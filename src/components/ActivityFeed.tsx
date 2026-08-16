/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { ActivityLog } from '../types';
import { 
  Bell, 
  CheckCircle2, 
  Info, 
  AlertTriangle, 
  Clock, 
  ShieldAlert,
  ArrowUpRight,
  ArrowDown,
  ArrowUp
} from 'lucide-react';
import { motion } from 'motion/react';

interface ActivityFeedProps {
  logs: ActivityLog[];
  onViewLogsClick?: () => void;
}

export default function ActivityFeed({ logs, onViewLogsClick }: ActivityFeedProps) {
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const sortedLogs = useMemo(() => {
    const copy = [...logs];
    return sortOrder === 'desc' ? copy : copy.reverse();
  }, [logs, sortOrder]);
  
  const getLogTypeStyles = (type: string) => {
    switch (type) {
      case 'success':
        return {
          iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
          dot: 'bg-emerald-500',
          icon: CheckCircle2
        };
      case 'warning':
        return {
          iconBg: 'bg-amber-50 text-amber-600 border-amber-100',
          dot: 'bg-amber-500',
          icon: AlertTriangle
        };
      case 'danger':
        return {
          iconBg: 'bg-rose-50 text-rose-600 border-rose-100',
          dot: 'bg-rose-500',
          icon: ShieldAlert
        };
      default:
        return {
          iconBg: 'bg-blue-50 text-blue-600 border-blue-100',
          dot: 'bg-blue-500',
          icon: Info
        };
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 flex flex-col justify-between" id="activity-feed-card">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Monitoramento de Atividades</h3>
            <p className="text-xs text-slate-400 mt-0.5">Histórico operacional da central em tempo real</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
              title={sortOrder === 'desc' ? 'Mais recentes primeiro (clique para inverter)' : 'Mais antigos primeiro (clique para inverter)'}
            >
              {sortOrder === 'desc' ? <ArrowDown size={12} className="text-blue-600" /> : <ArrowUp size={12} className="text-blue-600" />}
              <span>{sortOrder === 'desc' ? 'Recentes' : 'Antigos'}</span>
            </button>
            <div className="p-1.5 rounded-lg bg-slate-50 text-slate-500">
              <Bell size={16} />
            </div>
          </div>
        </div>

        {/* Timeline Event list */}
        <div className="relative pl-6 space-y-5" id="timeline-events-container">
          {/* Vertical joining timeline line */}
          <div className="absolute left-2.5 top-2.5 bottom-2.5 w-0.5 bg-slate-100" />

          {sortedLogs.map((log, idx) => {
            const styles = getLogTypeStyles(log.type);
            const Icon = styles.icon;

            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                className="relative flex items-start gap-3.5 group"
                id={`activity-timeline-item-${log.id}`}
              >
                {/* Timeline interactive status circle dot on line */}
                <div className={`absolute -left-[20px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white ring-4 ring-slate-50 transition-transform group-hover:scale-125 z-10 ${styles.dot}`} />

                {/* Event visual avatar / icon badge */}
                <div className={`p-1.5 rounded-lg border shrink-0 ${styles.iconBg}`}>
                  <Icon size={14} />
                </div>

                {/* Content body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[11px] font-mono text-slate-400 font-bold">
                      {log.time}
                    </span>
                    {log.orderId && (
                      <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono font-bold uppercase transition-colors group-hover:bg-blue-50 group-hover:text-blue-600">
                        {log.orderId}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed font-semibold group-hover:text-slate-800 transition-colors">
                    {log.message}
                  </p>
                </div>
              </motion.div>
            );
          })}

          {logs.length === 0 && (
            <div className="text-center py-6 text-xs text-slate-400 font-semibold">
              Nenhuma atividade registrada hoje.
            </div>
          )}
        </div>
      </div>

      {/* Footer with summary metadata */}
      {onViewLogsClick && (
        <div className="mt-6 pt-4 border-t border-slate-50 text-center">
          <button 
            onClick={onViewLogsClick}
            className="text-[11px] text-blue-600 hover:text-blue-700 font-extrabold uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5 mx-auto"
          >
            <span>Ver Logs Consolidados</span>
            <ArrowUpRight size={12} />
          </button>
        </div>
      )}

    </div>
  );
}
