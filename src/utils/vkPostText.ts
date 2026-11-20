import { ClubDatabase, PosterDraft } from '../types/club';
import {
  computeFieldPlayerStats,
  computeGoalkeeperStats,
  formatRuDate,
  getMatchOutcome,
  getMatchScore,
  getPlayerMatchSummary,
} from './stats';

const RU_MONTHS_NOMINATIVE = [
  'ЯНВАРЬ',
  'ФЕВРАЛЬ',
  'МАРТ',
  'АПРЕЛЬ',
  'МАЙ',
  'ИЮНЬ',
  'ИЮЛЬ',
  'АВГУСТ',
  'СЕНТЯБРЬ',
  'ОКТЯБРЬ',
  'НОЯБРЬ',
  'ДЕКАБРЬ',
];

export function getCurrentRuMonthYear(): string {
  const now = new Date();
  return `${RU_MONTHS_NOMINATIVE[now.getMonth()]} ${now.getFullYear()}`;
}

function buildClubHashtags(db: ClubDatabase): string {
  const cleanTag = (raw: string) =>
    raw
      .replace(/[«»"'.,!?:;()-]/g, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('');

  const tags = new Set<string>();
  const clubTag = cleanTag(db.club.name);
  const shortTag = cleanTag(db.club.shortName);
  const cityTag = cleanTag(db.club.city);

  if (clubTag) tags.add(`#${clubTag}`);
  if (shortTag && shortTag !== clubTag) tags.add(`#${shortTag}`);
  if (cityTag) tags.add(`#${cityTag}`);
  tags.add('#Футзал');
  tags.add('#МиниФутбол');

  return Array.from(tags).join(' ');
}

export function generateVkPostText(db: ClubDatabase, draft: PosterDraft): string {
  const clubName = db.club.name;
  const vkFooter = db.club.vkLink ? `\n\n${db.club.vkLink}` : '';
  const hashtags = `\n${buildClubHashtags(db)}`;

  const match =
    db.matches.find((m) => m.id === draft.matchId) ||
    (draft.mode === 'results'
      ? db.matches.find((m) => m.status === 'finished')
      : db.matches.find((m) => m.status === 'scheduled')) ||
    db.matches[0];
  const opp = match ? db.opponents.find((o) => o.id === match.opponentId) : undefined;
  const season = match ? db.seasons.find((s) => s.id === match.seasonTagId) : undefined;
  const playerMap = new Map(db.players.map((p) => [p.id, p]));

  switch (draft.mode) {
    case 'matchday': {
      if (!match) {
        return `ДЕНЬ МАТЧА! ${clubName} выходит на паркет!${vkFooter}${hashtags}`;
      }
      const left = match.isHome ? clubName : opp?.name || 'Соперник';
      const right = match.isHome ? opp?.name || 'Соперник' : clubName;
      const kicker =
        draft.matchdayKicker.trim() || (match.isHome ? 'Домашний матч' : 'Выездной матч');
      const tour = [season?.name, match.roundLabel].filter(Boolean).join(' · ');

      return (
        [
          `ДЕНЬ МАТЧА | ${kicker.toUpperCase()}`,
          tour ? `${tour}` : '',
          '',
          `${left} — ${right}`,
          `Дата: ${formatRuDate(match.date)}`,
          `Начало: ${match.time}`,
          match.venue ? `Площадка: ${match.venue}` : '',
          '',
          `Поддержим ${db.club.shortName || clubName} на трибунах и в комментариях!`,
        ]
          .filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''))
          .join('\n')
          .trim() +
        vkFooter +
        hashtags
      );
    }

    case 'lineup': {
      const selectedIds =
        draft.lineupSelectedIds.length > 0
          ? draft.lineupSelectedIds
          : match?.lineupPlayerIds || [];
      const selected = db.players
        .filter((p) => selectedIds.includes(p.id))
        .sort((a, b) => {
          if (a.role === 'GK' && b.role !== 'GK') return -1;
          if (a.role !== 'GK' && b.role === 'GK') return 1;
          return a.number - b.number;
        });

      const startingSet = new Set(match?.startingFiveIds || []);
      const formatRow = (p: (typeof selected)[number]) => {
        const marks = [p.role === 'GK' ? 'ВР' : '', p.isCaptain ? 'К' : '']
          .filter(Boolean)
          .join(', ');
        return `#${p.number} ${p.fullName}${marks ? ` (${marks})` : ''}`;
      };

      const lines: string[] = [`${(draft.lineupTitle || 'ЗАЯВКА НА МАТЧ').toUpperCase()}`];

      if (match) {
        const matchup = match.isHome
          ? `${clubName} — ${opp?.name || 'Соперник'}`
          : `${opp?.name || 'Соперник'} — ${clubName}`;
        lines.push(`${matchup} · ${formatRuDate(match.date)}, ${match.time}`);
        if (match.venue) lines.push(`Площадка: ${match.venue}`);
      }
      lines.push('');

      if (draft.lineupShowStartingFive && startingSet.size > 0) {
        const starters = selected.filter((p) => startingSet.has(p.id));
        const bench = selected.filter((p) => !startingSet.has(p.id));
        if (starters.length > 0) {
          lines.push('Стартовая пятёрка:');
          starters.forEach((p) => lines.push(formatRow(p)));
        }
        if (bench.length > 0) {
          lines.push('');
          lines.push('Запасные:');
          bench.forEach((p) => lines.push(formatRow(p)));
        }
      } else {
        selected.forEach((p) => lines.push(formatRow(p)));
      }

      return lines.join('\n').trim() + vkFooter + hashtags;
    }

    case 'results': {
      if (!match) {
        return `ИТОГ МАТЧА · ${clubName}${vkFooter}${hashtags}`;
      }
      const score = getMatchScore(match);
      const outcome = getMatchOutcome(match);
      const leftName = match.isHome ? clubName : opp?.name || 'Соперник';
      const rightName = match.isHome ? opp?.name || 'Соперник' : clubName;
      const leftScore = match.isHome ? score.our : score.opponent;
      const rightScore = match.isHome ? score.opponent : score.our;

      const outcomePrefix =
        outcome === 'W'
          ? 'ПОБЕДА!'
          : outcome === 'D'
          ? 'НИЧЬЯ'
          : outcome === 'L'
          ? 'ИТОГ МАТЧА'
          : draft.resultsHeadline || 'ИТОГ МАТЧА';

      const tour = [season?.name, match.roundLabel].filter(Boolean).join(' · ');
      const lines: string[] = [
        `${(draft.resultsHeadline.trim() || outcomePrefix).toUpperCase()}`,
        tour ? tour : '',
        '',
        `${leftName} ${leftScore} : ${rightScore} ${rightName}`,
      ];

      if (match.penalties) {
        const lp = match.isHome ? match.penalties.our : match.penalties.opponent;
        const rp = match.isHome ? match.penalties.opponent : match.penalties.our;
        lines.push(`По пенальти: ${lp} : ${rp}`);
      } else if (match.isTechnical) {
        lines.push('Технический результат (ТП)');
      }

      const ourGoals = match.events
        .filter((e) => e.type === 'goal_our' || e.type === 'own_goal_opp')
        .sort((a, b) => a.minute - b.minute);

      if (ourGoals.length > 0) {
        lines.push('');
        lines.push(`Голы ${db.club.shortName || clubName}:`);
        for (const ev of ourGoals) {
          if (ev.type === 'own_goal_opp') {
            lines.push(`${ev.minute}' — Автогол соперника`);
          } else {
            const scorer = ev.playerId ? playerMap.get(ev.playerId) : undefined;
            const assist = ev.assistPlayerId ? playerMap.get(ev.assistPlayerId) : undefined;
            const pen = ev.isPenalty ? ' (пен.)' : '';
            const asstText = assist ? ` (пас: ${assist.shortName || assist.fullName})` : '';
            lines.push(`${ev.minute}' — ${scorer?.fullName || 'Игрок клуба'}${pen}${asstText}`);
          }
        }
      }

      const mvp = match.mvpPlayerId ? playerMap.get(match.mvpPlayerId) : undefined;
      if (mvp) {
        const note = draft.resultsMvpNote.trim() || getPlayerMatchSummary(match, mvp);
        lines.push('');
        lines.push(`Лучший игрок матча (MVP): #${mvp.number} ${mvp.fullName} — ${note}`);
      }

      if (match.venue) {
        lines.push('');
        lines.push(`${formatRuDate(match.date)} · ${match.venue}`);
      }

      return (
        lines
          .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
          .join('\n')
          .trim() +
        vkFooter +
        hashtags
      );
    }

    case 'scorers': {
      const seasonObj = db.seasons.find((s) => s.id === draft.seasonFilterId);
      const stats = computeFieldPlayerStats(db.players, db.matches, draft.seasonFilterId);
      const sorted = [...stats]
        .sort((a, b) => {
          if (draft.scorersMode === 'goals') return b.goals - a.goals || b.points - a.points;
          if (draft.scorersMode === 'assists') return b.assists - a.assists || b.points - a.points;
          return b.points - a.points || b.goals - a.goals;
        })
        .slice(0, draft.scorersLimit);

      const title =
        draft.scorersTitle.trim() ||
        (draft.scorersMode === 'goals'
          ? 'БОМБАРДИРЫ КЛУБА'
          : draft.scorersMode === 'assists'
          ? 'АССИСТЕНТЫ КЛУБА'
          : 'ЛИДЕРЫ ПО СИСТЕМЕ «ГОЛ + ПАС»');

      const lines = [
        `${title.toUpperCase()} | ${clubName}`,
        seasonObj ? seasonObj.name : 'Все турниры сезона',
        '',
        ...sorted.map(
          (r, i) =>
            `${i + 1}. #${r.player.number} ${r.player.fullName} — ${r.points} (${r.goals} г. + ${r.assists} п., ${r.matches} и.)`
        ),
      ];
      return lines.join('\n').trim() + vkFooter + hashtags;
    }

    case 'goalkeepers': {
      const seasonObj = db.seasons.find((s) => s.id === draft.seasonFilterId);
      const gks = computeGoalkeeperStats(db.players, db.matches, draft.seasonFilterId);
      const lines = [
        `${(draft.gkTitle.trim() || 'ВРАТАРИ И СУХАРИ').toUpperCase()} | ${clubName}`,
        seasonObj ? seasonObj.name : 'Все турниры сезона',
        '',
        ...gks.map(
          (g, i) =>
            `${i + 1}. #${g.player.number} ${g.player.fullName} — ${g.matches} и., ${g.cleanSheets} сух., ${g.conceded} пм., КН ${
              g.matches > 0 ? g.gaa.toFixed(2) : '—'
            }`
        ),
      ];
      return lines.join('\n').trim() + vkFooter + hashtags;
    }

    case 'club_event': {
      if (draft.eventPreset === 'potm_vote') {
        const stats = computeFieldPlayerStats(db.players, db.matches, draft.seasonFilterId);
        const topNominees = stats.slice(0, 4);
        const lines = [
          `${(draft.eventBadgeText || `ГОЛОСОВАНИЕ · ${getCurrentRuMonthYear()}`).toUpperCase()}`,
          `${(draft.eventHeadline || 'КТО ЛУЧШИЙ ИГРОК МЕСЯЦА?').toUpperCase()}`,
          '',
          draft.eventSubtitle ||
            `Выбираем лучшего футболиста ${clubName}! Голосуйте в опросе ниже и пишите своего фаворита в комментариях:`,
          '',
          ...(topNominees.length > 0
            ? [
                'Главные претенденты:',
                ...topNominees.map(
                  (r, idx) =>
                    `${idx + 1}. #${r.player.number} ${r.player.fullName} — ${r.matches} и., ${r.goals} г. + ${r.assists} п. (${r.points} очк.)`
                ),
              ]
            : []),
        ];
        return (
          lines
            .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
            .join('\n')
            .trim() +
          vkFooter +
          hashtags
        );
      }

      if (draft.eventPreset === 'potm_winner') {
        const pl = draft.eventPlayerId ? playerMap.get(draft.eventPlayerId) : db.players[0];
        const stats = computeFieldPlayerStats(db.players, db.matches, draft.seasonFilterId);
        const pStat = pl ? stats.find((s) => s.player.id === pl.id) : undefined;

        const lines = [
          `${(draft.eventBadgeText || `ЛУЧШИЙ ИГРОК МЕСЯЦА · ${getCurrentRuMonthYear()}`).toUpperCase()}`,
          pl ? `#${pl.number} ${pl.fullName.toUpperCase()}!` : draft.eventHeadline,
          pStat
            ? `Статистика: ${pStat.matches} игр · ${pStat.goals} голов · ${pStat.assists} ассистов · ${pStat.points} (Г+П)`
            : '',
          '',
          draft.eventSubtitle ||
            'По итогам голосования болельщиков! Благодарим за яркую игру и самоотдачу на паркете!',
        ];
        return (
          lines
            .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
            .join('\n')
            .trim() +
          vkFooter +
          hashtags
        );
      }

      const pl =
        !draft.eventUseCustomPhoto && draft.eventPlayerId
          ? playerMap.get(draft.eventPlayerId)
          : undefined;
      const headline = draft.eventHeadline || 'Новости клуба';
      const includePlayerLine =
        pl &&
        !headline.toLowerCase().includes(pl.fullName.toLowerCase()) &&
        !headline.toLowerCase().includes(pl.shortName.toLowerCase());

      const lines = [
        draft.eventBadgeText ? `${draft.eventBadgeText.toUpperCase()}` : '',
        headline,
        includePlayerLine && pl ? `#${pl.number} ${pl.fullName}` : '',
        '',
        draft.eventSubtitle || '',
      ];
      return (
        lines
          .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
          .join('\n')
          .trim() +
        vkFooter +
        hashtags
      );
    }
  }
}
