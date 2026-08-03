import { ClientPartner, isMatchingClientCode } from '../types';

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
