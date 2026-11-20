export type PlayerRole = 'FIELD' | 'GK';
export type LogoMaskMode = 'none' | 'circle' | 'shield';

export interface ClubProfile {
  name: string;
  shortName: string;
  city: string;
  defaultVenue?: string;
  vkLink: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string;
  logoMask?: LogoMaskMode;
  altLogoUrl: string;
  altLogoMask?: LogoMaskMode;
  logoScale: number;
  logoOffsetX: number;
  logoOffsetY: number;
  altLogoScale?: number;
  altLogoOffsetX?: number;
  altLogoOffsetY?: number;
}

export interface SeasonTag {
  id: string;
  name: string;
  seasonLabel: string;
  isArchived: boolean;
}

export interface OpponentTeam {
  id: string;
  name: string;
  shortName: string;
  logoUrl: string;
  logoMask?: LogoMaskMode;
  logoScale: number;
  logoOffsetX: number;
  logoOffsetY: number;
}

export interface Player {
  id: string;
  fullName: string;
  shortName: string;
  number: number;
  role: PlayerRole;
  isCaptain: boolean;
  isActive: boolean;
  birthDate: string; // YYYY-MM-DD or ''
  photoUrl: string;
  photoScale: number;
  photoOffsetX: number;
  photoOffsetY: number;
}

export type MediaGalleryCategory = 'backdrop' | 'match' | 'player';

export interface MediaGalleryItem {
  id: string;
  title: string;
  category: MediaGalleryCategory;
  imageUrl: string;
  playerId?: string;
  createdAt: string;
}

export type MatchEventType =
  | 'goal_our'
  | 'goal_opp'
  | 'own_goal_our'
  | 'own_goal_opp'
  | 'yellow'
  | 'red';

export interface MatchEvent {
  id: string;
  half: 1 | 2;
  minute: number;
  type: MatchEventType;
  playerId?: string;
  assistPlayerId?: string;
  isPenalty?: boolean;
  concededGkId?: string;
}

export interface MatchPenaltyShootout {
  our: number;
  opponent: number;
}

export interface MatchItem {
  id: string;
  seasonTagId: string;
  roundLabel: string;
  opponentId: string;
  isHome: boolean;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  venue: string;
  status: 'scheduled' | 'live' | 'finished';
  halfDuration: 20 | 25;
  lineupPlayerIds: string[];
  startingFiveIds: string[];
  gkHalf1Id: string;
  gkHalf2Id: string;
  events: MatchEvent[];
  isTechnical: boolean;
  technicalWinner: 'our' | 'opponent' | null;
  penalties: MatchPenaltyShootout | null;
  mvpPlayerId: string;
  coverPhotoUrl?: string;
  coverPhotoScale?: number;
  coverPhotoOffsetX?: number;
  coverPhotoOffsetY?: number;
  notes?: string;
}

export type PosterFormat = '4:5' | '9:16' | '1:1';
export type PosterMode =
  | 'matchday'
  | 'lineup'
  | 'results'
  | 'scorers'
  | 'goalkeepers'
  | 'club_event';
export type PosterThemeId = 'midnight' | 'club' | 'light' | 'gold';
export type PosterBackgroundPreset =
  | 'fortuna_arena'
  | 'shushenskoe'
  | 'summer_pitch'
  | 'broadcast'
  | 'custom';
export type PosterLayoutStyle = 'matchtv' | 'cinematic' | 'broadcast';
export type ScorersMode = 'points' | 'goals' | 'assists';
export type ClubEventPreset =
  | 'potm_vote'
  | 'potm_winner'
  | 'birthday'
  | 'welcome'
  | 'announcement'
  | 'training';

export interface PosterDraft {
  mode: PosterMode;
  format: PosterFormat;
  theme: PosterThemeId;
  layoutStyle: PosterLayoutStyle;
  showSafeZones: boolean; // preview-only VK Stories guide overlay
  bgPreset: PosterBackgroundPreset;
  bgOverlayOpacity: number; // 0.20 .. 0.90
  bgCustomUrl: string;
  useAltLogo: boolean;
  matchId: string;
  seasonFilterId: string; // 'all' or SeasonTag.id
  // Matchday options
  matchdayPlayerId: string;
  matchdayKicker: string;
  // Lineup options
  lineupTitle: string;
  lineupSelectedIds: string[];
  lineupShowStartingFive: boolean;
  // Results options
  resultsHeadline: string;
  resultsMvpNote: string;
  // Scorers options
  scorersMode: ScorersMode;
  scorersLimit: 5 | 10;
  scorersTitle: string;
  // Goalkeepers options
  gkTitle: string;
  // Club Event & POTM options
  eventPreset: ClubEventPreset;
  eventPlayerId: string;
  eventUseCustomPhoto: boolean;
  eventCustomPhotoUrl: string;
  eventCustomPhotoScale: number;
  eventCustomPhotoOffsetX: number;
  eventCustomPhotoOffsetY: number;
  eventHeadline: string;
  eventSubtitle: string;
  eventBadgeText: string;
}

export interface FieldPlayerStat {
  player: Player;
  matches: number;
  goals: number;
  penalties: number;
  assists: number;
  points: number;
  yellowCards: number;
  redCards: number;
}

export interface GoalkeeperStat {
  player: Player;
  matches: number;
  conceded: number;
  gaa: number; // КН = ПМ / И
  cleanSheets: number;
  yellowCards: number;
  redCards: number;
}

export interface ClubDatabase {
  version: number;
  updatedAt: string;
  lastBackupAt?: string;
  club: ClubProfile;
  seasons: SeasonTag[];
  opponents: OpponentTeam[];
  players: Player[];
  matches: MatchItem[];
  mediaGallery?: MediaGalleryItem[];
}
