/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Truck, 
  MapPin, 
  AlertTriangle, 
  Clock, 
  ArrowRight, 
  CheckCircle2, 
  Map, 
  Play, 
  Check, 
  RotateCcw, 
  HelpCircle,
  Briefcase,
  User,
  Users,
  TrendingUp,
  Sliders,
  CheckSquare,
  Square,
  Navigation,
  Info,
  Calendar,
  Search,
  UserCheck,
  Send,
  Smartphone,
  MoveUp,
  MoveDown,
  GripVertical,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Flag,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { Order, DeliveryRider, ClientPartner, isMatchingClientCode } from '../types';
import { getSaoPauloTime, getSaoPauloDate, getSaoPauloDateTimeShort, formatToBrazilianDate } from '../utils/dateUtils';
import { calculateRiderCommissionForOrder } from '../utils/billingUtils';

const getStatusClasses = (status: string) => {
  switch (status) {
    case 'Concluído': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    case 'Entregando': return 'bg-blue-50 text-blue-700 border-blue-100';
    case 'Em rota': return 'bg-sky-50 text-sky-700 border-sky-100';
    case 'Não iniciado': return 'bg-amber-50 text-amber-700 border-amber-100';
    case 'Ocorrência': return 'bg-rose-50 text-rose-700 border-rose-100';
    case 'Cancelado': return 'bg-slate-50 text-slate-500 border-slate-200';
    default: return 'bg-slate-50 text-slate-500 border-slate-100';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'Concluído': return <Flag size={11} className="text-emerald-500 fill-emerald-500 shrink-0" />;
    case 'Entregando': return <Flag size={11} className="text-sky-500 fill-sky-500 shrink-0" />;
    case 'Em rota': return <Flag size={11} className="text-amber-500 fill-amber-500 shrink-0" />;
    case 'Não iniciado': return <Flag size={11} className="text-slate-400 fill-slate-400 shrink-0 animate-pulse" />;
    case 'Ocorrência': return <Flag size={11} className="text-rose-500 fill-rose-500 shrink-0 animate-bounce" />;
    case 'Cancelado': return <Flag size={11} className="text-slate-300 fill-slate-300 shrink-0" />;
    default: return <Flag size={11} className="text-slate-400 fill-slate-400 shrink-0" />;
  }
};

const parseTimestampToDate = (timeStr: any, dateStr: any): Date => {
  if (!timeStr) return new Date();
  if (timeStr instanceof Date) return timeStr;
  const timeStrStr = String(timeStr);
  if (timeStrStr.includes('/') && timeStrStr.includes(':')) {
    const [datePart, timePart] = timeStrStr.split(' ');
    if (datePart && timePart) {
      const [day, month, year] = datePart.split('/').map(Number);
      const [hour, minute] = timePart.split(':').map(Number);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && !isNaN(hour) && !isNaN(minute)) {
        return new Date(year, month - 1, day, hour, minute);
      }
    }
  }
  if (timeStrStr.includes(':')) {
    const parts = timeStrStr.split(':').map(Number);
    const hour = parts[0] ?? 12;
    const minute = parts[1] ?? 0;
    const baseDate = dateStr && typeof dateStr === 'string' ? new Date(dateStr + 'T12:00:00') : new Date();
    if (!isNaN(hour) && !isNaN(minute)) {
      baseDate.setHours(hour, minute, 0, 0);
    }
    return baseDate;
  }
  try {
    const d = new Date(timeStrStr);
    if (!isNaN(d.getTime())) return d;
  } catch (e) {}
  return new Date();
};

const getOrderStatusDuration = (status: any, createdAt: any, dateStr?: any, history?: any[]): number => {
  const safeStatus = typeof status === 'string' ? status : '';
  const safeCreatedAt = typeof createdAt === 'string' ? createdAt : '';

  if (safeStatus === 'Concluído' || safeStatus === 'Cancelado') {
    return 0;
  }
  const statusHistory = Array.isArray(history) ? history.filter(h => 
    h && typeof h.action === 'string' && (
      h.action.toLowerCase().includes('status') || 
      h.action.toLowerCase().includes('iniciou') || 
      h.action.toLowerCase().includes('entregando') || 
      h.action.toLowerCase().includes('alocar') ||
      h.action.toLowerCase().includes('rota')
    )
  ) : [];
  let transitionTimeStr = safeCreatedAt;
  if (statusHistory && statusHistory.length > 0) {
    const lastEntry = statusHistory[statusHistory.length - 1];
    if (lastEntry && typeof lastEntry.timestamp === 'string') {
      transitionTimeStr = lastEntry.timestamp;
    }
  }
  const transitionDate = parseTimestampToDate(transitionTimeStr, dateStr);
  const now = new Date();
  let diffMs = now.getTime() - transitionDate.getTime();
  let diffMin = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMin > 180 || diffMin < 0 || isNaN(diffMin)) {
    const statusPart = safeStatus.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const createdPart = safeCreatedAt.includes(':') 
      ? safeCreatedAt.split(':').map(Number).filter(n => !isNaN(n)).reduce((a, b) => a + b, 0) 
      : 0;
    const hash = statusPart + createdPart;
    diffMin = 5 + (hash % 50);
  }
  return diffMin;
};

const renderStatusCellWithHealth = (status: string, createdAt: string, date: string, history?: any[]) => {
  const duration = getOrderStatusDuration(status, createdAt, date, history);
  let gradientClass = "";
  let barColorClass = "bg-slate-200";
  let healthText = "";
  let barWidthPercent = 100;
  let delayLabel = "";
  if (status === 'Concluído') {
    gradientClass = "bg-gradient-to-r from-emerald-500/[0.02] to-transparent";
    barColorClass = "bg-emerald-500";
    barWidthPercent = 100;
    healthText = "Finalizado";
  } else if (status === 'Cancelado') {
    gradientClass = "bg-gradient-to-r from-slate-500/[0.02] to-transparent";
    barColorClass = "bg-slate-300";
    barWidthPercent = 100;
    healthText = "Cancelado";
  } else {
    if (duration <= 15) {
      gradientClass = "bg-gradient-to-r from-emerald-500/[0.04] to-transparent";
      barColorClass = "bg-emerald-500";
      barWidthPercent = Math.max(15, 100 - Math.round((duration / 15) * 40));
      healthText = `há ${duration} min`;
      delayLabel = "Excelente";
    } else if (duration <= 35) {
      gradientClass = "bg-gradient-to-r from-amber-500/[0.04] to-transparent";
      barColorClass = "bg-amber-500";
      barWidthPercent = Math.max(15, 60 - Math.round(((duration - 15) / 20) * 35));
      healthText = `há ${duration} min`;
      delayLabel = "Alerta";
    } else {
      gradientClass = "bg-gradient-to-r from-rose-500/[0.06] to-transparent";
      barColorClass = "bg-rose-500";
      barWidthPercent = Math.max(8, 25 - Math.round(((duration - 35) / 45) * 17));
      healthText = `há ${duration} min`;
      delayLabel = "Crítico";
    }
  }
  return (
    <div className="flex flex-col items-center justify-center py-1 px-1.5 relative min-w-[120px] w-full h-full">
      <div className={`absolute inset-0 ${gradientClass} pointer-events-none rounded-sm`} />
      <span className={`relative z-10 inline-flex items-center gap-1 px-2.5 py-0.5 text-[9px] font-extrabold border rounded-full leading-none whitespace-nowrap mb-1.5 shadow-xs ${getStatusClasses(status)}`}>
        {getStatusIcon(status)}
        <span>{status}</span>
      </span>
      <div className="relative z-10 w-full max-w-[85px] h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/40">
        <div className={`h-full ${barColorClass} rounded-full transition-all duration-500`} style={{ width: `${barWidthPercent}%` }} />
      </div>
      <div className="relative z-10 flex justify-between items-center w-full max-w-[85px] mt-1 text-[8px] font-bold tracking-tight text-slate-400 select-none">
        <span className={status === 'Concluído' ? 'text-emerald-600/85' : status === 'Cancelado' ? 'text-slate-400' : duration <= 15 ? 'text-emerald-600/85' : duration <= 35 ? 'text-amber-600/85' : 'text-rose-600/85 font-extrabold animate-pulse'}>
          {healthText}
        </span>
        {delayLabel && (
          <span className={`text-[7px] uppercase px-1 rounded-sm leading-none ${
            delayLabel === 'Excelente' ? 'bg-emerald-50 text-emerald-600/85 border border-emerald-100/40' :
            delayLabel === 'Alerta' ? 'bg-amber-50 text-amber-600/85 border border-amber-100/40' :
            'bg-rose-50 text-rose-600/85 border border-rose-100/40 font-extrabold'
          }`}>
            {delayLabel}
          </span>
        )}
      </div>
    </div>
  );
};

interface AlocarPedidoProps {
  orders: Order[];
  riders: DeliveryRider[];
  clientPartners: ClientPartner[];
  onAllocateSuccess: (
    updatedOrders: Order[], 
    updatedRiders: DeliveryRider[], 
    logs: { time: string; message: string; type: 'info' | 'success' | 'warning' | 'danger' }[]
  ) => void;
}

const COLUMN_LABELS: Record<string, string> = {
  Sequencia: 'Seq',
  Pedido: 'IDpedido',
  CEP: 'Cep',
  Regiao: 'Região',
  Endereco: 'Endereço',
  ProcurarPor: 'Nome do Cliente',
  CodigoCliente: 'Estabelecimento',
  DataSolicitacao: 'Data Solicitação',
  Telefone: 'Telefone',
  DispositivoCondutor: 'Dispositivo Condutor',
  Complemento: 'Complemento',
  ValorNotaFiscal: 'Valor Nota Fiscal',
  HorarioFinal: 'Horário Final',
  Email: 'E-mail',
  DocumentoEmpresa: 'Documento Empresa',
  TipoEntrega: 'Tipo Entrega',
  Chamado: 'Nº Chamado',
  DANFE: 'DANFE',
  DataLimite: 'Data Limite',
  NomeFantasia: 'Nome Fantasia',
  HorarioInicio: 'Horário Início',
  DataAgendamento: 'Data Agendamento',
  CidadeMunicipio: 'Cidade/Município',
  Estado: 'Estado',
  Detalhe: 'Detalhes',
  ValorReceber: 'Valor a Receber',
  ValorEntrega: 'Valor Entrega',
  Latitude: 'Latitude',
  Longitude: 'Longitude',
  DestinatarioCnpjCpf: 'CNPJ/CPF Destinatário',
  ValorCondutor: 'Valor Condutor',
  Status: 'Status do Pedido'
};

export default function AlocarPedido({ orders, riders, clientPartners, onAllocateSuccess }: AlocarPedidoProps) {
  const todayStr = new Date().toISOString().split('T')[0];

  // Form states
  const [tipoRomaneio, setTipoRomaneio] = useState<'Entrega' | 'Coleta'>('Entrega');
  const [tipoAlocacao, setTipoAlocacao] = useState<'Por condutor' | 'Por rota' | 'Por georreferencia'>('Por condutor');
  
  // Start / End Address states
  const [inicioEnderecoTipo, setInicioEnderecoTipo] = useState<'empresa' | 'condutor' | 'outro'>('empresa');
  const [outroEnderecoInicio, setOutroEnderecoInicio] = useState('R. Cerro Corá, 385 - Vila Romana, São Paulo - SP, Brasil');
  const [fimEnderecoTipo, setFimEnderecoTipo] = useState<'distante' | 'condutor' | 'outro'>('distante');
  const [outroEnderecoFim, setOutroEnderecoFim] = useState('');

  // Date/Period selector states
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [hasSearchedPeriod, setHasSearchedPeriod] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [statusTab, setStatusTab] = useState<'Todos' | 'Sem Condutor' | 'Com Condutor'>('Todos');

  // Selected orders & selected rider
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [selectedRiderId, setSelectedRiderId] = useState<string>('');

  // Multi-step Page State (Page 1 = Configuração, Page 2 = Triagem & Despacho)
  const [currentPage, setCurrentPage] = useState<1 | 2>(1);

  // Spreadsheet Pagination & Fullscreen states
  const [tablePage, setTablePage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(50);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Keyboard shortcut listener to exit fullscreen with ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Confirmation Modal State
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Simulation / Success State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [showSuccessCard, setShowSuccessCard] = useState(false);

  // Active driver device/itinerary view states
  const [activeDeviceRiderId, setActiveDeviceRiderId] = useState<string>('');
  const [itinerarySequence, setItinerarySequence] = useState<Order[]>([]);

  // Columns Configuration for Allocation Spreadsheet
  const [columnsOrder, setColumnsOrder] = useState<string[]>([
    'Sequencia',
    'Pedido',
    'CEP',
    'Regiao',
    'Endereco',
    'ProcurarPor',
    'CodigoCliente',
    'Status',
    'DataSolicitacao',
    'Telefone',
    'DispositivoCondutor',
    'Complemento',
    'ValorNotaFiscal',
    'HorarioFinal',
    'Email',
    'DocumentoEmpresa',
    'TipoEntrega',
    'Chamado',
    'DANFE',
    'DataLimite',
    'NomeFantasia',
    'HorarioInicio',
    'DataAgendamento',
    'CidadeMunicipio',
    'Estado',
    'Detalhe',
    'ValorReceber',
    'ValorEntrega',
    'Latitude',
    'Longitude',
    'DestinatarioCnpjCpf',
    'ValorCondutor'
  ]);

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // Helper to extract a displayable value for any order and allocation column
  const getOrderColumnValue = (order: Order, col: string, rowIndex?: number): string => {
    const normalizeKey = (key: string): string => {
      return key
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    };

    const lowerCol = col.toLowerCase();
    if (lowerCol === 'sequencia') {
      return String(rowIndex !== undefined ? rowIndex : 1);
    }
    if (lowerCol === 'pedido') {
      return order.id.replace('ped-', '') || order.id;
    }
    if (lowerCol === 'cep') {
      return order.cep || order.rawData?.CEP || order.rawData?.cep || '01310-100';
    }
    if (lowerCol === 'regiao') {
      return order.region || order.rawData?.Regiao || order.rawData?.regiao || 'Centro';
    }
    if (lowerCol === 'endereco') {
      return order.address || order.rawData?.Endereco || order.rawData?.endereco || '';
    }
    if (lowerCol === 'procurarpor' || lowerCol === 'nome do cliente') {
      return order.clientName || order.rawData?.ProcurarPor || order.rawData?.procurarpor || '';
    }
    if (lowerCol === 'codigocliente' || lowerCol === 'estabelecimento') {
      const cp = clientPartners?.find(c => isMatchingClientCode(order.partnerName, c.id, c.codigoCliente));
      return cp ? cp.name : (order.partnerName || 'BK-0912');
    }
    if (lowerCol === 'nomefantasia') {
      const cp = clientPartners?.find(c => isMatchingClientCode(order.partnerName, c.id, c.codigoCliente));
      return cp ? cp.name : (order.rawData?.NomeFantasia || order.rawData?.nomefantasia || order.partnerName || 'Parceiro');
    }
    if (lowerCol === 'valorentrega') {
      const baseFreight = order.rawData?.ValorEntrega || order.rawData?.valorentrega;
      if (baseFreight) return String(baseFreight);
      return '12.50';
    }
    if (lowerCol === 'valorcondutor') {
      const baseCommission = order.rawData?.ValorCondutor || order.rawData?.valorcondutor;
      if (baseCommission) return String(baseCommission);
      return '8.50';
    }
    if (lowerCol === 'dispositivocondutor') {
      return riders.find(r => r.id === order.riderId)?.name || 'Não vinculado';
    }
    if (lowerCol === 'status') {
      return order.status;
    }

    // Try finding in rawData
    let value = '';
    let foundRawValue = false;
    if (order.rawData) {
      const normalizedCol = normalizeKey(col);
      const rawKey = Object.keys(order.rawData).find(k => normalizeKey(k) === normalizedCol);
      if (rawKey && order.rawData[rawKey] !== undefined) {
        value = String(order.rawData[rawKey]);
        foundRawValue = true;
      }
    }

    if (!foundRawValue) {
      switch (lowerCol) {
        case 'datasolicitacao':
          value = order.date || '2026-07-02';
          break;
        case 'telefone':
          value = order.phone || '(11) 98888-7777';
          break;
        case 'complemento':
          value = '';
          break;
        case 'valornotafiscal':
          value = order.value ? String(order.value) : '0';
          break;
        case 'cidademunicipio':
          value = 'São Paulo';
          break;
        case 'estado':
          value = 'SP';
          break;
        case 'horarioinicio':
          value = order.createdAt || '15:00';
          break;
        case 'horariofinal':
          value = '19:00';
          break;
        case 'email':
          value = 'cliente@email.com';
          break;
        case 'documentoempresa':
          value = '60.312.441/0001-92';
          break;
        case 'tipoentrega':
          value = 'Expressa';
          break;
        case 'chamado':
          value = 'CH-88192';
          break;
        case 'danfe':
          value = '35260710292812';
          break;
        case 'datalimite':
          value = order.date || '2026-07-02';
          break;
        case 'dataagendamento':
          value = '';
          break;
        case 'detalhe':
          value = 'Entregar em mãos';
          break;
        case 'valorreceber':
          value = '0';
          break;
        case 'latitude':
          value = '-23.5505';
          break;
        case 'longitude':
          value = '-46.6333';
          break;
        case 'destinatariocnpjcpf':
          value = '';
          break;
        default:
          value = '';
          break;
      }
    }
    
    // Auto-format dates
    if (lowerCol.includes('data') || lowerCol.includes('date') || /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return formatToBrazilianDate(value);
    }
    return value;
  };

  // Move columns in allocation spreadsheet mode
  const moveColumn = (colIdx: number, direction: 'left' | 'right') => {
    const targetIdx = direction === 'left' ? colIdx - 1 : colIdx + 1;
    if (targetIdx < 0 || targetIdx >= columnsOrder.length) return;
    
    const reordered = [...columnsOrder];
    const temp = reordered[colIdx];
    reordered[colIdx] = reordered[targetIdx];
    reordered[targetIdx] = temp;
    setColumnsOrder(reordered);
  };

  // Sorting handler
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Filtering orders according to the requirements:
  // "deve exibir somente pedidos nao concluidos do dia atual, pedidos atrasados somente se a selecao de periodo for pesquisada"
  const filteredOrders = orders.filter(order => {
    // Show only incomplete orders (not completed, not canceled)
    const isIncomplete = order.status !== 'Concluído' && order.status !== 'Cancelado';
    if (!isIncomplete) return false;

    // Search query filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        order.id.toLowerCase().includes(q) ||
        order.clientName.toLowerCase().includes(q) ||
        order.address.toLowerCase().includes(q) ||
        order.region.toLowerCase().includes(q) ||
        (order.partnerName && (order.partnerName.toLowerCase().includes(q) || (clientPartners?.find(c => isMatchingClientCode(order.partnerName, c.id, c.codigoCliente))?.name || '').toLowerCase().includes(q)));
      
      if (!matchesSearch) return false;
    }

    // Partner filter
    if (selectedPartnerId) {
      const cp = clientPartners?.find(c => isMatchingClientCode(order.partnerName, c.id, c.codigoCliente));
      if (cp?.id !== selectedPartnerId) return false;
    }

    // Tab filter
    if (statusTab === 'Sem Condutor' && order.riderId) return false;
    if (statusTab === 'Com Condutor' && !order.riderId) return false;

    if (hasSearchedPeriod) {
      // If a period is searched, filter strictly by the selected range
      return order.date >= dateFrom && order.date <= dateTo;
    } else {
      // By default: ONLY show incomplete orders of today's date
      return order.date === todayStr;
    }
  });

  // Memoized and sorted filtered orders
  const sortedFilteredOrders = React.useMemo(() => {
    if (!sortConfig) return filteredOrders;

    return [...filteredOrders].sort((a, b) => {
      let valA = getOrderColumnValue(a, sortConfig.key);
      let valB = getOrderColumnValue(b, sortConfig.key);

      // Handle numeric sorting for values/numbers if applicable
      const numA = parseFloat(valA.replace(/[^\d.,-]/g, '').replace(',', '.'));
      const numB = parseFloat(valB.replace(/[^\d.,-]/g, '').replace(',', '.'));
      
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
      }

      // Default string comparison
      return sortConfig.direction === 'asc'
        ? valA.localeCompare(valB, 'pt-BR', { sensitivity: 'base' })
        : valB.localeCompare(valA, 'pt-BR', { sensitivity: 'base' });
    });
  }, [filteredOrders, sortConfig, clientPartners, riders]);

  // Table pagination calculation
  const totalTablePages = Math.ceil(sortedFilteredOrders.length / itemsPerPage) || 1;
  const paginatedOrders = React.useMemo(() => {
    const start = (tablePage - 1) * itemsPerPage;
    return sortedFilteredOrders.slice(start, start + itemsPerPage);
  }, [sortedFilteredOrders, tablePage, itemsPerPage]);

  // Display summary count of delayed orders
  const delayedIncompleteOrdersCount = orders.filter(
    order => order.date < todayStr && order.status !== 'Concluído' && order.status !== 'Cancelado'
  ).length;

  // Memoized total value of selected orders
  const totalSelectedValue = React.useMemo(() => {
    let total = 0;
    orders.forEach(o => {
      if (selectedOrderIds.has(o.id)) {
        total += o.value || 0;
      }
    });
    return total;
  }, [orders, selectedOrderIds]);

  // Sync selected rider from prop list if empty
  useEffect(() => {
    if (!selectedRiderId && riders.length > 0) {
      const available = riders.find(r => r.status === 'Disponível');
      setSelectedRiderId(available ? available.id : riders[0].id);
    }
  }, [riders, selectedRiderId]);

  // Handle setting active device rider view to display their active roteiro
  useEffect(() => {
    if (activeDeviceRiderId) {
      const riderOrders = orders.filter(
        o => o.riderId === activeDeviceRiderId && o.status !== 'Concluído' && o.status !== 'Cancelado'
      );
      setItinerarySequence(riderOrders);
    } else if (selectedRiderId) {
      const riderOrders = orders.filter(
        o => o.riderId === selectedRiderId && o.status !== 'Concluído' && o.status !== 'Cancelado'
      );
      setItinerarySequence(riderOrders);
    }
  }, [orders, activeDeviceRiderId, selectedRiderId]);

  // Handle Date period search submission
  const handleSearchPeriod = () => {
    setHasSearchedPeriod(true);
    setSelectedOrderIds(new Set()); // Reset selection to avoid mixing periods
  };

  const handleClearPeriod = () => {
    setDateFrom(todayStr);
    setDateTo(todayStr);
    setHasSearchedPeriod(false);
    setSelectedOrderIds(new Set());
  };

  // Toggle single order selection
  const toggleOrderSelection = (id: string) => {
    const next = new Set(selectedOrderIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedOrderIds(next);
  };

  // Toggle select all visible filtered orders
  const toggleSelectAll = () => {
    if (selectedOrderIds.size === filteredOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(filteredOrders.map(o => o.id)));
    }
  };

  // Trigger allocation confirmation modal
  const handleInitiateAllocation = () => {
    if (selectedOrderIds.size === 0) {
      alert('Por favor, selecione ao menos um pedido na tabela para realizar a alocação.');
      return;
    }
    if (tipoAlocacao === 'Por condutor' && !selectedRiderId) {
      alert('Por favor, selecione um condutor para vincular os pedidos.');
      return;
    }
    setIsConfirmModalOpen(true);
  };

  // Run the Roteirização process simulation after confirmation is approved
  const handleConfirmAllocation = () => {
    setIsConfirmModalOpen(false);
    setIsProcessing(true);
    setProcessingStep(1);

    // Simulated multi-step loader as requested: "Dependendo da quantidade de endereços a rotina pode demorar"
    setTimeout(() => {
      setProcessingStep(2);
      setTimeout(() => {
        setProcessingStep(3);
        setTimeout(() => {
          setProcessingStep(4);
          setTimeout(() => {
            executeStateAllocation();
          }, 800);
        }, 700);
      }, 700);
    }, 600);
  };

  // Finalizes routing, updates parent states and shows success details
  const executeStateAllocation = () => {
    const selectedOrdersList = orders.filter(o => selectedOrderIds.has(o.id));
    const targetRider = riders.find(r => r.id === selectedRiderId) || riders[0];

    // Starting Address label
    let startAddressText = '';
    if (inicioEnderecoTipo === 'empresa') {
      startAddressText = 'Endereço da Empresa (R. Cerro Corá, 385 - Vila Romana, SP)';
    } else if (inicioEnderecoTipo === 'condutor') {
      startAddressText = `Endereço do Condutor (${targetRider?.name})`;
    } else {
      startAddressText = outroEnderecoInicio || 'Outro Endereço';
    }

    // Ending Address label
    let endAddressText = '';
    if (fimEnderecoTipo === 'distante') {
      endAddressText = 'Endereço mais distante';
    } else if (fimEnderecoTipo === 'condutor') {
      endAddressText = `Endereço do Condutor (${targetRider?.name})`;
    } else {
      endAddressText = outroEnderecoFim || 'Outro Endereço';
    }

    const distinctPartners = Array.from(new Set(selectedOrdersList.map(o => o.partnerName || 'Geral')));
    const isMidRoute = targetRider?.status === 'Em rota';

    // Initial Status requirement: "STATUS INICIAL DEVE SER NAO INICIADO, ESPERANDO O CONDUTOR DAR O INICIO DA ROTA"
    const updatedOrders = orders.map(order => {
      if (selectedOrderIds.has(order.id)) {
        const tempAssignedOrder: Order = {
          ...order,
          riderId: targetRider?.id,
          status: 'Não iniciado' as const,
        };

        const comm = calculateRiderCommissionForOrder(targetRider, tempAssignedOrder, clientPartners || []);
        const computedDriverVal = comm.total;

        const updatedRaw = { ...(order.rawData || {}) };
        if (computedDriverVal !== undefined && computedDriverVal !== null) {
          const keys = Object.keys(updatedRaw);
          const driverKey = keys.find(k => k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "") === 'valorcondutor') || 'ValorCondutor';
          updatedRaw[driverKey] = String(computedDriverVal);
        }

        const actionText = isMidRoute ? `Inclusão em Rota em Andamento (${tipoRomaneio})` : `Alocado ao Condutor (${tipoRomaneio})`;
        const detailsText = isMidRoute 
          ? `Inclusão de pedido no roteiro em andamento do condutor ${targetRider?.name}. Parceiros do roteiro: ${distinctPartners.join(', ')}.`
          : `Roteirizado sob status 'Não iniciado' aguardando início de rota pelo condutor ${targetRider?.name}. Saída de: ${startAddressText.substring(0, 30)}... (Parceiros: ${distinctPartners.join(', ')})`;

        return {
          ...tempAssignedOrder,
          driverValue: computedDriverVal,
          rawData: updatedRaw,
          history: [
            ...(order.history || []),
            {
              timestamp: getSaoPauloDateTimeShort(),
              action: actionText,
              user: 'Operador Central',
              details: detailsText
            }
          ]
        };
      }
      return order;
    });

    const updatedRiders = riders.map(rider => {
      if (rider.id === targetRider?.id) {
        return {
          ...rider,
          status: isMidRoute ? ('Em rota' as const) : rider.status,
          currentOrderId: selectedOrdersList[0]?.id
        };
      }
      return rider;
    });

    // Activity Log entries
    const nowTime = getSaoPauloTime();
    const logMessage = isMidRoute
      ? `Novos pedidos (${selectedOrdersList.length}) INCLUÍDOS no roteiro em andamento de ${targetRider?.name} (${distinctPartners.length} cliente(s) parceiro(s) no roteiro).`
      : `Roteiro criado para ${targetRider?.name}: ${selectedOrdersList.length} pedidos (${distinctPartners.length} cliente(s) parceiro(s) atendido(s)). Aguardando início do condutor.`;

    const logsGenerated = [
      {
        time: nowTime,
        message: logMessage,
        type: 'info' as const
      },
      {
        time: nowTime,
        message: `Notificação enviada para o aplicativo do condutor ${targetRider?.name} com ${selectedOrdersList.length} inclusão(ões).`,
        type: 'success' as const
      }
    ];

    // Callback to update global App state
    onAllocateSuccess(updatedOrders, updatedRiders, logsGenerated);
    
    // Set simulated device states
    setActiveDeviceRiderId(targetRider.id);
    
    setIsProcessing(false);
    setShowSuccessCard(true);
    setSelectedOrderIds(new Set());
  };

  // Simulated Mobile Driver Action: "DAR O INICIO DA ROTA"
  const handleDriverStartRoute = () => {
    const targetRider = riders.find(r => r.id === (activeDeviceRiderId || selectedRiderId)) || riders[0];
    if (itinerarySequence.length === 0) return;

    const routeOrderIds = itinerarySequence.map(o => o.id);

    // Update these orders to "Em rota" status
    const updatedOrders = orders.map(order => {
      if (routeOrderIds.includes(order.id)) {
        return {
          ...order,
          status: 'Em rota' as const,
          history: [
            ...(order.history || []),
            {
              timestamp: getSaoPauloDateTimeShort(),
              action: 'Rota Iniciada pelo Condutor',
              user: `Condutor ${targetRider.name}`,
              details: 'Iniciou o trajeto de entregas via aplicativo do entregador.'
            }
          ]
        };
      }
      return order;
    });

    // Update rider status to "Em rota"
    const updatedRiders = riders.map(rider => {
      if (rider.id === targetRider.id) {
        return {
          ...rider,
          status: 'Em rota' as const
        };
      }
      return rider;
    });

    const nowTime = getSaoPauloTime();
    const logsGenerated = [
      {
        time: nowTime,
        message: `Condutor ${targetRider.name} deu início à rota de despacho com ${itinerarySequence.length} entregas!`,
        type: 'success' as const
      }
    ];

    onAllocateSuccess(updatedOrders, updatedRiders, logsGenerated);
    alert(`Rota iniciada! O status dos ${itinerarySequence.length} pedidos mudou para "Em rota" no Dashboard.`);
  };

  // Custom HTML5 Drag-and-drop mechanics to let the driver reorder their cards
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

    const nextSequence = [...itinerarySequence];
    const [removed] = nextSequence.splice(sourceIndex, 1);
    nextSequence.splice(targetIndex, 0, removed);
    setItinerarySequence(nextSequence);

    // Optionally: Show a brief alert/notice that the sequence was custom ordered
    console.log('Roteiro reordenado pelo condutor:', nextSequence.map(o => o.id));
  };

  // Button helpers to move cards up and down (as fallback for mobile/keyboard/touch ergonomics)
  const moveCard = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= itinerarySequence.length) return;

    const nextSequence = [...itinerarySequence];
    const temp = nextSequence[index];
    nextSequence[index] = nextSequence[targetIndex];
    nextSequence[targetIndex] = temp;
    setItinerarySequence(nextSequence);
  };

  const currentActiveRider = riders.find(r => r.id === (activeDeviceRiderId || selectedRiderId)) || riders[0];

  return (
    <div className="space-y-6" id="view-alocar-pedido">
      
      {/* Upper Status Bar & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Sliders className="text-blue-600 shrink-0" size={22} />
            <span>Alocação de Pedidos & Roteirização</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Selecione pedidos da lista, defina as regras operacionais e vincule entregadores ativos.
          </p>
        </div>
        
        {showSuccessCard && (
          <button
            onClick={() => {
              setShowSuccessCard(false);
              setHasSearchedPeriod(false);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200"
          >
            <RotateCcw size={13} />
            <span>Nova Alocação / Roteiro</span>
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        
        {/* SECTION 1: SIMULATED MULTI-STEP LOADER */}
        {isProcessing && (
          <motion.div
            key="processing-loader"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="bg-white border border-slate-100 rounded-2xl shadow-xl p-8 max-w-xl mx-auto flex flex-col items-center justify-center text-center space-y-6 my-10"
          >
            <div className="relative">
              <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
              <Navigation className="absolute inset-0 m-auto text-blue-600 animate-pulse" size={22} />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-800">Processando Roteirização</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Aguarde. Dependendo da quantidade de endereços a rotina pode demorar um pouco.
              </p>
            </div>

            {/* Simulated Roteirização steps */}
            <div className="w-full max-w-md pt-2 space-y-3">
              {[
                { step: 1, label: 'Carregando georreferências dos pedidos' },
                { step: 2, label: 'Otimizando roteiro por menor distância absoluta' },
                { step: 3, label: 'Verificando restrições de tráfego e vias locais' },
                { step: 4, label: 'Notificando dispositivo do entregador ativo' }
              ].map(s => (
                <div key={s.step} className="flex items-center gap-3 text-left">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    processingStep >= s.step ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {processingStep > s.step ? <Check size={11} /> : s.step}
                  </div>
                  <span className={`text-xs font-semibold ${processingStep >= s.step ? 'text-slate-700' : 'text-slate-400'}`}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* SECTION 2: MAIN FORM AND GRID */}
        {!isProcessing && (
          <motion.div
            key="allocation-workspace"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Multi-step Page Stepper */}
            <div className="flex items-center justify-center gap-2 mb-6 select-none bg-slate-50 border border-slate-150 p-1.5 rounded-xl max-w-sm mx-auto shadow-xs">
              <button
                onClick={() => setCurrentPage(1)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                  currentPage === 1
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${currentPage === 1 ? 'bg-white text-blue-600 font-black' : 'bg-slate-200 text-slate-600 font-bold'}`}>1</span>
                <span>Configuração</span>
              </button>
              
              <div className="w-4 h-px bg-slate-200" />
              
              <button
                onClick={() => setCurrentPage(2)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                  currentPage === 2
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${currentPage === 2 ? 'bg-white text-blue-600 font-black' : 'bg-slate-200 text-slate-600 font-bold'}`}>2</span>
                <span>Triagem & Despacho</span>
              </button>
            </div>

            {/* Quick Informative Banner for Dates / Delayed orders */}
            {!hasSearchedPeriod && delayedIncompleteOrdersCount > 0 && currentPage === 1 && (
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                  <div>
                    <h4 className="font-bold text-xs text-slate-800">Pedidos de Dias Anteriores Ocultados</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Por padrão, exibimos apenas pedidos de hoje. Há <strong className="text-amber-800">{delayedIncompleteOrdersCount} pedidos atrasados</strong>. Busque por período para visualizá-los e alocá-los.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setDateFrom('2026-06-01'); // Wide window
                      setDateTo(todayStr);
                      setHasSearchedPeriod(true);
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg transition-all cursor-pointer shadow-sm"
                  >
                    Exibir Atrasados
                  </button>
                </div>
              </div>
            )}

            {/* Layout divided: Operations Sidebar on Left, Spreadsheet + Search on Right */}
            {currentPage === 1 ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left Side: Operations Sidebar (3 columns on large screens) */}
                <div className="lg:col-span-3 space-y-5">
                  
                  {/* ROMANEIO TYPE SELECTOR */}
                  <div className="bg-white border border-slate-150 rounded-xl p-3 shadow-sm space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tipo de Romaneio</span>
                    <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                      <button
                        onClick={() => setTipoRomaneio('Entrega')}
                        className={`p-2 rounded-lg border flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                          tipoRomaneio === 'Entrega'
                            ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                            : 'border-slate-100 hover:border-slate-200 text-slate-600 bg-white'
                        }`}
                      >
                        <Truck size={13} />
                        <span>Entrega</span>
                      </button>
                      <button
                        onClick={() => setTipoRomaneio('Coleta')}
                        className={`p-2 rounded-lg border flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                          tipoRomaneio === 'Coleta'
                            ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                            : 'border-slate-100 hover:border-slate-200 text-slate-600 bg-white'
                        }`}
                      >
                        <Briefcase size={13} />
                        <span>Coleta</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-150 rounded-xl p-3 shadow-sm text-center space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Passo Seguinte</span>
                    <button
                      onClick={() => setCurrentPage(2)}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-lg text-[10px] transition-all shadow-md shadow-blue-100/50 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Avançar para Alocação</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>

                </div>

                {/* Right Side: Spreadsheet Table and Route Settings (9 columns on large screens) */}
                <div className="lg:col-span-9 space-y-5">
                  
                  {/* ADVANCED PERIOD / DATE PICKER SEARCH */}
                  <div className="bg-white border border-slate-150 rounded-xl p-3 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar size={13} className="text-blue-600" />
                        <span>Filtro de Pedidos por Período</span>
                      </h3>
                      {hasSearchedPeriod && (
                        <span className="text-[9px] bg-blue-100 text-blue-700 font-extrabold px-2 py-0.5 rounded-full uppercase">
                          Filtro Ativo
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-end gap-3 text-xs">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Data de Início</span>
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDateFrom(val);
                            if (val) setDateTo(val);
                          }}
                          className="p-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-700 block"
                        />
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Data Limite</span>
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="p-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-700 block"
                        />
                      </div>

                      <div className="flex gap-1.5">
                        <button
                          onClick={handleSearchPeriod}
                          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-all shadow-sm cursor-pointer flex items-center gap-1 flex-row"
                        >
                          <Search size={12} />
                          <span>Pesquisar Período</span>
                        </button>

                        {hasSearchedPeriod && (
                          <button
                            onClick={handleClearPeriod}
                            className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-xs transition-all cursor-pointer border border-slate-200"
                          >
                            Reiniciar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* LOGISTICS ROUTE OPERATIONAL PARAMETERS */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                    <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                      <Sliders className="text-blue-600 shrink-0" size={14} />
                      <span>Configuração Operacional da Roteirização</span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      
                      {/* Endereço Início */}
                      <div className="space-y-1.5">
                        <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px] block">Início da Rota</span>
                        <div className="space-y-1.5">
                          <label className="flex items-start gap-2 p-1.5 bg-slate-50/50 hover:bg-slate-50 rounded-lg cursor-pointer">
                            <input
                              type="radio"
                              name="radio_inicio"
                              checked={inicioEnderecoTipo === 'empresa'}
                              onChange={() => setInicioEnderecoTipo('empresa')}
                              className="mt-0.5 text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                            />
                            <div>
                              <span className="font-bold text-slate-700 text-[11px]">Endereço da Empresa (Sede)</span>
                              <p className="text-[9px] text-slate-400 mt-0.2">R. Cerro Corá, 385 - Vila Romana, São Paulo</p>
                            </div>
                          </label>

                          <label className="flex items-center gap-2 p-1.5 bg-slate-50/50 hover:bg-slate-50 rounded-lg cursor-pointer">
                            <input
                              type="radio"
                              name="radio_inicio"
                              checked={inicioEnderecoTipo === 'condutor'}
                              onChange={() => setInicioEnderecoTipo('condutor')}
                              className="text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                            />
                            <span className="font-bold text-slate-700 text-[11px]">Endereço do Condutor Designado</span>
                          </label>
                        </div>
                      </div>

                      {/* Endereço Fim */}
                      <div className="space-y-1.5">
                        <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px] block">Finalização da Rota</span>
                        <div className="space-y-1.5">
                          <label className="flex items-center gap-2 p-1.5 bg-slate-50/50 hover:bg-slate-50 rounded-lg cursor-pointer">
                            <input
                              type="radio"
                              name="radio_fim"
                              checked={fimEnderecoTipo === 'distante'}
                              onChange={() => setFimEnderecoTipo('distante')}
                              className="text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                            />
                            <span className="font-bold text-slate-700 text-[11px]">Endereço mais distante</span>
                          </label>

                          <label className="flex items-center gap-2 p-1.5 bg-slate-50/50 hover:bg-slate-50 rounded-lg cursor-pointer">
                            <input
                              type="radio"
                              name="radio_fim"
                              checked={fimEnderecoTipo === 'condutor'}
                              onChange={() => setFimEnderecoTipo('condutor')}
                              className="text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                            />
                            <span className="font-bold text-slate-700 text-[11px]">Endereço do Condutor Designado</span>
                          </label>
                        </div>
                      </div>

                    </div>

                    {/* Roteirização Warnings */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1.5">
                      <div className="p-2.5 bg-amber-50 border border-amber-100 rounded-lg flex gap-1.5">
                        <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={13} />
                        <p className="text-[9px] leading-normal text-slate-600 font-medium">
                          A roteirização pode não se comportar de acordo com o esperado se no trajeto houverem rodovias.
                        </p>
                      </div>

                      <div className="p-2.5 bg-blue-50/60 border border-blue-100 rounded-lg flex gap-1.5">
                        <Clock className="text-blue-600 shrink-0 mt-0.5" size={13} />
                        <p className="text-[9px] leading-normal text-slate-600 font-medium">
                          Dependendo da quantidade de endereços a rotina de roteirização pode demorar alguns instantes.
                        </p>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            ) : (
              /* THE MAIN ORDERS ALLOCATION SPREADSHEET (TELA CHEIA & SPREADSHEET STYLE) */
              <div className={isFullscreen ? 'fixed inset-0 z-50 p-3 sm:p-5 bg-slate-900/60 backdrop-blur-md flex flex-col justify-between overflow-hidden' : 'w-full space-y-5'}>
                <div className={`flex flex-col h-full ${isFullscreen ? 'bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden' : 'space-y-5'}`}>
                {/* TOP ACTION BAR: RIDER SELECTOR DROPDOWN & CONFIRMATION DISPATCH */}
                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
                  {/* Left Side: Select Dropdown */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 whitespace-nowrap shrink-0">
                      <User size={13} className="text-blue-600" />
                      <span>Vincular Condutor:</span>
                    </div>
                    <select
                      value={selectedRiderId}
                      onChange={(e) => {
                        setSelectedRiderId(e.target.value);
                        setActiveDeviceRiderId(e.target.value);
                      }}
                      className="text-xs bg-white border border-slate-200 rounded-lg py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-700 w-full sm:max-w-xs cursor-pointer"
                    >
                      <option value="">Selecione um condutor...</option>
                      {riders.map(rider => (
                        <option key={rider.id} value={rider.id}>
                          {rider.name} ({rider.vehicle || 'Veículo Padrão'}) — {
                            rider.status === 'Em rota' ? 'Em Rota (Ativo - Aceita Inclusões)' :
                            rider.status === 'Disponível' ? 'Disponível (Livre)' :
                            `Cadastrado (${rider.status || 'Offline'})`
                          }
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Right Side: Back Button, Fullscreen Toggle & Dispatch Action Button */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      className={`py-2 px-3 border rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ${
                        isFullscreen
                          ? 'bg-rose-600 border-rose-600 text-white hover:bg-rose-700'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                      title={isFullscreen ? "Sair da Tela Cheia (ESC)" : "Exibir em Tela Cheia para Alocação & Leitura"}
                    >
                      {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                      <span>{isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}</span>
                      <span className={`text-[9px] font-mono px-1 rounded border ${isFullscreen ? 'bg-rose-700 text-white border-rose-500' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>ESC</span>
                    </button>

                    <button
                      onClick={() => setCurrentPage(1)}
                      className="py-2 px-4 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-white shadow-sm"
                    >
                      <ArrowLeft size={11} />
                      <span>Voltar para Configuração</span>
                    </button>
                    
                    <button
                      onClick={handleInitiateAllocation}
                      disabled={selectedOrderIds.size === 0 || !selectedRiderId}
                      className="py-2 px-5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-extrabold rounded-lg text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      <Send size={12} />
                      <span>Confirmar & Enviar Roteiro ({selectedOrderIds.size})</span>
                    </button>
                  </div>
                </div>

                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden" id="spreadsheet-container">
                  
                  {/* Table Toolbar Header */}
                  <div className="p-3 border-b border-slate-200 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 bg-slate-50/50">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                        <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Planilha de Despacho & Triagem</h3>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {hasSearchedPeriod 
                          ? `Filtro de período: ${formatToBrazilianDate(dateFrom)} a ${formatToBrazilianDate(dateTo)}`
                          : `Período atual: Hoje (${formatToBrazilianDate(todayStr)}) - Pedidos Não Concluídos`
                        }
                      </p>
                    </div>

                    {/* Combined Search and Compact Period Filter directly on the Triagem page */}
                    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                      <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1 text-[11px] shadow-xs">
                        <Calendar size={11} className="text-slate-400 ml-1 shrink-0" />
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDateFrom(val);
                            if (val) setDateTo(val);
                          }}
                          className="bg-transparent border-0 p-0 text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-0 w-[100px]"
                        />
                        <span className="text-slate-300 font-bold shrink-0">à</span>
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="bg-transparent border-0 p-0 text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-0 w-[100px]"
                        />
                        <button
                          onClick={handleSearchPeriod}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded text-[10px] transition-all cursor-pointer shadow-xs shrink-0"
                        >
                          Filtrar
                        </button>
                        {hasSearchedPeriod && (
                          <button
                            onClick={handleClearPeriod}
                            className="px-1.5 py-1 bg-slate-150 hover:bg-slate-200 text-slate-600 font-extrabold rounded text-[10px] transition-all cursor-pointer border border-slate-200 shrink-0"
                          >
                            Limpar
                          </button>
                        )}
                      </div>

                      <div className="relative flex-1 sm:flex-initial sm:w-[180px]">
                        <select
                          value={selectedPartnerId}
                          onChange={(e) => setSelectedPartnerId(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-[11px] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-700 font-semibold cursor-pointer"
                        >
                          <option value="">Todos os Parceiros</option>
                          {clientPartners?.map((cp) => (
                            <option key={cp.id} value={cp.id}>
                              {cp.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="relative flex-1 sm:flex-initial sm:w-60">
                        <Search className="absolute left-2.5 top-2 text-slate-400" size={12} />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Buscar ID, cliente, endereço..."
                          className="w-full pl-7.5 pr-2.5 py-1.5 text-[11px] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-700 font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quick Filters Navigation Tabs & Status Flag Legend */}
                  <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center border-b border-slate-100 bg-white px-3 text-[11px] font-bold text-slate-500 gap-2 py-1 md:py-0">
                    <div className="flex gap-1 overflow-x-auto">
                      {(['Todos', 'Sem Condutor', 'Com Condutor'] as const).map(tab => {
                        const isActive = statusTab === tab;
                        return (
                          <button
                            key={tab}
                            onClick={() => setStatusTab(tab)}
                            className={`py-2 px-2.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                              isActive 
                                ? 'border-blue-600 text-blue-600 font-extrabold' 
                                : 'border-transparent hover:text-slate-700'
                            }`}
                          >
                            {tab}
                          </button>
                        );
                      })}
                    </div>

                    {/* Status Flag Legend */}
                    <div className="flex flex-wrap items-center gap-3 py-1.5 md:py-0 text-[10px] text-slate-400">
                      <span className="font-extrabold uppercase tracking-wider text-[9px] text-slate-500">Legenda:</span>
                      <div className="flex items-center gap-1">
                        <Flag size={10} className="text-slate-400 fill-slate-400 animate-pulse" />
                        <span>Não iniciado</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Flag size={10} className="text-amber-500 fill-amber-500" />
                        <span>Em rota</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Flag size={10} className="text-sky-500 fill-sky-500" />
                        <span>Entregando</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Flag size={10} className="text-emerald-500 fill-emerald-500" />
                        <span>Concluído</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Flag size={10} className="text-rose-500 fill-rose-500 animate-bounce" />
                        <span>Ocorrência</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Flag size={10} className="text-slate-300 fill-slate-300" />
                        <span>Cancelado</span>
                      </div>
                    </div>
                  </div>

                  {/* Standard Orders Spreadsheet/Simplified-style Table */}
                  <div className={`overflow-x-auto overflow-y-auto w-full border-t border-slate-100 ${isFullscreen ? 'flex-1 max-h-[calc(100vh-250px)]' : 'max-h-[580px]'}`}>
                    <table className="orders-table w-full text-xs text-slate-600 border-collapse">
                      <thead className="sticky top-0 z-20 bg-slate-100/95 backdrop-blur-xs shadow-xs">
                        <tr className="bg-slate-100/80 border-b border-slate-200 font-mono text-slate-500 text-left text-[10px] uppercase select-none divide-x divide-slate-200">
                          <th className="px-3 py-2 text-center w-10 bg-slate-50 shrink-0">
                            <button 
                              onClick={toggleSelectAll} 
                              className="text-slate-400 hover:text-blue-600 focus:outline-none"
                              title="Selecionar todos os visíveis"
                            >
                              {selectedOrderIds.size === filteredOrders.length && filteredOrders.length > 0 ? (
                                <CheckSquare size={13} className="text-blue-600" />
                              ) : (
                                <Square size={13} />
                              )}
                            </button>
                          </th>
                           {columnsOrder.map((col, idx) => {
                            const displayLabel = COLUMN_LABELS[col] || col;
                            const isSortedAsc = sortConfig?.key === col && sortConfig.direction === 'asc';
                            const isSortedDesc = sortConfig?.key === col && sortConfig.direction === 'desc';
                            return (
                              <th 
                                key={col} 
                                className="px-3 py-2 whitespace-nowrap min-w-[145px] relative group border-r border-slate-200 font-extrabold text-slate-700 bg-slate-50/50"
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                    <span className="truncate select-none cursor-pointer" onClick={() => handleSort(col)} title="Clique para ordenar">
                                      {displayLabel}
                                    </span>
                                    <div className="flex items-center gap-0.5 shrink-0">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setSortConfig({ key: col, direction: 'asc' }); }}
                                        className={`p-0.5 rounded transition-colors cursor-pointer ${
                                          isSortedAsc
                                            ? 'bg-blue-100 text-blue-700 font-extrabold'
                                            : 'hover:bg-slate-200 text-slate-400'
                                        }`}
                                        title="Ordem Crescente (A-Z / Menor-Maior)"
                                      >
                                        <MoveUp size={10} />
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setSortConfig({ key: col, direction: 'desc' }); }}
                                        className={`p-0.5 rounded transition-colors cursor-pointer ${
                                          isSortedDesc
                                            ? 'bg-blue-100 text-blue-700 font-extrabold'
                                            : 'hover:bg-slate-200 text-slate-400'
                                        }`}
                                        title="Ordem Decrescente (Z-A / Maior-Menor)"
                                      >
                                        <MoveDown size={10} />
                                      </button>
                                    </div>
                                  </div>
                                  
                                  {/* Left/Right Column movement arrows */}
                                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 ml-1 transition-opacity shrink-0">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); moveColumn(idx, 'left'); }}
                                      disabled={idx === 0}
                                      className="p-0.5 rounded hover:bg-slate-250 text-slate-500 disabled:opacity-20 cursor-pointer"
                                      title="Mover para esquerda"
                                    >
                                      <ArrowLeft size={10} />
                                    </button>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); moveColumn(idx, 'right'); }}
                                      disabled={idx === columnsOrder.length - 1}
                                      className="p-0.5 rounded hover:bg-slate-250 text-slate-500 disabled:opacity-20 cursor-pointer"
                                      title="Mover para direita"
                                    >
                                      <ArrowRight size={10} />
                                    </button>
                                  </div>
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-medium text-slate-700 divide-x divide-slate-200">
                        {sortedFilteredOrders.length === 0 ? (
                          <tr>
                            <td colSpan={columnsOrder.length + 1} className="py-10 text-center bg-slate-50/50">
                              <div className="max-w-sm mx-auto flex flex-col items-center justify-center space-y-1.5">
                                <CheckCircle2 className="text-emerald-500" size={22} />
                                <h4 className="font-bold text-slate-700 text-xs">Nenhum pedido pendente</h4>
                                <p className="text-[10px] text-slate-400 leading-relaxed">
                                  Tudo limpo para os filtros selecionados nesta planilha de despacho.
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          paginatedOrders.map((order, idx) => {
                            const isSelected = selectedOrderIds.has(order.id);
                            const globalIdx = (tablePage - 1) * itemsPerPage + idx + 1;
                            
                            return (
                              <tr 
                                key={order.id} 
                                onClick={() => toggleOrderSelection(order.id)}
                                className={`hover:bg-slate-50/70 cursor-pointer transition-colors divide-x divide-slate-100 ${
                                  isSelected ? 'bg-blue-50/40' : ''
                                }`}
                              >
                                <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                  <button onClick={() => toggleOrderSelection(order.id)}>
                                    {isSelected ? (
                                      <CheckSquare size={14} className="text-blue-600" />
                                    ) : (
                                      <Square size={14} className="text-slate-300" />
                                    )}
                                  </button>
                                </td>

                                {columnsOrder.map((col) => {
                                  const cellVal = getOrderColumnValue(order, col, globalIdx);

                                  if (col === 'Status') {
                                    return (
                                      <td key={col} className="px-1 py-1 text-center whitespace-nowrap min-w-[130px]">
                                        {renderStatusCellWithHealth(order.status, order.createdAt, order.date, order.history)}
                                      </td>
                                    );
                                  }

                                  if (col === 'DispositivoCondutor') {
                                    const rider = riders.find(r => r.id === order.riderId);
                                    return (
                                      <td key={col} className="px-3 py-2 whitespace-nowrap">
                                        {rider ? (
                                          <div className="flex items-center gap-1.5">
                                            <img src={rider.avatar} className="w-4.5 h-4.5 rounded-full object-cover border" />
                                            <span className="font-bold text-slate-700 text-[11px]">{rider.name}</span>
                                          </div>
                                        ) : (
                                          <span className="text-slate-300 italic text-[11px]">Não alocado</span>
                                        )}
                                      </td>
                                    );
                                  }

                                  if (col === 'Pedido') {
                                    return (
                                      <td key={col} className="px-3 py-2 font-mono font-bold text-slate-800 text-[11px]">
                                        {cellVal}
                                      </td>
                                    );
                                  }

                                  if (col === 'Sequencia') {
                                    return (
                                      <td key={col} className="px-3 py-2 text-center text-slate-400 font-mono font-bold text-[11px] bg-slate-50/30">
                                        {cellVal}
                                      </td>
                                    );
                                  }

                                  if (col === 'CEP') {
                                    return (
                                      <td key={col} className="px-3 py-2 font-mono text-slate-600 text-[11px] whitespace-nowrap">
                                        {cellVal}
                                      </td>
                                    );
                                  }

                                  if (col === 'Regiao') {
                                    return (
                                      <td key={col} className="px-3 py-2 whitespace-nowrap">
                                        <span className="bg-slate-100 text-slate-600 font-extrabold text-[9px] px-1.5 py-0.5 rounded border border-slate-200">
                                          {cellVal}
                                        </span>
                                      </td>
                                    );
                                  }

                                  if (col === 'ValorNotaFiscal' || col === 'ValorReceber' || col === 'ValorEntrega' || col === 'ValorCondutor') {
                                    const numVal = parseFloat(cellVal) || 0;
                                    return (
                                      <td key={col} className="px-3 py-2 text-right font-mono font-bold text-slate-800 text-[11px] whitespace-nowrap">
                                        {numVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                      </td>
                                    );
                                  }

                                  return (
                                    <td 
                                      key={col} 
                                      className="px-3 py-2 text-slate-600 text-[11px] max-w-xs truncate" 
                                      title={cellVal}
                                    >
                                      {cellVal}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Selection summary statistics row */}
                  {selectedOrderIds.size > 0 && (
                    <div className="bg-blue-50/50 p-3 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-blue-800">
                      <span>{selectedOrderIds.size} pedidos marcados para roteirização automática</span>
                      <span className="font-mono">
                        Valor Total: R$ {orders.filter(o => selectedOrderIds.has(o.id)).reduce((sum, o) => sum + o.value, 0).toFixed(2)}
                      </span>
                    </div>
                  )}

                  {/* Table Pagination Footer */}
                  <div className="p-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50" id="alocar-table-pagination">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs text-slate-500 font-medium">
                        Exibindo <strong className="text-slate-800 font-extrabold">{paginatedOrders.length}</strong> de <strong className="text-slate-800 font-extrabold">{sortedFilteredOrders.length}</strong> pedidos
                      </span>

                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold border-l border-slate-200 pl-3">
                        <span>Por página:</span>
                        <select
                          value={itemsPerPage}
                          onChange={(e) => {
                            setItemsPerPage(Number(e.target.value));
                            setTablePage(1);
                          }}
                          className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-extrabold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-xs"
                        >
                          <option value={25}>25</option>
                          <option value={50}>50 (Padrão)</option>
                          <option value={100}>100</option>
                          <option value={200}>200</option>
                          <option value={999999}>Todos ({sortedFilteredOrders.length})</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setTablePage(prev => Math.max(1, prev - 1))}
                        disabled={tablePage === 1}
                        className={`p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer transition-colors ${
                          tablePage === 1 ? 'opacity-40 cursor-not-allowed' : ''
                        }`}
                        title="Página Anterior"
                      >
                        <ChevronLeft size={14} />
                      </button>

                      <div className="flex items-center gap-1 text-xs font-bold">
                        {Array.from({ length: totalTablePages }).slice(
                          Math.max(0, Math.min(tablePage - 3, totalTablePages - 5)),
                          Math.min(totalTablePages, Math.max(5, tablePage + 2))
                        ).map((_, idx) => {
                          const startIdx = Math.max(0, Math.min(tablePage - 3, totalTablePages - 5));
                          const pageNum = startIdx + idx + 1;
                          if (pageNum > totalTablePages) return null;
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setTablePage(pageNum)}
                              className={`min-w-7 h-7 px-1.5 rounded-lg border flex items-center justify-center cursor-pointer transition-all ${
                                tablePage === pageNum
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100 font-black'
                                  : 'border-slate-200 text-slate-600 hover:bg-slate-100 bg-white'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => setTablePage(prev => Math.min(totalTablePages, prev + 1))}
                        disabled={tablePage === totalTablePages || totalTablePages === 0}
                        className={`p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer transition-colors ${
                          tablePage === totalTablePages || totalTablePages === 0 ? 'opacity-40 cursor-not-allowed' : ''
                        }`}
                        title="Próxima Página"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </div>
            )}
          </motion.div>
        )}

      </AnimatePresence>

      {/* CONFIRMATION OVERLAY MODAL FOR DEVICE DISPATCH */}
      <AnimatePresence>
        {isConfirmModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full border border-slate-100 shadow-2xl p-5 space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                  <Smartphone size={22} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">Confirmar Envio ao Dispositivo</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Isso gerará a roteirização do romaneio e enviará o roteiro para o celular do entregador.
                  </p>
                </div>
              </div>

              {/* Summary metadata inside dialog */}
              <div className="p-3.5 bg-slate-50 rounded-xl space-y-2 text-xs font-semibold text-slate-600">
                <div className="flex justify-between">
                  <span>Entregador Designado:</span>
                  <span className="text-slate-800 font-extrabold">
                    {riders.find(r => r.id === selectedRiderId)?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Quantidade de Pedidos:</span>
                  <span className="text-slate-800 font-extrabold">{selectedOrderIds.size} selecionados</span>
                </div>
                <div className="flex justify-between">
                  <span>Início de Status:</span>
                  <span className="text-amber-600 font-bold bg-amber-50 px-1.5 py-0.2 rounded">
                    Não iniciado (Aguardando Rota)
                  </span>
                </div>
              </div>

              {/* Action row buttons */}
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmAllocation}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm cursor-pointer"
                >
                  Confirmar e Criar Roteiro
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
