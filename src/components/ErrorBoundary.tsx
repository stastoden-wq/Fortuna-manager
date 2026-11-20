import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Произошла непредвиденная ошибка интерфейса',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('App ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#090B10] p-6 text-slate-100">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-[#14161C] p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-display text-base font-bold text-white">
                  Ошибка приложения
                </h1>
                <p className="text-xs text-slate-400">
                  Локальные данные в браузере сохранены
                </p>
              </div>
            </div>
            <p className="rounded-xl border border-white/10 bg-[#0E1014] p-3 text-xs text-slate-300 break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#8B1723] px-4 min-h-[44px] text-sm font-bold text-white hover:bg-[#A31D2B] cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Перезагрузить студию</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
