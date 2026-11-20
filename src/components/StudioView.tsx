import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  BookmarkPlus,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Copy,
  Download,
  Eye,
  FileText,
  FolderHeart,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  Package,
  Palette,
  Plus,
  RotateCcw,
  Share2,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Trophy,
  Upload,
  Users,
} from 'lucide-react';
import {
  ClubDatabase,
  ClubEventPreset,
  MatchItem,
  MediaGalleryCategory,
  MediaGalleryItem,
  Player,
  PosterBackgroundPreset,
  PosterDraft,
  PosterFormat,
  PosterLayoutStyle,
  PosterMode,
  PosterThemeId,
} from '../types/club';
import { POSTER_BG_PRESETS } from '../data/brandAssets';
import { resolveAssetUrl } from '../lib/assetUrl';
import { processImageUpload } from '../lib/storage';
import {
  POSTER_DIMENSIONS,
  buildBroadcastTheme,
  copyPosterPngToClipboard,
  downloadPosterPack,
  downloadPosterPng,
  renderPosterToCanvas,
  sharePosterPng,
} from '../utils/canvasPosterExport';
import { computeFieldPlayerStats } from '../utils/stats';
import { generateVkPostText, getCurrentRuMonthYear } from '../utils/vkPostText';
import { ImageCropperControl } from './ImageCropperControl';

interface StudioViewProps {
  db: ClubDatabase;
  draft: PosterDraft;
  onChangeDraft: (updater: (prev: PosterDraft) => PosterDraft) => void;
  onUpdatePlayerCrop: (playerId: string, patch: Partial<Player>) => void;
  onSyncMatchLineup: (matchId: string, lineupPlayerIds: string[]) => void;
  onUpdateMatchCover: (matchId: string, patch: Partial<MatchItem>) => void;
  onAddMediaItem: (item: MediaGalleryItem) => void;
  onDeleteMediaItem: (id: string) => void;
  onCreateMatchQuick: () => void;
  onNotify: (msg: string) => void;
}

const POSTER_MODES: { id: PosterMode; label: string; icon: React.ReactNode }[] = [
  { id: 'matchday', label: 'Анонс матча', icon: <Calendar className="w-4 h-4" /> },
  { id: 'lineup', label: 'Заявка / Состав', icon: <Users className="w-4 h-4" /> },
  { id: 'results', label: 'Итог матча', icon: <Trophy className="w-4 h-4" /> },
  { id: 'scorers', label: 'Бомбардиры', icon: <Award className="w-4 h-4" /> },
  { id: 'goalkeepers', label: 'Вратари', icon: <Shield className="w-4 h-4" /> },
  { id: 'club_event', label: 'Событие / MVP', icon: <Sparkles className="w-4 h-4" /> },
];

const FORMATS: { id: PosterFormat; label: string; dims: string }[] = [
  { id: '4:5', label: 'Пост ВК 4:5', dims: '1080×1350' },
  { id: '9:16', label: 'Сторис 9:16', dims: '1080×1920' },
  { id: '1:1', label: 'Квадрат 1:1', dims: '1080×1080' },
];

const LAYOUT_STYLES: { id: PosterLayoutStyle; name: string; desc: string }[] = [
  { id: 'matchtv', name: 'Матч ТВ · Фото', desc: 'Полный кадр + золотая рамка счёта снизу' },
  { id: 'cinematic', name: 'Кинокадр · HUD', desc: 'Чистое фото 100% + ТВ-плашка в углу' },
  { id: 'broadcast', name: 'ТВ-Протокол', desc: 'Классическая карточка с голами и MVP' },
];

const THEME_IDS: PosterThemeId[] = ['midnight', 'club', 'gold', 'light'];

export const StudioView: React.FC<StudioViewProps> = ({
  db,
  draft,
  onChangeDraft,
  onUpdatePlayerCrop,
  onSyncMatchLineup,
  onUpdateMatchCover,
  onAddMediaItem,
  onDeleteMediaItem,
  onCreateMatchQuick,
  onNotify,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const customBgInputRef = useRef<HTMLInputElement | null>(null);
  const galleryUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview'>('editor');
  const [editorSection, setEditorSection] = useState<'content' | 'style'>('content');
  const [galleryFilter, setGalleryFilter] = useState<'all' | MediaGalleryCategory>('all');
  const [exporting, setExporting] = useState(false);
  const [packing, setPacking] = useState(false);
  const [copyingPng, setCopyingPng] = useState(false);
  const [captionOpen, setCaptionOpen] = useState(false);
  const [customVkCaption, setCustomVkCaption] = useState<string | null>(null);

  const themes = useMemo(() => THEME_IDS.map((id) => buildBroadcastTheme(id, db.club)), [db.club]);
  const monthLabel = useMemo(() => getCurrentRuMonthYear(), []);
  const autoVkCaption = useMemo(() => generateVkPostText(db, draft), [db, draft]);
  const activeVkCaption = customVkCaption ?? autoVkCaption;

  useEffect(() => {
    setCustomVkCaption(null);
  }, [autoVkCaption]);

  const topSeasonLeader = useMemo(() => {
    const stats = computeFieldPlayerStats(db.players, db.matches, draft.seasonFilterId);
    const sorted = [...stats].sort((a, b) =>
      b.points !== a.points ? b.points - a.points : b.goals - a.goals
    );
    return sorted[0]?.player || db.players[0];
  }, [db.players, db.matches, draft.seasonFilterId]);

  const eventPresets: {
    id: ClubEventPreset;
    label: string;
    badge: string;
    headline: string;
    subtitle: string;
    highlight?: boolean;
  }[] = useMemo(
    () => [
      {
        id: 'potm_vote',
        label: 'Голосование: Игрок месяца ?',
        badge: `ГОЛОСОВАНИЕ · ${monthLabel}`,
        headline: 'ЛУЧШИЙ ИГРОК МЕСЯЦА',
        subtitle: 'Кто достоин звания MVP? Пишите фамилию в комментариях или голосуйте в опросе ВК!',
        highlight: true,
      },
      {
        id: 'potm_winner',
        label: 'Победитель: Игрок месяца',
        badge: `MVP МЕСЯЦА · ${monthLabel}`,
        headline: topSeasonLeader ? topSeasonLeader.fullName : 'ЛУЧШИЙ ИГРОК МЕСЯЦА',
        subtitle: `По итогам голосования болельщиков признан лучшим игроком ${db.club.name}!`,
        highlight: true,
      },
      {
        id: 'birthday',
        label: 'С Днём рождения!',
        badge: 'С ДНЁМ РОЖДЕНИЯ!',
        headline: 'ПОЗДРАВЛЯЕМ!',
        subtitle:
          'Желаем крепкого здоровья, ярких побед, красивых голов и неиссякаемой энергии на паркете!',
      },
      {
        id: 'welcome',
        label: 'Добро пожаловать!',
        badge: 'ДОБРО ПОЖАЛОВАТЬ В КОМАНДУ',
        headline: 'НОВЫЙ ИГРОК КЛУБА',
        subtitle: `Рады приветствовать в составе ${db.club.name}! Вместе к новым трофеям и победам в сезоне.`,
      },
      {
        id: 'announcement',
        label: 'Важное объявление',
        badge: 'ВАЖНОЕ ОБЪЯВЛЕНИЕ',
        headline: 'НОВОСТИ КЛУБА',
        subtitle:
          'Вся актуальная информация для игроков и болельщиков о ближайших играх и расписании.',
      },
      {
        id: 'training',
        label: 'Сбор на тренировку',
        badge: 'СБОР НА ТРЕНИРОВКУ',
        headline: 'КОМАНДНАЯ ТРЕНИРОВКА',
        subtitle: `Четверг · 20:00 · ${db.club.defaultVenue || 'Домашняя площадка'}. С собой игровую форму, щитки и футзалки.`,
      },
    ],
    [db.club.name, db.club.defaultVenue, monthLabel, topSeasonLeader]
  );

  // Combine saved mediaGallery items + player photos for instant 1-tap selection
  const combinedGallery = useMemo(() => {
    const saved = db.mediaGallery || [];
    const playerItems: MediaGalleryItem[] = db.players
      .filter((p) => Boolean(p.photoUrl))
      .map((p) => ({
        id: `player-photo-${p.id}`,
        title: `#${p.number} ${p.shortName || p.fullName}`,
        category: 'player' as MediaGalleryCategory,
        imageUrl: p.photoUrl,
        createdAt: '',
      }));
    const all = [...saved, ...playerItems];
    if (galleryFilter === 'all') return all;
    return all.filter((item) => item.category === galleryFilter);
  }, [db.mediaGallery, db.players, galleryFilter]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      renderPosterToCanvas(canvas, db, draft, 1).catch(() => {});
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [db, draft, mobileTab]);

  const handleDownload = async () => {
    setExporting(true);
    try {
      await downloadPosterPng(db, draft);
      onNotify('Постер HD (pixelRatio: 2) сохранён в PNG');
    } catch {
      onNotify('Не удалось экспортировать постер');
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadPack = async () => {
    setPacking(true);
    try {
      await downloadPosterPack(db, draft);
      onNotify('Пакет 4:5 (Пост) + 9:16 (Сторис) скачан в HD');
    } catch {
      onNotify('Не удалось скачать пакет постеров');
    } finally {
      setPacking(false);
    }
  };

  const handleCopyPng = async () => {
    setCopyingPng(true);
    try {
      const res = await copyPosterPngToClipboard(db, draft);
      if (res === 'copied') {
        onNotify('Постер HD скопирован в буфер — можно вставить в ВК через Ctrl+V');
      } else {
        await downloadPosterPng(db, draft);
        onNotify('Буфер PNG не поддерживается браузером — файл скачан в HD');
      }
    } catch {
      onNotify('Не удалось скопировать изображение в буфер');
    } finally {
      setCopyingPng(false);
    }
  };

  const handleShare = async () => {
    setExporting(true);
    try {
      const res = await sharePosterPng(db, draft, activeVkCaption);
      onNotify(
        res === 'shared'
          ? 'Постер передан в меню «Поделиться»'
          : 'Браузер не поддерживает «Поделиться» — файл скачан в PNG'
      );
    } catch {
      onNotify('Не удалось поделиться постером');
    } finally {
      setExporting(false);
    }
  };

  const handleCopyVkText = async () => {
    try {
      await navigator.clipboard.writeText(activeVkCaption);
      onNotify('Готовый текст поста для ВК скопирован в буфер');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = activeVkCaption;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      onNotify('Текст поста для ВК скопирован');
    }
  };

  const handleSelectBgPreset = (presetId: PosterBackgroundPreset) => {
    const found = POSTER_BG_PRESETS.find((b) => b.id === presetId);
    onChangeDraft((prev) => ({
      ...prev,
      bgPreset: presetId,
      bgOverlayOpacity: found ? found.recommendedDim : prev.bgOverlayOpacity,
    }));
  };

  const handleCustomBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await processImageUpload(file, 1600);
      onChangeDraft((prev) => ({
        ...prev,
        bgPreset: 'custom',
        bgCustomUrl: url,
      }));
      onNotify('Свой фон загружен');
    } catch {
      onNotify('Ошибка загрузки фона');
    } finally {
      if (customBgInputRef.current) customBgInputRef.current.value = '';
    }
  };

  const handleGalleryUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    category: MediaGalleryCategory = 'match'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await processImageUpload(file, 1600);
      const cleanName = file.name.replace(/\.[^/.]+$/, '').slice(0, 28) || 'Фото клуба';
      const newItem: MediaGalleryItem = {
        id: `media_${Date.now()}`,
        title: cleanName,
        category,
        imageUrl: url,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      onAddMediaItem(newItem);
      onNotify(`Фото «${cleanName}» сохранено в медиатеку клуба`);
    } catch {
      onNotify('Ошибка добавления фото в медиатеку');
    } finally {
      if (galleryUploadInputRef.current) galleryUploadInputRef.current.value = '';
    }
  };

  const handleSaveCurrentToGallery = (
    imageUrl: string,
    title: string,
    category: MediaGalleryCategory
  ) => {
    if (!imageUrl) return;
    const exists = (db.mediaGallery || []).some((m) => m.imageUrl === imageUrl);
    if (exists) {
      onNotify('Этот кадр уже есть в медиатеке клуба');
      return;
    }
    onAddMediaItem({
      id: `media_${Date.now()}`,
      title,
      category,
      imageUrl,
      createdAt: new Date().toISOString().slice(0, 10),
    });
    onNotify(`«${title}» сохранено в медиатеку клуба`);
  };

  const applyEventPreset = (presetId: ClubEventPreset) => {
    const preset = eventPresets.find((p) => p.id === presetId);
    if (!preset) return;
    const fallbackPlayerId =
      draft.eventPlayerId || topSeasonLeader?.id || db.players[0]?.id || '';
    const player = db.players.find((p) => p.id === fallbackPlayerId);

    onChangeDraft((prev) => ({
      ...prev,
      eventPreset: presetId,
      eventPlayerId: presetId === 'potm_vote' ? prev.eventPlayerId : fallbackPlayerId,
      eventUseCustomPhoto: presetId === 'potm_vote' ? false : prev.eventUseCustomPhoto,
      eventBadgeText: preset.badge,
      eventHeadline:
        presetId === 'birthday' && player
          ? `${player.fullName}!`
          : (presetId === 'welcome' || presetId === 'potm_winner') && player
          ? player.fullName
          : preset.headline,
      eventSubtitle: preset.subtitle,
    }));
  };

  const handleSelectEventPlayer = (playerId: string) => {
    const pl = db.players.find((p) => p.id === playerId);
    onChangeDraft((prev) => ({
      ...prev,
      eventPlayerId: playerId,
      eventUseCustomPhoto: false,
      eventHeadline:
        prev.eventPreset === 'birthday' && pl
          ? `${pl.fullName}!`
          : (prev.eventPreset === 'welcome' || prev.eventPreset === 'potm_winner') && pl
          ? pl.fullName
          : prev.eventHeadline,
    }));
  };

  const selectedMatch = db.matches.find((m) => m.id === draft.matchId) || db.matches[0];

  const toggleLineupPlayer = (playerId: string) => {
    const exists = draft.lineupSelectedIds.includes(playerId);
    const next = exists
      ? draft.lineupSelectedIds.filter((id) => id !== playerId)
      : [...draft.lineupSelectedIds, playerId];
    onChangeDraft((prev) => ({ ...prev, lineupSelectedIds: next }));
    if (selectedMatch) {
      onSyncMatchLineup(selectedMatch.id, next);
    }
  };

  const setAllLineupPlayers = (ids: string[]) => {
    onChangeDraft((prev) => ({ ...prev, lineupSelectedIds: ids }));
    if (selectedMatch) {
      onSyncMatchLineup(selectedMatch.id, ids);
    }
  };

  const matchdayPlayer = db.players.find((p) => p.id === draft.matchdayPlayerId);
  const eventPlayer = db.players.find((p) => p.id === draft.eventPlayerId);
  const dims = POSTER_DIMENSIONS[draft.format];
  const supportsLayoutStyles = draft.mode === 'results' || draft.mode === 'matchday';

  return (
    <div className="space-y-4 pb-16 lg:pb-0">
      {/* Mobile Switcher: Редактор | Превью */}
      <div className="flex lg:hidden items-center gap-1 rounded-xl border border-white/10 bg-[#14161C] p-1">
        <button
          type="button"
          onClick={() => setMobileTab('editor')}
          className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg min-h-[44px] text-sm font-semibold transition-colors cursor-pointer ${
            mobileTab === 'editor' ? 'bg-[#8B1723] text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Редактор</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('preview')}
          className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg min-h-[44px] text-sm font-semibold transition-colors cursor-pointer ${
            mobileTab === 'preview' ? 'bg-[#8B1723] text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>Превью</span>
        </button>
      </div>

      {/* Split-Screen Desktop Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[450px_1fr] xl:grid-cols-[480px_1fr] gap-6 items-start">
        {/* LEFT COLUMN: Compact 2-Tab Editor Controls */}
        <div
          className={`space-y-4 rounded-2xl border border-white/10 bg-[#14161C] p-4 sm:p-5 ${
            mobileTab === 'preview' ? 'hidden lg:block' : 'block'
          }`}
        >
          {/* Always visible: 6 Poster Modes */}
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-2">Шаблон постера</p>
            <div className="grid grid-cols-2 gap-2">
              {POSTER_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChangeDraft((prev) => ({ ...prev, mode: m.id }))}
                  className={`flex items-center gap-2 rounded-xl px-3 min-h-[42px] text-left text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    draft.mode === m.id
                      ? 'bg-[#8B1723] text-white'
                      : 'border border-white/10 bg-[#0E1014] text-slate-300 hover:border-white/20 hover:text-white'
                  }`}
                >
                  <span className="shrink-0">{m.icon}</span>
                  <span className="truncate">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Always visible: VK Format + Safe Zones toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-400">Формат ВКонтакте</p>
              {draft.format === '9:16' && (
                <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#C8B289] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.showSafeZones}
                    onChange={(e) =>
                      onChangeDraft((prev) => ({ ...prev, showSafeZones: e.target.checked }))
                    }
                    className="h-3.5 w-3.5 accent-[#C8B289]"
                  />
                  <span>Границы ВК Сторис</span>
                </label>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onChangeDraft((prev) => ({ ...prev, format: f.id }))}
                  className={`rounded-xl px-2.5 py-2 text-center transition-colors min-h-[46px] cursor-pointer ${
                    draft.format === f.id
                      ? 'bg-[#8B1723] text-white'
                      : 'border border-white/10 bg-[#0E1014] text-slate-300 hover:text-white'
                  }`}
                >
                  <div className="text-xs font-bold whitespace-nowrap">{f.label}</div>
                  <div className="text-[10px] opacity-75 tabular-nums">{f.dims}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Compact Editor Section Tabs: Контент | Стиль и фон */}
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-[#0E1014] p-1">
            <button
              type="button"
              onClick={() => setEditorSection('content')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg min-h-[38px] text-xs font-bold transition-colors cursor-pointer ${
                editorSection === 'content'
                  ? 'bg-[#C8B289] text-[#111215]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Контент и кадр</span>
            </button>
            <button
              type="button"
              onClick={() => setEditorSection('style')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg min-h-[38px] text-xs font-bold transition-colors cursor-pointer ${
                editorSection === 'style'
                  ? 'bg-[#C8B289] text-[#111215]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Стиль и медиатека</span>
            </button>
          </div>

          {/* SECTION 1: CONTENT & COMPOSITION */}
          {editorSection === 'content' && (
            <div className="space-y-4">
              {/* Composition Layout Selector for Results & Matchday */}
              {supportsLayoutStyles && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-400">
                    Композиция эфира (Матч ТВ / Кинокадр / Протокол)
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {LAYOUT_STYLES.map((st) => {
                      const active = draft.layoutStyle === st.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() =>
                            onChangeDraft((prev) => ({ ...prev, layoutStyle: st.id }))
                          }
                          className={`rounded-xl p-2.5 text-left transition-colors cursor-pointer ${
                            active
                              ? 'border border-[#C8B289] bg-[#C8B289]/12 text-white'
                              : 'border border-white/10 bg-[#0E1014] text-slate-300 hover:border-white/25'
                          }`}
                        >
                          <p className="text-xs font-bold leading-tight">{st.name}</p>
                          <p className="mt-1 text-[10px] text-slate-400 leading-snug">{st.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Match Selector for matchday / lineup / results */}
              {(draft.mode === 'matchday' || draft.mode === 'lineup' || draft.mode === 'results') && (
                <div className="space-y-4">
                  {db.matches.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#C8B289]/40 bg-[#0E1014] p-4 text-center space-y-2.5">
                      <p className="text-xs text-slate-300">
                        В базе пока нет матчей. Создайте первый матч, чтобы постер заполнился автоматически.
                      </p>
                      <button
                        type="button"
                        onClick={onCreateMatchQuick}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B1723] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#A31D2B] cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Создать первый матч</span>
                      </button>
                    </div>
                  ) : (
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-400">Выберите матч</span>
                      <select
                        value={draft.matchId}
                        onChange={(e) => {
                          const mId = e.target.value;
                          const found = db.matches.find((m) => m.id === mId);
                          onChangeDraft((prev) => ({
                            ...prev,
                            matchId: mId,
                            lineupSelectedIds: found
                              ? [...found.lineupPlayerIds]
                              : prev.lineupSelectedIds,
                          }));
                        }}
                        className="mt-1.5 w-full min-h-[44px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
                      >
                        {db.matches.map((m) => {
                          const opp = db.opponents.find((o) => o.id === m.opponentId);
                          return (
                            <option key={m.id} value={m.id}>
                              {m.date} · {m.roundLabel || 'Матч'} vs{' '}
                              {opp?.shortName || opp?.name || 'Соперник'}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                  )}

                  {/* Match Action Cover Photo + Quick Pick from Club Media Gallery */}
                  {selectedMatch && supportsLayoutStyles && (
                    <div className="space-y-2.5">
                      <ImageCropperControl
                        label="Игровое фото матча (для Матч ТВ / Кинокадра)"
                        hint="Необязательно — если пусто, используется фон из вкладки «Стиль и медиатека»"
                        imageUrl={selectedMatch.coverPhotoUrl || ''}
                        scale={selectedMatch.coverPhotoScale ?? 1.02}
                        offsetX={selectedMatch.coverPhotoOffsetX ?? 0}
                        offsetY={selectedMatch.coverPhotoOffsetY ?? 0}
                        aspect="landscape"
                        fitMode="cover"
                        onChange={(patch) =>
                          onUpdateMatchCover(selectedMatch.id, {
                            ...(patch.imageUrl !== undefined ? { coverPhotoUrl: patch.imageUrl } : {}),
                            ...(patch.scale !== undefined ? { coverPhotoScale: patch.scale } : {}),
                            ...(patch.offsetX !== undefined ? { coverPhotoOffsetX: patch.offsetX } : {}),
                            ...(patch.offsetY !== undefined ? { coverPhotoOffsetY: patch.offsetY } : {}),
                          })
                        }
                      />

                      {selectedMatch.coverPhotoUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            handleSaveCurrentToGallery(
                              selectedMatch.coverPhotoUrl || '',
                              `Матч ${selectedMatch.date}`,
                              'match'
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#C8B289]/40 bg-[#C8B289]/10 px-3 py-1.5 text-[11px] font-semibold text-[#C8B289] hover:bg-[#C8B289]/20 cursor-pointer"
                        >
                          <BookmarkPlus className="w-3.5 h-3.5" />
                          <span>Сохранить этот кадр в медиатеку клуба</span>
                        </button>
                      )}

                      {/* Quick 1-Tap Media Gallery Strip for Match Photo */}
                      {combinedGallery.length > 0 && (
                        <div className="rounded-xl border border-white/10 bg-[#0E1014] p-2.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
                              <FolderHeart className="w-3.5 h-3.5 text-[#C8B289]" />
                              <span>Подставить из медиатеки ({combinedGallery.length})</span>
                            </span>
                            {selectedMatch.coverPhotoUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateMatchCover(selectedMatch.id, { coverPhotoUrl: '' })
                                }
                                className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                              >
                                Сбросить фото
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2 overflow-x-auto pb-1">
                            {combinedGallery.map((item) => {
                              const isSelected = selectedMatch.coverPhotoUrl === item.imageUrl;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() =>
                                    onUpdateMatchCover(selectedMatch.id, {
                                      coverPhotoUrl: item.imageUrl,
                                      coverPhotoScale: 1.02,
                                      coverPhotoOffsetX: 0,
                                      coverPhotoOffsetY: 0,
                                    })
                                  }
                                  className={`group relative h-14 w-20 shrink-0 rounded-lg overflow-hidden border transition-all cursor-pointer ${
                                    isSelected
                                      ? 'border-[#C8B289] ring-2 ring-[#C8B289]/40'
                                      : 'border-white/10 hover:border-white/35'
                                  }`}
                                  title={item.title}
                                >
                                  <img
                                    src={resolveAssetUrl(item.imageUrl)}
                                    alt={item.title}
                                    referrerPolicy="no-referrer"
                                    className="h-full w-full object-cover"
                                  />
                                  <span className="absolute inset-x-0 bottom-0 bg-black/75 px-1 py-0.5 text-[9px] font-semibold text-white truncate">
                                    {item.title}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {draft.mode === 'matchday' && (
                    <>
                      <label className="block">
                        <span className="text-xs font-semibold text-slate-400">
                          Верхняя плашка (опционально)
                        </span>
                        <input
                          type="text"
                          value={draft.matchdayKicker}
                          placeholder={selectedMatch?.isHome ? 'ДОМАШНИЙ МАТЧ' : 'ВЫЕЗДНОЙ МАТЧ'}
                          onChange={(e) =>
                            onChangeDraft((prev) => ({ ...prev, matchdayKicker: e.target.value }))
                          }
                          className="mt-1.5 w-full min-h-[42px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
                        />
                      </label>

                      <label className="block">
                        <span className="text-xs font-semibold text-slate-400">
                          Игрок на афише (если нет общего фото матча)
                        </span>
                        <select
                          value={draft.matchdayPlayerId}
                          onChange={(e) =>
                            onChangeDraft((prev) => ({ ...prev, matchdayPlayerId: e.target.value }))
                          }
                          className="mt-1.5 w-full min-h-[42px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
                        >
                          <option value="">Без фото игрока</option>
                          {db.players.map((p) => (
                            <option key={p.id} value={p.id}>
                              #{p.number} {p.fullName}
                            </option>
                          ))}
                        </select>
                      </label>

                      {matchdayPlayer && (
                        <ImageCropperControl
                          label={`Посадка фото: ${matchdayPlayer.shortName || matchdayPlayer.fullName}`}
                          hint="Сохраняется в профиле игрока"
                          imageUrl={matchdayPlayer.photoUrl}
                          scale={matchdayPlayer.photoScale}
                          offsetX={matchdayPlayer.photoOffsetX}
                          offsetY={matchdayPlayer.photoOffsetY}
                          onChange={(patch) =>
                            onUpdatePlayerCrop(matchdayPlayer.id, {
                              ...(patch.imageUrl !== undefined ? { photoUrl: patch.imageUrl } : {}),
                              ...(patch.scale !== undefined ? { photoScale: patch.scale } : {}),
                              ...(patch.offsetX !== undefined ? { photoOffsetX: patch.offsetX } : {}),
                              ...(patch.offsetY !== undefined ? { photoOffsetY: patch.offsetY } : {}),
                            })
                          }
                        />
                      )}
                    </>
                  )}

                  {draft.mode === 'lineup' && (
                    <div className="space-y-3">
                      <label className="block">
                        <span className="text-xs font-semibold text-slate-400">Заголовок постера</span>
                        <input
                          type="text"
                          value={draft.lineupTitle}
                          onChange={(e) =>
                            onChangeDraft((prev) => ({ ...prev, lineupTitle: e.target.value }))
                          }
                          className="mt-1.5 w-full min-h-[42px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
                        />
                      </label>

                      <label className="flex items-center gap-2.5 text-xs font-medium text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={draft.lineupShowStartingFive}
                          onChange={(e) =>
                            onChangeDraft((prev) => ({
                              ...prev,
                              lineupShowStartingFive: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[#8B1723]"
                        />
                        <span>Разделять на «Стартовую пятёрку» и «Запасных»</span>
                      </label>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs font-semibold text-slate-400">
                          Заявка ({draft.lineupSelectedIds.length}) · автосохранение в матч
                        </span>
                        <div className="flex items-center gap-3 text-xs">
                          <button
                            type="button"
                            onClick={() =>
                              setAllLineupPlayers(
                                db.players.filter((p) => p.isActive).map((p) => p.id)
                              )
                            }
                            className="text-[#C8B289] hover:text-white cursor-pointer"
                          >
                            Всех
                          </button>
                          <button
                            type="button"
                            onClick={() => setAllLineupPlayers([])}
                            className="text-slate-400 hover:text-white cursor-pointer"
                          >
                            Сбросить
                          </button>
                        </div>
                      </div>

                      <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                        {[...db.players]
                          .sort((a, b) => a.number - b.number)
                          .map((p) => {
                            const checked = draft.lineupSelectedIds.includes(p.id);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => toggleLineupPlayer(p.id)}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors min-h-[40px] cursor-pointer ${
                                  checked
                                    ? 'bg-[#8B1723]/25 border border-[#8B1723]/60 text-white'
                                    : 'bg-[#0E1014] border border-white/5 text-slate-400 hover:text-white'
                                }`}
                              >
                                <span className="flex items-center gap-2.5 min-w-0">
                                  <span
                                    className={`flex h-4 w-4 items-center justify-center rounded border shrink-0 ${
                                      checked
                                        ? 'border-[#8B1723] bg-[#8B1723] text-white'
                                        : 'border-slate-600'
                                    }`}
                                  >
                                    {checked && <Check className="w-3 h-3" />}
                                  </span>
                                  <span className="font-display font-bold tabular-nums w-7 shrink-0">
                                    #{p.number}
                                  </span>
                                  <span className="truncate font-medium">{p.fullName}</span>
                                </span>
                                <span className="text-[11px] font-semibold text-[#C8B289] shrink-0">
                                  {[p.role === 'GK' ? 'ВР' : '', p.isCaptain ? 'К' : '']
                                    .filter(Boolean)
                                    .join(' · ')}
                                </span>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {draft.mode === 'results' && (
                    <div className="space-y-3">
                      <label className="block">
                        <span className="text-xs font-semibold text-slate-400">Заголовок итогов</span>
                        <input
                          type="text"
                          value={draft.resultsHeadline}
                          onChange={(e) =>
                            onChangeDraft((prev) => ({ ...prev, resultsHeadline: e.target.value }))
                          }
                          className="mt-1.5 w-full min-h-[42px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold text-slate-400">
                          Подпись для MVP (пусто = авто из протокола)
                        </span>
                        <input
                          type="text"
                          value={draft.resultsMvpNote}
                          placeholder="Например: 2 гола + 1 ассист"
                          onChange={(e) =>
                            onChangeDraft((prev) => ({ ...prev, resultsMvpNote: e.target.value }))
                          }
                          className="mt-1.5 w-full min-h-[42px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}

              {draft.mode === 'scorers' && (
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-400">
                      Турнир / Фильтр статистики
                    </span>
                    <select
                      value={draft.seasonFilterId}
                      onChange={(e) =>
                        onChangeDraft((prev) => ({ ...prev, seasonFilterId: e.target.value }))
                      }
                      className="mt-1.5 w-full min-h-[42px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
                    >
                      <option value="all">Все турниры сезона</option>
                      {db.seasons.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div>
                    <p className="text-xs font-semibold text-slate-400 mb-2">Рейтинг по показателю</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { id: 'points', label: 'Гол + Пас' },
                          { id: 'goals', label: 'Только голы' },
                          { id: 'assists', label: 'Ассисты' },
                        ] as const
                      ).map((sm) => (
                        <button
                          key={sm.id}
                          type="button"
                          onClick={() => onChangeDraft((prev) => ({ ...prev, scorersMode: sm.id }))}
                          className={`min-h-[40px] rounded-lg text-xs font-semibold cursor-pointer ${
                            draft.scorersMode === sm.id
                              ? 'bg-[#8B1723] text-white'
                              : 'border border-white/10 bg-[#0E1014] text-slate-300'
                          }`}
                        >
                          {sm.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-400 mb-2">Количество строк</p>
                    <div className="grid grid-cols-2 gap-2">
                      {([5, 10] as const).map((lim) => (
                        <button
                          key={lim}
                          type="button"
                          onClick={() => onChangeDraft((prev) => ({ ...prev, scorersLimit: lim }))}
                          className={`min-h-[40px] rounded-lg text-xs font-semibold cursor-pointer ${
                            draft.scorersLimit === lim
                              ? 'bg-[#8B1723] text-white'
                              : 'border border-white/10 bg-[#0E1014] text-slate-300'
                          }`}
                        >
                          Топ-{lim} игроков
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="block">
                    <span className="text-xs font-semibold text-slate-400">
                      Свой заголовок (пусто = авто)
                    </span>
                    <input
                      type="text"
                      value={draft.scorersTitle}
                      placeholder="БОМБАРДИРЫ КЛУБА"
                      onChange={(e) =>
                        onChangeDraft((prev) => ({ ...prev, scorersTitle: e.target.value }))
                      }
                      className="mt-1.5 w-full min-h-[42px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
                    />
                  </label>
                </div>
              )}

              {draft.mode === 'goalkeepers' && (
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-400">
                      Турнир / Фильтр статистики
                    </span>
                    <select
                      value={draft.seasonFilterId}
                      onChange={(e) =>
                        onChangeDraft((prev) => ({ ...prev, seasonFilterId: e.target.value }))
                      }
                      className="mt-1.5 w-full min-h-[42px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
                    >
                      <option value="all">Все турниры сезона</option>
                      {db.seasons.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-slate-400">Заголовок постера</span>
                    <input
                      type="text"
                      value={draft.gkTitle}
                      placeholder="ВРАТАРИ И СУХАРИ"
                      onChange={(e) =>
                        onChangeDraft((prev) => ({ ...prev, gkTitle: e.target.value }))
                      }
                      className="mt-1.5 w-full min-h-[42px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
                    />
                  </label>
                </div>
              )}

              {draft.mode === 'club_event' && (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 mb-2">
                      Быстрый шаблон (Игрок месяца / ДР / Трансфер / Анонс)
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {eventPresets.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => applyEventPreset(p.id)}
                          className={`min-h-[42px] rounded-xl px-2.5 py-1.5 text-left text-xs font-semibold transition-colors cursor-pointer ${
                            draft.eventPreset === p.id
                              ? 'bg-[#C8B289] text-[#111215] font-bold'
                              : p.highlight
                              ? 'border border-[#C8B289]/40 bg-[#C8B289]/10 text-[#E5D4B3] hover:border-[#C8B289]'
                              : 'border border-white/10 bg-[#0E1014] text-slate-300 hover:text-white'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {draft.eventPreset === 'potm_vote' && !draft.eventUseCustomPhoto && (
                    <div className="rounded-xl border border-[#C8B289]/35 bg-[#C8B289]/10 p-3 flex items-start gap-2.5">
                      <HelpCircle className="w-4 h-4 text-[#C8B289] shrink-0 mt-0.5" />
                      <div className="text-xs text-slate-200 leading-relaxed">
                        <span className="font-bold text-[#E5D4B3]">Студийный силуэт «Кто станет MVP?»:</span>{' '}
                        на постере используется брендированная обложка с силуэтом футболиста, золотым знаком «?» и топ-4 претендентами сезона по системе Гол+Пас.
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onChangeDraft((prev) => ({ ...prev, eventUseCustomPhoto: false }))
                      }
                      className={`min-h-[40px] rounded-lg text-xs font-semibold cursor-pointer ${
                        !draft.eventUseCustomPhoto
                          ? 'bg-[#8B1723] text-white'
                          : 'border border-white/10 bg-[#0E1014] text-slate-300'
                      }`}
                    >
                      {draft.eventPreset === 'potm_vote'
                        ? 'Силуэт со знаком ?'
                        : 'Игрок из базы'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onChangeDraft((prev) => ({ ...prev, eventUseCustomPhoto: true }))
                      }
                      className={`min-h-[40px] rounded-lg text-xs font-semibold cursor-pointer ${
                        draft.eventUseCustomPhoto
                          ? 'bg-[#8B1723] text-white'
                          : 'border border-white/10 bg-[#0E1014] text-slate-300'
                      }`}
                    >
                      Своё фото / из медиатеки
                    </button>
                  </div>

                  {!draft.eventUseCustomPhoto ? (
                    draft.eventPreset !== 'potm_vote' && (
                      <>
                        <label className="block">
                          <span className="text-xs font-semibold text-slate-400">
                            {draft.eventPreset === 'potm_winner'
                              ? 'Победитель «Игрок месяца» (статистика подтянется авто)'
                              : 'Выберите игрока'}
                          </span>
                          <select
                            value={draft.eventPlayerId}
                            onChange={(e) => handleSelectEventPlayer(e.target.value)}
                            className="mt-1.5 w-full min-h-[42px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
                          >
                            <option value="">Без привязки к игроку</option>
                            {db.players.map((p) => (
                              <option key={p.id} value={p.id}>
                                #{p.number} {p.fullName}
                              </option>
                            ))}
                          </select>
                        </label>

                        {eventPlayer && (
                          <ImageCropperControl
                            label={`Кадрирование: ${eventPlayer.shortName || eventPlayer.fullName}`}
                            imageUrl={eventPlayer.photoUrl}
                            scale={eventPlayer.photoScale}
                            offsetX={eventPlayer.photoOffsetX}
                            offsetY={eventPlayer.photoOffsetY}
                            onChange={(patch) =>
                              onUpdatePlayerCrop(eventPlayer.id, {
                                ...(patch.imageUrl !== undefined ? { photoUrl: patch.imageUrl } : {}),
                                ...(patch.scale !== undefined ? { photoScale: patch.scale } : {}),
                                ...(patch.offsetX !== undefined ? { photoOffsetX: patch.offsetX } : {}),
                                ...(patch.offsetY !== undefined ? { photoOffsetY: patch.offsetY } : {}),
                              })
                            }
                          />
                        )}
                      </>
                    )
                  ) : (
                    <div className="space-y-2.5">
                      <ImageCropperControl
                        label="Произвольное фото для события"
                        hint="Подойдёт командное фото, арена или портрет игрока"
                        imageUrl={draft.eventCustomPhotoUrl}
                        scale={draft.eventCustomPhotoScale}
                        offsetX={draft.eventCustomPhotoOffsetX}
                        offsetY={draft.eventCustomPhotoOffsetY}
                        fitMode="cover"
                        onChange={(patch) =>
                          onChangeDraft((prev) => ({
                            ...prev,
                            ...(patch.imageUrl !== undefined
                              ? { eventCustomPhotoUrl: patch.imageUrl }
                              : {}),
                            ...(patch.scale !== undefined ? { eventCustomPhotoScale: patch.scale } : {}),
                            ...(patch.offsetX !== undefined
                              ? { eventCustomPhotoOffsetX: patch.offsetX }
                              : {}),
                            ...(patch.offsetY !== undefined
                              ? { eventCustomPhotoOffsetY: patch.offsetY }
                              : {}),
                          }))
                        }
                      />

                      {draft.eventCustomPhotoUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            handleSaveCurrentToGallery(
                              draft.eventCustomPhotoUrl,
                              draft.eventHeadline || 'Фото события',
                              'match'
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#C8B289]/40 bg-[#C8B289]/10 px-3 py-1.5 text-[11px] font-semibold text-[#C8B289] hover:bg-[#C8B289]/20 cursor-pointer"
                        >
                          <BookmarkPlus className="w-3.5 h-3.5" />
                          <span>Сохранить фото в медиатеку клуба</span>
                        </button>
                      )}

                      {combinedGallery.length > 0 && (
                        <div className="rounded-xl border border-white/10 bg-[#0E1014] p-2.5 space-y-2">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
                            <FolderHeart className="w-3.5 h-3.5 text-[#C8B289]" />
                            <span>Выбрать из медиатеки и фото игроков ({combinedGallery.length})</span>
                          </span>
                          <div className="flex items-center gap-2 overflow-x-auto pb-1">
                            {combinedGallery.map((item) => {
                              const isSelected = draft.eventCustomPhotoUrl === item.imageUrl;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() =>
                                    onChangeDraft((prev) => ({
                                      ...prev,
                                      eventUseCustomPhoto: true,
                                      eventCustomPhotoUrl: item.imageUrl,
                                      eventCustomPhotoScale: 1,
                                      eventCustomPhotoOffsetX: 0,
                                      eventCustomPhotoOffsetY: 0,
                                    }))
                                  }
                                  className={`relative h-14 w-20 shrink-0 rounded-lg overflow-hidden border transition-all cursor-pointer ${
                                    isSelected
                                      ? 'border-[#C8B289] ring-2 ring-[#C8B289]/40'
                                      : 'border-white/10 hover:border-white/35'
                                  }`}
                                  title={item.title}
                                >
                                  <img
                                    src={resolveAssetUrl(item.imageUrl)}
                                    alt={item.title}
                                    referrerPolicy="no-referrer"
                                    className="h-full w-full object-cover"
                                  />
                                  <span className="absolute inset-x-0 bottom-0 bg-black/75 px-1 py-0.5 text-[9px] font-semibold text-white truncate">
                                    {item.title}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <label className="block">
                    <span className="text-xs font-semibold text-slate-400">Текст цветной плашки</span>
                    <input
                      type="text"
                      value={draft.eventBadgeText}
                      onChange={(e) =>
                        onChangeDraft((prev) => ({ ...prev, eventBadgeText: e.target.value }))
                      }
                      className="mt-1.5 w-full min-h-[42px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-slate-400">Заголовок</span>
                    <input
                      type="text"
                      value={draft.eventHeadline}
                      onChange={(e) =>
                        onChangeDraft((prev) => ({ ...prev, eventHeadline: e.target.value }))
                      }
                      className="mt-1.5 w-full min-h-[42px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-slate-400">Подзаголовок / описание</span>
                    <textarea
                      rows={3}
                      value={draft.eventSubtitle}
                      onChange={(e) =>
                        onChangeDraft((prev) => ({ ...prev, eventSubtitle: e.target.value }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#0E1014] p-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: STYLE, BACKDROP, CREST & CLUB MEDIA GALLERY */}
          {editorSection === 'style' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-400">Базовые площадки и фоны</p>
                  <button
                    type="button"
                    onClick={() => customBgInputRef.current?.click()}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#C8B289] hover:text-white cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Свой фон с устройства</span>
                  </button>
                  <input
                    ref={customBgInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleCustomBgUpload}
                    className="hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {POSTER_BG_PRESETS.filter((b) => b.id !== 'custom' || draft.bgCustomUrl).map((bg) => {
                    const active = draft.bgPreset === bg.id;
                    const thumbUrl = bg.id === 'custom' ? draft.bgCustomUrl : bg.url;
                    return (
                      <button
                        key={bg.id}
                        type="button"
                        onClick={() => handleSelectBgPreset(bg.id)}
                        className={`flex items-center gap-2.5 rounded-xl p-2 text-left transition-colors cursor-pointer ${
                          active
                            ? 'border border-[#C8B289] bg-[#C8B289]/12 text-white'
                            : 'border border-white/10 bg-[#0E1014] text-slate-300 hover:border-white/25'
                        }`}
                      >
                        <div className="h-10 w-10 rounded-lg overflow-hidden border border-white/15 shrink-0 bg-[#14161C] flex items-center justify-center">
                          {thumbUrl ? (
                            <img
                              src={resolveAssetUrl(thumbUrl)}
                              alt={bg.name}
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-slate-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{bg.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{bg.subtitle}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {draft.bgPreset === 'custom' && draft.bgCustomUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      handleSaveCurrentToGallery(draft.bgCustomUrl, 'Фон арены / клуба', 'backdrop')
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#C8B289]/40 bg-[#C8B289]/10 px-3 py-1.5 text-[11px] font-semibold text-[#C8B289] hover:bg-[#C8B289]/20 cursor-pointer"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    <span>Сохранить текущий фон в медиатеку</span>
                  </button>
                )}

                {draft.bgPreset !== 'broadcast' && (
                  <div className="rounded-xl border border-white/10 bg-[#0E1014] px-3.5 py-2.5">
                    <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                      <span>Затемнение фона (контраст текста)</span>
                      <span className="tabular-nums font-bold text-[#C8B289]">
                        {Math.round(draft.bgOverlayOpacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.2}
                      max={0.88}
                      step={0.02}
                      value={draft.bgOverlayOpacity}
                      onChange={(e) =>
                        onChangeDraft((prev) => ({
                          ...prev,
                          bgOverlayOpacity: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full accent-[#C8B289] cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {/* CLUB MEDIA GALLERY (ГАЛЕРЕЯ ЧАСТО ИСПОЛЬЗУЕМЫХ ФОТО И ИГРОКОВ) */}
              <div className="rounded-xl border border-white/10 bg-[#0E1014] p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      <FolderHeart className="w-3.5 h-3.5 text-[#C8B289]" />
                      <span>Медиатека клуба ({combinedGallery.length})</span>
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Частые фоны, кадры с игр и фото игроков для подстановки в 1 клик
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => galleryUploadInputRef.current?.click()}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#8B1723] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#A31D2B] cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Фото</span>
                  </button>
                  <input
                    ref={galleryUploadInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => handleGalleryUpload(e, 'backdrop')}
                    className="hidden"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  {(
                    [
                      { id: 'all', label: 'Все' },
                      { id: 'backdrop', label: 'Фоны' },
                      { id: 'match', label: 'Матчи' },
                      { id: 'player', label: 'Игроки' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setGalleryFilter(tab.id)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                        galleryFilter === tab.id
                          ? 'bg-[#C8B289] text-[#111215]'
                          : 'bg-[#14161C] text-slate-400 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                  {combinedGallery.map((item) => {
                    const isCustomSaved = !item.id.startsWith('player-photo-');
                    const isActiveBg =
                      draft.bgPreset === 'custom' && draft.bgCustomUrl === item.imageUrl;
                    return (
                      <div
                        key={item.id}
                        className={`group relative rounded-xl overflow-hidden border bg-[#14161C] transition-all ${
                          isActiveBg
                            ? 'border-[#C8B289] ring-1 ring-[#C8B289]'
                            : 'border-white/10 hover:border-white/30'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onChangeDraft((prev) => ({
                              ...prev,
                              bgPreset: 'custom',
                              bgCustomUrl: item.imageUrl,
                            }));
                            onNotify(`Фон «${item.title}» применён к постеру`);
                          }}
                          className="block w-full h-20 cursor-pointer"
                          title={`Сделать фоном: ${item.title}`}
                        >
                          <img
                            src={resolveAssetUrl(item.imageUrl)}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        </button>
                        <div className="flex items-center justify-between px-1.5 py-1 bg-black/80">
                          <span className="text-[10px] font-medium text-slate-200 truncate">
                            {item.title}
                          </span>
                          {isCustomSaved && (
                            <button
                              type="button"
                              onClick={() => onDeleteMediaItem(item.id)}
                              className="text-slate-400 hover:text-rose-400 p-0.5 cursor-pointer"
                              title="Удалить из медиатеки"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-400">Цветовая ТВ-тема</p>
                <div className="grid grid-cols-2 gap-2">
                  {themes.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onChangeDraft((prev) => ({ ...prev, theme: t.id }))}
                      className={`flex items-center gap-2.5 rounded-xl px-3 min-h-[42px] text-xs font-semibold transition-colors cursor-pointer ${
                        draft.theme === t.id
                          ? 'border border-[#C8B289] bg-[#C8B289]/15 text-white'
                          : 'border border-white/10 bg-[#0E1014] text-slate-300 hover:text-white'
                      }`}
                    >
                      <span
                        className="h-5 w-5 rounded-md border border-white/25 shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${t.bgTop} 0%, ${t.primary} 55%, ${t.goldMid} 100%)`,
                        }}
                      />
                      <span className="truncate">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {db.club.altLogoUrl && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-400">Вариант герба на постере</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onChangeDraft((prev) => ({ ...prev, useAltLogo: false }))}
                      className={`min-h-[40px] rounded-lg text-xs font-semibold cursor-pointer ${
                        !draft.useAltLogo
                          ? 'bg-[#8B1723] text-white'
                          : 'border border-white/10 bg-[#0E1014] text-slate-400 hover:text-white'
                      }`}
                    >
                      Основной (Щит)
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeDraft((prev) => ({ ...prev, useAltLogo: true }))}
                      className={`min-h-[40px] rounded-lg text-xs font-semibold cursor-pointer ${
                        draft.useAltLogo
                          ? 'bg-[#C8B289] text-[#111215]'
                          : 'border border-white/10 bg-[#0E1014] text-slate-400 hover:text-white'
                      }`}
                    >
                      Медаль (Круг)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Sticky Live 2D Canvas Preview & Export Suite */}
        <div
          className={`lg:sticky lg:top-20 space-y-4 ${
            mobileTab === 'editor' ? 'hidden lg:block' : 'block'
          }`}
        >
          <div className="rounded-2xl border border-white/10 bg-[#14161C] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-display text-sm sm:text-base font-bold text-white">
                  Живое превью 2D Canvas
                </h2>
                <p className="text-xs text-slate-400 tabular-nums mt-0.5">
                  {dims.label} · HD {dims.width * 2}×{dims.height * 2} px
                </p>
              </div>

              {/* Primary Export & VK Workflow Bar */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyVkText}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#0E1014] px-3 min-h-[44px] text-xs font-semibold text-slate-200 hover:border-[#C8B289]/60 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
                  title="Скопировать готовый текст поста для ВКонтакте"
                >
                  <Copy className="w-4 h-4 text-[#C8B289]" />
                  <span>Текст ВК</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyPng}
                  disabled={copyingPng}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#0E1014] px-3 min-h-[44px] text-xs font-semibold text-slate-200 hover:border-[#C8B289]/60 hover:text-white transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
                  title="Скопировать картинку PNG в буфер обмена (для быстрой вставки Ctrl+V в ВК)"
                >
                  <ClipboardCopy className="w-4 h-4 text-[#C8B289]" />
                  <span>{copyingPng ? 'Копирую…' : 'Копировать PNG'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPack}
                  disabled={packing}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#0E1014] px-3 min-h-[44px] text-xs font-semibold text-slate-200 hover:border-[#C8B289]/60 hover:text-white transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
                  title="Скачать сразу Пост 4:5 и Сторис 9:16"
                >
                  <Package className="w-4 h-4 text-[#C8B289]" />
                  <span>{packing ? 'Пакет…' : '4:5 + 9:16'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  disabled={exporting}
                  className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-[#0E1014] min-h-[44px] min-w-[44px] text-slate-200 hover:border-[#C8B289]/60 hover:text-white transition-colors cursor-pointer disabled:opacity-60"
                  title="Поделиться постером"
                  aria-label="Поделиться постером"
                >
                  <Share2 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={exporting}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#C8B289] px-5 min-h-[44px] text-sm font-bold text-[#111215] hover:bg-[#D9C6A2] active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer disabled:opacity-60"
                >
                  <Download className="w-4 h-4" />
                  <span>{exporting ? 'Рендер HD…' : 'Скачать PNG'}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center rounded-xl border border-white/10 bg-[#090A0D] p-3 sm:p-5">
              <canvas
                ref={canvasRef}
                className="max-h-[75vh] w-auto max-w-full rounded-lg shadow-2xl"
                style={{
                  aspectRatio: `${dims.width} / ${dims.height}`,
                }}
              />
            </div>

            {/* Collapsible Editable VK Post Caption Drawer */}
            <div className="mt-4 rounded-xl border border-white/10 bg-[#0E1014] overflow-hidden">
              <button
                type="button"
                onClick={() => setCaptionOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-200 hover:bg-white/[0.03] transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#C8B289]" />
                  <span>Текст поста для ВКонтакте</span>
                  {customVkCaption !== null && (
                    <span className="text-[10px] font-bold text-[#C8B289]">· отредактирован</span>
                  )}
                </span>
                {captionOpen ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {captionOpen && (
                <div className="border-t border-white/10 p-3.5 space-y-2.5">
                  <textarea
                    rows={6}
                    value={activeVkCaption}
                    onChange={(e) => setCustomVkCaption(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#14161C] p-3 text-xs leading-relaxed text-slate-100 focus:border-[#C8B289] focus:outline-none"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {activeVkCaption.length} симв. · готов к вставке в ВК
                    </span>
                    <div className="flex items-center gap-2">
                      {customVkCaption !== null && (
                        <button
                          type="button"
                          onClick={() => setCustomVkCaption(null)}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Автотекст</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleCopyVkText}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#C8B289] px-3 py-1.5 text-[11px] font-bold text-[#111215] hover:bg-[#D9C6A2] cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Скопировать текст</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
