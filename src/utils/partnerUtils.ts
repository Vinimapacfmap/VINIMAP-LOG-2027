import { ClientPartner, DeliveryRider, isMatchingClientCode } from '../types';

// Global cache for client partners to ensure resolution across all components even when props are omitted
let globalClientPartnersCache: ClientPartner[] = [];

export function setCachedClientPartners(partners: ClientPartner[]) {
  if (Array.isArray(partners)) {
    globalClientPartnersCache = partners;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('vinimap_cached_client_partners', JSON.stringify(partners));
      }
    } catch {
      // ignore
    }
  }
}

export function getCachedClientPartners(): ClientPartner[] {
  if (globalClientPartnersCache.length > 0) {
    return globalClientPartnersCache;
  }
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('vinimap_cached_client_partners');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          globalClientPartnersCache = parsed;
          return parsed;
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
 * Replaces raw codes (e.g. 'PAR-001', 'CL1-001', 'CL1-014') with full partner names.
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
  const partnersList = (clientPartners && clientPartners.length > 0)
    ? clientPartners
    : getCachedClientPartners();

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

  // 2. Fallback dictionary for standard known codes
  const defaultCodeMap: Record<string, string> = {
    'cl1-001': 'Ana Silva',
    'par-001': 'Ana Silva',
    'cli-001': 'Ana Silva',
    'cl1-002': 'Pedro Santos',
    'par-002': 'Pedro Santos',
    'cli-002': 'Pedro Santos',
    'cl1-003': 'Mariana Costa',
    'par-003': 'Mariana Costa',
    'cli-003': 'Mariana Costa',
    'cl1-004': 'Beatriz Lima',
    'par-004': 'Beatriz Lima',
    'cli-004': 'Beatriz Lima',
    'cl1-005': 'Carlos Eduardo',
    'par-005': 'Carlos Eduardo',
    'cli-005': 'Carlos Eduardo',
    'cl1-006': 'Fernanda Oliveira',
    'par-006': 'Fernanda Oliveira',
    'cli-006': 'Fernanda Oliveira',
    'cl1-007': 'Lucas Mendes',
    'par-007': 'Lucas Mendes',
    'cli-007': 'Lucas Mendes',
    'cl1-014': 'Cliente Parceiro 014',
    'par-014': 'Cliente Parceiro 014',
    'cli-014': 'Cliente Parceiro 014',
  };

  const lowerCode = trimmed.toLowerCase();
  if (defaultCodeMap[lowerCode]) {
    return defaultCodeMap[lowerCode];
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
    globalDeliveryRidersCache = riders;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('vinimap_cached_delivery_riders', JSON.stringify(riders));
      }
    } catch {
      // ignore
    }
  }
}

export function getCachedDeliveryRiders(): DeliveryRider[] {
  if (globalDeliveryRidersCache.length > 0) {
    return globalDeliveryRidersCache;
  }
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('vinimap_cached_delivery_riders');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          globalDeliveryRidersCache = parsed;
          return parsed;
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
 * Finds a delivery rider by any identifier (id, name, phone, deviceNumber, cpfCnpj).
 */
export function findRiderByIdentifier(
  riders: DeliveryRider[] | undefined,
  identifier: any
): DeliveryRider | undefined {
  if (!identifier || identifier === 'Todos' || String(identifier).trim() === '') {
    return undefined;
  }

  const list = (riders && riders.length > 0) ? riders : getCachedDeliveryRiders();
  if (!list || list.length === 0) return undefined;

  const clean = String(identifier).trim().toLowerCase();
  const digits = clean.replace(/\D/g, '');

  return list.find(r => {
    if (String(r.id || '').trim().toLowerCase() === clean) return true;
    if (String(r.name || '').trim().toLowerCase() === clean) return true;
    if (r.name && clean.length >= 4 && r.name.toLowerCase().includes(clean)) return true;
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
 */
export function isOrderMatchingRider(
  order: { riderId?: any; rawData?: Record<string, any>; status?: any },
  filterRiderId: any,
  riders?: DeliveryRider[]
): boolean {
  if (!filterRiderId || filterRiderId === 'Todos' || String(filterRiderId).trim() === '') {
    return true;
  }

  const cleanFilter = String(filterRiderId).trim().toLowerCase();

  // If filtering specifically for unassigned / sem condutor:
  // Cancelled orders should NOT appear as unassigned / sem condutor (they are Cancelados)
  if (
    cleanFilter === 'unassigned' ||
    cleanFilter === 'sem condutor' ||
    cleanFilter === 'semcondutor' ||
    cleanFilter === 'nao alocado' ||
    cleanFilter === 'não alocado' ||
    cleanFilter === 'nao vinculado' ||
    cleanFilter === 'não vinculado'
  ) {
    if (order.status === 'Cancelado') return false;
    const rawOrderRiderId = order.riderId !== undefined && order.riderId !== null ? String(order.riderId).trim() : '';
    const orderRiderId = rawOrderRiderId.toLowerCase();
    const isAssigned = rawOrderRiderId !== '' && 
      orderRiderId !== 'unassigned' && 
      orderRiderId !== 'desalocar' && 
      orderRiderId !== 'undefined' && 
      orderRiderId !== 'null' &&
      orderRiderId !== 'sem condutor' &&
      orderRiderId !== 'não alocado' &&
      orderRiderId !== 'nao alocado' &&
      orderRiderId !== 'não vinculado' &&
      orderRiderId !== 'nao vinculado';
    return !isAssigned;
  }

  const availableRiders = (riders && riders.length > 0) ? riders : getCachedDeliveryRiders();
  const filterDigits = cleanFilter.replace(/\D/g, '');
  const targetRider = findRiderByIdentifier(availableRiders, filterRiderId);

  const rawOrderRiderId = order.riderId !== undefined && order.riderId !== null ? String(order.riderId).trim() : '';
  const orderRiderId = rawOrderRiderId.toLowerCase();
  const orderRiderDigits = orderRiderId.replace(/\D/g, '');

  const isAssigned = rawOrderRiderId !== '' && 
    orderRiderId !== 'unassigned' && 
    orderRiderId !== 'desalocar' && 
    orderRiderId !== 'undefined' && 
    orderRiderId !== 'null' &&
    orderRiderId !== 'sem condutor' &&
    orderRiderId !== 'não alocado' &&
    orderRiderId !== 'nao alocado' &&
    orderRiderId !== 'não vinculado' &&
    orderRiderId !== 'nao vinculado';

  // 1. If order has an active riderId assigned, evaluate against that assigned rider
  if (isAssigned) {
    if (orderRiderId === cleanFilter) return true;
    if (filterDigits.length >= 8 && orderRiderDigits.length >= 8 && areDigitsMatching(orderRiderDigits, filterDigits)) {
      return true;
    }

    if (targetRider) {
      const tId = String(targetRider.id || '').trim().toLowerCase();
      const tName = String(targetRider.name || '').trim().toLowerCase();
      const tPhoneDigits = String(targetRider.phone || '').replace(/\D/g, '');
      const tDeviceDigits = String(targetRider.deviceNumber || '').replace(/\D/g, '');
      const tCpfDigits = String(targetRider.cpfCnpj || '').replace(/\D/g, '');

      if (orderRiderId === tId || orderRiderId === tName) return true;
      if (tPhoneDigits && areDigitsMatching(orderRiderDigits, tPhoneDigits)) return true;
      if (tDeviceDigits && areDigitsMatching(orderRiderDigits, tDeviceDigits)) return true;
      if (tCpfDigits && areDigitsMatching(orderRiderDigits, tCpfDigits)) return true;
    }

    const assignedRider = findRiderByIdentifier(availableRiders, order.riderId);
    if (assignedRider) {
      if (String(assignedRider.id || '').trim().toLowerCase() === cleanFilter) return true;
      if (String(assignedRider.name || '').trim().toLowerCase() === cleanFilter) return true;
      const aPhoneDigits = String(assignedRider.phone || '').replace(/\D/g, '');
      if (filterDigits.length >= 8 && areDigitsMatching(aPhoneDigits, filterDigits)) return true;
      const aDeviceDigits = String(assignedRider.deviceNumber || '').replace(/\D/g, '');
      if (filterDigits.length >= 8 && areDigitsMatching(aDeviceDigits, filterDigits)) return true;

      if (targetRider && targetRider.id === assignedRider.id) return true;
    }

    // Since the order is assigned to another specific rider, it must NOT match the filter
    return false;
  }

  // 2. IF AND ONLY IF the order has NO active assigned riderId (unassigned order), check rawData fallback
  const rawData = order.rawData || {};
  let rawRiderValues: string[] = [];
  for (const k of Object.keys(rawData)) {
    const rawVal = rawData[k];
    if (rawVal !== undefined && rawVal !== null) {
      const normalizedKey = String(k).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (
        normalizedKey.includes('condutor') ||
        normalizedKey.includes('entregador') ||
        normalizedKey.includes('motorista') ||
        normalizedKey.includes('dispositivo') ||
        normalizedKey.includes('rider') ||
        normalizedKey.includes('driver')
      ) {
        const val = String(rawVal).trim().toLowerCase();
        if (val && val !== 'nao alocado' && val !== 'não alocado' && val !== 'sem condutor' && val !== 'desalocado') {
          rawRiderValues.push(val);
        }
      }
    }
  }

  for (const val of rawRiderValues) {
    if (val === cleanFilter) return true;
    const valDigits = val.replace(/\D/g, '');
    if (filterDigits.length >= 8 && valDigits.length >= 8 && areDigitsMatching(valDigits, filterDigits)) {
      return true;
    }
  }

  if (targetRider) {
    const tId = String(targetRider.id || '').trim().toLowerCase();
    const tName = String(targetRider.name || '').trim().toLowerCase();
    const tPhoneDigits = String(targetRider.phone || '').replace(/\D/g, '');
    const tDeviceDigits = String(targetRider.deviceNumber || '').replace(/\D/g, '');
    const tCpfDigits = String(targetRider.cpfCnpj || '').replace(/\D/g, '');

    for (const val of rawRiderValues) {
      if (val === tId || val === tName) return true;
      const valDigits = val.replace(/\D/g, '');
      if (tPhoneDigits && areDigitsMatching(valDigits, tPhoneDigits)) return true;
      if (tDeviceDigits && areDigitsMatching(valDigits, tDeviceDigits)) return true;
      if (tCpfDigits && areDigitsMatching(valDigits, tCpfDigits)) return true;
    }
  }

  return false;
}

