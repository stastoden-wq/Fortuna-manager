import React, { useRef, useState } from 'react';
import { RotateCcw, Trash2, Upload } from 'lucide-react';
import { LogoMaskMode } from '../types/club';
import { processImageUpload } from '../lib/storage';
import { resolveAssetUrl } from '../lib/assetUrl';

interface ImageCropperControlProps {
  label: string;
  hint?: string;
  imageUrl: string;
  scale: number;
  offsetX: number;
  offsetY: number;
  aspect?: 'square' | 'portrait' | 'landscape';
  fitMode?: 'contain' | 'cover';
  maskPreview?: LogoMaskMode;
  darkBackdrop?: boolean;
  onChange: (patch: {
    imageUrl?: string;
    scale?: number;
    offsetX?: number;
    offsetY?: number;
  }) => void;
}

export const ImageCropperControl: React.FC<ImageCropperControlProps> = ({
  label,
  hint,
  imageUrl,
  scale,
  offsetX,
  offsetY,
  aspect = 'portrait',
  fitMode = 'contain',
  maskPreview = 'none',
  darkBackdrop = true,
  onChange,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setLoading(true);
    try {
      const dataUrl = await processImageUpload(file, 1600);
      onChange({ imageUrl: dataUrl, scale: 1, offsetX: 0, offsetY: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки файла');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const resetCrop = () => {
    onChange({ scale: 1, offsetX: 0, offsetY: 0 });
  };

  const aspectClass =
    aspect === 'portrait'
      ? 'aspect-[4/5]'
      : aspect === 'landscape'
      ? 'aspect-[16/10]'
      : 'aspect-square';

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-[#0E1014] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B1723] px-3 py-2 text-xs font-semibold text-white hover:bg-[#A31D2B] transition-colors min-h-[38px] whitespace-nowrap cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{loading ? 'Загрузка…' : imageUrl ? 'Заменить' : 'Загрузить'}</span>
          </button>
          {imageUrl && (
            <button
              type="button"
              onClick={() => onChange({ imageUrl: '', scale: 1, offsetX: 0, offsetY: 0 })}
              className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-[#181B22] text-slate-300 hover:text-rose-300 hover:border-rose-500/40 min-h-[38px] min-w-[38px] transition-colors cursor-pointer"
              title="Удалить изображение"
              aria-label="Удалить изображение"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={handleFile}
          className="hidden"
        />
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-4 items-center">
        {/* Live Framed Cropper Preview */}
        <div
          className={`relative mx-auto w-full max-w-[140px] overflow-hidden border border-[#C8B289]/35 ${aspectClass} ${
            maskPreview === 'circle' ? 'rounded-full' : 'rounded-xl'
          } ${
            darkBackdrop
              ? 'bg-[radial-gradient(circle_at_50%_30%,#27181B,#0E1014)]'
              : 'bg-slate-200'
          }`}
        >
          <div className="pointer-events-none absolute inset-0 z-10 border border-dashed border-white/15" />
          <div className="pointer-events-none absolute inset-x-0 top-1/3 z-10 h-px bg-white/10" />
          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-px bg-white/10" />

          {imageUrl ? (
            <img
              src={resolveAssetUrl(imageUrl)}
              alt={label}
              referrerPolicy="no-referrer"
              className={`h-full w-full select-none pointer-events-none ${
                fitMode === 'cover' ? 'object-cover' : 'object-contain'
              }`}
              style={{
                transform: `translate(${offsetX * 0.5}%, ${offsetY * 0.5}%) scale(${scale})`,
                transformOrigin: 'center center',
              }}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center p-3 text-center text-xs text-slate-400">
              <span>Нет фото</span>
            </div>
          )}
        </div>

        {/* Sliders */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
              <span>Масштаб</span>
              <span className="tabular-nums font-semibold text-white">{Math.round(scale * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={2.2}
              step={0.02}
              value={scale}
              onChange={(e) => onChange({ scale: parseFloat(e.target.value) })}
              className="w-full accent-[#C8B289] cursor-pointer"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
              <span>Сдвиг X (влево / вправо)</span>
              <span className="tabular-nums font-semibold text-white">
                {offsetX > 0 ? `+${offsetX}` : offsetX}%
              </span>
            </div>
            <input
              type="range"
              min={-80}
              max={80}
              step={1}
              value={offsetX}
              onChange={(e) => onChange({ offsetX: parseInt(e.target.value, 10) })}
              className="w-full accent-[#C8B289] cursor-pointer"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
              <span>Сдвиг Y (вверх / вниз)</span>
              <span className="tabular-nums font-semibold text-white">
                {offsetY > 0 ? `+${offsetY}` : offsetY}%
              </span>
            </div>
            <input
              type="range"
              min={-80}
              max={80}
              step={1}
              value={offsetY}
              onChange={(e) => onChange({ offsetY: parseInt(e.target.value, 10) })}
              className="w-full accent-[#C8B289] cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={resetCrop}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Сбросить кадрирование</span>
          </button>
        </div>
      </div>
    </div>
  );
};
