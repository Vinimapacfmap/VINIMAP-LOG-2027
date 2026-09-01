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
    // If it is an ISO string with time or timezone (e.g. 2026-09-01T01:30:00.000Z or ending in Z), convert to America/Sao_Paulo timezone
    if (clean.includes('T') || clean.endsWith('Z')) {
      const d = new Date(clean);
      if (!isNaN(d.getTime())) {
        return new Intl.DateTimeFormat('fr-CA', {
          timeZone: 'America/Sao_Paulo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(d);
      }
    }

    // If it's a pure YYYY-MM-DD format (e.g. 2026-08-14)
    const isoPureMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
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
 * Safely converts an ISO date string (YYYY-MM-DD) or DD-MM-YYYY or DD-MM or ISO timestamp to Brazilian date format (DD/MM/YYYY)
 * without timezone off-by-one errors.
 */
export function formatToBrazilianDate(dateString?: string): string {
  if (!dateString) return '';
  const clean = String(dateString).trim();
  if (!clean) return '';

  // If it's an ISO timestamp with time or timezone (e.g. 2026-09-01T01:30:00.000Z or ending in Z), format with America/Sao_Paulo
  if (clean.includes('T') || clean.endsWith('Z')) {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      return getSaoPauloDate(d);
    }
  }

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
  // If YYYY-MM-DD
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
 * including YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY, DD-MM-YY, DD/MM, DD-MM, Excel serial numbers, and ISO datetime strings.
 */
export function extractISODateFromTimestamp(timestamp?: string | number): string | null {
  if (!timestamp && timestamp !== 0) return null;
  const clean = String(timestamp).trim();
  if (!clean) return null;

  // 0. If it has 'T' or ends with 'Z' (ISO datetime timestamp), parse as Date with America/Sao_Paulo timezone
  if (clean.includes('T') || clean.endsWith('Z')) {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      return getSaoPauloISODate(d);
    }
  }

  // 1. Format pure YYYY-MM-DD
  const isoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${isoMatch[1]}-${m}-${d}`;
  }

  // 2. Format pure YYYY/MM/DD
  const isoSlashMatch = clean.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (isoSlashMatch) {
    const m = isoSlashMatch[2].padStart(2, '0');
    const d = isoSlashMatch[3].padStart(2, '0');
    return `${isoSlashMatch[1]}-${m}-${d}`;
  }

  // 3. Format DD/MM/YYYY or DD/MM/YYYY HH:MM or DD/MM/YYYY HH:MM:SS or DD/MM/YYYY às HH:MM
  const brSlashMatch = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (brSlashMatch) {
    const d = brSlashMatch[1].padStart(2, '0');
    const m = brSlashMatch[2].padStart(2, '0');
    return `${brSlashMatch[3]}-${m}-${d}`; // YYYY-MM-DD
  }

  // 4. Format DD-MM-YYYY (e.g. 20-08-2026, 21-08-2026)
  const brHyphenMatch = clean.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (brHyphenMatch) {
    const d = brHyphenMatch[1].padStart(2, '0');
    const m = brHyphenMatch[2].padStart(2, '0');
    return `${brHyphenMatch[3]}-${m}-${d}`; // YYYY-MM-DD
  }

  // 5. Format DD/MM/YY or DD-MM-YY (e.g. 20/08/26, 21/08/26, 20-08-26)
  const shortYearMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2})(?!\d)/);
  if (shortYearMatch) {
    const d = shortYearMatch[1].padStart(2, '0');
    const m = shortYearMatch[2].padStart(2, '0');
    const fullYear = `20${shortYearMatch[3]}`;
    return `${fullYear}-${m}-${d}`;
  }

  // 6. Format DD-MM or DD/MM (e.g. 20-08, 21-08, 20/08, 21/08)
  const shortMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})(?:\s.*)?$/);
  if (shortMatch && !clean.includes('T')) {
    const currentYear = new Date().getFullYear();
    const d = shortMatch[1].padStart(2, '0');
    const m = shortMatch[2].padStart(2, '0');
    return `${currentYear}-${m}-${d}`;
  }

  // 7. Handle Excel serial date numbers (e.g. 45882 ~ Aug 2026)
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
  
  // 8. Fallback to standard Date parsing with São Paulo time zone
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
  if (clean.includes('T') || clean.endsWith('Z')) {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      return getSaoPauloTime(d);
    }
  }

  // Handle pure time HH:MM or HH:MM:SS
  const pureTimeMatch = clean.match(/^(\d{1,2}):(\d{2})/);
  if (pureTimeMatch) {
    return `${pureTimeMatch[1].padStart(2, '0')}:${pureTimeMatch[2]}`;
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
 * Checks if an order falls within a date period [dateFrom, dateTo].
 * Evaluates primary order dates (date, deliveryDate, dataConclusao, occurrenceDate, createdAt)
 * and all operational rawData fields from imported spreadsheets/systems.
 */
export function isOrderInDatePeriod(
  order: { 
    status?: string; 
    date?: string; 
    deliveryDate?: string; 
    dataConclusao?: string; 
    occurrenceDate?: string; 
    createdAt?: string;
    rawData?: Record<string, any>;
    history?: { timestamp: string; action?: string; details?: string }[] 
  },
  dateFrom?: string,
  dateTo?: string,
  targetStatus?: string
): boolean {
  if (!dateFrom && !dateTo) return true;

  let isoFrom = dateFrom ? (extractISODateFromTimestamp(dateFrom) || dateFrom) : undefined;
  let isoTo = dateTo ? (extractISODateFromTimestamp(dateTo) || dateTo) : undefined;

  // Strip any accidental time portion
  if (isoFrom && isoFrom.includes('T')) isoFrom = isoFrom.split('T')[0];
  if (isoTo && isoTo.includes('T')) isoTo = isoTo.split('T')[0];

  // If user selected inverted dates, swap them safely
  if (isoFrom && isoTo && isoFrom > isoTo) {
    const temp = isoFrom;
    isoFrom = isoTo;
    isoTo = temp;
  }

  // If a specific target status is requested, filter early
  if (targetStatus && targetStatus !== 'Todos' && targetStatus !== '') {
    if (order.status && order.status !== targetStatus) {
      return false;
    }
  }

  // Gather all potential operational dates associated with this order
  const candidateDates: string[] = [];

  const addCandidate = (val?: any) => {
    if (!val && val !== 0) return;
    const str = String(val).trim();
    if (!str) return;
    const iso = extractISODateFromTimestamp(str);
    if (iso && !candidateDates.includes(iso)) {
      candidateDates.push(iso);
    }
  };

  // 1. Direct standard properties
  addCandidate(order.date);
  addCandidate(order.deliveryDate);
  addCandidate(order.dataConclusao);
  addCandidate(order.occurrenceDate);
  addCandidate(order.createdAt);

  // 2. Operational fields from raw spreadsheet / payload data
  if (order.rawData && typeof order.rawData === 'object') {
    Object.entries(order.rawData).forEach(([k, v]) => {
      const lower = k.toLowerCase().replace(/[^a-z]/g, '');
      if (
        lower.includes('data') || 
        lower.includes('date') || 
        lower === 'horarioinicio' || 
        lower === 'horarioabertura' || 
        lower === 'horalancamento'
      ) {
        addCandidate(v);
      }
    });
  }

  // If order has no identifiable date fields at all, retain visibility to avoid losing data
  if (candidateDates.length === 0) {
    return true;
  }

  // Check if ANY candidate date falls within the [isoFrom, isoTo] window
  for (const candIso of candidateDates) {
    const matchFrom = !isoFrom || (candIso >= isoFrom);
    const matchTo = !isoTo || (candIso <= isoTo);
    if (matchFrom && matchTo) {
      return true;
    }
  }

  return false;
}
