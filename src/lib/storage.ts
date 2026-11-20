import { ClubDatabase } from '../types/club';
import { createSeedDatabase } from '../data/seedData';

const DB_NAME = 'club_media_studio_db';
const DB_VERSION = 1;
const STORE_NAME = 'state';
const RECORD_KEY = 'club_database_v1';
const FALLBACK_LS_KEY = 'club_media_studio_fallback_v1';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadClubDatabase(): Promise<ClubDatabase> {
  try {
    const db = await openDatabase();
    const record = await new Promise<ClubDatabase | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(RECORD_KEY);
      req.onsuccess = () => resolve(req.result as ClubDatabase | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (record && record.club && Array.isArray(record.players) && Array.isArray(record.matches)) {
      if ((record.version || 1) < 2 && record.club.name === 'МФК Авангард') {
        const upgraded = createSeedDatabase();
        await saveClubDatabase(upgraded);
        return upgraded;
      }
      if ((record.version || 1) < 3 && record.club.name === 'ФК Фортуна') {
        const fresh = createSeedDatabase();
        const upgraded: ClubDatabase = {
          ...record,
          version: 3,
          club: {
            ...record.club,
            defaultVenue: record.club.defaultVenue || fresh.club.defaultVenue,
            primaryColor: fresh.club.primaryColor,
            secondaryColor: fresh.club.secondaryColor,
            accentColor: fresh.club.accentColor,
            logoUrl: fresh.club.logoUrl,
            logoMask: fresh.club.logoMask,
            altLogoUrl: fresh.club.altLogoUrl,
            altLogoMask: fresh.club.altLogoMask,
            logoScale: fresh.club.logoScale,
            logoOffsetX: fresh.club.logoOffsetX,
            logoOffsetY: fresh.club.logoOffsetY,
            altLogoScale: fresh.club.altLogoScale,
            altLogoOffsetX: fresh.club.altLogoOffsetX,
            altLogoOffsetY: fresh.club.altLogoOffsetY,
          },
        };
        await saveClubDatabase(upgraded);
        return upgraded;
      }
      const fixAssetUrl = (u?: string) =>
        typeof u === 'string' && u.startsWith('/src/assets/images/')
          ? u.replace('/src/assets/images/', '/assets/images/')
          : u;

      const fresh = createSeedDatabase();
      const freshGallery = fresh.mediaGallery || [];
      const rawGallery = Array.isArray(record.mediaGallery) ? record.mediaGallery : freshGallery;
      const migratedGallery = rawGallery.map((item) => ({
        ...item,
        imageUrl: fixAssetUrl(item.imageUrl) || item.imageUrl,
      }));
      const potmDefault = freshGallery.find((g) => g.id === 'mg_potm_mystery');
      const finalGallery =
        potmDefault && !migratedGallery.some((g) => g.id === 'mg_potm_mystery')
          ? [...migratedGallery, potmDefault]
          : migratedGallery;

      const normalized: ClubDatabase = {
        ...record,
        mediaGallery: finalGallery,
        matches: record.matches.map((m) =>
          m.coverPhotoUrl ? { ...m, coverPhotoUrl: fixAssetUrl(m.coverPhotoUrl) } : m
        ),
        club: {
          ...record.club,
          logoUrl: fixAssetUrl(record.club.logoUrl) || record.club.logoUrl,
          altLogoUrl: fixAssetUrl(record.club.altLogoUrl) ?? '',
          defaultVenue: record.club.defaultVenue ?? (record.club.city ? `ФСЦ «${record.club.city}»` : ''),
          altLogoScale: record.club.altLogoScale ?? 1.24,
          altLogoOffsetX: record.club.altLogoOffsetX ?? 0,
          altLogoOffsetY: record.club.altLogoOffsetY ?? 0,
        },
      };
      return normalized;
    }
  } catch {
    // Fallback to localStorage if IndexedDB blocked
    try {
      const raw = localStorage.getItem(FALLBACK_LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ClubDatabase;
        if (parsed && parsed.club && Array.isArray(parsed.players)) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
  }
  const seed = createSeedDatabase();
  await saveClubDatabase(seed);
  return seed;
}

export async function saveClubDatabase(data: ClubDatabase): Promise<void> {
  const payload: ClubDatabase = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(payload, RECORD_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
  } catch {
    try {
      localStorage.setItem(FALLBACK_LS_KEY, JSON.stringify(payload));
    } catch {
      // Quota exceeded in fallback storage
    }
  }
}

export function exportDatabaseToJson(data: ClubDatabase): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (data.club.shortName || 'club')
    .toLowerCase()
    .replace(/[^a-zа-я0-9_-]+/gi, '_');
  const datePart = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `media_studio_${safeName}_${datePart}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importDatabaseFromFile(file: File): Promise<ClubDatabase> {
  const text = await file.text();
  const parsed = JSON.parse(text) as Partial<ClubDatabase>;
  if (
    !parsed ||
    !parsed.club ||
    typeof parsed.club.name !== 'string' ||
    !Array.isArray(parsed.players) ||
    !Array.isArray(parsed.opponents) ||
    !Array.isArray(parsed.matches) ||
    !Array.isArray(parsed.seasons)
  ) {
    throw new Error('Файл не соответствует формату резервной копии Клубной Медиа-Студии.');
  }
  return {
    version: parsed.version || 3,
    updatedAt: new Date().toISOString(),
    lastBackupAt: parsed.lastBackupAt,
    club: parsed.club,
    seasons: parsed.seasons,
    opponents: parsed.opponents,
    players: parsed.players,
    matches: parsed.matches,
    mediaGallery: Array.isArray(parsed.mediaGallery) ? parsed.mediaGallery : createSeedDatabase().mediaGallery,
  };
}

/**
 * Reads an uploaded image (PNG/WebP/JPEG) and resizes if gigantic while strictly preserving PNG alpha transparency.
 */
export function processImageUpload(file: File, maxDimension = 1400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать файл изображения.'));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (file.type === 'image/svg+xml') {
        resolve(dataUrl);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (w <= maxDimension && h <= maxDimension) {
          resolve(dataUrl);
          return;
        }
        const ratio = Math.min(maxDimension / w, maxDimension / h);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w * ratio);
        canvas.height = Math.round(h * ratio);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const preserveAlpha = file.type === 'image/png' || file.type === 'image/webp';
        resolve(canvas.toDataURL(preserveAlpha ? 'image/png' : 'image/jpeg', 0.92));
      };
      img.onerror = () => reject(new Error('Некорректный формат изображения.'));
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
