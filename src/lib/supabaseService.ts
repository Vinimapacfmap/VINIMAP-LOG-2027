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

// ============================================================================
// MAPPING HELPER FUNCTIONS (camelCase <-> snake_case)
// ============================================================================

export function mapOrderToDb(o: Order) {
  // Preserve and merge all vital delivery metadata, signatures, photos, and timestamps in raw_data JSON
  const existingRaw = o.rawData || {};
  const mergedRawData = {
    ...existingRaw,
    protocolNumber: o.protocolNumber || existingRaw.protocolNumber || existingRaw.NumeroProtocolo || existingRaw.protocolo,
    signatureUrl: o.signatureUrl || existingRaw.signatureUrl || existingRaw.signatureImage || existingRaw.assinatura,
    deliveryPhotoUrl: o.deliveryPhotoUrl || existingRaw.deliveryPhotoUrl || existingRaw.photoImage || existingRaw.fotoComprovante || existingRaw.foto,
    recipientName: o.recipientName || existingRaw.recipientName || existingRaw.Recebedor || existingRaw.recebedor,
    recipientDoc: o.recipientDoc || existingRaw.recipientDoc || existingRaw.DocumentoRecebedor || existingRaw.doc,
    deliveryDate: o.deliveryDate || o.dataConclusao || existingRaw.deliveryDate || existingRaw.DataConclusao || existingRaw.DataEntrega,
    deliveryTime: o.deliveryTime || o.horarioFinal || existingRaw.deliveryTime || existingRaw.HorarioFinal || existingRaw.HorarioEntrega,
    dataConclusao: o.dataConclusao || o.deliveryDate || existingRaw.dataConclusao || existingRaw.DataConclusao,
    horarioInicial: o.horarioInicial || o.createdAt || existingRaw.horarioInicial || existingRaw.HorarioInicio,
    horarioFinal: o.horarioFinal || o.deliveryTime || existingRaw.horarioFinal || existingRaw.HorarioFinal,
    occurrenceDate: o.occurrenceDate || existingRaw.occurrenceDate || existingRaw.DataOcorrencia,
    sequence: o.sequence ?? existingRaw.sequence,
    date: o.date || existingRaw.date || existingRaw.DataLancamento,
    status: o.status,
    priority: o.priority,
    value: o.value,
    deliveryValue: o.deliveryValue,
    driverValue: o.driverValue,
    riderId: o.riderId,
    clientName: o.clientName,
    phone: o.phone,
    address: o.address,
    region: o.region,
    cep: o.cep,
    history: o.history || existingRaw.history
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
    rider_id: o.riderId || null,
    items_count: o.itemsCount ?? 1,
    date: o.date,
    cep: o.cep || null,
    partner_name: o.partnerName || null,
    delivery_value: o.deliveryValue ?? 0,
    driver_value: o.driverValue ?? 0,
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

  const resolvedRiderId = row.rider_id 
    || rawDataObj?.riderId 
    || rawDataObj?.Condutor 
    || rawDataObj?.condutor 
    || rawDataObj?.NomeCondutor 
    || rawDataObj?.nomeCondutor 
    || rawDataObj?.Entregador 
    || rawDataObj?.entregador 
    || rawDataObj?.NomeEntregador 
    || rawDataObj?.Motorista 
    || rawDataObj?.motorista 
    || rawDataObj?.DispositivoCondutor 
    || rawDataObj?.dispositivoCondutor 
    || rawDataObj?.riderName 
    || undefined;

  const rawStatusCandidate = (
    row.status 
    || rawDataObj?.status 
    || rawDataObj?.Status 
    || rawDataObj?.Situacao 
    || rawDataObj?.situacao 
    || rawDataObj?.STATUS 
    || ''
  ).toString().trim();

  let resolvedStatus: OrderStatus = 'Não iniciado';
  const cleanStatus = rawStatusCandidate.toLowerCase();
  if (cleanStatus === 'concluído' || cleanStatus === 'concluido' || cleanStatus === 'entregue' || cleanStatus === 'finalizado' || cleanStatus === 'baixado' || protocolNumber || signatureUrl || deliveryPhotoUrl || dataConclusao) {
    resolvedStatus = 'Concluído';
  } else if (cleanStatus === 'ocorrência' || cleanStatus === 'ocorrencia' || cleanStatus === 'falha' || cleanStatus === 'devolvido' || occurrenceDate) {
    resolvedStatus = 'Ocorrência';
  } else if (cleanStatus === 'cancelado' || cleanStatus === 'cancelada') {
    resolvedStatus = 'Cancelado';
  } else if (cleanStatus === 'em trânsito' || cleanStatus === 'em transito' || cleanStatus === 'a caminho' || cleanStatus === 'em rota') {
    resolvedStatus = 'Em rota';
  } else if (cleanStatus === 'entregando') {
    resolvedStatus = 'Entregando';
  } else if (resolvedRiderId) {
    resolvedStatus = 'Não iniciado';
  }

  return {
    id: String(row.id),
    clientName: row.client_name || rawDataObj?.clientName || rawDataObj?.Cliente || rawDataObj?.cliente || 'Cliente',
    phone: row.phone || rawDataObj?.phone || rawDataObj?.Telefone || rawDataObj?.telefone || '',
    address: row.address || rawDataObj?.address || rawDataObj?.Endereco || rawDataObj?.endereco || '',
    region: row.region || rawDataObj?.region || rawDataObj?.Regiao || rawDataObj?.regiao || '',
    status: resolvedStatus,
    priority: row.priority || rawDataObj?.priority || 'Normal',
    value: Number(row.value ?? rawDataObj?.value ?? rawDataObj?.ValorEntrega ?? 0),
    riderId: resolvedRiderId,
    createdAt: row.created_at || horarioInicial || '08:00',
    itemsCount: row.items_count ?? rawDataObj?.itemsCount ?? 1,
    date: resolvedDate,
    cep: row.cep || rawDataObj?.cep || rawDataObj?.CEP || '',
    partnerName: row.partner_name || rawDataObj?.partnerName || rawDataObj?.NomeFantasia || rawDataObj?.CodigoCliente || '',
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
