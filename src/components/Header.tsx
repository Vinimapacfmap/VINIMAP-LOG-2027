/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
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
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PwaInstallButton } from './PwaInstallButton';

interface HeaderProps {
  onSearchChange: (search: string) => void;
  onNewOrderClick: () => void;
  searchQuery: string;
  onLogout?: () => void;
  onExportContingency?: () => void;
  lastContingencyTime?: string;
}

export default function Header({ 
  onSearchChange, 
  onNewOrderClick, 
  searchQuery, 
  onLogout,
  onExportContingency,
  lastContingencyTime
}: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

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

  return (
    <header className="h-16 border-b border-slate-100 bg-white px-6 flex items-center justify-between sticky top-0 z-20">
      
      {/* Left Search Bar */}
      <div className="flex items-center gap-4 w-1/3">
        <div className="relative w-full max-w-md group" id="header-search-container">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="Buscar por código, cliente ou endereço..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-10 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition-all"
            id="header-search-input"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
              id="header-search-clear"
            >
              Limpar
            </button>
          )}
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
        <PwaInstallButton variant="header" />

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
