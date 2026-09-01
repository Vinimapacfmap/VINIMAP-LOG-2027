/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ViniMap Pro - Background Sync CronJob Service
 * Runs continuous background periodic synchronization and reactive network recovery triggers.
 * Automatically flushes IndexedDB operations queue (deallocations, allocations, status updates)
 * and processes the SyncRetryQueue without requiring manual user intervention.
 */

import { flushIndexedDbOperationsQueue, getAllOfflineOperations } from './indexedDbSync';
import { syncRetryQueue } from './syncRetryQueue';
import { realtimeSyncBus } from './realtimeSync';

export interface BackgroundSyncStatus {
  isRunning: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  lastRunAt: number | null;
  lastSuccessfulSyncAt: number | null;
  pendingOpsCount: number;
  retryTasksCount: number;
  totalSyncedSinceStart: number;
  lastError: string | null;
}

type SyncStatusListener = (status: BackgroundSyncStatus) => void;

class BackgroundSyncCronService {
  private isRunning = false;
  private isSyncing = false;
  private intervalTimer: any = null;
  private statusListeners = new Set<SyncStatusListener>();
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private lastRunAt: number | null = null;
  private lastSuccessfulSyncAt: number | null = null;
  private pendingOpsCount = 0;
  private retryTasksCount = 0;
  private totalSyncedSinceStart = 0;
  private lastError: string | null = null;

  // Active sync debounce timer
  private debounceTimer: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initEventListeners();
      this.start();
    }
  }

  /**
   * Initializes all browser event hooks: online/offline, visibility, focus, page show, and cross-tab sync.
   */
  private initEventListeners() {
    if (typeof window === 'undefined') return;

    // 1. Online Network Recovery Event
    window.addEventListener('online', () => {
      console.log('[BackgroundSyncCron] 🌐 Rede ONLINE detectada! Acionando sincronização imediata de IndexedDB e RetryQueue...');
      this.isOnline = true;
      this.updateMetrics();
      this.triggerSync(true, 'NETWORK_ONLINE');
    });

    // 2. Offline Event
    window.addEventListener('offline', () => {
      console.warn('[BackgroundSyncCron] 📴 Rede OFFLINE detectada. Operações serão enfileiradas no IndexedDB.');
      this.isOnline = false;
      this.updateMetrics();
    });

    // 3. Tab Visibility Change (when user switches back to ViniMap)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isOnline) {
        console.log('[BackgroundSyncCron] 👁️ Aba visível novamente. Verificando operações pendentes...');
        this.triggerSync(false, 'TAB_VISIBLE');
      }
    });

    // 4. Window Focus Event
    window.addEventListener('focus', () => {
      if (this.isOnline) {
        this.triggerSync(false, 'WINDOW_FOCUS');
      }
    });

    // 5. RealtimeSyncBus Event (when any tab or component enqueues an operation)
    realtimeSyncBus.subscribe('*', (event) => {
      if (
        event.type === 'ORDERS_BATCH_UPDATED' ||
        event.type === 'ORDER_STATUS_CHANGED' ||
        event.type === 'FORCE_SYNC_REQUEST'
      ) {
        if (this.isOnline) {
          this.scheduleDebouncedSync(300, 'REALTIME_BUS_EVENT');
        }
      }
    });

    // 6. Register Web Background Sync API in Service Worker if supported
    this.registerServiceWorkerSync();
  }

  /**
   * Registers Background Sync with the Service Worker (PWA) if supported by the browser.
   */
  private async registerServiceWorkerSync() {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const swReadyPromise = navigator.serviceWorker.ready;
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
        const registration = await Promise.race([swReadyPromise, timeoutPromise]);
        
        if (registration && 'sync' in registration) {
          await (registration as any).sync.register('vinimap-background-sync');
          console.log('[BackgroundSyncCron] ✅ Web Background Sync API registrado com sucesso no Service Worker.');
        }
        if (registration && 'periodicSync' in registration) {
          const periodicSync = (registration as any).periodicSync;
          const tags = await periodicSync.getTags();
          if (!tags.includes('vinimap-periodic-sync')) {
            await periodicSync.register('vinimap-periodic-sync', {
              minInterval: 12 * 1000 // 12 seconds
            });
            console.log('[BackgroundSyncCron] ✅ Periodic Background Sync API registrado.');
          }
        }
      } catch (_) {
        // Background Sync API may not be permitted without user gesture or supported in all browsers
      }
    }
  }

  /**
   * Starts the background cron interval ticker.
   */
  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[BackgroundSyncCron] ⏱️ Cronjob de sincronização periódica INICIADO.');

    // Run initial sync check
    this.updateMetrics();
    if (this.isOnline) {
      this.triggerSync(false, 'CRON_STARTUP');
    }

    // Dynamic ticker: checks every 8 seconds
    if (this.intervalTimer) clearInterval(this.intervalTimer);
    this.intervalTimer = setInterval(() => {
      this.tick();
    }, 8000);
  }

  /**
   * Stops the background cron interval ticker.
   */
  public stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    console.log('[BackgroundSyncCron] ⏹️ Cronjob de sincronização periódica PARADO.');
    this.notify();
  }

  /**
   * Periodic tick routine executed every 8 seconds.
   */
  private async tick() {
    if (!this.isRunning) return;

    // Check navigator.onLine status directly
    if (typeof navigator !== 'undefined') {
      this.isOnline = navigator.onLine;
    }

    if (!this.isOnline) return;

    await this.updateMetrics();

    // If there are pending operations or retry tasks, trigger sync immediately
    if (this.pendingOpsCount > 0 || this.retryTasksCount > 0) {
      await this.triggerSync(true, 'CRON_TICK_PENDING_ITEMS');
    } else {
      // Normal heartbeat maintenance
      await this.triggerSync(false, 'CRON_TICK_HEARTBEAT');
    }
  }

  /**
   * Schedules a debounced sync execution.
   */
  private scheduleDebouncedSync(delayMs: number, reason: string) {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.triggerSync(true, reason);
    }, delayMs);
  }

  /**
   * Updates the in-memory counts of pending IndexedDB operations and retry queue tasks.
   */
  public async updateMetrics() {
    try {
      const ops = await getAllOfflineOperations();
      this.pendingOpsCount = ops.length;
      
      const retryState = syncRetryQueue.getState();
      this.retryTasksCount = retryState.pendingCount;
      if (retryState.lastSuccessfulSyncAt) {
        this.lastSuccessfulSyncAt = retryState.lastSuccessfulSyncAt;
      }
      this.notify();
    } catch (_) {}
  }

  /**
   * Main sync trigger: Executes flushIndexedDbOperationsQueue and syncRetryQueue.processQueue(true).
   * Guarantees non-concurrent execution with mutex locking.
   */
  public async triggerSync(forceAll = false, reason = 'MANUAL_TRIGGER'): Promise<{
    syncedOps: number;
    failedOps: number;
    syncedTasks: number;
    failedTasks: number;
  }> {
    if (this.isSyncing) {
      return { syncedOps: 0, failedOps: 0, syncedTasks: 0, failedTasks: 0 };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.isOnline = false;
      this.notify();
      return { syncedOps: 0, failedOps: 0, syncedTasks: 0, failedTasks: 0 };
    }

    this.isSyncing = true;
    this.lastRunAt = Date.now();
    this.notify();

    let syncedOps = 0;
    let failedOps = 0;
    let syncedTasks = 0;
    let failedTasks = 0;

    try {
      // 1. Flush IndexedDB operations queue (deallocations, allocations, status updates)
      const opResult = await flushIndexedDbOperationsQueue();
      syncedOps = opResult.synced;
      failedOps = opResult.failed;

      // 2. Process SyncRetryQueue with force flag
      const retryResult = await syncRetryQueue.processQueue(forceAll);
      syncedTasks = retryResult.success;
      failedTasks = retryResult.failed;

      const totalSyncedInRun = syncedOps + syncedTasks;
      if (totalSyncedInRun > 0) {
        this.totalSyncedSinceStart += totalSyncedInRun;
        this.lastSuccessfulSyncAt = Date.now();
        this.lastError = null;
        console.log(`[BackgroundSyncCron] 🚀 (${reason}) Sincronização concluída: ${syncedOps} operações IndexedDB + ${syncedTasks} tarefas RetryQueue sincronizadas com o banco de dados.`);
      }
    } catch (err: any) {
      this.lastError = err?.message || 'Erro durante a sincronização em segundo plano';
      console.warn(`[BackgroundSyncCron] ⚠️ Erro na sincronização (${reason}):`, err);
    } finally {
      this.isSyncing = false;
      await this.updateMetrics();
      this.notify();
    }

    return { syncedOps, failedOps, syncedTasks, failedTasks };
  }

  /**
   * Gets current status snapshot.
   */
  public getStatus(): BackgroundSyncStatus {
    return {
      isRunning: this.isRunning,
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      lastRunAt: this.lastRunAt,
      lastSuccessfulSyncAt: this.lastSuccessfulSyncAt,
      pendingOpsCount: this.pendingOpsCount,
      retryTasksCount: this.retryTasksCount,
      totalSyncedSinceStart: this.totalSyncedSinceStart,
      lastError: this.lastError
    };
  }

  /**
   * Subscribes to status updates.
   */
  public subscribe(cb: SyncStatusListener): () => void {
    this.statusListeners.add(cb);
    cb(this.getStatus());
    return () => {
      this.statusListeners.delete(cb);
    };
  }

  private notify() {
    const status = this.getStatus();
    this.statusListeners.forEach(cb => {
      try { cb(status); } catch (_) {}
    });
  }
}

export const backgroundSyncCron = new BackgroundSyncCronService();
