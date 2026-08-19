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
 * Checks if an order matches a selected rider/driver filter value (by ID, name, phone, deviceNumber, CPF).
 * When an order has an active `order.riderId`, that assignment is authoritative and exclusive.
 */
export function isOrderMatchingRider(
  order: { riderId?: any; rawData?: Record<string, any> },
  filterRiderId: any,
  riders?: DeliveryRider[]
): boolean {
  if (!filterRiderId || filterRiderId === 'Todos' || String(filterRiderId).trim() === '') {
    return true;
  }

  const cleanFilter = String(filterRiderId).trim().toLowerCase();
  const filterDigits = cleanFilter.replace(/\D/g, '');
  const rawOrderRiderId = order.riderId !== undefined && order.riderId !== null ? String(order.riderId).trim() : '';
  const orderRiderId = rawOrderRiderId.toLowerCase();
  const orderRiderDigits = orderRiderId.replace(/\D/g, '');

  const availableRiders = (riders && riders.length > 0) ? riders : getCachedDeliveryRiders();

  const isAssigned = rawOrderRiderId !== '' && 
    orderRiderId !== 'unassigned' && 
    orderRiderId !== 'desalocar' && 
    orderRiderId !== 'undefined' && 
    orderRiderId !== 'null';

  // 1. If order has an active riderId assigned, evaluate ONLY against that assigned rider (Authoritative Single Source of Truth)
  if (isAssigned) {
    if (orderRiderId === cleanFilter) {
      return true;
    }
    if (filterDigits.length >= 8 && orderRiderDigits.length >= 8 && orderRiderDigits === filterDigits) {
      return true;
    }

    if (availableRiders && availableRiders.length > 0) {
      // Find the filter target rider object
      const targetRider = availableRiders.find(r => 
        String(r.id || '').trim().toLowerCase() === cleanFilter || 
        String(r.name || '').trim().toLowerCase() === cleanFilter ||
        (r.phone && String(r.phone).replace(/\D/g, '') === filterDigits) ||
        (r.deviceNumber && String(r.deviceNumber).replace(/\D/g, '') === filterDigits) ||
        (r.cpfCnpj && String(r.cpfCnpj).replace(/\D/g, '') === filterDigits)
      );

      if (targetRider) {
        const tId = String(targetRider.id || '').trim().toLowerCase();
        const tName = String(targetRider.name || '').trim().toLowerCase();
        const tPhoneDigits = String(targetRider.phone || '').replace(/\D/g, '');
        const tDeviceDigits = String(targetRider.deviceNumber || '').replace(/\D/g, '');
        const tCpfDigits = String(targetRider.cpfCnpj || '').replace(/\D/g, '');

        if (orderRiderId === tId || orderRiderId === tName) return true;
        if (tPhoneDigits && orderRiderDigits === tPhoneDigits) return true;
        if (tDeviceDigits && orderRiderDigits === tDeviceDigits) return true;
        if (tCpfDigits && orderRiderDigits === tCpfDigits) return true;
      }

      // Find the order's currently assigned rider object
      const assignedRider = availableRiders.find(r =>
        String(r.id || '').trim().toLowerCase() === orderRiderId ||
        String(r.name || '').trim().toLowerCase() === orderRiderId ||
        (r.phone && String(r.phone).replace(/\D/g, '') === orderRiderDigits) ||
        (r.deviceNumber && String(r.deviceNumber).replace(/\D/g, '') === orderRiderDigits)
      );

      if (assignedRider) {
        if (String(assignedRider.id || '').trim().toLowerCase() === cleanFilter) return true;
        if (String(assignedRider.name || '').trim().toLowerCase() === cleanFilter) return true;
        const aPhoneDigits = String(assignedRider.phone || '').replace(/\D/g, '');
        if (filterDigits.length >= 8 && aPhoneDigits === filterDigits) return true;
        const aDeviceDigits = String(assignedRider.deviceNumber || '').replace(/\D/g, '');
        if (filterDigits.length >= 8 && aDeviceDigits === filterDigits) return true;
      }
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
    if (filterDigits.length >= 8 && valDigits.length >= 8 && valDigits === filterDigits) {
      return true;
    }
  }

  if (availableRiders && availableRiders.length > 0) {
    const targetRider = availableRiders.find(r => 
      String(r.id || '').trim().toLowerCase() === cleanFilter || 
      String(r.name || '').trim().toLowerCase() === cleanFilter ||
      (r.phone && String(r.phone).replace(/\D/g, '') === filterDigits) ||
      (r.deviceNumber && String(r.deviceNumber).replace(/\D/g, '') === filterDigits) ||
      (r.cpfCnpj && String(r.cpfCnpj).replace(/\D/g, '') === filterDigits)
    );

    if (targetRider) {
      const tId = String(targetRider.id || '').trim().toLowerCase();
      const tName = String(targetRider.name || '').trim().toLowerCase();
      const tPhoneDigits = String(targetRider.phone || '').replace(/\D/g, '');
      const tDeviceDigits = String(targetRider.deviceNumber || '').replace(/\D/g, '');
      const tCpfDigits = String(targetRider.cpfCnpj || '').replace(/\D/g, '');

      for (const val of rawRiderValues) {
        if (val === tId || val === tName) return true;
        const valDigits = val.replace(/\D/g, '');
        if (tPhoneDigits && valDigits === tPhoneDigits) return true;
        if (tDeviceDigits && valDigits === tDeviceDigits) return true;
        if (tCpfDigits && valDigits === tCpfDigits) return true;
      }
    }
  }

  return false;
}

