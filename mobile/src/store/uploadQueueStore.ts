/**
 * Upload Queue Store
 *
 * Manages offline photo upload queue using Zustand with persistence.
 * Automatically retries uploads when network is restored.
 *
 * Requirements: FR-2 (AC-2.7)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import type { PhotoUploadMetadata } from '../types/photo';

/**
 * Upload queue item status
 */
export type UploadStatus = 'pending' | 'uploading' | 'success' | 'error';

/**
 * Upload queue item
 */
export interface QueuedUpload {
  id: string;
  photoUri: string;
  metadata: PhotoUploadMetadata;
  status: UploadStatus;
  errorMessage?: string;
  retryCount: number;
  createdAt: string;
  lastAttemptAt?: string;
}

/**
 * Upload queue state
 */
interface UploadQueueState {
  queue: QueuedUpload[];
  isProcessing: boolean;

  // Actions
  addToQueue: (photoUri: string, metadata: PhotoUploadMetadata) => string;
  removeFromQueue: (id: string) => void;
  updateStatus: (id: string, status: UploadStatus, errorMessage?: string) => void;
  incrementRetryCount: (id: string) => void;
  getNextPending: () => QueuedUpload | undefined;
  setProcessing: (isProcessing: boolean) => void;
  clearCompleted: () => void;
  clearAll: () => void;
}

/**
 * Maximum retry attempts
 */
const MAX_RETRIES = 3;

/**
 * Generate unique ID
 */
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Upload queue store with persistence
 */
export const useUploadQueueStore = create<UploadQueueState>()(
  persist(
    (set, get) => ({
      queue: [],
      isProcessing: false,

      /**
       * Add a new upload to the queue
       */
      addToQueue: (photoUri, metadata) => {
        const id = generateId();
        const newItem: QueuedUpload = {
          id,
          photoUri,
          metadata,
          status: 'pending',
          retryCount: 0,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          queue: [...state.queue, newItem],
        }));

        return id;
      },

      /**
       * Remove an upload from the queue
       */
      removeFromQueue: (id) => {
        set((state) => ({
          queue: state.queue.filter((item) => item.id !== id),
        }));
      },

      /**
       * Update upload status
       */
      updateStatus: (id, status, errorMessage) => {
        set((state) => ({
          queue: state.queue.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status,
                  errorMessage,
                  lastAttemptAt: new Date().toISOString(),
                }
              : item
          ),
        }));
      },

      /**
       * Increment retry count for an upload
       */
      incrementRetryCount: (id) => {
        set((state) => ({
          queue: state.queue.map((item) =>
            item.id === id
              ? {
                  ...item,
                  retryCount: item.retryCount + 1,
                  // Mark as error if max retries exceeded
                  status: item.retryCount + 1 >= MAX_RETRIES ? 'error' : item.status,
                  errorMessage:
                    item.retryCount + 1 >= MAX_RETRIES
                      ? 'Maximum retry attempts exceeded'
                      : item.errorMessage,
                }
              : item
          ),
        }));
      },

      /**
       * Get next pending upload
       */
      getNextPending: () => {
        const { queue } = get();
        return queue.find(
          (item) =>
            item.status === 'pending' && item.retryCount < MAX_RETRIES
        );
      },

      /**
       * Set processing state
       */
      setProcessing: (isProcessing) => {
        set({ isProcessing });
      },

      /**
       * Clear completed uploads
       */
      clearCompleted: () => {
        set((state) => ({
          queue: state.queue.filter((item) => item.status !== 'success'),
        }));
      },

      /**
       * Clear all uploads
       */
      clearAll: () => {
        set({ queue: [], isProcessing: false });
      },
    }),
    {
      name: 'upload-queue-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist queue, not processing state
      partialize: (state) => ({ queue: state.queue }),
    }
  )
);

/**
 * Get pending upload count
 */
export const usePendingUploadCount = (): number => {
  return useUploadQueueStore((state) =>
    state.queue.filter((item) => item.status === 'pending').length
  );
};

/**
 * Get failed upload count
 */
export const useFailedUploadCount = (): number => {
  return useUploadQueueStore((state) =>
    state.queue.filter((item) => item.status === 'error').length
  );
};
