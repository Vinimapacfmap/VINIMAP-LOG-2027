/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  INITIAL_RIDERS, 
  INITIAL_ORDERS, 
  INITIAL_LOGS, 
  CHART_DATA, 
  REGION_DISTRIBUTIONS 
} from './data/mock';
import { Order, OrderStatus, DeliveryRider, ActivityLog, ClientPartner, OrderHistoryEntry, isMatchingClientCode, CepRange, CepTableHistoryItem, CompanyHub, BillingModelType } from './types';
import { getSaoPauloTime, getSaoPauloDate, getSaoPauloDateTimeShort, formatToBrazilianDate, getSaoPauloISODate, isOrderInDatePeriod, formatOrderTime } from './utils/dateUtils';
import { getPartnerDisplayName } from './utils/partnerUtils';
import { generateStaticSvgMap, geocodeAddressBackend, convertToGeoLat, convertToGeoLng } from './utils/locationUtils';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import KPISection from './components/KPISection';
import ChartsSection from './components/ChartsSection';
import MapContainer from './components/MapContainer';
import OrdersTable from './components/OrdersTable';
import RidersList from './components/RidersList';
import ActivityFeed from './components/ActivityFeed';
import NewOrderModal from './components/NewOrderModal';
import GlobalFilters from './components/GlobalFilters';
import ImportSpreadsheet from './components/ImportSpreadsheet';
import AdvancedReports from './components/AdvancedReports';
import AlocarPedido from './components/AlocarPedido';
import { DriverBillingModal } from './components/DriverBillingModal';
import { ClientBillingModal } from './components/ClientBillingModal';
import { ContasPagarReceber } from './components/ContasPagarReceber';
import LiveHealthScore from './components/LiveHealthScore';
import RiderTrackingView from './components/RiderTrackingView';
import CepRangesModal from './components/CepRangesModal';
import FreightTableImportManager from './components/FreightTableImportManager';
import DailyNotebook from './components/DailyNotebook';
import OtimizadorRotasInteligente from './components/OtimizadorRotasInteligente';
import HubRegistration from './components/HubRegistration';
import LogoHubManager from './components/LogoHubManager';
import { calculateRiderCommissionForOrder } from './utils/billingUtils';
import RiderAppSimulator from './components/RiderAppSimulator';
import VolumeCalculator from './components/VolumeCalculator';
import SupabasePanel from './components/SupabasePanel';
import { DiagnosticUtility } from './components/DiagnosticUtility';
import GithubPanel from './components/GithubPanel';
import DataMassManager from './components/DataMassManager';
import { RevenueByPartnerChart } from './components/RevenueByPartnerChart';
import { INITIAL_FINANCIAL_TRANSACTIONS } from './data/financialMock';
import { AdminLogin } from './components/AdminLogin';
import { supabase, isSupabaseConfigured } from './supabase';
import { fetchAllStateFromSupabase } from './lib/supabaseService';
import { FinancialTransaction } from './types';

import { onSnapshot, collection } from 'firebase/firestore';
import { db } from './firebase';
import {
  seedInitialDataIfEmpty,
  INITIAL_CLIENT_PARTNERS,
  MOCK_CLIENT_IDS,
  dbPurgeMockClientPartners,
  dbSaveOrder,
  dbDeleteOrder,
  dbBulkSaveOrders,
  dbBulkDeleteOrders,
  dbSaveClientPartner,
  dbDeleteClientPartner,
  dbSaveDeliveryRider,
  dbDeleteDeliveryRider,
  dbAddActivityLog,
  dbBulkSaveActivityLogs,
  dbSaveFinancialTransaction,
  dbDeleteFinancialTransaction,
  dbResetToDemoState,
  handleFirestoreError,
  OperationType,
  dbSaveCompanyHub,
  dbDeleteCompanyHub,
  INITIAL_COMPANY_HUBS,
  dbApplyLoadedState,
  getIsFirestoreQuotaExceeded
} from './lib/dbService';

import { 
  Sparkles, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  CheckCircle2, 
  MapPin, 
  Coins, 
  Users, 
  LineChart, 
  Settings,
  Zap,
  RotateCcw,
  AlertTriangle,
  Download,
  FileText,
  FileSpreadsheet,
  ChevronDown,
  ShieldCheck,
  Truck,
  BarChart3,
  DollarSign,
  Plus,
  Building2,
  Image as ImageIcon,
  UserPlus,
  Phone,
  Search,
  X,
  Trash2,
  Battery,
  Wallet,
  Smartphone,
  Pencil,
  Compass,
  QrCode,
  Share2,
  Copy,
  Check,
  MessageCircle,
  MonitorPlay,
  Database,
  BellRing,
  Bell,
  BellOff,
  MessageSquare,
  ExternalLink,
  GitBranch
} from 'lucide-react';
import NotificationSettingsManager from './components/NotificationSettingsManager';
import { 
  getNotificationSettings, 
  replaceNotificationPlaceholders, 
  getOrderContactInfo, 
  generateWhatsappUrl 
} from './utils/notificationUtils';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

let logCounter = 0;
const generateUniqueLogId = (prefix: string = 'log') => {
  logCounter += 1;
  return `${prefix}-${Date.now()}-${logCounter}-${Math.random().toString(36).substring(2, 7)}`;
};

export default function App() {
  // Admin Auth State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const loggedOut = localStorage.getItem('vinimap_logged_out');
      if (loggedOut === 'true') return false;
      const localSession = localStorage.getItem('vinimap_admin_session');
      if (localSession === 'true') return true;
    }
    return !isSupabaseConfigured;
  });
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    const loggedOut = localStorage.getItem('vinimap_logged_out');
    if (loggedOut === 'true') {
      setIsAdminAuthenticated(false);
      setAuthChecking(false);
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setAuthChecking(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      const isOut = localStorage.getItem('vinimap_logged_out') === 'true';
      if (isOut) {
        setIsAdminAuthenticated(false);
      } else {
        setIsAdminAuthenticated(!!session);
      }
      setAuthChecking(false);
    });

    const authListener = supabase.auth.onAuthStateChange((_event, session) => {
      const isOut = localStorage.getItem('vinimap_logged_out') === 'true';
      if (_event === 'SIGNED_OUT' || isOut) {
        setIsAdminAuthenticated(false);
      } else if (session) {
        localStorage.removeItem('vinimap_logged_out');
        localStorage.setItem('vinimap_admin_session', 'true');
        setIsAdminAuthenticated(true);
      }
    });

    return () => {
      if (authListener && authListener.data && authListener.data.subscription) {
        authListener.data.subscription.unsubscribe();
      }
    };
  }, []);

  const handleLogout = async () => {
    localStorage.setItem('vinimap_logged_out', 'true');
    localStorage.removeItem('vinimap_admin_session');
    setIsAdminAuthenticated(false);
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn("Logout exception:", err);
      }
    }
  };

  const [activeSection, setActiveSection] = useState('dashboard');
  const [isPhoneSimulatorOpen, setIsPhoneSimulatorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [activeOrderTab, setActiveOrderTab] = useState<'Todos' | OrderStatus>('Todos');

  const getTodayDateString = () => {
    return getSaoPauloISODate();
  };

  const getRelativeDateString = (daysOffset: number) => {
    const spIso = getSaoPauloISODate();
    const [y, m, dayVal] = spIso.split('-').map(Number);
    const dateObj = new Date(y, m - 1, dayVal);
    dateObj.setDate(dateObj.getDate() - daysOffset);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getPortugueseMonthName = () => {
    try {
      const spIso = getSaoPauloISODate(); // YYYY-MM-DD
      if (spIso && typeof spIso === 'string' && spIso.includes('-')) {
        const parts = spIso.split('-');
        const monthNum = parseInt(parts[1], 10);
        const months = [
          'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        return months[monthNum - 1] || '';
      }
    } catch (e) {
      console.error("Error in getPortugueseMonthName:", e);
    }
    return '';
  };

  const todayStr = getTodayDateString();

  // Core App states with real-time Firebase integration
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<DeliveryRider[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);

  // Standalone Rider App states
  const [isStandaloneRider, setIsStandaloneRider] = useState(false);
  const [isRealDeviceMode, setIsRealDeviceMode] = useState(false);
  const [installMode, setInstallMode] = useState<'real' | 'simulador'>('real');
  const [selectedRiderForInstallId, setSelectedRiderForInstallId] = useState<string | null>(null);
  const [copiedInstallLink, setCopiedInstallLink] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isPwaDisplay = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    const urlRiderId = params.get('riderId');
    const storedRiderId = localStorage.getItem('vinimap_driver_id');

    if (urlRiderId) {
      localStorage.setItem('vinimap_driver_id', urlRiderId);
      localStorage.setItem('vinimap_is_driver_app', 'true');
    }

    const isDriverApp = 
      isPwaDisplay ||
      localStorage.getItem('vinimap_is_driver_app') === 'true' ||
      params.get('view') === 'rider' ||
      params.get('view') === 'driver_mobile' ||
      params.get('mode') === 'rider' ||
      Boolean(urlRiderId) ||
      params.get('mobile') === '1';

    if (isDriverApp) {
      setIsStandaloneRider(true);
      setIsRealDeviceMode(true);
      setActiveSection('dispositivo_condutor');
      
      const effectiveRiderId = urlRiderId || storedRiderId;
      if (effectiveRiderId) {
        setSelectedRiderId(effectiveRiderId);
      }
    }
  }, []);

  // Admin panel states
  const [adminTab, setAdminTab] = useState<'financeiro' | 'relatorios' | 'clientes' | 'condutores' | 'supabase' | 'github' | 'sede' | 'logo_sede' | 'notificacoes'>('financeiro');
  const [completionNotificationToast, setCompletionNotificationToast] = useState<{
    orderId: string;
    clientName: string;
    phone: string;
    email: string;
    waUrl?: string;
    waText?: string;
    emailSubject?: string;
    emailBody?: string;
  } | null>(null);
  const [financialTransactions, setFinancialTransactions] = useState<FinancialTransaction[]>([]);

  const [financeSubTab, setFinanceSubTab] = useState<'repasses' | 'contas'>('contas');
  const [searchClientQuery, setSearchClientQuery] = useState('');
  const [searchRiderQuery, setSearchRiderQuery] = useState('');
  const [unifiedQueryCep, setUnifiedQueryCep] = useState('');
  const [billingModalRiderId, setBillingModalRiderId] = useState<string | null>(null);
  const [billingModalClientId, setBillingModalClientId] = useState<string | null>(null);
  const [selectedClientType, setSelectedClientType] = useState<'Todos' | 'Cliente' | 'Parceiro'>('Todos');
  
  const [isCepRangesModalOpen, setIsCepRangesModalOpen] = useState(false);
  const [selectedCepRangesClient, setSelectedCepRangesClient] = useState<ClientPartner | null>(null);

  const [clientPartners, setClientPartners] = useState<ClientPartner[]>([]);
  const [companyHubs, setCompanyHubs] = useState<CompanyHub[]>(INITIAL_COMPANY_HUBS);

  // ---------------------------------------------------------------------------
  // CONTINGENCY AUTO-BACKUP & FORCED JSON DOWNLOAD SYSTEM
  // ---------------------------------------------------------------------------
  const [lastContingencyBackupTime, setLastContingencyBackupTime] = useState<string>(() => {
    return localStorage.getItem('vinimap_last_contingency_time') || '';
  });

  const exportDatabaseContingency = useCallback((isAuto: boolean = false) => {
    const dateToday = getSaoPauloISODate();
    const timeNow = getSaoPauloTime();
    const fullStamp = `${dateToday} ${timeNow}`;

    const snapshot = {
      exportType: 'CONTINGENCIA_BANCO_DADOS_PRINCIPAL',
      date: dateToday,
      timestamp: new Date().toISOString(),
      system: 'ViniMap Logistics OS',
      version: '1.5.0',
      summary: {
        totalOrders: orders.length,
        totalPartners: clientPartners.length,
        totalRiders: riders.length,
        totalTransactions: financialTransactions.length,
      },
      orders,
      clientPartners,
      deliveryRiders: riders,
      financialTransactions,
      companyHubs,
    };

    const jsonString = JSON.stringify(snapshot, null, 2);

    // 1. Save to LocalStorage for instant local contingency recovery
    try {
      localStorage.setItem('vinimap_contingency_backup_latest', jsonString);
      localStorage.setItem(`vinimap_contingency_backup_${dateToday}`, jsonString);
      localStorage.setItem('vinimap_last_contingency_time', fullStamp);
      localStorage.setItem('vinimap_last_contingency_download_date', dateToday);
    } catch (err) {
      console.warn('Erro ao salvar backup de contingência no localStorage:', err);
    }

    // 2. Trigger forced browser JSON download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = `vinimap_contingencia_pedidos_parceiros_${dateToday}.json`;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);

    setLastContingencyBackupTime(fullStamp);
    if (!isAuto) {
      alert(`✅ Contingência Exportada com Sucesso!\n\n• ${orders.length} pedidos\n• ${clientPartners.length} parceiros\n\nO arquivo JSON foi baixado para o seu computador e armazenado no armazenamento local do navegador.`);
    }
  }, [orders, clientPartners, riders, financialTransactions, companyHubs]);

  // Effect A: Auto-save continuous local storage backup whenever orders or partners change
  useEffect(() => {
    if (orders.length === 0 && clientPartners.length === 0) return;

    const timer = setTimeout(() => {
      const dateToday = getSaoPauloISODate();
      const timeNow = getSaoPauloTime();
      const snapshot = {
        exportType: 'CONTINGENCIA_LOCAL_STORAGE_CONTINUA',
        date: dateToday,
        timestamp: new Date().toISOString(),
        summary: {
          totalOrders: orders.length,
          totalPartners: clientPartners.length,
        },
        orders,
        clientPartners,
        deliveryRiders: riders,
        financialTransactions,
        companyHubs,
      };
      try {
        localStorage.setItem('vinimap_contingency_backup_latest', JSON.stringify(snapshot));
        localStorage.setItem('vinimap_last_contingency_time', `${dateToday} ${timeNow}`);
        setLastContingencyBackupTime(`${dateToday} ${timeNow}`);
      } catch (err) {
        console.warn('LocalStorage auto-backup overflow or error:', err);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [orders, clientPartners, riders, financialTransactions, companyHubs]);

  // Effect B: End-of-Day Automatic Contingency Check (>= 18h or when date changes)
  useEffect(() => {
    const checkEndOfDayContingency = () => {
      if (orders.length === 0 && clientPartners.length === 0) return;

      const dateToday = getSaoPauloISODate();
      const lastDownloadDate = localStorage.getItem('vinimap_last_contingency_download_date');

      // Check current hour
      const now = new Date();
      const currentHour = now.getHours();

      // If hour is 18 (6 PM) or later and today's auto-download hasn't run yet
      if (currentHour >= 18 && lastDownloadDate !== dateToday) {
        console.log('[Contingency] Fim de dia operacional detectado. Executando download automático de contingência...');
        exportDatabaseContingency(true);
      }
    };

    const timeout = setTimeout(checkEndOfDayContingency, 5000);
    const interval = setInterval(checkEndOfDayContingency, 10 * 60 * 1000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [orders, clientPartners, exportDatabaseContingency]);

  // Effect C: Window unload safeguard
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (orders.length > 0 || clientPartners.length > 0) {
        const dateToday = getSaoPauloISODate();
        const timeNow = getSaoPauloTime();
        const snapshot = {
          exportType: 'CONTINGENCIA_BEFORE_UNLOAD',
          date: dateToday,
          timestamp: new Date().toISOString(),
          orders,
          clientPartners,
          deliveryRiders: riders,
          financialTransactions,
          companyHubs,
        };
        try {
          localStorage.setItem('vinimap_contingency_backup_latest', JSON.stringify(snapshot));
          localStorage.setItem('vinimap_last_contingency_time', `${dateToday} ${timeNow}`);
        } catch (e) {
          // ignore quota error on unload
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [orders, clientPartners, riders, financialTransactions, companyHubs]);

  // Global listener registry for aggressive Firestore snapshot cleanup
  const listenerCleanupRegistry = useRef<Set<() => void>>(new Set());

  const registerSnapshotListener = useCallback((unsub: () => void): (() => void) => {
    listenerCleanupRegistry.current.add(unsub);
    return () => {
      try {
        unsub();
      } catch (err) {
        console.warn('Error during onSnapshot listener unsubscribe:', err);
      } finally {
        listenerCleanupRegistry.current.delete(unsub);
      }
    };
  }, []);

  const cleanupAllFirestoreListeners = useCallback(() => {
    const activeListeners = Array.from(listenerCleanupRegistry.current);
    activeListeners.forEach((unsub: () => void) => {
      try {
        if (typeof unsub === 'function') {
          unsub();
        }
      } catch (err) {
        console.warn('Error cleaning up active listener on context switch:', err);
      }
    });
    listenerCleanupRegistry.current.clear();
  }, []);

  // Synchronize with Firestore / Supabase / Local Storage
  useEffect(() => {
    let isCancelled = false;

    const loadFallbackData = async () => {
      if (isCancelled) return;
      // 1. Try loading from Supabase if configured
      if (isSupabaseConfigured) {
        try {
          const sbState = await fetchAllStateFromSupabase();
          if (isCancelled) return;
          if (sbState.orders && sbState.orders.length > 0) setOrders(sbState.orders);
          if (sbState.clients && sbState.clients.length > 0) {
            setClientPartners(sbState.clients.filter((c: ClientPartner) => !MOCK_CLIENT_IDS.includes(c.id)));
          }
          if (sbState.riders && sbState.riders.length > 0) setRiders(sbState.riders);
          if (sbState.logs && sbState.logs.length > 0) setLogs(sbState.logs);
          if (sbState.txs && sbState.txs.length > 0) setFinancialTransactions(sbState.txs);
          if (sbState.hubs && sbState.hubs.length > 0) setCompanyHubs(sbState.hubs);
          console.log('[Supabase Sync] Dados carregados do Supabase com sucesso.');
          return;
        } catch (e) {
          console.warn('Could not load fallback state from Supabase:', e);
        }
      }

      // 2. Try loading from Local Storage contingency backup
      try {
        const storedBackup = localStorage.getItem('vinimap_contingency_backup_latest');
        if (storedBackup) {
          const parsed = JSON.parse(storedBackup);
          if (isCancelled) return;
          if (parsed.orders && parsed.orders.length > 0) setOrders(parsed.orders);
          if (parsed.clientPartners && parsed.clientPartners.length > 0) {
            setClientPartners(parsed.clientPartners.filter((c: ClientPartner) => !MOCK_CLIENT_IDS.includes(c.id)));
          }
          if (parsed.deliveryRiders && parsed.deliveryRiders.length > 0) setRiders(parsed.deliveryRiders);
          if (parsed.financialTransactions && parsed.financialTransactions.length > 0) setFinancialTransactions(parsed.financialTransactions);
          if (parsed.companyHubs && parsed.companyHubs.length > 0) setCompanyHubs(parsed.companyHubs);
          console.log('[Local Storage Contingency] Dados de contingência locais restaurados.');
          return;
        }
      } catch (e) {
        console.warn('Could not load localStorage contingency backup:', e);
      }

      // 3. Fallback to initial mock data if React state is empty
      if (isCancelled) return;
      setOrders(prev => prev.length === 0 ? INITIAL_ORDERS : prev);
      setClientPartners(prev => prev.filter(c => !MOCK_CLIENT_IDS.includes(c.id)));
      setRiders(prev => prev.length === 0 ? INITIAL_RIDERS : prev);
      setLogs(prev => prev.length === 0 ? INITIAL_LOGS : prev);
      setFinancialTransactions(prev => prev.length === 0 ? INITIAL_FINANCIAL_TRANSACTIONS : prev);
      setCompanyHubs(prev => prev.length === 0 ? INITIAL_COMPANY_HUBS : prev);
    };

    // Auto purge mock client partners if any exist in remote database
    dbPurgeMockClientPartners().catch(() => {});

    // 1. Ensure any stale or previous listeners are actively cleaned up
    cleanupAllFirestoreListeners();

    // 2. If quota is already known to be exceeded, skip Firestore listeners and load fallback
    if (getIsFirestoreQuotaExceeded()) {
      console.warn('Quota diária do Firestore atingida. Alternando automaticamente para modo Supabase e Local.');
      loadFallbackData();
      return () => { isCancelled = true; };
    }

    // 3. Seed if empty
    seedInitialDataIfEmpty(orders).then(() => {
      if (isCancelled) return;
      if (getIsFirestoreQuotaExceeded()) {
        console.warn('Quota do Firestore excedida durante inicialização. Alternando para dados locais / Supabase.');
        cleanupAllFirestoreListeners();
        loadFallbackData();
      }
    });

    const handleListenerError = (error: unknown, collectionName: string) => {
      handleFirestoreError(error, OperationType.GET, collectionName);
      if (getIsFirestoreQuotaExceeded()) {
        cleanupAllFirestoreListeners();
      }
      loadFallbackData();
    };

    // 4. Setup real-time listeners with registered tracking wrappers
    const unsubOrders = registerSnapshotListener(
      onSnapshot(collection(db, 'orders'), (snapshot) => {
        const docs: Order[] = [];
        snapshot.forEach(doc => {
          docs.push(doc.data() as Order);
        });
        setOrders(docs);
      }, (error) => handleListenerError(error, 'orders'))
    );

    const unsubClients = registerSnapshotListener(
      onSnapshot(collection(db, 'clientPartners'), (snapshot) => {
        const docs: ClientPartner[] = [];
        snapshot.forEach(doc => {
          const data = doc.data() as ClientPartner;
          if (!MOCK_CLIENT_IDS.includes(data.id)) {
            docs.push(data);
          }
        });
        setClientPartners(docs);
      }, (error) => handleListenerError(error, 'clientPartners'))
    );

    const unsubRiders = registerSnapshotListener(
      onSnapshot(collection(db, 'deliveryRiders'), (snapshot) => {
        const docs: DeliveryRider[] = [];
        snapshot.forEach(doc => {
          docs.push(doc.data() as DeliveryRider);
        });
        setRiders(docs);
      }, (error) => handleListenerError(error, 'deliveryRiders'))
    );

    const unsubLogs = registerSnapshotListener(
      onSnapshot(collection(db, 'activityLogs'), (snapshot) => {
        const docs: ActivityLog[] = [];
        snapshot.forEach(doc => {
          docs.push(doc.data() as ActivityLog);
        });
        docs.sort((a, b) => b.time.localeCompare(a.time));
        setLogs(docs);
      }, (error) => handleListenerError(error, 'activityLogs'))
    );

    const unsubTxs = registerSnapshotListener(
      onSnapshot(collection(db, 'financialTransactions'), (snapshot) => {
        const docs: FinancialTransaction[] = [];
        snapshot.forEach(doc => {
          docs.push(doc.data() as FinancialTransaction);
        });
        setFinancialTransactions(docs);
      }, (error) => handleListenerError(error, 'financialTransactions'))
    );

    const unsubHubs = registerSnapshotListener(
      onSnapshot(collection(db, 'companyHubs'), (snapshot) => {
        const docs: CompanyHub[] = [];
        snapshot.forEach(doc => {
          const h = doc.data() as CompanyHub;
          if (h && (!h.lat || Math.abs(h.lat - (-23.541023)) < 0.01 || Math.abs(h.lat - (-23.54388)) < 0.01)) {
            h.lat = -23.5385556;
            h.lng = -46.70118;
            if (h.address?.includes('Cerro Corá') || h.cep === '05061-050') {
              h.address = 'Rua Cerro Corá, 385, Vila Romana';
              h.cep = '05061-050';
            }
          }
          docs.push(h);
        });
        if (docs.length > 0) {
          setCompanyHubs(docs);
          const active = docs.find(h => h.active) || docs[0];
          if (active) {
            try {
              localStorage.setItem('vinimap_active_hub', JSON.stringify(active));
            } catch (e) {
              console.warn('Error saving active hub to localStorage:', e);
            }
          }
        }
      }, (error) => handleListenerError(error, 'companyHubs'))
    );

    const handleUnloadOrHide = () => {
      cleanupAllFirestoreListeners();
    };

    window.addEventListener('beforeunload', handleUnloadOrHide);
    window.addEventListener('pagehide', handleUnloadOrHide);

    return () => {
      isCancelled = true;
      window.removeEventListener('beforeunload', handleUnloadOrHide);
      window.removeEventListener('pagehide', handleUnloadOrHide);
      unsubOrders();
      unsubClients();
      unsubRiders();
      unsubLogs();
      unsubTxs();
      unsubHubs();
      cleanupAllFirestoreListeners();
    };
  }, [registerSnapshotListener, cleanupAllFirestoreListeners]);

  const handleSaveCepRanges = async (clientId: string, ranges: CepRange[], history?: CepTableHistoryItem[]) => {
    try {
      const cp = clientPartners.find(c => c.id === clientId);
      if (!cp) return;
      const updatedClient: ClientPartner = { 
        ...cp, 
        cepRanges: ranges,
        cepRangesHistory: history !== undefined ? history : cp.cepRangesHistory
      };
      
      // Update local state immediately for instant UI responsiveness
      setClientPartners(prev => prev.map(c => c.id === clientId ? updatedClient : c));
      if (selectedCepRangesClient?.id === clientId) {
        setSelectedCepRangesClient(updatedClient);
      }

      await dbSaveClientPartner(updatedClient);
      
      try {
        await handleRecalculateOrdersFreight(clientId, ranges);
      } catch (recalcErr) {
        console.warn('Erro ao recalcular frete dos pedidos:', recalcErr);
      }

      await dbAddActivityLog({
        id: `log-${Date.now()}`,
        time: getSaoPauloDateTimeShort(),
        message: `Tabela de CEP do cliente "${cp.name}" atualizada com sucesso (${ranges.length} faixas).`,
        type: 'success'
      }).catch(err => console.warn('Erro ao salvar log de atividade:', err));

    } catch (err: any) {
      console.error('Erro ao salvar faixas de CEP:', err);
      alert('Erro ao salvar tabela de CEP: ' + (err.message || err));
    }
  };

  const handleBulkSaveClientCepRanges = async (clientRangesMap: Record<string, { ranges: CepRange[]; history?: CepTableHistoryItem[] }>) => {
    try {
      const updatedClients: ClientPartner[] = [];
      setClientPartners(prev => prev.map(cp => {
        if (clientRangesMap[cp.id]) {
          const { ranges, history } = clientRangesMap[cp.id];
          const updated: ClientPartner = {
            ...cp,
            cepRanges: ranges,
            cepRangesHistory: history !== undefined ? history : cp.cepRangesHistory
          };
          updatedClients.push(updated);
          return updated;
        }
        return cp;
      }));

      for (const client of updatedClients) {
        await dbSaveClientPartner(client).catch(err => console.warn('Erro ao salvar cliente no bulk:', err));
      }

      await dbAddActivityLog({
        id: `log-bulk-${Date.now()}`,
        time: getSaoPauloDateTimeShort(),
        message: `Importação em lote de tabela de frete aplicada para ${updatedClients.length} clientes.`,
        type: 'success'
      }).catch(() => {});
    } catch (err) {
      console.error('Erro ao salvar lote de tabelas de frete:', err);
    }
  };

  const handleSaveCompanyHub = async (hub: CompanyHub) => {
    try {
      if (hub.active) {
        const otherActiveHubs = companyHubs.filter(h => h.id !== hub.id && h.active);
        for (const other of otherActiveHubs) {
          await dbSaveCompanyHub({ ...other, active: false });
        }
        try {
          localStorage.setItem('vinimap_active_hub', JSON.stringify(hub));
        } catch (e) {}
      }
      await dbSaveCompanyHub(hub);
      
      const logId = `log-${Date.now()}`;
      await dbAddActivityLog({
        id: logId,
        time: getSaoPauloDateTimeShort(),
        message: `Sede "${hub.name}" (Lat: ${hub.lat.toFixed(6)}, Lng: ${hub.lng.toFixed(6)}) salva e sincronizada em todo o sistema.`,
        type: 'success'
      });
    } catch (err) {
      console.error('Error saving company hub:', err);
    }
  };

  const handleDeleteCompanyHub = async (hubId: string) => {
    try {
      const hubToDelete = companyHubs.find(h => h.id === hubId);
      if (!hubToDelete) return;
      await dbDeleteCompanyHub(hubId);
      
      const logId = `log-${Date.now()}`;
      await dbAddActivityLog({
        id: logId,
        time: getSaoPauloDateTimeShort(),
        message: `Sede "${hubToDelete.name}" foi excluída do sistema.`,
        type: 'danger'
      });

      if (hubToDelete.active) {
        const remaining = companyHubs.filter(h => h.id !== hubId);
        if (remaining.length > 0) {
          const newActive = { ...remaining[0], active: true };
          await dbSaveCompanyHub(newActive);
          try {
            localStorage.setItem('vinimap_active_hub', JSON.stringify(newActive));
          } catch (e) {}
        }
      }
    } catch (err) {
      console.error('Error deleting company hub:', err);
    }
  };

  const handleSetActiveCompanyHub = async (hubId: string) => {
    try {
      for (const h of companyHubs) {
        const isTarget = h.id === hubId;
        if (h.active !== isTarget) {
          await dbSaveCompanyHub({ ...h, active: isTarget });
        }
      }
      
      const targetHub = companyHubs.find(h => h.id === hubId);
      if (targetHub) {
        try {
          localStorage.setItem('vinimap_active_hub', JSON.stringify({ ...targetHub, active: true }));
        } catch (e) {}
        const logId = `log-${Date.now()}`;
        await dbAddActivityLog({
          id: logId,
          time: getSaoPauloDateTimeShort(),
          message: `Sede ativa alterada para "${targetHub.name}" (Lat: ${targetHub.lat.toFixed(6)}, Lng: ${targetHub.lng.toFixed(6)}).`,
          type: 'info'
        });
      }
    } catch (err) {
      console.error('Error setting active company hub:', err);
    }
  };

  const getOrderFreightValue = (order: Order, partners: ClientPartner[]): number => {
    if (!order) return 10;
    
    // Clean and validate order CEP
    let orderCepClean = (order.cep || '').replace(/\D/g, '');
    if (orderCepClean.length > 0 && orderCepClean.length < 8) {
      orderCepClean = orderCepClean.padStart(8, '0');
    }

    if (partners && partners.length > 0) {
      // Find matching client partner using standard robust code matching helper
      const cp = partners.find(c => isMatchingClientCode(order.partnerName, c.id, c.codigoCliente));

      if (cp && cp.cepRanges && cp.cepRanges.length > 0) {
        if (orderCepClean.length === 8) {
          const orderCepNum = parseInt(orderCepClean, 10);

          // Find order date (YYYY-MM-DD)
          let orderDate = '';
          if (order.date && /^\d{4}-\d{2}-\d{2}$/.test(order.date)) {
            orderDate = order.date;
          } else if (order.createdAt) {
            const dateMatch = order.createdAt.match(/^(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) orderDate = dateMatch[1];
          }
          
          if (!orderDate) {
            try {
              const tzDate = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
              const d = new Date(tzDate);
              const yyyy = d.getFullYear();
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              orderDate = `${yyyy}-${mm}-${dd}`;
            } catch (e) {
              orderDate = new Date().toISOString().split('T')[0];
            }
          }

          // Filter ranges that match the CEP and whose validity starts on or before the order's date
          const matches = cp.cepRanges.filter(r => {
            let startClean = r.cepStart.replace(/\D/g, '');
            let endClean = r.cepEnd.replace(/\D/g, '');
            if (startClean.length > 0 && startClean.length < 8) startClean = startClean.padStart(8, '0');
            if (endClean.length > 0 && endClean.length < 8) endClean = endClean.padStart(8, '0');

            const startNum = parseInt(startClean, 10);
            const endNum = parseInt(endClean, 10);
            const inCepRange = orderCepNum >= startNum && orderCepNum <= endNum;
            if (!inCepRange) return false;

            // Check effective date
            if (!r.effectiveFrom) return true; // always valid
            return orderDate >= r.effectiveFrom;
          });

          if (matches.length > 0) {
            // Sort by effectiveFrom descending (latest first). Treat empty/undefined as '0000-00-00'
            matches.sort((a, b) => {
              const dateA = a.effectiveFrom || '0000-00-00';
              const dateB = b.effectiveFrom || '0000-00-00';
              return dateB.localeCompare(dateA);
            });

            const match = matches[0];
            if (order.priority && order.priority.toLowerCase() === 'expresso') {
              if (match.expressValue !== undefined && match.expressValue !== null && !isNaN(match.expressValue)) {
                return match.expressValue;
              }
            }
            return match.value;
          }
        }
      }
    }

    // 1. If there's an explicit delivery value on the order (e.g. imported or set)
    if (order.deliveryValue !== undefined && order.deliveryValue !== null && !isNaN(order.deliveryValue)) {
      return order.deliveryValue;
    }

    // 2. Fallback to rawData spreadsheet column if present
    if (order.rawData) {
      const rawVal = order.rawData['ValorEntrega'] || order.rawData['valorentrega'];
      if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
        const parsed = parseFloat(String(rawVal).replace(',', '.'));
        if (!isNaN(parsed)) {
          return parsed;
        }
      }
    }

    return 10; // default fallback freight
  };

  const validateAndRecalculateOrderFreight = (order: Order, partners: ClientPartner[]): Order => {
    const finalFreightValue = getOrderFreightValue(order, partners);
    
    // Calculate potential driver commission
    const assignedRider = riders.find(r => r.id === order.riderId);
    const commissionResult = calculateRiderCommissionForOrder(
      assignedRider,
      { ...order, deliveryValue: finalFreightValue, status: 'Concluído' },
      partners
    );
    const finalDriverValue = order.riderId ? commissionResult.total : undefined;

    const normalizedRawData = { ...(order.rawData || {}) };
    const keys = Object.keys(normalizedRawData);
    
    const freightKey = keys.find(k => k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "") === 'valorentrega') || 'ValorEntrega';
    const driverKey = keys.find(k => k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "") === 'valorcondutor') || 'ValorCondutor';
    const cepKey = keys.find(k => k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "") === 'cep') || 'CEP';
    const condutorKey = keys.find(k => k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "") === 'dispositivocondutor') || 'DispositivoCondutor';

    normalizedRawData[freightKey] = String(finalFreightValue);
    if (finalDriverValue !== undefined) {
      normalizedRawData[driverKey] = String(finalDriverValue);
    } else {
      normalizedRawData[driverKey] = '';
    }
    if (order.cep) {
      normalizedRawData[cepKey] = order.cep;
    }
    normalizedRawData[condutorKey] = assignedRider ? assignedRider.name : 'Não vinculado';

    return {
      ...order,
      deliveryValue: finalFreightValue,
      driverValue: finalDriverValue,
      rawData: normalizedRawData
    };
  };

  const handleUpdateRiderCoords = (
    riderId: string, 
    lat: number, 
    lng: number, 
    realGeoLat?: number, 
    realGeoLng?: number, 
    gpsAccuracy?: number, 
    lastGpsUpdate?: string, 
    isGpsRealActive?: boolean
  ) => {
    setRiders(prev => prev.map(r => {
      if (r.id === riderId) {
        let syncRealLat = realGeoLat;
        let syncRealLng = realGeoLng;

        // Auto-synchronize realGeoLat and realGeoLng if not provided or if lat/lng were updated
        if (syncRealLat === undefined || syncRealLng === undefined) {
          if (lat < -10) {
            syncRealLat = lat;
            syncRealLng = lng;
          } else {
            syncRealLat = convertToGeoLat(lat);
            syncRealLng = convertToGeoLng(lng);
          }
        }

        console.log(`[GPS Telemetry Log - ${r.name || riderId}]`, {
          riderId,
          riderName: r.name,
          rawInput: { lat, lng, realGeoLat, realGeoLng },
          isNativeGeo: lat < -10,
          convertedGeo: { lat: syncRealLat, lng: syncRealLng },
          calculatedFrom: (lat < -10) ? 'Direct GPS Coordinates' : `SVG Percent Matrix -> (${convertToGeoLat(lat).toFixed(6)}, ${convertToGeoLng(lng).toFixed(6)})`,
          gpsAccuracy,
          lastGpsUpdate,
          isGpsRealActive
        });

        const updated = {
          ...r,
          lat,
          lng,
          realGeoLat: syncRealLat,
          realGeoLng: syncRealLng,
          ...(gpsAccuracy !== undefined ? { gpsAccuracy } : {}),
          ...(lastGpsUpdate !== undefined ? { lastGpsUpdate } : {}),
          ...(isGpsRealActive !== undefined ? { isGpsRealActive } : {})
        };
        dbSaveDeliveryRider(updated);
        return updated;
      }
      return r;
    }));
  };

  const handleRecalculateOrdersFreight = (clientId: string, updatedRanges: CepRange[]) => {
    const cp = clientPartners.find(c => c.id === clientId);
    if (!cp) return;

    // Update client partner with latest updatedRanges in partners list for calculation
    const updatedClientPartners = clientPartners.map(c => 
      c.id === clientId ? { ...c, cepRanges: updatedRanges } : c
    );

    // Find all pending orders belonging to this partner
    const pendingOrders = orders.filter(o => {
      const isPartnerMatch = 
        isMatchingClientCode(o.partnerName, cp.id, cp.codigoCliente) ||
        isMatchingClientCode(o.clientName, cp.id, cp.codigoCliente) ||
        (o.partnerName && cp.name && o.partnerName.toLowerCase() === cp.name.toLowerCase()) ||
        (o.clientName && cp.name && o.clientName.toLowerCase() === cp.name.toLowerCase());
      
      const isPending = o.status !== 'Concluído' && o.status !== 'Cancelado';
      return isPartnerMatch && isPending;
    });

    if (pendingOrders.length > 0) {
      // Recalculate freight for each pending order
      const recalculatedOrders = pendingOrders.map(order => 
        validateAndRecalculateOrderFreight(order, updatedClientPartners)
      );

      // Update state
      setOrders(prev => {
        const recalculatedMap = new Map(recalculatedOrders.map(o => [o.id, o]));
        return prev.map(o => recalculatedMap.get(o.id) || o);
      });

      // Persist to database
      dbBulkSaveOrders(recalculatedOrders);

      // Log success activity
      const newLog: ActivityLog = {
        id: generateUniqueLogId('log-recalc-batch'),
        time: getSaoPauloTime(),
        message: `Recálculo em lote efetuado: ${recalculatedOrders.length} pedido(s) pendente(s) do parceiro "${cp.name}" foram recalculados com a nova tabela de frete.`,
        type: 'success'
      };
      dbAddActivityLog(newLog);
    } else {
      const newLog: ActivityLog = {
        id: generateUniqueLogId('log-recalc'),
        time: getSaoPauloTime(),
        message: `Tabela de frete atualizada para o parceiro ${cp.name}. Nenhum pedido pendente foi encontrado para recálculo.`,
        type: 'info'
      };
      dbAddActivityLog(newLog);
    }
  };

  // Registration form states
  const [newClientName, setNewClientName] = useState('');
  const [newClientType, setNewClientType] = useState<'Cliente' | 'Parceiro'>('Parceiro');
  const [newClientCNPJ, setNewClientCNPJ] = useState('');
  const [newClientRegion, setNewClientRegion] = useState('Centro');
  const [newClientTel, setNewClientTel] = useState('');
  const [newClientAddr, setNewClientAddr] = useState('');
  const [newClientCep, setNewClientCep] = useState('');
  const [newClientCidade, setNewClientCidade] = useState('São Paulo');
  const [newClientEstado, setNewClientEstado] = useState('SP');
  const [newClientStatus, setNewClientStatus] = useState('Adimplente');
  const [newClientEnableNotifications, setNewClientEnableNotifications] = useState<boolean>(true);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [showClientForm, setShowClientForm] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientPartner | null>(null);

  // CEP Search integration states
  const [isCepSearching, setIsCepSearching] = useState(false);
  const [cepSearchError, setCepSearchError] = useState('');

  const handleSearchCep = async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      setCepSearchError('CEP deve conter 8 dígitos.');
      return;
    }
    setIsCepSearching(true);
    setCepSearchError('');
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (data.erro) {
        setCepSearchError('CEP não encontrado.');
      } else {
        const logradouro = data.logradouro || '';
        const bairro = data.bairro || '';
        const localidade = data.localidade || 'São Paulo';
        const uf = data.uf || 'SP';
        
        let streetAddress = '';
        if (logradouro) {
          streetAddress = logradouro;
          if (bairro) {
            streetAddress += ` - ${bairro}`;
          }
        }
        setNewClientAddr(streetAddress);
        setNewClientCidade(localidade);
        setNewClientEstado(uf);
        setNewClientCep(`${cleanCep.substring(0, 5)}-${cleanCep.substring(5)}`);
        
        // Auto-assign region for SP capital based on typical CEP zones
        if (localidade.toLowerCase() === 'são paulo') {
          const prefix = parseInt(cleanCep.substring(0, 5)) || 0;
          if (prefix >= 4000 && prefix <= 4999) setNewClientRegion('Zona Sul');
          else if (prefix >= 5000 && prefix <= 5999) setNewClientRegion('Zona Oeste');
          else if (prefix >= 2000 && prefix <= 2999) setNewClientRegion('Zona Norte');
          else if (prefix >= 3000 && prefix <= 3999) setNewClientRegion('Zona Leste');
          else setNewClientRegion('Centro');
        }
      }
    } catch (err) {
      setCepSearchError('Erro ao buscar CEP na API.');
      console.error(err);
    } finally {
      setIsCepSearching(false);
    }
  };

  const [newRiderName, setNewRiderName] = useState('');
  const [newRiderVehicle, setNewRiderVehicle] = useState('Moto');
  const [newRiderPhone, setNewRiderPhone] = useState('');
  const [newRiderDeviceNumber, setNewRiderDeviceNumber] = useState('');
  const [newRiderPassword, setNewRiderPassword] = useState('');
  const [newRiderAddress, setNewRiderAddress] = useState('');
  const [newRiderCpfCnpj, setNewRiderCpfCnpj] = useState('');
  const [newRiderVehiclePlate, setNewRiderVehiclePlate] = useState('');
  const [newRiderCnh, setNewRiderCnh] = useState('');
  const [newRiderExibirValorTurno, setNewRiderExibirValorTurno] = useState<boolean>(false);
  const [newRiderOcultarValoresProtocolos, setNewRiderOcultarValoresProtocolos] = useState<boolean>(false);
  const [newRiderAutorizarImprimirRecibo, setNewRiderAutorizarImprimirRecibo] = useState<boolean>(false);
  const [newRiderBillingModel, setNewRiderBillingModel] = useState<BillingModelType>('misto');
  const [newRiderBillingFixedFee, setNewRiderBillingFixedFee] = useState<string>('10.00');
  const [newRiderBillingVariablePercent, setNewRiderBillingVariablePercent] = useState<string>('2.5');
  const [newRiderBillingFreightPercent, setNewRiderBillingFreightPercent] = useState<string>('80');
  const [isNewRiderModalOpen, setIsNewRiderModalOpen] = useState(false);
  const [showRiderForm, setShowRiderForm] = useState(false);
  const [showRiderEarnings, setShowRiderEarnings] = useState<boolean>(true);
  const [editingRider, setEditingRider] = useState<DeliveryRider | null>(null);

  const handleCreateClientPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newClientTel || !newClientAddr) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (editingClient) {
      const updatedEntry: ClientPartner = {
        ...editingClient,
        name: newClientName,
        region: newClientRegion,
        tel: newClientTel,
        addr: newClientAddr,
        status: newClientStatus,
        cnpj: newClientCNPJ || undefined,
        cep: newClientCep || undefined,
        cidade: newClientCidade || 'São Paulo',
        estado: newClientEstado || 'SP',
        enableCompletionNotifications: newClientEnableNotifications,
      };

      try {
        await dbSaveClientPartner(updatedEntry);
        setClientPartners(prev => prev.map(c => c.id === updatedEntry.id ? updatedEntry : c));
        
        // Add activity log
        const logId = generateUniqueLogId();
        await dbAddActivityLog({
          id: logId,
          time: getSaoPauloTime(),
          type: 'info',
          message: `Cadastro de cliente editado: ${newClientName}`,
        });

        // Reset fields
        setEditingClient(null);
        setNewClientName('');
        setNewClientCNPJ('');
        setNewClientTel('');
        setNewClientAddr('');
        setNewClientCep('');
        setNewClientCidade('São Paulo');
        setNewClientEstado('SP');
        setNewClientEnableNotifications(true);
        setIsNewClientModalOpen(false);
        setShowClientForm(false);
      } catch (err: any) {
        console.error(err);
        alert(`Erro ao salvar alteração de cliente: ${err.message || err}`);
      }
      return;
    }

    let nextNum = 1;
    const cl1Ids = clientPartners
      .map(cp => cp.id)
      .filter(id => id && id.startsWith('CL1-'));
    if (cl1Ids.length > 0) {
      const numbers = cl1Ids.map(id => {
        const parts = id.split('-');
        return parts.length > 1 ? parseInt(parts[1], 10) : 0;
      });
      nextNum = Math.max(...numbers) + 1;
    } else {
      nextNum = clientPartners.length + 1;
    }
    const paddedNum = String(nextNum).padStart(3, '0');
    const newId = `CL1-${paddedNum}`;

    const newEntry: ClientPartner = {
      id: newId,
      codigoCliente: newId,
      name: newClientName,
      type: 'Parceiro',
      region: newClientRegion,
      tel: newClientTel,
      addr: newClientAddr,
      status: newClientStatus,
      cnpj: newClientCNPJ || undefined,
      cep: newClientCep || undefined,
      cidade: newClientCidade || 'São Paulo',
      estado: newClientEstado || 'SP',
      enableCompletionNotifications: newClientEnableNotifications,
    };

    try {
      setClientPartners(prev => [...prev.filter(c => c.id !== newEntry.id), newEntry]);
      await dbSaveClientPartner(newEntry);
      
      // Add activity log
      const logId = generateUniqueLogId();
      await dbAddActivityLog({
        id: logId,
        time: getSaoPauloTime(),
        type: 'info',
        message: `Novo cliente parceiro cadastrado: ${newClientName}${newClientCNPJ ? ` (CNPJ: ${newClientCNPJ})` : ''}`,
      });

      // Reset fields
      setNewClientName('');
      setNewClientCNPJ('');
      setNewClientTel('');
      setNewClientAddr('');
      setNewClientCep('');
      setNewClientCidade('São Paulo');
      setNewClientEstado('SP');
      setIsNewClientModalOpen(false);
      setShowClientForm(false);
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao salvar cadastro de cliente: ${err.message || err}`);
    }
  };

  const handleCreateRider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRiderName || !newRiderPhone) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (newRiderPassword && (!/^\d+$/.test(newRiderPassword) || newRiderPassword.length > 6)) {
      alert('A senha deve ser numérica de até 6 dígitos.');
      return;
    }

    if (editingRider) {
      const updatedEntry: DeliveryRider = {
        ...editingRider,
        name: newRiderName,
        vehicle: newRiderVehicle as any,
        phone: newRiderPhone,
        exibirValorTurno: newRiderExibirValorTurno,
        ocultarValoresProtocolos: newRiderOcultarValoresProtocolos,
        autorizarImprimirRecibo: newRiderAutorizarImprimirRecibo,
        deviceNumber: newRiderDeviceNumber || undefined,
        password: newRiderPassword || undefined,
        address: newRiderAddress || undefined,
        cpfCnpj: newRiderCpfCnpj || undefined,
        vehiclePlate: newRiderVehiclePlate || undefined,
        cnh: newRiderCnh || undefined,
        billingModel: newRiderBillingModel,
        billingFixedFee: parseFloat(newRiderBillingFixedFee) || 0,
        billingVariablePercent: parseFloat(newRiderBillingVariablePercent) || 0,
        billingFreightPercent: parseFloat(newRiderBillingFreightPercent) || 0,
      };

      try {
        setRiders(prev => prev.map(r => r.id === updatedEntry.id ? updatedEntry : r));
        await dbSaveDeliveryRider(updatedEntry);

        // Add activity log
        const logId = generateUniqueLogId();
        await dbAddActivityLog({
          id: logId,
          time: getSaoPauloTime(),
          type: 'info',
          message: `Cadastro de condutor editado: ${newRiderName} (${newRiderVehicle})`,
        });

        // Reset fields
        setEditingRider(null);
        setNewRiderName('');
        setNewRiderPhone('');
        setNewRiderDeviceNumber('');
        setNewRiderPassword('');
        setNewRiderAddress('');
        setNewRiderCpfCnpj('');
        setNewRiderVehiclePlate('');
        setNewRiderCnh('');
        setNewRiderExibirValorTurno(false);
        setNewRiderOcultarValoresProtocolos(false);
        setNewRiderAutorizarImprimirRecibo(false);
        setNewRiderBillingModel('misto');
        setNewRiderBillingFixedFee('10.00');
        setNewRiderBillingVariablePercent('2.5');
        setNewRiderBillingFreightPercent('80');
        setIsNewRiderModalOpen(false);
        setShowRiderForm(false);
      } catch (err: any) {
        console.error(err);
        alert(`Erro ao salvar alteração de entregador: ${err.message || err}`);
      }
      return;
    }

    const newEntry: DeliveryRider = {
      id: `ent-${Date.now()}`,
      name: newRiderName,
      avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(newRiderName)}`,
      vehicle: newRiderVehicle as any,
      rating: 5.0,
      status: 'Disponível',
      phone: newRiderPhone,
      lat: 38 + (Math.random() - 0.5) * 5,
      lng: 42 + (Math.random() - 0.5) * 5,
      completedDeliveries: 0,
      batteryPercent: 100,
      exibirValorTurno: newRiderExibirValorTurno,
      ocultarValoresProtocolos: newRiderOcultarValoresProtocolos,
      autorizarImprimirRecibo: newRiderAutorizarImprimirRecibo,
      deviceNumber: newRiderDeviceNumber || undefined,
      password: newRiderPassword || undefined,
      address: newRiderAddress || undefined,
      cpfCnpj: newRiderCpfCnpj || undefined,
      vehiclePlate: newRiderVehiclePlate || undefined,
      cnh: newRiderCnh || undefined,
      billingModel: newRiderBillingModel,
      billingFixedFee: parseFloat(newRiderBillingFixedFee) || 0,
      billingVariablePercent: parseFloat(newRiderBillingVariablePercent) || 0,
      billingFreightPercent: parseFloat(newRiderBillingFreightPercent) || 0,
    };

    try {
      setRiders(prev => [...prev.filter(r => r.id !== newEntry.id), newEntry]);
      await dbSaveDeliveryRider(newEntry);

      // Add activity log
      const logId = generateUniqueLogId();
      await dbAddActivityLog({
        id: logId,
        time: getSaoPauloTime(),
        type: 'info',
        message: `Novo condutor cadastrado: ${newRiderName} (${newRiderVehicle})`,
      });

      // Reset fields
      setNewRiderName('');
      setNewRiderPhone('');
      setNewRiderDeviceNumber('');
      setNewRiderPassword('');
      setNewRiderAddress('');
      setNewRiderCpfCnpj('');
      setNewRiderVehiclePlate('');
      setNewRiderCnh('');
      setNewRiderExibirValorTurno(false);
      setNewRiderOcultarValoresProtocolos(false);
      setNewRiderAutorizarImprimirRecibo(false);
      setNewRiderBillingModel('misto');
      setNewRiderBillingFixedFee('10.00');
      setNewRiderBillingVariablePercent('2.5');
      setNewRiderBillingFreightPercent('80');
      setIsNewRiderModalOpen(false);
      setShowRiderForm(false);
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao salvar cadastro de entregador: ${err.message || err}`);
    }
  };

  // Global filter states (pre-filtered to dynamic today's date by default)
  const [filterDateFrom, setFilterDateFrom] = useState(todayStr);
  const [filterDateTo, setFilterDateTo] = useState(todayStr);
  const [filterPartner, setFilterPartner] = useState('');
  const [filterRiderId, setFilterRiderId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCep, setFilterCep] = useState('');
  const [filterShowDelayed, setFilterShowDelayed] = useState(false);

  const handleClearFilters = () => {
    const freshTodayStr = getTodayDateString();
    setFilterDateFrom(freshTodayStr);
    setFilterDateTo(freshTodayStr);
    setFilterPartner('');
    setFilterRiderId('');
    setFilterStatus('');
    setFilterCep('');
    setFilterShowDelayed(false);
  };

  // Real-time order status progression simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setOrders((prevOrders) => {
        // Find orders of today that are progressable (only already active routes)
        const progressable = prevOrders.filter(
          (o) => o.date === todayStr && (o.status === 'Em rota' || o.status === 'Entregando')
        );
        if (progressable.length === 0) return prevOrders;

        // Pick one at random
        const randomIndex = Math.floor(Math.random() * progressable.length);
        const randomOrder = progressable[randomIndex];
        
        let nextStatus: OrderStatus;
        if (randomOrder.status === 'Em rota') {
          nextStatus = 'Entregando';
        } else {
          nextStatus = 'Concluído';
        }

        // Schedule status update in background to reuse state log and update logic safely
        setTimeout(() => {
          handleUpdateStatus(randomOrder.id, nextStatus);
        }, 50);

        return prevOrders;
      });
    }, 12000); // 12-second rhythm for visual real-time dynamic feel

    return () => clearInterval(interval);
  }, [todayStr]);

  // Redirect old individual sections to unified administrative panel tabs
  useEffect(() => {
    if (activeSection === 'financeiro') {
      setActiveSection('admin');
      setAdminTab('financeiro');
    } else if (activeSection === 'relatorios') {
      setActiveSection('admin');
      setAdminTab('relatorios');
    } else if (activeSection === 'clientes') {
      setActiveSection('admin');
      setAdminTab('clientes');
    } else if (activeSection === 'entregadores' || activeSection === 'condutores') {
      setActiveSection('admin');
      setAdminTab('condutores');
    } else if (activeSection === 'sede') {
      setActiveSection('admin');
      setAdminTab('sede');
    } else if (activeSection === 'supabase') {
      setActiveSection('admin');
      setAdminTab('supabase');
    } else if (activeSection === 'logo_sede') {
      setActiveSection('admin');
      setAdminTab('logo_sede');
    } else if (activeSection === 'github') {
      setActiveSection('admin');
      setAdminTab('github');
    }
  }, [activeSection]);

  // Filtered orders to be used across the entire system
  const filteredOrders = orders.filter((order) => {
    // If show delayed filter is active
    if (filterShowDelayed) {
      const isDelayed = order.date < todayStr && order.status !== 'Concluído' && order.status !== 'Cancelado';
      const isToday = order.date === todayStr;
      if (!isDelayed && !isToday) return false;
    } else {
      // If NOT searching, respect the date filters.
      // If searching, we bypass date filters so historic/all matching orders are found
      const isSearching = searchQuery.trim() !== '';
      if (!isSearching) {
        if (filterDateFrom || filterDateTo) {
          const matchesDatePeriod = isOrderInDatePeriod(order, filterDateFrom, filterDateTo, filterStatus);
          if (!matchesDatePeriod) {
            return false;
          }
        }
      }
    }

    // 3. Partner client filter
    if (filterPartner && order.partnerName !== filterPartner) {
      return false;
    }
    // 4. Rider/Driver filter
    if (filterRiderId && order.riderId !== filterRiderId) {
      return false;
    }
    // 5. Status filter
    if (filterStatus && order.status !== filterStatus) {
      return false;
    }
    // 6. CEP filter (removes dashes for partial comparison)
    if (filterCep) {
      const cleanCep = filterCep.replace('-', '').trim();
      const cleanOrderCep = order.cep.replace('-', '').trim();
      if (!cleanOrderCep.includes(cleanCep)) {
        return false;
      }
    }
    return true;
  });

  // Dynamic Chart Data based on filteredOrders
  const dynamicChartData = [
    { hour: '08h', total: 0, delivered: 0 },
    { hour: '10h', total: 0, delivered: 0 },
    { hour: '12h', total: 0, delivered: 0 },
    { hour: '14h', total: 0, delivered: 0 },
    { hour: '16h', total: 0, delivered: 0 },
    { hour: '18h', total: 0, delivered: 0 },
    { hour: '20h', total: 0, delivered: 0 },
    { hour: '22h', total: 0, delivered: 0 }
  ];

  filteredOrders.forEach(o => {
    const hourStr = o.createdAt.split(':')[0];
    const hourNum = parseInt(hourStr) || 12;
    
    let hourLabel = '12h';
    if (hourNum <= 9) hourLabel = '08h';
    else if (hourNum <= 11) hourLabel = '10h';
    else if (hourNum <= 13) hourLabel = '12h';
    else if (hourNum <= 15) hourLabel = '14h';
    else if (hourNum <= 17) hourLabel = '16h';
    else if (hourNum <= 19) hourLabel = '18h';
    else if (hourNum <= 21) hourLabel = '20h';
    else hourLabel = '22h';

    const bin = dynamicChartData.find(d => d.hour === hourLabel);
    if (bin) {
      bin.total += 1;
      if (o.status === 'Concluído') {
        bin.delivered += 1;
      }
    }
  });

  // Dynamic Regions based on filteredOrders
  const regionNames = ['Centro', 'Zona Sul', 'Zona Oeste', 'Zona Norte', 'Zona Leste'];
  const totalInRegions = filteredOrders.length || 1;
  const dynamicRegions = regionNames.map(name => {
    const count = filteredOrders.filter(o => o.region === name).length;
    const percent = Math.round((count / totalInRegions) * 100);
    return { name, count, percent };
  });

  // Route optimization loading states
  const [optimizing, setOptimizing] = useState(false);
  const [optSuccess, setOptSuccess] = useState(false);

  const handleUpdateRider = (updatedRider: DeliveryRider) => {
    dbSaveDeliveryRider(updatedRider);
    setRiders(prev => prev.map(r => r.id === updatedRider.id ? updatedRider : r));
  };

  // Triggered when a new order is dispatched
  const handleCreateOrder = async (newOrderData: Omit<Order, 'id' | 'status' | 'createdAt'>) => {
    const nextId = `ped-${100 + orders.length + 1}`;
    
    // Auto geocode if coordinates are missing
    let finalLat = newOrderData.lat;
    let finalLng = newOrderData.lng;
    if (!finalLat || !finalLng) {
      try {
        const geoRes = await geocodeAddressBackend(newOrderData.address || '', newOrderData.cep, newOrderData.region);
        if (geoRes && typeof geoRes.lat === 'number' && typeof geoRes.lng === 'number') {
          finalLat = geoRes.lat;
          finalLng = geoRes.lng;
        }
      } catch (err) {
        console.warn("Backend geocode in handleCreateOrder warning:", err);
      }
    }

    const orderCreationTime = formatOrderTime(newOrderData.horarioInicial || getSaoPauloTime());
    const initialOrder: Order = {
      ...newOrderData,
      id: nextId,
      status: 'Não iniciado',
      createdAt: orderCreationTime,
      horarioInicial: orderCreationTime,
      date: newOrderData.date || getSaoPauloISODate(),
      lat: finalLat,
      lng: finalLng
    };

    const newOrder = validateAndRecalculateOrderFreight(initialOrder, clientPartners);

    try {
      await dbSaveOrder(newOrder);

      // Create activity timeline log
      const newLog: ActivityLog = {
        id: generateUniqueLogId('log'),
        time: newOrder.createdAt,
        message: `Novo pedido #${newOrder.id} recebido de ${newOrder.clientName} (${newOrder.region}) - Não iniciado.`,
        type: 'info',
        orderId: newOrder.id
      };
      await dbAddActivityLog(newLog);
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao salvar pedido: ${err.message || err}`);
    }
  };

  const handleImportOrders = (importedOrders: Order[]) => {
    // Auto-register missing partners in clientPartners state
    const missingPartners: ClientPartner[] = [];
    importedOrders.forEach(o => {
      if (!o.partnerName) return;
      const alreadyExists = clientPartners.some(cp => 
        isMatchingClientCode(o.partnerName, cp.id, cp.codigoCliente)
      );
      if (!alreadyExists) {
        const alreadyCollected = missingPartners.some(cp => 
          isMatchingClientCode(o.partnerName, cp.id, cp.codigoCliente)
        );
        if (!alreadyCollected) {
          let partnerNameFromExcel = '';
          if (o.rawData) {
            const keys = Object.keys(o.rawData);
            const nfKey = keys.find(k => k.toLowerCase() === 'nomefantasia');
            if (nfKey && o.rawData[nfKey]) {
              partnerNameFromExcel = String(o.rawData[nfKey]).trim();
            }
          }
          const finalName = partnerNameFromExcel || o.partnerName;
          const newPartner: ClientPartner = {
            id: o.partnerName,
            codigoCliente: o.partnerName,
            name: finalName,
            type: 'Parceiro',
            region: o.region || 'Centro',
            tel: '(11) 99999-9999',
            addr: o.address || 'Endereço Importado',
            status: 'Ativo'
          };
          if (o.cep) {
            newPartner.cep = o.cep;
          }
          missingPartners.push(newPartner);
        }
      }
    });

    if (missingPartners.length > 0) {
      missingPartners.forEach(p => dbSaveClientPartner(p));
      setClientPartners(prev => {
        const existingIds = new Set(prev.map(cp => cp.id));
        const newPartners = missingPartners.filter(p => !existingIds.has(p.id));
        return [...newPartners, ...prev];
      });
    }

    if (importedOrders.length > 0) {
      dbBulkSaveOrders(importedOrders);
      setOrders(prev => {
        const importedIds = new Set(importedOrders.map(i => i.id));
        const remainingPrev = prev.filter(p => !importedIds.has(p.id));
        return [...importedOrders, ...remainingPrev];
      });

      // Expand date filters if needed so user sees imported orders immediately
      const importedDates = importedOrders.map(o => o.date).filter(Boolean);
      if (importedDates.length > 0) {
        const minDate = importedDates.reduce((a, b) => (a < b ? a : b));
        const maxDate = importedDates.reduce((a, b) => (a > b ? a : b));
        setFilterDateFrom(prev => (!prev || minDate < prev ? minDate : prev));
        setFilterDateTo(prev => (!prev || maxDate > prev ? maxDate : prev));
      }
      // Clear restrictive side filters to guarantee visibility in Central de Pedidos
      setFilterPartner('');
      setFilterRiderId('');
      setFilterStatus('');
      setFilterCep('');
    }

    // Create activity logs
    const newLogs: ActivityLog[] = importedOrders.map((o, idx) => ({
      id: generateUniqueLogId(`log-import-${idx}`),
      time: o.createdAt,
      message: `Pedido #${o.id} importado com sucesso via planilha (${o.partnerName}).`,
      type: 'info',
      orderId: o.id
    }));
    if (newLogs.length > 0) {
      dbBulkSaveActivityLogs(newLogs);
      setLogs(prev => [...newLogs, ...prev]);
    }
  };

  // Triggered when dispatching or completing an order from table/list
  const handleUpdateStatus = async (
    orderId: string, 
    nextStatus: OrderStatus,
    protocolNumber?: string,
    signatureUrl?: string,
    deliveryPhotoUrl?: string,
    recipientName?: string,
    recipientDoc?: string,
    observations?: string
  ) => {
    try {
      const currentOrder = orders.find(o => o.id === orderId);
      if (!currentOrder) return;

      let updatedRiderObj: DeliveryRider | null = null;

      // If status changes to 'Em rota' or 'Entregando', we make sure the rider is marked 'Em rota'
      if ((nextStatus === 'Em rota' || nextStatus === 'Entregando') && currentOrder.riderId) {
        const rider = riders.find(r => r.id === currentOrder.riderId);
        if (rider) {
          updatedRiderObj = { ...rider, status: 'Em rota', currentOrderId: currentOrder.id };
        }
      }

      // If status changes to 'Concluído' or 'Cancelado', check if rider still has remaining active orders on route
      if ((nextStatus === 'Concluído' || nextStatus === 'Cancelado') && currentOrder.riderId) {
        const rider = riders.find(r => r.id === currentOrder.riderId);
        if (rider) {
          const remainingActiveOrders = orders.filter(
            o => o.id !== currentOrder.id && o.riderId === currentOrder.riderId && o.status !== 'Concluído' && o.status !== 'Cancelado'
          );
          const hasRemaining = remainingActiveOrders.length > 0;
          updatedRiderObj = { 
            ...rider, 
            status: hasRemaining ? 'Em rota' : 'Disponível', 
            currentOrderId: hasRemaining ? remainingActiveOrders[0].id : undefined,
            completedDeliveries: nextStatus === 'Concluído' ? rider.completedDeliveries + 1 : rider.completedDeliveries
          };
        }
      }

      const isConcluido = nextStatus === 'Concluído';

      // 1. Resolve Protocol Number
      let finalProtocolNumber = protocolNumber !== undefined && protocolNumber !== null && protocolNumber.trim() !== ''
        ? protocolNumber
        : currentOrder.protocolNumber;
      if (isConcluido && (!finalProtocolNumber || finalProtocolNumber.trim() === '')) {
        finalProtocolNumber = `PROT-${currentOrder.id.replace('ped-', '').toUpperCase()}`;
      }

      // 2. Resolve Recipient Name and Document
      let finalRecipientName = recipientName !== undefined && recipientName !== null && recipientName.trim() !== ''
        ? recipientName
        : currentOrder.recipientName;
      if (isConcluido && (!finalRecipientName || finalRecipientName.trim() === '')) {
        finalRecipientName = currentOrder.clientName || 'Recebedor Titular';
      }

      let finalRecipientDoc = recipientDoc !== undefined && recipientDoc !== null
        ? recipientDoc
        : (currentOrder.recipientDoc || '');

      // 3. Resolve Signature URL
      let finalSignatureUrl = signatureUrl !== undefined && signatureUrl !== null && signatureUrl.trim() !== ''
        ? signatureUrl
        : currentOrder.signatureUrl;
      if (isConcluido && (!finalSignatureUrl || finalSignatureUrl.trim() === '')) {
        finalSignatureUrl = `typed:${finalRecipientName}`;
      }

      // 4. Resolve Delivery Photo URL
      let finalDeliveryPhotoUrl = deliveryPhotoUrl !== undefined && deliveryPhotoUrl !== null && deliveryPhotoUrl.trim() !== ''
        ? deliveryPhotoUrl
        : currentOrder.deliveryPhotoUrl;
      if (isConcluido && (!finalDeliveryPhotoUrl || finalDeliveryPhotoUrl.trim() === '' || finalDeliveryPhotoUrl.includes('unsplash.com'))) {
        const coords = {
          lat: currentOrder.rawData?.Latitude ? parseFloat(currentOrder.rawData.Latitude) : -23.55052,
          lng: currentOrder.rawData?.Longitude ? parseFloat(currentOrder.rawData.Longitude) : -46.633308
        };
        finalDeliveryPhotoUrl = generateStaticSvgMap(coords.lat, coords.lng, currentOrder.address);
      }

      // 5. Resolve Observations
      let finalObservations = observations !== undefined && observations !== null && observations.trim() !== ''
        ? observations
        : (currentOrder.rawData?.Observacoes || currentOrder.rawData?.observacoes || currentOrder.rawData?.Observations || '');

      const updatedHistory: OrderHistoryEntry[] = [
        ...(currentOrder.history || []),
        {
          timestamp: getSaoPauloDateTimeShort(),
          action: `Status alterado para ${nextStatus}`,
          user: 'Sistema / Operador',
          details: `Movimentação no fluxo logístico para o status ${nextStatus}.`
        }
      ];

      // Sync rawData spreadsheet fields with explicit protocol data
      const updatedRawData = { ...(currentOrder.rawData || {}) };
      updatedRawData['Situacao'] = nextStatus;
      if (finalProtocolNumber) updatedRawData['NumeroProtocolo'] = finalProtocolNumber;
      if (finalSignatureUrl) {
        updatedRawData['signatureUrl'] = finalSignatureUrl;
        updatedRawData['signatureImage'] = finalSignatureUrl;
        updatedRawData['assinatura'] = finalSignatureUrl;
      }
      if (finalDeliveryPhotoUrl) {
        updatedRawData['deliveryPhotoUrl'] = finalDeliveryPhotoUrl;
        updatedRawData['photoImage'] = finalDeliveryPhotoUrl;
        updatedRawData['fotoComprovante'] = finalDeliveryPhotoUrl;
        updatedRawData['foto'] = finalDeliveryPhotoUrl;
      }
      if (finalRecipientName) updatedRawData['Recebedor'] = finalRecipientName;
      if (finalRecipientDoc !== undefined) updatedRawData['DocumentoRecebedor'] = finalRecipientDoc;
      if (finalObservations) {
        updatedRawData['Observacoes'] = finalObservations;
        updatedRawData['observacoes'] = finalObservations;
        updatedRawData['Observations'] = finalObservations;
      }

      const calculatedDataConclusao = isConcluido ? (currentOrder.dataConclusao || currentOrder.deliveryDate || getSaoPauloISODate()) : currentOrder.dataConclusao;
      const rawOrderStartTime = currentOrder.horarioInicial || currentOrder.createdAt || currentOrder.rawData?.HorarioInicio || currentOrder.rawData?.horarioinicio;
      const calculatedHorarioInicial = formatOrderTime(rawOrderStartTime || getSaoPauloTime());
      const calculatedHorarioFinal = isConcluido ? (currentOrder.horarioFinal || currentOrder.deliveryTime || getSaoPauloTime()) : currentOrder.horarioFinal;

      if (calculatedDataConclusao) updatedRawData['DataConclusao'] = calculatedDataConclusao;
      if (calculatedHorarioInicial) updatedRawData['HorarioInicio'] = calculatedHorarioInicial;
      if (calculatedHorarioFinal) updatedRawData['HorarioFinal'] = calculatedHorarioFinal;

      const updatedOrderObj: Order = { 
        ...currentOrder, 
        status: nextStatus, 
        riderId: nextStatus === 'Cancelado' ? undefined : currentOrder.riderId,
        history: updatedHistory,
        protocolNumber: finalProtocolNumber,
        signatureUrl: finalSignatureUrl,
        deliveryPhotoUrl: finalDeliveryPhotoUrl,
        recipientName: finalRecipientName,
        recipientDoc: finalRecipientDoc,
        occurrenceDate: nextStatus === 'Ocorrência' ? (currentOrder.occurrenceDate || getSaoPauloISODate()) : currentOrder.occurrenceDate,
        deliveryDate: isConcluido ? (currentOrder.deliveryDate || getSaoPauloISODate()) : currentOrder.deliveryDate,
        deliveryTime: isConcluido ? (currentOrder.deliveryTime || getSaoPauloTime()) : currentOrder.deliveryTime,
        dataConclusao: calculatedDataConclusao,
        horarioInicial: calculatedHorarioInicial,
        horarioFinal: calculatedHorarioFinal,
        rawData: updatedRawData
      };

      // Execute Automatic Customer Notification Processing if Order is Completed
      if (isConcluido) {
        // Find partner to check if notifications are enabled
        const partnerObj = clientPartners.find(cp => 
          isMatchingClientCode(updatedOrderObj.partnerName, cp.id, cp.codigoCliente) ||
          isMatchingClientCode(updatedOrderObj.clientName, cp.id, cp.codigoCliente) ||
          (cp.name && (cp.name.toLowerCase() === (updatedOrderObj.partnerName || '').toLowerCase() || cp.name.toLowerCase() === (updatedOrderObj.clientName || '').toLowerCase()))
        );

        const isNotifEnabledForPartner = partnerObj ? partnerObj.enableCompletionNotifications !== false : true;

        if (!isNotifEnabledForPartner) {
          updatedOrderObj.history = [
            ...(updatedOrderObj.history || []),
            {
              timestamp: getSaoPauloDateTimeShort(),
              action: 'Notificação Não Enviada',
              user: 'Sistema de Notificações Automáticas',
              details: `Envio de mensagem desativado no cadastro do parceiro (${partnerObj?.name || 'Parceiro'}).`
            }
          ];
        } else {
          const notifSettings = getNotificationSettings();
          const contact = getOrderContactInfo(updatedOrderObj);
          const riderName = riders.find(r => r.id === updatedOrderObj.riderId)?.name || 'Condutor ViniMap';

          let waUrl = '';
          let waText = '';
          let emailSubj = '';
          let emailBody = '';

          if (notifSettings.autoSendWhatsapp && (contact.hasPhone || contact.phone)) {
            waText = replaceNotificationPlaceholders(notifSettings.whatsappMessageTemplate, updatedOrderObj, riderName);
            waUrl = generateWhatsappUrl(contact.cleanPhoneDigits, waText);
          }

          if (notifSettings.autoSendEmail && contact.hasEmail) {
            emailSubj = replaceNotificationPlaceholders(notifSettings.emailSubjectTemplate, updatedOrderObj, riderName);
            emailBody = replaceNotificationPlaceholders(notifSettings.emailMessageTemplate, updatedOrderObj, riderName);
          }

          const notifDetails = [
            contact.hasPhone ? `WhatsApp: ${contact.phone}` : null,
            contact.hasEmail ? `E-mail: ${contact.email}` : null
          ].filter(Boolean).join(' | ');

          if (notifDetails) {
            updatedOrderObj.history = [
              ...(updatedOrderObj.history || []),
              {
                timestamp: getSaoPauloDateTimeShort(),
                action: 'Notificação Enviada ao Cliente',
                user: 'Sistema de Notificações Automáticas',
                details: `Mensagem enviada com sucesso ao cliente (${notifDetails}).`
              }
            ];
          }

          // Trigger floating completion notification toast
          setCompletionNotificationToast({
            orderId: updatedOrderObj.id,
            clientName: updatedOrderObj.clientName,
            phone: contact.phone,
            email: contact.email,
            waUrl,
            waText,
            emailSubject: emailSubj,
            emailBody
          });
        }
      }

      // Instantly update local React state for snappy, real-time UI consistency
      setOrders(prev => prev.map(o => o.id === orderId ? updatedOrderObj : o));
      if (updatedRiderObj) {
        setRiders(prev => prev.map(r => r.id === updatedRiderObj.id ? updatedRiderObj : r));
      }

      // EXPLICIT VALIDATION STEP: Verify payload properties before executing dbSaveOrder
      const payloadValidation = {
        orderId,
        nextStatus,
        hasProtocolNumber: !!updatedOrderObj.protocolNumber,
        protocolNumber: updatedOrderObj.protocolNumber || null,
        hasSignatureUrl: !!updatedOrderObj.signatureUrl,
        signatureUrlLength: updatedOrderObj.signatureUrl?.length || 0,
        signaturePreview: updatedOrderObj.signatureUrl ? (updatedOrderObj.signatureUrl.length > 50 ? updatedOrderObj.signatureUrl.substring(0, 50) + '...' : updatedOrderObj.signatureUrl) : null,
        hasDeliveryPhotoUrl: !!updatedOrderObj.deliveryPhotoUrl,
        deliveryPhotoUrlLength: updatedOrderObj.deliveryPhotoUrl?.length || 0,
        deliveryPhotoPreview: updatedOrderObj.deliveryPhotoUrl ? (updatedOrderObj.deliveryPhotoUrl.length > 50 ? updatedOrderObj.deliveryPhotoUrl.substring(0, 50) + '...' : updatedOrderObj.deliveryPhotoUrl) : null,
        recipientName: updatedOrderObj.recipientName || null,
        recipientDoc: updatedOrderObj.recipientDoc || null,
        observations: finalObservations
      };

      console.log(`[handleUpdateStatus EXPLICIT VALIDATION] Order #${orderId} payload verification before dbSaveOrder:`, payloadValidation);

      if (isConcluido) {
        if (!updatedOrderObj.signatureUrl) {
          console.error(`[handleUpdateStatus VALIDATION ERROR] signatureUrl is missing on completed order #${orderId}`);
        }
        if (!updatedOrderObj.deliveryPhotoUrl) {
          console.error(`[handleUpdateStatus VALIDATION ERROR] deliveryPhotoUrl is missing on completed order #${orderId}`);
        }
        if (!updatedOrderObj.protocolNumber) {
          console.error(`[handleUpdateStatus VALIDATION ERROR] protocolNumber is missing on completed order #${orderId}`);
        }
      }

      const promises: Promise<any>[] = [dbSaveOrder(updatedOrderObj)];
      if (updatedRiderObj) {
        promises.push(dbSaveDeliveryRider(updatedRiderObj));
      }

      // Create log
      const nowTime = getSaoPauloTime();
      let logMsg = '';
      let logType: 'info' | 'success' | 'warning' | 'danger' = 'info';

      if (nextStatus === 'Em rota') {
        logMsg = `Pedido #${orderId} despachado e a caminho (Em Rota).`;
        logType = 'info';
      } else if (nextStatus === 'Entregando') {
        logMsg = `Pedido #${orderId} em processo final de entrega (Entregando).`;
        logType = 'info';
      } else if (nextStatus === 'Concluído') {
        logMsg = `Pedido #${orderId} entregue com sucesso e concluído (Concluído).`;
        logType = 'success';
      } else if (nextStatus === 'Ocorrência') {
        logMsg = `Atenção: Ocorrência/Incidente registrado no pedido #${orderId}.`;
        logType = 'danger';
      } else if (nextStatus === 'Cancelado') {
        logMsg = `Aviso: Pedido #${orderId} foi cancelado.`;
        logType = 'warning';
      } else {
        logMsg = `Pedido #${orderId} atualizado para ${nextStatus}.`;
        logType = 'info';
      }

      const newLog: ActivityLog = {
        id: generateUniqueLogId('log'),
        time: nowTime,
        message: logMsg,
        type: logType,
        orderId
      };
      promises.push(dbAddActivityLog(newLog));

      await Promise.all(promises);

      console.log(`[handleUpdateStatus AFTER SAVE SUCCESS] Order #${orderId} data integrity confirmed persisted:`, {
        orderId,
        status: updatedOrderObj.status,
        protocolNumber: updatedOrderObj.protocolNumber,
        signatureUrlSaved: !!updatedOrderObj.signatureUrl,
        deliveryPhotoUrlSaved: !!updatedOrderObj.deliveryPhotoUrl,
        recipientName: updatedOrderObj.recipientName,
        recipientDoc: updatedOrderObj.recipientDoc
      });
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao atualizar status do pedido: ${err.message || err}`);
    }
  };

  // Triggered when linking a rider to a pending order
  const handleAssignRider = async (orderId: string, riderId: string) => {
    try {
      const currentOrder = orders.find(o => o.id === orderId);
      if (!currentOrder) return;

      const riderName = riders.find(r => r.id === riderId)?.name || 'Entregador';
      const nowTime = getSaoPauloTime();

      const historyEntry = {
        timestamp: getSaoPauloDateTimeShort(),
        action: 'Entregador Alocado',
        user: 'Operador',
        details: `Entregador ${riderName} vinculado ao pedido. Status definido como Não iniciado.`
      };

      const initialUpdatedOrder: Order = { 
        ...currentOrder, 
        riderId, 
        status: 'Não iniciado' as OrderStatus,
        history: [...(currentOrder.history || []), historyEntry]
      };

      const updatedOrder = validateAndRecalculateOrderFreight(initialUpdatedOrder, clientPartners);

      const promises: Promise<any>[] = [];

      // Mark rider busy if order is already in route/delivering
      if (currentOrder.status === 'Entregando' || currentOrder.status === 'Em rota') {
        const rider = riders.find(r => r.id === riderId);
        if (rider) {
          const updatedRider: DeliveryRider = { ...rider, status: 'Em rota', currentOrderId: orderId };
          promises.push(dbSaveDeliveryRider(updatedRider));
        }
      }

      promises.push(dbSaveOrder(updatedOrder));

      const newLog: ActivityLog = {
        id: generateUniqueLogId('log'),
        time: nowTime,
        message: `Entregador ${riderName} vinculado ao pedido #${orderId}.`,
        type: 'info',
        orderId
      };
      promises.push(dbAddActivityLog(newLog));

      await Promise.all(promises);
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao alocar condutor: ${err.message || err}`);
    }
  };

  const handleUpdateOrder = async (updatedOrder: Order) => {
    try {
      let finalOrder = { ...updatedOrder };
      
      // Dynamic recalculation of freight whenever CEP or partnerName is modified
      const existingOrder = orders.find(o => o.id === finalOrder.id);
      if (existingOrder && (existingOrder.cep !== finalOrder.cep || existingOrder.partnerName !== finalOrder.partnerName)) {
        // If CEP or partner name is changed, we ignore any manual overridden deliveryValue to let it recompute
        const orderForRecalc = { ...finalOrder, deliveryValue: undefined };
        finalOrder = validateAndRecalculateOrderFreight(orderForRecalc, clientPartners);
      } else {
        // Even if CEP didn't change, run validateAndRecalculateOrderFreight to keep rawData and state fully synced
        finalOrder = validateAndRecalculateOrderFreight(finalOrder, clientPartners);
      }

      const promises: Promise<any>[] = [];

      if (finalOrder.status === 'Cancelado') {
        if (finalOrder.riderId) {
          const rider = riders.find(r => r.id === finalOrder.riderId);
          if (rider) {
            const updatedRider: DeliveryRider = { ...rider, status: 'Disponível', currentOrderId: undefined };
            promises.push(dbSaveDeliveryRider(updatedRider));
          }
        }
        finalOrder.riderId = undefined;
      }

      promises.push(dbSaveOrder(finalOrder));

      const nowTime = getSaoPauloTime();
      const newLog: ActivityLog = {
        id: generateUniqueLogId('log-crud'),
        time: nowTime,
        message: `Pedido #${finalOrder.id} de ${finalOrder.clientName} foi atualizado manualmente via painel.`,
        type: 'info',
        orderId: finalOrder.id
      };
      promises.push(dbAddActivityLog(newLog));

      await Promise.all(promises);
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao editar pedido: ${err.message || err}`);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      await dbDeleteOrder(orderId);

      const nowTime = getSaoPauloTime();
      const newLog: ActivityLog = {
        id: generateUniqueLogId('log-crud'),
        time: nowTime,
        message: `Pedido #${orderId} foi deletado e removido do sistema.`,
        type: 'danger',
        orderId
      };
      await dbAddActivityLog(newLog);
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao excluir pedido: ${err.message || err}`);
    }
  };

  const handleBulkUpdateStatus = async (orderIds: string[], nextStatus: OrderStatus) => {
    try {
      const updatedOrders: Order[] = [];
      const updatedRidersMap: { [riderId: string]: DeliveryRider } = {};

      orders.forEach(order => {
        if (orderIds.includes(order.id)) {
          const historyEntry = {
            timestamp: getSaoPauloDateTimeShort(),
            action: 'Status Alterado (Em Massa)',
            user: 'Sistema (Painel)',
            details: `Status alterado para ${nextStatus} em massa.`
          };

          if ((nextStatus === 'Concluído' || nextStatus === 'Cancelado') && order.riderId) {
            const rider = riders.find(r => r.id === order.riderId);
            if (rider) {
              updatedRidersMap[rider.id] = {
                ...rider,
                status: 'Disponível',
                currentOrderId: undefined,
                completedDeliveries: nextStatus === 'Concluído' ? rider.completedDeliveries + 1 : rider.completedDeliveries
              };
            }
          }

          const isConcluido = nextStatus === 'Concluído';

          let finalProtocolNumber = order.protocolNumber;
          if (isConcluido && (!finalProtocolNumber || finalProtocolNumber.trim() === '')) {
            finalProtocolNumber = `PROT-${order.id.replace('ped-', '').toUpperCase()}`;
          }

          let finalRecipientName = order.recipientName;
          if (isConcluido && (!finalRecipientName || finalRecipientName.trim() === '')) {
            finalRecipientName = order.clientName || 'Recebedor Titular';
          }

          let finalRecipientDoc = order.recipientDoc || '';

          let finalSignatureUrl = order.signatureUrl;
          if (isConcluido && (!finalSignatureUrl || finalSignatureUrl.trim() === '')) {
            finalSignatureUrl = `typed:${finalRecipientName}`;
          }

          let finalDeliveryPhotoUrl = order.deliveryPhotoUrl;
          if (isConcluido && (!finalDeliveryPhotoUrl || finalDeliveryPhotoUrl.trim() === '' || finalDeliveryPhotoUrl.includes('unsplash.com'))) {
            const coords = {
              lat: order.rawData?.Latitude ? parseFloat(order.rawData.Latitude) : -23.55052,
              lng: order.rawData?.Longitude ? parseFloat(order.rawData.Longitude) : -46.633308
            };
            finalDeliveryPhotoUrl = generateStaticSvgMap(coords.lat, coords.lng, order.address);
          }

          const updatedRawData = { ...(order.rawData || {}) };
          updatedRawData['Situacao'] = nextStatus;
          if (finalProtocolNumber) updatedRawData['NumeroProtocolo'] = finalProtocolNumber;
          if (finalSignatureUrl) {
            updatedRawData['signatureUrl'] = finalSignatureUrl;
            updatedRawData['signatureImage'] = finalSignatureUrl;
            updatedRawData['assinatura'] = finalSignatureUrl;
          }
          if (finalDeliveryPhotoUrl) {
            updatedRawData['deliveryPhotoUrl'] = finalDeliveryPhotoUrl;
            updatedRawData['photoImage'] = finalDeliveryPhotoUrl;
            updatedRawData['fotoComprovante'] = finalDeliveryPhotoUrl;
            updatedRawData['foto'] = finalDeliveryPhotoUrl;
          }
          if (finalRecipientName) updatedRawData['Recebedor'] = finalRecipientName;
          if (finalRecipientDoc !== undefined) updatedRawData['DocumentoRecebedor'] = finalRecipientDoc;

          updatedOrders.push({
            ...order,
            status: nextStatus,
            riderId: nextStatus === 'Cancelado' ? undefined : order.riderId,
            history: [...(order.history || []), historyEntry],
            protocolNumber: finalProtocolNumber,
            signatureUrl: finalSignatureUrl,
            deliveryPhotoUrl: finalDeliveryPhotoUrl,
            recipientName: finalRecipientName,
            recipientDoc: finalRecipientDoc,
            deliveryDate: isConcluido ? (order.deliveryDate || getSaoPauloISODate()) : order.deliveryDate,
            deliveryTime: isConcluido ? (order.deliveryTime || getSaoPauloTime()) : order.deliveryTime,
            rawData: updatedRawData
          });
        }
      });

      const promises: Promise<any>[] = [];

      if (updatedOrders.length > 0) {
        promises.push(dbBulkSaveOrders(updatedOrders));
      }
      const ridersToSave = Object.values(updatedRidersMap);
      if (ridersToSave.length > 0) {
        ridersToSave.forEach(r => promises.push(dbSaveDeliveryRider(r)));
      }

      const nowTime = getSaoPauloTime();
      const newLog: ActivityLog = {
        id: generateUniqueLogId('log-bulk'),
        time: nowTime,
        message: `${orderIds.length} pedidos tiveram o status alterado para "${nextStatus}" em massa.`,
        type: 'success'
      };
      promises.push(dbAddActivityLog(newLog));

      await Promise.all(promises);
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao atualizar pedidos em lote: ${err.message || err}`);
    }
  };

  const handleBulkAssignRider = async (orderIds: string[], riderId: string) => {
    try {
      const riderName = riders.find(r => r.id === riderId)?.name || 'Entregador';
      const updatedOrders: Order[] = [];

      orders.forEach(order => {
        if (orderIds.includes(order.id)) {
          const historyEntry = {
            timestamp: getSaoPauloDateTimeShort(),
            action: 'Entregador Alocado (Em Massa)',
            user: 'Sistema (Painel)',
            details: `Entregador ${riderName} vinculado em massa.`
          };
          const initialUpdatedOrder: Order = {
            ...order,
            riderId,
            history: [...(order.history || []), historyEntry]
          };
          updatedOrders.push(validateAndRecalculateOrderFreight(initialUpdatedOrder, clientPartners));
        }
      });

      const promises: Promise<any>[] = [];

      if (updatedOrders.length > 0) {
        promises.push(dbBulkSaveOrders(updatedOrders));
      }

      const nowTime = getSaoPauloTime();
      const newLog: ActivityLog = {
        id: generateUniqueLogId('log-bulk'),
        time: nowTime,
        message: `Entregador ${riderName} vinculado a ${orderIds.length} pedidos em massa.`,
        type: 'info'
      };
      promises.push(dbAddActivityLog(newLog));

      await Promise.all(promises);
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao vincular condutor em lote: ${err.message || err}`);
    }
  };

  const handleBulkDelete = async (orderIds: string[]) => {
    try {
      await dbBulkDeleteOrders(orderIds);

      const nowTime = getSaoPauloTime();
      const newLog: ActivityLog = {
        id: generateUniqueLogId('log-bulk'),
        time: nowTime,
        message: `${orderIds.length} pedidos foram removidos em massa via seleção de linhas.`,
        type: 'danger'
      };
      await dbAddActivityLog(newLog);
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao excluir pedidos em lote: ${err.message || err}`);
    }
  };

  const handleBulkCreate = async (newOrdersData: Omit<Order, 'id' | 'status' | 'createdAt'>[]) => {
    try {
      const startNum = 100 + orders.length + 1;
      const createdOrders: Order[] = newOrdersData.map((data, index) => {
        const tempOrder: Order = {
          ...data,
          id: `ped-${startNum + index}`,
          status: 'Não iniciado',
          createdAt: getSaoPauloTime(),
          history: [
            {
              timestamp: getSaoPauloDateTimeShort(),
              action: 'Pedido Criado (Em Lote)',
              user: 'Operador',
              details: 'Pedido criado através do painel de inclusão em lote.'
            }
          ]
        };

        return validateAndRecalculateOrderFreight(tempOrder, clientPartners);
      });

      await dbBulkSaveOrders(createdOrders);

      // Add a single activity log for the bulk operation
      const nowTime = getSaoPauloTime();
      const newLog: ActivityLog = {
        id: generateUniqueLogId('log-bulk'),
        time: nowTime,
        message: `${createdOrders.length} novos pedidos foram incluídos em lote via painel.`,
        type: 'success'
      };
      await dbAddActivityLog(newLog);
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao criar pedidos em lote: ${err.message || err}`);
    }
  };

  const handleBulkEdit = async (orderIds: string[], updates: Partial<Order>) => {
    try {
      const updatedOrders: Order[] = [];
      const updatedRidersMap: { [riderId: string]: DeliveryRider } = {};

      orders.forEach(order => {
        if (orderIds.includes(order.id)) {
          const merged: Order = {
            ...order,
            ...updates
          };

          // If updates includes status, append a timeline history entry
          const fieldsModified = Object.keys(updates).join(', ');
          const historyEntry = {
            timestamp: getSaoPauloDateTimeShort(),
            action: 'Pedido Editado (Em Lote)',
            user: 'Operador',
            details: `Campos editados em lote: ${fieldsModified}.`
          };
          merged.history = [...(order.history || []), historyEntry];

          // Handle special cases like changing status to Cancelado or Concluído, releasing riders
          if (updates.status && (updates.status === 'Concluído' || updates.status === 'Cancelado') && order.riderId) {
            const rider = riders.find(r => r.id === order.riderId);
            if (rider) {
              updatedRidersMap[rider.id] = {
                ...rider,
                status: 'Disponível',
                currentOrderId: undefined,
                completedDeliveries: updates.status === 'Concluído' ? rider.completedDeliveries + 1 : rider.completedDeliveries
              };
            }
            if (updates.status === 'Cancelado') {
              merged.riderId = undefined;
            }
          }

          // Handle allocating a rider in bulk edit
          if (updates.riderId && updates.riderId !== order.riderId) {
            const riderName = riders.find(r => r.id === updates.riderId)?.name || 'Entregador';
            merged.history.push({
              timestamp: getSaoPauloDateTimeShort(),
              action: 'Entregador Alocado (Em Lote)',
              user: 'Operador',
              details: `Entregador ${riderName} vinculado em massa.`
            });
          }

          // Recalculate freight if CEP or partnerName changes in bulk edits, or always validate consistency
          let finalMerged = merged;
          if (updates.cep !== undefined || updates.partnerName !== undefined) {
            const orderForRecalc = { ...merged };
            if (updates.cep !== undefined && updates.cep !== order.cep) {
              orderForRecalc.deliveryValue = undefined;
            }
            if (updates.partnerName !== undefined && updates.partnerName !== order.partnerName) {
              orderForRecalc.deliveryValue = undefined;
            }
            finalMerged = validateAndRecalculateOrderFreight(orderForRecalc, clientPartners);
          } else {
            finalMerged = validateAndRecalculateOrderFreight(merged, clientPartners);
          }

          updatedOrders.push(finalMerged);
        }
      });

      const promises: Promise<any>[] = [];
      if (updatedOrders.length > 0) {
        promises.push(dbBulkSaveOrders(updatedOrders));
      }

      const ridersToSave = Object.values(updatedRidersMap);
      if (ridersToSave.length > 0) {
        ridersToSave.forEach(r => promises.push(dbSaveDeliveryRider(r)));
      }

      const nowTime = getSaoPauloTime();
      const newLog: ActivityLog = {
        id: generateUniqueLogId('log-bulk'),
        time: nowTime,
        message: `${orderIds.length} pedidos foram editados e atualizados em massa via painel.`,
        type: 'info'
      };
      promises.push(dbAddActivityLog(newLog));

      await Promise.all(promises);
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao editar pedidos em lote: ${err.message || err}`);
    }
  };

  // Reset demo state back to default mock
  const handleResetDemoState = async () => {
    const today = getTodayDateString();
    const yesterday = getRelativeDateString(1);
    const twoDaysAgo = getRelativeDateString(2);
    const threeDaysAgo = getRelativeDateString(3);

    const mappedOrders: Order[] = INITIAL_ORDERS.map((order, idx) => {
      let mappedDate = order.date;
      if (order.date === '2026-07-02') {
        mappedDate = today;
      } else if (order.date === '2026-07-01') {
        mappedDate = yesterday;
      } else if (order.date === '2026-06-30') {
        mappedDate = twoDaysAgo;
      } else {
        mappedDate = threeDaysAgo;
      }

      const protocolNumber = `PROT-${order.id.replace('ped-', '').toUpperCase()}${String(100 + idx)}`;
      
      return {
        ...order,
        date: mappedDate,
        protocolNumber
      };
    });

    await dbResetToDemoState(mappedOrders);
    setOrders(mappedOrders);
    setRiders(INITIAL_RIDERS);
    setClientPartners(INITIAL_CLIENT_PARTNERS);
    setLogs(INITIAL_LOGS);
    setFinancialTransactions(INITIAL_FINANCIAL_TRANSACTIONS);
    setSelectedRiderId(null);
    setActiveOrderTab('Todos');
  };

  const handleUpdateFinancialTransactions = async (updatedTxs: FinancialTransaction[]) => {
    // Optimistic local update so UI reflects additions/edits/deletions immediately
    setFinancialTransactions(updatedTxs);

    const prevIds = new Set(financialTransactions.map(tx => tx.id));
    const nextIds = new Set(updatedTxs.map(tx => tx.id));
    
    try {
      const promises: Promise<any>[] = [];

      // Delete missing
      financialTransactions.forEach(tx => {
        if (!nextIds.has(tx.id)) {
          promises.push(dbDeleteFinancialTransaction(tx.id));
        }
      });

      // Save/update any new or changed transactions
      updatedTxs.forEach(tx => {
        const prevTx = financialTransactions.find(t => t.id === tx.id);
        if (!prevTx || JSON.stringify(prevTx) !== JSON.stringify(tx)) {
          promises.push(dbSaveFinancialTransaction(tx));
        }
      });

      await Promise.all(promises);
    } catch (err: any) {
      console.error("Error updating financial transactions: ", err);
      alert(`Erro ao atualizar lançamentos financeiros: ${err.message || err}`);
    }
  };

  // Live optimization simulation
  const triggerOptimization = () => {
    setOptimizing(true);
    setOptSuccess(false);
    setTimeout(() => {
      setOptimizing(false);
      setOptSuccess(true);
      
      // Auto assign pending orders to free drivers as a benefit of route optimization
      const pendingList = orders.filter(o => o.status === 'Não iniciado');
      const freeRiders = riders.filter(r => r.status === 'Disponível');

      if (pendingList.length > 0 && freeRiders.length > 0) {
        // Link first pending to first available
        handleAssignRider(pendingList[0].id, freeRiders[0].id);
      }

      // Append optimization success event log
      const nowTime = getSaoPauloTime();
      const newLog: ActivityLog = {
        id: generateUniqueLogId('log'),
        time: nowTime,
        message: 'Algoritmo Vinimap recalculou rotas de despacho. Eficiência de percurso aumentada em 18.4%!',
        type: 'success'
      };
      dbAddActivityLog(newLog);
    }, 1800);
  };

  const handleExportFinanceExcel = () => {
    if (filteredOrders.length === 0) {
      alert("Nenhum pedido filtrado para exportar.");
      return;
    }

    const exportData = filteredOrders.map((o) => {
      const rider = riders.find((r) => r.id === o.riderId);
      const riderDetails = rider ? `${rider.name} (${rider.vehicle}) - Tel: ${rider.phone}` : 'Não alocado';
      const adminFee = o.value * 0.15;
      const riderShare = o.value * 0.85;
      
      let paymentStatus = 'Pendente';
      if (o.status === 'Concluído') {
        paymentStatus = 'Liquidado';
      } else if (o.status === 'Cancelado') {
        paymentStatus = 'Estornado';
      }

      return {
        'Código do Pedido': o.id,
        'Cliente': o.clientName,
        'Contato': o.phone,
        'Região': o.region,
        'Parceiro/Estabelecimento': getPartnerDisplayName(o.partnerName, clientPartners),
        'Valor Total (R$)': o.value,
        'Taxa Administrativa (15%) (R$)': adminFee,
        'Repasse Entregador (85%) (R$)': riderShare,
        'Entregador (Detalhes)': riderDetails,
        'Status do Pagamento': paymentStatus,
        'Status do Pedido': o.status,
        'Data': formatToBrazilianDate(o.date)
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    worksheet['!cols'] = [
      { wch: 15 }, // Código do Pedido
      { wch: 20 }, // Cliente
      { wch: 15 }, // Contato
      { wch: 12 }, // Região
      { wch: 22 }, // Parceiro/Estabelecimento
      { wch: 15 }, // Valor Total
      { wch: 22 }, // Taxa Administrativa (15%)
      { wch: 22 }, // Repasse Entregador (85%)
      { wch: 35 }, // Entregador (Detalhes)
      { wch: 18 }, // Status do Pagamento
      { wch: 15 }, // Status do Pedido
      { wch: 12 }  // Data
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Extrato Financeiro');

    const timestamp = getSaoPauloDate().split('/').reverse().join('-');
    XLSX.writeFile(workbook, `vinimap_extrato_financeiro_${timestamp}.xlsx`);
  };

  const handleExportFinancePDF = () => {
    if (filteredOrders.length === 0) {
      alert("Nenhum pedido filtrado para exportar.");
      return;
    }

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // Dark professional header
    doc.setFillColor(30, 41, 59); // Slate-800
    doc.rect(0, 0, 297, 25, 'F');

    // Title text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text('Vinimap Logistics OS - Relatório Financeiro e Repasses', 14, 16);

    // Metadata subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(226, 232, 240); // Slate-200
    const timestamp = getSaoPauloDateTimeShort();
    doc.text(`Gerado em: ${timestamp} | Total de Registros Filtrados: ${filteredOrders.length}`, 14, 21);

    // Display active filter description for context
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.setFontSize(8);
    let filterDesc = 'Filtros ativos: ';
    if (filterPartner) filterDesc += `Parceiro: ${filterPartner} | `;
    if (filterRiderId) {
      const rName = riders.find(r => r.id === filterRiderId)?.name || filterRiderId;
      filterDesc += `Entregador: ${rName} | `;
    }
    if (filterStatus) filterDesc += `Status: ${filterStatus} | `;
    if (filterDateFrom || filterDateTo) {
      filterDesc += `Período: ${filterDateFrom} até ${filterDateTo} | `;
    }
    if (filterDesc === 'Filtros ativos: ') {
      filterDesc += 'Nenhum (Todos os pedidos exibidos)';
    } else {
      filterDesc = filterDesc.slice(0, -3);
    }
    doc.text(filterDesc, 14, 31);

    // Summary calculations block (KPI Card overlay in PDF)
    const totalRev = filteredOrders.reduce((sum, o) => {
      if (o.status !== 'Cancelado') {
        return sum + o.value;
      }
      return sum;
    }, 0);
    const systemRevenue = totalRev * 0.15;
    const ridersEarnings = totalRev * 0.85;

    // KPI box container background
    doc.setFillColor(248, 250, 252); // Slate-50
    doc.rect(14, 35, 269, 14, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, 35, 269, 14, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('RESUMO CONSOLIDADO DA SELEÇÃO:', 18, 44);

    doc.setFont('helvetica', 'normal');
    doc.text('Faturamento Estimado:', 85, 44);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235); // Blue
    doc.text(totalRev.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 120, 44);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Taxa Admin (15%):', 155, 44);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 163, 74); // Green
    doc.text(systemRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 185, 44);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Repasse Entregadores (85%):', 215, 44);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(124, 58, 237); // Violet
    doc.text(ridersEarnings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 255, 44);

    // Setup headers and body for AutoTable
    const pdfHeaders = [['Código', 'Cliente / Contato', 'Região / Parceiro', 'Valor Total', 'Taxa Admin (15%)', 'Repasse (85%)', 'Entregador (Detalhes)', 'Status Pagamento']];
    
    const pdfBody = filteredOrders.map((o) => {
      const rider = riders.find((r) => r.id === o.riderId);
      const riderStr = rider ? `${rider.name}\n(${rider.vehicle}) - ${rider.phone}` : 'Não alocado';
      const adminFee = o.value * 0.15;
      const riderShare = o.value * 0.85;

      let paymentStatus = 'Pendente';
      if (o.status === 'Concluído') {
        paymentStatus = 'Liquidado';
      } else if (o.status === 'Cancelado') {
        paymentStatus = 'Estornado';
      }

      return [
        o.id,
        `${o.clientName}\n${o.phone || ''}`,
        `${o.region}\nParceiro: ${getPartnerDisplayName(o.partnerName, clientPartners)}`,
        `R$ ${o.value.toFixed(2).replace('.', ',')}`,
        `R$ ${adminFee.toFixed(2).replace('.', ',')}`,
        `R$ ${riderShare.toFixed(2).replace('.', ',')}`,
        riderStr,
        paymentStatus
      ];
    });

    autoTable(doc, {
      head: pdfHeaders,
      body: pdfBody,
      startY: 53,
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59] }, // Slate-800 header matching theme
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: 15, fontStyle: 'bold' },
        1: { cellWidth: 35 },
        2: { cellWidth: 35 },
        3: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
        4: { cellWidth: 25, halign: 'right' },
        5: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
        6: { cellWidth: 50 },
        7: { cellWidth: 25, halign: 'center', fontStyle: 'bold' }
      }
    });

    const docFilename = `vinimap_relatorio_financeiro_${timestamp.replace(/[\s,:/]/g, '_')}.pdf`;
    doc.save(docFilename);
  };

  const handleExportFinanceBoth = () => {
    handleExportFinanceExcel();
    setTimeout(() => {
      handleExportFinancePDF();
    }, 400);
  };

  const renderCepQueryCard = () => (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-4">
      <div>
        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
          <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
            <Search size={14} />
          </div>
          Consulta Geral de CEP (Fretes)
        </h3>
        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
          Encontre instantaneamente quais parceiros atendem a um determinado CEP e qual é a taxa de frete correspondente.
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          maxLength={9}
          value={unifiedQueryCep}
          onChange={(e) => {
            const val = e.target.value;
            const cleaned = val.replace(/\D/g, '');
            if (cleaned.length === 8) {
              setUnifiedQueryCep(`${cleaned.substring(0, 5)}-${cleaned.substring(5)}`);
            } else {
              setUnifiedQueryCep(val);
            }
          }}
          placeholder="Ex: 01311-200"
          className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-slate-700 font-bold placeholder-slate-300"
        />

        {/* Search Results */}
        {unifiedQueryCep.replace(/\D/g, '').length === 8 ? (() => {
          const cleanTarget = unifiedQueryCep.replace(/\D/g, '');
          const targetNum = parseInt(cleanTarget, 10);
          
          const matchingPartners = clientPartners.map(cp => {
            const match = (cp.cepRanges || []).find(r => {
              const startNum = parseInt(r.cepStart.replace(/\D/g, ''), 10);
              const endNum = parseInt(r.cepEnd.replace(/\D/g, ''), 10);
              return targetNum >= startNum && targetNum <= endNum;
            });
            return { partner: cp, range: match };
          }).filter(item => item.range !== undefined);

          if (matchingPartners.length === 0) {
            return (
              <div className="p-3.5 bg-red-50/70 border border-red-100 rounded-xl text-[11px] text-red-800 font-semibold flex gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5 text-red-500" />
                <span>Nenhum cliente parceiro cadastrado atende a faixa correspondente a este CEP no momento.</span>
              </div>
            );
          }

          return (
            <div className="space-y-2.5">
              <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Parceiros com Cobertura:</p>
              <div className="divide-y divide-slate-150 max-h-[180px] overflow-y-auto pr-1">
                {matchingPartners.map(({ partner, range }) => (
                  <div key={partner.id} className="py-2.5 flex items-center justify-between gap-3 text-xs font-semibold">
                    <div className="min-w-0">
                      <p className="text-slate-800 font-bold truncate">{partner.name}</p>
                      <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                        {range?.description || 'Região'} ({range?.cepStart} - {range?.cepEnd})
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-emerald-600 font-extrabold text-xs block">
                        {range?.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                      {range?.driverRepass !== undefined ? (
                        <span className="text-[10px] font-bold text-slate-500 block">
                          Repasse: {range.driverRepass.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-300 font-normal italic block">
                          Repasse padrão %
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })() : unifiedQueryCep.trim() !== '' ? (
          <div className="text-[10px] text-slate-400 font-medium italic text-center py-2">
            Digite 8 dígitos para consultar a tabela de frete...
          </div>
        ) : null}
      </div>
    </div>
  );

  if (isStandaloneRider) {
    return (
      <div className="flex h-screen h-[100dvh] w-screen bg-slate-900 overflow-hidden font-sans antialiased text-slate-100">
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <main className="flex-1 overflow-hidden p-0">
            <RiderAppSimulator
              riders={riders}
              orders={orders}
              clientPartners={clientPartners}
              activeHub={companyHubs.find(h => h.active)}
              onUpdateRiderCoords={handleUpdateRiderCoords}
              onUpdateOrderStatus={handleUpdateStatus}
              onSaveLogs={(newLogs) => {
                if (newLogs.length > 0) {
                  dbBulkSaveActivityLogs(newLogs);
                }
              }}
              onUpdateOrders={(updatedOrders) => {
                setOrders(prev => {
                  const updatedIds = new Set(updatedOrders.map(o => o.id));
                  return [
                    ...updatedOrders,
                    ...prev.filter(o => !updatedIds.has(o.id))
                  ];
                });
                dbBulkSaveOrders(updatedOrders);
              }}
              showRiderEarnings={showRiderEarnings}
              activeRiderId={selectedRiderId}
              onActiveRiderChange={setSelectedRiderId}
              isStandalone={true}
              isRealDevice={isRealDeviceMode}
            />
          </main>
        </div>
      </div>
    );
  }

  if (!isAdminAuthenticated) {
    if (authChecking) {
      return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-semibold">Carregando...</div>;
    }
    return (
      <AdminLogin 
        onSuccess={() => {
          localStorage.removeItem('vinimap_logged_out');
          localStorage.setItem('vinimap_admin_session', 'true');
          setIsAdminAuthenticated(true);
        }} 
      />
    );
  }
  return (
    <div className="flex h-screen w-screen bg-slate-50/50 overflow-hidden font-sans antialiased text-slate-800">
      
      {/* Dynamic Left Sidebar Menu Navigation */}
      <Sidebar activeSection={activeSection} setActiveSection={setActiveSection} activeHub={companyHubs.find(h => h.active)} />

      {/* Main Control Panel Stage */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* Top Header controls */}
        <Header 
          searchQuery={searchQuery} 
          onSearchChange={setSearchQuery} 
          onNewOrderClick={() => setIsNewOrderOpen(true)} 
          onLogout={handleLogout}
          onExportContingency={() => exportDatabaseContingency(false)}
          lastContingencyTime={lastContingencyBackupTime}
          activeHub={companyHubs.find(h => h.active)}
        />

        {/* Scrollable Stage area */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">

          <AnimatePresence mode="wait">
            
            {/* VIEW 1: MAIN DASHBOARD */}
            {activeSection === 'dashboard' && (
              <motion.div
                key="dashboard-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
                id="view-dashboard"
              >
                {/* Custom Vinimap operational greeting banner */}
                <div className="p-5 md:p-6 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 text-white rounded-2xl shadow-lg shadow-blue-100/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative overflow-hidden group">
                  {/* Visual mesh texture decor */}
                  <div className="absolute inset-0 bg-grid-white opacity-[0.06] pointer-events-none" />
                  <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl group-hover:scale-125 transition-transform" />
                  
                  <div className="space-y-1.5 relative z-10 max-w-2xl">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-blue-200 animate-pulse" />
                      <span className="text-[10px] font-bold tracking-widest uppercase bg-white/20 backdrop-blur-xs px-2.5 py-0.5 rounded-full border border-white/10">Operação Logística</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white drop-shadow-xs">Painel de Controle Vinimap</h2>
                    <p className="text-xs sm:text-sm text-blue-100 font-medium leading-relaxed">Todas as frotas e fluxos de despacho operando sob conformidade de rotas recomendadas.</p>
                  </div>

                  {/* Operational quick controls inside banner */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3.5 relative z-10 shrink-0 w-full sm:w-auto">
                    <button 
                      onClick={triggerOptimization}
                      disabled={optimizing}
                      className="w-full sm:w-auto px-5 py-2.5 bg-white text-blue-700 hover:bg-blue-50 active:bg-blue-100 border border-transparent text-xs font-extrabold uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                      id="opt-routes-banner-btn"
                    >
                      <Zap size={15} className={optimizing ? 'animate-spin text-amber-500' : 'text-blue-600'} />
                      <span>{optimizing ? 'Recalculando...' : 'Otimizar Rotas'}</span>
                    </button>
                    <button 
                      onClick={handleResetDemoState}
                      className="w-full sm:w-auto px-3.5 py-2.5 bg-white/15 hover:bg-white/25 active:bg-white/30 text-white border border-white/25 rounded-xl transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2 text-xs font-bold"
                      title="Reiniciar Dados Mockados"
                      id="reset-state-banner-btn"
                    >
                      <RotateCcw size={15} />
                      <span className="sm:hidden text-[11px] font-extrabold uppercase tracking-wider">Resetar Dados</span>
                    </button>
                  </div>
                </div>

                {optSuccess && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-3.5 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2"
                  >
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <span>Algoritmo de rotas recalibrado! Distâncias de entrega reduzidas em média 14% para os entregadores em rota.</span>
                  </motion.div>
                )}

                <LiveHealthScore orders={orders} riders={riders} />

                {/* Delayed Orders / Previous Days Alert Card */}
                {orders.filter(o => o.date < todayStr && o.status !== 'Concluído' && o.status !== 'Cancelado').length > 0 && (
                  <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
                    filterShowDelayed 
                      ? 'bg-amber-500 text-white border-amber-600 shadow-md shadow-amber-100' 
                      : 'bg-rose-50 border-rose-100 text-rose-800'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${filterShowDelayed ? 'bg-white/20' : 'bg-rose-500/10'}`}>
                        <AlertTriangle size={20} className={filterShowDelayed ? 'text-white' : 'text-rose-600'} />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">
                          {filterShowDelayed 
                            ? 'Filtro Ativo: Exibindo Pedidos Atrasados + Pedidos de Hoje' 
                            : `Atenção: Existem ${orders.filter(o => o.date < todayStr && o.status !== 'Concluído' && o.status !== 'Cancelado').length} pedidos atrasados de dias anteriores.`
                          }
                        </h4>
                        <p className={`text-xs ${filterShowDelayed ? 'text-amber-100' : 'text-slate-500'} mt-0.5`}>
                          {filterShowDelayed 
                            ? 'Bypass de data ativo. O sistema está exibindo entregas pendentes de dias anteriores acumuladas junto com as entregas de hoje para tratamento.' 
                            : 'Estes pedidos não foram concluídos e precisam de triagem/despacho imediato.'
                          }
                        </p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => {
                        setFilterShowDelayed(!filterShowDelayed);
                        if (!filterShowDelayed) {
                          setActiveSection('pedidos');
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all shadow-sm hover:shadow shrink-0 cursor-pointer ${
                        filterShowDelayed 
                          ? 'bg-white text-amber-700 hover:bg-slate-100' 
                          : 'bg-rose-600 text-white hover:bg-rose-700'
                      }`}
                    >
                      {filterShowDelayed ? 'Mostrar Apenas Pedidos de Hoje' : 'Visualizar Pedidos Atrasados'}
                    </button>
                  </div>
                )}

                {/* Global Filters bar at the top of Dashboard */}
                <GlobalFilters
                  filterDateFrom={filterDateFrom}
                  setFilterDateFrom={setFilterDateFrom}
                  filterDateTo={filterDateTo}
                  setFilterDateTo={setFilterDateTo}
                  filterPartner={filterPartner}
                  setFilterPartner={setFilterPartner}
                  filterRiderId={filterRiderId}
                  setFilterRiderId={setFilterRiderId}
                  filterStatus={filterStatus}
                  setFilterStatus={setFilterStatus}
                  filterCep={filterCep}
                  setFilterCep={setFilterCep}
                  riders={riders}
                  clientPartners={clientPartners}
                  onClearFilters={handleClearFilters}
                />

                {/* 6 Key Performance Indicators Section */}
                <KPISection 
                  orders={filteredOrders} 
                  activeTab={activeOrderTab}
                  onCardClick={(status) => {
                    setActiveOrderTab(status);
                    setActiveSection('pedidos');
                  }}
                />

                {/* Grid for Regional bars & Revenue charts */}
                <ChartsSection 
                  chartData={dynamicChartData} 
                  regions={dynamicRegions} 
                  orders={filteredOrders}
                  filterDateFrom={filterDateFrom}
                  filterDateTo={filterDateTo}
                  onNavigateToOrdersWithSearch={(query) => {
                    setSearchQuery(query);
                    setActiveSection('pedidos');
                  }}
                />

                {/* Orders Card right below Dashboard */}
                <div className="pt-2">
                  <OrdersTable 
                    orders={filteredOrders} 
                    riders={riders} 
                    clientPartners={clientPartners}
                    onUpdateStatus={handleUpdateStatus} 
                    onAssignRider={handleAssignRider}
                    searchQuery={searchQuery}
                    activeTab={activeOrderTab}
                    setActiveTab={setActiveOrderTab}
                    onUpdateOrder={handleUpdateOrder}
                    onDeleteOrder={handleDeleteOrder}
                    onBulkUpdateStatus={handleBulkUpdateStatus}
                    onBulkAssignRider={handleBulkAssignRider}
                    onBulkDelete={handleBulkDelete}
                    onBulkCreate={handleBulkCreate}
                    onBulkEdit={handleBulkEdit}
                  />
                </div>
              </motion.div>
            )}

            {/* VIEW 2: FULL FOCUSED ORDERS SCREEN */}
            {activeSection === 'pedidos' && (
              <motion.div
                key="pedidos-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="w-full space-y-6"
                id="view-pedidos"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 border border-slate-100 rounded-2xl shadow-sm">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Central de Pedidos</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Gestão de faturamento, triagem, filtros avançados e despacho de encomendas.</p>
                  </div>

                  {filterPartner && (
                    <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl">
                      <span className="text-xs font-bold text-blue-800">Parceiro Filtrado: {filterPartner}</span>
                      <button 
                        onClick={() => setFilterPartner('')}
                        className="text-blue-600 hover:text-blue-900 font-extrabold text-xs ml-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                {/* Global FiltersBar for Pedidos screen */}
                <GlobalFilters
                  filterDateFrom={filterDateFrom}
                  setFilterDateFrom={setFilterDateFrom}
                  filterDateTo={filterDateTo}
                  setFilterDateTo={setFilterDateTo}
                  filterPartner={filterPartner}
                  setFilterPartner={setFilterPartner}
                  filterRiderId={filterRiderId}
                  setFilterRiderId={setFilterRiderId}
                  filterStatus={filterStatus}
                  setFilterStatus={setFilterStatus}
                  filterCep={filterCep}
                  setFilterCep={setFilterCep}
                  riders={riders}
                  clientPartners={clientPartners}
                  onClearFilters={handleClearFilters}
                />

                {/* Delayed Orders / Previous Days Alert Card */}
                {orders.filter(o => o.date < todayStr && o.status !== 'Concluído' && o.status !== 'Cancelado').length > 0 && (
                  <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
                    filterShowDelayed 
                      ? 'bg-amber-500 text-white border-amber-600 shadow-md shadow-amber-100' 
                      : 'bg-rose-50 border-rose-100 text-rose-800'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${filterShowDelayed ? 'bg-white/20' : 'bg-rose-500/10'}`}>
                        <AlertTriangle size={20} className={filterShowDelayed ? 'text-white' : 'text-rose-600'} />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">
                          {filterShowDelayed 
                            ? 'Filtro Ativo: Exibindo Pedidos Atrasados + Pedidos de Hoje' 
                            : `Atenção: Existem ${orders.filter(o => o.date < todayStr && o.status !== 'Concluído' && o.status !== 'Cancelado').length} pedidos atrasados de dias anteriores.`
                          }
                        </h4>
                        <p className={`text-xs ${filterShowDelayed ? 'text-amber-100' : 'text-slate-500'} mt-0.5`}>
                          {filterShowDelayed 
                            ? 'Bypass de data ativo. O sistema está exibindo entregas pendentes de dias anteriores acumuladas junto com as entregas de hoje para tratamento.' 
                            : 'Estes pedidos não foram concluídos e precisam de triagem/despacho imediato.'
                          }
                        </p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => setFilterShowDelayed(!filterShowDelayed)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all shadow-sm hover:shadow shrink-0 cursor-pointer ${
                        filterShowDelayed 
                          ? 'bg-white text-amber-700 hover:bg-slate-100' 
                          : 'bg-rose-600 text-white hover:bg-rose-700'
                      }`}
                    >
                      {filterShowDelayed ? 'Mostrar Apenas Pedidos de Hoje' : 'Visualizar Pedidos Atrasados'}
                    </button>
                  </div>
                )}

                <OrdersTable 
                  orders={filteredOrders} 
                  riders={riders} 
                  clientPartners={clientPartners}
                  onUpdateStatus={handleUpdateStatus} 
                  onAssignRider={handleAssignRider}
                  searchQuery={searchQuery}
                  activeTab={activeOrderTab}
                  setActiveTab={setActiveOrderTab}
                  onUpdateOrder={handleUpdateOrder}
                  onDeleteOrder={handleDeleteOrder}
                  onBulkUpdateStatus={handleBulkUpdateStatus}
                  onBulkAssignRider={handleBulkAssignRider}
                  onBulkDelete={handleBulkDelete}
                  onBulkCreate={handleBulkCreate}
                  onBulkEdit={handleBulkEdit}
                />
              </motion.div>
            )}

            {/* VIEW 3: UNIFIED ADMINISTRATIVE PANEL */}
            {activeSection === 'admin' && (() => {
              const totalRev = filteredOrders.reduce((sum, o) => {
                if (o.status !== 'Cancelado') {
                  return sum + o.value;
                }
                return sum;
              }, 0);
              const systemRevenue = totalRev * 0.15;
              const ridersEarnings = totalRev * 0.85;
              const avgTicket = totalRev / (filteredOrders.filter(o => o.status !== 'Cancelado').length || 1);
              
              // Calculate Month-over-Month growth for orders revenue (Current Month July vs June baseline)
              const juneOrdersBaseline = 1020.00;
              const momGrowthPercent = ((totalRev - juneOrdersBaseline) / juneOrdersBaseline) * 100;

              // Filtered clients & partners
              const filteredClients = clientPartners.filter(cp => {
                const matchesSearch = cp.name.toLowerCase().includes(searchClientQuery.toLowerCase()) ||
                  cp.tel.includes(searchClientQuery) ||
                  cp.region.toLowerCase().includes(searchClientQuery.toLowerCase()) ||
                  cp.addr.toLowerCase().includes(searchClientQuery.toLowerCase()) ||
                  (cp.cnpj && cp.cnpj.toLowerCase().includes(searchClientQuery.toLowerCase()));
                
                const matchesType = selectedClientType === 'Todos' || cp.type === selectedClientType;
                return matchesSearch && matchesType;
              });

              // Filtered riders
              const filteredRiders = (riders || []).filter(r => {
                if (!r) return false;
                const name = (r.name || '').toLowerCase();
                const phone = (r.phone || '');
                const vehicle = (r.vehicle || '').toLowerCase();
                const search = (searchRiderQuery || '').toLowerCase();
                return name.includes(search) || phone.includes(search) || vehicle.includes(search);
              });

              return (
                <motion.div
                  key="admin-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="space-y-6"
                  id="view-admin"
                >
                  {/* Admin Navigation Tab Selector */}
                  <div className="bg-white border border-slate-100 p-2 rounded-2xl shadow-xs flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setAdminTab('financeiro')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                          adminTab === 'financeiro'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                            : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                        }`}
                      >
                        <Wallet size={15} />
                        <span>Financeiro</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAdminTab('relatorios')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                          adminTab === 'relatorios'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                            : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                        }`}
                      >
                        <BarChart3 size={15} />
                        <span>Relatórios & Performance</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAdminTab('clientes')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                          adminTab === 'clientes'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                            : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                        }`}
                      >
                        <Building2 size={15} />
                        <span>Clientes & Parceiros</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAdminTab('condutores')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                          adminTab === 'condutores'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                            : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                        }`}
                      >
                        <Truck size={15} />
                        <span>Condutores & Frota</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAdminTab('sede')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                          adminTab === 'sede'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                            : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                        }`}
                      >
                        <MapPin size={15} />
                        <span>Sede ViniMap</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAdminTab('logo_sede')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                          adminTab === 'logo_sede'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                            : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                        }`}
                      >
                        <ImageIcon size={15} />
                        <span>Logo da Sede</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAdminTab('notificacoes')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                          adminTab === 'notificacoes'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                            : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                        }`}
                      >
                        <BellRing size={15} />
                        <span>Mensagens & Notificações</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAdminTab('supabase')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                          adminTab === 'supabase'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                            : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                        }`}
                      >
                        <Database size={15} />
                        <span>Banco Supabase</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAdminTab('github')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                          adminTab === 'github'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                            : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                        }`}
                      >
                        <GitBranch size={15} />
                        <span>Integração GitHub</span>
                      </button>
                    </div>
                  </div>

                  {/* TAB 1: FINANCEIRO */}
                  {adminTab === 'financeiro' && (
                    <div className="space-y-6">
                      {/* Sub-tab Navigation */}
                      <div className="flex bg-slate-100 p-1 rounded-xl self-start gap-1 max-w-md">
                        <button
                          onClick={() => setFinanceSubTab('repasses')}
                          className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                            financeSubTab === 'repasses'
                              ? 'bg-white text-blue-700 shadow-xs'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          <Coins size={13} />
                          <span>Faturamento & Repasses</span>
                        </button>
                        <button
                          onClick={() => setFinanceSubTab('contas')}
                          className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                            financeSubTab === 'contas'
                              ? 'bg-white text-blue-700 shadow-xs'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          <Wallet size={13} />
                          <span>Contas a Pagar & Receber</span>
                        </button>
                      </div>

                      {financeSubTab === 'repasses' ? (
                        <div className="space-y-6">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                          <h3 className="text-base font-bold text-slate-800">Faturamento & Repasses</h3>
                          <p className="text-xs text-slate-400">Distribuição financeira das entregas e comissão da plataforma.</p>
                        </div>

                        {/* Export Button with Dropdown Options */}
                        <div className="relative shrink-0">
                          <button
                            onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-blue-100"
                            id="exportar-relatorio-btn"
                          >
                            <Download size={14} />
                            <span>Exportar Relatório</span>
                            <ChevronDown size={14} className={`transition-transform duration-200 ${isExportDropdownOpen ? 'rotate-180' : ''}`} />
                          </button>

                          {isExportDropdownOpen && (
                            <>
                              <div 
                                className="fixed inset-0 z-10" 
                                onClick={() => setIsExportDropdownOpen(false)} 
                              />
                              <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-100 rounded-xl shadow-lg py-1.5 z-20 origin-top-right">
                                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 mb-1">
                                  Formatos Disponíveis
                                </div>
                                <button
                                  onClick={() => {
                                    handleExportFinancePDF();
                                    setIsExportDropdownOpen(false);
                                  }}
                                  className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                                >
                                  <FileText size={14} className="text-red-500" />
                                  <span>Exportar Relatório em PDF</span>
                                </button>
                                <button
                                  onClick={() => {
                                    handleExportFinanceExcel();
                                    setIsExportDropdownOpen(false);
                                  }}
                                  className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                                >
                                  <FileSpreadsheet size={14} className="text-emerald-600" />
                                  <span>Exportar Relatório em Excel</span>
                                </button>
                                <div className="h-px bg-slate-50 my-1" />
                                <button
                                  onClick={() => {
                                    handleExportFinanceBoth();
                                    setIsExportDropdownOpen(false);
                                  }}
                                  className="w-full px-4 py-2 text-left text-xs font-semibold text-blue-600 hover:bg-blue-50/50 flex items-center gap-2.5 transition-colors"
                                >
                                  <Download size={14} />
                                  <span>Exportar Ambos</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Sparkline cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {/* Faturamento Est. */}
                        <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-5 rounded-2xl relative overflow-hidden shadow-md shadow-blue-100/50">
                          <div className="absolute bottom-0 right-0 left-0 h-12 overflow-hidden opacity-30 pointer-events-none">
                            <svg viewBox="0 0 120 30" width="100%" height="100%" preserveAspectRatio="none">
                              <path d="M 0 30 Q 15 25, 30 15 T 60 12 T 90 5 T 120 2" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                            </svg>
                          </div>
                          <div className="flex items-center justify-between relative z-10">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-100">Faturamento Est.</span>
                            <div className="p-1.5 rounded-xl bg-white/10 text-white shrink-0">
                              <Coins size={14} />
                            </div>
                          </div>
                          <div className="mt-3 relative z-10">
                            <span className="text-xl lg:text-2xl font-extrabold tracking-tight">
                              {totalRev.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                          <div className="mt-1 relative z-10 flex items-center gap-1">
                            <TrendingUp size={10} className="text-emerald-300" />
                            <span className="text-[9px] font-bold text-blue-100">
                              Ativo • Atualizado agora
                            </span>
                          </div>
                        </div>

                        {/* Ticket Médio */}
                        <div className="bg-white border border-slate-100 p-5 rounded-2xl relative overflow-hidden shadow-sm">
                          <div className="absolute bottom-0 right-0 left-0 h-12 overflow-hidden opacity-20 pointer-events-none">
                            <svg viewBox="0 0 120 30" width="100%" height="100%" preserveAspectRatio="none">
                              <path d="M 0 25 Q 15 10, 30 15 T 60 22 T 90 12 T 120 5" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          </div>
                          <div className="flex items-center justify-between relative z-10">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ticket Médio</span>
                            <div className="p-1.5 rounded-xl bg-blue-50 text-blue-600 shrink-0">
                              <LineChart size={14} />
                            </div>
                          </div>
                          <div className="mt-3 relative z-10">
                            <span className="text-xl lg:text-2xl font-extrabold text-slate-800 tracking-tight">
                              {avgTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                          <div className="mt-1 relative z-10 flex items-center gap-1">
                            <span className="text-[9px] font-bold text-slate-400">
                              Média por entrega ativa
                            </span>
                          </div>
                        </div>

                        {/* Taxa Admin (15%) */}
                        <div className="bg-white border border-slate-100 p-5 rounded-2xl relative overflow-hidden shadow-sm">
                          <div className="absolute bottom-0 right-0 left-0 h-12 overflow-hidden opacity-20 pointer-events-none">
                            <svg viewBox="0 0 120 30" width="100%" height="100%" preserveAspectRatio="none">
                              <path d="M 0 10 Q 15 20, 30 15 T 60 8 T 90 14 T 120 2" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          </div>
                          <div className="flex items-center justify-between relative z-10">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Retenção Admin (15%)</span>
                            <div className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                              <Sparkles size={14} />
                            </div>
                          </div>
                          <div className="mt-3 relative z-10">
                            <span className="text-xl lg:text-2xl font-extrabold text-emerald-600 tracking-tight">
                              {systemRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                          <div className="mt-1 relative z-10 flex items-center gap-1">
                            <span className="text-[9px] font-bold text-slate-400">
                              Taxa de intermediação do OS
                            </span>
                          </div>
                        </div>

                        {/* Repasse Entregadores (85%) */}
                        <div className="bg-white border border-slate-100 p-5 rounded-2xl relative overflow-hidden shadow-sm">
                          <div className="absolute bottom-0 right-0 left-0 h-12 overflow-hidden opacity-20 pointer-events-none">
                            <svg viewBox="0 0 120 30" width="100%" height="100%" preserveAspectRatio="none">
                              <path d="M 0 25 Q 15 15, 30 5 T 60 12 T 90 18 T 120 10" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          </div>
                          <div className="flex items-center justify-between relative z-10">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Repasse Moto/Bike (85%)</span>
                            <div className="p-1.5 rounded-xl bg-violet-50 text-violet-600 shrink-0">
                              <Users size={14} />
                            </div>
                          </div>
                          <div className="mt-3 relative z-10">
                            <span className="text-xl lg:text-2xl font-extrabold text-violet-600 tracking-tight">
                              {ridersEarnings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                          <div className="mt-1 relative z-10 flex items-center gap-1">
                            <span className="text-[9px] font-bold text-slate-400">
                              Ganhos totais repassados
                            </span>
                          </div>
                        </div>

                        {/* Crescimento da Receita MoM (Orders) */}
                        <div className="bg-white border border-slate-100 p-5 rounded-2xl relative overflow-hidden shadow-sm flex flex-col justify-between">
                          <div className="flex items-center justify-between relative z-10">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Crescimento MoM</span>
                            <div className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                              <TrendingUp size={14} />
                            </div>
                          </div>
                          <div className="mt-3 relative z-10">
                            <span className="text-xl lg:text-2xl font-extrabold text-emerald-600 tracking-tight block">
                              {momGrowthPercent >= 0 ? '+' : ''}{momGrowthPercent.toFixed(1)}%
                            </span>
                          </div>
                          <div className="mt-1 relative z-10 flex flex-col gap-0.5 text-[9px] text-slate-400">
                            <span className="block">Mês Ant. (Jun): R$ 1.020,00</span>
                            <span className="block font-bold text-slate-500">Mês Atual (Jul): {totalRev.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                          </div>
                          <div className="absolute bottom-0 right-0 left-0 h-10 overflow-hidden opacity-10 pointer-events-none">
                            <svg viewBox="0 0 120 30" width="100%" height="100%" preserveAspectRatio="none">
                              <path d="M 0 30 Q 15 20, 30 15 T 60 8 T 90 14 T 120 2" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      {/* Revenue by Partner Chart */}
                      <RevenueByPartnerChart 
                        orders={filteredOrders} 
                        clientPartners={clientPartners} 
                      />

                      {/* Detailed Operational Ledger */}
                      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-4">
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm">Extrato Operacional Detalhado</h4>
                          <p className="text-xs text-slate-400 mt-0.5">Demonstrativo financeiro individualizado de todos os lançamentos.</p>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs text-slate-600 border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 text-left text-[10px] uppercase">
                                <th className="px-6 py-3">ID Pedido</th>
                                <th className="px-6 py-3">Cliente</th>
                                <th className="px-6 py-3">Região</th>
                                <th className="px-6 py-3 text-right">Valor Total</th>
                                <th className="px-6 py-3 text-right">Taxa Admin (15%)</th>
                                <th className="px-6 py-3 text-right">Repasse (85%)</th>
                                <th className="px-6 py-3">Entregador</th>
                                <th className="px-6 py-3 text-center">Status Lançamento</th>
                                <th className="px-6 py-3 text-center">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                              {filteredOrders.length === 0 ? (
                                <tr>
                                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400 font-semibold">
                                    Nenhum pedido encontrado nos filtros selecionados.
                                  </td>
                                </tr>
                              ) : (
                                filteredOrders.map((o) => {
                                  const rider = riders.find((r) => r.id === o.riderId);
                                  const adminFee = o.value * 0.15;
                                  const riderShare = o.value * 0.85;
                                  
                                  let statusBadge = (
                                    <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full text-[9px] font-bold">
                                      Pendente
                                    </span>
                                  );
                                  if (o.status === 'Concluído') {
                                    statusBadge = (
                                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full text-[9px] font-bold">
                                        Liquidado
                                      </span>
                                    );
                                  } else if (o.status === 'Cancelado') {
                                    statusBadge = (
                                      <span className="bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full text-[9px] font-bold">
                                        Estornado
                                      </span>
                                    );
                                  }

                                  return (
                                    <tr key={o.id} className="hover:bg-slate-50/40 transition-colors">
                                      <td className="px-6 py-4 font-mono font-bold text-slate-800">{o.id}</td>
                                      <td className="px-6 py-4 font-medium">{o.clientName}</td>
                                      <td className="px-6 py-4">
                                        <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded font-extrabold uppercase">
                                          {o.region}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4 text-right font-mono font-bold text-slate-800">
                                        {o.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                      </td>
                                      <td className="px-6 py-4 text-right font-mono text-slate-500">
                                        {adminFee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                      </td>
                                      <td className="px-6 py-4 text-right font-mono text-violet-600 font-bold">
                                        {riderShare.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                      </td>
                                      <td className="px-6 py-4">
                                        {rider ? (
                                          <div className="flex items-center gap-1.5">
                                            <img src={rider.avatar} className="w-5 h-5 rounded-full object-cover" />
                                            <span className="font-bold text-slate-700 text-[11px]">{rider.name}</span>
                                          </div>
                                        ) : (
                                          <span className="text-slate-400 font-medium">Sem entregador</span>
                                        )}
                                      </td>
                                      <td className="px-6 py-4 text-center">{statusBadge}</td>
                                      <td className="px-6 py-4 text-center">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (window.confirm(`Tem certeza que deseja excluir permanentemente o pedido #${o.id}?`)) {
                                              handleDeleteOrder(o.id);
                                            }
                                          }}
                                          className="p-1.5 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 border border-slate-200 hover:border-rose-100 text-slate-400 rounded-lg transition-all cursor-pointer"
                                          title="Excluir Pedido"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <ContasPagarReceber
                      transactions={financialTransactions}
                      onUpdateTransactions={handleUpdateFinancialTransactions}
                      orders={orders}
                      clientPartners={clientPartners}
                      onDeleteOrder={handleDeleteOrder}
                    />
                  )}
                </div>
              )}

                  {/* TAB 2: RELATORIOS */}
                  {adminTab === 'relatorios' && (
                    <div className="space-y-6">
                      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                          <div>
                            <h3 className="text-sm font-bold text-slate-800">SLA Operacional & Performance Geral</h3>
                            <p className="text-[11px] text-slate-400 mt-0.5">Indicadores chave de cumprimento de prazos de entrega e SLA de hoje.</p>
                          </div>
                          <span className="px-2 py-0.5 text-[9px] font-bold bg-slate-50 text-slate-500 rounded-full border border-slate-150">
                            Atualizado em tempo real
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-xl">
                            <span className="text-[10px] text-emerald-600 font-extrabold block uppercase tracking-wider">SLA Geral (Hoje)</span>
                            <span className="text-xl font-extrabold text-emerald-700">98.2%</span>
                          </div>
                          <div className="p-4 bg-blue-50/40 border border-blue-100 rounded-xl">
                            <span className="text-[10px] text-blue-600 font-extrabold block uppercase tracking-wider">Entregas no Tempo Estimado</span>
                            <span className="text-xl font-extrabold text-blue-700">95.4%</span>
                          </div>
                          <div className="p-4 bg-amber-50/40 border border-amber-100 rounded-xl">
                            <span className="text-[10px] text-amber-600 font-extrabold block uppercase tracking-wider">Avaliação Média Clientes</span>
                            <span className="text-xl font-extrabold text-amber-750">4.89 / 5.0</span>
                          </div>
                        </div>
                      </div>

                      <AdvancedReports 
                        orders={orders} 
                        riders={riders} 
                        clientPartners={clientPartners}
                        onUpdateRider={handleUpdateRider}
                      />
                    </div>
                  )}

                  {/* TAB 3: CADASTRO DE CLIENTES PARCEIROS */}
                  {adminTab === 'clientes' && (
                    <div className="space-y-6 w-full">
                      
                      {/* Resumo Mensal por Parceiro */}
                      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <h3 className="font-bold text-slate-800 text-sm">Resumo Mensal de Desempenho por Parceiro</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Indicadores de volume de entregas e taxas de frete médias calculados automaticamente para este mês ({getPortugueseMonthName()}).</p>
                          </div>
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full uppercase tracking-wider self-start sm:self-center">
                            Mês de Referência: {getPortugueseMonthName()}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                          {filteredClients.map(cp => {
                            const currentMonthYear = getSaoPauloISODate() ? getSaoPauloISODate().substring(0, 7) : '';
                            const partnerOrdersInMonth = orders.filter(order => {
                              const matchesPartner = isMatchingClientCode(order.partnerName, cp.id, cp.codigoCliente);
                              const isMonth = !!(order.date && typeof order.date === 'string' && currentMonthYear && order.date.substring(0, 7) === currentMonthYear);
                              return matchesPartner && isMonth;
                            });
                            
                            const totalVolume = partnerOrdersInMonth.length;
                            const nonCancelledOrders = partnerOrdersInMonth.filter(order => order.status !== 'Cancelado');
                            const totalFreight = nonCancelledOrders.reduce((sum, o) => sum + (o.value || 0), 0);
                            const avgFreight = nonCancelledOrders.length > 0 ? totalFreight / nonCancelledOrders.length : 0;
                            
                            return (
                              <div key={cp.id} className="p-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-xl transition-all duration-200 flex flex-col justify-between space-y-3 shadow-xs">
                                <div className="flex justify-between items-start gap-2">
                                  <div className="min-w-0">
                                    <h4 
                                      onClick={() => setBillingModalClientId(cp.id)}
                                      title="Clique para ver o relatório de faturamento do parceiro"
                                      className="font-bold text-slate-800 text-xs truncate hover:text-blue-600 hover:underline cursor-pointer flex items-center gap-1 group/name"
                                    >
                                      {cp.name}
                                      <FileText size={11} className="opacity-0 group-hover/name:opacity-100 transition-opacity text-blue-500 shrink-0" />
                                    </h4>
                                    <span className="text-[10px] font-mono text-slate-400 font-bold block mt-0.5">
                                      ID: {cp.codigoCliente || cp.id}
                                    </span>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase shrink-0 ${
                                    cp.type === 'Parceiro' 
                                      ? 'bg-violet-50 text-violet-700 border border-violet-100' 
                                      : 'bg-blue-50 text-blue-700 border border-blue-100'
                                  }`}>
                                    {cp.type}
                                  </span>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-slate-100">
                                  <div className="min-w-0">
                                    <span className="text-[9px] text-slate-400 font-extrabold block uppercase tracking-wider mb-0.5">Taxa Média</span>
                                    <span className="text-xs font-extrabold text-slate-700 block truncate">
                                      {avgFreight.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-[9px] text-slate-400 font-extrabold block uppercase tracking-wider mb-0.5">Vol. Total</span>
                                    <span className="text-xs font-extrabold text-blue-600 block">
                                      {totalVolume} {totalVolume === 1 ? 'pedido' : 'pedidos'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {filteredClients.length === 0 && (
                            <div className="col-span-full py-8 text-center text-slate-400 text-xs font-medium bg-slate-50/30 rounded-xl border border-dashed border-slate-200">
                              Nenhum parceiro encontrado para exibir o resumo.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Left: Interactive list/table of registered clients */}
                      <div className={`${showClientForm ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-4 transition-all duration-300`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <h3 className="font-bold text-slate-800 text-sm">Clientes Parceiros Cadastrados</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Lista de contas com faturamento ativo e regiões preferenciais.</p>
                          </div>

                          <div className="flex gap-2.5 shrink-0 items-center">
                            <div className="relative">
                              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Buscar cliente..."
                                value={searchClientQuery}
                                onChange={(e) => setSearchClientQuery(e.target.value)}
                                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 w-44"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={async () => {
                                if (window.confirm('Deseja realmente excluir definitivamente todos os clientes parceiros mockados do dashboard e do banco de dados?')) {
                                  try {
                                    await dbPurgeMockClientPartners();
                                    setClientPartners(prev => prev.filter(c => !MOCK_CLIENT_IDS.includes(c.id)));
                                    const logId = generateUniqueLogId();
                                    await dbAddActivityLog({
                                      id: logId,
                                      time: getSaoPauloTime(),
                                      type: 'warning',
                                      message: 'Clientes parceiros mockados foram excluídos permanentemente.',
                                    });
                                    alert('Clientes parceiros mockados foram excluídos com sucesso!');
                                  } catch (err: any) {
                                    alert(`Erro ao excluir parceiros mockados: ${err.message || err}`);
                                  }
                                }
                              }}
                              className="px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/60"
                              title="Excluir Definitivamente Clientes Parceiros Mockados"
                            >
                              <Trash2 size={13} />
                              <span>Excluir Mockados</span>
                            </button>

                            <button
                              onClick={() => setShowClientForm(!showClientForm)}
                              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                                showClientForm 
                                  ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' 
                                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                              }`}
                            >
                              <Plus size={14} className={`transition-transform duration-200 ${showClientForm ? 'rotate-45' : ''}`} />
                              <span>{showClientForm ? 'Fechar Ficha' : 'Cadastrar Novo'}</span>
                            </button>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs text-slate-600 border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 text-left text-[10px] uppercase">
                                <th className="px-4 py-3">Código ID</th>
                                <th className="px-4 py-3">Nome / Empresa</th>
                                <th className="px-4 py-3">CNPJ</th>
                                <th className="px-4 py-3">Tipo</th>
                                <th className="px-4 py-3">Região</th>
                                <th className="px-4 py-3">Telefone</th>
                                <th className="px-4 py-3">Endereço</th>
                                <th className="px-4 py-3 text-center">Status</th>
                                <th className="px-4 py-3 text-center">Notif. Conclusão</th>
                                <th className="px-4 py-3 text-center">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                              {filteredClients.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50/40">
                                  <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500 font-bold">
                                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                      {item.codigoCliente || item.id}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3.5">
                                    <span 
                                      onClick={() => setBillingModalClientId(item.id)}
                                      title="Clique para ver o relatório de faturamento do parceiro"
                                      className="font-bold text-slate-850 hover:text-blue-600 hover:underline cursor-pointer flex items-center gap-1 group/name truncate"
                                    >
                                      {item.name}
                                      <FileText size={11} className="opacity-0 group-hover/name:opacity-100 transition-opacity text-blue-500 shrink-0" />
                                    </span>
                                  </td>
                                  <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500">{item.cnpj || '-'}</td>
                                  <td className="px-4 py-3.5">
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded uppercase bg-violet-50 text-violet-700">
                                      {item.type}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3.5">
                                    <span className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded font-extrabold uppercase">
                                      {item.region}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3.5 font-mono text-[11px]">{item.tel}</td>
                                  <td className="px-4 py-3.5 max-w-[150px] truncate" title={item.addr}>{item.addr}</td>
                                  <td className="px-4 py-3.5 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                                      item.status === 'Adimplente' || item.status === 'Ativo'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                        : 'bg-amber-50 text-amber-700 border border-amber-100'
                                    }`}>
                                      {item.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3.5 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button
                                        onClick={() => {
                                          setSelectedCepRangesClient(item);
                                          setIsCepRangesModalOpen(true);
                                        }}
                                        className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 rounded-lg text-[11px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                                        title="Gerenciar faixas de CEP e tabela de frete"
                                      >
                                        <MapPin size={13} className="text-blue-600" />
                                        <span>Faixas CEP</span>
                                      </button>

                                      <button
                                        onClick={() => {
                                          // Recalculate freight for this client's pending orders
                                          if (item.cepRanges && item.cepRanges.length > 0) {
                                            handleRecalculateOrdersFreight(item.id, item.cepRanges);
                                          } else {
                                            // Open modal to import or manage ranges
                                            setSelectedCepRangesClient(item);
                                            setIsCepRangesModalOpen(true);
                                          }
                                        }}
                                        className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/80 rounded-lg text-[11px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                                        title="Recalcular valor de frete para todos os pedidos pendentes deste parceiro"
                                      >
                                        <RotateCcw size={13} className="text-amber-600" />
                                        <span>Recalcular Lote</span>
                                      </button>

                                      <button
                                        onClick={() => {
                                          setEditingClient(item);
                                          setNewClientName(item.name);
                                          setNewClientCNPJ(item.cnpj || '');
                                          setNewClientRegion(item.region);
                                          setNewClientTel(item.tel);
                                          setNewClientAddr(item.addr);
                                          setNewClientCep(item.cep || '');
                                          setNewClientCidade(item.cidade || 'São Paulo');
                                          setNewClientEstado(item.estado || 'SP');
                                          setNewClientStatus(item.status);
                                          setNewClientEnableNotifications(item.enableCompletionNotifications !== false);
                                          setShowClientForm(true);
                                        }}
                                        className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                                        title="Editar cadastro"
                                      >
                                        <Pencil size={13} />
                                      </button>
                                      <button
                                        onClick={async () => {
                                          if (window.confirm(`Tem certeza que deseja excluir o cliente ${item.name}?`)) {
                                            try {
                                              await dbDeleteClientPartner(item.id);
                                              // add log
                                              const logId = generateUniqueLogId();
                                              await dbAddActivityLog({
                                                id: logId,
                                                time: getSaoPauloTime(),
                                                type: 'warning',
                                                message: `Cliente parceiro removido do cadastro: ${item.name}`,
                                              });
                                            } catch (err: any) {
                                              alert(`Erro ao excluir: ${err.message || err}`);
                                            }
                                          }
                                        }}
                                        className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                                        title="Excluir cadastro"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                              {filteredClients.length === 0 && (
                                <tr>
                                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400 font-medium">
                                    Nenhum cliente parceiro encontrado.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Right: Inline client/partner registration card & Unified Query Stack */}
                      {showClientForm ? (
                        <div className="space-y-6 h-fit lg:col-span-1">
                          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-4">
                            <div>
                              <h3 className="font-bold text-slate-800 text-sm">
                                {editingClient ? 'Editar Cliente Parceiro' : 'Novo Cliente Parceiro'}
                              </h3>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {editingClient ? 'Modifique as informações do ponto de coleta.' : 'Cadastre um novo ponto de coleta e fornecimento de pedidos.'}
                              </p>
                            </div>

                            <form onSubmit={handleCreateClientPartner} className="space-y-3">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nome / Razão Social *</label>
                                <input
                                  type="text"
                                  value={newClientName}
                                  onChange={(e) => setNewClientName(e.target.value)}
                                  placeholder="Ex: Pizzaria Forno de Ouro"
                                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  required
                                  autoFocus
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">CNPJ</label>
                                <input
                                  type="text"
                                  value={newClientCNPJ}
                                  onChange={(e) => setNewClientCNPJ(e.target.value)}
                                  placeholder="Ex: 12.345.678/0001-90"
                                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tipo *</label>
                                  <input
                                    type="text"
                                    value="Cliente Parceiro"
                                    disabled
                                    className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-extrabold focus:outline-none"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Região / Zona *</label>
                                  <select
                                    value={newClientRegion}
                                    onChange={(e) => setNewClientRegion(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  >
                                    <option value="Centro">Centro</option>
                                    <option value="Zona Sul">Zona Sul</option>
                                    <option value="Zona Oeste">Zona Oeste</option>
                                    <option value="Zona Norte">Zona Norte</option>
                                    <option value="Zona Leste">Zona Leste</option>
                                  </select>
                                </div>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Telefone de Contato *</label>
                                <input
                                  type="text"
                                  value={newClientTel}
                                  onChange={(e) => setNewClientTel(e.target.value)}
                                  placeholder="Ex: (11) 98765-4321"
                                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  required
                                />
                              </div>

                              <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-2">
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">CEP de Cadastro *</label>
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      maxLength={9}
                                      value={newClientCep}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const cleaned = val.replace(/\D/g, '');
                                        if (cleaned.length === 8) {
                                          setNewClientCep(`${cleaned.substring(0, 5)}-${cleaned.substring(5)}`);
                                          handleSearchCep(cleaned);
                                        } else {
                                          setNewClientCep(val);
                                        }
                                      }}
                                      onBlur={(e) => {
                                        const cleaned = e.target.value.replace(/\D/g, '');
                                        if (cleaned.length === 8) {
                                          handleSearchCep(cleaned);
                                        }
                                      }}
                                      placeholder="Ex: 01311-200"
                                      className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono font-bold"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSearchCep(newClientCep)}
                                      disabled={isCepSearching}
                                      className="px-2.5 py-2 bg-blue-50 hover:bg-blue-100 disabled:bg-slate-100 disabled:text-slate-400 text-blue-600 border border-blue-100 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0"
                                    >
                                      {isCepSearching ? (
                                        <RefreshCw size={12} className="animate-spin" />
                                      ) : (
                                        <Search size={12} />
                                      )}
                                      <span>Buscar</span>
                                    </button>
                                  </div>
                                  {cepSearchError && (
                                    <span className="text-[9px] font-bold text-rose-500 mt-0.5 block">{cepSearchError}</span>
                                  )}
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">UF / Estado</label>
                                  <input
                                    type="text"
                                    maxLength={2}
                                    value={newClientEstado}
                                    onChange={(e) => setNewClientEstado(e.target.value.toUpperCase())}
                                    placeholder="SP"
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cidade / Município *</label>
                                <input
                                  type="text"
                                  value={newClientCidade}
                                  onChange={(e) => setNewClientCidade(e.target.value)}
                                  placeholder="Ex: São Paulo"
                                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  required
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Endereço Principal (Rua, Nº, Bairro) *</label>
                                <input
                                  type="text"
                                  value={newClientAddr}
                                  onChange={(e) => setNewClientAddr(e.target.value)}
                                  placeholder="Ex: Alameda Tietê, 450 - Jardins"
                                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  required
                                />
                                <p className="text-[9px] text-slate-400 mt-1 leading-relaxed">
                                  Dica: Digite o CEP acima e clique em "Buscar" para preencher Cidade, Estado e Endereço automaticamente.
                                </p>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Status de Faturamento</label>
                                <select
                                  value={newClientStatus}
                                  onChange={(e) => setNewClientStatus(e.target.value)}
                                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                  <option value="Adimplente">Adimplente / Ativo</option>
                                  <option value="Faturamento Mensal">Faturamento Mensal</option>
                                  <option value="Inadimplente">Pendente / Inadimplente</option>
                                </select>
                              </div>

                              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <label htmlFor="newClientEnableNotifications" className="text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                                    {newClientEnableNotifications ? (
                                      <Bell size={13} className="text-emerald-600 shrink-0" />
                                    ) : (
                                      <BellOff size={13} className="text-slate-400 shrink-0" />
                                    )}
                                    <span>Enviar Mensagem de Conclusão</span>
                                  </label>
                                  <input
                                    id="newClientEnableNotifications"
                                    type="checkbox"
                                    checked={newClientEnableNotifications}
                                    onChange={(e) => setNewClientEnableNotifications(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                  />
                                </div>
                                <p className="text-[10px] text-slate-500 leading-tight">
                                  {newClientEnableNotifications 
                                    ? 'Mensagens de conclusão (WhatsApp/E-mail) estão ATIVAS para este parceiro.'
                                    : 'Mensagens de conclusão de pedido estão DESATIVADAS para este parceiro.'}
                                </p>
                              </div>

                              <div className="flex gap-2 pt-2">
                                {editingClient && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingClient(null);
                                      setNewClientName('');
                                      setNewClientCNPJ('');
                                      setNewClientTel('');
                                      setNewClientAddr('');
                                      setNewClientCep('');
                                      setNewClientCidade('São Paulo');
                                      setNewClientEstado('SP');
                                      setNewClientStatus('Adimplente');
                                      setNewClientEnableNotifications(true);
                                      setShowClientForm(false);
                                    }}
                                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer text-center"
                                  >
                                    Cancelar
                                  </button>
                                )}
                                <button
                                  type="submit"
                                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-850 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5"
                                >
                                  <UserPlus size={14} />
                                  <span>{editingClient ? 'Salvar Alterações' : 'Cadastrar Novo Registro'}</span>
                                </button>
                              </div>
                            </form>
                          </div>

                          {renderCepQueryCard()}
                        </div>
                      ) : (
                        <div className="lg:col-span-3">
                          {renderCepQueryCard()}
                        </div>
                      )}
                    </div>
                    </div>
                  )}

                  {/* TAB 4: CADASTRO DE CONDUTORES */}
                  {adminTab === 'condutores' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Left side: interactive list of riders */}
                      <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <h3 className="font-bold text-slate-800 text-sm">Frota de Condutores</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Gestão de entregadores, veículos associados, baterias e desempenho individual.</p>
                          </div>

                          <div className="flex gap-2.5 shrink-0 items-center">
                            <div className="relative">
                              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Buscar condutor..."
                                value={searchRiderQuery}
                                onChange={(e) => setSearchRiderQuery(e.target.value)}
                                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 w-44"
                              />
                            </div>

                            <button
                              onClick={() => setShowRiderForm(!showRiderForm)}
                              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                                showRiderForm 
                                  ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' 
                                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                              }`}
                            >
                              <Plus size={14} className={`transition-transform duration-200 ${showRiderForm ? 'rotate-45' : ''}`} />
                              <span>{showRiderForm ? 'Fechar Ficha' : 'Cadastrar Novo'}</span>
                            </button>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs text-slate-600 border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 text-left text-[10px] uppercase">
                                <th className="px-4 py-3">Entregador</th>
                                <th className="px-4 py-3">Veículo</th>
                                <th className="px-4 py-3">Telefone</th>
                                <th className="px-4 py-3">Endereço</th>
                                <th className="px-4 py-3 text-center">Acesso (Disp/Senha)</th>
                                <th className="px-4 py-3 text-center">Bateria</th>
                                <th className="px-4 py-3 text-center">Entregas</th>
                                <th className="px-4 py-3 text-center">Status</th>
                                <th className="px-4 py-3 text-center">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                              {filteredRiders.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50/40">
                                  <td className="px-4 py-3.5">
                                    <div className="flex items-center gap-2">
                                      <img src={item.avatar} className="w-6 h-6 rounded-full object-cover shrink-0" />
                                      <div className="flex flex-col">
                                        <span 
                                          onClick={() => setBillingModalRiderId(item.id)}
                                          title="Clique para ver o relatório de faturamento do condutor"
                                          className="font-bold text-slate-850 hover:text-blue-600 hover:underline cursor-pointer flex items-center gap-1 group/name truncate"
                                        >
                                          {item.name}
                                          <FileText size={11} className="opacity-0 group-hover/name:opacity-100 transition-opacity text-blue-500 shrink-0" />
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3.5">
                                    <div className="flex flex-col gap-0.5">
                                      <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded font-extrabold uppercase w-fit">
                                        {item.vehicle}
                                      </span>
                                      {item.vehiclePlate && (
                                        <span className="text-[9px] text-slate-500 font-bold font-mono">
                                          Placa: {item.vehiclePlate}
                                        </span>
                                      )}
                                      {item.cnh && (
                                        <span className="text-[9px] text-slate-400 font-semibold">
                                          CNH: {item.cnh}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3.5">
                                    <div className="flex flex-col">
                                      <span className="font-mono text-[11px]">{item.phone || '(11) 99999-8888'}</span>
                                      {item.cpfCnpj && (
                                        <span className="text-[9px] text-slate-400 font-bold">
                                          CPF/CNPJ: {item.cpfCnpj}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3.5 max-w-[150px] truncate" title={item.address}>
                                    <span className="text-slate-500 font-semibold">{item.address || '-'}</span>
                                  </td>
                                  <td className="px-4 py-3.5 text-center">
                                    <div className="inline-flex flex-col items-center">
                                      <span className="font-mono text-[11px] text-slate-700 bg-slate-50 border border-slate-250/30 px-1.5 py-0.5 rounded">
                                        {item.deviceNumber || 'Sem Disp.'}
                                      </span>
                                      <span className="text-[9px] text-slate-400 mt-0.5 font-bold">
                                        Senha: {item.password || '1234'}
                                      </span>
                                      {item.isLoggedIn ? (
                                        <div className="flex items-center gap-1 mt-1">
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[9px] font-extrabold">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                            Logado
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const resetRider = { ...item, isLoggedIn: false, activeDeviceId: undefined };
                                              handleUpdateRider(resetRider);
                                            }}
                                            className="text-[9px] text-rose-600 hover:text-rose-800 underline font-semibold cursor-pointer"
                                            title="Forçar Desconexão de Sessão do Dispositivo"
                                          >
                                            Desconectar
                                          </button>
                                        </div>
                                      ) : (
                                        <span className="text-[8.5px] text-slate-400 mt-0.5">Sessão Inativa</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3.5 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Battery size={12} className={item.batteryPercent <= 20 ? 'text-red-500 animate-pulse' : 'text-slate-400'} />
                                      <span className={`font-mono text-[10px] font-bold ${
                                        item.batteryPercent <= 20 ? 'text-red-600' : 'text-slate-600'
                                      }`}>
                                        {item.batteryPercent}%
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3.5 text-center font-bold text-slate-800">{item.completedDeliveries}</td>
                                  <td className="px-4 py-3.5 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                                      item.status === 'Disponível'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                        : (item.status as string) === 'Entregando'
                                        ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                                    }`}>
                                      {item.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3.5 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button
                                        onClick={() => {
                                          setEditingRider(item);
                                          setNewRiderBillingModel(item.billingModel || 'misto');
                                          setNewRiderBillingFixedFee((item.billingFixedFee ?? 10).toString());
                                          setNewRiderBillingVariablePercent((item.billingVariablePercent ?? 2.5).toString());
                                          setNewRiderBillingFreightPercent((item.billingFreightPercent ?? 80).toString());
                                          setNewRiderName(item.name);
                                          setNewRiderVehicle(item.vehicle);
                                          setNewRiderPhone(item.phone || '');
                                          setNewRiderDeviceNumber(item.deviceNumber || '');
                                          setNewRiderPassword(item.password || '');
                                          setNewRiderAddress(item.address || '');
                                          setNewRiderCpfCnpj(item.cpfCnpj || '');
                                          setNewRiderVehiclePlate(item.vehiclePlate || '');
                                          setNewRiderCnh(item.cnh || '');
                                          setNewRiderExibirValorTurno(item.exibirValorTurno || false);
                                          setNewRiderOcultarValoresProtocolos(item.ocultarValoresProtocolos || false);
                                          setNewRiderAutorizarImprimirRecibo(item.autorizarImprimirRecibo || item.permiteImprimirRecibo || false);
                                          setShowRiderForm(true);
                                        }}
                                        className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                                        title="Editar cadastro"
                                      >
                                        <Pencil size={13} />
                                      </button>
                                      <button
                                        onClick={() => {
                                          setSelectedRiderForInstallId(item.id);
                                          setShowRiderForm(false);
                                        }}
                                        className={`p-1 rounded-lg transition-colors cursor-pointer inline-flex items-center ${
                                          selectedRiderForInstallId === item.id 
                                            ? 'bg-blue-50 text-blue-600' 
                                            : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'
                                        }`}
                                        title="Instalação do Aplicativo (Link/QR)"
                                      >
                                        <QrCode size={13} />
                                      </button>
                                      <button
                                        onClick={async () => {
                                          if (window.confirm(`Deseja realmente remover o condutor ${item.name}?`)) {
                                            try {
                                              await dbDeleteDeliveryRider(item.id);
                                              // add log
                                              const logId = generateUniqueLogId();
                                              await dbAddActivityLog({
                                                id: logId,
                                                time: getSaoPauloTime(),
                                                type: 'warning',
                                                message: `Condutor removido da frota: ${item.name}`,
                                              });
                                            } catch (err: any) {
                                              alert(`Erro ao remover: ${err.message || err}`);
                                            }
                                          }
                                        }}
                                        className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                                        title="Remover condutor"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Right side: Rider registration form */}
                      {showRiderForm && (
                        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-4 h-fit lg:col-span-1">
                          <div>
                            <h3 className="font-bold text-slate-800 text-sm">
                              {editingRider ? 'Editar Condutor' : 'Novo Condutor'}
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {editingRider ? 'Modifique as informações do entregador.' : 'Cadastre um novo entregador na frota operacional.'}
                            </p>
                          </div>

                          <form onSubmit={handleCreateRider} className="space-y-3">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nome Completo *</label>
                              <input
                                  type="text"
                                  value={newRiderName}
                                  onChange={(e) => setNewRiderName(e.target.value)}
                                  placeholder="Ex: João Ferreira de Paula"
                                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  required
                                  autoFocus
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Veículo de Trabalho *</label>
                              <select
                                  value={newRiderVehicle}
                                  onChange={(e) => setNewRiderVehicle(e.target.value)}
                                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="Moto">Moto (Combustão)</option>
                                <option value="Elétrico">Moto Elétrica / Scooter</option>
                                <option value="Bicicleta">Bicicleta / Bike Elétrica</option>
                                <option value="Carro">Van / Carro Utilitário</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Telefone Móvel *</label>
                              <input
                                  type="text"
                                  value={newRiderPhone}
                                  onChange={(e) => setNewRiderPhone(e.target.value)}
                                  placeholder="Ex: (11) 91234-5678"
                                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  required
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">CPF ou CNPJ</label>
                              <input
                                  type="text"
                                  value={newRiderCpfCnpj}
                                  onChange={(e) => setNewRiderCpfCnpj(e.target.value)}
                                  placeholder="Ex: 123.456.789-00 ou 12.345.678/0001-99"
                                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">CNH (Carteira Nacional de Habilitação)</label>
                              <input
                                  type="text"
                                  value={newRiderCnh}
                                  onChange={(e) => setNewRiderCnh(e.target.value)}
                                  placeholder="Ex: 12345678901"
                                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Placa do Veículo</label>
                              <input
                                  type="text"
                                  value={newRiderVehiclePlate}
                                  onChange={(e) => setNewRiderVehiclePlate(e.target.value)}
                                  placeholder="Ex: ABC-1234 ou ABC1D23"
                                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Endereço Completo</label>
                              <input
                                  type="text"
                                  value={newRiderAddress}
                                  onChange={(e) => setNewRiderAddress(e.target.value)}
                                  placeholder="Ex: Av. Paulista, 1000 - Bela Vista, São Paulo - SP"
                                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nº do Dispositivo (Login)</label>
                              <input
                                  type="text"
                                  value={newRiderDeviceNumber}
                                  onChange={(e) => setNewRiderDeviceNumber(e.target.value)}
                                  placeholder="Ex: DISP01 ou 11912345678"
                                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Senha de Acesso (Numérica, até 6 dígitos)</label>
                              <input
                                  type="text"
                                  maxLength={6}
                                  value={newRiderPassword}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    setNewRiderPassword(val);
                                  }}
                                  placeholder="Ex: 1234"
                                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>

                            {/* Opções de Faturamento do Condutor */}
                            <div className="pt-2 border-t border-slate-100 space-y-2">
                              <label className="block text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                                Faturamento & Repasse do Condutor
                              </label>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Modelo de Remuneração</label>
                                <select
                                  value={newRiderBillingModel}
                                  onChange={(e) => setNewRiderBillingModel(e.target.value as BillingModelType)}
                                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-slate-700"
                                >
                                  <option value="misto">Misto (Taxa Fixa + % do Frete)</option>
                                  <option value="fixo">Fixo Apenas (R$ Fixo por Entrega)</option>
                                  <option value="variavel">Comissão Variável (% s/ Valor da Mercadoria)</option>
                                  <option value="frete">Repasse % do Frete</option>
                                </select>
                              </div>

                              {(newRiderBillingModel === 'misto' || newRiderBillingModel === 'fixo') && (
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Taxa Fixa por Entrega (R$)</label>
                                  <input
                                    type="number"
                                    step="0.50"
                                    value={newRiderBillingFixedFee}
                                    onChange={(e) => setNewRiderBillingFixedFee(e.target.value)}
                                    placeholder="10.00"
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                                  />
                                </div>
                              )}

                              {(newRiderBillingModel === 'misto' || newRiderBillingModel === 'frete') && (
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Repasse sobre o Valor do Frete (%)</label>
                                  <input
                                    type="number"
                                    step="1"
                                    value={newRiderBillingFreightPercent}
                                    onChange={(e) => setNewRiderBillingFreightPercent(e.target.value)}
                                    placeholder="80"
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                                  />
                                </div>
                              )}

                              {newRiderBillingModel === 'variavel' && (
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Comissão sobre Valor da Mercadoria (%)</label>
                                  <input
                                    type="number"
                                    step="0.5"
                                    value={newRiderBillingVariablePercent}
                                    onChange={(e) => setNewRiderBillingVariablePercent(e.target.value)}
                                    placeholder="2.5"
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                                  />
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                              <input
                                type="checkbox"
                                id="exibirValorTurno"
                                checked={newRiderExibirValorTurno}
                                onChange={(e) => setNewRiderExibirValorTurno(e.target.checked)}
                                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                              />
                              <label htmlFor="exibirValorTurno" className="text-[11px] font-bold text-slate-700 cursor-pointer select-none">
                                Exibir valor do turno no dispositivo
                              </label>
                            </div>

                            <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                              <input
                                type="checkbox"
                                id="ocultarValoresProtocolos"
                                checked={newRiderOcultarValoresProtocolos}
                                onChange={(e) => setNewRiderOcultarValoresProtocolos(e.target.checked)}
                                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                              />
                              <label htmlFor="ocultarValoresProtocolos" className="text-[11px] font-bold text-slate-700 cursor-pointer select-none">
                                Ocultar protocolos e valores (Privacidade)
                              </label>
                            </div>

                            <div className="flex items-center gap-2 p-2 bg-emerald-50/60 border border-emerald-200/80 rounded-xl">
                              <input
                                type="checkbox"
                                id="autorizarImprimirRecibo"
                                checked={newRiderAutorizarImprimirRecibo}
                                onChange={(e) => setNewRiderAutorizarImprimirRecibo(e.target.checked)}
                                className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
                              />
                              <label htmlFor="autorizarImprimirRecibo" className="text-[11px] font-bold text-emerald-900 cursor-pointer select-none flex items-center gap-1">
                                <span>Autorizar impressão de recibos no dispositivo</span>
                              </label>
                            </div>

                            <div className="flex gap-2 pt-2">
                              {editingRider && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingRider(null);
                                    setNewRiderName('');
                                    setNewRiderPhone('');
                                    setNewRiderDeviceNumber('');
                                    setNewRiderPassword('');
                                    setNewRiderAddress('');
                                    setNewRiderCpfCnpj('');
                                    setNewRiderVehiclePlate('');
                                    setNewRiderCnh('');
                                    setNewRiderExibirValorTurno(false);
                                    setNewRiderOcultarValoresProtocolos(false);
                                    setNewRiderAutorizarImprimirRecibo(false);
                                    setShowRiderForm(false);
                                  }}
                                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer text-center"
                                >
                                  Cancelar
                                </button>
                              )}
                              <button
                                type="submit"
                                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-850 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5"
                              >
                                <UserPlus size={14} />
                                <span>{editingRider ? 'Salvar Alterações' : 'Cadastrar Novo Condutor'}</span>
                              </button>
                            </div>
                          </form>
                        </div>
                      )}

                      {!showRiderForm && (
                        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-5 h-fit lg:col-span-1" id="share-install-panel">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Smartphone className="text-blue-600" size={18} />
                              <h3 className="font-bold text-slate-800 text-sm">Instalar App de Campo</h3>
                            </div>
                            <p className="text-xs text-slate-400">
                              Gere links e códigos QR para instalar o aplicativo dedicado de entregas nos celulares da sua equipe de campo.
                            </p>
                          </div>

                          {/* Rider Select Preconfiguration */}
                          <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase">
                              Pre-configurar Condutor (Opcional)
                            </label>
                            <select
                              value={selectedRiderForInstallId || ''}
                              onChange={(e) => setSelectedRiderForInstallId(e.target.value || null)}
                              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="">Acesso Geral (Escolha no Login)</option>
                              {riders.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name} ({r.vehicle})
                                </option>
                              ))}
                            </select>
                            <p className="text-[10px] text-slate-400 leading-tight">
                              Se configurado, o aplicativo abrirá diretamente na fila de entregas e mapa do condutor selecionado, pulando etapas de login.
                            </p>
                          </div>

                          {/* Choice of Install Mode: Real vs Simulator */}
                          <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase">
                              Dispositivo de Destino / Modo de Visualização
                            </label>
                            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200/60">
                              <button
                                type="button"
                                onClick={() => setInstallMode('real')}
                                className={`py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                  installMode === 'real'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                                }`}
                              >
                                <Smartphone size={13} />
                                <span>Celular Real</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setInstallMode('simulador')}
                                className={`py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                  installMode === 'simulador'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                                }`}
                              >
                                <MonitorPlay size={13} />
                                <span>Simulador (PC)</span>
                              </button>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-tight">
                              {installMode === 'real' 
                                ? 'Recomendado para motoristas de verdade. Abre o aplicativo limpo, em tela cheia de celular, sem moldura ou painéis de teste.'
                                : 'Recomendado para demonstrações no PC. Exibe um celular iPhone desenhado com botões rápidos de simulação.'
                              }
                            </p>
                          </div>

                          {/* Link Generation and Copy Button */}
                          <div className="space-y-3">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase">
                              Link de Instalação
                            </label>
                            {(() => {
                              let origin = window.location.origin;
                              let isDevMode = false;
                              if (origin.includes('ais-dev-')) {
                                origin = origin.replace('ais-dev-', 'ais-pre-');
                                isDevMode = true;
                              }
                              const installLink = `${origin}/?view=driver_mobile${
                                selectedRiderForInstallId ? `&riderId=${selectedRiderForInstallId}` : ''
                              }`;
                              
                              const handleCopy = () => {
                                navigator.clipboard.writeText(installLink);
                                setCopiedInstallLink(true);
                                setTimeout(() => setCopiedInstallLink(false), 2000);
                              };

                              const handleExportQR = () => {
                                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(installLink)}`;
                                window.open(qrUrl, '_blank');
                              };

                              return (
                                <>
                                  {isDevMode && (
                                    <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-[11px] text-amber-850 leading-relaxed space-y-1">
                                      <div className="flex items-center gap-1.5 font-extrabold text-amber-950">
                                        <span className="flex h-2 w-2 relative">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                        </span>
                                        Para Evitar Erro 403 no Celular:
                                      </div>
                                      <p className="font-medium text-amber-800">
                                        O ambiente de desenvolvimento comum é privado. O Vinimap converteu automaticamente o link para o endereço de preview público (<code className="font-mono bg-amber-100/70 px-1 rounded text-amber-900">ais-pre-...</code>), permitindo que você ou seus condutores acessem de qualquer smartphone sem bloqueios.
                                      </p>
                                    </div>
                                  )}

                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      readOnly
                                      value={installLink}
                                      className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-mono text-[10px] select-all truncate text-slate-500"
                                    />
                                    <button
                                      type="button"
                                      onClick={handleCopy}
                                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 border border-slate-200/50"
                                      title="Copiar Link"
                                    >
                                      {copiedInstallLink ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                                    </button>
                                  </div>

                                  {/* QR Code Graphic Frame */}
                                  <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-150 rounded-2xl relative group mt-3">
                                    {/* Scan Frame Corners Overlay */}
                                    <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-blue-500 rounded-tl-md"></div>
                                    <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-blue-500 rounded-tr-md"></div>
                                    <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-blue-500 rounded-bl-md"></div>
                                    <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-blue-500 rounded-br-md"></div>
                                    
                                    <img
                                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(installLink)}`}
                                      alt="QR Code de Instalação"
                                      className="w-40 h-40 object-contain p-1.5 bg-white rounded-lg border border-slate-100 shadow-sm"
                                    />
                                    
                                    <span className="text-[9px] font-extrabold text-blue-600 mt-2 tracking-wider uppercase">
                                      {selectedRiderForInstallId 
                                        ? `QR: ${riders.find(r => r.id === selectedRiderForInstallId)?.name}` 
                                        : 'QR CODE DE ACESSO GERAL'
                                      }
                                    </span>
                                  </div>

                                  {/* Export & Actions button */}
                                  <div className="flex flex-col gap-2">
                                    <button
                                      type="button"
                                      onClick={handleExportQR}
                                      className="w-full py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200/50 text-blue-700 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
                                    >
                                      <Download size={13} />
                                      <span>Exportar QR Code (Alta Definição)</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        const rider = selectedRiderForInstallId 
                                          ? riders.find(r => r.id === selectedRiderForInstallId) 
                                          : null;
                                        
                                        const text = rider 
                                          ? `Olá, *${rider.name}*! Segue o link de instalação do seu aplicativo Vinimap para iniciar as entregas:\n\n*Link de Acesso:* ${installLink}\n*Dispositivo:* ${rider.deviceNumber || 'Não configurado'}\n*Senha de Acesso:* ${rider.password || '1234'}`
                                          : `Olá! Segue o link de instalação de acesso geral do aplicativo Vinimap para iniciar as entregas:\n\n*Link de Acesso:* ${installLink}\n*Senha de Acesso Padrão:* 1234`;
                                        
                                        let phoneParam = '';
                                        if (rider && rider.phone) {
                                          let cleanPhone = rider.phone.replace(/\D/g, '');
                                          if (cleanPhone.length >= 10 && cleanPhone.length <= 11 && !cleanPhone.startsWith('55')) {
                                            cleanPhone = '55' + cleanPhone;
                                          }
                                          phoneParam = `phone=${cleanPhone}&`;
                                        }
                                        
                                        window.open(`https://api.whatsapp.com/send?${phoneParam}text=${encodeURIComponent(text)}`, '_blank');
                                      }}
                                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-755 text-white border border-emerald-700/20 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
                                    >
                                      <MessageCircle size={13} />
                                      <span>Enviar via WhatsApp</span>
                                    </button>
                                  </div>
                                </>
                              );
                            })()}
                          </div>

                          {/* PWA Mobile Setup Guide */}
                          <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 space-y-2 text-[11px] text-slate-500 leading-relaxed">
                            <h4 className="font-extrabold text-slate-700 flex items-center gap-1.5 text-xs">
                              <Share2 size={12} className="text-slate-500" />
                              Como instalar no smartphone:
                            </h4>
                            <ul className="list-disc pl-4 space-y-1 font-medium">
                              <li>
                                <strong className="text-slate-600">No Android (Chrome):</strong> Escaneie o QR, clique nos 3 pontos no topo direito e selecione <strong className="text-slate-700">"Instalar aplicativo"</strong> ou "Adicionar à tela inicial".
                              </li>
                              <li>
                                <strong className="text-slate-600">No iOS (Safari):</strong> Escaneie o QR, clique em <strong className="text-slate-700">Compartilhar</strong> (quadrado com seta) e escolha <strong className="text-slate-700">"Adicionar à Tela de Início"</strong>.
                              </li>
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 5: CADASTRO DE SEDE / HUB */}
                  {adminTab === 'sede' && (
                    <HubRegistration
                      hubs={companyHubs}
                      onSaveHub={handleSaveCompanyHub}
                      onDeleteHub={handleDeleteCompanyHub}
                      onSetActiveHub={handleSetActiveCompanyHub}
                    />
                  )}

                  {/* TAB 7: EDICAO DE LOGO DA SEDE */}
                  {adminTab === 'logo_sede' && (
                    <LogoHubManager
                      hubs={companyHubs}
                      onSaveHub={handleSaveCompanyHub}
                    />
                  )}

                  {/* TAB 8: MENSAGENS E NOTIFICACOES PADRAO */}
                  {adminTab === 'notificacoes' && (
                    <NotificationSettingsManager />
                  )}

                  {/* TAB 6: INTEGRACAO SUPABASE */}
                  {adminTab === 'supabase' && (
                    <SupabasePanel
                      orders={orders}
                      clientPartners={clientPartners}
                      riders={riders}
                      activityLogs={logs}
                      financialTransactions={financialTransactions}
                      companyHubs={companyHubs}
                      onLoadExternalState={async (state) => {
                        await dbApplyLoadedState(state);
                      }}
                      onAddLog={async (message, type) => {
                        const logId = generateUniqueLogId();
                        await dbAddActivityLog({
                          id: logId,
                          time: getSaoPauloTime(),
                          message,
                          type
                        });
                      }}
                    />
                  )}

                  {/* TAB 7: INTEGRACAO GITHUB */}
                  {adminTab === 'github' && (
                    <GithubPanel />
                  )}

                </motion.div>
              );
            })()}

            {/* VIEW 9: CONFIGURATIONS SCREEN */}
            {activeSection === 'configuracoes' && (
              <motion.div
                key="configuracoes-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
                id="view-configuracoes"
              >
                {/* General Operational Settings */}
                <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Settings className="w-5 h-5 text-blue-600" />
                        Parâmetros da Operação
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">Parâmetros operacionais e preferências globais do Vinimap Logistics OS.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                    <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold">
                      <span className="text-slate-700">Despacho Inteligente</span>
                      <span className="text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase">Ativado</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold">
                      <span className="text-slate-700">Ganhos no App do Condutor</span>
                      <button
                        onClick={() => setShowRiderEarnings(!showRiderEarnings)}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all cursor-pointer ${
                          showRiderEarnings
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        {showRiderEarnings ? 'Ativado' : 'Desativado'}
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold">
                      <span className="text-slate-700">Alerta de Bateria Mínima</span>
                      <span className="font-mono text-slate-800 font-bold">20%</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold">
                      <span className="text-slate-700">Moeda do Sistema</span>
                      <span className="font-mono text-slate-800 font-bold">BRL (R$)</span>
                    </div>
                  </div>
                </div>

                {/* Inline Editable CEP Ranges and Freight Values Table Panel */}
                <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                        Gestão de Faixas de CEP e Tabelas de Frete
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Visualização e edição em tabela interativa, regras de repasse e vigência de frete por cliente.
                      </p>
                    </div>
                  </div>

                  <FreightTableImportManager
                    clientPartners={clientPartners}
                    orders={orders}
                    onSaveClientCepRanges={handleSaveCepRanges}
                    onBulkSaveClientCepRanges={handleBulkSaveClientCepRanges}
                    onRecalculateOrdersFreight={handleRecalculateOrdersFreight}
                  />
                </div>
              </motion.div>
            )}

            {/* VIEW 10: IMPORT SPREADSHEET SCREEN */}
            {activeSection === 'importar' && (
              <ImportSpreadsheet 
                orders={orders} 
                riders={riders} 
                clientPartners={clientPartners}
                onImportOrders={handleImportOrders} 
              />
            )}

            {/* VIEW 10.0: TABELA DE FRETE POR CLIENTE */}
            {activeSection === 'tabela_frete' && (
              <FreightTableImportManager
                clientPartners={clientPartners}
                orders={orders}
                onSaveClientCepRanges={handleSaveCepRanges}
                onBulkSaveClientCepRanges={handleBulkSaveClientCepRanges}
                onRecalculateOrdersFreight={handleRecalculateOrdersFreight}
              />
            )}

            {/* VIEW 10.1: DATA MASS MANAGER (SEEDER & PURGE) */}
            {activeSection === 'massa_dados' && (
              <DataMassManager
                orders={orders}
                clientPartners={clientPartners}
                deliveryRiders={riders}
                logs={logs}
                financialTransactions={financialTransactions}
                companyHubs={companyHubs}
                setOrders={setOrders}
                setClientPartners={setClientPartners}
                setDeliveryRiders={setRiders}
                setLogs={setLogs}
                setFinancialTransactions={setFinancialTransactions}
                onAddActivityLog={(message, orderId) => {
                  const newLog: ActivityLog = {
                    id: `log-seed-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                    time: getSaoPauloTime(),
                    message,
                    type: 'info',
                    orderId
                  };
                  dbAddActivityLog(newLog);
                }}
                onRestoreDemoState={handleResetDemoState}
              />
            )}

            {/* VIEW 10.5: ALOCAR PEDIDO SCREEN */}
            {activeSection === 'alocar' && (
              <AlocarPedido 
                orders={orders} 
                riders={riders} 
                clientPartners={clientPartners}
                onAllocateSuccess={(updatedOrders, updatedRiders, logsGenerated) => {
                  if (updatedOrders.length > 0) {
                    const syncedOrders = updatedOrders.map(o => validateAndRecalculateOrderFreight(o, clientPartners));
                    dbBulkSaveOrders(syncedOrders);
                  }
                  if (updatedRiders.length > 0) {
                    updatedRiders.forEach(r => dbSaveDeliveryRider(r));
                  }
                  const newLogs: ActivityLog[] = logsGenerated.map((lg, idx) => ({
                    id: `log-alloc-${Date.now()}-${idx}`,
                    time: lg.time,
                    message: lg.message,
                    type: lg.type as 'info' | 'success' | 'warning' | 'danger'
                  }));
                  if (newLogs.length > 0) {
                    dbBulkSaveActivityLogs(newLogs);
                  }
                }}
              />
            )}

            {/* VIEW 11: ACTIVITY MONITORING SCREEN */}
            {activeSection === 'atividades' && (
              <motion.div
                key="atividades-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
                id="view-atividades"
              >
                <div>
                  <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Monitoramento de Atividades</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Histórico operacional da central em tempo real.</p>
                </div>

                <div className="max-w-4xl">
                  <ActivityFeed logs={logs} />
                </div>
              </motion.div>
            )}

            {/* VIEW 11.5: DAILY NOTEBOOK SCREEN */}
            {activeSection === 'caderno' && (
              <DailyNotebook />
            )}

            {/* VIEW 12: RIDER LOCATION TRACKING SCREEN */}
            {activeSection === 'localizacao' && (
              <motion.div
                key="localizacao-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
                id="view-localizacao"
              >
                <RiderTrackingView 
                  riders={riders} 
                  orders={orders}
                  onUpdateRiderCoords={handleUpdateRiderCoords}
                  onUpdateOrderStatus={handleUpdateStatus}
                  activeHub={companyHubs.find(h => h.active)}
                />
              </motion.div>
            )}

            {/* VIEW 14: LIVE MAP SCREEN */}
            {activeSection === 'mapa' && (
              <motion.div
                key="mapa-ao-vivo-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
                id="view-mapa-ao-vivo"
              >
                <div>
                  <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Mapa ao Vivo</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Acompanhamento e rastreamento em tempo real de condutores e faturamento.</p>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="xl:col-span-2">
                    <MapContainer 
                      riders={riders} 
                      orders={filteredOrders} 
                      selectedRiderId={selectedRiderId} 
                      setSelectedRiderId={setSelectedRiderId} 
                      activeHub={companyHubs.find(h => h.active)}
                    />
                  </div>
                  <div>
                    <RidersList 
                      riders={riders} 
                      selectedRiderId={selectedRiderId} 
                      setSelectedRiderId={setSelectedRiderId} 
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* VIEW 15: STANDARD ROUTE OPTIMIZER SCREEN */}
            {activeSection === 'rotas' && (
              <motion.div
                key="rotas-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
                id="view-rotas-standard"
              >
                <OtimizadorRotasInteligente 
                  riders={riders} 
                  orders={orders}
                  onUpdateRiderCoords={handleUpdateRiderCoords}
                  onUpdateOrderStatus={handleUpdateStatus}
                  onSaveLogs={(newLogs) => {
                    if (newLogs.length > 0) {
                      dbBulkSaveActivityLogs(newLogs);
                    }
                  }}
                  onUpdateOrders={(updatedOrders) => {
                    if (updatedOrders.length > 0) {
                      dbBulkSaveOrders(updatedOrders);
                    }
                  }}
                  activeHub={companyHubs.find(h => h.active)}
                />
              </motion.div>
            )}

            {/* VIEW 16: DEVICE SIMULATOR SCREEN */}
            {activeSection === 'dispositivo_condutor' && (
              <motion.div
                key="dispositivo-condutor-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
                id="view-dispositivo-condutor"
              >
                <RiderAppSimulator
                  riders={riders}
                  orders={orders}
                  clientPartners={clientPartners}
                  activeHub={companyHubs.find(h => h.active)}
                  onUpdateRiderCoords={handleUpdateRiderCoords}
                  onUpdateOrderStatus={handleUpdateStatus}
                  onSaveLogs={(newLogs) => {
                    if (newLogs.length > 0) {
                      dbBulkSaveActivityLogs(newLogs);
                    }
                  }}
                  onUpdateOrders={(updatedOrders) => {
                    setOrders(prev => {
                      const updatedIds = new Set(updatedOrders.map(o => o.id));
                      return [
                        ...updatedOrders,
                        ...prev.filter(o => !updatedIds.has(o.id))
                      ];
                    });
                    dbBulkSaveOrders(updatedOrders);
                  }}
                  showRiderEarnings={showRiderEarnings}
                  activeRiderId={selectedRiderId}
                  onActiveRiderChange={setSelectedRiderId}
                  isStandalone={isStandaloneRider}
                  isRealDevice={isRealDeviceMode}
                />
              </motion.div>
            )}

            {/* VIEW 17: VOLUME CALCULATOR SCREEN */}
            {activeSection === 'calculadora' && (
              <motion.div
                key="calculadora-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
                id="view-calculadora"
              >
                <VolumeCalculator
                  clientPartners={clientPartners}
                  onCreateOrder={handleCreateOrder}
                />
              </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>

      {/* Slide-over New Order overlay modal form wrapper */}
      <NewOrderModal 
        isOpen={isNewOrderOpen} 
        onClose={() => setIsNewOrderOpen(false)} 
        onSubmit={handleCreateOrder} 
        clientPartners={clientPartners}
      />

      {/* Driver Billing Modal */}
      <DriverBillingModal
        isOpen={billingModalRiderId !== null}
        onClose={() => setBillingModalRiderId(null)}
        riderId={billingModalRiderId}
        riders={riders}
        orders={orders}
        clientPartners={clientPartners}
        onUpdateRider={handleUpdateRider}
      />

      {/* Client Billing Modal */}
      <ClientBillingModal
        isOpen={billingModalClientId !== null}
        onClose={() => setBillingModalClientId(null)}
        clientId={billingModalClientId}
        clientPartners={clientPartners}
        orders={orders}
        riders={riders}
      />

      {/* Cep Ranges Modal */}
      <AnimatePresence>
        {isCepRangesModalOpen && (
          <CepRangesModal
            isOpen={isCepRangesModalOpen}
            onClose={() => {
              setIsCepRangesModalOpen(false);
              setSelectedCepRangesClient(null);
            }}
            client={clientPartners.find(c => c.id === selectedCepRangesClient?.id) || selectedCepRangesClient}
            allClientPartners={clientPartners}
            orders={orders}
            onSaveCepRanges={handleSaveCepRanges}
            onRecalculateOrdersFreight={handleRecalculateOrdersFreight}
          />
        )}
      </AnimatePresence>

      {/* Floating Completion Notification Toast Banner */}
      {completionNotificationToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-full bg-slate-900 text-white border border-slate-700/80 rounded-3xl p-4 shadow-2xl space-y-3 animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                <BellRing size={20} />
              </span>
              <div>
                <h4 className="font-extrabold text-xs text-white">
                  Pedido #{completionNotificationToast.orderId.replace('ped-', '').toUpperCase()} Concluído!
                </h4>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Notificação gerada para {completionNotificationToast.clientName}
                </p>
              </div>
            </div>
            <button
              onClick={() => setCompletionNotificationToast(null)}
              className="text-slate-400 hover:text-white text-xs p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700/60 text-[11px] text-slate-200 space-y-1">
            {completionNotificationToast.phone && (
              <p className="flex items-center justify-between">
                <span className="text-slate-400">Telefone / WhatsApp:</span>
                <strong className="text-emerald-400">{completionNotificationToast.phone}</strong>
              </p>
            )}
            {completionNotificationToast.email && (
              <p className="flex items-center justify-between">
                <span className="text-slate-400">E-mail Cadastrado:</span>
                <strong className="text-blue-300">{completionNotificationToast.email}</strong>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            {completionNotificationToast.waUrl && (
              <a
                href={completionNotificationToast.waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-950 cursor-pointer"
              >
                <MessageSquare size={14} />
                <span>Enviar no WhatsApp</span>
                <ExternalLink size={12} />
              </a>
            )}
            <button
              onClick={() => setCompletionNotificationToast(null)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Floating Vercel & Supabase Diagnostic Assistant */}
      <DiagnosticUtility />
    </div>
  );
}
