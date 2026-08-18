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
  rawNameOrCode: string | undefined | null,
  clientPartners?: ClientPartner[]
): string {
  if (!rawNameOrCode || !rawNameOrCode.trim()) {
    return 'Parceiro Geral';
  }

  const trimmed = rawNameOrCode.trim();

  // Combine provided clientPartners with cached partners if needed
  const partnersList = (clientPartners && clientPartners.length > 0)
    ? clientPartners
    : getCachedClientPartners();

  // 1. Direct match in clientPartners list
  if (partnersList && partnersList.length > 0) {
    const matched = partnersList.find(cp => 
      isMatchingClientCode(trimmed, cp.id, cp.codigoCliente) ||
      cp.id?.trim().toLowerCase() === trimmed.toLowerCase() ||
      cp.codigoCliente?.trim().toLowerCase() === trimmed.toLowerCase() ||
      cp.name?.trim().toLowerCase() === trimmed.toLowerCase() ||
      cp.fantasia?.trim().toLowerCase() === trimmed.toLowerCase() ||
      cp.razaoSocial?.trim().toLowerCase() === trimmed.toLowerCase() ||
      (cp.codigoCliente && trimmed.toLowerCase().includes(cp.codigoCliente.toLowerCase())) ||
      (cp.id && trimmed.toLowerCase().includes(cp.id.toLowerCase()))
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
  order: { partnerName?: string; clientName?: string; rawData?: Record<string, string> },
  filterPartner: string | undefined | null,
  clientPartners?: ClientPartner[]
): boolean {
  if (!filterPartner || filterPartner === 'Todos' || filterPartner.trim() === '') {
    return true;
  }

  const cleanFilter = filterPartner.trim().toLowerCase();
  const rawPartner = (order.partnerName || '').trim().toLowerCase();
  const rawClient = (order.clientName || '').trim().toLowerCase();
  const rawDataPartner = (order.rawData?.['CodigoCliente'] || order.rawData?.['Parceiro'] || order.rawData?.['Cliente'] || '').trim().toLowerCase();

  // Direct string / name equality
  if (rawPartner === cleanFilter || rawClient === cleanFilter || rawDataPartner === cleanFilter) {
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
      cp.id.toLowerCase() === cleanFilter ||
      cp.name.toLowerCase() === cleanFilter ||
      (cp.codigoCliente && cp.codigoCliente.toLowerCase() === cleanFilter) ||
      (cp.fantasia && cp.fantasia.toLowerCase() === cleanFilter) ||
      (cp.razaoSocial && cp.razaoSocial.toLowerCase() === cleanFilter)
    );

    if (targetCp) {
      if (isMatchingClientCode(order.partnerName, targetCp.id, targetCp.codigoCliente)) return true;
      if (isMatchingClientCode(order.clientName, targetCp.id, targetCp.codigoCliente)) return true;
      if (rawPartner === targetCp.name.toLowerCase()) return true;
      if (rawClient === targetCp.name.toLowerCase()) return true;
      if (rawDataPartner && isMatchingClientCode(rawDataPartner, targetCp.id, targetCp.codigoCliente)) return true;
    }

    // If order's partner resolves to a ClientPartner object
    const orderCp = clientPartners.find(cp => isMatchingClientCode(order.partnerName, cp.id, cp.codigoCliente));
    if (orderCp) {
      if (
        orderCp.id.toLowerCase() === cleanFilter ||
        orderCp.name.toLowerCase() === cleanFilter ||
        (orderCp.codigoCliente && orderCp.codigoCliente.toLowerCase() === cleanFilter)
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
 */
export function isOrderMatchingRider(
  order: { riderId?: string; rawData?: Record<string, string> },
  filterRiderId: string | undefined | null,
  riders?: DeliveryRider[]
): boolean {
  if (!filterRiderId || filterRiderId === 'Todos' || filterRiderId.trim() === '') {
    return true;
  }

  const cleanFilter = filterRiderId.trim().toLowerCase();
  const filterDigits = cleanFilter.replace(/\D/g, '');
  const orderRiderId = (order.riderId || '').trim().toLowerCase();
  const orderRiderDigits = orderRiderId.replace(/\D/g, '');

  // Extract rider identification from any known rawData key
  const rawData = order.rawData || {};
  const rawRiderKeys = [
    'DispositivoCondutor',
    'Entregador',
    'Condutor',
    'Motorista',
    'Dispositivo',
    'Rider',
    'Driver',
    'NomeCondutor',
    'NomeEntregador',
    'IDCondutor',
    'IdEntregador',
    'CodigoEntregador',
    'CodigoCondutor',
    'TelefoneCondutor',
    'TelefoneEntregador'
  ];

  let rawRiderValues: string[] = [];
  for (const k of Object.keys(rawData)) {
    const normalizedKey = k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (
      normalizedKey.includes('condutor') ||
      normalizedKey.includes('entregador') ||
      normalizedKey.includes('motorista') ||
      normalizedKey.includes('dispositivo') ||
      normalizedKey.includes('rider') ||
      normalizedKey.includes('driver')
    ) {
      const val = (rawData[k] || '').trim().toLowerCase();
      if (val) rawRiderValues.push(val);
    }
  }

  // 1. Direct match on order.riderId
  if (orderRiderId && orderRiderId === cleanFilter) {
    return true;
  }
  if (filterDigits.length >= 8 && orderRiderDigits.length >= 8 && orderRiderDigits === filterDigits) {
    return true;
  }

  // 2. Direct match on rawData fields
  for (const val of rawRiderValues) {
    if (val === cleanFilter) return true;
    const valDigits = val.replace(/\D/g, '');
    if (filterDigits.length >= 8 && valDigits.length >= 8 && valDigits === filterDigits) {
      return true;
    }
  }

  // 3. Match using full list of riders (provided prop + persistent global cache fallback)
  const availableRiders = (riders && riders.length > 0) ? riders : getCachedDeliveryRiders();

  if (availableRiders && availableRiders.length > 0) {
    const targetRider = availableRiders.find(r => 
      r.id.trim().toLowerCase() === cleanFilter || 
      r.name.trim().toLowerCase() === cleanFilter ||
      (r.phone && r.phone.replace(/\D/g, '') === filterDigits) ||
      (r.deviceNumber && r.deviceNumber.replace(/\D/g, '') === filterDigits) ||
      (r.cpfCnpj && r.cpfCnpj.replace(/\D/g, '') === filterDigits)
    );

    if (targetRider) {
      const tId = targetRider.id.trim().toLowerCase();
      const tName = targetRider.name.trim().toLowerCase();
      const tPhoneDigits = (targetRider.phone || '').replace(/\D/g, '');
      const tDeviceDigits = (targetRider.deviceNumber || '').replace(/\D/g, '');
      const tCpfDigits = (targetRider.cpfCnpj || '').replace(/\D/g, '');

      // Check order.riderId against target rider attributes
      if (orderRiderId) {
        if (orderRiderId === tId || orderRiderId === tName) return true;
        if (tPhoneDigits && orderRiderDigits === tPhoneDigits) return true;
        if (tDeviceDigits && orderRiderDigits === tDeviceDigits) return true;
        if (tCpfDigits && orderRiderDigits === tCpfDigits) return true;
      }

      // Check rawData values against target rider attributes
      for (const val of rawRiderValues) {
        if (val === tId || val === tName) return true;
        const valDigits = val.replace(/\D/g, '');
        if (tPhoneDigits && valDigits === tPhoneDigits) return true;
        if (tDeviceDigits && valDigits === tDeviceDigits) return true;
        if (tCpfDigits && valDigits === tCpfDigits) return true;
      }
    }

    // Also check if the order's assigned riderId resolves to a known rider that matches cleanFilter
    if (orderRiderId) {
      const assignedRider = availableRiders.find(r =>
        r.id.trim().toLowerCase() === orderRiderId ||
        r.name.trim().toLowerCase() === orderRiderId ||
        (r.phone && r.phone.replace(/\D/g, '') === orderRiderDigits) ||
        (r.deviceNumber && r.deviceNumber.replace(/\D/g, '') === orderRiderDigits)
      );

      if (assignedRider) {
        if (assignedRider.id.trim().toLowerCase() === cleanFilter) return true;
        if (assignedRider.name.trim().toLowerCase() === cleanFilter) return true;
        const aPhoneDigits = (assignedRider.phone || '').replace(/\D/g, '');
        if (filterDigits.length >= 8 && aPhoneDigits === filterDigits) return true;
        const aDeviceDigits = (assignedRider.deviceNumber || '').replace(/\D/g, '');
        if (filterDigits.length >= 8 && aDeviceDigits === filterDigits) return true;
      }
    }
  }

  return false;
}

