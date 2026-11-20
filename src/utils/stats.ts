import {
  FieldPlayerStat,
  GoalkeeperStat,
  MatchItem,
  Player,
} from '../types/club';

export interface MatchScore {
  our: number;
  opponent: number;
}

export function getMatchScore(match: MatchItem): MatchScore {
  if (match.isTechnical && match.technicalWinner) {
    return match.technicalWinner === 'our'
      ? { our: 5, opponent: 0 }
      : { our: 0, opponent: 5 };
  }
  let our = 0;
  let opponent = 0;
  for (const ev of match.events) {
    if (ev.type === 'goal_our' || ev.type === 'own_goal_opp') {
      our += 1;
    } else if (ev.type === 'goal_opp' || ev.type === 'own_goal_our') {
      opponent += 1;
    }
  }
  return { our, opponent };
}

export function getMatchOutcome(match: MatchItem): 'W' | 'D' | 'L' | null {
  if (match.status !== 'finished') return null;
  const score = getMatchScore(match);
  if (score.our > score.opponent) return 'W';
  if (score.our < score.opponent) return 'L';
  if (match.penalties) {
    if (match.penalties.our > match.penalties.opponent) return 'W';
    if (match.penalties.our < match.penalties.opponent) return 'L';
  }
  return 'D';
}

export function resolveMatchGoalkeepers(
  match: MatchItem,
  players: Player[]
): { gkHalf1Id: string; gkHalf2Id: string; playedGkIds: string[] } {
  const activeGks = players.filter((p) => p.role === 'GK' && p.isActive);
  const autoGkId = activeGks.length === 1 ? activeGks[0].id : '';
  const gkHalf1Id = match.gkHalf1Id || autoGkId;
  const gkHalf2Id = match.gkHalf2Id || autoGkId;
  const set = new Set<string>();
  if (gkHalf1Id) set.add(gkHalf1Id);
  if (gkHalf2Id) set.add(gkHalf2Id);
  return { gkHalf1Id, gkHalf2Id, playedGkIds: Array.from(set) };
}

export function computeFieldPlayerStats(
  players: Player[],
  matches: MatchItem[],
  seasonFilterId = 'all'
): FieldPlayerStat[] {
  const relevantMatches = matches.filter(
    (m) =>
      m.status === 'finished' &&
      (seasonFilterId === 'all' || m.seasonTagId === seasonFilterId)
  );

  const map = new Map<string, FieldPlayerStat>();
  for (const p of players) {
    map.set(p.id, {
      player: p,
      matches: 0,
      goals: 0,
      penalties: 0,
      assists: 0,
      points: 0,
      yellowCards: 0,
      redCards: 0,
    });
  }

  for (const match of relevantMatches) {
    if (match.isTechnical) continue;

    const participants = new Set<string>(match.lineupPlayerIds);
    for (const ev of match.events) {
      if (ev.playerId) participants.add(ev.playerId);
      if (ev.assistPlayerId) participants.add(ev.assistPlayerId);
    }

    for (const pid of participants) {
      const row = map.get(pid);
      if (row) row.matches += 1;
    }

    for (const ev of match.events) {
      if (ev.type === 'goal_our') {
        if (ev.playerId && map.has(ev.playerId)) {
          const scorer = map.get(ev.playerId)!;
          scorer.goals += 1;
          if (ev.isPenalty) scorer.penalties += 1;
          scorer.points = scorer.goals + scorer.assists;
        }
        if (ev.assistPlayerId && map.has(ev.assistPlayerId)) {
          const assister = map.get(ev.assistPlayerId)!;
          assister.assists += 1;
          assister.points = assister.goals + assister.assists;
        }
      } else if (ev.type === 'yellow' && ev.playerId && map.has(ev.playerId)) {
        map.get(ev.playerId)!.yellowCards += 1;
      } else if (ev.type === 'red' && ev.playerId && map.has(ev.playerId)) {
        map.get(ev.playerId)!.redCards += 1;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goals !== a.goals) return b.goals - a.goals;
    if (b.assists !== a.assists) return b.assists - a.assists;
    if (a.matches !== b.matches) return a.matches - b.matches;
    return a.player.number - b.player.number;
  });
}

/**
 * Goalkeeper stats strictly following Variant A clean-sheet rule & GAA (КН = ПМ / И):
 * - Technical wins/losses do NOT award clean sheets or conceded goals.
 * - If our team conceded 0 goals in a finished non-technical match, every GK who played gets +1 Сух.
 * - Conceded goals (opponent goals + our own goals) are charged to concededGkId or the GK of that half.
 * - Sorted by КН ascending (with >=1 match first), then Сух. desc, then И desc.
 */
export function computeGoalkeeperStats(
  players: Player[],
  matches: MatchItem[],
  seasonFilterId = 'all'
): GoalkeeperStat[] {
  const relevantMatches = matches.filter(
    (m) =>
      m.status === 'finished' &&
      (seasonFilterId === 'all' || m.seasonTagId === seasonFilterId)
  );

  const gks = players.filter((p) => p.role === 'GK');
  const map = new Map<string, GoalkeeperStat>();
  for (const gk of gks) {
    map.set(gk.id, {
      player: gk,
      matches: 0,
      conceded: 0,
      gaa: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
    });
  }

  for (const match of relevantMatches) {
    if (match.isTechnical) continue;

    const { gkHalf1Id, gkHalf2Id, playedGkIds } = resolveMatchGoalkeepers(match, players);
    const score = getMatchScore(match);

    for (const gkId of playedGkIds) {
      const row = map.get(gkId);
      if (row) {
        row.matches += 1;
        if (score.opponent === 0) {
          row.cleanSheets += 1;
        }
      }
    }

    for (const ev of match.events) {
      if (ev.type === 'goal_opp' || ev.type === 'own_goal_our') {
        const targetGkId =
          ev.concededGkId || (ev.half === 1 ? gkHalf1Id : gkHalf2Id) || gkHalf1Id || gkHalf2Id;
        if (targetGkId && map.has(targetGkId)) {
          map.get(targetGkId)!.conceded += 1;
        }
      } else if (ev.type === 'yellow' && ev.playerId && map.has(ev.playerId)) {
        map.get(ev.playerId)!.yellowCards += 1;
      } else if (ev.type === 'red' && ev.playerId && map.has(ev.playerId)) {
        map.get(ev.playerId)!.redCards += 1;
      }
    }
  }

  for (const row of map.values()) {
    row.gaa = row.matches > 0 ? row.conceded / row.matches : 0;
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.matches === 0 && b.matches > 0) return 1;
    if (b.matches === 0 && a.matches > 0) return -1;
    if (a.gaa !== b.gaa) return a.gaa - b.gaa;
    if (b.cleanSheets !== a.cleanSheets) return b.cleanSheets - a.cleanSheets;
    return b.matches - a.matches;
  });
}

export function getPlayerMatchSummary(match: MatchItem, player: Player): string {
  const goals = match.events.filter((e) => e.type === 'goal_our' && e.playerId === player.id).length;
  const assists = match.events.filter(
    (e) => e.type === 'goal_our' && e.assistPlayerId === player.id
  ).length;
  const score = getMatchScore(match);

  if (player.role === 'GK') {
    if (!match.isTechnical && score.opponent === 0) {
      return 'Матч на ноль (Сухарь)';
    }
    const parts: string[] = [];
    if (goals > 0) parts.push(`${goals} гол`);
    if (assists > 0) parts.push(`${assists} ассист`);
    return parts.length > 0 ? `Вратарь · ${parts.join(' · ')}` : 'Ключевые спасения';
  }

  const parts: string[] = [];
  if (goals > 0) {
    parts.push(`${goals} ${pluralizeRu(goals, 'гол', 'гола', 'голов')}`);
  }
  if (assists > 0) {
    parts.push(`${assists} ${pluralizeRu(assists, 'ассист', 'ассиста', 'ассистов')}`);
  }
  return parts.length > 0 ? parts.join(' + ') : 'Лидер встречи';
}

export function pluralizeRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}

export interface UpcomingBirthday {
  player: Player;
  daysUntil: number;
  turningAge: number;
  formattedDate: string;
}

export function getUpcomingBirthdays(players: Player[], maxDays = 45): UpcomingBirthday[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const list: UpcomingBirthday[] = [];

  for (const player of players) {
    if (!player.birthDate) continue;
    const parts = player.birthDate.split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) continue;
    const [birthYear, birthMonth, birthDay] = parts;

    let next = new Date(today.getFullYear(), birthMonth - 1, birthDay);
    if (next < today) {
      next = new Date(today.getFullYear() + 1, birthMonth - 1, birthDay);
    }
    const diffMs = next.getTime() - today.getTime();
    const daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (daysUntil <= maxDays) {
      const turningAge = next.getFullYear() - birthYear;
      const formattedDate = next.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
      });
      list.push({ player, daysUntil, turningAge, formattedDate });
    }
  }

  return list.sort((a, b) => a.daysUntil - b.daysUntil);
}

export function formatRuDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }).toUpperCase();
}

export function formatRuDateShort(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCell).join(';'), ...rows.map((r) => r.map(escapeCell).join(';'))].join(
      '\r\n'
    );
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
