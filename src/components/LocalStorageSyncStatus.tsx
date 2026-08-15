import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  RefreshCw, 
  ChevronUp, 
  ChevronDown, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  Cloud, 
  CloudOff, 
  Database,
  ArrowUpCircle,
  Zap,
  Trash2
} from 'lucide-react';
import { useSyncRetryQueue } from '../hooks/useSyncRetryQueue';

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
  const [isFlushing, setIsFlushing] = useState(false);

  const {
    tasks,
    pendingCount,
    highPriorityCount,
    failedCount,
    isProcessing,
    isOnline,
    lastSuccessfulSyncAt,
    flushQueue,
    retryTask,
    clearQueue
  } = useSyncRetryQueue();

  // Trigger visual highlight pulse when lastSyncTime changes or successful cloud sync happens
  useEffect(() => {
    if (lastSyncTime || lastSuccessfulSyncAt) {
      setIsJustSynced(true);
      const timer = setTimeout(() => setIsJustSynced(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastSyncTime, lastSuccessfulSyncAt]);

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
  }, [lastSyncTime, isExpanded, pendingCount]);

  const handleManualFlush = async () => {
    setIsFlushing(true);
    try {
      await flushQueue(true);
      if (onManualSync) onManualSync();
    } finally {
      setIsFlushing(false);
    }
  };

  const displayTime = lastSyncTime || 'Sincronizando...';
  const formatTime = (ts: number) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (_) {
      return '';
    }
  };

  return (
    <div className={`fixed bottom-4 right-4 z-40 ${className}`} id="localstorage-sync-indicator">
      <div className="relative">
        {/* Expanded Details Card */}
        {isExpanded && (
          <div className="absolute bottom-full right-0 mb-2 w-84 sm:w-96 bg-slate-900/98 text-white backdrop-blur-md border border-slate-700/90 rounded-2xl p-4 shadow-2xl text-xs space-y-3 animate-in fade-in slide-in-from-bottom-2">
            
            {/* Card Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  {isOnline ? <Cloud size={16} /> : <CloudOff size={16} />}
                </div>
                <div>
                  <h4 className="font-extrabold text-white text-xs">Sincronização e Fila de Re-tentativa</h4>
                  <p className="text-[10px] text-slate-400">Supabase & Firestore com Auto-Reenvio</p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                {storageUsage}
              </span>
            </div>

            {/* Network & Queue Health Status Banner */}
            <div className="grid grid-cols-2 gap-2">
              <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                isOnline ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300' : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
              }`}>
                {isOnline ? <Wifi size={15} className="text-emerald-400 shrink-0" /> : <WifiOff size={15} className="text-rose-400 shrink-0" />}
                <div className="min-w-0">
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Rede</span>
                  <strong className="text-[11px] truncate block">{isOnline ? 'Online (Conectado)' : 'Offline (Sem Sinal)'}</strong>
                </div>
              </div>

              <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                pendingCount > 0 ? 'bg-amber-950/40 border-amber-800/60 text-amber-300' : 'bg-slate-800/60 border-slate-700/60 text-slate-300'
              }`}>
                <RefreshCw size={15} className={`shrink-0 ${isProcessing || isFlushing ? 'animate-spin text-sky-400' : pendingCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`} />
                <div className="min-w-0">
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Fila Nuvem</span>
                  <strong className="text-[11px] truncate block">
                    {pendingCount === 0 ? 'Tudo Sincronizado' : `${pendingCount} pendente${pendingCount > 1 ? 's' : ''}`}
                  </strong>
                </div>
              </div>
            </div>

            {/* High Priority Warning Banner if any */}
            {highPriorityCount > 0 && (
              <div className="bg-rose-950/50 border border-rose-800/70 p-2.5 rounded-xl flex items-center gap-2 text-rose-200 text-[11px]">
                <Zap size={14} className="text-rose-400 shrink-0 animate-bounce" />
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-white">{highPriorityCount} baixa(s) com prioridade ALTA na fila.</span>
                  <span className="block text-[10px] text-rose-300/90">Serão salvas primeiro assim que a conexão responder.</span>
                </div>
              </div>
            )}

            {/* Pending Tasks List in Retry Queue */}
            {pendingCount > 0 && (
              <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar pr-1">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-400 px-1">
                  <span>Itens Aguardando Reenvio ({pendingCount})</span>
                  {failedCount > 0 && <span className="text-amber-400">{failedCount} com falha temporária</span>}
                </div>
                {tasks.map((task) => (
                  <div 
                    key={task.id} 
                    className="p-2 bg-slate-800/90 rounded-xl border border-slate-700/70 flex items-center justify-between gap-2 text-[11px]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-white font-mono">
                          #{task.orderId.replace('ped-', '').toUpperCase()}
                        </span>
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full uppercase ${
                          task.priority === 'HIGH' 
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' 
                            : 'bg-slate-700 text-slate-300'
                        }`}>
                          {task.priority === 'HIGH' ? 'Alta Prioridade' : 'Normal'}
                        </span>
                        {task.orderData?.status && (
                          <span className="text-[9px] text-slate-400 truncate">
                            • {task.orderData.status}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span>Tentativa {task.retryCount + 1}/{task.maxRetries}</span>
                        {task.lastError && (
                          <span className="text-amber-400/90 truncate max-w-[150px]" title={task.lastError}>
                            • {task.lastError}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => retryTask(task.id)}
                      disabled={isProcessing || isFlushing}
                      className="p-1.5 bg-slate-700 hover:bg-sky-600 text-slate-200 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
                      title="Reenviar este pedido agora"
                    >
                      <RefreshCw size={12} className={isProcessing ? 'animate-spin' : ''} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* LocalStorage & Cloud Timestamps */}
            <div className="bg-slate-800/70 p-2.5 rounded-xl border border-slate-700/50 space-y-1 text-[11px]">
              <div className="flex items-center justify-between text-slate-300">
                <div className="flex items-center gap-1.5">
                  <Clock size={12} className="text-sky-400 shrink-0" />
                  <span>Último backup local:</span>
                </div>
                <span className="font-mono font-bold text-emerald-400">{displayTime}</span>
              </div>

              {lastSuccessfulSyncAt && (
                <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-700/40">
                  <div className="flex items-center gap-1.5">
                    <Cloud size={12} className="text-emerald-400 shrink-0" />
                    <span>Último sync em nuvem:</span>
                  </div>
                  <span className="font-mono font-bold text-sky-400">{formatTime(lastSuccessfulSyncAt)}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleManualFlush}
                disabled={isProcessing || isFlushing}
                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-[11px] rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
              >
                <RefreshCw size={12} className={isProcessing || isFlushing ? 'animate-spin' : ''} />
                <span>{pendingCount > 0 ? 'Sincronizar Fila Agora' : 'Forçar Sincronização Geral'}</span>
              </button>

              {pendingCount > 0 && (
                <button
                  type="button"
                  onClick={clearQueue}
                  className="p-2 bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-200 border border-slate-700 rounded-xl transition-colors cursor-pointer"
                  title="Limpar itens com falha da fila"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Floating Pill Badge */}
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          className={`cursor-pointer select-none flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-lg backdrop-blur-md transition-all ${
            !isOnline
              ? 'bg-slate-900 text-amber-300 border-amber-500/60 ring-2 ring-amber-500/20'
              : pendingCount > 0
              ? 'bg-slate-900 text-amber-300 border-amber-500/60 ring-2 ring-amber-500/20'
              : isJustSynced
              ? 'bg-slate-900 text-emerald-300 border-emerald-500/60 ring-2 ring-emerald-500/20 scale-102'
              : 'bg-slate-900/90 text-slate-200 border-slate-700/80 hover:border-slate-600 hover:bg-slate-900'
          }`}
          title="Clique para ver o status da sincronização e fila de re-tentativa"
        >
          {/* Icon indicator */}
          <div className="relative flex items-center justify-center">
            {!isOnline ? (
              <WifiOff size={14} className="text-amber-400 shrink-0" />
            ) : isProcessing || isFlushing ? (
              <RefreshCw size={14} className="text-sky-400 animate-spin shrink-0" />
            ) : pendingCount > 0 ? (
              <Cloud size={14} className="text-amber-400 shrink-0" />
            ) : (
              <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
            )}
            <span className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full animate-ping opacity-75 ${
              !isOnline ? 'bg-amber-400' : pendingCount > 0 ? 'bg-amber-400' : 'bg-emerald-400'
            }`} />
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-medium">
            {!isOnline ? (
              <>
                <span className="font-bold text-amber-400">Offline</span>
                {pendingCount > 0 && <span className="font-mono text-xs">({pendingCount} na fila)</span>}
              </>
            ) : pendingCount > 0 ? (
              <>
                <span className="text-amber-300 font-bold">Fila:</span>
                <span className="font-mono font-bold text-amber-400">{pendingCount}</span>
                {highPriorityCount > 0 && (
                  <span className="text-[10px] bg-rose-500/30 text-rose-300 px-1 rounded font-bold">
                    ⚡ {highPriorityCount}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="hidden sm:inline text-slate-300 font-semibold">Sincronizado:</span>
                <span className="font-mono font-bold text-emerald-400">{displayTime}</span>
              </>
            )}
          </div>

          <div className="p-0.5 rounded-full text-slate-400 hover:text-white">
            {isExpanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </div>
        </div>
      </div>
    </div>
  );
}
