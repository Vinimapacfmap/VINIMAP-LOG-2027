import { supabase, isSupabaseConfigured } from '../supabase';
import { 
  Order, 
  OrderStatus,
  ClientPartner, 
  DeliveryRider, 
  ActivityLog, 
  FinancialTransaction,
  CompanyHub 
} from '../types';
import { sanitizeOrdersListConsistency } from '../utils/orderConsistency';
import { extractISODateFromTimestamp, getSaoPauloISODate } from '../utils/dateUtils';
import { getPartnerDisplayName, getCachedClientPartners } from '../utils/partnerUtils';

// ============================================================================
// MAPPING HELPER FUNCTIONS (camelCase <-> snake_case)
// ============================================================================

export function mapOrderToDb(o: Order) {
  // Preserve and merge all vital delivery metadata, signatures, photos, and timestamps in raw_data JSON
  const existingRaw = o.rawData || {};
  const isUnassigned = !o.riderId || o.riderId === 'unassigned' || o.riderId === 'desalocar' || o.riderId === '';
  const cleanRawData = { ...existingRaw };
  
  if (isUnassigned) {
    delete cleanRawData.riderId;
    delete cleanRawData.Condutor;
    delete cleanRawData.condutor;
    delete cleanRawData.NomeCondutor;
    delete cleanRawData.nomeCondutor;
    delete cleanRawData.Entregador;
    delete cleanRawData.entregador;
    delete cleanRawData.Motorista;
    delete cleanRawData.motorista;
    delete cleanRawData.DispositivoCondutor;
    delete cleanRawData.dispositivoCondutor;
    delete cleanRawData.riderName;
  }

  const mergedRawData = {
    ...cleanRawData,
    protocolNumber: o.protocolNumber || cleanRawData.protocolNumber || cleanRawData.NumeroProtocolo || cleanRawData.protocolo,
    signatureUrl: o.signatureUrl || cleanRawData.signatureUrl || cleanRawData.signatureImage || cleanRawData.assinatura,
    deliveryPhotoUrl: o.deliveryPhotoUrl || cleanRawData.deliveryPhotoUrl || cleanRawData.photoImage || cleanRawData.fotoComprovante || cleanRawData.foto,
    recipientName: o.recipientName || cleanRawData.recipientName || cleanRawData.Recebedor || cleanRawData.recebedor,
    recipientDoc: o.recipientDoc || cleanRawData.recipientDoc || cleanRawData.DocumentoRecebedor || cleanRawData.doc,
    deliveryDate: o.deliveryDate || o.dataConclusao || cleanRawData.deliveryDate || cleanRawData.DataConclusao || cleanRawData.DataEntrega,
    deliveryTime: o.deliveryTime || o.horarioFinal || cleanRawData.deliveryTime || cleanRawData.HorarioFinal || cleanRawData.HorarioEntrega,
    dataConclusao: o.dataConclusao || o.deliveryDate || cleanRawData.dataConclusao || cleanRawData.DataConclusao,
    horarioInicial: o.horarioInicial || o.createdAt || cleanRawData.horarioInicial || cleanRawData.HorarioInicio,
    horarioFinal: o.horarioFinal || o.deliveryTime || cleanRawData.horarioFinal || cleanRawData.HorarioFinal,
    occurrenceDate: o.occurrenceDate || cleanRawData.occurrenceDate || cleanRawData.DataOcorrencia,
    sequence: o.sequence ?? cleanRawData.sequence,
    date: o.date || cleanRawData.date || cleanRawData.DataLancamento,
    status: o.status,
    priority: o.priority,
    value: o.value,
    deliveryValue: o.deliveryValue,
    driverValue: isUnassigned ? 0 : o.driverValue,
    riderId: isUnassigned ? undefined : o.riderId,
    clientName: o.clientName,
    phone: o.phone,
    address: o.address,
    region: o.region,
    cep: o.cep,
    history: o.history || cleanRawData.history
  };

  return {
    id: o.id,
    client_name: o.clientName,
    phone: o.phone,
    address: o.address,
    region: o.region,
    status: o.status,
    priority: o.priority,
    value: o.value,
    rider_id: isUnassigned ? null : o.riderId,
    items_count: o.itemsCount ?? 1,
    date: o.date,
    cep: o.cep || null,
    partner_name: getPartnerDisplayName(o.partnerName || (mergedRawData as any).partnerName || (mergedRawData as any).NomeFantasia || (mergedRawData as any).CodigoCliente || '', getCachedClientPartners()) || null,
    delivery_value: o.deliveryValue ?? 0,
    driver_value: isUnassigned ? 0 : (o.driverValue ?? 0),
    raw_data: JSON.stringify(mergedRawData),
    history: o.history ? JSON.stringify(o.history) : (mergedRawData.history ? JSON.stringify(mergedRawData.history) : null),
    protocol_number: o.protocolNumber || null,
    signature_url: o.signatureUrl || null,
    delivery_photo_url: o.deliveryPhotoUrl || null,
    recipient_name: o.recipientName || null,
    recipient_doc: o.recipientDoc || null,
    delivery_date: o.deliveryDate || o.dataConclusao || null,
    delivery_time: o.deliveryTime || o.horarioFinal || null,
    data_conclusao: o.dataConclusao || o.deliveryDate || null,
    horario_inicial: o.horarioInicial || o.createdAt || null,
    horario_final: o.horarioFinal || o.deliveryTime || null,
    sequence: o.sequence ?? null
  };
}

export function mapOrderFromDb(row: any): Order {
  const rawDataObj = row.raw_data ? (typeof row.raw_data === 'string' ? (() => {
    try { return JSON.parse(row.raw_data); } catch (_) { return undefined; }
  })() : row.raw_data) : undefined;
  
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

  const deliveryDate = row.delivery_date 
    || row.data_conclusao 
    || rawDataObj?.deliveryDate 
    || rawDataObj?.DataEntrega 
    || rawDataObj?.DataConclusao 
    || rawDataObj?.dataConclusao 
    || undefined;

  const deliveryTime = row.delivery_time 
    || row.horario_final 
    || rawDataObj?.deliveryTime 
    || rawDataObj?.HorarioEntrega 
    || rawDataObj?.HorarioFinal 
    || rawDataObj?.horarioFinal 
    || undefined;

  const dataConclusao = row.data_conclusao 
    || deliveryDate 
    || rawDataObj?.dataConclusao 
    || rawDataObj?.DataConclusao 
    || undefined;

  const horarioInicial = row.horario_inicial 
    || rawDataObj?.horarioInicial 
    || rawDataObj?.HorarioInicio 
    || rawDataObj?.horario_inicial 
    || row.created_at 
    || undefined;

  const horarioFinal = row.horario_final 
    || deliveryTime 
    || rawDataObj?.horarioFinal 
    || rawDataObj?.HorarioFinal 
    || undefined;

  const occurrenceDate = row.occurrence_date 
    || rawDataObj?.occurrenceDate 
    || rawDataObj?.DataOcorrencia 
    || undefined;

  const history = row.history 
    ? (typeof row.history === 'string' ? (() => {
        try { return JSON.parse(row.history); } catch (_) { return undefined; }
      })() : row.history) 
    : (rawDataObj?.history || undefined);

  const rawDateCandidate = row.date 
    || deliveryDate 
    || dataConclusao 
    || occurrenceDate 
    || rawDataObj?.date 
    || rawDataObj?.DataSolicitacao 
    || rawDataObj?.dataSolicitacao 
    || rawDataObj?.DataLancamento 
    || rawDataObj?.dataLancamento 
    || rawDataObj?.DataEntrega 
    || rawDataObj?.dataEntrega 
    || rawDataObj?.Data 
    || rawDataObj?.data 
    || rawDataObj?.DataAgendamento 
    || rawDataObj?.DataCriacao 
    || row.created_at;

  const resolvedDate = extractISODateFromTimestamp(rawDateCandidate) 
    || (typeof rawDateCandidate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDateCandidate) ? rawDateCandidate : undefined)
    || (row.date ? String(row.date) : undefined)
    || getSaoPauloISODate();

  let resolvedRiderId: string | undefined = undefined;
  if (row.rider_id !== undefined && row.rider_id !== null) {
    const cleanRowRider = String(row.rider_id).trim();
    if (cleanRowRider !== '' && cleanRowRider !== 'unassigned' && cleanRowRider !== 'desalocar' && cleanRowRider !== 'null' && cleanRowRider !== 'undefined') {
      resolvedRiderId = cleanRowRider;
    }
  } else if (rawDataObj?.riderId) {
    const cleanRaw = String(rawDataObj.riderId).trim();
    if (cleanRaw !== '' && cleanRaw !== 'unassigned' && cleanRaw !== 'desalocar' && cleanRaw !== 'null' && cleanRaw !== 'undefined') {
      resolvedRiderId = cleanRaw;
    }
  }

  const rawStatusCandidate = (
    row.status 
    || rawDataObj?.status 
    || rawDataObj?.Status 
    || rawDataObj?.Situacao 
    || rawDataObj?.situacao 
    || rawDataObj?.STATUS 
    || ''
  ).toString().trim();

  const hasAdminOverride = Boolean(
    rawDataObj?.adminOverride === true || 
    rawDataObj?.adminOverride === 'true' ||
    rawDataObj?.adminOverride === '1'
  );

  let resolvedStatus: OrderStatus = 'Não iniciado';
  const cleanStatus = rawStatusCandidate.toLowerCase();

  if (cleanStatus === 'concluído' || cleanStatus === 'concluido' || cleanStatus === 'entregue' || cleanStatus === 'finalizado' || cleanStatus === 'baixado') {
    resolvedStatus = 'Concluído';
  } else if (cleanStatus === 'ocorrência' || cleanStatus === 'ocorrencia' || cleanStatus === 'falha' || cleanStatus === 'devolvido') {
    resolvedStatus = 'Ocorrência';
  } else if (cleanStatus === 'cancelado' || cleanStatus === 'cancelada') {
    resolvedStatus = 'Cancelado';
  } else if (cleanStatus === 'em trânsito' || cleanStatus === 'em transito' || cleanStatus === 'a caminho' || cleanStatus === 'em rota' || cleanStatus === 'entregando') {
    resolvedStatus = 'Em rota';
  } else if (cleanStatus === 'não iniciado' || cleanStatus === 'nao iniciado' || cleanStatus === 'pendente') {
    resolvedStatus = 'Não iniciado';
  } else if (cleanStatus) {
    resolvedStatus = 'Não iniciado';
  } else {
    resolvedStatus = 'Não iniciado';
  }

  return {
    id: String(row.id),
    clientName: row.client_name || rawDataObj?.clientName || rawDataObj?.Cliente || rawDataObj?.cliente || 'Cliente',
    phone: row.phone || rawDataObj?.phone || rawDataObj?.Telefone || rawDataObj?.telefone || '',
    address: row.address || rawDataObj?.address || rawDataObj?.Endereco || rawDataObj?.endereco || '',
    region: row.region || rawDataObj?.region || rawDataObj?.Regiao || rawDataObj?.regiao || '',
    status: resolvedStatus,
    adminOverride: hasAdminOverride,
    statusUpdatedAt: rawDataObj?.statusUpdatedAt || row.updated_at || undefined,
    updatedAt: row.updated_at || rawDataObj?.updatedAt || undefined,
    priority: row.priority || rawDataObj?.priority || 'Normal',
    value: Number(row.value ?? rawDataObj?.value ?? rawDataObj?.ValorEntrega ?? 0),
    riderId: resolvedRiderId,
    createdAt: row.created_at || horarioInicial || '08:00',
    itemsCount: row.items_count ?? rawDataObj?.itemsCount ?? 1,
    date: resolvedDate,
    cep: row.cep || rawDataObj?.cep || rawDataObj?.CEP || '',
    partnerName: getPartnerDisplayName(row.partner_name || rawDataObj?.partnerName || rawDataObj?.NomeFantasia || rawDataObj?.CodigoCliente || '', getCachedClientPartners()) || '',
    deliveryValue: row.delivery_value !== null && row.delivery_value !== undefined ? Number(row.delivery_value) : (rawDataObj?.deliveryValue !== undefined ? Number(rawDataObj.deliveryValue) : undefined),
    driverValue: row.driver_value !== null && row.driver_value !== undefined ? Number(row.driver_value) : (rawDataObj?.driverValue !== undefined ? Number(rawDataObj.driverValue) : undefined),
    rawData: rawDataObj,
    history,
    protocolNumber,
    signatureUrl,
    deliveryPhotoUrl,
    recipientName,
    recipientDoc,
    deliveryDate,
    deliveryTime,
    dataConclusao,
    horarioInicial,
    horarioFinal,
    occurrenceDate,
    sequence: row.sequence !== null && row.sequence !== undefined ? Number(row.sequence) : (rawDataObj?.sequence !== undefined ? Number(rawDataObj.sequence) : undefined)
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
  if (!isSupabaseConfigured || !supabase) {
    console.log('[Supabase sbSaveOrder] Supabase not configured. Skipping remote write.');
    return;
  }
  try {
    console.log(`[Supabase sbSaveOrder] Upserting order #${order.id}...`);
    const dbOrder = mapOrderToDb(order);
    const { error } = await supabase.from('orders').upsert(dbOrder);
    if (!error) {
      console.log(`[Supabase sbSaveOrder] Order #${order.id} saved successfully to Supabase.`);
      return;
    }

    console.warn(`[Supabase sbSaveOrder] Full upsert failed for #${order.id}. Retrying with resilient base columns:`, error.message);

    // Fallback: Retain essential schema columns + raw_data (which holds 100% of rich attributes in JSON)
    const baseOrder = {
      id: dbOrder.id,
      client_name: dbOrder.client_name,
      phone: dbOrder.phone,
      address: dbOrder.address,
      region: dbOrder.region,
      status: dbOrder.status,
      priority: dbOrder.priority,
      value: dbOrder.value,
      rider_id: dbOrder.rider_id,
      items_count: dbOrder.items_count,
      date: dbOrder.date,
      cep: dbOrder.cep,
      partner_name: dbOrder.partner_name,
      delivery_value: dbOrder.delivery_value,
      driver_value: dbOrder.driver_value,
      raw_data: dbOrder.raw_data,
      history: dbOrder.history
    };

    const { error: fallbackError } = await supabase.from('orders').upsert(baseOrder);
    if (fallbackError) {
      // Secondary fallback with minimum standard columns
      const minOrder = {
        id: dbOrder.id,
        client_name: dbOrder.client_name,
        phone: dbOrder.phone,
        address: dbOrder.address,
        region: dbOrder.region,
        status: dbOrder.status,
        priority: dbOrder.priority,
        value: dbOrder.value,
        rider_id: dbOrder.rider_id,
        items_count: dbOrder.items_count,
        date: dbOrder.date,
        cep: dbOrder.cep,
        raw_data: dbOrder.raw_data
      };
      const { error: minErr } = await supabase.from('orders').upsert(minOrder);
      if (minErr) {
        console.warn(`[Supabase sbSaveOrder] Minimal upsert failed for order #${order.id}:`, minErr);
      } else {
        console.log(`[Supabase sbSaveOrder] Minimal fallback succeeded for order #${order.id}.`);
      }
    } else {
      console.log(`[Supabase sbSaveOrder] Base fallback succeeded for order #${order.id}.`);
    }
  } catch (err) {
    console.warn(`[Supabase sbSaveOrder] Exception saving order #${order.id}:`, err);
  }
}

export async function sbDeleteOrder(orderId: string) {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    console.log(`[Supabase sbDeleteOrder] Deleting order #${orderId}...`);
    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (error) {
      console.warn(`[Supabase sbDeleteOrder] Error deleting order #${orderId}:`, error);
    } else {
      console.log(`[Supabase sbDeleteOrder] Order #${orderId} deleted successfully.`);
    }
  } catch (err) {
    console.warn(`[Supabase sbDeleteOrder] Exception deleting order #${orderId}:`, err);
  }
}

export async function sbBulkSaveOrders(orders: Order[]): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase || !orders || orders.length === 0) return false;
  try {
    const chunks = chunkArray(orders, 30);
    for (const chunk of chunks) {
      const dbOrders = chunk.map(mapOrderToDb);
      const { error } = await supabase.from('orders').upsert(dbOrders);
      if (error) {
        // Fallback with base columns
        const baseOrders = dbOrders.map(dbOrder => ({
          id: dbOrder.id,
          client_name: dbOrder.client_name,
          phone: dbOrder.phone,
          address: dbOrder.address,
          region: dbOrder.region,
          status: dbOrder.status,
          priority: dbOrder.priority,
          value: dbOrder.value,
          rider_id: dbOrder.rider_id,
          items_count: dbOrder.items_count,
          date: dbOrder.date,
          cep: dbOrder.cep,
          partner_name: dbOrder.partner_name,
          delivery_value: dbOrder.delivery_value,
          driver_value: dbOrder.driver_value,
          raw_data: dbOrder.raw_data,
          history: dbOrder.history
        }));
        const { error: fallbackErr } = await supabase.from('orders').upsert(baseOrders);
        if (fallbackErr) {
          console.warn('[Supabase sbBulkSaveOrders] Fallback error saving orders chunk:', fallbackErr.message);
        }
      }
    }
    return true;
  } catch (err) {
    console.warn('[Supabase sbBulkSaveOrders] Exception saving orders in bulk:', err);
    return false;
  }
}

export async function sbSaveClientPartner(client: ClientPartner) {
  if (!isSupabaseConfigured || !supabase) {
    console.log('[Supabase sbSaveClientPartner] Supabase not configured. Skipping remote write.');
    return;
  }
  try {
    console.log(`[Supabase sbSaveClientPartner] Upserting client #${client.id} (${client.name})...`);
    const dbClient = mapClientPartnerToDb(client);
    const { error } = await supabase.from('client_partners').upsert(dbClient);
    if (error) {
      // If column missing in schema cache, attempt fallback without newly added optional columns
      if (error.message?.includes('enable_completion_notifications') || error.message?.includes('column') || error.code === 'PGRST204' || error.code === '42703') {
        console.warn(`[Supabase sbSaveClientPartner] Missing column in schema cache, retrying without optional columns...`);
        const { enable_completion_notifications, cep_ranges_history, ...fallbackClient } = dbClient as any;
        const { error: retryErr } = await supabase.from('client_partners').upsert(fallbackClient);
        if (retryErr) {
          console.warn(`[Supabase sbSaveClientPartner] Error saving client #${client.id} on retry:`, retryErr);
        }
        return;
      }
      console.warn(`[Supabase sbSaveClientPartner] Error saving client #${client.id}:`, error);
    } else {
      console.log(`[Supabase sbSaveClientPartner] Client #${client.id} saved successfully.`);
    }
  } catch (err) {
    console.warn(`[Supabase sbSaveClientPartner] Exception saving client #${client.id}:`, err);
  }
}

export async function sbDeleteClientPartner(clientId: string) {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    console.log(`[Supabase sbDeleteClientPartner] Deleting client #${clientId}...`);
    const { error } = await supabase.from('client_partners').delete().eq('id', clientId);
    if (error) {
      console.warn(`[Supabase sbDeleteClientPartner] Error deleting client #${clientId}:`, error);
    } else {
      console.log(`[Supabase sbDeleteClientPartner] Client #${clientId} deleted successfully.`);
    }
  } catch (err) {
    console.warn(`[Supabase sbDeleteClientPartner] Exception deleting client #${clientId}:`, err);
  }
}

export async function sbSaveDeliveryRider(rider: DeliveryRider) {
  if (!isSupabaseConfigured || !supabase) {
    console.log('[Supabase sbSaveDeliveryRider] Supabase not configured. Skipping remote write.');
    return;
  }
  try {
    console.log(`[Supabase sbSaveDeliveryRider] Upserting rider #${rider.id} (${rider.name})...`);
    const dbRider = mapDeliveryRiderToDb(rider);
    const { error } = await supabase.from('delivery_riders').upsert(dbRider);
    if (error) {
      console.warn(`[Supabase sbSaveDeliveryRider] Error saving rider #${rider.id}:`, error);
    } else {
      console.log(`[Supabase sbSaveDeliveryRider] Rider #${rider.id} saved successfully.`);
    }
  } catch (err) {
    console.warn(`[Supabase sbSaveDeliveryRider] Exception saving rider #${rider.id}:`, err);
  }
}

export async function sbDeleteDeliveryRider(riderId: string) {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    console.log(`[Supabase sbDeleteDeliveryRider] Deleting rider #${riderId}...`);
    const { error } = await supabase.from('delivery_riders').delete().eq('id', riderId);
    if (error) {
      console.warn(`[Supabase sbDeleteDeliveryRider] Error deleting rider #${riderId}:`, error);
    } else {
      console.log(`[Supabase sbDeleteDeliveryRider] Rider #${riderId} deleted successfully.`);
    }
  } catch (err) {
    console.warn(`[Supabase sbDeleteDeliveryRider] Exception deleting rider #${riderId}:`, err);
  }
}

export async function sbSaveFinancialTransaction(tx: FinancialTransaction) {
  if (!isSupabaseConfigured || !supabase) {
    console.log('[Supabase sbSaveFinancialTransaction] Supabase not configured. Skipping remote write.');
    return;
  }
  try {
    console.log(`[Supabase sbSaveFinancialTransaction] Upserting transaction #${tx.id}...`);
    const dbTx = mapFinancialTransactionToDb(tx);
    const { error } = await supabase.from('financial_transactions').upsert(dbTx);
    if (error) {
      console.warn(`[Supabase sbSaveFinancialTransaction] Error saving transaction #${tx.id}:`, error);
    } else {
      console.log(`[Supabase sbSaveFinancialTransaction] Transaction #${tx.id} saved successfully.`);
    }
  } catch (err) {
    console.warn(`[Supabase sbSaveFinancialTransaction] Exception saving transaction #${tx.id}:`, err);
  }
}

export async function sbDeleteFinancialTransaction(txId: string) {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const { error } = await supabase.from('financial_transactions').delete().eq('id', txId);
    if (error) {
      console.warn('Supabase Error deleting financial transaction:', error);
    }
  } catch (err) {
    console.warn('Supabase Exception deleting financial transaction:', err);
  }
}

export async function sbBulkDeleteFinancialTransactions(txIds: string[]) {
  if (!isSupabaseConfigured || !supabase || txIds.length === 0) return;
  // Delete in batches of 200
  for (let i = 0; i < txIds.length; i += 200) {
    const chunk = txIds.slice(i, i + 200);
    try {
      const { error } = await supabase.from('financial_transactions').delete().in('id', chunk);
      if (error) {
        console.warn('Supabase Error bulk deleting financial transactions:', error);
      }
    } catch (err) {
      console.warn('Supabase Exception bulk deleting financial transactions:', err);
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
  try {
    const dbHub = mapCompanyHubToDb(hub);
    const { error } = await supabase.from('company_hubs').upsert(dbHub);
    if (error) {
      console.warn('Supabase Error writing company hub:', error);
    }
  } catch (err) {
    console.warn('Supabase Exception writing company hub:', err);
  }
}

export async function sbDeleteCompanyHub(hubId: string) {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const { error } = await supabase.from('company_hubs').delete().eq('id', hubId);
    if (error) {
      console.warn('Supabase Error deleting company hub:', error);
    }
  } catch (err) {
    console.warn('Supabase Exception deleting company hub:', err);
  }
}

export async function sbAddActivityLog(log: ActivityLog) {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const dbLog = mapActivityLogToDb(log);
    const { error } = await supabase.from('activity_logs').upsert(dbLog);
    if (error) {
      console.warn('Supabase Error writing log:', error);
    }
  } catch (err) {
    console.warn('Supabase Exception writing log:', err);
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

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
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

  // 1. Sync Company Hubs in chunks
  if (data.hubs.length > 0) {
    const dbHubs = data.hubs.map(mapCompanyHubToDb);
    const hubChunks = chunkArray(dbHubs, 50);
    for (const chunk of hubChunks) {
      const { error } = await supabase.from('company_hubs').upsert(chunk);
      if (error) throw new Error(`Error syncing company hubs: ${error.message}`);
    }
  }

  // 2. Sync Riders in chunks
  if (data.riders.length > 0) {
    const dbRiders = data.riders.map(mapDeliveryRiderToDb);
    const riderChunks = chunkArray(dbRiders, 50);
    for (const chunk of riderChunks) {
      const { error } = await supabase.from('delivery_riders').upsert(chunk);
      if (error) throw new Error(`Error syncing riders: ${error.message}`);
    }
  }

  // 3. Sync Clients in chunks
  if (data.clients.length > 0) {
    const dbClients = data.clients.map(mapClientPartnerToDb);
    const clientChunks = chunkArray(dbClients, 50);
    for (const chunk of clientChunks) {
      const { error } = await supabase.from('client_partners').upsert(chunk);
      if (error) {
        if (error.message?.includes('enable_completion_notifications') || error.message?.includes('column') || error.code === 'PGRST204' || error.code === '42703') {
          console.warn('[Supabase Sync] Missing column in client_partners schema cache, retrying chunk without optional columns...');
          const fallbackChunk = chunk.map(c => {
            const { enable_completion_notifications, cep_ranges_history, ...rest } = c as any;
            return rest;
          });
          const { error: retryErr } = await supabase.from('client_partners').upsert(fallbackChunk);
          if (retryErr) throw new Error(`Error syncing client partners: ${retryErr.message}`);
        } else {
          throw new Error(`Error syncing client partners: ${error.message}`);
        }
      }
    }
  }

  // 4. Sync Orders in chunks (small chunk size of 30 to avoid PostgreSQL statement timeouts and payload size limits)
  if (data.orders.length > 0) {
    const validRiderIds = new Set(data.riders.map(r => r.id));
    const dbOrders = data.orders.map(o => {
      const dbO = mapOrderToDb(o);
      if (dbO.rider_id && !validRiderIds.has(dbO.rider_id)) {
        dbO.rider_id = null;
      }
      return dbO;
    });

    const orderChunks = chunkArray(dbOrders, 30);
    for (const chunk of orderChunks) {
      const { error } = await supabase.from('orders').upsert(chunk);
      if (error) {
        console.warn('[Supabase Sync] Orders chunk upsert failed, retrying chunk with base columns fallback...', error.message);
        const baseChunk = chunk.map(dbO => ({
          id: dbO.id,
          client_name: dbO.client_name,
          phone: dbO.phone,
          address: dbO.address,
          region: dbO.region,
          status: dbO.status,
          priority: dbO.priority,
          value: dbO.value,
          rider_id: dbO.rider_id,
          items_count: dbO.items_count,
          date: dbO.date,
          cep: dbO.cep,
          partner_name: dbO.partner_name,
          delivery_value: dbO.delivery_value,
          driver_value: dbO.driver_value,
          raw_data: dbO.raw_data,
          history: dbO.history
        }));
        const { error: retryErr } = await supabase.from('orders').upsert(baseChunk);
        if (retryErr) throw new Error(`Error syncing orders: ${retryErr.message}`);
      }
    }
  }

  // 5. Sync Activity Logs in chunks
  if (data.logs.length > 0) {
    const dbLogs = data.logs.map(mapActivityLogToDb);
    const logChunks = chunkArray(dbLogs, 50);
    for (const chunk of logChunks) {
      const { error } = await supabase.from('activity_logs').upsert(chunk);
      if (error) throw new Error(`Error syncing activity logs: ${error.message}`);
    }
  }

  // 6. Sync Transactions in chunks
  if (data.txs.length > 0) {
    const dbTxs = data.txs.map(mapFinancialTransactionToDb);
    const txChunks = chunkArray(dbTxs, 50);
    for (const chunk of txChunks) {
      const { error } = await supabase.from('financial_transactions').upsert(chunk);
      if (error) throw new Error(`Error syncing transactions: ${error.message}`);
    }
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

export interface TableSyncDiagnostic {
  tableName: 'company_hubs' | 'client_partners' | 'delivery_riders' | 'orders' | 'activity_logs' | 'financial_transactions';
  label: string;
  description: string;
  localCount: number;
  remoteCount: number | null;
  status: 'synced' | 'discrepancy' | 'missing_table' | 'permission_error' | 'column_mismatch' | 'error' | 'idle' | 'checking';
  latencyMs?: number;
  errorMessage?: string;
  actionHint?: string;
  sqlFix?: string;
  lastChecked?: string;
  missingColumns?: string[];
  isSyncing?: boolean;
}

export const TABLE_SQL_FIXES: Record<string, string> = {
  company_hubs: `-- Criar / Corrigir Tabela company_hubs
CREATE TABLE IF NOT EXISTS company_hubs (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    cnpj VARCHAR(20),
    address TEXT NOT NULL,
    cep VARCHAR(10) NOT NULL,
    lat NUMERIC(10, 6) NOT NULL,
    lng NUMERIC(10, 6) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    logo_url TEXT,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
ALTER TABLE company_hubs DISABLE ROW LEVEL SECURITY;
GRANT ALL ON company_hubs TO anon, authenticated, postgres, service_role;`,

  client_partners: `-- Criar / Corrigir Tabela client_partners
CREATE TABLE IF NOT EXISTS client_partners (
    id VARCHAR(100) PRIMARY KEY,
    codigo_cliente VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    region VARCHAR(100),
    tel VARCHAR(50),
    addr TEXT,
    status VARCHAR(50) DEFAULT 'Ativo',
    type VARCHAR(20) DEFAULT 'Parceiro',
    cnpj VARCHAR(20),
    cep VARCHAR(10),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    enable_completion_notifications BOOLEAN DEFAULT TRUE NOT NULL,
    cep_ranges JSONB DEFAULT '[]'::jsonb,
    cep_ranges_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
ALTER TABLE client_partners ADD COLUMN IF NOT EXISTS enable_completion_notifications BOOLEAN DEFAULT TRUE NOT NULL;
ALTER TABLE client_partners ADD COLUMN IF NOT EXISTS cep_ranges_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE client_partners DISABLE ROW LEVEL SECURITY;
GRANT ALL ON client_partners TO anon, authenticated, postgres, service_role;`,

  delivery_riders: `-- Criar / Corrigir Tabela delivery_riders
CREATE TABLE IF NOT EXISTS delivery_riders (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    avatar TEXT,
    vehicle VARCHAR(50) DEFAULT 'Moto',
    rating NUMERIC(3, 2) DEFAULT 5.0,
    status VARCHAR(50) DEFAULT 'Offline',
    phone VARCHAR(50),
    lat NUMERIC(10, 6) DEFAULT 0.0,
    lng NUMERIC(10, 6) DEFAULT 0.0,
    completed_deliveries INT DEFAULT 0,
    current_order_id VARCHAR(100),
    battery_percent INT DEFAULT 100,
    billing_model VARCHAR(50) DEFAULT 'misto',
    billing_fixed_fee NUMERIC(10, 2) DEFAULT 0.00,
    billing_variable_percent NUMERIC(5, 2) DEFAULT 0.00,
    billing_freight_percent NUMERIC(5, 2) DEFAULT 0.00,
    exibir_valor_turno BOOLEAN DEFAULT TRUE NOT NULL,
    ocultar_valores_protocolos BOOLEAN DEFAULT FALSE NOT NULL,
    autorizar_imprimir_recibo BOOLEAN DEFAULT FALSE NOT NULL,
    device_number VARCHAR(100),
    password VARCHAR(100),
    address TEXT,
    cpf_cnpj VARCHAR(20),
    vehicle_plate VARCHAR(20),
    cnh VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
ALTER TABLE delivery_riders ADD COLUMN IF NOT EXISTS autorizar_imprimir_recibo BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE delivery_riders DISABLE ROW LEVEL SECURITY;
GRANT ALL ON delivery_riders TO anon, authenticated, postgres, service_role;`,

  orders: `-- Criar / Corrigir Tabela orders
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(100) PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    address TEXT NOT NULL,
    region VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Não iniciado',
    priority VARCHAR(20) DEFAULT 'Média',
    value NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    rider_id VARCHAR(100),
    items_count INT DEFAULT 1 NOT NULL,
    date DATE NOT NULL,
    cep VARCHAR(10),
    partner_name VARCHAR(255),
    delivery_value NUMERIC(10, 2) DEFAULT 0.00,
    driver_value NUMERIC(10, 2) DEFAULT 0.00,
    raw_data JSONB DEFAULT '{}'::jsonb,
    history JSONB DEFAULT '[]'::jsonb,
    protocol_number VARCHAR(100),
    signature_url TEXT,
    delivery_photo_url TEXT,
    recipient_name VARCHAR(255),
    recipient_doc VARCHAR(50),
    delivery_date VARCHAR(50),
    delivery_time VARCHAR(50),
    data_conclusao VARCHAR(50),
    horario_inicial VARCHAR(50),
    horario_final VARCHAR(50),
    sequence INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS data_conclusao VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS horario_inicial VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS horario_final VARCHAR(50);
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_rider_id_fkey;
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date);
CREATE INDEX IF NOT EXISTS idx_orders_rider_id ON orders(rider_id);
CREATE INDEX IF NOT EXISTS idx_orders_partner ON orders(partner_name);
CREATE INDEX IF NOT EXISTS idx_orders_date_status_partner ON orders(date, status, partner_name);
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
GRANT ALL ON orders TO anon, authenticated, postgres, service_role;`,

  activity_logs: `-- Criar / Corrigir Tabela activity_logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id VARCHAR(100) PRIMARY KEY,
    time VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'info',
    order_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;
GRANT ALL ON activity_logs TO anon, authenticated, postgres, service_role;`,

  financial_transactions: `-- Criar / Corrigir Tabela financial_transactions
CREATE TABLE IF NOT EXISTS financial_transactions (
    id VARCHAR(100) PRIMARY KEY,
    description VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    due_date DATE NOT NULL,
    actual_payment_date DATE,
    category VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'Pendente',
    recipient_or_payer VARCHAR(255),
    payment_method VARCHAR(100),
    notes TEXT,
    cost_type VARCHAR(20),
    is_recurring BOOLEAN DEFAULT FALSE NOT NULL,
    recurrence_period VARCHAR(20),
    recurrence_installment INT,
    total_installments INT,
    parent_recurrence_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_financial_due_date ON financial_transactions(due_date);
CREATE INDEX IF NOT EXISTS idx_financial_type ON financial_transactions(type);
CREATE INDEX IF NOT EXISTS idx_financial_category ON financial_transactions(category);
ALTER TABLE financial_transactions DISABLE ROW LEVEL SECURITY;
GRANT ALL ON financial_transactions TO anon, authenticated, postgres, service_role;`
};

export async function checkTableSyncStatus(
  tableName: TableSyncDiagnostic['tableName'],
  localCount: number,
  customClient?: any
): Promise<TableSyncDiagnostic> {
  const activeClient = customClient || supabase;
  const labels: Record<TableSyncDiagnostic['tableName'], { label: string; desc: string }> = {
    company_hubs: { label: 'Sedes & Hubs (company_hubs)', desc: 'Matriz e centros de distribuição para cálculo de rotas e coordenadas' },
    client_partners: { label: 'Clientes & Parceiros (client_partners)', desc: 'Contratos, faixas de CEP customizadas e regras de frete' },
    delivery_riders: { label: 'Entregadores & Frota (delivery_riders)', desc: 'Condutores, modelos de repasse, senhas e status de conexão' },
    orders: { label: 'Pedidos & Entregas (orders)', desc: 'Rastreamento, histórico de ocorrências, comprovantes e valores' },
    activity_logs: { label: 'Auditoria & Logs (activity_logs)', desc: 'Registro histórico de eventos e alterações do sistema' },
    financial_transactions: { label: 'Financeiro (financial_transactions)', desc: 'Contas a pagar/receber, repasses e fluxo de caixa' }
  };

  const info = labels[tableName] || { label: tableName, desc: 'Tabela PostgreSQL' };
  const nowStr = new Date().toLocaleTimeString('pt-BR');

  if (!isSupabaseConfigured && !customClient) {
    return {
      tableName,
      label: info.label,
      description: info.desc,
      localCount,
      remoteCount: null,
      status: 'idle',
      errorMessage: 'Supabase não configurado.',
      actionHint: 'Insira a URL e a Anon API Key nas configurações do Supabase.',
      sqlFix: TABLE_SQL_FIXES[tableName],
      lastChecked: nowStr
    };
  }

  const startTime = performance.now();

  try {
    // 1. Test basic existence, RLS and get count
    const { count, error } = await activeClient
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    const latencyMs = Math.round(performance.now() - startTime);

    if (error) {
      const errMsg = error.message || String(error);
      const errCode = error.code;

      // Table does not exist (Postgres code 42P01 or PostgREST PGRST204)
      if (
        errCode === '42P01' || 
        errCode === 'PGRST204' || 
        errMsg.includes('does not exist') || 
        errMsg.includes('Could not find the table') || 
        errMsg.includes('relation')
      ) {
        return {
          tableName,
          label: info.label,
          description: info.desc,
          localCount,
          remoteCount: null,
          status: 'missing_table',
          latencyMs,
          errorMessage: `Tabela "${tableName}" não existe no schema public do PostgreSQL.`,
          actionHint: `Copie o SQL de criação desta tabela e execute no "SQL Editor" do Supabase.`,
          sqlFix: TABLE_SQL_FIXES[tableName],
          lastChecked: nowStr
        };
      }

      // RLS Permission blocking (Postgres 42501 or RLS policy)
      if (
        errCode === '42501' || 
        errMsg.includes('row-level security') || 
        errMsg.includes('RLS') || 
        errMsg.includes('policy')
      ) {
        return {
          tableName,
          label: info.label,
          description: info.desc,
          localCount,
          remoteCount: null,
          status: 'permission_error',
          latencyMs,
          errorMessage: `Políticas de RLS estão bloqueando leitura/gravação na tabela "${tableName}".`,
          actionHint: `Desative o RLS executando "ALTER TABLE ${tableName} DISABLE ROW LEVEL SECURITY; GRANT ALL ON ${tableName} TO anon;".`,
          sqlFix: TABLE_SQL_FIXES[tableName],
          lastChecked: nowStr
        };
      }

      // Missing column or schema cache error
      if (errMsg.includes('column') || errCode === 'PGRST204') {
        return {
          tableName,
          label: info.label,
          description: info.desc,
          localCount,
          remoteCount: null,
          status: 'column_mismatch',
          latencyMs,
          errorMessage: `Discrepância de colunas no schema: ${errMsg}`,
          actionHint: `Execute o script de migração para adicionar as colunas faltantes e recarregar o schema cache.`,
          sqlFix: TABLE_SQL_FIXES[tableName],
          lastChecked: nowStr
        };
      }

      return {
        tableName,
        label: info.label,
        description: info.desc,
        localCount,
        remoteCount: null,
        status: 'error',
        latencyMs,
        errorMessage: errMsg,
        actionHint: 'Verifique a conexão de rede e as credenciais do Supabase.',
        sqlFix: TABLE_SQL_FIXES[tableName],
        lastChecked: nowStr
      };
    }

    const remoteCount = count ?? 0;

    // Check for specific columns based on table
    const missingCols: string[] = [];
    if (tableName === 'client_partners') {
      const colCheck = await activeClient.from('client_partners').select('enable_completion_notifications, cep_ranges_history').limit(1);
      if (colCheck.error && (colCheck.error.message.includes('column') || colCheck.error.code === 'PGRST204')) {
        missingCols.push('enable_completion_notifications', 'cep_ranges_history');
      }
    } else if (tableName === 'delivery_riders') {
      const colCheck = await activeClient.from('delivery_riders').select('autorizar_imprimir_recibo').limit(1);
      if (colCheck.error && (colCheck.error.message.includes('column') || colCheck.error.code === 'PGRST204')) {
        missingCols.push('autorizar_imprimir_recibo');
      }
    } else if (tableName === 'orders') {
      const colCheck = await activeClient.from('orders').select('data_conclusao, horario_inicial, horario_final').limit(1);
      if (colCheck.error && (colCheck.error.message.includes('column') || colCheck.error.code === 'PGRST204')) {
        missingCols.push('data_conclusao', 'horario_inicial', 'horario_final');
      }
    }

    if (missingCols.length > 0) {
      return {
        tableName,
        label: info.label,
        description: info.desc,
        localCount,
        remoteCount,
        status: 'column_mismatch',
        latencyMs,
        missingColumns: missingCols,
        errorMessage: `Colunas adicionais não encontradas no PostgreSQL: ${missingCols.join(', ')}.`,
        actionHint: `Execute o script SQL da tabela para adicionar as novas colunas.`,
        sqlFix: TABLE_SQL_FIXES[tableName],
        lastChecked: nowStr
      };
    }

    if (remoteCount === localCount) {
      return {
        tableName,
        label: info.label,
        description: info.desc,
        localCount,
        remoteCount,
        status: 'synced',
        latencyMs,
        actionHint: 'Tabela 100% sincronizada com o banco PostgreSQL.',
        sqlFix: TABLE_SQL_FIXES[tableName],
        lastChecked: nowStr
      };
    } else {
      const diff = localCount - remoteCount;
      const diffText = diff > 0 
        ? `${diff} registro(s) pendente(s) de envio ao Supabase`
        : `${Math.abs(diff)} registro(s) a mais no Supabase (pendente de download)`;

      return {
        tableName,
        label: info.label,
        description: info.desc,
        localCount,
        remoteCount,
        status: 'discrepancy',
        latencyMs,
        errorMessage: `Discrepância na contagem: ${diffText}.`,
        actionHint: diff > 0 
          ? 'Clique em "Enviar Esta Tabela" para gravar as pendências no Supabase.'
          : 'Clique em "Carregar do Supabase" ou faça o sincronismo bidirecional.',
        sqlFix: TABLE_SQL_FIXES[tableName],
        lastChecked: nowStr
      };
    }
  } catch (err: any) {
    return {
      tableName,
      label: info.label,
      description: info.desc,
      localCount,
      remoteCount: null,
      status: 'error',
      errorMessage: err.message || String(err),
      actionHint: 'Falha de comunicação com o servidor Supabase.',
      sqlFix: TABLE_SQL_FIXES[tableName],
      lastChecked: nowStr
    };
  }
}

export async function syncSingleTableToSupabase(
  tableName: TableSyncDiagnostic['tableName'],
  dataset: {
    hubs?: CompanyHub[];
    clients?: ClientPartner[];
    riders?: DeliveryRider[];
    orders?: Order[];
    logs?: ActivityLog[];
    txs?: FinancialTransaction[];
  }
): Promise<number> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não está configurado.');
  }

  if (tableName === 'company_hubs') {
    const items = (dataset.hubs || []).map(mapCompanyHubToDb);
    if (items.length === 0) return 0;
    const chunks = chunkArray(items, 50);
    for (const chunk of chunks) {
      const { error } = await supabase.from('company_hubs').upsert(chunk);
      if (error) throw new Error(error.message);
    }
    return items.length;
  }

  if (tableName === 'client_partners') {
    const items = (dataset.clients || []).map(mapClientPartnerToDb);
    if (items.length === 0) return 0;
    const chunks = chunkArray(items, 50);
    for (const chunk of chunks) {
      const { error } = await supabase.from('client_partners').upsert(chunk);
      if (error) {
        if (error.message?.includes('column') || error.code === 'PGRST204') {
          const fallbackChunk = chunk.map(c => {
            const { enable_completion_notifications, cep_ranges_history, ...rest } = c as any;
            return rest;
          });
          const { error: retryErr } = await supabase.from('client_partners').upsert(fallbackChunk);
          if (retryErr) throw new Error(retryErr.message);
        } else {
          throw new Error(error.message);
        }
      }
    }
    return items.length;
  }

  if (tableName === 'delivery_riders') {
    const items = (dataset.riders || []).map(mapDeliveryRiderToDb);
    if (items.length === 0) return 0;
    const chunks = chunkArray(items, 50);
    for (const chunk of chunks) {
      const { error } = await supabase.from('delivery_riders').upsert(chunk);
      if (error) throw new Error(error.message);
    }
    return items.length;
  }

  if (tableName === 'orders') {
    const validRiderIds = new Set((dataset.riders || []).map(r => r.id));
    const items = (dataset.orders || []).map(o => {
      const dbO = mapOrderToDb(o);
      if (dbO.rider_id && !validRiderIds.has(dbO.rider_id)) {
        dbO.rider_id = null;
      }
      return dbO;
    });
    if (items.length === 0) return 0;
    const chunks = chunkArray(items, 30);
    for (const chunk of chunks) {
      const { error } = await supabase.from('orders').upsert(chunk);
      if (error) {
        const baseChunk = chunk.map(dbO => ({
          id: dbO.id,
          client_name: dbO.client_name,
          phone: dbO.phone,
          address: dbO.address,
          region: dbO.region,
          status: dbO.status,
          priority: dbO.priority,
          value: dbO.value,
          rider_id: dbO.rider_id,
          items_count: dbO.items_count,
          date: dbO.date,
          cep: dbO.cep,
          partner_name: dbO.partner_name,
          delivery_value: dbO.delivery_value,
          driver_value: dbO.driver_value,
          raw_data: dbO.raw_data,
          history: dbO.history
        }));
        const { error: retryErr } = await supabase.from('orders').upsert(baseChunk);
        if (retryErr) throw new Error(retryErr.message);
      }
    }
    return items.length;
  }

  if (tableName === 'activity_logs') {
    const items = (dataset.logs || []).map(mapActivityLogToDb);
    if (items.length === 0) return 0;
    const chunks = chunkArray(items, 50);
    for (const chunk of chunks) {
      const { error } = await supabase.from('activity_logs').upsert(chunk);
      if (error) throw new Error(error.message);
    }
    return items.length;
  }

  if (tableName === 'financial_transactions') {
    const items = (dataset.txs || []).map(mapFinancialTransactionToDb);
    if (items.length === 0) return 0;
    const chunks = chunkArray(items, 50);
    for (const chunk of chunks) {
      const { error } = await supabase.from('financial_transactions').upsert(chunk);
      if (error) throw new Error(error.message);
    }
    return items.length;
  }

  return 0;
}

export async function fetchSingleTableFromSupabase(
  tableName: TableSyncDiagnostic['tableName']
): Promise<any[]> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não está configurado.');
  }
  const { data, error } = await safeQueryTable(tableName);
  if (error) throw new Error(`Erro ao buscar dados de ${tableName}: ${error.message || error}`);
  return data || [];
}


export interface SupabaseLoadedState {
  hubs: CompanyHub[];
  clients: ClientPartner[];
  riders: DeliveryRider[];
  orders: Order[];
  logs: ActivityLog[];
  txs: FinancialTransaction[];
}

async function safeQueryTable(tableName: string) {
  try {
    if (!supabase) return { data: [], error: null };
    const res = await supabase.from(tableName).select('*').limit(50000);
    return { data: res.data || [], error: res.error };
  } catch (err) {
    console.warn(`[safeQueryTable] Exception fetching table ${tableName}:`, err);
    return { data: [], error: err };
  }
}

export async function fetchAllStateFromSupabase(): Promise<SupabaseLoadedState> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  try {
    const [
      { data: hubs, error: hubsErr },
      { data: clients, error: clientsErr },
      { data: riders, error: ridersErr },
      { data: orders, error: ordersErr },
      { data: logs, error: logsErr },
      { data: txs, error: txsErr }
    ] = await Promise.all([
      safeQueryTable('company_hubs'),
      safeQueryTable('client_partners'),
      safeQueryTable('delivery_riders'),
      safeQueryTable('orders'),
      safeQueryTable('activity_logs'),
      safeQueryTable('financial_transactions')
    ]);

    if (hubsErr) console.warn('Supabase hubs query warning:', hubsErr);
    if (clientsErr) console.warn('Supabase clients query warning:', clientsErr);
    if (ridersErr) console.warn('Supabase riders query warning:', ridersErr);
    if (ordersErr) console.warn('Supabase orders query warning:', ordersErr);
    if (logsErr) console.warn('Supabase logs query warning:', logsErr);
    if (txsErr) console.warn('Supabase txs query warning:', txsErr);

    const mappedOrders = (orders || []).map(mapOrderFromDb);
    const { orders: sanitizedOrders } = sanitizeOrdersListConsistency(mappedOrders);

    return {
      hubs: (hubs || []).map(mapCompanyHubFromDb),
      clients: (clients || []).map(mapClientPartnerFromDb),
      riders: (riders || []).map(mapDeliveryRiderFromDb),
      orders: sanitizedOrders,
      logs: (logs || []).map(mapActivityLogFromDb),
      txs: (txs || []).map(mapFinancialTransactionFromDb)
    };
  } catch (err: any) {
    console.warn('[fetchAllStateFromSupabase] Exception loading state from Supabase:', err);
    return {
      hubs: [],
      clients: [],
      riders: [],
      orders: [],
      logs: [],
      txs: []
    };
  }
}
