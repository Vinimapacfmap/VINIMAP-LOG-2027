import { DeliveryRider, Order, ClientPartner, isMatchingClientCode } from '../types';

export function getOrderFreightValue(order: Order, clientPartners: ClientPartner[]): number {
  if (!order) return 10;

  // Clean and validate order CEP
  let orderCepClean = (order.cep || '').replace(/\D/g, '');
  if (orderCepClean.length > 0 && orderCepClean.length < 8) {
    orderCepClean = orderCepClean.padStart(8, '0');
  }

  // 1. Prioritize partner's freight table (tabela de frete do parceiro)
  if (clientPartners && clientPartners.length > 0) {
    // Find matching client partner using standard robust code matching helper
    const cp = clientPartners.find(c => isMatchingClientCode(order.partnerName, c.id, c.codigoCliente));

    if (cp && cp.cepRanges && cp.cepRanges.length > 0) {
      if (orderCepClean.length === 8) {
        const orderCepNum = parseInt(orderCepClean, 10);

        // Find order date (YYYY-MM-DD)
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

          // Check effective date
          if (!r.effectiveFrom) return true; // always valid
          return orderDate >= r.effectiveFrom;
        });

        if (matches.length > 0) {
          // Sort by effectiveFrom descending (latest first). Treat empty/undefined as '0000-00-00'
          matches.sort((a, b) => {
            const dateA = String(a.effectiveFrom || '0000-00-00');
            const dateB = String(b.effectiveFrom || '0000-00-00');
            return dateB.localeCompare(dateA);
          });

          const match = matches[0];
          if (order.priority && order.priority.toLowerCase() === 'expresso') {
            if (match.expressValue !== undefined && match.expressValue !== null && !isNaN(match.expressValue)) {
              return match.expressValue;
            }
          }
          return match.value;
        }
      }
    }
  }

  // 2. Fallback to explicit delivery value on order if not matched in partner's freight table
  if (order.deliveryValue !== undefined && order.deliveryValue !== null && order.deliveryValue > 0) {
    return order.deliveryValue;
  }

  // 3. Fallback to rawData spreadsheet column if present
  if (order.rawData) {
    const rawVal = order.rawData['ValorEntrega'] || order.rawData['valorentrega'];
    if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
      const parsed = parseFloat(String(rawVal).replace(',', '.'));
      if (!isNaN(parsed)) {
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
  // 1. If there's an explicit driver value already set on the order, preserve it for existing orders
  if (order.driverValue !== undefined && order.driverValue !== null && order.driverValue >= 0) {
    return order.driverValue;
  }

  if (clientPartners && clientPartners.length > 0) {
    const cp = clientPartners.find(c => isMatchingClientCode(order.partnerName, c.id, c.codigoCliente));

    if (cp && cp.cepRanges && cp.cepRanges.length > 0) {
      let orderCepClean = (order.cep || '').replace(/\D/g, '');
      if (orderCepClean.length > 0 && orderCepClean.length < 8) {
        orderCepClean = orderCepClean.padStart(8, '0');
      }

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

          if (match.driverRepass !== undefined && match.driverRepass !== null && !isNaN(match.driverRepass) && match.driverRepass >= 0) {
            if (isExpress && match.expressValue !== undefined && match.expressValue !== null && match.value > 0) {
              return match.driverRepass * (match.expressValue / match.value);
            }
            return match.driverRepass;
          }
        }
      }
    }
  }

  const freightVal = getOrderFreightValue(order, clientPartners);
  return freightVal * (fallbackFreightPercent / 100);
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
      model: rider?.billingModel || 'nenhum'
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

  if (order.status === 'Concluído') {
    switch (model) {
      case 'fixo':
        fixed = fixedFee;
        total = fixed;
        break;
      case 'variavel':
        variable = order.value * (variablePercent / 100);
        total = variable;
        break;
      case 'frete':
        freight = getOrderDriverRepassValue(order, clientPartners, freightPercent);
        total = freight;
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
        break;
      }
      case 'misto':
      default:
        fixed = fixedFee;
        variable = order.value * (variablePercent / 100);
        total = fixed + variable;
        break;
    }
  }

  return {
    total,
    fixed,
    variable,
    freight,
    fractional,
    model
  };
}
