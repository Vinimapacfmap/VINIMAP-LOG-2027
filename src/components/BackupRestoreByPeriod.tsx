/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  RotateCcw, 
  Database, 
  Calendar, 
  Upload, 
  Download, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  FileJson, 
  Search, 
  RefreshCw, 
  Layers, 
  ArrowRight,
  ShieldAlert,
  Clock,
  Building2,
  Users,
  ShoppingBag,
  DollarSign,
  Info,
  History,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Order, ClientPartner, DeliveryRider, FinancialTransaction } from '../types';
import { getSaoPauloISODate, getSaoPauloTime, formatToBrazilianDate, extractISODateFromTimestamp } from '../utils/dateUtils';
import { resolveOrderDisplayName, getPartnerDisplayName } from '../utils/partnerUtils';

export interface NormalizedBackupData {
  exportType?: string;
  exportDate?: string;
  date?: string;
  timestamp?: string;
  orders: Order[];
  clientPartners: ClientPartner[];
  riders: DeliveryRider[];
  financialTransactions: FinancialTransaction[];
  companyHubs?: any[];
}

/**
 * Universal normalizer for backup data from any JSON structure or storage format
 */
export function normalizeBackupData(raw: any): NormalizedBackupData {
  if (!raw) {
    return {
      orders: [],
      clientPartners: [],
      riders: [],
      financialTransactions: []
    };
  }

  // 1. Direct array of items
  if (Array.isArray(raw)) {
    // Check if the array contains orders (has id and address/clientName/status)
    const isOrderArray = raw.length > 0 && (raw[0].clientName || raw[0].client_name || raw[0].address || raw[0].status);
    return {
      orders: isOrderArray ? raw : [],
      clientPartners: [],
      riders: [],
      financialTransactions: []
    };
  }

  if (typeof raw !== 'object') {
    return {
      orders: [],
      clientPartners: [],
      riders: [],
      financialTransactions: []
    };
  }

  // 2. Extract Orders with comprehensive key matching
  let orders: Order[] = [];
  if (Array.isArray(raw.orders)) {
    orders = raw.orders;
  } else if (Array.isArray(raw.pedidos)) {
    orders = raw.pedidos;
  } else if (Array.isArray(raw.deliveryOrders)) {
    orders = raw.deliveryOrders;
  } else if (Array.isArray(raw.rows)) {
    orders = raw.rows;
  } else if (Array.isArray(raw.data)) {
    orders = raw.data;
  } else if (raw.data && Array.isArray(raw.data.orders)) {
    orders = raw.data.orders;
  } else if (raw.data && Array.isArray(raw.data.pedidos)) {
    orders = raw.data.pedidos;
  } else if (raw.data && Array.isArray(raw.data.rows)) {
    orders = raw.data.rows;
  } else if (raw.state && Array.isArray(raw.state.orders)) {
    orders = raw.state.orders;
  } else if (raw.payload && Array.isArray(raw.payload.orders)) {
    orders = raw.payload.orders;
  }

  // 3. Extract Client Partners
  let clientPartners: ClientPartner[] = [];
  if (Array.isArray(raw.clientPartners)) {
    clientPartners = raw.clientPartners;
  } else if (Array.isArray(raw.parceiros)) {
    clientPartners = raw.parceiros;
  } else if (Array.isArray(raw.clientes)) {
    clientPartners = raw.clientes;
  } else if (raw.data && Array.isArray(raw.data.clientPartners)) {
    clientPartners = raw.data.clientPartners;
  } else if (raw.data && Array.isArray(raw.data.parceiros)) {
    clientPartners = raw.data.parceiros;
  }

  // 4. Extract Delivery Riders
  let riders: DeliveryRider[] = [];
  if (Array.isArray(raw.deliveryRiders)) {
    riders = raw.deliveryRiders;
  } else if (Array.isArray(raw.riders)) {
    riders = raw.riders;
  } else if (Array.isArray(raw.entregadores)) {
    riders = raw.entregadores;
  } else if (Array.isArray(raw.condutores)) {
    riders = raw.condutores;
  } else if (raw.data && Array.isArray(raw.data.deliveryRiders)) {
    riders = raw.data.deliveryRiders;
  } else if (raw.data && Array.isArray(raw.data.riders)) {
    riders = raw.data.riders;
  }

  // 5. Extract Financial Transactions
  let financialTransactions: FinancialTransaction[] = [];
  if (Array.isArray(raw.financialTransactions)) {
    financialTransactions = raw.financialTransactions;
  } else if (Array.isArray(raw.transacoes)) {
    financialTransactions = raw.transacoes;
  } else if (raw.data && Array.isArray(raw.data.financialTransactions)) {
    financialTransactions = raw.data.financialTransactions;
  }

  return {
    exportType: raw.exportType,
    exportDate: raw.exportDate || raw.timestamp || raw.date || 'Recente',
    date: raw.date,
    timestamp: raw.timestamp,
    orders,
    clientPartners,
    riders,
    financialTransactions,
    companyHubs: Array.isArray(raw.companyHubs) ? raw.companyHubs : []
  };
}

interface LocalBackupInfo {
  key: string;
  label: string;
  dateStr: string;
  timestamp: string;
  ordersCount: number;
  partnersCount: number;
  sizeKb: number;
  data: NormalizedBackupData;
}

interface BackupRestoreByPeriodProps {
  orders: Order[];
  clientPartners: ClientPartner[];
  riders: DeliveryRider[];
  financialTransactions?: FinancialTransaction[];
  lastContingencyTime?: string;
  onGenerateBackup?: () => void;
  onRestoreData: (
    restoredOrders: Order[], 
    restoredPartners?: ClientPartner[], 
    restoredRiders?: DeliveryRider[],
    mode?: 'merge' | 'replace_period' | 'replace_all',
    startDate?: string,
    endDate?: string
  ) => void;
  onAddActivityLog?: (message: string, type?: 'info' | 'success' | 'warning' | 'danger') => void;
}

export default function BackupRestoreByPeriod({
  orders,
  clientPartners,
  riders,
  financialTransactions = [],
  lastContingencyTime,
  onGenerateBackup,
  onRestoreData,
  onAddActivityLog
}: BackupRestoreByPeriodProps) {
  // Source Selection: 'local_storage' | 'file_upload' | 'current_db'
  const [sourceType, setSourceType] = useState<'local_storage' | 'file_upload' | 'current_db'>('local_storage');
  const [selectedBackupKey, setSelectedBackupKey] = useState<string>('vinimap_contingency_backup_latest');

  // File upload state
  const [uploadedBackupData, setUploadedBackupData] = useState<NormalizedBackupData | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Local storage backups list
  const [localBackups, setLocalBackups] = useState<LocalBackupInfo[]>([]);

  // Filter mode: whether to restrict orders by date range or show all orders from the backup
  const [filterByPeriod, setFilterByPeriod] = useState<boolean>(false);

  // Date Period Filter
  const todayIso = getSaoPauloISODate();
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(todayIso);

  // Search filter inside preview table
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');

  // Restoration Mode
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace_period' | 'replace_all'>('merge');

  // UI States
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Scan localStorage for available backup keys
  const scanLocalStorageBackups = () => {
    const list: LocalBackupInfo[] = [];
    try {
      const scannedKeys = new Set<string>();

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        const isBackupKey = 
          key.startsWith('vinimap_contingency_backup') || 
          key.startsWith('vinimap_snapshot') || 
          key.startsWith('vinimap_backup') || 
          key.startsWith('vinimap_contingencia') ||
          key === 'vinimap_orders_cache' ||
          key === 'vinimap_cached_orders';

        if (isBackupKey && !scannedKeys.has(key)) {
          scannedKeys.add(key);
          const rawVal = localStorage.getItem(key);
          if (!rawVal) continue;
          try {
            const parsed = JSON.parse(rawVal);
            const normalized = normalizeBackupData(parsed);
            const sizeKb = Math.max(1, Math.round((rawVal.length * 2) / 1024));
            
            let dateStr = 'Atual / Tempo Real';
            if (key.includes('_202')) {
              const match = key.match(/(\d{4}[-_]\d{2}[-_]\d{2})/);
              if (match) {
                dateStr = match[1].replace(/_/g, '-');
              } else {
                dateStr = key.replace('vinimap_contingency_backup_', '');
              }
            } else if (key === 'vinimap_contingency_backup_latest') {
              dateStr = 'Snapshot Mais Recente';
            } else if (key.includes('cache')) {
              dateStr = 'Cache Local';
            }

            let label = `Backup ${dateStr}`;
            if (key === 'vinimap_contingency_backup_latest') {
              label = 'Snapshot Mais Recente (Auto-Backup)';
            } else if (key.includes('snapshot')) {
              label = `Snapshot do Sistema (${dateStr})`;
            }

            list.push({
              key,
              label,
              dateStr,
              timestamp: normalized.exportDate || normalized.timestamp || 'Salvo recentemente',
              ordersCount: normalized.orders.length,
              partnersCount: normalized.clientPartners.length,
              sizeKb,
              data: normalized
            });
          } catch (err) {
            // ignore invalid JSON
          }
        }
      }

      // Always prepend live active database state if orders are present in Supabase / memory
      if (orders && orders.length > 0) {
        list.unshift({
          key: 'vinimap_live_active_database',
          label: `Estado Atual em Memória / Supabase (${orders.length} Pedidos)`,
          dateStr: 'Tempo Real',
          timestamp: 'Agora',
          ordersCount: orders.length,
          partnersCount: clientPartners ? clientPartners.length : 0,
          sizeKb: Math.max(1, Math.round(orders.length * 0.6)),
          data: {
            exportType: 'ESTADO_ATUAL_MEMORIA_SUPABASE',
            exportDate: todayIso,
            date: todayIso,
            timestamp: new Date().toISOString(),
            orders,
            clientPartners,
            riders,
            financialTransactions,
          }
        });
      }
    } catch (e) {
      console.warn('Erro ao escanear backups locais:', e);
    }

    // Sort list: live state & latest auto-backup first
    list.sort((a, b) => {
      if (a.key === 'vinimap_live_active_database') return -1;
      if (b.key === 'vinimap_live_active_database') return 1;
      if (a.key === 'vinimap_contingency_backup_latest') return -1;
      if (b.key === 'vinimap_contingency_backup_latest') return 1;
      return b.key.localeCompare(a.key);
    });

    setLocalBackups(list);
    if (list.length > 0) {
      if (!selectedBackupKey || !list.some(b => b.key === selectedBackupKey)) {
        setSelectedBackupKey(list[0].key);
      }
    }
  };

  useEffect(() => {
    scanLocalStorageBackups();
  }, [lastContingencyTime, orders.length, clientPartners.length]);

  // Handle file drop or upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setUploadError('Por favor, selecione um arquivo válido no formato .JSON.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        if (!parsed || (typeof parsed !== 'object')) {
          throw new Error('Formato JSON inválido.');
        }

        const normalized = normalizeBackupData(parsed);

        if (normalized.orders.length === 0 && normalized.clientPartners.length === 0) {
          throw new Error('O arquivo não contém registros válidos de pedidos ou parceiros.');
        }

        setUploadedBackupData(normalized);
        setUploadedFileName(file.name);
        showToast(`Arquivo "${file.name}" carregado com sucesso (${normalized.orders.length} pedidos)!`, 'success');
      } catch (err: any) {
        setUploadError(`Erro ao ler o arquivo: ${err.message || 'JSON corrompido'}`);
      }
    };
    reader.readAsText(file);
  };

  // Determine active dataset to filter based on chosen sourceType
  const activeBackupData = useMemo<NormalizedBackupData | null>(() => {
    if (sourceType === 'local_storage') {
      const found = localBackups.find(b => b.key === selectedBackupKey);
      return found ? found.data : null;
    } else if (sourceType === 'file_upload') {
      return uploadedBackupData;
    } else {
      return {
        orders,
        clientPartners,
        riders,
        financialTransactions
      };
    }
  }, [sourceType, selectedBackupKey, localBackups, uploadedBackupData, orders, clientPartners, riders, financialTransactions]);

  // Helper to extract ISO date YYYY-MM-DD from an order with multi-format support
  const getOrderIsoDate = (order: Order): string => {
    if (!order) return todayIso;
    if (order.date) {
      return getSaoPauloISODate(order.date);
    }
    if (order.deliveryDate) {
      return getSaoPauloISODate(order.deliveryDate);
    }
    if (order.dataConclusao) {
      return getSaoPauloISODate(order.dataConclusao);
    }
    if (order.occurrenceDate) {
      return getSaoPauloISODate(order.occurrenceDate);
    }
    if (order.rawData) {
      const rawDate = 
        order.rawData.DataSolicitacao || order.rawData.dataSolicitacao ||
        order.rawData.DataLancamento || order.rawData.dataLancamento ||
        order.rawData.DataEntrega || order.rawData.dataEntrega ||
        order.rawData.Data || order.rawData.data ||
        order.rawData.DataAgendamento || order.rawData.DataCriacao;
      if (rawDate) {
        return getSaoPauloISODate(String(rawDate));
      }
    }
    if (order.createdAt) {
      return getSaoPauloISODate(order.createdAt);
    }
    return todayIso;
  };

  // Detect earliest and latest dates in the current backup
  const backupDateRange = useMemo(() => {
    if (!activeBackupData || !activeBackupData.orders || activeBackupData.orders.length === 0) {
      return { min: todayIso, max: todayIso, count: 0 };
    }
    const dates = activeBackupData.orders.map(o => getOrderIsoDate(o)).filter(Boolean).sort();
    if (dates.length === 0) return { min: todayIso, max: todayIso, count: activeBackupData.orders.length };
    return {
      min: dates[0],
      max: dates[dates.length - 1],
      count: activeBackupData.orders.length
    };
  }, [activeBackupData, todayIso]);

  // Function to adjust period to fit all orders in the backup
  const fitPeriodToBackup = () => {
    if (backupDateRange.count > 0) {
      setStartDate(backupDateRange.min);
      setEndDate(backupDateRange.max);
      showToast(`Período ajustado para ${formatToBrazilianDate(backupDateRange.min)} até ${formatToBrazilianDate(backupDateRange.max)}`, 'info');
    }
  };

  // Filter orders by the selected date range [startDate, endDate] or include all if filterByPeriod is false
  const backupOrdersInPeriod = useMemo(() => {
    if (!activeBackupData || !Array.isArray(activeBackupData.orders)) return [];

    const allBackupOrders: Order[] = activeBackupData.orders;

    if (!filterByPeriod) {
      return allBackupOrders;
    }

    return allBackupOrders.filter(order => {
      const orderDate = getOrderIsoDate(order);
      if (startDate && orderDate < startDate) return false;
      if (endDate && orderDate > endDate) return false;
      return true;
    });
  }, [activeBackupData, startDate, endDate, filterByPeriod]);

  // Filter preview orders for search & status dropdown
  const filteredPreviewOrders = useMemo(() => {
    return backupOrdersInPeriod.filter(order => {
      if (statusFilter !== 'TODOS' && order.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchId = order.id.toLowerCase().includes(query);
        const matchClient = order.clientName?.toLowerCase().includes(query);
        const matchPartner = order.partnerName?.toLowerCase().includes(query);
        const matchAddress = order.address?.toLowerCase().includes(query);
        return matchId || matchClient || matchPartner || matchAddress;
      }
      return true;
    });
  }, [backupOrdersInPeriod, statusFilter, searchQuery]);

  // Statistics for the chosen period
  const stats = useMemo(() => {
    const totalOrdersInBackup = activeBackupData?.orders?.length || 0;
    const totalOrders = backupOrdersInPeriod.length;
    const concluded = backupOrdersInPeriod.filter(o => o.status === 'Concluído').length;
    const inRoute = backupOrdersInPeriod.filter(o => o.status === 'Em rota' || (o.status as string) === 'Entregando').length;
    const occurrences = backupOrdersInPeriod.filter(o => o.status === 'Ocorrência').length;
    const notStarted = backupOrdersInPeriod.filter(o => o.status === 'Não iniciado').length;
    const canceled = backupOrdersInPeriod.filter(o => o.status === 'Cancelado').length;

    const totalValue = backupOrdersInPeriod.reduce((sum, o) => sum + (o.value || 0), 0);
    const totalFreight = backupOrdersInPeriod.reduce((sum, o) => sum + (o.deliveryValue || 0), 0);

    const partnersInBackup = Array.isArray(activeBackupData?.clientPartners) ? activeBackupData.clientPartners.length : 0;
    const ridersInBackup = Array.isArray(activeBackupData?.riders) ? activeBackupData.riders.length : 0;

    return {
      totalOrdersInBackup,
      totalOrders,
      concluded,
      inRoute,
      occurrences,
      notStarted,
      canceled,
      totalValue,
      totalFreight,
      partnersInBackup,
      ridersInBackup
    };
  }, [backupOrdersInPeriod, activeBackupData]);

  // Quick period preset buttons
  const setQuickPeriod = (preset: 'today' | 'yesterday' | 'last7' | 'this_month' | 'last_month' | 'all') => {
    const now = new Date();
    const isoNow = getSaoPauloISODate();
    setFilterByPeriod(true);

    if (preset === 'today') {
      setStartDate(isoNow);
      setEndDate(isoNow);
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const isoY = y.toISOString().split('T')[0];
      setStartDate(isoY);
      setEndDate(isoY);
    } else if (preset === 'last7') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(isoNow);
    } else if (preset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(isoNow);
    } else if (preset === 'last_month') {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      setStartDate(firstDayLastMonth);
      setEndDate(lastDayLastMonth);
    } else if (preset === 'all') {
      setFilterByPeriod(false);
      setStartDate('2020-01-01');
      setEndDate('2030-12-31');
    }
  };

  // Toast helper
  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Execute Restore Process
  const handleConfirmRestore = () => {
    if (!activeBackupData) {
      showToast('Nenhum dado de backup válido foi selecionado.', 'error');
      return;
    }

    if (backupOrdersInPeriod.length === 0 && restoreMode !== 'replace_all') {
      showToast('Nenhum pedido encontrado para o período selecionado.', 'error');
      return;
    }

    setIsRestoring(true);

    setTimeout(() => {
      try {
        const backupOrdersToRestore = backupOrdersInPeriod;
        const backupPartners = Array.isArray(activeBackupData.clientPartners) ? activeBackupData.clientPartners : [];
        const backupRiders = Array.isArray(activeBackupData.riders) ? activeBackupData.riders : [];

        let finalOrders: Order[] = [];

        if (restoreMode === 'merge') {
          // Merge: Replace/update matching order IDs from backup, add new ones, keep orders outside the period
          const existingMap = new Map<string, Order>(orders.map(o => [o.id, o]));

          // Update existing orders or insert backup orders
          backupOrdersToRestore.forEach(bo => {
            existingMap.set(bo.id, bo);
          });

          finalOrders = Array.from(existingMap.values());
        } else if (restoreMode === 'replace_period') {
          if (filterByPeriod) {
            // Replace Period: Filter out current orders in [startDate, endDate], insert backup orders
            const ordersOutsidePeriod = orders.filter(o => {
              const d = getOrderIsoDate(o);
              return d < startDate || d > endDate;
            });
            finalOrders = [...ordersOutsidePeriod, ...backupOrdersToRestore];
          } else {
            // If no period filter was selected, replace all
            finalOrders = backupOrdersToRestore;
          }
        } else if (restoreMode === 'replace_all') {
          // Replace All: Completely replace database with backup dataset
          finalOrders = Array.isArray(activeBackupData.orders) ? activeBackupData.orders : backupOrdersToRestore;
        }

        // Sort orders by date descending
        finalOrders.sort((a, b) => {
          const dateA = `${getOrderIsoDate(a)} ${a.createdAt || '00:00'}`;
          const dateB = `${getOrderIsoDate(b)} ${b.createdAt || '00:00'}`;
          return dateB.localeCompare(dateA);
        });

        // Trigger callback
        onRestoreData(
          finalOrders,
          backupPartners.length > 0 ? backupPartners : undefined,
          backupRiders.length > 0 ? backupRiders : undefined,
          restoreMode,
          filterByPeriod ? startDate : undefined,
          filterByPeriod ? endDate : undefined
        );

        const periodLabel = filterByPeriod ? `${formatToBrazilianDate(startDate)} até ${formatToBrazilianDate(endDate)}` : 'Todo o Backup';
        const successMsg = `Restauração concluída! ${backupOrdersToRestore.length} pedidos restaurados (${periodLabel}).`;

        showToast(successMsg, 'success');

        if (onAddActivityLog) {
          onAddActivityLog(
            `Restauração de Backup (${restoreMode.toUpperCase()}): ${backupOrdersToRestore.length} pedidos restaurados (${periodLabel}).`,
            'success'
          );
        }

        setIsConfirmOpen(false);
      } catch (err: any) {
        showToast(`Erro durante a restauração: ${err.message || 'Falha inesperada'}`, 'error');
      } finally {
        setIsRestoring(false);
      }
    }, 600);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" id="backup-restore-container">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border text-xs font-bold text-white ${
              toastMessage.type === 'success' ? 'bg-emerald-600 border-emerald-500' :
              toastMessage.type === 'error' ? 'bg-rose-600 border-rose-500' :
              'bg-blue-600 border-blue-500'
            }`}
          >
            {toastMessage.type === 'success' ? <CheckCircle2 size={18} /> :
             toastMessage.type === 'error' ? <AlertTriangle size={18} /> :
             <Info size={18} />}
            <span>{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER TITLE BAR */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 rounded-2xl p-6 text-white shadow-lg border border-slate-800/80 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <RotateCcw size={180} className="text-blue-400" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                <History size={12} /> Restauração por Período
              </span>
              {lastContingencyTime && (
                <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full text-[10px] font-bold">
                  Último Auto-Backup: {lastContingencyTime}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
              Restaurar Backup por Período
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Recupere pedidos, cadastros de clientes parceiros e condutores a partir de snapshots locais ou arquivos JSON externos. Filtre por intervalo de datas ou restaure o arquivo completo.
            </p>
          </div>

          <div className="flex items-center gap-3 self-stretch md:self-auto shrink-0">
            {onGenerateBackup && (
              <button
                onClick={onGenerateBackup}
                className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2"
                title="Salvar snapshot local imediato da base atual"
              >
                <Download size={15} />
                <span>Gerar Backup Agora</span>
              </button>
            )}

            <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md p-3 rounded-xl border border-white/10 shrink-0">
              <div className="p-2.5 bg-blue-600/30 rounded-lg text-blue-300 shrink-0">
                <Database size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-300 tracking-wider">Base Atual no Sistema</p>
                <p className="text-sm font-black text-white">{orders.length} <span className="text-xs font-normal text-slate-300">pedidos</span></p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* STEP 1: SELECT BACKUP SOURCE */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Database size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">1. Selecione a Fonte do Backup</h2>
              <p className="text-xs text-slate-400">Escolha de onde os dados do backup serão carregados</p>
            </div>
          </div>

          {/* Source Tabs */}
          <div className="flex p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setSourceType('local_storage')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                sourceType === 'local_storage' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock size={14} />
              <span>Snapshots Locais ({localBackups.length})</span>
            </button>
            <button
              onClick={() => setSourceType('file_upload')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                sourceType === 'file_upload' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload size={14} />
              <span>Arquivo JSON Externo</span>
            </button>
          </div>
        </div>

        {/* Tab Content 1: Local Storage Snapshots */}
        {sourceType === 'local_storage' && (
          <div className="space-y-3">
            {localBackups.length === 0 ? (
              <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-slate-500 space-y-3">
                <AlertTriangle size={28} className="mx-auto text-amber-500" />
                <div>
                  <p className="text-xs font-bold text-slate-700">Nenhum auto-backup local encontrado no armazenamento deste navegador.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Gere um backup imediato da base atual ou carregue um arquivo JSON salvo anteriormente.</p>
                </div>
                {onGenerateBackup && (
                  <button
                    onClick={() => {
                      onGenerateBackup();
                      setTimeout(scanLocalStorageBackups, 300);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all inline-flex items-center gap-2 shadow-sm"
                  >
                    <Download size={14} />
                    <span>Gerar Snapshot Local Agora</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {localBackups.map((item) => {
                  const isSelected = selectedBackupKey === item.key;
                  return (
                    <div
                      key={item.key}
                      onClick={() => setSelectedBackupKey(item.key)}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative ${
                        isSelected 
                          ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20 shadow-sm' 
                          : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                          item.key === 'vinimap_contingency_backup_latest' 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                            : 'bg-slate-200 text-slate-700'
                        }`}>
                          {item.dateStr}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{item.sizeKb} KB</span>
                      </div>

                      <h3 className="text-xs font-bold text-slate-800 line-clamp-1">{item.label}</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">{item.timestamp}</p>

                      <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                        <span className="font-bold text-blue-700 flex items-center gap-1">
                          <ShoppingBag size={12} /> {item.ordersCount} pedidos
                        </span>
                        <span className="font-medium text-slate-600 flex items-center gap-1">
                          <Building2 size={12} /> {item.partnersCount} parceiros
                        </span>
                      </div>

                      {isSelected && (
                        <div className="absolute top-2 right-2 text-blue-600">
                          <CheckCircle2 size={16} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab Content 2: File Upload */}
        {sourceType === 'file_upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-6 bg-slate-50/50 hover:bg-blue-50/20 transition-all text-center">
              <input
                type="file"
                id="backup-file-input"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label htmlFor="backup-file-input" className="cursor-pointer space-y-2 block">
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto shadow-sm">
                  <FileJson size={24} />
                </div>
                <div>
                  <p className="text-xs font-extrabold text-slate-800">Clique para selecionar ou arraste o arquivo .JSON de Backup</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Formatos suportados: Arquivos JSON de contingência, snapshots ou exportações do ViniMap</p>
                </div>
              </label>
            </div>

            {uploadedFileName && uploadedBackupData && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-extrabold text-emerald-900">{uploadedFileName}</p>
                    <p className="text-[10px] text-emerald-700">
                      {uploadedBackupData.orders.length} pedidos e {uploadedBackupData.clientPartners.length} parceiros identificados no arquivo
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setUploadedBackupData(null);
                    setUploadedFileName('');
                  }}
                  className="px-2.5 py-1 bg-white border border-emerald-300 text-emerald-700 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                >
                  Remover
                </button>
              </div>
            )}

            {uploadError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2 font-semibold">
                <AlertTriangle size={16} className="shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* STEP 2: SELECT DATE PERIOD & MODE */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Calendar size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">2. Filtro de Período do Backup</h2>
              <p className="text-xs text-slate-400">Restaurar todos os pedidos contidos no arquivo ou filtrar por data específica</p>
            </div>
          </div>

          {/* Mode Switcher: All Orders vs Date Filter */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterByPeriod(false)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                !filterByPeriod 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <ShoppingBag size={14} />
              <span>Exibir Todos os Pedidos ({stats.totalOrdersInBackup})</span>
            </button>
            <button
              onClick={() => setFilterByPeriod(true)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterByPeriod 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Filter size={14} />
              <span>Filtrar por Intervalo de Datas</span>
            </button>
          </div>
        </div>

        {/* Date Filter Inputs & Presets (Visible when filterByPeriod is TRUE) */}
        {filterByPeriod ? (
          <div className="space-y-3 bg-slate-50/70 p-4 rounded-xl border border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Atalhos de Período:</span>
              <div className="flex flex-wrap gap-1">
                {backupDateRange.count > 0 && (
                  <button
                    onClick={fitPeriodToBackup}
                    className="px-2.5 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-lg text-[11px] font-bold cursor-pointer transition-all flex items-center gap-1"
                  >
                    <Layers size={12} />
                    <span>Ajustar ao Período do Backup ({formatToBrazilianDate(backupDateRange.min)} - {formatToBrazilianDate(backupDateRange.max)})</span>
                  </button>
                )}
                <button
                  onClick={() => setQuickPeriod('today')}
                  className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-blue-50 hover:text-blue-600 text-slate-600 rounded-lg text-[11px] font-bold cursor-pointer transition-all"
                >
                  Hoje
                </button>
                <button
                  onClick={() => setQuickPeriod('yesterday')}
                  className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-blue-50 hover:text-blue-600 text-slate-600 rounded-lg text-[11px] font-bold cursor-pointer transition-all"
                >
                  Ontem
                </button>
                <button
                  onClick={() => setQuickPeriod('last7')}
                  className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-blue-50 hover:text-blue-600 text-slate-600 rounded-lg text-[11px] font-bold cursor-pointer transition-all"
                >
                  Últimos 7 Dias
                </button>
                <button
                  onClick={() => setQuickPeriod('this_month')}
                  className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-blue-50 hover:text-blue-600 text-slate-600 rounded-lg text-[11px] font-bold cursor-pointer transition-all"
                >
                  Mês Atual
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Data Inicial
                </label>
                <input
                  type="date"
                  value={startDate}
                  max={endDate || undefined}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStartDate(val);
                    if (val && endDate && val > endDate) {
                      setEndDate(val);
                    }
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Data Final
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val && startDate && val < startDate) {
                      setStartDate(val);
                    }
                    setEndDate(val);
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            {stats.totalOrders < stats.totalOrdersInBackup && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
                <div className="flex items-center gap-2">
                  <Info size={16} className="text-amber-600 shrink-0" />
                  <span>
                    O backup possui <strong>{stats.totalOrdersInBackup} pedidos</strong> no total ({stats.totalOrdersInBackup - stats.totalOrders} pedidos estão fora das datas selecionadas).
                  </span>
                </div>
                <button
                  onClick={() => setFilterByPeriod(false)}
                  className="px-2.5 py-1 bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 rounded-lg text-[10px] font-bold cursor-pointer shrink-0"
                >
                  Exibir Todos
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black">
                ✓
              </div>
              <div>
                <p className="text-xs font-extrabold text-blue-900">Exibição Completa Ativa (Sem Filtro de Data)</p>
                <p className="text-[11px] text-blue-700 mt-0.5">
                  Todos os <strong>{stats.totalOrdersInBackup} pedidos</strong> contidos no backup serão visualizados e restaurados.
                </p>
              </div>
            </div>
            <button
              onClick={() => setFilterByPeriod(true)}
              className="px-3 py-1.5 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl text-xs font-bold cursor-pointer transition-all"
            >
              Restringir por Data
            </button>
          </div>
        )}
      </div>

      {/* STEP 3: PREVIEW & PERIOD STATS */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Filter size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">3. Pré-Visualização dos Dados</h2>
              <p className="text-xs text-slate-400">
                {filterByPeriod 
                  ? `Registros correspondentes ao período de ${formatToBrazilianDate(startDate)} até ${formatToBrazilianDate(endDate)}`
                  : `Todos os registros do arquivo (${stats.totalOrdersInBackup} pedidos no total)`
                }
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 bg-blue-50/60 border border-blue-100 rounded-xl">
            <p className="text-[10px] font-bold uppercase text-blue-600 tracking-wider">Pedidos a Restaurar</p>
            <p className="text-xl font-black text-blue-950 mt-1">{stats.totalOrders}</p>
            <div className="text-[10px] text-blue-700 mt-1 flex gap-2">
              <span>{stats.concluded} Concluídos</span>
              <span>•</span>
              <span>{stats.occurrences} Ocorrências</span>
            </div>
          </div>

          <div className="p-3.5 bg-emerald-50/60 border border-emerald-100 rounded-xl">
            <p className="text-[10px] font-bold uppercase text-emerald-600 tracking-wider">Valor Total Nota Fiscal</p>
            <p className="text-xl font-black text-emerald-950 mt-1">
              R$ {stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-emerald-700 mt-1">R$ {stats.totalFreight.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em fretes</p>
          </div>

          <div className="p-3.5 bg-purple-50/60 border border-purple-100 rounded-xl">
            <p className="text-[10px] font-bold uppercase text-purple-600 tracking-wider">Clientes Parceiros</p>
            <p className="text-xl font-black text-purple-950 mt-1">{stats.partnersInBackup}</p>
            <p className="text-[10px] text-purple-700 mt-1">Registros no arquivo/backup</p>
          </div>

          <div className="p-3.5 bg-amber-50/60 border border-amber-100 rounded-xl">
            <p className="text-[10px] font-bold uppercase text-amber-600 tracking-wider">Condutores / Entregadores</p>
            <p className="text-xl font-black text-amber-950 mt-1">{stats.ridersInBackup}</p>
            <p className="text-[10px] text-amber-700 mt-1">Registros de frota</p>
          </div>
        </div>

        {/* Filter controls inside table preview */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por ID, cliente, parceiro..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Filtrar Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="Não iniciado">Não iniciado</option>
              <option value="Em rota">Em rota</option>
              <option value="Entregando">Entregando</option>
              <option value="Concluído">Concluído</option>
              <option value="Ocorrência">Ocorrência</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </div>
        </div>

        {/* Table Preview */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="p-3">Pedido / ID</th>
                  <th className="p-3">Data</th>
                  <th className="p-3">Cliente / Destinatário</th>
                  <th className="p-3">Parceiro</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Valor NF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredPreviewOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                      {stats.totalOrdersInBackup === 0 ? (
                        <div className="space-y-1">
                          <p className="font-bold text-slate-600">Nenhum pedido encontrado neste snapshot de backup.</p>
                          <p className="text-[11px]">Selecione outro snapshot ou gere um novo backup da base atual.</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="font-bold text-slate-600">Nenhum pedido dentro das datas filtradas.</p>
                          <button
                            onClick={() => setFilterByPeriod(false)}
                            className="mt-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                          >
                            Exibir Todos os {stats.totalOrdersInBackup} Pedidos do Backup
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredPreviewOrders.slice(0, 50).map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-bold font-mono text-blue-700">{order.id}</td>
                      <td className="p-3 text-slate-600 whitespace-nowrap">{formatToBrazilianDate(order.date || order.createdAt)}</td>
                      <td className="p-3 text-slate-800 font-bold max-w-xs truncate">{resolveOrderDisplayName(order.clientName)}</td>
                      <td className="p-3 text-slate-600">{getPartnerDisplayName(order.partnerName)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          order.status === 'Concluído' ? 'bg-emerald-100 text-emerald-800' :
                          order.status === 'Ocorrência' ? 'bg-rose-100 text-rose-800' :
                          order.status === 'Em rota' ? 'bg-amber-100 text-amber-800' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-slate-800">
                        R$ {order.value?.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filteredPreviewOrders.length > 50 && (
            <div className="p-2.5 bg-slate-50 text-center text-[11px] font-bold text-slate-500 border-t border-slate-200">
              Exibindo 50 de {filteredPreviewOrders.length} pedidos correspondentes.
            </div>
          )}
        </div>
      </div>

      {/* STEP 4: RESTORATION MODE & CONFIRMATION BUTTON */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
            <ShieldAlert size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">4. Modo de Aplicação e Confirmação</h2>
            <p className="text-xs text-slate-400">Escolha como os dados do backup serão aplicados no banco de dados ativo</p>
          </div>
        </div>

        {/* Restore Mode Radio Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div 
            onClick={() => setRestoreMode('merge')}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              restoreMode === 'merge' 
                ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-sm' 
                : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-black text-xs text-blue-900 flex items-center gap-1.5">
                <Layers size={14} className="text-blue-600" />
                Mesclar / Atualizar (Recomendado)
              </span>
              {restoreMode === 'merge' && <CheckCircle2 size={16} className="text-blue-600" />}
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Atualiza os pedidos existentes correspondentes e insere novos pedidos do backup sem apagar os outros pedidos do sistema.
            </p>
          </div>

          <div 
            onClick={() => setRestoreMode('replace_period')}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              restoreMode === 'replace_period' 
                ? 'bg-amber-50/80 border-amber-500 ring-2 ring-amber-500/20 shadow-sm' 
                : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-black text-xs text-amber-900 flex items-center gap-1.5">
                <Calendar size={14} className="text-amber-600" />
                Substituir Período
              </span>
              {restoreMode === 'replace_period' && <CheckCircle2 size={16} className="text-amber-600" />}
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Remove os pedidos atuais situados no intervalo selecionado e re-insere exatamente os pedidos contidos no backup para aquele período.
            </p>
          </div>

          <div 
            onClick={() => setRestoreMode('replace_all')}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              restoreMode === 'replace_all' 
                ? 'bg-rose-50/80 border-rose-500 ring-2 ring-rose-500/20 shadow-sm' 
                : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-black text-xs text-rose-900 flex items-center gap-1.5">
                <RotateCcw size={14} className="text-rose-600" />
                Substituir Base Completa
              </span>
              {restoreMode === 'replace_all' && <CheckCircle2 size={16} className="text-rose-600" />}
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Substitui a base inteira atual pelo contido no arquivo/snapshot de backup selecionado. Use com atenção.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
          <div className="text-xs text-slate-500">
            {filterByPeriod ? (
              <span>Serão restaurados <strong>{backupOrdersInPeriod.length} pedidos</strong> do período de {formatToBrazilianDate(startDate)} a {formatToBrazilianDate(endDate)}.</span>
            ) : (
              <span>Serão restaurados <strong>{backupOrdersInPeriod.length} pedidos</strong> (todos os pedidos do backup).</span>
            )}
          </div>

          <button
            onClick={() => setIsConfirmOpen(true)}
            disabled={backupOrdersInPeriod.length === 0 && restoreMode !== 'replace_all'}
            className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            <RotateCcw size={16} />
            <span>Executar Restauração ({backupOrdersInPeriod.length} Pedidos)</span>
          </button>
        </div>
      </div>

      {/* CONFIRMATION MODAL */}
      <AnimatePresence>
        {isConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                <AlertTriangle size={24} />
              </div>

              <div className="text-center">
                <h3 className="text-base font-black text-slate-800">Confirmar Restauração</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Você está prestes a aplicar os dados do backup na base operacional ativa.
                </p>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1.5">
                <p>• <strong>Modo:</strong> {restoreMode === 'merge' ? 'Mesclar e Atualizar' : restoreMode === 'replace_period' ? 'Substituir Período' : 'Substituir Tudo'}</p>
                <p>• <strong>Período:</strong> {filterByPeriod ? `${formatToBrazilianDate(startDate)} a ${formatToBrazilianDate(endDate)}` : 'Todo o Backup'}</p>
                <p>• <strong>Pedidos Afetados:</strong> {backupOrdersInPeriod.length} pedidos</p>
                {activeBackupData?.clientPartners && activeBackupData.clientPartners.length > 0 && (
                  <p>• <strong>Parceiros:</strong> {activeBackupData.clientPartners.length} clientes parceiros</p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsConfirmOpen(false)}
                  disabled={isRestoring}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  disabled={isRestoring}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black cursor-pointer transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  {isRestoring ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Restaurando...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Confirmar e Aplicar</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
