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
import { INITIAL_RIDERS, INITIAL_ORDERS, INITIAL_LOGS } from '../data/mock';
import { INITIAL_FINANCIAL_TRANSACTIONS } from '../data/financialMock';

// Define the default client partners since they are not in mock.ts
export const INITIAL_CLIENT_PARTNERS: ClientPartner[] = [
  { 
    id: 'CL1-001', 
    codigoCliente: 'CL1-001', 
    name: 'Ana Silva', 
    region: 'Centro', 
    tel: '(11) 99123-4567', 
    addr: 'Av. Paulista, 1000', 
    status: 'Adimplente', 
    type: 'Parceiro', 
    cnpj: '12.345.678/0001-00', 
    cep: '01310-100', 
    cidade: 'São Paulo', 
    estado: 'SP', 
    cepRanges: [
      { id: 'cl1-r1-v2', cepStart: '01000-000', cepEnd: '01399-999', value: 10.00, expressValue: 14.00, driverRepass: 8.00, description: 'Centro Expandido' },
      { id: 'cl1-r2-v2', cepStart: '01400-000', cepEnd: '01499-999', value: 12.00, expressValue: 16.00, driverRepass: 9.50, description: 'Jardins / Cerqueira César' },
      { id: 'cl1-r3-v2', cepStart: '01500-000', cepEnd: '01999-999', value: 11.00, expressValue: 15.00, driverRepass: 8.80, description: 'Liberdade / Bela Vista' },
      { id: 'cl1-r4-v2', cepStart: '02000-000', cepEnd: '02999-999', value: 14.00, expressValue: 18.50, driverRepass: 11.00, description: 'Zona Norte (Santana/Tucuruvi)' },
      { id: 'cl1-r5-v2', cepStart: '03000-000', cepEnd: '03999-999', value: 15.00, expressValue: 19.50, driverRepass: 12.00, description: 'Zona Leste (Tatuapé/Mooca)' },
      { id: 'cl1-r6-v2', cepStart: '04000-000', cepEnd: '04999-999', value: 13.50, expressValue: 17.50, driverRepass: 10.80, description: 'Zona Sul (Vila Mariana/Itaim)' },
      { id: 'cl1-r7-v2', cepStart: '05000-000', cepEnd: '05999-999', value: 14.50, expressValue: 19.00, driverRepass: 11.50, description: 'Zona Oeste (Pinheiros/Lapa)' }
    ],
    cepRangesHistory: [
      {
        id: 'hist-cl1-001-v2',
        importedAt: '25/07/2026 09:30',
        filename: 'Tabela_Precos_CEP_Ana_Silva_2026_v2.xlsx',
        rangesCount: 7,
        note: 'Última tabela de frete e repasses importada (Ativa)',
        cepRanges: [
          { id: 'cl1-r1-v2', cepStart: '01000-000', cepEnd: '01399-999', value: 10.00, expressValue: 14.00, driverRepass: 8.00, description: 'Centro Expandido' },
          { id: 'cl1-r2-v2', cepStart: '01400-000', cepEnd: '01499-999', value: 12.00, expressValue: 16.00, driverRepass: 9.50, description: 'Jardins / Cerqueira César' },
          { id: 'cl1-r3-v2', cepStart: '01500-000', cepEnd: '01999-999', value: 11.00, expressValue: 15.00, driverRepass: 8.80, description: 'Liberdade / Bela Vista' },
          { id: 'cl1-r4-v2', cepStart: '02000-000', cepEnd: '02999-999', value: 14.00, expressValue: 18.50, driverRepass: 11.00, description: 'Zona Norte (Santana/Tucuruvi)' },
          { id: 'cl1-r5-v2', cepStart: '03000-000', cepEnd: '03999-999', value: 15.00, expressValue: 19.50, driverRepass: 12.00, description: 'Zona Leste (Tatuapé/Mooca)' },
          { id: 'cl1-r6-v2', cepStart: '04000-000', cepEnd: '04999-999', value: 13.50, expressValue: 17.50, driverRepass: 10.80, description: 'Zona Sul (Vila Mariana/Itaim)' },
          { id: 'cl1-r7-v2', cepStart: '05000-000', cepEnd: '05999-999', value: 14.50, expressValue: 19.00, driverRepass: 11.50, description: 'Zona Oeste (Pinheiros/Lapa)' }
        ]
      },
      {
        id: 'hist-cl1-001-v1',
        importedAt: '10/01/2026 14:15',
        filename: 'Tabela_Precos_CEP_Ana_Silva_2026_v1.xlsx',
        rangesCount: 3,
        note: 'Tabela anterior (Substituída)',
        cepRanges: [
          { id: 'cl1-r1', cepStart: '01000-000', cepEnd: '01399-999', value: 10.00, expressValue: 14.00, driverRepass: 8.00, description: 'Centro Expandido v1' },
          { id: 'cl1-r2', cepStart: '01400-000', cepEnd: '01499-999', value: 12.00, expressValue: 16.00, driverRepass: 9.50, description: 'Jardins / Cerqueira César v1' },
          { id: 'cl1-r3', cepStart: '01500-000', cepEnd: '01999-999', value: 11.00, expressValue: 15.00, driverRepass: 8.80, description: 'Liberdade / Bela Vista v1' }
        ]
      }
    ]
  },
  { 
    id: 'CL1-002', 
    codigoCliente: 'CL1-002', 
    name: 'Pedro Santos', 
    region: 'Centro', 
    tel: '(11) 98234-5678', 
    addr: 'Rua Augusta, 420', 
    status: 'Adimplente', 
    type: 'Parceiro', 
    cnpj: '23.456.789/0001-11', 
    cep: '01303-010', 
    cidade: 'São Paulo', 
    estado: 'SP', 
    cepRanges: [
      { id: 'ps-r1', cepStart: '01000-000', cepEnd: '01399-999', value: 9.50, expressValue: 13.50, driverRepass: 7.50, description: 'Centro Expandido' },
      { id: 'ps-r2', cepStart: '01400-000', cepEnd: '01499-999', value: 12.00, expressValue: 16.00, driverRepass: 9.50, description: 'Jardins / Cerqueira César' }
    ] 
  },
  { 
    id: 'CL1-003', 
    codigoCliente: 'CL1-003', 
    name: 'Mariana Costa', 
    region: 'Zona Sul', 
    tel: '(11) 97345-6789', 
    addr: 'Al. Lorena, 1500', 
    status: 'Ativo', 
    type: 'Parceiro', 
    cnpj: '34.567.890/0001-22', 
    cep: '01415-000', 
    cidade: 'São Paulo', 
    estado: 'SP', 
    cepRanges: [
      { id: 'mc-r1', cepStart: '04000-000', cepEnd: '04599-999', value: 11.00, expressValue: 15.00, driverRepass: 8.80, description: 'Vila Mariana & Itaim' },
      { id: 'mc-r2', cepStart: '01400-000', cepEnd: '01499-999', value: 10.00, expressValue: 14.00, driverRepass: 8.00, description: 'Jardins' }
    ] 
  },
  { 
    id: 'CL1-004', 
    codigoCliente: 'CL1-004', 
    name: 'Beatriz Lima', 
    region: 'Zona Oeste', 
    tel: '(11) 95567-8901', 
    addr: 'Av. Brigadeiro Faria Lima, 3477', 
    status: 'Adimplente', 
    type: 'Parceiro', 
    cnpj: '45.678.901/0001-33', 
    cep: '01452-000', 
    cidade: 'São Paulo', 
    estado: 'SP', 
    cepRanges: [
      { id: 'bl-r1', cepStart: '05400-000', cepEnd: '05499-999', value: 13.00, expressValue: 17.00, driverRepass: 10.00, description: 'Pinheiros / Faria Lima' },
      { id: 'bl-r2', cepStart: '01400-000', cepEnd: '01499-999', value: 12.00, expressValue: 16.00, driverRepass: 9.50, description: 'Jardins' }
    ] 
  },
  { 
    id: 'CL1-005', 
    codigoCliente: 'CL1-005', 
    name: 'Burger King', 
    region: 'Centro', 
    tel: '(11) 3003-5464', 
    addr: 'Av. Paulista, 1200', 
    status: 'Ativo', 
    type: 'Parceiro', 
    cnpj: '17.261.661/0001-73', 
    cep: '01311-200', 
    cidade: 'São Paulo', 
    estado: 'SP',
    cepRanges: [
      { id: 'bk-r1', cepStart: '01000-000', cepEnd: '01399-999', value: 8.90, description: 'Centro Expandido', expressValue: 12.90, driverRepass: 7.00 },
      { id: 'bk-r2', cepStart: '01400-000', cepEnd: '01499-999', value: 11.50, description: 'Jardins / Cerqueira César', expressValue: 15.50, driverRepass: 9.00 },
      { id: 'bk-r3', cepStart: '01500-000', cepEnd: '01999-999', value: 10.00, description: 'Liberdade / Bela Vista', expressValue: 14.00, driverRepass: 8.00 }
    ] 
  },
  { 
    id: 'CL1-006', 
    codigoCliente: 'CL1-006', 
    name: 'Bella Paulista', 
    region: 'Centro', 
    tel: '(11) 3211-1234', 
    addr: 'Rua Haddock Lobo, 354', 
    status: 'Ativo', 
    type: 'Parceiro', 
    cnpj: '56.789.012/0001-44', 
    cep: '01303-050', 
    cidade: 'São Paulo', 
    estado: 'SP',
    cepRanges: [
      { id: 'bella-r1', cepStart: '01300-000', cepEnd: '01399-999', value: 6.00, description: 'Consolação & Bela Vista', expressValue: 9.00, driverRepass: 4.80 },
      { id: 'bella-r2', cepStart: '01200-000', cepEnd: '01299-999', value: 8.50, description: 'Higienópolis & Santa Cecília', expressValue: 11.50, driverRepass: 6.80 },
      { id: 'bella-r3', cepStart: '01400-000', cepEnd: '01499-999', value: 9.00, description: 'Cerqueira César', expressValue: 12.00, driverRepass: 7.20 }
    ] 
  },
  { 
    id: 'CL1-007', 
    codigoCliente: 'CL1-007', 
    name: 'Droga Raia', 
    region: 'Zona Sul', 
    tel: '(11) 3003-7242', 
    addr: 'Rua Pamplona, 1792', 
    status: 'Adimplente', 
    type: 'Parceiro', 
    cnpj: '67.890.123/0001-55', 
    cep: '01415-002', 
    cidade: 'São Paulo', 
    estado: 'SP',
    cepRanges: [
      { id: 'raia-r1', cepStart: '01400-000', cepEnd: '01499-999', value: 5.00, description: 'Região Jardins', expressValue: 8.00, driverRepass: 4.00 },
      { id: 'raia-r2', cepStart: '04500-000', cepEnd: '04599-999', value: 8.00, description: 'Itaim Bibi', expressValue: 11.00, driverRepass: 6.50 },
      { id: 'raia-r3', cepStart: '01300-000', cepEnd: '01399-999', value: 7.50, description: 'Bela Vista', expressValue: 10.50, driverRepass: 6.00 }
    ] 
  }
];

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
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('quota metric') ||
    msg.includes('Free daily write units per project') ||
    msg.includes('Free daily read units per project')
  );
}

let isFirestoreQuotaExceededState = false;

export function getIsFirestoreQuotaExceeded(): boolean {
  if (isFirestoreQuotaExceededState) return true;
  if (typeof window !== 'undefined') {
    return window.sessionStorage.getItem('firestore_quota_exceeded') === 'true';
  }
  return false;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): void {
  const errMessage = error instanceof Error ? error.message : String(error);
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

// Helper functions for seeding
export async function seedInitialDataIfEmpty(mappedInitialOrders: Order[], force: boolean = false) {
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

// Order CRUD operations
export async function dbSaveOrder(order: Order) {
  // 1. Always save to Supabase independently
  try {
    await sbSaveOrder(order);
  } catch (err) {
    console.warn('Supabase save order warning:', err);
  }

  // 2. Save to Firestore if quota is not exceeded
  if (!getIsFirestoreQuotaExceeded()) {
    try {
      const cleanedPayload = removeUndefinedFields(order);
      await setDoc(doc(db, 'orders', order.id), cleanedPayload);
      console.log(`[dbSaveOrder SUCCESS] Order #${order.id} written to Firestore.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `orders/${order.id}`);
    }
  }
}

export async function dbDeleteOrder(orderId: string) {
  try {
    await sbDeleteOrder(orderId);
  } catch (err) {
    console.warn('Supabase delete order warning:', err);
  }

  if (!getIsFirestoreQuotaExceeded()) {
    try {
      await deleteDoc(doc(db, 'orders', orderId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `orders/${orderId}`);
    }
  }
}

export async function dbBulkSaveOrders(orders: Order[]) {
  for (const order of orders) {
    await sbSaveOrder(order).catch(err => console.warn('Supabase bulk save order error:', err));
  }

  if (!getIsFirestoreQuotaExceeded()) {
    try {
      const batch = writeBatch(db);
      orders.forEach(order => {
        batch.set(doc(db, 'orders', order.id), removeUndefinedFields(order));
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'orders');
    }
  }
}

export async function dbBulkDeleteOrders(orderIds: string[]) {
  for (const id of orderIds) {
    await sbDeleteOrder(id).catch(err => console.warn('Supabase bulk delete order error:', err));
  }

  if (!getIsFirestoreQuotaExceeded()) {
    try {
      const batch = writeBatch(db);
      orderIds.forEach(id => {
        batch.delete(doc(db, 'orders', id));
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'orders');
    }
  }
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
        where('driverId', '==', riderId),
        where('status', '==', status)
      );
    } else {
      q = query(
        collection(db, 'orders'),
        where('driverId', '==', riderId),
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
export const INITIAL_COMPANY_HUBS: CompanyHub[] = [
  {
    id: 'hub-main',
    name: 'Sede Ativa Vinimap Principal',
    cnpj: '98.765.432/0001-99',
    address: 'Rua Cerro Corá, 385, Vila Romana',
    cep: '05061-050',
    lat: -23.5385556,
    lng: -46.70118,
    phone: '(11) 3222-1111',
    logoUrl: vinimapLogo,
    active: true
  }
];

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

// General Clear operations to reset demo state
export async function dbResetToDemoState(mappedOrders: Order[]) {
  try {
    const batch = writeBatch(db);
    
    mappedOrders.forEach(o => batch.set(doc(db, 'orders', o.id), removeUndefinedFields(o)));
    INITIAL_CLIENT_PARTNERS.forEach(c => batch.set(doc(db, 'clientPartners', c.id), removeUndefinedFields(c)));
    INITIAL_RIDERS.forEach(r => batch.set(doc(db, 'deliveryRiders', r.id), removeUndefinedFields(r)));
    INITIAL_LOGS.forEach(l => batch.set(doc(db, 'activityLogs', l.id), removeUndefinedFields(l)));
    INITIAL_FINANCIAL_TRANSACTIONS.forEach(t => batch.set(doc(db, 'financialTransactions', t.id), removeUndefinedFields(t)));
    INITIAL_COMPANY_HUBS.forEach(h => batch.set(doc(db, 'companyHubs', h.id), removeUndefinedFields(h)));
    
    // Reset purged flag in systemConfig/state
    batch.set(doc(db, 'systemConfig', 'state'), { purged: false, restoredAt: new Date().toISOString() });

    await batch.commit();

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('system_purged');
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'bulk_reset');
  }
}

// Applies remote Supabase state to Firestore to sync active UI state
export async function dbApplyLoadedState(state: any) {
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
    
    // Also purge Supabase if mapped
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
  } catch (err) {
    console.warn(`Error purging collection ${collectionName}:`, err);
  }
}

// Explicitly clear local web storage and IndexedDB caches to prevent stale offline restoration
export async function clearLocalSystemCache() {
  try {
    if (typeof window !== 'undefined') {
      const isPurged = window.localStorage.getItem('system_purged');
      // 1. Clear LocalStorage and SessionStorage
      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
        if (isPurged) {
          window.localStorage.setItem('system_purged', isPurged);
        }
      } catch (e) {
        console.warn('Could not clear localStorage/sessionStorage:', e);
      }

      // 2. Clear browser IndexedDB databases
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
  try {
    await setDoc(doc(db, 'systemConfig', 'state'), { initialized: true, purged: true, purgedAt: new Date().toISOString() });
  } catch (err) {
    console.warn('Could not set systemConfig/state purged flag:', err);
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
  try {
    const batch = writeBatch(db);
    clientIds.forEach(id => batch.delete(doc(db, 'clientPartners', id)));
    await batch.commit();
    for (const id of clientIds) {
      await sbDeleteClientPartner(id).catch(() => {});
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'clientPartners');
  }
}

export async function dbBulkDeleteRiders(riderIds: string[]) {
  try {
    const batch = writeBatch(db);
    riderIds.forEach(id => batch.delete(doc(db, 'deliveryRiders', id)));
    await batch.commit();
    for (const id of riderIds) {
      await sbDeleteDeliveryRider(id).catch(() => {});
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'deliveryRiders');
  }
}

export async function dbBulkDeleteTransactions(txIds: string[]) {
  try {
    for (let i = 0; i < txIds.length; i += 400) {
      const chunk = txIds.slice(i, i + 400);
      const batch = writeBatch(db);
      chunk.forEach(id => batch.delete(doc(db, 'financialTransactions', id)));
      await batch.commit();
    }
    await sbBulkDeleteFinancialTransactions(txIds).catch(err => console.warn('Supabase bulk delete error:', err));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'financialTransactions');
  }
}

export async function dbBulkSaveClients(clients: ClientPartner[]) {
  try {
    const batch = writeBatch(db);
    clients.forEach(c => batch.set(doc(db, 'clientPartners', c.id), removeUndefinedFields(c)));
    await batch.commit();
    for (const c of clients) {
      await sbSaveClientPartner(c).catch(() => {});
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'clientPartners');
  }
}

export async function dbBulkSaveRiders(riders: DeliveryRider[]) {
  try {
    const batch = writeBatch(db);
    riders.forEach(r => batch.set(doc(db, 'deliveryRiders', r.id), removeUndefinedFields(r)));
    await batch.commit();
    for (const r of riders) {
      await sbSaveDeliveryRider(r).catch(() => {});
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'deliveryRiders');
  }
}


