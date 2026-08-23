import { Order, DeliveryRider, ClientPartner } from '../types';
import { matchesAddressQuery, normalizeAddressForSearch } from './addressUtils';
import { getPartnerDisplayName } from './partnerUtils';
import { formatToBrazilianDate, extractISODateFromTimestamp } from './dateUtils';

const STOP_WORDS = new Set([
  'de', 'do', 'da', 'dos', 'das', 'e', 'em', 'o', 'os', 'a', 'as', 
  'no', 'na', 'nos', 'nas', 'para', 'por', 'com', 'dia', 'dias', 
  'pedido', 'pedidos', 'busca', 'pesquisa', 'exibir', 'buscar', 'listar', 'todos'
]);

/**
 * Normalizes text for lexicographical matching:
 * - Decomposes Unicode characters (NFD) and removes accents / diacritical marks.
 * - Converts to lowercase.
 * - Replaces punctuation and special symbols with spaces.
 * - Collapses contiguous whitespace.
 */
export function normalizeLexicographical(text: string | number | undefined | null): string {
  if (text === undefined || text === null) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents (á, é, í, ó, ú, ã, õ, ç -> a, e, i, o, u, a, o, c)
    .toLowerCase()
    .replace(/[^\w\s\d]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes Levenshtein edit distance between two strings
 */
export function getLevenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Checks if a target string matches a query token under lexicographical rules:
 * - Fast path: Direct normalized substring
 * - Fast path: Compact string check (ignoring whitespace for codes, CEPs, numbers)
 * - Fast path: Word token prefix & boundary match
 * - Fallback: Fuzzy tolerance for longer queries only
 */
export function isLexicographicallyMatching(target: string | number | undefined | null, queryToken: string): boolean {
  if (target === undefined || target === null || !queryToken) return false;

  const rawStr = String(target);
  if (rawStr.length === 0) return false;

  // Extremely fast raw direct lowercase check
  const lowerQuery = queryToken.toLowerCase();
  const lowerTarget = rawStr.toLowerCase();
  if (lowerTarget.includes(lowerQuery)) return true;

  const normTarget = normalizeLexicographical(target);
  const normQuery = normalizeLexicographical(queryToken);

  if (!normTarget || !normQuery) return false;

  // 1. Direct normalized substring match
  if (normTarget.includes(normQuery)) return true;

  // 2. Compact string match (no whitespace)
  const compactTarget = normTarget.replace(/\s+/g, '');
  const compactQuery = normQuery.replace(/\s+/g, '');
  if (compactTarget.includes(compactQuery)) return true;

  // 3. Word token prefix & boundary match
  const targetWords = normTarget.split(/\s+/).filter(Boolean);
  for (const word of targetWords) {
    if (word.startsWith(normQuery)) return true;
    if (normQuery.startsWith(word) && word.length >= 3) return true;
  }

  // 4. Fuzzy distance tolerance ONLY for long search queries (>= 5 chars) to keep typing instant
  if (normQuery.length >= 5) {
    for (const word of targetWords) {
      if (word.length >= 4) {
        const maxDistance = normQuery.length >= 8 ? 2 : 1;
        if (Math.abs(word.length - normQuery.length) <= maxDistance) {
          if (getLevenshteinDistance(word, normQuery) <= maxDistance) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Checks if a single token matches any property of the order using lexicographical rules.
 */
function isOrderMatchingSingleToken(
  order: Order,
  token: string,
  riders?: DeliveryRider[],
  clientPartners?: ClientPartner[]
): boolean {
  if (!token) return true;
  const cleanToken = token.toLowerCase().trim();
  const normToken = normalizeLexicographical(cleanToken);
  const digitsToken = cleanToken.replace(/\D/g, '');

  // 1. Order ID & Sequence (numeric, prefixed, normalized)
  if (order.id) {
    if (isLexicographicallyMatching(order.id, cleanToken)) return true;
    const rawIdNum = order.id.replace(/\D/g, '');
    if (digitsToken && rawIdNum.includes(digitsToken)) return true;
    const cleanId = order.id.replace(/^ped-/i, '');
    if (isLexicographicallyMatching(cleanId, cleanToken)) return true;
  }

  // 2. Client & Recipient & Region (lexicographically normalized)
  if (order.clientName && isLexicographicallyMatching(order.clientName, cleanToken)) return true;
  if (order.recipientName && isLexicographicallyMatching(order.recipientName, cleanToken)) return true;
  if (order.region && isLexicographicallyMatching(order.region, cleanToken)) return true;

  // 3. Status & Status Aliases (normalized for accents and variations)
  if (order.status && isLexicographicallyMatching(order.status, cleanToken)) return true;
  if ((normToken.includes('baixad') || normToken === 'concluido' || normToken === 'entregue') && order.status === 'Concluído') return true;
  if ((normToken.includes('lancad') || normToken === 'aberto' || normToken === 'pendente' || normToken === 'nao iniciado') && 
      (order.status === 'Não iniciado' || order.status === 'Em rota')) return true;
  if ((normToken.includes('rota') || normToken.includes('transito') || normToken.includes('entregando')) && order.status === 'Em rota') return true;
  if ((normToken.includes('ocorrencia') || normToken === 'problema') && order.status === 'Ocorrência') return true;
  if ((normToken.includes('cancelad')) && order.status === 'Cancelado') return true;

  // 4. Address & Street Abbreviations (normalized)
  if (order.address) {
    if (isLexicographicallyMatching(order.address, cleanToken) || matchesAddressQuery(order.address, cleanToken)) {
      return true;
    }
  }

  // 5. CEP (formatted & numeric)
  if (order.cep) {
    const digitsCep = order.cep.replace(/\D/g, '');
    if (isLexicographicallyMatching(order.cep, cleanToken)) return true;
    if (digitsToken && digitsToken.length >= 2 && digitsCep.includes(digitsToken)) return true;
  }

  // 6. Partner Name & Code (lexicographical check)
  if (order.partnerName) {
    if (isLexicographicallyMatching(order.partnerName, cleanToken)) return true;
    const partnerDisplay = getPartnerDisplayName(order.partnerName, clientPartners);
    if (isLexicographicallyMatching(partnerDisplay, cleanToken)) return true;
  }

  // 7. Rider Matching (by ID, Name, Phone, Vehicle, Device, RawData)
  const isAssigned = order.riderId && 
    String(order.riderId).trim() !== '' && 
    String(order.riderId).trim().toLowerCase() !== 'unassigned' && 
    String(order.riderId).trim().toLowerCase() !== 'desalocar';

  if (isAssigned) {
    const oRiderId = String(order.riderId).trim();
    if (isLexicographicallyMatching(oRiderId, cleanToken)) return true;

    if (riders && riders.length > 0) {
      const activeRider = riders.find(r => 
        String(r.id || '').toLowerCase() === oRiderId.toLowerCase() || 
        String(r.name || '').toLowerCase() === oRiderId.toLowerCase()
      );

      if (activeRider) {
        if (activeRider.name && isLexicographicallyMatching(activeRider.name, cleanToken)) return true;
        if (activeRider.vehicle && isLexicographicallyMatching(activeRider.vehicle, cleanToken)) return true;
        if (activeRider.phone && String(activeRider.phone).replace(/\D/g, '').includes(digitsToken)) return true;
        if (activeRider.deviceNumber && isLexicographicallyMatching(activeRider.deviceNumber, cleanToken)) return true;
        if (activeRider.cpfCnpj && String(activeRider.cpfCnpj).replace(/\D/g, '').includes(digitsToken)) return true;
      }
    }
  } else {
    // Check rawData candidate strings
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
      if (rStr && isLexicographicallyMatching(rStr, cleanToken)) return true;
    }

    if (riders && riders.length > 0) {
      const matchedRider = riders.find(r => 
        candidateRiderStrings.some(cs => cs && isLexicographicallyMatching(r.name, cs))
      );

      if (matchedRider) {
        if (matchedRider.name && isLexicographicallyMatching(matchedRider.name, cleanToken)) return true;
        if (matchedRider.vehicle && isLexicographicallyMatching(matchedRider.vehicle, cleanToken)) return true;
        if (matchedRider.phone && String(matchedRider.phone).replace(/\D/g, '').includes(digitsToken)) return true;
        if (matchedRider.deviceNumber && isLexicographicallyMatching(matchedRider.deviceNumber, cleanToken)) return true;
      }
    }
  }

  // Check history for mentions
  if (order.history && order.history.length > 0) {
    for (const h of order.history) {
      if (h.details && isLexicographicallyMatching(h.details, cleanToken)) return true;
      if (h.action && isLexicographicallyMatching(h.action, cleanToken)) return true;
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
    const brDate = formatToBrazilianDate(dateVal);
    const brDateDash = brDate.replace(/\//g, '-');
    if (brDate.includes(cleanToken) || brDateDash.includes(normalizedTokenDate)) return true;

    // Match if token is full ISO or BR date
    const isoDate = extractISODateFromTimestamp(dateVal);
    if (isoDate && (isoDate.includes(cleanToken) || isoDate.includes(normalizedTokenDate))) {
      return true;
    }
  }

  // 9. Protocols, Fiscal, DANFE, Documents
  if (order.protocolNumber && isLexicographicallyMatching(order.protocolNumber, cleanToken)) return true;
  if (order.recipientDoc && (isLexicographicallyMatching(order.recipientDoc, cleanToken) || (digitsToken && order.recipientDoc.replace(/\D/g, '').includes(digitsToken)))) return true;
  if (order.phone && (isLexicographicallyMatching(order.phone, cleanToken) || (digitsToken && order.phone.replace(/\D/g, '').includes(digitsToken)))) return true;

  // 10. RawData inspection
  if (order.rawData && typeof order.rawData === 'object') {
    for (const [, val] of Object.entries(order.rawData)) {
      if (!val) continue;
      if (isLexicographicallyMatching(String(val), cleanToken)) return true;
      if (digitsToken && digitsToken.length >= 3 && String(val).replace(/\D/g, '').includes(digitsToken)) return true;
    }
  }

  return false;
}

/**
 * Universal search matcher for orders using full lexicographical analysis.
 * Supports multi-token searches (e.g. "Bruno 14-08-2026", "São Paulo 101", "baixados centro").
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

  // 2. Tokenized multi-word search (split by spaces/commas/punctuation)
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

/**
 * Calculates a lexicographical relevance score for an order given a search query.
 * Higher score = more relevant match.
 */
export function getOrderLexicographicScore(
  order: Order,
  searchQuery: string | undefined | null,
  riders?: DeliveryRider[],
  clientPartners?: ClientPartner[]
): number {
  const cleanSearch = (searchQuery || '').toString().trim();
  if (!cleanSearch) return 0;

  const normQuery = normalizeLexicographical(cleanSearch);
  const digitsQuery = cleanSearch.replace(/\D/g, '');

  let score = 0;

  // 1. Order ID match (highest priority)
  const normId = normalizeLexicographical(order.id);
  const rawIdNum = (order.id || '').replace(/\D/g, '');
  if (normId === normQuery || (rawIdNum === digitsQuery && digitsQuery.length > 0)) {
    score += 1000;
  } else if (normId.startsWith(normQuery)) {
    score += 600;
  } else if (normId.includes(normQuery)) {
    score += 350;
  }

  // 2. Client Name match
  if (order.clientName) {
    const normClient = normalizeLexicographical(order.clientName);
    if (normClient === normQuery) {
      score += 500;
    } else if (normClient.startsWith(normQuery)) {
      score += 300;
    } else if (normClient.includes(normQuery)) {
      score += 180;
    }
  }

  // 3. Recipient Name match
  if (order.recipientName) {
    const normRecipient = normalizeLexicographical(order.recipientName);
    if (normRecipient === normQuery) {
      score += 400;
    } else if (normRecipient.startsWith(normQuery)) {
      score += 260;
    } else if (normRecipient.includes(normQuery)) {
      score += 150;
    }
  }

  // 4. Tracking / Protocol / DANFE match
  if (order.protocolNumber && normalizeLexicographical(order.protocolNumber).includes(normQuery)) {
    score += 220;
  }

  // 5. Address / CEP match
  if (order.cep && digitsQuery.length >= 4 && order.cep.replace(/\D/g, '').includes(digitsQuery)) {
    score += 190;
  }
  if (order.address && normalizeLexicographical(order.address).includes(normQuery)) {
    score += 130;
  }

  // 6. Rider Name match
  if (order.riderId && riders) {
    const rider = riders.find(r => r.id === order.riderId || r.name === order.riderId);
    if (rider && normalizeLexicographical(rider.name).includes(normQuery)) {
      score += 120;
    }
  }

  // 7. Partner Name match
  if (order.partnerName && normalizeLexicographical(order.partnerName).includes(normQuery)) {
    score += 100;
  }

  return score;
}

/**
 * Sorts orders lexicographically by search relevance and alphabetical order
 */
export function sortOrdersByLexicographicSearch(
  orders: Order[],
  searchQuery: string | undefined | null,
  riders?: DeliveryRider[],
  clientPartners?: ClientPartner[]
): Order[] {
  if (!searchQuery || !searchQuery.trim()) return orders;

  return [...orders].sort((a, b) => {
    const scoreA = getOrderLexicographicScore(a, searchQuery, riders, clientPartners);
    const scoreB = getOrderLexicographicScore(b, searchQuery, riders, clientPartners);

    if (scoreB !== scoreA) {
      return scoreB - scoreA; // Highest relevance first
    }

    // Tie-breaker: Lexicographical order (alphabetical by client name, then ID)
    const clientCompare = (a.clientName || '').localeCompare(b.clientName || '', 'pt-BR', { sensitivity: 'base' });
    if (clientCompare !== 0) return clientCompare;

    return (a.id || '').localeCompare(b.id || '', 'pt-BR', { numeric: true });
  });
}

