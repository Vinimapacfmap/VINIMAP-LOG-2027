import { DeliveryRider, Order, ClientPartner, CepRange, isMatchingClientCode } from '../types';

/**
 * Extracts and cleans the CEP from an order (from order.cep, rawData columns, or address regex).
 */
export function extractOrderCep(order: Order): string {
  if (!order) return '';
  let rawCep = order.cep || '';
  if (!rawCep && order.rawData) {
    rawCep = order.rawData['CEP'] || order.rawData['cep'] || order.rawData['Cep'] || 
             order.rawData['CEP_DESTINO'] || order.rawData['cep_destino'] || 
             order.rawData['CEP Destino'] || order.rawData['CEPEntrega'] || 
             order.rawData['CepEntrega'] || '';
  }
  if (!rawCep && order.address) {
    const match = order.address.match(/\b\d{5}-?\d{3}\b/);
    if (match) {
      rawCep = match[0];
    }
  }
  let clean = String(rawCep).replace(/\D/g, '');
  if (clean.length > 0 && clean.length < 8) {
    clean = clean.padStart(8, '0');
  }
  return clean;
}

/**
 * Formats a clean 8-digit CEP or raw string into the standard '00000-000' display format.
 */
export function formatCepDisplay(rawCep: string | undefined | null): string {
  if (!rawCep) return '-';
  const clean = String(rawCep).replace(/\D/g, '');
  if (clean.length === 8) {
    return `${clean.substring(0, 5)}-${clean.substring(5, 8)}`;
  }
  return String(rawCep);
}

/**
 * Robustly finds the ClientPartner associated with an order.
 * Checks partnerName, clientName, and multiple rawData code/name columns.
 */
export function findClientPartnerForOrder(order: Order, clientPartners?: ClientPartner[]): ClientPartner | undefined {
  if (!order || !clientPartners || clientPartners.length === 0) return undefined;

  const rawPartner = String(order.partnerName ?? '').trim();
  const rawClient = String(order.clientName ?? '').trim();
  const rawCode = String(
    order.rawData?.['CodigoCliente'] ?? 
    order.rawData?.['codigocliente'] ?? 
    order.rawData?.['Codigo_Cliente'] ?? 
    order.rawData?.['Parceiro'] ?? 
    order.rawData?.['parceiro'] ?? 
    order.rawData?.['Cliente'] ?? 
    order.rawData?.['cliente'] ?? 
    order.rawData?.['NomeCliente'] ?? 
    order.rawData?.['NomeParceiro'] ?? 
    order.rawData?.['EMPRESA'] ?? 
    ''
  ).trim();

  const candidates = [rawPartner, rawCode, rawClient].filter(Boolean);

  // 1. Direct matching by ID, code, name, fantasia, razaoSocial
  for (const c of candidates) {
    const cLower = c.toLowerCase();
    const matched = clientPartners.find(cp => 
      isMatchingClientCode(c, cp.id, cp.codigoCliente) ||
      String(cp.id || '').toLowerCase() === cLower ||
      (cp.codigoCliente && String(cp.codigoCliente).toLowerCase() === cLower) ||
      String(cp.name || '').toLowerCase() === cLower ||
      (cp.fantasia && String(cp.fantasia).toLowerCase() === cLower) ||
      (cp.razaoSocial && String(cp.razaoSocial).toLowerCase() === cLower)
    );
    if (matched) return matched;
  }

  // 2. Partial substring matching
  for (const c of candidates) {
    const cLower = c.toLowerCase();
    if (cLower.length >= 3) {
      const partial = clientPartners.find(cp => 
        (cp.name && cp.name.toLowerCase().includes(cLower)) ||
        (cp.fantasia && cp.fantasia.toLowerCase().includes(cLower)) ||
        (cp.razaoSocial && cp.razaoSocial.toLowerCase().includes(cLower)) ||
        (cp.name && cLower.includes(cp.name.toLowerCase()))
      );
      if (partial) return partial;
    }
  }

  // 3. If only one client partner has cepRanges configured, use it as default
  const partnersWithRanges = clientPartners.filter(cp => cp.cepRanges && cp.cepRanges.length > 0);
  if (partnersWithRanges.length === 1) {
    return partnersWithRanges[0];
  }

  // 4. If only one clientPartner overall
  if (clientPartners.length === 1) {
    return clientPartners[0];
  }

  return undefined;
}

/**
 * Calculates the minimum repasse value in a list of CepRanges.
 * Prioritizes positive driverRepass, then falls back to range value.
 */
export function getMinTableRepass(ranges: CepRange[]): number {
  if (!ranges || ranges.length === 0) return 0;
  
  const repasses = ranges
    .map(r => {
      if (r.driverRepass !== undefined && r.driverRepass !== null && !isNaN(r.driverRepass) && r.driverRepass > 0) {
        return r.driverRepass;
      }
      if (r.value !== undefined && r.value !== null && !isNaN(r.value) && r.value > 0) {
        return r.value;
      }
      return 0;
    })
    .filter(v => v > 0);

  if (repasses.length > 0) {
    return Math.min(...repasses);
  }
  return 0;
}

export function getOrderFreightValue(order: Order, clientPartners: ClientPartner[]): number {
  if (!order) return 10;

  const orderCepClean = extractOrderCep(order);
  const cp = findClientPartnerForOrder(order, clientPartners);

  // 1. Prioritize partner's freight table (tabela de frete do parceiro)
  if (cp && cp.cepRanges && cp.cepRanges.length > 0) {
    if (orderCepClean.length === 8) {
      const orderCepNum = parseInt(orderCepClean, 10);

      let orderDate = '';
      if (order.date && /^\d{4}-\d{2}-\d{2}$/.test(order.date)) {
        orderDate = order.date;
      } else if (order.createdAt) {
        const dateMatch = order.createdAt.match(/^(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) orderDate = dateMatch[1];
      }
      
      if (!orderDate) {
        try {
          const tzDate = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
          const d = new Date(tzDate);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          orderDate = `${yyyy}-${mm}-${dd}`;
        } catch (e) {
          orderDate = new Date().toISOString().split('T')[0];
        }
      }

      // Filter ranges that match the CEP and whose validity starts on or before the order's date
      const matches = cp.cepRanges.filter(r => {
        let startClean = r.cepStart.replace(/\D/g, '');
        let endClean = r.cepEnd.replace(/\D/g, '');
        if (startClean.length > 0 && startClean.length < 8) startClean = startClean.padStart(8, '0');
        if (endClean.length > 0 && endClean.length < 8) endClean = endClean.padStart(8, '0');

        const startNum = parseInt(startClean, 10);
        const endNum = parseInt(endClean, 10);
        const inCepRange = orderCepNum >= startNum && orderCepNum <= endNum;
        if (!inCepRange) return false;

        if (!r.effectiveFrom) return true;
        return orderDate >= r.effectiveFrom;
      });

      if (matches.length > 0) {
        matches.sort((a, b) => {
          const dateA = String(a.effectiveFrom || '0000-00-00');
          const dateB = String(b.effectiveFrom || '0000-00-00');
          return dateB.localeCompare(dateA);
        });

        const match = matches[0];
        if (order.priority && order.priority.toLowerCase() === 'expresso') {
          if (match.expressValue !== undefined && match.expressValue !== null && !isNaN(match.expressValue) && match.expressValue > 0) {
            return match.expressValue;
          }
        }
        if (match.value !== undefined && match.value !== null && !isNaN(match.value) && match.value > 0) {
          return match.value;
        }
      }
    }

    // If CEP was not found in ranges, fallback to minimum table freight value if available
    const minValues = cp.cepRanges.map(r => r.value).filter(v => typeof v === 'number' && !isNaN(v) && v > 0);
    if (minValues.length > 0 && (!order.deliveryValue || order.deliveryValue <= 0)) {
      return Math.min(...minValues);
    }
  }

  // 2. Fallback to explicit delivery value on order if not matched in partner's freight table
  if (order.deliveryValue !== undefined && order.deliveryValue !== null && order.deliveryValue > 0) {
    return order.deliveryValue;
  }

  // 3. Fallback to rawData spreadsheet column if present
  if (order.rawData) {
    const rawVal = order.rawData['ValorEntrega'] || order.rawData['valorentrega'] || order.rawData['ValorFrete'] || order.rawData['valorfrete'];
    if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
      const parsed = parseFloat(String(rawVal).replace(',', '.'));
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return 10; // default fallback freight
}

export function getOrderDriverRepassValue(
  order: Order, 
  clientPartners: ClientPartner[], 
  fallbackFreightPercent: number = 80
): number {
  if (!order) return 0;

  const orderCepClean = extractOrderCep(order);
  const cp = findClientPartnerForOrder(order, clientPartners);

  // 1. Prioritize client partner's freight table (cruzando CEP x Repasse ao Condutor)
  if (cp && cp.cepRanges && cp.cepRanges.length > 0) {
    if (orderCepClean.length === 8) {
      const orderCepNum = parseInt(orderCepClean, 10);

      let orderDate = '';
      if (order.date && /^\d{4}-\d{2}-\d{2}$/.test(order.date)) {
        orderDate = order.date;
      } else if (order.createdAt) {
        const dateMatch = order.createdAt.match(/^(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) orderDate = dateMatch[1];
      }

      const matches = cp.cepRanges.filter(r => {
        let startClean = r.cepStart.replace(/\D/g, '');
        let endClean = r.cepEnd.replace(/\D/g, '');
        if (startClean.length > 0 && startClean.length < 8) startClean = startClean.padStart(8, '0');
        if (endClean.length > 0 && endClean.length < 8) endClean = endClean.padStart(8, '0');

        const startNum = parseInt(startClean, 10);
        const endNum = parseInt(endClean, 10);
        const inCepRange = orderCepNum >= startNum && orderCepNum <= endNum;
        if (!inCepRange) return false;

        if (!r.effectiveFrom) return true;
        return !orderDate || orderDate >= r.effectiveFrom;
      });

      if (matches.length > 0) {
        matches.sort((a, b) => {
          const dateA = String(a.effectiveFrom || '0000-00-00');
          const dateB = String(b.effectiveFrom || '0000-00-00');
          return dateB.localeCompare(dateA);
        });

        const match = matches[0];
        const isExpress = !!(order.priority && order.priority.toLowerCase() === 'expresso');

        // If explicit repasse ao condutor is defined on matched CEP range
        if (match.driverRepass !== undefined && match.driverRepass !== null && !isNaN(match.driverRepass) && match.driverRepass > 0) {
          if (isExpress && match.expressValue !== undefined && match.expressValue !== null && match.expressValue > 0 && match.value > 0) {
            return match.driverRepass * (match.expressValue / match.value);
          }
          return match.driverRepass;
        }

        // If driverRepass was not set on the matched range, use the range value
        if (match.value !== undefined && match.value !== null && !isNaN(match.value) && match.value > 0) {
          return match.value;
        }
      }
    }

    // REGRA FUNDAMENTAL: Se não achar o CEP (ou CEP fora da faixa/vazio), vale o MENOR VALOR de repasse da tabela!
    const minTableRepass = getMinTableRepass(cp.cepRanges);
    if (minTableRepass > 0) {
      return minTableRepass;
    }
  }

  // 2. Se nenhum parceiro específico bateu mas existem parceiros com tabelas de CEP cadastradas
  if (clientPartners && clientPartners.length > 0) {
    const allPartnersWithRanges = clientPartners.filter(p => p.cepRanges && p.cepRanges.length > 0);
    
    // Tenta encontrar em qualquer tabela disponível se o CEP bater
    if (orderCepClean.length === 8) {
      const orderCepNum = parseInt(orderCepClean, 10);
      for (const p of allPartnersWithRanges) {
        const found = p.cepRanges?.find(r => {
          const s = parseInt(r.cepStart.replace(/\D/g, '').padStart(8, '0'), 10);
          const e = parseInt(r.cepEnd.replace(/\D/g, '').padStart(8, '0'), 10);
          return orderCepNum >= s && orderCepNum <= e;
        });
        if (found) {
          if (found.driverRepass && found.driverRepass > 0) return found.driverRepass;
          if (found.value && found.value > 0) return found.value;
        }
      }
    }

    // Se ainda não achou, pega o menor repasse entre todas as tabelas
    const allRanges = allPartnersWithRanges.flatMap(p => p.cepRanges || []);
    const minRepassGlobal = getMinTableRepass(allRanges);
    if (minRepassGlobal > 0) {
      return minRepassGlobal;
    }
  }

  // 3. Fallback: Se houver valor explícito de condutor setado manualmente no pedido
  if (order.driverValue !== undefined && order.driverValue !== null && order.driverValue > 0) {
    return order.driverValue;
  }

  // 4. Fallback padrão seguro
  return 10;
}

export function calculateRiderCommissionForOrder(
  rider: DeliveryRider | undefined,
  order: Order,
  clientPartners: ClientPartner[]
): {
  total: number;
  fixed: number;
  variable: number;
  freight: number;
  fractional: number;
  model: string;
  sourceDescription?: string;
} {
  // REGRA: Ao desalocar ou cancelar o pedido, o frete/repasse NÃO é contabilizado para o condutor antigo (retorna 0).
  // O repasse só é contabilizado para o NOVO condutor atualmente alocado (se concluído), e é ZERADO se desalocado ou cancelado.
  if (!rider || !order.riderId || order.riderId !== rider.id || order.status === 'Cancelado') {
    return {
      total: 0,
      fixed: 0,
      variable: 0,
      freight: 0,
      fractional: 0,
      model: rider?.billingModel || 'nenhum',
      sourceDescription: 'Pedido não alocado / cancelado'
    };
  }

  const model = rider.billingModel || 'misto';
  const fixedFee = rider.billingFixedFee !== undefined ? rider.billingFixedFee : 10;
  const variablePercent = rider.billingVariablePercent !== undefined ? rider.billingVariablePercent : 2.5;
  const freightPercent = rider.billingFreightPercent !== undefined ? rider.billingFreightPercent : 80;
  const fractionalDefault = rider.billingFractionalValue !== undefined ? rider.billingFractionalValue : 12.50;

  let total = 0;
  let fixed = 0;
  let variable = 0;
  let freight = 0;
  let fractional = 0;
  let sourceDescription = '';

  if (order.status === 'Concluído') {
    switch (model) {
      case 'fixo':
        fixed = fixedFee;
        total = fixed;
        sourceDescription = `Taxa fixa (R$ ${fixedFee.toFixed(2)})`;
        break;
      case 'variavel':
        variable = order.value * (variablePercent / 100);
        total = variable;
        sourceDescription = `${variablePercent}% sobre o valor do pedido`;
        break;
      case 'frete':
        freight = getOrderDriverRepassValue(order, clientPartners, freightPercent);
        total = freight;
        sourceDescription = 'Tabela de CEP (Repasse Condutor)';
        break;
      case 'fracionado': {
        // Prioritize manually included charged value on order (driverValue or rawData)
        if (order.driverValue !== undefined && order.driverValue !== null && order.driverValue > 0) {
          fractional = order.driverValue;
        } else if (order.rawData) {
          const rawVal = order.rawData['ValorCondutor'] || order.rawData['ValorCobrado'] || order.rawData['ValorFracionado'] || order.rawData['valorcondutor'] || order.rawData['valorcobrado'];
          if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
            const parsed = parseFloat(String(rawVal).replace(',', '.'));
            if (!isNaN(parsed) && parsed > 0) {
              fractional = parsed;
            }
          }
        }
        if (fractional === 0) {
          fractional = fractionalDefault;
        }
        total = fractional;
        sourceDescription = `Fracionado por entrega (R$ ${fractional.toFixed(2)})`;
        break;
      }
      case 'misto':
      default:
        fixed = fixedFee;
        variable = order.value * (variablePercent / 100);
        total = fixed + variable;
        sourceDescription = `Misto (Fixo R$ ${fixedFee.toFixed(2)} + ${variablePercent}%)`;
        break;
    }
  }

  return {
    total,
    fixed,
    variable,
    freight,
    fractional,
    model,
    sourceDescription
  };
}

