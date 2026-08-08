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
import { CompanyHub, Order } from '../types';
import { PwaInstallButton } from './PwaInstallButton';

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
  onNavigateToOrders?: () => void;
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
  onNavigateToOrders
}: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
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

  // Global search matching across all orders
  const matchingOrders = useMemo(() => {
    if (!orders || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return orders.filter(o => {
      const city = o.rawData?.CidadeMunicipio || o.rawData?.Cidade || o.region || '';
      const tracking = o.rawData?.DANFE || o.rawData?.Chamado || '';
      const rider = o.rawData?.DispositivoCondutor || o.riderId || '';

      const codeMatch = o.id.toLowerCase().includes(q) || (o.rawData?.Pedido && String(o.rawData.Pedido).toLowerCase().includes(q));
      const clientMatch = o.clientName.toLowerCase().includes(q) || (o.rawData?.CodigoCliente && String(o.rawData.CodigoCliente).toLowerCase().includes(q));
      const recipientMatch = (o.recipientName || '').toLowerCase().includes(q) || (o.rawData?.ProcurarPor && String(o.rawData.ProcurarPor).toLowerCase().includes(q));
      const addressMatch = (o.address || '').toLowerCase().includes(q) || city.toLowerCase().includes(q) || (o.cep || '').toLowerCase().includes(q);
      const trackingMatch = tracking.toLowerCase().includes(q);
      const riderMatch = rider.toLowerCase().includes(q);
      return codeMatch || clientMatch || recipientMatch || addressMatch || trackingMatch || riderMatch;
    });
  }, [orders, searchQuery]);

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
    onSearchChange(orderId.replace('ped-', ''));
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
              onSearchChange(e.target.value);
              setIsSearchFocused(true);
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
                          {(order.rawData?.DispositivoCondutor || order.riderId) ? (
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
      <div className="flex items-center gap-4">
        
        {/* Real-Time Operational Clock & Date */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-600 font-mono" id="header-clock">
          <Clock size={14} className="text-blue-500 animate-spin" style={{ animationDuration: '8s' }} />
          <span className="font-sans font-bold text-slate-700">{dateStr}</span>
          <span className="text-slate-300">•</span>
          <span>{timeStr}</span>
          <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded uppercase font-sans font-bold">Ao Vivo</span>
        </div>

        {/* Vercel Environment Badge */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 text-white rounded-xl text-[11px] font-extrabold shadow-xs border border-slate-800" title="Vercel Ready / Production Environment">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="tracking-tight">Vercel OS</span>
        </div>

        {/* Notifications Center */}
        <div className="relative" id="notifications-dropdown-container">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfile(false);
            }}
            className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-800 border border-slate-100 cursor-pointer relative transition-all"
            id="header-notifications-btn"
          >
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full animate-bounce" />
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
                        className="p-3.5 hover:bg-slate-50/50 flex gap-3 transition-colors cursor-pointer"
                      >
                        <div className={`p-2 rounded-lg shrink-0 flex items-center justify-center ${
                          notif.type === 'danger' ? 'bg-rose-50 text-rose-600' :
                          notif.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                          'bg-blue-50 text-blue-600'
                        }`}>
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0">
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
            className={`hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border shadow-3xs transition-all cursor-pointer shrink-0 group ${
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
              <RefreshCw size={15} className="animate-spin text-amber-600 shrink-0" />
            ) : supabaseSyncStatus === 'synced' ? (
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            ) : supabaseSyncStatus === 'error' ? (
              <AlertCircle size={15} className="text-rose-600 shrink-0" />
            ) : (
              <RefreshCw size={15} className="text-sky-600 group-hover:rotate-180 transition-transform duration-500 shrink-0" />
            )}

            <span>
              {isSyncingSupabase
                ? 'Sincronizando...'
                : supabaseSyncStatus === 'synced'
                ? 'Sincronizado'
                : supabaseSyncStatus === 'error'
                ? 'Erro ao Sincronizar'
                : 'Sincronizar Supabase'}
            </span>

            {supabaseSyncStatus === 'synced' && !isSyncingSupabase && (
              <span className="w-2 h-2 bg-emerald-500 rounded-full shrink-0" />
            )}
            {isSyncingSupabase && (
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping shrink-0" />
            )}
          </button>
        )}

        {/* Contingency Backup & Daily Forced JSON Export */}
        {onExportContingency && (
          <button
            onClick={onExportContingency}
            title={lastContingencyTime ? `Contingência salva: ${lastContingencyTime}. Clique para baixar o arquivo JSON.` : 'Exportar Banco de Dados (Pedidos & Parceiros) em JSON para contingência'}
            className="hidden md:flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200/80 shadow-3xs transition-all cursor-pointer shrink-0 group"
            id="header-contingency-btn"
          >
            <Database size={15} className="text-emerald-600 group-hover:scale-110 transition-transform" />
            <span className="hidden lg:inline">Contingência JSON</span>
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          </button>
        )}

        {/* Create Order Dispatch Action */}
        <button
          onClick={onNewOrderClick}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-100 hover:shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shrink-0"
          id="header-new-order-btn"
        >
          <Plus size={16} className="stroke-[3]" />
          <span>Novo Pedido</span>
        </button>

        <div className="h-6 w-px bg-slate-200 shrink-0" />

        {/* User Account Menu */}
        <div className="relative" id="profile-dropdown-container">
          <button
            onClick={() => {
              setShowProfile(!showProfile);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2.5 pl-1.5 pr-3 py-1 bg-slate-50 hover:bg-slate-100 rounded-full border border-slate-100 cursor-pointer transition-all"
            id="header-profile-btn"
          >
            <div className="w-8 h-8 rounded-full bg-blue-500 text-white font-extrabold flex items-center justify-center border-2 border-white shadow-sm shadow-blue-100">
              D
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-bold text-slate-800 leading-none">Despachante 01</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">araocris524</p>
            </div>
          </button>

          <AnimatePresence>
            {showProfile && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-3 w-56 bg-white rounded-2xl border border-slate-100 shadow-xl py-2 z-50"
              >
                <div className="px-4 py-2.5 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-800">Cristóvão Arão</p>
                  <p className="text-[10px] text-slate-400">araocris524@gmail.com</p>
                </div>
                <div className="p-1 space-y-0.5">
                  <button className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg cursor-pointer">
                    <User size={14} className="text-slate-400" />
                    <span>Meu Perfil</span>
                  </button>
                  <button className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg cursor-pointer">
                    <SlidersHorizontal size={14} className="text-slate-400" />
                    <span>Ajustes da Central</span>
                  </button>
                  <div className="h-px bg-slate-50 my-1" />
                  <button 
                    onClick={async () => {
                      setShowProfile(false);
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
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                  >
                    <LogOut size={14} />
                    <span>Sair do Painel</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </header>
  );
}
