/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type OrderStatus = 'Não iniciado' | 'Em rota' | 'Entregando' | 'Concluído' | 'Cancelado' | 'Ocorrência';
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

export function isMatchingClientCode(partnerIdOrCode: string | undefined, targetId: string, targetCodigo?: string): boolean {
  if (!partnerIdOrCode) return false;
  const p1 = partnerIdOrCode.trim().toLowerCase();
  const tId = targetId.trim().toLowerCase();
  const tCode = targetCodigo?.trim().toLowerCase() || '';
  
  if (p1 === tId || p1 === tCode) return true;
  
  const norm = (s: string) => s.replace(/[-_]/g, '');
  const nP1 = norm(p1);
  const nTId = norm(tId);
  const nTCode = norm(tCode);
  
  if (nP1 === nTId || (nTCode && nP1 === nTCode)) return true;
  
  const getParts = (s: string) => {
    const match = s.match(/\d+$/);
    const num = match ? parseInt(match[0], 10) : NaN;
    const letters = s.replace(/\d+$/, '').replace(/[^a-z]/g, '');
    return { letters, num };
  };
  
  try {
    const partsP1 = getParts(p1);
    const partsTId = getParts(tId);
    
    const isP1Client = partsP1.letters.startsWith('cl') || partsP1.letters.startsWith('ci');
    const isTIdClient = partsTId.letters.startsWith('cl') || partsTId.letters.startsWith('ci');
    const isP1Partner = partsP1.letters.startsWith('pa') || partsP1.letters.startsWith('pr');
    const isTIdPartner = partsTId.letters.startsWith('pa') || partsTId.letters.startsWith('pr');
    
    if (isP1Client && isTIdClient && partsP1.num === partsTId.num) return true;
    if (isP1Partner && isTIdPartner && partsP1.num === partsTId.num) return true;
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
  cpfCnpj?: string;
  vehiclePlate?: string;
  cnh?: string;
}

export interface ActivityLog {
  id: string;
  time: string;
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


