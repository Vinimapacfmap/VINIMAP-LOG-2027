/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Order, OrderStatus } from '../types';
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
      updated.deliveryDate = updated.dataConclusao || (updated.rawData?.DataEntrega ? normalizeToISODate(updated.rawData.DataEntrega) : '') || orderIsoDate || todayIso;
      isModified = true;
    }
    if (!updated.dataConclusao) {
      updated.dataConclusao = updated.deliveryDate || orderIsoDate || todayIso;
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

export const MOCK_CLIENT_IDS = ['CL1-001', 'CL1-002', 'CL1-003', 'CL1-004', 'CL1-005', 'CL1-006', 'CL1-007', 'cli-1', 'cli-2', 'cli-3', 'cli-4', 'cli-5', 'cli-6', 'cli-7'];
export const MOCK_RIDER_IDS = ['ent-1', 'ent-2', 'ent-3', 'ent-4', 'ent-5', 'rid-1', 'rid-2', 'rid-3', 'rid-4', 'rid-5', 'mot-1', 'mot-2', 'mot-3'];
export const MOCK_ORDER_IDS = [
  'ORD-101', 'ORD-102', 'ORD-103', 'ORD-104', 'ORD-105', 'ORD-106', 'ORD-107', 'ORD-108', 'ORD-109', 'ORD-110',
  'ORD-111', 'ORD-112', 'ORD-113', 'ORD-114', 'ORD-115', 'PED-101', 'PED-102', 'PED-103', 'ped-1', 'ped-2', 'ped-3', 'ped-4', 'ped-5'
];

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
  if (raw?.clientId && MOCK_CLIENT_IDS.includes(raw.clientId)) return true;
  if (raw?.clientCode && MOCK_CLIENT_IDS.includes(raw.clientCode)) return true;
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
