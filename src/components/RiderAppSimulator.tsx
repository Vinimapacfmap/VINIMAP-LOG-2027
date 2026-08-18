/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DeliveryRider, Order, OrderStatus, ActivityLog, ClientPartner, isMatchingClientCode, CompanyHub } from '../types';
import { getSaoPauloISODate, getSaoPauloDate, getSaoPauloTime, extractISODateFromTimestamp } from '../utils/dateUtils';
import { compareOrdersByCep } from '../utils/addressUtils';
import { isOrderMatchingRider } from '../utils/partnerUtils';
import { realtimeSyncBus } from '../utils/realtimeSync';
import { compressImage } from '../utils/imageCompressor';
import { dbSaveDeliveryRider, validateRiderDeviceSession } from '../lib/dbService';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

import { PwaInstallBanner } from './PwaInstallBanner';

function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'device_server';
  try {
    let devId = localStorage.getItem('vinimap_rider_device_id');
    if (!devId) {
      devId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      localStorage.setItem('vinimap_rider_device_id', devId);
    }
    return devId;
  } catch (e) {
    return `device_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }
}
import { 
  Smartphone, 
  Wifi, 
  WifiOff,
  CloudOff,
  HardDrive,
  Battery, 
  MapPin, 
  Navigation, 
  Compass,
  ArrowLeft,
  Maximize2,
  Minimize2,
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Play, 
  Pause, 
  RotateCcw, 
  Camera, 
  Clock, 
  Phone, 
  ChevronRight, 
  ChevronDown,
  ExternalLink, 
  User, 
  Truck, 
  Check, 
  X, 
  Map as MapIcon, 
  HelpCircle, 
  QrCode, 
  Shield, 
  RefreshCw,
  TrendingUp,
  Volume2,
  FileText,
  Printer,
  Download,
  Search,
  Award,
  PenTool,
  Image as ImageIcon,
  DollarSign,
  ArrowUp,
  ArrowDown,
  FileSignature,
  Lock as LockIcon,
  Menu,
  Users,
  LogOut
} from 'lucide-react';
import { SignatureCanvasModal } from './SignatureCanvasModal';
import { DriverAppInstallerModal } from './DriverAppInstallerModal';
import { applyDynamicPwaManifestAndIcons, getDriverAppInstallUrl } from '../utils/pwaUtils';
import vinimapLogo from '../assets/images/vinimap_app_logo_1785236008840.jpg';

const convertToGeoLat = (svgLatPercent: number) => -23.52 - (svgLatPercent / 100) * 0.12;
const convertToGeoLng = (svgLngPercent: number) => -46.72 + (svgLngPercent / 100) * 0.18;

const generateStaticSvgMap = (lat: number, lng: number, address: string) => {
  const escapedAddress = address.replace(/[&<>'"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
    <!-- Map Grid Background -->
    <rect width="300" height="300" fill="#f1f5f9"/>
    
    <!-- Stylized Grid Lines representing blocks -->
    <g stroke="#cbd5e1" stroke-width="2.5">
      <line x1="0" y1="40" x2="300" y2="40"/>
      <line x1="0" y1="110" x2="300" y2="110"/>
      <line x1="0" y1="180" x2="300" y2="180"/>
      <line x1="0" y1="250" x2="300" y2="250"/>
      
      <line x1="60" y1="0" x2="60" y2="300"/>
      <line x1="140" y1="0" x2="140" y2="300"/>
      <line x1="220" y1="0" x2="220" y2="300"/>
    </g>

    <!-- Secondary detailed street routes -->
    <g stroke="#e2e8f0" stroke-width="1.2">
      <line x1="0" y1="75" x2="300" y2="75"/>
      <line x1="0" y1="145" x2="300" y2="145"/>
      <line x1="0" y1="215" x2="300" y2="215"/>
      
      <line x1="100" y1="0" x2="100" y2="300"/>
      <line x1="180" y1="0" x2="180" y2="300"/>
      <line x1="260" y1="0" x2="260" y2="300"/>
    </g>

    <!-- Water Canal or Green Belt feature to simulate real terrain -->
    <path d="M -10,145 C 50,155 100,120 180,135 C 240,145 280,110 310,125" fill="none" stroke="#93c5fd" stroke-width="12" opacity="0.75"/>
    <path d="M -10,145 C 50,155 100,120 180,135 C 240,145 280,110 310,125" fill="none" stroke="#60a5fa" stroke-width="4" opacity="0.9"/>
    
    <!-- Park Area -->
    <rect x="15" y="15" width="35" height="45" rx="4" fill="#dcfce7" stroke="#bbf7d0" stroke-width="1" opacity="0.8"/>
    <text x="32" y="42" font-family="system-ui, sans-serif" font-size="6" font-weight="extrabold" fill="#166534" text-anchor="middle">PARQUE</text>

    <!-- Navigation Compass / GPS Data Overlay -->
    <rect x="10" y="235" width="125" height="55" rx="8" fill="#1e293b" opacity="0.92" stroke="#475569" stroke-width="0.5"/>
    <text x="20" y="248" font-family="monospace" font-size="7" font-weight="bold" fill="#38bdf8">AUTO-REGISTRO GPS</text>
    <text x="20" y="259" font-family="monospace" font-size="6.5" fill="#94a3b8">LAT: ${lat.toFixed(6)}</text>
    <text x="20" y="269" font-family="monospace" font-size="6.5" fill="#94a3b8">LNG: ${lng.toFixed(6)}</text>
    <text x="20" y="279" font-family="monospace" font-size="6" font-weight="bold" fill="#10b981">CONFORMIDADE ✓</text>

    <!-- Target Pin Location Marker -->
    <g transform="translate(140, 110)">
      <!-- Radar Pulse Ring -->
      <circle r="18" fill="#ef4444" opacity="0.25"/>
      <circle r="8" fill="#ef4444" opacity="0.4"/>
      
      <!-- High Contrast Pin Marker -->
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#dc2626" transform="translate(-12, -22)"/>
      <circle cx="0" cy="-13" r="3.5" fill="#ffffff"/>
    </g>

    <!-- Address Tag Banner -->
    <g transform="translate(140, 75)">
      <rect x="-65" y="-10" width="130" height="15" rx="3" fill="#ffffff" stroke="#ef4444" stroke-width="1" />
      <text x="0" y="0" font-family="system-ui, sans-serif" font-size="6.5" font-weight="bold" fill="#0f172a" text-anchor="middle">COORDENADA DE ENTREGA</text>
    </g>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
};

interface RiderAppSimulatorProps {
  riders: DeliveryRider[];
  orders: Order[];
  onUpdateRiderCoords: (
    riderId: string, 
    lat: number, 
    lng: number, 
    realGeoLat?: number, 
    realGeoLng?: number, 
    gpsAccuracy?: number, 
    lastGpsUpdate?: string, 
    isGpsRealActive?: boolean
  ) => void;
  onUpdateOrderStatus: (
    orderId: string, 
    status: OrderStatus,
    protocolNumber?: string,
    signatureUrl?: string,
    deliveryPhotoUrl?: string,
    recipientName?: string,
    recipientDoc?: string,
    observations?: string
  ) => void;
  onSaveLogs: (logs: ActivityLog[]) => void;
  isFloating?: boolean; // If used in the side panel
  onCloseFloating?: () => void;
  showRiderEarnings?: boolean;
  activeRiderId?: string | null;
  onActiveRiderChange?: (riderId: string | null) => void;
  clientPartners?: ClientPartner[];
  onUpdateOrders?: (orders: Order[]) => void;
  isStandalone?: boolean;
  isRealDevice?: boolean;
  activeHub?: CompanyHub;
}

export interface PhotoQueueTask {
  id: string;
  source: File | string;
  label: string;
  status: 'pending' | 'compressing' | 'syncing' | 'completed' | 'error';
  progressMessage: string;
  resultUrl?: string;
  error?: string;
  createdAt: number;
}

export interface OfflineQueueItem {
  id: string;
  riderId: string;
  orderId: string;
  status: OrderStatus;
  protocolNumber?: string;
  signatureUrl?: string;
  deliveryPhotoUrl?: string;
  recipientName?: string;
  recipientDoc?: string;
  observations?: string;
  timestamp: string;
}

export default function RiderAppSimulator({
  riders,
  orders,
  onUpdateRiderCoords,
  onUpdateOrderStatus,
  onSaveLogs,
  isFloating = false,
  onCloseFloating,
  showRiderEarnings = false,
  activeRiderId,
  onActiveRiderChange,
  clientPartners = [],
  onUpdateOrders,
  isStandalone = false,
  isRealDevice = false,
  activeHub
}: RiderAppSimulatorProps) {
  const effectiveLogo = activeHub?.logoUrl || vinimapLogo;
  const [isUserFullScreen, setIsUserFullScreen] = useState(false);
  const [isDrawerMenuOpen, setIsDrawerMenuOpen] = useState(false);
  
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 1024 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  });

  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        setIsMobileScreen(window.innerWidth < 1024 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isEffectiveRealDevice = isRealDevice || isStandalone || isUserFullScreen || isMobileScreen || (typeof window !== 'undefined' && (
    new URLSearchParams(window.location.search).has('mobile') || 
    new URLSearchParams(window.location.search).has('riderId') || 
    new URLSearchParams(window.location.search).get('view') === 'driver_mobile'
  ));

  const [selectedRiderId, setSelectedRiderId] = useState<string>('');
  const [lockedRiderId, setLockedRiderId] = useState<string | null>(null);
  const selectedRider = riders.find(r => {
    if (!selectedRiderId) return false;
    const cleanSel = selectedRiderId.trim().toLowerCase();
    const selDigits = cleanSel.replace(/\D/g, '');
    if (r.id.toLowerCase() === cleanSel) return true;
    if (r.name.toLowerCase() === cleanSel) return true;
    if (selDigits.length >= 8) {
      if (r.phone && r.phone.replace(/\D/g, '') === selDigits) return true;
      if (r.deviceNumber && r.deviceNumber.replace(/\D/g, '') === selDigits) return true;
      if (r.cpfCnpj && r.cpfCnpj.replace(/\D/g, '') === selDigits) return true;
    }
    return false;
  });

  // Apply dynamic PWA icons & manifest using Headquarters Logo
  useEffect(() => {
    applyDynamicPwaManifestAndIcons(activeHub?.logoUrl);
  }, [activeHub]);

  // Check URL parameters for standalone driver device link (?riderId=xxx)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlRiderParam = params.get('riderId');
      if (urlRiderParam) {
        setLockedRiderId(urlRiderParam);
        setSelectedRiderId(urlRiderParam);
        const targetRider = riders.find(r => r.id === urlRiderParam);
        if (targetRider) {
          setPhoneInput(prev => prev || targetRider.deviceNumber || targetRider.phone || '');
          setPasswordInput(prev => prev || targetRider.password || '1234');
        }
      } else {
        if (!selectedRiderId && riders.length > 0) {
          const storedRiderId = localStorage.getItem('vinimap_driver_id') || activeRiderId;
          const initial = (storedRiderId && riders.some(r => r.id === storedRiderId))
            ? storedRiderId
            : riders[0].id;
          setSelectedRiderId(initial);
          const targetRider = riders.find(r => r.id === initial);
          if (targetRider) {
            setPhoneInput(prev => prev || targetRider.deviceNumber || targetRider.phone || '');
            setPasswordInput(prev => prev || targetRider.password || '1234');
          }
        }
      }
    }
  }, [riders, activeRiderId]);

  // Sync state with parent activeRiderId
  useEffect(() => {
    if (activeRiderId && activeRiderId !== selectedRiderId) {
      setSelectedRiderId(activeRiderId);
    }
  }, [activeRiderId]);

  const changeSelectedRiderId = (id: string) => {
    if (!id) return;
    setSelectedRiderId(id);
    if (lockedRiderId) {
      setLockedRiderId(id);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('vinimap_driver_id', id);
    }
    const targetRider = riders.find(r => r.id === id);
    if (targetRider) {
      setPhoneInput(targetRider.deviceNumber || targetRider.phone || '');
      setPasswordInput(targetRider.password || '1234');
      setLoginError(null);
    }
    // Clear selected order if it belongs to another driver
    if (selectedOrder && selectedOrder.riderId !== id && selectedRider && selectedOrder.riderId !== selectedRider.name) {
      setSelectedOrder(null);
      if (currentScreen === 'details') {
        setCurrentScreen('dashboard');
      }
    }
    if (onActiveRiderChange) {
      onActiveRiderChange(id);
    }
  };

  const handleMoveOrder = (orderId: string, direction: 'up' | 'down') => {
    // Active orders excluding Concluído, Cancelado, and Ocorrência
    const activeNotCompleted = driverActiveOrders.filter(o => o.status !== 'Concluído' && o.status !== 'Cancelado' && o.status !== 'Ocorrência');
    const index = activeNotCompleted.findIndex(o => o.id === orderId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= activeNotCompleted.length) return;

    // Swap the elements in the array
    const updatedList = [...activeNotCompleted];
    const temp = updatedList[index];
    updatedList[index] = updatedList[newIndex];
    updatedList[newIndex] = temp;

    // Assign consecutive sequences starting from 1
    const updatedOrders = updatedList.map((order, idx) => ({
      ...order,
      sequence: idx + 1
    }));

    playBeep(900, 0.08);

    if (onUpdateOrders) {
      onUpdateOrders(updatedOrders);
    }
  };
  const [currentScreen, setCurrentScreen] = useState<'login' | 'dashboard' | 'map' | 'deliveries' | 'details'>('login');
  const [activeTab, setActiveTab] = useState<'home' | 'map' | 'tasks' | 'protocols' | 'help' | 'audio'>('home');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Helper to persist driver session and selected order before external map navigation
  const prepareExternalMapNavigation = (orderToNavigate?: Order | null) => {
    if (typeof window !== 'undefined') {
      const targetRiderId = selectedRiderId || lockedRiderId;
      if (targetRiderId) {
        localStorage.setItem('vinimap_driver_id', targetRiderId);
        localStorage.setItem('vinimap_driver_logged_in', 'true');
      }
      const targetOrd = orderToNavigate || selectedOrder;
      if (targetOrd) {
        setSelectedOrder(targetOrd);
        localStorage.setItem('vinimap_driver_selected_order_id', targetOrd.id);
        localStorage.setItem('vinimap_driver_active_screen', 'details');
        localStorage.setItem('vinimap_driver_active_tab', 'tasks');
      } else {
        localStorage.setItem('vinimap_driver_active_screen', 'dashboard');
      }
    }
  };

  // Persist driver active screen and selected order in localStorage so returning from Google Maps / map view doesn't reset to login screen
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (selectedRiderId && currentScreen !== 'login') {
        localStorage.setItem('vinimap_driver_id', selectedRiderId);
        localStorage.setItem('vinimap_driver_logged_in', 'true');
        localStorage.setItem('vinimap_driver_active_screen', currentScreen);
        localStorage.setItem('vinimap_driver_active_tab', activeTab);
        if (selectedOrder) {
          localStorage.setItem('vinimap_driver_selected_order_id', selectedOrder.id);
        }
      }
    }
  }, [selectedRiderId, currentScreen, activeTab, selectedOrder]);

  const hasRestoredSessionRef = useRef(false);

  // Restore active session and selected order when returning to the app (e.g., after viewing map)
  useEffect(() => {
    if (typeof window === 'undefined' || hasRestoredSessionRef.current) return;
    if (riders.length === 0) return;

    hasRestoredSessionRef.current = true;
    
    const savedLoggedIn = localStorage.getItem('vinimap_driver_logged_in') === 'true';
    const savedRiderId = localStorage.getItem('vinimap_driver_id') || lockedRiderId;
    const savedOrderId = localStorage.getItem('vinimap_driver_selected_order_id');
    const savedScreen = localStorage.getItem('vinimap_driver_active_screen');
    const savedTab = localStorage.getItem('vinimap_driver_active_tab');

    if (savedRiderId) {
      const targetRider = riders.find(r => r.id === savedRiderId);
      if (targetRider) {
        setSelectedRiderId(targetRider.id);
        
        // Auto restore order if saved
        if (savedOrderId && orders.length > 0) {
          const foundOrder = orders.find(o => o.id === savedOrderId);
          if (foundOrder) {
            setSelectedOrder(foundOrder);
          }
        }

        // Auto restore logged-in screen instead of resetting to login
        if (savedLoggedIn || targetRider.isLoggedIn || isStandalone || isEffectiveRealDevice) {
          if (savedScreen === 'details' && savedOrderId) {
            setCurrentScreen('details');
            setActiveTab('tasks');
          } else if (savedScreen === 'map' || savedTab === 'map') {
            setActiveTab('map');
            if (savedOrderId) {
              setCurrentScreen('details');
            } else {
              setCurrentScreen('dashboard');
            }
          } else if (savedScreen === 'dashboard' || savedScreen === 'deliveries') {
            setCurrentScreen('dashboard');
            if (savedTab) setActiveTab(savedTab as any);
          } else if (currentScreen === 'login') {
            // Fallback for active driver session: restore details if order exists, otherwise dashboard
            setCurrentScreen(savedOrderId ? 'details' : 'dashboard');
          }

          // Auto-start GPS by default upon active session restore
          setTimeout(() => {
            if (typeof navigator !== 'undefined' && navigator.geolocation) {
              startRealGpsTracking();
            }
          }, 300);
        }
      }
    }
  }, [riders, orders, isStandalone, isEffectiveRealDevice]);

  // Keep selectedOrder synced with updated orders prop
  useEffect(() => {
    if (selectedOrder && orders.length > 0) {
      const freshOrder = orders.find(o => o.id === selectedOrder.id);
      if (freshOrder && freshOrder !== selectedOrder) {
        setSelectedOrder(freshOrder);
      }
    }
  }, [orders]);

  // Individual Login State
  const [phoneInput, setPhoneInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Delivery Cards Dashboard States
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [showIncidentInputId, setShowIncidentInputId] = useState<string | null>(null);
  const [incidentReasonInput, setIncidentReasonInput] = useState<string>('');
  const [showReceiverInputId, setShowReceiverInputId] = useState<string | null>(null);
  const [receiverNameInput, setReceiverNameInput] = useState<string>('');

  // Sound effects generator via Web Audio API
  const playBeep = (freq = 800, duration = 0.1) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn("AudioContext failed to play:", e);
    }
  };

  const playChimeSuccess = () => {
    playBeep(987.77, 0.12);
    setTimeout(() => playBeep(1318.51, 0.22), 120);
  };

  const playChimeFailure = () => {
    playBeep(550.00, 0.18);
    setTimeout(() => playBeep(330.00, 0.28), 160);
  };

  const playNotificationSound = (soundType = 'alerta_padrao') => {
    try {
      if (soundType === 'sinal_suave') {
        playBeep(523.25, 0.15);
        setTimeout(() => playBeep(659.25, 0.15), 120);
        setTimeout(() => playBeep(783.99, 0.2), 240);
      } else if (soundType === 'sinal_urgente') {
        playBeep(1200, 0.08);
        setTimeout(() => playBeep(1500, 0.08), 90);
        setTimeout(() => playBeep(1200, 0.08), 180);
        setTimeout(() => playBeep(1500, 0.12), 270);
      } else if (soundType === 'pop_moderno') {
        playBeep(1046.5, 0.06);
        setTimeout(() => playBeep(1318.5, 0.08), 70);
        setTimeout(() => playBeep(1567.98, 0.1), 140);
      } else {
        // 'alerta_padrao'
        playBeep(880, 0.1);
        setTimeout(() => playBeep(1174, 0.15), 100);
      }
    } catch (e) {
      console.warn("AudioContext notification failed:", e);
    }
  };

  // Live Simulated Push Notifications state
  const [phoneNotification, setPhoneNotification] = useState<{ title: string; body: string } | null>(null);

  // Monitor newly assigned orders for current rider and trigger sound alert
  const prevOrderIdsRef = useRef<Set<string>>(new Set());
  const isAudioEffectMountedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!selectedRiderId && !selectedRider) return;

    // Filter active orders assigned to selected driver
    const currentRiderOrders = orders.filter(o =>
      isOrderMatchingRider(o, selectedRiderId || selectedRider?.id, riders) &&
      o.status !== 'Concluído' && o.status !== 'Cancelado'
    );
    const currentIds = new Set(currentRiderOrders.map(o => o.id));

    // If already mounted, check for newly appeared orders
    if (isAudioEffectMountedRef.current) {
      let newlyAddedCount = 0;
      currentIds.forEach(id => {
        if (!prevOrderIdsRef.current.has(id)) {
          newlyAddedCount++;
        }
      });

      if (newlyAddedCount > 0) {
        // Sound alert check (default: true)
        const soundEnabled = !selectedRider || selectedRider.enableSoundAlert !== false;
        if (soundEnabled) {
          playNotificationSound(selectedRider?.soundType || 'alerta_padrao');
        }

        // Haptic feedback / vibration if supported
        try {
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
          }
        } catch (_) {}

        // Push notification on simulator screen
        setPhoneNotification({
          title: `🔔 Novo${newlyAddedCount > 1 ? 's' : ''} Pedido${newlyAddedCount > 1 ? 's' : ''} Recebido${newlyAddedCount > 1 ? 's' : ''}!`,
          body: `Você recebeu ${newlyAddedCount} novo${newlyAddedCount > 1 ? 's' : ''} pedido${newlyAddedCount > 1 ? 's' : ''} de entrega.`
        });
        setTimeout(() => setPhoneNotification(null), 6000);
      }
    } else {
      isAudioEffectMountedRef.current = true;
    }

    prevOrderIdsRef.current = currentIds;
  }, [orders, selectedRiderId, selectedRider?.enableSoundAlert, selectedRider?.soundType, riders]);

  // --- OFFLINE CACHE & NETWORK SIGNAL STATE ---
  const [isNetworkOffline, setIsNetworkOffline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? !navigator.onLine : false;
  });

  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>(() => {
    try {
      const saved = localStorage.getItem('vinimap_rider_offline_queue');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [isSyncingOfflineQueue, setIsSyncingOfflineQueue] = useState<boolean>(false);
  const [isInstallerModalOpen, setIsInstallerModalOpen] = useState<boolean>(false);
  const [showPwaGuideModal, setShowPwaGuideModal] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState<boolean>(false);

  // Listen for native PWA installation event (beforeinstallprompt)
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
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

  const handleTriggerInstallPwa = async () => {
    triggerPhoneNotification(
      "Instalação do App",
      "Siga as instruções na tela para fixar o atalho no seu celular.",
      "info"
    );

    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setIsAppInstalled(true);
          triggerPhoneNotification("App Instalado!", "O atalho da Vinimap foi adicionado à sua tela inicial.", "success");
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.warn('Erro ao acionar prompt PWA:', err);
      }
    }
    
    setShowPwaGuideModal(true);
  };

  // Sync state to localStorage whenever queue changes
  useEffect(() => {
    try {
      localStorage.setItem('vinimap_rider_offline_queue', JSON.stringify(offlineQueue));
    } catch (e) {
      console.error("Erro ao salvar fila offline no localStorage:", e);
    }
  }, [offlineQueue]);

  // Listen for real window online / offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsNetworkOffline(false);
    };
    const handleOffline = () => {
      setIsNetworkOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Central handler for status updates with offline cache support
  const handleUpdateOrderStatus = (
    orderId: string, 
    status: OrderStatus,
    protocolNumber?: string,
    signatureUrl?: string,
    deliveryPhotoUrl?: string,
    recipientName?: string,
    recipientDoc?: string,
    observations?: string
  ) => {
    if (isNetworkOffline) {
      const newItem: OfflineQueueItem = {
        id: `offline-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        riderId: selectedRiderId,
        orderId,
        status,
        protocolNumber,
        signatureUrl,
        deliveryPhotoUrl,
        recipientName,
        recipientDoc,
        observations,
        timestamp: new Date().toISOString()
      };

      setOfflineQueue(prev => [...prev, newItem]);

      // Optimistic update for parent orders if onUpdateOrders provided
      if (onUpdateOrders && orders) {
        const todayIso = getSaoPauloISODate();
        const timeNow = getSaoPauloTime();
        const updatedOrders = orders.map(o => {
          if (o.id === orderId) {
            return {
              ...o,
              status,
              ...(protocolNumber ? { protocolNumber } : {}),
              ...(signatureUrl ? { signatureUrl } : {}),
              ...(deliveryPhotoUrl ? { deliveryPhotoUrl } : {}),
              ...(recipientName ? { recipientName } : {}),
              ...(recipientDoc ? { recipientDoc } : {}),
              ...(observations ? { notes: observations, observations } : {}),
              ...(status === 'Concluído' ? {
                deliveryDate: o.deliveryDate || todayIso,
                dataConclusao: o.dataConclusao || todayIso,
                deliveryTime: o.deliveryTime || timeNow,
                horarioFinal: o.horarioFinal || timeNow
              } : {})
            };
          }
          return o;
        });
        onUpdateOrders(updatedOrders);
      }

      // Also call standard parent handler so local react state stays updated
      onUpdateOrderStatus(
        orderId,
        status,
        protocolNumber,
        signatureUrl,
        deliveryPhotoUrl,
        recipientName,
        recipientDoc,
        observations
      );

      triggerPhoneNotification(
        "💾 Salvo no Cache Local",
        `Pedido #${orderId} alterado para "${status}" em modo offline. O status será transmitido automaticamente ao recuperar sinal.`,
        'info'
      );
    } else {
      onUpdateOrderStatus(
        orderId,
        status,
        protocolNumber,
        signatureUrl,
        deliveryPhotoUrl,
        recipientName,
        recipientDoc,
        observations
      );
    }
  };

  // Process and sync queued items when coming back online
  const syncOfflineQueue = async () => {
    if (offlineQueue.length === 0 || isSyncingOfflineQueue) return;

    setIsSyncingOfflineQueue(true);
    let syncedCount = 0;

    try {
      for (const item of offlineQueue) {
        onUpdateOrderStatus(
          item.orderId,
          item.status,
          item.protocolNumber,
          item.signatureUrl,
          item.deliveryPhotoUrl,
          item.recipientName,
          item.recipientDoc,
          item.observations
        );
        syncedCount++;
      }

      setOfflineQueue([]);
      localStorage.removeItem('vinimap_rider_offline_queue');

      playChimeSuccess();
      triggerPhoneNotification(
        "⚡ Sincronização Concluída!",
        `${syncedCount} atualização(ões) de entregas salvas no cache local foram enviadas com sucesso ao servidor!`,
        'success'
      );

      onSaveLogs([{
        id: `log-sync-${Date.now()}`,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        type: 'success',
        message: `App do Condutor: Sincronização offline automática concluída! ${syncedCount} atualizações salvas localmente foram transmitidas ao painel principal.`,
      }]);
    } catch (err) {
      console.error("Falha ao sincronizar fila offline:", err);
      triggerPhoneNotification(
        "Erro na Sincronização",
        "Falha ao transmitir dados do cache. Os itens foram mantidos salvos no dispositivo.",
        'failure'
      );
    } finally {
      setIsSyncingOfflineQueue(false);
    }
  };

  // State for manual synchronization with system
  const [isSyncingWithSystem, setIsSyncingWithSystem] = useState<boolean>(false);

  // Synchronize orders in real-time from broadcast channel (for instant reallocation / new orders updates)
  useEffect(() => {
    const unsub = realtimeSyncBus.subscribe('*', (msg) => {
      const { type, payload } = msg;

      if (type === 'ORDERS_BATCH_UPDATED' && Array.isArray(payload) && onUpdateOrders) {
        const batch: Order[] = payload;
        const map = new Map(orders.map(o => [o.id, o]));
        batch.forEach(o => map.set(o.id, { ...(map.get(o.id) || o), ...o }));
        onUpdateOrders(Array.from(map.values()));
      } else if ((type === 'ORDER_STATUS_CHANGED' || type === 'ORDER_UPDATED') && payload?.id && onUpdateOrders) {
        const updatedOrder: Order = payload;
        const exists = orders.some(o => o.id === updatedOrder.id);
        if (exists) {
          onUpdateOrders(orders.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o));
        } else {
          onUpdateOrders([updatedOrder, ...orders]);
        }
      } else if (type === 'ORDER_DELETED' && typeof payload === 'string' && onUpdateOrders) {
        const deletedId = payload;
        onUpdateOrders(orders.filter(o => o.id !== deletedId));
      }
    });

    return () => {
      unsub();
    };
  }, [onUpdateOrders, orders]);

  // Manual explicit synchronization of today's orders with system
  const handleManualSyncTodayOrders = async () => {
    if (isSyncingWithSystem) return;
    setIsSyncingWithSystem(true);
    playBeep(987.77, 0.1);

    try {
      // 1. If there's an offline queue, sync it first
      if (offlineQueue.length > 0) {
        await syncOfflineQueue();
      }

      // 2. Broadcast request to parent/peers to push latest orders
      realtimeSyncBus.broadcast('REQUEST_ORDERS_SYNC', {
        riderId: selectedRiderId || selectedRider?.id,
        timestamp: Date.now()
      });

      // 3. Fetch directly from Firestore for guaranteed fresh data
      let freshOrders: Order[] = [];
      try {
        const snap = await getDocs(collection(db, 'orders'));
        snap.forEach(d => {
          freshOrders.push(d.data() as Order);
        });
      } catch (e) {
        console.warn("Direct Firestore read fallback:", e);
      }

      if (freshOrders.length > 0 && onUpdateOrders) {
        onUpdateOrders(freshOrders);
      }

      // 4. Calculate active orders count for driver feedback
      const currentList = freshOrders.length > 0 ? freshOrders : orders;
      const activeCount = currentList.filter(isOrderActiveForDriver).length;

      playChimeSuccess();
      triggerPhoneNotification(
        "🔄 Sincronização Concluída!",
        `Sistema sincronizado com sucesso! ${activeCount} lançamento(s) do dia atualizados no seu dispositivo.`,
        'success'
      );

      onSaveLogs([{
        id: `log-sync-manual-${Date.now()}`,
        time: getSaoPauloTime(),
        type: 'success',
        message: `App do Condutor (${selectedRider?.name || 'Condutor'}): Sincronização manual dos lançamentos do dia realizada com sucesso (${activeCount} pedidos ativos).`
      }]);
    } catch (error) {
      console.error("Erro ao sincronizar lançamentos:", error);
      playChimeFailure();
      triggerPhoneNotification(
        "Aviso de Sincronização",
        "Sincronização concluída com base nos dados locais.",
        'info'
      );
    } finally {
      setIsSyncingWithSystem(false);
    }
  };

  // Auto-sync when reconnecting online
  useEffect(() => {
    if (!isNetworkOffline && offlineQueue.length > 0) {
      syncOfflineQueue();
    }
  }, [isNetworkOffline]);

  const triggerPhoneNotification = (title: string, body: string, chimeType: 'info' | 'success' | 'failure' = 'info') => {
    setPhoneNotification({ title, body });
    if (chimeType === 'success') {
      playChimeSuccess();
    } else if (chimeType === 'failure') {
      playChimeFailure();
    } else {
      playBeep(880, 0.1);
    }
    setTimeout(() => {
      setPhoneNotification(prev => (prev?.title === title ? null : prev));
    }, 4000);
  };
  
  // Delivery Protocol Interface
  interface DeliveryProtocol {
    id: string;
    orderId: string;
    clientName: string;
    address: string;
    timestamp: string;
    receiverName: string;
    signatureImage: string;
    photoImage?: string | null;
    hash: string;
    lat: number;
    lng: number;
    observations?: string;
  }

  // Protocols state
  const [deliveryProtocols, setDeliveryProtocols] = useState<DeliveryProtocol[]>([]);
  const [selectedProtocol, setSelectedProtocol] = useState<DeliveryProtocol | null>(null);
  const [protocolsSearchQuery, setProtocolsSearchQuery] = useState<string>('');
  // Sync / reset activeTab when protocols are hidden
  useEffect(() => {
    if (selectedRider?.ocultarValoresProtocolos && activeTab === 'protocols') {
      setActiveTab('home');
    }
  }, [selectedRider?.ocultarValoresProtocolos, activeTab]);

  // Signature Pad State
  const [signatureMode, setSignatureMode] = useState<'draw' | 'type'>('draw');
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const isDrawingRef = useRef(false);
  const hasDrawnOnCanvasRef = useRef(false);

  // Delivery receipt success screen state
  const [showSuccessProtocol, setShowSuccessProtocol] = useState(false);
  const [generatedProtocol, setGeneratedProtocol] = useState<DeliveryProtocol | null>(null);
  const [fullScreenOrder, setFullScreenOrder] = useState<Order | null>(null);

  // Live Camera stream state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // GPS simulation state
  const [isSimulating, setIsSimulating] = useState(false);
  const [simSpeed, setSimSpeed] = useState<number>(2.5); // multiplier for speed
  const [simProgress, setSimProgress] = useState<number>(0);
  const [simulationLog, setSimulationLog] = useState<string[]>([]);
  
  // Camera/Receipt submission modal state
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [isDriverSignatureModalOpen, setIsDriverSignatureModalOpen] = useState(false);
  const [receiptPhoto, setReceiptPhoto] = useState<string | null>(null);
  const [receiptSignature, setReceiptSignature] = useState<string>('');
  const [receiverName, setReceiverName] = useState<string>('');
  const [receiptObservations, setReceiptObservations] = useState<string>('');
  const [isSubmittingDelivery, setIsSubmittingDelivery] = useState(false);
  
  // Photo Upload & Compression Queue State (Sequential worker prevents RAM crash & Firestore overflow)
  const [photoQueue, setPhotoQueue] = useState<PhotoQueueTask[]>([]);
  const [isProcessingPhotoQueue, setIsProcessingPhotoQueue] = useState<boolean>(false);
  const photoQueueTasksRef = useRef<(PhotoQueueTask & { _resolve: (url: string) => void; _reject: (err: any) => void })[]>([]);
  const isPhotoWorkerRunningRef = useRef<boolean>(false);

  const processPhotoQueue = async () => {
    if (isPhotoWorkerRunningRef.current) return;

    const nextTask = photoQueueTasksRef.current.find(t => t.status === 'pending');
    if (!nextTask) {
      setIsProcessingPhotoQueue(false);
      return;
    }

    isPhotoWorkerRunningRef.current = true;
    setIsProcessingPhotoQueue(true);

    nextTask.status = 'compressing';
    nextTask.progressMessage = 'Comprimindo foto (Otimizando memória)...';
    setPhotoQueue(photoQueueTasksRef.current.map(t => ({
      id: t.id,
      source: t.source,
      label: t.label,
      status: t.status,
      progressMessage: t.progressMessage,
      resultUrl: t.resultUrl,
      error: t.error,
      createdAt: t.createdAt
    })));

    try {
      // Execute canvas compression sequentially
      const compressedUrl = await compressImage(nextTask.source, 800, 800, 0.65);

      nextTask.status = 'syncing';
      nextTask.progressMessage = 'Sincronizando envio com Firestore...';
      nextTask.resultUrl = compressedUrl;
      setPhotoQueue(photoQueueTasksRef.current.map(t => ({
        id: t.id,
        source: t.source,
        label: t.label,
        status: t.status,
        progressMessage: t.progressMessage,
        resultUrl: t.resultUrl,
        error: t.error,
        createdAt: t.createdAt
      })));

      // Micro-delay for memory release
      await new Promise(r => setTimeout(r, 60));

      nextTask.status = 'completed';
      setPhotoQueue(photoQueueTasksRef.current.map(t => ({
        id: t.id,
        source: t.source,
        label: t.label,
        status: t.status,
        progressMessage: t.progressMessage,
        resultUrl: t.resultUrl,
        error: t.error,
        createdAt: t.createdAt
      })));

      nextTask._resolve(compressedUrl);
    } catch (err: any) {
      console.error("[PhotoQueueWorker] Erro ao comprimir e processar foto:", err);
      nextTask.status = 'error';
      nextTask.error = String(err?.message || err);
      nextTask.progressMessage = 'Erro no processamento da imagem';
      setPhotoQueue(photoQueueTasksRef.current.map(t => ({
        id: t.id,
        source: t.source,
        label: t.label,
        status: t.status,
        progressMessage: t.progressMessage,
        resultUrl: t.resultUrl,
        error: t.error,
        createdAt: t.createdAt
      })));
      nextTask._reject(err);
    } finally {
      isPhotoWorkerRunningRef.current = false;

      // Auto-purge completed task after short window
      setTimeout(() => {
        photoQueueTasksRef.current = photoQueueTasksRef.current.filter(t => t.id !== nextTask.id);
        setPhotoQueue(photoQueueTasksRef.current.map(t => ({
          id: t.id,
          source: t.source,
          label: t.label,
          status: t.status,
          progressMessage: t.progressMessage,
          resultUrl: t.resultUrl,
          error: t.error,
          createdAt: t.createdAt
        })));
      }, 800);

      // Trigger next task in sequence
      processPhotoQueue();
    }
  };

  const enqueuePhotoProcessing = (source: File | string, label?: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const taskId = `photo-task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const task = {
        id: taskId,
        source,
        label: label || (typeof source === 'string' ? 'Foto da Câmera' : source.name),
        status: 'pending' as const,
        progressMessage: 'Aguardando na fila...',
        createdAt: Date.now(),
        _resolve: resolve,
        _reject: reject
      };

      photoQueueTasksRef.current.push(task);
      setPhotoQueue(photoQueueTasksRef.current.map(t => ({
        id: t.id,
        source: t.source,
        label: t.label,
        status: t.status,
        progressMessage: t.progressMessage,
        resultUrl: t.resultUrl,
        error: t.error,
        createdAt: t.createdAt
      })));

      processPhotoQueue();
    });
  };
  
  // Failure modal state
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [failureReason, setFailureReason] = useState<string>('');
  
  // Local leafet maps for the phone
  const phoneMapContainerRef = useRef<HTMLDivElement>(null);
  const phoneMapInstanceRef = useRef<any>(null);
  const phoneRiderMarkerRef = useRef<any>(null);
  const phoneRouteLineRef = useRef<any>(null);

  // Timer reference for simulation intervals
  const simulationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Real Device GPS Tracking state (HTML5 Geolocation API)
  const [isRealGpsActive, setIsRealGpsActive] = useState<boolean>(false);
  const [realGpsData, setRealGpsData] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    speed: number | null;
    timestamp: number;
  } | null>(null);
  const [realGpsStatus, setRealGpsStatus] = useState<'off' | 'connecting' | 'active' | 'error' | 'denied'>('off');
  const [realGpsErrorMessage, setRealGpsErrorMessage] = useState<string>('');
  const realGpsWatchRef = useRef<number | null>(null);

  // Sync selected rider's real GPS state if present
  useEffect(() => {
    if (selectedRider?.isGpsRealActive && selectedRider.realGeoLat && selectedRider.realGeoLng) {
      setIsRealGpsActive(true);
      setRealGpsStatus('active');
      setRealGpsData({
        lat: selectedRider.realGeoLat,
        lng: selectedRider.realGeoLng,
        accuracy: selectedRider.gpsAccuracy || 5,
        speed: null,
        timestamp: Date.now()
      });
    }
  }, [selectedRiderId]);

  // Cleanup watcher on unmount
  useEffect(() => {
    return () => {
      if (realGpsWatchRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(realGpsWatchRef.current);
      }
    };
  }, []);

  // Start continuous watchPosition
  const startRealGpsTracking = () => {
    if (!navigator.geolocation) {
      setRealGpsStatus('error');
      setRealGpsErrorMessage('Navegador não possui suporte ao GPS Geolocation.');
      triggerPhoneNotification('GPS Indisponível', 'Seu dispositivo ou navegador não suporta a API de Geolocalização.', 'failure');
      return;
    }

    setRealGpsStatus('connecting');
    setRealGpsErrorMessage('');

    if (realGpsWatchRef.current !== null) {
      navigator.geolocation.clearWatch(realGpsWatchRef.current);
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy, speed } = pos.coords;
        const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        setRealGpsStatus('active');
        setIsRealGpsActive(true);
        setRealGpsData({
          lat: latitude,
          lng: longitude,
          accuracy: accuracy || 0,
          speed: speed,
          timestamp: pos.timestamp || Date.now()
        });

        // Calculate SVG percentage coordinates for fallback map grids
        const nextLatPercent = (-23.52 - latitude) / 0.12 * 100;
        const nextLngPercent = (longitude - (-46.72)) / 0.18 * 100;

        const clampedLat = Math.min(100, Math.max(0, nextLatPercent));
        const clampedLng = Math.min(100, Math.max(0, nextLngPercent));

        if (selectedRider) {
          onUpdateRiderCoords(
            selectedRider.id,
            clampedLat,
            clampedLng,
            latitude,
            longitude,
            accuracy || 0,
            nowTime,
            true
          );
          realtimeSyncBus.broadcastRiderGps({
            riderId: selectedRider.id,
            lat: clampedLat,
            lng: clampedLng,
            realGeoLat: latitude,
            realGeoLng: longitude,
            gpsAccuracy: accuracy || 0,
            lastGpsUpdate: nowTime,
            isGpsRealActive: true
          });
        }

        // Move phone Leaflet map marker if visible
        try {
          if (phoneRiderMarkerRef.current && (phoneRiderMarkerRef.current as any)._map) {
            phoneRiderMarkerRef.current.setLatLng([latitude, longitude]);
          }
          if (phoneMapInstanceRef.current && (phoneMapInstanceRef.current as any)._loaded) {
            phoneMapInstanceRef.current.panTo([latitude, longitude]);
          }
        } catch (err) {
          // Ignore marker movement on detached/unmounting maps
        }

        setSimulationLog(prev => [
          `📡 GPS REAL CELULAR: Lat ${latitude.toFixed(6)}, Lng ${longitude.toFixed(6)} (±${Math.round(accuracy)}m) às ${nowTime}`,
          ...prev
        ].slice(0, 10));
      },
      (err) => {
        console.warn('Geolocation watchPosition error:', err);
        let errorMsg = 'Erro ao capturar sinal do GPS.';
        if (err.code === err.PERMISSION_DENIED) {
          setRealGpsStatus('denied');
          errorMsg = 'Permissão de localização foi negada no celular. Permita o GPS no seu navegador para rastrear ao vivo.';
          triggerPhoneNotification('GPS Negado', 'Habilite a localização no navegador do celular.', 'failure');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setRealGpsStatus('error');
          errorMsg = 'Sinal de GPS temporariamente indisponível.';
        } else if (err.code === err.TIMEOUT) {
          setRealGpsStatus('error');
          errorMsg = 'Tempo limite esgotado ao aguardar o sinal do GPS do celular.';
        }
        setRealGpsErrorMessage(errorMsg);
        setIsRealGpsActive(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 1000
      }
    );

    realGpsWatchRef.current = watchId;

    triggerPhoneNotification(
      '📡 GPS Real Conectando...',
      'Capturando sinal do sensor de localização do seu celular.',
      'info'
    );
  };

  const stopRealGpsTracking = () => {
    if (realGpsWatchRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(realGpsWatchRef.current);
      realGpsWatchRef.current = null;
    }
    setIsRealGpsActive(false);
    setRealGpsStatus('off');

    if (selectedRider) {
      onUpdateRiderCoords(
        selectedRider.id,
        selectedRider.lat,
        selectedRider.lng,
        undefined,
        undefined,
        undefined,
        undefined,
        false
      );
    }

    setSimulationLog(prev => ['🔴 Transmissão de GPS Real do Celular pausada.', ...prev]);
    triggerPhoneNotification('GPS Pausado', 'Transmissão do GPS do celular foi interrompida.', 'info');
  };

  const captureInstantLocation = () => {
    if (!navigator.geolocation) {
      triggerPhoneNotification('GPS Indisponível', 'Navegador sem suporte a geolocalização.', 'failure');
      return;
    }

    setRealGpsStatus('connecting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        setRealGpsStatus('active');
        setIsRealGpsActive(true);
        setRealGpsData({
          lat: latitude,
          lng: longitude,
          accuracy: accuracy || 0,
          speed: pos.coords.speed,
          timestamp: pos.timestamp || Date.now()
        });

        const nextLatPercent = (-23.52 - latitude) / 0.12 * 100;
        const nextLngPercent = (longitude - (-46.72)) / 0.18 * 100;

        if (selectedRider) {
          onUpdateRiderCoords(
            selectedRider.id,
            nextLatPercent,
            nextLngPercent,
            latitude,
            longitude,
            accuracy || 0,
            nowTime,
            true
          );
          realtimeSyncBus.broadcastRiderGps({
            riderId: selectedRider.id,
            lat: nextLatPercent,
            lng: nextLngPercent,
            realGeoLat: latitude,
            realGeoLng: longitude,
            gpsAccuracy: accuracy || 0,
            lastGpsUpdate: nowTime,
            isGpsRealActive: true
          });
        }

        triggerPhoneNotification(
          '📍 GPS Capturado com Sucesso!',
          `Coordenadas Reais: ${latitude.toFixed(5)}, ${longitude.toFixed(5)} (Precisão: ±${Math.round(accuracy)}m)`,
          'success'
        );
      },
      (err) => {
        setRealGpsStatus('denied');
        triggerPhoneNotification('GPS Desativado', 'Verifique as permissões de localização do celular.', 'failure');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Initialize first available rider (only in non-standalone desktop preview mode)
  useEffect(() => {
    if (!isStandalone && !isEffectiveRealDevice && riders.length > 0 && !selectedRiderId) {
      changeSelectedRiderId(riders[0].id);
    }
  }, [riders, selectedRiderId, isStandalone, isEffectiveRealDevice]);

  // Auto-activate real GPS tracking when driver is active on a real device or when tracking starts
  useEffect(() => {
    if (selectedRider && currentScreen !== 'login' && !isRealGpsActive && (realGpsStatus === 'off' || realGpsStatus === 'connecting') && typeof navigator !== 'undefined' && navigator.geolocation) {
      // Auto-start GPS tracking
      startRealGpsTracking();
    }
  }, [selectedRider?.id, currentScreen, isEffectiveRealDevice, isStandalone]);

  // Active highlighted/selected order in focus
  const focusedOrder = (currentScreen === 'details' && selectedOrder)
    ? selectedOrder
    : orders.find(o => o.id === expandedOrderId);

  // Handle order status updates from clicking the top KPI cards
  const handleCardStatusClick = (targetStatus: OrderStatus) => {
    if (!focusedOrder) {
      triggerPhoneNotification('Selecione um Pedido', 'Selecione ou clique em um pedido abaixo antes de alterar o status!', 'info');
      return;
    }

    if (focusedOrder.status === 'Concluído') {
      triggerPhoneNotification(
        'Ação Restrita',
        `O pedido #${focusedOrder.id} já foi concluído e seu status só pode ser alterado pelo Administrador.`,
        'failure'
      );
      return;
    }
    
    if (focusedOrder.status === targetStatus) {
      triggerPhoneNotification('Status Igual', `O pedido já está com o status "${targetStatus}".`, 'info');
      return;
    }

    if (targetStatus === 'Não iniciado') {
      handleUpdateOrderStatus(focusedOrder.id, 'Não iniciado');
      triggerPhoneNotification('Status Atualizado', `Pedido #${focusedOrder.id} marcado como "Não iniciado".`, 'info');
      onSaveLogs([{
        id: `log-sim-ni-${Date.now()}`,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        type: 'info',
        message: `App do Condutor: Pedido #${focusedOrder.id} marcado como "Não iniciado" por ${selectedRider?.name || 'Condutor'}.`,
        orderId: focusedOrder.id
      }]);
      return;
    }

    if (targetStatus === 'Em rota') {
      handleUpdateOrderStatus(focusedOrder.id, 'Em rota');
      triggerPhoneNotification('Pedido em Rota!', `Pedido #${focusedOrder.id} foi colocado em rota.`, 'info');
      onSaveLogs([{
        id: `log-sim-route-${Date.now()}`,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        type: 'info',
        message: `App do Condutor: Pedido #${focusedOrder.id} marcado como "Em Rota" por ${selectedRider?.name || 'Condutor'}.`,
        orderId: focusedOrder.id
      }]);
    } else if (targetStatus === 'Entregando') {
      handleUpdateOrderStatus(focusedOrder.id, 'Entregando');
      triggerPhoneNotification('Iniciado!', `Entrega do pedido #${focusedOrder.id} iniciada.`, 'info');
      onSaveLogs([{
        id: `log-sim-deliv-${Date.now()}`,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        type: 'info',
        message: `App do Condutor: Pedido #${focusedOrder.id} marcado como "Entregando" por ${selectedRider?.name || 'Condutor'}.`,
        orderId: focusedOrder.id
      }]);
    } else if (targetStatus === 'Concluído') {
      // Open the receiver confirmation subform
      setShowReceiverInputId(focusedOrder.id);
      setShowIncidentInputId(null);
      setReceiverNameInput(focusedOrder.clientName);
      setExpandedOrderId(focusedOrder.id);
      triggerPhoneNotification('Dar Baixa', 'Digite o nome do recebedor abaixo para concluir.', 'info');
    } else if (targetStatus === 'Ocorrência') {
      // Open the incident description subform
      setShowIncidentInputId(focusedOrder.id);
      setShowReceiverInputId(null);
      setIncidentReasonInput('');
      setExpandedOrderId(focusedOrder.id);
      triggerPhoneNotification('Ocorrência', 'Descreva o motivo da ocorrência no campo abaixo.', 'info');
    }
  };

  // Filter orders for the active driver based on the start-the-day-clean rule.
  // Filter orders for the active driver:
  // Any open order allocated to the driver (regardless of original date) is displayed on the driver's screen today to follow the route.
  // Completed/canceled orders remain allocated to the driver for historical and reporting purposes.
  const todayIso = getSaoPauloISODate();
  const todayFormatted = getSaoPauloDate();

  const isOrderActiveForDriver = (order: Order) => {
    const isAssignedToRider = isOrderMatchingRider(order, selectedRiderId || selectedRider?.id, riders);
    if (!isAssignedToRider) return false;
    
    // Open orders allocated to this driver MUST be displayed on driver screen today to follow route, even if from another date
    if (order.status !== 'Concluído' && order.status !== 'Cancelado') {
      return true;
    }

    // For completed orders, show ONLY if completed TODAY (Padrão: exibir apenas pedidos concluídos do dia)
    if (order.status === 'Concluído') {
      const completionDate = extractISODateFromTimestamp(order.deliveryDate || order.dataConclusao || order.date) || order.deliveryDate || order.dataConclusao || order.date;
      return completionDate === todayIso;
    }

    // For canceled orders, show if canceled today
    if (order.status === 'Cancelado') {
      const canceledDate = extractISODateFromTimestamp(order.date) || order.date;
      return canceledDate === todayIso;
    }

    return false;
  };

  const driverActiveOrders = orders.filter(isOrderActiveForDriver).sort((a, b) => {
    return compareOrdersByCep(a, b);
  });

  // Dynamic KPIs synchronized with dashboard
  const completedCount = selectedRiderId
    ? driverActiveOrders.filter(o => o.status === 'Concluído').length
    : 0;
  const pendingCount = selectedRiderId
    ? driverActiveOrders.filter(o => o.status !== 'Concluído' && o.status !== 'Cancelado' && o.status !== 'Ocorrência').length
    : 0;
  const occurrenceCount = selectedRiderId
    ? driverActiveOrders.filter(o => o.status === 'Ocorrência').length
    : 0;
  const naoIniciadoCount = selectedRiderId
    ? driverActiveOrders.filter(o => o.status === 'Não iniciado').length
    : 0;
  const emRotaCount = selectedRiderId
    ? driverActiveOrders.filter(o => o.status === 'Em rota').length
    : 0;
  const entregandoCount = selectedRiderId
    ? driverActiveOrders.filter(o => o.status === 'Entregando').length
    : 0;
  const totalAssignedCount = selectedRiderId
    ? driverActiveOrders.length
    : 0;
  const successRate = totalAssignedCount > 0 
    ? Math.round((completedCount / (completedCount + occurrenceCount || 1)) * 100) 
    : 100;
  const shiftEarnings = selectedRiderId
    ? driverActiveOrders
        .filter(o => o.status === 'Concluído')
        .reduce((sum, o) => sum + (o.driverValue || 0), 0)
    : 0;

// Helper functions to safely extract signature, photo, protocol, and recipient fields from order or rawData
const getOrderSignatureUrl = (order: Order): string | undefined => {
  if (order.signatureUrl && order.signatureUrl.trim()) return order.signatureUrl;
  const raw = order.rawData;
  if (!raw) return undefined;
  return raw.signatureUrl || raw.signatureImage || raw.assinatura || raw.Assinatura || raw.AssinaturaDigital || undefined;
};

const getOrderDeliveryPhotoUrl = (order: Order): string | undefined => {
  if (order.deliveryPhotoUrl && order.deliveryPhotoUrl.trim()) return order.deliveryPhotoUrl;
  const raw = order.rawData;
  if (!raw) return undefined;
  return raw.deliveryPhotoUrl || raw.photoImage || raw.fotoComprovante || raw.foto || raw.Foto || raw.Comprovante || undefined;
};

const getOrderProtocolNumber = (order: Order): string | undefined => {
  if (order.protocolNumber && order.protocolNumber.trim()) return order.protocolNumber;
  const raw = order.rawData;
  if (!raw) return undefined;
  return raw.protocolNumber || raw.NumeroProtocolo || raw.protocolo || raw.Protocolo || undefined;
};

const getOrderRecipientName = (order: Order): string | undefined => {
  if (order.recipientName && order.recipientName.trim()) return order.recipientName;
  const raw = order.rawData;
  if (!raw) return undefined;
  return raw.recipientName || raw.Recebedor || raw.recebedor || undefined;
};

const getOrderRecipientDoc = (order: Order): string | undefined => {
  if (order.recipientDoc && order.recipientDoc.trim()) return order.recipientDoc;
  const raw = order.rawData;
  if (!raw) return undefined;
  return raw.recipientDoc || raw.DocumentoRecebedor || raw.doc || undefined;
};

  // Sync / pre-populate protocols based on completed orders of today for the driver
  useEffect(() => {
    if (!orders || orders.length === 0) return;
    
    // Find completed orders for this driver or all drivers if no specific rider selected (default today)
    const completed = orders.filter(o => {
      const isConclued = o.status === 'Concluído' || !!getOrderProtocolNumber(o) || !!getOrderSignatureUrl(o);
      if (!isConclued) return false;
      if (selectedRiderId) {
        const matchesRider = o.riderId === selectedRiderId || (selectedRider && (o.riderId === selectedRider.id || o.riderId === selectedRider.name));
        if (!matchesRider) return false;
      }
      const orderDate = extractISODateFromTimestamp(o.deliveryDate || o.dataConclusao || o.date) || o.deliveryDate || o.dataConclusao || o.date;
      return orderDate === todayIso;
    });
    
    setDeliveryProtocols(prevProtocols => {
      const prevMap = new Map<string, DeliveryProtocol>(prevProtocols.map(p => [p.orderId, p]));

      const updatedProtocols: DeliveryProtocol[] = completed.map((order, index) => {
        const existing = prevMap.get(order.id);

        const pId = getOrderProtocolNumber(order) || existing?.id || `PRT-2026-${order.id.replace(/\D/g, '') || Math.floor(111111 + Math.random() * 888888)}`;
        const pHash = getOrderProtocolNumber(order) || existing?.hash || pId.replace('PRT-', 'HASH-');

        const orderLat = order.rawData?.Latitude ? parseFloat(order.rawData.Latitude) : (selectedRider ? convertToGeoLat(selectedRider.lat) - (index + 1) * 0.003 : -23.55);
        const orderLng = order.rawData?.Longitude ? parseFloat(order.rawData.Longitude) : (selectedRider ? convertToGeoLng(selectedRider.lng) + (index + 1) * 0.003 : -46.63);

        const orderPhoto = getOrderDeliveryPhotoUrl(order);
        const isOrderPhotoReal = orderPhoto && !orderPhoto.includes('<svg') && !orderPhoto.includes('data:image/svg+xml');
        const isExistingPhotoReal = existing?.photoImage && !existing.photoImage.includes('<svg') && !existing.photoImage.includes('data:image/svg+xml');

        const photo = (isOrderPhotoReal ? orderPhoto : (isExistingPhotoReal ? existing?.photoImage : (orderPhoto || existing?.photoImage))) || generateStaticSvgMap(orderLat, orderLng, order.address);
        const receiver = getOrderRecipientName(order) || existing?.receiverName || order.clientName || 'Recebedor Titular';
        const doc = getOrderRecipientDoc(order) || '';
        const signature = getOrderSignatureUrl(order) || existing?.signatureImage || `typed:${receiver}`;

        let obsvs = existing?.observations || 'Entrega realizada e confirmada via app do condutor.';
        if (doc && !obsvs.includes('Documento:')) {
          obsvs = `Documento: ${doc}. ${obsvs}`;
        }

        const timestamp = order.deliveryDate
          ? `${order.deliveryDate} às ${order.deliveryTime || ''}`.trim()
          : (existing?.timestamp || order.createdAt || new Date().toLocaleString('pt-BR'));

        return {
          id: pId,
          orderId: order.id,
          clientName: order.clientName,
          address: order.address,
          timestamp,
          receiverName: receiver,
          signatureImage: signature,
          photoImage: photo,
          hash: pHash,
          lat: orderLat,
          lng: orderLng,
          observations: obsvs
        };
      });

      return updatedProtocols;
    });
  }, [selectedRiderId, orders]);

  // Render Expandable Delivery Cards with status transition options
  const renderDeliveryCards = () => {
    const riderOrders = selectedRiderId
      ? driverActiveOrders.filter(o => o.status !== 'Concluído' && o.status !== 'Cancelado' && o.status !== 'Ocorrência')
      : [];

    if (riderOrders.length === 0) {
      return (
        <div className="bg-white rounded-2xl p-6 text-center border border-slate-200/50 text-slate-400 space-y-2">
          <CheckCircle2 size={32} className="text-emerald-500 mx-auto" />
          <div className="text-xs font-bold text-slate-700">Tudo em dia!</div>
          <p className="text-[10px]">Nenhuma entrega ativa vinculada ao seu usuário no momento.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {riderOrders.map((order, index) => {
          const isExpanded = expandedOrderId === order.id;
          
          // Badge styling
          let badgeColor = "bg-slate-100 text-slate-600";
          if (order.status === 'Não iniciado') badgeColor = "bg-amber-100 text-amber-800 border-amber-200";
          else if (order.status === 'Em rota') badgeColor = "bg-indigo-100 text-indigo-800 border-indigo-200";
          else if (order.status === 'Entregando') badgeColor = "bg-blue-100 text-blue-800 border-blue-200";
          else if (order.status === 'Concluído') badgeColor = "bg-emerald-100 text-emerald-800 border-emerald-200";
          else if (order.status === 'Ocorrência') badgeColor = "bg-rose-100 text-rose-800 border-rose-200";
          else if (order.status === 'Cancelado') badgeColor = "bg-slate-100 text-slate-800 border-slate-200";

          return (
            <div 
              key={order.id}
              className={`bg-white border rounded-2xl shadow-xs overflow-hidden transition-all duration-300 ${
                isExpanded 
                  ? 'border-blue-500 shadow-md ring-1 ring-blue-500/20 bg-blue-50/5' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Card Header (Always visible - clickable) */}
              <div 
                onClick={() => {
                  setExpandedOrderId(isExpanded ? null : order.id);
                  if (fullScreenOrder?.id === order.id) {
                    setFullScreenOrder(null);
                  } else {
                    setFullScreenOrder(order);
                    setSelectedOrder(order);
                  }
                  // Close subforms
                  setShowIncidentInputId(null);
                  setShowReceiverInputId(null);
                }}
                className="p-3 flex items-center justify-between gap-2.5 cursor-pointer select-none"
              >
                {/* Reordering Controls */}
                <div className="flex flex-col gap-0.5 items-center justify-center pr-2 border-r border-slate-100 mr-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveOrder(order.id, 'up');
                    }}
                    disabled={index === 0}
                    className={`p-0.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-slate-50 transition-all ${
                      index === 0 ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                    title="Mover para cima"
                  >
                    <ArrowUp size={11} className="stroke-[2.5]" />
                  </button>
                  
                  <span className="font-mono font-black text-[10px] text-blue-600 tracking-tighter leading-none select-none">
                    {index + 1}º
                  </span>
                  
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveOrder(order.id, 'down');
                    }}
                    disabled={index === riderOrders.length - 1}
                    className={`p-0.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-slate-50 transition-all ${
                      index === riderOrders.length - 1 ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                    title="Mover para baixo"
                  >
                    <ArrowDown size={11} className="stroke-[2.5]" />
                  </button>
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10px] font-extrabold text-slate-700">#{order.id}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-black border uppercase tracking-wider ${badgeColor}`}>
                      {order.status}
                    </span>
                    {order.priority === 'Alta' && (
                      <span className="bg-rose-100 text-rose-800 border border-rose-300 text-[8.5px] px-1.5 py-0.2 rounded font-black">
                        URGENTE
                      </span>
                    )}
                    {isExpanded && (
                      <span className="bg-blue-600 text-white text-[8.5px] px-2 py-0.5 rounded-full font-extrabold flex items-center gap-1 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        SELECIONADO
                      </span>
                    )}
                  </div>
                  
                  <h4 className="font-black text-[13px] text-slate-950 truncate leading-tight">
                    {order.clientName}
                  </h4>
                  
                  <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
                    <MapPin size={11} className="shrink-0 text-slate-700" />
                    <p className="text-[11px] truncate max-w-[200px] font-bold text-slate-900">{order.address}</p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {!selectedRider?.ocultarValoresProtocolos && (
                    <span className="font-mono font-black text-xs text-slate-950">
                      R$ {order.value.toFixed(2)}
                    </span>
                  )}
                  
                  <div className="flex items-center gap-1">
                    <span className="text-[9.5px] text-slate-700 font-extrabold uppercase">{order.region}</span>
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-slate-600"
                    >
                      <ChevronDown size={14} />
                    </motion.div>
                  </div>
                </div>
              </div>

              {/* Collapsible details / Expandable Area */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                  >
                    <div className="border-t border-slate-200 bg-slate-50 p-3.5 space-y-3.5">
                      
                      {/* Delivery Reading / Metadata Block */}
                      <div className="bg-white border border-slate-300 rounded-xl p-3 space-y-2.5 shadow-xs">
                        <span className="text-[9.5px] font-black text-slate-800 uppercase tracking-wider block">📄 Dados para Leitura da Entrega</span>
                        
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10.5px]">
                          <div>
                            <span className="text-slate-600 block font-bold">ESTABELECIMENTO:</span>
                            <span className="font-black text-slate-950">
                              {(() => {
                                const cp = clientPartners?.find(c => isMatchingClientCode(order.partnerName, c.id, c.codigoCliente));
                                return cp ? cp.name : (order.partnerName || 'Estabelecimento Parceiro');
                              })()}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-600 block font-bold">CEP DE DESTINO:</span>
                            <span className="font-mono font-black text-slate-950">{order.cep || '01000-000'}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-slate-600 block font-bold">ENDEREÇO DE ENTREGA:</span>
                            <span className="font-black text-slate-950 leading-snug">{order.address}</span>
                          </div>
                          <div>
                            <span className="text-slate-600 block font-bold">CONTATO CLIENTE:</span>
                            <span className="font-black text-slate-950 font-mono">{order.phone || '(11) 99999-9999'}</span>
                          </div>
                          <div>
                            <span className="text-slate-600 block font-bold">QUANTIDADE ITENS:</span>
                            <span className="font-black text-slate-950">{order.itemsCount || 1} {order.itemsCount === 1 ? 'item' : 'itens'}</span>
                          </div>
                        </div>

                        {/* Removed order history from rider device as requested */}
                      </div>

                      {/* Interactive Status Transition Actions */}
                      <div className="space-y-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">⚡ Opções de Despacho / Ações</span>

                        {/* Standard action options grids */}
                        {(order.status as string) === 'Concluído' ? (
                          <div className="bg-slate-100 border border-slate-200/80 rounded-xl p-3 text-center space-y-1">
                            <div className="flex items-center justify-center gap-1.5 font-bold text-xs text-slate-700">
                              <Shield size={14} className="text-slate-500" />
                              <span>Pedido Concluído (Status Travado)</span>
                            </div>
                            <p className="m-0 text-[10px] text-slate-500 font-medium">
                              Este pedido já foi finalizado. O condutor pode visualizar o protocolo mas não pode alterar o status. Alterações são permitidas apenas ao Administrador.
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                          
                          {/* OPTION 1: COLOCAR EM ROTA */}
                          <button
                            type="button"
                            disabled={(order.status as string) === 'Em rota' || (order.status as string) === 'Entregando' || (order.status as string) === 'Concluído'}
                            onClick={() => {
                              handleUpdateOrderStatus(order.id, 'Em rota');
                              triggerPhoneNotification('Pedido em Rota!', `Pedido #${order.id} foi colocado em rota.`, 'info');
                              onSaveLogs([{
                                id: `log-sim-route-${Date.now()}`,
                                time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                                type: 'info',
                                message: `App do Condutor: Pedido #${order.id} marcado como "Em Rota" por ${selectedRider?.name}.`,
                                orderId: order.id
                              }]);
                            }}
                            className={`py-2 px-2.5 rounded-xl font-bold text-[10px] flex items-center justify-center gap-1.5 transition-all shadow-3xs cursor-pointer ${
                              order.status === 'Não iniciado'
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                            }`}
                          >
                            <Truck size={12} />
                            <span>Colocar em Rota</span>
                          </button>

                          {/* OPTION 2: ENTREGANDO */}
                          <button
                            type="button"
                            disabled={(order.status as string) === 'Entregando' || (order.status as string) === 'Concluído'}
                            onClick={() => {
                              handleUpdateOrderStatus(order.id, 'Entregando');
                              triggerPhoneNotification('Iniciado!', `Entrega do pedido #${order.id} iniciada.`, 'info');
                              onSaveLogs([{
                                id: `log-sim-deliv-${Date.now()}`,
                                time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                                type: 'info',
                                message: `App do Condutor: Pedido #${order.id} marcado como "Entregando" por ${selectedRider?.name}.`,
                                orderId: order.id
                              }]);
                            }}
                            className={`py-2 px-2.5 rounded-xl font-bold text-[10px] flex items-center justify-center gap-1.5 transition-all shadow-3xs cursor-pointer ${
                              order.status === 'Não iniciado' || order.status === 'Em rota'
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                            }`}
                          >
                            <Navigation size={12} />
                            <span>Entregando</span>
                          </button>

                          {/* OPTION 3: CONCLUÍDO (dar baixa) */}
                          <button
                            type="button"
                            disabled={(order.status as string) === 'Concluído'}
                            onClick={() => {
                              setSelectedOrder(order);
                              setReceiverName(order.clientName);
                              if (signatureMode === 'type') {
                                setReceiptSignature(order.clientName);
                              } else {
                                setReceiptSignature('');
                              }
                              setReceiptPhoto(null);
                              setSignatureImage(null);
                              hasDrawnOnCanvasRef.current = false;
                              isDrawingRef.current = false;
                              setReceiptObservations('');
                              setShowReceiptModal(true);
                            }}
                            className={`py-2 px-2.5 rounded-xl font-bold text-[10px] flex items-center justify-center gap-1.5 transition-all border shadow-3xs cursor-pointer ${
                              (order.status as string) === 'Concluído'
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            <CheckCircle2 size={12} className="text-emerald-600" />
                            <span>Dar Baixa (Concluído)</span>
                          </button>

                          {/* OPTION 4: OCORRÊNCIA */}
                          <button
                            type="button"
                            disabled={(order.status as string) === 'Concluído'}
                            onClick={() => {
                              setShowIncidentInputId(showIncidentInputId === order.id ? null : order.id);
                              setIncidentReasonInput('');
                            }}
                            className={`py-2 px-2.5 rounded-xl font-bold text-[10px] flex items-center justify-center gap-1.5 transition-all border shadow-3xs cursor-pointer ${
                              (order.status as string) === 'Concluído'
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
                                : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                            }`}
                          >
                            <AlertTriangle size={12} className="text-rose-600" />
                            <span>Registrar Ocorrência</span>
                          </button>

                          {/* OPTION 5: ABRIR NO GOOGLE MAPS */}
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              e.stopPropagation();
                              prepareExternalMapNavigation(order);
                            }}
                            className="col-span-2 py-2 px-3 bg-slate-900 hover:bg-black text-white rounded-xl font-extrabold text-[10px] flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                          >
                            <MapPin size={12} className="text-emerald-400 animate-pulse" />
                            <span>Abrir Rota de Entrega no Google Maps</span>
                          </a>
                        </div>
                        )}

                        {/* Inline sub-form for Occurrence description */}
                        {showIncidentInputId === order.id && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            className="bg-rose-50/50 border border-rose-100 rounded-xl p-3 space-y-2"
                          >
                            <span className="text-[9px] font-black text-rose-800 uppercase block">⚠️ Relatório da Ocorrência:</span>
                            <textarea 
                              placeholder="Descreva o ocorrido (Ex: cliente ausente, endereço não localizado, pedido recusado, pneu furado...)"
                              value={incidentReasonInput}
                              onChange={(e) => setIncidentReasonInput(e.target.value)}
                              rows={2}
                              className="w-full bg-white border border-rose-200 focus:border-rose-400 rounded-lg p-1.5 text-xs text-slate-800 focus:outline-none resize-none"
                            />
                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const reason = incidentReasonInput.trim();
                                  if (!reason) {
                                    triggerPhoneNotification('Aviso', 'Descreva o motivo da ocorrência.', 'failure');
                                    return;
                                  }

                                  // Update order status to Ocorrência with reason
                                  handleUpdateOrderStatus(order.id, 'Ocorrência', undefined, undefined, undefined, undefined, undefined, reason);
                                  
                                  setShowIncidentInputId(null);
                                  setExpandedOrderId(null);

                                  triggerPhoneNotification('Ocorrência Registrada!', `Pedido #${order.id} marcado como ocorrência.`, 'failure');

                                  onSaveLogs([{
                                    id: `log-sim-fail-${Date.now()}`,
                                    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                                    type: 'danger',
                                    message: `App do Condutor: Pedido #${order.id} teve OCORRÊNCIA registrada por ${selectedRider?.name}. Motivo: ${reason}.`,
                                    orderId: order.id
                                  }]);
                                }}
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[10px] rounded-lg shadow-sm transition-all cursor-pointer"
                              >
                                Salvar Ocorrência
                              </button>
                            </div>
                          </motion.div>
                        )}

                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    );
  };

  // Get active pending orders for this rider
  const riderPendingOrders = selectedRiderId
    ? driverActiveOrders.filter(o => o.status !== 'Concluído' && o.status !== 'Cancelado' && o.status !== 'Ocorrência')
    : [];

  const riderCompletedOrders = selectedRiderId
    ? driverActiveOrders.filter(o => o.status === 'Concluído')
    : [];

  // Helper coordinate resolution (same coordinates conversion used in main system)
  const getOrderCoords = (order: Order) => {
    let bx = 500;
    let by = 300;
    if (order.region === 'Centro') { bx = 450; by = 240; }
    else if (order.region === 'Zona Sul') { bx = 560; by = 450; }
    else if (order.region === 'Zona Oeste') { bx = 220; by = 340; }
    else if (order.region === 'Zona Norte') { bx = 650; by = 130; }

    const idNum = parseInt(order.id.replace(/\D/g, '') || '0', 10) || 1;
    const jitterX = ((idNum % 7) - 3) * 22;
    const jitterY = ((idNum % 5) - 2) * 22;
    return { x: bx + jitterX, y: by + jitterY };
  };

  const getOrderGeoCoords = (order: Order) => {
    const svgCoords = getOrderCoords(order);
    const latPercent = (svgCoords.y / 600) * 100;
    const lngPercent = (svgCoords.x / 1000) * 100;
    return [convertToGeoLat(latPercent), convertToGeoLng(lngPercent)] as [number, number];
  };

  const getRiderGeoCoords = (rider: DeliveryRider) => {
    if (rider.isGpsRealActive && rider.realGeoLat !== undefined && rider.realGeoLng !== undefined) {
      return [rider.realGeoLat, rider.realGeoLng] as [number, number];
    }
    if (rider.realGeoLat !== undefined && rider.realGeoLng !== undefined && rider.realGeoLat < -10) {
      return [rider.realGeoLat, rider.realGeoLng] as [number, number];
    }
    if (rider.lat < -10) {
      return [rider.lat, rider.lng] as [number, number];
    }
    return [convertToGeoLat(rider.lat), convertToGeoLng(rider.lng)] as [number, number];
  };

  const calculateDistance = (coord1: [number, number], coord2: [number, number]) => {
    const latDiff = coord1[0] - coord2[0];
    const lngDiff = coord1[1] - coord2[1];
    return Math.sqrt(Math.pow(latDiff * 111, 2) + Math.pow(lngDiff * 102, 2));
  };

  // Next order to deliver
  const currentNextOrder = riderPendingOrders[0];

  // Map initialization inside the phone
  useEffect(() => {
    if (activeTab !== 'map' || !phoneMapContainerRef.current || !selectedRider) return;

    const L = (window as any).L;
    if (!L) return;

    if (phoneMapInstanceRef.current) {
      phoneMapInstanceRef.current.remove();
      phoneMapInstanceRef.current = null;
    }

    const riderCoords = getRiderGeoCoords(selectedRider);

    const map = L.map(phoneMapContainerRef.current, {
      center: riderCoords,
      zoom: 14,
      zoomControl: false,
      attributionControl: false
    });

    phoneMapInstanceRef.current = map;

    // Soft tiles for mobile map view
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(map);

    // Add zoom buttons at small scale
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Base Central marker
    const hubCoords: [number, number] = activeHub ? [activeHub.lat, activeHub.lng] : [-23.5385556, -46.70118];
    const baseIcon = L.divIcon({
      html: `
        <div class="flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 text-white shadow-lg border-2 border-white overflow-hidden p-0.5">
          <img src="${activeHub?.logoUrl || vinimapLogo}" class="w-full h-full object-cover rounded-full" onerror="this.onerror=null;this.src='${vinimapLogo}';" />
        </div>
      `,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    L.marker(hubCoords, { icon: baseIcon }).addTo(map)
      .bindPopup(`<div class="text-[10px] font-bold">${activeHub ? activeHub.name : 'Base ViniMap (Sede)'}</div>`);

    // Rider Marker
    const riderIcon = L.divIcon({
      html: `
        <div class="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white shadow-lg border border-white relative">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-5l-4-4h-4v11"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
        </div>
      `,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    phoneRiderMarkerRef.current = L.marker(riderCoords, { 
      icon: riderIcon,
      title: `${selectedRider.name} (${selectedRider.vehicle})`
    })
      .addTo(map)
      .bindTooltip(`
        <div class="px-2 py-1 font-sans text-xs font-bold text-slate-900 flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-blue-500"></span>
          <span>${selectedRider.name}</span>
        </div>
      `, { direction: 'top', offset: [0, -16], opacity: 0.98 });

    // Stop Destination markers & Route (Originating from Base Central CD)
    if (riderPendingOrders.length > 0) {
      const bounds = L.latLngBounds([hubCoords, riderCoords]);
      const routePoints: [number, number][] = [hubCoords];

      riderPendingOrders.forEach((order, index) => {
        const orderCoords = getOrderGeoCoords(order);
        routePoints.push(orderCoords);
        bounds.extend(orderCoords);

        const orderIcon = L.divIcon({
          html: `
            <div class="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white shadow-md border border-white font-extrabold text-[9px]">
              ${index + 1}
            </div>
          `,
          className: '',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        L.marker(orderCoords, { icon: orderIcon }).addTo(map)
          .bindPopup(`<div class="text-[10px] font-bold">${order.clientName}</div><div class="text-[9px] text-slate-500">${order.address}</div>`);
      });

      // Draw path line
      phoneRouteLineRef.current = L.polyline(routePoints, {
        color: '#2563eb',
        weight: 3.5,
        opacity: 0.8,
        dashArray: '5, 5'
      }).addTo(map);

      map.fitBounds(bounds, { padding: [30, 30] });
    }

    return () => {
      if (phoneMapInstanceRef.current) {
        phoneMapInstanceRef.current.remove();
        phoneMapInstanceRef.current = null;
      }
    };
  }, [activeTab, selectedRiderId, orders]);

  // Handle GPS simulation state updates
  useEffect(() => {
    if (isSimulating) {
      simulationTimerRef.current = setInterval(() => {
        simulateStep();
      }, 1000);
    } else {
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
      }
    }

    return () => {
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
      }
    };
  }, [isSimulating, selectedRiderId, orders, simSpeed]);

  // Steps the rider closer to the current delivery target
  const simulateStep = () => {
    if (!selectedRider || !currentNextOrder) {
      setIsSimulating(false);
      return;
    }

    const riderCoords = getRiderGeoCoords(selectedRider);
    const targetCoords = getOrderGeoCoords(currentNextOrder);
    const distanceLeft = calculateDistance(riderCoords, targetCoords);

    // If already arrived
    if (distanceLeft < 0.04) {
      setIsSimulating(false);
      setSimulationLog(prev => [
        `Arrived at ${currentNextOrder.clientName}! (${currentNextOrder.address})`,
        ...prev
      ]);
      
      // Auto-open detail/confirm flow
      setSelectedOrder(currentNextOrder);
      setCurrentScreen('details');
      setActiveTab('tasks');
      setShowReceiptModal(true);

      // Play sound notification and trigger live banner
      triggerPhoneNotification(
        "Destino Alcançado!",
        `Você chegou ao endereço de ${currentNextOrder.clientName}. Colha a assinatura para dar baixa.`,
        'success'
      );

      // Play sound notification if API available
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
      
      // Save logs
      onSaveLogs([{
        id: `log-sim-arr-${Date.now()}`,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        type: 'success',
        message: `Simulador GPS: Condutor ${selectedRider.name} chegou ao destino de ${currentNextOrder.clientName}.`,
        orderId: currentNextOrder.id
      }]);
      return;
    }

    // Move step closer
    // 1 deg Lat ≈ 111km, 1 deg Lng ≈ 102km
    // We want to move at simulated speed of around 40km/h
    // Speed * multiplier. Speed = 40km/h => 0.011km per second.
    const stepDist = (0.008 * simSpeed) / 100; // in degrees representation
    
    const latDiff = targetCoords[0] - riderCoords[0];
    const lngDiff = targetCoords[1] - riderCoords[1];
    const angle = Math.atan2(latDiff, lngDiff);

    const nextGeoLat = riderCoords[0] + Math.sin(angle) * stepDist;
    const nextGeoLng = riderCoords[1] + Math.cos(angle) * stepDist;

    // Convert back to original SVG/percentage coordinates of riders list
    // reverse formula: latPercent = (svgCoords.y / 600) * 100 => convertToGeoLat = -23.52 - (latPercent/100)*0.12
    // => latPercent = (-23.52 - GeoLat) / 0.12 * 100
    // => lngPercent = (GeoLng - (-46.72)) / 0.18 * 100
    const nextLatPercent = (-23.52 - nextGeoLat) / 0.12 * 100;
    const nextLngPercent = (nextGeoLng - (-46.72)) / 0.18 * 100;

    // Bounds checking
    const clampedLat = Math.min(100, Math.max(0, nextLatPercent));
    const clampedLng = Math.min(100, Math.max(0, nextLngPercent));

    onUpdateRiderCoords(selectedRider.id, clampedLat, clampedLng, nextGeoLat, nextGeoLng, 3, 'Agora mesmo (Simulador GPS)', true);

    // Update local map marker if initialized
    try {
      if (phoneMapInstanceRef.current && phoneRiderMarkerRef.current && (phoneRiderMarkerRef.current as any)._map) {
        phoneRiderMarkerRef.current.setLatLng([nextGeoLat, nextGeoLng]);
      }
    } catch (err) {
      // Suppress unmounted marker movement
    }

    setSimulationLog(prev => [
      `Pos GPS: ${nextGeoLat.toFixed(5)}, ${nextGeoLng.toFixed(5)} • Distância restante: ${distanceLeft.toFixed(2)} km`,
      ...prev
    ].slice(0, 5));
  };

  // Quick jump/teleport to destination (manual simulation)
  const handleTeleportToNext = () => {
    if (!selectedRider || !currentNextOrder) return;
    
    const targetCoords = getOrderGeoCoords(currentNextOrder);
    
    // Convert back to original SVG/percentage coordinates
    const nextLatPercent = (-23.52 - targetCoords[0]) / 0.12 * 100;
    const nextLngPercent = (targetCoords[1] - (-46.72)) / 0.18 * 100;

    onUpdateRiderCoords(selectedRider.id, nextLatPercent, nextLngPercent, targetCoords[0], targetCoords[1], 2, 'Agora mesmo (Destino Chegada)', true);
    
    // Log
    onSaveLogs([{
      id: `log-sim-tel-${Date.now()}`,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      type: 'info',
      message: `Simulador GPS: Condutor ${selectedRider.name} avançou rapidamente para o destino de ${currentNextOrder.clientName}.`,
      orderId: currentNextOrder.id
    }]);

    // Force arrive check
    setTimeout(() => {
      simulateStep();
    }, 200);
  };

  // Start rider delivery queue faturamento (Retirar na Sede ViniMap)
  const handleCollectAtCD = () => {
    if (riderPendingOrders.length === 0) return;

    riderPendingOrders.forEach(order => {
      if (order.status === 'Não iniciado') {
        handleUpdateOrderStatus(order.id, 'Em rota');
      }
    });

    onSaveLogs([{
      id: `log-cd-col-${Date.now()}`,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      type: 'info',
      message: `Simulador Celular: Condutor ${selectedRider?.name} retirou as encomendas na Sede ViniMap. Entregas em rota!`,
    }]);

    alert("Sucesso! Todos os pedidos pendentes foram faturados e estão 'Em rota'!");
  };

  // Confirm delivery with simulated photo, digital signature, and protocol generation
  const handleConfirmDelivery = async () => {
    if (!selectedOrder) return;

    // Auto-generate fallback photo if missing
    let currentPhoto = receiptPhoto;
    if (!currentPhoto) {
      currentPhoto = handleCapturePhoto() || null;
    }

    if (!currentPhoto) {
      alert("A foto do comprovante é obrigatória para concluir o protocolo de entrega!");
      return;
    }

    setIsSubmittingDelivery(true);

    // Route photo through sequential processing queue to optimize RAM and ensure Firestore write safety
    if (currentPhoto) {
      try {
        currentPhoto = await enqueuePhotoProcessing(currentPhoto, 'Comprovante de Entrega');
      } catch (err) {
        console.warn("[RiderAppSimulator] Compression queue fallback, using photo as-is:", err);
      }
    }

    setTimeout(() => {
      // Create formal protocol number and hash
      const protocolId = `PRT-${new Date().getFullYear()}-${Math.floor(111111 + Math.random() * 888888)}`;
      const protocolHash = Math.random().toString(36).substring(2, 10).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
      const currentLat = selectedRider?.lat ? convertToGeoLat(selectedRider.lat) : -23.55;
      const currentLng = selectedRider?.lng ? convertToGeoLng(selectedRider.lng) : -46.63;

      // Capture final signature based on mode (Drawn canvas base64 OR cursive text string)
      let finalSignature = '';
      if (signatureMode === 'draw') {
        if (hasDrawnOnCanvasRef.current && canvasRef.current) {
          try {
            const canvas = canvasRef.current;
            // Create white-background canvas for high contrast
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
              tempCtx.fillStyle = '#ffffff';
              tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
              tempCtx.drawImage(canvas, 0, 0);
              finalSignature = tempCanvas.toDataURL('image/png');
            } else {
              finalSignature = canvas.toDataURL('image/png');
            }
          } catch (e) {
            console.warn("Could not read signature from canvas:", e);
          }
        } else if (signatureImage && signatureImage.startsWith('data:image/')) {
          finalSignature = signatureImage;
        } else if (receiptSignature && receiptSignature.trim() !== '') {
          finalSignature = `typed:${receiptSignature.trim()}`;
        }
      } else {
        if (receiptSignature && receiptSignature.trim() !== '') {
          finalSignature = `typed:${receiptSignature.trim()}`;
        } else if (receiverName && receiverName.trim() !== '') {
          finalSignature = `typed:${receiverName.trim()}`;
        }
      }

      // Parse receiverName into finalName and finalDoc
      let finalName = receiverName.trim() || 'Recebedor Titular';
      let finalDoc = '';

      // Look for a document pattern like RG: or CPF: or just numbers with dots and dashes
      const rgCpfRegex = /(?:RG|CPF|doc|documento|Identidade)[:\s-]*([\d.xX-]+)/i;
      const match = receiverName.match(rgCpfRegex);
      if (match) {
        finalDoc = match[1].trim();
        finalName = receiverName.replace(rgCpfRegex, '').replace(/[()\-]/g, '').trim();
      } else {
        // If no explicit prefix, look for numbers inside parentheses
        const parenMatch = receiverName.match(/\(([^)]+)\)/);
        if (parenMatch) {
          const content = parenMatch[1].trim();
          if (/[\d.xX-]/.test(content)) {
            finalDoc = content;
            finalName = receiverName.replace(parenMatch[0], '').trim();
          }
        }
      }
      
      finalName = finalName.replace(/\s+/g, ' ').replace(/[,.-]$/, '').trim() || 'Recebedor Titular';

      // Fallback signature if empty
      if (!finalSignature || finalSignature.trim() === '') {
        const fallbackTyped = receiptSignature.trim() || finalName;
        finalSignature = `typed:${fallbackTyped}`;
      }

      // Determine photo image
      const photoImageToUse = currentPhoto || generateStaticSvgMap(currentLat, currentLng, selectedOrder.address);

      let obsToSave = receiptObservations.trim();
      if (!obsToSave) {
        obsToSave = 'Deixado sem observações pendentes (Conformidade 100%).';
      }
      if (finalDoc && !obsToSave.includes('Documento:')) {
        obsToSave = `Documento: ${finalDoc}. ${obsToSave}`;
      }

      const newProtocol: DeliveryProtocol = {
        id: protocolId,
        orderId: selectedOrder.id,
        clientName: selectedOrder.clientName,
        address: selectedOrder.address,
        timestamp: new Date().toLocaleString('pt-BR'),
        receiverName: finalName,
        signatureImage: finalSignature,
        photoImage: photoImageToUse,
        hash: protocolHash,
        lat: currentLat,
        lng: currentLng,
        observations: obsToSave
      };

      // Add to our reactive protocol list
      setDeliveryProtocols(prev => [newProtocol, ...prev]);

      const completionPayload = {
        orderId: selectedOrder.id,
        nextStatus: 'Concluído' as const,
        protocolNumber: protocolHash,
        signatureUrl: finalSignature,
        deliveryPhotoUrl: newProtocol.photoImage,
        recipientName: finalName,
        recipientDoc: finalDoc
      };

      console.log(`[RiderAppSimulator SUBMIT PAYLOAD] Order #${selectedOrder.id} completion payload structure:`, {
        ...completionPayload,
        hasSignatureUrl: !!completionPayload.signatureUrl,
        signatureUrlType: typeof completionPayload.signatureUrl,
        signatureUrlLength: completionPayload.signatureUrl?.length || 0,
        signatureUrlPreview: completionPayload.signatureUrl ? (completionPayload.signatureUrl.length > 60 ? completionPayload.signatureUrl.substring(0, 60) + '...' : completionPayload.signatureUrl) : null,
        hasDeliveryPhotoUrl: !!completionPayload.deliveryPhotoUrl,
        deliveryPhotoUrlType: typeof completionPayload.deliveryPhotoUrl,
        deliveryPhotoUrlLength: completionPayload.deliveryPhotoUrl?.length || 0,
        deliveryPhotoUrlPreview: completionPayload.deliveryPhotoUrl ? (completionPayload.deliveryPhotoUrl.length > 60 ? completionPayload.deliveryPhotoUrl.substring(0, 60) + '...' : completionPayload.deliveryPhotoUrl) : null,
        observations: newProtocol.observations
      });
      
      // Trigger actual status change in dashboard
      handleUpdateOrderStatus(
        completionPayload.orderId, 
        completionPayload.nextStatus, 
        completionPayload.protocolNumber, 
        completionPayload.signatureUrl, 
        completionPayload.deliveryPhotoUrl, 
        completionPayload.recipientName,
        completionPayload.recipientDoc,
        newProtocol.observations
      );
      
      triggerPhoneNotification(
        "Entrega Concluída! ✓",
        `Pedido #${selectedOrder.id} finalizado com sucesso para o cliente ${selectedOrder.clientName}.`,
        'success'
      );
      
      onSaveLogs([{
        id: `log-sim-done-${Date.now()}`,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        type: 'success',
        message: `App do Condutor: Entrega #${selectedOrder.id} finalizada com sucesso! Recebedor: ${newProtocol.receiverName}`,
        orderId: selectedOrder.id
      }]);

      setIsSubmittingDelivery(false);
      handleCompleteAndCloseModal();
    }, 400);
  };

  // Resets receipt states and closes the modal
  const handleCompleteAndCloseModal = () => {
    setShowReceiptModal(false);
    setShowSuccessProtocol(false);
    setGeneratedProtocol(null);
    setReceiptPhoto(null);
    setReceiptSignature('');
    setReceiverName('');
    setReceiptObservations('');
    setSignatureImage(null);
    setSelectedOrder(null);
    setCurrentScreen('dashboard');
    setActiveTab('home');
  };

  // Report delivery failure
  const handleReportFailure = () => {
    if (!selectedOrder || !failureReason) return;

    if (selectedOrder.status === 'Concluído') {
      alert("Este pedido já foi concluído! Alterações de status são restritas ao Administrador.");
      setShowFailureModal(false);
      return;
    }

    handleUpdateOrderStatus(selectedOrder.id, 'Ocorrência', undefined, undefined, undefined, undefined, undefined, failureReason); // Reverts with incident status

    onSaveLogs([{
      id: `log-sim-fail-${Date.now()}`,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      type: 'danger',
      message: `App do Condutor: Tentativa de entrega falhou para #${selectedOrder.id}. Motivo: "${failureReason}"`,
      orderId: selectedOrder.id
    }]);

    setShowFailureModal(false);
    setFailureReason('');
    setSelectedOrder(null);
    setCurrentScreen('dashboard');
    setActiveTab('home');

    alert("Ocorrência registrada! O pedido foi removido da sua lista de entregas ativas e encaminhado para tratativa operacional.");
  };

  // Rear camera stream handlers
  const startWebcam = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API not supported in this environment");
      }
      let stream: MediaStream;
      try {
        // Try strict rear camera constraint (facingMode: { exact: 'environment' })
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
      } catch (exactErr) {
        console.warn("Exact environment facingMode failed, falling back to soft environment constraint:", exactErr);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
          });
        } catch (softErr) {
          console.warn("Soft environment constraint failed, requesting default video stream:", softErr);
          stream = await navigator.mediaDevices.getUserMedia({
            video: true
          });
        }
      }
      setCameraStream(stream);
      setIsCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.warn("Video play exception:", e));
        }
      }, 150);
    } catch (err) {
      console.warn("Could not start camera, generating proof photo fallback:", err);
      setIsCameraActive(false);
      handleCapturePhoto();
    }
  };

  const stopWebcam = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const captureWebcamPhoto = () => {
    try {
      const video = videoRef.current;
      if (video && video.readyState >= 2 && (video.videoWidth > 0 || video.clientWidth > 0)) {
        const w = Math.min(video.videoWidth || video.clientWidth || 640, 800);
        const h = Math.min(video.videoHeight || video.clientHeight || 480, 800);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
          canvas.width = 0;
          canvas.height = 0;
          if (dataUrl && dataUrl.length > 500) {
            console.log("[RiderAppSimulator CAMERA CAPTURE SUCCESS]", {
              type: 'camera',
              length: dataUrl.length,
              preview: dataUrl.substring(0, 60) + '...'
            });
            stopWebcam();
            enqueuePhotoProcessing(dataUrl, 'Foto da Câmera').then(compressed => {
              if (compressed) setReceiptPhoto(compressed);
            }).catch(e => console.warn("Camera photo queue error:", e));
            return dataUrl;
          }
        }
      }
    } catch (e) {
      console.warn("Error capturing frame from camera:", e);
    }
    // Fallback if video stream was not ready or gave black frame
    const fallbackPhoto = handleCapturePhoto();
    stopWebcam();
    if (fallbackPhoto) {
      enqueuePhotoProcessing(fallbackPhoto, 'Foto Fallback').then(compressed => {
        if (compressed) setReceiptPhoto(compressed);
      }).catch(e => console.warn("Fallback photo queue error:", e));
    }
    return fallbackPhoto;
  };

  const handleCapturePhoto = () => {
    // Generate a high-fidelity high-resolution delivery proof directly on a local canvas
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Background gradient (solid slate navy gradient)
      const grad = ctx.createLinearGradient(0, 0, 800, 600);
      grad.addColorStop(0, '#0f172a'); // Slate 900
      grad.addColorStop(1, '#1e293b'); // Slate 800
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 800, 600);

      // Grid line details
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)'; // sky-400
      ctx.lineWidth = 2;
      for (let i = 0; i < 800; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 600);
        ctx.stroke();
      }
      for (let j = 0; j < 600; j += 40) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(800, j);
        ctx.stroke();
      }

      // Header Banner Box
      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.fillRect(40, 30, 720, 80);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.strokeRect(40, 30, 720, 80);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('COMPROVANTE FOTOGRÁFICO DE ENTREGA', 400, 78);

      // Draw isometric parcel box
      ctx.fillStyle = '#d97706'; // Amber 600
      ctx.strokeStyle = '#f59e0b'; // Amber 500
      ctx.lineWidth = 5;

      ctx.beginPath();
      ctx.moveTo(400, 180);
      ctx.lineTo(540, 250);
      ctx.lineTo(540, 390);
      ctx.lineTo(400, 460);
      ctx.lineTo(260, 390);
      ctx.lineTo(260, 250);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Top face of the box
      ctx.fillStyle = '#f59e0b'; // Amber 500
      ctx.beginPath();
      ctx.moveTo(400, 180);
      ctx.lineTo(540, 250);
      ctx.lineTo(400, 320);
      ctx.lineTo(260, 250);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner corner lines
      ctx.beginPath();
      ctx.moveTo(400, 320);
      ctx.lineTo(400, 460);
      ctx.stroke();

      // Red security tape on package
      ctx.strokeStyle = '#ef4444'; // Red 500
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(330, 215);
      ctx.lineTo(470, 285);
      ctx.stroke();

      // Green check circle
      ctx.fillStyle = '#10b981'; // Emerald 500
      ctx.beginPath();
      ctx.arc(580, 420, 50, 0, Math.PI * 2);
      ctx.fill();

      // White checkmark inside badge
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(560, 420);
      ctx.lineTo(575, 435);
      ctx.lineTo(602, 405);
      ctx.stroke();

      // Footer Banner Box / Text Overlay
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.fillRect(40, 490, 720, 80);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.strokeRect(40, 490, 720, 80);

      ctx.fillStyle = '#38bdf8'; // Sky 400
      ctx.font = '900 22px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('PEDIDO ENTREGUE - VIA RECEPTOR', 60, 528);

      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR');
      const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      ctx.fillStyle = '#cbd5e1'; // Slate 300
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`REGISTRO GPS: ${dateStr} - ${timeStr}`, 740, 528);

      ctx.fillStyle = '#a7f3d0';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`STATUS: AUDITADO & CERTIFICADO (SISTEMA VINIMAP)`, 60, 555);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      console.log("[RiderAppSimulator CANVAS PHOTO CAPTURE SUCCESS]", {
        type: 'canvas_generated',
        length: dataUrl.length,
        preview: dataUrl.substring(0, 60) + '...'
      });
      setReceiptPhoto(dataUrl);
      return dataUrl;
    }
    return '';
  };

  // Helper for Canvas coordinate calculation matching CSS scale
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const scaleX = canvas.width / (rect.width || 1);
    const scaleY = canvas.height / (rect.height || 1);
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  // Canvas drawing event handlers for Digital Signature
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#1e3a8a'; // dark navy blue
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const coords = getCanvasCoords(e, canvas);

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
    isDrawingRef.current = true;
    hasDrawnOnCanvasRef.current = true;

    // Prevent touch scrolling
    if ('touches' in e) {
      e.preventDefault();
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current && !isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoords(e, canvas);

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    hasDrawnOnCanvasRef.current = true;

    // Prevent touch scrolling
    if ('touches' in e) {
      e.preventDefault();
    }
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
    setIsDrawing(false);
    if (hasDrawnOnCanvasRef.current && canvasRef.current) {
      setSignatureImage(canvasRef.current.toDataURL('image/png'));
    }
  };

  const clearCanvas = () => {
    isDrawingRef.current = false;
    hasDrawnOnCanvasRef.current = false;
    setIsDrawing(false);
    setSignatureImage(null);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleStatusToggle = () => {
    if (!selectedRider) return;
    const nextStatus = selectedRider.status === 'Offline' ? 'Disponível' : 'Offline';
    
    // Updates status directly in list
    selectedRider.status = nextStatus;

    if (nextStatus === 'Disponível') {
      triggerPhoneNotification(
        "Você está Online! 🔋",
        "Pronto para receber ordens de entrega da Sede ViniMap.",
        'success'
      );
    } else {
      triggerPhoneNotification(
        "Modo Offline",
        "Você pausou seu plantão operacional.",
        'info'
      );
    }

    onSaveLogs([{
      id: `log-sim-status-${Date.now()}`,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      type: 'info',
      message: `App do Condutor: Entregador ${selectedRider.name} mudou seu status para "${nextStatus}".`
    }]);
  };

  return (
    <div className={isEffectiveRealDevice ? "w-full h-full" : `space-y-6 ${isFloating ? '' : 'max-w-6xl mx-auto'}`} id="driver-app-simulation-dashboard">
      
      {/* Upper header explanatory (Only in dedicated tab view) */}
      {!isFloating && !isEffectiveRealDevice && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                <Smartphone size={18} className="animate-pulse" />
              </span>
              <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">
                Simulador de Dispositivo do Condutor
              </h2>
            </div>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              Inspecione a experiência de campo do motorista ou instale o aplicativo oficial de campo diretamente no celular do condutor (PWA / APK).
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setIsUserFullScreen(true)}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-2 border border-blue-500 font-extrabold text-xs"
            >
              <Maximize2 size={16} />
              <span>Abrir em Tela Cheia</span>
            </button>

            <button
              onClick={() => setIsInstallerModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-slate-900 to-blue-950 hover:from-slate-800 hover:to-blue-900 text-white rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-2 border border-slate-700/60"
            >
              <div className="w-6 h-6 rounded-lg overflow-hidden border border-white/20 shrink-0">
                <img 
                  src={effectiveLogo} 
                  alt="Vinimap Logo" 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = vinimapLogo;
                  }}
                />
              </div>
              <div className="text-left">
                <span className="text-[9px] uppercase font-bold text-emerald-400 block leading-tight">Download do App</span>
                <span className="text-xs font-black text-white leading-tight">Instalar no Dispositivo</span>
              </div>
            </button>

            <div className="text-right hidden sm:block">
              <span className="text-[10px] text-slate-400 block font-semibold">INTEGRAÇÃO COM RASTREADOR</span>
              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                Sincronizado via WebSockets
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN DRIVER SELECTION PANEL */}
      {!isFloating && !isEffectiveRealDevice && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-5 shadow-lg border border-slate-700/80 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-700/60">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-sky-500/20 text-sky-400 rounded-xl border border-sky-400/30">
                <Users size={20} />
              </div>
              <div>
                <span className="text-[9px] font-black tracking-widest text-sky-400 uppercase block">
                  Painel do Administrador
                </span>
                <h3 className="text-sm font-extrabold text-white">
                  Selecionar Condutor Cadastrado para Simulação
                </h3>
              </div>
            </div>

            {selectedRider && (
              <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
                <img src={selectedRider.avatar} className="w-6 h-6 rounded-full object-cover border border-sky-400" />
                <div className="text-left">
                  <span className="text-[10px] font-extrabold text-white block leading-tight">{selectedRider.name}</span>
                  <span className="text-[8px] font-bold text-sky-300 uppercase">{selectedRider.vehicle || 'Veículo'}</span>
                </div>
                <span className={`ml-2 text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                  selectedRider.status === 'Em rota' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                  selectedRider.status === 'Disponível' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                  'bg-slate-700 text-slate-300'
                }`}>
                  {selectedRider.status}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Dropdown Select */}
            <div className="md:col-span-6 space-y-1">
              <label className="text-[10px] font-bold text-slate-300 block uppercase tracking-wider">
                Condutor Ativo no Simulador:
              </label>
              <div className="relative">
                <select
                  value={selectedRiderId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    if (newId) {
                      changeSelectedRiderId(newId);
                      const targetRider = riders.find(r => r.id === newId);
                      if (targetRider) {
                        setPhoneInput(targetRider.deviceNumber || targetRider.phone || '');
                        setPasswordInput(targetRider.password || '1234');
                      }
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-700 hover:border-sky-400 focus:border-sky-400 rounded-xl px-3.5 py-2 text-xs font-extrabold text-white focus:outline-none transition-all cursor-pointer shadow-inner"
                >
                  <option value="" className="bg-slate-900 text-slate-400">-- Selecione um Condutor da Frota --</option>
                  {riders.map((r) => {
                    const pendingCount = orders.filter(o => o.riderId === r.id && o.status !== 'Concluído' && o.status !== 'Cancelado').length;
                    return (
                      <option key={r.id} value={r.id} className="bg-slate-900 text-white font-semibold">
                        {r.name} ({r.vehicle || 'Moto'}) — Dispositivo: {r.deviceNumber || r.phone || 'Geral'} [{pendingCount} entregas]
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="md:col-span-6 flex items-center gap-2 flex-wrap md:justify-end pt-2 md:pt-4">
              {selectedRider ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentScreen('dashboard');
                      setActiveTab('home');
                      setPhoneInput('');
                      setPasswordInput('');
                      setLoginError(null);

                      // Enable GPS by default on connect
                      if (typeof navigator !== 'undefined' && navigator.geolocation) {
                        startRealGpsTracking();
                        captureInstantLocation();
                      }
                    }}
                    className="px-3.5 py-2 bg-sky-500 hover:bg-sky-600 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                  >
                    <CheckCircle2 size={15} />
                    <span>Conectar / Simular {selectedRider.name.split(' ')[0]}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCurrentScreen('login');
                      setPhoneInput(selectedRider.deviceNumber || selectedRider.phone || '');
                      setPasswordInput(selectedRider.password || '1234');
                      setLoginError(null);
                    }}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <LockIcon size={14} className="text-amber-400" />
                    <span>Ver Tela de Login</span>
                  </button>
                </>
              ) : (
                <span className="text-xs text-slate-400 italic">Selecione um condutor acima para iniciar a simulação no dispositivo.</span>
              )}
            </div>
          </div>

          {/* Quick Rider Selection Cards */}
          <div className="pt-2 border-t border-slate-800">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              ⚡ Clique em um condutor para alternar a simulação instantaneamente:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {riders.map((r) => {
                const isSelected = selectedRiderId === r.id;
                const pendingCount = orders.filter(o => o.riderId === r.id && o.status !== 'Concluído' && o.status !== 'Cancelado').length;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      changeSelectedRiderId(r.id);
                      setPhoneInput(r.deviceNumber || r.phone || '');
                      setPasswordInput(r.password || '1234');
                      setLoginError(null);
                    }}
                    className={`p-2 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                      isSelected
                        ? 'bg-sky-500/20 border-sky-400 text-white shadow-md ring-1 ring-sky-400'
                        : 'bg-slate-950/60 hover:bg-slate-800 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <img src={r.avatar} className="w-5 h-5 rounded-full object-cover shrink-0" />
                      <span className="text-[10.5px] font-extrabold truncate">{r.name}</span>
                    </div>
                    <div className="flex items-center justify-between text-[8.5px] text-slate-400 font-medium">
                      <span>{r.vehicle || 'Moto'}</span>
                      <span className="px-1.5 py-0.2 bg-slate-800 rounded font-bold text-sky-300">{pendingCount} ord.</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* CORE WRAPPER LAYOUT */}
      <div className={isEffectiveRealDevice ? "fixed inset-0 w-full h-full bg-slate-900 z-50 font-sans antialiased flex flex-col overflow-hidden p-0" : `grid grid-cols-1 ${isFloating ? 'grid-cols-1' : 'lg:grid-cols-12'} gap-6`}>
        
        {/* PHONE EMULATOR SHELL (Lg: col-span-5) */}
        <div className={isEffectiveRealDevice ? "w-full h-full flex flex-col flex-1" : `${isFloating ? 'w-full' : 'lg:col-span-5'} flex justify-center`}>
          <div className={isEffectiveRealDevice ? "w-full h-full flex flex-col relative overflow-hidden bg-slate-900" : "relative w-[360px] h-[720px] bg-slate-950 rounded-[48px] border-[10px] border-slate-900 shadow-2xl overflow-hidden shrink-0 flex flex-col"}>
            
            {/* Exit Full Screen Button overlay when in user full screen mode */}
            {isUserFullScreen && (
              <button
                type="button"
                onClick={() => setIsUserFullScreen(false)}
                className="absolute top-2 right-2 z-50 px-3 py-1.5 bg-slate-900/90 hover:bg-black text-amber-400 border border-amber-400/30 rounded-xl text-[10px] font-black flex items-center gap-1.5 shadow-2xl backdrop-blur-md cursor-pointer transition-all"
              >
                <Minimize2 size={13} className="text-amber-400" />
                <span>Sair da Tela Cheia</span>
              </button>
            )}

            {/* Camera / Notch */}
            {!isEffectiveRealDevice && (
              <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-slate-950 rounded-full z-50 flex items-center justify-between px-4">
                <div className="w-2.5 h-2.5 bg-slate-900 rounded-full border border-slate-800" />
                <div className="w-10 h-1 bg-slate-900 rounded-full" />
              </div>
            )}

            {/* Simulated Phone OS Status Bar */}
            {!isEffectiveRealDevice && (
              <>
                <div className="h-10 bg-slate-900 text-white flex items-center justify-between px-6 pt-3 text-[10px] font-bold select-none shrink-0 z-40">
                  <span>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  <div className="flex items-center gap-1.5">
                    {isNetworkOffline ? (
                      <WifiOff size={11} className="text-amber-400 animate-pulse" />
                    ) : (
                      <Wifi size={10} className="text-emerald-400" />
                    )}
                    <span className="text-[9px] font-mono">{isNetworkOffline ? 'OFF-GRID' : '5G'}</span>
                    <Battery size={12} className={selectedRider && selectedRider.batteryPercent <= 20 ? 'text-red-500 animate-pulse' : 'text-emerald-400'} />
                    <span>{selectedRider ? selectedRider.batteryPercent : 100}%</span>
                  </div>
                </div>

                {/* Real-time Latency & Offline Cache Telemetry Banner */}
                <div className="bg-slate-950 text-slate-300 px-3.5 py-1 flex items-center justify-between text-[8px] font-mono border-b border-slate-800/80 z-40 select-none">
                  {isNetworkOffline ? (
                    <div className="flex items-center gap-1 text-amber-400 font-black">
                      <HardDrive size={10} className="animate-pulse" />
                      <span>CACHE LOCAL: {offlineQueue.length} PENDENTE(S)</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-emerald-400 font-black">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                      <span>PING: 24ms (REDE 100%)</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const nextOffline = !isNetworkOffline;
                      setIsNetworkOffline(nextOffline);
                      if (nextOffline) {
                        triggerPhoneNotification("Modo Off-Grid", "Conexão desligada. Entregas serão salvas no cache do dispositivo.", "info");
                      } else {
                        triggerPhoneNotification("Sinal Restabelecido", "Conexão online ativa.", "success");
                      }
                    }}
                    className="px-1.5 py-0.5 rounded text-[7.5px] font-bold uppercase transition-all bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer border border-slate-700"
                  >
                    {isNetworkOffline ? '⚡ Conectar' : '📴 Testar Offline'}
                  </button>
                </div>
              </>
            )}

            {/* SCREEN VIEWPORT CONTAINER */}
            <div className="flex-1 bg-slate-100 flex flex-col overflow-hidden relative text-slate-800">
              
              {/* OFFLINE MODE / CACHE SYNC WARNING STRIP */}
              {isNetworkOffline && (
                <div className="bg-amber-500 text-slate-950 px-3 py-1.5 text-[9px] font-black flex items-center justify-between shrink-0 z-30 shadow-xs">
                  <div className="flex items-center gap-1.5 truncate">
                    <CloudOff size={11} className="shrink-0 text-slate-950" />
                    <span className="truncate">MODO SEM CONEXÃO — CACHE LOCAL ATIVO</span>
                  </div>
                  <span className="bg-slate-950 text-amber-400 px-1.5 py-0.2 rounded font-mono text-[8px] shrink-0 font-bold">
                    {offlineQueue.length} em cache
                  </span>
                </div>
              )}

              {!isNetworkOffline && offlineQueue.length > 0 && (
                <div className="bg-blue-600 text-white px-3 py-1.5 text-[9px] font-extrabold flex items-center justify-between shrink-0 z-30 shadow-xs">
                  <div className="flex items-center gap-1.5">
                    <RefreshCw size={11} className={`shrink-0 ${isSyncingOfflineQueue ? 'animate-spin' : ''}`} />
                    <span>Sinal Ok! {offlineQueue.length} atualização(ões) no cache</span>
                  </div>
                  <button
                    onClick={syncOfflineQueue}
                    disabled={isSyncingOfflineQueue}
                    className="px-2 py-0.5 bg-white text-blue-700 rounded text-[8px] font-black hover:bg-blue-50 cursor-pointer shadow-3xs"
                  >
                    {isSyncingOfflineQueue ? 'Enviando...' : 'Sincronizar Já'}
                  </button>
                </div>
              )}
              
              {/* Simulated iOS/Android Style Push Notification */}
              <AnimatePresence>
                {phoneNotification && (
                  <motion.div
                    initial={{ y: -65, opacity: 0 }}
                    animate={{ y: 8, opacity: 1 }}
                    exit={{ y: -65, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                    className="absolute top-2 left-3 right-3 bg-slate-900/95 text-white p-2.5 rounded-2xl shadow-xl z-50 border border-white/10 flex items-center gap-2.5 backdrop-blur-md"
                  >
                    <div className="w-7 h-7 rounded-xl overflow-hidden border border-white/20 shrink-0 shadow-md bg-slate-900">
                      <img 
                        src={effectiveLogo} 
                        alt="Vinimap Logo" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = vinimapLogo;
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-[9px] text-blue-400 uppercase tracking-widest">Vinimap OS</span>
                        <span className="text-[8px] text-slate-400 font-medium">Agora</span>
                      </div>
                      <h4 className="font-bold text-[10.5px] text-white truncate leading-tight mt-0.5">{phoneNotification.title}</h4>
                      <p className="text-[9.5px] text-slate-300 truncate leading-none mt-0.5">{phoneNotification.body}</p>
                    </div>
                    <button
                      onClick={() => setPhoneNotification(null)}
                      className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* CURRENT ACTIVE APP SCREEN */}
              {currentScreen === 'login' ? (
                /* SCREEN 1: INDIVIDUAL DRIVER APP LOGIN WITH TELEPHONE AND PASSWORD */
                <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between bg-gradient-to-b from-blue-950 via-slate-900 to-slate-950 text-white overflow-y-auto">
                  <div className="max-w-xs sm:max-w-sm mx-auto w-full flex flex-col justify-between h-full min-h-0 space-y-3.5 my-auto py-1">
                    
                    {/* Branding Header */}
                  <div className="space-y-1.5 text-center pt-2">
                    <div className="w-16 h-16 rounded-2xl mx-auto shadow-xl border-2 border-white/30 overflow-hidden bg-slate-900 flex items-center justify-center p-0.5">
                      <img 
                        src={effectiveLogo} 
                        alt="Vinimap Logo" 
                        className="w-full h-full object-cover rounded-xl" 
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = vinimapLogo;
                        }}
                      />
                    </div>
                    <h3 className="text-base font-black tracking-tight mt-2 text-white">Vinimap Condutor</h3>
                    <span className="text-[9.5px] text-blue-200 font-bold tracking-widest uppercase block">Aplicativo de Campo do Entregador</span>
                  </div>

                  {/* Locked Driver Device Banner */}
                  {lockedRiderId && (
                    <div className="bg-emerald-500/20 border border-emerald-500/40 rounded-2xl p-3 text-left space-y-1 my-2">
                      <div className="flex items-center gap-1.5 font-black text-emerald-300 text-[10.5px] uppercase tracking-wide">
                        <Shield size={14} className="text-emerald-400 shrink-0" />
                        <span>Dispositivo Vinculado Exclusivo</span>
                      </div>
                      <p className="text-[10px] text-emerald-100 font-medium leading-relaxed">
                        Este link foi gerado exclusivamente para o condutor <strong className="text-white font-bold">{riders.find(r => r.id === lockedRiderId)?.name || 'Atribuído'}</strong> ({riders.find(r => r.id === lockedRiderId)?.vehicle || 'Veículo'}).
                      </p>
                    </div>
                  )}

                  {/* Form Container */}
                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setLoginError(null);
                      
                      const inputVal = phoneInput.trim();
                      if (!inputVal) {
                        setLoginError('Informe o seu dispositivo ou telefone.');
                        return;
                      }
                      if (!passwordInput.trim()) {
                        setLoginError('Informe a sua senha.');
                        return;
                      }

                      // Sanitize phone input for phone matching fallback
                      const cleanInputPhone = inputVal.replace(/\D/g, '');
                      const shortInputPhone = cleanInputPhone.length >= 10 && cleanInputPhone.startsWith('55')
                        ? cleanInputPhone.substring(2)
                        : cleanInputPhone;
                      
                      // Flexible matching: check device number, sanitized phone (with/without country code), name, or locked rider ID
                      const matched = riders.find(r => {
                        if (lockedRiderId && r.id === lockedRiderId) return true;
                        if (r.deviceNumber && r.deviceNumber.trim().toLowerCase() === inputVal.toLowerCase()) return true;
                        if (r.deviceNumber && r.deviceNumber.replace(/\D/g, '') === cleanInputPhone && cleanInputPhone.length > 0) return true;
                        
                        const rCleanPhone = (r.phone || '').replace(/\D/g, '');
                        const rShortPhone = rCleanPhone.length >= 10 && rCleanPhone.startsWith('55') ? rCleanPhone.substring(2) : rCleanPhone;
                        
                        if (rCleanPhone && cleanInputPhone && (rCleanPhone === cleanInputPhone || rShortPhone === shortInputPhone)) return true;
                        if (rCleanPhone && cleanInputPhone && (rCleanPhone.endsWith(cleanInputPhone) || cleanInputPhone.endsWith(rCleanPhone))) return true;
                        if (r.cpfCnpj && r.cpfCnpj.replace(/\D/g, '') === cleanInputPhone && cleanInputPhone.length > 0) return true;
                        if (r.name && r.name.toLowerCase().trim() === inputVal.toLowerCase()) return true;
                        
                        return false;
                      });

                      if (!matched) {
                        setLoginError('Dispositivo ou telefone não cadastrado no Vinimap.');
                        return;
                      }

                      if (lockedRiderId && matched.id !== lockedRiderId) {
                        const targetRider = riders.find(r => r.id === lockedRiderId);
                        setLoginError(`Este dispositivo foi vinculado exclusivamente a ${targetRider?.name || 'outro condutor'}.`);
                        return;
                      }

                      const expectedPassword = matched.password || '1234';
                      if (passwordInput !== expectedPassword) {
                        setLoginError(`Senha incorreta. ${matched.password ? 'Verifique suas credenciais.' : 'Sua senha padrão é: 1234'}`);
                        return;
                      }

                      // Device session setup for real device
                      const thisDeviceId = getOrCreateDeviceId();

                      // Set active session state for this device (takeover session if logged in elsewhere)
                      const updatedRider: DeliveryRider = {
                        ...matched,
                        isLoggedIn: true,
                        activeDeviceId: thisDeviceId,
                        lastLoginAt: new Date().toISOString()
                      };

                      try {
                        await dbSaveDeliveryRider(updatedRider);
                      } catch (saveErr: any) {
                        console.warn('Non-blocking save error during login:', saveErr);
                      }

                      // Login successful
                      changeSelectedRiderId(matched.id);
                      setCurrentScreen('dashboard');
                      setActiveTab('home');
                      setPhoneInput('');
                      setPasswordInput('');
                      setLoginError(null);

                      // Automatically activate device GPS tracking by default upon login
                      if (typeof navigator !== 'undefined' && navigator.geolocation) {
                        startRealGpsTracking();
                        captureInstantLocation();
                      }

                      // Welcome alert notification
                      setTimeout(() => {
                        triggerPhoneNotification(
                          `Olá, ${matched.name}! 👋`,
                          `GPS do dispositivo ativado por padrão. Plantão iniciado no veículo ${matched.vehicle}.`,
                          'success'
                        );
                      }, 500);

                      onSaveLogs([{
                        id: `log-sim-login-${Date.now()}`,
                        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                        type: 'success',
                        message: `Aplicativo Condutor: ${matched.name} conectou-se com sucesso no dispositivo.`
                      }]);
                    }}
                    className="space-y-3.5 my-3"
                  >
                    <div className="space-y-3">
                      {/* Driver Select Dropdown */}
                      {lockedRiderId ? (
                        <div>
                          <label className="text-[9.5px] font-bold text-emerald-300 uppercase tracking-wider block mb-1">
                            🔒 Condutor Exclusivo do Link
                          </label>
                          <div className="bg-slate-800/90 border border-emerald-500/40 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-inner">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0 shadow-xs">
                                <User size={14} className="text-emerald-300" />
                              </div>
                              <div className="min-w-0">
                                <div className="font-extrabold text-xs text-white truncate">
                                  {riders.find(r => r.id === lockedRiderId)?.name || 'Condutor Cadastrado'}
                                </div>
                                <div className="text-[9.5px] text-emerald-200 font-medium truncate">
                                  {riders.find(r => r.id === lockedRiderId)?.vehicle || 'Veículo'} — Acesso Restrito
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="text-[9.5px] font-bold text-blue-200 uppercase tracking-wider block mb-1">
                            Condutor Cadastrado (Selecione abaixo)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-blue-300 pointer-events-none z-10">
                              <User size={13} />
                            </span>
                            <select
                              value={selectedRiderId || ''}
                              onChange={(e) => {
                                const id = e.target.value;
                                if (id) {
                                  const r = riders.find(item => item.id === id);
                                  if (r) {
                                    changeSelectedRiderId(r.id);
                                    setPhoneInput(r.deviceNumber || r.phone || r.name);
                                    setPasswordInput(r.password || '1234');
                                    setLoginError(null);
                                  }
                                } else {
                                  changeSelectedRiderId('');
                                  setPhoneInput('');
                                  setPasswordInput('');
                                }
                              }}
                              className="w-full bg-slate-800/90 hover:bg-slate-800 focus:bg-slate-900 border border-white/20 focus:border-blue-400 rounded-xl py-2 pl-8 pr-3 text-xs text-white focus:outline-none transition-all cursor-pointer font-semibold shadow-inner"
                            >
                              <option value="" className="bg-slate-900 text-slate-300">-- Selecione o Condutor Cadastrado --</option>
                              {riders.map(r => (
                                <option key={r.id} value={r.id} className="bg-slate-900 text-white">
                                  {r.name} ({r.vehicle || 'Veículo'}) — {r.deviceNumber || r.phone || 'Cadastrado'}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="text-[9.5px] font-bold text-blue-200 uppercase tracking-wider block mb-1">Dispositivo / Telefone</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-blue-300">
                            <Phone size={12} />
                          </span>
                          <input 
                            type="text"
                            placeholder="Ex: DISP01 ou Telefone"
                            value={phoneInput}
                            onChange={(e) => setPhoneInput(e.target.value)}
                            className="w-full bg-white/10 hover:bg-white/15 focus:bg-white/20 border border-white/15 focus:border-white/35 rounded-xl py-2 pl-8 pr-3 text-xs text-white placeholder-blue-300/60 focus:outline-none transition-all"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[9.5px] font-bold text-blue-200 uppercase tracking-wider block mb-1">Senha de Acesso</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-blue-300">
                            <Shield size={12} />
                          </span>
                          <input 
                            type="password"
                            placeholder="••••••"
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            className="w-full bg-white/10 hover:bg-white/15 focus:bg-white/20 border border-white/15 focus:border-white/35 rounded-xl py-2 pl-8 pr-3 text-xs text-white placeholder-blue-300/60 focus:outline-none transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    {loginError && (
                      <div className="bg-rose-500/20 border border-rose-500/35 rounded-xl p-2.5 text-[10px] text-rose-200 font-semibold leading-relaxed">
                        {loginError}
                      </div>
                    )}

                    <button 
                      type="submit"
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-950/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>Acessar Painel</span>
                      <ChevronRight size={13} />
                    </button>

                    {/* Prominent Install App Button */}
                    <button
                      type="button"
                      onClick={handleTriggerInstallPwa}
                      className="w-full py-2.5 bg-emerald-600/90 hover:bg-emerald-600 active:bg-emerald-700 text-white font-extrabold text-[11px] rounded-xl shadow-md border border-emerald-400/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Download size={14} className="animate-bounce" />
                      <span>{deferredPrompt ? '⚡ Instalar App no Celular' : '📱 Instalar / Baixar Aplicativo'}</span>
                    </button>
                  </form>

                  {/* Quick select helpful tool - only in simulator preview mode without locked link */}
                  {!lockedRiderId && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                      <span className="text-[8.5px] font-black text-blue-300 uppercase tracking-wider block">
                        ⚡ Seleção Rápida de Condutores Cadastrados:
                      </span>
                      <div className="grid grid-cols-1 gap-1 max-h-[120px] overflow-y-auto pr-1">
                        {riders.map(r => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              changeSelectedRiderId(r.id);
                              setPhoneInput(r.deviceNumber || r.phone || r.name);
                              setPasswordInput(r.password || '1234');
                              setLoginError(null);
                            }}
                            className="w-full py-1 px-2 bg-white/5 hover:bg-white/10 active:bg-white/15 rounded-lg text-left text-[9.5px] text-blue-100 flex items-center justify-between gap-1 border border-white/5 transition-all cursor-pointer"
                          >
                            <span className="font-semibold truncate">{r.name} ({r.vehicle})</span>
                            <span className="font-mono text-blue-300 shrink-0">{r.deviceNumber || r.phone} (senha: {r.password || '1234'})</span>
                          </button>
                        ))}
                      </div>
                      <p className="text-[8px] text-blue-300/60 leading-none m-0 text-center">Senha padrão: <strong className="text-blue-300">1234</strong> ou a cadastrada pelo administrador.</p>
                    </div>
                  )}

                  {/* Footer Terms */}
                  <div className="text-center text-[8.5px] text-blue-300/80 pt-1 pb-1">
                    Ao conectar, você aceita os termos operacionais do Vinimap OS.
                  </div>

                  </div>
                </div>
              ) : (
                /* SCREENS RUNNING ACTIVE APPLICATION (HEADER & CONTENT & FOOTER NAVIGATION) */
                <div className="flex-1 flex flex-col overflow-hidden">
                  
                  {/* APP TOP ACTION HEADER */}
                  <div className="bg-white border-b border-slate-200/50 px-3 py-2.5 shrink-0 flex items-center justify-between shadow-xs relative z-30">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Hamburger Menu Toggle Button */}
                      <button
                        type="button"
                        onClick={() => setIsDrawerMenuOpen(true)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0"
                        title="Abrir Menu Lateral do Condutor"
                      >
                        <Menu size={16} />
                      </button>

                      <img src={selectedRider?.avatar} className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-extrabold text-[11px] truncate text-slate-800">{selectedRider?.name}</div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">{selectedRider?.vehicle}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Quick Sync Button */}
                      <button
                        type="button"
                        disabled={isSyncingWithSystem}
                        onClick={handleManualSyncTodayOrders}
                        className="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 font-extrabold text-[9.5px] rounded-lg border border-sky-200 transition-all flex items-center gap-1 cursor-pointer"
                        title="Sincronizar Lançamentos do Dia com o Sistema"
                      >
                        <RefreshCw size={11} className={`text-sky-600 ${isSyncingWithSystem ? "animate-spin" : ""}`} />
                        <span>{isSyncingWithSystem ? 'Sinc...' : 'Sinc'}</span>
                      </button>

                      {/* GPS Localização Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (isRealGpsActive) {
                            stopRealGpsTracking();
                          } else {
                            startRealGpsTracking();
                          }
                        }}
                        className={`px-2 py-1 font-extrabold text-[9.5px] rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                          isRealGpsActive
                            ? 'bg-emerald-500 text-white border-emerald-600 animate-pulse'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                        }`}
                        title="Localizar via GPS do Celular"
                      >
                        <Compass size={11} className={isRealGpsActive ? "animate-spin" : ""} />
                        <span>{isRealGpsActive ? 'GPS On' : 'GPS'}</span>
                      </button>

                      {/* Full screen toggle */}
                      <button
                        type="button"
                        onClick={() => setIsUserFullScreen(!isUserFullScreen)}
                        className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold text-[9.5px] rounded-lg border border-blue-200 transition-all flex items-center gap-1 cursor-pointer"
                        title={isUserFullScreen ? "Sair da Tela Cheia" : "Abrir em Tela Cheia"}
                      >
                        {isUserFullScreen ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
                        <span>{isUserFullScreen ? 'Sair' : 'Tela Cheia'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleTriggerInstallPwa}
                        className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold text-[9.5px] rounded-lg border border-emerald-200 transition-all flex items-center gap-1 cursor-pointer"
                        title="Instalar Aplicativo no Dispositivo"
                      >
                        <Download size={11} className="text-emerald-600" />
                        <span>Instalar</span>
                      </button>

                      <button
                        onClick={async () => {
                          if (selectedRider) {
                            const loggedOutRider: DeliveryRider = {
                              ...selectedRider,
                              isLoggedIn: false,
                              activeDeviceId: undefined
                            };
                            try {
                              await dbSaveDeliveryRider(loggedOutRider);
                            } catch (e) {
                              console.warn('Error saving logout state:', e);
                            }
                          }
                          if (typeof window !== 'undefined') {
                            localStorage.removeItem('vinimap_driver_logged_in');
                            localStorage.removeItem('vinimap_driver_active_screen');
                            localStorage.removeItem('vinimap_driver_active_tab');
                            localStorage.removeItem('vinimap_driver_selected_order_id');
                          }
                          setSelectedOrder(null);
                          setCurrentScreen('login');
                        }}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                        title="Sair / Desconectar"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>

                  {/* LATERAL DRAWER MENU OVERLAY */}
                  <AnimatePresence>
                    {isDrawerMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex"
                        onClick={() => setIsDrawerMenuOpen(false)}
                      >
                        <motion.div
                          initial={{ x: '-100%' }}
                          animate={{ x: 0 }}
                          exit={{ x: '-100%' }}
                          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4/5 max-w-[280px] h-full bg-slate-900 text-white flex flex-col shadow-2xl overflow-y-auto"
                        >
                          {/* Drawer Header with Logged-in Driver Profile Card */}
                          <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-800 border-b border-slate-700/80 shrink-0">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Condutor Conectado</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setIsDrawerMenuOpen(false)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
                              >
                                <X size={16} />
                              </button>
                            </div>

                            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
                              <img 
                                src={selectedRider?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'} 
                                className="w-11 h-11 rounded-full object-cover border-2 border-sky-400 shrink-0 shadow-md" 
                                alt={selectedRider?.name || 'Condutor'}
                              />
                              <div className="min-w-0 flex-1">
                                <h4 className="font-extrabold text-sm text-white truncate">{selectedRider?.name || 'Condutor Vinimap'}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 uppercase">
                                    {selectedRider?.vehicle || 'Moto'}
                                  </span>
                                  {selectedRider?.phone && (
                                    <span className="text-[10px] text-slate-400 font-mono truncate">
                                      {selectedRider.phone}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Drawer Menu Navigation Items */}
                          <div className="p-3 space-y-1.5 flex-1 overflow-y-auto">
                            {/* Botão de Sincronizar Lançamentos do Dia */}
                            <button
                              type="button"
                              disabled={isSyncingWithSystem}
                              onClick={async () => {
                                await handleManualSyncTodayOrders();
                              }}
                              className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-sky-950/80 to-slate-900 border border-sky-500/40 text-sky-300 hover:border-sky-400 hover:bg-sky-900/30 transition-all cursor-pointer shadow-sm group mb-2"
                              title="Sincronizar Lançamentos do Dia com o Sistema"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30 shrink-0">
                                  <RefreshCw size={15} className={`${isSyncingWithSystem ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                                </div>
                                <div className="flex flex-col text-left min-w-0">
                                  <span className="font-black text-white text-[11px] truncate">Sincronizar com o Sistema</span>
                                  <span className="text-[9px] font-medium text-sky-300/80 truncate">Atualizar Lançamentos do Dia</span>
                                </div>
                              </div>
                              {isSyncingWithSystem ? (
                                <span className="text-[9px] font-bold text-sky-400 animate-pulse shrink-0 ml-1">Sincronizando...</span>
                              ) : (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-sky-400/20 text-sky-300 border border-sky-400/30 shrink-0 ml-1">
                                  {driverActiveOrders.length} do dia
                                </span>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('home');
                                setCurrentScreen('dashboard');
                                setIsDrawerMenuOpen(false);
                              }}
                              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                activeTab === 'home' ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30' : 'text-slate-300 hover:bg-slate-800'
                              }`}
                            >
                              <User size={15} />
                              <span>Painel do Condutor</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('map');
                                setIsDrawerMenuOpen(false);
                              }}
                              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                activeTab === 'map' ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30' : 'text-slate-300 hover:bg-slate-800'
                              }`}
                            >
                              <MapIcon size={15} />
                              <span>Mapa e Rota GPS</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('tasks');
                                setIsDrawerMenuOpen(false);
                              }}
                              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                activeTab === 'tasks' ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30' : 'text-slate-300 hover:bg-slate-800'
                              }`}
                            >
                              <CheckCircle2 size={15} />
                              <span>Minhas Entregas ({riderPendingOrders.length})</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('audio');
                                setIsDrawerMenuOpen(false);
                              }}
                              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                activeTab === 'audio' ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30' : 'text-slate-300 hover:bg-slate-800'
                              }`}
                            >
                              <Volume2 size={15} />
                              <span>Áudio & Notificações</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                handleTriggerInstallPwa();
                                setIsDrawerMenuOpen(false);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-emerald-400 hover:bg-emerald-950/30 transition-all cursor-pointer"
                            >
                              <Download size={15} />
                              <span>Instalar Aplicativo PWA</span>
                            </button>
                          </div>

                          {/* Drawer Footer Logout */}
                          <div className="p-4 border-t border-slate-800 bg-slate-950 shrink-0">
                            <button
                              type="button"
                              onClick={async () => {
                                setIsDrawerMenuOpen(false);
                                if (selectedRider) {
                                  const loggedOutRider: DeliveryRider = {
                                    ...selectedRider,
                                    isLoggedIn: false,
                                    activeDeviceId: undefined
                                  };
                                  try {
                                    await dbSaveDeliveryRider(loggedOutRider);
                                  } catch (e) {
                                    console.warn('Error saving logout state:', e);
                                  }
                                }
                                if (typeof window !== 'undefined') {
                                  localStorage.removeItem('vinimap_driver_logged_in');
                                  localStorage.removeItem('vinimap_driver_active_screen');
                                  localStorage.removeItem('vinimap_driver_active_tab');
                                  localStorage.removeItem('vinimap_driver_selected_order_id');
                                }
                                setSelectedOrder(null);
                                setCurrentScreen('login');
                              }}
                              className="w-full py-2.5 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer"
                            >
                              <LogOut size={15} />
                              <span>Sair do Aplicativo</span>
                            </button>
                          </div>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* SCREEN BODY VIEWS */}
                  <div className="flex-1 overflow-y-auto bg-slate-50 relative">
                    
                    {/* FULL SCREEN ORDER OVERLAY (TOUCH TO COLLAPSE/EXPAND FOR EASY RIDER READING) */}
                    <AnimatePresence>
                      {fullScreenOrder && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ duration: 0.2 }}
                          className="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur-md flex flex-col p-3 overflow-y-auto space-y-3"
                          onClick={() => setFullScreenOrder(null)}
                        >
                          {/* Banner Header - Tap to Close */}
                          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl p-3 shadow-md flex items-center justify-between cursor-pointer shrink-0">
                            <div className="flex items-center gap-2">
                              <Minimize2 size={16} className="text-sky-200 animate-pulse" />
                              <div>
                                <span className="text-[11px] font-black uppercase tracking-wider block">Pedido em Tela Cheia</span>
                                <span className="text-[9px] text-blue-100 font-medium">Toque para fechar ou voltar</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFullScreenOrder(null);
                              }}
                              className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-all cursor-pointer"
                            >
                              <X size={16} />
                            </button>
                          </div>

                          {/* Full Screen Card Details */}
                          <div 
                            onClick={(e) => e.stopPropagation()} 
                            className="bg-white rounded-2xl p-4 space-y-3.5 shadow-xl border border-slate-200 flex-1 overflow-y-auto"
                          >
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                              <span className="text-xs font-mono font-black text-slate-800">#{fullScreenOrder.id}</span>
                              <span className="px-3 py-1 text-xs font-black uppercase rounded-full bg-blue-100 text-blue-900 border border-blue-300">
                                {fullScreenOrder.status}
                              </span>
                            </div>

                            <div>
                              <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider block">Cliente / Solicitante</span>
                              <h2 className="text-lg font-black text-slate-950 leading-tight mt-0.5">{fullScreenOrder.clientName}</h2>
                            </div>

                            <div className="bg-slate-50 border border-slate-300 rounded-xl p-3 space-y-1.5">
                              <div className="flex items-start gap-2">
                                <MapPin size={18} className="text-blue-700 shrink-0 mt-0.5" />
                                <div className="space-y-0.5">
                                  <span className="text-[9.5px] font-extrabold text-slate-700 uppercase block">Endereço Completo de Entrega</span>
                                  <p className="text-sm font-black text-slate-950 leading-relaxed">{fullScreenOrder.address}</p>
                                  {fullScreenOrder.cep && (
                                    <span className="text-[11px] font-mono font-extrabold text-slate-800 block">CEP: {fullScreenOrder.cep}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {fullScreenOrder.phone && (
                              <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-emerald-950">
                                <Phone size={18} className="text-emerald-700 shrink-0" />
                                <div>
                                  <span className="text-[9.5px] font-extrabold text-emerald-800 uppercase block">Telefone de Contato</span>
                                  <span className="text-xs font-black font-mono text-slate-950">{fullScreenOrder.phone}</span>
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2.5">
                              <div className="bg-slate-50 border border-slate-300 rounded-xl p-2.5">
                                <span className="text-[9px] text-slate-700 font-extrabold uppercase block">Região</span>
                                <span className="text-xs font-black text-slate-950 uppercase">{fullScreenOrder.region}</span>
                              </div>
                              <div className="bg-slate-50 border border-slate-300 rounded-xl p-2.5">
                                <span className="text-[9px] text-slate-700 font-extrabold uppercase block">Prioridade</span>
                                <span className={`text-xs font-black uppercase ${fullScreenOrder.priority === 'Alta' ? 'text-rose-700' : 'text-slate-950'}`}>
                                  {fullScreenOrder.priority}
                                </span>
                              </div>
                            </div>

                            {!selectedRider?.ocultarValoresProtocolos && (
                              <div className="bg-slate-50 border border-slate-300 rounded-xl p-2.5 flex justify-between items-center">
                                <span className="text-[10.5px] font-extrabold text-slate-700">Valor Declarado:</span>
                                <span className="text-xs font-black text-slate-950 font-mono">R$ {fullScreenOrder.value.toFixed(2)}</span>
                              </div>
                            )}

                            {fullScreenOrder.protocolNumber && (
                              <div className="bg-slate-50 border border-slate-300 rounded-xl p-2.5 space-y-0.5">
                                <span className="text-[9px] font-extrabold text-slate-700 uppercase block">Número do Protocolo</span>
                                <span className="text-xs font-mono font-black text-blue-800">{fullScreenOrder.protocolNumber}</span>
                              </div>
                            )}

                            {/* Fullscreen Actions */}
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                              {(fullScreenOrder.status === 'Não iniciado' || (fullScreenOrder.status as string) === 'Pendente') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleUpdateOrderStatus(fullScreenOrder.id, 'Em rota');
                                    setFullScreenOrder({ ...fullScreenOrder, status: 'Em rota' });
                                  }}
                                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                                >
                                  <Play size={16} />
                                  <span>Iniciar Viagem (Retirar e Entregar)</span>
                                </button>
                              )}

                              {fullScreenOrder.status === 'Em rota' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleUpdateOrderStatus(fullScreenOrder.id, 'Entregando');
                                    setFullScreenOrder({ ...fullScreenOrder, status: 'Entregando' });
                                  }}
                                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                                >
                                  <Navigation size={16} />
                                  <span>Marcar "Cheguei ao Destino"</span>
                                </button>
                              )}

                              {(fullScreenOrder.status === 'Em rota' || fullScreenOrder.status === 'Entregando') && (
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedOrder(fullScreenOrder);
                                      setShowFailureModal(true);
                                      setFullScreenOrder(null);
                                    }}
                                    className="py-2.5 border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                  >
                                    <AlertTriangle size={14} />
                                    <span>Ocorrência</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedOrder(fullScreenOrder);
                                      setShowReceiptModal(true);
                                      setFullScreenOrder(null);
                                    }}
                                    className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                                  >
                                    <CheckCircle2 size={14} />
                                    <span>Dar Baixa</span>
                                  </button>
                                </div>
                              )}

                              <a
                                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(fullScreenOrder.address)}`}
                                target="_blank"
                                referrerPolicy="no-referrer"
                                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
                              >
                                <ExternalLink size={14} />
                                <span>Abrir no OpenStreetMap</span>
                              </a>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setFullScreenOrder(null)}
                            className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl text-center transition-all cursor-pointer shrink-0"
                          >
                            Toque aqui para fechar a tela cheia
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                    {/* VIEW: HOME / DASHBOARD TAB */}
                    {activeTab === 'home' && (
                      <div className="p-3.5 sm:p-4 space-y-3.5">
                        
                        {/* PERFORMANCE METRICS HERO CARDS */}
                        <div className={(selectedRider?.exibirValorTurno && !selectedRider?.ocultarValoresProtocolos) ? "grid grid-cols-2 gap-2" : "grid grid-cols-1 gap-2"}>
                          {selectedRider?.exibirValorTurno && !selectedRider?.ocultarValoresProtocolos && (
                            <div className="bg-white border border-slate-100 rounded-xl p-2.5 flex items-center gap-2 shadow-xs">
                              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                <DollarSign size={14} />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Ganhos do Turno</span>
                                <span className="text-[11px] font-black text-slate-800 font-mono block">
                                  R$ {shiftEarnings.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )}

                          <div className="bg-white border border-slate-100 rounded-xl p-2.5 flex items-center gap-2 shadow-xs">
                            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                              <Award size={14} />
                            </div>
                            <div className="min-w-0">
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Taxa de SLA</span>
                              <span className="text-[11px] font-black text-slate-800 font-mono block">
                                {successRate}%
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* STATUS DAS ENTREGAS GRIDS */}
                        <div className="space-y-1.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">📊 Resumo das Entregas (Toque p/ Mudar Status)</span>
                          <div className="grid grid-cols-3 gap-1.5">
                            {/* Não iniciado */}
                            <button
                              type="button"
                              onClick={() => handleCardStatusClick('Não iniciado')}
                              className={`text-left bg-white border rounded-xl p-2 flex flex-col justify-between shadow-3xs transition-all ${
                                focusedOrder
                                  ? 'border-slate-300 hover:border-slate-500 hover:bg-slate-50/50 cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
                                  : 'border-slate-150 cursor-default'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1 w-full">
                                <div className="w-5 h-5 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center">
                                  <Clock size={11} />
                                </div>
                                {focusedOrder && (
                                  <span className="text-[7px] font-bold text-slate-400 uppercase">Toque</span>
                                )}
                              </div>
                              <div>
                                <span className="text-[8px] font-bold text-slate-400 uppercase block truncate">Não Iniciado</span>
                                <span className="text-sm font-black text-slate-700 font-mono">{naoIniciadoCount}</span>
                              </div>
                            </button>

                            {/* Em Rota */}
                            <button
                              type="button"
                              onClick={() => handleCardStatusClick('Em rota')}
                              className={`text-left border rounded-xl p-2 flex flex-col justify-between shadow-3xs transition-all ${
                                focusedOrder
                                  ? 'bg-indigo-50/80 border-indigo-300 hover:border-indigo-500 hover:bg-indigo-100/50 cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
                                  : 'bg-indigo-50/40 border-indigo-100/60 cursor-default'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1 w-full">
                                <div className="w-5 h-5 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                  <Truck size={11} />
                                </div>
                                {focusedOrder && (
                                  <span className="text-[7px] font-bold text-indigo-400 uppercase">Toque</span>
                                )}
                              </div>
                              <div>
                                <span className="text-[8px] font-bold text-indigo-500 uppercase block truncate">Em Rota</span>
                                <span className="text-sm font-black text-indigo-800 font-mono">{emRotaCount}</span>
                              </div>
                            </button>

                            {/* Entregando */}
                            <button
                              type="button"
                              onClick={() => handleCardStatusClick('Entregando')}
                              className={`text-left border rounded-xl p-2 flex flex-col justify-between shadow-3xs transition-all ${
                                focusedOrder
                                  ? 'bg-blue-50/80 border-blue-300 hover:border-blue-500 hover:bg-blue-100/50 cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
                                  : 'bg-blue-50/40 border-blue-100/60 cursor-default'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1 w-full">
                                <div className="w-5 h-5 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                                  <Navigation size={11} />
                                </div>
                                {focusedOrder && (
                                  <span className="text-[7px] font-bold text-blue-400 uppercase">Toque</span>
                                )}
                              </div>
                              <div>
                                <span className="text-[8px] font-bold text-blue-500 uppercase block truncate">Entregando</span>
                                <span className="text-sm font-black text-blue-800 font-mono">{entregandoCount}</span>
                              </div>
                            </button>

                            {/* Concluído */}
                            <button
                              type="button"
                              onClick={() => handleCardStatusClick('Concluído')}
                              className={`col-span-2 text-left border rounded-xl p-2 flex items-center justify-between shadow-3xs transition-all ${
                                focusedOrder
                                  ? 'bg-emerald-50/80 border-emerald-300 hover:border-emerald-500 hover:bg-emerald-100/50 cursor-pointer hover:scale-[1.01] active:scale-[0.99]'
                                  : 'bg-emerald-50/40 border-emerald-100/60 cursor-default'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                  <CheckCircle2 size={13} />
                                </div>
                                <div>
                                  <span className="text-[8px] font-bold text-emerald-600 uppercase block">Concluído (Hoje)</span>
                                  <span className="text-[7.5px] font-semibold text-slate-400 leading-none block uppercase">
                                    {focusedOrder ? 'Clique p/ Dar Baixa' : 'Total do Dia'}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right pr-1 flex items-center gap-1.5">
                                {focusedOrder && (
                                  <span className="text-[7px] font-bold text-emerald-500 uppercase">Toque</span>
                                )}
                                <span className="text-base font-black text-emerald-800 font-mono">{completedCount}</span>
                              </div>
                            </button>

                            {/* Ocorrência */}
                            <button
                              type="button"
                              onClick={() => handleCardStatusClick('Ocorrência')}
                              className={`text-left border rounded-xl p-2 flex flex-col justify-between shadow-3xs transition-all ${
                                focusedOrder
                                  ? 'bg-rose-50/80 border-rose-300 hover:border-rose-500 hover:bg-rose-100/50 cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
                                  : 'bg-rose-50/40 border-rose-100/60 cursor-default'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1 w-full">
                                <div className="w-5 h-5 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center">
                                  <AlertTriangle size={11} />
                                </div>
                                {focusedOrder && (
                                  <span className="text-[7px] font-bold text-rose-400 uppercase">Toque</span>
                                )}
                              </div>
                              <div>
                                <span className="text-[8px] font-bold text-rose-500 uppercase block truncate">Ocorrência</span>
                                <span className="text-sm font-black text-rose-800 font-mono">{occurrenceCount}</span>
                              </div>
                            </button>
                          </div>
                        </div>

                        {/* HIGHLY VISIBLE INTERACTIVE SELECTION HINT BANNER */}
                        {focusedOrder && (
                          <div className="bg-blue-50 border border-blue-100 rounded-xl p-2.5 flex items-center gap-2 text-blue-700 animate-pulse">
                            <Sparkles size={13} className="shrink-0 text-blue-500" />
                            <p className="text-[9.5px] leading-tight m-0 font-bold">
                              Pedido <span className="font-mono text-xs">#{focusedOrder.id}</span> está selecionado! Clique nos botões acima para alterar seu status rápido.
                            </p>
                          </div>
                        )}

                        {/* CO-PILOT DELIVERIES CARDS DASHBOARD */}
                        <div className="space-y-2.5">
                          <span className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider block">📋 Minhas Entregas (Plantão Individual)</span>
                          {renderDeliveryCards()}
                        </div>

                        {/* CO-PILOT OFFLINE SYSTEM METADATA */}
                        <div className="p-3 bg-slate-100 rounded-xl flex items-center gap-2.5 text-slate-500">
                          <Shield size={14} className="text-slate-400 shrink-0" />
                          <p className="text-[9px] leading-relaxed m-0 font-medium">
                            GPS ativo com precisão de ±4m. As transações são transmitidas de forma segura criptografadas em tempo real ao painel administrador.
                          </p>
                        </div>

                      </div>
                    )}

                    {/* VIEW: LIVE GPS MAP TAB */}
                    {activeTab === 'map' && (
                      <div className="w-full h-full flex flex-col relative">
                        
                        {/* TOP OVERLAY: REAL GPS TRACKING & GOOGLE MAPS CONTROLS */}
                        <div className="absolute top-3 left-3 right-3 z-20 flex flex-col gap-2">
                          <div className="bg-slate-900/90 text-white backdrop-blur-md rounded-2xl p-2.5 border border-white/10 shadow-xl flex items-center justify-between gap-2">
                            {/* Real GPS Toggle / Locate Me Button */}
                            <button
                              type="button"
                              onClick={() => {
                                if (isRealGpsActive) {
                                  stopRealGpsTracking();
                                } else {
                                  startRealGpsTracking();
                                }
                              }}
                              className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer ${
                                isRealGpsActive
                                  ? 'bg-emerald-500 text-slate-950 font-black animate-pulse'
                                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                              }`}
                            >
                              <Compass size={12} className={isRealGpsActive ? "animate-spin" : ""} />
                              <span>{isRealGpsActive ? 'GPS Ativo (Transmitindo)' : 'Usar GPS do Celular'}</span>
                            </button>

                            {/* Open Google Maps Button */}
                            {currentNextOrder ? (
                              <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(currentNextOrder.address)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => prepareExternalMapNavigation(currentNextOrder)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-extrabold flex items-center gap-1.5 shadow-sm transition-all"
                              >
                                <Navigation size={12} />
                                <span>Google Maps</span>
                              </a>
                            ) : (
                              <button
                                type="button"
                                onClick={captureInstantLocation}
                                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[10px] font-extrabold flex items-center gap-1 border border-white/10 cursor-pointer"
                              >
                                <MapPin size={11} className="text-amber-400" />
                                <span>Capturar Posição</span>
                              </button>
                            )}
                          </div>

                          {/* Button to Return to Selected Order */}
                          {selectedOrder && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('tasks');
                                setCurrentScreen('details');
                              }}
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] py-2 px-3 rounded-2xl flex items-center justify-center gap-1.5 shadow-lg cursor-pointer transition-all border border-blue-400/30"
                            >
                              <ArrowLeft size={13} />
                              <span>Voltar ao Pedido Selecionado (#{selectedOrder.id})</span>
                            </button>
                          )}

                          {/* Real GPS live coordinates badge */}
                          {isRealGpsActive && realGpsData && (
                            <div className="bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-[9px] px-3 py-1 rounded-xl font-mono flex items-center justify-between backdrop-blur-md shadow-md">
                              <span>Lat: {realGpsData.lat.toFixed(5)}, Lng: {realGpsData.lng.toFixed(5)}</span>
                              <span className="font-bold text-emerald-400">±{Math.round(realGpsData.accuracy)}m</span>
                            </div>
                          )}

                          {/* Service Worker Map Tiles Cache status badge */}
                          <div className="bg-slate-900/80 border border-slate-700/60 text-slate-300 text-[8.5px] px-2.5 py-1 rounded-xl font-medium flex items-center justify-between backdrop-blur-md">
                            <span className="flex items-center gap-1.5 font-bold text-blue-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Cache Offline de Tiles & Leaflet Ativo
                            </span>
                            <span className="text-emerald-400 text-[8px] font-mono font-bold">Modo Sem 4G Pronto</span>
                          </div>
                        </div>

                        {/* Leaflet instance inside phone */}
                        <div className="flex-1 bg-slate-200 min-h-[300px]" ref={phoneMapContainerRef} />

                        {/* Next Navigation floating strip */}
                        {currentNextOrder && (
                          <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md border border-slate-300 rounded-2xl p-3 shadow-lg flex items-center justify-between gap-3 z-10">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                                <span className="text-[9.5px] font-black text-slate-700 uppercase">GPS Ativo: Próxima Entrega</span>
                              </div>
                              <h5 className="font-black text-xs truncate mt-0.5 text-slate-950">{currentNextOrder.clientName}</h5>
                              <p className="text-[10.5px] font-bold text-slate-900 truncate">{currentNextOrder.address}</p>
                            </div>

                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(currentNextOrder.address)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => prepareExternalMapNavigation(currentNextOrder)}
                              className="px-3 py-2 bg-slate-900 hover:bg-black text-white text-[10px] font-black rounded-xl cursor-pointer flex items-center gap-1.5 shadow-md"
                            >
                              <Navigation size={11} className="text-emerald-400" />
                              <span>Google Maps</span>
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {/* VIEW: TASKS QUEUE TAB */}
                    {activeTab === 'tasks' && currentScreen === 'dashboard' && (
                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Fila de Entregas ({riderPendingOrders.length})</h4>
                          
                          {riderPendingOrders.some(o => o.status === 'Não iniciado') && (
                            <button
                              onClick={handleCollectAtCD}
                              className="px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 text-[9px] font-bold rounded-md cursor-pointer transition-all flex items-center gap-1"
                            >
                              <RefreshCw size={10} />
                              <span>Retirar no CD</span>
                            </button>
                          )}
                        </div>

                        {renderDeliveryCards()}
                      </div>
                    )}

                    {/* VIEW: ORDER DETAILS & DELIVERY ACTIONS */}
                    {activeTab === 'tasks' && currentScreen === 'details' && selectedOrder && (
                      <div className="p-4 space-y-4">
                        
                        {/* Go back header */}
                        <button
                          onClick={() => {
                            setCurrentScreen('dashboard');
                            setSelectedOrder(null);
                          }}
                          className="flex items-center gap-1 text-[10px] font-extrabold text-blue-600 hover:text-blue-700 cursor-pointer uppercase tracking-wider"
                        >
                          ← Voltar para Fila
                        </button>

                        {/* Order Header info */}
                        <div className="bg-white border border-slate-300 rounded-2xl p-4 shadow-sm space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-200 font-extrabold rounded uppercase">
                              Pedido {selectedOrder.status}
                            </span>
                            <span className="text-[11px] font-mono font-black text-slate-800">#{selectedOrder.id}</span>
                          </div>

                          <div className="space-y-1">
                            <h4 className="font-black text-base text-slate-950">{selectedOrder.clientName}</h4>
                            <p className="text-[11px] font-bold text-slate-900 leading-relaxed">{selectedOrder.address}</p>
                            <span className="text-[9.5px] bg-slate-200 text-slate-900 font-extrabold px-2 py-0.5 rounded inline-block uppercase border border-slate-300">
                              Região: {selectedOrder.region}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-slate-200">
                            <div>
                              <span className="text-[9px] text-slate-700 font-extrabold uppercase block">Faturamento</span>
                              <span className="text-sm font-black text-slate-950">
                                {selectedRider?.ocultarValoresProtocolos ? '---' : `R$ ${selectedOrder.value.toFixed(2)}`}
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-700 font-extrabold uppercase block">Prioridade</span>
                              <span className={`text-sm font-black uppercase ${selectedOrder.priority === 'Alta' ? 'text-rose-700' : 'text-amber-800'}`}>
                                {selectedOrder.priority}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons list */}
                        <div className="space-y-2.5">
                          
                          {/* If not collected/started yet */}
                          {((selectedOrder.status as string) === 'Pendente' || (selectedOrder.status as string) === 'Aguardando' || selectedOrder.status === 'Não iniciado') && (
                            <button
                              onClick={() => {
                                handleUpdateOrderStatus(selectedOrder.id, 'Em rota');
                                onSaveLogs([{
                                  id: `log-sim-start-${Date.now()}`,
                                  time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                                  type: 'info',
                                  message: `App do Condutor: Início de viagem para entregar pedido #${selectedOrder.id}.`,
                                  orderId: selectedOrder.id
                                }]);
                              }}
                              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                            >
                              <Play size={14} />
                              <span>Iniciar Viagem (Retirar e Entregar)</span>
                            </button>
                          )}

                          {/* If in route but not active delivering yet */}
                          {selectedOrder.status === 'Em rota' && (
                            <button
                              onClick={() => {
                                handleUpdateOrderStatus(selectedOrder.id, 'Entregando');
                                onSaveLogs([{
                                  id: `log-sim-arr-prep-${Date.now()}`,
                                  time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                                  type: 'info',
                                  message: `App do Condutor: Condutor iniciou a entrega direta no endereço do cliente #${selectedOrder.id}.`,
                                  orderId: selectedOrder.id
                                }]);
                              }}
                              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                            >
                              <Navigation size={14} className="animate-pulse" />
                              <span>Marcar "Cheguei ao Destino"</span>
                            </button>
                          )}

                          {/* Final actions (Complete / Fail) */}
                          {(selectedOrder.status === 'Em rota' || selectedOrder.status === 'Entregando') && (
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                onClick={() => setShowFailureModal(true)}
                                className="py-2 px-3 border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <AlertTriangle size={13} />
                                <span>Ocorrência</span>
                              </button>

                              <button
                                onClick={() => setShowReceiptModal(true)}
                                className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                              >
                                <CheckCircle2 size={13} />
                                <span>Dar Baixa</span>
                              </button>
                            </div>
                          )}

                          {/* If order is already completed */}
                          {selectedOrder.status === 'Concluído' && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1 text-amber-900 shadow-2xs">
                              <div className="flex items-center gap-1.5 font-black text-xs text-amber-800">
                                <LockIcon size={14} className="text-amber-700" />
                                <span>Pedido Concluído (Status Travado)</span>
                              </div>
                              <p className="m-0 text-[10px] text-amber-700/90 leading-relaxed font-medium">
                                Este pedido já foi finalizado. Alterações de status ou reaberturas são restritas ao Administrador no painel principal.
                              </p>
                            </div>
                          )}

                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selectedOrder.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => prepareExternalMapNavigation(selectedOrder)}
                            className="w-full py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                          >
                            <Navigation size={14} className="text-emerald-400 animate-pulse" />
                            <span>Abrir Rota no Google Maps</span>
                          </a>
                        </div>
                      </div>
                    )}

                    {/* VIEW: PROTOCOLS LIST TAB */}
                    {activeTab === 'protocols' && (
                      <div className="p-4 space-y-3 flex-1 flex flex-col h-full overflow-hidden">
                        <div className="space-y-1 shrink-0">
                          <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Protocolos Digitalizados</h4>
                          <p className="text-[9px] text-slate-400">Histórico de comprovantes e assinaturas digitais do condutor.</p>
                        </div>

                        {/* Search input */}
                        <div className="relative shrink-0">
                          <input
                            type="text"
                            placeholder="Buscar por cliente, endereço ou PRT..."
                            value={protocolsSearchQuery}
                            onChange={(e) => setProtocolsSearchQuery(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-[10px] text-slate-800 focus:outline-hidden focus:border-blue-400 shadow-2xs"
                          />
                          <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                          {protocolsSearchQuery && (
                            <button
                              onClick={() => setProtocolsSearchQuery('')}
                              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>

                        {/* List of protocols */}
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0 pb-4">
                          {deliveryProtocols
                            .filter(p => 
                              p.clientName.toLowerCase().includes(protocolsSearchQuery.toLowerCase()) ||
                              p.address.toLowerCase().includes(protocolsSearchQuery.toLowerCase()) ||
                              p.id.toLowerCase().includes(protocolsSearchQuery.toLowerCase())
                            )
                            .map((p) => (
                              <div
                                key={p.id}
                                onClick={() => setSelectedProtocol(p)}
                                className="bg-white border border-slate-150 hover:border-slate-250 rounded-xl p-3 shadow-2xs cursor-pointer transition-all flex items-center justify-between gap-3"
                              >
                                <div className="min-w-0 space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-[10px] font-black text-blue-700">{p.id}</span>
                                    <span className="text-[8.5px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-extrabold uppercase border border-emerald-200">Sincronizado</span>
                                  </div>
                                  <h5 className="font-black text-xs text-slate-950 truncate">{p.clientName}</h5>
                                  <span className="text-[9px] text-slate-700 font-bold block">{p.timestamp}</span>
                                </div>

                                <div className="shrink-0 flex flex-col items-end gap-1">
                                  <div className="w-8 h-8 rounded-md overflow-hidden border border-slate-200 flex items-center justify-center bg-slate-50">
                                    {p.photoImage ? (
                                      <img src={p.photoImage} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                      <MapPin size={14} className="text-rose-500" />
                                    )}
                                  </div>
                                  <span className="text-[7px] font-bold text-blue-500 uppercase flex items-center gap-0.5">
                                    <Shield size={7} /> GPS Ativo
                                  </span>
                                </div>
                              </div>
                            ))}

                          {deliveryProtocols.length === 0 && (
                            <div className="py-12 text-center text-slate-400 text-xs">
                              Nenhuma baixa realizada até o momento. Realize uma entrega para confirmar no sistema!
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* VIEW: HELP / INSTALL SECTION TAB */}
                    {activeTab === 'help' && (
                      <div className="p-4 space-y-4">
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-xs text-slate-800">Guia de Instalação no Celular</h4>
                          <p className="text-[10px] text-slate-400">Instale este aplicativo diretamente no dispositivo de campo.</p>
                        </div>

                        {/* Simulated QR Code */}
                        <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-xs flex flex-col items-center text-center space-y-3">
                          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl relative">
                            <QrCode size={110} className="text-slate-800" />
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 opacity-0 hover:opacity-100 transition-opacity">
                              <span className="text-[9px] font-black text-blue-600">APLICATIVO PWA</span>
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-700">QR Code de Campo</span>
                            <p className="text-[9px] text-slate-400 max-w-xs">
                              Escaneie com a câmera do celular para abrir o portal de instalação do entregador e salvar na tela de início como aplicativo nativo.
                            </p>
                          </div>
                        </div>

                        {/* Direct installation instructions */}
                        <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-xs space-y-3">
                          <h5 className="font-bold text-[10px] text-slate-700 uppercase tracking-wider">Passo a Passo de Configuração</h5>
                          
                          <div className="space-y-2.5 text-[9px] font-medium text-slate-500">
                            <div className="flex gap-2">
                              <span className="w-4 h-4 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0 font-black">1</span>
                              <p className="m-0">Abra o link do sistema no navegador do celular (Chrome ou Safari).</p>
                            </div>
                            <div className="flex gap-2">
                              <span className="w-4 h-4 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0 font-black">2</span>
                              <p className="m-0">Clique no botão de opções e selecione <strong>"Adicionar à Tela de Início"</strong> ou <strong>"Instalar App"</strong>.</p>
                            </div>
                            <div className="flex gap-2">
                              <span className="w-4 h-4 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0 font-black">3</span>
                              <p className="m-0">Insira a chave do CD de despacho informada pelo despachante para ativar a simulação GPS.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* VIEW: AUDIO SETTINGS TAB */}
                    {activeTab === 'audio' && selectedRider && (
                      <div className="p-4 space-y-4 overflow-y-auto">
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                            <Volume2 size={16} className="text-blue-600" />
                            <span>Configurações de Áudio</span>
                          </h4>
                          <p className="text-[10px] text-slate-400">Configure os alertas sonoros de novos pedidos recebidos no seu celular.</p>
                        </div>

                        {/* Sound Alert Main Switch */}
                        <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="space-y-0.5">
                              <span className="text-xs font-extrabold text-slate-800 block">Alerta Sonoro de Novos Pedidos</span>
                              <span className="text-[9.5px] text-slate-500 block leading-tight">
                                Tocar som automaticamente quando um novo pedido for atribuído a você pelo despacho.
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                const current = selectedRider.enableSoundAlert !== false;
                                const updated: DeliveryRider = {
                                  ...selectedRider,
                                  enableSoundAlert: !current
                                };
                                try {
                                  await dbSaveDeliveryRider(updated);
                                } catch (e) {
                                  console.warn("Save rider failed:", e);
                                }
                              }}
                              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                                selectedRider.enableSoundAlert !== false ? 'bg-blue-600' : 'bg-slate-300'
                              }`}
                            >
                              <span
                                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow-xs ${
                                  selectedRider.enableSoundAlert !== false ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        {/* Sound Selector and Demo Test */}
                        {selectedRider.enableSoundAlert !== false && (
                          <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs space-y-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                Tipo de Som da Notificação
                              </label>
                              <select
                                value={selectedRider.soundType || 'alerta_padrao'}
                                onChange={async (e) => {
                                  const val = e.target.value;
                                  const updated: DeliveryRider = {
                                    ...selectedRider,
                                    soundType: val
                                  };
                                  try {
                                    await dbSaveDeliveryRider(updated);
                                  } catch (err) {
                                    console.warn("Save sound type failed:", err);
                                  }
                                  playNotificationSound(val);
                                }}
                                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-hidden focus:border-blue-500 cursor-pointer"
                              >
                                <option value="alerta_padrao">🔔 Sinal Clássico (Padrão)</option>
                                <option value="sinal_suave">🎵 Chime Melódico (Suave)</option>
                                <option value="sinal_urgente">🚨 Sirene Dupla (Urgente)</option>
                                <option value="pop_moderno">✨ Pop Digital (Moderno)</option>
                              </select>
                            </div>

                            <button
                              type="button"
                              onClick={() => playNotificationSound(selectedRider.soundType || 'alerta_padrao')}
                              className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-700 text-xs font-bold rounded-xl border border-blue-200/80 transition-all cursor-pointer flex items-center justify-center gap-2"
                            >
                              <Volume2 size={15} />
                              <span>Ouvir Demonstração (Testar Som)</span>
                            </button>
                          </div>
                        )}

                        <div className="p-3 bg-slate-100/70 border border-slate-200/80 rounded-xl text-[9.5px] text-slate-500 leading-relaxed">
                          <span className="font-bold text-slate-700 block mb-0.5">💡 Observação do Dispositivo:</span>
                          Certifique-se de que o volume de mídia do celular está ativado para ouvir as notificações sonoras durante as entregas.
                        </div>
                      </div>
                    )}

                  </div>

                  {/* BOTTOM simulated smartphone navigation menu */}
                  <div className="h-14 bg-white border-t border-slate-200/50 flex items-center justify-around px-1 shrink-0 z-40 select-none">
                    
                    <button
                      onClick={() => {
                        setActiveTab('home');
                        setCurrentScreen('dashboard');
                      }}
                      className={`flex flex-col items-center gap-0.5 cursor-pointer flex-1 py-1 ${activeTab === 'home' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <User size={15} />
                      <span className="text-[7.5px] font-bold uppercase">Painel</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('map');
                      }}
                      className={`flex flex-col items-center gap-0.5 cursor-pointer flex-1 py-1 ${activeTab === 'map' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <MapIcon size={15} />
                      <span className="text-[7.5px] font-bold uppercase">Mapa GPS</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('tasks');
                        if (currentScreen !== 'details') {
                          setCurrentScreen('dashboard');
                        }
                      }}
                      className={`flex flex-col items-center gap-0.5 cursor-pointer relative flex-1 py-1 ${activeTab === 'tasks' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <CheckCircle2 size={15} />
                      <span className="text-[7.5px] font-bold uppercase">Entregas</span>
                      {riderPendingOrders.length > 0 && (
                        <span className="absolute top-0 right-3 w-3.5 h-3.5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[7px] font-bold">
                          {riderPendingOrders.length}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('audio');
                      }}
                      className={`flex flex-col items-center gap-0.5 cursor-pointer flex-1 py-1 ${activeTab === 'audio' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                      title="Configurações de Áudio e Notificações"
                    >
                      <Volume2 size={15} />
                      <span className="text-[7.5px] font-bold uppercase">Áudio</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('help');
                      }}
                      className={`flex flex-col items-center gap-0.5 cursor-pointer flex-1 py-1 ${activeTab === 'help' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <HelpCircle size={15} />
                      <span className="text-[7.5px] font-bold uppercase">Instalar</span>
                    </button>

                  </div>

                </div>
              )}

              {/* FLOATING SUBMISSION MODALS INSIDE PHONE SCREEN */}
              {/* MODAL 1: RECEIPT AND PROOF OF DELIVERY SUBMISSION */}
              <AnimatePresence>
                {showReceiptModal && selectedOrder && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end justify-center z-50 p-4"
                  >
                    <motion.div
                      initial={{ y: 100 }}
                      animate={{ y: 0 }}
                      exit={{ y: 100 }}
                      className="bg-white rounded-t-3xl rounded-b-xl w-full max-h-[92%] flex flex-col overflow-hidden text-slate-800 shadow-xl"
                    >
                      {showSuccessProtocol && generatedProtocol ? (
                        /* SUCCESS SCREEN - CONFIRMAÇÃO DE BAIXA (Dispositivo Móvel) */
                        <div className="flex-1 flex flex-col overflow-hidden">
                          {/* Header */}
                          <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-emerald-50">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 size={18} className="text-emerald-600" />
                              <h5 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Confirmação de Baixa</h5>
                            </div>
                            <span className="text-[8px] bg-emerald-600 text-white font-extrabold px-2 py-0.5 rounded-full">BAIXA REGISTRADA</span>
                          </div>

                          {/* Body - Clean Baixa Confirmation */}
                          <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs bg-slate-50 flex flex-col items-center text-center justify-center">
                            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center my-1 shadow-xs">
                              <CheckCircle2 size={36} />
                            </div>

                            <div className="space-y-1 max-w-xs">
                              <h4 className="font-extrabold text-sm text-slate-800">Baixa Concluída com Sucesso!</h4>
                              <p className="text-[10px] text-slate-500 leading-relaxed">
                                A confirmação de baixa do pedido foi enviada e registrada com sucesso no sistema.
                              </p>
                            </div>

                            {/* Summary Card */}
                            <div className="w-full bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2 text-left shadow-2xs">
                              <div className="border-b border-slate-100 pb-2 flex items-start justify-between">
                                <div className="space-y-0.5">
                                  <span className="text-[7.5px] font-extrabold tracking-widest text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded-full inline-block">
                                    VOUCHER DE COMPROVAÇÃO LOGÍSTICA
                                  </span>
                                  <h4 className="font-extrabold text-slate-800 text-xs">Vinimap Logistics OS</h4>
                                  <p className="text-[9px] text-slate-400 font-semibold uppercase">
                                    ID DO PEDIDO: {generatedProtocol.orderId.startsWith('ped-') ? generatedProtocol.orderId : `ped-${generatedProtocol.orderId}`}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] font-mono font-extrabold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg block">
                                    {generatedProtocol.id}
                                  </span>
                                  <p className="text-[8px] text-emerald-600 font-bold uppercase mt-0.5">Status: Concluído</p>
                                </div>
                              </div>
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-400 font-semibold">RECEBEDOR:</span>
                                <span className="font-bold text-slate-800 uppercase">{generatedProtocol.receiverName}</span>
                              </div>
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-400 font-semibold">DATA E HORA:</span>
                                <span className="font-medium text-slate-700">{generatedProtocol.timestamp}</span>
                              </div>
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-400 font-semibold">DESTINATÁRIO:</span>
                                <span className="font-bold text-slate-800 truncate max-w-[150px]">{generatedProtocol.clientName}</span>
                              </div>
                              <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[9px]">
                                <span className="text-slate-400 font-semibold">STATUS DO PEDIDO:</span>
                                <span className="font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  CONCLUÍDO / BAIXADO
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="p-3 bg-white border-t border-slate-150 flex gap-2 shrink-0">
                            {(selectedRider?.autorizarImprimirRecibo || selectedRider?.permiteImprimirRecibo) && (
                              <button
                                onClick={() => alert(`Enviando recibo #${generatedProtocol.id} para a impressora...`)}
                                className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Printer size={14} />
                                <span>Imprimir Recibo</span>
                              </button>
                            )}
                            
                            <button
                              onClick={handleCompleteAndCloseModal}
                              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                            >
                              <Check size={14} />
                              <span>Finalizar Baixa</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* STAGE 1 - FILL SUBMISSION PROTOCOL DETAILS */
                        <div className="flex-1 flex flex-col overflow-hidden">
                          {/* Modal Header */}
                          <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50">
                            <div className="flex items-center gap-2">
                              <Camera size={16} className="text-emerald-600 animate-pulse" />
                              <h5 className="font-extrabold text-xs text-slate-800">Dar Baixa Eletrônica</h5>
                            </div>
                            <button
                              onClick={() => {
                                stopWebcam();
                                setShowReceiptModal(false);
                              }}
                              className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600"
                            >
                              <X size={15} />
                            </button>
                          </div>

                          {/* Modal Body */}
                          <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
                            
                            {/* Summary */}
                            <div className="p-2.5 bg-slate-50 border border-slate-150 rounded-xl space-y-1">
                              <span className="font-bold text-[10px] text-slate-700">Comprovante do Pedido #{selectedOrder.id}</span>
                              <p className="m-0 text-[9px] text-slate-500 leading-normal">
                                Para garantir conformidade de auditoria Vinimap, anexe uma foto do pacote no local e colha a assinatura do recebedor.
                              </p>
                            </div>

                            {/* PHOTO CAPTURE WORKFLOW SECTION */}
                            <div className="space-y-1.5">
                              <label className="font-bold text-slate-700 flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                  <span className="text-rose-500 font-bold">*</span>
                                  <Camera size={12} className="text-blue-600" />
                                  <span>Foto do Comprovante (Obrigatório):</span>
                                </span>
                                {!receiptPhoto && (
                                  <span className="text-[8px] text-rose-600 font-extrabold bg-rose-50 border border-rose-200/50 px-1 rounded animate-pulse">
                                    Pendente
                                  </span>
                                )}
                              </label>

                              {/* Queue Progress Status Indicator */}
                              {isProcessingPhotoQueue && (
                                <div className="p-2 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-xs flex items-center justify-between animate-pulse shadow-2xs">
                                  <div className="flex items-center gap-2">
                                    <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                                    <div className="flex flex-col">
                                      <span className="font-extrabold text-[10px] leading-tight">
                                        {photoQueue.find(t => t.status === 'compressing' || t.status === 'syncing')?.progressMessage || 'Fila de otimização de foto ativa...'}
                                      </span>
                                      <span className="text-[8.5px] text-blue-600 font-medium">Compressão sequencial antes do envio ao Firestore</span>
                                    </div>
                                  </div>
                                  <span className="text-[9px] bg-blue-100 text-blue-700 font-black px-2 py-0.5 rounded-full shrink-0">
                                    Fila: {photoQueue.filter(t => t.status === 'pending' || t.status === 'compressing' || t.status === 'syncing').length}
                                  </span>
                                </div>
                              )}

                              {receiptPhoto ? (
                                <div className="relative rounded-xl overflow-hidden border border-slate-200 h-36 bg-slate-900 flex items-center justify-center group">
                                  <img src={receiptPhoto} className="w-full h-full object-cover cursor-pointer" referrerPolicy="no-referrer" onClick={() => setExpandedImage(receiptPhoto)} />
                                  <button
                                    onClick={() => setReceiptPhoto(null)}
                                    className="absolute top-2 right-2 p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full cursor-pointer shadow-md transition-all"
                                    title="Remover e tirar outra foto"
                                  >
                                    <X size={12} />
                                  </button>
                                  <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 text-[8px] font-mono text-emerald-400 rounded flex items-center gap-1 backdrop-blur-xs">
                                    <CheckCircle2 size={10} className="text-emerald-400" />
                                    <span>FOTO CAPTURADA COM SUCESSO</span>
                                  </div>
                                </div>
                              ) : (
                                /* Camera and File Upload options */
                                <div className="space-y-2">
                                  <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl">
                                    <label
                                      htmlFor="delivery-camera-capture"
                                      className="py-2.5 px-2 bg-blue-600 hover:bg-blue-700 text-white text-[9.5px] font-extrabold rounded-lg shadow-xs border border-blue-500 text-center cursor-pointer flex items-center justify-center gap-1.5 transition-all active:scale-95"
                                    >
                                      <Camera size={13} />
                                      <span>Tirar Foto (Câmera)</span>
                                    </label>
                                    <input
                                      type="file"
                                      id="delivery-camera-capture"
                                      accept="image/*"
                                      capture="environment"
                                      className="hidden"
                                      onChange={async (e) => {
                                        if (e.target.files && e.target.files[0]) {
                                          const file = e.target.files[0];
                                          try {
                                            const compressed = await enqueuePhotoProcessing(file, 'Câmera');
                                            if (compressed) setReceiptPhoto(compressed);
                                          } catch (err) {
                                            console.warn("Camera photo compression queue error:", err);
                                          }
                                          e.target.value = '';
                                        }
                                      }}
                                    />

                                    <label
                                      htmlFor="delivery-file-upload"
                                      className="py-2 px-2 bg-white hover:bg-slate-50 text-[9px] font-extrabold text-slate-700 rounded-lg shadow-2xs border border-slate-200 text-center cursor-pointer flex items-center justify-center gap-1 transition-all"
                                    >
                                      📁 Galeria / Arquivo
                                    </label>
                                    <input
                                      type="file"
                                      id="delivery-file-upload"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={async (e) => {
                                        if (e.target.files && e.target.files[0]) {
                                          const file = e.target.files[0];
                                          try {
                                            const compressed = await enqueuePhotoProcessing(file, 'Galeria');
                                            if (compressed) setReceiptPhoto(compressed);
                                          } catch (err) {
                                            console.warn("Gallery photo compression queue error:", err);
                                          }
                                          e.target.value = '';
                                        }
                                      }}
                                    />
                                  </div>

                                  {/* Quick simulation button for desktop testing */}
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const simulatedPhoto = handleCapturePhoto();
                                      if (simulatedPhoto) {
                                        try {
                                          const compressed = await enqueuePhotoProcessing(simulatedPhoto, 'Foto Teste');
                                          if (compressed) setReceiptPhoto(compressed);
                                        } catch (err) {
                                          console.warn("Test photo queue error:", err);
                                        }
                                      }
                                    }}
                                    className="w-full py-1 px-2 bg-slate-50 hover:bg-slate-100 text-[8.5px] font-bold text-slate-500 rounded-lg border border-slate-200 text-center cursor-pointer transition-all flex items-center justify-center gap-1"
                                  >
                                    <span>⚡ Gerar Comprovante Fotográfico de Teste</span>
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* SIGNATURE WORKFLOW SECTION */}
                            <div className="space-y-1.5">
                              <label className="font-bold text-slate-700 flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                  <PenTool size={12} className="text-blue-600" />
                                  <span>Assinatura do Recebedor (Opcional):</span>
                                </span>
                                
                                <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[8px] font-bold">
                                  <button
                                    type="button"
                                    onClick={() => setSignatureMode('draw')}
                                    className={`px-1.5 py-0.5 rounded cursor-pointer ${signatureMode === 'draw' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-400 hover:text-slate-600'}`}
                                  >
                                    Desenhar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSignatureMode('type');
                                      if (!receiptSignature && receiverName) {
                                        setReceiptSignature(receiverName);
                                      }
                                    }}
                                    className={`px-1.5 py-0.5 rounded cursor-pointer ${signatureMode === 'type' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-400 hover:text-slate-600'}`}
                                  >
                                    Digitar
                                  </button>
                                </div>
                              </label>

                              {signatureMode === 'draw' ? (
                                <div className="space-y-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setIsDriverSignatureModalOpen(true)}
                                    className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-[10px] border border-blue-200 flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                                  >
                                    <FileSignature size={13} className="text-blue-600" />
                                    <span>Abrir Canvas Interativo de Assinatura</span>
                                  </button>
                                  <div className="relative border border-slate-200 bg-slate-50 rounded-xl overflow-hidden shadow-2xs">
                                    <canvas
                                      ref={canvasRef}
                                      onMouseDown={startDrawing}
                                      onMouseMove={draw}
                                      onMouseUp={stopDrawing}
                                      onMouseLeave={stopDrawing}
                                      onTouchStart={startDrawing}
                                      onTouchMove={draw}
                                      onTouchEnd={stopDrawing}
                                      width={300}
                                      height={100}
                                      className="w-full h-24 cursor-crosshair touch-none block"
                                    />
                                    {signatureImage && (
                                      <span className="absolute bottom-1 left-2 text-[7px] font-mono text-emerald-600 font-bold bg-white/75 px-1 rounded border">
                                        Capturado ✓
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={clearCanvas}
                                      className="absolute right-2 bottom-1.5 py-0.5 px-1.5 bg-slate-200 hover:bg-slate-300 rounded text-[8px] font-extrabold text-slate-700 cursor-pointer shadow-2xs"
                                    >
                                      Limpar
                                    </button>
                                  </div>
                                  <p className="m-0 text-[7.5px] text-slate-400 text-center italic">Colha a assinatura arrastando o mouse ou usando a tela sensível ao toque.</p>
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  <input
                                    type="text"
                                    placeholder="Digite a assinatura do recebedor..."
                                    value={receiptSignature}
                                    onChange={(e) => setReceiptSignature(e.target.value)}
                                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-[10px] font-semibold text-slate-800 shadow-2xs"
                                  />
                                  <div className="h-20 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center p-3 relative overflow-hidden">
                                    {receiptSignature ? (
                                      <div 
                                        className="text-center text-lg text-blue-700 italic border-b border-blue-200 px-3 py-1 transform -rotate-4 transition-all"
                                        style={{ fontFamily: 'Caveat, "Playfair Display", Georgia, cursive, serif' }}
                                      >
                                        {receiptSignature}
                                      </div>
                                    ) : (
                                      <span className="text-slate-300 text-[10px] italic">Digite o nome para pré-visualizar a assinatura cursiva...</span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Nom/RG Recebedor Input */}
                            <div className="space-y-1.5">
                              <label className="font-bold text-slate-700 flex items-center gap-1">
                                <span className="text-rose-500 font-bold">*</span>
                                <span>Nome Completo & RG do Recebedor (Obrigatório):</span>
                              </label>
                              <input
                                type="text"
                                placeholder="Ex: Claudio Santos (Titular - RG: 42.112.983-X)"
                                value={receiverName}
                                onChange={(e) => {
                                  setReceiverName(e.target.value);
                                  if (signatureMode === 'type') {
                                    setReceiptSignature(e.target.value);
                                  }
                                }}
                                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-slate-50 text-[10px] text-slate-800 shadow-2xs"
                              />
                            </div>

                            {/* Observations textarea */}
                            <div className="space-y-1.5">
                              <label className="font-bold text-slate-700">Observações adicionais (Opcional):</label>
                              <textarea
                                placeholder="Ex: Campainha quebrada, pacote entregue ao vizinho de frente..."
                                rows={2}
                                value={receiptObservations}
                                onChange={(e) => setReceiptObservations(e.target.value)}
                                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-slate-50 text-[10px] text-slate-800 shadow-2xs"
                              />
                            </div>

                          </div>

                          {/* Modal Footer */}
                          <div className="p-3 border-t border-slate-100 bg-slate-50 flex gap-2 shrink-0">
                            <button
                              onClick={() => {
                                stopWebcam();
                                setShowReceiptModal(false);
                              }}
                              className="flex-1 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-500 font-bold rounded-lg cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={handleConfirmDelivery}
                              disabled={isSubmittingDelivery || !receiverName.trim() || !receiptPhoto}
                              className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none text-white font-bold rounded-lg cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                            >
                              {isSubmittingDelivery ? (
                                <RefreshCw size={12} className="animate-spin" />
                              ) : (
                                <Check size={12} />
                              )}
                              <span>Concluir Pedido</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* MODAL 2: REPORT INCIDENT OR FALHURE */}
              <AnimatePresence>
                {showFailureModal && selectedOrder && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end justify-center z-50 p-4"
                  >
                    <motion.div
                      initial={{ y: 100 }}
                      animate={{ y: 0 }}
                      exit={{ y: 100 }}
                      className="bg-white rounded-t-3xl rounded-b-xl w-full flex flex-col overflow-hidden text-slate-800 shadow-xl"
                    >
                      {/* Modal Header */}
                      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={15} className="text-rose-600 animate-pulse" />
                          <h5 className="font-extrabold text-xs text-slate-800">Registrar Ocorrência</h5>
                        </div>
                        <button
                          onClick={() => setShowFailureModal(false)}
                          className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600"
                        >
                          <X size={15} />
                        </button>
                      </div>

                      {/* Modal Body */}
                      <div className="p-4 space-y-3.5 text-xs">
                        <span className="font-bold text-slate-700">Selecione o motivo da impossibilidade de entrega:</span>
                        
                        <div className="space-y-2">
                          {[
                            'Cliente ausente / ninguém atendeu',
                            'Endereço não encontrado ou CEP incorreto',
                            'Portaria recusou recebimento',
                            'Problema mecânico com o veículo do condutor',
                            'Condições climáticas adversas ou alagamento'
                          ].map(reason => (
                            <button
                              key={reason}
                              onClick={() => setFailureReason(reason)}
                              className={`w-full text-left p-2.5 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
                                failureReason === reason
                                  ? 'bg-rose-50 text-rose-700 border-rose-200 shadow-sm'
                                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                              }`}
                            >
                              {reason}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Modal Footer */}
                      <div className="p-3 border-t border-slate-100 bg-slate-50 flex gap-2">
                        <button
                          onClick={() => setShowFailureModal(false)}
                          className="flex-1 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-500 font-bold rounded-lg cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleReportFailure}
                          disabled={!failureReason}
                          className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:pointer-events-none text-white font-bold rounded-lg cursor-pointer shadow-md"
                        >
                          Registrar
                        </button>
                      </div>

                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>


              {/* EXPANDED IMAGE MODAL */}
              <AnimatePresence>
                {expandedImage && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={() => setExpandedImage(null)}
                  >
                    <button 
                      className="absolute top-4 right-4 text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                      onClick={() => setExpandedImage(null)}
                    >
                      <X size={24} />
                    </button>
                    {expandedImage.startsWith('typed:') ? (
                      <div 
                        className="bg-white px-8 py-4 rounded-xl text-center text-4xl text-blue-700 italic transform -rotate-6 shadow-2xl cursor-pointer"
                        style={{ fontFamily: 'Caveat, "Playfair Display", Georgia, cursive, serif' }}
                        onClick={() => setExpandedImage(null)}
                      >
                        {expandedImage.replace('typed:', '')}
                      </div>
                    ) : (
                      <img 
                        src={expandedImage} 
                        className="max-w-full max-h-full object-contain rounded-lg cursor-pointer"
                        onClick={() => setExpandedImage(null)}
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* MODAL 3: VIEW HISTORIC PROTOCOL DETAIL */}
              <AnimatePresence>
                {selectedProtocol && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end justify-center z-50 p-4"
                  >
                    <motion.div
                      initial={{ y: 100 }}
                      animate={{ y: 0 }}
                      exit={{ y: 100 }}
                      className="bg-white rounded-t-3xl rounded-b-xl w-full max-h-[92%] flex flex-col overflow-hidden text-slate-800 shadow-xl animate-fade-in"
                    >
                      {/* Modal Header */}
                      <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-blue-50">
                        <div className="flex items-center gap-1.5">
                          <FileText size={15} className="text-blue-600 animate-pulse" />
                          <h5 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Protocolo {selectedProtocol.id}</h5>
                        </div>
                        <button
                          onClick={() => setSelectedProtocol(null)}
                          className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X size={15} />
                        </button>
                      </div>

                      {/* Modal Body - Paper thermal receipt */}
                      <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs bg-slate-100">
                        <div className="protocolo-card-container border border-slate-200 p-4 pt-6 pb-6 space-y-3 bg-white relative shadow-md">
                          
                          {/* Jagged Top Cut */}
                          <div className="absolute top-0 left-0 right-0 h-[8px] overflow-hidden flex select-none" style={{ transform: 'translateY(-4px)' }}>
                            {[...Array(40)].map((_, i) => (
                              <svg key={i} className="w-3 h-3 text-slate-100 shrink-0 fill-current" viewBox="0 0 10 10">
                                <polygon points="0,10 5,0 10,10" />
                              </svg>
                            ))}
                          </div>

                          {/* Jagged Bottom Cut */}
                          <div className="absolute bottom-0 left-0 right-0 h-[8px] overflow-hidden flex select-none" style={{ transform: 'translateY(4px) rotate(180deg)' }}>
                            {[...Array(40)].map((_, i) => (
                              <svg key={i} className="w-3 h-3 text-slate-100 shrink-0 fill-current" viewBox="0 0 10 10">
                                <polygon points="0,10 5,0 10,10" />
                              </svg>
                            ))}
                          </div>

                          {/* Voucher Standard Header */}
                          <div className="flex items-start justify-between border-b border-slate-100 pb-3 relative z-10 text-left">
                            <div className="space-y-1">
                              <span className="text-[8px] font-extrabold tracking-widest text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded-full inline-block">
                                VOUCHER DE COMPROVAÇÃO LOGÍSTICA
                              </span>
                              <h3 className="font-extrabold text-slate-800 text-sm">Vinimap Logistics OS</h3>
                              <p className="text-[9px] text-slate-500 font-semibold uppercase">
                                ID DO PEDIDO: {selectedProtocol.orderId.startsWith('ped-') ? selectedProtocol.orderId : `ped-${selectedProtocol.orderId}`}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-mono font-extrabold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg block">
                                {selectedProtocol.id}
                              </span>
                              <p className="text-[9px] text-emerald-600 font-bold uppercase mt-1">Status: Concluído</p>
                            </div>
                          </div>

                          {/* Barcode component */}
                          <div className="py-2 flex flex-col items-center justify-center bg-white border-y border-slate-150 border-dashed my-3 select-none">
                            <div className="flex justify-center items-center h-8 w-full gap-[1.5px] bg-white">
                              {[1, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 1, 3, 2, 4, 1, 2, 3, 1, 2, 1, 4, 1, 3, 2, 1, 1, 2, 3, 1].map((w, idx) => (
                                <div
                                  key={idx}
                                  className="h-6"
                                  style={{
                                    width: `${w * 1.2}px`,
                                    backgroundColor: idx % 2 === 0 ? '#0a192f' : 'transparent'
                                  }}
                                />
                              ))}
                            </div>
                            <span className="text-[7.5px] font-mono text-slate-500 mt-1 tracking-widest">{selectedProtocol.id}</span>
                          </div>

                          {/* Detail rows */}
                          <div className="space-y-2 pt-2 text-[9px]">
                            <div className="flex justify-between">
                              <span className="text-slate-400 font-semibold font-mono">CÓD. PROTOCOLO:</span>
                              <span className="font-mono font-black text-slate-800">{selectedProtocol.id}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400 font-semibold font-mono">DATA / HORA:</span>
                              <span className="font-black text-slate-800">{selectedProtocol.timestamp}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400 font-semibold font-mono">CÓD. PEDIDO:</span>
                              <span className="font-mono font-bold text-slate-600">#{selectedProtocol.orderId}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400 font-semibold font-mono">RECEBEDOR:</span>
                              <span className="font-black text-slate-800 uppercase">{selectedProtocol.receiverName}</span>
                            </div>
                          </div>

                          {/* Client Details */}
                          <div className="space-y-1 pt-2 border-t border-slate-100 text-[9px]">
                            <span className="text-slate-400 font-semibold block uppercase font-mono">Destinatário:</span>
                            <span className="font-bold text-slate-800 block leading-tight">{selectedProtocol.clientName}</span>
                            <p className="m-0 text-slate-500 leading-normal">{selectedProtocol.address}</p>
                          </div>

                          {/* Observations */}
                          {selectedProtocol.observations && (
                            <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 text-[9px] text-slate-500 italic">
                              <span className="font-bold text-[8px] text-slate-400 block not-italic uppercase tracking-wider font-mono">OBSERVAÇÕES DO OPERADOR:</span>
                              "{selectedProtocol.observations}"
                            </div>
                          )}

                          {/* Photo and Signature Proofs side-by-side */}
                          <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="space-y-1">
                              <span className="text-slate-400 font-bold uppercase text-[8px] block font-mono">FOTO DO PACOTE</span>
                              <div className="aspect-square w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                                {selectedProtocol.photoImage ? (
                                  <img src={selectedProtocol.photoImage} className="w-full h-full object-cover cursor-pointer" referrerPolicy="no-referrer" onClick={() => setExpandedImage(selectedProtocol.photoImage || null)} />
                                ) : (
                                  <div className="w-full h-full bg-slate-100 relative flex flex-col items-center justify-center p-2 text-center overflow-hidden">
                                    <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
                                    <div className="absolute inset-x-0 h-0.5 bg-blue-500/20 top-1/2 transform -translate-y-1/2" />
                                    <div className="absolute inset-y-0 w-0.5 bg-blue-500/20 left-1/2 transform -translate-x-1/2" />
                                    <div className="relative z-10 flex flex-col items-center gap-1 scale-[0.85]">
                                      <div className="relative">
                                        <MapPin size={22} className="text-rose-600 animate-bounce" />
                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-1 bg-black/20 rounded-full blur-[1px]" />
                                      </div>
                                      <span className="font-extrabold text-[8px] text-slate-700 block uppercase tracking-wider leading-tight">ENTREGUE SEM FOTO</span>
                                      <span className="font-mono text-[7px] text-slate-500 block leading-none">
                                        Lat: {selectedProtocol.lat.toFixed(5)}<br/>
                                        Lng: {selectedProtocol.lng.toFixed(5)}
                                      </span>
                                      <span className="text-[6px] text-emerald-600 font-extrabold border border-emerald-200 bg-emerald-50 px-1 rounded-full uppercase mt-1">
                                        Localização Auditada
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="space-y-1">
                              <span className="text-slate-400 font-bold uppercase text-[8px] block font-mono">ASSINATURA</span>
                              <div className="aspect-square w-full rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center p-2 overflow-hidden relative">
                                {selectedProtocol.signatureImage?.startsWith('typed:') ? (
                                  <div 
                                    className="text-center text-[13px] leading-tight text-blue-700 italic border-b border-blue-200 px-1.5 py-1 transform -rotate-6 cursor-pointer" onClick={() => setExpandedImage(selectedProtocol.signatureImage)}
                                    style={{ fontFamily: 'Caveat, "Playfair Display", Georgia, cursive, serif' }}
                                  >
                                    {selectedProtocol.signatureImage.replace('typed:', '')}
                                  </div>
                                ) : selectedProtocol.signatureImage ? (
                                  <img src={selectedProtocol.signatureImage} className="max-w-full max-h-full object-contain cursor-pointer" onClick={() => setExpandedImage(selectedProtocol.signatureImage || null)} />
                                ) : (
                                  <span className="text-[8px] text-slate-300 font-mono">Sem assinatura</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Blockchain Hash seal */}
                          <div className="pt-2 border-t border-slate-200/80 flex flex-col items-center text-center space-y-1">
                            <span className="text-[7px] font-mono text-slate-400 block">HASH DO PROTOCOLO</span>
                            <span className="font-mono text-[8px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase tracking-wider font-extrabold">
                              {selectedProtocol.hash}
                            </span>
                            <span className="text-[7px] text-slate-400 block font-mono">Coordenadas GPS: {selectedProtocol.lat.toFixed(5)}, {selectedProtocol.lng.toFixed(5)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Modal Footer */}
                      <div className="p-3 border-t border-slate-100 bg-slate-50 flex gap-2 shrink-0">
                        {(selectedRider?.autorizarImprimirRecibo || selectedRider?.permiteImprimirRecibo) && (
                          <button
                            onClick={() => alert(`Enviando recibo #${selectedProtocol.id} para a impressora...`)}
                            className="flex-1 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <Printer size={13} />
                            <span>Imprimir Recibo</span>
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedProtocol(null)}
                          className="flex-1 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center justify-center cursor-pointer shadow-md"
                        >
                          Fechar
                        </button>
                      </div>

                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>

          </div>
        </div>

        {/* CONTROLS AND MONITORING LOG PANEL (Lg: col-span-7) */}
        {!isFloating && !isEffectiveRealDevice && (
          <div className="lg:col-span-7 space-y-6">
            
            {/* REAL DEVICE GPS SIGNAL & SIMULATOR ENGINE SETTINGS */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800 text-sm">Painel de Sinal e Localização GPS Real</h3>
                    {isRealGpsActive ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-[9px] font-black font-mono animate-pulse flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        SINAL GPS REAL ATIVO (CELULAR)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[9px] font-bold font-mono">
                        SIMULADOR ATIVO
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Captura e transmissão de coordenadas geográficas reais diretamente do celular cadastrado.</p>
                </div>

                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/50">
                  <button
                    onClick={() => setSimSpeed(1)}
                    className={`px-2 py-1 text-[9px] font-bold rounded ${simSpeed === 1 ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-400'}`}
                  >
                    1x (Lento)
                  </button>
                  <button
                    onClick={() => setSimSpeed(2.5)}
                    className={`px-2 py-1 text-[9px] font-bold rounded ${simSpeed === 2.5 ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-400'}`}
                  >
                    2.5x (Normal)
                  </button>
                  <button
                    onClick={() => setSimSpeed(6)}
                    className={`px-2 py-1 text-[9px] font-bold rounded ${simSpeed === 6 ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-400'}`}
                  >
                    6x (Rápido)
                  </button>
                </div>
              </div>

              {/* REAL GPS SENSOR HARDWARE PANEL */}
              <div className={`p-4 rounded-xl border transition-all ${
                isRealGpsActive 
                  ? 'bg-emerald-950 text-white border-emerald-500/50' 
                  : 'bg-slate-50 text-slate-800 border-slate-200'
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isRealGpsActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-200 text-slate-600'
                    }`}>
                      <Navigation size={20} className={isRealGpsActive ? 'animate-pulse text-emerald-400' : ''} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-wider block">Transmissão GPS Real do Celular ({selectedRider?.name || 'Condutor'})</span>
                      </div>
                      <p className={`text-[11px] font-medium mt-0.5 ${isRealGpsActive ? 'text-emerald-300' : 'text-slate-500'}`}>
                        {isRealGpsActive 
                          ? `Capturando satélite GPS do dispositivo cadastrado (${selectedRider?.phone || 'Celular'})` 
                          : 'Clique abaixo para ativar a leitura contínua do GPS do celular em tempo real.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={captureInstantLocation}
                      className="px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <MapPin size={13} />
                      <span>Capturar GPS Agora</span>
                    </button>

                    <button
                      type="button"
                      onClick={isRealGpsActive ? stopRealGpsTracking : startRealGpsTracking}
                      className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md flex items-center gap-1.5 ${
                        isRealGpsActive
                          ? 'bg-rose-600 hover:bg-rose-700 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {isRealGpsActive ? (
                        <>
                          <Pause size={13} /> Pausar GPS Real
                        </>
                      ) : (
                        <>
                          <Play size={13} /> Ativar GPS Real do Celular
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {isRealGpsActive && realGpsData && (
                  <div className="mt-3 pt-3 border-t border-emerald-500/30 grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[10px]">
                    <div className="bg-slate-900 p-2 rounded-lg border border-emerald-500/20">
                      <span className="text-slate-400 block font-sans text-[8px] uppercase">Latitude / Longitude</span>
                      <span className="font-bold text-emerald-300">{realGpsData.lat.toFixed(6)}, {realGpsData.lng.toFixed(6)}</span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-emerald-500/20">
                      <span className="text-slate-400 block font-sans text-[8px] uppercase">Precisão do Sinal</span>
                      <span className="font-bold text-emerald-300">±{Math.round(realGpsData.accuracy)} metros</span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-emerald-500/20">
                      <span className="text-slate-400 block font-sans text-[8px] uppercase">Última Transmissão</span>
                      <span className="font-bold text-emerald-300">{new Date(realGpsData.timestamp).toLocaleTimeString('pt-BR')}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* LOCAL CACHE & OFFLINE QUEUE MONITORING CARD */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                      <HardDrive size={16} />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-slate-800 m-0">Sistema de Cache Local Offline</h4>
                      <span className="text-[10px] text-slate-500 block">Fila em localStorage com auto-sincronização</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const nextOffline = !isNetworkOffline;
                      setIsNetworkOffline(nextOffline);
                      if (nextOffline) {
                        triggerPhoneNotification("Modo Off-Grid", "Conexão desligada. Entregas serão salvas no cache do dispositivo.", "info");
                      } else {
                        triggerPhoneNotification("Sinal Restabelecido", "Conexão online ativa.", "success");
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ${
                      isNetworkOffline 
                        ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                        : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                    }`}
                  >
                    {isNetworkOffline ? <WifiOff size={13} /> : <Wifi size={13} />}
                    <span>{isNetworkOffline ? 'Sinal: OFFLINE' : 'Sinal: ONLINE'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="bg-white p-2.5 rounded-xl border border-amber-200/60 shadow-3xs space-y-0.5">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Itens na Fila</span>
                    <span className="font-black text-amber-700 text-sm font-mono">{offlineQueue.length} registro(s)</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-amber-200/60 shadow-3xs space-y-0.5">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Status do Cache</span>
                    <span className="font-bold text-slate-700 block truncate">
                      {isNetworkOffline ? 'Acumulando em localStorage' : (offlineQueue.length > 0 ? 'Aguardando envio' : 'Sincronizado / Vazio')}
                    </span>
                  </div>
                </div>

                {offlineQueue.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-slate-700">Fila Pendente de Envio:</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={syncOfflineQueue}
                          disabled={isSyncingOfflineQueue || isNetworkOffline}
                          className="text-[9px] px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                        >
                          <RefreshCw size={10} className={isSyncingOfflineQueue ? 'animate-spin' : ''} />
                          <span>Sincronizar Agora</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("Deseja mesmo descartar a fila de cache local?")) {
                              setOfflineQueue([]);
                              localStorage.removeItem('vinimap_rider_offline_queue');
                            }
                          }}
                          className="text-[9px] px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg font-bold transition-all cursor-pointer"
                        >
                          Limpar
                        </button>
                      </div>
                    </div>

                    <div className="bg-white border border-amber-200 rounded-xl p-2 max-h-32 overflow-y-auto space-y-1.5 font-mono text-[9.5px]">
                      {offlineQueue.map((item) => (
                        <div key={item.id} className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800">#{item.orderId}</span>
                            <span className="ml-2 text-blue-600 font-semibold">{item.status}</span>
                            <span className="text-slate-400 block text-[8.5px] font-sans">
                              {new Date(item.timestamp).toLocaleTimeString('pt-BR')}
                            </span>
                          </div>
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[8px] rounded font-bold uppercase shrink-0">
                            Offline
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* ACTION TRIGGER BUTTONS */}
                <div className="space-y-3.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mapear Corrida Física (Simulador):</span>
                  
                  <div className="flex gap-2.5">
                    <button
                      onClick={() => setIsSimulating(!isSimulating)}
                      disabled={riderPendingOrders.length === 0}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold text-white shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                        isSimulating
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50'
                      }`}
                    >
                      {isSimulating ? (
                        <>
                          <Pause size={13} />
                          <span>Pausar Corrida</span>
                        </>
                      ) : (
                        <>
                          <Play size={13} />
                          <span>Iniciar Simulador</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleTeleportToNext}
                      disabled={riderPendingOrders.length === 0}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                      title="Simular chegada rápida pulando trecho de trânsito"
                    >
                      <Navigation size={13} />
                      <span>Chegar no Destino</span>
                    </button>
                  </div>

                  <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-700">
                      <Sparkles size={11} className="animate-spin" />
                      <span>Rastreamento Híbrido Real + Simulação</span>
                    </div>
                    <p className="text-[10px] text-blue-600/90 leading-relaxed font-medium m-0">
                      Ative o <strong>"GPS Real do Celular"</strong> para transmitir a localização exata do seu dispositivo físico, ou utilize o <strong>"Simulador"</strong> para testar rotas e deslocamentos pré-programados no mapa da Central.
                    </p>
                  </div>
                </div>

                {/* COORDINATE TELEMETRY LOGS */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Telemetria GPS Logs:</span>
                  
                  <div className="bg-slate-900 text-slate-300 font-mono text-[9px] p-3 rounded-xl min-h-[105px] max-h-[110px] overflow-y-auto space-y-1">
                    {simulationLog.length === 0 ? (
                      <span className="text-slate-500 italic block">Transmissão GPS inativa. Aguardando comando...</span>
                    ) : (
                      simulationLog.map((log, idx) => (
                        <div key={idx} className="flex gap-1">
                          <span className="text-blue-400">⚡</span>
                          <span>{log}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* DRIVER STATS CARD */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Performance Consolidada de Campo</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Indicadores do condutor selecionado no plantão operacional.</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                
                {/* Completed */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Total Concluído (Hoje)</span>
                  <span className="text-lg font-black text-slate-800 font-mono">
                    {completedCount} bipes
                  </span>
                </div>

                {/* Revenue */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Faturamento Condutor</span>
                  <span className="text-lg font-black text-slate-800 font-mono">
                    R$ {riderCompletedOrders.reduce((sum, o) => sum + o.value, 0).toFixed(2)}
                  </span>
                </div>

                {/* SLA Score */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Tempo SLA Médio</span>
                  <span className="text-lg font-black text-slate-800 font-mono">
                    18.5 min / parada
                  </span>
                </div>

                {/* Rating */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Avaliação Clientes</span>
                  <span className="text-lg font-black text-slate-800 font-mono">
                    ★ 4.98 / 5.0
                  </span>
                </div>

              </div>
            </div>

            {/* PWA INSTALLATION BANNER IN DRIVER VIEW FOOTER */}
            <PwaInstallBanner logoUrl={activeHub?.logoUrl} className="mt-4" />

          </div>
        )}

      {/* Signature Canvas Modal for Rider App */}
      <SignatureCanvasModal
        isOpen={isDriverSignatureModalOpen}
        onClose={() => setIsDriverSignatureModalOpen(false)}
        order={selectedOrder}
        onSaveSignature={(signatureDataUrl, recName, recDoc) => {
          setSignatureImage(signatureDataUrl);
          setSignatureMode('draw');
          if (recName) {
            const formatted = recDoc ? `${recName} (Doc: ${recDoc})` : recName;
            setReceiverName(formatted);
          }
          setIsDriverSignatureModalOpen(false);
        }}
      />

      {/* Driver App Download & Installation Modal */}
      <DriverAppInstallerModal
        isOpen={isInstallerModalOpen}
        onClose={() => setIsInstallerModalOpen(false)}
        riders={riders}
        selectedRiderId={selectedRiderId}
        onSelectRider={(id) => setSelectedRiderId(id)}
        activeHub={activeHub}
      />

      {/* PWA Direct Installation & Visual Guide Modal */}
      <AnimatePresence>
        {showPwaGuideModal && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-slate-800 space-y-5 relative my-auto"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowPwaGuideModal(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>

              {/* Logo & Header */}
              <div className="text-center space-y-2 pt-1">
                <div className="w-16 h-16 rounded-2xl mx-auto shadow-lg border-2 border-emerald-500/30 overflow-hidden bg-slate-900 flex items-center justify-center p-0.5 relative">
                  <img 
                    src={effectiveLogo} 
                    alt="Vinimap Logo" 
                    className="w-full h-full object-cover rounded-xl" 
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = vinimapLogo;
                    }}
                  />
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white border-2 border-white text-[10px]">
                    <Check size={12} />
                  </span>
                </div>
                <div>
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black uppercase tracking-wider">
                    Aplicativo Oficial de Campo (PWA)
                  </span>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight mt-1">
                    Instalar Vinimap Condutor
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Fixe o atalho oficial na tela inicial do seu celular para acesso direto e modo offline.
                  </p>
                </div>
              </div>

              {/* WhatsApp Webview Notice (if opened inside WhatsApp) */}
              {typeof navigator !== 'undefined' && /WhatsApp/i.test(navigator.userAgent) && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl space-y-1.5 shadow-sm">
                  <div className="flex items-center gap-1.5 font-black text-amber-900 text-xs uppercase tracking-wide">
                    <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                    <span>Navegador do WhatsApp Detectado</span>
                  </div>
                  <p className="text-[11px] text-amber-800 font-medium leading-relaxed m-0">
                    O WhatsApp impede a instalação automática de aplicativos. Toque no menu <strong>(⋮)</strong> no canto superior do WhatsApp e escolha <strong>"Abrir no Chrome"</strong> ou <strong>"Abrir no Safari"</strong> para instalar o ícone oficial na tela do celular.
                  </p>
                </div>
              )}

              {/* Native Prompt Triggered or Status Banner */}
              <div className="p-3.5 bg-slate-900 text-white rounded-2xl space-y-1.5 shadow-md border border-slate-800">
                <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs">
                  <Sparkles size={16} className="animate-spin" />
                  <span>Aplicativo Web PWA Pronto para Instalação!</span>
                </div>
                <p className="text-[11px] text-slate-300 font-medium leading-relaxed m-0">
                  {isAppInstalled ? 
                    'O aplicativo Vinimap Condutor já está instalado e ativo no seu dispositivo.' : 
                    'Este é um aplicativo PWA oficial. Ele instala o ícone direto na Tela de Início do celular sem precisar baixar arquivo de loja (.APK).'}
                </p>
              </div>

              {/* Step by Step Guide per Operating System */}
              <div className="space-y-3">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                  Como Criar o Atalho na Tela do Celular:
                </span>

                {/* Android Chrome */}
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-2 font-black text-xs text-slate-800">
                    <span className="w-5 h-5 rounded-lg bg-emerald-600 text-white text-[10px] flex items-center justify-center font-extrabold">A</span>
                    <span>No Android (Google Chrome)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium leading-relaxed m-0">
                    1. Toque no menu de três pontos <strong>(⋮)</strong> no canto superior do Chrome.<br />
                    2. Selecione a opção <strong>"Adicionar à tela inicial"</strong> ou <strong>"Instalar aplicativo"</strong>.<br />
                    3. Confirme e o ícone oficial aparecerá na sua tela de aplicativos.
                  </p>
                </div>

                {/* iPhone Safari */}
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-2 font-black text-xs text-slate-800">
                    <span className="w-5 h-5 rounded-lg bg-blue-600 text-white text-[10px] flex items-center justify-center font-black">i</span>
                    <span>No iPhone / iPad (Safari)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium leading-relaxed m-0">
                    1. Toque no botão de Compartilhar <strong>(Compartilhar)</strong> na barra inferior do Safari.<br />
                    2. Role para baixo e selecione <strong>"Adicionar à Tela de Início"</strong>.<br />
                    3. Toque em <strong>"Adicionar"</strong> no canto superior direito.
                  </p>
                </div>
              </div>

              {/* Direct Action Buttons */}
              <div className="space-y-2 pt-1">
                {deferredPrompt && (
                  <button
                    type="button"
                    onClick={() => {
                      deferredPrompt.prompt();
                      deferredPrompt.userChoice.then((choice: any) => {
                        if (choice.outcome === 'accepted') {
                          setIsAppInstalled(true);
                          triggerPhoneNotification("App Instalado!", "O atalho da Vinimap foi adicionado à sua tela inicial.", "success");
                        }
                        setDeferredPrompt(null);
                      });
                    }}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider"
                  >
                    <Download size={16} className="animate-bounce" />
                    <span>Confirmar Instalação no Navegador</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const url = getDriverAppInstallUrl(selectedRider?.id);
                    navigator.clipboard.writeText(url);
                    triggerPhoneNotification("Link Copiado!", "Cole no navegador do seu celular para instalar.", "success");
                  }}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 border border-slate-200"
                >
                  <ExternalLink size={14} />
                  <span>Copiar Link de Acesso do Condutor</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPwaGuideModal(false)}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Entendi! Acessar Aplicativo Agora</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      </div>
    </div>
  );
}
