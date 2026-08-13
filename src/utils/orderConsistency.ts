/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Order, OrderStatus } from '../types';
import { getSaoPauloISODate } from './dateUtils';

/**
 * Normalizes any date string (YYYY-MM-DD or DD/MM/YYYY) to YYYY-MM-DD format for ISO comparison.
 */
export function normalizeToISODate(dateStr?: string): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
    const parts = clean.split('/');
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  const parts = clean.split('-');
  if (parts.length === 3 && parts[0].length === 4) return clean;
  try {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      return getSaoPauloISODate(d);
    }
  } catch (_) {}
  return clean;
}

/**
 * Checks if an order has physical, digital, or historical evidence of completion.
 */
export function hasOrderCompletionEvidence(order: Order): boolean {
  if (!order) return false;

  const hasProtocol = Boolean(order.protocolNumber && order.protocolNumber.trim() !== '');
  const hasSignature = Boolean(order.signatureUrl && order.signatureUrl.trim() !== '');
  const hasPhoto = Boolean(order.deliveryPhotoUrl && order.deliveryPhotoUrl.trim() !== '');
  const hasRecipient = Boolean(
    (order.recipientName && order.recipientName.trim() !== '') ||
    (order.recipientDoc && order.recipientDoc.trim() !== '')
  );
  const hasCompletionDates = Boolean(
    (order.dataConclusao && order.dataConclusao.trim() !== '') ||
    (order.deliveryDate && order.deliveryDate.trim() !== '')
  );

  const hasCompletionHistory = Boolean(
    order.history &&
    order.history.some(h => {
      const text = `${h.action || ''} ${h.details || ''}`.toLowerCase();
      return (
        text.includes('concluí') ||
        text.includes('conclui') ||
        text.includes('baixa') ||
        text.includes('entregue') ||
        text.includes('conclusão') ||
        text.includes('conclusao')
      );
    })
  );

  const hasRawCompletion = Boolean(
    order.rawData &&
    (order.rawData.signatureUrl ||
      order.rawData.deliveryPhotoUrl ||
      order.rawData.protocolNumber ||
      order.rawData.recipientName ||
      order.rawData.dataConclusao ||
      order.rawData.Status === 'Concluído' ||
      order.rawData.status === 'Concluído' ||
      order.rawData.Status === 'Concluido' ||
      order.rawData.status === 'Concluido')
  );

  return (
    hasProtocol ||
    hasSignature ||
    hasPhoto ||
    hasRecipient ||
    hasCompletionDates ||
    hasCompletionHistory ||
    hasRawCompletion
  );
}

/**
 * Sanitizes a single order to guarantee status consistency across initial load,
 * date closures, and persistent storage.
 */
export function sanitizeOrderConsistency(
  order: Order,
  todayIso: string = getSaoPauloISODate()
): { order: Order; modified: boolean } {
  if (!order) return { order, modified: false };

  let isModified = false;
  const updated = { ...order };

  const orderIsoDate = normalizeToISODate(updated.date || updated.deliveryDate || updated.dataConclusao);

  // Rule 1: Populate completion or occurrence dates/times ONLY if status is 'Concluído' or 'Ocorrência'.
  if (updated.status === 'Concluído') {
    if (!updated.deliveryDate) {
      updated.deliveryDate = updated.dataConclusao || orderIsoDate || todayIso;
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

/**
 * Sanitizes an array of orders for consistency.
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

  const sanitizedOrders = orders.map(o => {
    const res = sanitizeOrderConsistency(o, todayIso);
    if (res.modified) {
      hasModified = true;
      modifiedOrders.push(res.order);
    }
    return res.order;
  });

  return { orders: sanitizedOrders, hasModified, modifiedOrders };
}
