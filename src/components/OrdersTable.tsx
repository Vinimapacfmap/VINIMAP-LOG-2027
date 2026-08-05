/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { compressImage } from '../utils/imageCompressor';
import { Order, OrderStatus, DeliveryRider, OrderHistoryEntry, ClientPartner, isMatchingClientCode } from '../types';
import { getSaoPauloTime, getSaoPauloDate, getSaoPauloDateTimeShort, formatToBrazilianDate, getSaoPauloISODate, formatOrderTime, extractISODateFromTimestamp } from '../utils/dateUtils';
import { getOrderFreightValue, calculateRiderCommissionForOrder } from '../utils/billingUtils';
import { getPartnerDisplayName as getPartnerDisplayNameUtil } from '../utils/partnerUtils';
import { generateStaticSvgMap, fetchAddressAndGeocodeByCep, CepGeocodeFullResult } from '../utils/locationUtils';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft,
  ChevronsRight,
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Truck,
  ChevronDown,
  UserCheck,
  XCircle,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  Ban,
  History,
  GitBranch,
  FileCheck2,
  Edit3,
  Trash2,
  Plus,
  Settings2,
  DownloadCloud,
  Check,
  X,
  FileSignature,
  ArrowLeft,
  ArrowRight,
  Eye,
  Search,
  Save,
  Grid,
  List,
  EyeOff,
  Flag,
  MapPin,
  Copy,
  Map,
  ExternalLink,
  RefreshCw,
  Maximize2,
  Minimize2,
  Filter,
  Building2,
  Compass,
  FilterX,
  MessageSquare,
  Send,
  Mail,
  BellRing,
  Phone,
  MoreVertical
} from 'lucide-react';
import { 
  getNotificationSettings, 
  replaceNotificationPlaceholders, 
  getOrderContactInfo, 
  generateWhatsappUrl, 
  generateMailtoUrl 
} from '../utils/notificationUtils';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import BulkCreateModal from './BulkCreateModal';
import BulkEditModal from './BulkEditModal';
import ExportConfigModal from './ExportConfigModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { SignatureCanvasModal } from './SignatureCanvasModal';

interface OrdersTableProps {
  orders: Order[];
  riders: DeliveryRider[];
  clientPartners: ClientPartner[];
  onUpdateStatus: (
    orderId: string, 
    nextStatus: OrderStatus,
    protocolNumber?: string,
    signatureUrl?: string,
    deliveryPhotoUrl?: string,
    recipientName?: string,
    recipientDoc?: string
  ) => void;
  onAssignRider: (orderId: string, riderId: string) => void;
  searchQuery: string;
  activeTab: 'Todos' | OrderStatus;
  setActiveTab: (tab: 'Todos' | OrderStatus) => void;
  onUpdateOrder: (updatedOrder: Order) => void;
  onDeleteOrder: (orderId: string) => void;
  onBulkUpdateStatus: (orderIds: string[], nextStatus: OrderStatus) => void;
  onBulkAssignRider: (orderIds: string[], riderId: string) => void;
  onBulkDelete: (orderIds: string[]) => void;
  onBulkCreate?: (newOrders: Omit<Order, 'id' | 'status' | 'createdAt'>[]) => void;
  onBulkEdit?: (orderIds: string[], updates: Partial<Order>) => void;
}

const ALL_SPREADSHEET_COLUMNS = [
  'Sequencia', 'Pedido', 'CodigoCliente', 'DataSolicitacao', 'ProcurarPor', 
  'Endereco', 'CEP', 'Telefone', 'DispositivoCondutor', 'Complemento', 
  'ValorNotaFiscal', 'HorarioFinal', 'Email', 'DocumentoEmpresa', 'TipoEntrega', 
  'Chamado', 'DANFE', 'DataLimite', 'NomeFantasia', 'HorarioInicio', 
  'DataAgendamento', 'CidadeMunicipio', 'Estado', 'Detalhe', 'ValorReceber', 
  'ValorEntrega', 'Latitude', 'Longitude', 'DestinatarioCnpjCpf', 'ValorCondutor',
  'Prioridade', 'DataConclusao'
];

const COLUMN_LABELS_MAP: Record<string, string> = {
  'Status': 'Status do Pedido',
  'Sequencia': 'Sequência (#)',
  'Pedido': 'Nº do Pedido (Código)',
  'CodigoCliente': 'Código / Nome Cliente',
  'DataSolicitacao': 'Data da Solicitação',
  'ProcurarPor': 'Destinatário (Procurar Por)',
  'Endereco': 'Endereço de Destino',
  'CEP': 'CEP',
  'Telefone': 'Telefone / Contato',
  'DispositivoCondutor': 'Condutor / Entregador',
  'Complemento': 'Complemento Endereço',
  'ValorNotaFiscal': 'Valor Nota Fiscal (R$)',
  'HorarioFinal': 'Horário Final Limite',
  'Email': 'E-mail Destinatário',
  'DocumentoEmpresa': 'CNPJ / Doc Empresa',
  'TipoEntrega': 'Tipo de Entrega',
  'Chamado': 'Nº Chamado / Ocorrência',
  'DANFE': 'Chave DANFE / NF-e',
  'DataLimite': 'Data Limite SLA',
  'NomeFantasia': 'Nome Fantasia Estabelecimento',
  'HorarioInicio': 'Horário Inicial',
  'DataAgendamento': 'Data de Agendamento',
  'CidadeMunicipio': 'Cidade / Município',
  'Estado': 'UF / Estado',
  'Detalhe': 'Observações / Detalhes',
  'ValorReceber': 'Valor a Receber (R$)',
  'ValorEntrega': 'Taxa / Valor Entrega (R$)',
  'Latitude': 'Latitude GPS',
  'Longitude': 'Longitude GPS',
  'DestinatarioCnpjCpf': 'CPF/CNPJ Destinatário',
  'ValorCondutor': 'Repasse Condutor (R$)',
  'Prioridade': 'Nível de Prioridade',
  'DataConclusao': 'Data / Hora Conclusão'
};

const ALL_TOGGLEABLE_COLUMNS = ['Status', ...ALL_SPREADSHEET_COLUMNS];

const getCoordinates = (order: Order | null) => {
  if (!order) return { lat: '-23.5505', lng: '-46.6333' };
  const lat = order.rawData?.Latitude || order.rawData?.latitude;
  const lng = order.rawData?.Longitude || order.rawData?.longitude;
  if (lat && lng) return { lat: String(lat), lng: String(lng) };
  
  // Fallbacks baseados na região do pedido
  switch (order.region) {
    case 'Centro': return { lat: '-23.5489', lng: '-46.6388' };
    case 'Zona Sul': return { lat: '-23.6182', lng: '-46.6544' };
    case 'Zona Oeste': return { lat: '-23.5555', lng: '-46.6900' };
    case 'Zona Norte': return { lat: '-23.4950', lng: '-46.6200' };
    default: return { lat: '-23.5505', lng: '-46.6333' };
  }
};

export default function OrdersTable({ 
  orders, 
  riders, 
  clientPartners,
  onUpdateStatus, 
  onAssignRider, 
  searchQuery,
  activeTab,
  setActiveTab,
  onUpdateOrder,
  onDeleteOrder,
  onBulkUpdateStatus,
  onBulkAssignRider,
  onBulkDelete,
  onBulkCreate,
  onBulkEdit
}: OrdersTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(50);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showRiderDropdown, setShowRiderDropdown] = useState<string | null>(null);

  // Keyboard shortcut listener to exit fullscreen with ESC
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);
  
  const getPartnerDisplayName = (partnerIdOrCode: string): string => {
    return getPartnerDisplayNameUtil(partnerIdOrCode, clientPartners);
  };
  const [viewMode, setViewMode] = useState<'simplified' | 'spreadsheet'>('spreadsheet');
  const [columnsOrder, setColumnsOrder] = useState<string[]>(ALL_SPREADSHEET_COLUMNS);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => new Set(ALL_TOGGLEABLE_COLUMNS));
  const [showColumnFilterMenu, setShowColumnFilterMenu] = useState<boolean>(false);
  const [columnSearchTerm, setColumnSearchTerm] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  
  // Selection states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [isBulkCreateOpen, setIsBulkCreateOpen] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  // Custom Delete Confirmation Modal state
  const [deleteModalConfig, setDeleteModalConfig] = useState<{
    isOpen: boolean;
    onConfirm: () => void;
    title: string;
    description: string;
    itemDetails?: {
      id?: string;
      clientName?: string;
      address?: string;
    };
    count?: number;
  }>({
    isOpen: false,
    onConfirm: () => {},
    title: '',
    description: ''
  });

  // Local multi-filters state
  const [localPartner, setLocalPartner] = useState<string>('Todos');
  const [localRider, setLocalRider] = useState<string>('Todos');
  const [localRegion, setLocalRegion] = useState<string>('Todos');

  // CEP Search & Geocoding Tool State inside OrdersTable
  const [showCepGeocodeTool, setShowCepGeocodeTool] = useState(false);
  const [cepSearchInput, setCepSearchInput] = useState('');
  const [cepSearchNumber, setCepSearchNumber] = useState('');
  const [isCepGeocoding, setIsCepGeocoding] = useState(false);
  const [cepGeocodeResult, setCepGeocodeResult] = useState<CepGeocodeFullResult | null>(null);
  const [cepGeocodeError, setCepGeocodeError] = useState('');
  const [selectedAssignOrderForCep, setSelectedAssignOrderForCep] = useState<string>('');
  const [cepAssignSuccessMsg, setCepAssignSuccessMsg] = useState('');

  // Handle CEP Geocoding lookup
  const handleExecuteCepGeocode = async (overrideCep?: string) => {
    const targetCep = overrideCep || cepSearchInput;
    const cleanCep = targetCep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      setCepGeocodeError('O CEP precisa conter exatamente 8 dígitos (ex: 01310-100).');
      setCepGeocodeResult(null);
      return;
    }

    setIsCepGeocoding(true);
    setCepGeocodeError('');
    setCepAssignSuccessMsg('');

    try {
      const res = await fetchAddressAndGeocodeByCep(cleanCep, cepSearchNumber);
      setCepGeocodeResult(res);
    } catch (err: any) {
      console.error('Erro na geocodificação do CEP:', err);
      setCepGeocodeError(err?.message || 'Falha ao realizar consulta de geocodificação para este CEP.');
      setCepGeocodeResult(null);
    } finally {
      setIsCepGeocoding(false);
    }
  };

  // Assign geocoded data to an existing order in the table
  const handleAssignGeocodedCoordsToOrder = (targetOrderId: string) => {
    if (!cepGeocodeResult || !targetOrderId) return;

    const targetOrder = orders.find(o => o.id === targetOrderId);
    if (!targetOrder) return;

    const updatedOrder: Order = {
      ...targetOrder,
      cep: cepGeocodeResult.formattedCep,
      address: cepGeocodeResult.address,
      region: cepGeocodeResult.region,
      lat: cepGeocodeResult.lat,
      lng: cepGeocodeResult.lng,
      rawData: {
        ...(targetOrder.rawData || {}),
        'CEP': cepGeocodeResult.formattedCep,
        'Endereco': cepGeocodeResult.address,
        'CidadeMunicipio': cepGeocodeResult.localidade,
        'Estado': cepGeocodeResult.uf,
        'Latitude': String(cepGeocodeResult.lat),
        'Longitude': String(cepGeocodeResult.lng)
      },
      history: [
        ...(targetOrder.history || []),
        {
          timestamp: getSaoPauloDateTimeShort(),
          action: 'Coordenadas Geocodificadas por CEP',
          user: 'Operador (API Geocoding)',
          details: `Endereço e coordenadas (Lat: ${cepGeocodeResult.lat.toFixed(6)}, Lng: ${cepGeocodeResult.lng.toFixed(6)}) preenchidos automaticamente via busca por CEP ${cepGeocodeResult.formattedCep}.`
        }
      ]
    };

    onUpdateOrder(updatedOrder);
    setCepAssignSuccessMsg(`Pedido #${targetOrder.id} atualizado com sucesso com as coordenadas Lat: ${cepGeocodeResult.lat.toFixed(5)}, Lng: ${cepGeocodeResult.lng.toFixed(5)}!`);
    setTimeout(() => setCepAssignSuccessMsg(''), 4000);
  };

  const handleCopyAddressAndRoute = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // 1. Copy to clipboard
    if (order.address) {
      navigator.clipboard.writeText(order.address);
    }
    
    // 2. Set active copy feedback
    setCopiedOrderId(order.id);
    setTimeout(() => {
      setCopiedOrderId(null);
    }, 2000);
    
    // 3. Build OpenStreetMap Route URL
    const cp = clientPartners?.find(c => isMatchingClientCode(order.partnerName, c.id, c.codigoCliente));
    let mapsUrl = '';
    
    if (cp && cp.addr) {
      // Create driving route from the Client Partner to the Destination Address using OpenStreetMap Routing
      mapsUrl = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${encodeURIComponent(cp.addr)}%3B${encodeURIComponent(order.address)}`;
    } else {
      // Fallback: search on OpenStreetMap
      mapsUrl = `https://www.openstreetmap.org/search?query=${encodeURIComponent(order.address)}`;
    }
    
    // 4. Open in new tab
    window.open(mapsUrl, '_blank');
  };

  // Consolidated Hub Modal states
  const [hubModalOpen, setHubModalOpen] = useState(false);
  const [hubOrder, setHubOrder] = useState<Order | null>(null);
  const [hubTab, setHubTab] = useState<'crud' | 'timeline' | 'history' | 'protocol' | 'notificacao'>('crud');
  const [isEditingInHub, setIsEditingInHub] = useState(false);
  
  // Local CRUD form state (cloned from active order)
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [editStandardFields, setEditStandardFields] = useState({
    clientName: '',
    phone: '',
    address: '',
    region: 'Centro',
    priority: 'Média' as Order['priority'],
    value: 0,
    itemsCount: 1,
    cep: '',
    partnerName: '',
    date: ''
  });

  // Protocol specific fields in modal
  const [protocolRecipientName, setProtocolRecipientName] = useState('');
  const [protocolRecipientDoc, setProtocolRecipientDoc] = useState('');
  const [protocolDeliveryDate, setProtocolDeliveryDate] = useState('');
  const [protocolDeliveryTime, setProtocolDeliveryTime] = useState('');
  const [protocolPartnerName, setProtocolPartnerName] = useState('');
  const [protocolOrderDate, setProtocolOrderDate] = useState('');
  const [protocolOrderTime, setProtocolOrderTime] = useState('');
  const [isEditingProtocol, setIsEditingProtocol] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [protocolSignatureUrl, setProtocolSignatureUrl] = useState('');
  const [protocolDeliveryPhoto, setProtocolDeliveryPhoto] = useState('');
  const [protocolObservations, setProtocolObservations] = useState('');
  const [isPhotoCorrupted, setIsPhotoCorrupted] = useState(false);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);

  // Signature Canvas Modal State
  const [signatureCanvasModalOpen, setSignatureCanvasModalOpen] = useState(false);
  const [signatureTargetOrder, setSignatureTargetOrder] = useState<Order | null>(null);

  const openSignatureCanvas = (order: Order) => {
    setSignatureTargetOrder(order);
    setSignatureCanvasModalOpen(true);
  };

  const handleSaveCanvasSignature = (
    signatureDataUrl: string,
    recipientName: string,
    recipientDoc: string
  ) => {
    if (!signatureTargetOrder) return;
    const orderId = signatureTargetOrder.id;

    const coords = getCoordinates(signatureTargetOrder);
    const photo = signatureTargetOrder.deliveryPhotoUrl || generateStaticSvgMap(parseFloat(coords.lat) || -23.55052, parseFloat(coords.lng) || -46.633308, signatureTargetOrder.address);
    const protocolNum = signatureTargetOrder.protocolNumber || `PROT-${orderId.replace('ped-', '').toUpperCase()}`;
    const name = recipientName.trim() || signatureTargetOrder.recipientName || signatureTargetOrder.clientName || 'Recebedor Titular';

    // Pass canvas Data URL directly to onUpdateStatus to populate signatureUrl field
    onUpdateStatus(
      orderId,
      'Concluído',
      protocolNum,
      signatureDataUrl,
      photo,
      name,
      recipientDoc
    );

    if (hubOrder && hubOrder.id === orderId) {
      setProtocolSignatureUrl(signatureDataUrl);
      setHasSignature(true);
      setProtocolRecipientName(name);
      if (recipientDoc) setProtocolRecipientDoc(recipientDoc);
      setHubOrder({
        ...hubOrder,
        status: 'Concluído',
        signatureUrl: signatureDataUrl,
        protocolNumber: protocolNum,
        recipientName: name,
        recipientDoc
      });
    }
  };

  // Reactively sync the open hub order and its protocol fields with updated global orders list (e.g. on delivery completion from rider app)
  React.useEffect(() => {
    if (hubModalOpen && hubOrder) {
      const freshOrder = orders.find(o => o.id === hubOrder.id);
      if (freshOrder) {
        // Deep check if properties changed
        const hasChanges = 
          freshOrder.status !== hubOrder.status ||
          freshOrder.deliveryPhotoUrl !== hubOrder.deliveryPhotoUrl ||
          freshOrder.signatureUrl !== hubOrder.signatureUrl ||
          freshOrder.recipientName !== hubOrder.recipientName ||
          freshOrder.recipientDoc !== hubOrder.recipientDoc ||
          freshOrder.deliveryDate !== hubOrder.deliveryDate ||
          freshOrder.deliveryTime !== hubOrder.deliveryTime ||
          JSON.stringify(freshOrder.history) !== JSON.stringify(hubOrder.history);

        if (hasChanges) {
          setHubOrder(freshOrder);
          
          // Only auto-sync form values if not currently actively editing in the protocol UI
          if (!isEditingProtocol) {
            setProtocolRecipientName(freshOrder.recipientName || freshOrder.clientName);
            setProtocolRecipientDoc(freshOrder.recipientDoc || '');
            setProtocolDeliveryDate(freshOrder.status === 'Concluído' ? (freshOrder.deliveryDate || freshOrder.date || getSaoPauloISODate()) : (freshOrder.deliveryDate || freshOrder.date || ''));
            setProtocolDeliveryTime(freshOrder.status === 'Concluído' ? (freshOrder.deliveryTime || getSaoPauloTime()) : (freshOrder.deliveryTime || freshOrder.rawData?.HorarioFinal || freshOrder.rawData?.horariofinal || ''));
            
            const freshSig = freshOrder.signatureUrl || freshOrder.rawData?.signatureUrl || freshOrder.rawData?.signatureImage || freshOrder.rawData?.assinatura || (freshOrder.status === 'Concluído' ? `typed:${freshOrder.recipientName || freshOrder.clientName || 'Recebedor Titular'}` : '');
            
            const coords = getCoordinates(freshOrder);
            let freshPhoto = freshOrder.deliveryPhotoUrl || freshOrder.rawData?.deliveryPhotoUrl || freshOrder.rawData?.photoImage || freshOrder.rawData?.fotoComprovante || freshOrder.rawData?.foto;
            if (!freshPhoto || freshPhoto.includes('unsplash.com')) {
              freshPhoto = freshOrder.status === 'Concluído' ? generateStaticSvgMap(parseFloat(coords.lat) || -23.55052, parseFloat(coords.lng) || -46.633308, freshOrder.address) : '';
            }

            setHasSignature(!!freshSig);
            setProtocolSignatureUrl(freshSig);
            setProtocolDeliveryPhoto(freshPhoto);
            setIsPhotoCorrupted(false);
          }
        }
      }
    }
  }, [orders, hubModalOpen, hubOrder, isEditingProtocol]);

  const protocolCoords = getCoordinates(hubOrder);

  // Helper to resolve real timestamps for timeline steps from the order history
  const getTimelineStepTime = (step: number): string | null => {
    if (!hubOrder) return null;
    const history = hubOrder.history || [];
    
    const addMinutesToTime = (timeStr: string, minutes: number): string => {
      if (!timeStr || !timeStr.includes(':')) return '12:00';
      const [h, m] = timeStr.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return timeStr;
      const totalMin = h * 60 + m + minutes;
      const newH = Math.floor(totalMin / 60) % 24;
      const newM = totalMin % 60;
      return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
    };

    const dateStr = formatToBrazilianDate(hubOrder.date) || '02/07/2026';
    const baseTime = hubOrder.createdAt || '12:00';

    switch (step) {
      case 1: {
        const entry = history.find(h => 
          h.action.toLowerCase().includes('importado') || 
          h.action.toLowerCase().includes('criado') ||
          h.action.toLowerCase().includes('entrada')
        );
        if (entry) return entry.timestamp;
        return `${dateStr} às ${baseTime}`;
      }
      case 2: {
        const entry = history.find(h => 
          h.action.toLowerCase().includes('alocado') || 
          h.action.toLowerCase().includes('vinculado') ||
          h.action.toLowerCase().includes('vínculo') ||
          h.action.toLowerCase().includes('designado')
        );
        if (entry) return entry.timestamp;
        if (hubOrder.riderId) {
          return `${dateStr} às ${addMinutesToTime(baseTime, 5)}`;
        }
        return null;
      }
      case 3: {
        const entry = history.find(h => 
          h.action.toLowerCase().includes('rota iniciada') || 
          h.action.toLowerCase().includes('iniciou o trajeto') ||
          h.action.toLowerCase().includes('em rota') ||
          h.action.toLowerCase().includes('despachado') ||
          h.details?.toLowerCase().includes('em rota') ||
          h.details?.toLowerCase().includes('despachado')
        );
        if (entry) return entry.timestamp;
        const isActive = hubOrder.status === 'Em rota' || hubOrder.status === 'Entregando' || hubOrder.status === 'Concluído';
        if (isActive) {
          return `${dateStr} às ${addMinutesToTime(baseTime, 12)}`;
        }
        return null;
      }
      case 4: {
        const entry = history.find(h => 
          h.action.toLowerCase().includes('entregando') || 
          h.action.toLowerCase().includes('trânsito') ||
          h.details?.toLowerCase().includes('entregando') ||
          h.details?.toLowerCase().includes('no local')
        );
        if (entry) return entry.timestamp;
        const isActive = hubOrder.status === 'Entregando' || hubOrder.status === 'Concluído';
        if (isActive) {
          return `${dateStr} às ${addMinutesToTime(baseTime, 25)}`;
        }
        return null;
      }
      case 5: {
        const entry = history.find(h => 
          h.action.toLowerCase().includes('concluído') || 
          h.action.toLowerCase().includes('cancelado') || 
          h.action.toLowerCase().includes('ocorrência') || 
          h.action.toLowerCase().includes('liquidado') ||
          h.action.toLowerCase().includes('protocolo') ||
          h.details?.toLowerCase().includes('concluiu') ||
          h.details?.toLowerCase().includes('recibo')
        );
        if (entry) return entry.timestamp;
        const isFinished = hubOrder.status === 'Concluído' || hubOrder.status === 'Cancelado' || hubOrder.status === 'Ocorrência';
        if (isFinished) {
          return `${dateStr} às ${addMinutesToTime(baseTime, 35)}`;
        }
        return null;
      }
      default:
        return null;
    }
  };

  // Helper to extract a displayable value for any order and spreadsheet column
  const getOrderColumnValue = (order: Order, col: string, rowIndex?: number): string => {
    const normalizeKey = (key: string): string => {
      return key
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    };

    const lowerCol = col.toLowerCase();
    if (lowerCol === 'prioridade') {
      return order.priority || 'Normal';
    }
    if (lowerCol === 'sequencia') {
      if (rowIndex !== undefined) {
        return String(rowIndex);
      }
      const globalIdx = orders.findIndex(o => o.id === order.id);
      return String(globalIdx !== -1 ? globalIdx + 1 : 1);
    }
    if (lowerCol === 'codigocliente' || lowerCol === 'nomefantasia') {
      if (order.rawData) {
        const keys = Object.keys(order.rawData);
        const nameKey = keys.find(k => k.toLowerCase() === 'nomefantasia');
        if (nameKey && order.rawData[nameKey] && String(order.rawData[nameKey]).trim() !== order.partnerName) {
          return String(order.rawData[nameKey]);
        }
      }
      return getPartnerDisplayNameUtil(order.partnerName, clientPartners);
    }

    if (lowerCol === 'valorentrega') {
      const freightVal = getOrderFreightValue(order, clientPartners);
      return String(freightVal);
    }
    if (lowerCol === 'valorcondutor') {
      const rider = riders.find(r => r.id === order.riderId);
      const commission = calculateRiderCommissionForOrder(rider, { ...order, status: 'Concluído' }, clientPartners);
      return String(commission.total);
    }
    if (lowerCol === 'dispositivocondutor') {
      const rider = riders.find(r => r.id === order.riderId);
      return rider ? rider.name : 'Não vinculado';
    }
    if (lowerCol === 'dataconclusao' || lowerCol === 'data de conclusao') {
      return order.dataConclusao || order.deliveryDate || (order.status === 'Concluído' ? (order.date || getSaoPauloISODate()) : '');
    }
    if (lowerCol === 'horarioinicio' || lowerCol === 'horarioinicial') {
      return order.horarioInicial || order.createdAt || '15:00';
    }
    if (lowerCol === 'horariofinal') {
      return order.horarioFinal || order.deliveryTime || (order.status === 'Concluído' ? '17:30' : '');
    }

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
      // Fallback translation mappings for initial mock orders
      switch (lowerCol) {
        case 'sequencia': 
          value = rowIndex !== undefined ? String(rowIndex) : (orders.findIndex(o => o.id === order.id) !== -1 ? String(orders.findIndex(o => o.id === order.id) + 1) : '1');
          break;
        case 'pedido': 
          value = order.id.replace('ped-', '') || order.id;
          break;
        case 'codigocliente': {
          const cp = clientPartners?.find(c => isMatchingClientCode(order.partnerName, c.id, c.codigoCliente));
          value = cp ? cp.name : (order.partnerName || 'Parceiro');
          break;
        }
        case 'datasolicitacao': 
          value = order.date || '2026-07-02';
          break;
        case 'procurarpor': 
          value = order.clientName;
          break;
        case 'endereco': 
          value = order.address;
          break;
        case 'cep': 
          value = order.cep || '01310-100';
          break;
        case 'telefone': 
          value = order.phone || '(11) 98888-7777';
          break;
        case 'dispositivocondutor':
          value = riders.find(r => r.id === order.riderId)?.name || 'Não vinculado';
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
        case 'nomefantasia': 
          value = order.partnerName || 'Parceiro';
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
        case 'valorentrega': 
          value = '12.50';
          break;
        case 'latitude': 
          value = '-23.5505';
          break;
        case 'longitude': 
          value = '-46.6333';
          break;
        case 'destinatariocnpjcpf': 
          value = '412.312.891-00';
          break;
        case 'valorcondutor': 
          value = '8.50';
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

  // Filter orders by active tab AND search query AND local dropdown filters
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 1. Tab filter
      const matchesTab = activeTab === 'Todos' || order.status === activeTab;
      
      // 2. Search query filter (client, code, region, address, partner, CEP)
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        order.id.toLowerCase().includes(query) ||
        order.clientName.toLowerCase().includes(query) ||
        order.region.toLowerCase().includes(query) ||
        order.address.toLowerCase().includes(query) ||
        (order.partnerName && order.partnerName.toLowerCase().includes(query)) ||
        (order.cep && order.cep.replace(/\D/g, '').includes(query)) ||
        (order.protocolNumber && order.protocolNumber.toLowerCase().includes(query)) ||
        (order.recipientName && order.recipientName.toLowerCase().includes(query)) ||
        (order.recipientDoc && order.recipientDoc.toLowerCase().includes(query));

      // 3. Partner filter
      const matchesPartner = localPartner === 'Todos' || order.partnerName === localPartner;

      // 4. Rider filter
      const matchesRider = localRider === 'Todos' || order.riderId === localRider;

      // 5. Region filter
      const matchesRegion = localRegion === 'Todos' || order.region === localRegion;

      return matchesTab && matchesSearch && matchesPartner && matchesRider && matchesRegion;
    });
  }, [orders, activeTab, searchQuery, localPartner, localRider, localRegion]);

  // Sort orders based on sortConfig
  const sortedOrders = useMemo(() => {
    if (!sortConfig) return filteredOrders;

    return [...filteredOrders].sort((a, b) => {
      // Check if simplified or spreadsheet mode sorting
      let valA = '';
      let valB = '';

      if (viewMode === 'spreadsheet') {
        valA = getOrderColumnValue(a, sortConfig.key);
        valB = getOrderColumnValue(b, sortConfig.key);
      } else {
        // Simplified fields sorting
        const key = sortConfig.key;
        if (key === 'Código') {
          valA = a.id;
          valB = b.id;
        } else if (key === 'Cliente') {
          valA = a.clientName;
          valB = b.clientName;
        } else if (key === 'Endereço') {
          valA = a.address;
          valB = b.address;
        } else if (key === 'Prioridade') {
          valA = a.priority;
          valB = b.priority;
        } else if (key === 'Status') {
          valA = a.status;
          valB = b.status;
        } else if (key === 'Valor') {
          return sortConfig.direction === 'asc' ? a.value - b.value : b.value - a.value;
        } else {
          valA = a.id;
          valB = b.id;
        }
      }

      const keyLower = sortConfig.key.toLowerCase();

      // 1. Check if we are sorting by date (contains "data" or "date" or matches date pattern)
      const isDateCol = keyLower.includes('data') || keyLower.includes('date');
      const isBrDatePattern = /^\d{2}\/\d{2}\/\d{4}$/;
      const isIsoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

      if (
        isDateCol || 
        (isBrDatePattern.test(valA) && isBrDatePattern.test(valB)) || 
        (isIsoDatePattern.test(valA) && isIsoDatePattern.test(valB))
      ) {
        const toComparableDate = (str: string) => {
          const clean = str.trim();
          if (isBrDatePattern.test(clean)) {
            const parts = clean.split('/');
            return `${parts[2]}${parts[1]}${parts[0]}`;
          }
          if (isIsoDatePattern.test(clean)) {
            const parts = clean.split('-');
            return `${parts[0]}${parts[1]}${parts[2]}`;
          }
          return clean;
        };

        const dateA = toComparableDate(valA);
        const dateB = toComparableDate(valB);

        return sortConfig.direction === 'asc' 
          ? dateA.localeCompare(dateB) 
          : dateB.localeCompare(dateA);
      }

      // 2. Is it a sequence/index column?
      if (keyLower === 'sequencia') {
        const numA = parseInt(valA, 10) || 0;
        const numB = parseInt(valB, 10) || 0;
        return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
      }

      // 3. Robust numeric, currency, and alphanumeric prefix parsing
      const extractNumber = (str: string): number | null => {
        if (!str) return null;
        let clean = str.trim();

        // Handle Brazilian currency, e.g., R$ 1.250,50 or R$ 12,50
        if (clean.includes('R$') || (clean.includes(',') && !clean.includes('/'))) {
          clean = clean.replace(/R\$\s*/gi, '');
          clean = clean.replace(/\./g, ''); // remove thousands separators
          clean = clean.replace(/,/g, '.'); // replace decimal comma with dot
        }

        // Filter out other characters except numbers, minus sign, and dots
        clean = clean.replace(/[^\d.-]/g, '');
        const parsed = parseFloat(clean);
        return isNaN(parsed) ? null : parsed;
      };

      const numA = extractNumber(valA);
      const numB = extractNumber(valB);

      if (numA !== null && numB !== null) {
        return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
      }

      // 4. Default natural Portuguese alphanumeric comparison
      return sortConfig.direction === 'asc' 
        ? valA.localeCompare(valB, 'pt-BR', { sensitivity: 'base', numeric: true }) 
        : valB.localeCompare(valA, 'pt-BR', { sensitivity: 'base', numeric: true });
    });
  }, [filteredOrders, sortConfig, viewMode]);

  // Calculate pagination details
  const totalPages = useMemo(() => Math.ceil(sortedOrders.length / itemsPerPage) || 1, [sortedOrders.length, itemsPerPage]);

  // Safe page setter
  const setPage = (p: number) => {
    const validPage = Math.max(1, Math.min(p, totalPages));
    setCurrentPage(validPage);
  };

  // Reset pagination to page 1 whenever active tab, search, or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab, localPartner, localRider, localRegion]);

  // Ensure currentPage is not out of bounds when totalPages decreases
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedOrders = useMemo(() => {
    return sortedOrders.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [sortedOrders, currentPage, itemsPerPage]);

  const getPriorityColor = (priority: string) => {
    const p = String(priority || '').toLowerCase();
    if (p === 'alta') return 'bg-rose-50 text-rose-700 border-rose-100 font-bold';
    if (p === 'media' || p === 'média') return 'bg-amber-50 text-amber-700 border-amber-100 font-bold';
    if (p === 'expresso') return 'bg-red-600 text-white border-red-700 font-black shadow-xs';
    return 'bg-slate-50 text-slate-600 border-slate-100';
  };

  const getStatusClasses = (status: OrderStatus) => {
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

  const getStatusIcon = (status: OrderStatus) => {
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
        <span className={`relative z-10 inline-flex items-center gap-1 px-2.5 py-0.5 text-[9px] font-extrabold border rounded-full leading-none whitespace-nowrap mb-1.5 shadow-xs ${getStatusClasses(status as OrderStatus)}`}>
          {getStatusIcon(status as OrderStatus)}
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

  // Move columns in spreadsheet mode
  const moveColumn = (colIdx: number, direction: 'left' | 'right') => {
    const targetIdx = direction === 'left' ? colIdx - 1 : colIdx + 1;
    if (targetIdx < 0 || targetIdx >= columnsOrder.length) return;
    
    const reordered = [...columnsOrder];
    const temp = reordered[colIdx];
    reordered[colIdx] = reordered[targetIdx];
    reordered[targetIdx] = temp;
    setColumnsOrder(reordered);
  };

  // Move columns in spreadsheet mode respecting current visible set
  const moveColumnName = (colName: string, direction: 'left' | 'right') => {
    const activeCols = columnsOrder.filter(c => visibleColumns.has(c));
    const activeIdx = activeCols.indexOf(colName);
    if (activeIdx === -1) return;
    const targetActiveIdx = direction === 'left' ? activeIdx - 1 : activeIdx + 1;
    if (targetActiveIdx < 0 || targetActiveIdx >= activeCols.length) return;
    
    const targetColName = activeCols[targetActiveIdx];
    const origIdx = columnsOrder.indexOf(colName);
    const origTargetIdx = columnsOrder.indexOf(targetColName);
    
    const reordered = [...columnsOrder];
    reordered[origIdx] = targetColName;
    reordered[origTargetIdx] = colName;
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

  // Row selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allFilteredIds = sortedOrders.map(o => o.id);
      setSelectedIds(new Set([...selectedIds, ...allFilteredIds]));
    } else {
      const allFilteredIds = sortedOrders.map(o => o.id);
      const copy = new Set(selectedIds);
      allFilteredIds.forEach(id => copy.delete(id));
      setSelectedIds(copy);
    }
  };

  const handleSelectRow = (orderId: string) => {
    const copy = new Set(selectedIds);
    if (copy.has(orderId)) {
      copy.delete(orderId);
    } else {
      copy.add(orderId);
    }
    setSelectedIds(copy);
  };

  const isAllSelectedOnPage = () => {
    if (sortedOrders.length === 0) return false;
    return sortedOrders.every(o => selectedIds.has(o.id));
  };

  // Bulk Actions
  const handleBulkStatusChange = (status: OrderStatus) => {
    onBulkUpdateStatus(Array.from(selectedIds), status);
    setSelectedIds(new Set());
  };

  const handleBulkRiderAssign = (riderId: string) => {
    onBulkAssignRider(Array.from(selectedIds), riderId);
    setSelectedIds(new Set());
  };

  const handleBulkDeleteAction = () => {
    if (selectedIds.size === 0) return;
    setDeleteModalConfig({
      isOpen: true,
      onConfirm: () => {
        onBulkDelete(Array.from(selectedIds));
        setSelectedIds(new Set());
      },
      title: 'Excluir Pedidos em Lote',
      description: `Você está prestes a excluir permanentemente ${selectedIds.size} pedidos selecionados de uma só vez. Esta ação é definitiva e removerá todos os históricos e dados financeiros destes pedidos permanentemente do Firestore.`,
      count: selectedIds.size
    });
  };

  const handleBulkEditSave = (updates: Partial<Order>) => {
    if (onBulkEdit) {
      onBulkEdit(Array.from(selectedIds), updates);
    }
    setSelectedIds(new Set());
  };

  const handleBulkCreateSubmit = (newOrders: Omit<Order, 'id' | 'status' | 'createdAt'>[]) => {
    if (onBulkCreate) {
      onBulkCreate(newOrders);
    }
  };

  // Exports supporting selection OR bulk (all filtered)
  const executeExcelExport = (onlySelected: boolean) => {
    const targetList = onlySelected 
      ? orders.filter(o => selectedIds.has(o.id))
      : sortedOrders;

    if (targetList.length === 0) {
      alert("Nenhum pedido para exportar.");
      return;
    }

    const exportData = targetList.map((o, idx) => {
      const riderName = riders.find((r) => r.id === o.riderId)?.name || 'Não vinculado';
      
      // If we have rawData, we can export ALL columns
      if (viewMode === 'spreadsheet') {
        const rowObj: Record<string, string> = {};
        columnsOrder.forEach(col => {
          rowObj[col] = getOrderColumnValue(o, col, idx + 1);
        });
        rowObj['Status Logística'] = o.status;
        rowObj['Região'] = o.region;
        return rowObj;
      }

      return {
        'Código': o.id,
        'Cliente': o.clientName,
        'Telefone': o.phone || '',
        'Endereço': o.address,
        'Região': o.region,
        'Status': o.status,
        'Valor (R$)': o.value,
        'Entregador': riderName,
        'Parceiro': getPartnerDisplayName(o.partnerName) || ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pedidos');

    const timestamp = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `vinimap_pedidos_${onlySelected ? 'selecionados' : 'relatorio'}_${timestamp}.xlsx`);
  };

  const executePDFExport = (onlySelected: boolean) => {
    const targetList = onlySelected 
      ? orders.filter(o => selectedIds.has(o.id))
      : sortedOrders;

    if (targetList.length === 0) {
      alert("Nenhum pedido para exportar.");
      return;
    }

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text(`Vinimap Logistics OS - Relatório de Pedidos (${onlySelected ? 'Selecionados' : 'Geral'})`, 14, 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    const timestamp = getSaoPauloDateTimeShort();
    doc.text(`Gerado em: ${timestamp} | Total de Registros: ${targetList.length}`, 14, 21);

    const pdfHeaders = [['Código', 'Cliente', 'Endereço / Região', 'Entregador', 'Status', 'Valor']];
    const pdfBody = targetList.map((o) => {
      const riderName = riders.find((r) => r.id === o.riderId)?.name || 'Não vinculado';
      return [
        o.id,
        `${o.clientName}\n${o.phone || ''}`,
        `${o.address}\nRegião: ${o.region}`,
        riderName,
        o.status,
        `R$ ${o.value.toFixed(2).replace('.', ',')}`
      ];
    });

    autoTable(doc, {
      head: pdfHeaders,
      body: pdfBody,
      startY: 25,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 8, cellPadding: 2.5 }
    });

    doc.save(`vinimap_pdf_${onlySelected ? 'selecionados' : 'relatorio'}_${timestamp}.pdf`);
  };

  const handleExportBoth = (onlySelected: boolean) => {
    executeExcelExport(onlySelected);
    setTimeout(() => {
      executePDFExport(onlySelected);
    }, 350);
  };

  // Open Consolidated Hub
  const openHub = (order: Order, tab: typeof hubTab) => {
    setHubOrder(order);
    setHubTab(tab);
    setIsEditingInHub(false);
    
    // Setup standard forms
    setEditStandardFields({
      clientName: order.clientName,
      phone: order.phone || '',
      address: order.address,
      region: order.region,
      priority: order.priority,
      value: order.value,
      itemsCount: order.itemsCount,
      cep: order.cep || '',
      partnerName: order.partnerName || '',
      date: order.date || '2026-07-02'
    });

    // Setup rawData forms
    const initialRawForm: Record<string, string> = {};
    ALL_SPREADSHEET_COLUMNS.forEach(col => {
      initialRawForm[col] = getOrderColumnValue(order, col);
    });
    setEditForm(initialRawForm);

    // Protocol info
    setProtocolRecipientName(order.recipientName || order.clientName);
    setProtocolRecipientDoc(order.recipientDoc || '');
    setProtocolDeliveryDate(order.status === 'Concluído' ? (order.deliveryDate || order.date || getSaoPauloISODate()) : (order.deliveryDate || order.date || ''));
    setProtocolDeliveryTime(order.status === 'Concluído' ? (order.deliveryTime || getSaoPauloTime()) : (order.deliveryTime || order.rawData?.HorarioFinal || order.rawData?.horariofinal || ''));
    setProtocolPartnerName(getPartnerDisplayName(order.partnerName) || 'Parceiro');
    const resolvedOrderDate = order.date || extractISODateFromTimestamp(order.createdAt) || getSaoPauloISODate();
    const resolvedOrderTime = formatOrderTime(order.horarioInicial || order.createdAt || order.rawData?.HorarioInicio || order.rawData?.horarioinicio || getSaoPauloTime());
    setProtocolOrderDate(resolvedOrderDate);
    setProtocolOrderTime(resolvedOrderTime);
    setIsEditingProtocol(false);

    const calculatedSig = order.signatureUrl || order.rawData?.signatureUrl || order.rawData?.signatureImage || order.rawData?.assinatura || (order.status === 'Concluído' ? `typed:${order.recipientName || order.clientName || 'Recebedor Titular'}` : '');
    
    const coords = getCoordinates(order);
    let calculatedPhoto = order.deliveryPhotoUrl || order.rawData?.deliveryPhotoUrl || order.rawData?.photoImage || order.rawData?.fotoComprovante || order.rawData?.foto;
    if (!calculatedPhoto || calculatedPhoto.includes('unsplash.com')) {
      calculatedPhoto = order.status === 'Concluído' ? generateStaticSvgMap(parseFloat(coords.lat) || -23.55052, parseFloat(coords.lng) || -46.633308, order.address) : '';
    }

    const initialObs = order.rawData?.Observacoes || order.rawData?.observacoes || order.rawData?.Observations || '';
    setProtocolObservations(initialObs);

    setHasSignature(!!calculatedSig);
    setProtocolSignatureUrl(calculatedSig);
    setProtocolDeliveryPhoto(calculatedPhoto);

    setHubModalOpen(true);
  };

  // Save changes from CRUD Tab
  const handleSaveHubEdit = () => {
    if (!hubOrder) return;

    const valNF = parseFloat(editForm['ValorNotaFiscal'] || String(editStandardFields.value)) || 0;
    const parsedValEntrega = editForm['ValorEntrega'] ? parseFloat(editForm['ValorEntrega'].replace(',', '.')) : undefined;
    const parsedValCondutor = editForm['ValorCondutor'] ? parseFloat(editForm['ValorCondutor'].replace(',', '.')) : undefined;

    const updatedOrder: Order = {
      ...hubOrder,
      clientName: editStandardFields.clientName,
      phone: editStandardFields.phone,
      address: editStandardFields.address,
      region: editStandardFields.region,
      priority: editStandardFields.priority,
      value: valNF || editStandardFields.value,
      itemsCount: parseInt(String(editStandardFields.itemsCount)) || 1,
      cep: editStandardFields.cep,
      partnerName: editStandardFields.partnerName,
      date: editStandardFields.date,
      deliveryValue: parsedValEntrega !== undefined && !isNaN(parsedValEntrega) ? parsedValEntrega : undefined,
      driverValue: parsedValCondutor !== undefined && !isNaN(parsedValCondutor) ? parsedValCondutor : undefined,
      rawData: {
        ...(hubOrder.rawData || {}),
        ...editForm,
        'ProcurarPor': editStandardFields.clientName,
        'Endereco': editStandardFields.address,
        'CEP': editStandardFields.cep,
        'Telefone': editStandardFields.phone,
        'CodigoCliente': editStandardFields.partnerName,
        'ValorNotaFiscal': String(valNF || editStandardFields.value),
        'DataSolicitacao': editStandardFields.date,
        'ValorEntrega': editForm['ValorEntrega'] || '',
        'ValorCondutor': editForm['ValorCondutor'] || ''
      },
      history: [
        ...(hubOrder.history || []),
        {
          timestamp: getSaoPauloDateTimeShort(),
          action: 'Pedido Editado (CRUD)',
          user: 'Operador',
          details: 'Campos cadastrais editados manualmente via central de pedidos.'
        }
      ]
    };

    onUpdateOrder(updatedOrder);
    setHubOrder(updatedOrder);
    setIsEditingInHub(false);
  };

  // Delete from within Hub
  const handleDeleteHubOrder = () => {
    if (!hubOrder) return;
    setDeleteModalConfig({
      isOpen: true,
      onConfirm: () => {
        onDeleteOrder(hubOrder.id);
        setHubModalOpen(false);
        setHubOrder(null);
      },
      title: 'Excluir Pedido Individual',
      description: `Você está prestes a excluir permanentemente o pedido #${hubOrder.id}. Esta ação removerá todo o histórico de entregas e dados financeiros vinculados a este pedido de forma permanente do Firestore.`,
      itemDetails: {
        id: hubOrder.id,
        clientName: getPartnerDisplayName(hubOrder.clientName),
        address: hubOrder.address
      },
      count: 1
    });
  };

  // Liquidation Protocol closure
  const handleSaveProtocol = () => {
    if (!hubOrder) return;
    
    const finalDeliveryDate = protocolDeliveryDate || getSaoPauloISODate();
    const finalDeliveryTime = protocolDeliveryTime || getSaoPauloTime();
    const finalProtocolNum = hubOrder.protocolNumber || `PROT-${hubOrder.id.replace('ped-', '').toUpperCase()}`;
    const finalSig = hasSignature 
      ? (protocolSignatureUrl || hubOrder.signatureUrl || `typed:${protocolRecipientName || hubOrder.clientName}`) 
      : `typed:${protocolRecipientName || hubOrder.clientName}`;
    const protocolCoords = getCoordinates(hubOrder);
    const finalPhoto = protocolDeliveryPhoto || hubOrder.deliveryPhotoUrl || generateStaticSvgMap(parseFloat(protocolCoords.lat) || -23.55052, parseFloat(protocolCoords.lng) || -46.633308, hubOrder.address);

    const updatedOrder: Order = {
      ...hubOrder,
      status: 'Concluído',
      protocolNumber: finalProtocolNum,
      recipientName: protocolRecipientName,
      recipientDoc: protocolRecipientDoc,
      date: protocolOrderDate,
      createdAt: formatOrderTime(protocolOrderTime),
      horarioInicial: formatOrderTime(protocolOrderTime),
      deliveryDate: finalDeliveryDate,
      deliveryTime: finalDeliveryTime,
      partnerName: protocolPartnerName,
      signatureUrl: finalSig,
      deliveryPhotoUrl: finalPhoto,
      rawData: {
        ...(hubOrder.rawData || {}),
        'Observacoes': protocolObservations,
        'observacoes': protocolObservations,
        'Recebedor': protocolRecipientName,
        'DocumentoRecebedor': protocolRecipientDoc,
        'NumeroProtocolo': finalProtocolNum,
        'HorarioInicio': formatOrderTime(protocolOrderTime),
        'horarioinicio': formatOrderTime(protocolOrderTime),
        'HorarioFinal': finalDeliveryTime,
        'horariofinal': finalDeliveryTime,
        'DataConclusao': finalDeliveryDate,
        'signatureUrl': finalSig,
        'deliveryPhotoUrl': finalPhoto
      },
      history: [
        ...(hubOrder.history || []),
        {
          timestamp: getSaoPauloDateTimeShort(),
          action: 'Protocolo de Entrega Emitido',
          user: 'Entregador (App)',
          details: `Liquidação formal efetuada para ${protocolRecipientName} (${protocolRecipientDoc}).`
        }
      ]
    };

    // Update status and save protocol via handleUpdateStatus
    onUpdateStatus(
      hubOrder.id, 
      'Concluído', 
      finalProtocolNum, 
      finalSig, 
      finalPhoto, 
      protocolRecipientName, 
      protocolRecipientDoc
    );

    setHubOrder(updatedOrder);
    setIsEditingProtocol(false);
    alert('Protocolo de Entrega gravado com sucesso! Pedido liquidado como Concluído.');
  };

  // Helper to convert images (URLs or base64) to format accepted by jsPDF
  const getImageDataUrl = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!url) {
        reject(new Error("URL vazia"));
        return;
      }
      if (url.startsWith('data:')) {
        resolve(url);
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/png');
            resolve(dataUrl);
          } else {
            reject(new Error("Não foi possível obter contexto 2D"));
          }
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = (err) => {
        reject(err);
      };
      img.src = url;
    });
  };

  // Single Protocol PDF Export
  const exportSingleProtocolPDF = async () => {
    if (!hubOrder) return;
    
    // Half A4 page size (A5 Landscape): 210mm width, 148.5mm height
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a5'
    });

    // Outer Border and Frame
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.rect(8, 8, 194, 132.5);

    // Decorative Slate Header block
    doc.setFillColor(30, 41, 59); // Slate-800
    doc.rect(8, 8, 194, 18, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('PROTOCOLO DIGITAL DE COMPROVACAO DE ENTREGA', 14, 15);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(226, 232, 240);
    doc.text('SISTEMA DE GESTAO LOGISTICA VINIMAP OS', 14, 21);

    // Protocol number right-aligned
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`${hubOrder.protocolNumber || 'PROT-' + hubOrder.id.replace('ped-', '').toUpperCase()}`, 196, 15, { align: 'right' });

    // Date/time of issue right-aligned
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(226, 232, 240);
    const nowStr = getSaoPauloDateTimeShort();
    doc.text(`Emissao: ${nowStr}`, 196, 21, { align: 'right' });

    // Columns coordinates
    // Left Column: General & Time & Recipient (x: 12 to 102, width 90)
    // Right Column: Delivery Proof (Photo + Signature) (x: 110 to 196, width 86)

    // Section 1: Dados do Pedido e Controle
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('1. DADOS GERAIS DO PEDIDO', 12, 33);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(12, 35, 102, 35); // Separator

    // Helper to draw bold key-value pairs
    const drawRow = (label: string, value: string, x: number, y: number) => {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7.5);
      doc.text(label, x, y);
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(7.5);
      doc.text(value, x + 38, y);
    };

    drawRow('ID do Pedido:', hubOrder.id, 12, 40);
    drawRow('Cliente Parceiro:', protocolPartnerName, 12, 45);
    drawRow('Destinatario Final:', hubOrder.clientName, 12, 50);

    // Let's handle the address line wrapping
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7.5);
    doc.text('Endereco de Destino:', 12, 55);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    const addressLines = doc.splitTextToSize(hubOrder.address, 48); // Wrap to fit column (width ~48)
    doc.text(addressLines, 12 + 38, 55);

    // Dynamic offset based on address length
    const addressHeight = addressLines.length * 3.5;
    const cepY = Math.max(60, 55 + addressHeight);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('CEP de Destino:', 12, cepY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(hubOrder.cep || '01310-100', 12 + 38, cepY);

    // Section 2: Datas e Horários
    const sec2Y = cepY + 7;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('2. DATAS E CONTROLE', 12, sec2Y);
    doc.line(12, sec2Y + 2, 102, sec2Y + 2);

    const datesY = sec2Y + 7;
    drawRow('Data Emissao:', formatToBrazilianDate(protocolOrderDate), 12, datesY);
    drawRow('Horario Abertura:', formatOrderTime(protocolOrderTime), 12, datesY + 4.5);
    drawRow('Data Liquidacao:', protocolDeliveryDate ? formatToBrazilianDate(protocolDeliveryDate) : 'Aguardando Entrega', 12, datesY + 9);
    drawRow('Horario Conclusao:', protocolDeliveryTime ? formatOrderTime(protocolDeliveryTime) : 'Aguardando Entrega', 12, datesY + 13.5);

    // Section 3: Responsável pelo Recebimento
    const sec3Y = datesY + 20.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('3. RESPONSAVEL PELO RECEBIMENTO', 12, sec3Y);
    doc.line(12, sec3Y + 2, 102, sec3Y + 2);

    const recY = sec3Y + 7;
    drawRow('Nome do Recebedor:', protocolRecipientName || 'Nao Informado', 12, recY);
    drawRow('Documento (RG/CPF):', protocolRecipientDoc || 'Nao Informado', 12, recY + 4.5);
    drawRow('Status de Liquidacao:', hubOrder.status.toUpperCase(), 12, recY + 9);

    // Section 4: Comprovação Fotográfica
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('4. COMPROVACAO FOTOGRAFICA', 110, 33);
    doc.line(110, 35, 196, 35);

    // Photo Box frame
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.rect(110, 39, 86, 44, 'F'); // Frame at x=110, y=39, width=86, height=44

    if (protocolDeliveryPhoto) {
      try {
        const base64Photo = await getImageDataUrl(protocolDeliveryPhoto);
        let format = 'PNG';
        if (base64Photo.includes('image/jpeg') || base64Photo.includes('image/jpg')) {
          format = 'JPEG';
        } else if (base64Photo.includes('image/webp')) {
          format = 'WEBP';
        }
        
        // Add the image slightly inset inside the frame
        doc.addImage(base64Photo, format, 111, 40, 84, 42);
      } catch (e) {
        console.error("Error adding delivery photo to PDF", e);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text('FOTO REGISTRADA (FORMATO ALTERNATIVO)', 153, 61, { align: 'center' });
      }
    } else {
      const coords = getCoordinates(hubOrder);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('PONTO DE ENTREGA REGISTRADO', 153, 53, { align: 'center' });
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Lat: ${coords.lat}`, 153, 61, { align: 'center' });
      doc.text(`Log: ${coords.lng}`, 153, 67, { align: 'center' });
      
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text('(Sem comprovacao por foto)', 153, 76, { align: 'center' });
    }

    // Section 5: Assinatura Biométrica
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('5. ASSINATURA BIOMETRICA (DIGITAL)', 110, 91);
    doc.line(110, 93, 196, 93);

    // Signature box
    doc.setDrawColor(226, 232, 240);
    if (hasSignature) {
      doc.setFillColor(248, 250, 252);
      doc.rect(110, 97, 86, 30, 'F');

      const sigUrl = hubOrder?.signatureUrl;
      if (sigUrl && sigUrl !== 'digital-sign-blob' && !sigUrl.startsWith('typed:')) {
        try {
          const base64Sig = await getImageDataUrl(sigUrl);
          let format = 'PNG';
          if (base64Sig.includes('image/jpeg') || base64Sig.includes('image/jpg')) format = 'JPEG';
          doc.addImage(base64Sig, format, 120, 99, 66, 22);
        } catch (err) {
          console.error("Error drawing signature image in PDF", err);
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(9.5);
          doc.setTextColor(59, 130, 246);
          doc.text(protocolRecipientName || 'Assinatura Digital', 153, 111, { align: 'center' });
        }
      } else if (sigUrl && sigUrl.startsWith('typed:')) {
        // Cursive styled signature
        const nameText = sigUrl.replace('typed:', '');
        doc.setFont('times', 'italic'); // Standard core Times-Italic font
        doc.setFontSize(12);
        doc.setTextColor(30, 58, 138); // Deep Blue
        doc.text(nameText, 153, 111, { align: 'center' });
      } else {
        // Mockup signature: draw a nice wavy signature line
        doc.setDrawColor(59, 130, 246); // blue stroke
        doc.setLineWidth(0.6);
        doc.line(125, 112, 135, 105);
        doc.line(135, 105, 145, 115);
        doc.line(145, 115, 155, 103);
        doc.line(155, 103, 165, 113);
        doc.line(165, 113, 181, 108);

        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(59, 130, 246);
        doc.text(protocolRecipientName || 'Assinatura Digital', 153, 115, { align: 'center' });
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(148, 163, 184);
      doc.text('REGISTRADO E ASSINADO ELETRONICAMENTE', 153, 124, { align: 'center' });
    } else {
      doc.setDrawColor(220, 100, 100); // Red outline for blank signature
      doc.setFillColor(254, 242, 242); // Soft red background
      doc.rect(110, 97, 86, 30, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(220, 38, 38); // Red text
      doc.text('ASSINATURA DIGITAL EM BRANCO', 153, 112, { align: 'center' });
    }

    // Footnote
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`Comprovante Digital emitido eletronicamente em ${nowStr} - Vinimap OS`, 105, 139, { align: 'center' });

    doc.save(`protocolo_${hubOrder.id}_${hubOrder.protocolNumber || 'DOC'}.pdf`);
  };

  // Reset signature mockup
  const handleSignMockup = () => {
    setHasSignature(true);
    if (hubOrder) {
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#f8fafc'; // light gray bg
        ctx.fillRect(0, 0, 300, 100);
        
        ctx.strokeStyle = '#1d4ed8'; // blue-700 stroke
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Draw a simulated elegant signature line
        ctx.beginPath();
        ctx.moveTo(30, 60);
        ctx.bezierCurveTo(70, 20, 90, 80, 130, 40);
        ctx.bezierCurveTo(150, 20, 170, 80, 210, 50);
        ctx.bezierCurveTo(230, 40, 250, 70, 270, 60);
        ctx.stroke();

        // Print receipt label below signature
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ASSINATURA BIOMETRICA OPERACIONAL', 150, 90);

        const base64Sig = canvas.toDataURL('image/png');
        setProtocolSignatureUrl(base64Sig);
        const updatedOrder = {
          ...hubOrder,
          signatureUrl: base64Sig
        };
        setHubOrder(updatedOrder);
        onUpdateOrder(updatedOrder);
      } else {
        setProtocolSignatureUrl('digital-sign-blob');
        const updatedOrder = {
          ...hubOrder,
          signatureUrl: 'digital-sign-blob'
        };
        setHubOrder(updatedOrder);
        onUpdateOrder(updatedOrder);
      }
    }
  };

  const handleClearSignature = () => {
    setHasSignature(false);
    setProtocolSignatureUrl('');
    if (hubOrder) {
      const updatedOrder = {
        ...hubOrder,
        signatureUrl: undefined
      };
      setHubOrder(updatedOrder);
      onUpdateOrder(updatedOrder);
    }
  };

  const handlePhotoUpload = async (file: File) => {
    if (!file) return;
    try {
      const compressed = await compressImage(file, 800, 800, 0.65);
      if (compressed) setProtocolDeliveryPhoto(compressed);
    } catch (e) {
      console.warn("Photo upload error:", e);
    }
  };

  const handleSimulatePhoto = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Background (Slate-800)
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 400, 300);

      // Draw box/package (isometric style)
      ctx.fillStyle = '#b45309';
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 4;
      
      ctx.beginPath();
      ctx.moveTo(200, 70);
      ctx.lineTo(280, 110);
      ctx.lineTo(280, 190);
      ctx.lineTo(200, 230);
      ctx.lineTo(120, 190);
      ctx.lineTo(120, 110);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inside lines
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      ctx.moveTo(200, 70);
      ctx.lineTo(200, 230);
      ctx.moveTo(120, 110);
      ctx.lineTo(200, 150);
      ctx.lineTo(280, 110);
      ctx.stroke();

      // Red tape on package
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(160, 90);
      ctx.lineTo(240, 130);
      ctx.moveTo(240, 90);
      ctx.lineTo(160, 130);
      ctx.stroke();

      // Green check badge
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(310, 210, 40, 0, Math.PI * 2);
      ctx.fill();

      // Checkmark inside badge
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(295, 210);
      ctx.lineTo(305, 220);
      ctx.lineTo(325, 200);
      ctx.stroke();

      // Text label
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('COMPROVACAO FOTOGRAFICA', 200, 275);
      
      // Border
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 8;
      ctx.strokeRect(0, 0, 400, 300);

      const dataUrl = canvas.toDataURL('image/png');
      setProtocolDeliveryPhoto(dataUrl);
    }
  };

  // Single row status advancement
  const advanceStatus = (order: Order) => {
    const timestamp = getSaoPauloDateTimeShort();
    let nextStatus: OrderStatus = order.status;

    if (order.status === 'Não iniciado') {
      if (!order.riderId) {
        const availableRider = riders.find(r => r.status === 'Disponível');
        if (availableRider) {
          onAssignRider(order.id, availableRider.id);
        } else {
          onAssignRider(order.id, riders[0].id);
        }
      }
      nextStatus = 'Em rota';
    } else if (order.status === 'Em rota') {
      nextStatus = 'Entregando';
    } else if (order.status === 'Entregando' || order.status === 'Ocorrência') {
      nextStatus = 'Concluído';
    }

    if (nextStatus !== order.status) {
      // Append history
      const updatedHistory: OrderHistoryEntry[] = [
        ...(order.history || []),
        {
          timestamp,
          action: `Status alterado para ${nextStatus}`,
          user: 'Operador',
          details: `Fluxo de entregas avançado via atalho rápido.`
        }
      ];
      onUpdateStatus(order.id, nextStatus);
      onUpdateOrder({
        ...order,
        status: nextStatus,
        history: updatedHistory
      });
    }
  };

  return (
    <div 
      className={`bg-white border border-slate-100 rounded-2xl shadow-sm flex flex-col justify-between transition-all duration-200 ${
        isFullscreen 
          ? 'fixed inset-0 z-50 p-3 sm:p-5 bg-slate-900/60 backdrop-blur-md flex flex-col overflow-hidden' 
          : ''
      }`} 
      id="orders-list-card"
    >
      <div className={`bg-white rounded-2xl flex flex-col h-full overflow-hidden ${isFullscreen ? 'shadow-2xl border border-slate-200' : ''}`}>
      
      {/* 1. OPERATIONAL KPI DECK (INTERACTIVE FILTER TABS) */}
      <div className="p-5 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm">Controle de Entregas</h3>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">Gestão inteligente de despacho, alocação de condutores e monitoramento de status</p>
          </div>
          <div className="text-[10px] text-slate-400 font-bold bg-white border border-slate-100 px-3 py-1 rounded-xl self-start md:self-auto">
            SLA padrão: <span className="text-blue-600 font-black">SP Capital</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3" id="orders-kpi-deck">
          {[
            { key: 'Todos', label: 'Todos os Pedidos', color: 'border-blue-200 text-blue-700 bg-blue-50/40 hover:bg-blue-50', icon: <Grid size={13} />, count: orders.length, desc: 'Acervo Geral' },
            { key: 'Não iniciado', label: 'Não Iniciados', color: 'border-amber-200 text-amber-700 bg-amber-50/40 hover:bg-amber-50', icon: <Clock size={13} />, count: orders.filter(o => o.status === 'Não iniciado').length, desc: 'Aguard. Despacho' },
            { key: 'Em rota', label: 'Em Rota', color: 'border-sky-200 text-sky-700 bg-sky-50/40 hover:bg-sky-50', icon: <Truck size={13} />, count: orders.filter(o => o.status === 'Em rota').length, desc: 'Em Trânsito' },
            { key: 'Entregando', label: 'Entregando', color: 'border-indigo-200 text-indigo-700 bg-indigo-50/40 hover:bg-indigo-50', icon: <Truck size={13} />, count: orders.filter(o => o.status === 'Entregando').length, desc: 'Última Milha' },
            { key: 'Concluído', label: 'Concluídos', color: 'border-emerald-200 text-emerald-700 bg-emerald-50/40 hover:bg-emerald-50', icon: <CheckCircle2 size={13} />, count: orders.filter(o => o.status === 'Concluído').length, desc: 'Sucesso Total' },
            { key: 'Ocorrência', label: 'Ocorrências', color: 'border-rose-200 text-rose-700 bg-rose-50/40 hover:bg-rose-50', icon: <AlertCircle size={13} />, count: orders.filter(o => o.status === 'Ocorrência').length, desc: 'Atenção Crítica' },
            { key: 'Cancelado', label: 'Cancelados', color: 'border-slate-200 text-slate-700 bg-slate-50/40 hover:bg-slate-50', icon: <Ban size={13} />, count: orders.filter(o => o.status === 'Cancelado').length, desc: 'Devolvidos' }
          ].map((item) => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setActiveTab(item.key as any);
                  setCurrentPage(1);
                  setSelectedIds(new Set());
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between h-24 ${
                  isActive 
                    ? `${item.color} border-2 ring-2 ring-blue-500/15 shadow-md transform scale-[1.01]` 
                    : 'border-slate-100 bg-white hover:border-slate-200 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`p-1.5 rounded-xl ${isActive ? 'bg-white/90 shadow-sm' : 'bg-slate-50 text-slate-400'}`}>
                    {item.icon}
                  </span>
                  <span className={`text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-white text-slate-800 shadow-xs' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {item.count}
                  </span>
                </div>
                <div className="mt-2">
                  <h4 className="text-[11px] font-extrabold text-slate-800 leading-none truncate">{item.label}</h4>
                  <p className="text-[9px] text-slate-400 font-semibold mt-1 leading-none">{item.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. ADVANCED FILTERS & ACTIONS CONTROL PANEL */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/60 space-y-3.5">
        
        {/* Row 1: Operational Filters Grid */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            
            {/* Filter Header & Active Count Badge */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                <Filter size={14} className="font-bold" />
              </div>
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Filtros Operacionais</span>
              {(localPartner !== 'Todos' || localRider !== 'Todos' || localRegion !== 'Todos') && (
                <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-extrabold rounded-full animate-pulse">
                  {[localPartner, localRider, localRegion].filter(f => f !== 'Todos').length} ativo(s)
                </span>
              )}
            </div>

            {/* Filter Select Controls Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 flex-1 max-w-4xl">
              
              {/* Cliente Parceiro */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider pl-0.5">Cliente Parceiro</span>
                <div className="relative flex items-center">
                  <div className="absolute left-3 text-slate-400 pointer-events-none">
                    <Building2 size={14} />
                  </div>
                  <select
                    value={localPartner}
                    onChange={(e) => { setLocalPartner(e.target.value); setCurrentPage(1); }}
                    className="w-full h-9 pl-9 pr-8 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer transition-all appearance-none"
                  >
                    <option value="Todos">Todos os Parceiros</option>
                    {clientPartners.map(cp => (
                      <option key={cp.id} value={cp.id}>{cp.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Condutor Alocado */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider pl-0.5">Condutor Alocado</span>
                <div className="relative flex items-center">
                  <div className="absolute left-3 text-slate-400 pointer-events-none">
                    <UserCheck size={14} />
                  </div>
                  <select
                    value={localRider}
                    onChange={(e) => { setLocalRider(e.target.value); setCurrentPage(1); }}
                    className="w-full h-9 pl-9 pr-8 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer transition-all appearance-none"
                  >
                    <option value="Todos">Todos os Condutores</option>
                    {riders.map(r => (
                      <option key={r.id} value={r.id}>{r.name} ({r.vehicle})</option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Região de Entrega */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider pl-0.5">Região de Entrega</span>
                <div className="relative flex items-center">
                  <div className="absolute left-3 text-slate-400 pointer-events-none">
                    <Compass size={14} />
                  </div>
                  <select
                    value={localRegion}
                    onChange={(e) => { setLocalRegion(e.target.value); setCurrentPage(1); }}
                    className="w-full h-9 pl-9 pr-8 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer transition-all appearance-none"
                  >
                    <option value="Todos">Todas as Regiões</option>
                    <option value="Centro">Centro</option>
                    <option value="Zona Sul">Zona Sul</option>
                    <option value="Zona Oeste">Zona Oeste</option>
                    <option value="Zona Norte">Zona Norte</option>
                    <option value="Zona Leste">Zona Leste</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-3 text-slate-400 pointer-events-none" />
                </div>
              </div>

            </div>

            {/* Clear Filters Button */}
            {(localPartner !== 'Todos' || localRider !== 'Todos' || localRegion !== 'Todos') && (
              <button
                onClick={() => {
                  setLocalPartner('Todos');
                  setLocalRider('Todos');
                  setLocalRegion('Todos');
                  setCurrentPage(1);
                }}
                className="h-9 px-3.5 mt-auto bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-all shrink-0 active:scale-[0.98]"
                title="Limpar todos os filtros selecionados"
              >
                <FilterX size={14} />
                <span>Limpar Filtros</span>
              </button>
            )}

          </div>
        </div>

        {/* Row 2: Action Buttons & Layout Tools */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          
          {/* Left Action Buttons Group */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Criar em Massa */}
            <button
              onClick={() => setIsBulkCreateOpen(true)}
              className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white border border-emerald-500 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer shadow-xs hover:shadow-md hover:scale-[1.01] active:scale-[0.99]"
              title="Criar múltiplos pedidos simultaneamente"
            >
              <Plus size={15} className="font-extrabold" />
              <span>Criar em Massa</span>
            </button>

            {/* Buscar & Geocodificar CEP */}
            <button
              type="button"
              onClick={() => setShowCepGeocodeTool(!showCepGeocodeTool)}
              className={`h-9 px-4 rounded-xl border text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer shadow-2xs hover:scale-[1.01] active:scale-[0.99] ${
                showCepGeocodeTool || cepGeocodeResult
                  ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100'
                  : 'bg-white border-blue-200 text-blue-700 hover:bg-blue-50/80'
              }`}
              title="Buscar CEP e obter Latitude/Longitude para otimização de rotas"
            >
              <MapPin size={14} className={showCepGeocodeTool ? 'animate-bounce text-white' : 'text-blue-600'} />
              <span>{showCepGeocodeTool ? 'Ocultar Geocodificação' : 'Buscar & Geocodificar CEP'}</span>
            </button>

            {/* Exportar Button Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                disabled={filteredOrders.length === 0}
                className={`h-9 px-4 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white border border-slate-800 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer shadow-2xs ${
                  filteredOrders.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                title="Exportar dados de pedidos em Excel ou PDF"
              >
                <DownloadCloud size={14} className="text-blue-400" />
                <span>Exportar {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}</span>
                <ChevronDown size={12} className={`transition-transform duration-200 ${showExportDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {showExportDropdown && filteredOrders.length > 0 && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowExportDropdown(false)} />
                  <div 
                    className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-60 bg-white border border-slate-100 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
                    id="export-dropdown-menu"
                  >
                    <div className="px-3.5 py-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                      {selectedIds.size > 0 ? `Exportar ${selectedIds.size} selecionados` : 'Exportar lista filtrada'}
                    </div>

                    <button
                      onClick={() => {
                        setShowExportModal(true);
                        setShowExportDropdown(false);
                      }}
                      className="w-full text-left px-3.5 py-2.5 bg-blue-50/70 hover:bg-blue-100 text-xs font-extrabold text-blue-700 flex items-center gap-2.5 cursor-pointer transition-all border-b border-blue-100/50"
                    >
                      <Settings2 size={14} className="text-blue-600" />
                      <span>Personalizar Relatório...</span>
                    </button>

                    <button
                      onClick={() => {
                        handleExportBoth(selectedIds.size > 0);
                        setShowExportDropdown(false);
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-2.5 cursor-pointer transition-colors"
                    >
                      <DownloadCloud size={14} className="text-blue-500" />
                      <span>Baixar Ambos (Excel & PDF)</span>
                    </button>

                    <button
                      onClick={() => {
                        executeExcelExport(selectedIds.size > 0);
                        setShowExportDropdown(false);
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-2.5 cursor-pointer transition-colors"
                    >
                      <FileSpreadsheet size={14} className="text-emerald-500" />
                      <span>Baixar Planilha Excel (.xlsx)</span>
                    </button>

                    <button
                      onClick={() => {
                        executePDFExport(selectedIds.size > 0);
                        setShowExportDropdown(false);
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-2.5 cursor-pointer transition-colors"
                    >
                      <FileText size={14} className="text-rose-500" />
                      <span>Baixar Relatório PDF (.pdf)</span>
                    </button>
                  </div>
                </>
              )}
            </div>

          </div>

          {/* Right Layout Mode & Fullscreen Controls Group */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            
            {/* Column Filter Toggle Button & Popover Modal */}
            <div className="relative" id="column-filter-container">
              <button
                type="button"
                onClick={() => setShowColumnFilterMenu(!showColumnFilterMenu)}
                className={`h-10 px-3.5 rounded-2xl border text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer shadow-2xs ${
                  visibleColumns.size < ALL_TOGGLEABLE_COLUMNS.length
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100 ring-2 ring-indigo-500/20'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
                title="Selecionar e ocultar colunas da tabela para melhorar a legibilidade"
                id="btn-column-filter"
              >
                <Eye size={14} className={visibleColumns.size < ALL_TOGGLEABLE_COLUMNS.length ? 'text-indigo-200' : 'text-indigo-600'} />
                <span>Colunas ({visibleColumns.size}/{ALL_TOGGLEABLE_COLUMNS.length})</span>
                <ChevronDown size={12} className={`transition-transform duration-200 ${showColumnFilterMenu ? 'rotate-180' : ''}`} />
              </button>

              {/* Column Selector Popover */}
              {showColumnFilterMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowColumnFilterMenu(false)} />
                  <div 
                    className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl py-3 px-3.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
                    id="column-filter-popover"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                          <Eye size={15} />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Filtro de Colunas Visíveis</h4>
                          <p className="text-[10px] text-slate-400 font-semibold">{visibleColumns.size} de {ALL_TOGGLEABLE_COLUMNS.length} campos exibidos</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setShowColumnFilterMenu(false)}
                        className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Quick Search */}
                    <div className="relative mb-2">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar campo (ex: Endereço, Data, Status)..."
                        value={columnSearchTerm}
                        onChange={(e) => setColumnSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder:font-normal"
                      />
                      {columnSearchTerm && (
                        <button 
                          onClick={() => setColumnSearchTerm('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    {/* Preset View Buttons */}
                    <div className="mb-2.5">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Visões Rápidas (Presets):</span>
                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => setVisibleColumns(new Set(ALL_TOGGLEABLE_COLUMNS))}
                          className="text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg transition-colors cursor-pointer border border-indigo-100/50"
                        >
                          Exibir Todas ({ALL_TOGGLEABLE_COLUMNS.length})
                        </button>
                        <button
                          onClick={() => setVisibleColumns(new Set(['Status', 'Sequencia', 'Pedido', 'CodigoCliente', 'ProcurarPor', 'Endereco', 'CEP', 'Telefone', 'DispositivoCondutor', 'ValorNotaFiscal', 'Prioridade']))}
                          className="text-[10px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          Essenciais (11)
                        </button>
                        <button
                          onClick={() => setVisibleColumns(new Set(['Status', 'Pedido', 'Endereco', 'CEP', 'DispositivoCondutor', 'HorarioInicio', 'HorarioFinal', 'DataLimite', 'Prioridade']))}
                          className="text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg transition-colors cursor-pointer border border-amber-100/50"
                        >
                          Logística (9)
                        </button>
                        <button
                          onClick={() => setVisibleColumns(new Set(['Status', 'Pedido', 'CodigoCliente', 'ValorNotaFiscal', 'ValorReceber', 'ValorEntrega', 'ValorCondutor']))}
                          className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg transition-colors cursor-pointer border border-emerald-100/50"
                        >
                          Financeiro (7)
                        </button>
                      </div>
                    </div>

                    {/* Column Checkboxes List */}
                    <div className="max-h-60 overflow-y-auto space-y-0.5 pr-1 border-t border-slate-100 pt-2 custom-scrollbar">
                      {ALL_TOGGLEABLE_COLUMNS.filter(col => {
                        const label = COLUMN_LABELS_MAP[col] || col;
                        return label.toLowerCase().includes(columnSearchTerm.toLowerCase()) || col.toLowerCase().includes(columnSearchTerm.toLowerCase());
                      }).map(col => {
                        const isChecked = visibleColumns.has(col);
                        const label = COLUMN_LABELS_MAP[col] || col;
                        return (
                          <label
                            key={col}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer select-none ${
                              isChecked ? 'bg-indigo-50/60 text-indigo-950 font-bold' : 'hover:bg-slate-50 text-slate-500'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  const updated = new Set(visibleColumns);
                                  if (isChecked) {
                                    if (updated.size > 1) {
                                      updated.delete(col);
                                    }
                                  } else {
                                    updated.add(col);
                                  }
                                  setVisibleColumns(updated);
                                }}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                              />
                              <span className="truncate">{label}</span>
                            </div>
                            <span className="text-[9px] font-mono font-bold text-slate-400 ml-2 shrink-0">{col}</span>
                          </label>
                        );
                      })}
                    </div>

                    {/* Footer / Reset */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-extrabold text-slate-400">
                      <span>{visibleColumns.size} colunas ativas</span>
                      {visibleColumns.size < ALL_TOGGLEABLE_COLUMNS.length && (
                        <button
                          onClick={() => setVisibleColumns(new Set(ALL_TOGGLEABLE_COLUMNS))}
                          className="text-indigo-600 hover:underline cursor-pointer"
                        >
                          Restaurar Padrão
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* View Mode Switcher Pill */}
            <div className="bg-white p-1 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewMode('spreadsheet')}
                className={`h-8 px-3 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'spreadsheet'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
                title="Visualização em formato Tabela / Planilha detalhada"
              >
                <Grid size={13} />
                <span>Planilha</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('simplified')}
                className={`h-8 px-3 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'simplified'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
                title="Visualização em formato Lista Simplificada"
              >
                <List size={13} />
                <span>Simplificada</span>
              </button>
            </div>

            {/* Tela Cheia Button */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`h-10 px-3.5 rounded-2xl border text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer shadow-2xs ${
                isFullscreen
                  ? 'bg-rose-600 border-rose-600 text-white hover:bg-rose-700'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
              title={isFullscreen ? "Sair do modo Tela Cheia (Pressione ESC)" : "Expandir tabela de pedidos para Tela Cheia"}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              <span className="hidden sm:inline">{isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}</span>
              <kbd className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md border font-extrabold shadow-2xs ${
                isFullscreen ? 'bg-rose-700 text-white border-rose-500' : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                ESC
              </kbd>
            </button>

          </div>

        </div>
      </div>

      {/* 3. CEP SEARCH & AUTO-GEOCODING TOOL PANEL */}
      {showCepGeocodeTool && (
        <div className="p-4 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-slate-50 border-b border-blue-100 animate-in fade-in slide-in-from-top-2 duration-200" id="cep-geocoding-tool-panel">
          <div className="max-w-5xl mx-auto space-y-4">
            
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                  <MapPin size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Busca Inteligente por CEP & Geocodificação de Coordenadas
                  </h4>
                  <p className="text-[10px] text-slate-500 font-semibold">
                    Consulte a API de Endereços (ViaCEP) e Geocodificação (OpenStreetMap) para autopreencher coordenadas exatas (Lat/Lng) e endereço.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCepGeocodeTool(false)}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-slate-600 cursor-pointer shadow-3xs"
              >
                <X size={14} />
              </button>
            </div>

            {/* Input Form Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex-1 relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" />
                <input
                  type="text"
                  placeholder="Digite o CEP (ex: 01310-100 ou 05061-050)..."
                  value={cepSearchInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setCepSearchInput(raw);
                    const clean = raw.replace(/\D/g, '');
                    if (clean.length === 8) {
                      handleExecuteCepGeocode(clean);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleExecuteCepGeocode();
                  }}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-blue-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-3xs font-mono"
                />
              </div>

              <div className="w-full sm:w-44">
                <input
                  type="text"
                  placeholder="Número/Comp. (opcional)"
                  value={cepSearchNumber}
                  onChange={(e) => setCepSearchNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-3xs"
                />
              </div>

              <button
                type="button"
                onClick={() => handleExecuteCepGeocode()}
                disabled={isCepGeocoding || !cepSearchInput}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
              >
                {isCepGeocoding ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Geocodificando...</span>
                  </>
                ) : (
                  <>
                    <Search size={14} />
                    <span>Consultar & Obter Coordenadas</span>
                  </>
                )}
              </button>
            </div>

            {/* Error Message */}
            {cepGeocodeError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-rose-600" />
                <span>{cepGeocodeError}</span>
              </div>
            )}

            {/* Success Notification message */}
            {cepAssignSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-black text-emerald-800 flex items-center gap-2 shadow-xs">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-600 animate-bounce" />
                <span>{cepAssignSuccessMsg}</span>
              </div>
            )}

            {/* Geocode Result Box */}
            {cepGeocodeResult && (
              <div className="bg-white border border-blue-200 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-mono font-black rounded-lg uppercase">
                        CEP {cepGeocodeResult.formattedCep}
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9.5px] font-extrabold rounded-lg flex items-center gap-1">
                        <Check size={11} />
                        {cepGeocodeResult.isExactGeocode ? 'Geocodificação Direta (Nominatim OSM)' : 'Base Setorial SP Calculada'}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[9.5px] font-bold rounded-lg uppercase">
                        {cepGeocodeResult.region}
                      </span>
                    </div>
                    <h5 className="text-xs font-extrabold text-slate-800 leading-snug">
                      {cepGeocodeResult.address}
                    </h5>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(cepGeocodeResult.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1"
                    >
                      <ExternalLink size={12} />
                      <span>Ver no Mapa</span>
                    </a>
                  </div>
                </div>

                {/* Coordenadas Latitude / Longitude & Auto-Fill Assignment Box */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  
                  {/* Coordenadas Lat/Lng pill */}
                  <div className="md:col-span-5 bg-slate-900 text-white p-3 rounded-xl flex items-center justify-between font-mono text-xs">
                    <div>
                      <span className="text-[9px] text-slate-400 block font-sans font-bold uppercase tracking-wider">
                        Coordenadas Geocodificadas
                      </span>
                      <div className="flex items-center gap-3 mt-0.5 font-bold">
                        <span className="text-emerald-400">Lat: {cepGeocodeResult.lat.toFixed(6)}</span>
                        <span className="text-sky-400">Lng: {cepGeocodeResult.lng.toFixed(6)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`${cepGeocodeResult.lat}, ${cepGeocodeResult.lng}`);
                        alert('Coordenadas copiadas para a área de transferência!');
                      }}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors cursor-pointer"
                      title="Copiar Lat, Lng"
                    >
                      <Copy size={13} />
                    </button>
                  </div>

                  {/* Quick Order Assign Select Box */}
                  <div className="md:col-span-7 flex items-center gap-2">
                    <select
                      value={selectedAssignOrderForCep}
                      onChange={(e) => setSelectedAssignOrderForCep(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecione um pedido existente para aplicar coordenadas...</option>
                      {orders.map(o => (
                        <option key={o.id} value={o.id}>
                          #{o.id} - {o.clientName} ({o.address || 'Sem endereço'})
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={!selectedAssignOrderForCep}
                      onClick={() => handleAssignGeocodedCoordsToOrder(selectedAssignOrderForCep)}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer whitespace-nowrap"
                    >
                      Aplicar ao Pedido
                    </button>
                  </div>

                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Floating/Sticky Bulk Actions Panel */}
      {selectedIds.size > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-50 border-b border-blue-100 px-6 py-3 flex flex-wrap items-center justify-between gap-3"
          id="bulk-actions-panel"
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
            <span className="text-xs font-bold text-blue-800">
              {selectedIds.size} {selectedIds.size === 1 ? 'pedido selecionado' : 'pedidos selecionados'}
            </span>
            <button 
              onClick={() => setSelectedIds(new Set())}
              className="text-[10px] text-blue-600 hover:text-blue-800 underline font-semibold ml-1 cursor-pointer"
            >
              Desmarcar tudo
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Bulk Status Dropdown */}
            <div className="relative group">
              <button className="px-2.5 py-1.5 bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 rounded-xl text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition-colors">
                <span>Alterar Status</span>
                <ChevronDown size={11} />
              </button>
              <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-100 rounded-xl shadow-xl py-1 z-50 hidden group-hover:block">
                {(['Não iniciado', 'Em rota', 'Entregando', 'Concluído', 'Ocorrência', 'Cancelado'] as OrderStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => handleBulkStatusChange(status)}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-[11px] font-bold text-slate-700"
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Bulk Rider Allocation Dropdown */}
            <div className="relative group">
              <button className="px-2.5 py-1.5 bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 rounded-xl text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition-colors">
                <UserCheck size={12} />
                <span>Alocar Condutor</span>
                <ChevronDown size={11} />
              </button>
              <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-100 rounded-xl shadow-xl py-1 z-50 hidden group-hover:block max-h-40 overflow-y-auto">
                {riders.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleBulkRiderAssign(r.id)}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-50/50 text-[11px] flex items-center gap-2 cursor-pointer font-semibold text-slate-700"
                  >
                    <img src={r.avatar} className="w-4 h-4 rounded-full object-cover" />
                    <span>{r.name} ({r.vehicle})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Bulk Edit Button */}
            <button
              onClick={() => setIsBulkEditOpen(true)}
              className="px-2.5 py-1.5 bg-indigo-100/80 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-xl text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition-colors"
              id="btn-bulk-edit"
            >
              <Edit3 size={11} />
              <span>Editar em Lote</span>
            </button>

            {/* Bulk deletion */}
            <button
              onClick={handleBulkDeleteAction}
              className="px-2.5 py-1.5 bg-rose-100/80 hover:bg-rose-600 text-rose-700 hover:text-white rounded-xl text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Trash2 size={11} />
              <span>Deletar</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* Actual Data Table list */}
      <div className={`overflow-x-auto overflow-y-auto w-full border-t border-slate-100 ${isFullscreen ? 'flex-1 max-h-[calc(100vh-220px)]' : 'max-h-[620px]'}`} id="orders-table-wrapper">
        <table className="orders-table min-w-full text-left text-xs text-slate-600 border-collapse">
          <thead className="sticky top-0 z-20 bg-slate-100/95 backdrop-blur-xs shadow-xs">
            <tr className="bg-slate-50/50 border-b border-slate-100 font-bold text-slate-400 uppercase tracking-wider select-none text-[10px]">
              {/* Row Selector Checkbox Header */}
              <th className="px-4 py-3 w-10 text-center">
                <input 
                  type="checkbox"
                  checked={isAllSelectedOnPage()}
                  onChange={handleSelectAll}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                />
              </th>

              {/* Actions shifted next to selection */}
              <th className="px-6 py-3 text-center">Ações</th>

              {/* Status column synchronized with dashboard */}
              {visibleColumns.has('Status') && (
                <th className="px-6 py-3 text-center cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={() => handleSort('Status')}>
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Status</span>
                    {sortConfig?.key === 'Status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </div>
                </th>
              )}

              {viewMode === 'simplified' ? (
                <>
                  {(visibleColumns.has('Pedido') || visibleColumns.has('Código')) && (
                    <th className="px-6 py-3 cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={() => handleSort('Código')}>
                      <div className="flex items-center gap-1.5">
                        <span>Código</span>
                        {sortConfig?.key === 'Código' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                  )}
                  {(visibleColumns.has('ProcurarPor') || visibleColumns.has('CodigoCliente')) && (
                    <th className="px-6 py-3 cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={() => handleSort('Cliente')}>
                      <div className="flex items-center gap-1.5">
                        <span>Cliente / Região</span>
                        {sortConfig?.key === 'Cliente' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                  )}
                  {visibleColumns.has('Endereco') && (
                    <th className="px-6 py-3 cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={() => handleSort('Endereço')}>
                      <div className="flex items-center gap-1.5">
                        <span>Endereço de Destino</span>
                        {sortConfig?.key === 'Endereço' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                  )}
                  {visibleColumns.has('DispositivoCondutor') && (
                    <th className="px-6 py-3">Entregador</th>
                  )}
                  {visibleColumns.has('ValorNotaFiscal') && (
                    <th className="px-6 py-3 text-right cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={() => handleSort('Valor')}>
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Valor</span>
                        {sortConfig?.key === 'Valor' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                  )}
                </>
              ) : (
                // SPREADSHEET MODE: Render active spreadsheet columns order-aware with Excel-like shifting
                columnsOrder.filter(col => visibleColumns.has(col)).map((col, idx) => {
                  const activeCols = columnsOrder.filter(c => visibleColumns.has(c));
                  return (
                    <th 
                      key={col} 
                      className="px-4 py-3 whitespace-nowrap min-w-[150px] relative group border-r border-slate-100"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 cursor-pointer select-none" onClick={() => handleSort(col)}>
                          <span className="font-extrabold text-slate-700">{COLUMN_LABELS_MAP[col] || col}</span>
                          {sortConfig?.key === col && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                        </div>
                        
                        {/* Left/Right Column movement arrows */}
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 ml-1 transition-opacity">
                          <button 
                            onClick={(e) => { e.stopPropagation(); moveColumnName(col, 'left'); }}
                            disabled={idx === 0}
                            className="p-0.5 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-20"
                            title="Mover coluna para esquerda"
                          >
                            <ArrowLeft size={10} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); moveColumnName(col, 'right'); }}
                            disabled={idx === activeCols.length - 1}
                            className="p-0.5 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-20"
                            title="Mover coluna para direita"
                          >
                            <ArrowRight size={10} />
                          </button>
                        </div>
                      </div>
                    </th>
                  );
                })
              )}
            </tr>
          </thead>
          
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            <AnimatePresence mode="popLayout">
              {paginatedOrders.length > 0 ? (
                paginatedOrders.map((order, index) => {
                  const rider = riders.find(r => r.id === order.riderId);
                  const isSelected = selectedIds.has(order.id);
                  
                  return (
                    <motion.tr
                      key={order.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={`transition-colors ${
                        isSelected 
                          ? 'bg-blue-100/60 hover:bg-blue-100/80 font-semibold' 
                          : index % 2 === 0 
                            ? 'bg-white hover:bg-slate-100/70' 
                            : 'bg-slate-50/90 hover:bg-slate-100/90'
                      }`}
                    >
                      {/* Row Selector Checkbox Cell */}
                      <td className="px-4 py-4 text-center">
                        <input 
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(order.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                        />
                      </td>

                      {/* Interactive Operational Actions: Floating Dropdown Menu */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveActionMenuId(activeActionMenuId === order.id ? null : order.id);
                            }}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer border shadow-2xs ${
                              activeActionMenuId === order.id
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-xs'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300'
                            }`}
                            title="Ações do Pedido"
                          >
                            <MoreVertical size={14} />
                          </button>

                          <AnimatePresence>
                            {activeActionMenuId === order.id && (
                              <>
                                {/* Backdrop overlay to dismiss menu on outside click */}
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveActionMenuId(null);
                                  }}
                                />

                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                  transition={{ duration: 0.12 }}
                                  className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-50 w-52 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1.5 text-left divide-y divide-slate-100/80"
                                >
                                  {/* Section 1: Visualização e Edição (Hub) */}
                                  <div className="py-1">
                                    <button
                                      onClick={() => {
                                        setActiveActionMenuId(null);
                                        openHub(order, 'crud');
                                      }}
                                      className="w-full px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2.5 transition-colors cursor-pointer"
                                    >
                                      <Edit3 size={14} className="text-blue-500" />
                                      <span>Editar / Detalhes (CRUD)</span>
                                    </button>

                                    <button
                                      onClick={() => {
                                        setActiveActionMenuId(null);
                                        openHub(order, 'timeline');
                                      }}
                                      className="w-full px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-2.5 transition-colors cursor-pointer"
                                    >
                                      <GitBranch size={14} className="text-indigo-500" />
                                      <span>Linha do Tempo</span>
                                    </button>

                                    <button
                                      onClick={() => {
                                        setActiveActionMenuId(null);
                                        openHub(order, 'history');
                                      }}
                                      className="w-full px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-teal-600 flex items-center gap-2.5 transition-colors cursor-pointer"
                                    >
                                      <History size={14} className="text-teal-500" />
                                      <span>Histórico de Auditoria</span>
                                    </button>

                                    <button
                                      onClick={() => {
                                        setActiveActionMenuId(null);
                                        openHub(order, 'protocol');
                                      }}
                                      className="w-full px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-emerald-600 flex items-center gap-2.5 transition-colors cursor-pointer"
                                    >
                                      <FileCheck2 size={14} className="text-emerald-500" />
                                      <span>Protocolo de Entrega</span>
                                    </button>
                                  </div>

                                  {/* Section 2: Comunicação Rápida */}
                                  <div className="py-1">
                                    {(() => {
                                      const contact = getOrderContactInfo(order);
                                      return contact.hasPhone ? (
                                        <a
                                          href={`tel:${contact.cleanPhoneDigits}`}
                                          onClick={() => setActiveActionMenuId(null)}
                                          className="w-full px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-emerald-600 flex items-center gap-2.5 transition-colors cursor-pointer"
                                        >
                                          <Phone size={14} className="text-emerald-500" />
                                          <div className="flex flex-col">
                                            <span>Ligar para Cliente</span>
                                            <span className="text-[10px] text-slate-400 font-mono">{contact.phone}</span>
                                          </div>
                                        </a>
                                      ) : (
                                        <div className="w-full px-3 py-2 text-xs font-medium text-slate-300 flex items-center gap-2.5 cursor-not-allowed">
                                          <Phone size={14} className="text-slate-300" />
                                          <span>Ligar (Sem telefone)</span>
                                        </div>
                                      );
                                    })()}
                                  </div>

                                  {/* Section 3: Cancelamento */}
                                  <div className="py-1">
                                    {order.status !== 'Concluído' && order.status !== 'Cancelado' ? (
                                      <button
                                        onClick={() => {
                                          setActiveActionMenuId(null);
                                          onUpdateStatus(order.id, 'Cancelado');
                                        }}
                                        className="w-full px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                                      >
                                        <Ban size={14} className="text-rose-500" />
                                        <span>Cancelar Pedido</span>
                                      </button>
                                    ) : (
                                      <div className="w-full px-3 py-2 text-xs font-medium text-slate-300 flex items-center gap-2.5 cursor-not-allowed">
                                        <Ban size={14} className="text-slate-300" />
                                        <span>Cancelar (Inativo)</span>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </td>

                      {/* Status Badge Indicator synchronized with dashboard */}
                      {visibleColumns.has('Status') && (
                        <td className="px-1 py-1 text-center whitespace-nowrap min-w-[130px]">
                          {renderStatusCellWithHealth(order.status, order.createdAt, order.date, order.history)}
                        </td>
                      )}

                      {viewMode === 'simplified' ? (
                        <>
                          {/* Order Code / ID */}
                          {(visibleColumns.has('Pedido') || visibleColumns.has('Código')) && (
                            <td className="px-6 py-4 font-mono font-bold text-slate-800">
                              {order.id}
                            </td>
                          )}

                          {/* Client information */}
                          {(visibleColumns.has('ProcurarPor') || visibleColumns.has('CodigoCliente')) && (
                            <td className="px-6 py-4">
                              <span className="block font-extrabold text-slate-800 leading-tight">{order.clientName}</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                <span className="text-[9px] text-blue-600 bg-blue-50 px-1 py-0.5 rounded font-extrabold uppercase inline-block leading-none">
                                  {order.region}
                                </span>
                                {order.partnerName && (
                                  <span className="text-[9px] text-amber-700 bg-amber-50 px-1 py-0.5 rounded font-extrabold uppercase inline-block border border-amber-100/30 leading-none">
                                    {getPartnerDisplayName(order.partnerName)}
                                  </span>
                                )}
                                {order.priority && (
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase inline-flex items-center gap-1 border leading-none ${getPriorityColor(order.priority)}`}>
                                    {order.priority.toLowerCase() === 'expresso' ? '🚨 Urgente' : order.priority}
                                  </span>
                                )}
                              </div>
                            </td>
                          )}

                          {/* Destination Address */}
                          {visibleColumns.has('Endereco') && (
                            <td className="px-6 py-4 max-w-xs" title={order.address}>
                              <span className="block text-slate-700 leading-normal text-xs font-semibold truncate max-w-[240px]">{order.address}</span>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                <button
                                  onClick={(e) => handleCopyAddressAndRoute(order, e)}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-extrabold rounded transition-all border shadow-sm cursor-pointer ${
                                    copiedOrderId === order.id 
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                                      : 'bg-blue-50/60 hover:bg-blue-50 border-blue-100 text-blue-700'
                                  }`}
                                  title="Copiar endereço e abrir rota no Google Maps"
                                >
                                  {copiedOrderId === order.id ? (
                                    <>
                                      <Check size={9} />
                                      <span>Copiado e Maps Aberto!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={9} />
                                      <span>Copiar Endereço</span>
                                    </>
                                  )}
                                </button>

                                {order.cep && (
                                  <span className="text-slate-500 font-mono bg-slate-100 px-1 py-0.2 rounded text-[9px] font-bold">
                                    CEP {order.cep}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[9px] font-bold text-slate-400">
                                <span>
                                  {order.itemsCount} {order.itemsCount === 1 ? 'item' : 'itens'}
                                </span>
                                {order.date && (
                                  <span className="text-slate-400 bg-slate-50 border border-slate-100 px-1 py-0.2 rounded">
                                    {formatToBrazilianDate(order.date)}
                                  </span>
                                )}
                              </div>
                            </td>
                          )}

                          {/* Assigned Delivery Rider */}
                          {visibleColumns.has('DispositivoCondutor') && (
                            <td className="px-6 py-4 relative">
                              {rider ? (
                                <div className="flex items-center gap-2">
                                  <img
                                    src={rider.avatar}
                                    alt={rider.name}
                                    className="w-6 h-6 rounded-full object-cover border border-slate-100"
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="text-left">
                                    <span className="block font-bold text-slate-700 text-[11px] leading-tight">{rider.name}</span>
                                    <span className="text-[9px] text-slate-400 font-medium">{rider.vehicle}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="relative">
                                  <button
                                    onClick={() => setShowRiderDropdown(showRiderDropdown === order.id ? null : order.id)}
                                    className="px-2 py-1 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-500 rounded-lg text-[10px] font-bold border border-slate-200/50 flex items-center gap-1 cursor-pointer transition-colors"
                                    id={`assign-rider-btn-${order.id}`}
                                  >
                                    <UserCheck size={11} />
                                    <span>Vincular</span>
                                    <ChevronDown size={9} />
                                  </button>

                                  {showRiderDropdown === order.id && (
                                    <div className="absolute left-0 mt-1.5 w-48 bg-white border border-slate-100 rounded-xl shadow-xl py-1 z-50 max-h-48 overflow-y-auto">
                                      <div className="px-2.5 py-1 border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                        Selecione um Entregador
                                      </div>
                                      {riders
                                        .filter(r => r.status === 'Disponível' || r.status === 'Em rota')
                                        .map(availRider => (
                                          <button
                                            key={availRider.id}
                                            onClick={() => {
                                              onAssignRider(order.id, availRider.id);
                                              setShowRiderDropdown(null);
                                            }}
                                            className="w-full text-left px-3 py-1.5 hover:bg-blue-50/50 text-[11px] flex items-center gap-2 cursor-pointer font-semibold text-slate-700"
                                          >
                                            <img src={availRider.avatar} className="w-5 h-5 rounded-full object-cover" />
                                            <div className="truncate">
                                              <p className="font-bold leading-none">{availRider.name}</p>
                                              <p className="text-[9px] text-slate-400 mt-0.5">{availRider.vehicle} • {availRider.status}</p>
                                            </div>
                                          </button>
                                        ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          )}

                          {/* Order Pricing/Value */}
                          {visibleColumns.has('ValorNotaFiscal') && (
                            <td className="px-6 py-4 text-right font-mono font-bold text-slate-800 text-xs">
                              {order.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                          )}
                        </>
                      ) : (
                        // SPREADSHEET MODE ROWS: Display dynamic values mapping active spreadsheet columns
                        columnsOrder.filter(col => visibleColumns.has(col)).map((col) => {
                          const globalRowIndex = (currentPage - 1) * itemsPerPage + index + 1;
                          const cellVal = getOrderColumnValue(order, col, globalRowIndex);
                          const isSpecial = col === 'Pedido' || col === 'ProcurarPor' || col === 'ValorNotaFiscal';
                          
                          if (col === 'Status') {
                            return (
                              <td key={col} className="px-1 py-1 border-r border-slate-50 text-center whitespace-nowrap min-w-[130px]">
                                {renderStatusCellWithHealth(order.status, order.createdAt, order.date, order.history)}
                              </td>
                            );
                          }

                          if (col === 'Prioridade') {
                            const isExpress = String(cellVal || '').toLowerCase() === 'expresso';
                            return (
                              <td key={col} className="px-4 py-3 border-r border-slate-50 text-center whitespace-nowrap min-w-[120px]">
                                <span className={`px-2 py-1 text-[10px] rounded-xl border font-black uppercase inline-flex items-center gap-1 ${getPriorityColor(cellVal)}`}>
                                  {isExpress ? '🚨 Urgente' : cellVal}
                                </span>
                              </td>
                            );
                          }

                          if (col === 'Endereco') {
                            return (
                              <td 
                                key={col} 
                                className="px-4 py-3 border-r border-slate-50 font-medium max-w-[200px] text-[11px] text-slate-600 relative group"
                                title={cellVal}
                              >
                                <div className="flex items-center justify-between gap-1.5 min-w-0">
                                  <span className="truncate flex-1">{cellVal}</span>
                                  <button
                                    onClick={(e) => handleCopyAddressAndRoute(order, e)}
                                    className={`opacity-0 group-hover:opacity-100 focus:opacity-100 inline-flex items-center justify-center p-1 rounded border shadow-sm transition-all shrink-0 cursor-pointer ${
                                      copiedOrderId === order.id 
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 opacity-100' 
                                        : 'bg-blue-50 hover:bg-blue-100 border-blue-100 text-blue-700'
                                    }`}
                                    title="Copiar endereço e abrir rota"
                                  >
                                    {copiedOrderId === order.id ? (
                                      <Check size={10} />
                                    ) : (
                                      <Copy size={10} />
                                    )}
                                  </button>
                                </div>
                              </td>
                            );
                          }

                          return (
                            <td 
                              key={col} 
                              className={`px-4 py-3 border-r border-slate-50 font-medium truncate max-w-[200px] text-[11px] ${
                                isSpecial ? 'font-bold text-slate-900' : 'text-slate-600'
                              }`}
                              title={cellVal}
                            >
                              {col === 'ValorNotaFiscal' || col === 'ValorReceber' || col === 'ValorCondutor' || col === 'ValorEntrega' ? (
                                isNaN(parseFloat(cellVal)) ? cellVal : `R$ ${parseFloat(cellVal).toFixed(2).replace('.', ',')}`
                              ) : (
                                cellVal
                              )}
                            </td>
                          );
                        })
                      )}
                    </motion.tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={viewMode === 'simplified' ? 8 : columnsOrder.length + 3} className="px-6 py-12 text-center text-slate-400 text-xs font-semibold">
                    Nenhum pedido encontrado com os filtros selecionados.
                  </td>
                </tr>
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Pagination controls footer */}
      <div className="p-3 sm:p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50" id="orders-pagination">
        <div className="flex flex-wrap items-center gap-3">
          {(() => {
            const startRecord = filteredOrders.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
            const endRecord = Math.min(currentPage * itemsPerPage, filteredOrders.length);
            return (
              <span className="text-xs text-slate-500 font-medium">
                Exibindo <strong className="text-slate-800 font-extrabold">{startRecord}–{endRecord}</strong> de <strong className="text-slate-800 font-extrabold">{filteredOrders.length}</strong> pedidos
                {totalPages > 1 && (
                  <span className="ml-1 text-slate-400 font-normal">
                    (Pág. <strong className="text-slate-700 font-bold">{currentPage}</strong> de {totalPages})
                  </span>
                )}
              </span>
            );
          })()}

          {/* Items per page selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold border-l border-slate-200 pl-3">
            <span>Por página:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-extrabold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs hover:border-slate-300 transition-colors"
            >
              <option value={25}>25 por pág.</option>
              <option value={50}>50 por pág. (Padrão)</option>
              <option value={100}>100 por pág.</option>
              <option value={200}>200 por pág.</option>
              <option value={500}>500 por pág.</option>
              <option value={999999}>Todos ({filteredOrders.length})</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap justify-end" id="pagination-buttons">
          {/* Primeiras páginas / Primeira pág */}
          <button
            onClick={() => setPage(1)}
            disabled={currentPage === 1}
            className={`p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer transition-colors ${
              currentPage === 1 ? 'opacity-30 cursor-not-allowed' : ''
            }`}
            id="orders-first-page"
            title="Primeira Página"
          >
            <ChevronsLeft size={14} />
          </button>

          <button
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage === 1}
            className={`p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer transition-colors ${
              currentPage === 1 ? 'opacity-30 cursor-not-allowed' : ''
            }`}
            id="orders-prev-page"
            title="Página Anterior"
          >
            <ChevronLeft size={14} />
          </button>
          
          <div className="flex items-center gap-1 text-xs font-bold">
            {Array.from({ length: totalPages }).slice(
              Math.max(0, Math.min(currentPage - 3, totalPages - 5)),
              Math.min(totalPages, Math.max(5, currentPage + 2))
            ).map((_, idx) => {
              const startIdx = Math.max(0, Math.min(currentPage - 3, totalPages - 5));
              const pageNum = startIdx + idx + 1;
              if (pageNum > totalPages) return null;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`min-w-7 h-7 px-1.5 rounded-lg border flex items-center justify-center cursor-pointer transition-all text-xs ${
                    currentPage === pageNum
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-black'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-100 bg-white'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage === totalPages || totalPages === 0}
            className={`p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer transition-colors ${
              currentPage === totalPages || totalPages === 0 ? 'opacity-30 cursor-not-allowed' : ''
            }`}
            id="orders-next-page"
            title="Próxima Página"
          >
            <ChevronRight size={14} />
          </button>

          <button
            onClick={() => setPage(totalPages)}
            disabled={currentPage === totalPages || totalPages === 0}
            className={`p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer transition-colors ${
              currentPage === totalPages || totalPages === 0 ? 'opacity-30 cursor-not-allowed' : ''
            }`}
            id="orders-last-page"
            title="Última Página"
          >
            <ChevronsRight size={14} />
          </button>
        </div>
      </div>
      </div> {/* Close inner card container */}

      {/* --- CONSOLIDATED OPERATIONAL ORDER HUB MODAL (CRUD, Timeline, History, Protocol) --- */}
      <AnimatePresence>
        {hubModalOpen && hubOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" id="hub-modal-overlay">
            {/* Backdrop blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setHubModalOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* Core Dialog Container */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden relative z-50 border border-slate-100"
              id="hub-dialog-panel"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                    <Settings2 size={18} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                      <span>Pedido #{hubOrder.id}</span>
                      <span className={`text-[10px] px-2 py-0.5 border rounded-full font-bold ${getStatusClasses(hubOrder.status)}`}>
                        {hubOrder.status}
                      </span>
                    </h3>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                      Central de Gestão, Triagem e Liquidação do Pedido
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => setHubModalOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Grid content containing Tabs and Panel */}
              <div className="flex-1 flex overflow-hidden min-h-[300px]">
                {/* Left Tabs Menu */}
                <div className="w-56 bg-slate-50 border-r border-slate-100 p-4 space-y-1.5 shrink-0 flex flex-col justify-between overflow-y-auto">
                  <div className="space-y-1">
                    <button
                      onClick={() => { setHubTab('crud'); setIsEditingInHub(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        hubTab === 'crud' 
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-50' 
                          : 'text-slate-600 hover:bg-slate-200/50'
                      }`}
                    >
                      <Edit3 size={14} />
                      <span>Ficha do Pedido</span>
                    </button>

                    <button
                      onClick={() => setHubTab('timeline')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        hubTab === 'timeline' 
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-50' 
                          : 'text-slate-600 hover:bg-slate-200/50'
                      }`}
                    >
                      <GitBranch size={14} />
                      <span>Linha do Tempo</span>
                    </button>

                    <button
                      onClick={() => setHubTab('history')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        hubTab === 'history' 
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-50' 
                          : 'text-slate-600 hover:bg-slate-200/50'
                      }`}
                    >
                      <History size={14} />
                      <span>Log de Auditoria</span>
                    </button>

                    <button
                      onClick={() => setHubTab('protocol')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        hubTab === 'protocol' 
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-50' 
                          : 'text-slate-600 hover:bg-slate-200/50'
                      }`}
                    >
                      <FileCheck2 size={14} />
                      <span>Protocolo de Entrega</span>
                    </button>

                    <button
                      onClick={() => setHubTab('notificacao')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        hubTab === 'notificacao' 
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-50' 
                          : 'text-slate-600 hover:bg-slate-200/50'
                      }`}
                    >
                      <MessageSquare size={14} />
                      <span>Notificação do Cliente</span>
                    </button>
                  </div>

                  {/* Danger zone delete button */}
                  <button
                    onClick={handleDeleteHubOrder}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-100 text-xs font-bold transition-all cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Excluir Pedido</span>
                  </button>
                </div>

                {/* Right Interactive Content Display Panel */}
                <div className="flex-1 p-6 overflow-y-auto bg-white" id="hub-content-container">
                  
                  {/* TAB 1: CRUD & EXCEL DATA FORM */}
                  {hubTab === 'crud' && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-sm">Dados Cadastrais e Faturamento</h4>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                            Estrutura completa das 30 colunas do Excel
                          </p>
                        </div>
                        <button
                          onClick={() => setIsEditingInHub(!isEditingInHub)}
                          className="px-3 py-1.5 bg-slate-50 border border-slate-200 hover:bg-blue-50 hover:text-blue-600 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          {isEditingInHub ? <Eye size={13} /> : <Edit3 size={13} />}
                          <span>{isEditingInHub ? 'Cancelar Edição' : 'Editar Ficha'}</span>
                        </button>
                      </div>

                      {hubOrder.status === 'Concluído' && (
                        <div className="bg-emerald-50 border border-emerald-100 p-3.5 rounded-2xl flex items-start gap-3 text-emerald-800" id="manual-baixa-edit-notice">
                          <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />
                          <div className="text-xs font-semibold">
                            <p className="font-bold">Baixa Manual Realizada - Edição Liberada</p>
                            <p className="text-[11px] text-emerald-700/85 mt-0.5 leading-normal">
                              Este pedido já foi baixado (concluído). Você pode clicar em <strong>Editar Ficha</strong> para modificar qualquer dado cadastral ou campo de faturamento se for necessário efetuar correções.
                            </p>
                          </div>
                        </div>
                      )}

                      {isEditingInHub ? (
                        /* EDIT MODE FORM */
                        <div className="space-y-5">
                          {/* Standard high-level fields */}
                          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-4">
                            <h5 className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Dados Básicos Operacionais</h5>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Cliente Destinatário</label>
                                <input
                                  type="text"
                                  value={editStandardFields.clientName}
                                  onChange={(e) => setEditStandardFields({ ...editStandardFields, clientName: e.target.value })}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                                />
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Telefone</label>
                                  {(() => {
                                    if (!hubOrder) return null;
                                    const contact = getOrderContactInfo(hubOrder);
                                    if (contact.hasPhone) {
                                      return (
                                        <a
                                          href={`tel:${contact.cleanPhoneDigits}`}
                                          className="text-[10px] text-indigo-600 hover:text-indigo-700 font-extrabold flex items-center gap-1 hover:underline cursor-pointer"
                                          title="Ligar agora para o cliente"
                                        >
                                          <Phone size={10} />
                                          <span>Ligar agora</span>
                                        </a>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                                <input
                                  type="text"
                                  value={editStandardFields.phone}
                                  onChange={(e) => setEditStandardFields({ ...editStandardFields, phone: e.target.value })}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Região / Zona</label>
                                <select
                                  value={editStandardFields.region}
                                  onChange={(e) => setEditStandardFields({ ...editStandardFields, region: e.target.value })}
                                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                                >
                                  {['Centro', 'Zona Sul', 'Zona Oeste', 'Zona Norte', 'Zona Leste'].map(r => (
                                    <option key={r} value={r}>{r}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Prioridade</label>
                                <select
                                  value={editStandardFields.priority}
                                  onChange={(e) => setEditStandardFields({ ...editStandardFields, priority: e.target.value as any })}
                                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                                >
                                  {['Baixa', 'Média', 'Alta'].map(p => (
                                    <option key={p} value={p}>{p}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Data do Pedido</label>
                                <input
                                  type="date"
                                  value={editStandardFields.date}
                                  onChange={(e) => setEditStandardFields({ ...editStandardFields, date: e.target.value })}
                                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                                />
                              </div>
                            </div>

                            {/* CEP & Address Geocoding Auto-Fill Section */}
                            <div className="pt-2 border-t border-slate-200/60 space-y-3">
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider flex items-center gap-1">
                                  <MapPin size={12} />
                                  <span>Autopreencher por CEP & Geocodificar</span>
                                </label>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const targetCep = editStandardFields.cep || editForm['CEP'] || '';
                                    const cleanCep = targetCep.replace(/\D/g, '');
                                    if (cleanCep.length !== 8) {
                                      alert('Digite um CEP de 8 dígitos para geocodificar.');
                                      return;
                                    }
                                    try {
                                      const res = await fetchAddressAndGeocodeByCep(cleanCep);
                                      setEditStandardFields({
                                        ...editStandardFields,
                                        cep: res.formattedCep,
                                        address: res.address,
                                        region: res.region
                                      });
                                      setEditForm({
                                        ...editForm,
                                        'CEP': res.formattedCep,
                                        'Endereco': res.address,
                                        'CidadeMunicipio': res.localidade,
                                        'Estado': res.uf,
                                        'Latitude': String(res.lat),
                                        'Longitude': String(res.lng)
                                      });
                                      alert(`✓ CEP e Coordenadas Atualizados!\nEndereço: ${res.address}\nLat: ${res.lat.toFixed(6)}, Lng: ${res.lng.toFixed(6)}`);
                                    } catch (err: any) {
                                      alert('Erro ao geocodificar CEP: ' + (err.message || err));
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-extrabold transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                                >
                                  <RefreshCw size={11} />
                                  <span>Geocodificar CEP Agora</span>
                                </button>
                              </div>

                              <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">CEP *</label>
                                  <input
                                    type="text"
                                    placeholder="Ex: 01310-100"
                                    value={editStandardFields.cep}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditStandardFields({ ...editStandardFields, cep: val });
                                      setEditForm({ ...editForm, 'CEP': val });
                                    }}
                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800"
                                  />
                                </div>
                                <div className="col-span-2 space-y-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Endereço de Entrega</label>
                                  <input
                                    type="text"
                                    placeholder="Endereço obtido via API..."
                                    value={editStandardFields.address}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditStandardFields({ ...editStandardFields, address: val });
                                      setEditForm({ ...editForm, 'Endereco': val });
                                    }}
                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* All 30 spreadsheet columns form fields */}
                          <div className="space-y-4">
                            <h5 className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Campos Completos da Planilha</h5>
                            
                            <div className="grid grid-cols-3 gap-4">
                              {ALL_SPREADSHEET_COLUMNS.map((col) => (
                                <div key={col} className="space-y-1 border border-slate-100 p-2.5 rounded-xl bg-white">
                                  <label className="text-[9px] font-extrabold text-slate-400 block truncate" title={col}>
                                    {col}
                                  </label>
                                  <input
                                    type="text"
                                    value={editForm[col] || ''}
                                    onChange={(e) => setEditForm({ ...editForm, [col]: e.target.value })}
                                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Submit button inside form */}
                          <div className="flex justify-end pt-3">
                            <button
                              onClick={handleSaveHubEdit}
                              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-50 flex items-center gap-1.5 transition-colors cursor-pointer font-extrabold"
                            >
                              <Save size={14} />
                              <span>Salvar Alterações</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* READ-ONLY CARD GRID DISPLAY */
                        <div className="space-y-6">
                          {/* Standard visual fields cards */}
                          <div className="grid grid-cols-4 gap-4">
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Código Interno</span>
                              <span className="block font-mono font-bold text-slate-800 text-sm mt-0.5">{hubOrder.id}</span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Cliente Destino</span>
                              <span className="block font-bold text-slate-800 text-xs mt-0.5 truncate">{hubOrder.clientName}</span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Região Logística</span>
                              <span className="block font-bold text-slate-800 text-xs mt-0.5">{hubOrder.region}</span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Valor do Faturamento</span>
                              <span className="block font-mono font-bold text-emerald-600 text-xs mt-0.5">
                                {hubOrder.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            </div>
                          </div>

                          {/* Spreadsheet grid details */}
                          <div className="space-y-3">
                            <h5 className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider border-b border-slate-100 pb-1.5">
                              Visualização Fiel de Colunas Excel
                            </h5>
                            
                            <div className="grid grid-cols-3 gap-3.5">
                              {ALL_SPREADSHEET_COLUMNS.map((col) => {
                                const val = getOrderColumnValue(hubOrder, col);
                                return (
                                  <div key={col} className="p-2.5 bg-slate-50/50 rounded-xl border border-slate-100 flex items-center justify-between">
                                    <div className="truncate pr-2">
                                      <span className="text-[8px] font-extrabold text-slate-400 uppercase block tracking-wider truncate" title={col}>
                                        {col}
                                      </span>
                                      <span className="font-bold text-slate-700 text-xs mt-0.5 truncate block" title={val || 'Nenhum'}>
                                        {val || <span className="text-slate-300 italic">Vazio</span>}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: ACTIVE WORKFLOW TIMELINE */}
                  {hubTab === 'timeline' && (
                    <div className="space-y-6">
                      <div className="border-b border-slate-100 pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <h4 className="font-extrabold text-slate-800 text-sm">Linha do Tempo Operacional</h4>
                            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                              Rastreamento de despacho em tempo real
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-[10px] uppercase tracking-wider">
                              Parceiro: <span className="font-extrabold">{getPartnerDisplayName(hubOrder.partnerName)}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-100 text-amber-700 font-bold text-[10px] uppercase tracking-wider">
                              Cliente: <span className="font-extrabold">{hubOrder.clientName}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Timeline Workflow Visualizer */}
                      <div className="relative pl-8 space-y-8 py-4">
                        
                        {/* Connecting Line */}
                        <div className="absolute left-3.5 top-5 bottom-5 w-0.5 bg-slate-100" />

                        {/* Step 1: Triagem */}
                        <div className="relative flex gap-4">
                          <div className="absolute -left-7.5 w-7 h-7 rounded-full bg-emerald-50 border-2 border-emerald-500 flex items-center justify-center text-emerald-600 z-10 bg-white shadow-sm">
                            <CheckCircle2 size={13} />
                          </div>
                          <div>
                            <h5 className="font-bold text-slate-800 text-xs">Triagem e Entrada Realizada</h5>
                            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                              {getTimelineStepTime(1) ? `Registrado em ${getTimelineStepTime(1)}` : `Disparado em ${formatToBrazilianDate(hubOrder.date)}`}
                            </p>
                            <p className="text-xs text-slate-500 mt-1 max-w-md">
                              Pedido recebido e catalogado na plataforma de <strong className="text-slate-700 font-bold">{getPartnerDisplayName(hubOrder.partnerName)}</strong> para entrega ao destinatário <strong className="text-slate-700 font-bold">{hubOrder.clientName}</strong>.
                            </p>
                          </div>
                        </div>

                        {/* Step 2: Condução / Vínculo */}
                        <div className="relative flex gap-4">
                          <div className={`absolute -left-7.5 w-7 h-7 rounded-full flex items-center justify-center z-10 bg-white shadow-sm border-2 ${
                            hubOrder.riderId 
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-600' 
                              : 'bg-slate-50 border-slate-300 text-slate-400 animate-pulse'
                          }`}>
                            {hubOrder.riderId ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                          </div>
                          <div>
                            <h5 className="font-bold text-slate-800 text-xs">Vinculação de Condutor</h5>
                            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                              {hubOrder.riderId 
                                ? `Vinculado em ${getTimelineStepTime(2) || formatToBrazilianDate(hubOrder.date)}` 
                                : 'Aguardando ação de despacho'
                              }
                            </p>
                            <p className="text-xs text-slate-500 mt-1 max-w-md">
                              {hubOrder.riderId ? (
                                <>
                                  O entregador <strong className="text-slate-700">{riders.find(r => r.id === hubOrder.riderId)?.name}</strong> foi designado e aceitou a solicitação para coletar o pedido na unidade do parceiro <strong className="text-slate-700 font-bold">{getPartnerDisplayName(hubOrder.partnerName)}</strong>.
                                </>
                              ) : (
                                `Aguardando operador selecionar um entregador para coletar no parceiro ${getPartnerDisplayName(hubOrder.partnerName)}.`
                              )}
                            </p>
                          </div>
                        </div>

                         {/* Step 3: Em Rota */}
                         {(() => {
                           const isActive = hubOrder.status === 'Em rota' || hubOrder.status === 'Entregando' || hubOrder.status === 'Concluído';
                           const stepTime = getTimelineStepTime(3);
                           return (
                             <div className="relative flex gap-4">
                               <div className={`absolute -left-7.5 w-7 h-7 rounded-full flex items-center justify-center z-10 bg-white shadow-sm border-2 ${
                                 isActive 
                                   ? 'bg-emerald-50 border-emerald-500 text-emerald-600' 
                                   : 'bg-slate-50 border-slate-300 text-slate-400'
                               }`}>
                                 {isActive ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                               </div>
                               <div>
                                 <h5 className="font-bold text-slate-800 text-xs">Despachado / Em Rota</h5>
                                 {isActive && stepTime && (
                                   <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Iniciado em {stepTime}</p>
                                 )}
                                 <p className="text-xs text-slate-500 mt-1 max-w-md">
                                   {isActive ? (
                                     <>
                                       O entregador iniciou o trajeto do parceiro <strong className="text-slate-700 font-bold">{getPartnerDisplayName(hubOrder.partnerName)}</strong> em direção ao endereço de <strong className="text-slate-700 font-bold">{hubOrder.clientName}</strong> portando as vias fiscais.
                                     </>
                                   ) : (
                                     `Aguardando saída da base do parceiro ${getPartnerDisplayName(hubOrder.partnerName)}.`
                                   )}
                                 </p>
                               </div>
                             </div>
                           );
                         })()}
 
                         {/* Step 4: No local de entrega */}
                         {(() => {
                           const isActive = hubOrder.status === 'Entregando' || hubOrder.status === 'Concluído';
                           const stepTime = getTimelineStepTime(4);
                           return (
                             <div className="relative flex gap-4">
                               <div className={`absolute -left-7.5 w-7 h-7 rounded-full flex items-center justify-center z-10 bg-white shadow-sm border-2 ${
                                 isActive 
                                   ? 'bg-emerald-50 border-emerald-500 text-emerald-600' 
                                   : 'bg-slate-50 border-slate-300 text-slate-400'
                               }`}>
                                 {isActive ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                               </div>
                               <div>
                                 <h5 className="font-bold text-slate-800 text-xs">Em Trânsito Final (Entregando)</h5>
                                 {isActive && stepTime && (
                                   <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Chegada em {stepTime}</p>
                                 )}
                                 <p className="text-xs text-slate-500 mt-1 max-w-md">
                                   {isActive ? (
                                     <>
                                       Entregador nas imediações do endereço de <strong className="text-slate-700 font-bold">{hubOrder.clientName}</strong> realizando contato com o recebedor.
                                     </>
                                   ) : (
                                     `Aguardando aproximação geográfica ao endereço de ${hubOrder.clientName}.`
                                   )}
                                 </p>
                               </div>
                             </div>
                           );
                         })()}
 
                         {/* Step 5: Conclusão / Liquidação */}
                         {(() => {
                           const isFinished = hubOrder.status === 'Concluído' || hubOrder.status === 'Cancelado' || hubOrder.status === 'Ocorrência';
                           const stepTime = getTimelineStepTime(5);
                           return (
                             <div className="relative flex gap-4">
                               <div className={`absolute -left-7.5 w-7 h-7 rounded-full flex items-center justify-center z-10 bg-white shadow-sm border-2 ${
                                 hubOrder.status === 'Concluído' 
                                   ? 'bg-emerald-50 border-emerald-500 text-emerald-600' 
                                   : hubOrder.status === 'Cancelado'
                                   ? 'bg-rose-50 border-rose-500 text-rose-600'
                                   : hubOrder.status === 'Ocorrência'
                                   ? 'bg-amber-50 border-amber-500 text-amber-600 animate-bounce'
                                   : 'bg-slate-50 border-slate-300 text-slate-400'
                               }`}>
                                 {hubOrder.status === 'Concluído' ? <CheckCircle2 size={13} /> : 
                                  hubOrder.status === 'Cancelado' ? <XCircle size={13} /> :
                                  hubOrder.status === 'Ocorrência' ? <AlertTriangle size={13} /> : <Clock size={13} />}
                               </div>
                               <div>
                                 <h5 className="font-bold text-slate-800 text-xs">Conclusão / Protocolo</h5>
                                 {isFinished && stepTime && (
                                   <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Finalizado em {stepTime}</p>
                                 )}
                                 <p className="text-xs text-slate-500 mt-1 max-w-md">
                                   {hubOrder.status === 'Concluído' ? (
                                     <>
                                       Liquidação concluída do pedido do parceiro <strong className="text-slate-700 font-bold">{getPartnerDisplayName(hubOrder.partnerName)}</strong>. O recebedor <strong className="text-slate-700 font-bold">{hubOrder.clientName}</strong> assinou o recibo do protocolo de entrega.
                                     </>
                                   ) : hubOrder.status === 'Cancelado' ? (
                                     <>
                                       O pedido do parceiro <strong className="text-slate-700 font-bold">{getPartnerDisplayName(hubOrder.partnerName)}</strong> destinado a <strong className="text-slate-700 font-bold">{hubOrder.clientName}</strong> foi cancelado pela central de atendimento.
                                     </>
                                   ) : hubOrder.status === 'Ocorrência' ? (
                                     <>
                                       Impossibilidade de entrega ao destinatário <strong className="text-slate-700 font-bold">{hubOrder.clientName}</strong> do pedido de <strong className="text-slate-700 font-bold">{getPartnerDisplayName(hubOrder.partnerName)}</strong>. Ocorrência em tratativa operacional.
                                     </>
                                   ) : (
                                     `Aguardando entrega final e assinatura física/digital do destinatário ${hubOrder.clientName}.`
                                   )}
                                 </p>
                               </div>
                             </div>
                           );
                         })()}

                      </div>
                    </div>
                  )}

                  {/* TAB 3: AUDIT LOG & ALTERATION HISTORY */}
                  {hubTab === 'history' && (
                    <div className="space-y-6">
                      <div className="border-b border-slate-100 pb-3">
                        <h4 className="font-extrabold text-slate-800 text-sm">Histórico de Alterações do Pedido</h4>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                          Trilha de auditoria operacional em conformidade com as ações rápidas
                        </p>
                      </div>

                      <div className="space-y-3.5">
                        {hubOrder.history && hubOrder.history.length > 0 ? (
                          hubOrder.history.map((log, idx) => (
                            <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100/60 flex items-start justify-between gap-4">
                              <div className="space-y-1">
                                <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full inline-block">
                                  {log.action}
                                </span>
                                <p className="text-xs font-bold text-slate-700 mt-1">{log.details || 'Nenhum detalhe fornecido.'}</p>
                                <p className="text-[10px] text-slate-400 font-semibold">Responsável: {log.user}</p>
                              </div>
                              <span className="text-[10px] font-mono text-slate-400 font-bold whitespace-nowrap">
                                {log.timestamp}
                              </span>
                            </div>
                          ))
                        ) : (
                          // Fallback mock history
                          <div className="space-y-3">
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/60 flex items-start justify-between gap-4">
                              <div className="space-y-1">
                                <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full inline-block">
                                  Pedido Importado
                                </span>
                                <p className="text-xs font-bold text-slate-700 mt-1">
                                  Importado automaticamente via planilha de faturamento operacional.
                                </p>
                                <p className="text-[10px] text-slate-400 font-semibold">Responsável: Sistema (Planilha)</p>
                              </div>
                              <span className="text-[10px] font-mono text-slate-400 font-bold whitespace-nowrap">
                                {formatToBrazilianDate(hubOrder.date) || getSaoPauloDate()} 15:30
                              </span>
                            </div>

                            {hubOrder.riderId && (
                              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/60 flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                  <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full inline-block">
                                    Condutor Vinculado
                                  </span>
                                  <p className="text-xs font-bold text-slate-700 mt-1">
                                    Entregador {riders.find(r => r.id === hubOrder.riderId)?.name} alocado para despacho geográfico.
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-semibold">Responsável: Operador Vinimap</p>
                                </div>
                                <span className="text-[10px] font-mono text-slate-400 font-bold whitespace-nowrap">
                                  {formatToBrazilianDate(hubOrder.date) || getSaoPauloDate()} 16:10
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: HIGH FIDELITY DELIVERY PROTOCOL */}
                  {hubTab === 'protocol' && (
                    <div className="space-y-6">
                      
                      {/* Interactive Action Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-sm">Protocolo Digital de Liquidação</h4>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                            Comprovante formal de recebimento e entrega física
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Export PDF Button */}
                          <button
                            onClick={exportSingleProtocolPDF}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm border border-slate-200"
                            title="Exportar como PDF"
                          >
                            <DownloadCloud size={13} />
                            <span>Exportar (PDF)</span>
                          </button>

                          {/* Toggle Edit Button */}
                          <button
                            onClick={() => setIsEditingProtocol(!isEditingProtocol)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm border ${
                              isEditingProtocol 
                                ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600' 
                                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            {isEditingProtocol ? (
                              <>
                                <Save size={13} />
                                <span>Visualizar</span>
                              </>
                            ) : (
                              <>
                                <Edit3 size={13} />
                                <span>Editar Informações</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {hubOrder.status !== 'Concluído' && (
                        <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-start gap-3 text-amber-800">
                          <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-600" />
                          <div className="text-xs font-semibold">
                            <p className="font-bold">Atenção: Pedido pendente de liquidação</p>
                            <p className="text-[11px] text-amber-700/85 mt-0.5 leading-normal">
                              Você pode editar os campos informativos diretamente e assinar digitalmente para homologar a entrega formal do pacote.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Official Voucher Layout Container */}
                      <div className="protocolo-card-container bg-white border-2 border-dashed border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 relative overflow-hidden">
                        
                        {/* Decorative background stamps */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] rotate-12 pointer-events-none select-none text-center">
                          <CheckCircle2 size={380} className="text-slate-900 mx-auto" />
                          <p className="text-4xl font-extrabold font-mono mt-4 tracking-widest text-slate-900">
                            {hubOrder.status === 'Concluído' ? 'CONCLUÍDO' : hubOrder.status === 'Cancelado' ? 'CANCELADO' : hubOrder.status === 'Ocorrência' ? 'OCORRÊNCIA' : 'PENDENTE'}
                          </p>
                        </div>

                        {/* Top Header of Voucher */}
                        <div className="flex items-start justify-between border-b border-slate-100 pb-4 relative z-10">
                          <div className="space-y-1">
                            <span className="text-[9px] font-extrabold tracking-widest text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded-full">
                              VOUCHER DE COMPROVAÇÃO LOGÍSTICA
                            </span>
                            <h3 className="font-extrabold text-slate-800 text-base">Vinimap Logistics OS</h3>
                            <p className="text-[10px] text-slate-400 font-semibold uppercase">ID DO PEDIDO: {hubOrder.id}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-mono font-extrabold text-slate-500 bg-slate-100 px-3 py-1 rounded-xl">
                              {hubOrder.protocolNumber || 'PROT-X912A'}
                            </span>
                            <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Status: {hubOrder.status}</p>
                          </div>
                        </div>

                        {/* Split columns for voucher details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                          
                          {/* Column Left: Dados Cadastrais & Datas */}
                          <div className="space-y-5">
                            
                            {/* Section: Parceiro e Destino */}
                            <div className="space-y-3">
                              <h5 className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1">
                                <span>1. Informações de Origem e Destino</span>
                              </h5>

                              <div className="grid grid-cols-1 gap-2.5">
                                {/* Partner Client Name */}
                                <div className="space-y-0.5">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase">Cliente Parceiro (Estabelecimento)</label>
                                  {isEditingProtocol ? (
                                    <input
                                      type="text"
                                      value={protocolPartnerName}
                                      onChange={(e) => setProtocolPartnerName(e.target.value)}
                                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      placeholder="Nome do estabelecimento"
                                    />
                                  ) : (
                                    <p className="text-xs font-bold text-slate-700">{protocolPartnerName}</p>
                                  )}
                                </div>

                                {/* Destinatário */}
                                <div className="space-y-0.5">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase">Destinatário Final</label>
                                  <p className="text-xs font-bold text-slate-700">{hubOrder.clientName}</p>
                                </div>

                                {/* Endereço */}
                                <div className="space-y-0.5">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase">Endereço de Entrega</label>
                                  <p className="text-xs font-bold text-slate-700 leading-normal">{hubOrder.address}</p>
                                  <p className="text-[10px] font-semibold text-slate-400">CEP: {hubOrder.cep || '01310-100'}</p>
                                </div>
                              </div>
                            </div>

                            {/* Section: Datas e Horários */}
                            <div className="space-y-3">
                              <h5 className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1">
                                <span>2. Controle de Datas e Horários</span>
                              </h5>

                              <div className="grid grid-cols-2 gap-3">
                                {/* Order Date */}
                                <div className="space-y-0.5">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase">Data de Emissão</label>
                                  {isEditingProtocol ? (
                                    <input
                                      type="date"
                                      value={protocolOrderDate}
                                      onChange={(e) => setProtocolOrderDate(e.target.value)}
                                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:bg-white"
                                    />
                                  ) : (
                                    <p className="text-xs font-bold text-slate-700">{formatToBrazilianDate(protocolOrderDate)}</p>
                                  )}
                                </div>

                                {/* Order Time */}
                                <div className="space-y-0.5">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase">Horário de Abertura</label>
                                  {isEditingProtocol ? (
                                    <input
                                      type="text"
                                      value={protocolOrderTime}
                                      onChange={(e) => setProtocolOrderTime(e.target.value)}
                                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:bg-white"
                                      placeholder="Ex: 11:15"
                                    />
                                  ) : (
                                    <p className="text-xs font-bold text-slate-700">{protocolOrderTime}</p>
                                  )}
                                </div>

                                {/* Delivery Date */}
                                <div className="space-y-0.5">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase">Data de Entrega</label>
                                  {isEditingProtocol ? (
                                    <input
                                      type="date"
                                      value={protocolDeliveryDate}
                                      onChange={(e) => setProtocolDeliveryDate(e.target.value)}
                                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:bg-white"
                                    />
                                  ) : (
                                    <p className="text-xs font-bold text-slate-700">
                                      {protocolDeliveryDate ? formatToBrazilianDate(protocolDeliveryDate) : 'Aguardando Entrega'}
                                    </p>
                                  )}
                                </div>

                                {/* Delivery Time */}
                                <div className="space-y-0.5">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase">Hora de Entrega</label>
                                  {isEditingProtocol ? (
                                    <input
                                      type="text"
                                      value={protocolDeliveryTime}
                                      onChange={(e) => setProtocolDeliveryTime(e.target.value)}
                                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:bg-white"
                                      placeholder="Ex: 16:45"
                                    />
                                  ) : (
                                    <p className="text-xs font-bold text-slate-700">{protocolDeliveryTime || 'Aguardando Entrega'}</p>
                                  )}
                                </div>
                              </div>
                            </div>

                          </div>

                          {/* Column Right: Recebedor & Assinatura */}
                          <div className="space-y-5">
                            
                            {/* Section: Recebedor */}
                            <div className="space-y-3">
                              <h5 className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-1">
                                <span>3. Identidade do Recebedor</span>
                              </h5>

                              <div className="grid grid-cols-1 gap-2.5">
                                {/* Name */}
                                <div className="space-y-0.5">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase block">Nome do Recebedor</label>
                                  {isEditingProtocol ? (
                                    <input
                                      type="text"
                                      value={protocolRecipientName}
                                      onChange={(e) => setProtocolRecipientName(e.target.value)}
                                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none"
                                      placeholder="Nome completo do recebedor"
                                    />
                                  ) : (
                                    <p className="text-xs font-bold text-slate-700">{protocolRecipientName || 'Não Informado'}</p>
                                  )}
                                </div>

                                {/* Doc */}
                                <div className="space-y-0.5">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase block">Documento de Identificação (RG/CPF)</label>
                                  {isEditingProtocol ? (
                                    <input
                                      type="text"
                                      value={protocolRecipientDoc}
                                      onChange={(e) => setProtocolRecipientDoc(e.target.value)}
                                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none"
                                      placeholder="RG ou CPF"
                                    />
                                  ) : (
                                    <p className="text-xs font-bold text-slate-700">{protocolRecipientDoc || 'Não Informado'}</p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Section: Assinatura Eletrônica */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                                <h5 className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                                  <span>4. Assinatura Biométrica Digital</span>
                                </h5>
                                {hubOrder && (
                                  <button
                                    onClick={() => openSignatureCanvas(hubOrder)}
                                    className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/60 rounded-lg text-[9px] font-extrabold flex items-center gap-1 cursor-pointer transition-all"
                                  >
                                    <FileSignature size={11} />
                                    <span>Assinar no Canvas</span>
                                  </button>
                                )}
                              </div>

                              <div className="border border-slate-200 rounded-2xl h-36 bg-slate-50 relative overflow-hidden flex flex-col justify-between">
                                {/* Sign Area */}
                                <div className="flex-1 flex items-center justify-center relative p-3">
                                  {(() => {
                                    const currentSig = protocolSignatureUrl || hubOrder?.signatureUrl || '';
                                    if (hasSignature || currentSig) {
                                      return (
                                        <div className="text-center w-full h-full flex items-center justify-center p-2">
                                          {currentSig.startsWith('typed:') ? (
                                            <div 
                                              className="text-center text-lg text-blue-700 italic border-b border-blue-200 px-3 py-1 transform -rotate-4 transition-all cursor-pointer hover:scale-105"
                                              style={{ fontFamily: 'Caveat, "Playfair Display", Georgia, cursive, serif' }}
                                              onClick={() => setExpandedImage(currentSig)}
                                              title="Clique para ampliar a assinatura digital"
                                            >
                                              {currentSig.replace('typed:', '')}
                                            </div>
                                          ) : (currentSig && currentSig !== 'digital-sign-blob') ? (
                                            <img 
                                              src={currentSig} 
                                              alt="Assinatura Eletrônica" 
                                              className="max-w-full max-h-24 object-contain cursor-pointer hover:scale-105 transition-transform"
                                              referrerPolicy="no-referrer"
                                              onClick={() => setExpandedImage(currentSig)}
                                              title="Clique para ampliar a assinatura digital"
                                            />
                                          ) : (
                                            <div className="text-center" id="signature-mockup-graphics">
                                              <svg className="w-48 h-14 text-blue-600" viewBox="0 0 200 100">
                                                <path 
                                                  d="M20 50 C 40 10, 60 90, 80 30 C 100 20, 120 80, 150 40 C 170 30, 190 60, 180 50" 
                                                  fill="none" 
                                                  stroke="currentColor" 
                                                  strokeWidth="3.5" 
                                                  strokeLinecap="round"
                                                />
                                              </svg>
                                              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest block mt-1">
                                                Assinatura Biométrica Validada
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    } else if (isEditingProtocol) {
                                      return (
                                        <div className="text-center text-slate-400">
                                          <FileSignature size={24} className="mx-auto text-blue-500 mb-1" />
                                          <p className="text-[9px] font-bold text-slate-600">Assinatura Eletrônica Pendente</p>
                                          <button
                                            onClick={() => hubOrder && openSignatureCanvas(hubOrder)}
                                            className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[9px] font-bold cursor-pointer transition-all shadow-xs flex items-center gap-1 mx-auto"
                                          >
                                            <FileSignature size={11} />
                                            <span>Desenhar Assinatura no Canvas</span>
                                          </button>
                                        </div>
                                      );
                                    } else {
                                      return (
                                        <div className="text-center text-slate-400">
                                          <FileSignature size={24} className="mx-auto text-slate-400 mb-1" />
                                          <p className="text-[10px] font-bold uppercase tracking-wider">Sem Assinatura Registrada</p>
                                          <button
                                            onClick={() => hubOrder && openSignatureCanvas(hubOrder)}
                                            className="mt-1.5 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[9px] font-bold cursor-pointer transition-all shadow-xs inline-flex items-center gap-1"
                                          >
                                            <FileSignature size={10} />
                                            <span>Assinar Agora</span>
                                          </button>
                                        </div>
                                      );
                                    }
                                  })()}
                                </div>
 
                                {/* Clear option */}
                                {hasSignature && isEditingProtocol && (
                                  <div className="border-t border-slate-100 p-2 bg-white flex justify-end">
                                    <button
                                      onClick={handleClearSignature}
                                      className="text-[9px] text-rose-500 hover:text-rose-700 font-bold cursor-pointer uppercase tracking-wider"
                                    >
                                      Limpar Assinatura
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Section: Comprovação Fotográfica da Entrega */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                                <h5 className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                                  <span>5. Comprovação Fotográfica da Entrega</span>
                                </h5>
                                {protocolDeliveryPhoto && !isPhotoCorrupted ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-extrabold shadow-3xs">
                                    <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                                    <span>Foto Auditada & Íntegra</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-extrabold shadow-3xs">
                                    <AlertTriangle size={12} className="text-rose-600 shrink-0" />
                                    <span>{isPhotoCorrupted ? 'Aviso: Imagem Corrompida' : 'Aviso: Foto Ausente'}</span>
                                  </span>
                                )}
                              </div>

                              {protocolDeliveryPhoto && !isPhotoCorrupted ? (
                                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 relative group cursor-pointer" onClick={() => setExpandedImage(protocolDeliveryPhoto)}>
                                  <img 
                                    src={protocolDeliveryPhoto} 
                                    alt="Comprovante de Entrega" 
                                    className="w-full h-44 object-contain bg-slate-900/90 group-hover:scale-102 transition-transform"
                                    referrerPolicy="no-referrer"
                                    onError={() => setIsPhotoCorrupted(true)}
                                  />
                                  <div className="absolute top-2 right-2 bg-slate-900/80 text-white px-2 py-1 rounded-lg text-[9px] font-bold flex items-center gap-1 shadow-md opacity-90 group-hover:opacity-100 transition-opacity">
                                    <Search size={10} />
                                    <span>🔍 Ampliar Foto</span>
                                  </div>
                                  {isEditingProtocol && (
                                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                      <button
                                        onClick={() => {
                                          setProtocolDeliveryPhoto('');
                                          setIsPhotoCorrupted(false);
                                        }}
                                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all shadow"
                                      >
                                        Remover Foto
                                      </button>
                                      <button
                                        onClick={() => {
                                          setIsPhotoCorrupted(false);
                                          handleSimulatePhoto();
                                        }}
                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all shadow"
                                      >
                                        Simular Outra
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : isPhotoCorrupted ? (
                                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-center space-y-2.5">
                                  <div className="flex items-center justify-center gap-2 text-rose-700 font-bold text-xs">
                                    <AlertTriangle size={16} />
                                    <span>Aviso de Auditoria: Imagem do Comprovante Requer Atualização</span>
                                  </div>
                                  <p className="text-[10px] text-rose-600 font-medium leading-relaxed">
                                    A imagem do comprovante não pôde ser carregada diretamente pelo navegador. Clique no botão abaixo para restaurar e gerar automaticamente um comprovante fotográfico GPS auditado.
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsPhotoCorrupted(false);
                                      handleSimulatePhoto();
                                    }}
                                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-extrabold cursor-pointer transition-all shadow-xs inline-flex items-center gap-1.5"
                                  >
                                    <RefreshCw size={12} />
                                    <span>Gerar Comprovante Válido (Autocorreção)</span>
                                  </button>
                                </div>
                              ) : isEditingProtocol ? (
                                <div className="space-y-3">
                                  {/* Upload Zone */}
                                  <div 
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                      setIsDraggingPhoto(true);
                                    }}
                                    onDragLeave={() => setIsDraggingPhoto(false)}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      setIsDraggingPhoto(false);
                                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                        handlePhotoUpload(e.dataTransfer.files[0]);
                                      }
                                    }}
                                    className={`border-2 border-dashed rounded-2xl p-4 text-center transition-all ${
                                      isDraggingPhoto 
                                        ? 'border-blue-500 bg-blue-50/50 scale-[1.01]' 
                                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100/75'
                                    }`}
                                  >
                                    <div className="flex flex-col items-center justify-center">
                                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-1.5">
                                        <Truck size={16} />
                                      </div>
                                      <p className="text-[10px] font-bold text-slate-600">Arraste a foto de entrega aqui</p>
                                      <p className="text-[9px] text-slate-400">ou clique para selecionar</p>
                                      
                                      <input 
                                        type="file" 
                                        accept="image/*"
                                        onChange={(e) => {
                                          if (e.target.files && e.target.files[0]) {
                                            handlePhotoUpload(e.target.files[0]);
                                          }
                                        }}
                                        className="hidden" 
                                        id="protocol-photo-input"
                                      />
                                      
                                      <div className="flex gap-2 mt-2">
                                        <label 
                                          htmlFor="protocol-photo-input"
                                          className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-[9px] font-bold cursor-pointer transition-all shadow-sm"
                                        >
                                          Selecionar Arquivo
                                        </label>
                                        <button
                                          onClick={handleSimulatePhoto}
                                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 rounded-lg text-[9px] font-bold cursor-pointer transition-all"
                                        >
                                          Simular Foto
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Delivery point map (Lat x Log) */}
                                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 shadow-xs flex flex-col">
                                    <div className="bg-slate-100/60 px-3 py-1.5 border-b border-slate-100 flex items-center justify-between text-[9px] font-bold text-slate-500">
                                      <div className="flex items-center gap-1.5">
                                        <MapPin size={11} className="text-rose-500 animate-pulse shrink-0" />
                                        <span>Ponto de Entrega</span>
                                      </div>
                                      <span className="font-mono text-slate-600 bg-white px-1.5 py-0.5 border border-slate-100 rounded">
                                        Lat: {protocolCoords.lat} x Log: {protocolCoords.lng}
                                      </span>
                                    </div>
                                    <div className="relative h-28 w-full bg-slate-100">
                                      {(() => {
                                        const latVal = Number(protocolCoords.lat) || 0;
                                        const lngVal = Number(protocolCoords.lng) || 0;
                                        return (
                                          <iframe
                                            title="Mapa do Ponto de Entrega"
                                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${lngVal - 0.005}%2C${latVal - 0.003}%2C${lngVal + 0.005}%2C${latVal + 0.003}&layer=mapnik&marker=${latVal}%2C${lngVal}`}
                                            className="w-full h-full border-0"
                                            allowFullScreen
                                            loading="lazy"
                                            referrerPolicy="no-referrer"
                                          />
                                        );
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {/* Beautiful empty banner */}
                                  <div className="border border-dashed border-slate-200 rounded-2xl p-4 text-center bg-slate-50/50">
                                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Foto de Comprovação Ausente</p>
                                    <p className="text-[9px] text-slate-400 mt-1">Nenhuma imagem registrada para este protocolo. Registros baseados em localização geográfica.</p>
                                  </div>

                                  {/* Map shown under */}
                                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 shadow-xs flex flex-col">
                                    <div className="bg-slate-100/60 px-3 py-1.5 border-b border-slate-100 flex items-center justify-between text-[9px] font-bold text-slate-500">
                                      <div className="flex items-center gap-1.5">
                                        <MapPin size={11} className="text-rose-500 animate-pulse shrink-0" />
                                        <span>Ponto de Entrega</span>
                                      </div>
                                      <span className="font-mono text-slate-600 bg-white px-1.5 py-0.5 border border-slate-100 rounded">
                                        Lat: {protocolCoords.lat} x Log: {protocolCoords.lng}
                                      </span>
                                    </div>
                                    <div className="relative h-28 w-full bg-slate-100">
                                      {(() => {
                                        const latVal = Number(protocolCoords.lat) || 0;
                                        const lngVal = Number(protocolCoords.lng) || 0;
                                        return (
                                          <iframe
                                            title="Mapa do Ponto de Entrega"
                                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${lngVal - 0.005}%2C${latVal - 0.003}%2C${lngVal + 0.005}%2C${latVal + 0.003}&layer=mapnik&marker=${latVal}%2C${lngVal}`}
                                            className="w-full h-full border-0"
                                            allowFullScreen
                                            loading="lazy"
                                            referrerPolicy="no-referrer"
                                          />
                                        );
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Section: Observações do Pedido / Protocolo */}
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                              <h5 className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                                <span>6. Observações do Pedido & Entrega</span>
                              </h5>
                              {isEditingProtocol ? (
                                <textarea
                                  rows={3}
                                  value={protocolObservations}
                                  onChange={(e) => setProtocolObservations(e.target.value)}
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                  placeholder="Digite observações sobre a entrega, local de recebimento ou ocorrências..."
                                />
                              ) : (
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium leading-relaxed">
                                  {protocolObservations || hubOrder?.rawData?.Observacoes || hubOrder?.rawData?.observacoes || 'Nenhuma observação cadastrada para este protocolo.'}
                                </div>
                              )}
                            </div>

                          </div>

                        </div>
                      </div>

                      {/* Action footer */}
                      {isEditingProtocol && (
                        <div className="border-t border-slate-100 pt-4 flex justify-end gap-3">
                          <button
                            onClick={handleSaveProtocol}
                            disabled={!protocolRecipientName}
                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-50 flex items-center gap-1.5 transition-all cursor-pointer font-extrabold"
                          >
                            <CheckCircle2 size={14} />
                            <span>Salvar & Confirmar Entrega</span>
                          </button>
                        </div>
                      )}

                    </div>
                  )}

                  {/* TAB 5: MENSAGEM E NOTIFICAÇÃO AO CLIENTE */}
                  {hubTab === 'notificacao' && hubOrder && (() => {
                    const settings = getNotificationSettings();
                    const contact = getOrderContactInfo(hubOrder);
                    const assignedRider = riders.find(r => r.id === hubOrder.riderId);
                    const riderName = assignedRider?.name || 'Condutor ViniMap';
                    
                    const waText = replaceNotificationPlaceholders(settings.whatsappMessageTemplate, hubOrder, riderName);
                    const waUrl = generateWhatsappUrl(contact.cleanPhoneDigits, waText);
                    const emailSubj = replaceNotificationPlaceholders(settings.emailSubjectTemplate, hubOrder, riderName);
                    const emailBody = replaceNotificationPlaceholders(settings.emailMessageTemplate, hubOrder, riderName);
                    const mailtoUrl = generateMailtoUrl(contact.email, emailSubj, emailBody);

                    return (
                      <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                          <div>
                            <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                              <BellRing size={16} className="text-blue-600" />
                              <span>Notificação Personalizada ao Cliente</span>
                            </h4>
                            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                              Mensagem gerada com base no modelo padrão configurado pelo Administrador
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {contact.hasPhone && (
                              <a
                                href={`tel:${contact.cleanPhoneDigits}`}
                                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-100 cursor-pointer"
                                title="Abrir discador do dispositivo"
                              >
                                <Phone size={14} />
                                <span>Ligar agora</span>
                              </a>
                            )}
                            {contact.hasPhone && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-100 cursor-pointer"
                              >
                                <MessageSquare size={14} />
                                <span>Enviar no WhatsApp</span>
                                <ExternalLink size={12} />
                              </a>
                            )}
                            {contact.hasEmail && (
                              <a
                                href={mailtoUrl}
                                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-md shadow-blue-100 cursor-pointer"
                              >
                                <Mail size={14} />
                                <span>Enviar por E-mail</span>
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Customer Contacts Summary Card */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Telefone / WhatsApp</span>
                              <span className="text-xs font-extrabold text-slate-800">
                                {contact.phone || 'Não cadastrado no pedido'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {contact.hasPhone && (
                                <a
                                  href={`tel:${contact.cleanPhoneDigits}`}
                                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-extrabold rounded-lg flex items-center gap-1 transition-all shadow-sm cursor-pointer"
                                  title="Ligar agora para o cliente"
                                >
                                  <Phone size={11} />
                                  <span>Ligar agora</span>
                                </a>
                              )}
                              {contact.hasPhone ? (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-lg">Válido</span>
                              ) : (
                                <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-bold rounded-lg">Ausente</span>
                              )}
                            </div>
                          </div>

                          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">E-mail para Comprovante</span>
                              <span className="text-xs font-extrabold text-slate-800">
                                {contact.email || 'Não cadastrado no pedido'}
                              </span>
                            </div>
                            {contact.hasEmail ? (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-lg">Válido</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-bold rounded-lg">Ausente</span>
                            )}
                          </div>
                        </div>

                        {/* WhatsApp Generated Message Box */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                              <MessageSquare size={14} className="text-emerald-600" />
                              <span>Mensagem de WhatsApp (Comprovante Digital):</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(waText);
                                alert('Mensagem do WhatsApp copiada!');
                              }}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                            >
                              <Copy size={12} />
                              <span>Copiar Texto</span>
                            </button>
                          </div>
                          <div className="p-4 bg-[#f0f2f5] border border-slate-200 rounded-2xl text-xs font-sans text-slate-800 whitespace-pre-wrap leading-relaxed">
                            {waText}
                          </div>
                        </div>

                        {/* Email Generated Message Box */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                              <Mail size={14} className="text-blue-600" />
                              <span>E-mail Formatado (Assunto: {emailSubj}):</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(`Assunto: ${emailSubj}\n\n${emailBody}`);
                                alert('E-mail copiado para a área de transferência!');
                              }}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                            >
                              <Copy size={12} />
                              <span>Copiar E-mail</span>
                            </button>
                          </div>
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-sans text-slate-800 whitespace-pre-wrap leading-relaxed">
                            {emailBody}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <BulkCreateModal
        isOpen={isBulkCreateOpen}
        onClose={() => setIsBulkCreateOpen(false)}
        onSubmit={handleBulkCreateSubmit}
        clientPartners={clientPartners}
      />

      <BulkEditModal
        isOpen={isBulkEditOpen}
        onClose={() => setIsBulkEditOpen(false)}
        onSave={handleBulkEditSave}
        selectedCount={selectedIds.size}
        clientPartners={clientPartners}
        riders={riders}
      />

      <ExportConfigModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        orders={orders}
        sortedOrders={sortedOrders}
        selectedIds={selectedIds}
        riders={riders}
        clientPartners={clientPartners}
      />

      <DeleteConfirmationModal
        isOpen={deleteModalConfig.isOpen}
        onClose={() => setDeleteModalConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={deleteModalConfig.onConfirm}
        title={deleteModalConfig.title}
        description={deleteModalConfig.description}
        itemDetails={deleteModalConfig.itemDetails}
        count={deleteModalConfig.count}
      />

      <SignatureCanvasModal
        isOpen={signatureCanvasModalOpen}
        onClose={() => setSignatureCanvasModalOpen(false)}
        order={signatureTargetOrder}
        onSaveSignature={handleSaveCanvasSignature}
      />

      {/* EXPANDED LIGHTBOX IMAGE MODAL */}
      <AnimatePresence>
        {expandedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4 backdrop-blur-md"
            onClick={() => setExpandedImage(null)}
          >
            <button 
              className="absolute top-5 right-5 text-white p-3 rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer shadow-lg"
              onClick={() => setExpandedImage(null)}
            >
              <X size={24} />
            </button>
            {expandedImage.startsWith('typed:') ? (
              <div 
                className="bg-white px-12 py-8 rounded-2xl text-center text-5xl text-blue-800 italic transform -rotate-4 shadow-2xl cursor-pointer max-w-xl border-2 border-blue-200"
                style={{ fontFamily: 'Caveat, "Playfair Display", Georgia, cursive, serif' }}
                onClick={() => setExpandedImage(null)}
              >
                {expandedImage.replace('typed:', '')}
              </div>
            ) : (
              <img 
                src={expandedImage} 
                alt="Visualização Ampliada"
                className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl cursor-pointer border border-slate-700/50"
                onClick={() => setExpandedImage(null)}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
