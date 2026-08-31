/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ViniMap Pro - IndexedDB Persistent Offline Operations & Sync Queue
 * Stores dashboard offline operations (deallocations, allocations, status updates),
 * driver actions, and GPS coordinates with automated synchronization upon network recovery.
 */

import { Order, DeliveryRider } from '../types';
import { db } from '../firebase';
import { doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { sbSaveOrder, sbDeleteOrder } from '../lib/supabaseService';
import { sanitizeOrderConsistency } from './orderConsistency';
import { realtimeSyncBus } from './realtimeSync';

const DB_NAME = 'vinimap_offline_sync_db';
const DB_VERSION = 2;
const STORE_GPS = 'offline_gps_queue';
const STORE_ORDERS = 'offline_order_queue';
const STORE_OPERATIONS = 'offline_operations_queue';

export type OfflineOpType = 'DEALLOCATE' | 'ALLOCATE' | 'UPDATE_STATUS' | 'UPDATE' | 'DELETE' | 'BULK_UPDATE';

export interface DashboardOfflineOperation {
  id: string;
  entityType: 'ORDER' | 'RIDER' | 'CLIENT';
  operationType: OfflineOpType;
  entityId: string;
  payload?: any;
  priority?: 'HIGH' | 'NORMAL' | 'LOW';
  timestamp: string;
  createdAt: number;
  retryCount: number;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  lastError?: string;
}

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
export function openDatabase(): Promise<IDBDatabase> {
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
      if (!idb.objectStoreNames.contains(STORE_OPERATIONS)) {
        const opStore = idb.createObjectStore(STORE_OPERATIONS, { keyPath: 'id' });
        opStore.createIndex('createdAt', 'createdAt', { unique: false });
        opStore.createIndex('entityId', 'entityId', { unique: false });
        opStore.createIndex('status', 'status', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Enqueues an offline dashboard operation into IndexedDB
 */
export async function enqueueOfflineOperation(
  op: Omit<DashboardOfflineOperation, 'id' | 'createdAt' | 'retryCount' | 'status'> & { id?: string }
): Promise<string> {
  const now = Date.now();
  const opId = op.id || `op_${op.entityType.toLowerCase()}_${op.entityId}_${now}_${Math.random().toString(36).slice(2, 7)}`;
  
  const record: DashboardOfflineOperation = {
    ...op,
    id: opId,
    createdAt: now,
    retryCount: 0,
    status: 'PENDING'
  };

  try {
    const idb = await openDatabase();
    const tx = idb.transaction(STORE_OPERATIONS, 'readwrite');
    const store = tx.objectStore(STORE_OPERATIONS);
    store.put(record);
    console.log(`[IndexedDB Operations Queue] 📥 Operação enfileirada: ${op.operationType} #${op.entityId} (ID: ${opId})`);
  } catch (err) {
    console.warn('[IndexedDB Operations Queue] Erro ao gravar no IndexedDB, usando fallback:', err);
    try {
      const fallbackKey = 'vinimap_offline_ops_fallback';
      const existing = JSON.parse(localStorage.getItem(fallbackKey) || '[]');
      const filtered = existing.filter((item: DashboardOfflineOperation) => item.id !== opId);
      filtered.push(record);
      if (filtered.length > 200) filtered.shift();
      localStorage.setItem(fallbackKey, JSON.stringify(filtered));
    } catch (_) {}
  }

  // Trigger sync attempt in background if online
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    setTimeout(() => {
      flushIndexedDbOperationsQueue().catch(() => {});
    }, 50);
  }

  return opId;
}

/**
 * Gets all pending offline operations from IndexedDB
 */
export async function getAllOfflineOperations(): Promise<DashboardOfflineOperation[]> {
  try {
    const idb = await openDatabase();
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_OPERATIONS, 'readonly');
      const store = tx.objectStore(STORE_OPERATIONS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (_) {
    try {
      const fallback = localStorage.getItem('vinimap_offline_ops_fallback');
      return fallback ? JSON.parse(fallback) : [];
    } catch {
      return [];
    }
  }
}

/**
 * Removes an operation from IndexedDB upon successful sync
 */
export async function removeOfflineOperation(opId: string): Promise<void> {
  try {
    const idb = await openDatabase();
    const tx = idb.transaction(STORE_OPERATIONS, 'readwrite');
    const store = tx.objectStore(STORE_OPERATIONS);
    store.delete(opId);
  } catch (err) {
    console.warn('[IndexedDB Operations Queue] Erro ao remover operação do IndexedDB:', err);
  }

  try {
    const fallbackKey = 'vinimap_offline_ops_fallback';
    const raw = localStorage.getItem(fallbackKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      const filtered = parsed.filter((item: DashboardOfflineOperation) => item.id !== opId);
      localStorage.setItem(fallbackKey, JSON.stringify(filtered));
    }
  } catch (_) {}
}

/**
 * Clears the operations store in IndexedDB
 */
export async function clearOfflineOperationsStore(): Promise<void> {
  try {
    const idb = await openDatabase();
    const tx = idb.transaction(STORE_OPERATIONS, 'readwrite');
    const store = tx.objectStore(STORE_OPERATIONS);
    store.clear();
  } catch (_) {}
  try {
    localStorage.removeItem('vinimap_offline_ops_fallback');
  } catch (_) {}
}

/**
 * Flushes all pending dashboard operations from IndexedDB to Firestore & Supabase,
 * and broadcasts updates via RealtimeSyncBus.
 */
let isFlushingOperations = false;

export async function flushIndexedDbOperationsQueue(): Promise<{ synced: number; failed: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  if (isFlushingOperations) {
    return { synced: 0, failed: 0 };
  }

  isFlushingOperations = true;
  let synced = 0;
  let failed = 0;

  try {
    const ops = await getAllOfflineOperations();
    if (ops.length === 0) {
      isFlushingOperations = false;
      return { synced: 0, failed: 0 };
    }

    // Sort by createdAt ascending (FIFO)
    ops.sort((a, b) => a.createdAt - b.createdAt);

    console.log(`[IndexedDB Operations Queue] 🚀 Sincronizando ${ops.length} operações offline pendentes com a nuvem...`);

    for (const op of ops) {
      try {
        if (op.entityType === 'ORDER') {
          if (op.operationType === 'DELETE') {
            await deleteDoc(doc(db, 'orders', op.entityId)).catch(() => {});
            await sbDeleteOrder(op.entityId).catch(() => {});
            realtimeSyncBus.broadcastOrderDelete(op.entityId);
          } else {
            // DEALLOCATE, ALLOCATE, UPDATE_STATUS, UPDATE
            const orderPayload: Order = op.payload;
            if (orderPayload) {
              const { order: sanitized } = sanitizeOrderConsistency(orderPayload);
              await setDoc(doc(db, 'orders', op.entityId), sanitized, { merge: true });
              await sbSaveOrder(sanitized).catch(() => {});
              
              // Broadcast locally and across tabs so Driver App updates immediately
              realtimeSyncBus.broadcastOrderUpdate(sanitized);
              realtimeSyncBus.broadcastOrderStatusChanged(sanitized);
              realtimeSyncBus.broadcast('ORDERS_BATCH_UPDATED', [sanitized]);
            }
          }
        }

        await removeOfflineOperation(op.id);
        synced++;
        console.log(`[IndexedDB Operations Queue] ✅ Operação #${op.entityId} (${op.operationType}) sincronizada com sucesso.`);
      } catch (err: any) {
        failed++;
        console.warn(`[IndexedDB Operations Queue] ⚠️ Falha ao sincronizar operação #${op.entityId}:`, err);
      }
    }
  } catch (err) {
    console.warn('[IndexedDB Operations Queue] Erro no ciclo de flush:', err);
  } finally {
    isFlushingOperations = false;
  }

  return { synced, failed };
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

  // Also flush dashboard operations
  flushIndexedDbOperationsQueue().catch(() => {});

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

/**
 * Deletes specific order(s) from IndexedDB offline queue
 */
export async function deleteOrdersFromIndexedDb(orderIds: string[] | string): Promise<void> {
  const idsToDelete = new Set(Array.isArray(orderIds) ? orderIds : [orderIds]);
  if (idsToDelete.size === 0) return;

  try {
    const idb = await openDatabase();
    const tx = idb.transaction([STORE_ORDERS, STORE_OPERATIONS], 'readwrite');
    const storeOrders = tx.objectStore(STORE_ORDERS);
    const getAllReq = storeOrders.getAll();

    getAllReq.onsuccess = () => {
      const records: OfflineOrderAction[] = getAllReq.result || [];
      records.forEach(rec => {
        if (rec.id && (idsToDelete.has(rec.orderId) || idsToDelete.has(String(rec.id)))) {
          try {
            storeOrders.delete(rec.id);
          } catch (_) {}
        }
      });
    };

    const storeOps = tx.objectStore(STORE_OPERATIONS);
    const getAllOps = storeOps.getAll();
    getAllOps.onsuccess = () => {
      const ops: DashboardOfflineOperation[] = getAllOps.result || [];
      ops.forEach(op => {
        if (idsToDelete.has(op.entityId) || idsToDelete.has(op.id)) {
          try {
            storeOps.delete(op.id);
          } catch (_) {}
        }
      });
    };
  } catch (err) {
    console.warn('[IndexedDB Sync] Erro ao deletar pedido(s) do IndexedDB:', err);
  }
}

/**
 * Clears the entire orders store in IndexedDB
 */
export async function clearIndexedDbOrdersStore(): Promise<void> {
  try {
    const idb = await openDatabase();
    const tx = idb.transaction(STORE_ORDERS, 'readwrite');
    const store = tx.objectStore(STORE_ORDERS);
    store.clear();
    console.log('[IndexedDB Sync] Store "offline_order_queue" do IndexedDB limpa com sucesso.');
  } catch (err) {
    console.warn('[IndexedDB Sync] Erro ao limpar store de pedidos do IndexedDB:', err);
  }
}

/**
 * Clears all object stores in the offline sync IndexedDB database
 */
export async function clearAllIndexedDbStores(): Promise<void> {
  try {
    const idb = await openDatabase();
    const storeNames = Array.from(idb.objectStoreNames);
    if (storeNames.length > 0) {
      const tx = idb.transaction(storeNames, 'readwrite');
      storeNames.forEach(name => {
        try {
          tx.objectStore(name).clear();
        } catch (_) {}
      });
    }
  } catch (err) {
    console.warn('[IndexedDB Sync] Erro ao limpar todos os stores do IndexedDB:', err);
  }
}

// Auto-register online and visibility event listeners to trigger immediate synchronization
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[IndexedDB Operations Queue] 🌐 Conexão restabelecida. Sincronizando operações offline...');
    flushIndexedDbOperationsQueue().catch(() => {});
    flushIndexedDbSyncQueue().catch(() => {});
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      flushIndexedDbOperationsQueue().catch(() => {});
    }
  });

  window.addEventListener('focus', () => {
    if (navigator.onLine) {
      flushIndexedDbOperationsQueue().catch(() => {});
    }
  });

  // Background interval check every 8 seconds
  setInterval(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      flushIndexedDbOperationsQueue().catch(() => {});
    }
  }, 8000);
}

