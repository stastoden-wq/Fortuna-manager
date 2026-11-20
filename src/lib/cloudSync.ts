import {
  Unsubscribe,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  ClubDatabase,
  ClubProfile,
  LogoMaskMode,
  MatchItem,
  MediaGalleryItem,
  OpponentTeam,
  Player,
  SeasonTag,
} from '../types/club';
import { canonicalizeAssetUrl } from './assetUrl';
import { OperationType, firestoreDb, handleFirestoreError } from './firebase';

export type CloudSyncStatus =
  | 'local'
  | 'connecting'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'error';

const MAX_IMAGE_CHARS = 740_000;

function sanitizeId(raw: string, fallbackPrefix: string): string {
  const cleaned = (raw || '').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 120);
  return cleaned.length > 0 ? cleaned : `${fallbackPrefix}_${Date.now()}`;
}

function clampStr(val: string | undefined | null, maxLen: number, fallback = ''): string {
  const s = (val ?? fallback).toString();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function clampNum(val: number | undefined | null, min: number, max: number, fallback: number): number {
  const n = typeof val === 'number' && Number.isFinite(val) ? val : fallback;
  return Math.max(min, Math.min(max, n));
}

function sanitizeMask(val: LogoMaskMode | undefined): LogoMaskMode {
  return val === 'circle' || val === 'shield' || val === 'none' ? val : 'none';
}

function sanitizeImage(val: string | undefined | null): string {
  const canon = canonicalizeAssetUrl(val);
  if (canon.length <= MAX_IMAGE_CHARS) return canon;
  // Exceeds Firestore safe per-doc budget; keep empty rather than failing the whole sync
  console.warn('Image exceeds Firestore 740KB cap and was skipped from cloud doc:', canon.length);
  return '';
}

// Track docs known to exist in Firestore during this session to choose updateDoc vs setDoc cleanly
const existingRemoteDocs = new Set<string>();

function docKey(uid: string, col: string, id: string): string {
  return `${uid}/${col}/${id}`;
}

export function clearCloudDocCache(): void {
  existingRemoteDocs.clear();
}

// --- Serializers matching firebase-blueprint.json & firestore.rules 1:1 ---

function serializeProfileMutable(db: ClubDatabase) {
  const c = db.club;
  return {
    name: clampStr(c.name.trim() || 'Мой клуб', 120),
    shortName: clampStr((c.shortName || c.name || 'Клуб').trim(), 60),
    city: clampStr(c.city, 80),
    defaultVenue: clampStr(c.defaultVenue, 140),
    vkLink: clampStr(c.vkLink, 160),
    primaryColor: clampStr(c.primaryColor || '#8B1723', 20),
    secondaryColor: clampStr(c.secondaryColor || '#16181C', 20),
    accentColor: clampStr(c.accentColor || '#C8B289', 20),
    logoUrl: sanitizeImage(c.logoUrl),
    logoMask: sanitizeMask(c.logoMask),
    logoScale: clampNum(c.logoScale, 0.2, 5, 1.25),
    logoOffsetX: clampNum(c.logoOffsetX, -500, 500, 0),
    logoOffsetY: clampNum(c.logoOffsetY, -500, 500, 0),
    altLogoUrl: sanitizeImage(c.altLogoUrl),
    altLogoMask: sanitizeMask(c.altLogoMask),
    altLogoScale: clampNum(c.altLogoScale, 0.2, 5, 1.24),
    altLogoOffsetX: clampNum(c.altLogoOffsetX, -500, 500, 0),
    altLogoOffsetY: clampNum(c.altLogoOffsetY, -500, 500, 0),
    version: clampNum(db.version, 1, 100, 3),
    lastBackupAt: clampStr(db.lastBackupAt, 64),
  };
}

function serializeSeasonMutable(s: SeasonTag) {
  return {
    name: clampStr(s.name.trim() || 'Сезон', 120),
    seasonLabel: clampStr(s.seasonLabel, 80),
    isArchived: Boolean(s.isArchived),
  };
}

function serializeOpponentMutable(o: OpponentTeam) {
  return {
    name: clampStr(o.name.trim() || 'Соперник', 120),
    shortName: clampStr((o.shortName || o.name || 'Соперник').trim(), 60),
    city: '',
    logoUrl: sanitizeImage(o.logoUrl),
    logoMask: sanitizeMask(o.logoMask),
    logoScale: clampNum(o.logoScale, 0.2, 5, 1),
    logoOffsetX: clampNum(o.logoOffsetX, -500, 500, 0),
    logoOffsetY: clampNum(o.logoOffsetY, -500, 500, 0),
  };
}

function serializePlayerMutable(p: Player) {
  return {
    fullName: clampStr(p.fullName.trim() || 'Игрок', 120),
    shortName: clampStr((p.shortName || p.fullName || 'Игрок').trim(), 60),
    number: clampNum(p.number, 0, 999, 0),
    role: p.role === 'GK' ? 'GK' : 'FIELD',
    isCaptain: Boolean(p.isCaptain),
    isActive: Boolean(p.isActive),
    birthDate: clampStr(p.birthDate, 32),
    photoUrl: sanitizeImage(p.photoUrl),
    photoScale: clampNum(p.photoScale, 0.2, 5, 1),
    photoOffsetX: clampNum(p.photoOffsetX, -500, 500, 0),
    photoOffsetY: clampNum(p.photoOffsetY, -500, 500, 0),
  };
}

function serializeMatchMutable(m: MatchItem) {
  const safeEvents = (m.events || []).slice(0, 120).map((ev) => {
    const clean: Record<string, unknown> = {
      id: sanitizeId(ev.id, 'ev'),
      half: ev.half === 2 ? 2 : 1,
      minute: clampNum(ev.minute, 0, 120, 1),
      type: ev.type,
    };
    if (ev.playerId) clean.playerId = clampStr(ev.playerId, 128);
    if (ev.assistPlayerId) clean.assistPlayerId = clampStr(ev.assistPlayerId, 128);
    if (ev.concededGkId) clean.concededGkId = clampStr(ev.concededGkId, 128);
    if (ev.isPenalty) clean.isPenalty = true;
    return clean;
  });

  const penalties =
    m.penalties && typeof m.penalties === 'object'
      ? {
          our: clampNum(m.penalties.our, 0, 50, 0),
          opponent: clampNum(m.penalties.opponent, 0, 50, 0),
        }
      : null;

  return {
    date: clampStr(m.date, 32),
    time: clampStr(m.time, 16),
    venue: clampStr(m.venue, 160),
    isHome: Boolean(m.isHome),
    opponentId: clampStr(m.opponentId, 128),
    seasonTagId: clampStr(m.seasonTagId, 128),
    roundLabel: clampStr(m.roundLabel, 80),
    halfDuration: clampNum(m.halfDuration, 5, 60, 20),
    status: m.status === 'live' || m.status === 'finished' ? m.status : 'scheduled',
    isTechnical: Boolean(m.isTechnical),
    technicalWinner:
      m.technicalWinner === 'our' || m.technicalWinner === 'opponent' ? m.technicalWinner : null,
    penalties,
    gkHalf1Id: clampStr(m.gkHalf1Id, 128),
    gkHalf2Id: clampStr(m.gkHalf2Id, 128),
    mvpPlayerId: clampStr(m.mvpPlayerId, 128),
    lineupPlayerIds: (m.lineupPlayerIds || []).slice(0, 30).map((id) => clampStr(id, 128)),
    startingFiveIds: (m.startingFiveIds || []).slice(0, 11).map((id) => clampStr(id, 128)),
    events: safeEvents,
    coverPhotoUrl: sanitizeImage(m.coverPhotoUrl),
    coverPhotoScale: clampNum(m.coverPhotoScale, 0.2, 5, 1.02),
    coverPhotoOffsetX: clampNum(m.coverPhotoOffsetX, -500, 500, 0),
    coverPhotoOffsetY: clampNum(m.coverPhotoOffsetY, -500, 500, 0),
  };
}

function serializeMediaMutable(item: MediaGalleryItem) {
  return {
    title: clampStr(item.title.trim() || 'Медиа', 120),
    category:
      item.category === 'backdrop' || item.category === 'player' ? item.category : 'match',
    imageUrl: sanitizeImage(item.imageUrl),
    createdAtIso: clampStr(item.createdAt || new Date().toISOString(), 64),
  };
}

// --- Upsert / Delete helpers honoring immutable ownerId & createdAt rules ---

async function upsertDoc(
  uid: string,
  colName: string,
  rawId: string,
  mutableFields: Record<string, unknown>,
  includeIdField: boolean
): Promise<void> {
  const id = sanitizeId(rawId, colName);
  const path = `users/${uid}/${colName}/${id}`;
  const ref = doc(firestoreDb, 'users', uid, colName, id);
  const key = docKey(uid, colName, id);

  if (existingRemoteDocs.has(key)) {
    try {
      await updateDoc(ref, {
        ...mutableFields,
        updatedAt: serverTimestamp(),
      });
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('No document to update') && !msg.includes('not-found')) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
      existingRemoteDocs.delete(key);
    }
  }

  try {
    const createPayload: Record<string, unknown> = {
      ...mutableFields,
      ownerId: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (includeIdField) {
      createPayload.id = id;
    }
    await setDoc(ref, createPayload);
    existingRemoteDocs.add(key);
  } catch (err) {
    // If document actually existed remotely (e.g. created by second device), retry with updateDoc
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('permission') || msg.includes('PERMISSION_DENIED')) {
      try {
        await updateDoc(ref, {
          ...mutableFields,
          updatedAt: serverTimestamp(),
        });
        existingRemoteDocs.add(key);
        return;
      } catch (updateErr) {
        handleFirestoreError(updateErr, OperationType.WRITE, path);
      }
    }
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

async function removeDoc(uid: string, colName: string, rawId: string): Promise<void> {
  const id = sanitizeId(rawId, colName);
  const path = `users/${uid}/${colName}/${id}`;
  const ref = doc(firestoreDb, 'users', uid, colName, id);
  try {
    await deleteDoc(ref);
    existingRemoteDocs.delete(docKey(uid, colName, id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

function stableJson(val: unknown): string {
  return JSON.stringify(val);
}

/**
 * Computes minimal diff between prevDb and nextDb and writes only changed documents to Firestore.
 */
export async function syncDatabaseDiffToCloud(
  uid: string,
  prevDb: ClubDatabase,
  nextDb: ClubDatabase
): Promise<void> {
  const ops: Promise<void>[] = [];

  const prevProfile = serializeProfileMutable(prevDb);
  const nextProfile = serializeProfileMutable(nextDb);
  if (stableJson(prevProfile) !== stableJson(nextProfile)) {
    ops.push(upsertDoc(uid, 'profile', 'main', nextProfile, false));
  }

  const syncList = <T extends { id: string }>(
    colName: string,
    prevItems: T[],
    nextItems: T[],
    serialize: (item: T) => Record<string, unknown>
  ) => {
    const prevMap = new Map(prevItems.map((it) => [it.id, it]));
    const nextMap = new Map(nextItems.map((it) => [it.id, it]));

    for (const [id, item] of nextMap) {
      const old = prevMap.get(id);
      const nextSer = serialize(item);
      if (!old || stableJson(serialize(old)) !== stableJson(nextSer)) {
        ops.push(upsertDoc(uid, colName, id, nextSer, true));
      }
    }
    for (const id of prevMap.keys()) {
      if (!nextMap.has(id)) {
        ops.push(removeDoc(uid, colName, id));
      }
    }
  };

  syncList('seasons', prevDb.seasons || [], nextDb.seasons || [], serializeSeasonMutable);
  syncList('opponents', prevDb.opponents || [], nextDb.opponents || [], serializeOpponentMutable);
  syncList('players', prevDb.players || [], nextDb.players || [], serializePlayerMutable);
  syncList('matches', prevDb.matches || [], nextDb.matches || [], serializeMatchMutable);
  syncList(
    'mediaGallery',
    prevDb.mediaGallery || [],
    nextDb.mediaGallery || [],
    serializeMediaMutable
  );

  if (ops.length > 0) {
    await Promise.all(ops);
  }
}

/**
 * Replaces the entire cloud workspace with currentDb (used on first sign-in bootstrap,
 * clean reset, demo restore, or JSON backup import).
 */
export async function pushFullDatabaseToCloud(
  uid: string,
  currentDb: ClubDatabase
): Promise<void> {
  const replaceCollection = async <T extends { id: string }>(
    colName: string,
    items: T[],
    serialize: (item: T) => Record<string, unknown>
  ) => {
    const colPath = `users/${uid}/${colName}`;
    let existingSnap;
    try {
      existingSnap = await getDocs(
        query(collection(firestoreDb, 'users', uid, colName), where('ownerId', '==', uid))
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, colPath);
    }

    const nextIds = new Set(items.map((it) => sanitizeId(it.id, colName)));
    const ops: Promise<void>[] = [];

    existingSnap.forEach((snapDoc) => {
      existingRemoteDocs.add(docKey(uid, colName, snapDoc.id));
      if (!nextIds.has(snapDoc.id)) {
        ops.push(removeDoc(uid, colName, snapDoc.id));
      }
    });

    for (const item of items) {
      ops.push(upsertDoc(uid, colName, item.id, serialize(item), true));
    }

    await Promise.all(ops);
  };

  await upsertDoc(uid, 'profile', 'main', serializeProfileMutable(currentDb), false);
  await Promise.all([
    replaceCollection('seasons', currentDb.seasons || [], serializeSeasonMutable),
    replaceCollection('opponents', currentDb.opponents || [], serializeOpponentMutable),
    replaceCollection('players', currentDb.players || [], serializePlayerMutable),
    replaceCollection('matches', currentDb.matches || [], serializeMatchMutable),
    replaceCollection('mediaGallery', currentDb.mediaGallery || [], serializeMediaMutable),
  ]);
}

// --- Real-Time Multi-Device Subscription ---

export function subscribeUserClubDatabase(
  uid: string,
  localFallbackDb: ClubDatabase,
  onRemoteUpdate: (remoteDb: ClubDatabase) => void,
  onStatusChange: (status: CloudSyncStatus) => void,
  onError: (err: unknown) => void
): () => void {
  let cancelled = false;
  const unsubs: Unsubscribe[] = [];

  const state: {
    profileReady: boolean;
    seasonsReady: boolean;
    opponentsReady: boolean;
    playersReady: boolean;
    matchesReady: boolean;
    mediaReady: boolean;
    club: ClubProfile | null;
    version: number;
    lastBackupAt?: string;
    seasons: SeasonTag[];
    opponents: OpponentTeam[];
    players: Player[];
    matches: MatchItem[];
    mediaGallery: MediaGalleryItem[];
  } = {
    profileReady: false,
    seasonsReady: false,
    opponentsReady: false,
    playersReady: false,
    matchesReady: false,
    mediaReady: false,
    club: null,
    version: localFallbackDb.version || 3,
    lastBackupAt: localFallbackDb.lastBackupAt,
    seasons: [],
    opponents: [],
    players: [],
    matches: [],
    mediaGallery: [],
  };

  let emitTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleEmit = () => {
    if (
      cancelled ||
      !state.profileReady ||
      !state.seasonsReady ||
      !state.opponentsReady ||
      !state.playersReady ||
      !state.matchesReady ||
      !state.mediaReady ||
      !state.club
    ) {
      return;
    }
    if (emitTimer) clearTimeout(emitTimer);
    emitTimer = setTimeout(() => {
      if (cancelled || !state.club) return;
      onRemoteUpdate({
        version: state.version,
        updatedAt: new Date().toISOString(),
        ...(state.lastBackupAt ? { lastBackupAt: state.lastBackupAt } : {}),
        club: state.club,
        seasons: state.seasons,
        opponents: state.opponents,
        players: [...state.players].sort((a, b) => a.number - b.number),
        matches: [...state.matches].sort((a, b) =>
          `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`)
        ),
        mediaGallery: state.mediaGallery,
      });
      onStatusChange('synced');
    }, 120);
  };

  const start = async () => {
    onStatusChange('connecting');
    const profileRef = doc(firestoreDb, 'users', uid, 'profile', 'main');
    const profilePath = `users/${uid}/profile/main`;

    try {
      const snap = await getDoc(profileRef);
      if (cancelled) return;
      if (!snap.exists()) {
        // First time this Google account connects: upload current local DB to cloud
        onStatusChange('syncing');
        await pushFullDatabaseToCloud(uid, localFallbackDb);
        if (cancelled) return;
      } else {
        existingRemoteDocs.add(docKey(uid, 'profile', 'main'));
      }
    } catch (err) {
      if (cancelled) return;
      onStatusChange(navigator.onLine ? 'error' : 'offline');
      try {
        handleFirestoreError(err, OperationType.GET, profilePath);
      } catch (wrapped) {
        onError(wrapped);
      }
      return;
    }

    // 1. Profile listener
    unsubs.push(
      onSnapshot(
        profileRef,
        (snap) => {
          if (snap.exists()) {
            existingRemoteDocs.add(docKey(uid, 'profile', 'main'));
            const d = snap.data();
            state.club = {
              name: String(d.name || localFallbackDb.club.name),
              shortName: String(d.shortName || localFallbackDb.club.shortName),
              city: String(d.city || ''),
              defaultVenue: String(d.defaultVenue || ''),
              vkLink: String(d.vkLink || ''),
              primaryColor: String(d.primaryColor || '#8B1723'),
              secondaryColor: String(d.secondaryColor || '#16181C'),
              accentColor: String(d.accentColor || '#C8B289'),
              logoUrl: canonicalizeAssetUrl(String(d.logoUrl || '')),
              logoMask: sanitizeMask(d.logoMask),
              logoScale: Number(d.logoScale ?? 1.25),
              logoOffsetX: Number(d.logoOffsetX ?? 0),
              logoOffsetY: Number(d.logoOffsetY ?? 0),
              altLogoUrl: canonicalizeAssetUrl(String(d.altLogoUrl || '')),
              altLogoMask: sanitizeMask(d.altLogoMask),
              altLogoScale: Number(d.altLogoScale ?? 1.24),
              altLogoOffsetX: Number(d.altLogoOffsetX ?? 0),
              altLogoOffsetY: Number(d.altLogoOffsetY ?? 0),
            };
            state.version = Number(d.version ?? 3);
            state.lastBackupAt = d.lastBackupAt ? String(d.lastBackupAt) : undefined;
            state.profileReady = true;
            scheduleEmit();
          }
        },
        (err) => {
          onStatusChange(navigator.onLine ? 'error' : 'offline');
          try {
            handleFirestoreError(err, OperationType.GET, profilePath);
          } catch (wrapped) {
            onError(wrapped);
          }
        }
      )
    );

    const watchCollection = <T>(
      colName: string,
      mapDoc: (id: string, d: Record<string, unknown>) => T,
      assign: (items: T[]) => void
    ) => {
      const colPath = `users/${uid}/${colName}`;
      const q = query(collection(firestoreDb, 'users', uid, colName), where('ownerId', '==', uid));
      unsubs.push(
        onSnapshot(
          q,
          (snap) => {
            const list: T[] = [];
            snap.forEach((docSnap) => {
              existingRemoteDocs.add(docKey(uid, colName, docSnap.id));
              list.push(mapDoc(docSnap.id, docSnap.data() as Record<string, unknown>));
            });
            assign(list);
            scheduleEmit();
          },
          (err) => {
            onStatusChange(navigator.onLine ? 'error' : 'offline');
            try {
              handleFirestoreError(err, OperationType.LIST, colPath);
            } catch (wrapped) {
              onError(wrapped);
            }
          }
        )
      );
    };

    watchCollection<SeasonTag>(
      'seasons',
      (id, d) => ({
        id,
        name: String(d.name || ''),
        seasonLabel: String(d.seasonLabel || ''),
        isArchived: Boolean(d.isArchived),
      }),
      (items) => {
        state.seasons = items;
        state.seasonsReady = true;
      }
    );

    watchCollection<OpponentTeam>(
      'opponents',
      (id, d) => ({
        id,
        name: String(d.name || ''),
        shortName: String(d.shortName || ''),
        logoUrl: canonicalizeAssetUrl(String(d.logoUrl || '')),
        logoMask: sanitizeMask(d.logoMask as LogoMaskMode),
        logoScale: Number(d.logoScale ?? 1),
        logoOffsetX: Number(d.logoOffsetX ?? 0),
        logoOffsetY: Number(d.logoOffsetY ?? 0),
      }),
      (items) => {
        state.opponents = items;
        state.opponentsReady = true;
      }
    );

    watchCollection<Player>(
      'players',
      (id, d) => ({
        id,
        fullName: String(d.fullName || ''),
        shortName: String(d.shortName || ''),
        number: Number(d.number ?? 0),
        role: d.role === 'GK' ? 'GK' : 'FIELD',
        isCaptain: Boolean(d.isCaptain),
        isActive: d.isActive !== false,
        birthDate: String(d.birthDate || ''),
        photoUrl: canonicalizeAssetUrl(String(d.photoUrl || '')),
        photoScale: Number(d.photoScale ?? 1),
        photoOffsetX: Number(d.photoOffsetX ?? 0),
        photoOffsetY: Number(d.photoOffsetY ?? 0),
      }),
      (items) => {
        state.players = items;
        state.playersReady = true;
      }
    );

    watchCollection<MatchItem>(
      'matches',
      (id, d) => ({
        id,
        date: String(d.date || ''),
        time: String(d.time || ''),
        venue: String(d.venue || ''),
        isHome: d.isHome !== false,
        opponentId: String(d.opponentId || ''),
        seasonTagId: String(d.seasonTagId || ''),
        roundLabel: String(d.roundLabel || ''),
        halfDuration: Number(d.halfDuration) === 25 ? 25 : 20,
        status:
          d.status === 'live' || d.status === 'finished' ? d.status : 'scheduled',
        isTechnical: Boolean(d.isTechnical),
        technicalWinner:
          d.technicalWinner === 'our' || d.technicalWinner === 'opponent'
            ? d.technicalWinner
            : null,
        penalties:
          d.penalties && typeof d.penalties === 'object'
            ? {
                our: Number((d.penalties as { our?: number }).our ?? 0),
                opponent: Number((d.penalties as { opponent?: number }).opponent ?? 0),
              }
            : null,
        gkHalf1Id: String(d.gkHalf1Id || ''),
        gkHalf2Id: String(d.gkHalf2Id || ''),
        mvpPlayerId: String(d.mvpPlayerId || ''),
        lineupPlayerIds: Array.isArray(d.lineupPlayerIds) ? d.lineupPlayerIds.map(String) : [],
        startingFiveIds: Array.isArray(d.startingFiveIds) ? d.startingFiveIds.map(String) : [],
        events: Array.isArray(d.events) ? (d.events as MatchItem['events']) : [],
        coverPhotoUrl: canonicalizeAssetUrl(String(d.coverPhotoUrl || '')),
        coverPhotoScale: Number(d.coverPhotoScale ?? 1.02),
        coverPhotoOffsetX: Number(d.coverPhotoOffsetX ?? 0),
        coverPhotoOffsetY: Number(d.coverPhotoOffsetY ?? 0),
      }),
      (items) => {
        state.matches = items;
        state.matchesReady = true;
      }
    );

    watchCollection<MediaGalleryItem>(
      'mediaGallery',
      (id, d) => ({
        id,
        title: String(d.title || ''),
        category:
          d.category === 'backdrop' || d.category === 'player' ? d.category : 'match',
        imageUrl: canonicalizeAssetUrl(String(d.imageUrl || '')),
        createdAt: String(d.createdAtIso || ''),
      }),
      (items) => {
        state.mediaGallery = items;
        state.mediaReady = true;
      }
    );
  };

  void start();

  return () => {
    cancelled = true;
    if (emitTimer) clearTimeout(emitTimer);
    unsubs.forEach((fn) => fn());
  };
}
