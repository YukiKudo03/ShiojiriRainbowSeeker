/**
 * useUploadQueueProcessor Hook
 *
 * Automatically processes queued photo uploads when network is available.
 * Implements exponential backoff for retries.
 *
 * Requirements: FR-2 (AC-2.7 Offline Support)
 */

import { useEffect, useRef, useCallback } from 'react';

import { useNetworkState } from './useNetworkState';
import {
  useUploadQueueStore,
  type QueuedUpload,
} from '../store/uploadQueueStore';
import { uploadPhoto, prepareUploadRequest } from '../services/photoService';
import type { CapturedPhoto } from '../types/photo';

/**
 * Exponential backoff configuration
 */
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second
const MAX_RETRY_DELAY_MS = 30000; // 30 seconds
const BACKOFF_MULTIPLIER = 2;

/**
 * Processing interval configuration
 */
const PROCESSING_INTERVAL_MS = 5000; // Check queue every 5 seconds when online

/**
 * Calculate retry delay with exponential backoff
 */
const calculateRetryDelay = (retryCount: number): number => {
  const delay = INITIAL_RETRY_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, retryCount);
  return Math.min(delay, MAX_RETRY_DELAY_MS);
};

/**
 * Convert queued upload back to CapturedPhoto format
 */
const queueItemToCapturedPhoto = (item: QueuedUpload): CapturedPhoto => ({
  uri: item.photoUri,
  width: 0, // Not needed for upload
  height: 0, // Not needed for upload
  location: {
    latitude: item.metadata.latitude,
    longitude: item.metadata.longitude,
  },
  timestamp: item.metadata.capturedAt || new Date().toISOString(),
});

/**
 * Return type for useUploadQueueProcessor hook
 */
export interface UseUploadQueueProcessorReturn {
  /** Whether the processor is currently running */
  isProcessing: boolean;
  /** Number of pending uploads */
  pendingCount: number;
  /** Number of failed uploads */
  failedCount: number;
  /** Manually trigger queue processing */
  processQueue: () => Promise<void>;
  /** Clear completed uploads from queue */
  clearCompleted: () => void;
  /** Retry all failed uploads */
  retryFailed: () => void;
}

/**
 * Upload queue processor hook
 *
 * Automatically monitors network state and processes queued uploads
 * when connectivity is restored. Uses exponential backoff for retries.
 *
 * @example
 * ```tsx
 * function App() {
 *   const { pendingCount, failedCount, isProcessing } = useUploadQueueProcessor();
 *
 *   return (
 *     <View>
 *       {pendingCount > 0 && <Text>Pending uploads: {pendingCount}</Text>}
 *       {failedCount > 0 && <Text>Failed uploads: {failedCount}</Text>}
 *       {isProcessing && <ActivityIndicator />}
 *     </View>
 *   );
 * }
 * ```
 */
export function useUploadQueueProcessor(): UseUploadQueueProcessorReturn {
  const { isOnline } = useNetworkState();
  const processingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    queue,
    isProcessing,
    getNextPending,
    updateStatus,
    incrementRetryCount,
    setProcessing,
    clearCompleted,
  } = useUploadQueueStore();

  /**
   * Process a single queued upload
   */
  const processUpload = useCallback(
    async (item: QueuedUpload): Promise<boolean> => {
      console.log(`[UploadQueueProcessor] Processing upload: ${item.id}`);

      try {
        // Mark as uploading
        updateStatus(item.id, 'uploading');

        // Convert to upload request format
        const capturedPhoto = queueItemToCapturedPhoto(item);
        const uploadRequest = prepareUploadRequest(capturedPhoto, item.metadata);

        // Attempt upload
        await uploadPhoto(uploadRequest);

        // Mark as success
        updateStatus(item.id, 'success');
        console.log(`[UploadQueueProcessor] Upload successful: ${item.id}`);

        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        console.error(`[UploadQueueProcessor] Upload failed: ${item.id}`, errorMessage);

        // Increment retry count (this also marks as error if max retries exceeded)
        incrementRetryCount(item.id);

        // Get updated item to check retry count
        const updatedItem = queue.find((i) => i.id === item.id);
        if (updatedItem && updatedItem.retryCount < 3) {
          // Mark as pending for retry
          updateStatus(item.id, 'pending', errorMessage);
        } else {
          // Max retries exceeded, mark as error
          updateStatus(item.id, 'error', errorMessage);
        }

        return false;
      }
    },
    [queue, updateStatus, incrementRetryCount]
  );

  /**
   * Process all pending uploads in queue
   */
  const processQueue = useCallback(async (): Promise<void> => {
    // Prevent concurrent processing
    if (processingRef.current || !isOnline) {
      return;
    }

    processingRef.current = true;
    setProcessing(true);

    console.log('[UploadQueueProcessor] Starting queue processing');

    try {
      let nextItem = getNextPending();

      while (nextItem && isOnline) {
        // Check if item needs delay (exponential backoff)
        if (nextItem.lastAttemptAt && nextItem.retryCount > 0) {
          const lastAttempt = new Date(nextItem.lastAttemptAt).getTime();
          const requiredDelay = calculateRetryDelay(nextItem.retryCount - 1);
          const timeSinceLastAttempt = Date.now() - lastAttempt;

          if (timeSinceLastAttempt < requiredDelay) {
            console.log(
              `[UploadQueueProcessor] Waiting ${requiredDelay - timeSinceLastAttempt}ms before retry`
            );
            // Skip this item for now, will be picked up on next interval
            break;
          }
        }

        await processUpload(nextItem);
        nextItem = getNextPending();
      }
    } finally {
      processingRef.current = false;
      setProcessing(false);
      console.log('[UploadQueueProcessor] Queue processing complete');
    }
  }, [isOnline, getNextPending, processUpload, setProcessing]);

  /**
   * Retry all failed uploads by resetting their status
   */
  const retryFailed = useCallback(() => {
    queue
      .filter((item) => item.status === 'error')
      .forEach((item) => {
        // Reset to pending with cleared retry count
        updateStatus(item.id, 'pending', undefined);
      });
  }, [queue, updateStatus]);

  /**
   * Start/stop processing interval based on network state
   */
  useEffect(() => {
    if (isOnline) {
      // Immediately process when coming online
      processQueue();

      // Set up interval for continued processing
      intervalRef.current = setInterval(() => {
        const pendingItems = queue.filter((item) => item.status === 'pending');
        if (pendingItems.length > 0) {
          processQueue();
        }
      }, PROCESSING_INTERVAL_MS);
    } else {
      // Clear interval when offline
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isOnline, processQueue, queue]);

  // Calculate counts
  const pendingCount = queue.filter((item) => item.status === 'pending').length;
  const failedCount = queue.filter((item) => item.status === 'error').length;

  return {
    isProcessing,
    pendingCount,
    failedCount,
    processQueue,
    clearCompleted,
    retryFailed,
  };
}

export default useUploadQueueProcessor;
