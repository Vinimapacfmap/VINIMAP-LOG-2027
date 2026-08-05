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
  const iso = getSaoPauloISODate(dateInput); // YYYY-MM-DD
  const parts = iso.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  
  const d = dateInput ? new Date(dateInput) : new Date();
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

/**
 * Formats a Date object or string to a local São Paulo ISO date string (YYYY-MM-DD).
 */
export function getSaoPauloISODate(dateInput?: Date | string | number): string {
  const d = dateInput ? new Date(dateInput) : new Date();
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
 * Safely converts an ISO date string (YYYY-MM-DD) to Brazilian date format (DD/MM/YYYY)
 * without timezone off-by-one errors.
 */
export function formatToBrazilianDate(dateString?: string): string {
  if (!dateString) return '';
  const clean = dateString.trim();
  // If it's already in DD/MM/YYYY format, return it
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
    return clean;
  }
  const parts = clean.split('-');
  if (parts.length === 3) {
    // If YYYY-MM-DD
    if (parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    // If DD-MM-YYYY
    return `${parts[0]}/${parts[1]}/${parts[2]}`;
  }
  
  // Try to parse as date in Sao Paulo timezone
  try {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      return getSaoPauloDate(d);
    }
  } catch (e) {
    // Ignore and fallback
  }
  
  return clean;
}

/**
 * Safely extracts an ISO date string (YYYY-MM-DD) from various timestamp formats.
 */
export function extractISODateFromTimestamp(timestamp?: string): string | null {
  if (!timestamp) return null;
  const clean = timestamp.trim();
  
  // Format DD/MM/YYYY or DD/MM/YYYY HH:MM or DD/MM/YYYY HH:MM:SS
  const brMatch = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`; // YYYY-MM-DD
  }
  
  // Format YYYY-MM-DD or YYYY-MM-DD HH:MM
  const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
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
 * Checks if an order falls within a date period, either by its creation/delivery date (order.date)
 * or by any history entry status change that occurred within the selected period.
 */
export function isOrderInDatePeriod(
  order: { date?: string; deliveryDate?: string; occurrenceDate?: string; history?: { timestamp: string; action?: string; details?: string }[] },
  dateFrom?: string,
  dateTo?: string,
  targetStatus?: string
): boolean {
  if (!dateFrom && !dateTo) return true;

  const isoFrom = dateFrom ? (extractISODateFromTimestamp(dateFrom) || dateFrom) : undefined;
  const isoTo = dateTo ? (extractISODateFromTimestamp(dateTo) || dateTo) : undefined;

  // 1. Direct check on order creation date, occurrenceDate, or deliveryDate
  const rawPrimary = order.occurrenceDate || order.date || order.deliveryDate;
  if (rawPrimary) {
    const primaryDate = extractISODateFromTimestamp(rawPrimary) || rawPrimary;
    const directFrom = !isoFrom || (primaryDate >= isoFrom);
    const directTo = !isoTo || (primaryDate <= isoTo);
    if (directFrom && directTo) {
      return true;
    }
  }

  // 2. Check order history for status transitions or updates occurring within [dateFrom, dateTo]
  if (order.history && order.history.length > 0) {
    for (const entry of order.history) {
      const entryIsoDate = extractISODateFromTimestamp(entry.timestamp);
      if (!entryIsoDate) continue;

      const histFrom = !isoFrom || (entryIsoDate >= isoFrom);
      const histTo = !isoTo || (entryIsoDate <= isoTo);

      if (histFrom && histTo) {
        if (targetStatus && targetStatus !== 'Todos') {
          const lowerAction = (entry.action || '').toLowerCase();
          const lowerDetails = (entry.details || '').toLowerCase();
          const lowerTarget = targetStatus.toLowerCase();
          if (lowerAction.includes(lowerTarget) || lowerDetails.includes(lowerTarget)) {
            return true;
          }
        } else {
          return true;
        }
      }
    }
  }

  return false;
}
