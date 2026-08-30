import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  setDoc, 
  deleteDoc, 
  writeBatch, 
  query, 
  where,
  orderBy,
  limit,
  clearIndexedDbPersistence
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import vinimapLogo from '../assets/images/vinimap_app_logo_1785236008840.jpg';
import {
  sbSaveOrder,
  sbDeleteOrder,
  sbBulkSaveOrders,
  sbSaveClientPartner,
  sbDeleteClientPartner,
  sbSaveDeliveryRider,
  sbDeleteDeliveryRider,
  sbSaveFinancialTransaction,
  sbDeleteFinancialTransaction,
  sbBulkDeleteFinancialTransactions,
  sbPurgeTable,
  sbSaveCompanyHub,
  sbDeleteCompanyHub,
  sbAddActivityLog
} from './supabaseService';
import { 
  Order, 
  ClientPartner, 
  DeliveryRider, 
  ActivityLog, 
  FinancialTransaction,
  CompanyHub 
} from '../types';
import { syncRetryQueue, QueuePriority } from '../utils/syncRetryQueue';
import { 
  deleteOrdersFromIndexedDb, 
  clearIndexedDbOrdersStore, 
  clearAllIndexedDbStores 
} from '../utils/indexedDbSync';
import { INITIAL_RIDERS, INITIAL_ORDERS, INITIAL_LOGS } from '../data/mock';
import { INITIAL_FINANCIAL_TRANSACTIONS } from '../data/financialMock';
import { isMockOrder, MOCK_CLIENT_IDS, MOCK_RIDER_IDS, MOCK_ORDER_IDS } from '../utils/orderConsistency';

export { isMockOrder, MOCK_CLIENT_IDS, MOCK_RIDER_IDS, MOCK_ORDER_IDS };

// Default client partners set to empty to permanently exclude mocked partners
export const INITIAL_CLIENT_PARTNERS: ClientPartner[] = [];

// Helper function to recursively remove undefined fields before saving to Firestore
function removeUndefinedFields<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedFields(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    // Keep standard Firestore objects or custom types intact if they aren't plain objects, but for our types they are plain JSON
    const cleaned: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = obj[key];
        if (val !== undefined) {
          cleaned[key] = removeUndefinedFields(val);
        }
      }
    }
    return cleaned as T;
  }
  return obj;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function isQuotaError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as any)?.code;
  return (
    code === 'resource-exhausted' ||
    code === 'RESOURCE_EXHAUSTED' ||
    msg.includes('resource-exhausted') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('quota metric') ||
    msg.includes('Free daily write units per project') ||
    msg.includes('Free daily read units per project') ||
    msg.includes('Write stream exhausted') ||
    msg.includes('maximum allowed queued writes') ||
    msg.includes('maximum backoff delay') ||
    msg.includes('overloading the backend')
  );
}

let isFirestoreQuotaExceededState = false;

export function setIsFirestoreQuotaExceeded(exceeded: boolean = true): void {
  isFirestoreQuotaExceededState = exceeded;
  if (typeof window !== 'undefined') {
    try {
      if (exceeded) {
        window.sessionStorage.setItem('firestore_quota_exceeded', 'true');
      } else {
        window.sessionStorage.removeItem('firestore_quota_exceeded');
      }
    } catch (_) {}
  }
}

export function getIsFirestoreQuotaExceeded(): boolean {
  if (isFirestoreQuotaExceededState) return true;
  if (typeof window !== 'undefined') {
    return window.sessionStorage.getItem('firestore_quota_exceeded') === 'true';
  }
  return false;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): void {
  const errMessage = error instanceof Error ? error.message : String(error);
  const code = (error as any)?.code;

  if (isQuotaError(error)) {
    isFirestoreQuotaExceededState = true;
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem('firestore_quota_exceeded', 'true');
      } catch (_) {}
    }
    console.warn(`Firestore quota reached [${operationType}] on "${path}". Operating in Local Storage & Supabase mode.`);
    return;
  }

  if (code === 'unavailable' || errMessage.includes('Could not reach Cloud Firestore backend') || errMessage.includes('client is offline')) {
    console.warn(`Firestore [${operationType}] backend indisponível no caminho "${path}". Operando temporariamente em modo offline/contingência.`);
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn(`Firestore [${operationType}] handled error on path "${path}":`, errMessage);
}

// Helper functions for seeding (Permanently disabled: No mock data seeding anywhere)
export async function seedInitialDataIfEmpty(mappedInitialOrders: Order[], force: boolean = false) {
  // Permanently disabled: The system operates exclusively with real user data and never seeds mock records.
  return;
}

async function _deprecatedSeedInitialData(mappedInitialOrders: Order[], force: boolean = false) {
  if (getIsFirestoreQuotaExceeded()) {
    console.log('Quota diária do Firestore excedida. Pulando restauração remota do Firestore.');
    return;
  }
  try {
    // Check local storage flag first to avoid unnecessary remote checks when purged
    if (!force && typeof window !== 'undefined' && window.localStorage.getItem('system_purged') === 'true') {
      console.log('Base de dados zerada no localStorage. Pulando restauração de dados demo.');
      return;
    }

    // Check if system was manually purged by admin in Firestore
    const stateDocRef = doc(db, 'systemConfig', 'state');
    if (!force) {
      try {
        const stateDoc = await getDoc(stateDocRef);
        if (stateDoc.exists()) {
          const data = stateDoc.data();
          if (data?.purged === true) {
            if (typeof window !== 'undefined') {
              window.localStorage.setItem('system_purged', 'true');
            }
            console.log('Base de dados zerada no Firestore. Pulando restauração automática.');
            return;
          }
          if (data?.initialized === true) {
            console.log('Sistema já inicializado no Firestore. Pulando restauração automática.');
            return;
          }
        }
      } catch (err) {
        if (isQuotaError(err)) {
          handleFirestoreError(err, OperationType.GET, 'systemConfig/state');
          return;
        }
        console.warn('Could not check systemConfig/state:', err);
        return;
      }
    } else {
      // Clear purged flag on forced seed/restore
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('system_purged');
      }
      try {
        await setDoc(stateDocRef, { initialized: true, purged: false, updatedAt: new Date().toISOString() });
      } catch (e) {
        if (isQuotaError(e)) {
          handleFirestoreError(e, OperationType.WRITE, 'systemConfig/state');
          return;
        }
      }
    }

    // Mark as initialized in Firestore if stateDoc didn't exist yet
    try {
      await setDoc(stateDocRef, { initialized: true, purged: false, createdAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
      if (isQuotaError(e)) {
        handleFirestoreError(e, OperationType.WRITE, 'systemConfig/state');
        return;
      }
    }

    if (getIsFirestoreQuotaExceeded()) return;
    // 1. Seed & Sync Client Partners
    let clientsSnap;
    try {
      clientsSnap = await getDocs(collection(db, 'clientPartners'));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'clientPartners');
    }

    const existingClients = new Map<string, ClientPartner>();
    if (clientsSnap) {
      clientsSnap.forEach(doc => {
        existingClients.set(doc.id, doc.data() as ClientPartner);
      });
    }

    const clientsBatch = writeBatch(db);
    let clientsBatchCount = 0;

    for (const client of INITIAL_CLIENT_PARTNERS) {
      const existing = existingClients.get(client.id);
      if (!existing) {
        console.log(`Seeding client partner ${client.name} to Firestore...`);
        const docRef = doc(db, 'clientPartners', client.id);
        clientsBatch.set(docRef, removeUndefinedFields(client));
        clientsBatchCount++;
        await sbSaveClientPartner(client).catch(err => console.warn(`Supabase save client on seed error:`, err));
      } else {
        // Compare cepRanges & cepRangesHistory to see if the committed file has updated ranges or history
        const existingRangesStr = JSON.stringify(existing.cepRanges || []);
        const initialRangesStr = JSON.stringify(client.cepRanges || []);
        const existingHistStr = JSON.stringify(existing.cepRangesHistory || []);
        const initialHistStr = JSON.stringify(client.cepRangesHistory || []);

        if ((existingRangesStr !== initialRangesStr || existingHistStr !== initialHistStr) && client.cepRanges && client.cepRanges.length > 0) {
          console.log(`Updating client ${client.name} with updated cepRanges/history from code commit...`);
          const updatedClient: ClientPartner = {
            ...existing,
            cepRanges: client.cepRanges,
            cepRangesHistory: client.cepRangesHistory || existing.cepRangesHistory
          };
          const docRef = doc(db, 'clientPartners', client.id);
          clientsBatch.set(docRef, removeUndefinedFields(updatedClient));
          clientsBatchCount++;
          await sbSaveClientPartner(updatedClient).catch(err => console.warn(`Supabase save client on update seed error:`, err));
        }
      }
    }

    if (clientsBatchCount > 0) {
      try {
        await clientsBatch.commit();
        console.log(`Successfully committed ${clientsBatchCount} client partner updates to Firestore.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'clientPartners');
      }
    }

    if (getIsFirestoreQuotaExceeded()) return;

    // 2. Seed Orders
    let ordersSnap;
    try {
      ordersSnap = await getDocs(query(collection(db, 'orders'), limit(1)));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'orders');
    }
    if (getIsFirestoreQuotaExceeded()) return;

    if (ordersSnap && ordersSnap.empty) {
      console.log('Seeding orders to Firestore...');
      const batch = writeBatch(db);
      mappedInitialOrders.forEach(order => {
        const docRef = doc(db, 'orders', order.id);
        batch.set(docRef, removeUndefinedFields(order));
      });
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'orders');
      }
    }

    if (getIsFirestoreQuotaExceeded()) return;

    // 3. Seed Delivery Riders
    let ridersSnap;
    try {
      ridersSnap = await getDocs(collection(db, 'deliveryRiders'));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'deliveryRiders');
    }
    if (getIsFirestoreQuotaExceeded()) return;

    const existingRidersMap = new Map<string, DeliveryRider>();
    if (ridersSnap && !ridersSnap.empty) {
      ridersSnap.forEach(doc => {
        existingRidersMap.set(doc.id, doc.data() as DeliveryRider);
      });
    }

    const ridersBatch = writeBatch(db);
    let ridersBatchCount = 0;
    for (const rider of INITIAL_RIDERS) {
      if (!existingRidersMap.has(rider.id)) {
        console.log(`Seeding delivery rider ${rider.name} (${rider.id}) to Firestore...`);
        const docRef = doc(db, 'deliveryRiders', rider.id);
        ridersBatch.set(docRef, removeUndefinedFields(rider));
        ridersBatchCount++;
      }
    }
    if (ridersBatchCount > 0) {
      try {
        await ridersBatch.commit();
        console.log(`Successfully committed ${ridersBatchCount} delivery riders to Firestore.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'deliveryRiders');
      }
    }

    if (getIsFirestoreQuotaExceeded()) return;

    // 4. Seed Activity Logs
    let logsSnap;
    try {
      logsSnap = await getDocs(query(collection(db, 'activityLogs'), limit(1)));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'activityLogs');
    }
    if (getIsFirestoreQuotaExceeded()) return;

    if (logsSnap && logsSnap.empty) {
      console.log('Seeding activity logs to Firestore...');
      const batch = writeBatch(db);
      INITIAL_LOGS.forEach(log => {
        const docRef = doc(db, 'activityLogs', log.id);
        batch.set(docRef, removeUndefinedFields(log));
      });
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'activityLogs');
      }
    }

    if (getIsFirestoreQuotaExceeded()) return;

    // 5. Seed Financial Transactions
    let txsSnap;
    try {
      txsSnap = await getDocs(query(collection(db, 'financialTransactions'), limit(1)));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'financialTransactions');
    }
    if (getIsFirestoreQuotaExceeded()) return;

    if (txsSnap && txsSnap.empty) {
      console.log('Seeding financial transactions to Firestore...');
      const batch = writeBatch(db);
      INITIAL_FINANCIAL_TRANSACTIONS.forEach(tx => {
        const docRef = doc(db, 'financialTransactions', tx.id);
        batch.set(docRef, removeUndefinedFields(tx));
      });
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'financialTransactions');
      }
    }

    if (getIsFirestoreQuotaExceeded()) return;

    // 6. Seed Company Hubs
    let hubsSnap;
    try {
      hubsSnap = await getDocs(query(collection(db, 'companyHubs'), limit(1)));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'companyHubs');
    }
    if (getIsFirestoreQuotaExceeded()) return;

    if (hubsSnap && hubsSnap.empty) {
      console.log('Seeding initial company hubs to Firestore...');
      const batch = writeBatch(db);
      INITIAL_COMPANY_HUBS.forEach(hub => {
        const docRef = doc(db, 'companyHubs', hub.id);
        batch.set(docRef, removeUndefinedFields(hub));
      });
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'companyHubs');
      }
    } else {
      // Migrate hub-main if it contains outdated legacy mock data or missing logo
      try {
        const mainHubDocRef = doc(db, 'companyHubs', 'hub-main');
        const mainHubDoc = await getDoc(mainHubDocRef);
        if (mainHubDoc.exists()) {
          const data = mainHubDoc.data();
          if (data.address?.includes('Paulista') || data.address?.includes('Riachuelo') || !data.logoUrl) {
            console.log('Migrating main hub to include Vinimap Condutor logo...');
            await setDoc(mainHubDocRef, removeUndefinedFields({
              ...INITIAL_COMPANY_HUBS[0],
              ...data,
              logoUrl: data.logoUrl || vinimapLogo
            }), { merge: true });
          }
        }
      } catch (err) {
        if (isQuotaError(err)) {
          handleFirestoreError(err, OperationType.WRITE, 'companyHubs/hub-main');
        } else {
          console.warn('Error checking legacy main hub address/logo:', err);
        }
      }
    }
  } catch (err) {
    console.error('Error seeding initial data to Firestore:', err);
  }
}

// Helper function to record audit logs when rider allocation changes
export async function recordRiderAllocationAuditLog(
  orderId: string,
  prevRiderId: string | undefined,
  newRiderId: string | undefined
) {
  const normPrev = prevRiderId || undefined;
  const normNew = newRiderId || undefined;

  if (normPrev !== normNew) {
    const timestamp = new Date().toISOString();
    const prevText = normPrev ? `riderId: ${normPrev}` : 'Nenhum (Desalocado)';
    const newText = normNew ? `riderId: ${normNew}` : 'Nenhum (Desalocado)';
    const message = `[AUDIT - ALOCAÇÃO DE CONDUTOR] Pedido #${orderId} alterou de "${prevText}" para "${newText}" às ${timestamp}`;

    console.log(`[dbSaveOrder AUDIT LOG] ${message}`, {
      orderId,
      prevRiderId: normPrev || null,
      newRiderId: normNew || null,
      timestamp
    });

    // Save to Firestore auditLogs collection
    if (!getIsFirestoreQuotaExceeded()) {
      try {
        const auditRef = doc(collection(db, 'auditLogs'));
        await setDoc(auditRef, {
          id: auditRef.id,
          orderId,
          prevRiderId: normPrev || null,
          newRiderId: normNew || null,
          action: 'RIDER_ALLOCATION_CHANGE',
          details: message,
          timestamp,
          createdAt: timestamp
        });
      } catch (err) {
        console.warn('[dbSaveOrder AUDIT LOG] Erro ao gravar log no Firestore:', err);
      }
    }

    // Save to activity log
    try {
      await dbAddActivityLog({
        id: `audit-${orderId}-${Date.now()}`,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type: 'warning',
        message: `Alteração de condutor no Pedido #${orderId}: de "${normPrev || 'Desalocado'}" para "${normNew || 'Desalocado'}"`,
        orderId
      });
    } catch (err) {
      console.warn('[dbSaveOrder AUDIT LOG] Erro ao gravar activity log:', err);
    }
  }
}

// Order CRUD operations with Priority Retry Queue
export async function dbSaveOrder(order: Order, explicitPriority?: QueuePriority) {
  // Check previous riderId before saving
  let prevRiderId: string | undefined = undefined;
  if (!getIsFirestoreQuotaExceeded()) {
    try {
      const existingSnap = await getDoc(doc(db, 'orders', order.id));
      if (existingSnap.exists()) {
        const data = existingSnap.data();
        prevRiderId = data?.riderId || data?.driverId || undefined;
      }
    } catch (e) {
      console.warn(`[dbSaveOrder Audit] Não foi possível obter estado prévio do pedido #${order.id}:`, e);
    }
  }

  // Record audit log if rider allocation changed
  await recordRiderAllocationAuditLog(order.id, prevRiderId, order.riderId);

  // 1. Update local contingency storage immediately
  try {
    const rawBackup = localStorage.getItem('vinimap_contingency_backup_latest');
    if (rawBackup) {
      const parsed = JSON.parse(rawBackup);
      if (parsed.orders && Array.isArray(parsed.orders)) {
        const index = parsed.orders.findIndex((o: Order) => o.id === order.id);
        if (index >= 0) {
          parsed.orders[index] = order;
        } else {
          parsed.orders.unshift(order);
        }
        localStorage.setItem('vinimap_contingency_backup_latest', JSON.stringify(parsed));
      }
    }
  } catch (_) {}

  // 2. Delegate persistence to Priority Retry Queue (Handles Supabase & Firestore with auto-retry and backoff)
  return await syncRetryQueue.enqueueSave(order, explicitPriority);
}

export async function dbDeleteOrder(orderId: string, explicitPriority: QueuePriority = 'NORMAL') {
  // 1. Remove from local contingency storage
  try {
    const rawBackup = localStorage.getItem('vinimap_contingency_backup_latest');
    if (rawBackup) {
      const parsed = JSON.parse(rawBackup);
      if (parsed.orders && Array.isArray(parsed.orders)) {
        parsed.orders = parsed.orders.filter((o: Order) => o.id !== orderId);
        localStorage.setItem('vinimap_contingency_backup_latest', JSON.stringify(parsed));
      }
    }
  } catch (_) {}

  // 2. Remove from IndexedDB offline sync store
  deleteOrdersFromIndexedDb(orderId).catch(() => {});

  return await syncRetryQueue.enqueueDelete(orderId, explicitPriority);
}

export async function dbBulkSaveOrders(orders: Order[], explicitPriority: QueuePriority = 'LOW') {
  if (!orders || orders.length === 0) return [];

  // 1. Update local contingency storage immediately in a single fast map update
  try {
    const rawBackup = localStorage.getItem('vinimap_contingency_backup_latest');
    if (rawBackup) {
      const parsed = JSON.parse(rawBackup);
      if (parsed.orders && Array.isArray(parsed.orders)) {
        const map = new Map<string, Order>();
        parsed.orders.forEach((o: Order) => map.set(o.id, o));
        orders.forEach((o: Order) => map.set(o.id, o));
        parsed.orders = Array.from(map.values());
        localStorage.setItem('vinimap_contingency_backup_latest', JSON.stringify(parsed));
      }
    }
  } catch (_) {}

  // 2. Direct chunked save to Supabase
  sbBulkSaveOrders(orders).catch(err => {
    console.warn('[dbBulkSaveOrders] Erro no salvamento em lote no Supabase:', err);
  });

  // 3. Enqueue to retry queue with LOW priority (processed sequentially by background worker)
  const results = [];
  for (const order of orders) {
    results.push(await syncRetryQueue.enqueueSave(order, explicitPriority));
  }
  return results;
}

export async function dbBulkDeleteOrders(orderIds: string[]) {
  const idsSet = new Set(orderIds);
  // 1. Remove from local contingency storage
  try {
    const rawBackup = localStorage.getItem('vinimap_contingency_backup_latest');
    if (rawBackup) {
      const parsed = JSON.parse(rawBackup);
      if (parsed.orders && Array.isArray(parsed.orders)) {
        parsed.orders = parsed.orders.filter((o: Order) => !idsSet.has(o.id));
        localStorage.setItem('vinimap_contingency_backup_latest', JSON.stringify(parsed));
      }
    }
  } catch (_) {}

  // 2. Remove from IndexedDB offline sync store
  deleteOrdersFromIndexedDb(orderIds).catch(() => {});

  const results = [];
  for (const id of orderIds) {
    results.push(await syncRetryQueue.enqueueDelete(id));
  }
  return results;
}

// Indexed query helpers for large datasets using Firestore composite indexes
export async function dbQueryOrdersByStatus(status: string, maxLimit = 100): Promise<Order[]> {
  try {
    const q = query(
      collection(db, 'orders'),
      where('status', '==', status),
      orderBy('createdAt', 'desc'),
      limit(maxLimit)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Order);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'orders');
    return [];
  }
}

export async function dbQueryOrdersByRider(riderId: string, status?: string): Promise<Order[]> {
  try {
    let q;
    if (status) {
      q = query(
        collection(db, 'orders'),
        where('riderId', '==', riderId),
        where('status', '==', status)
      );
    } else {
      q = query(
        collection(db, 'orders'),
        where('riderId', '==', riderId),
        orderBy('createdAt', 'desc')
      );
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Order);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'orders');
    return [];
  }
}

export async function dbQueryOrdersByPartner(partnerName: string, maxLimit = 100): Promise<Order[]> {
  try {
    const q = query(
      collection(db, 'orders'),
      where('partnerName', '==', partnerName),
      orderBy('createdAt', 'desc'),
      limit(maxLimit)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Order);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'orders');
    return [];
  }
}

// Client CRUD operations
export async function dbSaveClientPartner(client: ClientPartner) {
  try {
    await sbSaveClientPartner(client);
  } catch (err) {
    console.warn('Supabase save client warning:', err);
  }

  if (!getIsFirestoreQuotaExceeded()) {
    try {
      await setDoc(doc(db, 'clientPartners', client.id), removeUndefinedFields(client));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `clientPartners/${client.id}`);
    }
  }
}

export async function dbDeleteClientPartner(clientId: string) {
  try {
    await sbDeleteClientPartner(clientId);
  } catch (err) {
    console.warn('Supabase delete client warning:', err);
  }

  if (!getIsFirestoreQuotaExceeded()) {
    try {
      await deleteDoc(doc(db, 'clientPartners', clientId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `clientPartners/${clientId}`);
    }
  }
}

// Function to permanently purge mock client partners from Firestore, Supabase, and local storage
export async function dbPurgeMockClientPartners(): Promise<void> {
  for (const mockId of MOCK_CLIENT_IDS) {
    try {
      await dbDeleteClientPartner(mockId);
    } catch (err) {
      console.warn(`Could not delete mock client ${mockId}:`, err);
    }
  }
}

// Function to permanently purge mock riders and mock orders from Firestore, Supabase, and local storage
export async function dbPurgeMockRidersAndOrders(): Promise<void> {
  for (const mockId of MOCK_RIDER_IDS) {
    try {
      await dbDeleteDeliveryRider(mockId);
    } catch (err) {
      console.warn(`Could not delete mock rider ${mockId}:`, err);
    }
  }
  for (const mockId of MOCK_ORDER_IDS) {
    try {
      await dbDeleteOrder(mockId);
    } catch (err) {
      console.warn(`Could not delete mock order ${mockId}:`, err);
    }
  }

  // Scan Firestore orders for any orphaned/residual mock orders
  if (!getIsFirestoreQuotaExceeded()) {
    try {
      const ordersSnap = await getDocs(collection(db, 'orders'));
      if (!ordersSnap.empty) {
        const batch = writeBatch(db);
        let count = 0;
        ordersSnap.docs.forEach(docSnap => {
          const orderData = docSnap.data() as Order;
          if (isMockOrder(orderData)) {
            batch.delete(docSnap.ref);
            count++;
          }
        });
        if (count > 0) {
          await batch.commit();
          console.log(`[Mock Purge] Excluídos ${count} pedidos mockados residuais do Firestore.`);
        }
      }
    } catch (err) {
      console.warn('Could not scan Firestore for residual mock orders:', err);
    }
  }

  // Also clean up local caches
  try {
    if (typeof window !== 'undefined') {
      const cachedRidersRaw = localStorage.getItem('vinimap_cached_delivery_riders');
      if (cachedRidersRaw) {
        const parsed = JSON.parse(cachedRidersRaw);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(r => !MOCK_RIDER_IDS.includes(r.id));
          localStorage.setItem('vinimap_cached_delivery_riders', JSON.stringify(filtered));
        }
      }

      const backupRaw = localStorage.getItem('vinimap_contingency_backup_latest');
      if (backupRaw) {
        const parsed = JSON.parse(backupRaw);
        if (parsed.deliveryRiders && Array.isArray(parsed.deliveryRiders)) {
          parsed.deliveryRiders = parsed.deliveryRiders.filter((r: any) => !MOCK_RIDER_IDS.includes(r.id));
        }
        if (parsed.clientPartners && Array.isArray(parsed.clientPartners)) {
          parsed.clientPartners = parsed.clientPartners.filter((c: any) => !MOCK_CLIENT_IDS.includes(c.id));
        }
        if (parsed.orders && Array.isArray(parsed.orders)) {
          parsed.orders = parsed.orders.filter((o: any) => !isMockOrder(o));
        }
        localStorage.setItem('vinimap_contingency_backup_latest', JSON.stringify(parsed));
      }
    }
  } catch (e) {
    console.warn('Could not clean local storage caches during rider purge:', e);
  }

  // Delete mock orders from IndexedDB
  try {
    await deleteOrdersFromIndexedDb(MOCK_ORDER_IDS);
  } catch (e) {
    console.warn('Could not purge mock orders from IndexedDB:', e);
  }
}

// Rider CRUD operations
export async function validateRiderDeviceSession(
  inputDeviceOrPhone: string,
  riderId: string,
  currentDeviceId: string
): Promise<{ allowed: boolean; activeRiderName?: string; reason?: string }> {
  if (getIsFirestoreQuotaExceeded()) return { allowed: true };
  try {
    if (!inputDeviceOrPhone) return { allowed: true };
    const cleanInput = inputDeviceOrPhone.trim().toLowerCase();
    const cleanPhone = inputDeviceOrPhone.replace(/\D/g, '');

    const ridersSnap = await getDocs(collection(db, 'deliveryRiders'));
    if (ridersSnap.empty) return { allowed: true };

    for (const docSnap of ridersSnap.docs) {
      const r = docSnap.data() as DeliveryRider;
      const matchDevice = r.deviceNumber && r.deviceNumber.trim().toLowerCase() === cleanInput;
      const matchPhone = cleanPhone && r.phone && r.phone.replace(/\D/g, '') === cleanPhone;
      const matchId = r.id === riderId;

      if ((matchDevice || matchPhone || matchId) && r.isLoggedIn) {
        if (r.activeDeviceId && r.activeDeviceId !== currentDeviceId) {
          return {
            allowed: false,
            activeRiderName: r.name,
            reason: `Dispositivo já logado`
          };
        }
      }
    }
  } catch (err) {
    console.warn('Error validating rider device session:', err);
  }
  return { allowed: true };
}

export async function dbSaveDeliveryRider(
  rider: DeliveryRider,
  options?: { checkDeviceSession?: boolean; currentDeviceId?: string }
) {
  if (options?.checkDeviceSession && rider.isLoggedIn && options.currentDeviceId) {
    const deviceCheck = await validateRiderDeviceSession(
      rider.deviceNumber || rider.phone,
      rider.id,
      options.currentDeviceId
    );
    if (!deviceCheck.allowed) {
      const error = new Error('Dispositivo já logado');
      (error as any).code = 'DEVICE_ALREADY_LOGGED_IN';
      throw error;
    }
  }

  try {
    await sbSaveDeliveryRider(rider);
  } catch (err) {
    console.warn('Supabase save rider warning:', err);
  }

  if (!getIsFirestoreQuotaExceeded()) {
    try {
      await setDoc(doc(db, 'deliveryRiders', rider.id), removeUndefinedFields(rider));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `deliveryRiders/${rider.id}`);
    }
  }
}

export async function dbDeleteDeliveryRider(riderId: string) {
  try {
    await sbDeleteDeliveryRider(riderId);
  } catch (err) {
    console.warn('Supabase delete rider warning:', err);
  }

  if (!getIsFirestoreQuotaExceeded()) {
    try {
      await deleteDoc(doc(db, 'deliveryRiders', riderId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `deliveryRiders/${riderId}`);
    }
  }
}

// Activity Log operations
export async function dbAddActivityLog(log: ActivityLog) {
  try {
    await sbAddActivityLog(log);
  } catch (err) {
    console.warn('Supabase save log warning:', err);
  }

  if (!getIsFirestoreQuotaExceeded()) {
    try {
      await setDoc(doc(db, 'activityLogs', log.id), removeUndefinedFields(log));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `activityLogs/${log.id}`);
    }
  }
}

export async function dbBulkSaveActivityLogs(logs: ActivityLog[]) {
  for (const log of logs) {
    await sbAddActivityLog(log).catch(err => console.warn('Supabase save log error:', err));
  }

  if (!getIsFirestoreQuotaExceeded()) {
    try {
      const batch = writeBatch(db);
      logs.forEach(log => {
        batch.set(doc(db, 'activityLogs', log.id), removeUndefinedFields(log));
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'activityLogs');
    }
  }
}

export async function dbQueryLogsByType(type: string, maxLimit = 100): Promise<ActivityLog[]> {
  try {
    const q = query(
      collection(db, 'activityLogs'),
      where('type', '==', type),
      orderBy('time', 'desc'),
      limit(maxLimit)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as ActivityLog);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'activityLogs');
    return [];
  }
}

export async function dbQueryRecentLogs(maxLimit = 50): Promise<ActivityLog[]> {
  try {
    const q = query(
      collection(db, 'activityLogs'),
      orderBy('time', 'desc'),
      limit(maxLimit)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as ActivityLog);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'activityLogs');
    return [];
  }
}

// Financial Transaction operations
export async function dbSaveFinancialTransaction(tx: FinancialTransaction) {
  try {
    await sbSaveFinancialTransaction(tx);
  } catch (err) {
    console.warn('Supabase save transaction warning:', err);
  }

  if (!getIsFirestoreQuotaExceeded()) {
    try {
      await setDoc(doc(db, 'financialTransactions', tx.id), removeUndefinedFields(tx));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `financialTransactions/${tx.id}`);
    }
  }
}

export async function dbDeleteFinancialTransaction(txId: string) {
  try {
    await sbDeleteFinancialTransaction(txId);
  } catch (err) {
    console.warn('Supabase delete transaction warning:', err);
  }

  if (!getIsFirestoreQuotaExceeded()) {
    try {
      await deleteDoc(doc(db, 'financialTransactions', txId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `financialTransactions/${txId}`);
    }
  }
}

// Company Hub CRUD operations
export const INITIAL_COMPANY_HUBS: CompanyHub[] = [];

export async function dbSaveCompanyHub(hub: CompanyHub) {
  try {
    await sbSaveCompanyHub(hub);
  } catch (err) {
    console.warn('Supabase save hub warning:', err);
  }

  if (!getIsFirestoreQuotaExceeded()) {
    try {
      await setDoc(doc(db, 'companyHubs', hub.id), removeUndefinedFields(hub));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `companyHubs/${hub.id}`);
    }
  }
}

export async function dbDeleteCompanyHub(hubId: string) {
  try {
    await sbDeleteCompanyHub(hubId);
  } catch (err) {
    console.warn('Supabase delete hub warning:', err);
  }

  if (!getIsFirestoreQuotaExceeded()) {
    try {
      await deleteDoc(doc(db, 'companyHubs', hubId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `companyHubs/${hubId}`);
    }
  }
}

// General Clear operations to clean mock data
export async function dbResetToDemoState(mappedOrders: Order[] = []) {
  // Purge any mock data definitively
  await dbPurgeMockClientPartners();
  await dbPurgeMockRidersAndOrders();
}

// Applies remote Supabase state to Firestore to sync active UI state
export async function dbApplyLoadedState(state: any) {
  if (getIsFirestoreQuotaExceeded()) return;
  try {
    const batch = writeBatch(db);
    
    if (state.orders) {
      state.orders.forEach((o: Order) => batch.set(doc(db, 'orders', o.id), removeUndefinedFields(o)));
    }
    if (state.clients) {
      state.clients.forEach((c: ClientPartner) => batch.set(doc(db, 'clientPartners', c.id), removeUndefinedFields(c)));
    }
    if (state.riders) {
      state.riders.forEach((r: DeliveryRider) => batch.set(doc(db, 'deliveryRiders', r.id), removeUndefinedFields(r)));
    }
    if (state.logs) {
      state.logs.forEach((l: ActivityLog) => batch.set(doc(db, 'activityLogs', l.id), removeUndefinedFields(l)));
    }
    if (state.txs) {
      state.txs.forEach((t: FinancialTransaction) => batch.set(doc(db, 'financialTransactions', t.id), removeUndefinedFields(t)));
    }
    if (state.hubs) {
      state.hubs.forEach((h: CompanyHub) => batch.set(doc(db, 'companyHubs', h.id), removeUndefinedFields(h)));
    }
    
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'supabase_state_apply');
  }
}

// Purge helper operations for Seeder & Purge Data Manager
export async function dbPurgeCollectionDocs(collectionName: string) {
  // Always purge Supabase if mapped
  const supabaseTableMap: Record<string, string> = {
    orders: 'orders',
    financialTransactions: 'financial_transactions',
    activityLogs: 'activity_logs',
    clientPartners: 'client_partners',
    deliveryRiders: 'delivery_riders',
    companyHubs: 'company_hubs'
  };
  if (supabaseTableMap[collectionName]) {
    await sbPurgeTable(supabaseTableMap[collectionName]).catch(() => {});
  }

  // Clear local contingency backup and IndexedDB store for the collection
  if (collectionName === 'orders') {
    clearIndexedDbOrdersStore().catch(() => {});
    try {
      const rawBackup = localStorage.getItem('vinimap_contingency_backup_latest');
      if (rawBackup) {
        const parsed = JSON.parse(rawBackup);
        if (parsed.orders) {
          parsed.orders = [];
          localStorage.setItem('vinimap_contingency_backup_latest', JSON.stringify(parsed));
        }
      }
    } catch (_) {}
  }

  if (getIsFirestoreQuotaExceeded()) return;

  try {
    const snap = await getDocs(collection(db, collectionName));
    if (!snap.empty) {
      // Process in batches of 400 (Firestore batch max is 500)
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + 400);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    }
  } catch (err) {
    if (isQuotaError(err)) {
      handleFirestoreError(err, OperationType.DELETE, collectionName);
    } else {
      console.warn(`Error purging collection ${collectionName}:`, err);
    }
  }
}

// Explicitly clear local web storage and IndexedDB caches to prevent stale offline restoration
export async function clearLocalSystemCache() {
  try {
    if (typeof window !== 'undefined') {
      const isPurged = window.localStorage.getItem('system_purged');
      const supabaseUrl = window.localStorage.getItem('SUPABASE_URL');
      const supabaseAnonKey = window.localStorage.getItem('SUPABASE_ANON_KEY');
      const activeHub = window.localStorage.getItem('vinimap_active_hub');

      // 1. Clear LocalStorage and SessionStorage
      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
        if (isPurged) {
          window.localStorage.setItem('system_purged', isPurged);
        }
        if (supabaseUrl) {
          window.localStorage.setItem('SUPABASE_URL', supabaseUrl);
        }
        if (supabaseAnonKey) {
          window.localStorage.setItem('SUPABASE_ANON_KEY', supabaseAnonKey);
        }
        if (activeHub) {
          window.localStorage.setItem('vinimap_active_hub', activeHub);
        }
      } catch (e) {
        console.warn('Could not clear localStorage/sessionStorage:', e);
      }

      // 2. Clear app IndexedDB stores
      try {
        await clearAllIndexedDbStores();
      } catch (e) {
        console.warn('Could not clear app IndexedDB stores:', e);
      }

      // 3. Clear browser IndexedDB databases
      if ('indexedDB' in window && window.indexedDB) {
        try {
          if (typeof window.indexedDB.databases === 'function') {
            const dbs = await window.indexedDB.databases();
            for (const dbInfo of dbs) {
              if (dbInfo.name) {
                try {
                  window.indexedDB.deleteDatabase(dbInfo.name);
                } catch (delErr) {
                  console.warn(`Could not delete IndexedDB ${dbInfo.name}:`, delErr);
                }
              }
            }
          } else {
            const commonDbNames = [
              'firestore/[DEFAULT]',
              'firebase-heartbeat-database',
              'firebase-installations-database'
            ];
            commonDbNames.forEach(name => {
              try { window.indexedDB.deleteDatabase(name); } catch (_) {}
            });
          }
        } catch (idbErr) {
          console.warn('Error enumerating/deleting IndexedDB databases:', idbErr);
        }
      }
    }

    // 3. Attempt Firestore clearIndexedDbPersistence
    try {
      await clearIndexedDbPersistence(db);
    } catch (fErr) {
      console.warn('Firestore active, IndexedDB deleted directly via browser API');
    }
  } catch (err) {
    console.warn('Failed to clear local system cache:', err);
  }
}

export async function dbPurgeAllData() {
  const collectionsToPurge = [
    'orders',
    'clientPartners',
    'deliveryRiders',
    'activityLogs',
    'financialTransactions',
    'companyHubs'
  ];
  for (const col of collectionsToPurge) {
    await dbPurgeCollectionDocs(col);
  }

  // Set systemConfig/state purged = true so auto-seeder won't re-populate on reload
  if (!getIsFirestoreQuotaExceeded()) {
    try {
      await setDoc(doc(db, 'systemConfig', 'state'), { initialized: true, purged: true, purgedAt: new Date().toISOString() });
    } catch (err) {
      if (isQuotaError(err)) {
        handleFirestoreError(err, OperationType.WRITE, 'systemConfig/state');
      } else {
        console.warn('Could not set systemConfig/state purged flag:', err);
      }
    }
  }

  // Clear local IndexedDB and Storage cache
  await clearLocalSystemCache();

  // Set system_purged in localStorage after cache clear
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem('system_purged', 'true');
    } catch (_) {}
  }
}

export async function dbBulkDeleteClients(clientIds: string[]) {
  for (const id of clientIds) {
    await sbDeleteClientPartner(id).catch(() => {});
  }

  if (getIsFirestoreQuotaExceeded()) return;

  try {
    const batch = writeBatch(db);
    clientIds.forEach(id => batch.delete(doc(db, 'clientPartners', id)));
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'clientPartners');
  }
}

export async function dbBulkDeleteRiders(riderIds: string[]) {
  for (const id of riderIds) {
    await sbDeleteDeliveryRider(id).catch(() => {});
  }

  if (getIsFirestoreQuotaExceeded()) return;

  try {
    const batch = writeBatch(db);
    riderIds.forEach(id => batch.delete(doc(db, 'deliveryRiders', id)));
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'deliveryRiders');
  }
}

export async function dbBulkDeleteTransactions(txIds: string[]) {
  await sbBulkDeleteFinancialTransactions(txIds).catch(err => console.warn('Supabase bulk delete error:', err));

  if (getIsFirestoreQuotaExceeded()) return;

  try {
    for (let i = 0; i < txIds.length; i += 400) {
      const chunk = txIds.slice(i, i + 400);
      const batch = writeBatch(db);
      chunk.forEach(id => batch.delete(doc(db, 'financialTransactions', id)));
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'financialTransactions');
  }
}

export async function dbBulkSaveClients(clients: ClientPartner[]) {
  for (const c of clients) {
    await sbSaveClientPartner(c).catch(() => {});
  }

  if (getIsFirestoreQuotaExceeded()) return;

  try {
    const batch = writeBatch(db);
    clients.forEach(c => batch.set(doc(db, 'clientPartners', c.id), removeUndefinedFields(c)));
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'clientPartners');
  }
}

export async function dbBulkSaveRiders(riders: DeliveryRider[]) {
  for (const r of riders) {
    await sbSaveDeliveryRider(r).catch(() => {});
  }

  if (getIsFirestoreQuotaExceeded()) return;

  try {
    const batch = writeBatch(db);
    riders.forEach(r => batch.set(doc(db, 'deliveryRiders', r.id), removeUndefinedFields(r)));
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'deliveryRiders');
  }
}

export async function dbSaveNotificationSettings(settings: any) {
  if (getIsFirestoreQuotaExceeded()) return;
  try {
    await setDoc(doc(db, 'systemConfig', 'notificationSettings'), removeUndefinedFields(settings));
    console.log('[dbSaveNotificationSettings SUCCESS] Global notification settings saved to Firestore.');
  } catch (err) {
    console.warn('[dbSaveNotificationSettings WARN]:', err);
  }
}

export async function dbGetNotificationSettings(): Promise<any | null> {
  if (getIsFirestoreQuotaExceeded()) return null;
  try {
    const snap = await getDoc(doc(db, 'systemConfig', 'notificationSettings'));
    if (snap.exists()) {
      return snap.data();
    }
  } catch (err) {
    console.warn('[dbGetNotificationSettings WARN]:', err);
  }
  return null;
}


