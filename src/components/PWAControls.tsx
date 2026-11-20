import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={`inline-flex items-center gap-2 rounded-lg border border-[#C8B289]/40 bg-[#C8B289]/15 text-[#C8B289] hover:bg-[#C8B289]/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          compact ? 'px-3 py-2 text-xs font-semibold min-h-[40px]' : 'px-4 py-2.5 text-sm font-semibold min-h-[44px]'
        }`}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Установить PWA</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center gap-2 rounded-lg border border-white/15 bg-[#14161C] text-slate-200 hover:border-[#C8B289]/50 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            compact ? 'px-3 py-2 text-xs font-medium min-h-[40px]' : 'px-4 py-2.5 text-sm font-medium min-h-[44px]'
          }`}
        >
          <Smartphone className="w-4 h-4 shrink-0 text-[#C8B289]" />
          <span>На экран iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#14161C] p-6 shadow-2xl">
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-display text-base font-bold text-white">Установка на iPhone / iPad</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                  aria-label="Закрыть"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <ol className="mt-4 space-y-2.5 text-sm text-slate-300 list-decimal list-inside">
                <li>Нажмите кнопку «Поделиться» в нижней панели Safari.</li>
                <li>Прокрутите меню вниз и выберите «На экран “Домой”».</li>
                <li>Подтвердите установку — приложение будет работать полностью офлайн.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-[44px] rounded-xl bg-[#8B1723] text-sm font-bold text-white hover:bg-[#A31D2B] transition-colors cursor-pointer"
              >
                Понятно
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 md:bottom-5 left-4 z-50 flex items-center gap-2 rounded-lg border border-[#C8B289]/40 bg-[#14161C]/95 px-3.5 py-2 text-xs font-medium text-[#C8B289] shadow-lg backdrop-blur-md"
    >
      <WifiOff className="w-4 h-4 text-[#C8B289] shrink-0" />
      <span>Автономный режим — данные сохраняются в браузере</span>
    </div>
  );
};
