/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { syncRetryQueue, SyncQueueState, SyncQueueTask } from '../utils/syncRetryQueue';

export function useSyncRetryQueue() {
  const [state, setState] = useState<SyncQueueState>(() => syncRetryQueue.getState());

  useEffect(() => {
    const unsubscribe = syncRetryQueue.subscribe((newState) => {
      setState(newState);
    });
    return unsubscribe;
  }, []);

  const flushQueue = useCallback(async (forceAll = true) => {
    return await syncRetryQueue.processQueue(forceAll);
  }, []);

  const retryTask = useCallback(async (taskId: string) => {
    return await syncRetryQueue.retryTaskNow(taskId);
  }, []);

  const clearQueue = useCallback(() => {
    syncRetryQueue.clearQueue();
  }, []);

  return {
    ...state,
    flushQueue,
    retryTask,
    clearQueue
  };
}
