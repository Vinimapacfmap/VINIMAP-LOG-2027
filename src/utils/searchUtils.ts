import { Order, DeliveryRider, ClientPartner } from '../types';
import { matchesAddressQuery } from './addressUtils';
import { getPartnerDisplayName } from './partnerUtils';
import { formatToBrazilianDate, extractISODateFromTimestamp } from './dateUtils';

const STOP_WORDS = new Set([
  'de', 'do', 'da', 'dos', 'das', 'e', 'em', 'o', 'os', 'a', 'as', 
  'no', 'na', 'nos', 'nas', 'para', 'por', 'com', 'dia', 'dias', 
  'pedido', 'pedidos', 'busca', 'pesquisa', 'exibir', 'buscar', 'listar', 'todos'
]);

/**
 * Checks if a single token matches any property of the order.
 */
function isOrderMatchingSingleToken(
  order: Order,
  token: string,
  riders?: DeliveryRider[],
  clientPartners?: ClientPartner[]
): boolean {
  if (!token) return true;
  const cleanToken = token.toLowerCase();
  const digitsToken = cleanToken.replace(/\D/g, '');

  // 1. Order ID & Sequence
  if (order.id && order.id.toLowerCase().includes(cleanToken)) return true;
  const rawIdNum = order.id.replace('ped-', '');
  if (rawIdNum && rawIdNum.toLowerCase().includes(cleanToken)) return true;

  // 2. Client & Recipient & Region
  if (order.clientName && order.clientName.toLowerCase().includes(cleanToken)) return true;
  if (order.recipientName && order.recipientName.toLowerCase().includes(cleanToken)) return true;
  if (order.region && order.region.toLowerCase().includes(cleanToken)) return true;

  // 3. Status & Status Aliases
  if (order.status && order.status.toLowerCase().includes(cleanToken)) return true;
  if ((cleanToken.includes('baixad') || cleanToken === 'baixado' || cleanToken === 'baixados' || cleanToken === 'concluido' || cleanToken === 'concluído') && order.status === 'Concluído') return true;
  if ((cleanToken.includes('lancad') || cleanToken.includes('lançad') || cleanToken === 'aberto' || cleanToken === 'pendente') && 
      (order.status === 'Não iniciado' || order.status === 'Em rota' || order.status === 'Entregando')) return true;
  if ((cleanToken.includes('rota') || cleanToken.includes('transito') || cleanToken.includes('trânsito')) && (order.status === 'Em rota' || order.status === 'Entregando')) return true;
  if ((cleanToken.includes('ocorrencia') || cleanToken.includes('ocorrência')) && order.status === 'Ocorrência') return true;
  if ((cleanToken.includes('cancelad')) && order.status === 'Cancelado') return true;

  // 4. Address & Street Abbreviations
  if (order.address && (order.address.toLowerCase().includes(cleanToken) || matchesAddressQuery(order.address, cleanToken))) {
    return true;
  }

  // 5. CEP (formatted & numeric)
  if (order.cep) {
    const rawCep = order.cep.toLowerCase();
    const digitsCep = order.cep.replace(/\D/g, '');
    if (rawCep.includes(cleanToken)) return true;
    if (digitsToken && digitsToken.length >= 2 && digitsCep.includes(digitsToken)) return true;
  }

  // 6. Partner Name & Code
  if (order.partnerName) {
    if (order.partnerName.toLowerCase().includes(cleanToken)) return true;
    const partnerDisplay = getPartnerDisplayName(order.partnerName, clientPartners).toLowerCase();
    if (partnerDisplay.includes(cleanToken)) return true;
  }

  // 7. Rider Matching (by ID, Name, Phone, Vehicle, Device, RawData)
  const isAssigned = order.riderId && 
    String(order.riderId).trim() !== '' && 
    String(order.riderId).trim().toLowerCase() !== 'unassigned' && 
    String(order.riderId).trim().toLowerCase() !== 'desalocar';

  if (isAssigned) {
    const oRiderId = String(order.riderId).trim().toLowerCase();
    if (oRiderId.includes(cleanToken)) return true;

    if (riders && riders.length > 0) {
      const activeRider = riders.find(r => 
        String(r.id || '').toLowerCase() === oRiderId || 
        String(r.name || '').toLowerCase() === oRiderId
      );

      if (activeRider) {
        if (String(activeRider.name || '').toLowerCase().includes(cleanToken)) return true;
        if (activeRider.vehicle && String(activeRider.vehicle).toLowerCase().includes(cleanToken)) return true;
        if (activeRider.phone && String(activeRider.phone).replace(/\D/g, '').includes(digitsToken)) return true;
        if (activeRider.deviceNumber && String(activeRider.deviceNumber).toLowerCase().includes(cleanToken)) return true;
        if (activeRider.cpfCnpj && String(activeRider.cpfCnpj).replace(/\D/g, '').includes(digitsToken)) return true;
      }
    }
  } else {
    // Only check rawData if no active assigned rider
    const candidateRiderStrings: string[] = [
      order.rawData?.Condutor !== undefined ? String(order.rawData.Condutor) : '',
      order.rawData?.condutor !== undefined ? String(order.rawData.condutor) : '',
      order.rawData?.NomeCondutor !== undefined ? String(order.rawData.NomeCondutor) : '',
      order.rawData?.nomeCondutor !== undefined ? String(order.rawData.nomeCondutor) : '',
      order.rawData?.Entregador !== undefined ? String(order.rawData.Entregador) : '',
      order.rawData?.entregador !== undefined ? String(order.rawData.entregador) : '',
      order.rawData?.NomeEntregador !== undefined ? String(order.rawData.NomeEntregador) : '',
      order.rawData?.Motorista !== undefined ? String(order.rawData.Motorista) : '',
      order.rawData?.motorista !== undefined ? String(order.rawData.motorista) : '',
      order.rawData?.DispositivoCondutor !== undefined ? String(order.rawData.DispositivoCondutor) : '',
      order.rawData?.dispositivoCondutor !== undefined ? String(order.rawData.dispositivoCondutor) : '',
      order.rawData?.riderName !== undefined ? String(order.rawData.riderName) : '',
      order.rawData?.Rider !== undefined ? String(order.rawData.Rider) : ''
    ].filter(Boolean);

    for (const rStr of candidateRiderStrings) {
      if (rStr && rStr.toLowerCase().includes(cleanToken)) return true;
    }

    if (riders && riders.length > 0) {
      const matchedRider = riders.find(r => 
        candidateRiderStrings.some(cs => cs && String(r.name || '').toLowerCase().includes(cs.toLowerCase()))
      );

      if (matchedRider) {
        if (String(matchedRider.name || '').toLowerCase().includes(cleanToken)) return true;
        if (matchedRider.vehicle && String(matchedRider.vehicle).toLowerCase().includes(cleanToken)) return true;
        if (matchedRider.phone && String(matchedRider.phone).replace(/\D/g, '').includes(digitsToken)) return true;
        if (matchedRider.deviceNumber && String(matchedRider.deviceNumber).toLowerCase().includes(cleanToken)) return true;
      }
    }
  }

  // Check history for rider name mentions
  if (order.history && order.history.length > 0) {
    for (const h of order.history) {
      if (h.details && h.details.toLowerCase().includes(cleanToken)) return true;
      if (h.action && h.action.toLowerCase().includes(cleanToken)) return true;
    }
  }

  // 8. Date Matching (supports 14-08, 14/08, 14-08-2026, 14/08/2026, 2026-08-14, etc.)
  const normalizedTokenDate = cleanToken.replace(/[.\/]/g, '-');
  const candidateDateStrings: (string | undefined)[] = [
    order.date,
    order.deliveryDate,
    order.dataConclusao,
    order.occurrenceDate,
    order.createdAt,
    order.horarioInicial,
    order.rawData?.DataSolicitacao,
    order.rawData?.dataSolicitacao,
    order.rawData?.DataLancamento,
    order.rawData?.dataLancamento,
    order.rawData?.DataEntrega,
    order.rawData?.dataEntrega,
    order.rawData?.Data,
    order.rawData?.data,
    order.rawData?.DataAgendamento,
    order.rawData?.DataCriacao
  ];

  for (const dateVal of candidateDateStrings) {
    if (!dateVal) continue;
    const lowerVal = String(dateVal).toLowerCase();
    if (lowerVal.includes(cleanToken) || lowerVal.includes(normalizedTokenDate)) return true;

    // Check Brazilian format (DD/MM/YYYY)
    const brDate = formatToBrazilianDate(dateVal); // e.g. "14/08/2026"
    const brDateDash = brDate.replace(/\//g, '-'); // e.g. "14-08-2026"
    if (brDate.includes(cleanToken) || brDateDash.includes(normalizedTokenDate)) return true;

    // Check partial day-month e.g. "14-08" or "14/08"
    if (cleanToken.includes('14-08') || cleanToken.includes('14/08') || cleanToken.includes('14.08')) {
      const iso = extractISODateFromTimestamp(dateVal);
      if (iso && (iso === '2026-08-14' || iso.endsWith('-08-14') || lowerVal.includes('14/08') || lowerVal.includes('14-08'))) return true;
    }

    // Match if token is full ISO or BR date
    const isoDate = extractISODateFromTimestamp(dateVal);
    if (isoDate && (isoDate.includes(cleanToken) || isoDate.includes(normalizedTokenDate))) {
      return true;
    }
  }

  // 9. Protocols, Fiscal & Documents
  if (order.protocolNumber && order.protocolNumber.toLowerCase().includes(cleanToken)) return true;
  if (order.recipientDoc && (order.recipientDoc.toLowerCase().includes(cleanToken) || (digitsToken && order.recipientDoc.replace(/\D/g, '').includes(digitsToken)))) return true;
  if (order.phone && (order.phone.toLowerCase().includes(cleanToken) || (digitsToken && order.phone.replace(/\D/g, '').includes(digitsToken)))) return true;

  // 10. RawData inspection
  if (order.rawData && typeof order.rawData === 'object') {
    for (const [, val] of Object.entries(order.rawData)) {
      if (!val) continue;
      const strVal = String(val).toLowerCase();
      if (strVal.includes(cleanToken)) return true;
      if (digitsToken && digitsToken.length >= 3 && strVal.replace(/\D/g, '').includes(digitsToken)) return true;
    }
  }

  return false;
}

/**
 * Universal search matcher for orders.
 * Supports multi-token searches (e.g. "Bruno 14-08-2026", "pedidos Bruno 14/08", "baixados dia 14").
 */
export function isOrderMatchingGlobalSearch(
  order: Order,
  searchQuery: string | undefined | null,
  riders?: DeliveryRider[],
  clientPartners?: ClientPartner[]
): boolean {
  const cleanSearch = (searchQuery || '').toString().trim();
  if (!cleanSearch) {
    return true;
  }

  const rawQuery = cleanSearch.toLowerCase();

  // 1. Direct single-pass full query check first
  if (isOrderMatchingSingleToken(order, rawQuery, riders, clientPartners)) {
    return true;
  }

  // 2. Tokenized multi-word search (split by spaces/commas)
  const rawTokens = rawQuery.split(/[\s,;]+/).filter(t => t.length > 0);
  if (rawTokens.length <= 1) {
    return false;
  }

  // Filter out Portuguese noise words unless all words are noise words
  const activeTokens = rawTokens.filter(t => !STOP_WORDS.has(t));
  const tokensToMatch = activeTokens.length > 0 ? activeTokens : rawTokens;

  // Every token must match at least one attribute of the order
  return tokensToMatch.every(token => isOrderMatchingSingleToken(order, token, riders, clientPartners));
}
