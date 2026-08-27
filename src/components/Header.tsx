/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  Bell, 
  Plus, 
  Clock, 
  SlidersHorizontal,
  LogOut,
  User,
  CheckCircle2,
  AlertTriangle,
  Info,
  Database,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  ShoppingBag,
  MapPin,
  Truck,
  ChevronRight,
  X,
  ExternalLink,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CompanyHub, Order, DeliveryRider, ClientPartner } from '../types';
import { PwaInstallButton } from './PwaInstallButton';
import HistoricOrdersConsultModal from './HistoricOrdersConsultModal';
import { isOrderMatchingGlobalSearch, sortOrdersByLexicographicSearch } from '../utils/searchUtils';

interface HeaderProps {
  onSearchChange: (search: string) => void;
  onNewOrderClick: () => void;
  searchQuery: string;
  onLogout?: () => void;
  onExportContingency?: () => void;
  lastContingencyTime?: string;
  activeHub?: CompanyHub;
  onSyncSupabase?: () => Promise<void> | void;
  isSyncingSupabase?: boolean;
  lastSupabaseSyncTime?: string;
  supabaseSyncStatus?: 'idle' | 'syncing' | 'synced' | 'error';
  orders?: Order[];
  riders?: DeliveryRider[];
  clientPartners?: ClientPartner[];
  onNavigateToOrders?: () => void;
  onNavigateToSection?: (section: string) => void;
}

export default function Header({ 
  onSearchChange, 
  onNewOrderClick, 
  searchQuery, 
  onLogout,
  onExportContingency,
  lastContingencyTime,
  activeHub,
  onSyncSupabase,
  isSyncingSupabase = false,
  lastSupabaseSyncTime,
  supabaseSyncStatus = 'idle',
  orders = [],
  riders = [],
  clientPartners = [],
  onNavigateToOrders,
  onNavigateToSection
}: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);
  const [isHistoricConsultOpen, setIsHistoricConsultOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const profileContainerRef = useRef<HTMLDivElement>(null);
  const notificationsContainerRef = useRef<HTMLDivElement>(null);

  // Close search, profile and notification dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
      if (profileContainerRef.current && !profileContainerRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
      if (notificationsContainerRef.current && !notificationsContainerRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Real-time Clock and Date in PT-BR style (São Paulo)
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      const parts = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(now);
      setDateStr(parts);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Global search matching across all orders using universal lexicographical search logic
  const matchingOrders = useMemo(() => {
    if (!orders || !searchQuery.trim()) return [];
    const matched = orders.filter(o => isOrderMatchingGlobalSearch(o, searchQuery, riders, clientPartners));
    return sortOrdersByLexicographicSearch(matched, searchQuery, riders, clientPartners);
  }, [orders, searchQuery, riders, clientPartners]);

  const notifications = [
    {
      id: 1,
      title: 'Bateria Crítica',
      desc: 'Entregador Lucas Souza está com 14% de bateria.',
      time: 'Há 5 min',
      type: 'danger',
      icon: AlertTriangle,
    },
    {
      id: 2,
      title: 'Novo Pedido Recebido',
      desc: 'Pedido #ped-110 aguardando despacho (Zona Norte).',
      time: 'Há 7 min',
      type: 'info',
      icon: Info,
    },
    {
      id: 3,
      title: 'Entrega Concluída',
      desc: 'Carlos Santos concluiu o pedido #ped-101 com sucesso.',
      time: 'Há 20 min',
      type: 'success',
      icon: CheckCircle2,
    },
  ];

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Concluído': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Em rota': return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'Entregando': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Ocorrência': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Cancelado': return 'bg-slate-100 text-slate-600 border-slate-200';
      default: return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  const handleSelectOrderResult = (orderId: string) => {
    onSearchChange(orderId.replace(/^ped-/i, ''));
    if (onNavigateToOrders) {
      onNavigateToOrders();
    }
    setIsSearchFocused(false);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (onNavigateToOrders) {
        onNavigateToOrders();
      }
      setIsSearchFocused(false);
    }
  };

  return (
    <header className="h-16 border-b border-slate-100 bg-white px-6 flex items-center justify-between sticky top-0 z-30">
      
      {/* Left Search Bar with Global Search Dropdown */}
      <div className="flex items-center gap-4 w-full md:w-1/2 lg:w-5/12" ref={searchContainerRef}>
        <div className="relative w-full max-w-lg group" id="header-search-container">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
          <input
            type="text"
            placeholder="Busca global de pedidos (código, cliente, endereço, CEP)..."
            value={searchQuery}
            onFocus={() => setIsSearchFocused(true)}
            onChange={(e) => {
              const val = e.target.value;
              onSearchChange(val);
              setIsSearchFocused(true);
              if (val.trim().length > 0 && onNavigateToOrders) {
                onNavigateToOrders();
              }
            }}
            onKeyDown={handleSearchKeyDown}
            className="w-full pl-10 pr-10 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition-all shadow-2xs"
            id="header-search-input"
          />
          {searchQuery && (
            <button
              onClick={() => {
                onSearchChange('');
                setIsSearchFocused(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5 rounded-full hover:bg-slate-100"
              id="header-search-clear"
              title="Limpar busca"
            >
              <X size={14} />
            </button>
          )}

          {/* Interactive Global Search Popup Overlay */}
          <AnimatePresence>
            {isSearchFocused && searchQuery.trim().length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden max-h-[450px] flex flex-col"
                id="global-search-dropdown"
              >
                {/* Header info bar */}
                <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingBag size={14} className="text-blue-600" />
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Busca Global de Pedidos</span>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    {matchingOrders.length} {matchingOrders.length === 1 ? 'resultado' : 'resultados'}
                  </span>
                </div>

                {/* Results List */}
                <div className="overflow-y-auto divide-y divide-slate-100 p-1 flex-1">
                  {matchingOrders.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 space-y-2">
                      <Search size={28} className="mx-auto text-slate-300 stroke-1" />
                      <p className="text-xs font-bold text-slate-600">Nenhum pedido encontrado</p>
                      <p className="text-[11px] text-slate-400">Tente buscar por código (ex: #101), nome do cliente, bairro, cidade ou CEP.</p>
                    </div>
                  ) : (
                    matchingOrders.slice(0, 8).map((order) => (
                      <button
                        key={order.id}
                        onClick={() => handleSelectOrderResult(order.id)}
                        className="w-full text-left p-3 hover:bg-blue-50/60 rounded-xl transition-colors flex items-center justify-between gap-3 group cursor-pointer"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs text-blue-700 font-mono bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                              #{order.id.replace('ped-', '').toUpperCase()}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadgeClass(order.status)}`}>
                              {order.status}
                            </span>
                            {order.clientName && (
                              <span className="text-xs font-bold text-slate-700 truncate max-w-[140px]">
                                {order.clientName}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <span className="font-semibold text-slate-800 truncate">
                              Para: {order.recipientName || 'Destinatário N/D'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
                            <MapPin size={12} className="shrink-0 text-slate-400" />
                            <span className="truncate">
                              {order.address || 'Sem endereço'} 
                              {(order.rawData?.CidadeMunicipio || order.rawData?.Cidade || order.region) ? ` - ${order.rawData?.CidadeMunicipio || order.rawData?.Cidade || order.region}` : ''}
                            </span>
                            {order.cep && <span className="text-[10px] bg-slate-100 px-1.5 py-0.2 rounded text-slate-500 font-mono">CEP: {order.cep}</span>}
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex flex-col items-end gap-1">
                          <span className="text-xs font-black text-slate-800 font-mono">
                            R$ {(order.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                          {order.status === 'Cancelado' ? (
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                              Cancelado
                            </span>
                          ) : (order.riderId && order.riderId !== 'unassigned' && order.riderId !== 'desalocar' && order.rawData?.DispositivoCondutor !== 'Não vinculado') ? (
                            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <Truck size={10} />
                              <span className="truncate max-w-[90px]">{order.rawData?.DispositivoCondutor || order.riderId}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                              Sem condutor
                            </span>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {/* Footer Action */}
                <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                  <button
                    onClick={() => {
                      if (onNavigateToOrders) onNavigateToOrders();
                      setIsSearchFocused(false);
                    }}
                    className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Ir para Central de Pedidos ({matchingOrders.length} filtrados)</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        
        {/* Real-Time Operational Clock & Date */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-semibold text-slate-600 font-mono shrink-0" id="header-clock">
          <Clock size={13} className="text-blue-500 animate-spin" style={{ animationDuration: '8s' }} />
          <span className="font-sans font-bold text-slate-700">{dateStr}</span>
          <span className="text-slate-300">•</span>
          <span>{timeStr}</span>
          <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded uppercase font-sans font-bold">Ao Vivo</span>
        </div>

        {/* Vercel Environment Badge */}
        <div className="hidden 2xl:flex items-center gap-1.5 px-2 py-1 bg-slate-900 text-white rounded-xl text-[10px] font-extrabold shadow-2xs border border-slate-800 shrink-0" title="Vercel Ready / Production Environment">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="tracking-tight">Vercel OS</span>
        </div>

        {/* Notifications Center */}
        <div className="relative shrink-0" id="notifications-dropdown-container" ref={notificationsContainerRef}>
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfile(false);
            }}
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-800 border border-slate-100 cursor-pointer relative transition-all"
            id="header-notifications-btn"
          >
            <Bell size={16} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-rose-500 rounded-full animate-bounce" />
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-3 w-80 bg-white rounded-2xl border border-slate-100 shadow-xl py-2 z-50 overflow-hidden"
              >
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-sm">Alertas e Notificações</span>
                  <span className="text-[10px] bg-rose-50 text-rose-600 font-bold px-2 py-0.5 rounded-full">
                    3 pendentes
                  </span>
                </div>
                <div className="divide-y divide-slate-50 max-h-[300px] overflow-y-auto">
                  {notifications.map((notif) => {
                    const Icon = notif.icon;
                    return (
                      <div 
                        key={notif.id} 
                        className="p-3 hover:bg-slate-50/50 flex gap-2.5 transition-colors cursor-pointer"
                      >
                        <div className={`p-1.5 rounded-lg shrink-0 flex items-center justify-center ${
                          notif.type === 'danger' ? 'bg-rose-50 text-rose-600' :
                          notif.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                          'bg-blue-50 text-blue-600'
                        }`}>
                          <Icon size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-800">{notif.title}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">{notif.desc}</p>
                          <span className="text-[9px] text-slate-400 font-medium block mt-1 font-mono">{notif.time}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="p-2 border-t border-slate-100 text-center">
                  <button className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold uppercase tracking-wider py-1 cursor-pointer w-full">
                    Marcar tudo como lido
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* PWA Install Action */}
        <PwaInstallButton variant="header" activeHub={activeHub} />

        {/* Historic Orders Direct Supabase Query Button */}
        <button
          type="button"
          onClick={() => setIsHistoricConsultOpen(true)}
          title="Consultar histórico de pedidos anteriores diretamente no banco Supabase sem consumir cotas do Firestore"
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 shadow-3xs transition-all cursor-pointer shrink-0"
          id="header-supabase-consult-btn"
        >
          <Database size={13} className="text-emerald-700 shrink-0" />
          <span className="hidden md:inline">Consultar Supabase</span>
        </button>

        {/* Supabase Force Sync Action */}
        {onSyncSupabase && (
          <button
            type="button"
            onClick={onSyncSupabase}
            disabled={isSyncingSupabase}
            title={
              isSyncingSupabase
                ? 'Sincronizando dados com o Supabase...'
                : lastSupabaseSyncTime
                ? `Última sincronização com Supabase: ${lastSupabaseSyncTime}. Clique para sincronizar novamente.`
                : 'Sincronizar todos os dados do painel com o Supabase imediatamente'
            }
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold rounded-xl border shadow-3xs transition-all cursor-pointer shrink-0 group ${
              isSyncingSupabase
                ? 'bg-amber-50 text-amber-700 border-amber-200/80 cursor-wait'
                : supabaseSyncStatus === 'synced'
                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200/80'
                : supabaseSyncStatus === 'error'
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200/80'
                : 'bg-sky-50 hover:bg-sky-100 active:bg-sky-200 text-sky-700 border-sky-200/80'
            }`}
            id="header-supabase-sync-btn"
          >
            {isSyncingSupabase ? (
              <RefreshCw size={13} className="animate-spin text-amber-600 shrink-0" />
            ) : supabaseSyncStatus === 'synced' ? (
              <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
            ) : supabaseSyncStatus === 'error' ? (
              <AlertCircle size={13} className="text-rose-600 shrink-0" />
            ) : (
              <RefreshCw size={13} className="text-sky-600 group-hover:rotate-180 transition-transform duration-500 shrink-0" />
            )}

            <span className="hidden md:inline">
              {isSyncingSupabase
                ? 'Sincronizando...'
                : supabaseSyncStatus === 'synced'
                ? 'Sincronizado'
                : supabaseSyncStatus === 'error'
                ? 'Erro ao Sincronizar'
                : 'Sincronizar Supabase'}
            </span>

            {supabaseSyncStatus === 'synced' && !isSyncingSupabase && (
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0" />
            )}
            {isSyncingSupabase && (
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping shrink-0" />
            )}
          </button>
        )}

        {/* Contingency Backup & Daily Forced JSON Export */}
        {onExportContingency && (
          <button
            onClick={onExportContingency}
            title={lastContingencyTime ? `Contingência salva: ${lastContingencyTime}. Clique para baixar o arquivo JSON.` : 'Exportar Banco de Dados (Pedidos & Parceiros) em JSON para contingência'}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-700 font-bold text-[11px] rounded-xl border border-emerald-200/80 shadow-3xs transition-all cursor-pointer shrink-0 group"
            id="header-contingency-btn"
          >
            <Database size={13} className="text-emerald-600 group-hover:scale-110 transition-transform shrink-0" />
            <span>Contingência</span>
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shrink-0" />
          </button>
        )}

        {/* Create Order Dispatch Action */}
        <button
          onClick={onNewOrderClick}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs hover:shadow-md transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shrink-0"
          id="header-new-order-btn"
        >
          <Plus size={15} className="stroke-[3] shrink-0" />
          <span>Novo Pedido</span>
        </button>

        <div className="h-5 w-px bg-slate-200 shrink-0" />

        {/* User Account Menu with Enhanced Sair do Painel Card */}
        <div className="relative shrink-0" id="profile-dropdown-container" ref={profileContainerRef}>
          <button
            onClick={() => {
              setShowProfile(!showProfile);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 pl-1 pr-2.5 py-1 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 rounded-full border border-slate-200/80 cursor-pointer transition-all shadow-3xs group shrink-0"
            id="header-profile-btn"
            title="Conta do Operador / Opções de Saída"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-[10px] flex items-center justify-center border-2 border-white shadow-2xs shadow-blue-200 group-hover:scale-105 transition-transform shrink-0">
              CA
            </div>
            <div className="text-left hidden sm:block leading-tight">
              <p className="text-[11px] font-bold text-slate-800 leading-tight group-hover:text-blue-600 transition-colors whitespace-nowrap">Despachante 01</p>
              <p className="text-[9px] text-slate-400 font-medium leading-none whitespace-nowrap">araocris524</p>
            </div>
          </button>

          <AnimatePresence>
            {showProfile && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-24px)] bg-white rounded-2xl border border-slate-200/90 shadow-2xl shadow-slate-900/15 overflow-hidden z-50 flex flex-col"
                id="header-profile-dropdown"
              >
                {/* User Identity Header */}
                <div className="p-3.5 bg-gradient-to-br from-slate-900 via-slate-850 to-blue-950 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-28 h-28 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
                  
                  <div className="flex items-center gap-2.5 relative z-10">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-xs flex items-center justify-center border border-white/20 shadow-sm shrink-0">
                      CA
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-white tracking-tight truncate leading-tight">Cristóvão Arão</h4>
                      <p className="text-[10px] text-slate-300 truncate font-mono leading-tight mt-0.5">araocris524@gmail.com</p>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-white/10 text-[9.5px]">
                    <span className="bg-blue-500/20 text-blue-200 px-2 py-0.5 rounded-full font-bold border border-blue-400/20 flex items-center gap-1 shrink-0 whitespace-nowrap">
                      <ShieldCheck size={10} className="text-blue-300 shrink-0" />
                      <span>Despachante Adm.</span>
                    </span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1 ml-auto shrink-0 whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      <span>Sessão Ativa</span>
                    </span>
                  </div>
                </div>

                {/* Quick Navigation Items */}
                <div className="p-1.5 space-y-0.5">
                  <button 
                    onClick={() => {
                      setShowProfile(false);
                      if (onNavigateToSection) onNavigateToSection('configuracoes');
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-slate-700 hover:text-blue-700 hover:bg-blue-50/70 rounded-xl transition-colors cursor-pointer group text-left"
                  >
                    <div className="w-6 h-6 rounded-lg bg-slate-100 group-hover:bg-blue-100 text-slate-500 group-hover:text-blue-600 flex items-center justify-center shrink-0 transition-colors">
                      <SlidersHorizontal size={13} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="leading-tight text-slate-800 group-hover:text-blue-700 font-bold text-[11px]">Ajustes da Central</p>
                      <p className="text-[9.5px] text-slate-400 mt-0.5 leading-tight truncate">Parâmetros operacionais e preferências</p>
                    </div>
                    <ChevronRight size={13} className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>

                  <button 
                    onClick={() => {
                      setShowProfile(false);
                      if (onNavigateToSection) onNavigateToSection('sede');
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-slate-700 hover:text-blue-700 hover:bg-blue-50/70 rounded-xl transition-colors cursor-pointer group text-left"
                  >
                    <div className="w-6 h-6 rounded-lg bg-slate-100 group-hover:bg-blue-100 text-slate-500 group-hover:text-blue-600 flex items-center justify-center shrink-0 transition-colors">
                      <MapPin size={13} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="leading-tight text-slate-800 group-hover:text-blue-700 font-bold text-[11px]">Sede Operacional</p>
                      <p className="text-[9.5px] text-slate-400 mt-0.5 leading-tight truncate">{activeHub?.name || 'Vinimap Matriz São Paulo'}</p>
                    </div>
                    <ChevronRight size={13} className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>

                  <button 
                    onClick={() => {
                      setShowProfile(false);
                      if (onLogout) {
                        onLogout();
                      } else {
                        localStorage.removeItem('vinimap_admin_session');
                        localStorage.setItem('vinimap_logged_out', 'true');
                        window.location.reload();
                      }
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-slate-700 hover:text-blue-700 hover:bg-blue-50/70 rounded-xl transition-colors cursor-pointer group text-left"
                  >
                    <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 transition-colors">
                      <ShieldCheck size={13} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="leading-tight text-slate-800 group-hover:text-blue-700 font-bold text-[11px]">Tela de Login (Bloquear)</p>
                      <p className="text-[9.5px] text-slate-400 mt-0.5 leading-tight truncate">Exibir tela de autenticação do administrador</p>
                    </div>
                    <ChevronRight size={13} className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                </div>

                {/* Elegant Sair do Painel Card */}
                <div className="p-2 bg-slate-50 border-t border-slate-100">
                  <button 
                    onClick={() => {
                      setShowProfile(false);
                      setShowLogoutConfirmModal(true);
                    }} 
                    className="w-full p-2.5 bg-rose-50/90 hover:bg-rose-100 active:bg-rose-200/90 text-rose-700 border border-rose-200/80 rounded-xl flex items-center justify-between transition-all cursor-pointer group shadow-2xs"
                    id="header-logout-card-action"
                    title="Encerrar sessão de trabalho e sair do painel"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-rose-200/80 text-rose-700 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                        <LogOut size={14} />
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-[11px] font-black text-rose-900 leading-tight">Sair do Painel</p>
                        <p className="text-[9.5px] text-rose-600 font-medium leading-tight mt-0.5 truncate">Desconectar da Central com segurança</p>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-rose-400 group-hover:text-rose-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* Elegant Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirmModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl text-center space-y-4 relative overflow-hidden"
              id="logout-confirmation-modal"
            >
              <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
                <LogOut size={26} className="stroke-[2.5]" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-lg font-black text-slate-800">Deseja sair do painel?</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Sua sessão de despachante será finalizada com segurança. Todos os dados e sincronizações foram preservados.
                </p>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirmModal(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setShowLogoutConfirmModal(false);
                    if (onLogout) {
                      onLogout();
                    } else {
                      const m = await import("../supabase");
                      if (m.supabase) {
                        await m.supabase.auth.signOut();
                      }
                      window.location.reload();
                    }
                  }}
                  className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-black text-xs rounded-xl shadow-md shadow-rose-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  id="confirm-logout-btn"
                >
                  <LogOut size={14} />
                  <span>Sim, Sair</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Direct Supabase Historical Orders Consult Modal */}
      <HistoricOrdersConsultModal
        isOpen={isHistoricConsultOpen}
        onClose={() => setIsHistoricConsultOpen(false)}
        clientPartners={clientPartners}
        riders={riders}
        initialSearchQuery={searchQuery}
      />
    </header>
  );
}
