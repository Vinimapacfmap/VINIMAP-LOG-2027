import React, { useState, useEffect } from 'react';
import { CheckCircle2, Clock, ShieldCheck, RefreshCw, ChevronUp, ChevronDown, HardDrive } from 'lucide-react';

export interface LocalStorageSyncStatusProps {
  lastSyncTime: string;
  onManualSync?: () => void;
  className?: string;
}

export default function LocalStorageSyncStatus({
  lastSyncTime,
  onManualSync,
  className = ''
}: LocalStorageSyncStatusProps) {
  const [isJustSynced, setIsJustSynced] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [storageUsage, setStorageUsage] = useState<string>('0 KB');

  // Trigger visual highlight pulse when lastSyncTime changes
  useEffect(() => {
    if (lastSyncTime) {
      setIsJustSynced(true);
      const timer = setTimeout(() => setIsJustSynced(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastSyncTime]);

  // Calculate approximate size of localStorage items starting with 'vinimap'
  useEffect(() => {
    try {
      let totalBytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('vinimap')) {
          const val = localStorage.getItem(key) || '';
          totalBytes += key.length + val.length;
        }
      }
      const kb = (totalBytes / 1024).toFixed(1);
      setStorageUsage(`${kb} KB`);
    } catch (e) {
      setStorageUsage('OK');
    }
  }, [lastSyncTime, isExpanded]);

  const displayTime = lastSyncTime || 'Sincronizando...';

  return (
    <div className={`fixed bottom-4 right-4 z-40 ${className}`} id="localstorage-sync-indicator">
      <div className="relative">
        {/* Expanded Details Card */}
        {isExpanded && (
          <div className="absolute bottom-full right-0 mb-2 w-72 bg-slate-900/95 text-white backdrop-blur-md border border-slate-700/80 rounded-2xl p-3.5 shadow-2xl text-xs space-y-2.5 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                <span className="font-extrabold text-white text-xs">Dados Seguros em LocalStorage</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                {storageUsage}
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              Pedidos, clientes e rotas são salvos continuamente no armazenamento local do seu navegador para prevenção de perdas.
            </p>

            <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/50 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 text-slate-300">
                <Clock size={13} className="text-blue-400 shrink-0" />
                <span>Último auto-salvamento:</span>
              </div>
              <span className="font-mono font-bold text-emerald-400">{displayTime}</span>
            </div>

            {onManualSync && (
              <button
                type="button"
                onClick={() => {
                  onManualSync();
                }}
                className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                <RefreshCw size={12} />
                <span>Forçar Sincronização Local</span>
              </button>
            )}
          </div>
        )}

        {/* Floating Pill Badge */}
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          className={`cursor-pointer select-none flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-lg backdrop-blur-md transition-all ${
            isJustSynced
              ? 'bg-slate-900 text-emerald-300 border-emerald-500/60 ring-2 ring-emerald-500/20 scale-102'
              : 'bg-slate-900/90 text-slate-200 border-slate-700/80 hover:border-slate-600 hover:bg-slate-900'
          }`}
          title="Clique para ver o status da sincronização no LocalStorage"
        >
          {/* Icon indicator */}
          <div className="relative flex items-center justify-center">
            {isJustSynced ? (
              <CheckCircle2 size={14} className="text-emerald-400 animate-pulse shrink-0" />
            ) : (
              <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
            )}
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping opacity-75" />
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-medium">
            <span className="hidden sm:inline text-slate-300 font-semibold">LocalStorage:</span>
            <span className="font-mono font-bold text-emerald-400">{displayTime}</span>
          </div>

          <div className="p-0.5 rounded-full text-slate-400 hover:text-white">
            {isExpanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </div>
        </div>
      </div>
    </div>
  );
}
