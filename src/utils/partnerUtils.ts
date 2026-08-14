import { ClientPartner, DeliveryRider, isMatchingClientCode } from '../types';

/**
 * Utility to resolve a friendly partner display name from a raw partner string or code.
 * Replaces raw codes (e.g. 'PAR-001', 'CL1-001') with full partner names (e.g. 'Ana Silva', 'Burger King').
 */
export function getPartnerDisplayName(
  rawNameOrCode: string | undefined | null,
  clientPartners?: ClientPartner[]
): string {
  if (!rawNameOrCode || !rawNameOrCode.trim()) {
    return 'Parceiro Geral';
  }

  const trimmed = rawNameOrCode.trim();

  // 1. Direct match in provided clientPartners list
  if (clientPartners && clientPartners.length > 0) {
    const matched = clientPartners.find(cp => 
      isMatchingClientCode(trimmed, cp.id, cp.codigoCliente) ||
      cp.id?.toLowerCase() === trimmed.toLowerCase() ||
      cp.codigoCliente?.toLowerCase() === trimmed.toLowerCase() ||
      cp.name?.toLowerCase() === trimmed.toLowerCase() ||
      cp.fantasia?.toLowerCase() === trimmed.toLowerCase() ||
      cp.razaoSocial?.toLowerCase() === trimmed.toLowerCase()
    );
    if (matched && matched.name) {
      return matched.name;
    }
  }

  // 2. Fallback dictionary for standard codes
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

/**
 * Checks if an order matches a selected rider/driver filter value (by ID, name, or phone).
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
  const orderRiderId = (order.riderId || '').trim().toLowerCase();
  const rawRider = (order.rawData?.['DispositivoCondutor'] || order.rawData?.['Entregador'] || order.rawData?.['Condutor'] || '').trim().toLowerCase();

  // 1. Exact ID or direct string match
  if (orderRiderId === cleanFilter || rawRider === cleanFilter) {
    return true;
  }

  // 2. Rider object resolution
  if (riders && riders.length > 0) {
    const targetRider = riders.find(r => 
      r.id.toLowerCase() === cleanFilter || 
      r.name.toLowerCase() === cleanFilter ||
      (r.phone && r.phone.replace(/\D/g, '') === cleanFilter.replace(/\D/g, ''))
    );

    if (targetRider) {
      if (orderRiderId === targetRider.id.toLowerCase()) return true;
      if (orderRiderId === targetRider.name.toLowerCase()) return true;
      if (rawRider === targetRider.id.toLowerCase()) return true;
      if (rawRider === targetRider.name.toLowerCase()) return true;
      if (targetRider.phone && rawRider === targetRider.phone.replace(/\D/g, '')) return true;
    }
  }

  return false;
}

