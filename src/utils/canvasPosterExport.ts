import {
  ClubDatabase,
  ClubProfile,
  LogoMaskMode,
  MatchItem,
  OpponentTeam,
  Player,
  PosterDraft,
  PosterFormat,
  PosterThemeId,
} from '../types/club';
import { FORTUNA_ASSETS, POSTER_BG_PRESETS } from '../data/brandAssets';
import { resolveAssetUrl } from '../lib/assetUrl';
import {
  computeFieldPlayerStats,
  computeGoalkeeperStats,
  formatRuDate,
  getMatchOutcome,
  getMatchScore,
  getPlayerMatchSummary,
} from './stats';

export const POSTER_DIMENSIONS: Record<PosterFormat, { width: number; height: number; label: string }> = {
  '4:5': { width: 1080, height: 1350, label: 'Пост ВК (4:5)' },
  '9:16': { width: 1080, height: 1920, label: 'Сторис / Клип (9:16)' },
  '1:1': { width: 1080, height: 1080, label: 'Квадрат (1:1)' },
};

const DISPLAY_FONT = '"Unbounded", "Inter", system-ui, sans-serif';
const BODY_FONT = '"Inter", system-ui, -apple-system, sans-serif';

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface ActiveClubLogoSpec {
  img: HTMLImageElement | null;
  mask: LogoMaskMode | undefined;
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface SafeMargins {
  topY: number;
  bottomInset: number;
  footerH: number;
  footerTop: number;
  padX: number;
  isStory: boolean;
  isSquare: boolean;
}

function getSafeMargins(W: number, H: number): SafeMargins {
  const isStory = H >= 1600;
  const isSquare = H === 1080;
  const footerH = 70;
  // VK Stories UI covers ~190px top (avatar + group name) and ~220px bottom (reply bar + reactions)
  const topY = isStory ? 196 : 56;
  const bottomInset = isStory ? 210 : 28;
  const footerTop = H - bottomInset - footerH;
  return {
    topY,
    bottomInset,
    footerH,
    footerTop,
    padX: 60,
    isStory,
    isSquare,
  };
}

function hexToRgb(hex: string): Rgb {
  const clean = (hex || '#8B1723').replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return { r: 139, g: 23, b: 35 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mixHex(hexA: string, hexB: string, ratio: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const r = Math.round(a.r + (b.r - a.r) * ratio);
  const g = Math.round(a.g + (b.g - a.g) * ratio);
  const bl = Math.round(a.b + (b.b - a.b) * ratio);
  return `#${[r, g, bl].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;
}

export interface BroadcastThemePalette {
  id: PosterThemeId;
  name: string;
  isLight: boolean;
  bgTop: string;
  bgMid: string;
  bgBottom: string;
  scrimBase: string;
  glowPrimary: string;
  glowAccent: string;
  cardBg: string;
  cardBgStrong: string;
  cardBorder: string;
  goldLight: string;
  goldMid: string;
  goldDark: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentText: string;
  primary: string;
  lineColor: string;
  footerBg: string;
}

export function buildBroadcastTheme(
  themeId: PosterThemeId,
  club: ClubProfile
): BroadcastThemePalette {
  const primary = club.primaryColor || '#8B1723';
  const secondary = club.secondaryColor || '#16181C';
  const accent = club.accentColor || '#C8B289';
  const goldLight = mixHex(accent, '#FFF8EA', 0.52);
  const goldDark = mixHex(accent, '#2B2216', 0.44);

  switch (themeId) {
    case 'club':
      return {
        id: 'club',
        name: 'Рубиновый эфир',
        isLight: false,
        bgTop: mixHex(primary, '#0D0507', 0.46),
        bgMid: mixHex(primary, secondary, 0.56),
        bgBottom: '#0B0608',
        scrimBase: mixHex(primary, '#0B0608', 0.76),
        glowPrimary: rgba(primary, 0.46),
        glowAccent: rgba(accent, 0.24),
        cardBg: 'rgba(18, 10, 12, 0.80)',
        cardBgStrong: 'rgba(13, 8, 10, 0.91)',
        cardBorder: rgba(accent, 0.36),
        goldLight,
        goldMid: accent,
        goldDark,
        textPrimary: '#FFFFFF',
        textSecondary: 'rgba(248, 246, 242, 0.92)',
        textMuted: 'rgba(218, 214, 208, 0.78)',
        accent,
        accentText: '#111215',
        primary,
        lineColor: 'rgba(255, 255, 255, 0.08)',
        footerBg: 'rgba(10, 6, 8, 0.94)',
      };
    case 'light':
      return {
        id: 'light',
        name: 'Слоновая кость · День',
        isLight: true,
        bgTop: '#F5F3EE',
        bgMid: '#EAE6DD',
        bgBottom: '#DDD7CB',
        scrimBase: '#F2EFE8',
        glowPrimary: rgba(primary, 0.10),
        glowAccent: rgba(accent, 0.18),
        cardBg: 'rgba(255, 255, 255, 0.90)',
        cardBgStrong: 'rgba(255, 255, 255, 0.96)',
        cardBorder: 'rgba(22, 24, 28, 0.13)',
        goldLight: mixHex(accent, '#FFFFFF', 0.35),
        goldMid: mixHex(accent, '#5E4E33', 0.22),
        goldDark: mixHex(accent, '#2B2216', 0.48),
        textPrimary: '#14161A',
        textSecondary: '#2C3038',
        textMuted: '#5C616B',
        accent: primary,
        accentText: '#FFFFFF',
        primary,
        lineColor: 'rgba(22, 24, 28, 0.07)',
        footerBg: '#16181C',
      };
    case 'gold':
      return {
        id: 'gold',
        name: 'Платиновая латунь',
        isLight: false,
        bgTop: '#121317',
        bgMid: '#1B1D23',
        bgBottom: '#0C0D10',
        scrimBase: '#111317',
        glowPrimary: rgba(accent, 0.24),
        glowAccent: rgba(primary, 0.24),
        cardBg: 'rgba(20, 22, 27, 0.84)',
        cardBgStrong: 'rgba(14, 16, 20, 0.93)',
        cardBorder: rgba(accent, 0.44),
        goldLight,
        goldMid: accent,
        goldDark,
        textPrimary: '#FFFFFF',
        textSecondary: '#F3F1EC',
        textMuted: 'rgba(210, 208, 202, 0.78)',
        accent: goldLight,
        accentText: '#111215',
        primary,
        lineColor: rgba(accent, 0.12),
        footerBg: 'rgba(10, 11, 14, 0.95)',
      };
    case 'midnight':
    default:
      return {
        id: 'midnight',
        name: 'Ночной антрацит',
        isLight: false,
        bgTop: mixHex(secondary, '#0A0B0E', 0.42),
        bgMid: mixHex(secondary, primary, 0.16),
        bgBottom: '#0B0C10',
        scrimBase: '#101216',
        glowPrimary: rgba(primary, 0.38),
        glowAccent: rgba(accent, 0.22),
        cardBg: 'rgba(18, 20, 25, 0.82)',
        cardBgStrong: 'rgba(13, 15, 19, 0.92)',
        cardBorder: 'rgba(255, 255, 255, 0.14)',
        goldLight,
        goldMid: accent,
        goldDark,
        textPrimary: '#FFFFFF',
        textSecondary: 'rgba(243, 241, 236, 0.92)',
        textMuted: 'rgba(188, 190, 198, 0.84)',
        accent,
        accentText: '#111215',
        primary,
        lineColor: 'rgba(255, 255, 255, 0.075)',
        footerBg: 'rgba(10, 11, 14, 0.95)',
      };
  }
}

const imageCache = new Map<string, HTMLImageElement>();
let grainCanvasCache: HTMLCanvasElement | null = null;

function getGrainCanvas(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  if (grainCanvasCache) return grainCanvasCache;
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 160;
  const gctx = c.getContext('2d');
  if (!gctx) return null;
  const imgData = gctx.createImageData(160, 160);
  const d = imgData.data;
  let seed = 1337;
  const nextRand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.floor(nextRand() * 255);
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = 28;
  }
  gctx.putImageData(imgData, 0, 0);
  grainCanvasCache = c;
  return c;
}

function drawFilmGrain(ctx: CanvasRenderingContext2D, W: number, H: number, alpha = 0.09): void {
  const grain = getGrainCanvas();
  if (!grain) return;
  const pattern = ctx.createPattern(grain, 'repeat');
  if (!pattern) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function loadImage(src?: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  const resolved = resolveAssetUrl(src);
  if (!resolved) return Promise.resolve(null);
  const cached = imageCache.get(resolved);
  if (cached && cached.complete && cached.naturalWidth > 0) {
    return Promise.resolve(cached);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(resolved, img);
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = resolved;
  });
}

async function ensureFontsReady(): Promise<void> {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await Promise.all([
        document.fonts.load('700 40px "Unbounded"'),
        document.fonts.load('900 60px "Unbounded"'),
        document.fonts.load('500 24px "Inter"'),
        document.fonts.load('700 24px "Inter"'),
      ]);
      await document.fonts.ready;
    } catch {
      // ignore
    }
  }
}

function createGoldGradient(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  theme: BroadcastThemePalette
): CanvasGradient {
  const g = ctx.createLinearGradient(x1, y1, x2, y2);
  g.addColorStop(0, theme.goldDark);
  g.addColorStop(0.35, theme.goldLight);
  g.addColorStop(0.65, theme.goldMid);
  g.addColorStop(1, theme.goldDark);
  return g;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawShieldPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const left = x + w * 0.145;
  const right = x + w * 0.855;
  const top = y + h * 0.04;
  const midY = y + h * 0.55;
  const bottomY = y + h * 0.96;
  const cx = x + w * 0.5;

  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(right, top);
  ctx.lineTo(right, midY);
  ctx.bezierCurveTo(right, y + h * 0.79, cx + w * 0.16, y + h * 0.90, cx, bottomY);
  ctx.bezierCurveTo(cx - w * 0.16, y + h * 0.90, left, y + h * 0.79, left, midY);
  ctx.closePath();
}

function fillBroadcastPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fillStyle: string | CanvasGradient,
  strokeStyle?: string | CanvasGradient,
  lineWidth = 1.5,
  topSpecular = true
): void {
  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  if (topSpecular) {
    ctx.save();
    roundRectPath(ctx, x, y, w, h, r);
    ctx.clip();
    const spec = ctx.createLinearGradient(x, y, x + w, y);
    spec.addColorStop(0, 'rgba(255,255,255,0)');
    spec.addColorStop(0.5, 'rgba(255,255,255,0.22)');
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spec;
    ctx.fillRect(x, y, w, 1.5);
    ctx.restore();
  }
  ctx.restore();
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  baseSize: number,
  minSize: number,
  weight: number | string = 800,
  family: string = DISPLAY_FONT
): number {
  let size = baseSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) {
      return size;
    }
    size -= 1;
  }
  ctx.font = `${weight} ${minSize}px ${family}`;
  return minSize;
}

function drawFittedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  baseSize: number,
  minSize: number,
  color: string,
  options?: {
    weight?: number | string;
    family?: string;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
    shadow?: boolean;
  }
): number {
  const weight = options?.weight ?? 800;
  const family = options?.family ?? DISPLAY_FONT;
  const size = fitText(ctx, text, maxWidth, baseSize, minSize, weight, family);
  ctx.save();
  if (options?.shadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.62)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
  }
  ctx.fillStyle = color;
  ctx.textAlign = options?.align ?? 'left';
  ctx.textBaseline = options?.baseline ?? 'alphabetic';
  ctx.fillText(text, x, y, maxWidth);
  ctx.restore();
  return size;
}

/**
 * Balanced 2-line split helper supporting both spaces and hyphens
 * (e.g. "ЛОКОМОТИВ-КРАСНОЯРСК" -> ["ЛОКОМОТИВ-", "КРАСНОЯРСК"]).
 */
export function splitTeamNameBalanced(text: string): [string, string] | null {
  const upper = text.toUpperCase().trim();
  if (!upper) return null;

  const spaceWords = upper.split(/\s+/).filter(Boolean);
  if (spaceWords.length >= 2) {
    let bestSplit = 1;
    let bestDiff = Infinity;
    for (let i = 1; i < spaceWords.length; i++) {
      const l1 = spaceWords.slice(0, i).join(' ');
      const l2 = spaceWords.slice(i).join(' ');
      const diff = Math.abs(l1.length - l2.length);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestSplit = i;
      }
    }
    return [spaceWords.slice(0, bestSplit).join(' '), spaceWords.slice(bestSplit).join(' ')];
  }

  if (upper.includes('-')) {
    const parts = upper.split('-').filter(Boolean);
    if (parts.length >= 2) {
      let bestSplit = 1;
      let bestDiff = Infinity;
      for (let i = 1; i < parts.length; i++) {
        const l1 = `${parts.slice(0, i).join('-')}-`;
        const l2 = parts.slice(i).join('-');
        const diff = Math.abs(l1.length - l2.length);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestSplit = i;
        }
      }
      return [`${parts.slice(0, bestSplit).join('-')}-`, parts.slice(bestSplit).join('-')];
    }
  }

  return null;
}

/**
 * Smart 1-or-2 line team name drawer so long or hyphenated club names stay legible on mobile VK feeds.
 */
function drawTeamNameLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  maxWidth: number,
  baseSize: number,
  minSingleLineSize: number,
  color: string,
  shadow = true
): void {
  const upper = text.toUpperCase().trim();
  ctx.font = `800 ${minSingleLineSize}px ${DISPLAY_FONT}`;
  const split = splitTeamNameBalanced(upper);

  if (ctx.measureText(upper).width <= maxWidth || !split) {
    drawFittedText(ctx, upper, cx, y, maxWidth, baseSize, Math.max(14, minSingleLineSize - 2), color, {
      align: 'center',
      weight: 800,
      family: DISPLAY_FONT,
      shadow,
    });
    return;
  }

  const [line1, line2] = split;
  const size = Math.min(
    fitText(ctx, line1, maxWidth, baseSize - 3, 14, 800, DISPLAY_FONT),
    fitText(ctx, line2, maxWidth, baseSize - 3, 14, 800, DISPLAY_FONT)
  );
  const lineGap = size * 1.18;

  ctx.save();
  if (shadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.62)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 4;
  }
  ctx.font = `800 ${size}px ${DISPLAY_FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(line1, cx, y - lineGap * 0.28, maxWidth);
  ctx.fillText(line2, cx, y + lineGap * 0.72, maxWidth);
  ctx.restore();
}

function drawTrackedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  tracking: number,
  color: string,
  weight: number | string = 700,
  family: string = DISPLAY_FONT
): void {
  const chars = Array.from(text);
  if (chars.length === 0) return;

  let size = fontSize;
  let track = tracking;
  const measureTotal = () => {
    ctx.font = `${weight} ${size}px ${family}`;
    let total = 0;
    for (let i = 0; i < chars.length; i++) {
      total += ctx.measureText(chars[i]).width;
      if (i < chars.length - 1) total += track;
    }
    return total;
  };

  let totalW = measureTotal();
  while (totalW > maxWidth && size > 11) {
    size -= 1;
    track = Math.max(1, track * 0.92);
    totalW = measureTotal();
  }

  ctx.save();
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  let cursor = cx - totalW / 2;
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], cursor, y);
    cursor += ctx.measureText(chars[i]).width + track;
  }
  ctx.restore();
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
  font: string,
  color: string,
  align: CanvasTextAlign = 'left'
): number {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';

  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  lines.forEach((line, idx) => {
    ctx.fillText(line, x, y + idx * lineHeight, maxWidth);
  });
  return lines.length * lineHeight;
}

function drawCroppedImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
  h: number,
  scale = 1,
  offsetX = 0,
  offsetY = 0,
  options?: {
    mode?: 'contain' | 'cover';
    radius?: number;
    circle?: boolean;
    shield?: boolean;
    bottomFadeColor?: string;
    opacity?: number;
    studioShadow?: boolean;
    rimGlowColor?: string;
  }
): void {
  if (!img || !img.naturalWidth || !img.naturalHeight) return;

  ctx.save();
  if (options?.circle) {
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
    ctx.clip();
  } else if (options?.shield) {
    drawShieldPath(ctx, x, y, w, h);
    ctx.clip();
  } else if (options?.radius && options.radius > 0) {
    roundRectPath(ctx, x, y, w, h, options.radius);
    ctx.clip();
  } else {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
  }

  if (options?.opacity !== undefined) {
    ctx.globalAlpha = options.opacity;
  }

  const fitMode = options?.mode ?? 'contain';
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const boxRatio = w / h;

  let drawW = w;
  let drawH = h;
  if (fitMode === 'contain') {
    if (imgRatio > boxRatio) {
      drawW = w;
      drawH = w / imgRatio;
    } else {
      drawH = h;
      drawW = h * imgRatio;
    }
  } else {
    if (imgRatio > boxRatio) {
      drawH = h;
      drawW = h * imgRatio;
    } else {
      drawW = w;
      drawH = w / imgRatio;
    }
  }

  const safeScale = Math.max(0.4, Math.min(3, scale || 1));
  drawW *= safeScale;
  drawH *= safeScale;

  const dx = x + (w - drawW) / 2 + ((offsetX || 0) / 100) * w * 0.5;
  const dy = y + (h - drawH) / 2 + ((offsetY || 0) / 100) * h * 0.5;

  // Rim glow behind cutout portrait for pro-league editorial depth
  if (options?.rimGlowColor) {
    const rim = ctx.createRadialGradient(
      x + w * 0.5,
      y + h * 0.44,
      w * 0.08,
      x + w * 0.5,
      y + h * 0.44,
      Math.max(w, h) * 0.56
    );
    rim.addColorStop(0, options.rimGlowColor);
    rim.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rim;
    ctx.fillRect(x, y, w, h);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (options?.studioShadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.72)';
    ctx.shadowBlur = 32;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 14;
  }
  ctx.drawImage(img, dx, dy, drawW, drawH);
  ctx.shadowColor = 'transparent';

  if (options?.bottomFadeColor) {
    const fadeGrad = ctx.createLinearGradient(0, y + h * 0.54, 0, y + h);
    fadeGrad.addColorStop(0, rgba(options.bottomFadeColor, 0));
    fadeGrad.addColorStop(1, rgba(options.bottomFadeColor, 0.96));
    ctx.fillStyle = fadeGrad;
    ctx.fillRect(x, y + h * 0.52, w, h * 0.5);
  }

  ctx.restore();
}

function drawMaskedLogo(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  size: number,
  scale: number,
  offsetX: number,
  offsetY: number,
  mask: LogoMaskMode | undefined,
  theme: BroadcastThemePalette,
  fallbackName: string,
  fallbackPrimary: string,
  fallbackAccent: string,
  rimWidth = 2.2
): void {
  const cx = x + size / 2;
  const cy = y + size / 2;

  if (!img) {
    drawCrestFallback(ctx, fallbackName, cx, cy, size * 0.9, fallbackPrimary, fallbackAccent);
    return;
  }

  const effectiveMask: LogoMaskMode = mask || 'none';

  if (effectiveMask !== 'none') {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.60)';
    ctx.shadowBlur = Math.max(12, size * 0.16);
    ctx.shadowOffsetY = Math.max(4, size * 0.05);
    ctx.fillStyle = '#0D0E12';
    if (effectiveMask === 'circle') {
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2 - 1, 0, Math.PI * 2);
      ctx.fill();
    } else {
      drawShieldPath(ctx, x, y, size, size);
      ctx.fill();
    }
    ctx.restore();
  }

  drawCroppedImage(ctx, img, x, y, size, size, scale, offsetX, offsetY, {
    mode: 'contain',
    circle: effectiveMask === 'circle',
    shield: effectiveMask === 'shield',
  });

  if (effectiveMask !== 'none' && rimWidth > 0) {
    ctx.save();
    const goldStroke = createGoldGradient(ctx, x, y, x + size, y + size, theme);
    ctx.strokeStyle = goldStroke;
    ctx.lineWidth = rimWidth;
    if (effectiveMask === 'circle') {
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2 - rimWidth / 2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      drawShieldPath(ctx, x, y, size, size);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawCrestFallback(
  ctx: CanvasRenderingContext2D,
  label: string,
  cx: number,
  cy: number,
  size: number,
  bgColor: string,
  accentColor: string
): void {
  const half = size / 2;
  ctx.save();
  drawShieldPath(ctx, cx - half, cy - half, size, size);
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.lineWidth = Math.max(3, size * 0.032);
  ctx.strokeStyle = accentColor;
  ctx.stroke();

  const initials =
    label
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'ФК';

  drawFittedText(ctx, initials, cx, cy + size * 0.12, size * 0.62, size * 0.32, 16, '#FFFFFF', {
    align: 'center',
    weight: 900,
    family: DISPLAY_FONT,
  });
  ctx.restore();
}

function resolveBgUrl(draft: PosterDraft): string {
  if (draft.bgPreset === 'custom') return draft.bgCustomUrl || '';
  const found = POSTER_BG_PRESETS.find((p) => p.id === draft.bgPreset);
  return found?.url || '';
}

async function drawBroadcastBackdrop(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  theme: BroadcastThemePalette,
  draft: PosterDraft,
  customPhotoOverride?: { url: string; scale?: number; offsetX?: number; offsetY?: number },
  skipFrame = false,
  dimOverride?: number
): Promise<void> {
  // 1. Base gradient
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, theme.bgTop);
  grad.addColorStop(0.5, theme.bgMid);
  grad.addColorStop(1, theme.bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 2. Photo backdrop if selected
  const bgUrl = customPhotoOverride?.url || resolveBgUrl(draft);
  const bgImg = bgUrl ? await loadImage(bgUrl) : null;

  if (bgImg) {
    drawCroppedImage(
      ctx,
      bgImg,
      0,
      0,
      W,
      H,
      customPhotoOverride?.scale ?? 1.02,
      customPhotoOverride?.offsetX ?? 0,
      customPhotoOverride?.offsetY ?? 0,
      { mode: 'cover' }
    );

    const dim = dimOverride ?? Math.max(0.2, Math.min(0.92, draft.bgOverlayOpacity ?? 0.56));
    if (dim > 0) {
      ctx.fillStyle = rgba(theme.scrimBase, theme.isLight ? Math.min(0.9, dim + 0.2) : dim * 0.72);
      ctx.fillRect(0, 0, W, H);
    }

    // Top contrast scrim
    const topScrim = ctx.createLinearGradient(0, 0, 0, H * 0.32);
    topScrim.addColorStop(0, rgba(theme.scrimBase, theme.isLight ? 0.9 : 0.84));
    topScrim.addColorStop(0.65, rgba(theme.scrimBase, theme.isLight ? 0.42 : 0.30));
    topScrim.addColorStop(1, rgba(theme.scrimBase, 0));
    ctx.fillStyle = topScrim;
    ctx.fillRect(0, 0, W, H * 0.34);

    // Bottom grounded scrim
    const botScrim = ctx.createLinearGradient(0, H * 0.54, 0, H);
    botScrim.addColorStop(0, rgba(theme.scrimBase, 0));
    botScrim.addColorStop(0.55, rgba(theme.scrimBase, theme.isLight ? 0.65 : 0.62));
    botScrim.addColorStop(1, rgba(theme.scrimBase, theme.isLight ? 0.94 : 0.95));
    ctx.fillStyle = botScrim;
    ctx.fillRect(0, H * 0.52, W, H * 0.48);
  }

  // 3. Subtle club-color floodlight atmosphere
  const bloom1 = ctx.createRadialGradient(W * 0.16, H * 0.14, 10, W * 0.16, H * 0.14, W * 0.72);
  bloom1.addColorStop(0, bgImg ? rgba(theme.primary, theme.isLight ? 0.08 : 0.20) : theme.glowPrimary);
  bloom1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bloom1;
  ctx.fillRect(0, 0, W, H);

  const bloom2 = ctx.createRadialGradient(W * 0.86, H * 0.82, 10, W * 0.86, H * 0.82, W * 0.62);
  bloom2.addColorStop(0, bgImg ? rgba(theme.accent, theme.isLight ? 0.06 : 0.14) : theme.glowAccent);
  bloom2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bloom2;
  ctx.fillRect(0, 0, W, H);

  // 4. Architectural lines + delicate film grain
  ctx.save();
  ctx.strokeStyle = theme.lineColor;
  ctx.lineWidth = 1.5;

  if (!bgImg) {
    for (let i = -1; i < 6; i++) {
      const startX = i * 260;
      ctx.beginPath();
      ctx.moveTo(startX, 0);
      ctx.lineTo(startX + H * 0.36, H);
      ctx.stroke();
    }
  }
  ctx.restore();

  drawFilmGrain(ctx, W, H, theme.isLight ? 0.05 : 0.085);

  // 5. Metallic broadcast outer frame & champagne L-brackets
  if (!skipFrame) {
    ctx.save();
    ctx.strokeStyle = theme.isLight ? 'rgba(22, 24, 28, 0.14)' : rgba(theme.goldMid, 0.25);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(28, 28, W - 56, H - 56);

    const bracketLen = 34;
    ctx.strokeStyle = createGoldGradient(ctx, 28, 28, W - 28, H - 28, theme);
    ctx.lineWidth = 3;
    const corners = [
      [28, 28, 1, 1],
      [W - 28, 28, -1, 1],
      [28, H - 28, 1, -1],
      [W - 28, H - 28, -1, -1],
    ];
    for (const [cx, cy, dx, dy] of corners) {
      ctx.beginPath();
      ctx.moveTo(cx + dx * bracketLen, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + dy * bracketLen);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawBroadcastHeader(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  club: ClubProfile,
  theme: BroadcastThemePalette,
  clubLogoSpec: ActiveClubLogoSpec,
  rightLabel: string
): number {
  const m = getSafeMargins(W, H);
  const topY = m.topY;
  const padX = m.padX;

  drawMaskedLogo(
    ctx,
    clubLogoSpec.img,
    padX,
    topY - 8,
    70,
    clubLogoSpec.scale,
    clubLogoSpec.offsetX,
    clubLogoSpec.offsetY,
    clubLogoSpec.mask,
    theme,
    club.shortName || club.name,
    club.primaryColor,
    club.accentColor,
    1.8
  );

  drawFittedText(ctx, club.name.toUpperCase(), padX + 86, topY + 23, W * 0.44, 24, 16, theme.textPrimary, {
    weight: 800,
    family: DISPLAY_FONT,
    shadow: !theme.isLight,
  });
  drawFittedText(
    ctx,
    club.city ? `${club.city.toUpperCase()}  ·  ФУТЗАЛ 5×5` : 'ФУТЗАЛ 5×5',
    padX + 86,
    topY + 49,
    W * 0.44,
    15,
    12,
    theme.textMuted,
    { weight: 600, family: BODY_FONT }
  );

  if (rightLabel) {
    const tagW = Math.min(W * 0.42, Math.max(210, rightLabel.length * 12.5 + 48));
    fillBroadcastPanel(
      ctx,
      W - padX - tagW,
      topY - 2,
      tagW,
      54,
      10,
      theme.cardBg,
      theme.cardBorder,
      1.5
    );
    drawFittedText(
      ctx,
      rightLabel.toUpperCase(),
      W - padX - tagW / 2,
      topY + 32,
      tagW - 28,
      16,
      12,
      theme.textPrimary,
      { align: 'center', weight: 700, family: DISPLAY_FONT }
    );
  }

  const lineY = topY + 78;
  ctx.fillStyle = theme.primary;
  ctx.fillRect(padX, lineY, 120, 3);
  ctx.fillStyle = createGoldGradient(ctx, padX + 120, lineY, W - padX, lineY, theme);
  ctx.fillRect(padX + 120, lineY, W - padX * 2 - 120, 1.5);

  return lineY + 28;
}

function drawBroadcastFooter(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  club: ClubProfile,
  theme: BroadcastThemePalette,
  transparent = false
): void {
  const m = getSafeMargins(W, H);
  const footerH = m.footerH;
  const footerY = m.footerTop;
  const sideInset = m.isStory ? 44 : 29;
  const barW = W - sideInset * 2;

  ctx.save();
  if (!transparent) {
    if (m.isStory) {
      fillBroadcastPanel(ctx, sideInset, footerY, barW, footerH, 14, theme.footerBg, theme.cardBorder, 1.2, false);
    } else {
      ctx.fillStyle = theme.footerBg;
      ctx.fillRect(sideInset, footerY, barW, footerH);
    }

    ctx.fillStyle = theme.primary;
    ctx.fillRect(sideInset + (m.isStory ? 12 : 0), footerY, 140, 2.5);
    ctx.fillStyle = createGoldGradient(ctx, sideInset + 140, footerY, W - sideInset, footerY, theme);
    ctx.fillRect(sideInset + 140 + (m.isStory ? 12 : 0), footerY, barW - 140 - (m.isStory ? 24 : 0), 1.5);
  }

  const vkText = (club.vkLink || 'vk.com/fc_fortuna_shush').trim();
  const leftX = m.padX;

  fillBroadcastPanel(ctx, leftX, footerY + 18, 44, 34, 8, '#0077FF', undefined, 0, false);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 17px ${BODY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VK', leftX + 22, footerY + 36);

  drawFittedText(ctx, vkText, leftX + 58, footerY + 43, W * 0.44, 21, 14, '#FFFFFF', {
    weight: 700,
    family: BODY_FONT,
    align: 'left',
    shadow: transparent,
  });

  const rightMeta = `${club.name.toUpperCase()}${club.city ? `  ·  ${club.city.toUpperCase()}` : ''}`;
  drawFittedText(ctx, rightMeta, W - m.padX, footerY + 42, W * 0.4, 15, 12, 'rgba(235, 232, 226, 0.84)', {
    weight: 700,
    family: DISPLAY_FONT,
    align: 'right',
    shadow: transparent,
  });
  ctx.restore();
}

function drawTeamCrestBlock(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement | null,
  logoMask: LogoMaskMode | undefined,
  name: string,
  cx: number,
  cy: number,
  boxSize: number,
  scale: number,
  offsetX: number,
  offsetY: number,
  theme: BroadcastThemePalette,
  fallbackPrimary: string,
  fallbackAccent: string,
  maxTextWidth: number
): void {
  ctx.save();
  const halo = ctx.createRadialGradient(cx, cy, 8, cx, cy, boxSize * 0.72);
  halo.addColorStop(0, theme.isLight ? 'rgba(22,24,28,0.06)' : 'rgba(255,255,255,0.11)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, boxSize * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  drawMaskedLogo(
    ctx,
    logo,
    cx - boxSize / 2,
    cy - boxSize / 2,
    boxSize,
    scale,
    offsetX,
    offsetY,
    logoMask,
    theme,
    name,
    fallbackPrimary,
    fallbackAccent,
    2.4
  );

  drawTeamNameLines(
    ctx,
    name,
    cx,
    cy + boxSize / 2 + 44,
    maxTextWidth,
    26,
    18,
    theme.textPrimary,
    !theme.isLight
  );
}

function drawVkSafeZoneGuides(ctx: CanvasRenderingContext2D, W: number, H: number, format: PosterFormat): void {
  if (format !== '9:16') return;
  ctx.save();
  // Top VK Stories UI zone (0..185px)
  ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
  ctx.fillRect(0, 0, W, 185);
  ctx.strokeStyle = 'rgba(248, 113, 113, 0.85)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(0, 185);
  ctx.lineTo(W, 185);
  ctx.stroke();

  // Bottom VK Stories UI zone (H-200..H)
  ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
  ctx.fillRect(0, H - 200, W, 200);
  ctx.beginPath();
  ctx.moveTo(0, H - 200);
  ctx.lineTo(W, H - 200);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.font = `700 18px ${BODY_FONT}`;
  ctx.fillStyle = '#FCA5A5';
  ctx.textAlign = 'center';
  ctx.fillText('ЗОНА ИНТЕРФЕЙСА ВК СТОРИС (АВАТАР И НАЗВАНИЕ ГРУППЫ)', W / 2, 104);
  ctx.fillText('ЗОНА ИНТЕРФЕЙСА ВК СТОРИС (ПОЛЕ ОТВЕТА И РЕАКЦИИ)', W / 2, H - 96);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// HELPER: Resolve match teams & logos
// ---------------------------------------------------------------------------
async function resolveMatchRenderContext(
  db: ClubDatabase,
  draft: PosterDraft,
  clubLogoSpec: ActiveClubLogoSpec,
  preferFinished: boolean
) {
  const match: MatchItem | undefined =
    db.matches.find((m) => m.id === draft.matchId) ||
    db.matches.find((m) => (preferFinished ? m.status === 'finished' : m.status === 'scheduled')) ||
    db.matches[0];
  const opp: OpponentTeam | undefined = match
    ? db.opponents.find((o) => o.id === match.opponentId)
    : db.opponents[0];
  const season = match ? db.seasons.find((s) => s.id === match.seasonTagId) : db.seasons[0];
  const oppLogo = await loadImage(opp?.logoUrl);

  const isHome = match ? match.isHome : true;
  const score = match ? getMatchScore(match) : { our: 0, opponent: 0 };

  return {
    match,
    opp,
    season,
    isHome,
    score,
    leftScore: isHome ? score.our : score.opponent,
    rightScore: isHome ? score.opponent : score.our,
    leftName: isHome ? db.club.name : opp?.name || 'Соперник',
    rightName: isHome ? opp?.name || 'Соперник' : db.club.name,
    leftShort: isHome ? db.club.shortName || db.club.name : opp?.shortName || opp?.name || 'Соперник',
    rightShort: isHome ? opp?.shortName || opp?.name || 'Соперник' : db.club.shortName || db.club.name,
    leftLogo: isHome ? clubLogoSpec.img : oppLogo,
    rightLogo: isHome ? oppLogo : clubLogoSpec.img,
    leftMask: isHome ? clubLogoSpec.mask : opp?.logoMask,
    rightMask: isHome ? opp?.logoMask : clubLogoSpec.mask,
    leftScale: isHome ? clubLogoSpec.scale : opp?.logoScale ?? 1,
    rightScale: isHome ? opp?.logoScale ?? 1 : clubLogoSpec.scale,
    leftOx: isHome ? clubLogoSpec.offsetX : opp?.logoOffsetX ?? 0,
    rightOx: isHome ? opp?.logoOffsetX ?? 0 : clubLogoSpec.offsetX,
    leftOy: isHome ? clubLogoSpec.offsetY : opp?.logoOffsetY ?? 0,
    rightOy: isHome ? opp?.logoOffsetY ?? 0 : clubLogoSpec.offsetY,
  };
}

// ---------------------------------------------------------------------------
// HELPER: Group goals & red cards (Match TV style: "ВОЛКОВ 7' 18'(П)" / "ГРОМОВ 34'(КК)")
// ---------------------------------------------------------------------------
export interface MatchTvEventLine {
  name: string;
  minutes: string;
  isRedCard: boolean;
  fullLine: string;
}

export function groupOurMatchTvEvents(
  match: MatchItem | undefined,
  playerMap: Map<string, Player>
): MatchTvEventLine[] {
  if (!match) return [];
  const ourGoals = (match.events || [])
    .filter((e) => e.type === 'goal_our' || e.type === 'own_goal_opp')
    .sort((a, b) => a.minute - b.minute);

  const grouped = new Map<string, { label: string; minutes: string[] }>();

  for (const ev of ourGoals) {
    if (ev.type === 'own_goal_opp') {
      const key = '__og__';
      const entry = grouped.get(key) || { label: 'АВТОГОЛ', minutes: [] };
      entry.minutes.push(`${ev.minute}'(АГ)`);
      grouped.set(key, entry);
    } else {
      const scorer = ev.playerId ? playerMap.get(ev.playerId) : undefined;
      const key = scorer?.id || ev.playerId || `__unknown_${ev.id}`;
      const name = (scorer ? scorer.shortName || scorer.fullName : 'ИГРОК').toUpperCase();
      const entry = grouped.get(key) || { label: name, minutes: [] };
      entry.minutes.push(`${ev.minute}'${ev.isPenalty ? '(П)' : ''}`);
      grouped.set(key, entry);
    }
  }

  const lines: MatchTvEventLine[] = Array.from(grouped.values()).map((g) => {
    const minutes = g.minutes.join(' ');
    return {
      name: g.label,
      minutes,
      isRedCard: false,
      fullLine: `${g.label} ${minutes}`,
    };
  });

  // Append our club's red cards in Match TV style ("ЩЕНСНЫЙ 56'(КК)")
  const redCards = (match.events || [])
    .filter((e) => e.type === 'red')
    .sort((a, b) => a.minute - b.minute);

  for (const rc of redCards) {
    const player = rc.playerId ? playerMap.get(rc.playerId) : undefined;
    const name = (player ? player.shortName || player.fullName : 'ИГРОК').toUpperCase();
    const minutes = `${rc.minute}'(КК)`;
    lines.push({
      name,
      minutes,
      isRedCard: true,
      fullLine: `${name} ${minutes}`,
    });
  }

  return lines;
}

// ---------------------------------------------------------------------------
// HELPER: Overflow-proof lineup layout metrics (handles up to 18 players in 1:1 / 4:5 / 9:16)
// ---------------------------------------------------------------------------
export interface LineupLayoutMetrics {
  gap: number;
  starterCols: number;
  cols: number;
  rowH: number;
  starterHeaderOffset: number;
  benchGapTop: number;
  benchHeaderOffset: number;
  lastCardBottomOffset: number;
}

export function computeLineupLayoutMetrics(
  availH: number,
  totalPlayers: number,
  splitStarting: boolean,
  starterCount: number,
  isStory: boolean
): LineupLayoutMetrics {
  const gap = totalPlayers > 12 ? 8 : totalPlayers > 9 ? 10 : 14;

  if (splitStarting) {
    const benchCount = Math.max(0, totalPlayers - starterCount);
    const starterCols = isStory && totalPlayers <= 10 ? 1 : 2;
    const starterRows = Math.ceil(starterCount / starterCols);
    const benchRows = benchCount > 0 ? Math.ceil(benchCount / 2) : 0;
    const starterHeaderOffset = totalPlayers > 12 ? 26 : 34;
    const benchGapTop = benchRows > 0 ? (totalPlayers > 12 ? 14 : 22) : 0;
    const benchHeaderOffset = benchRows > 0 ? (totalPlayers > 12 ? 14 : 18) : 0;
    const fixedOverhead =
      starterHeaderOffset +
      benchGapTop +
      benchHeaderOffset +
      Math.max(0, starterRows - 1) * gap +
      (benchRows > 0 ? gap + Math.max(0, benchRows - 1) * gap : 0);
    const totalRowCount = Math.max(1, starterRows + benchRows);
    const maxFittingRowH = Math.floor((availH - fixedOverhead) / totalRowCount);
    const rowH = Math.max(34, Math.min(94, maxFittingRowH));
    const starterBlockEnd = starterHeaderOffset + starterRows * rowH + Math.max(0, starterRows - 1) * gap;
    const lastCardBottomOffset =
      benchRows > 0
        ? starterBlockEnd +
          gap +
          benchGapTop +
          benchHeaderOffset +
          benchRows * rowH +
          Math.max(0, benchRows - 1) * gap
        : starterBlockEnd;

    return {
      gap,
      starterCols,
      cols: 2,
      rowH,
      starterHeaderOffset,
      benchGapTop,
      benchHeaderOffset,
      lastCardBottomOffset,
    };
  }

  const useSingleCol = isStory && totalPlayers <= 10;
  const cols = useSingleCol ? 1 : 2;
  const rows = Math.ceil(totalPlayers / cols);
  const maxFittingRowH = Math.floor((availH - Math.max(0, rows - 1) * gap) / Math.max(1, rows));
  const rowH = Math.max(36, Math.min(100, maxFittingRowH));
  const lastCardBottomOffset = rows * rowH + Math.max(0, rows - 1) * gap;

  return {
    gap,
    starterCols: cols,
    cols,
    rowH,
    starterHeaderOffset: 0,
    benchGapTop: 0,
    benchHeaderOffset: 0,
    lastCardBottomOffset,
  };
}

// ---------------------------------------------------------------------------
// HELPER: Draw Match TV Top Corner Badges (Tournament top-left, Club TV tag top-right)
// ---------------------------------------------------------------------------
function drawMatchTvTopCorners(
  ctx: CanvasRenderingContext2D,
  W: number,
  topY: number,
  padX: number,
  seasonName: string,
  roundLabel: string,
  club: ClubProfile,
  clubLogoSpec: ActiveClubLogoSpec,
  theme: BroadcastThemePalette,
  rightTagText: string
): void {
  // Top-left: Small emblem + 2-line uppercase tournament & round (Match TV style)
  drawMaskedLogo(
    ctx,
    clubLogoSpec.img,
    padX,
    topY,
    56,
    clubLogoSpec.scale,
    clubLogoSpec.offsetX,
    clubLogoSpec.offsetY,
    clubLogoSpec.mask,
    theme,
    club.shortName || club.name,
    club.primaryColor,
    club.accentColor,
    1.6
  );

  const line1 = (seasonName || club.name).toUpperCase();
  const line2 = (roundLabel || (club.city ? `${club.city} · ФУТЗАЛ 5×5` : 'ФУТЗАЛ 5×5')).toUpperCase();

  drawFittedText(ctx, line1, padX + 70, topY + 23, W * 0.48, 20, 14, theme.goldLight, {
    weight: 700,
    family: DISPLAY_FONT,
    shadow: true,
  });
  drawFittedText(ctx, line2, padX + 70, topY + 48, W * 0.48, 18, 13, 'rgba(240, 236, 228, 0.90)', {
    weight: 600,
    family: DISPLAY_FONT,
    shadow: true,
  });

  // Top-right: Authentic dark TV broadcast tag with champagne typography
  const tagText = (rightTagText || club.shortName || 'МАТЧ!').toUpperCase();
  ctx.font = `900 20px ${DISPLAY_FONT}`;
  const tagW = Math.min(240, Math.max(154, ctx.measureText(tagText).width + 44));
  const tagX = W - padX - tagW;

  fillBroadcastPanel(
    ctx,
    tagX,
    topY + 2,
    tagW,
    52,
    6,
    'rgba(10, 11, 14, 0.92)',
    rgba(theme.goldMid, 0.45),
    1.4,
    false
  );
  drawFittedText(ctx, tagText, tagX + tagW / 2, topY + 35, tagW - 24, 20, 13, theme.goldMid, {
    align: 'center',
    weight: 900,
    family: DISPLAY_FONT,
  });
}

// ---------------------------------------------------------------------------
// 1. MATCHDAY TEMPLATE (3 Selectable Pro-League Styles: Match TV / Cinematic / Broadcast)
// ---------------------------------------------------------------------------
async function renderMatchday(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  db: ClubDatabase,
  draft: PosterDraft,
  theme: BroadcastThemePalette,
  clubLogoSpec: ActiveClubLogoSpec
): Promise<void> {
  const m = getSafeMargins(W, H);
  const mc = await resolveMatchRenderContext(db, draft, clubLogoSpec, false);
  const featuredPlayer = draft.matchdayPlayerId
    ? db.players.find((p) => p.id === draft.matchdayPlayerId)
    : undefined;
  const playerImg = await loadImage(featuredPlayer?.photoUrl);

  const headerTag = [mc.season?.name, mc.match?.roundLabel].filter(Boolean).join(' · ') || 'МАТЧ ДНЯ';
  const statusLabel = mc.match ? (mc.match.isHome ? 'ДОМАШНИЙ МАТЧ' : 'ВЫЕЗДНОЙ МАТЧ') : 'МАТЧ ДНЯ';
  const kicker = (draft.matchdayKicker || statusLabel).toUpperCase();
  const dateText = mc.match ? formatRuDate(mc.match.date) : 'СКОРО';
  const timeText = mc.match?.time || '19:00';
  const venueText = mc.match?.venue || db.club.defaultVenue || 'ФСЦ «Шушенское»';

  const layout = draft.layoutStyle || 'matchtv';
  const cardW = W - m.padX * 2;

  // --- STYLE A: MATCH TV EDITORIAL PHOTO + GOLD-FRAMED LOWER SCOREBOARD ---
  if (layout === 'matchtv') {
    const boxH = m.isSquare ? 228 : m.isStory ? 268 : 246;
    const boxY = m.footerTop - boxH - 16;

    // Smooth dark dissolve behind the lower scoreboard and meta row
    const fadeTop = boxY - (m.isSquare ? 150 : 190);
    const fadeGrad = ctx.createLinearGradient(0, fadeTop, 0, m.footerTop);
    fadeGrad.addColorStop(0, 'rgba(10, 11, 14, 0)');
    fadeGrad.addColorStop(0.45, 'rgba(10, 11, 14, 0.76)');
    fadeGrad.addColorStop(1, 'rgba(10, 11, 14, 0.96)');
    ctx.fillStyle = fadeGrad;
    ctx.fillRect(0, fadeTop, W, H - fadeTop);

    // Optional featured player cutout in the open upper photo stage
    if (featuredPlayer && playerImg) {
      const heroTop = m.topY + 64;
      const heroH = boxY - heroTop + 18;
      drawCroppedImage(
        ctx,
        playerImg,
        W * 0.18,
        heroTop,
        W * 0.64,
        heroH,
        featuredPlayer.photoScale,
        featuredPlayer.photoOffsetX,
        featuredPlayer.photoOffsetY,
        {
          mode: 'contain',
          bottomFadeColor: '#0A0B0E',
          studioShadow: true,
          rimGlowColor: rgba(theme.primary, 0.28),
        }
      );
    }

    // Top corners: tournament info top-left, kicker badge top-right
    drawMatchTvTopCorners(
      ctx,
      W,
      m.topY,
      m.padX,
      mc.season?.name || db.club.name,
      mc.match?.roundLabel || 'ДЕНЬ МАТЧА',
      db.club,
      clubLogoSpec,
      theme,
      kicker
    );

    // Above the gold frame: Date/Time on left, Venue on right
    const metaY = boxY - 18;
    drawFittedText(
      ctx,
      `${dateText.toUpperCase()}  ·  ${timeText}`,
      m.padX + 4,
      metaY,
      cardW * 0.48,
      22,
      15,
      '#FFFFFF',
      { align: 'left', weight: 800, family: DISPLAY_FONT, shadow: true }
    );
    drawFittedText(
      ctx,
      venueText.toUpperCase(),
      W - m.padX - 4,
      metaY,
      cardW * 0.48,
      20,
      14,
      theme.goldLight,
      { align: 'right', weight: 800, family: DISPLAY_FONT, shadow: true }
    );

    // Monolithic Match TV dark rectangular scoreboard with thin champagne gold border
    ctx.save();
    ctx.fillStyle = 'rgba(10, 12, 16, 0.88)';
    ctx.fillRect(m.padX, boxY, cardW, boxH);
    ctx.strokeStyle = theme.goldMid;
    ctx.lineWidth = 2;
    ctx.strokeRect(m.padX, boxY, cardW, boxH);
    ctx.restore();

    const crestS = m.isSquare ? 124 : 138;
    const crestCy = boxY + boxH * 0.43;
    const leftCx = m.padX + cardW * 0.19;
    const rightCx = m.padX + cardW * 0.81;

    drawMaskedLogo(
      ctx,
      mc.leftLogo,
      leftCx - crestS / 2,
      crestCy - crestS / 2,
      crestS,
      mc.leftScale,
      mc.leftOx,
      mc.leftOy,
      mc.leftMask,
      theme,
      mc.leftShort,
      db.club.primaryColor,
      db.club.accentColor,
      2.2
    );
    drawFittedText(
      ctx,
      mc.leftShort.toUpperCase(),
      leftCx,
      boxY + boxH - 22,
      cardW * 0.32,
      24,
      15,
      theme.goldMid,
      { align: 'center', weight: 800, family: DISPLAY_FONT }
    );

    // Center massive kickoff time or VS
    drawFittedText(
      ctx,
      timeText,
      W / 2,
      boxY + boxH * 0.56,
      cardW * 0.34,
      m.isSquare ? 88 : 102,
      54,
      '#FFFFFF',
      { align: 'center', weight: 900, family: DISPLAY_FONT, shadow: true }
    );
    drawFittedText(
      ctx,
      'НАЧАЛО МАТЧА',
      W / 2,
      boxY + boxH - 22,
      cardW * 0.32,
      15,
      12,
      'rgba(235, 232, 224, 0.78)',
      { align: 'center', weight: 700, family: DISPLAY_FONT }
    );

    drawMaskedLogo(
      ctx,
      mc.rightLogo,
      rightCx - crestS / 2,
      crestCy - crestS / 2,
      crestS,
      mc.rightScale,
      mc.rightOx,
      mc.rightOy,
      mc.rightMask,
      theme,
      mc.rightShort,
      '#334155',
      theme.accent,
      2.2
    );
    drawFittedText(
      ctx,
      mc.rightShort.toUpperCase(),
      rightCx,
      boxY + boxH - 22,
      cardW * 0.32,
      24,
      15,
      theme.goldMid,
      { align: 'center', weight: 800, family: DISPLAY_FONT }
    );

    drawBroadcastFooter(ctx, W, H, db.club, theme, true);
    return;
  }

  // --- STYLE B: CINEMATIC FULL-BLEED HUD ---
  if (layout === 'cinematic') {
    const bugW = 470;
    const bugH = 74;
    fillBroadcastPanel(
      ctx,
      m.padX,
      m.topY,
      bugW,
      bugH,
      14,
      'rgba(14,16,20,0.88)',
      createGoldGradient(ctx, m.padX, m.topY, m.padX + bugW, m.topY + bugH, theme),
      1.8
    );
    drawMaskedLogo(
      ctx,
      mc.leftLogo,
      m.padX + 14,
      m.topY + 11,
      52,
      mc.leftScale,
      mc.leftOx,
      mc.leftOy,
      mc.leftMask,
      theme,
      mc.leftShort,
      db.club.primaryColor,
      db.club.accentColor,
      1.5
    );
    drawMaskedLogo(
      ctx,
      mc.rightLogo,
      m.padX + bugW - 66,
      m.topY + 11,
      52,
      mc.rightScale,
      mc.rightOx,
      mc.rightOy,
      mc.rightMask,
      theme,
      mc.rightShort,
      '#334155',
      theme.accent,
      1.5
    );
    drawFittedText(
      ctx,
      `${mc.leftShort} — ${mc.rightShort}`.toUpperCase(),
      m.padX + bugW / 2,
      m.topY + 34,
      bugW - 160,
      17,
      12,
      '#FFFFFF',
      { align: 'center', weight: 800, family: DISPLAY_FONT }
    );
    drawFittedText(
      ctx,
      `${dateText} · ${timeText}`,
      m.padX + bugW / 2,
      m.topY + 58,
      bugW - 160,
      14,
      11,
      theme.goldLight,
      { align: 'center', weight: 700, family: BODY_FONT }
    );

    // Bottom clean editorial typography over photo scrim (no duplicate team names)
    const baseY = m.footerTop - 32;
    drawFittedText(
      ctx,
      `${headerTag} · ${kicker}`.toUpperCase(),
      m.padX,
      baseY - 118,
      cardW,
      17,
      12,
      theme.goldLight,
      { weight: 800, family: DISPLAY_FONT, shadow: true }
    );
    drawFittedText(
      ctx,
      'ДЕНЬ МАТЧА',
      m.padX,
      baseY - 52,
      cardW,
      m.isSquare ? 48 : 56,
      28,
      '#FFFFFF',
      { weight: 900, family: DISPLAY_FONT, shadow: true }
    );
    drawFittedText(
      ctx,
      `${dateText}  ·  НАЧАЛО ${timeText}  ·  ${venueText}`.toUpperCase(),
      m.padX,
      baseY - 8,
      cardW,
      20,
      14,
      'rgba(245,243,238,0.92)',
      { weight: 700, family: BODY_FONT, shadow: true }
    );

    drawBroadcastFooter(ctx, W, H, db.club, theme, true);
    return;
  }

  // --- STYLE C: CLASSIC PRO-LEAGUE BROADCAST ---
  if (featuredPlayer && playerImg) {
    const heroTop = m.topY + 95;
    const heroH = (m.footerTop - heroTop) * 0.66;
    drawCroppedImage(
      ctx,
      playerImg,
      W * 0.14,
      heroTop,
      W * 0.72,
      heroH,
      featuredPlayer.photoScale,
      featuredPlayer.photoOffsetX,
      featuredPlayer.photoOffsetY,
      {
        mode: 'contain',
        opacity: theme.isLight ? 0.92 : 0.95,
        bottomFadeColor: theme.scrimBase,
        studioShadow: true,
        rimGlowColor: rgba(theme.primary, 0.25),
      }
    );
  }

  const startY = drawBroadcastHeader(ctx, W, H, db.club, theme, clubLogoSpec, headerTag);

  drawTrackedText(
    ctx,
    kicker,
    W / 2,
    startY + 24,
    W - 180,
    18,
    6,
    theme.isLight ? theme.primary : theme.goldLight,
    700,
    DISPLAY_FONT
  );

  ctx.fillStyle = createGoldGradient(ctx, W / 2 - 70, startY + 38, W / 2 + 70, startY + 38, theme);
  ctx.fillRect(W / 2 - 70, startY + 38, 140, 2.5);

  const titleY = startY + (m.isSquare ? 110 : 126);
  drawFittedText(
    ctx,
    'ДЕНЬ МАТЧА',
    W / 2,
    titleY,
    W - 120,
    m.isSquare ? 66 : 80,
    42,
    theme.textPrimary,
    {
      align: 'center',
      weight: 900,
      family: DISPLAY_FONT,
      shadow: !theme.isLight,
    }
  );

  const cardH = m.isSquare ? 326 : m.isStory ? 410 : 374;
  const infoH = m.isSquare ? 112 : 128;
  const infoY = m.footerTop - infoH - 22;
  const cardY = infoY - cardH - (m.isSquare ? 18 : 24);

  const goldBorder = createGoldGradient(ctx, m.padX, cardY, m.padX + cardW, cardY + cardH, theme);
  fillBroadcastPanel(ctx, m.padX, cardY, cardW, cardH, 22, theme.cardBgStrong, goldBorder, 1.8);

  ctx.fillStyle = theme.primary;
  ctx.fillRect(W / 2 - 90, cardY, 180, 4);

  const crestSize = m.isSquare ? 160 : 192;
  const crestY = cardY + cardH * 0.39;

  drawTeamCrestBlock(
    ctx,
    mc.leftLogo,
    mc.leftMask,
    mc.leftName,
    m.padX + cardW * 0.24,
    crestY,
    crestSize,
    mc.leftScale,
    mc.leftOx,
    mc.leftOy,
    theme,
    db.club.primaryColor,
    db.club.accentColor,
    cardW * 0.39
  );

  const vsCx = W / 2;
  const vsCy = crestY;
  ctx.save();
  ctx.translate(vsCx, vsCy);
  ctx.rotate(Math.PI / 4);
  fillBroadcastPanel(
    ctx,
    -38,
    -38,
    76,
    76,
    12,
    theme.primary,
    createGoldGradient(ctx, -38, -38, 38, 38, theme),
    2.5,
    false
  );
  ctx.restore();
  drawFittedText(ctx, 'VS', vsCx, vsCy + 12, 62, 30, 18, '#FFFFFF', {
    align: 'center',
    weight: 900,
    family: DISPLAY_FONT,
  });

  drawTeamCrestBlock(
    ctx,
    mc.rightLogo,
    mc.rightMask,
    mc.rightName,
    m.padX + cardW * 0.76,
    crestY,
    crestSize,
    mc.rightScale,
    mc.rightOx,
    mc.rightOy,
    theme,
    '#334155',
    theme.accent,
    cardW * 0.39
  );

  fillBroadcastPanel(ctx, m.padX, infoY, cardW, infoH, 18, theme.cardBgStrong, theme.cardBorder, 1.5);

  const colW = cardW / 3;
  const drawInfoCol = (idx: number, label: string, value: string) => {
    const cx = m.padX + colW * idx + colW / 2;
    if (idx > 0) {
      ctx.fillStyle = theme.cardBorder;
      ctx.fillRect(m.padX + colW * idx, infoY + 24, 1.5, infoH - 48);
    }
    drawFittedText(
      ctx,
      label,
      cx,
      infoY + 42,
      colW - 24,
      13,
      11,
      theme.isLight ? theme.textMuted : theme.goldLight,
      {
        align: 'center',
        weight: 700,
        family: BODY_FONT,
      }
    );
    drawFittedText(
      ctx,
      value,
      cx,
      infoY + (m.isSquare ? 82 : 88),
      colW - 26,
      23,
      15,
      theme.textPrimary,
      {
        align: 'center',
        weight: 800,
        family: DISPLAY_FONT,
      }
    );
  };

  drawInfoCol(0, 'ДАТА', dateText);
  drawInfoCol(1, 'НАЧАЛО', timeText);
  drawInfoCol(2, 'ПЛОЩАДКА', venueText);

  drawBroadcastFooter(ctx, W, H, db.club, theme);
}

// ---------------------------------------------------------------------------
// 2. LINEUP TEMPLATE (Заявка / Состав на матч)
// ---------------------------------------------------------------------------
async function renderLineup(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  db: ClubDatabase,
  draft: PosterDraft,
  theme: BroadcastThemePalette,
  clubLogoSpec: ActiveClubLogoSpec
): Promise<void> {
  const m = getSafeMargins(W, H);
  const mc = await resolveMatchRenderContext(db, draft, clubLogoSpec, false);

  const headerTag = [mc.season?.name, mc.match?.roundLabel].filter(Boolean).join(' · ') || 'ЗАЯВКА';
  const startY = drawBroadcastHeader(ctx, W, H, db.club, theme, clubLogoSpec, headerTag);

  const title = (draft.lineupTitle || 'ЗАЯВКА НА МАТЧ').toUpperCase();
  drawFittedText(ctx, title, m.padX, startY + 48, W - m.padX * 2, m.isSquare ? 44 : 52, 30, theme.textPrimary, {
    weight: 900,
    family: DISPLAY_FONT,
    shadow: !theme.isLight,
  });

  const stripY = startY + 68;
  const stripH = 84;
  fillBroadcastPanel(ctx, m.padX, stripY, W - m.padX * 2, stripH, 14, theme.cardBgStrong, theme.cardBorder, 1.5);

  drawMaskedLogo(ctx, clubLogoSpec.img, m.padX + 18, stripY + 12, 60, clubLogoSpec.scale, clubLogoSpec.offsetX, clubLogoSpec.offsetY, clubLogoSpec.mask, theme, db.club.shortName, db.club.primaryColor, db.club.accentColor, 1.5);

  const vsLabel = mc.opp
    ? `${db.club.shortName || db.club.name}  VS  ${mc.opp.shortName || mc.opp.name}`
    : db.club.name;
  drawFittedText(ctx, vsLabel.toUpperCase(), m.padX + 94, stripY + 41, W - 360, 22, 15, theme.textPrimary, {
    weight: 800,
    family: DISPLAY_FONT,
  });
  const metaLine = mc.match
    ? `${formatRuDate(mc.match.date)} · ${mc.match.time} · ${mc.match.venue}`
    : 'МИНИ-ФУТБОЛ 5×5';
  drawFittedText(ctx, metaLine, m.padX + 94, stripY + 67, W - 360, 16, 13, theme.textMuted, {
    weight: 600,
    family: BODY_FONT,
  });

  if (mc.opp) {
    drawMaskedLogo(ctx, mc.isHome ? mc.rightLogo : mc.leftLogo, W - m.padX - 78, stripY + 12, 60, mc.opp.logoScale ?? 1, mc.opp.logoOffsetX ?? 0, mc.opp.logoOffsetY ?? 0, mc.opp.logoMask, theme, mc.opp.shortName || mc.opp.name, '#334155', theme.accent, 1.5);
  }

  const selectedIds =
    draft.lineupSelectedIds.length > 0
      ? draft.lineupSelectedIds
      : mc.match?.lineupPlayerIds || db.players.filter((p) => p.isActive).map((p) => p.id);

  const selectedPlayers = db.players
    .filter((p) => selectedIds.includes(p.id))
    .sort((a, b) => {
      if (a.role === 'GK' && b.role !== 'GK') return -1;
      if (a.role !== 'GK' && b.role === 'GK') return 1;
      return a.number - b.number;
    });

  const playerImages = new Map<string, HTMLImageElement | null>();
  await Promise.all(selectedPlayers.map(async (p) => playerImages.set(p.id, await loadImage(p.photoUrl))));

  const listTop = stripY + stripH + 24;
  const listBottom = m.footerTop - 22;
  const availH = listBottom - listTop;

  const startingSet = new Set(mc.match?.startingFiveIds || []);
  const splitStarting =
    draft.lineupShowStartingFive &&
    startingSet.size > 0 &&
    selectedPlayers.some((p) => startingSet.has(p.id));

  const drawPlayerCard = (p: Player, x: number, y: number, w: number, h: number, highlight: boolean) => {
    fillBroadcastPanel(
      ctx,
      x,
      y,
      w,
      h,
      14,
      highlight ? theme.cardBgStrong : theme.cardBg,
      highlight ? createGoldGradient(ctx, x, y, x + w, y, theme) : theme.cardBorder,
      highlight ? 1.8 : 1.2
    );

    const numW = Math.min(76, h * 0.92);
    fillBroadcastPanel(ctx, x + 8, y + 8, numW, h - 16, 10, p.role === 'GK' ? theme.goldMid : theme.primary, undefined, 0, false);
    drawFittedText(ctx, String(p.number), x + 8 + numW / 2, y + h / 2 + 10, numW - 10, Math.min(30, h * 0.42), 16, p.role === 'GK' ? '#111215' : '#FFFFFF', {
      align: 'center',
      weight: 900,
      family: DISPLAY_FONT,
    });

    const img = playerImages.get(p.id) || null;
    let textLeft = x + 8 + numW + 16;
    if (img && h >= 64) {
      const avSize = h - 18;
      fillBroadcastPanel(ctx, textLeft, y + 9, avSize, avSize, avSize / 2, 'rgba(255,255,255,0.08)', undefined, 0, false);
      drawCroppedImage(ctx, img, textLeft, y + 9, avSize, avSize, p.photoScale, p.photoOffsetX, p.photoOffsetY, {
        circle: true,
        mode: 'cover',
      });
      textLeft += avSize + 14;
    }

    let rightLimit = x + w - 16;
    if (p.isCaptain) {
      const bw = 38;
      const bh = 28;
      fillBroadcastPanel(ctx, rightLimit - bw, y + h / 2 - bh / 2, bw, bh, 7, theme.goldMid, undefined, 0, false);
      drawFittedText(ctx, 'К', rightLimit - bw / 2, y + h / 2 + 7, 28, 16, 12, '#111215', {
        align: 'center',
        weight: 900,
        family: DISPLAY_FONT,
      });
      rightLimit -= bw + 8;
    }
    if (p.role === 'GK') {
      const bw = 50;
      const bh = 28;
      fillBroadcastPanel(ctx, rightLimit - bw, y + h / 2 - bh / 2, bw, bh, 7, rgba(theme.goldMid, 0.2), theme.goldMid, 1.4, false);
      drawFittedText(ctx, 'ВР', rightLimit - bw / 2, y + h / 2 + 6, 40, 14, 11, theme.isLight ? theme.textPrimary : theme.goldLight, {
        align: 'center',
        weight: 800,
        family: DISPLAY_FONT,
      });
      rightLimit -= bw + 8;
    }

    const nameMaxW = Math.max(100, rightLimit - textLeft - 8);
    drawFittedText(ctx, p.fullName.toUpperCase(), textLeft, y + h / 2 + 8, nameMaxW, Math.min(24, h * 0.35), 15, theme.textPrimary, {
      weight: 800,
      family: DISPLAY_FONT,
    });
  };

  if (selectedPlayers.length === 0) {
    fillBroadcastPanel(ctx, m.padX, listTop + 40, W - m.padX * 2, 180, 18, theme.cardBgStrong, theme.cardBorder, 1.5);
    drawFittedText(ctx, 'ВЫБЕРИТЕ ИГРОКОВ В РЕДАКТОРЕ СЛЕВА', W / 2, listTop + 140, W - 200, 24, 16, theme.textMuted, {
      align: 'center',
      weight: 700,
      family: DISPLAY_FONT,
    });
  } else if (splitStarting) {
    const starters = selectedPlayers.filter((p) => startingSet.has(p.id));
    const bench = selectedPlayers.filter((p) => !startingSet.has(p.id));
    const metrics = computeLineupLayoutMetrics(availH, selectedPlayers.length, true, starters.length, m.isStory);

    drawFittedText(
      ctx,
      'СТАРТОВАЯ ПЯТЁРКА',
      m.padX,
      listTop + (metrics.starterHeaderOffset - 12),
      W - m.padX * 2,
      selectedPlayers.length > 12 ? 15 : 17,
      12,
      theme.isLight ? theme.primary : theme.goldLight,
      {
        weight: 800,
        family: DISPLAY_FONT,
      }
    );

    const { gap, starterCols, rowH, starterHeaderOffset, benchGapTop, benchHeaderOffset } = metrics;
    const starterRows = Math.ceil(starters.length / starterCols);
    const starterCardW = (W - m.padX * 2 - gap * (starterCols - 1)) / starterCols;
    starters.forEach((p, idx) => {
      const col = idx % starterCols;
      const row = Math.floor(idx / starterCols);
      drawPlayerCard(
        p,
        m.padX + col * (starterCardW + gap),
        listTop + starterHeaderOffset + row * (rowH + gap),
        starterCardW,
        rowH,
        true
      );
    });

    if (bench.length > 0) {
      const benchHeaderY = listTop + starterHeaderOffset + starterRows * (rowH + gap) + benchGapTop;
      drawFittedText(
        ctx,
        'ЗАПАСНЫЕ',
        m.padX,
        benchHeaderY,
        W - m.padX * 2,
        selectedPlayers.length > 12 ? 15 : 17,
        12,
        theme.textMuted,
        {
          weight: 800,
          family: DISPLAY_FONT,
        }
      );
      const benchCardW = (W - m.padX * 2 - gap) / 2;
      bench.forEach((p, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        drawPlayerCard(
          p,
          m.padX + col * (benchCardW + gap),
          benchHeaderY + benchHeaderOffset + row * (rowH + gap),
          benchCardW,
          rowH,
          false
        );
      });
    }
  } else {
    const metrics = computeLineupLayoutMetrics(availH, selectedPlayers.length, false, 0, m.isStory);
    const { cols, gap, rowH } = metrics;
    const colW = (W - m.padX * 2 - gap * (cols - 1)) / cols;

    selectedPlayers.forEach((p, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      drawPlayerCard(p, m.padX + col * (colW + gap), listTop + row * (rowH + gap), colW, rowH, p.role === 'GK' || p.isCaptain);
    });
  }

  drawBroadcastFooter(ctx, W, H, db.club, theme);
}

// ---------------------------------------------------------------------------
// 3. RESULTS TEMPLATE (3 Pro-League Styles: Match TV Reference / Cinematic / Broadcast)
// ---------------------------------------------------------------------------
async function renderResults(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  db: ClubDatabase,
  draft: PosterDraft,
  theme: BroadcastThemePalette,
  clubLogoSpec: ActiveClubLogoSpec
): Promise<void> {
  const m = getSafeMargins(W, H);
  const mc = await resolveMatchRenderContext(db, draft, clubLogoSpec, true);
  const playerMap = new Map(db.players.map((p) => [p.id, p]));
  const mvpPlayer = mc.match?.mvpPlayerId ? playerMap.get(mc.match.mvpPlayerId) : undefined;
  const mvpImg = await loadImage(mvpPlayer?.photoUrl);

  const headerTag = [mc.season?.name, mc.match?.roundLabel].filter(Boolean).join(' · ') || 'ИТОГ МАТЧА';
  const headline = (draft.resultsHeadline || 'ИТОГ МАТЧА').toUpperCase();

  const ourGoals = (mc.match?.events || [])
    .filter((e) => e.type === 'goal_our' || e.type === 'own_goal_opp')
    .sort((a, b) => a.minute - b.minute);

  const matchTvEvents = groupOurMatchTvEvents(mc.match, playerMap);

  const formatGoalCompact = (ev: (typeof ourGoals)[number]): string => {
    if (ev.type === 'own_goal_opp') return `${ev.minute}' Автогол соп.`;
    const scorer = ev.playerId ? playerMap.get(ev.playerId) : undefined;
    const assist = ev.assistPlayerId ? playerMap.get(ev.assistPlayerId) : undefined;
    const name = scorer ? scorer.shortName || scorer.fullName : 'Игрок';
    const pen = ev.isPenalty ? ' (п)' : '';
    const asst = assist ? ` · ${assist.shortName || assist.fullName}` : '';
    return `${ev.minute}' ${name}${pen}${asst}`;
  };

  const layout = draft.layoutStyle || 'matchtv';
  const cardW = W - m.padX * 2;

  // --- STYLE A: AUTHENTIC MATCH TV REFERENCE (Real 2:5 Barcelona Layout) ---
  if (layout === 'matchtv') {
    const boxH = m.isSquare ? 236 : m.isStory ? 276 : 254;
    const boxY = m.footerTop - boxH - 16;

    // How many scorer/red-card rows sit directly ABOVE the gold-bordered scoreboard
    const maxScorerLines = Math.min(matchTvEvents.length, m.isSquare ? 5 : 6);
    const scorerLineStep = m.isSquare ? 34 : 38;
    const scorersBlockH = maxScorerLines * scorerLineStep;

    // Smooth dark gradient rising from the bottom scoreboard up behind the goalscorers list
    const fadeTop = Math.max(m.topY + 90, boxY - scorersBlockH - 160);
    const fadeGrad = ctx.createLinearGradient(0, fadeTop, 0, boxY + 40);
    fadeGrad.addColorStop(0, 'rgba(10, 11, 14, 0)');
    fadeGrad.addColorStop(0.45, 'rgba(10, 11, 14, 0.72)');
    fadeGrad.addColorStop(1, 'rgba(10, 11, 14, 0.95)');
    ctx.fillStyle = fadeGrad;
    ctx.fillRect(0, fadeTop, W, H - fadeTop);

    // Top corners: tournament emblem + 2-line tournament/round on left, TV badge on right
    drawMatchTvTopCorners(
      ctx,
      W,
      m.topY,
      m.padX,
      mc.season?.name || db.club.name,
      mc.match?.roundLabel || headline,
      db.club,
      clubLogoSpec,
      theme,
      headline
    );

    // Goalscorers & red cards directly ABOVE the top border of the scoreboard box
    // Placed on the side of our club (left if home, right if away) just like Match TV!
    if (maxScorerLines > 0) {
      const ourOnLeft = mc.isHome;
      const scorerX = ourOnLeft ? m.padX + 6 : W - m.padX - 6;
      const scorerAlign: CanvasTextAlign = ourOnLeft ? 'left' : 'right';
      const maxRowW = cardW * 0.54;

      matchTvEvents.slice(0, maxScorerLines).forEach((evLine, idx) => {
        const reverseIdx = maxScorerLines - 1 - idx;
        const sy = boxY - 18 - reverseIdx * scorerLineStep;

        if (evLine.isRedCard) {
          // Render "ФАМИЛИЯ 56'" in crisp white and "(КК)" in crimson (#FB7185) just like Match TV reference
          const prefix = `${evLine.name} ${evLine.minutes.replace('(КК)', '')}`;
          const kkTag = '(КК)';
          const baseFontSize = fitText(ctx, evLine.fullLine, maxRowW, m.isSquare ? 24 : 26, 15, 800, BODY_FONT);

          ctx.save();
          ctx.font = `800 ${baseFontSize}px ${BODY_FONT}`;
          ctx.shadowColor = 'rgba(0, 0, 0, 0.72)';
          ctx.shadowBlur = 12;
          ctx.shadowOffsetY = 3;
          ctx.textBaseline = 'alphabetic';

          const prefixW = ctx.measureText(prefix).width;
          const kkW = ctx.measureText(kkTag).width;

          if (ourOnLeft) {
            ctx.textAlign = 'left';
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(prefix, scorerX, sy, maxRowW - kkW);
            ctx.fillStyle = '#FB7185';
            ctx.fillText(kkTag, scorerX + Math.min(prefixW, maxRowW - kkW), sy);
          } else {
            ctx.textAlign = 'right';
            ctx.fillStyle = '#FB7185';
            ctx.fillText(kkTag, scorerX, sy);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(prefix, scorerX - kkW, sy, maxRowW - kkW);
          }
          ctx.restore();
        } else {
          drawFittedText(ctx, evLine.fullLine, scorerX, sy, maxRowW, m.isSquare ? 24 : 26, 15, '#FFFFFF', {
            align: scorerAlign,
            weight: 800,
            family: BODY_FONT,
            shadow: true,
          });
        }
      });
    }

    // MVP badge on the opposite side above the box (if MVP is set)
    if (mvpPlayer) {
      const mvpOnRight = mc.isHome;
      const mx = mvpOnRight ? W - m.padX - 6 : m.padX + 6;
      const mAlign: CanvasTextAlign = mvpOnRight ? 'right' : 'left';
      const note =
        draft.resultsMvpNote.trim() || (mc.match ? getPlayerMatchSummary(mc.match, mvpPlayer) : '');
      drawFittedText(
        ctx,
        `MVP: ${mvpPlayer.shortName || mvpPlayer.fullName} #${mvpPlayer.number}`.toUpperCase(),
        mx,
        boxY - (note ? 48 : 20),
        cardW * 0.44,
        21,
        14,
        theme.goldLight,
        { align: mAlign, weight: 800, family: DISPLAY_FONT, shadow: true }
      );
      if (note) {
        drawFittedText(ctx, note.toUpperCase(), mx, boxY - 18, cardW * 0.44, 17, 12, '#FFFFFF', {
          align: mAlign,
          weight: 700,
          family: BODY_FONT,
          shadow: true,
        });
      }
    }

    // Monolithic Match TV dark rectangular scoreboard with thin champagne gold border
    ctx.save();
    ctx.fillStyle = 'rgba(10, 12, 16, 0.88)';
    ctx.fillRect(m.padX, boxY, cardW, boxH);
    ctx.strokeStyle = theme.goldMid;
    ctx.lineWidth = 2;
    ctx.strokeRect(m.padX, boxY, cardW, boxH);
    ctx.restore();

    const crestS = m.isSquare ? 120 : 136;
    const crestCy = boxY + boxH * 0.40;
    const leftCx = m.padX + cardW * 0.19;
    const rightCx = m.padX + cardW * 0.81;

    // Left Team Crest + Gold Name below (2-line safe for long/hyphenated names)
    drawMaskedLogo(
      ctx,
      mc.leftLogo,
      leftCx - crestS / 2,
      crestCy - crestS / 2,
      crestS,
      mc.leftScale,
      mc.leftOx,
      mc.leftOy,
      mc.leftMask,
      theme,
      mc.leftShort,
      db.club.primaryColor,
      db.club.accentColor,
      2.2
    );
    drawTeamNameLines(
      ctx,
      mc.leftShort,
      leftCx,
      boxY + boxH - 28,
      cardW * 0.32,
      24,
      16,
      theme.goldMid,
      false
    );

    // Center Giant Match TV Score ("2:5")
    const hasSubTag = Boolean(mc.match?.penalties || mc.match?.isTechnical);
    const scoreBaselineY = boxY + boxH * (hasSubTag ? 0.56 : 0.63);
    drawFittedText(
      ctx,
      `${mc.leftScore}:${mc.rightScore}`,
      W / 2,
      scoreBaselineY,
      cardW * 0.36,
      m.isSquare ? 132 : 148,
      76,
      '#FFFFFF',
      { align: 'center', weight: 900, family: DISPLAY_FONT, shadow: true }
    );

    if (mc.match?.penalties) {
      const lp = mc.isHome ? mc.match.penalties.our : mc.match.penalties.opponent;
      const rp = mc.isHome ? mc.match.penalties.opponent : mc.match.penalties.our;
      drawFittedText(
        ctx,
        `ПО ПЕНАЛЬТИ ${lp}:${rp}`,
        W / 2,
        boxY + boxH - 22,
        cardW * 0.34,
        18,
        13,
        theme.goldLight,
        { align: 'center', weight: 800, family: DISPLAY_FONT }
      );
    } else if (mc.match?.isTechnical) {
      drawFittedText(
        ctx,
        'ТЕХНИЧЕСКИЙ ИТОГ',
        W / 2,
        boxY + boxH - 22,
        cardW * 0.34,
        16,
        12,
        theme.goldLight,
        { align: 'center', weight: 800, family: DISPLAY_FONT }
      );
    }

    // Right Team Crest + Gold Name below (2-line safe for long/hyphenated names)
    drawMaskedLogo(
      ctx,
      mc.rightLogo,
      rightCx - crestS / 2,
      crestCy - crestS / 2,
      crestS,
      mc.rightScale,
      mc.rightOx,
      mc.rightOy,
      mc.rightMask,
      theme,
      mc.rightShort,
      '#334155',
      theme.accent,
      2.2
    );
    drawTeamNameLines(
      ctx,
      mc.rightShort,
      rightCx,
      boxY + boxH - 28,
      cardW * 0.32,
      24,
      16,
      theme.goldMid,
      false
    );

    drawBroadcastFooter(ctx, W, H, db.club, theme, true);
    return;
  }

  // --- STYLE B: CINEMATIC FULL-BLEED PHOTO + LIVE TV SCORE BUG (No duplicate score!) ---
  if (layout === 'cinematic') {
    const bugW = 510;
    const bugH = 82;
    fillBroadcastPanel(
      ctx,
      m.padX,
      m.topY,
      bugW,
      bugH,
      14,
      'rgba(14,16,20,0.88)',
      createGoldGradient(ctx, m.padX, m.topY, m.padX + bugW, m.topY + bugH, theme),
      1.8
    );

    fillBroadcastPanel(
      ctx,
      m.padX + bugW / 2 - 64,
      m.topY + 12,
      128,
      58,
      10,
      theme.primary,
      undefined,
      0,
      false
    );
    drawFittedText(
      ctx,
      `${mc.leftScore} : ${mc.rightScore}`,
      m.padX + bugW / 2,
      m.topY + 52,
      114,
      34,
      22,
      '#FFFFFF',
      { align: 'center', weight: 900, family: DISPLAY_FONT }
    );

    drawMaskedLogo(
      ctx,
      mc.leftLogo,
      m.padX + 14,
      m.topY + 13,
      56,
      mc.leftScale,
      mc.leftOx,
      mc.leftOy,
      mc.leftMask,
      theme,
      mc.leftShort,
      db.club.primaryColor,
      db.club.accentColor,
      1.5
    );
    drawFittedText(
      ctx,
      mc.leftShort.toUpperCase(),
      m.padX + 132,
      m.topY + 48,
      106,
      15,
      11,
      '#FFFFFF',
      { align: 'center', weight: 800, family: DISPLAY_FONT }
    );

    drawMaskedLogo(
      ctx,
      mc.rightLogo,
      m.padX + bugW - 70,
      m.topY + 13,
      56,
      mc.rightScale,
      mc.rightOx,
      mc.rightOy,
      mc.rightMask,
      theme,
      mc.rightShort,
      '#334155',
      theme.accent,
      1.5
    );
    drawFittedText(
      ctx,
      mc.rightShort.toUpperCase(),
      m.padX + bugW - 132,
      m.topY + 48,
      106,
      15,
      11,
      '#FFFFFF',
      { align: 'center', weight: 800, family: DISPLAY_FONT }
    );

    // Bottom clean editorial typography (no score duplication here!)
    const baseY = m.footerTop - 28;
    const kickerLine = mc.match?.penalties
      ? `${headerTag}  ·  ПО ПЕНАЛЬТИ ${
          mc.isHome ? mc.match.penalties.our : mc.match.penalties.opponent
        }:${mc.isHome ? mc.match.penalties.opponent : mc.match.penalties.our}`
      : headerTag;
    drawFittedText(ctx, kickerLine.toUpperCase(), m.padX, baseY - 124, cardW, 17, 13, theme.goldLight, {
      weight: 800,
      family: DISPLAY_FONT,
      shadow: true,
    });
    drawFittedText(ctx, headline, m.padX, baseY - 62, cardW, m.isSquare ? 46 : 54, 28, '#FFFFFF', {
      weight: 900,
      family: DISPLAY_FONT,
      shadow: true,
    });

    const bottomTicker =
      matchTvEvents.length > 0
        ? matchTvEvents
            .slice(0, 5)
            .map((e) => e.fullLine)
            .join('   ·   ')
        : mvpPlayer
        ? `MVP: #${mvpPlayer.number} ${mvpPlayer.fullName}`
        : `${formatRuDate(mc.match?.date || '')} · ${mc.match?.venue || ''}`;
    drawFittedText(ctx, bottomTicker, m.padX, baseY - 14, cardW, 20, 14, 'rgba(248,246,242,0.94)', {
      weight: 700,
      family: BODY_FONT,
      shadow: true,
    });

    drawBroadcastFooter(ctx, W, H, db.club, theme, true);
    return;
  }

  // --- STYLE C: CLASSIC DETAILED BROADCAST PROTOCOL ---
  const startY = drawBroadcastHeader(ctx, W, H, db.club, theme, clubLogoSpec, headerTag);

  drawFittedText(ctx, headline, W / 2, startY + 46, cardW, m.isSquare ? 44 : 52, 28, theme.textPrimary, {
    align: 'center',
    weight: 900,
    family: DISPLAY_FONT,
    shadow: !theme.isLight,
  });

  const scoreCardY = startY + (m.isSquare ? 66 : 78);
  const scoreCardH = m.isSquare ? 248 : m.isStory ? 310 : 286;
  const goldBorder = createGoldGradient(ctx, m.padX, scoreCardY, m.padX + cardW, scoreCardY + scoreCardH, theme);
  fillBroadcastPanel(ctx, m.padX, scoreCardY, cardW, scoreCardH, 22, theme.cardBgStrong, goldBorder, 1.8);

  const crestSize = m.isSquare ? 120 : 150;
  const crestCy = scoreCardY + scoreCardH * 0.41;

  drawTeamCrestBlock(ctx, mc.leftLogo, mc.leftMask, mc.leftName, m.padX + cardW * 0.19, crestCy, crestSize, mc.leftScale, mc.leftOx, mc.leftOy, theme, db.club.primaryColor, db.club.accentColor, cardW * 0.34);

  const scoreBoxW = 246;
  const scoreBoxH = m.isSquare ? 110 : 132;
  fillBroadcastPanel(ctx, W / 2 - scoreBoxW / 2, crestCy - scoreBoxH / 2, scoreBoxW, scoreBoxH, 18, theme.primary, createGoldGradient(ctx, W / 2 - scoreBoxW / 2, crestCy - scoreBoxH / 2, W / 2 + scoreBoxW / 2, crestCy + scoreBoxH / 2, theme), 2.2);
  drawFittedText(ctx, `${mc.leftScore} : ${mc.rightScore}`, W / 2, crestCy + (m.isSquare ? 26 : 30), scoreBoxW - 24, m.isSquare ? 72 : 84, 46, '#FFFFFF', {
    align: 'center',
    weight: 900,
    family: DISPLAY_FONT,
  });

  if (mc.match?.penalties) {
    const lp = mc.isHome ? mc.match.penalties.our : mc.match.penalties.opponent;
    const rp = mc.isHome ? mc.match.penalties.opponent : mc.match.penalties.our;
    fillBroadcastPanel(ctx, W / 2 - 148, crestCy + scoreBoxH / 2 + 14, 296, 36, 8, theme.goldMid, undefined, 0, false);
    drawFittedText(ctx, `ПО ПЕНАЛЬТИ  ${lp} : ${rp}`, W / 2, crestCy + scoreBoxH / 2 + 38, 276, 16, 12, '#111215', {
      align: 'center',
      weight: 800,
      family: DISPLAY_FONT,
    });
  } else if (mc.match?.isTechnical) {
    fillBroadcastPanel(ctx, W / 2 - 148, crestCy + scoreBoxH / 2 + 14, 296, 36, 8, theme.goldMid, undefined, 0, false);
    drawFittedText(ctx, 'ТЕХНИЧЕСКИЙ ИТОГ (ТП)', W / 2, crestCy + scoreBoxH / 2 + 38, 276, 14, 11, '#111215', {
      align: 'center',
      weight: 800,
      family: DISPLAY_FONT,
    });
  } else if (mc.match) {
    drawFittedText(ctx, `${formatRuDate(mc.match.date)} · ${mc.match.venue}`, W / 2, scoreCardY + scoreCardH - 20, cardW * 0.44, 15, 12, theme.textMuted, {
      align: 'center',
      weight: 600,
      family: BODY_FONT,
    });
  }

  drawTeamCrestBlock(ctx, mc.rightLogo, mc.rightMask, mc.rightName, m.padX + cardW * 0.81, crestCy, crestSize, mc.rightScale, mc.rightOx, mc.rightOy, theme, '#334155', theme.accent, cardW * 0.34);

  const contentTop = scoreCardY + scoreCardH + (m.isSquare ? 18 : 24);
  const contentBottom = m.footerTop - 22;
  const contentH = contentBottom - contentTop;

  const drawGoalsBox = (x: number, y: number, w: number, h: number) => {
    fillBroadcastPanel(ctx, x, y, w, h, 18, theme.cardBgStrong, theme.cardBorder, 1.5);
    drawFittedText(ctx, 'ГОЛЫ НАШЕГО КЛУБА', x + 28, y + 40, w - 56, 17, 13, theme.isLight ? theme.primary : theme.goldLight, {
      weight: 800,
      family: DISPLAY_FONT,
    });
    ctx.fillStyle = theme.cardBorder;
    ctx.fillRect(x + 28, y + 54, w - 56, 1.5);

    if (ourGoals.length === 0) {
      drawFittedText(ctx, mc.match?.isTechnical ? 'Технический протокол без авторов голов' : 'Голы в протоколе не отмечены', x + 28, y + 98, w - 56, 18, 14, theme.textMuted, {
        weight: 500,
        family: BODY_FONT,
      });
      return;
    }

    // Auto-group goals when high futsal score (>5 goals) so scorers never clip out of the panel
    const groupedGoalsOnly = matchTvEvents.filter((e) => !e.isRedCard);
    const shouldGroup = ourGoals.length > (m.isSquare ? 4 : 5) && groupedGoalsOnly.length < ourGoals.length;

    if (shouldGroup) {
      const maxVisible = Math.min(groupedGoalsOnly.length, m.isStory ? 9 : m.isSquare ? 5 : 7);
      const listAvail = h - 76;
      const rowStep = Math.min(50, listAvail / Math.max(1, maxVisible));

      groupedGoalsOnly.slice(0, maxVisible).forEach((row, idx) => {
        const ry = y + 74 + idx * rowStep;
        const badgeH = Math.min(34, rowStep - 8);
        const textY = ry + Math.min(23, (rowStep - 8) * 0.7);
        fillBroadcastPanel(ctx, x + 28, ry, 10, badgeH, 5, theme.primary, undefined, 0, false);
        drawFittedText(ctx, row.name, x + 50, textY, (w - 92) * 0.52, 19, 13, theme.textPrimary, {
          weight: 800,
          family: DISPLAY_FONT,
        });
        drawFittedText(
          ctx,
          row.minutes,
          x + w - 28,
          textY,
          (w - 92) * 0.48,
          17,
          12,
          theme.isLight ? theme.primary : theme.goldLight,
          {
            align: 'right',
            weight: 700,
            family: BODY_FONT,
          }
        );
      });
    } else {
      const maxVisible = Math.min(ourGoals.length, m.isStory ? 9 : m.isSquare ? 5 : 7);
      const listAvail = h - 76;
      const rowStep = Math.min(52, listAvail / Math.max(1, maxVisible));

      ourGoals.slice(0, maxVisible).forEach((ev, idx) => {
        const ry = y + 74 + idx * rowStep;
        fillBroadcastPanel(ctx, x + 28, ry, 58, Math.min(34, rowStep - 8), 8, theme.primary, undefined, 0, false);
        drawFittedText(ctx, `${ev.minute}'`, x + 57, ry + Math.min(23, (rowStep - 8) * 0.7), 50, 16, 12, '#FFFFFF', {
          align: 'center',
          weight: 800,
          family: DISPLAY_FONT,
        });

        drawFittedText(ctx, formatGoalCompact(ev).replace(/^\d+'\s*/, ''), x + 100, ry + Math.min(23, (rowStep - 8) * 0.7), w - 126, 20, 14, theme.textPrimary, {
          weight: 600,
          family: BODY_FONT,
        });
      });
    }
  };

  const drawMvpBox = (x: number, y: number, w: number, h: number) => {
    fillBroadcastPanel(ctx, x, y, w, h, 18, theme.cardBgStrong, createGoldGradient(ctx, x, y, x + w, y + h, theme), 1.8);
    fillBroadcastPanel(ctx, x + 24, y + 20, 188, 34, 8, theme.goldMid, undefined, 0, false);
    drawFittedText(ctx, 'MVP МАТЧА', x + 118, y + 43, 170, 15, 12, '#111215', {
      align: 'center',
      weight: 900,
      family: DISPLAY_FONT,
    });

    if (!mvpPlayer) {
      drawFittedText(ctx, 'MVP не выбран', x + 24, y + h / 2, w - 48, 22, 14, theme.textMuted, {
        weight: 700,
        family: DISPLAY_FONT,
      });
      return;
    }

    const horizontalMvp = w > h * 1.4;
    if (horizontalMvp) {
      const photoW = Math.min(h * 1.05, w * 0.34);
      if (mvpImg) {
        drawCroppedImage(ctx, mvpImg, x + w - photoW - 18, y + 12, photoW, h - 24, mvpPlayer.photoScale, mvpPlayer.photoOffsetX, mvpPlayer.photoOffsetY, {
          mode: 'contain',
          radius: 14,
          bottomFadeColor: theme.isLight ? '#FFFFFF' : theme.scrimBase,
          studioShadow: true,
        });
      }
      const textMaxW = w - photoW - 56;
      drawFittedText(ctx, `#${mvpPlayer.number}`, x + 24, y + 102, textMaxW, 42, 24, theme.goldLight, { weight: 900, family: DISPLAY_FONT });
      drawFittedText(ctx, mvpPlayer.fullName.toUpperCase(), x + 24, y + 148, textMaxW, 30, 18, theme.textPrimary, { weight: 800, family: DISPLAY_FONT });
      const statLine = draft.resultsMvpNote.trim() || (mc.match ? getPlayerMatchSummary(mc.match, mvpPlayer) : 'Лучший игрок');
      drawFittedText(ctx, statLine, x + 24, y + 188, textMaxW, 21, 14, theme.textSecondary, { weight: 600, family: BODY_FONT });
    } else {
      const photoH = h * 0.56;
      if (mvpImg) {
        drawCroppedImage(ctx, mvpImg, x + 18, y + 62, w - 36, photoH, mvpPlayer.photoScale, mvpPlayer.photoOffsetX, mvpPlayer.photoOffsetY, {
          mode: 'contain',
          radius: 12,
          bottomFadeColor: theme.isLight ? '#FFFFFF' : theme.scrimBase,
          studioShadow: true,
        });
      }
      const infoTop = y + h - 102;
      drawFittedText(ctx, `#${mvpPlayer.number} ${mvpPlayer.shortName || mvpPlayer.fullName}`.toUpperCase(), x + 24, infoTop + 26, w - 48, 25, 16, theme.textPrimary, { weight: 900, family: DISPLAY_FONT });
      const statLine = draft.resultsMvpNote.trim() || (mc.match ? getPlayerMatchSummary(mc.match, mvpPlayer) : 'Лучший игрок');
      drawFittedText(ctx, statLine, x + 24, infoTop + 62, w - 48, 19, 14, theme.isLight ? theme.primary : theme.goldLight, { weight: 700, family: BODY_FONT });
    }
  };

  if (m.isStory) {
    const goalsH = contentH * 0.52;
    const mvpH = contentH - goalsH - 20;
    drawGoalsBox(m.padX, contentTop, cardW, goalsH);
    drawMvpBox(m.padX, contentTop + goalsH + 20, cardW, mvpH);
  } else {
    const gap = 24;
    const leftW = cardW * 0.56;
    const rightW = cardW - leftW - gap;
    drawGoalsBox(m.padX, contentTop, leftW, contentH);
    drawMvpBox(m.padX + leftW + gap, contentTop, rightW, contentH);
  }

  drawBroadcastFooter(ctx, W, H, db.club, theme);
}

// ---------------------------------------------------------------------------
// 4. SCORERS & ASSISTANTS TEMPLATE
// ---------------------------------------------------------------------------
async function renderScorers(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  db: ClubDatabase,
  draft: PosterDraft,
  theme: BroadcastThemePalette,
  clubLogoSpec: ActiveClubLogoSpec
): Promise<void> {
  const m = getSafeMargins(W, H);
  const season = db.seasons.find((s) => s.id === draft.seasonFilterId);
  const seasonLabel = season ? season.name : 'ВСЕ ТУРНИРЫ СЕЗОНА';
  const startY = drawBroadcastHeader(ctx, W, H, db.club, theme, clubLogoSpec, seasonLabel);

  const defaultTitle =
    draft.scorersMode === 'goals'
      ? 'БОМБАРДИРЫ КЛУБА'
      : draft.scorersMode === 'assists'
      ? 'АССИСТЕНТЫ КЛУБА'
      : 'ГОЛ + ПАС';
  const title = (draft.scorersTitle.trim() || defaultTitle).toUpperCase();

  drawFittedText(ctx, title, m.padX, startY + 48, W - m.padX * 2, m.isSquare ? 44 : 52, 28, theme.textPrimary, {
    weight: 900,
    family: DISPLAY_FONT,
    shadow: !theme.isLight,
  });

  const rawStats = computeFieldPlayerStats(db.players, db.matches, draft.seasonFilterId);
  const sorted = [...rawStats]
    .sort((a, b) => {
      if (draft.scorersMode === 'goals') {
        if (b.goals !== a.goals) return b.goals - a.goals;
        return b.points - a.points;
      }
      if (draft.scorersMode === 'assists') {
        if (b.assists !== a.assists) return b.assists - a.assists;
        return b.points - a.points;
      }
      if (b.points !== a.points) return b.points - a.points;
      return b.goals - a.goals;
    })
    .slice(0, draft.scorersLimit);

  const leader = sorted[0];
  const leaderImg = await loadImage(leader?.player.photoUrl);

  const cardW = W - m.padX * 2;
  const topAreaY = startY + 70;
  const footerTop = m.footerTop - 22;

  if (!leader) {
    fillBroadcastPanel(ctx, m.padX, topAreaY + 40, cardW, 200, 18, theme.cardBgStrong, theme.cardBorder, 1.5);
    drawFittedText(ctx, 'НЕТ ДАННЫХ ПО ЗАВЕРШЁННЫМ МАТЧАМ', W / 2, topAreaY + 150, cardW - 60, 22, 15, theme.textMuted, {
      align: 'center',
      weight: 700,
      family: DISPLAY_FONT,
    });
    drawBroadcastFooter(ctx, W, H, db.club, theme);
    return;
  }

  const heroH = m.isSquare ? 236 : m.isStory ? 320 : 288;
  fillBroadcastPanel(ctx, m.padX, topAreaY, cardW, heroH, 20, theme.cardBgStrong, createGoldGradient(ctx, m.padX, topAreaY, m.padX + cardW, topAreaY + heroH, theme), 1.8);

  const photoW = Math.min(340, cardW * 0.38);
  if (leaderImg) {
    drawCroppedImage(ctx, leaderImg, m.padX + cardW - photoW - 14, topAreaY + 10, photoW, heroH - 12, leader.player.photoScale, leader.player.photoOffsetX, leader.player.photoOffsetY, {
      mode: 'contain',
      radius: 16,
      bottomFadeColor: theme.isLight ? '#FFFFFF' : theme.scrimBase,
      studioShadow: true,
      rimGlowColor: rgba(theme.primary, 0.28),
    });
  }

  const textAreaW = cardW - photoW - 64;
  fillBroadcastPanel(ctx, m.padX + 30, topAreaY + 26, 178, 36, 8, theme.goldMid, undefined, 0, false);
  drawFittedText(ctx, '№1 ЛИДЕР', m.padX + 119, topAreaY + 50, 160, 16, 12, '#111215', { align: 'center', weight: 900, family: DISPLAY_FONT });

  drawFittedText(ctx, leader.player.fullName.toUpperCase(), m.padX + 30, topAreaY + (m.isSquare ? 112 : 126), textAreaW, m.isSquare ? 34 : 42, 20, theme.textPrimary, {
    weight: 900,
    family: DISPLAY_FONT,
  });

  const primaryVal = draft.scorersMode === 'goals' ? leader.goals : draft.scorersMode === 'assists' ? leader.assists : leader.points;
  const primaryLabel = draft.scorersMode === 'goals' ? 'ГОЛОВ' : draft.scorersMode === 'assists' ? 'АССИСТОВ' : 'ГОЛ + ПАС';

  const statY = topAreaY + heroH - (m.isSquare ? 78 : 94);
  drawFittedText(ctx, String(primaryVal), m.padX + 30, statY + 46, 130, m.isSquare ? 64 : 76, 42, theme.isLight ? theme.primary : theme.goldLight, {
    weight: 900,
    family: DISPLAY_FONT,
  });

  drawFittedText(ctx, primaryLabel, m.padX + 160, statY + 16, textAreaW - 140, 17, 12, theme.textMuted, { weight: 700, family: DISPLAY_FONT });
  const subBreakdown = `Игр: ${leader.matches}  ·  Голы: ${leader.goals}${leader.penalties > 0 ? ` (${leader.penalties} п.)` : ''}  ·  Пасы: ${leader.assists}`;
  drawFittedText(ctx, subBreakdown, m.padX + 160, statY + 48, textAreaW - 140, 19, 14, theme.textSecondary, { weight: 600, family: BODY_FONT });

  const tableY = topAreaY + heroH + 20;
  const tableH = footerTop - tableY;
  const rest = sorted.slice(1);

  fillBroadcastPanel(ctx, m.padX, tableY, cardW, tableH, 18, theme.cardBgStrong, theme.cardBorder, 1.5);

  const thY = tableY + 34;
  const colRank = m.padX + 30;
  const colName = m.padX + 90;
  const colMatches = m.padX + cardW - 310;
  const colGoals = m.padX + cardW - 224;
  const colAssists = m.padX + cardW - 138;
  const colPoints = m.padX + cardW - 52;

  ctx.font = `700 15px ${BODY_FONT}`;
  ctx.fillStyle = theme.textMuted;
  ctx.textAlign = 'left';
  ctx.fillText('#', colRank, thY);
  ctx.fillText('ИГРОК', colName, thY);
  ctx.textAlign = 'center';
  ctx.fillText('И', colMatches, thY);
  ctx.fillText('Г (П)', colGoals, thY);
  ctx.fillText('А', colAssists, thY);
  ctx.fillText('Г+П', colPoints, thY);

  ctx.fillStyle = theme.cardBorder;
  ctx.fillRect(m.padX + 20, tableY + 48, cardW - 40, 1.5);

  const bodyTop = tableY + 58;
  const bodyAvail = tableH - 68;
  const rowH = Math.min(72, bodyAvail / Math.max(1, rest.length));

  rest.forEach((row, idx) => {
    const ry = bodyTop + idx * rowH;
    if (idx % 2 === 1) {
      ctx.fillStyle = theme.isLight ? 'rgba(22,24,28,0.035)' : 'rgba(255,255,255,0.035)';
      ctx.fillRect(m.padX + 12, ry, cardW - 24, rowH);
    }

    const midY = ry + rowH / 2 + 7;
    drawFittedText(ctx, String(idx + 2), colRank, midY, 44, 22, 14, theme.textMuted, { weight: 800, family: DISPLAY_FONT });
    drawFittedText(ctx, `${row.player.fullName}  #${row.player.number}`, colName, midY, colMatches - colName - 36, Math.min(22, rowH * 0.42), 14, theme.textPrimary, { weight: 700, family: BODY_FONT });

    const drawNum = (val: string, cx: number, active: boolean) => {
      drawFittedText(ctx, val, cx, midY, 74, Math.min(24, rowH * 0.44), 15, active ? (theme.isLight ? theme.primary : theme.goldLight) : theme.textSecondary, {
        align: 'center',
        weight: active ? 900 : 700,
        family: DISPLAY_FONT,
      });
    };

    drawNum(String(row.matches), colMatches, false);
    drawNum(row.penalties > 0 ? `${row.goals}(${row.penalties})` : String(row.goals), colGoals, draft.scorersMode === 'goals');
    drawNum(String(row.assists), colAssists, draft.scorersMode === 'assists');
    drawNum(String(row.points), colPoints, draft.scorersMode === 'points');
  });

  drawBroadcastFooter(ctx, W, H, db.club, theme);
}

// ---------------------------------------------------------------------------
// 5. GOALKEEPERS TEMPLATE
// ---------------------------------------------------------------------------
async function renderGoalkeepers(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  db: ClubDatabase,
  draft: PosterDraft,
  theme: BroadcastThemePalette,
  clubLogoSpec: ActiveClubLogoSpec
): Promise<void> {
  const m = getSafeMargins(W, H);
  const season = db.seasons.find((s) => s.id === draft.seasonFilterId);
  const seasonLabel = season ? season.name : 'ВСЕ ТУРНИРЫ СЕЗОНА';
  const startY = drawBroadcastHeader(ctx, W, H, db.club, theme, clubLogoSpec, seasonLabel);

  const title = (draft.gkTitle.trim() || 'ВРАТАРИ И СУХАРИ').toUpperCase();
  drawFittedText(ctx, title, m.padX, startY + 48, W - m.padX * 2, m.isSquare ? 44 : 52, 28, theme.textPrimary, {
    weight: 900,
    family: DISPLAY_FONT,
    shadow: !theme.isLight,
  });

  const gkStats = computeGoalkeeperStats(db.players, db.matches, draft.seasonFilterId);
  const gkImages = new Map<string, HTMLImageElement | null>();
  await Promise.all(gkStats.map(async (g) => gkImages.set(g.player.id, await loadImage(g.player.photoUrl))));

  const cardW = W - m.padX * 2;
  const areaTop = startY + 74;
  const areaBottom = m.footerTop - 24;
  const availH = areaBottom - areaTop;

  if (gkStats.length === 0) {
    fillBroadcastPanel(ctx, m.padX, areaTop + 40, cardW, 200, 18, theme.cardBgStrong, theme.cardBorder, 1.5);
    drawFittedText(ctx, 'ДОБАВЬТЕ ВРАТАРЕЙ В РАЗДЕЛЕ «СОСТАВ»', W / 2, areaTop + 150, cardW - 60, 22, 15, theme.textMuted, {
      align: 'center',
      weight: 700,
      family: DISPLAY_FONT,
    });
    drawBroadcastFooter(ctx, W, H, db.club, theme);
    return;
  }

  const gap = 22;
  const maxShow = Math.min(gkStats.length, 4);
  const cardH = Math.min(m.isSquare ? 310 : 370, (availH - gap * (maxShow - 1)) / maxShow);

  gkStats.slice(0, maxShow).forEach((gk, idx) => {
    const cy = areaTop + idx * (cardH + gap);
    const isBest = idx === 0 && gk.matches > 0;

    fillBroadcastPanel(ctx, m.padX, cy, cardW, cardH, 20, theme.cardBgStrong, isBest ? createGoldGradient(ctx, m.padX, cy, m.padX + cardW, cy + cardH, theme) : theme.cardBorder, isBest ? 2 : 1.5);

    const photoW = Math.min(270, cardH * 0.85);
    const img = gkImages.get(gk.player.id) || null;
    if (img) {
      drawCroppedImage(ctx, img, m.padX + 18, cy + 14, photoW, cardH - 28, gk.player.photoScale, gk.player.photoOffsetX, gk.player.photoOffsetY, {
        mode: 'contain',
        radius: 14,
        bottomFadeColor: theme.isLight ? '#FFFFFF' : theme.scrimBase,
        studioShadow: true,
      });
    } else {
      fillBroadcastPanel(ctx, m.padX + 18, cy + 18, photoW, cardH - 36, 14, rgba(theme.primary, 0.25), undefined, 0, false);
      drawFittedText(ctx, `#${gk.player.number}`, m.padX + 18 + photoW / 2, cy + cardH / 2 + 22, photoW - 24, 62, 30, theme.goldLight, {
        align: 'center',
        weight: 900,
        family: DISPLAY_FONT,
      });
    }

    const rightX = m.padX + 18 + photoW + 28;
    const rightW = cardW - photoW - 64;

    const badgeText = isBest ? `№${gk.player.number} · ЛУЧШИЙ КН` : `№${gk.player.number} · ВРАТАРЬ`;
    fillBroadcastPanel(ctx, rightX, cy + 24, 214, 34, 8, isBest ? theme.goldMid : theme.primary, undefined, 0, false);
    drawFittedText(ctx, badgeText, rightX + 107, cy + 47, 196, 14, 11, isBest ? '#111215' : '#FFFFFF', {
      align: 'center',
      weight: 800,
      family: DISPLAY_FONT,
    });

    drawFittedText(ctx, gk.player.fullName.toUpperCase(), rightX, cy + 104, rightW, 34, 18, theme.textPrimary, {
      weight: 900,
      family: DISPLAY_FONT,
    });

    const kpiTop = cy + cardH - (cardH < 240 ? 96 : 116);
    const kpiH = cardH < 240 ? 78 : 94;
    const kpiGap = 12;
    const kpiW = (rightW - kpiGap * 3) / 4;

    const metrics = [
      { label: 'МАТЧИ', value: String(gk.matches), highlight: false },
      { label: 'СУХИЕ', value: String(gk.cleanSheets), highlight: gk.cleanSheets > 0 },
      { label: 'ПРОПУЩ.', value: String(gk.conceded), highlight: false },
      { label: 'КН', value: gk.matches > 0 ? gk.gaa.toFixed(2) : '—', highlight: isBest },
    ];

    metrics.forEach((met, mi) => {
      const kx = rightX + mi * (kpiW + kpiGap);
      fillBroadcastPanel(
        ctx,
        kx,
        kpiTop,
        kpiW,
        kpiH,
        12,
        met.highlight ? rgba(theme.goldMid, 0.16) : theme.isLight ? 'rgba(22,24,28,0.04)' : 'rgba(255,255,255,0.05)',
        met.highlight ? rgba(theme.goldMid, 0.55) : theme.cardBorder,
        1.5,
        false
      );
      drawFittedText(ctx, met.value, kx + kpiW / 2, kpiTop + kpiH * 0.54, kpiW - 14, 34, 18, met.highlight ? (theme.isLight ? theme.primary : theme.goldLight) : theme.textPrimary, {
        align: 'center',
        weight: 900,
        family: DISPLAY_FONT,
      });
      drawFittedText(ctx, met.label, kx + kpiW / 2, kpiTop + kpiH - 14, kpiW - 12, 12, 10, theme.textMuted, {
        align: 'center',
        weight: 700,
        family: BODY_FONT,
      });
    });
  });

  drawBroadcastFooter(ctx, W, H, db.club, theme);
}

// ---------------------------------------------------------------------------
// 6. CLUB EVENT TEMPLATE (incl. POTM VOTE SILHOUETTE '?' & POTM WINNER)
// ---------------------------------------------------------------------------
function drawMysteryPlayerSilhouette(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  theme: BroadcastThemePalette
): void {
  ctx.save();
  roundRectPath(ctx, x, y, w, h, 22);
  ctx.clip();

  // Studio dark backdrop with dramatic ruby + champagne spotlight
  const bgGrad = ctx.createLinearGradient(x, y, x, y + h);
  bgGrad.addColorStop(0, 'rgba(13, 15, 20, 0.72)');
  bgGrad.addColorStop(1, 'rgba(8, 9, 12, 0.95)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(x, y, w, h);

  const cx = x + w / 2;
  const cy = y + h * 0.48;
  const spotR = Math.min(w, h) * 0.58;

  const spotGrad = ctx.createRadialGradient(cx, cy, spotR * 0.08, cx, cy, spotR);
  spotGrad.addColorStop(0, rgba(theme.primary, 0.48));
  spotGrad.addColorStop(0.45, rgba(theme.goldMid, 0.22));
  spotGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = spotGrad;
  ctx.fillRect(x, y, w, h);

  // Decorative background question marks Left & Right
  ctx.save();
  ctx.font = `900 ${Math.round(h * 0.34)}px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(theme.goldMid, 0.08);
  ctx.fillText('?', cx - w * 0.31, cy - h * 0.04);
  ctx.fillText('?', cx + w * 0.31, cy - h * 0.04);
  ctx.restore();

  // Athletic footballer head-and-shoulders silhouette anchored to bottom of frame
  const baseBottom = y + h;
  const scale = Math.min(w / 780, h / 640);
  const headRadiusX = 76 * scale;
  const headRadiusY = 92 * scale;
  const headCenterY = baseBottom - 430 * scale;

  ctx.save();
  ctx.shadowColor = rgba(theme.goldLight, 0.45);
  ctx.shadowBlur = 32;

  ctx.beginPath();
  // Left shoulder & arm slope
  ctx.moveTo(cx - 310 * scale, baseBottom + 10);
  ctx.quadraticCurveTo(cx - 295 * scale, baseBottom - 165 * scale, cx - 235 * scale, baseBottom - 220 * scale);
  // Left trapezius to neck
  ctx.quadraticCurveTo(cx - 135 * scale, baseBottom - 265 * scale, cx - 58 * scale, baseBottom - 285 * scale);
  // Left neck up
  ctx.lineTo(cx - 52 * scale, baseBottom - 335 * scale);
  // Right neck down
  ctx.moveTo(cx + 52 * scale, baseBottom - 335 * scale);
  ctx.lineTo(cx + 58 * scale, baseBottom - 285 * scale);
  // Right trapezius to shoulder
  ctx.quadraticCurveTo(cx + 135 * scale, baseBottom - 265 * scale, cx + 235 * scale, baseBottom - 220 * scale);
  ctx.quadraticCurveTo(cx + 295 * scale, baseBottom - 165 * scale, cx + 310 * scale, baseBottom + 10);
  ctx.lineTo(cx - 310 * scale, baseBottom + 10);
  ctx.closePath();

  const bodyGrad = ctx.createLinearGradient(cx, baseBottom - 360 * scale, cx, baseBottom);
  bodyGrad.addColorStop(0, '#171A22');
  bodyGrad.addColorStop(0.5, '#0F1117');
  bodyGrad.addColorStop(1, '#08090C');
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  ctx.lineWidth = 3.2;
  ctx.strokeStyle = createGoldGradient(ctx, cx - 280 * scale, baseBottom - 300 * scale, cx + 280 * scale, baseBottom, theme);
  ctx.stroke();

  // Head & ears silhouette
  ctx.beginPath();
  ctx.ellipse(cx, headCenterY, headRadiusX, headRadiusY, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#14171F';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = createGoldGradient(ctx, cx - headRadiusX, headCenterY - headRadiusY, cx + headRadiusX, headCenterY + headRadiusY, theme);
  ctx.stroke();

  // Jersey V-neck collar & shoulder stripes in club ruby/gold
  ctx.beginPath();
  ctx.moveTo(cx - 64 * scale, baseBottom - 282 * scale);
  ctx.lineTo(cx, baseBottom - 218 * scale);
  ctx.lineTo(cx + 64 * scale, baseBottom - 282 * scale);
  ctx.lineWidth = 4 * scale;
  ctx.strokeStyle = rgba(theme.primary, 0.85);
  ctx.stroke();
  ctx.restore();

  // Bottom vignette before question mark
  const botFade = ctx.createLinearGradient(x, baseBottom - h * 0.35, x, baseBottom);
  botFade.addColorStop(0, 'rgba(8, 9, 12, 0)');
  botFade.addColorStop(1, 'rgba(8, 9, 12, 0.92)');
  ctx.fillStyle = botFade;
  ctx.fillRect(x, baseBottom - h * 0.35, w, h * 0.35);

  // Giant glowing '?' badge in center of chest
  const qCenterY = baseBottom - 155 * scale;
  const ringR = 104 * scale;

  ctx.save();
  const haloGrad = ctx.createRadialGradient(cx, qCenterY, ringR * 0.2, cx, qCenterY, ringR * 1.45);
  haloGrad.addColorStop(0, rgba(theme.goldLight, 0.32));
  haloGrad.addColorStop(0.6, rgba(theme.primary, 0.22));
  haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = haloGrad;
  ctx.beginPath();
  ctx.arc(cx, qCenterY, ringR * 1.45, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, qCenterY, ringR, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(14, 16, 22, 0.88)';
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = createGoldGradient(ctx, cx - ringR, qCenterY - ringR, cx + ringR, qCenterY + ringR, theme);
  ctx.stroke();

  const qFontSize = Math.round(154 * scale);
  ctx.font = `900 ${qFontSize}px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = rgba(theme.goldLight, 0.65);
  ctx.shadowBlur = 24;
  ctx.fillStyle = createGoldGradient(ctx, cx - 50, qCenterY - 70, cx + 50, qCenterY + 70, theme);
  ctx.fillText('?', cx, qCenterY + 6 * scale);
  ctx.restore();

  // Outer frame border
  roundRectPath(ctx, x, y, w, h, 22);
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = createGoldGradient(ctx, x, y, x + w, y + h, theme);
  ctx.stroke();

  ctx.restore();
}

async function renderClubEvent(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  db: ClubDatabase,
  draft: PosterDraft,
  theme: BroadcastThemePalette,
  clubLogoSpec: ActiveClubLogoSpec
): Promise<void> {
  const m = getSafeMargins(W, H);
  const isPotmVote = draft.eventPreset === 'potm_vote';
  const isPotmWinner = draft.eventPreset === 'potm_winner';

  const selectedPlayer =
    !draft.eventUseCustomPhoto && draft.eventPlayerId && !isPotmVote
      ? db.players.find((p) => p.id === draft.eventPlayerId)
      : isPotmWinner
      ? db.players.find((p) => p.id === draft.eventPlayerId) || db.players[0]
      : undefined;

  const photoUrl = draft.eventUseCustomPhoto
    ? draft.eventCustomPhotoUrl
    : isPotmVote
    ? FORTUNA_ASSETS.potmMysterySilhouette
    : selectedPlayer?.photoUrl || '';
  const photoScale = draft.eventUseCustomPhoto
    ? draft.eventCustomPhotoScale
    : isPotmVote
    ? 1.02
    : selectedPlayer?.photoScale ?? 1;
  const photoOx = draft.eventUseCustomPhoto
    ? draft.eventCustomPhotoOffsetX
    : isPotmVote
    ? 0
    : selectedPlayer?.photoOffsetX ?? 0;
  const photoOy = draft.eventUseCustomPhoto
    ? draft.eventCustomPhotoOffsetY
    : isPotmVote
    ? -6
    : selectedPlayer?.photoOffsetY ?? 0;

  const heroImg = photoUrl ? await loadImage(photoUrl) : null;

  const presetTagMap: Record<PosterDraft['eventPreset'], string> = {
    potm_vote: 'ГОЛОСОВАНИЕ БОЛЕЛЬЩИКОВ',
    potm_winner: 'ИГРОК МЕСЯЦА',
    birthday: 'ДЕНЬ РОЖДЕНИЯ',
    welcome: 'ТРАНСФЕР КЛУБА',
    announcement: 'НОВОСТИ КЛУБА',
    training: 'ТРЕНИРОВКА',
  };

  const startY = drawBroadcastHeader(ctx, W, H, db.club, theme, clubLogoSpec, presetTagMap[draft.eventPreset]);

  const cardW = W - m.padX * 2;
  const footerTop = m.footerTop - 22;
  const lowerBoxH = m.isSquare
    ? isPotmVote || isPotmWinner
      ? 336
      : 300
    : m.isStory
    ? isPotmVote || isPotmWinner
      ? 410
      : 380
    : isPotmVote || isPotmWinner
    ? 368
    : 340;
  const photoAreaTop = startY + 12;
  const photoAreaH = footerTop - lowerBoxH - photoAreaTop + 42;

  if (isPotmVote && !draft.eventUseCustomPhoto) {
    if (heroImg) {
      drawCroppedImage(ctx, heroImg, m.padX, photoAreaTop, cardW, photoAreaH, photoScale, photoOx, photoOy, {
        mode: 'cover',
        radius: 22,
        bottomFadeColor: theme.scrimBase,
      });
      // Thin champagne-gold studio frame around the mystery silhouette artwork
      ctx.save();
      roundRectPath(ctx, m.padX, photoAreaTop, cardW, photoAreaH - 22, 22);
      ctx.strokeStyle = createGoldGradient(ctx, m.padX, photoAreaTop, m.padX + cardW, photoAreaTop + photoAreaH, theme);
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.restore();
    } else {
      drawMysteryPlayerSilhouette(ctx, m.padX, photoAreaTop, cardW, photoAreaH - 28, theme);
    }

    // Top-left mystery badge inside silhouette card
    fillBroadcastPanel(
      ctx,
      m.padX + 24,
      photoAreaTop + 20,
      204,
      54,
      14,
      'rgba(12, 14, 18, 0.86)',
      createGoldGradient(ctx, m.padX + 24, photoAreaTop + 20, m.padX + 228, photoAreaTop + 74, theme),
      1.6
    );
    drawFittedText(ctx, 'КТО СТАНЕТ MVP?', m.padX + 126, photoAreaTop + 53, 180, 16, 12, theme.goldLight, {
      align: 'center',
      weight: 900,
      family: DISPLAY_FONT,
    });
  } else if (heroImg) {
    drawCroppedImage(ctx, heroImg, m.padX, photoAreaTop, cardW, photoAreaH, photoScale, photoOx, photoOy, {
      mode: draft.eventUseCustomPhoto ? 'cover' : 'contain',
      radius: 22,
      bottomFadeColor: theme.scrimBase,
      studioShadow: !draft.eventUseCustomPhoto,
      rimGlowColor: !draft.eventUseCustomPhoto
        ? isPotmWinner
          ? rgba(theme.goldLight, 0.36)
          : rgba(theme.primary, 0.28)
        : undefined,
    });
  } else if (isPotmWinner) {
    drawMysteryPlayerSilhouette(ctx, m.padX, photoAreaTop, cardW, photoAreaH - 28, theme);
  } else {
    fillBroadcastPanel(ctx, m.padX, photoAreaTop, cardW, photoAreaH - 60, 22, theme.cardBg, theme.cardBorder, 1.5);
    drawMaskedLogo(
      ctx,
      clubLogoSpec.img,
      W / 2 - 115,
      photoAreaTop + (photoAreaH - 60) / 2 - 115,
      230,
      clubLogoSpec.scale,
      clubLogoSpec.offsetX,
      clubLogoSpec.offsetY,
      clubLogoSpec.mask,
      theme,
      db.club.shortName,
      db.club.primaryColor,
      db.club.accentColor,
      2.6
    );
  }

  if (selectedPlayer && !isPotmVote) {
    fillBroadcastPanel(
      ctx,
      m.padX + 24,
      photoAreaTop + 20,
      118,
      96,
      16,
      theme.cardBgStrong,
      createGoldGradient(ctx, m.padX + 24, photoAreaTop + 20, m.padX + 142, photoAreaTop + 116, theme),
      1.8
    );
    drawFittedText(
      ctx,
      `#${selectedPlayer.number}`,
      m.padX + 83,
      photoAreaTop + 76,
      98,
      40,
      22,
      theme.isLight ? theme.primary : theme.goldLight,
      { align: 'center', weight: 900, family: DISPLAY_FONT }
    );
    drawFittedText(
      ctx,
      isPotmWinner ? 'MVP МЕСЯЦА' : selectedPlayer.role === 'GK' ? 'ВРАТАРЬ' : 'ИГРОК',
      m.padX + 83,
      photoAreaTop + 102,
      102,
      11,
      9,
      theme.textMuted,
      { align: 'center', weight: 800, family: DISPLAY_FONT }
    );
  }

  const lowerY = footerTop - lowerBoxH;
  fillBroadcastPanel(
    ctx,
    m.padX,
    lowerY,
    cardW,
    lowerBoxH,
    22,
    theme.cardBgStrong,
    createGoldGradient(ctx, m.padX, lowerY, m.padX + cardW, lowerY + lowerBoxH, theme),
    1.8
  );

  const badgeText = (draft.eventBadgeText || presetTagMap[draft.eventPreset]).toUpperCase();
  ctx.font = `800 17px ${DISPLAY_FONT}`;
  const bw = Math.min(cardW - 64, ctx.measureText(badgeText).width + 52);
  fillBroadcastPanel(
    ctx,
    m.padX + 32,
    lowerY + 26,
    bw,
    40,
    10,
    isPotmWinner || isPotmVote ? theme.goldMid : theme.primary,
    undefined,
    0,
    false
  );
  drawFittedText(
    ctx,
    badgeText,
    m.padX + 32 + bw / 2,
    lowerY + 52,
    bw - 24,
    16,
    12,
    isPotmWinner || isPotmVote ? '#111215' : '#FFFFFF',
    { align: 'center', weight: 900, family: DISPLAY_FONT }
  );

  const defaultHeadline = isPotmVote
    ? 'ЛУЧШИЙ ИГРОК МЕСЯЦА'
    : isPotmWinner && selectedPlayer
    ? selectedPlayer.fullName.toUpperCase()
    : 'СОБЫТИЕ КЛУБА';
  const headline = (draft.eventHeadline.trim() || defaultHeadline).toUpperCase();

  drawFittedText(
    ctx,
    headline,
    m.padX + 32,
    lowerY + (m.isSquare ? 120 : 134),
    cardW - 64,
    m.isSquare ? 42 : 50,
    22,
    theme.textPrimary,
    { weight: 900, family: DISPLAY_FONT }
  );

  let subTop = lowerY + (m.isSquare ? 144 : 162);

  if (selectedPlayer && !isPotmVote) {
    const shortUp = (selectedPlayer.shortName || '').toUpperCase();
    const fullUp = (selectedPlayer.fullName || '').toUpperCase();
    const firstWord = fullUp.split(/\s+/)[0] || '';
    const alreadyHasName =
      (shortUp && headline.includes(shortUp)) ||
      (fullUp && headline.includes(fullUp)) ||
      (firstWord.length > 2 && headline.includes(firstWord));

    if (!alreadyHasName) {
      drawFittedText(
        ctx,
        `${selectedPlayer.fullName.toUpperCase()}  ·  #${selectedPlayer.number}`,
        m.padX + 32,
        subTop + 18,
        cardW - 64,
        24,
        15,
        theme.isLight ? theme.primary : theme.goldLight,
        { weight: 800, family: DISPLAY_FONT }
      );
      subTop += 38;
    }
  }

  const subtitle = draft.eventSubtitle.trim();
  if (subtitle) {
    drawWrappedText(
      ctx,
      subtitle,
      m.padX + 32,
      subTop,
      cardW - 64,
      30,
      isPotmVote || isPotmWinner ? 2 : m.isStory ? 5 : 3,
      `500 20px ${BODY_FONT}`,
      theme.textSecondary,
      'left'
    );
  }

  // Dedicated bottom bar for POTM Vote (Top 4 Nominees) or POTM Winner (Season Stats KPIs)
  if (isPotmVote) {
    const fieldStats = computeFieldPlayerStats(db.players, db.matches, draft.seasonFilterId);
    const nominees = [...fieldStats]
      .sort((a, b) => (b.points !== a.points ? b.points - a.points : b.goals - a.goals))
      .slice(0, 4);

    if (nominees.length > 0) {
      const stripY = lowerY + lowerBoxH - 96;
      const stripH = 72;
      const gap = 12;
      const pillW = (cardW - 64 - gap * (nominees.length - 1)) / nominees.length;

      nominees.forEach((nom, idx) => {
        const px = m.padX + 32 + idx * (pillW + gap);
        fillBroadcastPanel(
          ctx,
          px,
          stripY,
          pillW,
          stripH,
          12,
          idx === 0 ? rgba(theme.goldMid, 0.16) : 'rgba(255,255,255,0.04)',
          idx === 0 ? rgba(theme.goldMid, 0.55) : theme.cardBorder,
          1.4,
          false
        );
        const surname = (nom.player.shortName || nom.player.fullName).split(/\s+/)[0].toUpperCase();
        drawFittedText(
          ctx,
          `#${nom.player.number} ${surname}`,
          px + pillW / 2,
          stripY + 30,
          pillW - 14,
          16,
          11,
          theme.textPrimary,
          { align: 'center', weight: 900, family: DISPLAY_FONT }
        );
        drawFittedText(
          ctx,
          `${nom.goals}Г + ${nom.assists}П (${nom.points})`,
          px + pillW / 2,
          stripY + 54,
          pillW - 14,
          13,
          10,
          theme.goldLight,
          { align: 'center', weight: 700, family: BODY_FONT }
        );
      });
    }
  } else if (isPotmWinner && selectedPlayer) {
    const stripY = lowerY + lowerBoxH - 104;
    const stripH = 80;
    const gap = 14;
    const colW = (cardW - 64 - gap * 3) / 4;

    let metrics: Array<{ label: string; value: string; highlight?: boolean }> = [];
    if (selectedPlayer.role === 'GK') {
      const gkList = computeGoalkeeperStats(db.players, db.matches, draft.seasonFilterId);
      const gkRow = gkList.find((g) => g.player.id === selectedPlayer.id);
      metrics = [
        { label: 'МАТЧИ', value: String(gkRow?.matches ?? 0) },
        { label: 'СУХИЕ ИГРЫ', value: String(gkRow?.cleanSheets ?? 0), highlight: true },
        { label: 'ПРОПУЩЕНО', value: String(gkRow?.conceded ?? 0) },
        { label: 'КОЭФФ. КН', value: gkRow && gkRow.matches > 0 ? gkRow.gaa.toFixed(2) : '0.00', highlight: true },
      ];
    } else {
      const fList = computeFieldPlayerStats(db.players, db.matches, draft.seasonFilterId);
      const fRow = fList.find((f) => f.player.id === selectedPlayer.id);
      metrics = [
        { label: 'МАТЧИ', value: String(fRow?.matches ?? 0) },
        { label: 'ГОЛЫ', value: String(fRow?.goals ?? 0), highlight: true },
        { label: 'АССИСТЫ', value: String(fRow?.assists ?? 0) },
        { label: 'ГОЛ + ПАС', value: String(fRow?.points ?? 0), highlight: true },
      ];
    }

    metrics.forEach((met, idx) => {
      const kx = m.padX + 32 + idx * (colW + gap);
      fillBroadcastPanel(
        ctx,
        kx,
        stripY,
        colW,
        stripH,
        12,
        met.highlight ? rgba(theme.goldMid, 0.16) : 'rgba(255,255,255,0.04)',
        met.highlight ? rgba(theme.goldMid, 0.55) : theme.cardBorder,
        1.5,
        false
      );
      drawFittedText(
        ctx,
        met.value,
        kx + colW / 2,
        stripY + 42,
        colW - 16,
        32,
        18,
        met.highlight ? theme.goldLight : theme.textPrimary,
        { align: 'center', weight: 900, family: DISPLAY_FONT }
      );
      drawFittedText(
        ctx,
        met.label,
        kx + colW / 2,
        stripY + 66,
        colW - 14,
        11,
        9,
        theme.textMuted,
        { align: 'center', weight: 700, family: BODY_FONT }
      );
    });
  }

  drawBroadcastFooter(ctx, W, H, db.club, theme);
}

// ---------------------------------------------------------------------------
// PUBLIC RENDER, EXPORT, PACK & SHARE API
// ---------------------------------------------------------------------------
export async function renderPosterToCanvas(
  canvas: HTMLCanvasElement,
  db: ClubDatabase,
  draft: PosterDraft,
  pixelRatio = 1
): Promise<void> {
  await ensureFontsReady();

  const { width: W, height: H } = POSTER_DIMENSIONS[draft.format];
  const targetW = Math.round(W * pixelRatio);
  const targetH = Math.round(H * pixelRatio);

  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.save();
  ctx.scale(pixelRatio, pixelRatio);
  ctx.clearRect(0, 0, W, H);

  const theme = buildBroadcastTheme(draft.theme, db.club);

  // Check if active match has an attached match-action cover photo
  const activeMatch =
    draft.mode === 'results' || draft.mode === 'matchday'
      ? db.matches.find((m) => m.id === draft.matchId) ||
        db.matches.find((m) => (draft.mode === 'results' ? m.status === 'finished' : m.status === 'scheduled')) ||
        db.matches[0]
      : undefined;

  const isEditorialPhotoLayout =
    (draft.mode === 'results' || draft.mode === 'matchday') &&
    (draft.layoutStyle === 'matchtv' || draft.layoutStyle === 'cinematic');

  const coverOverride =
    activeMatch?.coverPhotoUrl && (draft.mode === 'results' || draft.mode === 'matchday')
      ? {
          url: activeMatch.coverPhotoUrl,
          scale: activeMatch.coverPhotoScale ?? 1.02,
          offsetX: activeMatch.coverPhotoOffsetX ?? 0,
          offsetY: activeMatch.coverPhotoOffsetY ?? 0,
        }
      : undefined;

  // For Match TV / Cinematic layouts keep photo bright & crisp (low uniform veil)
  const dimOverride = isEditorialPhotoLayout
    ? Math.max(0.08, (draft.bgOverlayOpacity ?? 0.56) * (draft.layoutStyle === 'cinematic' ? 0.36 : 0.28))
    : undefined;

  await drawBroadcastBackdrop(
    ctx,
    W,
    H,
    theme,
    draft,
    coverOverride,
    draft.layoutStyle === 'cinematic' && (draft.mode === 'results' || draft.mode === 'matchday'),
    dimOverride
  );

  const [mainLogo, altLogo] = await Promise.all([
    loadImage(db.club.logoUrl),
    loadImage(db.club.altLogoUrl),
  ]);

  const useAlt = Boolean(draft.useAltLogo && altLogo);
  const clubLogoSpec: ActiveClubLogoSpec = {
    img: useAlt ? altLogo : mainLogo,
    mask: useAlt ? db.club.altLogoMask : db.club.logoMask,
    scale: useAlt ? db.club.altLogoScale ?? 1.24 : db.club.logoScale ?? 1.27,
    offsetX: useAlt ? db.club.altLogoOffsetX ?? 0 : db.club.logoOffsetX ?? 0,
    offsetY: useAlt ? db.club.altLogoOffsetY ?? 0 : db.club.logoOffsetY ?? 0,
  };

  switch (draft.mode) {
    case 'matchday':
      await renderMatchday(ctx, W, H, db, draft, theme, clubLogoSpec);
      break;
    case 'lineup':
      await renderLineup(ctx, W, H, db, draft, theme, clubLogoSpec);
      break;
    case 'results':
      await renderResults(ctx, W, H, db, draft, theme, clubLogoSpec);
      break;
    case 'scorers':
      await renderScorers(ctx, W, H, db, draft, theme, clubLogoSpec);
      break;
    case 'goalkeepers':
      await renderGoalkeepers(ctx, W, H, db, draft, theme, clubLogoSpec);
      break;
    case 'club_event':
      await renderClubEvent(ctx, W, H, db, draft, theme, clubLogoSpec);
      break;
  }

  // Preview-only VK Stories Safe Zone guide (strictly excluded from pixelRatio >= 2 HD exports)
  if (pixelRatio === 1 && draft.showSafeZones) {
    drawVkSafeZoneGuides(ctx, W, H, draft.format);
  }

  ctx.restore();
}

export async function renderPosterBlob(
  db: ClubDatabase,
  draft: PosterDraft,
  pixelRatio = 2
): Promise<{ blob: Blob; filename: string }> {
  const offscreen = document.createElement('canvas');
  await renderPosterToCanvas(offscreen, db, { ...draft, showSafeZones: false }, pixelRatio);

  const safeClub = (db.club.shortName || 'fortuna')
    .toLowerCase()
    .replace(/[^a-zа-я0-9_-]+/gi, '_');
  const formatKey = draft.format.replace(':', 'x');
  const datePart = new Date().toISOString().slice(0, 10);
  const filename = `${safeClub}_${draft.mode}_${formatKey}_${datePart}.png`;

  const blob = await new Promise<Blob>((resolve, reject) => {
    offscreen.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('PNG blob failed'));
    }, 'image/png');
  });

  return { blob, filename };
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadPosterPng(db: ClubDatabase, draft: PosterDraft): Promise<void> {
  const { blob, filename } = await renderPosterBlob(db, draft, 2);
  triggerBlobDownload(blob, filename);
}

export async function downloadPosterPack(db: ClubDatabase, draft: PosterDraft): Promise<void> {
  const formats: PosterFormat[] = ['4:5', '9:16'];
  for (const fmt of formats) {
    const { blob, filename } = await renderPosterBlob(db, { ...draft, format: fmt }, 2);
    triggerBlobDownload(blob, filename);
    await new Promise((r) => setTimeout(r, 250));
  }
}

export async function copyPosterPngToClipboard(
  db: ClubDatabase,
  draft: PosterDraft
): Promise<'copied' | 'unsupported'> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.clipboard ||
    typeof navigator.clipboard.write !== 'function' ||
    typeof ClipboardItem === 'undefined'
  ) {
    return 'unsupported';
  }
  const { blob } = await renderPosterBlob(db, draft, 2);
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  return 'copied';
}

export async function sharePosterPng(
  db: ClubDatabase,
  draft: PosterDraft,
  captionText?: string
): Promise<'shared' | 'downloaded'> {
  const { blob, filename } = await renderPosterBlob(db, draft, 2);
  const file = new File([blob], filename, { type: 'image/png' });

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title: db.club.name,
        text: captionText,
      });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'shared';
      }
    }
  }

  triggerBlobDownload(blob, filename);
  return 'downloaded';
}
