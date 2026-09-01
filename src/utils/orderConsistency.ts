/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Order, OrderStatus, ClientPartner, DeliveryRider } from '../types';
import { getSaoPauloISODate, extractISODateFromTimestamp } from './dateUtils';

/**
 * Normalizes any date string (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD-MM, DD/MM) to YYYY-MM-DD format for ISO comparison.
 */
export function normalizeToISODate(dateStr?: string): string {
  if (!dateStr) return '';
  const clean = (dateStr || '').toString().trim();
  const extracted = extractISODateFromTimestamp(clean);
  if (extracted) return extracted;
  return clean;
}

/**
 * Checks if an order has physical, digital, or historical evidence of completion.
 * Used only for informational verification and reporting.
 */
export function hasOrderCompletionEvidence(order: Order): boolean {
  if (!order) return false;

  // Real digital / physical Proof of Delivery (POD)
  const hasSignature = Boolean(order.signatureUrl && (order.signatureUrl || '').toString().trim() !== '');
  const hasPhoto = Boolean(order.deliveryPhotoUrl && (order.deliveryPhotoUrl || '').toString().trim() !== '');
  const hasDataConclusao = Boolean(order.dataConclusao && (order.dataConclusao || '').toString().trim() !== '');

  const hasCompletionHistory = Boolean(
    order.history &&
    order.history.some(h => {
      const text = `${h.action || ''} ${h.details || ''}`.toLowerCase();
      return (
        text.includes('concluí') ||
        text.includes('conclui') ||
        text.includes('baixa confirmada') ||
        text.includes('entregue com sucesso')
      );
    })
  );

  return (
    hasSignature ||
    hasPhoto ||
    hasDataConclusao ||
    hasCompletionHistory
  );
}

/**
 * Sanitizes a single order for structural consistency without modifying its status automatically.
 * Order status is authoritative and can ONLY be changed via explicit operator or driver action.
 */
export function sanitizeOrderConsistency(
  order: Order,
  todayIso: string = getSaoPauloISODate()
): { order: Order; modified: boolean } {
  if (!order) return { order, modified: false };

  let isModified = false;
  const updated = { ...order };

  // Normalize order date
  if (!updated.date || (updated.date || '').toString().trim() === '') {
    const fallbackDate = updated.deliveryDate 
      || updated.dataConclusao 
      || updated.occurrenceDate 
      || updated.rawData?.DataSolicitacao 
      || updated.rawData?.dataSolicitacao 
      || updated.rawData?.DataLancamento 
      || updated.rawData?.dataLancamento 
      || updated.rawData?.DataEntrega 
      || updated.rawData?.dataEntrega 
      || updated.rawData?.Data 
      || updated.rawData?.data 
      || updated.rawData?.DataAgendamento 
      || updated.rawData?.DataCriacao;
    if (fallbackDate) {
      updated.date = normalizeToISODate(fallbackDate);
      isModified = true;
    }
  }

  // Normalize riderId - handle object and empty/placeholder values
  if (updated.riderId && typeof updated.riderId === 'object') {
    const obj: any = updated.riderId;
    updated.riderId = obj.id || obj.name || obj.deviceNumber || undefined;
    isModified = true;
  }

  if (updated.riderId) {
    const cleanRiderId = (updated.riderId || '').toString().trim();
    const isPlaceholder = cleanRiderId === '' || 
      cleanRiderId.toLowerCase() === 'unassigned' || 
      cleanRiderId.toLowerCase() === 'desalocar' || 
      cleanRiderId.toLowerCase() === 'nao alocado' || 
      cleanRiderId.toLowerCase() === 'não alocado' || 
      cleanRiderId.toLowerCase() === 'nao vinculado' || 
      cleanRiderId.toLowerCase() === 'não vinculado' || 
      cleanRiderId.toLowerCase() === 'sem condutor' || 
      cleanRiderId.toLowerCase() === 'null' || 
      cleanRiderId.toLowerCase() === 'undefined';

    if (isPlaceholder) {
      updated.riderId = undefined;
      isModified = true;
    } else if (updated.riderId !== cleanRiderId) {
      updated.riderId = cleanRiderId;
      isModified = true;
    }
  }

  // If order is unassigned, ensure driverValue is 0 and driver candidate fields are clean
  if (!updated.riderId && updated.rawData) {
    const rawRider = (
      updated.rawData.riderId ||
      updated.rawData.driverId ||
      updated.rawData.Motorista ||
      updated.rawData.motorista ||
      updated.rawData.Entregador ||
      updated.rawData.entregador ||
      updated.rawData.Condutor ||
      updated.rawData.condutor
    );
    if (rawRider && typeof rawRider === 'string' && rawRider.trim() !== '') {
      const cleanRawRider = rawRider.trim();
      const isPlaceholder = cleanRawRider.toLowerCase() === 'unassigned' || 
        cleanRawRider.toLowerCase() === 'desalocar' || 
        cleanRawRider.toLowerCase() === 'nao alocado' || 
        cleanRawRider.toLowerCase() === 'não alocado' || 
        cleanRawRider.toLowerCase() === 'nao vinculado' || 
        cleanRawRider.toLowerCase() === 'não vinculado' || 
        cleanRawRider.toLowerCase() === 'sem condutor' || 
        cleanRawRider.toLowerCase() === 'null' || 
        cleanRawRider.toLowerCase() === 'undefined';
      if (!isPlaceholder) {
        updated.riderId = cleanRawRider;
        isModified = true;
      }
    }
  }

  if (!updated.riderId) {
    if (updated.driverValue && updated.driverValue > 0) {
      updated.driverValue = 0;
      isModified = true;
    }
    if ((updated as any).driverId) {
      delete (updated as any).driverId;
      isModified = true;
    }
    if ((updated as any).assignedDriver) {
      delete (updated as any).assignedDriver;
      isModified = true;
    }
    if ((updated as any).entregadorId) {
      delete (updated as any).entregadorId;
      isModified = true;
    }
    if ((updated as any).motoristaId) {
      delete (updated as any).motoristaId;
      isModified = true;
    }
  }

  // Authoritative Status Preservation:
  // Status MUST NOT be changed automatically based on recipientName or protocolNumber.
  // Only explicit user/driver action or explicit spreadsheet status sets 'Concluído'.
  const VALID_STATUSES: OrderStatus[] = ['Não iniciado', 'Em rota', 'Concluído', 'Cancelado', 'Ocorrência'];
  
  const rawSt = (updated.rawData?.status || updated.rawData?.Status || updated.rawData?.Situacao || '').toString().trim().toLowerCase();
  const isExplicitlyConcluidoInRaw = rawSt === 'concluído' || rawSt === 'concluido' || rawSt === 'entregue' || rawSt === 'baixado';

  if (updated.status === 'Concluído' || isExplicitlyConcluidoInRaw) {
    if (updated.status !== 'Concluído') {
      updated.status = 'Concluído';
      isModified = true;
    }
  } else if ((updated.status as string) === 'Entregando' || (updated.status as string) === 'Em Trânsito' || rawSt === 'em rota' || rawSt === 'entregando') {
    if (updated.status !== 'Em rota') {
      updated.status = 'Em rota';
      isModified = true;
    }
  } else if (updated.status === 'Ocorrência' || rawSt === 'ocorrência' || rawSt === 'ocorrencia') {
    if (updated.status !== 'Ocorrência') {
      updated.status = 'Ocorrência';
      isModified = true;
    }
  } else if (updated.status === 'Cancelado' || rawSt === 'cancelado' || rawSt === 'cancelada') {
    if (updated.status !== 'Cancelado') {
      updated.status = 'Cancelado';
      isModified = true;
    }
  } else if (!updated.status || !VALID_STATUSES.includes(updated.status)) {
    updated.status = 'Não iniciado';
    isModified = true;
  }

  // Sync rawData status with authoritative order.status so that rawData does not have conflicting stale status
  if (updated.rawData && updated.status) {
    if (updated.rawData.status !== updated.status || updated.rawData.Situacao !== updated.status || updated.rawData.Status !== updated.status) {
      updated.rawData.status = updated.status;
      updated.rawData.Situacao = updated.status;
      updated.rawData.Status = updated.status;
      isModified = true;
    }
  }

  // Sync rawData rider fields with authoritative order.riderId when assigned
  if (updated.rawData && updated.riderId) {
    const cleanRiderId = (updated.riderId || '').toString().trim();
    if (cleanRiderId && cleanRiderId !== 'unassigned' && cleanRiderId !== 'desalocar') {
      if (updated.rawData.riderId !== cleanRiderId) {
        updated.rawData.riderId = cleanRiderId;
        isModified = true;
      }
    }
  }

  // Restore auxiliary fields from rawData if missing in root
  if (updated.rawData) {
    if (!updated.protocolNumber && (updated.rawData.NumeroProtocolo || updated.rawData.protocolNumber || updated.rawData.protocolo)) {
      updated.protocolNumber = updated.rawData.NumeroProtocolo || updated.rawData.protocolNumber || updated.rawData.protocolo;
      isModified = true;
    }
    if (!updated.signatureUrl && (updated.rawData.signatureUrl || updated.rawData.signatureImage || updated.rawData.assinatura)) {
      updated.signatureUrl = updated.rawData.signatureUrl || updated.rawData.signatureImage || updated.rawData.assinatura;
      isModified = true;
    }
    if (!updated.deliveryPhotoUrl && (updated.rawData.deliveryPhotoUrl || updated.rawData.photoImage || updated.rawData.fotoComprovante || updated.rawData.foto)) {
      updated.deliveryPhotoUrl = updated.rawData.deliveryPhotoUrl || updated.rawData.photoImage || updated.rawData.fotoComprovante || updated.rawData.foto;
      isModified = true;
    }
    if (!updated.recipientName && (updated.rawData.Recebedor || updated.rawData.recipientName || updated.rawData.recebedor)) {
      updated.recipientName = updated.rawData.Recebedor || updated.rawData.recipientName || updated.rawData.recebedor;
      isModified = true;
    }
    if (!updated.recipientDoc && (updated.rawData.DocumentoRecebedor || updated.rawData.recipientDoc || updated.rawData.doc)) {
      updated.recipientDoc = updated.rawData.DocumentoRecebedor || updated.rawData.recipientDoc || updated.rawData.doc;
      isModified = true;
    }
  }

  const orderIsoDate = normalizeToISODate(updated.date) || todayIso;

  // Rule 1: Populate completion or occurrence dates/times ONLY if status is 'Concluído' or 'Ocorrência'.
  if (updated.status === 'Concluído') {
    if (!updated.deliveryDate) {
      const rawDeliveryDate = updated.rawData?.deliveryDate || updated.rawData?.DataEntrega || updated.rawData?.DataConclusao || updated.rawData?.dataconclusao;
      updated.deliveryDate = updated.dataConclusao || (rawDeliveryDate ? normalizeToISODate(rawDeliveryDate) : '') || orderIsoDate || todayIso;
      isModified = true;
    }
    if (!updated.dataConclusao) {
      const rawDataConclusao = updated.rawData?.dataConclusao || updated.rawData?.DataConclusao || updated.rawData?.DataEntrega || updated.rawData?.deliveryDate;
      updated.dataConclusao = updated.deliveryDate || (rawDataConclusao ? normalizeToISODate(rawDataConclusao) : '') || orderIsoDate || todayIso;
      isModified = true;
    }
    if (!updated.deliveryTime && updated.horarioFinal) {
      updated.deliveryTime = updated.horarioFinal;
      isModified = true;
    }
    if (!updated.horarioFinal && updated.deliveryTime) {
      updated.horarioFinal = updated.deliveryTime;
      isModified = true;
    }
    if (!updated.protocolNumber) {
      updated.protocolNumber = `PROT-${(updated.id || 'PED').replace('ped-', '').toUpperCase()}`;
      isModified = true;
    }
    if (!updated.recipientName) {
      updated.recipientName = updated.clientName || 'Recebedor Titular';
      isModified = true;
    }
  }

  if (updated.status === 'Ocorrência') {
    if (!updated.occurrenceDate) {
      updated.occurrenceDate = updated.deliveryDate || updated.dataConclusao || orderIsoDate || todayIso;
      isModified = true;
    }
    if (!updated.deliveryDate) {
      updated.deliveryDate = updated.occurrenceDate || orderIsoDate || todayIso;
      isModified = true;
    }
  }

  return { order: updated, modified: isModified };
}

export const MOCK_CLIENT_IDS = [
  'CL1-001', 'CL1-002', 'CL1-003', 'CL1-004', 'CL1-005', 'CL1-006', 'CL1-007', 'CL1-008', 'CL1-009', 'CL1-010', 'CL1-011', 'CL1-012', 'CL1-013', 'CL1-014',
  'cli-1', 'cli-2', 'cli-3', 'cli-4', 'cli-5', 'cli-6', 'cli-7',
  'cli-001', 'cli-002', 'cli-003', 'cli-004', 'cli-005', 'cli-006', 'cli-007', 'cli-014',
  'par-001', 'par-002', 'par-003', 'par-004', 'par-005', 'par-006', 'par-007', 'par-014',
  'par-1', 'par-2', 'par-3', 'par-4', 'par-5'
];

export const MOCK_RIDER_IDS = [
  'ent-1', 'ent-2', 'ent-3', 'ent-4', 'ent-5',
  'rid-1', 'rid-2', 'rid-3', 'rid-4', 'rid-5',
  'mot-1', 'mot-2', 'mot-3', 'mot-4', 'mot-5'
];

export const MOCK_PARTNER_NAMES = [
  'ana silva',
  'pedro santos',
  'mariana costa',
  'beatriz lima',
  'carlos eduardo',
  'fernanda oliveira',
  'lucas mendes',
  'cliente parceiro 014',
  'burger king paulista',
  'bella augusta',
  'ponto av. paulista',
  'ponto haddock lobo',
  'ponto alameda lorena',
  'ponto faria lima',
  'ponto rua augusta',
  'ponto rua pamplona',
  'ponto paulista express',
  'livraria cultura',
  'sesc pompeia',
  'tech hub berrini',
  'hospital santa cruz',
  'distribuidora santana',
  'comercial tatuapé',
  'parceiro geral',
  'exemplo parceiro'
];

export const MOCK_RIDER_NAMES = [
  'marcos silva',
  'lucas santos',
  'matheus oliveira',
  'gabriel souza',
  'rodrigo lima',
  'entregador teste',
  'motoboy demo'
];

export const MOCK_ORDER_IDS = [
  'ORD-101', 'ORD-102', 'ORD-103', 'ORD-104', 'ORD-105', 'ORD-106', 'ORD-107', 'ORD-108', 'ORD-109', 'ORD-110',
  'ORD-111', 'ORD-112', 'ORD-113', 'ORD-114', 'ORD-115', 'PED-101', 'PED-102', 'PED-103', 'ped-1', 'ped-2', 'ped-3', 'ped-4', 'ped-5'
];

/**
 * Identifies whether a client partner is an artificial / mock partner so it can be definitively excluded.
 */
export function isMockClientPartner(partner: Partial<ClientPartner> | null | undefined): boolean {
  if (!partner) return false;
  const id = String(partner.id || '').trim();
  const code = String(partner.codigoCliente || '').trim();
  const name = String(partner.name || partner.fantasia || partner.razaoSocial || '').trim().toLowerCase();

  if (MOCK_CLIENT_IDS.map(c => c.toLowerCase()).includes(id.toLowerCase())) return true;
  if (MOCK_CLIENT_IDS.map(c => c.toLowerCase()).includes(code.toLowerCase())) return true;

  if (/^CL1-00[1-7]$/i.test(id) || /^CL1-00[1-7]$/i.test(code)) return true;
  if (/^(par|cli|cl1)-0?0?[1-7]$/i.test(id) || /^(par|cli|cl1)-0?0?[1-7]$/i.test(code)) return true;

  if (MOCK_PARTNER_NAMES.includes(name)) return true;

  // Check if it was an auto-created placeholder partner from a mock order
  if (partner.addr === 'Endereço Importado' && (partner.tel === '(11) 99999-9999' || !partner.tel)) {
    if (MOCK_PARTNER_NAMES.some(mn => name.includes(mn)) || /^CL1-/i.test(id) || /^cli-/i.test(id) || /^par-/i.test(id)) {
      return true;
    }
  }

  return false;
}

/**
 * Identifies whether a delivery rider is an artificial / mock rider so it can be definitively excluded.
 */
export function isMockRider(rider: Partial<DeliveryRider> | null | undefined): boolean {
  if (!rider) return false;
  const id = String(rider.id || '').trim().toLowerCase();
  const name = String(rider.name || '').trim().toLowerCase();

  if (MOCK_RIDER_IDS.map(r => r.toLowerCase()).includes(id)) return true;
  if (/^(ent|rid|mot)-[1-5]$/i.test(id)) return true;
  if (MOCK_RIDER_NAMES.includes(name)) return true;

  return false;
}

/**
 * Identifies whether an order is an artificial / mock order so it can be definitively excluded.
 */
export function isMockOrder(order: Partial<Order>): boolean {
  if (!order) return false;
  const id = (order.id || '').toString().trim();
  if (!id) return false;
  if (MOCK_ORDER_IDS.includes(id)) return true;
  if (/^ORD-\d+$/i.test(id)) return true;
  if (/^ped-[1-9]\b/i.test(id)) return true;
  if (/^PED-10[1-9]$/i.test(id)) return true;
  const raw = order as any;
  if (raw?.clientId && MOCK_CLIENT_IDS.map(c => c.toLowerCase()).includes(String(raw.clientId).toLowerCase())) return true;
  if (raw?.clientCode && MOCK_CLIENT_IDS.map(c => c.toLowerCase()).includes(String(raw.clientCode).toLowerCase())) return true;
  if (order.partnerName && (
    MOCK_CLIENT_IDS.map(c => c.toLowerCase()).includes(String(order.partnerName).toLowerCase()) ||
    MOCK_PARTNER_NAMES.includes(String(order.partnerName).trim().toLowerCase())
  )) return true;
  if (order.clientName && MOCK_PARTNER_NAMES.includes(String(order.clientName).trim().toLowerCase())) return true;
  if (order.riderId && MOCK_RIDER_IDS.includes(order.riderId)) return true;
  return false;
}

/**
 * Sanitizes an array of orders for consistency and strictly excludes any mock orders.
 * Returns the sanitized array, whether any order was modified, and a list of modified orders to persist back to DB.
 */
export function sanitizeOrdersListConsistency(
  orders: Order[],
  todayIso: string = getSaoPauloISODate()
): {
  orders: Order[];
  hasModified: boolean;
  modifiedOrders: Order[];
} {
  if (!orders || orders.length === 0) {
    return { orders: [], hasModified: false, modifiedOrders: [] };
  }

  let hasModified = false;
  const modifiedOrders: Order[] = [];

  // Filter out any mock order permanently
  const realOrders = orders.filter(o => !isMockOrder(o));

  const sanitizedOrders = realOrders.map(o => {
    const res = sanitizeOrderConsistency(o, todayIso);
    if (res.modified) {
      hasModified = true;
      modifiedOrders.push(res.order);
    }
    return res.order;
  });

  return { orders: sanitizedOrders, hasModified, modifiedOrders };
}

/**
 * Robust timestamp parsing for ISO strings, Brazilian date strings (DD/MM/YYYY HH:mm), and numeric timestamps.
 */
export function parseOrderTimestamp(val: any): number {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const s = String(val).trim();
  if (!s) return 0;

  const direct = new Date(s).getTime();
  if (!isNaN(direct) && direct > 0) return direct;

  const match = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:(?:\s+às\s+|\s+)(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    const hour = match[4] ? parseInt(match[4], 10) : 0;
    const min = match[5] ? parseInt(match[5], 10) : 0;
    const sec = match[6] ? parseInt(match[6], 10) : 0;
    const d = new Date(year, month, day, hour, min, sec);
    if (!isNaN(d.getTime())) return d.getTime();
  }
  return 0;
}

/**
 * Calculates a temporal score for an order to determine which state is authoritatively newer.
 */
export function getOrderTimestampScore(o: Order): number {
  if (!o) return 0;
  let maxTime = 0;
  if (o.statusUpdatedAt) maxTime = Math.max(maxTime, parseOrderTimestamp(o.statusUpdatedAt));
  if (o.updatedAt) maxTime = Math.max(maxTime, parseOrderTimestamp(o.updatedAt));
  if (o.reallocatedAt) maxTime = Math.max(maxTime, parseOrderTimestamp(o.reallocatedAt));
  if (o.rawData?.statusUpdatedAt) maxTime = Math.max(maxTime, parseOrderTimestamp(o.rawData.statusUpdatedAt));
  if (o.rawData?.updatedAt) maxTime = Math.max(maxTime, parseOrderTimestamp(o.rawData.updatedAt));
  if (o.dataConclusao) maxTime = Math.max(maxTime, parseOrderTimestamp(o.dataConclusao));
  if (o.deliveryDate) maxTime = Math.max(maxTime, parseOrderTimestamp(o.deliveryDate));
  if (o.occurrenceDate) maxTime = Math.max(maxTime, parseOrderTimestamp(o.occurrenceDate));
  if (o.history && Array.isArray(o.history) && o.history.length > 0) {
    o.history.forEach(h => {
      if (h && h.timestamp) {
        maxTime = Math.max(maxTime, parseOrderTimestamp(h.timestamp));
      }
    });
  }
  return maxTime;
}

/**
 * Merges two order arrays by ID preserving authoritative newer updates, administrator overrides,
 * and protecting active states ('Em rota', 'Concluído', 'Ocorrência') from being reverted by stale snapshots.
 */
export function mergeOrders(prev: Order[], incoming: Order[]): Order[] {
  if (!prev || prev.length === 0) return incoming || [];
  if (!incoming || incoming.length === 0) return prev || [];

  const map = new Map<string, Order>();
  prev.forEach(o => {
    if (o && o.id) map.set(o.id, o);
  });

  incoming.forEach(inc => {
    if (!inc || !inc.id) return;
    const existing = map.get(inc.id);
    if (!existing) {
      map.set(inc.id, inc);
    } else {
      // Administrator override takes absolute precedence
      if (existing.adminOverride && !inc.adminOverride) {
        map.set(inc.id, { ...inc, ...existing, status: existing.status, adminOverride: true });
        return;
      }
      if (inc.adminOverride && !existing.adminOverride) {
        map.set(inc.id, { ...existing, ...inc, status: inc.status, adminOverride: true });
        return;
      }

      const existingScore = getOrderTimestampScore(existing);
      const incScore = getOrderTimestampScore(inc);

      if (existingScore > incScore) {
        // Existing in-memory state is strictly newer
        map.set(inc.id, { ...inc, ...existing });
      } else if (incScore > existingScore) {
        // Incoming is newer or equal; incoming state is authoritative
        map.set(inc.id, { ...existing, ...inc });
      } else {
        // Equal scores: Protect active statuses ('Em rota', 'Concluído', 'Ocorrência') over default/stale 'Não iniciado'
        if (existing.status && existing.status !== 'Não iniciado' && inc.status === 'Não iniciado') {
          map.set(inc.id, { ...inc, ...existing });
        } else {
          map.set(inc.id, { ...existing, ...inc });
        }
      }
    }
  });

  return Array.from(map.values());
}
