import { LogoMaskMode, PosterBackgroundPreset } from '../types/club';

export interface LogoPresetOption {
  id: string;
  name: string;
  subtitle: string;
  url: string;
  mask: LogoMaskMode;
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface BackgroundPresetOption {
  id: PosterBackgroundPreset;
  name: string;
  subtitle: string;
  url: string;
  recommendedDim: number;
}

export const FORTUNA_ASSETS = {
  logoMetallicShield: '/assets/aistudio/Gemini_Generated_Image_xwfw9ixwfw9ixwfw_d9008d1c.jpg',
  logoGoldMedal: '/assets/images/fortuna_logo_gold_medal_1795151277914.jpg',
  logoObsidianGold: '/assets/images/fortuna_logo_obsidian_gold_1795151276516.jpg',
  logoOriginal: '/assets/aistudio/LsReEBwgAaY-2_a6c3d535.jpg',
  bgFortunaArena: '/assets/images/bg_fortuna_crimson_1795151276374.jpg',
  bgShushenskoe:
    '/assets/aistudio/811762a0908eb4058a0a226b0d66009b_4c1c7d08-bb27-41e4-bd9e-39b682316cd2_f4608ef8.jpg',
  bgSummerPitch: '/assets/images/bg_summer_pitch_1795151277156.jpg',
  potmMysterySilhouette: '/assets/images/potm_mystery_silhouette_1795156777716.jpg',
} as const;

export const FORTUNA_LOGO_PRESETS: LogoPresetOption[] = [
  {
    id: 'metallic_shield',
    name: 'Металлический щит · Шампань (Основной)',
    subtitle: 'Рельефный рубиново-антрацитовый щит с матовой латунной оправой — официальный брендбук',
    url: FORTUNA_ASSETS.logoMetallicShield,
    mask: 'shield',
    scale: 1.27,
    offsetX: 1,
    offsetY: 1,
  },
  {
    id: 'gold_medal',
    name: 'Премиум-медаль · Тонкое золото',
    subtitle: 'Сдержанный круглый медальон в тонкой золотой оправе — альтернатива для аватаров и сторис',
    url: FORTUNA_ASSETS.logoGoldMedal,
    mask: 'circle',
    scale: 1.24,
    offsetX: 0,
    offsetY: 0,
  },
  {
    id: 'obsidian_gold',
    name: 'Обсидиан · Золотой контур',
    subtitle: 'Тёмный люксовый щит с рубиновым отблеском — для ночных афиш и MVP',
    url: FORTUNA_ASSETS.logoObsidianGold,
    mask: 'shield',
    scale: 1.38,
    offsetX: 0,
    offsetY: 2,
  },
  {
    id: 'original_shield',
    name: 'Оригинальный логотип (классика)',
    subtitle: 'Исходная классическая эмблема ФК «Фортуна» с аккуратной обрезкой по щиту',
    url: FORTUNA_ASSETS.logoOriginal,
    mask: 'shield',
    scale: 1.38,
    offsetX: 0,
    offsetY: 2,
  },
];

export const POSTER_BG_PRESETS: BackgroundPresetOption[] = [
  {
    id: 'fortuna_arena',
    name: 'Стиль «Фортуна»',
    subtitle: 'Алая арена и прожекторы в цветах клуба',
    url: FORTUNA_ASSETS.bgFortunaArena,
    recommendedDim: 0.52,
  },
  {
    id: 'shushenskoe',
    name: 'ФСЦ Шушенское',
    subtitle: 'Домашний зал в вечерней подсветке',
    url: FORTUNA_ASSETS.bgShushenskoe,
    recommendedDim: 0.64,
  },
  {
    id: 'summer_pitch',
    name: 'Летний газон',
    subtitle: 'Открытое поле с травой и сибирским лесом',
    url: FORTUNA_ASSETS.bgSummerPitch,
    recommendedDim: 0.56,
  },
  {
    id: 'broadcast',
    name: 'Чистый ТВ-эфир',
    subtitle: 'Строгий геометрический градиент без фото',
    url: '',
    recommendedDim: 0.45,
  },
  {
    id: 'custom',
    name: 'Свой фон',
    subtitle: 'Загрузите фото зала, трибун или команды',
    url: '',
    recommendedDim: 0.6,
  },
];
