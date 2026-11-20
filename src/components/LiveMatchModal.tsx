import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Shield,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { ClubDatabase, MatchEvent, MatchEventType, MatchItem } from '../types/club';
import { getMatchScore, resolveMatchGoalkeepers } from '../utils/stats';

interface LiveMatchModalProps {
  db: ClubDatabase;
  match: MatchItem;
  onSave: (updated: MatchItem) => void;
  onClose: () => void;
  onOpenResultsPoster: (matchId: string) => void;
}

export const LiveMatchModal: React.FC<LiveMatchModalProps> = ({
  db,
  match,
  onSave,
  onClose,
  onOpenResultsPoster,
}) => {
  const [draft, setDraft] = useState<MatchItem>(() => ({
    ...match,
    events: [...match.events],
    lineupPlayerIds: [...match.lineupPlayerIds],
    startingFiveIds: [...match.startingFiveIds],
  }));

  const [activeHalf, setActiveHalf] = useState<1 | 2>(1);
  const [eventMode, setEventMode] = useState<MatchEventType>('goal_our');
  const [minute, setMinute] = useState<number>(() =>
    match.events.length > 0
      ? Math.min(match.halfDuration * 2, match.events[match.events.length - 1].minute + 1)
      : 1
  );
  const [playerId, setPlayerId] = useState<string>('');
  const [assistPlayerId, setAssistPlayerId] = useState<string>('');
  const [isPenalty, setIsPenalty] = useState(false);

  // Built-in pitchside half stopwatch
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => {
      setElapsedSec((prev) => {
        const next = prev + 1;
        const computedMinute = Math.min(
          draft.halfDuration * 2 + 10,
          (activeHalf === 1 ? 0 : draft.halfDuration) + Math.floor(next / 60) + 1
        );
        setMinute(computedMinute);
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning, activeHalf, draft.halfDuration]);

  const opponent = db.opponents.find((o) => o.id === draft.opponentId);
  const gks = useMemo(() => db.players.filter((p) => p.role === 'GK'), [db.players]);
  const resolvedGks = useMemo(() => resolveMatchGoalkeepers(draft, db.players), [draft, db.players]);

  const currentHalfGkId = activeHalf === 1 ? resolvedGks.gkHalf1Id : resolvedGks.gkHalf2Id;
  const [concededGkId, setConcededGkId] = useState<string>(currentHalfGkId);

  const squadPlayers = useMemo(() => {
    const inLineup = db.players.filter((p) => draft.lineupPlayerIds.includes(p.id));
    return (inLineup.length > 0 ? inLineup : db.players.filter((p) => p.isActive)).sort(
      (a, b) => a.number - b.number
    );
  }, [db.players, draft.lineupPlayerIds]);

  const score = getMatchScore(draft);
  const playerMap = useMemo(() => new Map(db.players.map((p) => [p.id, p])), [db.players]);

  const updateDraft = (updater: (prev: MatchItem) => MatchItem) => {
    setDraft((prev) => {
      const next = updater(prev);
      onSave(next);
      return next;
    });
  };

  const handleHalfChange = (half: 1 | 2) => {
    setActiveHalf(half);
    setTimerRunning(false);
    setElapsedSec(0);
    const nextGk = half === 1 ? resolvedGks.gkHalf1Id : resolvedGks.gkHalf2Id;
    setConcededGkId(nextGk);
    setMinute(half === 1 ? 1 : draft.halfDuration + 1);
  };

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    const newEvent: MatchEvent = {
      id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      half: activeHalf,
      minute: Math.max(1, Math.min(99, minute || 1)),
      type: eventMode,
    };

    if (eventMode === 'goal_our') {
      if (!playerId) return;
      newEvent.playerId = playerId;
      if (assistPlayerId && assistPlayerId !== playerId) {
        newEvent.assistPlayerId = assistPlayerId;
      }
      if (isPenalty) newEvent.isPenalty = true;
    } else if (eventMode === 'goal_opp') {
      newEvent.concededGkId = concededGkId || currentHalfGkId || undefined;
    } else if (eventMode === 'own_goal_our') {
      if (playerId) newEvent.playerId = playerId;
      newEvent.concededGkId = concededGkId || currentHalfGkId || undefined;
    } else if (eventMode === 'yellow' || eventMode === 'red') {
      if (!playerId) return;
      newEvent.playerId = playerId;
    }

    updateDraft((prev) => ({
      ...prev,
      status: prev.status === 'scheduled' ? 'live' : prev.status,
      isTechnical: false,
      technicalWinner: null,
      events: [...prev.events, newEvent].sort((a, b) => a.minute - b.minute),
    }));

    setPlayerId('');
    setAssistPlayerId('');
    setIsPenalty(false);
    if (!timerRunning) {
      setMinute((m) => Math.min(draft.halfDuration * 2 + 10, m + 1));
    }
  };

  const handleRemoveEvent = (id: string) => {
    updateDraft((prev) => ({
      ...prev,
      events: prev.events.filter((ev) => ev.id !== id),
    }));
  };

  const handleUndoLastEvent = () => {
    updateDraft((prev) => {
      if (prev.events.length === 0) return prev;
      return {
        ...prev,
        events: prev.events.slice(0, -1),
      };
    });
  };

  const handleAdjustEventMinute = (id: string, delta: number) => {
    updateDraft((prev) => ({
      ...prev,
      events: prev.events
        .map((ev) =>
          ev.id === id
            ? { ...ev, minute: Math.max(1, Math.min(99, ev.minute + delta)) }
            : ev
        )
        .sort((a, b) => a.minute - b.minute),
    }));
  };

  const togglePenalties = (enabled: boolean) => {
    updateDraft((prev) => ({
      ...prev,
      penalties: enabled ? prev.penalties || { our: 3, opponent: 2 } : null,
    }));
  };

  const setTechnical = (winner: 'our' | 'opponent' | null) => {
    updateDraft((prev) => ({
      ...prev,
      isTechnical: winner !== null,
      technicalWinner: winner,
      status: winner !== null ? 'finished' : prev.status,
    }));
  };

  const formatTimer = (sec: number) => {
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const formatEventLabel = (ev: MatchEvent): { title: string; subtitle: string; badge: string } => {
    const pl = ev.playerId ? playerMap.get(ev.playerId) : undefined;
    const asst = ev.assistPlayerId ? playerMap.get(ev.assistPlayerId) : undefined;
    const gk = ev.concededGkId ? playerMap.get(ev.concededGkId) : undefined;

    switch (ev.type) {
      case 'goal_our':
        return {
          badge: 'ГОЛ',
          title: `${pl ? `#${pl.number} ${pl.fullName}` : 'Игрок клуба'}${ev.isPenalty ? ' (пен.)' : ''}`,
          subtitle: asst ? `Ассист: ${asst.shortName || asst.fullName}` : 'Без ассистента',
        };
      case 'own_goal_opp':
        return {
          badge: 'ГОЛ (АГ)',
          title: 'Автогол соперника',
          subtitle: 'Гол в нашу пользу',
        };
      case 'goal_opp':
        return {
          badge: 'ПРОПУЩ.',
          title: `Гол ${opponent?.shortName || 'соперника'}`,
          subtitle: gk ? `В воротах: ${gk.shortName || gk.fullName}` : 'Вратарь не указан',
        };
      case 'own_goal_our':
        return {
          badge: 'АВТОГОЛ',
          title: pl ? `Автогол: ${pl.fullName}` : 'Автогол нашего игрока',
          subtitle: gk ? `Записан в ПМ: ${gk.shortName || gk.fullName}` : 'Гол сопернику',
        };
      case 'yellow':
        return {
          badge: 'ЖК',
          title: pl ? `#${pl.number} ${pl.fullName}` : 'Игрок',
          subtitle: 'Жёлтая карточка',
        };
      case 'red':
        return {
          badge: 'КК',
          title: pl ? `#${pl.number} ${pl.fullName}` : 'Игрок',
          subtitle: 'Красная карточка',
        };
    }
  };

  const needsPlayer =
    eventMode === 'goal_our' ||
    eventMode === 'own_goal_our' ||
    eventMode === 'yellow' ||
    eventMode === 'red';

  const canSubmit =
    eventMode === 'goal_opp' ||
    eventMode === 'own_goal_opp' ||
    eventMode === 'own_goal_our' ||
    Boolean(playerId);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="flex h-[95vh] md:h-[91vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl md:rounded-2xl border border-white/10 bg-[#0D0F14] shadow-2xl">
        {/* Header Scoreboard */}
        <div className="border-b border-white/10 bg-[#14161C] px-4 py-3.5 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-400 truncate">
                Живой протокол · {draft.roundLabel || 'Матч'} · 2×{draft.halfDuration} мин
              </p>
              <h2 className="mt-0.5 font-display text-base sm:text-lg font-bold text-white truncate">
                {draft.isHome
                  ? `${db.club.shortName || db.club.name} — ${opponent?.shortName || opponent?.name || 'Соперник'}`
                  : `${opponent?.shortName || opponent?.name || 'Соперник'} — ${db.club.shortName || db.club.name}`}
              </h2>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenResultsPoster(draft.id);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#C8B289] px-3 py-2 text-xs font-bold text-[#111215] hover:bg-[#D9C6A2] transition-colors min-h-[40px] whitespace-nowrap cursor-pointer"
              >
                <ImageIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Постер итогов</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-white/10 bg-[#0E1014] text-slate-300 hover:text-white cursor-pointer"
                aria-label="Закрыть протокол"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Live Score + Built-in Stopwatch + Match Status */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0A0C10] px-4 py-2.5">
            <div className="flex items-center gap-4">
              <div className="font-display text-3xl sm:text-4xl font-black text-white tabular-nums tracking-tight">
                {draft.isHome ? `${score.our} : ${score.opponent}` : `${score.opponent} : ${score.our}`}
              </div>
              {draft.penalties && (
                <div className="text-xs font-bold text-[#C8B289] tabular-nums">
                  пен.{' '}
                  {draft.isHome
                    ? `${draft.penalties.our}:${draft.penalties.opponent}`
                    : `${draft.penalties.opponent}:${draft.penalties.our}`}
                </div>
              )}
              {draft.isTechnical && <div className="text-xs font-bold text-[#C8B289]">ТП 5:0</div>}
            </div>

            {/* Pitchside Stopwatch */}
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#14161C] px-2.5 py-1.5">
              <span className="font-display text-sm font-bold text-[#C8B289] tabular-nums w-14 text-center">
                {formatTimer(elapsedSec)}
              </span>
              <button
                type="button"
                onClick={() => {
                  setTimerRunning((r) => !r);
                  if (draft.status === 'scheduled') {
                    updateDraft((prev) => ({ ...prev, status: 'live' }));
                  }
                }}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold cursor-pointer ${
                  timerRunning ? 'bg-amber-500 text-slate-950' : 'bg-[#8B1723] text-white'
                }`}
              >
                {timerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{timerRunning ? 'Пауза' : 'Таймер'}</span>
              </button>
              {elapsedSec > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setTimerRunning(false);
                    setElapsedSec(0);
                  }}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                  aria-label="Сбросить таймер"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Switcher */}
            <div className="flex items-center gap-1 rounded-lg bg-[#14161C] p-1">
              {(
                [
                  { id: 'scheduled', label: 'План' },
                  { id: 'live', label: 'Идёт' },
                  { id: 'finished', label: 'Завершён' },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => updateDraft((prev) => ({ ...prev, status: st.id }))}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors min-h-[34px] whitespace-nowrap cursor-pointer ${
                    draft.status === st.id
                      ? st.id === 'finished'
                        ? 'bg-emerald-600 text-white'
                        : st.id === 'live'
                        ? 'bg-[#8B1723] text-white'
                        : 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Half Switcher & GK per Half */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-white/10 bg-[#14161C] p-4">
              <p className="text-xs font-semibold text-slate-400 mb-2.5">
                Текущий тайм (футзал 2×{draft.halfDuration} мин)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {([1, 2] as const).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleHalfChange(h)}
                    className={`min-h-[44px] rounded-lg font-display text-sm font-bold transition-colors cursor-pointer ${
                      activeHalf === h
                        ? 'bg-[#8B1723] text-white'
                        : 'border border-white/10 bg-[#0E1014] text-slate-300 hover:text-white'
                    }`}
                  >
                    {h}-й тайм ({h === 1 ? `1–${draft.halfDuration}'` : `${draft.halfDuration + 1}–${draft.halfDuration * 2}'`})
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#14161C] p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-2.5">
                <Shield className="w-3.5 h-3.5 text-[#C8B289]" />
                <span>Вратари нашего клуба по таймам</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="text-[11px] text-slate-400">1-й тайм</span>
                  <select
                    value={resolvedGks.gkHalf1Id}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateDraft((prev) => ({ ...prev, gkHalf1Id: val }));
                      if (activeHalf === 1) setConcededGkId(val);
                    }}
                    className="mt-1 w-full min-h-[42px] rounded-lg border border-white/10 bg-[#0E1014] px-2.5 text-xs text-white focus:border-[#C8B289] focus:outline-none"
                  >
                    <option value="">Не выбран</option>
                    {gks.map((g) => (
                      <option key={g.id} value={g.id}>
                        #{g.number} {g.shortName || g.fullName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] text-slate-400">2-й тайм</span>
                  <select
                    value={resolvedGks.gkHalf2Id}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateDraft((prev) => ({ ...prev, gkHalf2Id: val }));
                      if (activeHalf === 2) setConcededGkId(val);
                    }}
                    className="mt-1 w-full min-h-[42px] rounded-lg border border-white/10 bg-[#0E1014] px-2.5 text-xs text-white focus:border-[#C8B289] focus:outline-none"
                  >
                    <option value="">Не выбран</option>
                    {gks.map((g) => (
                      <option key={g.id} value={g.id}>
                        #{g.number} {g.shortName || g.fullName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </div>

          {/* Pitchside 1-Tap Event Entry Form */}
          <form onSubmit={handleAddEvent} className="rounded-xl border border-white/10 bg-[#14161C] p-4 space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'goal_our', label: 'Наш гол', active: 'bg-emerald-600 text-white' },
                  { id: 'goal_opp', label: 'Гол соперника', active: 'bg-[#8B1723] text-white' },
                  { id: 'own_goal_our', label: 'Наш автогол', active: 'bg-rose-800 text-white' },
                  { id: 'own_goal_opp', label: 'Автогол соп.', active: 'bg-emerald-800 text-white' },
                  { id: 'yellow', label: 'Жёлтая', active: 'bg-amber-500 text-slate-950' },
                  { id: 'red', label: 'Красная', active: 'bg-red-600 text-white' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setEventMode(t.id)}
                  className={`min-h-[40px] rounded-lg px-3 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    eventMode === t.id
                      ? t.active
                      : 'border border-white/10 bg-[#0E1014] text-slate-300 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Minute & Penalty row */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400">Минута:</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={minute}
                  onChange={(e) => setMinute(parseInt(e.target.value, 10) || 1)}
                  className="w-20 min-h-[40px] rounded-lg border border-white/10 bg-[#0E1014] px-3 text-sm font-bold text-white tabular-nums focus:border-[#C8B289] focus:outline-none"
                />
              </label>

              {eventMode === 'goal_our' && (
                <label className="flex items-center gap-2 min-h-[40px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPenalty}
                    onChange={(e) => setIsPenalty(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#8B1723]"
                  />
                  <span className="text-xs font-semibold text-slate-200">С пенальти</span>
                </label>
              )}
            </div>

            {/* 1-Tap Player Tile Grid for Scorer / Card */}
            {needsPlayer && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400">
                  {eventMode === 'goal_our' ? '1. Кто забил (1 тап):' : 'Игрок (1 тап):'}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                  {squadPlayers.map((p) => {
                    const active = playerId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setPlayerId(active ? '' : p.id);
                          if (assistPlayerId === p.id) setAssistPlayerId('');
                        }}
                        className={`flex items-center gap-2 rounded-lg px-2.5 min-h-[42px] text-left text-xs font-semibold transition-colors cursor-pointer ${
                          active
                            ? 'bg-emerald-600 text-white'
                            : 'border border-white/10 bg-[#0E1014] text-slate-200 hover:border-[#C8B289]/50'
                        }`}
                      >
                        <span className="font-display font-bold tabular-nums opacity-85 shrink-0">
                          #{p.number}
                        </span>
                        <span className="truncate">{p.shortName || p.fullName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 1-Tap Assist Tile Grid */}
            {eventMode === 'goal_our' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-400">
                    2. Ассистент (опционально, 1 тап):
                  </p>
                  {assistPlayerId && (
                    <button
                      type="button"
                      onClick={() => setAssistPlayerId('')}
                      className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                    >
                      Убрать пас
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                  {squadPlayers
                    .filter((p) => p.id !== playerId)
                    .map((p) => {
                      const active = assistPlayerId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setAssistPlayerId(active ? '' : p.id)}
                          className={`flex items-center gap-2 rounded-lg px-2.5 min-h-[38px] text-left text-xs font-medium transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#C8B289] text-[#111215] font-bold'
                              : 'border border-white/10 bg-[#0E1014] text-slate-300 hover:border-white/25'
                          }`}
                        >
                          <span className="font-display font-bold tabular-nums opacity-80 shrink-0">
                            #{p.number}
                          </span>
                          <span className="truncate">{p.shortName || p.fullName}</span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {(eventMode === 'goal_opp' || eventMode === 'own_goal_our') && (
              <label className="block max-w-sm">
                <span className="text-xs text-slate-400">Кому забили (Вратарь в воротах)</span>
                <select
                  value={concededGkId || currentHalfGkId}
                  onChange={(e) => setConcededGkId(e.target.value)}
                  className="mt-1 w-full min-h-[44px] rounded-lg border border-white/10 bg-[#0E1014] px-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
                >
                  <option value="">Авто по тайму ({activeHalf}Т)</option>
                  {gks.map((g) => (
                    <option key={g.id} value={g.id}>
                      #{g.number} {g.fullName}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              {draft.events.length > 0 ? (
                <button
                  type="button"
                  onClick={handleUndoLastEvent}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-[#0E1014] px-3.5 min-h-[44px] text-xs font-semibold text-slate-300 hover:border-amber-400/50 hover:text-amber-300 transition-colors cursor-pointer"
                >
                  <Undo2 className="w-4 h-4" />
                  <span>Отменить последнее</span>
                </button>
              ) : (
                <span />
              )}
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#8B1723] px-5 min-h-[46px] w-full sm:w-auto text-sm font-bold text-white hover:bg-[#A31D2B] transition-colors cursor-pointer disabled:opacity-45"
              >
                <Plus className="w-4 h-4" />
                <span>Записать событие ({activeHalf}Т · {minute}&apos;)</span>
              </button>
            </div>
          </form>

          {/* Penalty Shootout, MVP & Technical Result */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/10 bg-[#14161C] p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#C8B289] mb-2">
                <Award className="w-4 h-4" />
                <span>Лучший игрок матча (MVP)</span>
              </div>
              <select
                value={draft.mvpPlayerId}
                onChange={(e) => updateDraft((prev) => ({ ...prev, mvpPlayerId: e.target.value }))}
                className="w-full min-h-[44px] rounded-lg border border-white/10 bg-[#0E1014] px-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
              >
                <option value="">Не выбран</option>
                {squadPlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.number} {p.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#14161C] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300">Серия пенальти</span>
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.penalties)}
                    onChange={(e) => togglePenalties(e.target.checked)}
                    className="h-4 w-4 accent-[#C8B289]"
                  />
                  <span>Была</span>
                </label>
              </div>
              {draft.penalties ? (
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-[11px] text-slate-400">Мы</span>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={draft.penalties.our}
                      onChange={(e) =>
                        updateDraft((prev) => ({
                          ...prev,
                          penalties: {
                            our: Math.max(0, parseInt(e.target.value, 10) || 0),
                            opponent: prev.penalties?.opponent ?? 0,
                          },
                        }))
                      }
                      className="mt-0.5 w-full min-h-[38px] rounded-lg border border-white/10 bg-[#0E1014] px-2.5 text-sm font-bold text-white tabular-nums"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-slate-400">Соперник</span>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={draft.penalties.opponent}
                      onChange={(e) =>
                        updateDraft((prev) => ({
                          ...prev,
                          penalties: {
                            our: prev.penalties?.our ?? 0,
                            opponent: Math.max(0, parseInt(e.target.value, 10) || 0),
                          },
                        }))
                      }
                      className="mt-0.5 w-full min-h-[38px] rounded-lg border border-white/10 bg-[#0E1014] px-2.5 text-sm font-bold text-white tabular-nums"
                    />
                  </label>
                </div>
              ) : (
                <p className="text-xs text-slate-500 mt-2">
                  Отметьте, если исход решился в серии послематчевых пенальти.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-[#14161C] p-4">
              <p className="text-xs font-semibold text-slate-300 mb-2">Технический результат (ТП)</p>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setTechnical(null)}
                  className={`min-h-[40px] rounded-lg text-xs font-semibold cursor-pointer ${
                    !draft.isTechnical
                      ? 'bg-slate-700 text-white'
                      : 'border border-white/10 bg-[#0E1014] text-slate-400'
                  }`}
                >
                  Обычный
                </button>
                <button
                  type="button"
                  onClick={() => setTechnical('our')}
                  className={`min-h-[40px] rounded-lg text-xs font-semibold cursor-pointer ${
                    draft.isTechnical && draft.technicalWinner === 'our'
                      ? 'bg-emerald-600 text-white'
                      : 'border border-white/10 bg-[#0E1014] text-slate-400'
                  }`}
                >
                  ТП 5:0
                </button>
                <button
                  type="button"
                  onClick={() => setTechnical('opponent')}
                  className={`min-h-[40px] rounded-lg text-xs font-semibold cursor-pointer ${
                    draft.isTechnical && draft.technicalWinner === 'opponent'
                      ? 'bg-rose-600 text-white'
                      : 'border border-white/10 bg-[#0E1014] text-slate-400'
                  }`}
                >
                  ТП 0:5
                </button>
              </div>
            </div>
          </div>

          {/* Event Timeline */}
          <div className="rounded-xl border border-white/10 bg-[#14161C] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-sm font-bold text-white">
                Хронология протокола ({draft.events.length})
              </h3>
              {draft.status !== 'finished' && (
                <button
                  type="button"
                  onClick={() => {
                    setTimerRunning(false);
                    updateDraft((prev) => ({ ...prev, status: 'finished' }));
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Завершить матч</span>
                </button>
              )}
            </div>

            {draft.events.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                События ещё не добавлены. Нажмите на игрока выше и запишите гол.
              </p>
            ) : (
              <div className="divide-y divide-white/5">
                {draft.events.map((ev) => {
                  const info = formatEventLabel(ev);
                  return (
                    <div key={ev.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleAdjustEventMinute(ev.id, -1)}
                            className="h-7 w-7 flex items-center justify-center rounded-md border border-white/10 bg-[#0E1014] text-slate-400 hover:text-white hover:border-white/25 cursor-pointer"
                            aria-label="Уменьшить минуту на 1"
                            title="-1 мин"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <div className="flex items-center justify-center gap-1 text-xs font-bold text-slate-200 tabular-nums w-12">
                            <Clock className="w-3 h-3 text-slate-500 hidden sm:inline" />
                            <span>{ev.minute}&apos;</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAdjustEventMinute(ev.id, 1)}
                            className="h-7 w-7 flex items-center justify-center rounded-md border border-white/10 bg-[#0E1014] text-slate-400 hover:text-white hover:border-white/25 cursor-pointer"
                            aria-label="Увеличить минуту на 1"
                            title="+1 мин"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-[11px] font-bold text-slate-400 w-7 shrink-0">
                          {ev.half}Т
                        </span>
                        <span
                          className={`text-[11px] font-bold uppercase w-20 shrink-0 ${
                            ev.type === 'goal_our' || ev.type === 'own_goal_opp'
                              ? 'text-emerald-400'
                              : ev.type === 'yellow'
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {info.badge}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{info.title}</p>
                          <p className="text-xs text-slate-400 truncate">{info.subtitle}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveEvent(ev.id)}
                        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                        aria-label="Удалить событие"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
