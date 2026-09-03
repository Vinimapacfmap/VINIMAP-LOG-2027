/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type OrderStatus = 'Não iniciado' | 'Em rota' | 'Concluído' | 'Cancelado' | 'Ocorrência';
export type OrderPriority = 'Baixa' | 'Média' | 'Alta' | 'Normal' | 'expresso' | 'normal' | 'Expresso';
export type RiderStatus = 'Disponível' | 'Em rota' | 'Alerta' | 'Offline';
export type VehicleType = 'Moto' | 'Bicicleta' | 'Carro' | 'Elétrico';

export interface OrderHistoryEntry {
  timestamp: string;
  action: string;
  user: string;
  details?: string;
}

export interface Order {
  id: string;
  clientName: string;
  phone: string;
  address: string;
  region: string;
  status: OrderStatus;
  priority: OrderPriority;
  value: number;
  riderId?: string;
  createdAt: string;
  timeRemaining?: number; // em minutos
  itemsCount: number;
  date: string;       // YYYY-MM-DD
  cep: string;        // CEP format 01234-567
  partnerName: string; // Cliente Parceiro / Estabelecimento
  deliveryValue?: number; // Valor da entrega / frete importado ou configurado
  driverValue?: number;   // Valor pago ao condutor/entregador importado ou configurado
  rawData?: Record<string, string>;
  history?: OrderHistoryEntry[];
  protocolNumber?: string;
  signatureUrl?: string;
  deliveryPhotoUrl?: string;
  recipientName?: string;
  recipientDoc?: string;
  occurrenceDate?: string;
  deliveryDate?: string;
  deliveryTime?: string;
  dataConclusao?: string;
  horarioInicial?: string;
  horarioFinal?: string;
  lat?: number;        // Explicit geocoded latitude
  lng?: number;        // Explicit geocoded longitude
  sequence?: number; // custom delivery sequence/order index
  email?: string;      // E-mail do cliente
  number?: string;     // Número do endereço
  complement?: string; // Complemento do endereço
  city?: string;       // Cidade
  state?: string;      // UF / Estado
  originalDate?: string; // Data de lançamento original do pedido
  reallocatedDate?: string; // Data da última realocação/revalidação
  reallocatedAt?: string; // Timestamp ISO da última realocação/revalidação
  adminOverride?: boolean; // Se o status foi alterado ou confirmado manualmente pelo administrador
  statusUpdatedAt?: string; // Timestamp ISO da última alteração de status
  updatedAt?: string;  // ISO timestamp of latest modification
}

export interface CepRange {
  id: string;
  cepStart: string; // ex: "01000-000" ou "01000000"
  cepEnd: string;   // ex: "01999-999" ou "01999999"
  value: number;    // valor do frete para essa faixa (Frete Normal)
  description?: string; // Descrição opcional (ex: Centro)
  expressValue?: number; // valor do frete expresso para essa faixa (Prioridade Expresso)
  driverRepass?: number; // valor de repasse ao condutor (Repasse Condutor)
  effectiveFrom?: string; // Data de início da vigência/validade (YYYY-MM-DD)
}

export interface CepTableHistoryItem {
  id: string;
  importedAt: string; // ex: "25/07/2026 09:30"
  filename?: string;
  rangesCount: number;
  cepRanges: CepRange[];
  note?: string;
}

export interface ClientPartner {
  id: string;
  codigoCliente?: string;
  name: string;
  fantasia?: string;
  razaoSocial?: string;
  region: string;
  tel: string;
  addr: string;
  status: string;
  type: 'Cliente' | 'Parceiro';
  cnpj?: string;
  cep?: string;
  cidade?: string;
  estado?: string;
  enableCompletionNotifications?: boolean;
  cepRanges?: CepRange[];
  cepRangesHistory?: CepTableHistoryItem[];
}

export function isMatchingClientCode(partnerIdOrCode: any, targetId: any, targetCodigo?: any): boolean {
  if (partnerIdOrCode === undefined || partnerIdOrCode === null) return false;
  const p1 = String(partnerIdOrCode).trim().toLowerCase();
  const tId = targetId ? String(targetId).trim().toLowerCase() : '';
  const tCode = targetCodigo ? String(targetCodigo).trim().toLowerCase() : '';
  
  if (!p1) return false;
  if (!tId && !tCode) return false;
  
  // 1. Direct equality
  if ((tId && p1 === tId) || (tCode && p1 === tCode)) return true;
  
  // 2. Alphanumeric normalized equality
  const clean = (s: string) => s.replace(/[^a-z0-9]/g, '');
  const nP1 = clean(p1);
  const nTId = clean(tId);
  const nTCode = clean(tCode);
  
  if (nP1 && ((nTId && nP1 === nTId) || (nTCode && nP1 === nTCode))) return true;
  
  // 3. Substring matching if substantial length
  if (nP1.length >= 4) {
    if (nTId && nTId.length >= 4 && (nP1.includes(nTId) || nTId.includes(nP1))) return true;
    if (nTCode && nTCode.length >= 4 && (nP1.includes(nTCode) || nTCode.includes(nP1))) return true;
  }
  
  // 4. Pattern extraction for CL1-009, CL1-010, CL1-011, CL1-012, CL-010, 010, etc.
  const extractCode = (s: string) => {
    if (!s) return null;
    const str = String(s).trim().toLowerCase();
    const isClient = /cl|ci|cliente/i.test(str) || !/pa|pr/i.test(str);

    // Specific match for CL1-009, CL1-010, CL-010, CLI-010, PARCEIRO-010
    const m1 = str.match(/^(?:cliente|cli|cl|ci|pa|pr|parceiro)\s*(?:1\s*[-_]|[-_\s])?\s*0*([0-9]+)$/i);
    if (m1 && m1[1]) return { num: parseInt(m1[1], 10), isClient };

    // Pure digits: "10", "010", "009", "9"
    const mDigits = str.match(/^0*([0-9]+)$/);
    if (mDigits && mDigits[1]) return { num: parseInt(mDigits[1], 10), isClient };

    // Name ending with code: "Cliente 10", "Ponto 10"
    const mTrailing = str.match(/[-_\s]0*([0-9]+)$/);
    if (mTrailing && mTrailing[1]) return { num: parseInt(mTrailing[1], 10), isClient };

    // Fallback: all numbers in string, if CL1-010, last number is 10
    const allDigits = str.match(/\d+/g);
    if (allDigits && allDigits.length > 0) {
      return { num: parseInt(allDigits[allDigits.length - 1], 10), isClient };
    }
    return null;
  };

  try {
    const cP1 = extractCode(p1);
    const cTId = extractCode(tId);
    const cTCode = extractCode(tCode);
    
    if (cP1 && !isNaN(cP1.num)) {
      if (cTId && !isNaN(cTId.num) && cP1.num === cTId.num) return true;
      if (cTCode && !isNaN(cTCode.num) && cP1.num === cTCode.num) return true;
    }
  } catch (e) {
    // ignore
  }

  return false;
}

export type BillingModelType = 'misto' | 'fixo' | 'variavel' | 'frete' | 'fracionado';

export interface DeliveryRider {
  id: string;
  name: string;
  avatar: string;
  vehicle: VehicleType;
  rating: number;
  status: RiderStatus;
  phone: string;
  lat: number; // coordenadas relativas em % no mapa SVG (0-100)
  lng: number; // coordenadas relativas em % no mapa SVG (0-100)
  realGeoLat?: number; // Coordenada Latitude REAL do GPS do dispositivo (ex: -23.55052)
  realGeoLng?: number; // Coordenada Longitude REAL do GPS do dispositivo (ex: -46.63330)
  gpsAccuracy?: number; // Precisão do sinal GPS em metros (ex: 3.5m)
  lastGpsUpdate?: string; // Horário da última transmissão de GPS do celular
  isGpsRealActive?: boolean; // Flag indicando se a localização real do celular está transmitindo
  completedDeliveries: number;
  currentOrderId?: string;
  batteryPercent: number;
  billingModel?: BillingModelType;
  billingFixedFee?: number;
  billingVariablePercent?: number;
  billingFreightPercent?: number;
  billingFractionalValue?: number; // Valor fracionado padrão ou cobrado manualmente por entrega
  exibirValorTurno?: boolean;
  ocultarValoresProtocolos?: boolean;
  autorizarImprimirRecibo?: boolean;
  enableSoundAlert?: boolean; // Alerta sonoro de novos pedidos (Ativo por padrão)
  soundType?: string; // Tipo de som de notificação (ex: 'alerta_padrao', 'sinal_suave', 'sinal_urgente', 'pop_moderno')
  permiteImprimirRecibo?: boolean;
  deviceNumber?: string;
  isLoggedIn?: boolean;
  activeDeviceId?: string;
  lastLoginAt?: string;
  password?: string; // numeric, up to 6 digits
  address?: string;
  cep?: string;
  cidade?: string;
  estado?: string;
  cpfCnpj?: string;
  vehiclePlate?: string;
  cnh?: string;
}

export interface ActivityLog {
  id: string;
  time: string;
  date?: string; // YYYY-MM-DD
  createdAt?: string; // ISO string
  message: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  orderId?: string;
}

export interface ChartDataPoint {
  hour: string;
  total: number;
  delivered: number;
}

export interface RegionDistribution {
  name: string;
  count: number;
  percent: number;
}

export interface FinancialTransaction {
  id: string;
  description: string;
  type: 'payable' | 'receivable';
  amount: number;
  dueDate: string;
  actualPaymentDate?: string;
  category: string;
  status: 'Pendente' | 'Pago' | 'Atrasado';
  recipientOrPayer: string;
  paymentMethod: string;
  notes?: string;
  costType?: 'fixed' | 'variable';
  isRecurring?: boolean;
  recurrencePeriod?: 'weekly' | 'monthly' | 'yearly';
  recurrenceInstallment?: number;
  totalInstallments?: number;
  parentRecurrenceId?: string;
}

export interface NoteTodo {
  id: string;
  text: string;
  completed: boolean;
}

export interface DailyNote {
  id: string;
  title: string;
  content: string;
  category: 'Geral' | 'Ideia' | 'Operacional' | 'Financeiro' | 'Urgente' | 'Lembrete';
  createdAt: string;
  updatedAt?: string;
  pinned: boolean;
  tags: string[];
  todos?: NoteTodo[];
  color?: string;
}

export interface CompanyHub {
  id: string;
  name: string;
  cnpj?: string;
  address: string;
  cep: string;
  lat: number;
  lng: number;
  phone?: string;
  email?: string;
  logoUrl?: string;
  active: boolean;
}


