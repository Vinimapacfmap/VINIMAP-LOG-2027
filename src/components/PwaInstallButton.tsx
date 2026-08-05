/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Download, CheckCircle2, Sparkles, X, ExternalLink, ChevronRight, Check, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DeliveryRider, CompanyHub } from '../types';
import vinimapLogo from '../assets/images/vinimap_app_logo_1785236008840.jpg';

interface PwaInstallButtonProps {
  variant?: 'header' | 'sidebar' | 'banner';
  className?: string;
  activeHub?: CompanyHub;
}

export const PwaInstallButton: React.FC<PwaInstallButtonProps> = ({ variant = 'header', className = '', activeHub }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false);

  const companyLogo = activeHub?.logoUrl || vinimapLogo;

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent default browser banner
      e.preventDefault();
      // Save the event for manual triggering
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsAppInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setIsAppInstalled(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.warn('PWA prompt error:', err);
        setShowModal(true);
      }
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      {/* HEADER VARIANT */}
      {variant === 'header' && (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-sm ${
            isAppInstalled
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
              : deferredPrompt
              ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-emerald-200 animate-pulse'
              : 'bg-emerald-600/90 hover:bg-emerald-600 active:bg-emerald-700 text-white border border-emerald-400/30'
          } ${className}`}
          title="Instalar o aplicativo Vinimap no seu dispositivo"
          id="header-pwa-install-btn"
        >
          {isAppInstalled ? (
            <>
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
              <span className="hidden sm:inline">App Instalado</span>
            </>
          ) : (
            <>
              <Download size={15} className={deferredPrompt ? 'animate-bounce shrink-0' : 'shrink-0'} />
              <span>{deferredPrompt ? 'Instalar PWA' : 'Instalar App'}</span>
              {deferredPrompt && (
                <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
              )}
            </>
          )}
        </button>
      )}

      {/* SIDEBAR VARIANT */}
      {variant === 'sidebar' && (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`w-full p-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-between gap-2 ${
            isAppInstalled
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : deferredPrompt
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-200 hover:from-emerald-700 hover:to-teal-700'
              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80'
          } ${className}`}
          id="sidebar-pwa-install-btn"
        >
          <div className="flex items-center gap-2 min-w-0">
            {isAppInstalled ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            ) : (
              <Download size={16} className={`shrink-0 ${deferredPrompt ? 'animate-bounce text-amber-200' : 'text-emerald-700'}`} />
            )}
            <span className="truncate">
              {isAppInstalled ? 'App Minimap Ativo' : deferredPrompt ? 'Instalar PWA Pronto' : 'Instalar App Vinimap'}
            </span>
          </div>
          {!isAppInstalled && (
            <span className="px-1.5 py-0.5 bg-emerald-500 text-white rounded text-[9px] font-black uppercase shrink-0">
              PWA
            </span>
          )}
        </button>
      )}

      {/* BANNER / FULL CARD VARIANT */}
      {variant === 'banner' && (
        <div className={`p-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl border border-slate-700 shadow-xl space-y-3 ${className}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/20 shrink-0 shadow-md bg-slate-900">
              <img src={companyLogo} alt="Vinimap Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div>
              <h4 className="font-black text-xs text-white">Aplicativo Oficial Vinimap</h4>
              <p className="text-[11px] text-slate-300 font-medium">Instale diretamente sem passar por lojas de aplicativos.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleInstallClick}
            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Download size={15} className={deferredPrompt ? 'animate-bounce' : ''} />
            <span>{isAppInstalled ? 'Verificar Atalho Instalado' : deferredPrompt ? 'Disparar Instalação PWA Agora' : 'Instalar / Criar Atalho PWA'}</span>
          </button>
        </div>
      )}

      {/* PWA INSTALLATION MODAL / GUIDE */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-slate-800 space-y-5 relative my-auto"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>

              {/* Header */}
              <div className="text-center space-y-2 pt-1">
                <div className="w-16 h-16 rounded-2xl mx-auto shadow-lg border-2 border-emerald-500/30 overflow-hidden bg-slate-900 flex items-center justify-center p-0.5 relative">
                  <img src={companyLogo} alt="Vinimap Logo" className="w-full h-full object-cover rounded-xl" referrerPolicy="no-referrer" />
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white border-2 border-white text-[10px]">
                    <Check size={12} />
                  </span>
                </div>
                <div>
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black uppercase tracking-wider">
                    Instalação PWA
                  </span>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight mt-1">
                    Instalar App Vinimap no Dispositivo
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Adicione o aplicativo Vinimap à tela inicial do seu celular ou computador para acesso instantâneo e uso offline.
                  </p>
                </div>
              </div>

              {/* PWA Event Status Banner */}
              <div className="p-3.5 bg-slate-900 text-white rounded-2xl space-y-1.5 shadow-md border border-slate-800">
                <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs">
                  <Sparkles size={16} className="animate-spin" />
                  <span>{deferredPrompt ? 'Prompt de Instalação Pronto!' : 'Modo PWA Habilitado'}</span>
                </div>
                <p className="text-[11px] text-slate-300 font-medium leading-relaxed m-0">
                  {deferredPrompt
                    ? 'O navegador detectou que o aplicativo pode ser instalado diretamente no seu sistema.'
                    : 'Você pode fixar este aplicativo na sua tela de início usando as ferramentas do navegador.'}
                </p>
              </div>

              {/* Instructions per device */}
              <div className="space-y-3">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                  Como Instalar Manualmente:
                </span>

                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1">
                  <div className="flex items-center gap-2 font-black text-xs text-slate-800">
                    <Smartphone size={14} className="text-emerald-600 shrink-0" />
                    <span>Android / Google Chrome</span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium leading-relaxed m-0">
                    Toque no menu do Chrome <strong>(⋮)</strong> e selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1">
                  <div className="flex items-center gap-2 font-black text-xs text-slate-800">
                    <Smartphone size={14} className="text-blue-600 shrink-0" />
                    <span>iPhone / iOS Safari</span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium leading-relaxed m-0">
                    Toque no ícone de Compartilhar <strong>(Compartilhar)</strong> no Safari e selecione <strong>"Adicionar à Tela de Início"</strong>.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-1">
                {deferredPrompt && (
                  <button
                    type="button"
                    onClick={() => {
                      deferredPrompt.prompt();
                      deferredPrompt.userChoice.then((choice: any) => {
                        if (choice.outcome === 'accepted') {
                          setIsAppInstalled(true);
                        }
                        setDeferredPrompt(null);
                        setShowModal(false);
                      });
                    }}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider"
                  >
                    <Download size={16} className="animate-bounce" />
                    <span>Disparar Prompt Nativo de Instalação</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    alert('Link copiado para a área de transferência!');
                  }}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 border border-slate-200"
                >
                  <ExternalLink size={14} />
                  <span>Copiar Link do Aplicativo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Concluído</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
