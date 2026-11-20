import React, { useMemo, useState } from 'react';
import { Award, Cake, Download, HelpCircle, Image as ImageIcon, Shield, Trophy } from 'lucide-react';
import { ClubDatabase, PosterMode } from '../types/club';
import {
  computeFieldPlayerStats,
  computeGoalkeeperStats,
  downloadCsv,
  getMatchOutcome,
  getMatchScore,
  getUpcomingBirthdays,
} from '../utils/stats';

interface StatsViewProps {
  db: ClubDatabase;
  onOpenStatsPoster: (mode: Extract<PosterMode, 'scorers' | 'goalkeepers'>, seasonId: string) => void;
  onOpenBirthdayPoster: (playerId: string) => void;
  onOpenPotmPoster: (preset: 'potm_vote' | 'potm_winner', playerId?: string) => void;
}

export const StatsView: React.FC<StatsViewProps> = ({
  db,
  onOpenStatsPoster,
  onOpenBirthdayPoster,
  onOpenPotmPoster,
}) => {
  const [seasonFilter, setSeasonFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'field' | 'gk'>('field');

  const fieldStats = useMemo(
    () => computeFieldPlayerStats(db.players, db.matches, seasonFilter),
    [db.players, db.matches, seasonFilter]
  );

  const gkStats = useMemo(
    () => computeGoalkeeperStats(db.players, db.matches, seasonFilter),
    [db.players, db.matches, seasonFilter]
  );

  const clubSummary = useMemo(() => {
    const finished = db.matches.filter(
      (m) => m.status === 'finished' && (seasonFilter === 'all' || m.seasonTagId === seasonFilter)
    );
    let wins = 0;
    let draws = 0;
    let losses = 0;
    let gf = 0;
    let ga = 0;

    for (const m of finished) {
      const outcome = getMatchOutcome(m);
      if (outcome === 'W') wins += 1;
      else if (outcome === 'D') draws += 1;
      else if (outcome === 'L') losses += 1;
      const sc = getMatchScore(m);
      gf += sc.our;
      ga += sc.opponent;
    }

    return { played: finished.length, wins, draws, losses, gf, ga };
  }, [db.matches, seasonFilter]);

  const upcomingBirthdays = useMemo(() => getUpcomingBirthdays(db.players, 60), [db.players]);

  const handleExportCsv = () => {
    const seasonName =
      seasonFilter === 'all'
        ? 'all_seasons'
        : (db.seasons.find((s) => s.id === seasonFilter)?.name || 'season')
            .toLowerCase()
            .replace(/[^a-zа-я0-9]+/gi, '_');

    if (activeTab === 'field') {
      downloadCsv(
        `scorers_${seasonName}.csv`,
        ['№', 'Игрок', 'Амплуа', 'И', 'Голы', 'Пен.', 'Ассисты', 'Г+П', 'ЖК', 'КК'],
        fieldStats.map((r) => [
          r.player.number,
          r.player.fullName,
          r.player.role === 'GK' ? 'ВР' : 'Пол.',
          r.matches,
          r.goals,
          r.penalties,
          r.assists,
          r.points,
          r.yellowCards,
          r.redCards,
        ])
      );
    } else {
      downloadCsv(
        `goalkeepers_${seasonName}.csv`,
        ['№', 'Вратарь', 'И', 'ПМ', 'КН', 'Сух.', 'ЖК', 'КК'],
        gkStats.map((r) => [
          r.player.number,
          r.player.fullName,
          r.matches,
          r.conceded,
          r.matches > 0 ? r.gaa.toFixed(2) : '0.00',
          r.cleanSheets,
          r.yellowCards,
          r.redCards,
        ])
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-white">
            Статистика клуба
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Автоматический подсчёт по завершённым протоколам (сухие матчи по правилу «Вариант А»)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenPotmPoster('potm_vote')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#C8B289]/40 bg-[#C8B289]/10 px-3.5 min-h-[42px] text-xs font-bold text-[#E5D4B3] hover:bg-[#C8B289]/20 transition-colors whitespace-nowrap cursor-pointer"
            title="Открыть шаблон анонса голосования за лучшего игрока месяца с силуэтом и знаком ?"
          >
            <HelpCircle className="w-4 h-4 text-[#C8B289]" />
            <span>Голосование месяца ?</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onOpenPotmPoster('potm_winner', fieldStats[0]?.player.id || db.players[0]?.id)
            }
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#8B1723]/60 bg-[#8B1723]/20 px-3.5 min-h-[42px] text-xs font-bold text-white hover:bg-[#8B1723]/35 transition-colors whitespace-nowrap cursor-pointer"
            title="Открыть постер победителя «Лучший игрок месяца»"
          >
            <Trophy className="w-4 h-4 text-[#C8B289]" />
            <span>Игрок месяца (MVP)</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#14161C] px-4 min-h-[42px] text-xs font-semibold text-slate-200 hover:border-[#C8B289]/45 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Экспорт CSV</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onOpenStatsPoster(activeTab === 'field' ? 'scorers' : 'goalkeepers', seasonFilter)
            }
            className="inline-flex items-center gap-2 rounded-xl bg-[#C8B289] px-4 min-h-[42px] text-xs font-bold text-[#111215] hover:bg-[#D9C6A2] transition-colors whitespace-nowrap cursor-pointer"
          >
            <ImageIcon className="w-4 h-4" />
            <span>{activeTab === 'field' ? 'Постер бомбардиров' : 'Постер вратарей'}</span>
          </button>
        </div>
      </div>

      {/* Season Filter */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-[#14161C] p-1.5 w-fit max-w-full">
        <button
          type="button"
          onClick={() => setSeasonFilter('all')}
          className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
            seasonFilter === 'all' ? 'bg-[#8B1723] text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          Весь сезон
        </button>
        {db.seasons.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSeasonFilter(s.id)}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              seasonFilter === s.id
                ? 'bg-[#8B1723] text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* Club Record Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/10 bg-[#14161C] p-4">
          <p className="text-xs text-slate-400">Сыграно матчей</p>
          <p className="mt-1 font-display text-2xl font-black text-white tabular-nums">
            {clubSummary.played}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#14161C] p-4">
          <p className="text-xs text-slate-400">Баланс (В / Н / П)</p>
          <p className="mt-1 font-display text-2xl font-black text-white tabular-nums">
            <span className="text-emerald-400">{clubSummary.wins}</span>
            <span className="mx-1 text-slate-600">/</span>
            <span className="text-[#C8B289]">{clubSummary.draws}</span>
            <span className="mx-1 text-slate-600">/</span>
            <span className="text-rose-400">{clubSummary.losses}</span>
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#14161C] p-4">
          <p className="text-xs text-slate-400">Мячи (Забито : Пропущ.)</p>
          <p className="mt-1 font-display text-2xl font-black text-white tabular-nums">
            {clubSummary.gf} : {clubSummary.ga}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#14161C] p-4">
          <p className="text-xs text-slate-400">Разница мячей</p>
          <p
            className={`mt-1 font-display text-2xl font-black tabular-nums ${
              clubSummary.gf - clubSummary.ga >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {clubSummary.gf - clubSummary.ga > 0
              ? `+${clubSummary.gf - clubSummary.ga}`
              : clubSummary.gf - clubSummary.ga}
          </p>
        </div>
      </div>

      {/* Main Content Grid: Stats Table + Upcoming Birthdays */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Tables Card */}
        <div className="rounded-2xl border border-white/10 bg-[#14161C] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-1 rounded-lg bg-[#0E1014] p-1">
              <button
                type="button"
                onClick={() => setActiveTab('field')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === 'field'
                    ? 'bg-[#8B1723] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Бомбардиры и ассистенты</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('gk')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === 'gk'
                    ? 'bg-[#8B1723] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Вратари и сухари</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {activeTab === 'field' ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="py-3 pl-4 pr-2 w-10">#</th>
                    <th className="py-3 px-2">Игрок</th>
                    <th className="py-3 px-2 text-right">И</th>
                    <th className="py-3 px-2 text-right">Г (пен.)</th>
                    <th className="py-3 px-2 text-right">Ассист</th>
                    <th className="py-3 px-2 text-right text-[#C8B289]">Г+П</th>
                    <th className="py-3 pl-2 pr-4 text-right">ЖК / КК</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {fieldStats.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-xs text-slate-400">
                        Пока нет игроков в составе. Добавьте игроков в разделе «Состав».
                      </td>
                    </tr>
                  ) : (
                    fieldStats.map((row, idx) => (
                      <tr
                        key={row.player.id}
                        className="hover:bg-white/[0.03] transition-colors"
                      >
                        <td className="py-3 pl-4 pr-2 text-xs font-bold text-slate-500 tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2.5">
                            <span className="font-display text-xs font-bold text-[#C8B289] tabular-nums w-7 shrink-0">
                              #{row.player.number}
                            </span>
                            <span className="font-semibold text-white">{row.player.fullName}</span>
                            {row.player.isCaptain && (
                              <span className="text-[11px] font-bold text-[#C8B289]">К</span>
                            )}
                            {row.player.role === 'GK' && (
                              <span className="text-[11px] font-semibold text-slate-400">ВР</span>
                            )}
                            {!row.player.isActive && (
                              <span className="text-[10px] text-slate-500">(архив)</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right tabular-nums text-slate-300">
                          {row.matches}
                        </td>
                        <td className="py-3 px-2 text-right tabular-nums font-semibold text-white">
                          {row.goals}
                          {row.penalties > 0 && (
                            <span className="text-xs text-slate-400 ml-1">({row.penalties})</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right tabular-nums text-slate-200">
                          {row.assists}
                        </td>
                        <td className="py-3 px-2 text-right tabular-nums font-display font-bold text-[#C8B289]">
                          {row.points}
                        </td>
                        <td className="py-3 pl-2 pr-4 text-right tabular-nums text-xs text-slate-400">
                          {row.yellowCards} / {row.redCards}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="py-3 pl-4 pr-2 w-10">#</th>
                    <th className="py-3 px-2">Вратарь</th>
                    <th className="py-3 px-2 text-right">И</th>
                    <th className="py-3 px-2 text-right">ПМ</th>
                    <th className="py-3 px-2 text-right text-[#C8B289]">КН</th>
                    <th className="py-3 px-2 text-right text-emerald-400">Сух.</th>
                    <th className="py-3 pl-2 pr-4 text-right">ЖК / КК</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {gkStats.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-xs text-slate-400">
                        В составе пока нет игроков с амплуа «Вратарь».
                      </td>
                    </tr>
                  ) : (
                    gkStats.map((row, idx) => (
                      <tr
                        key={row.player.id}
                        className="hover:bg-white/[0.03] transition-colors"
                      >
                        <td className="py-3 pl-4 pr-2 text-xs font-bold text-slate-500 tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2.5">
                            <span className="font-display text-xs font-bold text-[#C8B289] tabular-nums w-7 shrink-0">
                              #{row.player.number}
                            </span>
                            <span className="font-semibold text-white">{row.player.fullName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right tabular-nums text-slate-300">
                          {row.matches}
                        </td>
                        <td className="py-3 px-2 text-right tabular-nums text-slate-200">
                          {row.conceded}
                        </td>
                        <td className="py-3 px-2 text-right tabular-nums font-display font-bold text-[#C8B289]">
                          {row.matches > 0 ? row.gaa.toFixed(2) : '—'}
                        </td>
                        <td className="py-3 px-2 text-right tabular-nums font-bold text-emerald-400">
                          {row.cleanSheets}
                        </td>
                        <td className="py-3 pl-2 pr-4 text-right tabular-nums text-xs text-slate-400">
                          {row.yellowCards} / {row.redCards}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Upcoming Birthdays Panel */}
        <div className="rounded-2xl border border-white/10 bg-[#14161C] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Cake className="w-4 h-4 text-[#C8B289]" />
            <h2 className="font-display text-sm font-bold text-white">Ближайшие дни рождения</h2>
          </div>

          {upcomingBirthdays.length === 0 ? (
            <p className="text-xs text-slate-400 leading-relaxed">
              В ближайшие 60 дней именинников нет. Укажите даты рождения в карточках игроков в разделе «Состав».
            </p>
          ) : (
            <div className="space-y-3">
              {upcomingBirthdays.map((item) => (
                <div
                  key={item.player.id}
                  className="rounded-xl border border-white/10 bg-[#0E1014] p-3.5 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">
                        #{item.player.number} {item.player.fullName}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {item.formattedDate} ·{' '}
                        {item.daysUntil === 0 ? 'Сегодня!' : `через ${item.daysUntil} дн.`} ·{' '}
                        {item.turningAge} лет
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenBirthdayPoster(item.player.id)}
                    className="w-full min-h-[38px] rounded-lg bg-[#C8B289]/15 border border-[#C8B289]/40 text-xs font-bold text-[#C8B289] hover:bg-[#C8B289]/25 transition-colors cursor-pointer"
                  >
                    Создать открытку ВК
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
