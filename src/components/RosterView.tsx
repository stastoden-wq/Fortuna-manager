import React, { useMemo, useState } from 'react';
import {
  Archive,
  Cake,
  Edit3,
  Plus,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  Trash2,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { ClubDatabase, OpponentTeam, Player } from '../types/club';
import { formatRuDateShort } from '../utils/stats';
import { resolveAssetUrl } from '../lib/assetUrl';
import { ImageCropperControl } from './ImageCropperControl';

interface RosterViewProps {
  db: ClubDatabase;
  onAddPlayer: (player: Player) => void;
  onUpdatePlayer: (player: Player) => void;
  onDeletePlayer: (playerId: string) => void;
  onAddOpponent: (opp: OpponentTeam) => void;
  onUpdateOpponent: (opp: OpponentTeam) => void;
  onDeleteOpponent: (oppId: string) => void;
  onOpenPlayerPoster: (playerId: string, preset?: 'birthday' | 'welcome' | 'potm_winner') => void;
}

export const RosterView: React.FC<RosterViewProps> = ({
  db,
  onAddPlayer,
  onUpdatePlayer,
  onDeletePlayer,
  onAddOpponent,
  onUpdateOpponent,
  onDeleteOpponent,
  onOpenPlayerPoster,
}) => {
  const [section, setSection] = useState<'players' | 'opponents'>('players');
  const [roleFilter, setRoleFilter] = useState<'all' | 'FIELD' | 'GK'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');

  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [isNewPlayer, setIsNewPlayer] = useState(false);

  const [editingOpp, setEditingOpp] = useState<OpponentTeam | null>(null);
  const [isNewOpp, setIsNewOpp] = useState(false);

  const [confirmDeletePlayerId, setConfirmDeletePlayerId] = useState<string | null>(null);
  const [confirmDeleteOppId, setConfirmDeleteOppId] = useState<string | null>(null);

  // Detect players referenced in any match protocol so we soft-archive them instead of breaking stats
  const referencedPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const m of db.matches) {
      m.lineupPlayerIds.forEach((id) => ids.add(id));
      m.startingFiveIds.forEach((id) => ids.add(id));
      if (m.gkHalf1Id) ids.add(m.gkHalf1Id);
      if (m.gkHalf2Id) ids.add(m.gkHalf2Id);
      if (m.mvpPlayerId) ids.add(m.mvpPlayerId);
      for (const ev of m.events) {
        if (ev.playerId) ids.add(ev.playerId);
        if (ev.assistPlayerId) ids.add(ev.assistPlayerId);
        if (ev.concededGkId) ids.add(ev.concededGkId);
      }
    }
    return ids;
  }, [db.matches]);

  const referencedOppIds = useMemo(() => {
    const ids = new Set<string>();
    for (const m of db.matches) {
      if (m.opponentId) ids.add(m.opponentId);
    }
    return ids;
  }, [db.matches]);

  const archivedCount = useMemo(
    () => db.players.filter((p) => !p.isActive).length,
    [db.players]
  );

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...db.players]
      .filter((p) => {
        if (!showArchived && !p.isActive) return false;
        if (roleFilter !== 'all' && p.role !== roleFilter) return false;
        if (!q) return true;
        return (
          p.fullName.toLowerCase().includes(q) ||
          p.shortName.toLowerCase().includes(q) ||
          String(p.number).includes(q)
        );
      })
      .sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return a.number - b.number;
      });
  }, [db.players, roleFilter, search, showArchived]);

  const openNewPlayer = () => {
    const used = new Set(db.players.map((p) => p.number));
    let nextNum = 2;
    while (used.has(nextNum) && nextNum < 99) nextNum += 1;

    setIsNewPlayer(true);
    setEditingPlayer({
      id: `p_${Date.now()}`,
      fullName: '',
      shortName: '',
      number: nextNum,
      role: 'FIELD',
      isCaptain: false,
      isActive: true,
      birthDate: '',
      photoUrl: '',
      photoScale: 1,
      photoOffsetX: 0,
      photoOffsetY: 0,
    });
  };

  const openNewOpponent = () => {
    setIsNewOpp(true);
    setEditingOpp({
      id: `opp_${Date.now()}`,
      name: '',
      shortName: '',
      logoUrl: '',
      logoScale: 1,
      logoOffsetX: 0,
      logoOffsetY: 0,
    });
  };

  const savePlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer || !editingPlayer.fullName.trim()) return;
    const prepared: Player = {
      ...editingPlayer,
      fullName: editingPlayer.fullName.trim(),
      shortName:
        editingPlayer.shortName.trim() || editingPlayer.fullName.trim().split(/\s+/)[0] || '',
    };
    if (isNewPlayer) onAddPlayer(prepared);
    else onUpdatePlayer(prepared);
    setEditingPlayer(null);
  };

  const saveOpponent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOpp || !editingOpp.name.trim()) return;
    const prepared: OpponentTeam = {
      ...editingOpp,
      name: editingOpp.name.trim(),
      shortName: editingOpp.shortName.trim() || editingOpp.name.trim(),
    };
    if (isNewOpp) onAddOpponent(prepared);
    else onUpdateOpponent(prepared);
    setEditingOpp(null);
  };

  const toggleArchivePlayer = (player: Player) => {
    onUpdatePlayer({ ...player, isActive: !player.isActive });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-white">
            Состав и соперники
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Портреты игроков с точным кадрированием для 2D Canvas и справочник команд-соперников
          </p>
        </div>

        <button
          type="button"
          onClick={section === 'players' ? openNewPlayer : openNewOpponent}
          className="inline-flex items-center gap-2 rounded-xl bg-[#8B1723] px-4 min-h-[44px] text-sm font-bold text-white hover:bg-[#A31D2B] transition-colors whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{section === 'players' ? 'Добавить игрока' : 'Добавить соперника'}</span>
        </button>
      </div>

      {/* Section Switcher & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#14161C] p-1">
          <button
            type="button"
            onClick={() => setSection('players')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              section === 'players' ? 'bg-[#8B1723] text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Состав клуба ({db.players.filter((p) => p.isActive).length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSection('opponents')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              section === 'opponents'
                ? 'bg-[#8B1723] text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Соперники ({db.opponents.length})</span>
          </button>
        </div>

        {section === 'players' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по имени или номеру…"
                className="min-h-[40px] w-56 rounded-xl border border-white/10 bg-[#14161C] pl-9 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-[#C8B289] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#14161C] p-1">
              {(
                [
                  { id: 'all', label: 'Все' },
                  { id: 'FIELD', label: 'Полевые' },
                  { id: 'GK', label: 'Вратари' },
                ] as const
              ).map((rf) => (
                <button
                  key={rf.id}
                  type="button"
                  onClick={() => setRoleFilter(rf.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                    roleFilter === rf.id
                      ? 'bg-white/12 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {rf.label}
                </button>
              ))}
            </div>

            {archivedCount > 0 && (
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 min-h-[40px] text-xs font-semibold cursor-pointer transition-colors ${
                  showArchived
                    ? 'border-[#C8B289]/50 bg-[#C8B289]/15 text-[#C8B289]'
                    : 'border-white/10 bg-[#14161C] text-slate-400 hover:text-white'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Архив ({archivedCount})</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* PLAYERS GRID */}
      {section === 'players' ? (
        filteredPlayers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-[#14161C]/60 p-10 text-center space-y-3">
            <p className="font-display text-sm font-bold text-white">
              {db.players.length === 0 ? 'Состав клуба пока пуст' : 'Игроки по фильтру не найдены'}
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {db.players.length === 0
                ? 'Добавьте игроков с номерами и портретами — они сразу появятся в заявках, живом протоколе и на постерах.'
                : 'Попробуйте изменить строку поиска или включить отображение архивных игроков.'}
            </p>
            {db.players.length === 0 && (
              <button
                type="button"
                onClick={openNewPlayer}
                className="inline-flex items-center gap-2 rounded-xl bg-[#8B1723] px-4 min-h-[42px] text-xs font-bold text-white hover:bg-[#A31D2B] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Добавить первого игрока</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPlayers.map((p) => {
              const isReferenced = referencedPlayerIds.has(p.id);
              const confirmingDelete = confirmDeletePlayerId === p.id;
              return (
                <div
                  key={p.id}
                  className={`rounded-2xl border p-4 flex flex-col justify-between gap-4 transition-colors ${
                    p.isActive
                      ? 'border-white/10 bg-[#14161C]'
                      : 'border-white/5 bg-[#14161C]/55 opacity-75'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Cropped Portrait Preview */}
                    <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_50%_25%,#252936,#0E1014)]">
                      {p.photoUrl ? (
                        <img
                          src={resolveAssetUrl(p.photoUrl)}
                          alt={p.fullName}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-contain"
                          style={{
                            transform: `translate(${p.photoOffsetX * 0.5}%, ${p.photoOffsetY * 0.5}%) scale(${p.photoScale})`,
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center font-display text-xl font-black text-slate-500">
                          #{p.number}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="font-display font-bold text-[#C8B289] tabular-nums">
                          #{p.number}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{p.role === 'GK' ? 'Вратарь' : 'Полевой'}</span>
                        {p.isCaptain && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-bold text-[#C8B289]">Капитан</span>
                          </>
                        )}
                      </div>
                      <h3 className="mt-1 font-display text-sm font-bold text-white truncate">
                        {p.fullName}
                      </h3>
                      <p className="mt-1 text-xs text-slate-400">
                        {p.birthDate
                          ? `ДР: ${formatRuDateShort(p.birthDate)}`
                          : 'Дата рождения не указана'}
                      </p>
                      {!p.isActive && (
                        <p className="mt-1 text-[11px] font-medium text-amber-400/90">
                          В архиве · статистика сохранена
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenPlayerPoster(p.id, 'potm_winner')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#C8B289] hover:text-white cursor-pointer"
                        title="Создать постер «Игрок месяца (MVP)»"
                      >
                        <Trophy className="w-3.5 h-3.5" />
                        <span>MVP</span>
                      </button>
                      <span className="text-slate-600" aria-hidden="true">
                        ·
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenPlayerPoster(p.id, 'birthday')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
                        title="Создать открытку ко дню рождения"
                      >
                        <Cake className="w-3.5 h-3.5 text-[#C8B289]" />
                        <span>ДР</span>
                      </button>
                      <span className="text-slate-600" aria-hidden="true">
                        ·
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenPlayerPoster(p.id, 'welcome')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
                        title="Создать постер представления / трансфера"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#C8B289]" />
                        <span>Трансфер</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {confirmingDelete ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onDeletePlayer(p.id);
                              setConfirmDeletePlayerId(null);
                            }}
                            className="min-h-[34px] rounded-lg bg-rose-600 px-2.5 text-[11px] font-bold text-white hover:bg-rose-500 cursor-pointer"
                          >
                            Удалить
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeletePlayerId(null)}
                            className="min-h-[34px] rounded-lg border border-white/10 px-2 text-[11px] text-slate-300 hover:text-white cursor-pointer"
                          >
                            Нет
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setIsNewPlayer(false);
                              setEditingPlayer(p);
                            }}
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-white/10 bg-[#0E1014] text-slate-300 hover:text-white cursor-pointer"
                            aria-label="Редактировать игрока"
                            title="Редактировать"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {isReferenced ? (
                            <button
                              type="button"
                              onClick={() => toggleArchivePlayer(p)}
                              className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-white/10 bg-[#0E1014] cursor-pointer ${
                                p.isActive
                                  ? 'text-slate-400 hover:text-amber-300'
                                  : 'text-emerald-400 hover:text-emerald-300'
                              }`}
                              aria-label={p.isActive ? 'В архив' : 'Вернуть в состав'}
                              title={
                                p.isActive
                                  ? 'Убрать в архив (игрок есть в протоколах, удаление сохранит статистику)'
                                  : 'Вернуть в активный состав'
                              }
                            >
                              {p.isActive ? (
                                <Archive className="w-4 h-4" />
                              ) : (
                                <RotateCcw className="w-4 h-4" />
                              )}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeletePlayerId(p.id)}
                              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-white/10 bg-[#0E1014] text-slate-400 hover:text-rose-400 cursor-pointer"
                              aria-label="Удалить игрока"
                              title="Удалить игрока"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : /* OPPONENTS GRID */
      db.opponents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-[#14161C]/60 p-10 text-center space-y-3">
          <p className="font-display text-sm font-bold text-white">Справочник соперников пуст</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Добавьте команды лиги и их эмблемы, чтобы создавать анонсы и итоги матчей в два клика.
          </p>
          <button
            type="button"
            onClick={openNewOpponent}
            className="inline-flex items-center gap-2 rounded-xl bg-[#8B1723] px-4 min-h-[42px] text-xs font-bold text-white hover:bg-[#A31D2B] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить первого соперника</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {db.opponents.map((opp) => {
            const usedInMatches = referencedOppIds.has(opp.id);
            const confirmingDelete = confirmDeleteOppId === opp.id;
            return (
              <div
                key={opp.id}
                className="rounded-2xl border border-white/10 bg-[#14161C] p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#0E1014] p-1.5 flex items-center justify-center">
                    {opp.logoUrl ? (
                      <img
                        src={resolveAssetUrl(opp.logoUrl)}
                        alt={opp.name}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-contain"
                        style={{
                          transform: `translate(${opp.logoOffsetX * 0.5}%, ${opp.logoOffsetY * 0.5}%) scale(${opp.logoScale})`,
                        }}
                      />
                    ) : (
                      <Shield className="w-6 h-6 text-slate-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-sm font-bold text-white truncate">
                      {opp.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      Короткое: {opp.shortName || opp.name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {confirmingDelete ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteOpponent(opp.id);
                          setConfirmDeleteOppId(null);
                        }}
                        className="min-h-[34px] rounded-lg bg-rose-600 px-2.5 text-[11px] font-bold text-white hover:bg-rose-500 cursor-pointer"
                        title={
                          usedInMatches
                            ? 'Внимание: команда используется в сохранённых матчах'
                            : 'Подтвердить удаление'
                        }
                      >
                        {usedInMatches ? 'Точно?' : 'Удалить'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteOppId(null)}
                        className="min-h-[34px] rounded-lg border border-white/10 px-2 text-[11px] text-slate-300 hover:text-white cursor-pointer"
                      >
                        Нет
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setIsNewOpp(false);
                          setEditingOpp(opp);
                        }}
                        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-white/10 bg-[#0E1014] text-slate-300 hover:text-white cursor-pointer"
                        aria-label="Редактировать соперника"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteOppId(opp.id)}
                        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-white/10 bg-[#0E1014] text-slate-400 hover:text-rose-400 cursor-pointer"
                        aria-label="Удалить соперника"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PLAYER MODAL */}
      {editingPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <form
            onSubmit={savePlayer}
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#14161C] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="font-display text-base font-bold text-white">
                {isNewPlayer ? 'Новый игрок клуба' : 'Карточка игрока'}
              </h2>
              <button
                type="button"
                onClick={() => setEditingPlayer(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-400">Фамилия и Имя</span>
                  <input
                    type="text"
                    required
                    value={editingPlayer.fullName}
                    onChange={(e) =>
                      setEditingPlayer({ ...editingPlayer, fullName: e.target.value })
                    }
                    placeholder="Волков Дмитрий"
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-400">
                    Короткая фамилия (для постеров)
                  </span>
                  <input
                    type="text"
                    value={editingPlayer.shortName}
                    onChange={(e) =>
                      setEditingPlayer({ ...editingPlayer, shortName: e.target.value })
                    }
                    placeholder="Волков"
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-400">Игровой номер</span>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    required
                    value={editingPlayer.number}
                    onChange={(e) =>
                      setEditingPlayer({
                        ...editingPlayer,
                        number: Math.max(0, Math.min(99, parseInt(e.target.value, 10) || 0)),
                      })
                    }
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm font-bold text-white tabular-nums focus:border-[#C8B289] focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-400">Дата рождения</span>
                  <input
                    type="date"
                    value={editingPlayer.birthDate}
                    onChange={(e) =>
                      setEditingPlayer({ ...editingPlayer, birthDate: e.target.value })
                    }
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white tabular-nums focus:border-[#C8B289] focus:outline-none"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <span className="text-xs font-semibold text-slate-400">Амплуа</span>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingPlayer({ ...editingPlayer, role: 'FIELD' })}
                      className={`min-h-[42px] rounded-xl text-xs font-bold cursor-pointer ${
                        editingPlayer.role === 'FIELD'
                          ? 'bg-[#8B1723] text-white'
                          : 'border border-white/10 bg-[#0E1014] text-slate-400 hover:text-white'
                      }`}
                    >
                      Полевой
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingPlayer({ ...editingPlayer, role: 'GK' })}
                      className={`min-h-[42px] rounded-xl text-xs font-bold cursor-pointer ${
                        editingPlayer.role === 'GK'
                          ? 'bg-[#C8B289] text-[#111215]'
                          : 'border border-white/10 bg-[#0E1014] text-slate-400 hover:text-white'
                      }`}
                    >
                      Вратарь (ВР)
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-5 pt-4">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingPlayer.isCaptain}
                      onChange={(e) =>
                        setEditingPlayer({ ...editingPlayer, isCaptain: e.target.checked })
                      }
                      className="h-4 w-4 accent-[#C8B289]"
                    />
                    <span>Капитан (К)</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingPlayer.isActive}
                      onChange={(e) =>
                        setEditingPlayer({ ...editingPlayer, isActive: e.target.checked })
                      }
                      className="h-4 w-4 accent-[#8B1723]"
                    />
                    <span>В активной заявке</span>
                  </label>
                </div>
              </div>

              {/* Smart Portrait Cropper */}
              <ImageCropperControl
                label="Портрет игрока (PNG без фона или фото)"
                hint="Выровняйте голову и плечи по сетке — настройки применятся на всех постерах"
                imageUrl={editingPlayer.photoUrl}
                scale={editingPlayer.photoScale}
                offsetX={editingPlayer.photoOffsetX}
                offsetY={editingPlayer.photoOffsetY}
                aspect="portrait"
                onChange={(patch) =>
                  setEditingPlayer({
                    ...editingPlayer,
                    ...(patch.imageUrl !== undefined ? { photoUrl: patch.imageUrl } : {}),
                    ...(patch.scale !== undefined ? { photoScale: patch.scale } : {}),
                    ...(patch.offsetX !== undefined ? { photoOffsetX: patch.offsetX } : {}),
                    ...(patch.offsetY !== undefined ? { photoOffsetY: patch.offsetY } : {}),
                  })
                }
              />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-white/10 px-5 py-4">
              <button
                type="button"
                onClick={() => setEditingPlayer(null)}
                className="min-h-[42px] rounded-xl border border-white/10 px-4 text-sm font-semibold text-slate-300 hover:text-white cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="min-h-[42px] rounded-xl bg-[#8B1723] px-5 text-sm font-bold text-white hover:bg-[#A31D2B] cursor-pointer"
              >
                Сохранить игрока
              </button>
            </div>
          </form>
        </div>
      )}

      {/* OPPONENT MODAL */}
      {editingOpp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <form
            onSubmit={saveOpponent}
            className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#14161C] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="font-display text-base font-bold text-white">
                {isNewOpp ? 'Новый соперник' : 'Редактировать соперника'}
              </h2>
              <button
                type="button"
                onClick={() => setEditingOpp(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <label className="block">
                <span className="text-xs font-semibold text-slate-400">Полное название команды</span>
                <input
                  type="text"
                  required
                  value={editingOpp.name}
                  onChange={(e) => setEditingOpp({ ...editingOpp, name: e.target.value })}
                  placeholder="МФК Енисей-Юг"
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-400">Короткое название</span>
                <input
                  type="text"
                  value={editingOpp.shortName}
                  onChange={(e) => setEditingOpp({ ...editingOpp, shortName: e.target.value })}
                  placeholder="Енисей-Юг"
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-white/10 bg-[#0E1014] px-3 text-sm text-white focus:border-[#C8B289] focus:outline-none"
                />
              </label>

              <ImageCropperControl
                label="Логотип соперника (PNG)"
                hint="Отрегулируйте масштаб логотипа, чтобы он гармонично смотрелся рядом с эмблемой вашего клуба"
                imageUrl={editingOpp.logoUrl}
                scale={editingOpp.logoScale}
                offsetX={editingOpp.logoOffsetX}
                offsetY={editingOpp.logoOffsetY}
                aspect="square"
                onChange={(patch) =>
                  setEditingOpp({
                    ...editingOpp,
                    ...(patch.imageUrl !== undefined ? { logoUrl: patch.imageUrl } : {}),
                    ...(patch.scale !== undefined ? { logoScale: patch.scale } : {}),
                    ...(patch.offsetX !== undefined ? { logoOffsetX: patch.offsetX } : {}),
                    ...(patch.offsetY !== undefined ? { logoOffsetY: patch.offsetY } : {}),
                  })
                }
              />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-white/10 px-5 py-4">
              <button
                type="button"
                onClick={() => setEditingOpp(null)}
                className="min-h-[42px] rounded-xl border border-white/10 px-4 text-sm font-semibold text-slate-300 hover:text-white cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="min-h-[42px] rounded-xl bg-[#8B1723] px-5 text-sm font-bold text-white hover:bg-[#A31D2B] cursor-pointer"
              >
                Сохранить соперника
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
