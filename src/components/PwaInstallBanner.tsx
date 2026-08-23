/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Download, Smartphone, X, Sparkles, CheckCircle2, ChevronRight, Share } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import vinimapLogo from '../assets/images/vinimap_app_logo_1785236008840.jpg';

interface PwaInstallBannerProps {
  className?: string;
  logoUrl?: string;
}

export const PwaInstallBanner: React.FC<PwaInstallBannerProps> = ({ className = '', logoUrl }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);
  const [showIosGuide, setShowIosGuide] = useState<boolean>(false);
  const [installedSuccess, setInstalledSuccess] = useState<boolean>(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed as PWA)
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    setIsStandalone(isStandaloneMode);

    // Check if iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // Listen for Chrome/Android beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setInstalledSuccess(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsStandalone(true);
          setInstalledSuccess(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.warn('Erro ao disparar prompt PWA:', err);
      }
    } else if (isIos) {
      setShowIosGuide(true);
    } else {
      setShowIosGuide(true);
    }
  };

  // Don't render if running in standalone mode (installed app) or user dismissed it
  if (isStandalone || isDismissed) {
    if (installedSuccess) {
      return (
        <div className={`p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-semibold flex items-center justify-between gap-2 ${className}`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>Aplicativo instalado com sucesso na tela inicial!</span>
          </div>
        </div>
      );
    }
    return null;
  }

  const logoSrc = logoUrl || vinimapLogo;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 15 }}
        className={`bg-slate-900 border border-slate-800 text-white rounded-2xl p-3.5 shadow-xl space-y-3 relative overflow-hidden ${className}`}
        id="pwa-install-banner-container"
      >
        {/* Glow Accent */}
        <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-emerald-500/15 rounded-full blur-xl pointer-events-none" />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-700/80 overflow-hidden shrink-0 p-0.5 shadow-inner">
              <img 
                src={logoSrc} 
                alt="App Logo" 
                className="w-full h-full object-cover rounded-lg" 
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = vinimapLogo;
                }}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-extrabold text-white truncate">Instalar Vinimap Condutor</span>
                {deferredPrompt && (
                  <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[9px] font-black uppercase tracking-wider shrink-0 animate-pulse">
                    PWA Pronto
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 truncate font-medium">
                {deferredPrompt ? 'Clique para adicionar à tela inicial do celular' : 'Instale como aplicativo sem baixar na loja'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Fechar banner"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleInstallClick}
            className={`flex-1 py-2 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
              deferredPrompt
                ? 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-emerald-950/40'
                : 'bg-emerald-600/90 hover:bg-emerald-600 active:bg-emerald-700 text-white'
            }`}
            id="btn-banner-install-pwa"
          >
            <Download size={14} className={deferredPrompt ? 'animate-bounce' : ''} />
            <span>{deferredPrompt ? 'Instalar Aplicativo Agora' : 'Ver Como Instalar (PWA)'}</span>
          </button>
        </div>
      </motion.div>

      {/* iOS & Manual Installation Guide Modal */}
      <AnimatePresence>
        {showIosGuide && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 text-slate-800 space-y-4 relative"
            >
              <button
                onClick={() => setShowIosGuide(false)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 overflow-hidden border border-slate-200 p-0.5 shrink-0 shadow-md">
                  <img 
                    src={logoSrc} 
                    alt="Logo" 
                    className="w-full h-full object-cover rounded-xl" 
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = vinimapLogo;
                    }}
                  />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">Instalação no Celular</h3>
                  <p className="text-[11px] text-slate-500">Adicione o atalho na tela inicial do seu telefone.</p>
                </div>
              </div>

              {isIos ? (
                <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-2xl space-y-2 text-left">
                  <div className="flex items-center gap-2 font-bold text-xs text-blue-900">
                    <Share size={15} className="text-blue-600 shrink-0" />
                    <span>Instruções para iPhone (Safari)</span>
                  </div>
                  <ol className="text-[11px] text-blue-800 space-y-1 pl-4 list-decimal font-medium">
                    <li>Toque no ícone de <strong>Compartilhar</strong> na barra do Safari.</li>
                    <li>Role as opções e toque em <strong>"Adicionar à Tela de Início"</strong>.</li>
                    <li>Confirme em <strong>"Adicionar"</strong> no canto superior.</li>
                  </ol>
                </div>
              ) : (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-left">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-800">
                    <Smartphone size={15} className="text-emerald-600 shrink-0" />
                    <span>Instruções para Android (Chrome)</span>
                  </div>
                  <ol className="text-[11px] text-slate-700 space-y-1 pl-4 list-decimal font-medium">
                    <li>Toque no menu de 3 pontos <strong>(⋮)</strong> no Chrome.</li>
                    <li>Selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.</li>
                    <li>Confirme a instalação.</li>
                  </ol>
                </div>
              )}

              <button
                onClick={() => setShowIosGuide(false)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Entendi!</span>
                <ChevronRight size={14} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
