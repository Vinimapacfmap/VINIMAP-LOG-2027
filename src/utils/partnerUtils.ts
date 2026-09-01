import { ClientPartner, DeliveryRider, isMatchingClientCode } from '../types';
import { isMockClientPartner, isMockRider } from './orderConsistency';

// Global cache for client partners to ensure resolution across all components even when props are omitted
let globalClientPartnersCache: ClientPartner[] = [];

export function setCachedClientPartners(partners: ClientPartner[]) {
  if (Array.isArray(partners)) {
    const clean = partners.filter(p => !isMockClientPartner(p));
    globalClientPartnersCache = clean;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('vinimap_cached_client_partners', JSON.stringify(clean));
      }
    } catch {
      // ignore
    }
  }
}

export function getCachedClientPartners(): ClientPartner[] {
  if (globalClientPartnersCache.length > 0) {
    return globalClientPartnersCache.filter(p => !isMockClientPartner(p));
  }
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('vinimap_cached_client_partners');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const clean = parsed.filter((p: ClientPartner) => !isMockClientPartner(p));
          globalClientPartnersCache = clean;
          return clean;
        }
      }
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * Utility to resolve a friendly partner display name from a raw partner string or code.
 * Uses only real registered partner names and never synthesizes mock names.
 */
export function getPartnerDisplayName(
  rawNameOrCode: any,
  clientPartners?: ClientPartner[]
): string {
  if (rawNameOrCode === undefined || rawNameOrCode === null) {
    return 'Parceiro Geral';
  }

  const trimmed = String(rawNameOrCode).trim();
  if (!trimmed) {
    return 'Parceiro Geral';
  }

  // Combine provided clientPartners with cached partners if needed
  const rawList = (clientPartners && clientPartners.length > 0)
    ? clientPartners
    : getCachedClientPartners();
  const partnersList = rawList.filter(cp => !isMockClientPartner(cp));

  // 1. Direct match in clientPartners list
  if (partnersList && partnersList.length > 0) {
    const matched = partnersList.find(cp => 
      isMatchingClientCode(trimmed, cp.id, cp.codigoCliente) ||
      String(cp.id || '').trim().toLowerCase() === trimmed.toLowerCase() ||
      String(cp.codigoCliente || '').trim().toLowerCase() === trimmed.toLowerCase() ||
      String(cp.name || '').trim().toLowerCase() === trimmed.toLowerCase() ||
      String(cp.fantasia || '').trim().toLowerCase() === trimmed.toLowerCase() ||
      String(cp.razaoSocial || '').trim().toLowerCase() === trimmed.toLowerCase() ||
      (cp.codigoCliente && trimmed.toLowerCase().includes(String(cp.codigoCliente).toLowerCase())) ||
      (cp.id && trimmed.toLowerCase().includes(String(cp.id).toLowerCase()))
    );
    if (matched && matched.name) {
      return matched.name;
    }
  }

  return trimmed;
}

/**
 * Checks if an order matches a selected partner filter value (by ID, code, or name).
 */
export function isOrderMatchingPartner(
  order: { partnerName?: any; clientName?: any; rawData?: Record<string, any> },
  filterPartner: any,
  clientPartners?: ClientPartner[]
): boolean {
  if (!filterPartner || filterPartner === 'Todos' || String(filterPartner).trim() === '') {
    return true;
  }

  const cleanFilter = String(filterPartner).trim().toLowerCase();
  const rawPartner = String(order.partnerName ?? '').trim().toLowerCase();
  const rawClient = String(order.clientName ?? '').trim().toLowerCase();
  const rawDataPartner = String(
    order.rawData?.['CodigoCliente'] ?? 
    order.rawData?.['Parceiro'] ?? 
    order.rawData?.['Cliente'] ?? 
    ''
  ).trim().toLowerCase();

  // Direct string / name equality
  if (rawPartner === cleanFilter || rawClient === cleanFilter || (rawDataPartner && rawDataPartner === cleanFilter)) {
    return true;
  }

  // Display name match
  const orderPartnerDisplay = getPartnerDisplayName(order.partnerName, clientPartners).toLowerCase();
  if (orderPartnerDisplay === cleanFilter) {
    return true;
  }

  // If filterPartner is a clientPartner ID or name or code
  if (clientPartners && clientPartners.length > 0) {
    const targetCp = clientPartners.find(cp => 
      String(cp.id || '').toLowerCase() === cleanFilter ||
      String(cp.name || '').toLowerCase() === cleanFilter ||
      (cp.codigoCliente && String(cp.codigoCliente).toLowerCase() === cleanFilter) ||
      (cp.fantasia && String(cp.fantasia).toLowerCase() === cleanFilter) ||
      (cp.razaoSocial && String(cp.razaoSocial).toLowerCase() === cleanFilter)
    );

    if (targetCp) {
      if (isMatchingClientCode(order.partnerName, targetCp.id, targetCp.codigoCliente)) return true;
      if (isMatchingClientCode(order.clientName, targetCp.id, targetCp.codigoCliente)) return true;
      if (rawPartner === String(targetCp.name || '').toLowerCase()) return true;
      if (rawClient === String(targetCp.name || '').toLowerCase()) return true;
      if (rawDataPartner && isMatchingClientCode(rawDataPartner, targetCp.id, targetCp.codigoCliente)) return true;
    }

    // If order's partner resolves to a ClientPartner object
    const orderCp = clientPartners.find(cp => isMatchingClientCode(order.partnerName, cp.id, cp.codigoCliente));
    if (orderCp) {
      if (
        String(orderCp.id || '').toLowerCase() === cleanFilter ||
        String(orderCp.name || '').toLowerCase() === cleanFilter ||
        (orderCp.codigoCliente && String(orderCp.codigoCliente).toLowerCase() === cleanFilter)
      ) {
        return true;
      }
    }
  }

  return false;
}

// Global cache for delivery riders to ensure consistent matching across all render ticks
let globalDeliveryRidersCache: DeliveryRider[] = [];

export function setCachedDeliveryRiders(riders: DeliveryRider[]) {
  if (Array.isArray(riders) && riders.length > 0) {
    const clean = riders.filter(r => !isMockRider(r));
    globalDeliveryRidersCache = clean;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('vinimap_cached_delivery_riders', JSON.stringify(clean));
      }
    } catch {
      // ignore
    }
  }
}

export function getCachedDeliveryRiders(): DeliveryRider[] {
  if (globalDeliveryRidersCache.length > 0) {
    return globalDeliveryRidersCache.filter(r => !isMockRider(r));
  }
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('vinimap_cached_delivery_riders');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const filtered = parsed.filter((r: DeliveryRider) => !isMockRider(r));
          globalDeliveryRidersCache = filtered;
          return filtered;
        }
      }
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * Checks if two phone numbers or numeric identifiers match, considering optional country code '55', DDD, and 8/9 digit suffix matching.
 */
export function areDigitsMatching(digitsA: string, digitsB: string): boolean {
  if (!digitsA || !digitsB) return false;
  if (digitsA === digitsB) return true;

  const cleanA = String(digitsA).replace(/\D/g, '');
  const cleanB = String(digitsB).replace(/\D/g, '');
  if (!cleanA || !cleanB) return false;
  if (cleanA === cleanB) return true;

  const shortA = cleanA.length >= 10 && cleanA.startsWith('55') ? cleanA.substring(2) : cleanA;
  const shortB = cleanB.length >= 10 && cleanB.startsWith('55') ? cleanB.substring(2) : cleanB;

  if (shortA === shortB) return true;
  if (shortA.length >= 8 && shortB.length >= 8) {
    if (shortA.endsWith(shortB) || shortB.endsWith(shortA)) return true;
    if (shortA.slice(-8) === shortB.slice(-8)) return true;
    if (shortA.slice(-9) === shortB.slice(-9)) return true;
  }
  return false;
}

/**
 * Finds a delivery rider by any identifier (id, name, phone, deviceNumber, cpfCnpj, or object with id/name).
 */
export function findRiderByIdentifier(
  riders: DeliveryRider[] | undefined,
  identifier: any
): DeliveryRider | undefined {
  if (!identifier || identifier === 'Todos' || String(identifier).trim() === '') {
    return undefined;
  }

  // Support object identifiers (e.g. { id: '...', name: '...' })
  if (typeof identifier === 'object' && identifier !== null) {
    identifier = identifier.id || identifier.name || identifier.phone || identifier.deviceNumber || '';
  }

  const list = (riders && riders.length > 0) ? riders : getCachedDeliveryRiders();
  if (!list || list.length === 0) return undefined;

  const clean = String(identifier).trim().toLowerCase();
  const digits = clean.replace(/\D/g, '');

  return list.find(r => {
    if (String(r.id || '').trim().toLowerCase() === clean) return true;
    if (String(r.name || '').trim().toLowerCase() === clean) return true;
    if (r.name && clean.length >= 4 && (clean.includes(r.name.toLowerCase()) || r.name.toLowerCase().includes(clean))) return true;
    if (r.deviceNumber && String(r.deviceNumber).trim().toLowerCase() === clean) return true;

    if (digits.length >= 6) {
      if (r.id && r.id.replace(/\D/g, '') === digits) return true;

      const rPhoneDigits = String(r.phone || '').replace(/\D/g, '');
      if (rPhoneDigits && areDigitsMatching(rPhoneDigits, digits)) return true;

      const rDeviceDigits = String(r.deviceNumber || '').replace(/\D/g, '');
      if (rDeviceDigits && (rDeviceDigits === digits || areDigitsMatching(rDeviceDigits, digits))) return true;

      const rCpfDigits = String(r.cpfCnpj || '').replace(/\D/g, '');
      if (rCpfDigits && areDigitsMatching(rCpfDigits, digits)) return true;

      const rNameDigits = String(r.name || '').replace(/\D/g, '');
      if (rNameDigits && areDigitsMatching(rNameDigits, digits)) return true;
    }

    return false;
  });
}

/**
 * Checks if an order matches a selected rider/driver filter value (by ID, name, phone, deviceNumber, CPF).
 * When an order has an active `order.riderId`, that assignment is authoritative and exclusive.
 * An unassigned order (no riderId) will only match unassigned/sem condutor queries and never a specific driver.
 */
export function isOrderMatchingRider(
  order: { riderId?: any; driverId?: any; assignedDriver?: any; driver?: any; rider?: any; entregadorId?: any; motoristaId?: any; rawData?: Record<string, any>; status?: any },
  filterRiderId: any,
  riders?: DeliveryRider[]
): boolean {
  if (!filterRiderId || filterRiderId === 'Todos' || String(filterRiderId).trim() === '') {
    return true;
  }

  // Handle object filter
  let normalizedFilter = filterRiderId;
  if (typeof filterRiderId === 'object' && filterRiderId !== null) {
    normalizedFilter = filterRiderId.id || filterRiderId.name || filterRiderId.phone || filterRiderId.deviceNumber || '';
  }

  const cleanFilter = String(normalizedFilter).trim().toLowerCase();

  // If filtering specifically for unassigned / sem condutor:
  // Cancelled orders should NOT appear as unassigned / sem condutor (they are Cancelados)
  if (
    cleanFilter === 'unassigned' ||
    cleanFilter === 'sem condutor' ||
    cleanFilter === 'semcondutor' ||
    cleanFilter === 'nao alocado' ||
    cleanFilter === 'não alocado' ||
    cleanFilter === 'nao vinculado' ||
    cleanFilter === 'não vinculado' ||
    cleanFilter === 'desalocar'
  ) {
    if (order.status === 'Cancelado') return false;
    const rId = String(order.riderId || '').trim().toLowerCase();
    return !rId || rId === 'unassigned' || rId === 'desalocar' || rId === 'undefined' || rId === 'null';
  }

  // Resolve the assigned driver identifier from the order
  const rawRiderId = order.riderId 
    || order.driverId 
    || order.assignedDriver 
    || order.entregadorId 
    || order.motoristaId
    || order.rawData?.riderId
    || order.rawData?.Motorista
    || order.rawData?.motorista
    || order.rawData?.Entregador
    || order.rawData?.entregador
    || order.rawData?.Condutor
    || order.rawData?.condutor
    || order.rawData?.driverId;
  const cleanOrderRider = String(rawRiderId || '').trim();

  // If the order has NO assigned driver, it CANNOT match any specific driver
  if (
    !cleanOrderRider ||
    cleanOrderRider.toLowerCase() === 'unassigned' ||
    cleanOrderRider.toLowerCase() === 'desalocar' ||
    cleanOrderRider.toLowerCase() === 'undefined' ||
    cleanOrderRider.toLowerCase() === 'null' ||
    cleanOrderRider.toLowerCase() === 'sem condutor'
  ) {
    return false;
  }

  const availableRiders = (riders && riders.length > 0) ? riders : getCachedDeliveryRiders();
  const filterDigits = cleanFilter.replace(/\D/g, '');
  const targetRider = findRiderByIdentifier(availableRiders, cleanFilter);

  const candLower = cleanOrderRider.toLowerCase();
  const candDigits = candLower.replace(/\D/g, '');

  // Exact match with filter string
  if (candLower === cleanFilter) return true;
  if (candLower.length >= 3 && cleanFilter.length >= 3) {
    if (candLower.includes(cleanFilter) || cleanFilter.includes(candLower)) return true;
  }

  // Phone / Device / ID digits match
  if (filterDigits.length >= 6 && candDigits.length >= 6) {
    if (candDigits === filterDigits || areDigitsMatching(candDigits, filterDigits)) {
      return true;
    }
  }

  // Compare against resolved target rider
  if (targetRider) {
    const tId = String(targetRider.id || '').trim().toLowerCase();
    const tName = String(targetRider.name || '').trim().toLowerCase();
    const tPhoneDigits = String(targetRider.phone || '').replace(/\D/g, '');
    const tDeviceDigits = String(targetRider.deviceNumber || '').replace(/\D/g, '');
    const tCpfDigits = String(targetRider.cpfCnpj || '').replace(/\D/g, '');

    if (candLower === tId || candLower === tName) return true;
    if (tName && candLower.length >= 3 && (candLower.includes(tName) || tName.includes(candLower))) return true;
    if (tPhoneDigits && areDigitsMatching(candDigits, tPhoneDigits)) return true;
    if (tDeviceDigits && (candDigits === tDeviceDigits || areDigitsMatching(candDigits, tDeviceDigits))) return true;
    if (tCpfDigits && areDigitsMatching(candDigits, tCpfDigits)) return true;
  }

  // Compare by looking up the order's rider in the directory
  const candRider = findRiderByIdentifier(availableRiders, cleanOrderRider);
  if (candRider) {
    const cId = String(candRider.id || '').trim().toLowerCase();
    const cName = String(candRider.name || '').trim().toLowerCase();
    if (cId === cleanFilter || cName === cleanFilter) return true;
    if (cName && (cleanFilter.includes(cName) || cName.includes(cleanFilter))) return true;

    const cPhoneDigits = String(candRider.phone || '').replace(/\D/g, '');
    if (filterDigits.length >= 8 && areDigitsMatching(cPhoneDigits, filterDigits)) return true;
    const cDeviceDigits = String(candRider.deviceNumber || '').replace(/\D/g, '');
    if (filterDigits.length >= 8 && areDigitsMatching(cDeviceDigits, filterDigits)) return true;

    if (targetRider && targetRider.id === candRider.id) return true;
  }

  return false;
}

