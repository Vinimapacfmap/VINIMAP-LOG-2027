import { supabase, isSupabaseConfigured } from '../supabase';
import { 
  Order, 
  ClientPartner, 
  DeliveryRider, 
  ActivityLog, 
  FinancialTransaction,
  CompanyHub 
} from '../types';

// ============================================================================
// MAPPING HELPER FUNCTIONS (camelCase <-> snake_case)
// ============================================================================

export function mapOrderToDb(o: Order) {
  return {
    id: o.id,
    client_name: o.clientName,
    phone: o.phone,
    address: o.address,
    region: o.region,
    status: o.status,
    priority: o.priority,
    value: o.value,
    rider_id: o.riderId || null,
    items_count: o.itemsCount ?? 1,
    date: o.date,
    cep: o.cep || null,
    partner_name: o.partnerName || null,
    delivery_value: o.deliveryValue ?? 0,
    driver_value: o.driverValue ?? 0,
    raw_data: o.rawData ? JSON.stringify(o.rawData) : null,
    history: o.history ? JSON.stringify(o.history) : null,
    protocol_number: o.protocolNumber || null,
    signature_url: o.signatureUrl || null,
    delivery_photo_url: o.deliveryPhotoUrl || null,
    recipient_name: o.recipientName || null,
    recipient_doc: o.recipientDoc || null,
    delivery_date: o.deliveryDate || null,
    delivery_time: o.deliveryTime || null,
    data_conclusao: o.dataConclusao || o.deliveryDate || null,
    horario_inicial: o.horarioInicial || o.createdAt || null,
    horario_final: o.horarioFinal || o.deliveryTime || null,
    sequence: o.sequence ?? null
  };
}

export function mapOrderFromDb(row: any): Order {
  const rawDataObj = row.raw_data ? (typeof row.raw_data === 'string' ? JSON.parse(row.raw_data) : row.raw_data) : undefined;
  
  const protocolNumber = row.protocol_number 
    || rawDataObj?.protocolNumber 
    || rawDataObj?.NumeroProtocolo 
    || rawDataObj?.protocolo 
    || rawDataObj?.Protocolo 
    || undefined;

  const signatureUrl = row.signature_url 
    || rawDataObj?.signatureUrl 
    || rawDataObj?.signatureImage 
    || rawDataObj?.assinatura 
    || rawDataObj?.Assinatura 
    || rawDataObj?.AssinaturaDigital 
    || undefined;

  const deliveryPhotoUrl = row.delivery_photo_url 
    || rawDataObj?.deliveryPhotoUrl 
    || rawDataObj?.photoImage 
    || rawDataObj?.fotoComprovante 
    || rawDataObj?.foto 
    || rawDataObj?.Foto 
    || undefined;

  const recipientName = row.recipient_name 
    || rawDataObj?.recipientName 
    || rawDataObj?.Recebedor 
    || rawDataObj?.recebedor 
    || undefined;

  const recipientDoc = row.recipient_doc 
    || rawDataObj?.recipientDoc 
    || rawDataObj?.DocumentoRecebedor 
    || rawDataObj?.doc 
    || undefined;

  return {
    id: row.id,
    clientName: row.client_name,
    phone: row.phone || '',
    address: row.address,
    region: row.region || '',
    status: row.status,
    priority: row.priority,
    value: Number(row.value),
    riderId: row.rider_id || undefined,
    createdAt: row.created_at,
    itemsCount: row.items_count,
    date: row.date,
    cep: row.cep || '',
    partnerName: row.partner_name || '',
    deliveryValue: row.delivery_value !== null ? Number(row.delivery_value) : undefined,
    driverValue: row.driver_value !== null ? Number(row.driver_value) : undefined,
    rawData: rawDataObj,
    history: row.history ? (typeof row.history === 'string' ? JSON.parse(row.history) : row.history) : undefined,
    protocolNumber,
    signatureUrl,
    deliveryPhotoUrl,
    recipientName,
    recipientDoc,
    deliveryDate: row.delivery_date || undefined,
    deliveryTime: row.delivery_time || undefined,
    dataConclusao: row.data_conclusao || row.delivery_date || undefined,
    horarioInicial: row.horario_inicial || undefined,
    horarioFinal: row.horario_final || row.delivery_time || undefined,
    sequence: row.sequence !== null ? Number(row.sequence) : undefined
  };
}

export function mapClientPartnerToDb(c: ClientPartner) {
  return {
    id: c.id,
    codigo_cliente: c.codigoCliente || null,
    name: c.name,
    region: c.region,
    tel: c.tel,
    addr: c.addr,
    status: c.status,
    type: c.type,
    cnpj: c.cnpj || null,
    cep: c.cep || null,
    cidade: c.cidade || null,
    estado: c.estado || null,
    enable_completion_notifications: c.enableCompletionNotifications !== false,
    cep_ranges: c.cepRanges ? JSON.stringify(c.cepRanges) : '[]',
    cep_ranges_history: c.cepRangesHistory ? JSON.stringify(c.cepRangesHistory) : '[]'
  };
}

export function mapClientPartnerFromDb(row: any): ClientPartner {
  return {
    id: row.id,
    codigoCliente: row.codigo_cliente || undefined,
    name: row.name,
    region: row.region || '',
    tel: row.tel || '',
    addr: row.addr || '',
    status: row.status || 'Ativo',
    type: row.type || 'Parceiro',
    cnpj: row.cnpj || undefined,
    cep: row.cep || undefined,
    cidade: row.cidade || undefined,
    estado: row.estado || undefined,
    enableCompletionNotifications: row.enable_completion_notifications !== false,
    cepRanges: row.cep_ranges ? (typeof row.cep_ranges === 'string' ? JSON.parse(row.cep_ranges) : row.cep_ranges) : [],
    cepRangesHistory: row.cep_ranges_history ? (typeof row.cep_ranges_history === 'string' ? JSON.parse(row.cep_ranges_history) : row.cep_ranges_history) : []
  };
}

export function mapDeliveryRiderToDb(r: DeliveryRider) {
  return {
    id: r.id,
    name: r.name,
    avatar: r.avatar || null,
    vehicle: r.vehicle,
    rating: r.rating ?? 5.0,
    status: r.status,
    phone: r.phone,
    lat: r.lat ?? 0,
    lng: r.lng ?? 0,
    completed_deliveries: r.completedDeliveries ?? 0,
    current_order_id: r.currentOrderId || null,
    battery_percent: r.batteryPercent ?? 100,
    billing_model: r.billingModel || 'misto',
    billing_fixed_fee: r.billingFixedFee ?? 0,
    billing_variable_percent: r.billingVariablePercent ?? 0,
    billing_freight_percent: r.billingFreightPercent ?? 0,
    exibir_valor_turno: r.exibirValorTurno ?? true,
    ocultar_valores_protocolos: r.ocultarValoresProtocolos ?? false,
    autorizar_imprimir_recibo: r.autorizarImprimirRecibo ?? false,
    device_number: r.deviceNumber || null,
    password: r.password || null,
    address: r.address || null,
    cpf_cnpj: r.cpfCnpj || null,
    vehicle_plate: r.vehiclePlate || null,
    cnh: r.cnh || null
  };
}

export function mapDeliveryRiderFromDb(row: any): DeliveryRider {
  return {
    id: row.id,
    name: row.name,
    avatar: row.avatar || '',
    vehicle: row.vehicle,
    rating: Number(row.rating),
    status: row.status,
    phone: row.phone || '',
    lat: Number(row.lat),
    lng: Number(row.lng),
    completedDeliveries: row.completed_deliveries,
    currentOrderId: row.current_order_id || undefined,
    batteryPercent: row.battery_percent,
    billingModel: row.billing_model || 'misto',
    billingFixedFee: row.billing_fixed_fee !== null ? Number(row.billing_fixed_fee) : undefined,
    billingVariablePercent: row.billing_variable_percent !== null ? Number(row.billing_variable_percent) : undefined,
    billingFreightPercent: row.billing_freight_percent !== null ? Number(row.billing_freight_percent) : undefined,
    exibirValorTurno: row.exibir_valor_turno,
    ocultarValoresProtocolos: row.ocultar_valores_protocolos,
    autorizarImprimirRecibo: row.autorizar_imprimir_recibo ?? false,
    deviceNumber: row.device_number || undefined,
    password: row.password || undefined,
    address: row.address || undefined,
    cpfCnpj: row.cpf_cnpj || undefined,
    vehiclePlate: row.vehicle_plate || undefined,
    cnh: row.cnh || undefined
  };
}

export function mapActivityLogToDb(l: ActivityLog) {
  return {
    id: l.id,
    time: l.time,
    message: l.message,
    type: l.type,
    order_id: l.orderId || null
  };
}

export function mapActivityLogFromDb(row: any): ActivityLog {
  return {
    id: row.id,
    time: row.time,
    message: row.message,
    type: row.type || 'info',
    orderId: row.order_id || undefined
  };
}

export function mapFinancialTransactionToDb(f: FinancialTransaction) {
  return {
    id: f.id,
    description: f.description,
    type: f.type,
    amount: f.amount,
    due_date: f.dueDate,
    actual_payment_date: f.actualPaymentDate || null,
    category: f.category,
    status: f.status,
    recipient_or_payer: f.recipientOrPayer || null,
    payment_method: f.paymentMethod || null,
    notes: f.notes || null,
    cost_type: f.costType || null,
    is_recurring: f.isRecurring ?? false,
    recurrence_period: f.recurrencePeriod || null,
    recurrence_installment: f.recurrenceInstallment || null,
    total_installments: f.totalInstallments || null,
    parent_recurrence_id: f.parentRecurrenceId || null
  };
}

export function mapFinancialTransactionFromDb(row: any): FinancialTransaction {
  return {
    id: row.id,
    description: row.description,
    type: row.type,
    amount: Number(row.amount),
    dueDate: row.due_date,
    actualPaymentDate: row.actual_payment_date || undefined,
    category: row.category,
    status: row.status,
    recipientOrPayer: row.recipient_or_payer || '',
    paymentMethod: row.payment_method || '',
    notes: row.notes || undefined,
    costType: row.cost_type || undefined,
    isRecurring: row.is_recurring,
    recurrencePeriod: row.recurrence_period || undefined,
    recurrenceInstallment: row.recurrence_installment !== null ? Number(row.recurrence_installment) : undefined,
    totalInstallments: row.total_installments !== null ? Number(row.total_installments) : undefined,
    parentRecurrenceId: row.parent_recurrence_id || undefined
  };
}

export function mapCompanyHubToDb(h: CompanyHub) {
  return {
    id: h.id,
    name: h.name,
    cnpj: h.cnpj || null,
    address: h.address,
    cep: h.cep,
    lat: h.lat,
    lng: h.lng,
    phone: h.phone || null,
    email: h.email || null,
    logo_url: h.logoUrl || null,
    active: h.active ?? true
  };
}

export function mapCompanyHubFromDb(row: any): CompanyHub {
  return {
    id: row.id,
    name: row.name,
    cnpj: row.cnpj || undefined,
    address: row.address,
    cep: row.cep,
    lat: Number(row.lat),
    lng: Number(row.lng),
    phone: row.phone || undefined,
    email: row.email || undefined,
    logoUrl: row.logo_url || undefined,
    active: row.active
  };
}

// ============================================================================
// SUPABASE OPERATIONS - CRUD & BULK SYNC
// ============================================================================

export async function sbSaveOrder(order: Order) {
  if (!isSupabaseConfigured || !supabase) return;
  const dbOrder = mapOrderToDb(order);
  const { error } = await supabase.from('orders').upsert(dbOrder);
  if (error) {
    console.warn('Supabase Error writing order:', error);
    throw error;
  }
}

export async function sbDeleteOrder(orderId: string) {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.from('orders').delete().eq('id', orderId);
  if (error) {
    console.warn('Supabase Error deleting order:', error);
    throw error;
  }
}

export async function sbSaveClientPartner(client: ClientPartner) {
  if (!isSupabaseConfigured || !supabase) return;
  const dbClient = mapClientPartnerToDb(client);
  const { error } = await supabase.from('client_partners').upsert(dbClient);
  if (error) {
    console.warn('Supabase Error writing client:', error);
    throw error;
  }
}

export async function sbDeleteClientPartner(clientId: string) {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.from('client_partners').delete().eq('id', clientId);
  if (error) {
    console.warn('Supabase Error deleting client:', error);
    throw error;
  }
}

export async function sbSaveDeliveryRider(rider: DeliveryRider) {
  if (!isSupabaseConfigured || !supabase) return;
  const dbRider = mapDeliveryRiderToDb(rider);
  const { error } = await supabase.from('delivery_riders').upsert(dbRider);
  if (error) {
    console.warn('Supabase Error writing rider:', error);
    throw error;
  }
}

export async function sbDeleteDeliveryRider(riderId: string) {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.from('delivery_riders').delete().eq('id', riderId);
  if (error) {
    console.warn('Supabase Error deleting rider:', error);
    throw error;
  }
}

export async function sbSaveFinancialTransaction(tx: FinancialTransaction) {
  if (!isSupabaseConfigured || !supabase) return;
  const dbTx = mapFinancialTransactionToDb(tx);
  const { error } = await supabase.from('financial_transactions').upsert(dbTx);
  if (error) {
    console.warn('Supabase Error writing financial transaction:', error);
    throw error;
  }
}

export async function sbDeleteFinancialTransaction(txId: string) {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.from('financial_transactions').delete().eq('id', txId);
  if (error) {
    console.warn('Supabase Error deleting financial transaction:', error);
    throw error;
  }
}

export async function sbBulkDeleteFinancialTransactions(txIds: string[]) {
  if (!isSupabaseConfigured || !supabase || txIds.length === 0) return;
  // Delete in batches of 200
  for (let i = 0; i < txIds.length; i += 200) {
    const chunk = txIds.slice(i, i + 200);
    const { error } = await supabase.from('financial_transactions').delete().in('id', chunk);
    if (error) {
      console.warn('Supabase Error bulk deleting financial transactions:', error);
    }
  }
}

export async function sbPurgeTable(tableName: string) {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const { error } = await supabase.from(tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      console.warn(`Supabase Error purging table ${tableName}:`, error);
    }
  } catch (e) {
    console.warn(`Exception purging table ${tableName}:`, e);
  }
}

export async function sbSaveCompanyHub(hub: CompanyHub) {
  if (!isSupabaseConfigured || !supabase) return;
  const dbHub = mapCompanyHubToDb(hub);
  const { error } = await supabase.from('company_hubs').upsert(dbHub);
  if (error) {
    console.warn('Supabase Error writing company hub:', error);
    throw error;
  }
}

export async function sbDeleteCompanyHub(hubId: string) {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.from('company_hubs').delete().eq('id', hubId);
  if (error) {
    console.warn('Supabase Error deleting company hub:', error);
    throw error;
  }
}

export async function sbAddActivityLog(log: ActivityLog) {
  if (!isSupabaseConfigured || !supabase) return;
  const dbLog = mapActivityLogToDb(log);
  const { error } = await supabase.from('activity_logs').upsert(dbLog);
  if (error) {
    console.warn('Supabase Error writing log:', error);
    throw error;
  }
}

// ============================================================================
// CORE BULK MIGRATION ENGINE (Sync state to Supabase in one go)
// ============================================================================

export interface SyncStats {
  hubsCount: number;
  clientsCount: number;
  ridersCount: number;
  ordersCount: number;
  logsCount: number;
  txsCount: number;
}

export async function syncAllStateToSupabase(data: {
  hubs: CompanyHub[];
  clients: ClientPartner[];
  riders: DeliveryRider[];
  orders: Order[];
  logs: ActivityLog[];
  txs: FinancialTransaction[];
}): Promise<SyncStats> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured yet. Set credentials in env/secrets.');
  }

  // 1. Sync Company Hubs
  if (data.hubs.length > 0) {
    const dbHubs = data.hubs.map(mapCompanyHubToDb);
    const { error } = await supabase.from('company_hubs').upsert(dbHubs);
    if (error) throw new Error(`Error syncing company hubs: ${error.message}`);
  }

  // 2. Sync Riders
  if (data.riders.length > 0) {
    const dbRiders = data.riders.map(mapDeliveryRiderToDb);
    const { error } = await supabase.from('delivery_riders').upsert(dbRiders);
    if (error) throw new Error(`Error syncing riders: ${error.message}`);
  }

  // 3. Sync Clients
  if (data.clients.length > 0) {
    const dbClients = data.clients.map(mapClientPartnerToDb);
    const { error } = await supabase.from('client_partners').upsert(dbClients);
    if (error) throw new Error(`Error syncing client partners: ${error.message}`);
  }

  // 4. Sync Orders
  if (data.orders.length > 0) {
    const validRiderIds = new Set(data.riders.map(r => r.id));
    const dbOrders = data.orders.map(o => {
      const dbO = mapOrderToDb(o);
      if (dbO.rider_id && !validRiderIds.has(dbO.rider_id)) {
        dbO.rider_id = null;
      }
      return dbO;
    });
    const { error } = await supabase.from('orders').upsert(dbOrders);
    if (error) throw new Error(`Error syncing orders: ${error.message}`);
  }

  // 5. Sync Activity Logs
  if (data.logs.length > 0) {
    const dbLogs = data.logs.map(mapActivityLogToDb);
    const { error } = await supabase.from('activity_logs').upsert(dbLogs);
    if (error) throw new Error(`Error syncing activity logs: ${error.message}`);
  }

  // 6. Sync Transactions
  if (data.txs.length > 0) {
    const dbTxs = data.txs.map(mapFinancialTransactionToDb);
    const { error } = await supabase.from('financial_transactions').upsert(dbTxs);
    if (error) throw new Error(`Error syncing transactions: ${error.message}`);
  }

  return {
    hubsCount: data.hubs.length,
    clientsCount: data.clients.length,
    ridersCount: data.riders.length,
    ordersCount: data.orders.length,
    logsCount: data.logs.length,
    txsCount: data.txs.length
  };
}

// ============================================================================
// RETRIEVAL ENGINE (Load state from Supabase)
// ============================================================================

export interface SupabaseLoadedState {
  hubs: CompanyHub[];
  clients: ClientPartner[];
  riders: DeliveryRider[];
  orders: Order[];
  logs: ActivityLog[];
  txs: FinancialTransaction[];
}

export async function fetchAllStateFromSupabase(): Promise<SupabaseLoadedState> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  const [
    { data: hubs, error: hubsErr },
    { data: clients, error: clientsErr },
    { data: riders, error: ridersErr },
    { data: orders, error: ordersErr },
    { data: logs, error: logsErr },
    { data: txs, error: txsErr }
  ] = await Promise.all([
    supabase.from('company_hubs').select('*'),
    supabase.from('client_partners').select('*'),
    supabase.from('delivery_riders').select('*'),
    supabase.from('orders').select('*'),
    supabase.from('activity_logs').select('*'),
    supabase.from('financial_transactions').select('*')
  ]);

  if (hubsErr) throw hubsErr;
  if (clientsErr) throw clientsErr;
  if (ridersErr) throw ridersErr;
  if (ordersErr) throw ordersErr;
  if (logsErr) throw logsErr;
  if (txsErr) throw txsErr;

  return {
    hubs: (hubs || []).map(mapCompanyHubFromDb),
    clients: (clients || []).map(mapClientPartnerFromDb),
    riders: (riders || []).map(mapDeliveryRiderFromDb),
    orders: (orders || []).map(mapOrderFromDb),
    logs: (logs || []).map(mapActivityLogFromDb),
    txs: (txs || []).map(mapFinancialTransactionFromDb)
  };
}
