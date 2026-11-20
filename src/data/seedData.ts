import { ClubDatabase } from '../types/club';
import { FORTUNA_ASSETS } from './brandAssets';

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

export function createCrestDataUrl(
  initials: string,
  primary: string,
  secondary: string,
  accent: string,
  monochrome = false
): string {
  const bg1 = monochrome ? '#FFFFFF' : secondary;
  const bg2 = monochrome ? '#E2E8F0' : primary;
  const stroke = monochrome ? '#FFFFFF' : accent;
  const textFill = monochrome ? '#0B1736' : '#FFFFFF';
  const fillShield = monochrome ? 'rgba(255,255,255,0.14)' : `url(#g_${initials})`;

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
    <defs>
      <linearGradient id="g_${initials}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bg1}"/>
        <stop offset="100%" stop-color="${bg2}"/>
      </linearGradient>
    </defs>
    <path d="M120 14 L208 46 V126 C208 180 168 214 120 228 C72 214 32 180 32 126 V46 Z"
      fill="${fillShield}" stroke="${stroke}" stroke-width="8" stroke-linejoin="round"/>
    <path d="M120 28 L194 55 V124 C194 170 160 199 120 212 C80 199 46 170 46 124 V55 Z"
      fill="none" stroke="${monochrome ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.22)'}" stroke-width="2"/>
    <polygon points="120,44 127,61 146,62 131,73 136,91 120,80 104,91 109,73 94,62 113,61"
      fill="${stroke}"/>
    <text x="120" y="156" text-anchor="middle" font-family="Arial Black, sans-serif" font-weight="900" font-size="54" fill="${monochrome ? '#FFFFFF' : textFill}" letter-spacing="-1">${initials}</text>
  </svg>`;
  return svgToDataUrl(svg);
}

export function createPlayerPortraitSvg(
  number: number,
  jerseyPrimary: string,
  jerseyAccent: string,
  skinTone: string,
  hairColor: string
): string {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 520">
    <defs>
      <linearGradient id="j_${number}" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${jerseyPrimary}"/>
        <stop offset="100%" stop-color="#111318"/>
      </linearGradient>
    </defs>
    <path d="M52 520 L78 338 C86 296 130 272 178 266 L242 266 C290 272 334 296 342 338 L368 520 Z" fill="url(#j_${number})" stroke="rgba(255,255,255,0.18)" stroke-width="3"/>
    <path d="M168 266 L210 318 L252 266 Z" fill="${skinTone}"/>
    <path d="M164 266 L210 326 L256 266" fill="none" stroke="${jerseyAccent}" stroke-width="7" stroke-linejoin="round"/>
    <path d="M110 350 L310 350 L300 370 L120 370 Z" fill="${jerseyAccent}" opacity="0.92"/>
    <text x="210" y="458" text-anchor="middle" font-family="Arial Black, sans-serif" font-weight="900" font-size="82" fill="#FFFFFF" opacity="0.95">${number}</text>
    <rect x="184" y="216" width="52" height="58" rx="18" fill="${skinTone}"/>
    <ellipse cx="210" cy="166" rx="56" ry="68" fill="${skinTone}"/>
    <ellipse cx="152" cy="170" rx="10" ry="18" fill="${skinTone}"/>
    <ellipse cx="268" cy="170" rx="10" ry="18" fill="${skinTone}"/>
    <path d="M154 156 C152 104 176 86 210 86 C244 86 268 104 266 156 C256 128 240 118 210 118 C180 118 164 128 154 156 Z" fill="${hairColor}"/>
    <path d="M182 162 Q192 158 200 162" stroke="#1E293B" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path d="M220 162 Q228 158 238 162" stroke="#1E293B" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path d="M196 202 Q210 210 224 202" stroke="#9A3412" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.65"/>
  </svg>`;
  return svgToDataUrl(svg);
}

function getUpcomingDateString(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getUpcomingBirthDate(daysFromNow: number, birthYear: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${birthYear}-${m}-${day}`;
}

export function createSeedDatabase(): ClubDatabase {
  const opp1Logo = createCrestDataUrl('СГ', '#1D4ED8', '#0B1736', '#93C5FD', false);
  const opp2Logo = createCrestDataUrl('ЕН', '#059669', '#064E3B', '#6EE7B7', false);
  const opp3Logo = createCrestDataUrl('МН', '#B45309', '#451A03', '#FDE047', false);
  const opp4Logo = createCrestDataUrl('СБ', '#475569', '#0F172A', '#E2E8F0', false);

  const players = [
    {
      id: 'p1',
      fullName: 'Соколов Артём',
      shortName: 'Соколов',
      number: 1,
      role: 'GK' as const,
      isCaptain: false,
      isActive: true,
      birthDate: getUpcomingBirthDate(3, 1996),
      photoUrl: createPlayerPortraitSvg(1, '#1E293B', '#C8B289', '#F1C29B', '#1E293B'),
      photoScale: 1.05,
      photoOffsetX: 0,
      photoOffsetY: 6,
    },
    {
      id: 'p2',
      fullName: 'Волков Дмитрий',
      shortName: 'Волков',
      number: 10,
      role: 'FIELD' as const,
      isCaptain: true,
      isActive: true,
      birthDate: getUpcomingBirthDate(9, 1995),
      photoUrl: createPlayerPortraitSvg(10, '#8B1723', '#C8B289', '#E8B890', '#27272A'),
      photoScale: 1.08,
      photoOffsetX: 0,
      photoOffsetY: 5,
    },
    {
      id: 'p3',
      fullName: 'Морозов Никита',
      shortName: 'Морозов',
      number: 7,
      role: 'FIELD' as const,
      isCaptain: false,
      isActive: true,
      birthDate: '1998-04-18',
      photoUrl: createPlayerPortraitSvg(7, '#8B1723', '#C8B289', '#F3C9A8', '#78350F'),
      photoScale: 1.05,
      photoOffsetX: 0,
      photoOffsetY: 6,
    },
    {
      id: 'p4',
      fullName: 'Лебедев Кирилл',
      shortName: 'Лебедев',
      number: 9,
      role: 'FIELD' as const,
      isCaptain: false,
      isActive: true,
      birthDate: '1999-08-22',
      photoUrl: createPlayerPortraitSvg(9, '#8B1723', '#C8B289', '#E5B28A', '#0F172A'),
      photoScale: 1.05,
      photoOffsetX: 0,
      photoOffsetY: 6,
    },
    {
      id: 'p5',
      fullName: 'Орлов Максим',
      shortName: 'Орлов',
      number: 11,
      role: 'FIELD' as const,
      isCaptain: false,
      isActive: true,
      birthDate: '1997-02-11',
      photoUrl: createPlayerPortraitSvg(11, '#8B1723', '#C8B289', '#F2C6A0', '#3F3F46'),
      photoScale: 1.05,
      photoOffsetX: 0,
      photoOffsetY: 6,
    },
    {
      id: 'p6',
      fullName: 'Громов Егор',
      shortName: 'Громов',
      number: 4,
      role: 'FIELD' as const,
      isCaptain: false,
      isActive: true,
      birthDate: '1994-11-05',
      photoUrl: createPlayerPortraitSvg(4, '#8B1723', '#C8B289', '#E0AA80', '#18181B'),
      photoScale: 1.05,
      photoOffsetX: 0,
      photoOffsetY: 6,
    },
    {
      id: 'p7',
      fullName: 'Белов Александр',
      shortName: 'Белов',
      number: 8,
      role: 'FIELD' as const,
      isCaptain: false,
      isActive: true,
      birthDate: '2000-06-14',
      photoUrl: createPlayerPortraitSvg(8, '#8B1723', '#C8B289', '#F5CBA7', '#92400E'),
      photoScale: 1.05,
      photoOffsetX: 0,
      photoOffsetY: 6,
    },
    {
      id: 'p8',
      fullName: 'Титов Роман',
      shortName: 'Титов',
      number: 17,
      role: 'FIELD' as const,
      isCaptain: false,
      isActive: true,
      birthDate: '2001-01-27',
      photoUrl: createPlayerPortraitSvg(17, '#8B1723', '#C8B289', '#EBB991', '#1E293B'),
      photoScale: 1.05,
      photoOffsetX: 0,
      photoOffsetY: 6,
    },
    {
      id: 'p9',
      fullName: 'Ковалёв Даниил',
      shortName: 'Ковалёв',
      number: 23,
      role: 'FIELD' as const,
      isCaptain: false,
      isActive: true,
      birthDate: '1998-09-30',
      photoUrl: createPlayerPortraitSvg(23, '#8B1723', '#C8B289', '#F0C09B', '#292524'),
      photoScale: 1.05,
      photoOffsetX: 0,
      photoOffsetY: 6,
    },
    {
      id: 'p10',
      fullName: 'Ершов Илья',
      shortName: 'Ершов',
      number: 99,
      role: 'GK' as const,
      isCaptain: false,
      isActive: true,
      birthDate: '1997-07-08',
      photoUrl: createPlayerPortraitSvg(99, '#334155', '#C8B289', '#ECC09B', '#18181B'),
      photoScale: 1.05,
      photoOffsetX: 0,
      photoOffsetY: 6,
    },
  ];

  const allPlayerIds = players.map((p) => p.id);

  return {
    version: 3,
    updatedAt: new Date().toISOString(),
    club: {
      name: 'ФК Фортуна',
      shortName: 'Фортуна',
      city: 'Шушенское',
      defaultVenue: 'ФСЦ «Шушенское»',
      vkLink: 'vk.com/fc_fortuna_shush',
      primaryColor: '#8B1723',
      secondaryColor: '#16181C',
      accentColor: '#C8B289',
      logoUrl: FORTUNA_ASSETS.logoMetallicShield,
      logoMask: 'shield',
      altLogoUrl: FORTUNA_ASSETS.logoGoldMedal,
      altLogoMask: 'circle',
      logoScale: 1.27,
      logoOffsetX: 1,
      logoOffsetY: 1,
      altLogoScale: 1.24,
      altLogoOffsetX: 0,
      altLogoOffsetY: 0,
    },
    seasons: [
      {
        id: 's1',
        name: 'Чемпионат Шушенского 2026',
        seasonLabel: 'Футзал · 5×5',
        isArchived: false,
      },
      {
        id: 's2',
        name: 'Летний кубок на газоне',
        seasonLabel: 'Открытое поле · Плей-офф',
        isArchived: false,
      },
    ],
    opponents: [
      {
        id: 'opp1',
        name: 'ФК Саяногорск',
        shortName: 'Саяногорск',
        logoUrl: opp1Logo,
        logoMask: 'none',
        logoScale: 1,
        logoOffsetX: 0,
        logoOffsetY: 0,
      },
      {
        id: 'opp2',
        name: 'СК Енисей-Юг',
        shortName: 'Енисей-Юг',
        logoUrl: opp2Logo,
        logoMask: 'none',
        logoScale: 1,
        logoOffsetX: 0,
        logoOffsetY: 0,
      },
      {
        id: 'opp3',
        name: 'ФК Минусинск',
        shortName: 'Минусинск',
        logoUrl: opp3Logo,
        logoMask: 'none',
        logoScale: 1,
        logoOffsetX: 0,
        logoOffsetY: 0,
      },
      {
        id: 'opp4',
        name: 'МФК Сибирь',
        shortName: 'Сибирь',
        logoUrl: opp4Logo,
        logoMask: 'none',
        logoScale: 1,
        logoOffsetX: 0,
        logoOffsetY: 0,
      },
    ],
    players,
    matches: [
      {
        id: 'm1',
        seasonTagId: 's1',
        roundLabel: 'Тур 8',
        opponentId: 'opp1',
        isHome: true,
        date: getUpcomingDateString(-2),
        time: '19:30',
        venue: 'ФСЦ «Шушенское»',
        status: 'finished',
        halfDuration: 20,
        lineupPlayerIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'],
        startingFiveIds: ['p1', 'p2', 'p3', 'p4', 'p6'],
        gkHalf1Id: 'p1',
        gkHalf2Id: 'p1',
        isTechnical: false,
        technicalWinner: null,
        penalties: null,
        mvpPlayerId: 'p2',
        events: [
          { id: 'e1', half: 1, minute: 4, type: 'goal_our', playerId: 'p2', assistPlayerId: 'p3' },
          { id: 'e2', half: 1, minute: 11, type: 'goal_opp', concededGkId: 'p1' },
          { id: 'e3', half: 1, minute: 18, type: 'goal_our', playerId: 'p4', assistPlayerId: 'p2' },
          { id: 'e4', half: 2, minute: 24, type: 'yellow', playerId: 'p6' },
          { id: 'e5', half: 2, minute: 29, type: 'goal_our', playerId: 'p2', isPenalty: true },
          { id: 'e6', half: 2, minute: 35, type: 'goal_opp', concededGkId: 'p1' },
          { id: 'e7', half: 2, minute: 38, type: 'goal_our', playerId: 'p3', assistPlayerId: 'p2' },
        ],
      },
      {
        id: 'm2',
        seasonTagId: 's1',
        roundLabel: 'Тур 7',
        opponentId: 'opp2',
        isHome: false,
        date: getUpcomingDateString(-9),
        time: '20:00',
        venue: 'ФСЦ «Шушенское»',
        status: 'finished',
        halfDuration: 20,
        lineupPlayerIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p9'],
        startingFiveIds: ['p1', 'p2', 'p3', 'p5', 'p6'],
        gkHalf1Id: 'p1',
        gkHalf2Id: 'p1',
        isTechnical: false,
        technicalWinner: null,
        penalties: null,
        mvpPlayerId: 'p1',
        events: [
          { id: 'e8', half: 1, minute: 7, type: 'goal_our', playerId: 'p3', assistPlayerId: 'p5' },
          { id: 'e9', half: 1, minute: 16, type: 'goal_our', playerId: 'p4', assistPlayerId: 'p2' },
          { id: 'e10', half: 2, minute: 33, type: 'goal_our', playerId: 'p5', assistPlayerId: 'p3' },
        ],
      },
      {
        id: 'm3',
        seasonTagId: 's2',
        roundLabel: '1/2 финала',
        opponentId: 'opp3',
        isHome: true,
        date: getUpcomingDateString(-14),
        time: '18:00',
        venue: 'Стадион «Урожай» (газон)',
        status: 'finished',
        halfDuration: 25,
        lineupPlayerIds: allPlayerIds.slice(0, 9),
        startingFiveIds: ['p10', 'p2', 'p4', 'p5', 'p6'],
        gkHalf1Id: 'p10',
        gkHalf2Id: 'p1',
        isTechnical: false,
        technicalWinner: null,
        penalties: { our: 4, opponent: 3 },
        mvpPlayerId: 'p3',
        events: [
          { id: 'e11', half: 1, minute: 9, type: 'goal_our', playerId: 'p3', assistPlayerId: 'p2' },
          { id: 'e12', half: 1, minute: 19, type: 'goal_opp', concededGkId: 'p10' },
          { id: 'e13', half: 2, minute: 31, type: 'goal_our', playerId: 'p2', assistPlayerId: 'p7' },
          { id: 'e14', half: 2, minute: 44, type: 'goal_opp', concededGkId: 'p1' },
        ],
      },
      {
        id: 'm4',
        seasonTagId: 's1',
        roundLabel: 'Тур 9',
        opponentId: 'opp4',
        isHome: true,
        date: getUpcomingDateString(3),
        time: '19:00',
        venue: 'ФСЦ «Шушенское»',
        status: 'scheduled',
        halfDuration: 20,
        lineupPlayerIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p10'],
        startingFiveIds: ['p1', 'p2', 'p3', 'p4', 'p6'],
        gkHalf1Id: 'p1',
        gkHalf2Id: 'p1',
        isTechnical: false,
        technicalWinner: null,
        penalties: null,
        mvpPlayerId: '',
        events: [],
      },
    ],
    mediaGallery: [
      {
        id: 'mg_shush',
        title: 'ФСЦ «Шушенское» (Вечерний фасад)',
        category: 'backdrop',
        imageUrl: FORTUNA_ASSETS.bgShushenskoe,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'mg_arena',
        title: 'Алая арена ФК «Фортуна»',
        category: 'backdrop',
        imageUrl: FORTUNA_ASSETS.bgFortunaArena,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'mg_summer',
        title: 'Летний газон · Открытое поле',
        category: 'backdrop',
        imageUrl: FORTUNA_ASSETS.bgSummerPitch,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'mg_potm_mystery',
        title: 'Кто станет MVP? (Силуэт ?)',
        category: 'match',
        imageUrl: FORTUNA_ASSETS.potmMysterySilhouette,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

export function createCleanClubDatabase(current: ClubDatabase): ClubDatabase {
  const year = new Date().getFullYear();
  return {
    version: 3,
    updatedAt: new Date().toISOString(),
    lastBackupAt: current.lastBackupAt,
    club: { ...current.club },
    seasons: [
      {
        id: `s_${Date.now()}`,
        name: `Сезон ${year}`,
        seasonLabel: 'Футзал · 5×5',
        isArchived: false,
      },
    ],
    opponents: [],
    players: [],
    matches: [],
    mediaGallery: (current.mediaGallery || []).filter((item) => item.category === 'backdrop'),
  };
}

