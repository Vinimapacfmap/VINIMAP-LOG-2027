/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
  ChevronDown,
  ArrowLeft,
  Flag,
  Maximize2,
  Minimize2,
  X
} from 'lucide-react';
import { Order, DeliveryRider, ClientPartner, isMatchingClientCode } from '../types';
import { getSaoPauloTime, getSaoPauloDate, getSaoPauloDateTimeShort, formatToBrazilianDate, getSaoPauloISODate } from '../utils/dateUtils';
import { hasOrderCompletionEvidence } from '../utils/orderConsistency';
import { calculateRiderCommissionForOrder } from '../utils/billingUtils';
import { matchesAddressQuery, compareOrdersByCep, resequenceRiderOrdersByCep } from '../utils/addressUtils';
import { realtimeSyncBus } from '../utils/realtimeSync';

const getStatusClasses = (status: string) => {
  switch (status) {
    case 'Concluído': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    case 'Entregando': return 'bg-blue-50 text-blue-700 border-blue-100';
    case 'Em rota': return 'bg-sky-50 text-sky-700 border-sky-100';
    case 'Não iniciado': return 'bg-amber-50 text-amber-800 border-amber-200 font-bold';
    case 'Ocorrência': return 'bg-rose-600 text-white border-rose-700 font-black shadow-2xs animate-pulse';
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
  const [statusTab, setStatusTab] = useState<'Todos' | 'Não Iniciadas' | 'Ocorrências' | 'Sem Condutor' | 'Com Condutor' | 'Concluídas'>('Todos');

  // Selected orders & selected rider
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [selectedRiderId, setSelectedRiderId] = useState<string>('');

  // Custom Rider Selector Dropdown state & ref
  const [isRiderDropdownOpen, setIsRiderDropdownOpen] = useState(false);
  const [riderSearchQuery, setRiderSearchQuery] = useState('');
  const riderDropdownRef = useRef<HTMLDivElement>(null);

  // Close rider dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (riderDropdownRef.current && !riderDropdownRef.current.contains(event.target as Node)) {
        setIsRiderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredDropdownRiders = riders.filter(r => {
    if (!riderSearchQuery.trim()) return true;
    const q = riderSearchQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      (r.vehicle && r.vehicle.toLowerCase().includes(q)) ||
      (r.phone && r.phone.toLowerCase().includes(q)) ||
      (r.deviceNumber && r.deviceNumber.toLowerCase().includes(q))
    );
  });

  const selectedRiderObj = riders.find(r => r.id === selectedRiderId);

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

  // Reallocation States (Realocar do Condutor A para o Condutor B no período)
  const [isReallocateModalOpen, setIsReallocateModalOpen] = useState<boolean>(false);
  const [reallocateDriverAId, setReallocateDriverAId] = useState<string>('todos');
  const [reallocateDriverBId, setReallocateDriverBId] = useState<string>('');
  const [filterDriverAId, setFilterDriverAId] = useState<string>('todos');
  const [targetRiderBId, setTargetRiderBId] = useState<string>('');
  const [reallocateDateFrom, setReallocateDateFrom] = useState<string>(todayStr);
  const [reallocateDateTo, setReallocateDateTo] = useState<string>(todayStr);
  const [selectedReallocateOrderIds, setSelectedReallocateOrderIds] = useState<Set<string>>(new Set());
  const [reallocateIncludeCompleted, setReallocateIncludeCompleted] = useState<boolean>(false);

  // Synchronize reallocation dates when main period filter changes
  useEffect(() => {
    if (dateFrom) setReallocateDateFrom(dateFrom);
    if (dateTo) setReallocateDateTo(dateTo);
  }, [dateFrom, dateTo]);

  // Memoized list of orders assigned to Driver A in the selected reallocation period
  const ordersForDriverA = React.useMemo(() => {
    return orders.filter(order => {
      // Check Driver A filter
      if (reallocateDriverAId === 'unassigned') {
        if (order.riderId) return false;
      } else if (reallocateDriverAId && reallocateDriverAId !== 'todos') {
        if (order.riderId !== reallocateDriverAId) return false;
      }

      const orderOperationalDate = (order.status === 'Concluído' ? (order.deliveryDate || order.dataConclusao || order.date) : order.date);
      const inPeriod = orderOperationalDate >= reallocateDateFrom && orderOperationalDate <= reallocateDateTo;
      if (!inPeriod) return false;

      if (!reallocateIncludeCompleted && (order.status === 'Concluído' || order.status === 'Cancelado')) {
        return false;
      }

      return true;
    });
  }, [orders, reallocateDriverAId, reallocateDateFrom, reallocateDateTo, reallocateIncludeCompleted]);

  // Auto-select all matching orders when Driver A or period selection changes
  useEffect(() => {
    if (ordersForDriverA.length > 0) {
      setSelectedReallocateOrderIds(new Set(ordersForDriverA.map(o => o.id)));
    } else {
      setSelectedReallocateOrderIds(new Set());
    }
  }, [reallocateDriverAId, reallocateDateFrom, reallocateDateTo, reallocateIncludeCompleted, ordersForDriverA]);

  // Memoized list of orders assigned to Filter Driver A in the main allocation view
  const driverAOrders = React.useMemo(() => {
    return orders.filter(order => {
      // Check Driver A filter
      if (filterDriverAId === 'unassigned') {
        if (order.riderId) return false;
      } else if (filterDriverAId && filterDriverAId !== 'todos') {
        if (order.riderId !== filterDriverAId) return false;
      }

      if (hasSearchedPeriod) {
        const orderOperationalDate = (order.status === 'Concluído' ? (order.deliveryDate || order.dataConclusao || order.date) : order.date);
        return orderOperationalDate >= dateFrom && orderOperationalDate <= dateTo;
      } else {
        return order.date === todayStr || (order.status !== 'Concluído' && order.status !== 'Cancelado');
      }
    });
  }, [orders, filterDriverAId, hasSearchedPeriod, dateFrom, dateTo, todayStr]);

  const selectedDriverAOrdersCount = React.useMemo(() => {
    return driverAOrders.filter(o => selectedOrderIds.has(o.id)).length;
  }, [driverAOrders, selectedOrderIds]);

  const selectedDriverA = React.useMemo(() => {
    if (!filterDriverAId || filterDriverAId === 'todos' || filterDriverAId === 'unassigned') return null;
    return riders.find(r => r.id === filterDriverAId) || null;
  }, [riders, filterDriverAId]);

  const selectedDriverB = React.useMemo(() => {
    if (!targetRiderBId) return null;
    return riders.find(r => r.id === targetRiderBId) || null;
  }, [riders, targetRiderBId]);

  const targetDriverBCurrentActiveCount = React.useMemo(() => {
    if (!targetRiderBId) return 0;
    return orders.filter(o => o.riderId === targetRiderBId && o.status !== 'Concluído' && o.status !== 'Cancelado').length;
  }, [orders, targetRiderBId]);

  const handleToggleSelectAllDriverAOrders = () => {
    const driverAOrderIds = driverAOrders.map(o => o.id);
    const allSelected = driverAOrderIds.length > 0 && driverAOrderIds.every(id => selectedOrderIds.has(id));

    const newSet = new Set(selectedOrderIds);
    if (allSelected) {
      driverAOrderIds.forEach(id => newSet.delete(id));
    } else {
      driverAOrderIds.forEach(id => newSet.add(id));
    }
    setSelectedOrderIds(newSet);
  };

  // Execute reallocation of selected orders from Driver A to Driver B (or same driver)
  const handleExecuteReallocation = () => {
    if (!reallocateDriverAId) {
      alert('Por favor, selecione o Condutor de Origem (A).');
      return;
    }
    if (!reallocateDriverBId) {
      alert('Por favor, selecione o Condutor de Destino (B).');
      return;
    }
    if (selectedReallocateOrderIds.size === 0) {
      alert('Nenhum pedido selecionado para realocação.');
      return;
    }

    const driverA = riders.find(r => r.id === reallocateDriverAId);
    const driverB = riders.find(r => r.id === reallocateDriverBId);
    const isSameDriver = reallocateDriverAId === reallocateDriverBId;

    const countToMove = selectedReallocateOrderIds.size;
    const confirmMessage = isSameDriver
      ? `Confirma realocar/revalidar ${countToMove} pedido(s) na rota atual do condutor ${driverB?.name || 'B'} (mantendo o status atual) para visualização e execução na data de hoje?`
      : `Confirma realocar ${countToMove} pedido(s) do condutor ${driverA?.name || 'A'} para o condutor ${driverB?.name || 'B'} no período ${formatToBrazilianDate(reallocateDateFrom)} a ${formatToBrazilianDate(reallocateDateTo)}?`;

    const isConfirmed = window.confirm(confirmMessage);
    if (!isConfirmed) return;

    const isMidRouteB = driverB?.status === 'Em rota';
    const todayIso = getSaoPauloISODate();

    const updatedOrders = orders.map(order => {
      if (selectedReallocateOrderIds.has(order.id)) {
        // When reallocated to the same driver or new driver, keep current status unless explicitly modified
        const assignedStatus = isSameDriver 
          ? order.status 
          : (order.status === 'Concluído' || order.status === 'Ocorrência' || order.status === 'Cancelado' || hasOrderCompletionEvidence(order) ? order.status : ('Não iniciado' as const));

        const tempOrder: Order = {
          ...order,
          riderId: driverB?.id,
          status: assignedStatus,
          originalDate: order.originalDate || order.date,
          reallocatedDate: todayIso,
          reallocatedAt: todayIso
        };

        const comm = calculateRiderCommissionForOrder(driverB, tempOrder, clientPartners || []);
        const computedVal = comm.total;

        const updatedRaw = { ...(order.rawData || {}) };
        if (driverB) {
          updatedRaw['Condutor'] = driverB.name;
          updatedRaw['NomeCondutor'] = driverB.name;
          updatedRaw['Entregador'] = driverB.name;
          updatedRaw['NomeEntregador'] = driverB.name;
          updatedRaw['DispositivoCondutor'] = driverB.deviceNumber ? String(driverB.deviceNumber) : driverB.name;
          updatedRaw['riderId'] = driverB.id;
          for (const k of Object.keys(updatedRaw)) {
            const norm = k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
            if (norm === 'condutor' || norm === 'nomecondutor' || norm === 'entregador' || norm === 'nomeentregador' || norm === 'motorista' || norm === 'nomemotorista' || norm === 'rider' || norm === 'ridername') {
              updatedRaw[k] = driverB.name;
            } else if (norm === 'dispositivocondutor' || norm === 'dispositivo' || norm === 'dispositivoentregador') {
              updatedRaw[k] = driverB.deviceNumber ? String(driverB.deviceNumber) : driverB.name;
            } else if (norm === 'idcondutor' || norm === 'identregador' || norm === 'codigocondutor' || norm === 'codigoentregador' || norm === 'riderid') {
              updatedRaw[k] = driverB.id;
            }
          }
        }

        if (computedVal !== undefined && computedVal !== null) {
          const keys = Object.keys(updatedRaw);
          const driverKey = keys.find(k => k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "") === 'valorcondutor') || 'ValorCondutor';
          updatedRaw[driverKey] = String(computedVal);
        }

        const actionText = isSameDriver
          ? `Realocação / Revalidação para o mesmo Condutor (${driverB?.name})`
          : `Realocação entre Condutores (A ➔ B)`;

        const detailsText = isSameDriver
          ? `Pedido do dia anterior/período ${formatToBrazilianDate(order.date)} revalidado e realocado para a rota atual do condutor ${driverB?.name} com status mantido (${order.status}).`
          : `Pedido realocado do Condutor ${driverA?.name || reallocateDriverAId} para o Condutor ${driverB?.name || reallocateDriverBId} no período ${formatToBrazilianDate(reallocateDateFrom)} a ${formatToBrazilianDate(reallocateDateTo)}.`;

        return {
          ...tempOrder,
          driverValue: computedVal,
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
      if (rider.id === driverB?.id) {
        return {
          ...rider,
          status: isMidRouteB ? ('Em rota' as const) : rider.status,
          currentOrderId: Array.from(selectedReallocateOrderIds)[0]
        };
      }
      if (!isSameDriver && rider.id === driverA?.id) {
        const remainingForA = updatedOrders.filter(
          o => o.riderId === driverA.id && o.status !== 'Concluído' && o.status !== 'Cancelado'
        );
        const hasRemainingA = remainingForA.length > 0;
        return {
          ...rider,
          status: hasRemainingA ? rider.status : ('Disponível' as const),
          currentOrderId: hasRemainingA ? remainingForA[0].id : undefined
        };
      }
      return rider;
    });

    const nowTime = getSaoPauloTime();
    const logMsg = isSameDriver
      ? `Realocação mantendo status: ${countToMove} pedido(s) revalidados na rota do condutor ${driverB?.name} para o dia atual.`
      : `Realocação concluída: ${countToMove} pedido(s) do Condutor ${driverA?.name} transferidos para o Condutor ${driverB?.name} (${formatToBrazilianDate(reallocateDateFrom)} a ${formatToBrazilianDate(reallocateDateTo)}).`;

    const logsGenerated = [
      {
        time: nowTime,
        message: logMsg,
        type: 'success' as const
      },
      {
        time: nowTime,
        message: `Aplicativo do Condutor ${driverB?.name} atualizado com novo roteiro.`,
        type: 'info' as const
      }
    ];

    const finalOrders = driverB ? resequenceRiderOrdersByCep(updatedOrders, driverB.id) : updatedOrders;
    realtimeSyncBus.broadcastOrdersBatch(finalOrders);
    updatedRiders.forEach(r => realtimeSyncBus.broadcastRiderUpdate(r));
    onAllocateSuccess(finalOrders, updatedRiders, logsGenerated);
    setSelectedReallocateOrderIds(new Set());
    setSelectedOrderIds(new Set());
    setIsReallocateModalOpen(false);
    alert(`Sucesso! ${countToMove} pedido(s) realocado(s) com sucesso de ${driverA?.name || 'Origem'} para ${driverB?.name}.`);
  };

  // Batch reallocate selected orders from allocation spreadsheet directly to targetRiderBId
  const handleBatchReallocateToDriverB = () => {
    if (!targetRiderBId) {
      alert('Por favor, selecione o Condutor de Destino (B).');
      return;
    }
    if (selectedOrderIds.size === 0) {
      alert('Por favor, selecione ao menos um pedido na tabela para vincular.');
      return;
    }

    const driverB = riders.find(r => r.id === targetRiderBId);
    if (!driverB) {
      alert('Condutor de Destino não encontrado.');
      return;
    }

    const countToMove = selectedOrderIds.size;
    const isConfirmed = window.confirm(
      `Confirma vincular/realocar ${countToMove} pedido(s) selecionado(s) para o condutor ${driverB.name}?`
    );

    if (!isConfirmed) return;

    const previousRiderIds = new Set<string>();

    const updatedOrders = orders.map(order => {
      if (selectedOrderIds.has(order.id)) {
        if (order.riderId) previousRiderIds.add(order.riderId);

        const isCompleted = order.status === 'Concluído' || order.status === 'Ocorrência' || order.status === 'Cancelado' || hasOrderCompletionEvidence(order);
        const assignedStatus = isCompleted ? order.status : ('Não iniciado' as const);

        const tempOrder: Order = {
          ...order,
          riderId: driverB.id,
          status: assignedStatus
        };

        const comm = calculateRiderCommissionForOrder(driverB, tempOrder, clientPartners || []);
        const computedVal = comm.total;

        const updatedRaw = { ...(order.rawData || {}) };
        if (driverB) {
          updatedRaw['Condutor'] = driverB.name;
          updatedRaw['NomeCondutor'] = driverB.name;
          updatedRaw['Entregador'] = driverB.name;
          updatedRaw['NomeEntregador'] = driverB.name;
          updatedRaw['DispositivoCondutor'] = driverB.deviceNumber ? String(driverB.deviceNumber) : driverB.name;
          updatedRaw['riderId'] = driverB.id;
          for (const k of Object.keys(updatedRaw)) {
            const norm = k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
            if (norm === 'condutor' || norm === 'nomecondutor' || norm === 'entregador' || norm === 'nomeentregador' || norm === 'motorista' || norm === 'nomemotorista' || norm === 'rider' || norm === 'ridername') {
              updatedRaw[k] = driverB.name;
            } else if (norm === 'dispositivocondutor' || norm === 'dispositivo' || norm === 'dispositivoentregador') {
              updatedRaw[k] = driverB.deviceNumber ? String(driverB.deviceNumber) : driverB.name;
            } else if (norm === 'idcondutor' || norm === 'identregador' || norm === 'codigocondutor' || norm === 'codigoentregador' || norm === 'riderid') {
              updatedRaw[k] = driverB.id;
            }
          }
        }
        if (computedVal !== undefined && computedVal !== null) {
          const keys = Object.keys(updatedRaw);
          const driverKey = keys.find(k => k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "") === 'valorcondutor') || 'ValorCondutor';
          updatedRaw[driverKey] = String(computedVal);
        }

        const currentRiderObj = riders.find(r => r.id === order.riderId);
        const prevName = currentRiderObj ? currentRiderObj.name : 'Não Vinculado';

        return {
          ...tempOrder,
          driverValue: computedVal,
          rawData: updatedRaw,
          history: [
            ...(order.history || []),
            {
              timestamp: getSaoPauloDateTimeShort(),
              action: `Realocação de Condutor (${prevName} ➔ ${driverB.name})`,
              user: 'Operador Central',
              details: `Pedido vinculado ao Condutor ${driverB.name} no período ${formatToBrazilianDate(dateFrom)} a ${formatToBrazilianDate(dateTo)}.`
            }
          ]
        };
      }
      return order;
    });

    const isMidRouteB = driverB.status === 'Em rota';

    const updatedRiders = riders.map(rider => {
      if (rider.id === driverB.id) {
        const activeForB = updatedOrders.filter(
          o => o.riderId === driverB.id && o.status !== 'Concluído' && o.status !== 'Cancelado'
        );
        return {
          ...rider,
          status: isMidRouteB ? ('Em rota' as const) : ('Disponível' as const),
          currentOrderId: activeForB.length > 0 ? activeForB[0].id : undefined
        };
      }
      if (previousRiderIds.has(rider.id)) {
        const remainingForPrev = updatedOrders.filter(
          o => o.riderId === rider.id && o.status !== 'Concluído' && o.status !== 'Cancelado'
        );
        const hasRemaining = remainingForPrev.length > 0;
        return {
          ...rider,
          status: hasRemaining ? rider.status : ('Disponível' as const),
          currentOrderId: hasRemaining ? remainingForPrev[0].id : undefined
        };
      }
      return rider;
    });

    const nowTime = getSaoPauloTime();
    const logsGenerated = [
      {
        time: nowTime,
        message: `Realocação concluída: ${countToMove} pedido(s) vinculados ao Condutor ${driverB.name} (${formatToBrazilianDate(dateFrom)} a ${formatToBrazilianDate(dateTo)}).`,
        type: 'success' as const
      }
    ];

    const finalOrders = resequenceRiderOrdersByCep(updatedOrders, driverB.id);
    realtimeSyncBus.broadcastOrdersBatch(finalOrders);
    updatedRiders.forEach(r => realtimeSyncBus.broadcastRiderUpdate(r));
    onAllocateSuccess(finalOrders, updatedRiders, logsGenerated);
    setSelectedOrderIds(new Set());
    alert(`Sucesso! ${countToMove} pedido(s) vinculados ao condutor ${driverB.name}. A tela de alocação foi atualizada.`);
  };

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
    // If user typed a search query, show the matching order REGARDLESS of status or rider or tab
    if (searchQuery && searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = 
        order.id.toLowerCase().includes(q) ||
        order.clientName.toLowerCase().includes(q) ||
        order.address.toLowerCase().includes(q) ||
        matchesAddressQuery(order.address, searchQuery) ||
        order.region.toLowerCase().includes(q) ||
        (order.partnerName && (order.partnerName.toLowerCase().includes(q) || (clientPartners?.find(c => isMatchingClientCode(order.partnerName, c.id, c.codigoCliente))?.name || '').toLowerCase().includes(q))) ||
        (order.protocolNumber && order.protocolNumber.toLowerCase().includes(q)) ||
        (order.recipientName && order.recipientName.toLowerCase().includes(q)) ||
        (order.recipientDoc && order.recipientDoc.toLowerCase().includes(q)) ||
        (order.cep && order.cep.replace(/\D/g, '').includes(q)) ||
        (order.status && order.status.toLowerCase().includes(q));
      
      return matchesSearch;
    }

    // Partner filter
    if (selectedPartnerId) {
      const cp = clientPartners?.find(c => isMatchingClientCode(order.partnerName, c.id, c.codigoCliente));
      if (cp?.id !== selectedPartnerId) return false;
    }

    // Filter by Condutor (A)
    if (filterDriverAId && filterDriverAId !== 'todos') {
      if (filterDriverAId === 'unassigned') {
        if (order.riderId) return false;
      } else {
        if (order.riderId !== filterDriverAId) return false;
      }
    }

    // Tab filter
    if (statusTab === 'Sem Condutor' && order.riderId) return false;
    if (statusTab === 'Com Condutor' && !order.riderId) return false;
    if (statusTab === 'Não Iniciadas' && order.status !== 'Não iniciado') return false;
    if (statusTab === 'Ocorrências' && order.status !== 'Ocorrência') return false;
    if (statusTab === 'Concluídas' && order.status !== 'Concluído') return false;

    // By default (when not searching period and not selecting Concluídas tab), hide completed/canceled orders from route allocation view
    if (statusTab !== 'Concluídas' && !hasSearchedPeriod) {
      if (order.status === 'Concluído' || order.status === 'Cancelado') return false;
    }

    if (hasSearchedPeriod) {
      // APOS SELECIONAR O PERIODO: exibir entregas do período selecionado
      const orderOperationalDate = (order.status === 'Concluído' ? (order.deliveryDate || order.dataConclusao || order.date) : order.date);
      const inPeriod = orderOperationalDate >= dateFrom && orderOperationalDate <= dateTo;
      return inPeriod;
    } else {
      // Por padrão (hoje): exibe pedidos do dia atual e também todos os pedidos abertos/pendentes acumulados de qualquer data
      return order.date === todayStr || (order.status !== 'Concluído' && order.status !== 'Cancelado');
    }
  });

  // Memoized and sorted filtered orders
  const sortedFilteredOrders = React.useMemo(() => {
    if (!sortConfig) return filteredOrders;

    return [...filteredOrders].sort((a, b) => {
      let valA = String(getOrderColumnValue(a, sortConfig.key) ?? '');
      let valB = String(getOrderColumnValue(b, sortConfig.key) ?? '');

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

  // Alphabetically/Lexicographically sorted riders list for dropdowns
  const sortedRidersByName = React.useMemo(() => {
    return [...riders].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
  }, [riders]);

  // Sync selected rider from prop list if empty
  useEffect(() => {
    if (!selectedRiderId && riders.length > 0) {
      const available = riders.find(r => r.status === 'Disponível');
      setSelectedRiderId(available ? available.id : riders[0].id);
    }
  }, [riders, selectedRiderId]);

  // Handle setting active device rider view to display their active roteiro (sorted by CEP)
  useEffect(() => {
    const targetRiderId = activeDeviceRiderId || selectedRiderId;
    if (targetRiderId) {
      const riderOrders = orders.filter(
        o => o.riderId === targetRiderId && o.status !== 'Concluído' && o.status !== 'Cancelado'
      ).sort(compareOrdersByCep);
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

  // Quick preset selector for Triage Period
  const handleSelectTriagePreset = (preset: 'hoje' | 'ontem' | '7dias' | 'esteMes' | '30dias') => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let fromDate = new Date(today);
    let toDate = new Date(today);

    if (preset === 'hoje') {
      // Keep today
    } else if (preset === 'ontem') {
      fromDate.setDate(today.getDate() - 1);
      toDate.setDate(today.getDate() - 1);
    } else if (preset === '7dias') {
      fromDate.setDate(today.getDate() - 6);
    } else if (preset === 'esteMes') {
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (preset === '30dias') {
      fromDate.setDate(today.getDate() - 29);
    }

    const formatDateStr = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const fStr = formatDateStr(fromDate);
    const tStr = formatDateStr(toDate);

    setDateFrom(fStr);
    setDateTo(tStr);
    setHasSearchedPeriod(true);
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

    // Initial Status requirement for pending orders: "STATUS INICIAL DEVE SER NAO INICIADO, ESPERANDO O CONDUTOR DAR O INICIO DA ROTA"
    // However, if order is already completed or has completion evidence, preserve its status.
    const updatedOrders = orders.map(order => {
      if (selectedOrderIds.has(order.id)) {
        const isCompleted = order.status === 'Concluído' || order.status === 'Ocorrência' || order.status === 'Cancelado' || hasOrderCompletionEvidence(order);
        const assignedStatus = isCompleted ? order.status : ('Não iniciado' as const);

        const tempAssignedOrder: Order = {
          ...order,
          riderId: targetRider?.id,
          status: assignedStatus,
        };

        const comm = calculateRiderCommissionForOrder(targetRider, tempAssignedOrder, clientPartners || []);
        const computedDriverVal = comm.total;

        const updatedRaw = { ...(order.rawData || {}) };
        if (targetRider) {
          updatedRaw['Condutor'] = targetRider.name;
          updatedRaw['NomeCondutor'] = targetRider.name;
          updatedRaw['Entregador'] = targetRider.name;
          updatedRaw['NomeEntregador'] = targetRider.name;
          updatedRaw['DispositivoCondutor'] = targetRider.deviceNumber ? String(targetRider.deviceNumber) : targetRider.name;
          updatedRaw['riderId'] = targetRider.id;
          for (const k of Object.keys(updatedRaw)) {
            const norm = k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
            if (norm === 'condutor' || norm === 'nomecondutor' || norm === 'entregador' || norm === 'nomeentregador' || norm === 'motorista' || norm === 'nomemotorista' || norm === 'rider' || norm === 'ridername') {
              updatedRaw[k] = targetRider.name;
            } else if (norm === 'dispositivocondutor' || norm === 'dispositivo' || norm === 'dispositivoentregador') {
              updatedRaw[k] = targetRider.deviceNumber ? String(targetRider.deviceNumber) : targetRider.name;
            } else if (norm === 'idcondutor' || norm === 'identregador' || norm === 'codigocondutor' || norm === 'codigoentregador' || norm === 'riderid') {
              updatedRaw[k] = targetRider.id;
            }
          }
        }
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

    // Gather previous riders of the selected reallocated orders
    const prevRiderIds = new Set<string>();
    selectedOrdersList.forEach(o => {
      if (o.riderId && o.riderId !== targetRider?.id) {
        prevRiderIds.add(o.riderId);
      }
    });

    const updatedRiders = riders.map(rider => {
      if (rider.id === targetRider?.id) {
        return {
          ...rider,
          status: isMidRoute ? ('Em rota' as const) : rider.status,
          currentOrderId: selectedOrdersList[0]?.id
        };
      }
      if (prevRiderIds.has(rider.id)) {
        const remainingActive = updatedOrders.filter(
          o => o.riderId === rider.id && o.status !== 'Concluído' && o.status !== 'Cancelado'
        );
        const hasRemaining = remainingActive.length > 0;
        return {
          ...rider,
          status: hasRemaining ? rider.status : ('Disponível' as const),
          currentOrderId: hasRemaining ? remainingActive[0].id : undefined
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

  // Render Realocar Condutor (A ➔ B) Component Card
  const renderReallocateSection = () => {
    const driverAObj = riders.find(r => r.id === reallocateDriverAId);
    const driverBObj = riders.find(r => r.id === reallocateDriverBId);

    return (
      <div className="bg-white border border-indigo-100 rounded-2xl shadow-sm p-5 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
              <Users size={18} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <span>Realocar do Condutor (A) para o Condutor (B)</span>
                <span className="text-[9px] bg-indigo-100 text-indigo-700 font-extrabold px-2 py-0.5 rounded-full uppercase">
                  Período Selecionado
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Transfira a carteira de pedidos do Condutor (A) para o Condutor (B) no período desejado.
              </p>
            </div>
          </div>
        </div>

        {/* Driver Selection Controls */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-slate-50/90 p-3.5 rounded-xl border border-slate-200/80 modal-dropdown-container relative z-[9999]" style={{ overflow: 'visible', zIndex: 9999 }}>
          {/* Driver A */}
          <div className="md:col-span-5 space-y-1 modal-dropdown relative z-[9999]" style={{ overflow: 'visible', zIndex: 9999 }}>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
              1. Condutor de Origem (A)
            </label>
            <select
              value={reallocateDriverAId}
              onChange={(e) => setReallocateDriverAId(e.target.value)}
              className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs modal-rider-select relative z-[9999]"
              style={{ overflow: 'visible', zIndex: 9999 }}
            >
              <option value="todos">-- Todos os Pedidos do Período --</option>
              <option value="unassigned">-- Sem Condutor (Não Vinculados) --</option>
              {riders.map(r => {
                const countActive = orders.filter(o => o.riderId === r.id && o.status !== 'Concluído' && o.status !== 'Cancelado').length;
                return (
                  <option key={`a-${r.id}`} value={r.id}>
                    {r.name} ({countActive} pedido(s) ativo(s) - {r.status})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Arrow Icon */}
          <div className="md:col-span-2 flex justify-center py-1">
            <div className="p-2 rounded-full bg-indigo-100 text-indigo-600 font-extrabold shadow-2xs">
              <ArrowRight size={16} className="hidden md:block" />
              <ChevronDown size={16} className="block md:hidden" />
            </div>
          </div>

          {/* Driver B */}
          <div className="md:col-span-5 space-y-1 modal-dropdown relative z-[9999]" style={{ overflow: 'visible', zIndex: 9999 }}>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
              2. Condutor de Destino (B)
            </label>
            <select
              value={reallocateDriverBId}
              onChange={(e) => setReallocateDriverBId(e.target.value)}
              className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs modal-rider-select relative z-[9999]"
              style={{ overflow: 'visible', zIndex: 9999 }}
            >
              <option value="">-- Selecione o Condutor (B) --</option>
              {riders.map(r => {
                const countActive = orders.filter(o => o.riderId === r.id && o.status !== 'Concluído' && o.status !== 'Cancelado').length;
                const isSame = r.id === reallocateDriverAId;
                return (
                  <option key={`b-${r.id}`} value={r.id}>
                    {r.name} {isSame ? '(Mesmo Condutor - Revalidação/Manter Status)' : `(${countActive} pedido(s) ativo(s) - ${r.status})`}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Date / Period Controls for Reallocation */}
        <div className="flex flex-wrap items-end justify-between gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 text-xs">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Data Início</span>
              <input
                type="date"
                value={reallocateDateFrom}
                onChange={(e) => setReallocateDateFrom(e.target.value)}
                className="p-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-white text-slate-700 block"
              />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Data Fim</span>
              <input
                type="date"
                value={reallocateDateTo}
                onChange={(e) => setReallocateDateTo(e.target.value)}
                className="p-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-white text-slate-700 block"
              />
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer py-1 text-slate-600 font-semibold text-[11px]">
              <input
                type="checkbox"
                checked={reallocateIncludeCompleted}
                onChange={(e) => setReallocateIncludeCompleted(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span>Incluir Concluídos/Cancelados</span>
            </label>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Pedidos Elegíveis do Condutor (A)</span>
            <span className="text-sm font-black text-indigo-700">
              {ordersForDriverA.length} pedido(s)
            </span>
          </div>
        </div>

        {/* Orders Preview List */}
        {reallocateDriverAId && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Lista de Pedidos do Condutor A ({driverAObj?.name}) entre {formatToBrazilianDate(reallocateDateFrom)} e {formatToBrazilianDate(reallocateDateTo)}:
              </span>
              {ordersForDriverA.length > 0 && (
                <button
                  onClick={() => {
                    if (selectedReallocateOrderIds.size === ordersForDriverA.length) {
                      setSelectedReallocateOrderIds(new Set());
                    } else {
                      setSelectedReallocateOrderIds(new Set(ordersForDriverA.map(o => o.id)));
                    }
                  }}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  {selectedReallocateOrderIds.size === ordersForDriverA.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                </button>
              )}
            </div>

            {ordersForDriverA.length === 0 ? (
              <div className="p-5 bg-slate-50/80 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400 font-medium">
                Nenhum pedido vinculado ao Condutor (A) <strong>{driverAObj?.name}</strong> no período selecionado.
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white shadow-2xs">
                {ordersForDriverA.map(o => {
                  const isChecked = selectedReallocateOrderIds.has(o.id);
                  const cp = clientPartners?.find(c => isMatchingClientCode(o.partnerName, c.id, c.codigoCliente));
                  return (
                    <div
                      key={o.id}
                      onClick={() => {
                        const next = new Set(selectedReallocateOrderIds);
                        if (next.has(o.id)) next.delete(o.id);
                        else next.add(o.id);
                        setSelectedReallocateOrderIds(next);
                      }}
                      className={`p-2.5 flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors ${
                        isChecked ? 'bg-indigo-50/60 font-semibold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded text-indigo-600 focus:ring-indigo-500 shrink-0 cursor-pointer"
                        />
                        <div className="truncate">
                          <span className="font-extrabold text-slate-800 mr-2">{o.id}</span>
                          <span className="text-slate-600 font-medium">{o.clientName}</span>
                          <span className="text-[10px] text-slate-400 ml-2">({cp ? cp.name : o.partnerName})</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-right">
                        <span className="text-[10px] text-slate-500 font-mono">{formatToBrazilianDate(o.date)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${getStatusClasses(o.status)}`}>
                          {o.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Execute Button */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={handleExecuteReallocation}
            disabled={!reallocateDriverAId || !reallocateDriverBId || selectedReallocateOrderIds.size === 0}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
              !reallocateDriverAId || !reallocateDriverBId || selectedReallocateOrderIds.size === 0
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-md shadow-indigo-200'
            }`}
          >
            <Users size={15} />
            <span>
              {reallocateDriverAId === reallocateDriverBId
                ? `Confirmar Revalidação de ${selectedReallocateOrderIds.size} Pedido(s) (${driverBObj?.name || 'Condutor'})`
                : `Confirmar Realocação de ${selectedReallocateOrderIds.size} Pedido(s) (${driverAObj?.name || 'A'} ➔ ${driverBObj?.name || 'B'})`}
            </span>
          </button>
        </div>
      </div>
    );
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
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsReallocateModalOpen(true);
              if (!reallocateDriverAId && riders.length > 0) {
                setReallocateDriverAId(riders[0].id);
              }
              if (!reallocateDriverBId && riders.length > 1) {
                setReallocateDriverBId(riders[1].id);
              }
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm shadow-indigo-200"
            id="btn-open-realocar-condutor"
          >
            <Users size={15} />
            <span>Realocar Condutor (A ➔ B)</span>
          </button>

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
                  
                  {/* REALLOCATION SECTION CARD (A ➔ B) */}
                  {renderReallocateSection()}

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
                          max={dateTo || undefined}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDateFrom(val);
                            if (val && dateTo && val > dateTo) {
                              setDateTo(val);
                            } else if (val && !dateTo) {
                              setDateTo(val);
                            }
                          }}
                          className="p-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-700 block"
                        />
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Data Limite</span>
                        <input
                          type="date"
                          value={dateTo}
                          min={dateFrom || undefined}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val && dateFrom && val < dateFrom) {
                              setDateFrom(val);
                            }
                            setDateTo(val);
                          }}
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
              <div className={isFullscreen ? 'fixed inset-0 z-50 p-3 sm:p-5 bg-slate-900/60 backdrop-blur-md flex flex-col justify-between overflow-y-auto' : 'w-full space-y-5'}>
                <div className={`flex flex-col h-full ${isFullscreen ? 'bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-visible' : 'space-y-5'}`}>
                {/* TOP ACTION BAR: RIDER SELECTOR DROPDOWN & CONFIRMATION DISPATCH */}
                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 relative z-40 overflow-visible">
                  {/* Left Side: Select Dropdown */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 relative z-40">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 whitespace-nowrap shrink-0">
                      <User size={13} className="text-blue-600" />
                      <span>Vincular Condutor:</span>
                    </div>

                    {/* CUSTOM RIDER SELECTION DROPDOWN WITH HIGH Z-INDEX & PERSISTENT SCROLL */}
                    <div className="relative w-full sm:w-80 z-[100]" ref={riderDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsRiderDropdownOpen(!isRiderDropdownOpen)}
                        className="w-full text-xs bg-white border border-slate-200 hover:border-blue-300 rounded-lg py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-700 flex items-center justify-between gap-2 shadow-2xs cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-2 truncate">
                          {selectedRiderObj ? (
                            <>
                              <img src={selectedRiderObj.avatar} alt="" className="w-5 h-5 rounded-full object-cover shrink-0 border border-slate-200" />
                              <span className="font-extrabold text-slate-800 truncate">{selectedRiderObj.name}</span>
                              <span className="text-[10px] font-bold text-slate-400 shrink-0">({selectedRiderObj.vehicle || 'Veículo'})</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${
                                selectedRiderObj.status === 'Em rota' ? 'bg-blue-100 text-blue-700' :
                                selectedRiderObj.status === 'Disponível' ? 'bg-emerald-100 text-emerald-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {selectedRiderObj.status || 'Offline'}
                              </span>
                            </>
                          ) : (
                            <span className="text-slate-400 italic">Selecione um condutor...</span>
                          )}
                        </div>
                        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-150 ${isRiderDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {/* DROPDOWN MENU */}
                      <AnimatePresence>
                        {isRiderDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: 4, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 4, scale: 0.98 }}
                            transition={{ duration: 0.1 }}
                            className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl z-[9999] overflow-hidden flex flex-col max-h-72"
                          >
                            {/* Search Input inside Dropdown */}
                            {riders.length > 3 && (
                              <div className="p-2 border-b border-slate-100 bg-slate-50/80 sticky top-0 z-10">
                                <div className="relative">
                                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                  <input
                                    type="text"
                                    value={riderSearchQuery}
                                    onChange={(e) => setRiderSearchQuery(e.target.value)}
                                    placeholder="Buscar condutor por nome/veículo..."
                                    className="w-full pl-7 pr-2.5 py-1 text-[11px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 font-medium"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Scrollable Rider List */}
                            <div className="overflow-y-auto max-h-56 py-1 divide-y divide-slate-50 custom-scrollbar">
                              {filteredDropdownRiders.length === 0 ? (
                                <div className="p-3 text-center text-xs text-slate-400 font-medium">
                                  Nenhum condutor encontrado.
                                </div>
                              ) : (
                                filteredDropdownRiders.map(rider => {
                                  const isSelected = rider.id === selectedRiderId;
                                  const activeCount = orders.filter(o => o.riderId === rider.id && o.status !== 'Concluído' && o.status !== 'Cancelado').length;
                                  return (
                                    <button
                                      key={rider.id}
                                      type="button"
                                      onClick={() => {
                                        setSelectedRiderId(rider.id);
                                        setActiveDeviceRiderId(rider.id);
                                        setIsRiderDropdownOpen(false);
                                      }}
                                      className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                                        isSelected ? 'bg-blue-50/80 text-blue-900 font-extrabold' : 'hover:bg-slate-50 text-slate-700 font-medium'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5 truncate">
                                        <img src={rider.avatar} alt="" className="w-6 h-6 rounded-full object-cover shrink-0 border border-slate-200" />
                                        <div className="truncate">
                                          <div className="text-xs font-bold text-slate-800 truncate flex items-center gap-1.5">
                                            <span>{rider.name}</span>
                                            <span className="text-[10px] text-slate-400 font-normal">({rider.vehicle || 'Veículo Padrão'})</span>
                                          </div>
                                          <div className="text-[9px] text-slate-400 flex items-center gap-2">
                                            <span>{activeCount} entregas ativas</span>
                                            {rider.deviceNumber && (
                                              <span>• Disp: {rider.deviceNumber}</span>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                          rider.status === 'Em rota' ? 'bg-blue-100 text-blue-700' :
                                          rider.status === 'Disponível' ? 'bg-emerald-100 text-emerald-700' :
                                          'bg-slate-100 text-slate-500'
                                        }`}>
                                          {rider.status === 'Em rota' ? 'Em Rota' : rider.status === 'Disponível' ? 'Disponível' : rider.status || 'Offline'}
                                        </span>
                                        {isSelected && <Check size={14} className="text-blue-600 shrink-0" />}
                                      </div>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
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

                {/* SELETOR DE PERÍODO TRIAGEM */}
                <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 border border-blue-800/80 text-white rounded-2xl p-3.5 shadow-md space-y-2.5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-blue-500/20 border border-blue-400/30 text-blue-300 rounded-xl shrink-0">
                        <Calendar size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-black uppercase tracking-wider text-white">
                            Seletor de Período Triagem
                          </h3>
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase border ${
                            hasSearchedPeriod
                              ? 'bg-blue-500/30 text-blue-200 border-blue-400/40'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          }`}>
                            {hasSearchedPeriod ? `Filtro Ativo: ${formatToBrazilianDate(dateFrom)} a ${formatToBrazilianDate(dateTo)}` : `Período Atual: Hoje (${formatToBrazilianDate(todayStr)})`}
                          </span>
                        </div>
                        <p className="text-[10px] text-blue-200/80">
                          Selecione o intervalo de datas ou utilize os atalhos rápidos para carregar as entregas no período desejado.
                        </p>
                      </div>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-extrabold text-blue-300 uppercase mr-1">Atalhos:</span>
                      <button
                        type="button"
                        onClick={() => handleSelectTriagePreset('hoje')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer border ${
                          dateFrom === todayStr && dateTo === todayStr
                            ? 'bg-blue-600 text-white border-blue-400 shadow-xs'
                            : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        Hoje
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectTriagePreset('ontem')}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-slate-800/80 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-all cursor-pointer"
                      >
                        Ontem
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectTriagePreset('7dias')}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-slate-800/80 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-all cursor-pointer"
                      >
                        7 Dias
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectTriagePreset('esteMes')}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-slate-800/80 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-all cursor-pointer"
                      >
                        Este Mês
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectTriagePreset('30dias')}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-slate-800/80 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-all cursor-pointer"
                      >
                        30 Dias
                      </button>
                    </div>
                  </div>

                  {/* Custom Date Range Pickers for Triage */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-blue-800/60 text-xs">
                    <div className="flex items-center gap-2 bg-slate-950/80 border border-blue-700/80 rounded-xl p-1.5 px-3">
                      <span className="text-[10px] font-extrabold text-blue-300 uppercase">De:</span>
                      <input
                        type="date"
                        value={dateFrom}
                        max={dateTo || undefined}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDateFrom(val);
                          if (val && dateTo && val > dateTo) setDateTo(val);
                          else if (val && !dateTo) setDateTo(val);
                        }}
                        className="bg-transparent border-0 text-xs font-bold text-white focus:outline-none focus:ring-0 cursor-pointer"
                      />
                      <span className="text-[10px] font-extrabold text-blue-300 uppercase">Até:</span>
                      <input
                        type="date"
                        value={dateTo}
                        min={dateFrom || undefined}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val && dateFrom && val < dateFrom) setDateFrom(val);
                          setDateTo(val);
                        }}
                        className="bg-transparent border-0 text-xs font-bold text-white focus:outline-none focus:ring-0 cursor-pointer"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleSearchPeriod}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl text-xs transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Search size={13} />
                      <span>Filtrar Triagem</span>
                    </button>

                    {hasSearchedPeriod && (
                      <button
                        type="button"
                        onClick={handleClearPeriod}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-extrabold rounded-xl text-xs transition-all cursor-pointer border border-slate-700"
                      >
                        Resetar
                      </button>
                    )}
                  </div>
                </div>

                {/* DUAL PANELS: 1. SELECIONAR CONDUTOR & EXIBIR PEDIDOS ALOCADOS | 2. REALOCAR PARA CONDUTOR (B) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* PANEL 1: SELECIONAR CONDUTOR (A) / ORIGEM E CONSULTA DE PEDIDOS ALOCADOS */}
                  <div className="lg:col-span-7 bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 shadow-lg space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      {/* Panel 1 Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-indigo-600/30 text-indigo-300 rounded-xl shrink-0">
                            <UserCheck size={18} />
                          </div>
                          <div>
                            <h3 className="text-xs font-black uppercase tracking-wider text-indigo-100 flex items-center gap-2">
                              <span>1. Selecionar Condutor (A) & Consultar Pedidos Alocados</span>
                              <span className="text-[9px] bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 font-extrabold px-2 py-0.5 rounded-full">
                                Período: {formatToBrazilianDate(dateFrom)} a {formatToBrazilianDate(dateTo)}
                              </span>
                            </h3>
                            <p className="text-[10px] text-slate-400">
                              Escolha um condutor para visualizar todos os seus pedidos alocados no período e marcar quais serão realocados.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Driver A Selector Dropdown */}
                      <div className="space-y-1 modal-dropdown relative z-[9999]" style={{ overflow: 'visible', zIndex: 9999 }}>
                        <label className="text-[10px] font-extrabold text-indigo-300 uppercase tracking-wider block">
                          Selecione o Condutor (A) / Origem:
                        </label>
                        <select
                          value={filterDriverAId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFilterDriverAId(val);
                            const matched = orders.filter(order => {
                              if (val === 'unassigned') return !order.riderId;
                              if (val !== 'todos') return order.riderId === val;
                              return true;
                            });
                            setSelectedOrderIds(new Set(matched.map(o => o.id)));
                          }}
                          className="w-full p-2 bg-slate-800/90 border border-indigo-700/80 rounded-lg text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer shadow-xs modal-rider-select relative z-[9999]"
                          style={{ overflow: 'visible', zIndex: 9999 }}
                        >
                          <option value="todos">-- Todos os Pedidos (Com e Sem Condutor) --</option>
                          <option value="unassigned">-- Sem Condutor (Não Vinculados) --</option>
                          {sortedRidersByName.map(r => {
                            const countActive = orders.filter(o => o.riderId === r.id && o.status !== 'Concluído' && o.status !== 'Cancelado').length;
                            return (
                              <option key={`fa-${r.id}`} value={r.id}>
                                {r.name} ({countActive} pedido(s) ativo(s) - {r.status})
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* Driver Info Card */}
                      {selectedDriverA && (
                        <div className="flex items-center justify-between bg-slate-800/80 border border-slate-700/80 p-2.5 rounded-xl text-xs">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-400/40 text-indigo-300 flex items-center justify-center font-bold text-xs uppercase">
                              {selectedDriverA.name.slice(0, 2)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-100 flex items-center gap-2">
                                <span>{selectedDriverA.name}</span>
                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                                  selectedDriverA.status === 'Em rota' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                                  selectedDriverA.status === 'Disponível' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                  'bg-slate-700 text-slate-300'
                                }`}>
                                  {selectedDriverA.status}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Veículo: {selectedDriverA.vehicle} • {selectedDriverA.phone || 'Sem telefone'}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] uppercase text-slate-400 block font-bold">Total Alocado</span>
                            <span className="text-xs font-black text-indigo-300 bg-indigo-950 px-2.5 py-1 rounded-lg border border-indigo-800">
                              {driverAOrders.length} pedido(s)
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Orders List for Driver A */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 px-1">
                          <button
                            type="button"
                            onClick={handleToggleSelectAllDriverAOrders}
                            disabled={driverAOrders.length === 0}
                            className="flex items-center gap-1.5 text-indigo-300 hover:text-indigo-200 transition-colors disabled:opacity-40 cursor-pointer"
                          >
                            {driverAOrders.length > 0 && selectedDriverAOrdersCount === driverAOrders.length ? (
                              <CheckSquare size={14} className="text-indigo-400" />
                            ) : (
                              <Square size={14} className="text-slate-500" />
                            )}
                            <span>
                              {selectedDriverAOrdersCount === driverAOrders.length && driverAOrders.length > 0
                                ? 'Desmarcar Todos'
                                : `Selecionar Todos (${driverAOrders.length})`}
                            </span>
                          </button>
                          <span className="text-[10px] text-slate-400">
                            <strong className="text-indigo-300">{selectedDriverAOrdersCount}</strong> de {driverAOrders.length} marcado(s) para realocação
                          </span>
                        </div>

                        {/* Scrollable Order Cards Box */}
                        <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                          {driverAOrders.length === 0 ? (
                            <div className="p-4 text-center bg-slate-800/40 rounded-xl border border-dashed border-slate-700 text-slate-400 text-xs">
                              Nenhum pedido alocado para este condutor no período selecionado.
                            </div>
                          ) : (
                            driverAOrders.map((order) => {
                              const isChecked = selectedOrderIds.has(order.id);
                              const cp = clientPartners?.find(c => isMatchingClientCode(order.partnerName, c.id, c.codigoCliente));
                              return (
                                <div
                                  key={`dra-ord-${order.id}`}
                                  onClick={() => {
                                    const newSet = new Set(selectedOrderIds);
                                    if (isChecked) {
                                      newSet.delete(order.id);
                                    } else {
                                      newSet.add(order.id);
                                    }
                                    setSelectedOrderIds(newSet);
                                  }}
                                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-xs ${
                                    isChecked
                                      ? 'bg-indigo-950/80 border-indigo-500/80 text-white shadow-xs'
                                      : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="shrink-0 text-indigo-400">
                                      {isChecked ? <CheckSquare size={16} className="text-indigo-400" /> : <Square size={16} className="text-slate-500" />}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-extrabold text-slate-100 flex items-center gap-2 truncate">
                                        <span>#{order.id.slice(0, 8)}</span>
                                        {order.protocolNumber && (
                                          <span className="text-[9px] bg-slate-700/80 text-slate-300 px-1.5 py-0.2 rounded font-mono">
                                            Prot: {order.protocolNumber}
                                          </span>
                                        )}
                                        <span className="text-[10px] text-indigo-300 font-normal truncate">
                                          • {cp?.name || order.partnerName || 'Cliente Direto'}
                                        </span>
                                      </div>
                                      <div className="text-[10px] text-slate-400 truncate">
                                        {order.address} {order.region ? `(${order.region})` : ''}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="shrink-0 flex items-center gap-2">
                                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                      order.status === 'Concluído' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                      order.status === 'Em rota' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                                      'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    }`}>
                                      {order.status}
                                    </span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* PANEL 2: SELECIONAR CONDUTOR (B) / DESTINO E BOTAO DE REALOCACAO */}
                  <div className="lg:col-span-5 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 border border-indigo-800 text-white rounded-2xl p-4 shadow-lg space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      {/* Panel 2 Header */}
                      <div className="flex items-center gap-2.5 border-b border-indigo-800/80 pb-2.5">
                        <div className="p-2 bg-indigo-600/30 text-indigo-300 rounded-xl shrink-0">
                          <Send size={18} />
                        </div>
                        <div>
                          <h3 className="text-xs font-black uppercase tracking-wider text-indigo-100">
                            2. Realocar para Condutor (B) / Destino
                          </h3>
                          <p className="text-[10px] text-indigo-300/80">
                            Escolha o condutor de destino. Somente os pedidos selecionados ao lado serão transferidos.
                          </p>
                        </div>
                      </div>

                      {/* Target Driver B Selector */}
                      <div className="space-y-1 modal-dropdown relative z-[9999]" style={{ overflow: 'visible', zIndex: 9999 }}>
                        <label className="text-[10px] font-extrabold text-indigo-200 uppercase tracking-wider block">
                          Selecione o Condutor (B) / Destino:
                        </label>
                        <select
                          value={targetRiderBId}
                          onChange={(e) => setTargetRiderBId(e.target.value)}
                          className="w-full p-2 bg-slate-800/90 border border-indigo-700/80 rounded-lg text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer shadow-xs modal-rider-select relative z-[9999]"
                          style={{ overflow: 'visible', zIndex: 9999 }}
                        >
                          <option value="">-- Selecione o Condutor (B) --</option>
                          {sortedRidersByName.map(r => {
                            const countActive = orders.filter(o => o.riderId === r.id && o.status !== 'Concluído' && o.status !== 'Cancelado').length;
                            const isSameAsA = filterDriverAId !== 'todos' && filterDriverAId !== 'unassigned' && r.id === filterDriverAId;
                            return (
                              <option key={`fb-${r.id}`} value={r.id} disabled={isSameAsA}>
                                {r.name} ({countActive} pedido(s) ativo(s) - {r.status}) {isSameAsA ? '(Condutor Origem)' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* Target Driver Info Card */}
                      {selectedDriverB && (
                        <div className="flex items-center justify-between bg-indigo-900/40 border border-indigo-700/60 p-2.5 rounded-xl text-xs">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-emerald-600/30 border border-emerald-400/40 text-emerald-300 flex items-center justify-center font-bold text-xs uppercase">
                              {selectedDriverB.name.slice(0, 2)}
                            </div>
                            <div>
                              <div className="font-bold text-indigo-100 flex items-center gap-2">
                                <span>{selectedDriverB.name}</span>
                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                                  selectedDriverB.status === 'Em rota' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                                  selectedDriverB.status === 'Disponível' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                  'bg-slate-700 text-slate-300'
                                }`}>
                                  {selectedDriverB.status}
                                </span>
                              </div>
                              <div className="text-[10px] text-indigo-300/70">
                                Veículo: {selectedDriverB.vehicle}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] uppercase text-indigo-300/70 block font-bold">Projeção Carga</span>
                            <span className="text-xs font-black text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded-lg border border-emerald-800">
                              {targetDriverBCurrentActiveCount} ➔ +{selectedOrderIds.size} = {targetDriverBCurrentActiveCount + selectedOrderIds.size} ped.
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Selection Summary Box */}
                      <div className="bg-slate-900/80 border border-indigo-800/80 rounded-xl p-3 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between font-extrabold text-indigo-200">
                          <span className="flex items-center gap-1.5">
                            <Info size={14} className="text-indigo-400" />
                            <span>Resumo da Realocação:</span>
                          </span>
                          <span className="text-xs bg-indigo-600 text-white font-extrabold px-2.5 py-0.5 rounded-full shadow-xs">
                            {selectedOrderIds.size} pedido(s) selecionado(s)
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-300 leading-relaxed">
                          Regra aplicada: <strong>Apenas os {selectedOrderIds.size} pedido(s) especificamente marcados</strong> no painel ao lado serão vinculados/transferidos para {selectedDriverB ? <strong>{selectedDriverB.name}</strong> : 'o condutor de destino'}. Os pedidos não marcados permanecerão inalterados.
                        </p>
                      </div>
                    </div>

                    {/* Reallocate Action Button */}
                    <div className="pt-2">
                      <button
                        onClick={handleBatchReallocateToDriverB}
                        disabled={!targetRiderBId || selectedOrderIds.size === 0}
                        className={`w-full py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          !targetRiderBId || selectedOrderIds.size === 0
                            ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                            : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 active:from-indigo-700 active:to-blue-700 text-white shadow-lg shadow-indigo-950/80 border border-indigo-400/30'
                        }`}
                      >
                        <Send size={15} />
                        <span>
                          Realocar {selectedOrderIds.size} Pedido(s) Selecionado(s)
                        </span>
                      </button>
                    </div>
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
                          max={dateTo || undefined}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDateFrom(val);
                            if (val && dateTo && val > dateTo) {
                              setDateTo(val);
                            } else if (val && !dateTo) {
                              setDateTo(val);
                            }
                          }}
                          className="bg-transparent border-0 p-0 text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-0 w-[100px]"
                        />
                        <span className="text-slate-300 font-bold shrink-0">à</span>
                        <input
                          type="date"
                          value={dateTo}
                          min={dateFrom || undefined}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val && dateFrom && val < dateFrom) {
                              setDateFrom(val);
                            }
                            setDateTo(val);
                          }}
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
                          {clientPartners?.map((cp, idx) => (
                            <option key={`alocar-cp-${cp.id}-${idx}`} value={cp.id}>
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
                      {(['Todos', 'Não Iniciadas', 'Ocorrências', 'Sem Condutor', 'Com Condutor', 'Concluídas'] as const).map(tab => {
                        const isActive = statusTab === tab;
                        let countBadge = null;
                        if (tab === 'Não Iniciadas') {
                          const cnt = sortedFilteredOrders.filter(o => o.status === 'Não iniciado').length;
                          countBadge = <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full font-extrabold">{cnt}</span>;
                        } else if (tab === 'Ocorrências') {
                          const cnt = sortedFilteredOrders.filter(o => o.status === 'Ocorrência').length;
                          countBadge = <span className="ml-1 text-[9px] bg-rose-600 text-white px-1.5 py-0.2 rounded-full font-black animate-pulse">{cnt}</span>;
                        } else if (tab === 'Concluídas') {
                          const cnt = sortedFilteredOrders.filter(o => o.status === 'Concluído').length;
                          countBadge = <span className="ml-1 text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-extrabold">{cnt}</span>;
                        }

                        return (
                          <button
                            key={tab}
                            onClick={() => setStatusTab(tab)}
                            className={`py-2 px-2.5 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center ${
                              isActive 
                                ? 'border-blue-600 text-blue-600 font-extrabold' 
                                : 'border-transparent hover:text-slate-700'
                            }`}
                          >
                            <span>{tab}</span>
                            {countBadge}
                          </button>
                        );
                      })}
                    </div>

                    {/* Status Flag Legend */}
                    <div className="flex flex-wrap items-center gap-3 py-1.5 md:py-0 text-[10px] text-slate-400">
                      <span className="font-extrabold uppercase tracking-wider text-[9px] text-slate-500">Legenda:</span>
                      <div className="flex items-center gap-1">
                        <Flag size={10} className="text-amber-500 fill-amber-500 animate-pulse" />
                        <span className="font-bold text-amber-800">Não iniciado</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Flag size={10} className="text-rose-600 fill-rose-600 animate-bounce" />
                        <span className="font-extrabold text-rose-700">Ocorrência</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Flag size={10} className="text-sky-500 fill-sky-500" />
                        <span>Em rota</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Flag size={10} className="text-emerald-500 fill-emerald-500" />
                        <span>Concluído</span>
                      </div>
                    </div>
                  </div>

                  {/* Active Period Status Info Banner */}
                  {hasSearchedPeriod && (
                    <div className="px-3.5 py-2 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-slate-50 border-b border-blue-100 text-xs text-slate-700 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <Calendar size={13} className="text-blue-600 shrink-0" />
                        <span>
                          Exibindo entregas de <strong className="text-slate-900">{formatToBrazilianDate(dateFrom)}</strong> a <strong className="text-slate-900">{formatToBrazilianDate(dateTo)}</strong>:
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 font-extrabold text-[11px]">
                        <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-md">
                          {sortedFilteredOrders.filter(o => o.status === 'Não iniciado').length} Não Iniciadas
                        </span>
                        <span className="px-2.5 py-0.5 bg-rose-600 text-white rounded-md flex items-center gap-1 shadow-2xs">
                          <AlertTriangle size={11} />
                          {sortedFilteredOrders.filter(o => o.status === 'Ocorrência').length} Ocorrências
                        </span>
                      </div>
                    </div>
                  )}

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
                            const isOccurrence = order.status === 'Ocorrência';
                            const globalIdx = (tablePage - 1) * itemsPerPage + idx + 1;
                            
                            return (
                              <tr 
                                key={order.id} 
                                onClick={() => toggleOrderSelection(order.id)}
                                className={`cursor-pointer transition-all divide-x divide-slate-100 ${
                                  isOccurrence
                                    ? isSelected 
                                      ? 'bg-rose-100/90 border-l-4 border-l-rose-600 text-rose-950 font-bold shadow-2xs' 
                                      : 'bg-rose-50/90 hover:bg-rose-100/80 border-l-4 border-l-rose-500 text-rose-900 font-medium'
                                    : isSelected 
                                      ? 'bg-blue-50/50 border-l-4 border-l-blue-600' 
                                      : 'hover:bg-slate-50/70 border-l-4 border-l-transparent'
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

      {/* REALLOCATION OVERLAY MODAL (CONDUTOR A ➔ CONDUTOR B) */}
      <AnimatePresence>
        {isReallocateModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-2xl w-full border border-slate-100 shadow-2xl p-6 relative max-h-[90vh] overflow-visible modal-content-visible z-[100]"
              style={{ overflow: 'visible', zIndex: 100 }}
            >
              <button
                onClick={() => setIsReallocateModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer z-20"
                title="Fechar"
              >
                <X size={18} />
              </button>

              {renderReallocateSection()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
