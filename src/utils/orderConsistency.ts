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
 */
export function hasOrderCompletionEvidence(order: Order): boolean {
  if (!order) return false;

  // If the admin or user explicitly set the status to something other than Concluído, completion evidence should NOT override it
  if ((order.adminOverride || order.rawData?.adminOverride === 'true') && order.status !== 'Concluído') {
    return false;
  }

  const hasProtocol = Boolean(order.protocolNumber && (order.protocolNumber || '').toString().trim() !== '');
  const hasSignature = Boolean(order.signatureUrl && (order.signatureUrl || '').toString().trim() !== '');
  const hasPhoto = Boolean(order.deliveryPhotoUrl && (order.deliveryPhotoUrl || '').toString().trim() !== '');
  const hasRecipient = Boolean(
    (order.recipientName && (order.recipientName || '').toString().trim() !== '') ||
    (order.recipientDoc && (order.recipientDoc || '').toString().trim() !== '')
  );
  const hasCompletionDates = Boolean(
    (order.dataConclusao && (order.dataConclusao || '').toString().trim() !== '') ||
    (order.deliveryDate && (order.deliveryDate || '').toString().trim() !== '')
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

  // Restore riderId from rawData if missing in root ONLY if rawData contains a real rider identifier
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
      const cleanRawRider = (rawRider || '').toString().trim().toLowerCase();
      const isPlaceholder = cleanRawRider === '' || 
        cleanRawRider === 'nao alocado' || 
        cleanRawRider === 'não alocado' || 
        cleanRawRider === 'nao vinculado' || 
        cleanRawRider === 'não vinculado' || 
        cleanRawRider === 'sem condutor' || 
        cleanRawRider === 'desalocado' || 
        cleanRawRider === 'unassigned' || 
        cleanRawRider === 'undefined' || 
        cleanRawRider === 'null';

      if (!isPlaceholder) {
        updated.riderId = (rawRider || '').toString().trim();
        isModified = true;
      }
    }
  }

  const orderIsoDate = normalizeToISODate(updated.date) || normalizeToISODate(updated.deliveryDate || updated.dataConclusao) || todayIso;

  // IMPORTANT: Administrator Overrides and Explicit Statuses Take Absolute Precedence!
  // If an administrator or user explicitly set the status (e.g. 'Não iniciado', 'Em rota', 'Entregando', 'Concluído', 'Cancelado', 'Ocorrência'),
  // or if adminOverride / statusOverride is flagged, NEVER revert or overwrite the status automatically!
  const hasAdminOverride = Boolean(
    updated.adminOverride || 
    (updated.rawData && (updated.rawData.adminOverride === 'true' || updated.rawData.adminOverride === '1'))
  );

  const VALID_STATUSES: OrderStatus[] = ['Não iniciado', 'Em rota', 'Concluído', 'Cancelado', 'Ocorrência'];
  if ((updated.status as string) === 'Entregando') {
    updated.status = 'Em rota';
    isModified = true;
  }
  const hasValidExplicitStatus = Boolean(updated.status && VALID_STATUSES.includes(updated.status));

  // Only infer status from raw data or completion evidence if the order has NO valid status set
  if (!hasAdminOverride && !hasValidExplicitStatus) {
    const rawStatus = (
      updated.rawData?.status ||
      updated.rawData?.Status ||
      updated.rawData?.Situacao ||
      updated.rawData?.situacao ||
      updated.rawData?.STATUS ||
      ''
    ).toString().trim().toLowerCase();

    const isRawCompleted = rawStatus === 'concluído' || rawStatus === 'concluido' || rawStatus === 'entregue' || rawStatus === 'finalizado' || rawStatus === 'baixado';
    const isRawOccurrence = rawStatus === 'ocorrência' || rawStatus === 'ocorrencia' || rawStatus === 'devolvido' || rawStatus === 'falha' || rawStatus === 'insucesso';
    const isRawCancelled = rawStatus === 'cancelado' || rawStatus === 'cancelada';
    const isRawEmRota = rawStatus === 'em rota' || rawStatus === 'em trânsito' || rawStatus === 'em transito' || rawStatus === 'entregando';

    if (isRawCompleted || hasOrderCompletionEvidence(updated)) {
      updated.status = 'Concluído';
      isModified = true;
    } else if (isRawOccurrence) {
      updated.status = 'Ocorrência';
      isModified = true;
    } else if (isRawCancelled) {
      updated.status = 'Cancelado';
      isModified = true;
    } else if (isRawEmRota) {
      updated.status = 'Em rota';
      isModified = true;
    } else {
      updated.status = 'Não iniciado';
      isModified = true;
    }
  }

  // Sync rawData status with authoritative order.status so that rawData does not have conflicting stale status
  if (updated.rawData && updated.status) {
    if (updated.rawData.status !== updated.status || updated.rawData.Situacao !== updated.status || updated.rawData.Status !== updated.status) {
      updated.rawData.status = updated.status;
      updated.rawData.Situacao = updated.status;
      updated.rawData.Status = updated.status;
      isModified = true;
    }
    if (hasAdminOverride && updated.rawData.adminOverride !== 'true') {
      updated.rawData.adminOverride = 'true';
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
