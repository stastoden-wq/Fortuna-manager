import React, { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Circle,
  Cloud,
  CloudOff,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Settings,
  Users,
} from 'lucide-react';
import {
  ClubDatabase,
  ClubProfile,
  MatchItem,
  MediaGalleryItem,
  OpponentTeam,
  Player,
  PosterDraft,
  PosterMode,
  SeasonTag,
} from './types/club';
import { createCleanClubDatabase, createSeedDatabase } from './data/seedData';
import { loadClubDatabase, saveClubDatabase } from './lib/storage';
import { auth, signInWithGoogle, signOutFromCloud } from './lib/firebase';
import {
  CloudSyncStatus,
  clearCloudDocCache,
  pushFullDatabaseToCloud,
  subscribeUserClubDatabase,
  syncDatabaseDiffToCloud,
} from './lib/cloudSync';
import { getCurrentRuMonthYear } from './utils/vkPostText';
import { StudioView } from './components/StudioView';
import { MatchesView } from './components/MatchesView';
import { StatsView } from './components/StatsView';
import { RosterView } from './components/RosterView';
import { ClubSettingsView } from './components/ClubSettingsView';
import { LiveMatchModal } from './components/LiveMatchModal';
import { OfflineIndicator, PWAInstallButton } from './components/PWAControls';

type NavTab = 'studio' | 'matches' | 'stats' | 'roster' | 'club';

function createInitialPosterDraft(db: ClubDatabase): PosterDraft {
  const upcoming = db.matches.find((m) => m.status === 'scheduled') || db.matches[0];
  const captain = db.players.find((p) => p.isCaptain) || db.players[0];

  return {
    mode: 'matchday',
    format: '4:5',
    theme: 'midnight',
    layoutStyle: 'matchtv',
    showSafeZones: false,
    bgPreset: 'shushenskoe',
    bgOverlayOpacity: 0.62,
    bgCustomUrl: '',
    useAltLogo: false,
    matchId: upcoming?.id || '',
    seasonFilterId: 'all',
    matchdayPlayerId: '',
    matchdayKicker: '',
    lineupTitle: 'ЗАЯВКА НА МАТЧ',
    lineupSelectedIds: upcoming ? [...upcoming.lineupPlayerIds] : db.players.map((p) => p.id),
    lineupShowStartingFive: true,
    resultsHeadline: 'ИТОГ МАТЧА',
    resultsMvpNote: '',
    scorersMode: 'points',
    scorersLimit: 5,
    scorersTitle: '',
    gkTitle: 'ВРАТАРИ И СУХАРИ',
    eventPreset: 'birthday',
    eventPlayerId: captain?.id || '',
    eventUseCustomPhoto: false,
    eventCustomPhotoUrl: '',
    eventCustomPhotoScale: 1,
    eventCustomPhotoOffsetX: 0,
    eventCustomPhotoOffsetY: 0,
    eventHeadline: captain ? `${captain.fullName}!` : 'С ДНЁМ РОЖДЕНИЯ!',
    eventSubtitle:
      'Желаем крепкого здоровья, ярких побед, красивых голов и неиссякаемой энергии на паркете!',
    eventBadgeText: 'С ДНЁМ РОЖДЕНИЯ!',
  };
}

export default function App() {
  const [db, setDb] = useState<ClubDatabase | null>(null);
  const [dbLoaded, setDbLoaded] = useState(false);
  const dbRef = useRef<ClubDatabase | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('studio');
  const [posterDraft, setPosterDraft] = useState<PosterDraft | null>(null);
  const [liveMatchId, setLiveMatchId] = useState<string | null>(null);
  const [createMatchTrigger, setCreateMatchTrigger] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  // Firebase Auth & Real-Time Cloud Sync state
  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const cloudUserRef = useRef<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>('local');
  const [cloudError, setCloudError] = useState<string | null>(null);
  const syncQueueRef = useRef<Promise<void>>(Promise.resolve());

  const notify = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // 1. Load local offline-first IndexedDB database immediately
  useEffect(() => {
    let active = true;
    loadClubDatabase().then((loaded) => {
      if (!active) return;
      dbRef.current = loaded;
      setDb(loaded);
      setPosterDraft(createInitialPosterDraft(loaded));
      setDbLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // 2. Listen to Firebase Authentication state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      cloudUserRef.current = user;
      setCloudUser(user);
      setAuthReady(true);
      if (!user) {
        clearCloudDocCache();
        setCloudStatus('local');
        setCloudError(null);
      }
    });
    return () => unsub();
  }, []);

  // 3. Apply incoming remote snapshot to local state & IndexedDB (never echoes back to Firestore)
  const applyRemoteDb = useCallback((remoteDb: ClubDatabase) => {
    dbRef.current = remoteDb;
    setDb(remoteDb);
    saveClubDatabase(remoteDb).catch(() => {});
    setCloudError(null);
    setPosterDraft((prev) => {
      if (!prev) return createInitialPosterDraft(remoteDb);
      const matchExists =
        Boolean(prev.matchId) && remoteDb.matches.some((m) => m.id === prev.matchId);
      if (matchExists) return prev;
      const fallbackMatch =
        remoteDb.matches.find((m) => m.status === 'scheduled') || remoteDb.matches[0];
      return {
        ...prev,
        matchId: fallbackMatch?.id || '',
        lineupSelectedIds: fallbackMatch
          ? [...fallbackMatch.lineupPlayerIds]
          : prev.lineupSelectedIds,
      };
    });
  }, []);

  // 4. Real-time multi-device subscription once both Auth and local IndexedDB are ready
  useEffect(() => {
    if (!authReady || !dbLoaded || !cloudUser || !dbRef.current) return;
    const unsubscribe = subscribeUserClubDatabase(
      cloudUser.uid,
      dbRef.current,
      applyRemoteDb,
      setCloudStatus,
      (err) => {
        const raw = err instanceof Error ? err.message : String(err);
        setCloudError(
          raw.includes('permission') || raw.includes('PERMISSION_DENIED')
            ? 'Нет доступа к облачной базе. Попробуйте выйти и войти снова.'
            : 'Не удалось синхронизироваться с облаком — локальные данные сохранены.'
        );
      }
    );
    return () => unsubscribe();
  }, [authReady, dbLoaded, cloudUser, applyRemoteDb]);

  // Helper to serialize outgoing cloud mutations safely
  const enqueueCloudSync = useCallback((task: () => Promise<void>) => {
    syncQueueRef.current = syncQueueRef.current
      .catch(() => {})
      .then(async () => {
        setCloudStatus('syncing');
        try {
          await task();
          setCloudError(null);
          setCloudStatus('synced');
        } catch (err) {
          const offline = typeof navigator !== 'undefined' && !navigator.onLine;
          setCloudStatus(offline ? 'offline' : 'error');
          if (!offline) {
            const msg = err instanceof Error ? err.message : String(err);
            setCloudError(
              msg.includes('permission') || msg.includes('PERMISSION_DENIED')
                ? 'Ошибка прав доступа Firestore. Проверьте вход в Google.'
                : 'Ошибка сохранения в облако — локальная копия в порядке.'
            );
          }
        }
      });
  }, []);

  const mutateDb = useCallback(
    (updater: (prev: ClubDatabase) => ClubDatabase) => {
      const prev = dbRef.current;
      if (!prev) return;
      const next = updater(prev);
      dbRef.current = next;
      setDb(next);
      saveClubDatabase(next).catch(() => {});

      const uid = cloudUserRef.current?.uid;
      if (uid) {
        enqueueCloudSync(() => syncDatabaseDiffToCloud(uid, prev, next));
      }
    },
    [enqueueCloudSync]
  );

  const handleUpdateClub = useCallback(
    (patch: Partial<ClubProfile>) => {
      mutateDb((prev) => ({
        ...prev,
        club: { ...prev.club, ...patch },
      }));
    },
    [mutateDb]
  );

  const handleAddSeason = useCallback(
    (season: SeasonTag) => {
      mutateDb((prev) => ({ ...prev, seasons: [...prev.seasons, season] }));
    },
    [mutateDb]
  );

  const handleDeleteSeason = useCallback(
    (seasonId: string) => {
      mutateDb((prev) => ({
        ...prev,
        seasons: prev.seasons.filter((s) => s.id !== seasonId),
      }));
      notify('Турнирный тег удалён');
    },
    [mutateDb, notify]
  );

  const handleAddPlayer = useCallback(
    (player: Player) => {
      mutateDb((prev) => ({ ...prev, players: [...prev.players, player] }));
      notify(`Игрок #${player.number} ${player.shortName} добавлен`);
    },
    [mutateDb, notify]
  );

  const handleUpdatePlayer = useCallback(
    (player: Player) => {
      mutateDb((prev) => ({
        ...prev,
        players: prev.players.map((p) => (p.id === player.id ? player : p)),
      }));
      notify('Карточка игрока сохранена');
    },
    [mutateDb, notify]
  );

  const handleUpdatePlayerCrop = useCallback(
    (playerId: string, patch: Partial<Player>) => {
      mutateDb((prev) => ({
        ...prev,
        players: prev.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)),
      }));
    },
    [mutateDb]
  );

  const handleDeletePlayer = useCallback(
    (playerId: string) => {
      mutateDb((prev) => ({
        ...prev,
        players: prev.players.filter((p) => p.id !== playerId),
      }));
      notify('Игрок удалён из состава');
    },
    [mutateDb, notify]
  );

  const handleAddOpponent = useCallback(
    (opp: OpponentTeam) => {
      mutateDb((prev) => ({ ...prev, opponents: [...prev.opponents, opp] }));
      notify(`Соперник «${opp.shortName}» добавлен`);
    },
    [mutateDb, notify]
  );

  const handleUpdateOpponent = useCallback(
    (opp: OpponentTeam) => {
      mutateDb((prev) => ({
        ...prev,
        opponents: prev.opponents.map((o) => (o.id === opp.id ? opp : o)),
      }));
      notify('Данные соперника обновлены');
    },
    [mutateDb, notify]
  );

  const handleDeleteOpponent = useCallback(
    (oppId: string) => {
      mutateDb((prev) => ({
        ...prev,
        opponents: prev.opponents.filter((o) => o.id !== oppId),
      }));
      notify('Соперник удалён');
    },
    [mutateDb, notify]
  );

  const handleAddMatch = useCallback(
    (match: MatchItem) => {
      mutateDb((prev) => ({ ...prev, matches: [match, ...prev.matches] }));
      setPosterDraft((prev) =>
        prev
          ? { ...prev, matchId: match.id, lineupSelectedIds: [...match.lineupPlayerIds] }
          : prev
      );
      notify('Матч добавлен в расписание');
    },
    [mutateDb, notify]
  );

  const handleUpdateMatch = useCallback(
    (match: MatchItem) => {
      mutateDb((prev) => ({
        ...prev,
        matches: prev.matches.map((m) => (m.id === match.id ? match : m)),
      }));
    },
    [mutateDb]
  );

  const handleSyncMatchLineup = useCallback(
    (matchId: string, lineupPlayerIds: string[]) => {
      mutateDb((prev) => ({
        ...prev,
        matches: prev.matches.map((m) =>
          m.id === matchId
            ? {
                ...m,
                lineupPlayerIds,
                startingFiveIds: m.startingFiveIds.filter((id) => lineupPlayerIds.includes(id)),
              }
            : m
        ),
      }));
    },
    [mutateDb]
  );

  const handleUpdateMatchCover = useCallback(
    (matchId: string, patch: Partial<MatchItem>) => {
      mutateDb((prev) => ({
        ...prev,
        matches: prev.matches.map((m) => (m.id === matchId ? { ...m, ...patch } : m)),
      }));
    },
    [mutateDb]
  );

  const handleDeleteMatch = useCallback(
    (matchId: string) => {
      let nextMatch: MatchItem | undefined;
      mutateDb((prev) => {
        const remaining = prev.matches.filter((m) => m.id !== matchId);
        nextMatch = remaining[0];
        return {
          ...prev,
          matches: remaining,
        };
      });
      setPosterDraft((prev) => {
        if (!prev || prev.matchId !== matchId) return prev;
        return {
          ...prev,
          matchId: nextMatch?.id || '',
          lineupSelectedIds: nextMatch ? [...nextMatch.lineupPlayerIds] : [],
        };
      });
      notify('Матч удалён');
    },
    [mutateDb, notify]
  );

  const handleOpenMatchPoster = useCallback(
    (mode: PosterMode, matchId: string) => {
      const target = db?.matches.find((m) => m.id === matchId);
      const isSummer =
        target?.venue?.toLowerCase().includes('газон') ||
        target?.venue?.toLowerCase().includes('стадион');
      const isShush = target?.venue?.toLowerCase().includes('шушен');
      setPosterDraft((prev) =>
        prev
          ? {
              ...prev,
              mode,
              matchId,
              bgPreset: isSummer ? 'summer_pitch' : isShush ? 'shushenskoe' : prev.bgPreset,
              lineupSelectedIds: target ? [...target.lineupPlayerIds] : prev.lineupSelectedIds,
            }
          : prev
      );
      setActiveTab('studio');
    },
    [db]
  );

  const handleOpenStatsPoster = useCallback(
    (mode: Extract<PosterMode, 'scorers' | 'goalkeepers'>, seasonId: string) => {
      setPosterDraft((prev) =>
        prev ? { ...prev, mode, seasonFilterId: seasonId, bgPreset: 'fortuna_arena' } : prev
      );
      setActiveTab('studio');
    },
    []
  );

  const handleAddMediaItem = useCallback(
    (item: MediaGalleryItem) => {
      mutateDb((prev) => ({
        ...prev,
        mediaGallery: [item, ...(prev.mediaGallery || [])],
      }));
    },
    [mutateDb]
  );

  const handleDeleteMediaItem = useCallback(
    (id: string) => {
      mutateDb((prev) => ({
        ...prev,
        mediaGallery: (prev.mediaGallery || []).filter((m) => m.id !== id),
      }));
      notify('Кадр удалён из медиатеки');
    },
    [mutateDb, notify]
  );

  const handleOpenPlayerEventPoster = useCallback(
    (
      playerId: string,
      preset: 'birthday' | 'welcome' | 'potm_winner' | 'potm_vote' = 'birthday'
    ) => {
      const pl = db?.players.find((p) => p.id === playerId) || db?.players[0];
      const monthLabel = getCurrentRuMonthYear();
      const isWelcome = preset === 'welcome';
      const isPotmVote = preset === 'potm_vote';
      const isPotmWinner = preset === 'potm_winner';

      setPosterDraft((prev) =>
        prev
          ? {
              ...prev,
              mode: 'club_event',
              bgPreset: 'fortuna_arena',
              theme: isWelcome ? 'club' : 'gold',
              eventPreset: preset,
              eventPlayerId: playerId || pl?.id || '',
              eventUseCustomPhoto: false,
              eventBadgeText: isPotmVote
                ? `ГОЛОСОВАНИЕ · ${monthLabel}`
                : isPotmWinner
                ? `MVP МЕСЯЦА · ${monthLabel}`
                : isWelcome
                ? 'ДОБРО ПОЖАЛОВАТЬ!'
                : 'С ДНЁМ РОЖДЕНИЯ!',
              eventHeadline: isPotmVote
                ? 'ЛУЧШИЙ ИГРОК МЕСЯЦА'
                : isPotmWinner && pl
                ? pl.fullName
                : pl
                ? isWelcome
                  ? pl.fullName
                  : `${pl.fullName}!`
                : isWelcome
                ? 'НОВЫЙ ИГРОК КЛУБА'
                : 'С ДНЁМ РОЖДЕНИЯ!',
              eventSubtitle: isPotmVote
                ? 'Кто достоин звания MVP? Пишите фамилию в комментариях или голосуйте в опросе ВК!'
                : isPotmWinner
                ? `По итогам голосования болельщиков признан лучшим игроком ${db?.club.name || 'клуба'}!`
                : isWelcome
                ? `Игровой номер #${pl?.number ?? '—'}. Добро пожаловать в красно-чёрную семью!`
                : 'Желаем крепкого здоровья, ярких побед, красивых голов и неиссякаемой энергии на паркете!',
            }
          : prev
      );
      setActiveTab('studio');
    },
    [db]
  );

  const handleImportDatabase = useCallback(
    (nextDb: ClubDatabase) => {
      dbRef.current = nextDb;
      setDb(nextDb);
      saveClubDatabase(nextDb).catch(() => {});
      setPosterDraft(createInitialPosterDraft(nextDb));
      const uid = cloudUserRef.current?.uid;
      if (uid) {
        enqueueCloudSync(() => pushFullDatabaseToCloud(uid, nextDb));
      }
    },
    [enqueueCloudSync]
  );

  const handleClearDemoData = useCallback(() => {
    const current = dbRef.current;
    if (!current) return;
    const clean = createCleanClubDatabase(current);
    dbRef.current = clean;
    setDb(clean);
    saveClubDatabase(clean).catch(() => {});
    setPosterDraft(createInitialPosterDraft(clean));
    const uid = cloudUserRef.current?.uid;
    if (uid) {
      enqueueCloudSync(() => pushFullDatabaseToCloud(uid, clean));
    }
    notify('Демо-данные очищены — брендбук клуба сохранён');
  }, [enqueueCloudSync, notify]);

  const handleResetDemo = useCallback(() => {
    const fresh = createSeedDatabase();
    dbRef.current = fresh;
    setDb(fresh);
    saveClubDatabase(fresh).catch(() => {});
    setPosterDraft(createInitialPosterDraft(fresh));
    const uid = cloudUserRef.current?.uid;
    if (uid) {
      enqueueCloudSync(() => pushFullDatabaseToCloud(uid, fresh));
    }
    notify('Применён брендбук ФК «Фортуна» (Шушенское)');
  }, [enqueueCloudSync, notify]);

  const handleGoogleSignIn = useCallback(async () => {
    setCloudError(null);
    try {
      await signInWithGoogle();
      notify('Вход через Google выполнен — облачная синхронизация активна');
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        notify('Вход через Google отменён');
        return;
      }
      if (code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        setCloudError(
          `Домен «${host}» ещё не добавлен в Firebase Authentication → Settings → Authorized domains.`
        );
        notify('Добавьте домен сайта в Authorized domains в Firebase');
        return;
      }
      if (code === 'auth/popup-blocked') {
        setCloudError('Браузер заблокировал окно входа Google. Разрешите всплывающие окна.');
        notify('Разрешите всплывающие окна для входа через Google');
        return;
      }
      setCloudError('Не удалось войти через Google. Проверьте подключение к интернету.');
      notify('Ошибка входа через Google');
    }
  }, [notify]);

  const handleGoogleSignOut = useCallback(async () => {
    try {
      await signOutFromCloud();
      clearCloudDocCache();
      setCloudStatus('local');
      setCloudError(null);
      notify('Облако отключено — локальная база сохранена на устройстве');
    } catch {
      notify('Не удалось выйти из аккаунта');
    }
  }, [notify]);

  const handleForceCloudSync = useCallback(async () => {
    const uid = cloudUserRef.current?.uid;
    const current = dbRef.current;
    if (!uid || !current) return;
    enqueueCloudSync(() => pushFullDatabaseToCloud(uid, current));
    await syncQueueRef.current;
    notify('База клуба синхронизирована с облаком');
  }, [enqueueCloudSync, notify]);

  const handleMarkBackupExported = useCallback(() => {
    mutateDb((prev) => ({
      ...prev,
      lastBackupAt: new Date().toISOString(),
    }));
  }, [mutateDb]);

  const handleNewMatchQuickAction = useCallback(() => {
    setActiveTab('matches');
    setCreateMatchTrigger((c) => c + 1);
  }, []);

  if (!db || !posterDraft) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090B10] text-slate-300">
        <div className="text-center space-y-2">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-[#C8B289] border-t-transparent" />
          <p className="text-xs font-medium text-slate-400">Загрузка локальной базы клуба…</p>
        </div>
      </div>
    );
  }

  const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'studio', label: 'Студия', icon: <ImageIcon className="w-5 h-5" /> },
    { id: 'matches', label: 'Матчи', icon: <CalendarDays className="w-5 h-5" /> },
    { id: 'stats', label: 'Статистика', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'roster', label: 'Состав', icon: <Users className="w-5 h-5" /> },
    { id: 'club', label: 'Клуб', icon: <Settings className="w-5 h-5" /> },
  ];

  const activeLiveMatch = liveMatchId ? db.matches.find((m) => m.id === liveMatchId) : undefined;
  const showOnboarding = db.players.length === 0 || db.matches.length === 0;
  const hasBrand = Boolean(db.club.name.trim() && db.club.logoUrl);
  const hasRoster = db.players.length > 0 && db.opponents.length > 0;
  const hasMatches = db.matches.length > 0;

  return (
    <div className="min-h-screen bg-[#090B10] text-slate-100 pb-20 md:pb-10">
      {/* Desktop Top Bar — Strict 3-Zone Contract */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#090B10]/92 backdrop-blur-md">
        <div className="mx-auto flex h-14 md:h-16 max-w-[1440px] items-center justify-between gap-8 px-4 sm:px-6">
          {/* Zone 1: Single-element Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('studio')}
            className="font-display text-sm sm:text-base font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            {db.club.name}
          </button>

          {/* Zone 2: 5 clean single-line text nav links (Desktop) */}
          <nav className="hidden md:flex items-center gap-7" aria-label="Основная навигация">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`relative py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active ? 'text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {item.label}
                  {active && (
                    <span className="absolute inset-x-0 -bottom-[19px] h-[2px] bg-[#C8B289]" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Cloud Sync Shortcut + Primary Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('club')}
              title={
                cloudUser
                  ? cloudStatus === 'synced'
                    ? `Облако: синхронизировано (${cloudUser.email || 'Google'})`
                    : cloudStatus === 'syncing' || cloudStatus === 'connecting'
                    ? 'Облако: синхронизация…'
                    : cloudStatus === 'offline'
                    ? 'Облако: офлайн — данные ждут сеть'
                    : 'Облако: проверьте синхронизацию'
                  : 'Подключить облачную синхронизацию Телефон ↔ ПК'
              }
              aria-label="Облачная синхронизация"
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg border min-h-[38px] px-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                cloudUser
                  ? cloudStatus === 'error'
                    ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                    : cloudStatus === 'offline'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                    : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15'
                  : 'border-white/15 bg-[#14161C] text-slate-300 hover:border-[#C8B289]/50 hover:text-white'
              }`}
            >
              {cloudUser ? (
                cloudStatus === 'syncing' || cloudStatus === 'connecting' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : cloudStatus === 'offline' || cloudStatus === 'error' ? (
                  <CloudOff className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <Cloud className="w-3.5 h-3.5 shrink-0" />
                )
              ) : (
                <Cloud className="w-3.5 h-3.5 text-[#C8B289] shrink-0" />
              )}
              <span className="hidden sm:inline">
                {cloudUser
                  ? cloudStatus === 'syncing' || cloudStatus === 'connecting'
                    ? 'Синхр…'
                    : cloudStatus === 'offline'
                    ? 'Офлайн'
                    : cloudStatus === 'error'
                    ? 'Ошибка'
                    : 'Облако'
                  : 'Войти'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleNewMatchQuickAction}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B1723] px-3.5 sm:px-4 min-h-[38px] text-xs font-bold text-white hover:bg-[#A31D2B] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Новый матч</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-6 space-y-5">
        {/* Clean-Slate Onboarding Checklist */}
        {showOnboarding && (
          <div className="rounded-2xl border border-[#C8B289]/30 bg-[#14161C] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="font-display text-sm font-bold text-white">
                  Быстрый старт нового сезона
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Пройдите 3 шага, чтобы выпускать афиши и итоги матчей ВК за 1 минуту
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setActiveTab('club')}
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors cursor-pointer ${
                  hasBrand
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-white/10 bg-[#0E1014] hover:border-[#C8B289]/50'
                }`}
              >
                {hasBrand ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-[#C8B289] shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white">1. Логотип и палитра</p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {hasBrand ? 'Брендбук настроен' : 'Загрузите эмблему в разделе «Клуб»'}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('roster')}
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors cursor-pointer ${
                  hasRoster
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-white/10 bg-[#0E1014] hover:border-[#C8B289]/50'
                }`}
              >
                {hasRoster ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-[#C8B289] shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white">2. Состав и соперники</p>
                  <p className="text-[11px] text-slate-400 truncate">
                    Игроков: {db.players.length} · Соперников: {db.opponents.length}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={handleNewMatchQuickAction}
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors cursor-pointer ${
                  hasMatches
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-[#8B1723]/60 bg-[#8B1723]/12 hover:bg-[#8B1723]/20'
                }`}
              >
                {hasMatches ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-[#C8B289] shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white">3. Первый матч и постер</p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {hasMatches ? `Матчей: ${db.matches.length}` : 'Создайте матч для афиши ВК'}
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'studio' && (
          <StudioView
            db={db}
            draft={posterDraft}
            onChangeDraft={(updater) => setPosterDraft((prev) => (prev ? updater(prev) : prev))}
            onUpdatePlayerCrop={handleUpdatePlayerCrop}
            onSyncMatchLineup={handleSyncMatchLineup}
            onUpdateMatchCover={handleUpdateMatchCover}
            onAddMediaItem={handleAddMediaItem}
            onDeleteMediaItem={handleDeleteMediaItem}
            onCreateMatchQuick={handleNewMatchQuickAction}
            onNotify={notify}
          />
        )}

        {activeTab === 'matches' && (
          <MatchesView
            db={db}
            openCreateTrigger={createMatchTrigger}
            onAddMatch={handleAddMatch}
            onUpdateMatch={handleUpdateMatch}
            onDeleteMatch={handleDeleteMatch}
            onQuickAddOpponent={handleAddOpponent}
            onOpenLiveProtocol={(id) => setLiveMatchId(id)}
            onOpenPoster={handleOpenMatchPoster}
          />
        )}

        {activeTab === 'stats' && (
          <StatsView
            db={db}
            onOpenStatsPoster={handleOpenStatsPoster}
            onOpenBirthdayPoster={(id) => handleOpenPlayerEventPoster(id, 'birthday')}
            onOpenPotmPoster={(preset, playerId) =>
              handleOpenPlayerEventPoster(playerId || '', preset)
            }
          />
        )}

        {activeTab === 'roster' && (
          <RosterView
            db={db}
            onAddPlayer={handleAddPlayer}
            onUpdatePlayer={handleUpdatePlayer}
            onDeletePlayer={handleDeletePlayer}
            onAddOpponent={handleAddOpponent}
            onUpdateOpponent={handleUpdateOpponent}
            onDeleteOpponent={handleDeleteOpponent}
            onOpenPlayerPoster={handleOpenPlayerEventPoster}
          />
        )}

        {activeTab === 'club' && (
          <ClubSettingsView
            db={db}
            cloudUser={cloudUser}
            cloudStatus={cloudStatus}
            cloudError={cloudError}
            onGoogleSignIn={handleGoogleSignIn}
            onGoogleSignOut={handleGoogleSignOut}
            onForceCloudSync={handleForceCloudSync}
            onUpdateClub={handleUpdateClub}
            onAddSeason={handleAddSeason}
            onDeleteSeason={handleDeleteSeason}
            onImportDatabase={handleImportDatabase}
            onClearDemoData={handleClearDemoData}
            onResetDemo={handleResetDemo}
            onMarkBackupExported={handleMarkBackupExported}
            onNotify={notify}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Мобильная навигация"
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-white/10 bg-[#0B0D14]/95 backdrop-blur-md pb-safe"
      >
        <div className="grid grid-cols-5 h-15 items-center">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center min-h-[48px] transition-colors cursor-pointer ${
                  active ? 'text-[#C8B289]' : 'text-slate-400'
                }`}
              >
                {item.icon}
                <span className="mt-1 text-[10px] font-semibold tracking-tight leading-none">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Live Match Pitchside Protocol Modal */}
      {activeLiveMatch && (
        <LiveMatchModal
          db={db}
          match={activeLiveMatch}
          onSave={handleUpdateMatch}
          onClose={() => setLiveMatchId(null)}
          onOpenResultsPoster={(mId) => handleOpenMatchPoster('results', mId)}
        />
      )}

      {/* Subtle Install Prompt Floating on Desktop */}
      <div className="fixed bottom-5 right-5 z-30 hidden md:block">
        <PWAInstallButton compact />
      </div>

      {/* Offline Indicator */}
      <OfflineIndicator />

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className="fixed top-18 right-4 z-50 rounded-xl border border-[#C8B289]/45 bg-[#14161C]/95 px-4 py-2.5 text-xs font-semibold text-white shadow-xl backdrop-blur-md"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
