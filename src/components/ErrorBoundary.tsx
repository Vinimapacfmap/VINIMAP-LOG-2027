import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    console.error('[ViniMap ErrorBoundary] Capturado erro no getDerivedStateFromError:', error);
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ViniMap ErrorBoundary] Uncaught Error em ViniMap App:', {
      error,
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
    });
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    window.location.reload();
  };

  private handleClearAndReload = () => {
    try {
      localStorage.removeItem('vinimap_logged_out');
      localStorage.setItem('vinimap_admin_session', 'true');
    } catch (_) {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white font-sans">
          <div className="max-w-lg w-full bg-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-700 space-y-5 text-center">
            <div className="mx-auto w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-400">
              <AlertTriangle size={32} />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-xl font-bold tracking-tight text-white">
                Ocorreu um erro ao carregar a página
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                Um problema inesperado impediu a exibição do painel. Você pode recarregar ou restaurar o acesso local.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-slate-950/80 rounded-xl text-left border border-slate-800 text-[11px] font-mono text-red-300 overflow-x-auto max-h-36">
                <p className="font-bold">{this.state.error.toString()}</p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="text-[10px] text-slate-500 mt-1 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-3 px-4 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <RefreshCw size={16} /> Recarregar Página
              </button>
              <button
                onClick={this.handleClearAndReload}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl py-3 px-4 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <LogOut size={16} /> Restaurar Painel
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
