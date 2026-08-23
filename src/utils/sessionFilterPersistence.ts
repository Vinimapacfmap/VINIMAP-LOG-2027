/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { OrderStatus } from '../types';

export const SESSION_FILTER_KEYS = {
  FILTER_DATE_FROM: 'vinimap_filter_date_from',
  FILTER_DATE_TO: 'vinimap_filter_date_to',
  ACTIVE_ORDER_TAB: 'vinimap_active_order_tab',
  SEARCH_QUERY: 'vinimap_search_query'
} as const;

const VALID_ORDER_STATUSES: readonly ('Todos' | OrderStatus)[] = [
  'Todos',
  'Não iniciado',
  'Em rota',
  'Concluído',
  'Cancelado',
  'Ocorrência'
];

/**
 * Recovers the persisted filterDateFrom from sessionStorage.
 * Validates format (YYYY-MM-DD) before returning.
 */
export function getSavedFilterDateFrom(defaultDate: string): string {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return defaultDate;
    const saved = window.sessionStorage.getItem(SESSION_FILTER_KEYS.FILTER_DATE_FROM);
    if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved.trim())) {
      return saved.trim();
    }
  } catch (err) {
    console.warn('[SessionFilter] Could not read filterDateFrom from sessionStorage:', err);
  }
  return defaultDate;
}

/**
 * Recovers the persisted filterDateTo from sessionStorage.
 * Validates format (YYYY-MM-DD) before returning.
 */
export function getSavedFilterDateTo(defaultDate: string): string {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return defaultDate;
    const saved = window.sessionStorage.getItem(SESSION_FILTER_KEYS.FILTER_DATE_TO);
    if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved.trim())) {
      return saved.trim();
    }
  } catch (err) {
    console.warn('[SessionFilter] Could not read filterDateTo from sessionStorage:', err);
  }
  return defaultDate;
}

/**
 * Recovers the persisted activeOrderTab from sessionStorage.
 * Validates allowed tab values before returning.
 */
export function getSavedActiveOrderTab(defaultTab: 'Todos' | OrderStatus = 'Todos'): 'Todos' | OrderStatus {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return defaultTab;
    const saved = window.sessionStorage.getItem(SESSION_FILTER_KEYS.ACTIVE_ORDER_TAB);
    if (saved && VALID_ORDER_STATUSES.includes(saved as any)) {
      return saved as 'Todos' | OrderStatus;
    }
  } catch (err) {
    console.warn('[SessionFilter] Could not read activeOrderTab from sessionStorage:', err);
  }
  return defaultTab;
}

/**
 * Recovers the persisted searchQuery from sessionStorage.
 */
export function getSavedSearchQuery(defaultQuery: string = ''): string {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return defaultQuery;
    const saved = window.sessionStorage.getItem(SESSION_FILTER_KEYS.SEARCH_QUERY);
    if (saved !== null && typeof saved === 'string') {
      return saved;
    }
  } catch (err) {
    console.warn('[SessionFilter] Could not read searchQuery from sessionStorage:', err);
  }
  return defaultQuery;
}

/**
 * Persists filterDateFrom reactively.
 */
export function saveFilterDateFrom(date: string): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (date) {
        window.sessionStorage.setItem(SESSION_FILTER_KEYS.FILTER_DATE_FROM, date);
      } else {
        window.sessionStorage.removeItem(SESSION_FILTER_KEYS.FILTER_DATE_FROM);
      }
    }
  } catch (err) {
    console.warn('[SessionFilter] Could not save filterDateFrom:', err);
  }
}

/**
 * Persists filterDateTo reactively.
 */
export function saveFilterDateTo(date: string): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (date) {
        window.sessionStorage.setItem(SESSION_FILTER_KEYS.FILTER_DATE_TO, date);
      } else {
        window.sessionStorage.removeItem(SESSION_FILTER_KEYS.FILTER_DATE_TO);
      }
    }
  } catch (err) {
    console.warn('[SessionFilter] Could not save filterDateTo:', err);
  }
}

/**
 * Persists activeOrderTab reactively.
 */
export function saveActiveOrderTab(tab: 'Todos' | OrderStatus): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(SESSION_FILTER_KEYS.ACTIVE_ORDER_TAB, tab);
    }
  } catch (err) {
    console.warn('[SessionFilter] Could not save activeOrderTab:', err);
  }
}

/**
 * Persists searchQuery reactively.
 */
export function saveSearchQuery(query: string): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (query !== undefined && query !== null) {
        window.sessionStorage.setItem(SESSION_FILTER_KEYS.SEARCH_QUERY, query);
      } else {
        window.sessionStorage.removeItem(SESSION_FILTER_KEYS.SEARCH_QUERY);
      }
    }
  } catch (err) {
    console.warn('[SessionFilter] Could not save searchQuery:', err);
  }
}

/**
 * Clears all dashboard filter persistence when explicitly resetting the panel.
 */
export function clearSavedFilterSession(): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(SESSION_FILTER_KEYS.FILTER_DATE_FROM);
      window.sessionStorage.removeItem(SESSION_FILTER_KEYS.FILTER_DATE_TO);
      window.sessionStorage.removeItem(SESSION_FILTER_KEYS.ACTIVE_ORDER_TAB);
      window.sessionStorage.removeItem(SESSION_FILTER_KEYS.SEARCH_QUERY);
    }
  } catch (err) {
    console.warn('[SessionFilter] Could not clear filter session:', err);
  }
}
