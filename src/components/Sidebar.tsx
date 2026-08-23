/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Truck, 
  Map, 
  TrendingUp, 
  Users, 
  BarChart3, 
  DollarSign,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  Settings,
  HelpCircle,
  FileSpreadsheet,
  Activity,
  Workflow,
  MapPin,
  Notebook,
  Sparkles,
  Smartphone,
  Calculator,
  Database,
  Wallet,
  Building2,
  Download,
  Image as ImageIcon,
  GitBranch,
  RotateCcw,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import vinimapLogo from '../assets/images/vinimap_app_logo_1785236008840.jpg';
import { DiagnosticUtility } from './DiagnosticUtility';

interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
  activeHub?: { name: string; logoUrl?: string };
  onLogout?: () => void;
}

export default function Sidebar({ activeSection, setActiveSection, activeHub, onLogout }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const isExpanded = !collapsed || isHovered;

  // Admin sub-items list
  const adminSubItems = [
    { id: 'bloquear_login', label: '🔒 Tela de Login Admin (Bloquear)', icon: ShieldCheck },
    { id: 'financeiro', label: 'Financeiro (Contas & Repasses)', icon: Wallet },
    { id: 'relatorios', label: 'Relatórios & Performance', icon: BarChart3 },
    { id: 'clientes', label: 'Clientes & Parceiros', icon: Building2 },
    { id: 'condutores', label: 'Condutores & Frota', icon: Users },
    { id: 'sede', label: 'Sede ViniMap', icon: MapPin },
    { id: 'logo_sede', label: 'Edição de Logo da Sede', icon: ImageIcon },
    { id: 'tabela_frete', label: 'Tabela de Frete por Cliente', icon: DollarSign },
    { id: 'massa_dados', label: 'Massa de Dados (Seed)', icon: Database },
    { id: 'restaurar_backup', label: 'Restaurar Backup por Período', icon: RotateCcw },
    { id: 'supabase', label: 'Banco de Dados Supabase', icon: Database },
    { id: 'github', label: 'Integração & Sync GitHub', icon: GitBranch },
    { id: 'configuracoes', label: 'Configurações Operacionais', icon: Settings }
  ];

  const adminSubIds = [...adminSubItems.map(item => item.id), 'admin', 'logo_sede'];
  const isAdminActive = adminSubIds.includes(activeSection);
  const [isAdminOpen, setIsAdminOpen] = useState(isAdminActive);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pedidos', label: 'Pedidos', icon: ShoppingBag, badge: '4' },
    { id: 'alocar', label: 'Alocar Pedidos', icon: Workflow },
    { id: 'tabela_frete', label: 'Faixas de CEP & Frete', icon: DollarSign, badge: 'CEP' },
    { id: 'importar', label: 'Importar Pedidos', icon: FileSpreadsheet },
    { id: 'restaurar_backup', label: 'Restaurar Backup por Período', icon: RotateCcw, badge: 'BACKUP' },
    { id: 'caderno', label: 'Caderno Diário', icon: Notebook },
    { id: 'localizacao', label: 'Rastrear Condutor & Mapa', icon: MapPin, pulse: true },
    { id: 'rotas', label: 'Otimizar Rota', icon: TrendingUp },
    { id: 'logo_sede', label: 'Logo da Sede', icon: ImageIcon, badge: 'NOVO' },
    { 
      id: 'admin_dropdown', 
      label: 'Painel do Administrador', 
      icon: ShieldCheck, 
      isDropdown: true 
    },
    { id: 'calculadora', label: 'Cálculo de Volume', icon: Calculator },
    { id: 'dispositivo_condutor', label: 'App do Condutor', icon: Smartphone, badge: 'SIM' },
    { id: 'atividades', label: 'Atividade', icon: Activity },
  ];

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative h-screen bg-white border-r border-slate-100 flex flex-col transition-all duration-300 ease-in-out z-30 ${
        isExpanded ? 'w-64 shadow-xl' : 'w-[60px]'
      }`}
      id="sidebar-container"
    >
      {/* Top Header / Branding & Scrollable Menu */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className={`flex items-center p-4 border-b border-slate-100 h-16 shrink-0 ${isExpanded ? 'justify-between' : 'justify-center px-2'}`}>
          <div className="flex items-center gap-3 overflow-hidden">
            {activeHub?.logoUrl ? (
              <img 
                src={activeHub.logoUrl} 
                alt="Logo Sede" 
                className="w-9 h-9 rounded-xl object-contain border border-slate-100 bg-white p-0.5 shrink-0 shadow-sm"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = vinimapLogo;
                }}
              />
            ) : (
              <img 
                src={vinimapLogo} 
                alt="Vinimap Logo" 
                className="w-9 h-9 rounded-xl object-cover border border-slate-100 bg-white shrink-0 shadow-sm"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = vinimapLogo;
                }}
              />
            )}
            {isExpanded && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col max-w-[140px]"
              >
                <span className="font-bold text-slate-800 tracking-tight leading-none text-sm truncate">
                  {activeHub?.name || 'Vinimap'}
                </span>
                <span className="text-[9px] text-blue-600 font-extrabold uppercase tracking-wider mt-0.5 truncate">
                  {activeHub?.name ? 'Sede Ativa' : 'Logistics OS'}
                </span>
              </motion.div>
            )}
          </div>
          
          {isExpanded && (
            <button 
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 border border-slate-100 cursor-pointer hidden md:block"
              id="sidebar-toggle-btn"
              title={collapsed ? "Fixar Menu" : "Recolher Menu"}
            >
              {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          )}
        </div>

        {/* Menu Items */}
        <nav className="p-2 space-y-1 mt-2 overflow-y-auto flex-1 min-h-0 select-none scrollbar-none">
          {menuItems.map((item) => {
            const Icon = item.icon;
            
            if (item.isDropdown) {
              const activeInAdmin = isAdminActive;
              const shouldShowOpen = isAdminOpen || activeInAdmin;

              return (
                <div key={item.id} className="space-y-1">
                  <button
                    onClick={() => {
                      setIsAdminOpen(!shouldShowOpen);
                      if (!activeInAdmin) {
                        setActiveSection('admin');
                      }
                    }}
                    className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all duration-200 group relative cursor-pointer ${
                      isExpanded ? 'justify-between p-2.5' : 'justify-center p-2'
                    } ${
                      activeInAdmin 
                        ? 'text-blue-700 bg-blue-50/70 shadow-sm' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/80'
                    }`}
                    id={`sidebar-menu-${item.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon 
                        size={16} 
                        className={`shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                          activeInAdmin ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                        }`} 
                      />
                      {isExpanded && (
                        <motion.span 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="truncate text-[12px]"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </div>

                    {isExpanded && (
                      <ChevronDown 
                        size={14} 
                        className={`text-slate-400 transition-transform duration-200 ${shouldShowOpen ? 'rotate-180 text-blue-600' : ''}`} 
                      />
                    )}

                    {!isExpanded && (
                      <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-slate-900 text-white text-[10px] font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap shadow-md z-40">
                        {item.label}
                      </div>
                    )}

                    {activeInAdmin && (
                      <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-blue-600 rounded-r-lg" />
                    )}
                  </button>

                  {/* Dropdown Sub-menu */}
                  <AnimatePresence>
                    {isExpanded && shouldShowOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="pl-7 pr-1 space-y-1 overflow-hidden"
                      >
                        {adminSubItems.map((sub) => {
                          const SubIcon = sub.icon;
                          const isSubActive = activeSection === sub.id;
                          return (
                            <button
                              key={sub.id}
                              onClick={() => {
                                if (sub.id === 'bloquear_login') {
                                  if (onLogout) {
                                    onLogout();
                                  } else {
                                    localStorage.removeItem('vinimap_admin_session');
                                    localStorage.setItem('vinimap_logged_out', 'true');
                                    window.location.reload();
                                  }
                                  return;
                                }
                                setActiveSection(sub.id);
                              }}
                              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                                isSubActive
                                  ? 'bg-blue-100/70 text-blue-800 font-extrabold shadow-2xs'
                                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
                              }`}
                              id={`sidebar-sub-menu-${sub.id}`}
                            >
                              <SubIcon size={13} className={isSubActive ? 'text-blue-600' : 'text-slate-400'} />
                              <span className="truncate">{sub.label}</span>
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            }

            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all duration-200 group relative cursor-pointer ${
                  isExpanded ? 'justify-between p-2.5' : 'justify-center p-2'
                } ${
                  isActive 
                    ? 'text-blue-700 bg-blue-50/70 shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/80'
                }`}
                id={`sidebar-menu-${item.id}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon 
                    size={16} 
                    className={`shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                      isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                    }`} 
                  />
                  {isExpanded && (
                    <motion.span 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="truncate text-[12px]"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </div>

                {/* Badges or indicators */}
                {isExpanded && (
                  <>
                    {item.badge && (
                      <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-blue-100 text-blue-700 rounded-full shrink-0">
                        {item.badge}
                      </span>
                    )}
                    {item.pulse && (
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    )}
                  </>
                )}

                {/* Collapsed Tooltip */}
                {!isExpanded && (
                  <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-slate-900 text-white text-[10px] font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap shadow-md z-40">
                    {item.label}
                  </div>
                )}

                {/* Active marker pill */}
                {isActive && (
                  <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-blue-600 rounded-r-lg" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Vercel & Supabase Status inside Sidebar */}
      <div className="p-2 border-t border-slate-100 shrink-0">
        <DiagnosticUtility mode="sidebar" isExpanded={isExpanded} />
      </div>

      {/* Sidebar Footer */}
      <div className="p-2 border-t border-slate-100 shrink-0">
        {isExpanded ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-3 bg-slate-50 rounded-2xl border border-slate-100/50 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Operação Ativa</span>
              </div>
              <span className="text-[9px] font-mono text-slate-400">v1.4.2</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">Central Vinimap SP Conectada.</p>
            
            <div className="flex items-center justify-between border-t border-slate-200/50 pt-2 gap-1">
              <button 
                onClick={() => setActiveSection('configuracoes')}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 text-[11px] font-semibold cursor-pointer transition-colors"
                title="Configurações da Operação"
                id="sidebar-settings-btn"
              >
                <Settings size={13} />
                <span>Ajustes</span>
              </button>

              <button 
                onClick={() => setShowLogoutModal(true)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-100/70 text-[11px] font-bold cursor-pointer transition-colors"
                title="Sair do Painel / Encerrar Sessão"
                id="sidebar-logout-btn"
              >
                <LogOut size={13} />
                <span>Sair</span>
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <button 
              onClick={() => setActiveSection('configuracoes')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              title="Configurações"
              id="sidebar-settings-collapsed-btn"
            >
              <Settings size={14} />
            </button>
            <button 
              onClick={() => setShowLogoutModal(true)}
              className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
              title="Sair do Painel"
              id="sidebar-logout-collapsed-btn"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Sidebar Logout Confirmation Dialog */}
      <AnimatePresence>
        {showLogoutModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl text-center space-y-4 relative overflow-hidden"
              id="sidebar-logout-modal"
            >
              <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
                <LogOut size={26} className="stroke-[2.5]" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-lg font-black text-slate-800">Deseja sair do painel?</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Sua sessão de despachante será encerrada com segurança.
                </p>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setShowLogoutModal(false);
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
                >
                  <LogOut size={14} />
                  <span>Sim, Sair</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
