import React, { useMemo, useState } from 'react';
import {
  Calendar,
  CopyPlus,
  Edit3,
  FolderHeart,
  Image as ImageIcon,
  MapPin,
  Play,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { ClubDatabase, MatchItem, OpponentTeam, PosterMode } from '../types/club';
import { formatRuDateShort, getMatchOutcome, getMatchScore } from '../utils/stats';
import { resolveAssetUrl } from '../lib/assetUrl';
import { ImageCropperControl } from './ImageCropperControl';

interface MatchesViewProps {
  db: ClubDatabase;
  openCreateTrigger: number;
  onAddMatch: (match: MatchItem) => void;
  onUpdateMatch: (match: MatchItem) => void;
  onDeleteMatch: (matchId: string) => void;
  onQuickAddOpponent: (opp: OpponentTeam) => void;
  onOpenLiveProtocol: (matchId: string) => void;
  onOpenPoster: (mode: PosterMode, matchId: string) => void;
}

function bumpRoundLabel(label: string): string {
  const m = label.match(/^(.*?)(\d+)(\s*)$/);
  if (!m) return label ? `${label} (копия)` : 'Новый тур';
  return `${m[1]}${parseInt(m[2], 10) + 1}${m[3]}`;
}

function addDaysToIso(dateStr: string, days: number): string {
  const parts = dateStr.split('-').map(Number);
  const d =
    parts.length === 3 && !parts.some(Number.isNaN)
      ? new Date(parts[0], parts[1] - 1, parts[2])
      : new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export const MatchesView: React.FC<MatchesViewProps> = ({
  db,
  openCreateTrigger,
  onAddMatch,
  onUpdateMatch,
  onDeleteMatch,
  onQuickAddOpponent,
  onOpenLiveProtocol,
  onOpenPoster,
}) => {
  const [seasonFilter, setSeasonFilter] = useState<string>('all');
  const [editingMatch, setEditingMatch] = useState<MatchItem | null>(null);
  const [isNewModal, setIsNewModal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showQuickOpp, setShowQuickOpp] = useState(false);
  const [quickOppName, setQuickOppName] = useState('');

  React.useEffect(() => {
    if (openCreateTrigger > 0) {
      openNewMatchModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCreateTrigger]);

  const openNewMatchModal = () => {
    const activePlayers = db.players.filter((p) => p.isActive);
    const activeGks = activePlayers.filter((p) => p.role === 'GK');
    const defaultGk = activeGks[0]?.id || '';
    const today = new Date().toISOString().slice(0, 10);

    setIsNewModal(true);
    setShowQuickOpp(db.opponents.length === 0);
    setQuickOppName('');
    setEditingMatch({
      id: `m_${Date.now()}`,
      seasonTagId: db.seasons[0]?.id || '',
      roundLabel: `Тур ${db.matches.length + 1}`,
      opponentId: db.opponents[0]?.id || '',
      isHome: true,
      date: today,
      time: '19:30',
      venue: db.club.defaultVenue || 'ФСЦ «Шушенское»',
      status: 'scheduled',
      halfDuration: 20,
      lineupPlayerIds: activePlayers.map((p) => p.id),
      startingFiveIds: activePlayers.slice(0, 5).map((p) => p.id),
      gkHalf1Id: defaultGk,
      gkHalf2Id: defaultGk,
      events: [],
      isTechnical: false,
      technicalWinner: null,
      penalties: null,
      mvpPlayerId: '',
    });
  };

  const handleDuplicateMatch = (source: MatchItem) => {
    const copy: MatchItem = {
      ...source,
      id: `m_${Date.now()}`,
      roundLabel: bumpRoundLabel(source.roundLabel),
      date: addDaysToIso(source.date, 7),
      status: 'scheduled',
      events: [],
      isTechnical: false,
      technicalWinner: null,
      penalties: null,
      mvpPlayerId: '',
      coverPhotoUrl: '',
    };
    setIsNewModal(true);
    setShowQuickOpp(false);
    setEditingMatch(copy);
  };

  const handleCreateInlineOpponent = () => {
    const name = quickOppName.trim();
    if (!name) return;
    const shortName = name.replace(/^(ФК|МФК|СК|ДЮСШ)\s+/i, '').trim() || name;
    const newOpp: OpponentTeam = {
      id: `opp_${Date.now()}`,
      name,
      shortName,
      logoUrl: '',
      logoMask: 'none',
      logoScale: 1,
      logoOffsetX: 0,
      logoOffsetY: 0,
    };
    onQuickAddOpponent(newOpp);
    setEditingMatch((prev) => (prev ? { ...prev, opponentId: newOpp.id } : prev));
    setQuickOppName('');
    setShowQuickOpp(false);
  };

  const filteredMatches = useMemo(() => {
    return db.matches
      .filter((m) => seasonFilter === 'all' || m.seasonTagId === seasonFilter)
      .sort((a, b) => {
        if (a.status === 'live' && b.status !== 'live') return -1;
        if (b.status === 'live' && a.status !== 'live') return 1;
        if (a.status === 'scheduled' && b.status === 'finished') return -1;
        if (b.status === 'scheduled' && a.status === 'finished') return 1;
        return b.date.localeCompare(a.date);
      });
  }, [db.matches, seasonFilter]);

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMatch) return;
    if (isNewModal) {
      onAddMatch(editingMatch);
    } else {
      onUpdateMatch(editingMatch);
    }
    setEditingMatch(null);
  };

  const toggleFormLineup = (pid: string) => {
    if (!editingMatch) return;
    const exists = editingMatch.lineupPlayerIds.includes(pid);
    setEditingMatch({
      ...editingMatch,
      lineupPlayerIds: exists
        ? editingMatch.lineupPlayerIds.filter((id) => id !== pid)
        : [...editingMatch.lineupPlayerIds, pid],
      startingFiveIds: exists
        ? editingMatch.startingFiveIds.filter((id) => id !== pid)
        : editingMatch.startingFiveIds,
    });
  };

  const toggleStartingFive = (pid: string) => {
    if (!editingMatch) return;
    const exists = editingMatch.startingFiveIds.includes(pid);
    if (!exists && editingMatch.startingFiveIds.length >= 5) return;
    const nextLineup = editingMatch.lineupPlayerIds.includes(pid)
      ? editingMatch.lineupPlayerIds
      : [...editingMatch.lineupPlayerIds, pid];
    setEditingMatch({
      ...editingMatch,
      lineupPlayerIds: nextLineup,
      startingFiveIds: exists
        ? editingMatch.startingFiveIds.filter((id) => id !== pid)
        : [...editingMatch.startingFiveIds, pid],
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-white">Матч-центр клуба</h1>
          <p className="mt-1 text-sm text-slate-400">
            Расписание, живой протокол у бровки поля, дублирование туров и мгновенные постеры
          </p>
        </div>

        <button
          type="button"
          onClick={openNewMatchModal}
          className="inline-flex items-center gap-2 rounded-xl bg-[#8B1723] px-4 min-h-[44px] text-sm font-semibold text-white hover:bg-[#A31D2B] transition-colors whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Добавить матч</span>
        </button>
      </div>

      {/* Season Filter Segmented Controls */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-[#14161C] p-1.5 w-fit max-w-full">
        <button
          type="button"
          onClick={() => setSeasonFilter('all')}
          className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
            seasonFilter === 'all' ? 'bg-[#8B1723] text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          Все турниры ({db.matches.length})
        </button>
        {db.seasons.map((s) => {
          const count = db.matches.filter((m) => m.seasonTagId === s.id).length;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSeasonFilter(s.id)}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                seasonFilter === s.id ? 'bg-[#8B1723] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {s.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Matches List */}
      {filteredMatches.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#14161C] p-10 text-center">
          <p className="font-display text-base font-bold text-white">Матчи не найдены</p>
          <p className="mt-2 text-sm text-slate-400">
            Добавьте ближайшую игру, чтобы сформировать анонс, заявку и вести протокол.
          </p>
          <button
            type="button"
            onClick={openNewMatchModal}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#8B1723] px-5 min-h-[44px] text-sm font-semibold text-white hover:bg-[#A31D2B] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Создать первый матч</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMatches.map((m) => {
            const opp = db.opponents.find((o) => o.id === m.opponentId);
            const season = db.seasons.find((s) => s.id === m.seasonTagId);
            const score = getMatchScore(m);
            const outcome = getMatchOutcome(m);
            const mvp = m.mvpPlayerId ? db.players.find((p) => p.id === m.mvpPlayerId) : undefined;

            const leftTeam = m.isHome ? db.club.name : opp?.name || 'Соперник';
            const rightTeam = m.isHome ? opp?.name || 'Соперник' : db.club.name;
            const leftLogo = m.isHome ? db.club.logoUrl : opp?.logoUrl || '';
            const rightLogo = m.isHome ? opp?.logoUrl || '' : db.club.logoUrl;
            const leftScore = m.isHome ? score.our : score.opponent;
            const rightScore = m.isHome ? score.opponent : score.our;

            return (
              <div
                key={m.id}
                className="rounded-2xl border border-white/10 bg-[#14161C] p-4 sm:p-5 transition-colors hover:border-[#C8B289]/35"
              >
                {/* Clean unboxed metadata header line */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-200">{season?.name || 'Товарищеский'}</span>
                    {m.roundLabel && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{m.roundLabel}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {formatRuDateShort(m.date)}, {m.time}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{m.isHome ? 'Дома' : 'В гостях'}</span>
                    {m.venue && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          {m.venue}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="font-semibold">
                    {m.status === 'live' && <span className="text-[#C8B289]">Идёт матч</span>}
                    {m.status === 'scheduled' && <span className="text-slate-400">Запланирован</span>}
                    {m.status === 'finished' && (
                      <span
                        className={
                          outcome === 'W'
                            ? 'text-emerald-400'
                            : outcome === 'L'
                            ? 'text-rose-400'
                            : 'text-[#C8B289]'
                        }
                      >
                        {outcome === 'W' ? 'Победа' : outcome === 'L' ? 'Поражение' : 'Ничья'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Main Matchup & Score Row */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4">
                  <div className="flex items-center gap-3 md:justify-end">
                    <span className="font-display text-sm sm:text-base font-bold text-white md:text-right">
                      {leftTeam}
                    </span>
                    {leftLogo && (
                      <img
                        src={resolveAssetUrl(leftLogo)}
                        alt={leftTeam}
                        referrerPolicy="no-referrer"
                        className="h-10 w-10 rounded-lg object-contain shrink-0"
                      />
                    )}
                  </div>

                  <div className="flex flex-col items-center justify-center px-4">
                    {m.status === 'scheduled' ? (
                      <span className="font-display text-lg font-extrabold text-slate-400 tabular-nums">
                        {m.time}
                      </span>
                    ) : (
                      <div className="text-center">
                        <div className="font-display text-2xl sm:text-3xl font-black text-white tabular-nums">
                          {leftScore} : {rightScore}
                        </div>
                        {m.penalties && (
                          <div className="text-xs font-bold text-[#C8B289] tabular-nums mt-0.5">
                            пен.{' '}
                            {m.isHome
                              ? `${m.penalties.our}:${m.penalties.opponent}`
                              : `${m.penalties.opponent}:${m.penalties.our}`}
                          </div>
                        )}
                        {m.isTechnical && (
                          <div className="text-[11px] font-bold text-[#C8B289]">ТП</div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {rightLogo && (
                      <img
                        src={resolveAssetUrl(rightLogo)}
                        alt={rightTeam}
                        referrerPolicy="no-referrer"
                        className="h-10 w-10 rounded-lg object-contain shrink-0"
                      />
                    )}
                    <span className="font-display text-sm sm:text-base font-bold text-white">
                      {rightTeam}
                    </span>
                  </div>
                </div>

                {/* Footer Action Bar */}
                <div className="mt-4 pt-3.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-400">
                    Заявка:{' '}
                    <span className="text-slate-200 font-semibold tabular-nums">
                      {m.lineupPlayerIds.length}
                    </span>
                    {mvp && (
                      <>
                        <span className="mx-2" aria-hidden="true">·</span>
                        <span>
                          MVP:{' '}
                          <strong className="text-[#C8B289]">
                            #{mvp.number} {mvp.shortName || mvp.fullName}
                          </strong>
                        </span>
                      </>
                    )}
                    {m.coverPhotoUrl && (
                      <>
                        <span className="mx-2" aria-hidden="true">·</span>
                        <span className="text-emerald-400 font-medium">Фото прикреплено</span>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenLiveProtocol(m.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B1723] px-3.5 min-h-[40px] text-xs font-bold text-white hover:bg-[#A31D2B] transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Протокол</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenPoster('matchday', m.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0E1014] px-3 min-h-[40px] text-xs font-semibold text-slate-200 hover:border-[#C8B289]/50 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5 text-[#C8B289]" />
                      <span>Анонс</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenPoster('lineup', m.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0E1014] px-3 min-h-[40px] text-xs font-semibold text-slate-200 hover:border-[#C8B289]/50 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5 text-[#C8B289]" />
                      <span>Состав</span>
                    </button>

                    {m.status !== 'scheduled' && (
                      <button
                        type="button"
                        onClick={() => onOpenPoster('results', m.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#C8B289]/15 border border-[#C8B289]/45 px-3 min-h-[40px] text-xs font-bold text-[#C8B289] hover:bg-[#C8B289]/25 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Итог</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDuplicateMatch(m)}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-white/10 bg-[#0E1014] text-slate-400 hover:text-[#C8B289] cursor-pointer"
                      title="Дублировать на следующий тур"
                      aria-label="Дублировать матч"
                    >
                      <CopyPlus className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsNewModal(false);
                        setShowQuickOpp(false);
                        setEditingMatch(m);
                      }}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-white/10 bg-[#0E1014] text-slate-400 hover:text-white cursor-pointer"
                      title="Редактировать матч"
                      aria-label="Редактировать матч"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {confirmDeleteId === m.id ? (
                      <div className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-950/50 px-2 py-1">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteMatch(m.id);
                            setConfirmDeleteId(null);
                          }}
                          className="rounded px-2 py-1 text-xs font-bold bg-rose-600 text-white cursor-pointer"
                        >
                          Удалить
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-1.5 text-xs text-slate-300 hover:text-white cursor-pointer"
                        >
                          Нет
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(m.id)}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-white/10 bg-[#0E1014] text-slate-400 hover:text-rose-400 cursor-pointer"
                        title="Удалить матч"
                        aria-label="Удалить матч"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Match Modal */}
      {editingMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSaveForm}
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#14161C] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="font-display text-base font-bold text-white">
                {isNewModal ? 'Новый матч клуба' : 'Редактировать матч'}
              </h2>
              <button
                type="button"
                onClick={() => setEditingMatch(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="block">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">Соперник</span>
                    <button
                      type="button"
                      onClick={() => setShowQuickOpp((v) => !v)}
                      className="text-[11px] font-semibold text-[#C8B289] hover:text-white cursor-pointer"
                    >
                      {showQuickOpp ? 'Скрыть' : '+ Быстро создать'}
                    </button>
                  </div>
                  <select
                    value={editingMatch.opponentId}
                    onChange={(e) =>
                      setEditingMatch({ ...editingMatch, opponentId: e.target.value })
                    }
                    required
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
                  >
                    <option value="">Выберите соперника</option>
                    {db.opponents.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>

                  {showQuickOpp && (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="text"
                        value={quickOppName}
                        onChange={(e) => setQuickOppName(e.target.value)}
                        placeholder="Например: ФК Абакан"
                        className="flex-1 min-h-[38px] rounded-lg border border-[#C8B289]/40 bg-[#0E1014] px-3 text-xs text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleCreateInlineOpponent}
                        className="min-h-[38px] rounded-lg bg-[#C8B289] px-3 text-xs font-bold text-[#111215] cursor-pointer"
                      >
                        Добавить
                      </button>
                    </div>
                  )}
                </div>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-400">Турнир / Сезон</span>
                  <select
                    value={editingMatch.seasonTagId}
                    onChange={(e) =>
                      setEditingMatch({ ...editingMatch, seasonTagId: e.target.value })
                    }
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
                  >
                    <option value="">Без турнира</option>
                    {db.seasons.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-400">Тур / Стадия</span>
                  <input
                    type="text"
                    value={editingMatch.roundLabel}
                    onChange={(e) =>
                      setEditingMatch({ ...editingMatch, roundLabel: e.target.value })
                    }
                    placeholder="Тур 9 / Полуфинал"
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-400">Площадка / Зал</span>
                  <input
                    type="text"
                    value={editingMatch.venue}
                    onChange={(e) => setEditingMatch({ ...editingMatch, venue: e.target.value })}
                    placeholder={db.club.defaultVenue || 'ФСЦ «Шушенское»'}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-400">Дата</span>
                  <input
                    type="date"
                    value={editingMatch.date}
                    onChange={(e) => setEditingMatch({ ...editingMatch, date: e.target.value })}
                    required
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white tabular-nums focus:border-[#C8B289] focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-400">Время</span>
                  <input
                    type="time"
                    value={editingMatch.time}
                    onChange={(e) => setEditingMatch({ ...editingMatch, time: e.target.value })}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white tabular-nums focus:border-[#C8B289] focus:outline-none"
                  />
                </label>
              </div>

              {/* Home/Away & Half Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-semibold text-slate-400">Статус площадки</span>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingMatch({ ...editingMatch, isHome: true })}
                      className={`min-h-[42px] rounded-xl text-xs font-bold cursor-pointer ${
                        editingMatch.isHome
                          ? 'bg-[#8B1723] text-white'
                          : 'border border-white/10 bg-[#0E1014] text-slate-400'
                      }`}
                    >
                      Дома
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingMatch({ ...editingMatch, isHome: false })}
                      className={`min-h-[42px] rounded-xl text-xs font-bold cursor-pointer ${
                        !editingMatch.isHome
                          ? 'bg-[#8B1723] text-white'
                          : 'border border-white/10 bg-[#0E1014] text-slate-400'
                      }`}
                    >
                      В гостях
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-400">Длительность тайма</span>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {([20, 25] as const).map((dur) => (
                      <button
                        key={dur}
                        type="button"
                        onClick={() => setEditingMatch({ ...editingMatch, halfDuration: dur })}
                        className={`min-h-[42px] rounded-xl text-xs font-bold cursor-pointer ${
                          editingMatch.halfDuration === dur
                            ? 'bg-[#8B1723] text-white'
                            : 'border border-white/10 bg-[#0E1014] text-slate-400'
                        }`}
                      >
                        2 × {dur} мин
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Optional Match Photo */}
              <ImageCropperControl
                label="Игровое фото матча (опционально)"
                hint="Автоматически подставится в постеры «Матч ТВ» и «Кинокадр»"
                imageUrl={editingMatch.coverPhotoUrl || ''}
                scale={editingMatch.coverPhotoScale ?? 1.02}
                offsetX={editingMatch.coverPhotoOffsetX ?? 0}
                offsetY={editingMatch.coverPhotoOffsetY ?? 0}
                aspect="landscape"
                fitMode="cover"
                onChange={(patch) =>
                  setEditingMatch({
                    ...editingMatch,
                    ...(patch.imageUrl !== undefined ? { coverPhotoUrl: patch.imageUrl } : {}),
                    ...(patch.scale !== undefined ? { coverPhotoScale: patch.scale } : {}),
                    ...(patch.offsetX !== undefined ? { coverPhotoOffsetX: patch.offsetX } : {}),
                    ...(patch.offsetY !== undefined ? { coverPhotoOffsetY: patch.offsetY } : {}),
                  })
                }
              />

              {(db.mediaGallery || []).length > 0 && (
                <div className="rounded-xl border border-white/10 bg-[#0E1014] p-2.5 space-y-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
                    <FolderHeart className="w-3.5 h-3.5 text-[#C8B289]" />
                    <span>Выбрать обложку из медиатеки ({(db.mediaGallery || []).length})</span>
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {(db.mediaGallery || []).map((item) => {
                      const isSelected = editingMatch.coverPhotoUrl === item.imageUrl;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            setEditingMatch({
                              ...editingMatch,
                              coverPhotoUrl: item.imageUrl,
                              coverPhotoScale: 1.02,
                              coverPhotoOffsetX: 0,
                              coverPhotoOffsetY: 0,
                            })
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

              {/* Squad Checkboxes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400">
                    Заявка ({editingMatch.lineupPlayerIds.length}) · Старт 5 (
                    {editingMatch.startingFiveIds.length}/5)
                  </span>
                </div>
                {db.players.length === 0 ? (
                  <p className="rounded-xl border border-white/10 bg-[#0E1014] p-3 text-xs text-slate-400">
                    Игроки ещё не добавлены — вы сможете отметить заявку позже в разделе «Состав».
                  </p>
                ) : (
                  <div className="max-h-52 overflow-y-auto space-y-1.5 rounded-xl border border-white/10 bg-[#0E1014] p-2.5">
                    {[...db.players]
                      .sort((a, b) => a.number - b.number)
                      .map((p) => {
                        const inLineup = editingMatch.lineupPlayerIds.includes(p.id);
                        const inStart = editingMatch.startingFiveIds.includes(p.id);
                        return (
                          <div
                            key={p.id}
                            className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5"
                          >
                            <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer flex-1 min-w-0">
                              <input
                                type="checkbox"
                                checked={inLineup}
                                onChange={() => toggleFormLineup(p.id)}
                                className="h-4 w-4 accent-[#8B1723]"
                              />
                              <span className="font-display font-bold tabular-nums w-7">
                                #{p.number}
                              </span>
                              <span className="truncate">{p.fullName}</span>
                              {p.role === 'GK' && (
                                <span className="text-[#C8B289] font-bold">ВР</span>
                              )}
                            </label>
                            <button
                              type="button"
                              onClick={() => toggleStartingFive(p.id)}
                              className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                                inStart
                                  ? 'bg-[#C8B289] text-[#111215]'
                                  : 'border border-white/10 text-slate-400 hover:text-white'
                              }`}
                            >
                              {inStart ? 'Старт' : 'В старт'}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-white/10 px-5 py-4">
              <button
                type="button"
                onClick={() => setEditingMatch(null)}
                className="min-h-[42px] rounded-xl border border-white/10 px-4 text-sm font-semibold text-slate-300 hover:text-white cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="min-h-[42px] rounded-xl bg-[#8B1723] px-5 text-sm font-bold text-white hover:bg-[#A31D2B] cursor-pointer"
              >
                Сохранить матч
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
