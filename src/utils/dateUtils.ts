/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Formats a Date object or string to a local São Paulo time string (HH:MM).
 */
export function getSaoPauloTime(dateInput?: Date | string | number): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(d);
}

/**
 * Formats a Date object or string to a local São Paulo date string (DD/MM/YYYY).
 */
export function getSaoPauloDate(dateInput?: Date | string | number): string {
  if (!dateInput) {
    const d = new Date();
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  }

  const iso = getSaoPauloISODate(dateInput); // YYYY-MM-DD
  const parts = iso.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  
  return formatToBrazilianDate(String(dateInput));
}

/**
 * Formats a Date object or string to a local São Paulo ISO date string (YYYY-MM-DD).
 * Safely avoids UTC midnight shifting errors when parsing Brazilian date strings or ISO strings.
 */
export function getSaoPauloISODate(dateInput?: Date | string | number): string {
  if (!dateInput) {
    const d = new Date();
    return new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  }

  if (typeof dateInput === 'string') {
    const clean = dateInput.trim();
    if (!clean) {
      return getSaoPauloISODate();
    }
    // If it's already in YYYY-MM-DD format (e.g. 2026-08-14)
    const isoPureMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoPureMatch) {
      return `${isoPureMatch[1]}-${isoPureMatch[2]}-${isoPureMatch[3]}`;
    }
    // If it's in DD/MM/YYYY or DD-MM-YYYY format (e.g. 14/08/2026 or 14-08-2026)
    const brFullMatch = clean.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
    if (brFullMatch) {
      return `${brFullMatch[3]}-${brFullMatch[2]}-${brFullMatch[1]}`;
    }
    // If it's in DD-MM or DD/MM format (e.g. 14-08 or 14/08)
    const brShortMatch = clean.match(/^(\d{2})[-/](\d{2})/);
    if (brShortMatch && !clean.includes('T')) {
      const currentYear = new Date().getFullYear();
      return `${currentYear}-${brShortMatch[2]}-${brShortMatch[1]}`;
    }
    // If it's in DD/MM/YY or DD-MM-YY format (e.g. 14/08/26)
    const brShortYearMatch = clean.match(/^(\d{2})[-/](\d{2})[-/](\d{2})/);
    if (brShortYearMatch) {
      return `20${brShortYearMatch[3]}-${brShortYearMatch[2]}-${brShortYearMatch[1]}`;
    }
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    return new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  }

  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

/**
 * Formats a Date object or string to local São Paulo full datetime string (DD/MM/YYYY HH:MM:SS).
 */
export function getSaoPauloDateTime(dateInput?: Date | string | number): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  const dateStr = getSaoPauloDate(d);
  const timeStr = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(d);
  return `${dateStr} ${timeStr}`;
}

/**
 * Formats a Date object or string to local São Paulo datetime string without seconds (DD/MM/YYYY HH:MM).
 */
export function getSaoPauloDateTimeShort(dateInput?: Date | string | number): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  return `${getSaoPauloDate(d)} ${getSaoPauloTime(d)}`;
}

/**
 * Safely converts an ISO date string (YYYY-MM-DD) or DD-MM-YYYY or DD-MM to Brazilian date format (DD/MM/YYYY)
 * without timezone off-by-one errors.
 */
export function formatToBrazilianDate(dateString?: string): string {
  if (!dateString) return '';
  const clean = String(dateString).trim();
  if (!clean) return '';

  // If it's already in DD/MM/YYYY format
  const brFullMatch = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brFullMatch) {
    return `${brFullMatch[1]}/${brFullMatch[2]}/${brFullMatch[3]}`;
  }
  // If DD-MM-YYYY
  const brHyphenMatch = clean.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (brHyphenMatch) {
    return `${brHyphenMatch[1]}/${brHyphenMatch[2]}/${brHyphenMatch[3]}`;
  }
  // If DD-MM or DD/MM
  const shortMatch = clean.match(/^(\d{2})[-/](\d{2})/);
  if (shortMatch && !clean.includes('T')) {
    const currentYear = new Date().getFullYear();
    return `${shortMatch[1]}/${shortMatch[2]}/${currentYear}`;
  }
  // If YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS
  const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }
  // If YYYY/MM/DD
  const isoSlashMatch = clean.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
  if (isoSlashMatch) {
    return `${isoSlashMatch[3]}/${isoSlashMatch[2]}/${isoSlashMatch[1]}`;
  }
  // If DD/MM/YY or DD-MM-YY
  const shortYearMatch = clean.match(/^(\d{2})[-/](\d{2})[-/](\d{2})/);
  if (shortYearMatch) {
    return `${shortYearMatch[1]}/${shortYearMatch[2]}/20${shortYearMatch[3]}`;
  }

  const parts = clean.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return `${parts[0]}/${parts[1]}/${parts[2]}`;
  }

  const iso = extractISODateFromTimestamp(clean);
  if (iso) {
    const isoParts = iso.split('-');
    if (isoParts.length === 3) {
      return `${isoParts[2]}/${isoParts[1]}/${isoParts[0]}`;
    }
  }
  
  return clean;
}

/**
 * Safely extracts an ISO date string (YYYY-MM-DD) from various timestamp formats,
 * including DD-MM-YYYY, DD-MM, DD/MM/YYYY, DD/MM, and ISO dates.
 */
export function extractISODateFromTimestamp(timestamp?: string | number): string | null {
  if (!timestamp) return null;
  const clean = String(timestamp).trim();
  if (!clean) return null;

  // Format DD/MM/YYYY or DD/MM/YYYY HH:MM or DD/MM/YYYY HH:MM:SS
  const brSlashMatch = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brSlashMatch) {
    return `${brSlashMatch[3]}-${brSlashMatch[2]}-${brSlashMatch[1]}`; // YYYY-MM-DD
  }

  // Format DD-MM-YYYY (e.g. 13-08-2026, 14-08-2026)
  const brHyphenMatch = clean.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (brHyphenMatch) {
    return `${brHyphenMatch[3]}-${brHyphenMatch[2]}-${brHyphenMatch[1]}`; // YYYY-MM-DD
  }

  // Format DD-MM or DD/MM (e.g. 13-08, 14-08, 13/08, 14/08)
  const shortMatch = clean.match(/^(\d{2})[-/](\d{2})/);
  if (shortMatch && !clean.includes('T')) {
    const currentYear = new Date().getFullYear();
    return `${currentYear}-${shortMatch[2]}-${shortMatch[1]}`;
  }

  // Format YYYY-MM-DD or YYYY-MM-DD HH:MM or YYYY-MM-DDTHH:MM:SS
  const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // Format YYYY/MM/DD
  const isoSlashMatch = clean.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
  if (isoSlashMatch) {
    return `${isoSlashMatch[1]}-${isoSlashMatch[2]}-${isoSlashMatch[3]}`;
  }

  // Format DD/MM/YY or DD-MM-YY
  const shortYearMatch = clean.match(/^(\d{2})[-/](\d{2})[-/](\d{2})/);
  if (shortYearMatch) {
    const fullYear = `20${shortYearMatch[3]}`;
    return `${fullYear}-${shortYearMatch[2]}-${shortYearMatch[1]}`;
  }

  // Handle Excel serial date numbers (e.g. 45882 ~ Aug 2026)
  const numericVal = parseFloat(clean);
  if (!isNaN(numericVal) && numericVal > 30000 && numericVal < 70000 && !clean.includes('-') && !clean.includes('/') && !clean.includes(':')) {
    try {
      const excelEpoch = new Date(1899, 11, 30);
      const targetDate = new Date(excelEpoch.getTime() + numericVal * 86400000);
      if (!isNaN(targetDate.getTime())) {
        const y = targetDate.getFullYear();
        const m = String(targetDate.getMonth() + 1).padStart(2, '0');
        const d = String(targetDate.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch (_) {}
  }
  
  try {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      return getSaoPauloISODate(d);
    }
  } catch (e) {
    // Ignore
  }
  
  return null;
}

/**
 * Safely formats a date or time string to a clean HH:MM format.
 */
export function formatOrderTime(timeInput?: string | null): string {
  if (!timeInput) return getSaoPauloTime();
  const clean = String(timeInput).trim();
  if (!clean) return getSaoPauloTime();

  // Handle ISO string e.g. "2026-08-01T15:00:00.000Z"
  if (clean.includes('T')) {
    const timePart = clean.split('T')[1];
    if (timePart) {
      const parts = timePart.split(':');
      if (parts.length >= 2) {
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
      }
    }
  }

  // Handle full datetime e.g. "2026-08-01 15:00:00" or "01/08/2026 15:00"
  if (clean.includes(' ')) {
    const spaceParts = clean.split(' ');
    const timePart = spaceParts[spaceParts.length - 1];
    if (timePart && timePart.includes(':')) {
      const parts = timePart.split(':');
      if (parts.length >= 2) {
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
      }
    }
  }

  // Handle "HH:MM" or "HH:MM:SS"
  if (clean.includes(':')) {
    const parts = clean.split(':');
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(h) && !isNaN(m)) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }
  }

  return clean;
}

/**
 * Checks if an order falls within a date period.
 * For completed orders, checks deliveryDate || dataConclusao || date.
 * For occurrence orders, checks occurrenceDate || date.
 * For other orders, checks order.date.
 * Editing order data (metadata/audit history) or database sync timestamps (createdAt) does NOT alter the operational date.
 */
export function isOrderInDatePeriod(
  order: { 
    status?: string; 
    date?: string; 
    deliveryDate?: string; 
    dataConclusao?: string; 
    occurrenceDate?: string; 
    createdAt?: string;
    rawData?: Record<string, string>;
    history?: { timestamp: string; action?: string; details?: string }[] 
  },
  dateFrom?: string,
  dateTo?: string,
  targetStatus?: string
): boolean {
  if (!dateFrom && !dateTo) return true;

  const isoFrom = dateFrom ? (extractISODateFromTimestamp(dateFrom) || dateFrom) : undefined;
  const isoTo = dateTo ? (extractISODateFromTimestamp(dateTo) || dateTo) : undefined;

  // Determine operational date for the order
  let rawPrimary = order.date;
  if (order.status === 'Concluído') {
    rawPrimary = order.deliveryDate || order.dataConclusao || (order.rawData?.DataEntrega ? getSaoPauloISODate(order.rawData.DataEntrega) : '') || order.date;
  } else if (order.status === 'Ocorrência') {
    rawPrimary = order.occurrenceDate || (order.rawData?.DataOcorrencia ? getSaoPauloISODate(order.rawData.DataOcorrencia) : '') || order.date;
  } else {
    rawPrimary = order.date || order.rawData?.DataSolicitacao || order.rawData?.DataLancamento || order.rawData?.DataAgendamento || order.rawData?.Data || order.rawData?.data;
  }

  const primaryIsoDate = rawPrimary ? extractISODateFromTimestamp(rawPrimary) : undefined;

  let dateMatches = false;

  if (primaryIsoDate) {
    const directFrom = !isoFrom || (primaryIsoDate >= isoFrom);
    const directTo = !isoTo || (primaryIsoDate <= isoTo);
    if (directFrom && directTo) {
      dateMatches = true;
    }
  }

  // If primary date is absent or didn't match, check explicit rawData operational date fields (excluding createdAt/timestamp)
  if (!dateMatches && order.rawData && typeof order.rawData === 'object') {
    const secondaryFields = [
      order.rawData.DataEntrega,
      order.rawData.dataEntrega,
      order.rawData.DataSolicitacao,
      order.rawData.dataSolicitacao,
      order.rawData.DataLancamento,
      order.rawData.dataLancamento,
      order.rawData.DataAgendamento,
      order.rawData.Data,
      order.rawData.data
    ];

    for (const cand of secondaryFields) {
      if (!cand) continue;
      const isoCand = extractISODateFromTimestamp(cand);
      if (isoCand) {
        const directFrom = !isoFrom || (isoCand >= isoFrom);
        const directTo = !isoTo || (isoCand <= isoTo);
        if (directFrom && directTo) {
          dateMatches = true;
          break;
        }
      }
    }
  }

  if (!dateMatches) {
    return false;
  }

  // If a target status is specified, verify status match
  if (targetStatus && targetStatus !== 'Todos' && targetStatus !== '') {
    if (order.status && order.status === targetStatus) {
      return true;
    }
    return false;
  }

  return true;
}
