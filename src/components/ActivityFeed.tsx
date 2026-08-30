/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { ActivityLog } from '../types';
import { 
  Bell, 
  CheckCircle2, 
  Info, 
  AlertTriangle, 
  ShieldAlert,
  ArrowDown,
  ArrowUp,
  Search,
  Filter,
  Calendar,
  Package,
  RotateCcw,
  Download,
  Copy,
  Check,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getSaoPauloISODate, getSaoPauloDate, formatToBrazilianDate } from '../utils/dateUtils';

interface ActivityFeedProps {
  logs: ActivityLog[];
  onViewLogsClick?: () => void;
}

type FilterType = 'all' | 'success' | 'warning' | 'danger' | 'info';

export const isPushErrorLog = (log: ActivityLog): boolean => {
  const text = `${log.message} ${log.type} ${log.orderId || ''}`.toLowerCase();
  return (
    text.includes('falha de notificação') ||
    text.includes('falha de notificacao') ||
    text.includes('push delivery error') ||
    text.includes('falha no push') ||
    text.includes('falha de push') ||
    text.includes('push delivery failed') ||
    text.includes('erro de sincronização') ||
    text.includes('erro de sincronizacao') ||
    (log.type === 'danger' && text.includes('push'))
  );
};

export default function ActivityFeed({ logs, onViewLogsClick }: ActivityFeedProps) {
  // Filter States
  const [selectedType, setSelectedType] = useState<FilterType>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [orderIdFilter, setOrderIdFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [isPushErrorsOnly, setIsPushErrorsOnly] = useState<boolean>(false);
  
  // UI & Pagination States
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(true);

  // Helper to resolve ISO Date for any log entry
  const getLogIsoDate = (log: ActivityLog): string => {
    if (log.date && /^\d{4}-\d{2}-\d{2}$/.test(log.date.trim())) {
      return log.date.trim();
    }
    if (log.createdAt) {
      try {
        const d = getSaoPauloISODate(log.createdAt);
        if (d) return d;
      } catch (e) {
        // ignore
      }
    }
    if (log.time) {
      const raw = log.time.trim();
      const isoMatch = raw.match(/(\d{4}-\d{2}-\d{2})/);
      if (isoMatch) return isoMatch[1];
      const brMatch = raw.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
      if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
    }
    return getSaoPauloISODate();
  };

  // Collect unique order IDs present in the log history for easy suggestion
  const uniqueOrderIds = useMemo(() => {
    const ids = new Set<string>();
    logs.forEach(log => {
      if (log.orderId && log.orderId.trim()) {
        ids.add(log.orderId.trim());
      }
      // Also extract #ped-... or #ZCO-... from message
      const matches = log.message.match(/#([a-zA-Z0-9_-]+)/g);
      if (matches) {
        matches.forEach(m => ids.add(m.replace('#', '')));
      }
    });
    return Array.from(ids);
  }, [logs]);

  // Statistics counters
  const stats = useMemo(() => {
    let success = 0;
    let warning = 0;
    let danger = 0;
    let info = 0;
    let pushErrors = 0;

    logs.forEach(log => {
      if (isPushErrorLog(log)) pushErrors++;
      if (log.type === 'success') success++;
      else if (log.type === 'warning') warning++;
      else if (log.type === 'danger') danger++;
      else info++;
    });

    return { total: logs.length, success, warning, danger, info, pushErrors };
  }, [logs]);

  // Filter application
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // 0. Dedicated Filter: Push Delivery Errors & Sync Failures
      if (isPushErrorsOnly) {
        if (!isPushErrorLog(log)) {
          return false;
        }
      }

      // 1. Filter by Log Type
      if (selectedType !== 'all' && log.type !== selectedType) {
        return false;
      }

      // 2. Filter by Specific Order ID
      if (orderIdFilter.trim()) {
        const queryNorm = orderIdFilter.trim().toLowerCase().replace(/^#/, '');
        const logOrderNorm = (log.orderId || '').toLowerCase().replace(/^#/, '');
        const messageNorm = log.message.toLowerCase();
        
        const matchDirect = logOrderNorm.includes(queryNorm);
        const matchMessage = messageNorm.includes(queryNorm) || messageNorm.includes(`#${queryNorm}`);
        
        if (!matchDirect && !matchMessage) {
          return false;
        }
      }

      // 3. Filter by Date Interval
      const logDate = getLogIsoDate(log);
      if (startDate && logDate < startDate) {
        return false;
      }
      if (endDate && logDate > endDate) {
        return false;
      }

      // 4. Filter by General Search Query (message text)
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const text = `${log.message} ${log.orderId || ''} ${log.time || ''} ${log.type}`.toLowerCase();
        if (!text.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [logs, selectedType, orderIdFilter, startDate, endDate, searchQuery, isPushErrorsOnly]);

  // Sorting
  const sortedLogs = useMemo(() => {
    const copy = [...filteredLogs];
    return sortOrder === 'desc' ? copy : copy.reverse();
  }, [filteredLogs, sortOrder]);

  // Paginated slice
  const totalPages = Math.ceil(sortedLogs.length / pageSize) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedLogs.slice(start, start + pageSize);
  }, [sortedLogs, currentPage, pageSize]);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (isPushErrorsOnly) count++;
    if (selectedType !== 'all') count++;
    if (startDate) count++;
    if (endDate) count++;
    if (orderIdFilter.trim()) count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [selectedType, startDate, endDate, orderIdFilter, searchQuery, isPushErrorsOnly]);

  // Reset all filters
  const handleResetFilters = () => {
    setIsPushErrorsOnly(false);
    setSelectedType('all');
    setStartDate('');
    setEndDate('');
    setOrderIdFilter('');
    setSearchQuery('');
    setCurrentPage(1);
  };

  // Quick Date Preset Helpers
  const applyDatePreset = (preset: 'today' | 'yesterday' | 'last7' | 'last30' | 'all') => {
    const today = new Date();
    const formatIso = (d: Date) => getSaoPauloISODate(d);

    if (preset === 'today') {
      const t = formatIso(today);
      setStartDate(t);
      setEndDate(t);
    } else if (preset === 'yesterday') {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const yStr = formatIso(y);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === 'last7') {
      const past = new Date(today);
      past.setDate(past.getDate() - 6);
      setStartDate(formatIso(past));
      setEndDate(formatIso(today));
    } else if (preset === 'last30') {
      const past = new Date(today);
      past.setDate(past.getDate() - 29);
      setStartDate(formatIso(past));
      setEndDate(formatIso(today));
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
    setCurrentPage(1);
  };

  // Copy to clipboard helper
  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Export filtered logs to CSV
  const handleExportCsv = () => {
    if (sortedLogs.length === 0) return;
    
    const headers = ['ID', 'Data/Hora', 'Tipo', 'ID Pedido', 'Mensagem'];
    const rows = sortedLogs.map(l => [
      `"${l.id}"`,
      `"${l.time}"`,
      `"${l.type}"`,
      `"${l.orderId || ''}"`,
      `"${l.message.replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `vinimap_logs_${getSaoPauloISODate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getLogTypeStyles = (type: string) => {
    switch (type) {
      case 'success':
        return {
          label: 'Sucesso',
          badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          iconBg: 'bg-emerald-100 text-emerald-600 border-emerald-200',
          dot: 'bg-emerald-500',
          borderLeft: 'border-l-emerald-500',
          icon: CheckCircle2
        };
      case 'warning':
        return {
          label: 'Alerta',
          badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
          iconBg: 'bg-amber-100 text-amber-600 border-amber-200',
          dot: 'bg-amber-500',
          borderLeft: 'border-l-amber-500',
          icon: AlertTriangle
        };
      case 'danger':
        return {
          label: 'Erro / Crítico',
          badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
          iconBg: 'bg-rose-100 text-rose-600 border-rose-200',
          dot: 'bg-rose-500',
          borderLeft: 'border-l-rose-500',
          icon: ShieldAlert
        };
      default:
        return {
          label: 'Informativo',
          badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
          iconBg: 'bg-blue-100 text-blue-600 border-blue-200',
          dot: 'bg-blue-500',
          borderLeft: 'border-l-blue-500',
          icon: Info
        };
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden flex flex-col space-y-0" id="activity-monitoring-system">
      
      {/* 1. TOP SUMMARY KPI CARDS & TYPE FILTER CHIPS */}
      <div className="p-5 bg-gradient-to-b from-slate-50/80 to-white border-b border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-600 text-white rounded-xl shadow-sm">
                <Bell size={18} />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-base">Monitoramento e Auditoria de Atividades</h3>
                <p className="text-xs text-slate-500 font-medium">Histórico operacional da central, notificações e registros de eventos em tempo real</p>
              </div>
            </div>
          </div>

          {/* Action Buttons: Toggle Filters, Export & Ordering */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(prev => !prev)}
              className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                showAdvancedFilters 
                  ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-xs' 
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title="Exibir ou ocultar barra de filtros avançados"
            >
              <SlidersHorizontal size={14} className={showAdvancedFilters ? 'text-blue-600' : 'text-slate-500'} />
              <span>Filtros Avançados</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-black flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title={sortOrder === 'desc' ? 'Ordenado: Mais Recentes Primeiro' : 'Ordenado: Mais Antigos Primeiro'}
            >
              {sortOrder === 'desc' ? <ArrowDown size={14} className="text-blue-600" /> : <ArrowUp size={14} className="text-blue-600" />}
              <span>{sortOrder === 'desc' ? 'Mais Recentes' : 'Mais Antigos'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={sortedLogs.length === 0}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title="Exportar logs filtrados em planilha CSV"
            >
              <Download size={14} />
              <span>Exportar ({sortedLogs.length})</span>
            </button>
          </div>
        </div>

        {/* Quick Type Filter KPI Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
          {/* Total */}
          <button
            type="button"
            onClick={() => {
              setIsPushErrorsOnly(false);
              setSelectedType('all');
              setCurrentPage(1);
            }}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
              !isPushErrorsOnly && selectedType === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
            }`}
          >
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${!isPushErrorsOnly && selectedType === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
                Todos os Logs
              </span>
              <span className="text-base font-extrabold">{stats.total}</span>
            </div>
            <div className={`p-1.5 rounded-lg ${!isPushErrorsOnly && selectedType === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
              <Bell size={14} />
            </div>
          </button>

          {/* Success */}
          <button
            type="button"
            onClick={() => {
              setIsPushErrorsOnly(false);
              setSelectedType(prev => prev === 'success' ? 'all' : 'success');
              setCurrentPage(1);
            }}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
              !isPushErrorsOnly && selectedType === 'success'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-600/20'
                : 'bg-emerald-50/40 text-emerald-900 border-emerald-200/80 hover:bg-emerald-50'
            }`}
          >
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${!isPushErrorsOnly && selectedType === 'success' ? 'text-emerald-100' : 'text-emerald-700'}`}>
                Sucesso
              </span>
              <span className="text-base font-extrabold">{stats.success}</span>
            </div>
            <div className={`p-1.5 rounded-lg ${!isPushErrorsOnly && selectedType === 'success' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-600'}`}>
              <CheckCircle2 size={14} />
            </div>
          </button>

          {/* Warning */}
          <button
            type="button"
            onClick={() => {
              setIsPushErrorsOnly(false);
              setSelectedType(prev => prev === 'warning' ? 'all' : 'warning');
              setCurrentPage(1);
            }}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
              !isPushErrorsOnly && selectedType === 'warning'
                ? 'bg-amber-500 text-white border-amber-500 shadow-md ring-2 ring-amber-500/20'
                : 'bg-amber-50/40 text-amber-900 border-amber-200/80 hover:bg-amber-50'
            }`}
          >
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${!isPushErrorsOnly && selectedType === 'warning' ? 'text-amber-100' : 'text-amber-700'}`}>
                Alertas
              </span>
              <span className="text-base font-extrabold">{stats.warning}</span>
            </div>
            <div className={`p-1.5 rounded-lg ${!isPushErrorsOnly && selectedType === 'warning' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-700'}`}>
              <AlertTriangle size={14} />
            </div>
          </button>

          {/* Danger */}
          <button
            type="button"
            onClick={() => {
              setIsPushErrorsOnly(false);
              setSelectedType(prev => prev === 'danger' ? 'all' : 'danger');
              setCurrentPage(1);
            }}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
              !isPushErrorsOnly && selectedType === 'danger'
                ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-600/20'
                : 'bg-rose-50/40 text-rose-900 border-rose-200/80 hover:bg-rose-50'
            }`}
          >
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${!isPushErrorsOnly && selectedType === 'danger' ? 'text-rose-100' : 'text-rose-700'}`}>
                Erros / Crítico
              </span>
              <span className="text-base font-extrabold">{stats.danger}</span>
            </div>
            <div className={`p-1.5 rounded-lg ${!isPushErrorsOnly && selectedType === 'danger' ? 'bg-rose-700 text-white' : 'bg-rose-100 text-rose-600'}`}>
              <ShieldAlert size={14} />
            </div>
          </button>

          {/* Info */}
          <button
            type="button"
            onClick={() => {
              setIsPushErrorsOnly(false);
              setSelectedType(prev => prev === 'info' ? 'all' : 'info');
              setCurrentPage(1);
            }}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
              !isPushErrorsOnly && selectedType === 'info'
                ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-600/20'
                : 'bg-blue-50/40 text-blue-900 border-blue-200/80 hover:bg-blue-50'
            }`}
          >
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${!isPushErrorsOnly && selectedType === 'info' ? 'text-blue-100' : 'text-blue-700'}`}>
                Informativo
              </span>
              <span className="text-base font-extrabold">{stats.info}</span>
            </div>
            <div className={`p-1.5 rounded-lg ${!isPushErrorsOnly && selectedType === 'info' ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-600'}`}>
              <Info size={14} />
            </div>
          </button>

          {/* Falhas de Notificação / Push Delivery Errors Filter Chip */}
          <button
            type="button"
            onClick={() => {
              setIsPushErrorsOnly(prev => !prev);
              setSelectedType('all');
              setCurrentPage(1);
            }}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
              isPushErrorsOnly
                ? 'bg-red-700 text-white border-red-700 shadow-md ring-2 ring-red-700/30'
                : stats.pushErrors > 0
                ? 'bg-rose-50/80 text-rose-950 border-rose-300 hover:bg-rose-100 animate-pulse'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
            title="Filtrar erros de sincronização e falhas de notificação push"
          >
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${isPushErrorsOnly ? 'text-rose-100' : stats.pushErrors > 0 ? 'text-rose-800' : 'text-slate-500'}`}>
                Falhas de Push
              </span>
              <span className="text-base font-extrabold">{stats.pushErrors}</span>
            </div>
            <div className={`p-1.5 rounded-lg ${isPushErrorsOnly ? 'bg-red-800 text-white' : stats.pushErrors > 0 ? 'bg-rose-200 text-rose-800' : 'bg-slate-200 text-slate-600'}`}>
              <AlertTriangle size={14} />
            </div>
          </button>
        </div>

        {/* 1.1 HIGHLIGHTED DIAGNOSTIC PANEL: SYNC & PUSH NOTIFICATION DELIVERY */}
        <div className="mt-4 p-3.5 rounded-xl border border-rose-100 bg-gradient-to-r from-rose-50/60 via-amber-50/30 to-blue-50/40 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-rose-500 text-white mt-0.5 shrink-0 shadow-xs">
              <ShieldAlert size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Painel de Diagnóstico: Sincronização & Push</span>
                {stats.pushErrors > 0 ? (
                  <span className="px-2 py-0.5 bg-rose-100 border border-rose-300 text-rose-700 text-[10px] font-extrabold rounded-full">
                    {stats.pushErrors} Falha(s) Detectada(s)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-emerald-100 border border-emerald-300 text-emerald-700 text-[10px] font-extrabold rounded-full">
                    Sincronização Ativa
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Rastreamento em tempo real de entrega de notificações push, alocações de pedidos e integridade do barramento Firestore/Sync Bus.
              </p>
            </div>
          </div>

          {/* Quick Diagnostic Actions */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsPushErrorsOnly(true);
                setSelectedType('all');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                isPushErrorsOnly 
                  ? 'bg-red-600 text-white border-red-600 shadow-xs' 
                  : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
              }`}
            >
              <AlertTriangle size={12} />
              <span>Ver Falhas de Push ({stats.pushErrors})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsPushErrorsOnly(false);
                setOrderIdFilter('150079');
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
              title="Filtrar logs do pedido 150079"
            >
              <Package size={12} className="text-blue-600" />
              <span>Rastrear Pedido 150079</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsPushErrorsOnly(false);
                setSearchQuery('11970791804');
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
              title="Filtrar logs do condutor 11970791804"
            >
              <Search size={12} className="text-blue-600" />
              <span>Condutor 11970791804</span>
            </button>

            {(isPushErrorsOnly || orderIdFilter || searchQuery) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer"
                title="Limpar filtros rápidos"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. ADVANCED FILTERS PANEL */}
      <AnimatePresence>
        {showAdvancedFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-b border-slate-200/80 bg-slate-50/50 p-5 space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
              
              {/* Filter: Search Keyword */}
              <div className="md:col-span-4 space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Search size={13} className="text-blue-600" />
                  <span>Buscar no Histórico</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Nome, condutor, evento, status..."
                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                  />
                  <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Filter: Specific Order ID */}
              <div className="md:col-span-3 space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Package size={13} className="text-blue-600" />
                  <span>Filtrar por ID do Pedido</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    list="orders-datalist"
                    value={orderIdFilter}
                    onChange={(e) => {
                      setOrderIdFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Ex: ZCO-149855, ped-101..."
                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono font-medium"
                  />
                  <Package size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                  {orderIdFilter && (
                    <button
                      type="button"
                      onClick={() => setOrderIdFilter('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ×
                    </button>
                  )}
                  {/* Suggestions Datalist */}
                  <datalist id="orders-datalist">
                    {uniqueOrderIds.map(id => (
                      <option key={id} value={id} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Filter: Date Range Start */}
              <div className="md:col-span-2 sm:col-span-6 space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={13} className="text-blue-600" />
                  <span>Data Início</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                />
              </div>

              {/* Filter: Date Range End */}
              <div className="md:col-span-2 sm:col-span-6 space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={13} className="text-blue-600" />
                  <span>Data Fim</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                />
              </div>

              {/* Filter: Clear Button */}
              <div className="md:col-span-1 flex items-end">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  disabled={activeFiltersCount === 0}
                  className="w-full py-2 px-2 bg-slate-200/80 hover:bg-slate-300 disabled:opacity-40 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
                  title="Limpar todos os filtros"
                >
                  <RotateCcw size={13} />
                  <span className="hidden sm:inline">Limpar</span>
                </button>
              </div>

            </div>

            {/* Quick Date Presets Row */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
              <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
                <Sparkles size={12} className="text-amber-500" />
                <span>Atalhos de Período:</span>
              </span>
              <button
                type="button"
                onClick={() => applyDatePreset('today')}
                className="px-2.5 py-1 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600 transition-all cursor-pointer shadow-2xs"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('yesterday')}
                className="px-2.5 py-1 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600 transition-all cursor-pointer shadow-2xs"
              >
                Ontem
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('last7')}
                className="px-2.5 py-1 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600 transition-all cursor-pointer shadow-2xs"
              >
                Últimos 7 dias
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('last30')}
                className="px-2.5 py-1 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600 transition-all cursor-pointer shadow-2xs"
              >
                Últimos 30 dias
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('all')}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-500 transition-all cursor-pointer shadow-2xs"
              >
                Todos os Períodos
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. LOG RESULTS METADATA BAR */}
      <div className="px-5 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-700">
            Exibindo <span className="text-blue-600 font-extrabold">{sortedLogs.length}</span> de <span className="text-slate-500">{logs.length}</span> atividades registradas
          </span>
          {activeFiltersCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-extrabold border border-blue-200">
              <Filter size={10} />
              {activeFiltersCount} {activeFiltersCount === 1 ? 'filtro ativo' : 'filtros ativos'}
            </span>
          )}
        </div>

        {/* Page Size Selector */}
        <div className="flex items-center gap-2 text-slate-500 text-xs">
          <span>Itens por página:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value={15}>15</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={500}>500</option>
          </select>
        </div>
      </div>

      {/* 4. TIMELINE LOGS LIST */}
      <div className="p-5 flex-1 min-h-[350px]">
        <div className="relative pl-6 space-y-4" id="timeline-events-container">
          
          {/* Continuous vertical timeline line */}
          <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-slate-100" />

          {paginatedLogs.map((log, idx) => {
            const styles = getLogTypeStyles(log.type);
            const Icon = styles.icon;
            const logDate = getLogIsoDate(log);
            const isCopied = copiedId === log.id;

            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.3) }}
                className={`relative flex items-start gap-3.5 p-3.5 rounded-xl border border-slate-100 hover:border-slate-300 bg-white hover:bg-slate-50/60 transition-all group shadow-2xs ${styles.borderLeft} border-l-4`}
                id={`activity-timeline-item-${log.id}`}
              >
                {/* Timeline status circle dot */}
                <div className={`absolute -left-[20px] top-4 w-2.5 h-2.5 rounded-full border-2 border-white ring-4 ring-slate-50 transition-transform group-hover:scale-125 z-10 ${styles.dot}`} />

                {/* Log Type Icon Badge */}
                <div className={`p-2 rounded-xl border shrink-0 ${styles.iconBg}`}>
                  <Icon size={16} />
                </div>

                {/* Content Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    
                    {/* Timestamp & Type Tag */}
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border uppercase tracking-wider ${styles.badgeBg}`}>
                        {styles.label}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 font-bold flex items-center gap-1">
                        <Calendar size={11} className="text-slate-400" />
                        <span>{formatToBrazilianDate(logDate)}</span>
                        <span className="text-slate-300">•</span>
                        <span>{log.time}</span>
                      </span>
                    </div>

                    {/* Order ID Badge & Copy Action */}
                    <div className="flex items-center gap-1.5">
                      {log.orderId && (
                        <button
                          type="button"
                          onClick={() => {
                            setOrderIdFilter(log.orderId!);
                            setCurrentPage(1);
                          }}
                          className="text-[10px] bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 px-2 py-0.5 rounded-md font-mono font-extrabold border border-slate-200 hover:border-blue-300 transition-all cursor-pointer flex items-center gap-1"
                          title={`Filtrar somente logs deste pedido #${log.orderId}`}
                        >
                          <Package size={11} />
                          <span>#{log.orderId}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleCopyText(log.message, log.id)}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                        title="Copiar mensagem do registro"
                      >
                        {isCopied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>

                  {/* Message body */}
                  <p className="text-xs text-slate-700 leading-relaxed font-semibold group-hover:text-slate-900 transition-colors">
                    {log.message}
                  </p>
                </div>
              </motion.div>
            );
          })}

          {/* Empty State */}
          {sortedLogs.length === 0 && (
            <div className="text-center py-12 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Filter size={20} />
              </div>
              <h4 className="text-sm font-bold text-slate-700">Nenhum registro encontrado</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Não foram localizadas atividades com os filtros selecionados (tipo, período ou ID de pedido).
              </p>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-3.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                >
                  <RotateCcw size={13} />
                  <span>Limpar Todos os Filtros</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 5. FOOTER PAGINATION BAR */}
      {totalPages > 1 && (
        <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span className="text-slate-500 font-medium">
            Página <span className="font-bold text-slate-800">{currentPage}</span> de <span className="font-bold text-slate-800">{totalPages}</span>
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <ChevronLeft size={14} />
              <span>Anterior</span>
            </button>

            {/* Quick page buttons */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              {totalPages > 5 && (
                <span className="text-slate-400 px-1 font-bold">...</span>
              )}
            </div>

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <span>Próxima</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Optional consolidated logs trigger */}
      {onViewLogsClick && (
        <div className="p-3 bg-white border-t border-slate-100 text-center">
          <button 
            type="button"
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
