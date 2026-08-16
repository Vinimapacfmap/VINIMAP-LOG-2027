/**
 * Utility functions for advanced address normalization and smart search matching.
 * Handles street type prefixes and abbreviations in Brazilian addresses:
 * - Alameda: Alameda, Al., Al, Alm., Alm
 * - Avenida: Avenida, Av., Av, Avn., Avn, Avda., Avda
 * - Praça: Praça, Praca, Pça, Pca, Pç, Pc, Pr., Pr
 * - Rua: Rua, R., R
 * - Doutor/Doutora: Doutor, Dr., Dr, Doutora, Dra., Dra
 * - Rodovia: Rodovia, Rod., Rod
 * - Estrada: Estrada, Est., Est
 * - Travessa: Travessa, Trv., Trv, Tv., Tv
 * - Professor/Professora: Professor, Prof., Prof, Professora, Profa., Profa
 * - Santa/Santo/São: Santa, Sta., Santo, Sto., São, Sao, St.
 */

export function normalizeAddressForSearch(text: string): string {
  if (!text) return '';

  // 1. Lowercase & remove accents/diacritics (e.g. Praça -> praca, São -> sao)
  let str = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // 2. Convert punctuation (dots, commas, dashes, slashes, etc.) to spaces
  str = str.replace(/[.,\-\/\\#$%\^&\*;:{}=\-_`~()]/g, ' ');

  // 3. Normalize whitespace
  str = str.replace(/\s+/g, ' ').trim();

  // 4. Standardize street type prefixes and abbreviations using regex word boundaries (\b)
  // Alameda
  str = str.replace(/\b(alameda|alms|alm|al)\b/g, 'alameda');
  // Avenida
  str = str.replace(/\b(avenida|avda|avn|av)\b/g, 'avenida');
  // Praça / Praca
  str = str.replace(/\b(praca|paca|pca|pcz|pc|pr)\b/g, 'praca');
  // Rua
  str = str.replace(/\b(rua|r)\b/g, 'rua');
  // Doutor / Doutora
  str = str.replace(/\b(doutor|dr)\b/g, 'doutor');
  str = str.replace(/\b(doutora|dra)\b/g, 'doutora');
  // Rodovia
  str = str.replace(/\b(rodovia|rod)\b/g, 'rodovia');
  // Estrada
  str = str.replace(/\b(estrada|est)\b/g, 'estrada');
  // Travessa
  str = str.replace(/\b(travessa|trv|tv)\b/g, 'travessa');
  // Professor / Professora
  str = str.replace(/\b(professor|prof)\b/g, 'professor');
  str = str.replace(/\b(professora|profa)\b/g, 'professora');
  // Santa / Santo / Sao
  str = str.replace(/\b(santa|sta)\b/g, 'santa');
  str = str.replace(/\b(santo|sto)\b/g, 'santo');
  str = str.replace(/\b(sao|st)\b/g, 'sao');

  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Enhanced address query matcher.
 * Returns true if the address matches the search query under normalized street prefixes and abbreviations.
 */
export function matchesAddressQuery(address: string | undefined | null, searchQuery: string | undefined | null): boolean {
  if (!searchQuery || !searchQuery.trim()) return true;
  if (!address) return false;

  const rawQuery = searchQuery.trim().toLowerCase();
  const rawAddress = address.trim().toLowerCase();

  // Quick raw check
  if (rawAddress.includes(rawQuery)) return true;

  const normAddress = normalizeAddressForSearch(address);
  const normQuery = normalizeAddressForSearch(searchQuery);

  if (!normQuery) return true;

  // Direct normalized substring match
  if (normAddress.includes(normQuery)) return true;

  // Tokenized match: every token in the query must match part of the address
  const queryTokens = normQuery.split(' ').filter(Boolean);
  if (queryTokens.length === 0) return true;

  return queryTokens.every(token => normAddress.includes(token));
}

/**
 * Compares two orders by CEP (Zip Code) in strict lexicographical ascending order
 * from lowest CEP (starting with 01...) to highest CEP (starting with 99...).
 * Cleans non-digit characters and normalizes 8-digit strings so "01310-100", "01310100", etc. are compared consistently.
 * Independent of system creation date, launch time, or reallocation date/status.
 */
export function compareOrdersByCep(
  a: { cep?: string; address?: string; id?: string },
  b: { cep?: string; address?: string; id?: string }
): number {
  const rawCepA = (a.cep || '').replace(/\D/g, '');
  const rawCepB = (b.cep || '').replace(/\D/g, '');

  const hasCepA = rawCepA.length > 0;
  const hasCepB = rawCepB.length > 0;

  if (hasCepA && hasCepB) {
    const padA = rawCepA.padStart(8, '0');
    const padB = rawCepB.padStart(8, '0');
    if (padA !== padB) {
      return padA.localeCompare(padB);
    }
  } else if (hasCepA) {
    return -1; // Order with CEP comes before order without CEP
  } else if (hasCepB) {
    return 1;
  }

  // Fallback if CEPs are identical or both missing
  const addrA = String(a.address || '');
  const addrB = String(b.address || '');
  if (addrA !== addrB) {
    return addrA.localeCompare(addrB, 'pt-BR', { sensitivity: 'base', numeric: true });
  }

  return String(a.id || '').localeCompare(String(b.id || ''), 'pt-BR', { numeric: true });
}

/**
 * Resequences orders belonging to a rider according to CEP order.
 * Updates the `sequence` property (1, 2, 3...) for all orders of the specified rider.
 */
export function resequenceRiderOrdersByCep<T extends { riderId?: string; sequence?: number; cep?: string; address?: string; id?: string }>(
  allOrders: T[],
  riderId: string
): T[] {
  if (!riderId || riderId === 'unassign' || riderId === 'desalocar') return allOrders;

  // Filter all orders assigned to this rider
  const riderOrders = allOrders.filter(o => o.riderId === riderId);
  if (riderOrders.length === 0) return allOrders;

  // Sort them strictly by CEP
  const sortedRiderOrders = [...riderOrders].sort(compareOrdersByCep);

  // Map of order ID -> new sequence number (1-based index)
  const sequenceMap = new Map<string, number>();
  sortedRiderOrders.forEach((o, index) => {
    if (o.id) sequenceMap.set(o.id, index + 1);
  });

  return allOrders.map(o => {
    if (o.riderId === riderId && o.id && sequenceMap.has(o.id)) {
      return {
        ...o,
        sequence: sequenceMap.get(o.id)
      };
    }
    return o;
  });
}
