import React, { useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertTriangle,
  Check,
  Clock,
  Cloud,
  CloudOff,
  Download,
  Eraser,
  LogIn,
  LogOut,
  Palette,
  Plus,
  RefreshCw,
  RotateCcw,
  Shield,
  Tag,
  Trash2,
  Upload,
} from 'lucide-react';
import { ClubDatabase, ClubProfile, LogoMaskMode, SeasonTag } from '../types/club';
import { FORTUNA_LOGO_PRESETS } from '../data/brandAssets';
import { resolveAssetUrl } from '../lib/assetUrl';
import { CloudSyncStatus } from '../lib/cloudSync';
import { FIREBASE_PROJECT_ID } from '../lib/firebase';
import { exportDatabaseToJson, importDatabaseFromFile } from '../lib/storage';
import { ImageCropperControl } from './ImageCropperControl';
import { PWAInstallButton } from './PWAControls';

interface ClubSettingsViewProps {
  db: ClubDatabase;
  cloudUser: User | null;
  cloudStatus: CloudSyncStatus;
  cloudError: string | null;
  onGoogleSignIn: () => Promise<void>;
  onGoogleSignOut: () => Promise<void>;
  onForceCloudSync: () => Promise<void>;
  onUpdateClub: (patch: Partial<ClubProfile>) => void;
  onAddSeason: (season: SeasonTag) => void;
  onDeleteSeason: (seasonId: string) => void;
  onImportDatabase: (nextDb: ClubDatabase) => void;
  onClearDemoData: () => void;
  onResetDemo: () => void;
  onMarkBackupExported: () => void;
  onNotify: (msg: string) => void;
}

const MASK_OPTIONS: { id: LogoMaskMode; label: string }[] = [
  { id: 'shield', label: 'Щит' },
  { id: 'circle', label: 'Круглая медаль' },
  { id: 'none', label: 'Без обрезки (PNG)' },
];

function formatBackupStatus(iso?: string): { text: string; isFresh: boolean; isMissing: boolean } {
  if (!iso) {
    return { text: 'Ещё не создавалась — рекомендуем скачать .json', isFresh: false, isMissing: true };
  }
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) {
    return { text: 'Дата неизвестна', isFresh: false, isMissing: true };
  }
  const diffDays = Math.floor((Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) {
    return {
      text: `Обновлена сегодня (${dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })})`,
      isFresh: true,
      isMissing: false,
    };
  }
  if (diffDays <= 7) {
    return { text: `${diffDays} дн. назад`, isFresh: true, isMissing: false };
  }
  return { text: `${diffDays} дн. назад — пора обновить копию`, isFresh: false, isMissing: false };
}

export const ClubSettingsView: React.FC<ClubSettingsViewProps> = ({
  db,
  cloudUser,
  cloudStatus,
  cloudError,
  onGoogleSignIn,
  onGoogleSignOut,
  onForceCloudSync,
  onUpdateClub,
  onAddSeason,
  onDeleteSeason,
  onImportDatabase,
  onClearDemoData,
  onResetDemo,
  onMarkBackupExported,
  onNotify,
}) => {
  const importRef = useRef<HTMLInputElement | null>(null);
  const [newSeasonName, setNewSeasonName] = useState('');
  const [newSeasonLabel, setNewSeasonLabel] = useState('Футзал · 5×5');
  const [confirmDeleteSeasonId, setConfirmDeleteSeasonId] = useState<string | null>(null);
  const [confirmClearDemo, setConfirmClearDemo] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  const backupInfo = useMemo(() => formatBackupStatus(db.lastBackupAt), [db.lastBackupAt]);

  const handleSignInClick = async () => {
    setAuthBusy(true);
    try {
      await onGoogleSignIn();
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOutClick = async () => {
    setAuthBusy(true);
    try {
      await onGoogleSignOut();
    } finally {
      setAuthBusy(false);
    }
  };

  const handleForceSyncClick = async () => {
    setAuthBusy(true);
    try {
      await onForceCloudSync();
    } finally {
      setAuthBusy(false);
    }
  };

  const handleAddSeason = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSeasonName.trim()) return;
    onAddSeason({
      id: `s_${Date.now()}`,
      name: newSeasonName.trim(),
      seasonLabel: newSeasonLabel.trim() || 'Сезон',
      isArchived: false,
    });
    setNewSeasonName('');
    onNotify('Турнирный тег добавлен');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const nextDb = await importDatabaseFromFile(file);
      onImportDatabase(nextDb);
      onNotify('База клуба успешно восстановлена из JSON');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Ошибка импорта JSON');
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  };

  const applyLogoPreset = (preset: (typeof FORTUNA_LOGO_PRESETS)[number]) => {
    onUpdateClub({
      logoUrl: preset.url,
      logoMask: preset.mask,
      logoScale: preset.scale,
      logoOffsetX: preset.offsetX,
      logoOffsetY: preset.offsetY,
    });
    onNotify(`Применён логотип: ${preset.name}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-white">
            Профиль и брендбук клуба
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Премиум-варианты логотипа ФК «Фортуна», фирменная палитра с эмблемы и резервные копии базы
          </p>
        </div>
        <PWAInstallButton />
      </div>

      {/* Premium Logo Variants Gallery for FC Fortuna */}
      <div className="rounded-2xl border border-[#C8B289]/30 bg-[#14161C] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#C8B289]" />
            <h2 className="font-display text-sm font-bold text-white">
              Варианты логотипа ФК «Фортуна» (переключение в 1 клик)
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            Автоматическая маска убирает фон и добавляет матовую латунную оправу на постерах
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {FORTUNA_LOGO_PRESETS.map((preset) => {
            const isSelected = db.club.logoUrl === preset.url;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyLogoPreset(preset)}
                className={`flex items-center gap-4 rounded-xl p-3.5 text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border border-[#C8B289] bg-[#C8B289]/10'
                    : 'border border-white/10 bg-[#0E1014] hover:border-white/25'
                }`}
              >
                <div
                  className={`h-20 w-20 shrink-0 overflow-hidden bg-[#121418] border border-[#C8B289]/40 ${
                    preset.mask === 'circle' ? 'rounded-full' : 'rounded-xl'
                  }`}
                >
                  <img
                    src={resolveAssetUrl(preset.url)}
                    alt={preset.name}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-contain"
                    style={{
                      transform: `scale(${preset.scale}) translate(${preset.offsetX * 0.5}%, ${preset.offsetY * 0.5}%)`,
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display text-xs font-bold text-white leading-snug">
                      {preset.name}
                    </p>
                    {isSelected && (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#C8B289] text-[#111215]">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                    {preset.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Club Identity & Brandbook */}
        <div className="space-y-5 rounded-2xl border border-white/10 bg-[#14161C] p-5">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-[#8B1723]" />
            <h2 className="font-display text-sm font-bold text-white">Основные данные и палитра</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-semibold text-slate-400">Полное название клуба</span>
              <input
                type="text"
                value={db.club.name}
                onChange={(e) => onUpdateClub({ name: e.target.value })}
                className="mt-1 w-full min-h-[44px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-400">Короткое название</span>
              <input
                type="text"
                value={db.club.shortName}
                onChange={(e) => onUpdateClub({ shortName: e.target.value })}
                className="mt-1 w-full min-h-[44px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-400">Город / Населённый пункт</span>
              <input
                type="text"
                value={db.club.city}
                onChange={(e) => onUpdateClub({ city: e.target.value })}
                className="mt-1 w-full min-h-[44px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-400">
                Ссылка / водяной знак группы ВК
              </span>
              <input
                type="text"
                value={db.club.vkLink}
                onChange={(e) => onUpdateClub({ vkLink: e.target.value })}
                placeholder="vk.com/fc_fortuna_shush"
                className="mt-1 w-full min-h-[44px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold text-slate-400">
                Домашняя площадка по умолчанию (подставляется в новые матчи)
              </span>
              <input
                type="text"
                value={db.club.defaultVenue || ''}
                onChange={(e) => onUpdateClub({ defaultVenue: e.target.value })}
                placeholder="ФСЦ «Шушенское»"
                className="mt-1 w-full min-h-[44px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
              />
            </label>
          </div>

          {/* 3 HEX Color Pickers */}
          <div className="grid grid-cols-3 gap-3 pt-1">
            {(
              [
                { key: 'primaryColor', label: 'Основной (Рубин)' },
                { key: 'secondaryColor', label: 'Тёмный (Антрацит)' },
                { key: 'accentColor', label: 'Акцент (Шампань)' },
              ] as const
            ).map((c) => (
              <label
                key={c.key}
                className="block rounded-xl border border-white/10 bg-[#0E1014] p-3"
              >
                <span className="text-[11px] font-semibold text-slate-400 block mb-2">
                  {c.label}
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={db.club[c.key]}
                    onChange={(e) => onUpdateClub({ [c.key]: e.target.value })}
                    className="h-9 w-9 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                  />
                  <input
                    type="text"
                    value={db.club[c.key].toUpperCase()}
                    onChange={(e) => onUpdateClub({ [c.key]: e.target.value })}
                    className="w-full bg-transparent text-xs font-mono font-bold text-white focus:outline-none"
                  />
                </div>
              </label>
            ))}
          </div>

          {/* Main Logo Mask Mode */}
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-2">
              Оправа и обрезка основного логотипа
            </p>
            <div className="grid grid-cols-3 gap-2">
              {MASK_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdateClub({ logoMask: opt.id })}
                  className={`min-h-[40px] rounded-lg text-xs font-semibold cursor-pointer ${
                    (db.club.logoMask || 'none') === opt.id
                      ? 'bg-[#8B1723] text-white'
                      : 'border border-white/10 bg-[#0E1014] text-slate-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Main Logo Cropper */}
          <ImageCropperControl
            label="Основной логотип клуба"
            hint="Подстройте масштаб так, чтобы оправа щита или медали встала идеально по контуру"
            imageUrl={db.club.logoUrl}
            scale={db.club.logoScale}
            offsetX={db.club.logoOffsetX}
            offsetY={db.club.logoOffsetY}
            aspect="square"
            maskPreview={db.club.logoMask || 'none'}
            onChange={(patch) =>
              onUpdateClub({
                ...(patch.imageUrl !== undefined ? { logoUrl: patch.imageUrl } : {}),
                ...(patch.scale !== undefined ? { logoScale: patch.scale } : {}),
                ...(patch.offsetX !== undefined ? { logoOffsetX: patch.offsetX } : {}),
                ...(patch.offsetY !== undefined ? { logoOffsetY: patch.offsetY } : {}),
              })
            }
          />

          {/* Alt Logo Mask Mode */}
          <div className="pt-2 border-t border-white/10">
            <p className="text-xs font-semibold text-slate-400 mb-2">
              Оправа альтернативного логотипа
            </p>
            <div className="grid grid-cols-3 gap-2">
              {MASK_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdateClub({ altLogoMask: opt.id })}
                  className={`min-h-[40px] rounded-lg text-xs font-semibold cursor-pointer ${
                    (db.club.altLogoMask || 'circle') === opt.id
                      ? 'bg-[#8B1723] text-white'
                      : 'border border-white/10 bg-[#0E1014] text-slate-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Alt Monochrome/Dark Logo with Independent Crop */}
          <ImageCropperControl
            label="Альтернативный тёмный / золотой логотип"
            hint="Независимое кадрирование — переключается в 1 клик прямо в Медиа-студии"
            imageUrl={db.club.altLogoUrl}
            scale={db.club.altLogoScale ?? 1.24}
            offsetX={db.club.altLogoOffsetX ?? 0}
            offsetY={db.club.altLogoOffsetY ?? 0}
            aspect="square"
            maskPreview={db.club.altLogoMask || 'circle'}
            onChange={(patch) =>
              onUpdateClub({
                ...(patch.imageUrl !== undefined ? { altLogoUrl: patch.imageUrl } : {}),
                ...(patch.scale !== undefined ? { altLogoScale: patch.scale } : {}),
                ...(patch.offsetX !== undefined ? { altLogoOffsetX: patch.offsetX } : {}),
                ...(patch.offsetY !== undefined ? { altLogoOffsetY: patch.offsetY } : {}),
              })
            }
          />
        </div>

        {/* Right Column: Cloud Sync + Season Tags + Offline JSON Backup */}
        <div className="space-y-6">
          {/* Cloud Sync (Phone <-> PC) */}
          <div className="rounded-2xl border border-[#C8B289]/35 bg-[#14161C] p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {cloudStatus === 'offline' || cloudStatus === 'error' ? (
                  <CloudOff className="w-4 h-4 text-amber-400 shrink-0" />
                ) : (
                  <Cloud className="w-4 h-4 text-[#C8B289] shrink-0" />
                )}
                <h2 className="font-display text-sm font-bold text-white">
                  Облачная синхронизация (Телефон ↔ ПК)
                </h2>
              </div>
              {cloudUser && (
                <span
                  className={`text-[11px] font-semibold shrink-0 ${
                    cloudStatus === 'synced'
                      ? 'text-emerald-400'
                      : cloudStatus === 'syncing' || cloudStatus === 'connecting'
                      ? 'text-[#C8B289]'
                      : cloudStatus === 'offline'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {cloudStatus === 'synced'
                    ? 'Синхронизировано'
                    : cloudStatus === 'connecting'
                    ? 'Подключение…'
                    : cloudStatus === 'syncing'
                    ? 'Сохранение…'
                    : cloudStatus === 'offline'
                    ? 'Офлайн — ждёт сеть'
                    : 'Ошибка связи'}
                </span>
              )}
            </div>

            {!cloudUser ? (
              <div className="space-y-3.5">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Войдите через Google на телефоне и компьютере — матчи, составы, медиатека и
                  статистика будут синхронизироваться автоматически в реальном времени. В зале без
                  связи всё продолжит работать офлайн и отправится в облако при появлении сети.
                </p>

                <button
                  type="button"
                  onClick={handleSignInClick}
                  disabled={authBusy}
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[#8B1723] px-4 min-h-[44px] text-sm font-bold text-white hover:bg-[#A31D2B] disabled:opacity-60 transition-colors cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{authBusy ? 'Открываем вход Google…' : 'Войти через Google'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0E1014] p-3">
                  {cloudUser.photoURL ? (
                    <img
                      src={cloudUser.photoURL}
                      alt={cloudUser.displayName || 'Аккаунт Google'}
                      referrerPolicy="no-referrer"
                      className="h-10 w-10 rounded-full object-cover border border-[#C8B289]/40 shrink-0"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8B1723]/30 border border-[#C8B289]/40 font-display text-sm font-bold text-[#C8B289] shrink-0">
                      {(cloudUser.displayName || cloudUser.email || 'G')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">
                      {cloudUser.displayName || 'Менеджер клуба'}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{cloudUser.email}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleForceSyncClick}
                    disabled={authBusy || cloudStatus === 'syncing' || cloudStatus === 'connecting'}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#C8B289]/40 bg-[#C8B289]/10 px-3.5 min-h-[40px] text-xs font-bold text-[#C8B289] hover:bg-[#C8B289]/18 disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        cloudStatus === 'syncing' || cloudStatus === 'connecting'
                          ? 'animate-spin'
                          : ''
                      }`}
                    />
                    <span>Синхронизировать сейчас</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSignOutClick}
                    disabled={authBusy}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-[#0E1014] px-3.5 min-h-[40px] text-xs font-semibold text-slate-300 hover:border-rose-500/40 hover:text-rose-300 disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Выйти</span>
                  </button>
                </div>
              </div>
            )}

            {cloudError && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200 leading-relaxed">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p>{cloudError}</p>
                  <p className="mt-1 text-[11px] text-rose-300/80">
                    Проект Firebase: <span className="font-mono">{FIREBASE_PROJECT_ID}</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#14161C] p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#C8B289]" />
              <h2 className="font-display text-sm font-bold text-white">
                Справочник турниров и сезонов
              </h2>
            </div>

            <form
              onSubmit={handleAddSeason}
              className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2.5"
            >
              <div className="space-y-2">
                <input
                  type="text"
                  value={newSeasonName}
                  onChange={(e) => setNewSeasonName(e.target.value)}
                  placeholder="Например: Летний кубок Шушенского 2026"
                  className="w-full min-h-[42px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
                />
                <input
                  type="text"
                  value={newSeasonLabel}
                  onChange={(e) => setNewSeasonLabel(e.target.value)}
                  placeholder="Подпись (например: Футзал · 5×5)"
                  className="w-full min-h-[38px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-xs text-slate-300 focus:border-[#C8B289] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#8B1723] px-4 min-h-[42px] text-xs font-bold text-white hover:bg-[#A31D2B] self-start cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Добавить</span>
              </button>
            </form>

            <div className="divide-y divide-white/5">
              {db.seasons.map((s) => {
                const confirming = confirmDeleteSeasonId === s.id;
                const attachedCount = db.matches.filter((m) => m.seasonTagId === s.id).length;
                return (
                  <div key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{s.name}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {s.seasonLabel}
                        {attachedCount > 0 ? ` · ${attachedCount} матч.` : ''}
                      </p>
                    </div>
                    {confirming ? (
                      <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                        {attachedCount > 0 && (
                          <span className="text-[10px] font-semibold text-amber-300 mr-1">
                            Привязано матчей: {attachedCount}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteSeason(s.id);
                            setConfirmDeleteSeasonId(null);
                          }}
                          className="rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-500 cursor-pointer"
                        >
                          Удалить
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteSeasonId(null)}
                          className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-slate-300 hover:text-white cursor-pointer"
                        >
                          Нет
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteSeasonId(s.id)}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer shrink-0"
                        aria-label="Удалить турнир"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#14161C] p-5 space-y-4">
            <div>
              <h2 className="font-display text-sm font-bold text-white">
                Автономная база и резервные копии (.JSON)
              </h2>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Полная локальная копия хранится в IndexedDB для работы без интернета. JSON-архив
                удобен как дополнительная страховка в конце сезона или для передачи другому
                менеджеру.
              </p>
            </div>

            {/* Backup freshness notice */}
            <div
              className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs ${
                backupInfo.isFresh
                  ? 'border-emerald-500/25 bg-emerald-500/5 text-emerald-300'
                  : 'border-[#C8B289]/30 bg-[#C8B289]/8 text-[#C8B289]'
              }`}
            >
              <Clock className="w-4 h-4 shrink-0" />
              <span>
                <strong className="font-semibold">Копия базы:</strong> {backupInfo.text}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  exportDatabaseToJson(db);
                  onMarkBackupExported();
                  onNotify('Резервная копия .json скачана');
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#8B1723] px-4 min-h-[44px] text-sm font-bold text-white hover:bg-[#A31D2B] transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Скачать базу (.json)</span>
              </button>

              <button
                type="button"
                onClick={() => importRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#0E1014] px-4 min-h-[44px] text-sm font-semibold text-white hover:border-[#C8B289]/60 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Загрузить базу (.json)</span>
              </button>
              <input
                ref={importRef}
                type="file"
                accept="application/json,.json"
                onChange={handleImportFile}
                className="hidden"
              />
            </div>

            <div className="pt-3 border-t border-white/10 space-y-3">
              <p className="text-xs text-slate-400">
                Игроков: <strong className="text-white tabular-nums">{db.players.length}</strong> ·
                Соперников:{' '}
                <strong className="text-white tabular-nums">{db.opponents.length}</strong> · Матчей:{' '}
                <strong className="text-white tabular-nums">{db.matches.length}</strong>
              </p>

              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Clean Slate Season Start */}
                {!confirmClearDemo ? (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmClearDemo(true);
                      setConfirmReset(false);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0E1014] px-3 py-2 text-xs font-semibold text-slate-300 hover:border-[#C8B289]/50 hover:text-white cursor-pointer"
                  >
                    <Eraser className="w-3.5 h-3.5 text-[#C8B289]" />
                    <span>Начать с чистого листа (очистить демо)</span>
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#C8B289]/40 bg-[#0E1014] px-3 py-2">
                    <span className="text-[11px] text-slate-300">
                      Брендбук сохранится, матчи и игроки очистятся:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onClearDemoData();
                        setConfirmClearDemo(false);
                      }}
                      className="rounded-lg bg-[#8B1723] px-2.5 py-1 text-xs font-bold text-white hover:bg-[#A31D2B] cursor-pointer"
                    >
                      Очистить
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearDemo(false)}
                      className="text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      Отмена
                    </button>
                  </div>
                )}

                {/* Restore Demo */}
                {!confirmReset ? (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmReset(true);
                      setConfirmClearDemo(false);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-rose-400 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Сбросить к демо ФК Фортуна</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onResetDemo();
                        setConfirmReset(false);
                      }}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-500 cursor-pointer"
                    >
                      Подтвердить сброс
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      Отмена
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
