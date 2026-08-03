import { DeliveryRider, Order, ClientPartner, isMatchingClientCode } from '../types';

export function getOrderFreightValue(order: Order, clientPartners: ClientPartner[]): number {
  // 1. If there's an explicit delivery value already set on the order, preserve it for existing orders
  if (order.deliveryValue !== undefined && order.deliveryValue !== null && order.deliveryValue > 0) {
    return order.deliveryValue;
  }

  if (clientPartners && clientPartners.length > 0) {
    // Find matching client partner using standard robust code matching helper
    const cp = clientPartners.find(c => isMatchingClientCode(order.partnerName, c.id, c.codigoCliente));

    if (cp && cp.cepRanges && cp.cepRanges.length > 0) {
      let orderCepClean = (order.cep || '').replace(/\D/g, '');
      if (orderCepClean.length > 0 && orderCepClean.length < 8) {
        orderCepClean = orderCepClean.padStart(8, '0');
      }

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
            const dateA = a.effectiveFrom || '0000-00-00';
            const dateB = b.effectiveFrom || '0000-00-00';
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

  // Fallback if deliveryValue was 0 or not found in ranges
  if (order.deliveryValue !== undefined && order.deliveryValue !== null && order.deliveryValue >= 0) {
    return order.deliveryValue;
  }

  // 2. Fallback to rawData spreadsheet column if present
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
            const dateA = a.effectiveFrom || '0000-00-00';
            const dateB = b.effectiveFrom || '0000-00-00';
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
  model: string;
} {
  // If there is no rider assigned, check if we can fallback to the spreadsheet's driver value
  if (!rider) {
    let fallbackValue = 0;
    if (order.driverValue !== undefined && order.driverValue !== null) {
      fallbackValue = order.driverValue;
    } else if (order.rawData) {
      const rawVal = order.rawData['ValorCondutor'] || order.rawData['valorcondutor'];
      if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
        const parsed = parseFloat(String(rawVal).replace(',', '.'));
        if (!isNaN(parsed)) {
          fallbackValue = parsed;
        }
      }
    }
    return {
      total: fallbackValue,
      fixed: 0,
      variable: 0,
      freight: fallbackValue,
      model: 'planilha'
    };
  }

  const model = rider.billingModel || 'misto';
  const fixedFee = rider.billingFixedFee !== undefined ? rider.billingFixedFee : 10;
  const variablePercent = rider.billingVariablePercent !== undefined ? rider.billingVariablePercent : 2.5;
  const freightPercent = rider.billingFreightPercent !== undefined ? rider.billingFreightPercent : 80;

  let total = 0;
  let fixed = 0;
  let variable = 0;
  let freight = 0;

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
    model
  };
}
