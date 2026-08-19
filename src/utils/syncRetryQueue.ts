/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ViniMap Pro - Robust Priority-Based Sync & Retry Queue
 * Handles persistent offline queuing, exponential backoff, priority dispatching,
 * and automatic synchronization when network connection is restored.
 */

import { Order } from '../types';
import { sbSaveOrder, sbDeleteOrder } from '../lib/supabaseService';
import { db } from '../firebase';
import { getIsFirestoreQuotaExceeded, isQuotaError, setIsFirestoreQuotaExceeded } from '../lib/dbService';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';

export type QueuePriority = 'HIGH' | 'NORMAL' | 'LOW';
export type QueueAction = 'UPSERT' | 'DELETE';
export type QueueTarget = 'ALL' | 'SUPABASE' | 'FIRESTORE';

export interface SyncQueueTask {
  id: string;
  orderId: string;
  action: QueueAction;
  orderData?: Order;
  priority: QueuePriority;
  target: QueueTarget;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  lastAttempt?: number;
  nextRetryAt: number;
  lastError?: string;
}

export interface SyncQueueState {
  tasks: SyncQueueTask[];
  pendingCount: number;
  highPriorityCount: number;
  failedCount: number;
  isProcessing: boolean;
  isOnline: boolean;
  lastSuccessfulSyncAt: number | null;
}

const STORAGE_KEY = 'vinimap_sync_retry_queue_v1';
const LAST_SYNC_KEY = 'vinimap_last_cloud_sync_timestamp';

// Helper to remove undefined fields before Firestore write
function cleanPayload(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanPayload);
  const copy: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      copy[key] = cleanPayload(obj[key]);
    }
  }
  return copy;
}

export function calculateOrderPriority(order: Order, explicit?: QueuePriority): QueuePriority {
  if (explicit) return explicit;
  // High priority for critical events: Completed delivery, proof of delivery, incidents, or express urgency
  if (order.status === 'Concluído' || order.status === 'Ocorrência') return 'HIGH';
  if (order.priority === 'Alta' || order.priority === 'Expresso' || order.priority === 'expresso') return 'HIGH';
  if (order.signatureUrl || order.deliveryPhotoUrl || order.protocolNumber) return 'HIGH';
  if (order.status === 'Em rota' || order.status === 'Entregando') return 'NORMAL';
  return 'NORMAL';
}

class SyncRetryQueueManager {
  private isProcessing = false;
  private subscribers = new Set<(state: SyncQueueState) => void>();
  private timer: any = null;
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private lastSuccessfulSyncAt: number | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const storedLast = localStorage.getItem(LAST_SYNC_KEY);
        if (storedLast) this.lastSuccessfulSyncAt = Number(storedLast);
      } catch (_) {}

      window.addEventListener('online', () => {
        console.log('[SyncRetryQueue] 🌐 Conexão de rede RESTAURADA. Iniciando re-tentativa imediata da fila...');
        this.isOnline = true;
        this.notify();
        this.processQueue(true);
      });

      window.addEventListener('offline', () => {
        console.warn('[SyncRetryQueue] ⚠️ Conexão de rede PERDIDA. Modo Offline ativo.');
        this.isOnline = false;
        this.notify();
      });

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.isOnline) {
          this.processQueue(false);
        }
      });

      // Background heartbeat check every 12 seconds
      this.timer = setInterval(() => {
        if (this.isOnline) {
          const tasks = this.loadTasks();
          const now = Date.now();
          const hasDueTasks = tasks.some(t => t.nextRetryAt <= now);
          if (hasDueTasks) {
            this.processQueue(false);
          }
        }
      }, 12000);
    }
  }

  public subscribe(cb: (state: SyncQueueState) => void): () => void {
    this.subscribers.add(cb);
    cb(this.getState());
    return () => {
      this.subscribers.delete(cb);
    };
  }

  private notify() {
    const state = this.getState();
    this.subscribers.forEach(cb => {
      try { cb(state); } catch (e) { console.error(e); }
    });
  }

  public getState(): SyncQueueState {
    const tasks = this.loadTasks();
    const highPriorityCount = tasks.filter(t => t.priority === 'HIGH').length;
    const failedCount = tasks.filter(t => t.retryCount > 0).length;

    return {
      tasks,
      pendingCount: tasks.length,
      highPriorityCount,
      failedCount,
      isProcessing: this.isProcessing,
      isOnline: this.isOnline,
      lastSuccessfulSyncAt: this.lastSuccessfulSyncAt
    };
  }

  private loadTasks(): SyncQueueTask[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('[SyncRetryQueue] Erro ao carregar tarefas do localStorage:', e);
      return [];
    }
  }

  private saveTasks(tasks: SyncQueueTask[]) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      this.notify();
    } catch (e) {
      console.warn('[SyncRetryQueue] Erro ao salvar tarefas no localStorage:', e);
    }
  }

  /**
   * Enqueues an order save operation with priority and attempts execution.
   */
  public async enqueueSave(order: Order, explicitPriority?: QueuePriority, target: QueueTarget = 'ALL'): Promise<boolean> {
    const priority = calculateOrderPriority(order, explicitPriority);
    const orderId = String(order.id);
    const now = Date.now();

    const tasks = this.loadTasks();
    const existingIndex = tasks.findIndex(t => t.orderId === orderId);

    const task: SyncQueueTask = {
      id: existingIndex >= 0 ? tasks[existingIndex].id : `retry-${orderId}-${now}`,
      orderId,
      action: 'UPSERT',
      orderData: order,
      priority: existingIndex >= 0 && tasks[existingIndex].priority === 'HIGH' ? 'HIGH' : priority,
      target,
      retryCount: existingIndex >= 0 ? tasks[existingIndex].retryCount : 0,
      maxRetries: 25,
      createdAt: existingIndex >= 0 ? tasks[existingIndex].createdAt : now,
      nextRetryAt: now,
      lastAttempt: now
    };

    if (existingIndex >= 0) {
      tasks[existingIndex] = task;
    } else {
      tasks.push(task);
    }

    this.saveTasks(tasks);

    // If online, attempt immediate execution
    if (this.isOnline) {
      return await this.executeTask(task);
    } else {
      console.log(`[SyncRetryQueue] 📴 Offline: Pedido #${orderId} colocado na fila de re-tentativa (Prioridade: ${priority}).`);
      return false;
    }
  }

  /**
   * Enqueues an order delete operation.
   */
  public async enqueueDelete(orderId: string, explicitPriority: QueuePriority = 'NORMAL'): Promise<boolean> {
    const now = Date.now();
    const tasks = this.loadTasks();
    const existingIndex = tasks.findIndex(t => t.orderId === orderId);

    const task: SyncQueueTask = {
      id: existingIndex >= 0 ? tasks[existingIndex].id : `retry-del-${orderId}-${now}`,
      orderId,
      action: 'DELETE',
      priority: explicitPriority,
      target: 'ALL',
      retryCount: existingIndex >= 0 ? tasks[existingIndex].retryCount : 0,
      maxRetries: 20,
      createdAt: existingIndex >= 0 ? tasks[existingIndex].createdAt : now,
      nextRetryAt: now,
      lastAttempt: now
    };

    if (existingIndex >= 0) {
      tasks[existingIndex] = task;
    } else {
      tasks.push(task);
    }

    this.saveTasks(tasks);

    if (this.isOnline) {
      return await this.executeTask(task);
    }
    return false;
  }

  /**
   * Calculates next backoff delay in milliseconds based on retry count and priority.
   */
  private getBackoffDelay(retryCount: number, priority: QueuePriority): number {
    const base = priority === 'HIGH' ? 800 : priority === 'NORMAL' ? 1800 : 3500;
    const factor = priority === 'HIGH' ? 1.4 : 1.7;
    const max = priority === 'HIGH' ? 25000 : priority === 'NORMAL' ? 45000 : 60000;
    const jitter = Math.random() * 800;
    return Math.min(max, Math.round(base * Math.pow(factor, retryCount) + jitter));
  }

  /**
   * Executes a single task against Supabase and Firestore.
   */
  private async executeTask(task: SyncQueueTask): Promise<boolean> {
    const { orderId, action, orderData, target } = task;
    let supabaseSuccess = true;
    let firestoreSuccess = true;
    let errorMsg = '';

    try {
      if (action === 'UPSERT') {
        if (!orderData) throw new Error('Dados do pedido não fornecidos para UPSERT');

        // 1. Save to Supabase (Primary target)
        if (target === 'ALL' || target === 'SUPABASE') {
          try {
            await sbSaveOrder(orderData);
          } catch (sbErr: any) {
            console.warn(`[SyncRetryQueue] Falha no salvamento do Supabase para #${orderId}:`, sbErr);
            supabaseSuccess = false;
            errorMsg = sbErr?.message || 'Falha Supabase';
          }
        }

        // 2. Save to Firestore (if configured and quota allows)
        if (target === 'ALL' || target === 'FIRESTORE') {
          if (!getIsFirestoreQuotaExceeded()) {
            try {
              const cleaned = cleanPayload(orderData);
              await setDoc(doc(db, 'orders', orderId), cleaned);
            } catch (fsErr: any) {
              console.warn(`[SyncRetryQueue] Falha no salvamento do Firestore para #${orderId}:`, fsErr);
              if (isQuotaError(fsErr)) {
                setIsFirestoreQuotaExceeded(true);
              }
              firestoreSuccess = false;
              if (!errorMsg) errorMsg = fsErr?.message || 'Falha Firestore';
            }
          }
        }
      } else if (action === 'DELETE') {
        if (target === 'ALL' || target === 'SUPABASE') {
          try {
            await sbDeleteOrder(orderId);
          } catch (sbErr: any) {
            supabaseSuccess = false;
            errorMsg = sbErr?.message || 'Falha Supabase Delete';
          }
        }

        if (target === 'ALL' || target === 'FIRESTORE') {
          if (!getIsFirestoreQuotaExceeded()) {
            try {
              await deleteDoc(doc(db, 'orders', orderId));
            } catch (fsErr: any) {
              console.warn(`[SyncRetryQueue] Falha no delete do Firestore para #${orderId}:`, fsErr);
              if (isQuotaError(fsErr)) {
                setIsFirestoreQuotaExceeded(true);
              }
              firestoreSuccess = false;
              if (!errorMsg) errorMsg = fsErr?.message || 'Falha Firestore Delete';
            }
          }
        }
      }

      const isFirestoreExceeded = getIsFirestoreQuotaExceeded();
      const isAllSuccessful = (supabaseSuccess && firestoreSuccess) || (supabaseSuccess && isFirestoreExceeded);

      if (isAllSuccessful) {
        // Success: Remove task from queue
        const currentTasks = this.loadTasks().filter(t => t.id !== task.id && t.orderId !== task.orderId);
        this.saveTasks(currentTasks);
        this.lastSuccessfulSyncAt = Date.now();
        try {
          localStorage.setItem(LAST_SYNC_KEY, String(this.lastSuccessfulSyncAt));
        } catch (_) {}
        console.log(`[SyncRetryQueue] ✅ Pedido #${orderId} sincronizado com sucesso no backend.`);
        return true;
      } else {
        throw new Error(errorMsg || 'Erro parcial na sincronização de nuvem');
      }
    } catch (err: any) {
      // Mark as failed and schedule next retry
      const delay = this.getBackoffDelay(task.retryCount, task.priority);
      const currentTasks = this.loadTasks();
      const idx = currentTasks.findIndex(t => t.id === task.id || t.orderId === task.orderId);

      if (idx >= 0) {
        currentTasks[idx].retryCount += 1;
        currentTasks[idx].lastAttempt = Date.now();
        currentTasks[idx].nextRetryAt = Date.now() + delay;
        currentTasks[idx].lastError = err?.message || 'Erro de conexão/timeout';
        this.saveTasks(currentTasks);
      }

      console.warn(`[SyncRetryQueue] 🔁 Reagendando pedido #${orderId} (Tentativa #${task.retryCount + 1}) em ${Math.round(delay / 1000)}s.`);
      return false;
    }
  }

  /**
   * Processes all pending tasks in the queue sorted by priority.
   */
  public async processQueue(forceAll = false): Promise<{ success: number; failed: number }> {
    if (this.isProcessing) return { success: 0, failed: 0 };
    if (!this.isOnline && !forceAll) return { success: 0, failed: 0 };

    this.isProcessing = true;
    this.notify();

    let successCount = 0;
    let failedCount = 0;

    try {
      const tasks = this.loadTasks();
      if (tasks.length === 0) {
        this.isProcessing = false;
        this.notify();
        return { success: 0, failed: 0 };
      }

      const now = Date.now();
      // Filter tasks that are due or if forced
      const eligibleTasks = tasks.filter(t => forceAll || t.nextRetryAt <= now);

      if (eligibleTasks.length === 0) {
        this.isProcessing = false;
        this.notify();
        return { success: 0, failed: 0 };
      }

      // Sort by priority weight (HIGH: 3, NORMAL: 2, LOW: 1), then oldest createdAt
      const priorityWeight: Record<QueuePriority, number> = {
        HIGH: 3,
        NORMAL: 2,
        LOW: 1
      };

      eligibleTasks.sort((a, b) => {
        const weightDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
        if (weightDiff !== 0) return weightDiff;
        return a.createdAt - b.createdAt;
      });

      console.log(`[SyncRetryQueue] 🚀 Processando ${eligibleTasks.length} tarefas pendentes na fila...`);

      // Process with concurrency limit of 2
      for (const task of eligibleTasks) {
        // Re-check current item validity
        const ok = await this.executeTask(task);
        if (ok) {
          successCount++;
        } else {
          failedCount++;
        }
        // Small throttle delay between queued tasks to prevent overwhelming write streams
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (e) {
      console.warn('[SyncRetryQueue] Erro durante processamento da fila:', e);
    } finally {
      this.isProcessing = false;
      this.notify();
    }

    return { success: successCount, failed: failedCount };
  }

  /**
   * Manually retries a specific task immediately.
   */
  public async retryTaskNow(taskId: string): Promise<boolean> {
    const tasks = this.loadTasks();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return false;

    task.nextRetryAt = Date.now();
    return await this.executeTask(task);
  }

  /**
   * Clears all tasks from the retry queue.
   */
  public clearQueue() {
    this.saveTasks([]);
    console.log('[SyncRetryQueue] 🗑️ Fila de re-tentativa limpa.');
  }
}

export const syncRetryQueue = new SyncRetryQueueManager();
