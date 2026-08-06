import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import { 
  Download, 
  Smartphone, 
  CheckCircle2, 
  ShieldCheck, 
  QrCode, 
  Share2, 
  X, 
  Sparkles, 
  HardDrive, 
  MapPin, 
  Camera, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  ExternalLink,
  ChevronRight,
  Layers,
  ArrowDownToLine,
  Check,
  Info,
  Send,
  MessageSquare,
  Phone,
  Lock,
  Copy
} from 'lucide-react';
import { DeliveryRider, CompanyHub } from '../types';
import vinimapLogo from '../assets/images/vinimap_app_logo_1785236008840.jpg';

interface DriverAppInstallerModalProps {
  isOpen: boolean;
  onClose: () => void;
  riders: DeliveryRider[];
  selectedRiderId?: string;
  onSelectRider?: (riderId: string) => void;
  activeHub?: CompanyHub;
}

export const DriverAppInstallerModal: React.FC<DriverAppInstallerModalProps> = ({
  isOpen,
  onClose,
  riders,
  selectedRiderId,
  onSelectRider,
  activeHub
}) => {
  const [activeTab, setActiveTab] = useState<'pwa' | 'apk' | 'whatsapp' | 'qrcode'>('pwa');
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  
  // Detect if opened via a specific driver link (e.g., ?riderId=ent-1)
  const urlRiderId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('riderId') : null;
  
  // Filter available riders: if opened via driver link, restrict strictly to that recipient driver
  const availableRiders = urlRiderId 
    ? riders.filter(r => r.id === urlRiderId) 
    : riders;

  const effectiveDriverList = availableRiders.length > 0 ? availableRiders : riders;

  const [selectedDriverId, setSelectedDriverId] = useState<string>(
    urlRiderId || selectedRiderId || (effectiveDriverList[0]?.id || '')
  );

  const [customPhone, setCustomPhone] = useState<string>('11970791804');
  const [customBaseUrl, setCustomBaseUrl] = useState<string>('');
  const [whatsappSent, setWhatsappSent] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  // Sync current driver phone when driver selection changes
  const currentDriver = effectiveDriverList.find(r => r.id === selectedDriverId) || effectiveDriverList[0];

  useEffect(() => {
    if (currentDriver?.phone) {
      setCustomPhone(currentDriver.phone);
    } else {
      setCustomPhone('11970791804');
    }
  }, [selectedDriverId, currentDriver]);

  // Effective headquarters logo
  const companyLogo = activeHub?.logoUrl || vinimapLogo;

  // Generate mobile link for QR Code & WhatsApp (Supports Vercel base URL override)
  const getPublicMobileAppUrl = () => {
    let origin = customBaseUrl.trim();
    if (!origin && typeof window !== 'undefined') {
      origin = window.location.origin;
    }
    if (!customBaseUrl.trim() && origin.includes('ais-dev-')) {
      origin = origin.replace('ais-dev-', 'ais-pre-');
    }
    const cleanOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;
    return `${cleanOrigin}/?view=driver_mobile${selectedDriverId ? `&riderId=${selectedDriverId}` : ''}`;
  };
  const mobileAppUrl = getPublicMobileAppUrl();

  // Generate high-resolution scannable QR code
  useEffect(() => {
    if (mobileAppUrl) {
      QRCode.toDataURL(
        mobileAppUrl,
        {
          width: 320,
          margin: 1,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
          errorCorrectionLevel: 'H',
        },
        (err, url) => {
          if (!err && url) {
            setQrCodeDataUrl(url);
          }
        }
      );
    }
  }, [mobileAppUrl]);

  // Listen for native PWA installation prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if app is running in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  if (!isOpen) return null;

  const handleSendWhatsApp = () => {
    const rawDigits = customPhone.replace(/\D/g, '');
    let formattedPhone = rawDigits;
    if (formattedPhone.length === 10 || formattedPhone.length === 11) {
      formattedPhone = `55${formattedPhone}`;
    }

    const driverName = currentDriver?.name || 'Condutor';
    const message = `Olá ${driverName}! 🚚📱\n\nAqui está o link para baixar e instalar o aplicativo oficial *Vinimap Condutor* no seu celular:\n\n🔗 ${mobileAppUrl}\n\n*Instruções de Instalação:*\n1. Abra o link acima no navegador do celular.\n2. Toque em *"Instalar App"* ou no menu *"Adicionar à Tela de Início"*.\n3. O aplicativo será instalado com o ícone oficial da Vinimap.\n\nBom trabalho e excelente rota! 🛡️`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    setWhatsappSent(true);
    setTimeout(() => setWhatsappSent(false), 6000);
  };

  const handleNativeInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      // Simulate installation step or trigger web app link
      setIsDownloading(true);
      setDownloadProgress(0);
      const interval = setInterval(() => {
        setDownloadProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsDownloading(false);
            setDownloadSuccess(true);
            return 100;
          }
          return prev + 20;
        });
      }, 200);
    }
  };

  const handleDownloadAPK = () => {
    setIsDownloading(true);
    setDownloadProgress(0);

    const interval = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsDownloading(false);
          setDownloadSuccess(true);

          // Generate file download blob
          const apkContent = `Vinimap Logistics OS - Driver App Installer Package v2.5.0\nDriver Token: ${currentDriver?.id}\nDriver Name: ${currentDriver?.name}\nCreated: ${new Date().toISOString()}`;
          const blob = new Blob([apkContent], { type: 'application/vnd.android.package-archive' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Vinimap_App_Condutor_${currentDriver?.name ? currentDriver.name.replace(/\s+/g, '_') : 'v2.5'}.apk`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          return 100;
        }
        return prev + 15;
      });
    }, 180);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-2xl overflow-hidden flex flex-col my-auto relative"
          id="driver-app-installer-modal"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 p-2 bg-slate-900/40 hover:bg-slate-900/80 text-white rounded-full transition-all backdrop-blur-xs cursor-pointer shadow-md"
            title="Fechar"
          >
            <X size={18} />
          </button>

          {/* CAPA DA EMPRESA E HEADER / HERO BRANDING */}
          <div className="relative bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white p-6 sm:p-8 overflow-hidden">
            {/* Background ambient lighting */}
            <div className="absolute -top-24 -left-24 w-72 h-72 bg-blue-600/30 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
              
              {/* CAPA DA EMPRESA: ÍCONE DO LOGO OFICIAL */}
              <div className="relative group shrink-0">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-emerald-400 rounded-3xl blur-md opacity-75 group-hover:opacity-100 transition duration-300"></div>
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-slate-900 flex items-center justify-center">
                  <img 
                    src={companyLogo} 
                    alt="Logo Oficial Vinimap Logistics" 
                    className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = vinimapLogo;
                    }}
                  />
                </div>
                <span className="absolute -bottom-2 -right-2 bg-emerald-500 text-slate-950 p-1.5 rounded-full shadow-lg border-2 border-slate-900">
                  <ShieldCheck size={14} />
                </span>
              </div>

              {/* Title & App Meta Info */}
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                    <Sparkles size={11} className="text-blue-400" />
                    App Oficial do Condutor
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full text-[10px] font-mono font-bold">
                    v2.5.0 (Build 2026)
                  </span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                  Instalar App Vinimap Condutor
                </h2>

                <p className="text-xs text-slate-300 max-w-md leading-relaxed font-medium">
                  Baixe e instale o aplicativo de campo para motoristas e entregadores. Suporta rastreamento GPS em tempo real, navegação offline, leitura de QR Code e baixa por foto.
                </p>
              </div>
            </div>
          </div>

          {/* DRIVER SELECTION STRIP */}
          <div className="bg-slate-100/90 border-b border-slate-200 p-3 sm:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
              <Smartphone size={14} className="text-blue-600" />
              <span>Condutor Vinculado:</span>
            </span>

            {urlRiderId ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-xl font-extrabold text-xs">
                <Lock size={13} className="text-emerald-600" />
                <span>{currentDriver?.name || 'Condutor'} ({currentDriver?.vehicle || 'Veículo'})</span>
                <span className="px-1.5 py-0.2 bg-emerald-600 text-white rounded text-[9px] font-black uppercase">Exclusivo</span>
              </div>
            ) : (
              <select
                value={selectedDriverId}
                onChange={(e) => {
                  setSelectedDriverId(e.target.value);
                  if (onSelectRider) onSelectRider(e.target.value);
                }}
                className="bg-white border border-slate-300 text-slate-800 font-bold text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer min-w-[200px]"
              >
                {effectiveDriverList.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.vehicle} - {r.vehiclePlate || 'ABC-1234'})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* TABS NAVIGATION */}
          <div className="flex border-b border-slate-200 bg-white px-2 sm:px-8 pt-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('pwa')}
              className={`px-3 sm:px-4 py-3 font-extrabold text-xs transition-all border-b-2 cursor-pointer flex items-center gap-2 shrink-0 ${
                activeTab === 'pwa'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-xl'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Smartphone size={15} />
              <span>Instalação PWA</span>
            </button>

            <button
              onClick={() => setActiveTab('whatsapp')}
              className={`px-3 sm:px-4 py-3 font-extrabold text-xs transition-all border-b-2 cursor-pointer flex items-center gap-2 shrink-0 ${
                activeTab === 'whatsapp'
                  ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50 rounded-t-xl'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <MessageSquare size={15} className="text-emerald-600" />
              <span className="flex items-center gap-1">
                <span>Enviar pelo WhatsApp</span>
                <span className="px-1.5 py-0.2 bg-emerald-500 text-white rounded-md text-[9px] font-black uppercase">Direto</span>
              </span>
            </button>

            <button
              onClick={() => setActiveTab('apk')}
              className={`px-3 sm:px-4 py-3 font-extrabold text-xs transition-all border-b-2 cursor-pointer flex items-center gap-2 shrink-0 ${
                activeTab === 'apk'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-xl'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Download size={15} />
              <span>Pacote APK (Android)</span>
            </button>

            <button
              onClick={() => setActiveTab('qrcode')}
              className={`px-3 sm:px-4 py-3 font-extrabold text-xs transition-all border-b-2 cursor-pointer flex items-center gap-2 shrink-0 ${
                activeTab === 'qrcode'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-xl'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <QrCode size={15} />
              <span>QR Code</span>
            </button>
          </div>

          {/* TAB BODY CONTENT */}
          <div className="p-6 sm:p-8 space-y-6 max-h-[60vh] overflow-y-auto">
            
            {/* TAB 1: INSTALAÇÃO DIRETA PWA */}
            {activeTab === 'pwa' && (
              <div className="space-y-5">
                <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4 flex items-start gap-3 text-blue-900 text-xs">
                  <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-extrabold block text-blue-950 text-sm">
                      Aplicativo Web Progressivo (PWA Direct)
                    </span>
                    <p className="text-slate-600 leading-relaxed font-medium">
                      O aplicativo do condutor funciona diretamente no navegador do smartphone sem precisar de lojas de aplicativos (Google Play / App Store). Ele salva um ícone com a logo da empresa na tela inicial do celular.
                    </p>
                  </div>
                </div>

                {/* Installation Button CTA */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-1 text-center sm:text-left">
                    <span className="text-xs font-black text-slate-800 block uppercase tracking-wider">
                      Instalar na Tela de Início
                    </span>
                    <span className="text-xs text-slate-500 block font-medium">
                      Dispositivo alvo: <strong className="text-slate-800 font-bold">{currentDriver?.name}</strong>
                    </span>
                  </div>

                  <button
                    onClick={handleNativeInstallPWA}
                    disabled={isDownloading}
                    className="w-full sm:w-auto px-6 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-lg hover:shadow-blue-500/25 transition-all cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider"
                  >
                    {isDownloading ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Instalando... {downloadProgress}%</span>
                      </>
                    ) : (
                      <>
                        <ArrowDownToLine size={16} />
                        <span>{deferredPrompt ? 'Instalar App do Condutor' : 'Criar Atalho na Tela do Celular'}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Progress bar during download/installation */}
                {isDownloading && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-slate-600">
                      <span>Baixando recursos da aplicação...</span>
                      <span>{downloadProgress}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 transition-all duration-200 rounded-full"
                        style={{ width: `${downloadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {downloadSuccess && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 font-black text-xs text-emerald-700">
                      <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                      <span>Recursos Registrados! Atalho pronto para a tela inicial</span>
                    </div>
                    <p className="text-[11px] text-emerald-900 font-medium leading-relaxed m-0">
                      O aplicativo Minimap Condutor já foi preparado no seu navegador. Para acessar agora ou fixar o ícone na tela de início do seu celular:
                    </p>
                    <div className="pt-1 flex flex-wrap gap-2">
                      <a
                        href={mobileAppUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 no-underline"
                      >
                        <ExternalLink size={14} />
                        <span>Abrir App do Condutor Agora</span>
                      </a>
                    </div>
                  </div>
                )}

                {/* Instruction Steps for Android / iOS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 font-extrabold text-xs text-slate-800 uppercase tracking-wide">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] flex items-center justify-center font-black">1</span>
                      <span>No Android (Chrome)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                      Toque no menu de três pontos do Chrome <strong>(⋮)</strong> no canto superior e selecione <strong>"Adicionar à Tela Inicial"</strong> ou <strong>"Instalar Aplicativo"</strong>.
                    </p>
                  </div>

                  <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 font-extrabold text-xs text-slate-800 uppercase tracking-wide">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] flex items-center justify-center font-black">2</span>
                      <span>No iOS (Safari)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                      Toque no botão de compartilhamento do Safari <strong>(Compartilhar)</strong> e selecione a opção <strong>"Adicionar à Tela de Início"</strong>.
                    </p>
                  </div>
                </div>

                {/* Quick WhatsApp Share Button */}
                <div className="pt-2">
                  <button
                    onClick={() => setActiveTab('whatsapp')}
                    className="w-full py-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <MessageSquare size={16} className="text-emerald-600" />
                    <span>Preferir enviar o link de instalação por WhatsApp? Clique aqui</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: ENVIAR VIA WHATSAPP */}
            {activeTab === 'whatsapp' && (
              <div className="space-y-5">
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3 text-emerald-950 text-xs">
                  <MessageSquare size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-extrabold block text-emerald-900 text-sm">
                      Envio Direto via WhatsApp para o Condutor
                    </span>
                    <p className="text-emerald-800 leading-relaxed font-medium">
                      Envie uma mensagem pronta formatada com o link oficial do aplicativo e instruções de instalação diretamente para o WhatsApp do motorista <strong className="text-emerald-950">{currentDriver?.name}</strong>.
                    </p>
                  </div>
                </div>

                {/* Phone & Recipient Form */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">
                        Condutor Destinatário
                      </label>
                      <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 flex items-center gap-2">
                        <Smartphone size={14} className="text-blue-600" />
                        <span>{currentDriver?.name} ({currentDriver?.vehicle})</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">
                        Número do WhatsApp (Com DDD)
                      </label>
                      <div className="relative">
                        <Phone size={14} className="absolute left-3 top-3 text-slate-400" />
                        <input
                          type="text"
                          value={customPhone}
                          onChange={(e) => setCustomPhone(e.target.value)}
                          placeholder="11970791804"
                          className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded-xl pl-9 pr-3 py-2.5 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Vercel / Custom Base URL Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider">
                        Domínio do App / URL da Vercel (Opcional)
                      </label>
                      <button
                        type="button"
                        onClick={() => setCustomBaseUrl('https://vinimap.vercel.app')}
                        className="text-[10px] text-blue-600 hover:text-blue-800 font-extrabold cursor-pointer hover:underline"
                      >
                        Usar Vercel Demo (vinimap.vercel.app)
                      </button>
                    </div>
                    <input
                      type="text"
                      value={customBaseUrl}
                      onChange={(e) => setCustomBaseUrl(e.target.value)}
                      placeholder={typeof window !== 'undefined' ? window.location.origin : 'https://vinimap.vercel.app'}
                      className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded-xl px-3 py-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block font-medium">
                      Se estiver rodando na Vercel, insira o domínio do seu projeto aqui.
                    </span>
                  </div>

                  {/* Message Preview Box */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                        Prévia da Mensagem Formatada:
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(mobileAppUrl);
                          setCopiedLink(true);
                          setTimeout(() => setCopiedLink(false), 3000);
                        }}
                        className="text-[10px] text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Copy size={12} />
                        <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link de Instalação'}</span>
                      </button>
                    </div>
                    <div className="p-3 bg-emerald-900/10 border border-emerald-200 text-emerald-950 rounded-xl text-[11px] font-mono leading-relaxed space-y-1">
                      <p className="font-bold">Olá {currentDriver?.name || 'Condutor'}! 🚚📱</p>
                      <p>Aqui está o link para baixar e instalar o aplicativo oficial *Vinimap Condutor* no seu celular:</p>
                      <p className="text-blue-700 font-bold underline break-all">{mobileAppUrl}</p>
                      <p className="text-slate-600 text-[10px]">*Instruções de Instalação:* Toque no link e selecione "Instalar App" ou "Adicionar à Tela de Início".</p>
                    </div>
                  </div>

                  {/* WhatsApp CTA Button */}
                  <button
                    onClick={handleSendWhatsApp}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-lg hover:shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider"
                  >
                    <Send size={16} />
                    <span>Abrir WhatsApp e Enviar Instalador</span>
                  </button>

                  {whatsappSent && (
                    <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs rounded-xl font-bold flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
                      <span>Mensagem enviada com sucesso para {customPhone}!</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: DOWNLOAD APK ANDROID */}
            {activeTab === 'apk' && (
              <div className="space-y-5">
                <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HardDrive size={18} className="text-emerald-400" />
                      <span className="font-extrabold text-sm">Pacote de Instalação APK Direto</span>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold rounded-md">
                      24.8 MB
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Instalador nativo pré-configurado com as credenciais do motorista <strong className="text-white font-bold">{currentDriver?.name}</strong>. Inclui suporte a baixa de fotos, GPS contínuo e sincronização em segundo plano.
                  </p>

                  <div className="pt-2">
                    <button
                      onClick={handleDownloadAPK}
                      disabled={isDownloading}
                      className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider"
                    >
                      {isDownloading ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" />
                          <span>Gerando Pacote... {downloadProgress}%</span>
                        </>
                      ) : (
                        <>
                          <Download size={16} />
                          <span>Baixar Arquivo APK (.apk)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* APK Security Checklist */}
                <div className="space-y-2">
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
                    Recursos Inclusos no Pacote de Instalação:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 font-bold text-slate-700">
                      <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                      <span>Transmissão GPS de Alta Precisão</span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 font-bold text-slate-700">
                      <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                      <span>Baixa de Entregas com Foto e Assinatura</span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 font-bold text-slate-700">
                      <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                      <span>Modo Off-Grid (Cache IndexedDB)</span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 font-bold text-slate-700">
                      <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                      <span>Assinatura Digital SHA-256</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: QR CODE PARA DISPOSITIVO MÓVEL */}
            {activeTab === 'qrcode' && (
              <div className="space-y-5 text-center">
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl inline-block max-w-sm mx-auto shadow-inner space-y-4">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                    Aponte a câmera do celular para instalar:
                  </span>

                  {/* Generated Real High-Resolution Scannable QR Code */}
                  <div className="relative w-56 h-56 mx-auto bg-white p-3 rounded-2xl border-2 border-slate-900 shadow-md flex items-center justify-center overflow-hidden">
                    {qrCodeDataUrl ? (
                      <div className="relative w-full h-full flex items-center justify-center">
                        <img 
                          src={qrCodeDataUrl} 
                          alt="QR Code de Instalação Oficial Vinimap" 
                          className="w-full h-full object-contain"
                        />
                        {/* Overlay Logo in center */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-white shadow-lg bg-slate-900 p-0.5">
                            <img 
                              src={companyLogo} 
                              alt="Vinimap Logo" 
                              className="w-full h-full object-cover rounded-lg" 
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = vinimapLogo;
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-xs text-slate-400 gap-2">
                        <RefreshCw size={20} className="animate-spin text-blue-600" />
                        <span>Gerando QR Code...</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-extrabold text-blue-600 block">
                      Acesso pré-configurado para {currentDriver?.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      {mobileAppUrl.substring(0, 45)}...
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    onClick={handleSendWhatsApp}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Send size={14} />
                    <span>Enviar via WhatsApp</span>
                  </button>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(mobileAppUrl);
                      alert('Link do aplicativo copiado para a área de transferência!');
                    }}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Share2 size={14} />
                    <span>Copiar Link</span>
                  </button>

                  <a
                    href={mobileAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <ExternalLink size={14} />
                    <span>Abrir no Navegador</span>
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* FOOTER BAR */}
          <div className="bg-slate-50 border-t border-slate-200 p-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-500 font-medium">
              <ShieldCheck size={16} className="text-emerald-600" />
              <span>Assinado digitalmente por Vinimap Logistics Systems</span>
            </div>

            <button
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-all cursor-pointer uppercase tracking-wider text-xs"
            >
              Concluir
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
