import React, { Component, ErrorInfo, ReactNode } from 'react';
import '../utils/leafletPatch';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SafeMapWrapper extends Component<Props, State> {
  override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('Leaflet Map Error caught safely in SafeMapWrapper:', error, errorInfo);
  }

  public override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="w-full h-full min-h-[300px] bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center p-6 text-center text-slate-300">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
            ⚠️ Reiniciando Renderização do Mapa
          </p>
          <p className="text-[11px] text-slate-400 max-w-md">
            Detectada interrupção na camada gráfica do Leaflet. Clique abaixo para reestabilizar a visualização.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-lg transition-all cursor-pointer shadow-md"
          >
            Reativar Mapa
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default SafeMapWrapper;
