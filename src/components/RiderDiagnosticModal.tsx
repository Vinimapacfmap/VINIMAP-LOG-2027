/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DeliveryRider, Order } from '../types';
import { isOrderMatchingRider, findRiderByIdentifier } from '../utils/partnerUtils';
import {
  Activity,
  Bug,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  Check,
  X,
  RefreshCw,
  Search,
  Database,
  Smartphone,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Shield,
  Layers,
  Key,
  Info
} from 'lucide-react';

interface RiderDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRiderId: string;
  lockedRiderId: string | null;
  selectedRider?: DeliveryRider;
  riders: DeliveryRider[];
  orders: Order[];
  driverActiveOrders: Order[];
  riderPendingOrders: Order[];
  riderCompletedOrders: Order[];
  onForceSync?: () => Promise<void>;
  onForceAutoLogin?: (riderId: string) => void;
}

export const RiderDiagnosticModal: React.FC<RiderDiagnosticModalProps> = ({
  isOpen,
  onClose,
  selectedRiderId,
  lockedRiderId,
  selectedRider,
  riders,
  orders,
  driverActiveOrders,
  riderPendingOrders,
  riderCompletedOrders,
  onForceSync,
  onForceAutoLogin
}) => {
  const [copied, setCopied] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'assigned' | 'unassigned' | 'matches'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Extract browser URL parameters
  const urlParams = useMemo(() => {
    if (typeof window === 'undefined') return { riderId: null, view: null, mode: null };
    const params = new URLSearchParams(window.location.search);
    return {
      riderId: params.get('riderId'),
      view: params.get('view'),
      mode: params.get('mode'),
      fullUrl: window.location.href
    };
  }, [isOpen]);

  // Extract LocalStorage variables
  const storageState = useMemo(() => {
    if (typeof window === 'undefined') return {};
    return {
      driverId: localStorage.getItem('vinimap_driver_id'),
      isLoggedIn: localStorage.getItem('vinimap_driver_logged_in'),
      isDriverApp: localStorage.getItem('vinimap_is_driver_app'),
      activeScreen: localStorage.getItem('vinimap_driver_active_screen'),
      activeTab: localStorage.getItem('vinimap_driver_active_tab'),
      lockedRiderIdStorage: localStorage.getItem('vinimap_locked_rider_id')
    };
  }, [isOpen]);

  // Detailed per-order diagnostic analysis
  const orderDiagnostics = useMemo(() => {
    return orders.map(order => {
      const topRiderId = order.riderId;
      const topRiderType = typeof order.riderId;
      const topDriverId = (order as any).driverId;
      const topAssignedDriver = (order as any).assignedDriver;
      const rawRiderId = order.rawData?.riderId;
      const rawCondutor = order.rawData?.Condutor || order.rawData?.condutor;
      const rawDispositivo = order.rawData?.DispositivoCondutor || order.rawData?.dispositivoCondutor;
      const rawEntregador = order.rawData?.Entregador || order.rawData?.entregador;

      // Evaluation results
      const matchesSelected = isOrderMatchingRider(order, selectedRiderId, riders);
      const matchesUrl = urlParams.riderId ? isOrderMatchingRider(order, urlParams.riderId, riders) : null;
      const matchesStorage = storageState.driverId ? isOrderMatchingRider(order, storageState.driverId, riders) : null;

      const hasAssignment = Boolean(
        topRiderId || topDriverId || topAssignedDriver || rawRiderId || rawCondutor || rawDispositivo || rawEntregador
      );

      return {
        id: order.id,
        status: order.status,
        recipient: order.recipientName || (order as any).recipient || order.rawData?.Destinatario || 'Sem destinatário',
        address: order.address || order.rawData?.Bairro || 'Sem endereço',
        topRiderId,
        topRiderType,
        topDriverId,
        topAssignedDriver,
        rawRiderId,
        rawCondutor,
        rawDispositivo,
        rawEntregador,
        matchesSelected,
        matchesUrl,
        matchesStorage,
        hasAssignment,
        rawOrder: order
      };
    });
  }, [orders, selectedRiderId, riders, urlParams.riderId, storageState.driverId]);

  // Filtered orders for diagnostic table
  const filteredOrderDiagnostics = useMemo(() => {
    return orderDiagnostics.filter(item => {
      if (filterType === 'assigned' && !item.hasAssignment) return false;
      if (filterType === 'unassigned' && item.hasAssignment) return false;
      if (filterType === 'matches' && !item.matchesSelected) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const idMatch = String(item.id).toLowerCase().includes(q);
        const riderMatch = String(item.topRiderId || '').toLowerCase().includes(q) ||
          String(item.topDriverId || '').toLowerCase().includes(q) ||
          String(item.rawCondutor || '').toLowerCase().includes(q) ||
          String(item.rawDispositivo || '').toLowerCase().includes(q);
        const recipientMatch = item.recipient.toLowerCase().includes(q);
        return idMatch || riderMatch || recipientMatch;
      }
      return true;
    });
  }, [orderDiagnostics, filterType, searchQuery]);

  // Generate diagnostic report as JSON
  const handleCopyReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      urlParams,
      storageState,
      runtimeState: {
        selectedRiderId,
        lockedRiderId,
        selectedRider: selectedRider ? {
          id: selectedRider.id,
          name: selectedRider.name,
          phone: selectedRider.phone,
          deviceNumber: selectedRider.deviceNumber,
          vehicle: selectedRider.vehicle,
          status: selectedRider.status
        } : null,
        totalRidersInContext: riders.length,
        availableRiders: riders.map(r => ({ id: r.id, name: r.name, deviceNumber: r.deviceNumber, phone: r.phone }))
      },
      ordersSummary: {
        totalOrders: orders.length,
        driverActiveOrders: driverActiveOrders.length,
        pendingForRider: riderPendingOrders.length,
        completedForRider: riderCompletedOrders.length
      },
      sampledOrders: orderDiagnostics.slice(0, 50).map(o => ({
        id: o.id,
        status: o.status,
        riderId: o.topRiderId,
        riderIdType: o.topRiderType,
        driverId: o.topDriverId,
        assignedDriver: o.topAssignedDriver,
        rawCondutor: o.rawCondutor,
        rawDispositivo: o.rawDispositivo,
        matchesSelectedRider: o.matchesSelected
      }))
    };

    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleTriggerSync = async () => {
    if (!onForceSync) return;
    setIsSyncing(true);
    try {
      await onForceSync();
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100 font-sans"
        >
          {/* Header */}
          <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Bug size={18} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <span>Diagnóstico de Alocação & Sincronização</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                    Deep Inspector
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 m-0">
                  Rastreamento em tempo real de parâmetros de URL, armazenamento local e chaves de alocação de pedidos.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyReport}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                <span>{copied ? 'Copiado JSON!' : 'Copiar Relatório'}</span>
              </button>

              {onForceSync && (
                <button
                  onClick={handleTriggerSync}
                  disabled={isSyncing}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <RefreshCw size={13} className={isSyncing ? "animate-spin" : ""} />
                  <span>{isSyncing ? 'Sincronizando...' : 'Recarregar Banco'}</span>
                </button>
              )}

              <button
                onClick={onClose}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Main Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* Top Cards: Parameters & States Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              
              {/* 1. URL Parameters */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-extrabold text-sky-400">
                  <span className="flex items-center gap-1.5">
                    <ExternalLink size={13} />
                    <span>Parâmetros de URL</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">window.location</span>
                </div>
                <div className="space-y-1 text-[11px] font-mono">
                  <div className="flex items-center justify-between bg-slate-900/80 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400">?riderId:</span>
                    <span className={`font-bold ${urlParams.riderId ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {urlParams.riderId || '(não presente)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-900/80 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400">?view:</span>
                    <span className="font-bold text-sky-300">{urlParams.view || '(vazio)'}</span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-900/80 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400">?mode:</span>
                    <span className="font-bold text-slate-400">{urlParams.mode || '(vazio)'}</span>
                  </div>
                </div>
              </div>

              {/* 2. LocalStorage Session */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-extrabold text-amber-400">
                  <span className="flex items-center gap-1.5">
                    <Smartphone size={13} />
                    <span>Sessão LocalStorage</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">localStorage</span>
                </div>
                <div className="space-y-1 text-[11px] font-mono">
                  <div className="flex items-center justify-between bg-slate-900/80 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400">driver_id:</span>
                    <span className={`font-bold ${storageState.driverId ? 'text-amber-300' : 'text-slate-500'}`}>
                      {storageState.driverId || '(vazio)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-900/80 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400">logged_in:</span>
                    <span className={`font-bold ${storageState.isLoggedIn === 'true' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {storageState.isLoggedIn || 'false'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-900/80 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400">is_driver_app:</span>
                    <span className="font-bold text-sky-300">{storageState.isDriverApp || 'false'}</span>
                  </div>
                </div>
              </div>

              {/* 3. Runtime Driver State */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-extrabold text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <Activity size={13} />
                    <span>Estado em Execução</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">React State</span>
                </div>
                <div className="space-y-1 text-[11px]">
                  <div className="flex items-center justify-between bg-slate-900/80 p-1.5 rounded-lg border border-slate-800 font-mono">
                    <span className="text-slate-400">selectedRiderId:</span>
                    <span className="font-bold text-emerald-300">{selectedRiderId || '(nenhum)'}</span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-900/80 p-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400">Nome:</span>
                    <span className="font-bold text-white truncate max-w-[140px]">
                      {selectedRider?.name || '(não identificado)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-900/80 p-1.5 rounded-lg border border-slate-800 font-mono">
                    <span className="text-slate-400">Dispositivo:</span>
                    <span className="font-bold text-sky-300">{selectedRider?.deviceNumber || selectedRider?.phone || '—'}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Quick Auto-Fix Action Bar */}
            {urlParams.riderId && urlParams.riderId !== selectedRiderId && onForceAutoLogin && (
              <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3 text-amber-200">
                <div className="flex items-center gap-2 text-xs">
                  <AlertTriangle size={15} className="text-amber-400 shrink-0" />
                  <span>
                    Divergência detectada! O parâmetro de URL pede o condutor <strong className="text-white font-mono">{urlParams.riderId}</strong>, mas o estado atual está em <strong className="text-white font-mono">{selectedRiderId || 'vazio'}</strong>.
                  </span>
                </div>
                <button
                  onClick={() => onForceAutoLogin(urlParams.riderId!)}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold rounded-lg shrink-0 cursor-pointer shadow-xs transition-all"
                >
                  Forçar Auto-Login para {urlParams.riderId}
                </button>
              </div>
            )}

            {/* Orders Summary KPI Pill Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Geral Pedidos</span>
                  <span className="text-lg font-black text-white font-mono">{orders.length}</span>
                </div>
                <Database size={20} className="text-slate-600" />
              </div>

              <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wider block">Ativos p/ este Condutor</span>
                  <span className="text-lg font-black text-sky-400 font-mono">{driverActiveOrders.length}</span>
                </div>
                <Layers size={20} className="text-sky-500/40" />
              </div>

              <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">Pendentes (Fila)</span>
                  <span className="text-lg font-black text-amber-400 font-mono">{riderPendingOrders.length}</span>
                </div>
                <Activity size={20} className="text-amber-500/40" />
              </div>

              <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">Concluídos Hoje</span>
                  <span className="text-lg font-black text-emerald-400 font-mono">{riderCompletedOrders.length}</span>
                </div>
                <CheckCircle2 size={20} className="text-emerald-500/40" />
              </div>
            </div>

            {/* Orders Deep Allocation Inspector */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Shield size={15} className="text-sky-400" />
                  <h4 className="text-xs font-black text-white uppercase tracking-wider m-0">
                    Inspeção de Campos de Alocação por Pedido
                  </h4>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono font-bold">
                    {filteredOrderDiagnostics.length} de {orders.length}
                  </span>
                </div>

                {/* Filter Tabs & Search */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Buscar pedido ou condutor..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-slate-900 border border-slate-700/80 rounded-lg pl-7 pr-2.5 py-1 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-all font-mono"
                    />
                  </div>

                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                      filterType === 'all' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setFilterType('matches')}
                    className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                      filterType === 'matches' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Vinculados ({orderDiagnostics.filter(o => o.matchesSelected).length})
                  </button>
                  <button
                    onClick={() => setFilterType('unassigned')}
                    className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                      filterType === 'unassigned' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Sem Condutor
                  </button>
                </div>
              </div>

              {/* Table of Orders & Rider Keys */}
              <div className="overflow-x-auto max-h-[340px] rounded-lg border border-slate-800/80">
                <table className="w-full text-left text-[11px] font-mono border-collapse">
                  <thead className="bg-slate-900/90 sticky top-0 z-10 text-slate-400 text-[10px] uppercase font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-2">Pedido</th>
                      <th className="p-2">order.riderId</th>
                      <th className="p-2">Tipo</th>
                      <th className="p-2">driverId / assignedDriver</th>
                      <th className="p-2">rawData (Condutor/Dispositivo)</th>
                      <th className="p-2">Status</th>
                      <th className="p-2 text-center">Compatível?</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredOrderDiagnostics.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-500 font-sans text-xs">
                          Nenhum pedido correspondente ao filtro de diagnóstico selecionado.
                        </td>
                      </tr>
                    ) : (
                      filteredOrderDiagnostics.map((item) => {
                        const isExpanded = expandedOrderId === item.id;
                        return (
                          <React.Fragment key={item.id}>
                            <tr
                              onClick={() => setExpandedOrderId(isExpanded ? null : item.id)}
                              className={`hover:bg-slate-800/50 transition-all cursor-pointer ${
                                item.matchesSelected ? 'bg-emerald-950/20' : ''
                              }`}
                            >
                              <td className="p-2 font-bold text-sky-400 whitespace-nowrap flex items-center gap-1">
                                {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                <span>#{item.id}</span>
                              </td>
                              <td className="p-2">
                                {item.topRiderId ? (
                                  <span className="text-emerald-300 font-bold bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-800/50">
                                    {typeof item.topRiderId === 'object' ? JSON.stringify(item.topRiderId) : String(item.topRiderId)}
                                  </span>
                                ) : (
                                  <span className="text-slate-600 italic">undefined</span>
                                )}
                              </td>
                              <td className="p-2">
                                <span className={`text-[10px] px-1 py-0.5 rounded ${
                                  item.topRiderType === 'string' ? 'text-sky-300 bg-sky-950/40' :
                                  item.topRiderType === 'object' ? 'text-amber-300 bg-amber-950/40 font-bold' : 'text-slate-600'
                                }`}>
                                  {item.topRiderType}
                                </span>
                              </td>
                              <td className="p-2">
                                {item.topDriverId || item.topAssignedDriver ? (
                                  <span className="text-amber-300">
                                    {item.topDriverId || JSON.stringify(item.topAssignedDriver)}
                                  </span>
                                ) : (
                                  <span className="text-slate-600">—</span>
                                )}
                              </td>
                              <td className="p-2 text-slate-300 truncate max-w-[180px]">
                                {item.rawCondutor || item.rawDispositivo || item.rawRiderId || (
                                  <span className="text-slate-600">—</span>
                                )}
                              </td>
                              <td className="p-2">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                  item.status === 'Concluído' ? 'bg-emerald-500/20 text-emerald-300' :
                                  item.status === 'Em rota' ? 'bg-sky-500/20 text-sky-300' :
                                  item.status === 'Ocorrência' ? 'bg-rose-500/20 text-rose-300' :
                                  item.status === 'Cancelado' ? 'bg-slate-700 text-slate-300' :
                                  'bg-slate-800 text-slate-300'
                                }`}>
                                  {item.status}
                                </span>
                              </td>
                              <td className="p-2 text-center">
                                {item.matchesSelected ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-[10px] bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-700/50">
                                    <CheckCircle2 size={11} />
                                    <span>SIM</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-slate-500 text-[10px]">
                                    <XCircle size={11} />
                                    <span>NÃO</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-slate-950/90 border-b border-slate-800">
                                <td colSpan={7} className="p-3">
                                  <div className="text-[11px] font-sans space-y-1.5">
                                    <div className="font-bold text-slate-300">
                                      Destinatário: <span className="text-white">{item.recipient}</span> — Endereço: <span className="text-slate-400">{item.address}</span>
                                    </div>
                                    <div className="bg-slate-900 p-2 rounded-lg font-mono text-[10px] text-slate-400 overflow-x-auto max-h-[120px]">
                                      <pre>{JSON.stringify(item.rawOrder, null, 2)}</pre>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            </div>

            {/* List of Registered Riders in System */}
            <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Key size={13} className="text-emerald-400" />
                  <span>Condutores Cadastrados no Sistema ({riders.length})</span>
                </span>
                <span className="text-[10px] text-slate-500">Clique para alternar teste</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {riders.map(r => (
                  <button
                    key={r.id}
                    onClick={() => {
                      if (onForceAutoLogin) onForceAutoLogin(r.id);
                    }}
                    className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                      r.id === selectedRiderId
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
                    }`}
                  >
                    <span>{r.name}</span>
                    <span className="text-[9px] text-slate-500">({r.id})</span>
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Info size={13} className="text-sky-400" />
              <span>Vnimap OS Diagnóstico de Alocações</span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all cursor-pointer"
            >
              Fechar
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
