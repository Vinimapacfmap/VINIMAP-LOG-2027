/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ViniMap Pro - IndexedDB Persistent Offline Sync Queue
 * Stores offline order updates and GPS coordinates with automated synchronization upon network recovery.
 */

import { Order, DeliveryRider } from '../types';
import { db } from '../firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { sbSaveOrder } from '../lib/supabaseService';
import { sanitizeOrderConsistency } from './orderConsistency';

const DB_NAME = 'vinimap_offline_sync_db';
const DB_VERSION = 1;
const STORE_GPS = 'offline_gps_queue';
const STORE_ORDERS = 'offline_order_queue';

export interface OfflineGpsRecord {
  id?: number;
  riderId: string;
  lat: number;
  lng: number;
  realGeoLat?: number;
  realGeoLng?: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  timestamp: string;
  createdAt: number;
}

export interface OfflineOrderAction {
  id?: number;
  orderId: string;
  riderId?: string;
  status: string;
  updatedOrder: Partial<Order>;
  timestamp: string;
  createdAt: number;
  retryCount: number;
}

// Open IndexedDB safely
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const idb = (event.target as IDBOpenDBRequest).result;
      if (!idb.objectStoreNames.contains(STORE_GPS)) {
        idb.createObjectStore(STORE_GPS, { keyPath: 'id', autoIncrement: true });
      }
      if (!idb.objectStoreNames.contains(STORE_ORDERS)) {
        idb.createObjectStore(STORE_ORDERS, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Persists an offline GPS coordinate record to IndexedDB
 */
export async function queueOfflineGpsCoord(record: Omit<OfflineGpsRecord, 'id' | 'createdAt'>): Promise<void> {
  try {
    const idb = await openDatabase();
    const tx = idb.transaction(STORE_GPS, 'readwrite');
    const store = tx.objectStore(STORE_GPS);
    store.add({
      ...record,
      createdAt: Date.now()
    });
  } catch (err) {
    console.warn('[IndexedDB Sync] Erro ao enfileirar GPS offline:', err);
    // Fallback to localStorage queue
    try {
      const existing = JSON.parse(localStorage.getItem('vinimap_offline_gps_fallback') || '[]');
      existing.push({ ...record, createdAt: Date.now() });
      if (existing.length > 100) existing.shift();
      localStorage.setItem('vinimap_offline_gps_fallback', JSON.stringify(existing));
    } catch (_) {}
  }
}

/**
 * Persists an offline Order action to IndexedDB
 */
export async function queueOfflineOrderAction(action: Omit<OfflineOrderAction, 'id' | 'createdAt' | 'retryCount'>): Promise<void> {
  try {
    const idb = await openDatabase();
    const tx = idb.transaction(STORE_ORDERS, 'readwrite');
    const store = tx.objectStore(STORE_ORDERS);
    store.add({
      ...action,
      createdAt: Date.now(),
      retryCount: 0
    });
  } catch (err) {
    console.warn('[IndexedDB Sync] Erro ao enfileirar pedido offline:', err);
  }
}

/**
 * Flushes all queued offline actions (GPS coordinates and Order updates) to the cloud
 */
export async function flushIndexedDbSyncQueue(
  onRiderCoordsSynced?: (riderId: string, lat: number, lng: number) => void
): Promise<{ gpsSynced: number; ordersSynced: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { gpsSynced: 0, ordersSynced: 0 };
  }

  let gpsSynced = 0;
  let ordersSynced = 0;

  try {
    const idb = await openDatabase();

    // 1. Sync GPS Queue
    const gpsTx = idb.transaction(STORE_GPS, 'readwrite');
    const gpsStore = gpsTx.objectStore(STORE_GPS);
    const getAllGps = gpsStore.getAll();

    getAllGps.onsuccess = async () => {
      const records: OfflineGpsRecord[] = getAllGps.result || [];
      if (records.length === 0) return;

      // Group by rider to update the latest coordinate
      const latestPerRider = new Map<string, OfflineGpsRecord>();
      records.forEach(r => {
        const existing = latestPerRider.get(r.riderId);
        if (!existing || r.createdAt > existing.createdAt) {
          latestPerRider.set(r.riderId, r);
        }
      });

      for (const [riderId, record] of latestPerRider.entries()) {
        try {
          const riderRef = doc(db, 'deliveryRiders', riderId);
          await updateDoc(riderRef, {
            lat: record.lat,
            lng: record.lng,
            realGeoLat: record.realGeoLat ?? record.lat,
            realGeoLng: record.realGeoLng ?? record.lng,
            speed: record.speed ?? 0,
            heading: record.heading ?? 0,
            accuracy: record.accuracy ?? 10,
            lastLocationUpdate: record.timestamp || new Date().toISOString()
          });
          gpsSynced++;
          if (onRiderCoordsSynced) {
            onRiderCoordsSynced(riderId, record.lat, record.lng);
          }
        } catch (e) {
          console.warn(`[IndexedDB Sync] Erro ao sincronizar GPS do condutor ${riderId}:`, e);
        }
      }

      // Clear synced GPS
      try {
        const clearTx = idb.transaction(STORE_GPS, 'readwrite');
        clearTx.objectStore(STORE_GPS).clear();
      } catch (_) {}
    };

    // 2. Sync Orders Queue
    const ordersTx = idb.transaction(STORE_ORDERS, 'readwrite');
    const ordersStore = ordersTx.objectStore(STORE_ORDERS);
    const getAllOrders = ordersStore.getAll();

    getAllOrders.onsuccess = async () => {
      const actions: OfflineOrderAction[] = getAllOrders.result || [];
      if (actions.length === 0) return;

      for (const act of actions) {
        try {
          const orderRef = doc(db, 'orders', act.orderId);
          const sanitizedPayload = { ...act.updatedOrder };
          if ((sanitizedPayload.status as string) === 'Entregando') {
            sanitizedPayload.status = 'Em rota';
          }
          await setDoc(orderRef, sanitizedPayload, { merge: true });
          await sbSaveOrder(sanitizedPayload as Order).catch(() => {});
          ordersSynced++;

          // Delete from IndexedDB upon success
          if (act.id) {
            const delTx = idb.transaction(STORE_ORDERS, 'readwrite');
            delTx.objectStore(STORE_ORDERS).delete(act.id);
          }
        } catch (e) {
          console.warn(`[IndexedDB Sync] Erro ao sincronizar pedido ${act.orderId}:`, e);
        }
      }
    };
  } catch (err) {
    console.warn('[IndexedDB Sync] Erro no processamento da fila:', err);
  }

  return { gpsSynced, ordersSynced };
}

/**
 * Pre-render consistency verification for Rider App Simulator orders.
 * Validates order statuses, fixes legacy values, and guarantees data integrity before display.
 */
export function verifyAndSanitizeRiderOrders(
  rawOrders: Order[],
  activeRiderId: string | null | undefined,
  riders: DeliveryRider[]
): Order[] {
  if (!rawOrders || !Array.isArray(rawOrders)) return [];

  return rawOrders.map(order => {
    const { order: sanitized } = sanitizeOrderConsistency(order);
    
    // Normalize status: Ensure 'Entregando' is treated as 'Em rota'
    if ((sanitized.status as string) === 'Entregando') {
      sanitized.status = 'Em rota';
    }

    return sanitized;
  });
}

// Auto-register online event listener to trigger synchronization
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[IndexedDB Sync] 🌐 Conexão restabelecida. Sincronizando fila persistente do condutor...');
    flushIndexedDbSyncQueue().catch(() => {});
  });
}
