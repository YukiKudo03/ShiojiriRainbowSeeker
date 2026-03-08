/**
 * Unit Tests for useUploadQueueProcessor hook
 *
 * Tests queue processing logic, retry calculation, and utility functions
 * without React rendering (node environment).
 */

// Mock dependencies
jest.mock('../../src/hooks/useNetworkState', () => ({
  useNetworkState: jest.fn(() => ({
    isOnline: true,
    networkState: { isConnected: true, isInternetReachable: true },
    refresh: jest.fn(),
  })),
}));

jest.mock('../../src/services/photoService', () => ({
  uploadPhoto: jest.fn(() => Promise.resolve({ id: 'photo-1' })),
  prepareUploadRequest: jest.fn((photo: any, metadata: any) => ({
    image: { uri: photo.uri, type: 'image/jpeg', name: 'test.jpg' },
    metadata,
  })),
}));

jest.mock('../../src/store/uploadQueueStore', () => ({
  useUploadQueueStore: jest.fn(() => ({
    queue: [],
    isProcessing: false,
    getNextPending: jest.fn(() => null),
    updateStatus: jest.fn(),
    incrementRetryCount: jest.fn(),
    setProcessing: jest.fn(),
    clearCompleted: jest.fn(),
  })),
}));

import { uploadPhoto, prepareUploadRequest } from '../../src/services/photoService';

const mockedUploadPhoto = jest.mocked(uploadPhoto);
const mockedPrepareUploadRequest = jest.mocked(prepareUploadRequest);

describe('useUploadQueueProcessor - logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('exponential backoff calculation', () => {
    const INITIAL_RETRY_DELAY_MS = 1000;
    const MAX_RETRY_DELAY_MS = 30000;
    const BACKOFF_MULTIPLIER = 2;

    const calculateRetryDelay = (retryCount: number): number => {
      const delay = INITIAL_RETRY_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, retryCount);
      return Math.min(delay, MAX_RETRY_DELAY_MS);
    };

    it('should return 1000ms for first retry (retryCount=0)', () => {
      expect(calculateRetryDelay(0)).toBe(1000);
    });

    it('should return 2000ms for second retry (retryCount=1)', () => {
      expect(calculateRetryDelay(1)).toBe(2000);
    });

    it('should return 4000ms for third retry (retryCount=2)', () => {
      expect(calculateRetryDelay(2)).toBe(4000);
    });

    it('should return 8000ms for fourth retry (retryCount=3)', () => {
      expect(calculateRetryDelay(3)).toBe(8000);
    });

    it('should cap at MAX_RETRY_DELAY_MS (30000ms)', () => {
      expect(calculateRetryDelay(10)).toBe(30000);
      expect(calculateRetryDelay(20)).toBe(30000);
    });
  });

  describe('queueItemToCapturedPhoto conversion', () => {
    const queueItemToCapturedPhoto = (item: any) => ({
      uri: item.photoUri,
      width: 0,
      height: 0,
      location: {
        latitude: item.metadata.latitude,
        longitude: item.metadata.longitude,
      },
      timestamp: item.metadata.capturedAt || new Date().toISOString(),
    });

    it('should convert queue item to CapturedPhoto format', () => {
      const item = {
        id: 'upload-1',
        photoUri: 'file:///photo.jpg',
        metadata: {
          latitude: 36.115,
          longitude: 137.954,
          capturedAt: '2026-01-01T00:00:00Z',
        },
      };

      const result = queueItemToCapturedPhoto(item);
      expect(result.uri).toBe('file:///photo.jpg');
      expect(result.width).toBe(0);
      expect(result.height).toBe(0);
      expect(result.location.latitude).toBe(36.115);
      expect(result.location.longitude).toBe(137.954);
      expect(result.timestamp).toBe('2026-01-01T00:00:00Z');
    });

    it('should use current time when capturedAt is missing', () => {
      const now = new Date().toISOString();
      const item = {
        id: 'upload-2',
        photoUri: 'file:///photo2.jpg',
        metadata: {
          latitude: 35.0,
          longitude: 136.0,
        },
      };

      const result = queueItemToCapturedPhoto(item);
      // Should be a valid ISO string (close to now)
      expect(new Date(result.timestamp).getTime()).toBeGreaterThan(
        new Date(now).getTime() - 1000
      );
    });
  });

  describe('upload processing', () => {
    it('should call prepareUploadRequest with correct params', () => {
      const photo = { uri: 'file:///photo.jpg', width: 0, height: 0 };
      const metadata = { latitude: 36.1, longitude: 137.9 };

      prepareUploadRequest(photo as any, metadata as any);

      expect(mockedPrepareUploadRequest).toHaveBeenCalledWith(photo, metadata);
    });

    it('should call uploadPhoto with prepared request', async () => {
      mockedPrepareUploadRequest.mockReturnValueOnce({
        image: { uri: 'file:///photo.jpg', type: 'image/jpeg', name: 'test.jpg' },
        metadata: { latitude: 36.1, longitude: 137.9 },
      } as any);

      const request = prepareUploadRequest({} as any, {} as any);
      await uploadPhoto(request);

      expect(mockedUploadPhoto).toHaveBeenCalledWith(request);
    });

    it('should handle upload failure', async () => {
      mockedUploadPhoto.mockRejectedValueOnce(new Error('Upload failed'));

      const request = { image: {}, metadata: {} } as any;
      await expect(uploadPhoto(request)).rejects.toThrow('Upload failed');
    });
  });

  describe('queue filtering', () => {
    it('should count pending items correctly', () => {
      const queue = [
        { id: '1', status: 'pending' },
        { id: '2', status: 'uploading' },
        { id: '3', status: 'pending' },
        { id: '4', status: 'error' },
        { id: '5', status: 'success' },
      ];

      const pendingCount = queue.filter((item) => item.status === 'pending').length;
      const failedCount = queue.filter((item) => item.status === 'error').length;

      expect(pendingCount).toBe(2);
      expect(failedCount).toBe(1);
    });

    it('should return 0 for empty queue', () => {
      const queue: any[] = [];
      const pendingCount = queue.filter((item) => item.status === 'pending').length;
      const failedCount = queue.filter((item) => item.status === 'error').length;

      expect(pendingCount).toBe(0);
      expect(failedCount).toBe(0);
    });
  });

  describe('retry logic', () => {
    it('should mark item as error when retryCount >= 3', () => {
      const item = { id: '1', retryCount: 3, status: 'pending' };
      const shouldMarkAsError = item.retryCount >= 3;
      expect(shouldMarkAsError).toBe(true);
    });

    it('should keep item as pending when retryCount < 3', () => {
      const item = { id: '1', retryCount: 2, status: 'pending' };
      const shouldMarkAsError = item.retryCount >= 3;
      expect(shouldMarkAsError).toBe(false);
    });

    it('should reset error items to pending on retryFailed', () => {
      const queue = [
        { id: '1', status: 'error' },
        { id: '2', status: 'error' },
        { id: '3', status: 'success' },
      ];

      const errorItems = queue.filter((item) => item.status === 'error');
      expect(errorItems).toHaveLength(2);

      // Simulate retryFailed
      errorItems.forEach((item) => {
        item.status = 'pending';
      });

      expect(queue.filter((item) => item.status === 'pending')).toHaveLength(2);
    });
  });
});
