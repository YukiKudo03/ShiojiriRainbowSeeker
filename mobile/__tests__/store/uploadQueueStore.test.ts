/**
 * Unit Tests for uploadQueueStore (Zustand with persist middleware)
 *
 * Tests the upload queue store actions and state transitions.
 * AsyncStorage is mocked in the setup file.
 */

// Import the store after mocks are in place (setup.ts handles AsyncStorage mock)
import { useUploadQueueStore } from '../../src/store/uploadQueueStore';

import type { QueuedUpload } from '../../src/store/uploadQueueStore';
import type { PhotoUploadMetadata } from '../../src/types/photo';

/**
 * Helper: create a mock PhotoUploadMetadata
 */
const createMockMetadata = (
  overrides: Partial<PhotoUploadMetadata> = {}
): PhotoUploadMetadata => ({
  title: 'Rainbow Photo',
  comment: 'Beautiful rainbow in Shiojiri',
  latitude: 36.115,
  longitude: 137.954,
  locationName: 'Shiojiri, Nagano',
  capturedAt: '2025-06-15T14:30:00Z',
  ...overrides,
});

/**
 * Helper: reset the store to initial state between tests
 */
const resetStore = () => {
  useUploadQueueStore.setState({ queue: [], isProcessing: false });
};

/**
 * Helper: add an item to the queue and return it
 */
const addItemToQueue = (
  photoUri = 'file:///photo1.jpg',
  metadata?: PhotoUploadMetadata
): { id: string; item: QueuedUpload } => {
  const meta = metadata ?? createMockMetadata();
  const id = useUploadQueueStore.getState().addToQueue(photoUri, meta);
  const item = useUploadQueueStore
    .getState()
    .queue.find((q) => q.id === id)!;
  return { id, item };
};

describe('uploadQueueStore', () => {
  beforeEach(() => {
    resetStore();
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------
  describe('initial state (after reset)', () => {
    it('should have an empty queue', () => {
      expect(useUploadQueueStore.getState().queue).toEqual([]);
    });

    it('should not be processing', () => {
      expect(useUploadQueueStore.getState().isProcessing).toBe(false);
    });
  });

  // -------------------------------------------------------------------
  // addToQueue
  // -------------------------------------------------------------------
  describe('addToQueue', () => {
    it('should add an item with pending status', () => {
      const metadata = createMockMetadata();
      const id = useUploadQueueStore
        .getState()
        .addToQueue('file:///rainbow.jpg', metadata);

      const queue = useUploadQueueStore.getState().queue;

      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe(id);
      expect(queue[0].photoUri).toBe('file:///rainbow.jpg');
      expect(queue[0].metadata).toEqual(metadata);
      expect(queue[0].status).toBe('pending');
      expect(queue[0].retryCount).toBe(0);
      expect(queue[0].createdAt).toBeDefined();
      expect(queue[0].errorMessage).toBeUndefined();
    });

    it('should return a unique id for each item', () => {
      const metadata = createMockMetadata();
      const id1 = useUploadQueueStore
        .getState()
        .addToQueue('file:///photo1.jpg', metadata);
      const id2 = useUploadQueueStore
        .getState()
        .addToQueue('file:///photo2.jpg', metadata);

      expect(id1).not.toBe(id2);
      expect(useUploadQueueStore.getState().queue).toHaveLength(2);
    });

    it('should append to existing queue', () => {
      const metadata = createMockMetadata();
      useUploadQueueStore.getState().addToQueue('file:///a.jpg', metadata);
      useUploadQueueStore.getState().addToQueue('file:///b.jpg', metadata);
      useUploadQueueStore.getState().addToQueue('file:///c.jpg', metadata);

      const queue = useUploadQueueStore.getState().queue;
      expect(queue).toHaveLength(3);
      expect(queue[0].photoUri).toBe('file:///a.jpg');
      expect(queue[1].photoUri).toBe('file:///b.jpg');
      expect(queue[2].photoUri).toBe('file:///c.jpg');
    });
  });

  // -------------------------------------------------------------------
  // removeFromQueue
  // -------------------------------------------------------------------
  describe('removeFromQueue', () => {
    it('should remove the item with the given id', () => {
      const { id } = addItemToQueue('file:///photo1.jpg');
      addItemToQueue('file:///photo2.jpg');

      expect(useUploadQueueStore.getState().queue).toHaveLength(2);

      useUploadQueueStore.getState().removeFromQueue(id);

      const queue = useUploadQueueStore.getState().queue;
      expect(queue).toHaveLength(1);
      expect(queue[0].photoUri).toBe('file:///photo2.jpg');
    });

    it('should be a no-op if id does not exist', () => {
      addItemToQueue('file:///photo1.jpg');

      useUploadQueueStore.getState().removeFromQueue('nonexistent-id');

      expect(useUploadQueueStore.getState().queue).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------
  // updateStatus
  // -------------------------------------------------------------------
  describe('updateStatus', () => {
    it('should change item status to uploading', () => {
      const { id } = addItemToQueue();

      useUploadQueueStore.getState().updateStatus(id, 'uploading');

      const item = useUploadQueueStore
        .getState()
        .queue.find((q) => q.id === id)!;
      expect(item.status).toBe('uploading');
      expect(item.lastAttemptAt).toBeDefined();
    });

    it('should change item status to success', () => {
      const { id } = addItemToQueue();

      useUploadQueueStore.getState().updateStatus(id, 'success');

      const item = useUploadQueueStore
        .getState()
        .queue.find((q) => q.id === id)!;
      expect(item.status).toBe('success');
    });

    it('should change item status to error with an error message', () => {
      const { id } = addItemToQueue();

      useUploadQueueStore
        .getState()
        .updateStatus(id, 'error', 'Upload failed: 500');

      const item = useUploadQueueStore
        .getState()
        .queue.find((q) => q.id === id)!;
      expect(item.status).toBe('error');
      expect(item.errorMessage).toBe('Upload failed: 500');
    });

    it('should set lastAttemptAt on status change', () => {
      const { id } = addItemToQueue();

      const beforeUpdate = new Date().toISOString();
      useUploadQueueStore.getState().updateStatus(id, 'uploading');
      const afterUpdate = new Date().toISOString();

      const item = useUploadQueueStore
        .getState()
        .queue.find((q) => q.id === id)!;
      expect(item.lastAttemptAt).toBeDefined();
      expect(item.lastAttemptAt! >= beforeUpdate).toBe(true);
      expect(item.lastAttemptAt! <= afterUpdate).toBe(true);
    });

    it('should not affect other items in the queue', () => {
      const { id: id1 } = addItemToQueue('file:///a.jpg');
      const { id: id2 } = addItemToQueue('file:///b.jpg');

      useUploadQueueStore.getState().updateStatus(id1, 'success');

      const queue = useUploadQueueStore.getState().queue;
      expect(queue.find((q) => q.id === id1)!.status).toBe('success');
      expect(queue.find((q) => q.id === id2)!.status).toBe('pending');
    });
  });

  // -------------------------------------------------------------------
  // incrementRetryCount
  // -------------------------------------------------------------------
  describe('incrementRetryCount', () => {
    it('should increment retryCount by 1', () => {
      const { id } = addItemToQueue();

      useUploadQueueStore.getState().incrementRetryCount(id);

      const item = useUploadQueueStore
        .getState()
        .queue.find((q) => q.id === id)!;
      expect(item.retryCount).toBe(1);
    });

    it('should increment retryCount cumulatively', () => {
      const { id } = addItemToQueue();

      useUploadQueueStore.getState().incrementRetryCount(id);
      useUploadQueueStore.getState().incrementRetryCount(id);

      const item = useUploadQueueStore
        .getState()
        .queue.find((q) => q.id === id)!;
      expect(item.retryCount).toBe(2);
    });

    it('should mark as error when max retries (3) are exceeded', () => {
      const { id } = addItemToQueue();

      // Increment 3 times to reach MAX_RETRIES
      useUploadQueueStore.getState().incrementRetryCount(id);
      useUploadQueueStore.getState().incrementRetryCount(id);
      useUploadQueueStore.getState().incrementRetryCount(id);

      const item = useUploadQueueStore
        .getState()
        .queue.find((q) => q.id === id)!;
      expect(item.retryCount).toBe(3);
      expect(item.status).toBe('error');
      expect(item.errorMessage).toBe('Maximum retry attempts exceeded');
    });

    it('should not mark as error before max retries', () => {
      const { id } = addItemToQueue();

      useUploadQueueStore.getState().incrementRetryCount(id);
      useUploadQueueStore.getState().incrementRetryCount(id);

      const item = useUploadQueueStore
        .getState()
        .queue.find((q) => q.id === id)!;
      expect(item.retryCount).toBe(2);
      expect(item.status).toBe('pending');
    });
  });

  // -------------------------------------------------------------------
  // getNextPending
  // -------------------------------------------------------------------
  describe('getNextPending', () => {
    it('should return the first pending item', () => {
      const { id: id1 } = addItemToQueue('file:///a.jpg');
      addItemToQueue('file:///b.jpg');

      const next = useUploadQueueStore.getState().getNextPending();

      expect(next).toBeDefined();
      expect(next!.id).toBe(id1);
      expect(next!.status).toBe('pending');
    });

    it('should return undefined when queue is empty', () => {
      const next = useUploadQueueStore.getState().getNextPending();

      expect(next).toBeUndefined();
    });

    it('should skip non-pending items', () => {
      const { id: id1 } = addItemToQueue('file:///a.jpg');
      const { id: id2 } = addItemToQueue('file:///b.jpg');

      // Mark first item as uploading
      useUploadQueueStore.getState().updateStatus(id1, 'uploading');

      const next = useUploadQueueStore.getState().getNextPending();

      expect(next).toBeDefined();
      expect(next!.id).toBe(id2);
    });

    it('should skip items that have exceeded max retries', () => {
      const { id: id1 } = addItemToQueue('file:///a.jpg');
      const { id: id2 } = addItemToQueue('file:///b.jpg');

      // Exhaust retries on first item (MAX_RETRIES = 3)
      useUploadQueueStore.getState().incrementRetryCount(id1);
      useUploadQueueStore.getState().incrementRetryCount(id1);
      useUploadQueueStore.getState().incrementRetryCount(id1);

      const next = useUploadQueueStore.getState().getNextPending();

      expect(next).toBeDefined();
      expect(next!.id).toBe(id2);
    });

    it('should return undefined when all items are completed or failed', () => {
      const { id: id1 } = addItemToQueue('file:///a.jpg');
      const { id: id2 } = addItemToQueue('file:///b.jpg');

      useUploadQueueStore.getState().updateStatus(id1, 'success');
      useUploadQueueStore.getState().updateStatus(id2, 'error', 'Failed');

      const next = useUploadQueueStore.getState().getNextPending();

      expect(next).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------
  // clearCompleted
  // -------------------------------------------------------------------
  describe('clearCompleted', () => {
    it('should remove items with success status', () => {
      const { id: id1 } = addItemToQueue('file:///a.jpg');
      const { id: id2 } = addItemToQueue('file:///b.jpg');
      addItemToQueue('file:///c.jpg');

      useUploadQueueStore.getState().updateStatus(id1, 'success');
      useUploadQueueStore.getState().updateStatus(id2, 'success');

      useUploadQueueStore.getState().clearCompleted();

      const queue = useUploadQueueStore.getState().queue;
      expect(queue).toHaveLength(1);
      expect(queue[0].photoUri).toBe('file:///c.jpg');
    });

    it('should keep pending, uploading, and error items', () => {
      addItemToQueue('file:///pending.jpg');
      const { id: id2 } = addItemToQueue('file:///uploading.jpg');
      const { id: id3 } = addItemToQueue('file:///error.jpg');
      const { id: id4 } = addItemToQueue('file:///success.jpg');

      useUploadQueueStore.getState().updateStatus(id2, 'uploading');
      useUploadQueueStore.getState().updateStatus(id3, 'error', 'Failed');
      useUploadQueueStore.getState().updateStatus(id4, 'success');

      useUploadQueueStore.getState().clearCompleted();

      const queue = useUploadQueueStore.getState().queue;
      expect(queue).toHaveLength(3);
      const statuses = queue.map((q) => q.status);
      expect(statuses).toContain('pending');
      expect(statuses).toContain('uploading');
      expect(statuses).toContain('error');
      expect(statuses).not.toContain('success');
    });

    it('should be a no-op when there are no completed items', () => {
      addItemToQueue('file:///a.jpg');
      addItemToQueue('file:///b.jpg');

      useUploadQueueStore.getState().clearCompleted();

      expect(useUploadQueueStore.getState().queue).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------
  // clearAll
  // -------------------------------------------------------------------
  describe('clearAll', () => {
    it('should empty the queue', () => {
      addItemToQueue('file:///a.jpg');
      addItemToQueue('file:///b.jpg');
      addItemToQueue('file:///c.jpg');

      useUploadQueueStore.getState().clearAll();

      expect(useUploadQueueStore.getState().queue).toEqual([]);
    });

    it('should reset isProcessing to false', () => {
      useUploadQueueStore.setState({ isProcessing: true });
      addItemToQueue('file:///a.jpg');

      useUploadQueueStore.getState().clearAll();

      expect(useUploadQueueStore.getState().isProcessing).toBe(false);
    });

    it('should work on an already empty queue', () => {
      useUploadQueueStore.getState().clearAll();

      expect(useUploadQueueStore.getState().queue).toEqual([]);
      expect(useUploadQueueStore.getState().isProcessing).toBe(false);
    });
  });

  // -------------------------------------------------------------------
  // setProcessing
  // -------------------------------------------------------------------
  describe('setProcessing', () => {
    it('should set isProcessing to true', () => {
      useUploadQueueStore.getState().setProcessing(true);

      expect(useUploadQueueStore.getState().isProcessing).toBe(true);
    });

    it('should set isProcessing to false', () => {
      useUploadQueueStore.setState({ isProcessing: true });

      useUploadQueueStore.getState().setProcessing(false);

      expect(useUploadQueueStore.getState().isProcessing).toBe(false);
    });
  });
});
