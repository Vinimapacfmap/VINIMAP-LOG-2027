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
  const clean = dateStr.trim();
  const extracted = extractISODateFromTimestamp(clean);
  if (extracted) return extracted;
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

  // Normalize order date
  if (!updated.date || updated.date.trim() === '') {
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

  // Restore riderId from rawData if missing in root
  if (!updated.riderId) {
    const rawRider = updated.rawData?.riderId 
      || updated.rawData?.Condutor 
      || updated.rawData?.condutor 
      || updated.rawData?.NomeCondutor 
      || updated.rawData?.nomeCondutor 
      || updated.rawData?.Entregador 
      || updated.rawData?.entregador 
      || updated.rawData?.Motorista 
      || updated.rawData?.motorista 
      || updated.rawData?.DispositivoCondutor 
      || updated.rawData?.dispositivoCondutor;
    if (rawRider) {
      updated.riderId = rawRider;
      isModified = true;
    }
  }

  const orderIsoDate = normalizeToISODate(updated.date || updated.deliveryDate || updated.dataConclusao) || todayIso;

  // Restore status to 'Concluído' if strong completion evidence exists
  const hasEvidence = hasOrderCompletionEvidence(updated);
  const rawStatus = updated.rawData?.Situacao || updated.rawData?.status || updated.rawData?.Status;
  const isRawCompleted = rawStatus === 'Concluído' || rawStatus === 'Concluido' || rawStatus === 'Entregue';

  if ((hasEvidence || isRawCompleted) && updated.status !== 'Concluído' && updated.status !== 'Cancelado' && updated.status !== 'Ocorrência') {
    updated.status = 'Concluído';
    isModified = true;
  }

  // Restore fields from rawData if missing in root
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
