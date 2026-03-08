/**
 * Component Tests for useUploadQueueProcessor hook
 *
 * Uses renderHook from @testing-library/react-native to test
 * the hook with proper React lifecycle.
 */

import { renderHook } from '@testing-library/react-native';

// Mock dependencies before importing
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

const mockGetNextPending = jest.fn(() => null);
const mockUpdateStatus = jest.fn();
const mockIncrementRetryCount = jest.fn();
const mockSetProcessing = jest.fn();
const mockClearCompleted = jest.fn();

jest.mock('../../src/store/uploadQueueStore', () => ({
  useUploadQueueStore: jest.fn(() => ({
    queue: [],
    isProcessing: false,
    getNextPending: mockGetNextPending,
    updateStatus: mockUpdateStatus,
    incrementRetryCount: mockIncrementRetryCount,
    setProcessing: mockSetProcessing,
    clearCompleted: mockClearCompleted,
  })),
}));

import { useUploadQueueProcessor } from '../../src/hooks/useUploadQueueProcessor';
import { useNetworkState } from '../../src/hooks/useNetworkState';
import { uploadPhoto } from '../../src/services/photoService';
import { useUploadQueueStore } from '../../src/store/uploadQueueStore';

const mockedUploadPhoto = jest.mocked(uploadPhoto);

describe('useUploadQueueProcessor hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Reset to online state
    (useNetworkState as jest.Mock).mockReturnValue({
      isOnline: true,
      networkState: { isConnected: true, isInternetReachable: true },
      refresh: jest.fn(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns expected interface', () => {
    const { result } = renderHook(() => useUploadQueueProcessor());

    expect(result.current).toHaveProperty('isProcessing');
    expect(result.current).toHaveProperty('pendingCount');
    expect(result.current).toHaveProperty('failedCount');
    expect(result.current).toHaveProperty('processQueue');
    expect(result.current).toHaveProperty('clearCompleted');
    expect(result.current).toHaveProperty('retryFailed');
  });

  it('has zero counts when queue is empty', () => {
    const { result } = renderHook(() => useUploadQueueProcessor());

    expect(result.current.pendingCount).toBe(0);
    expect(result.current.failedCount).toBe(0);
  });

  it('provides processQueue function', () => {
    const { result } = renderHook(() => useUploadQueueProcessor());
    expect(typeof result.current.processQueue).toBe('function');
  });

  it('provides clearCompleted function', () => {
    const { result } = renderHook(() => useUploadQueueProcessor());
    expect(typeof result.current.clearCompleted).toBe('function');
  });

  it('provides retryFailed function', () => {
    const { result } = renderHook(() => useUploadQueueProcessor());
    expect(typeof result.current.retryFailed).toBe('function');
  });

  it('does not process when offline', () => {
    (useNetworkState as jest.Mock).mockReturnValue({
      isOnline: false,
      networkState: { isConnected: false, isInternetReachable: false },
      refresh: jest.fn(),
    });

    renderHook(() => useUploadQueueProcessor());

    // processQueue should not call getNextPending when offline
    expect(mockGetNextPending).not.toHaveBeenCalled();
  });

  it('counts pending items correctly', () => {
    (useUploadQueueStore as jest.MockedFunction<typeof useUploadQueueStore>).mockReturnValue({
      queue: [
        { id: '1', status: 'pending', photoUri: 'file://1', metadata: { latitude: 36.1, longitude: 137.9 }, retryCount: 0, createdAt: new Date().toISOString() },
        { id: '2', status: 'pending', photoUri: 'file://2', metadata: { latitude: 36.1, longitude: 137.9 }, retryCount: 0, createdAt: new Date().toISOString() },
        { id: '3', status: 'success', photoUri: 'file://3', metadata: { latitude: 36.1, longitude: 137.9 }, retryCount: 0, createdAt: new Date().toISOString() },
      ] as any,
      isProcessing: false,
      getNextPending: mockGetNextPending,
      updateStatus: mockUpdateStatus,
      incrementRetryCount: mockIncrementRetryCount,
      setProcessing: mockSetProcessing,
      clearCompleted: mockClearCompleted,
    } as any);

    const { result } = renderHook(() => useUploadQueueProcessor());

    expect(result.current.pendingCount).toBe(2);
  });

  it('counts failed items correctly', () => {
    (useUploadQueueStore as jest.MockedFunction<typeof useUploadQueueStore>).mockReturnValue({
      queue: [
        { id: '1', status: 'error', photoUri: 'file://1', metadata: { latitude: 36.1, longitude: 137.9 }, retryCount: 3, createdAt: new Date().toISOString() },
        { id: '2', status: 'pending', photoUri: 'file://2', metadata: { latitude: 36.1, longitude: 137.9 }, retryCount: 0, createdAt: new Date().toISOString() },
      ] as any,
      isProcessing: false,
      getNextPending: mockGetNextPending,
      updateStatus: mockUpdateStatus,
      incrementRetryCount: mockIncrementRetryCount,
      setProcessing: mockSetProcessing,
      clearCompleted: mockClearCompleted,
    } as any);

    const { result } = renderHook(() => useUploadQueueProcessor());

    expect(result.current.failedCount).toBe(1);
  });

  it('processes pending item when online', async () => {
    const pendingItem = {
      id: 'upload-1',
      status: 'pending',
      photoUri: 'file://photo1.jpg',
      metadata: { latitude: 36.1, longitude: 137.9 },
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };

    mockGetNextPending
      .mockReturnValueOnce(pendingItem)
      .mockReturnValueOnce(null);

    mockedUploadPhoto.mockResolvedValue({ id: 'photo-1' } as any);

    renderHook(() => useUploadQueueProcessor());

    // Let async processing complete
    await jest.advanceTimersByTimeAsync(100);

    expect(mockSetProcessing).toHaveBeenCalledWith(true);
  });

  it('retries failed items via retryFailed', () => {
    const errorItems = [
      { id: '1', status: 'error', photoUri: 'file://1', metadata: { latitude: 36.1, longitude: 137.9 }, retryCount: 3, createdAt: new Date().toISOString() },
    ];

    (useUploadQueueStore as jest.MockedFunction<typeof useUploadQueueStore>).mockReturnValue({
      queue: errorItems as any,
      isProcessing: false,
      getNextPending: mockGetNextPending,
      updateStatus: mockUpdateStatus,
      incrementRetryCount: mockIncrementRetryCount,
      setProcessing: mockSetProcessing,
      clearCompleted: mockClearCompleted,
    } as any);

    const { result } = renderHook(() => useUploadQueueProcessor());

    result.current.retryFailed();

    expect(mockUpdateStatus).toHaveBeenCalledWith('1', 'pending', undefined);
  });

  it('calls clearCompleted from store', () => {
    const { result } = renderHook(() => useUploadQueueProcessor());

    result.current.clearCompleted();

    expect(mockClearCompleted).toHaveBeenCalled();
  });

  it('handles upload failure and increments retry count', async () => {
    const pendingItem = {
      id: 'upload-fail',
      status: 'pending',
      photoUri: 'file://photo-fail.jpg',
      metadata: { latitude: 36.1, longitude: 137.9 },
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };

    mockGetNextPending
      .mockReturnValueOnce(pendingItem)
      .mockReturnValueOnce(null);

    mockedUploadPhoto.mockRejectedValueOnce(new Error('Upload failed'));

    // Configure queue to return updated item with retryCount < 3
    (useUploadQueueStore as jest.MockedFunction<typeof useUploadQueueStore>).mockReturnValue({
      queue: [{ ...pendingItem, retryCount: 1 }] as any,
      isProcessing: false,
      getNextPending: mockGetNextPending,
      updateStatus: mockUpdateStatus,
      incrementRetryCount: mockIncrementRetryCount,
      setProcessing: mockSetProcessing,
      clearCompleted: mockClearCompleted,
    } as any);

    renderHook(() => useUploadQueueProcessor());

    await jest.advanceTimersByTimeAsync(200);

    expect(mockIncrementRetryCount).toHaveBeenCalledWith('upload-fail');
  });

  it('marks as error when max retries exceeded', async () => {
    const pendingItem = {
      id: 'upload-max-retry',
      status: 'pending',
      photoUri: 'file://photo-retry.jpg',
      metadata: { latitude: 36.1, longitude: 137.9 },
      retryCount: 2,
      createdAt: new Date().toISOString(),
    };

    mockGetNextPending
      .mockReturnValueOnce(pendingItem)
      .mockReturnValueOnce(null);

    mockedUploadPhoto.mockRejectedValueOnce(new Error('Upload failed'));

    // Return item with retryCount >= 3 (max exceeded)
    (useUploadQueueStore as jest.MockedFunction<typeof useUploadQueueStore>).mockReturnValue({
      queue: [{ ...pendingItem, retryCount: 3 }] as any,
      isProcessing: false,
      getNextPending: mockGetNextPending,
      updateStatus: mockUpdateStatus,
      incrementRetryCount: mockIncrementRetryCount,
      setProcessing: mockSetProcessing,
      clearCompleted: mockClearCompleted,
    } as any);

    renderHook(() => useUploadQueueProcessor());

    await jest.advanceTimersByTimeAsync(200);

    expect(mockUpdateStatus).toHaveBeenCalledWith('upload-max-retry', 'error', expect.any(String));
  });

  it('cleans up interval on unmount', () => {
    const { unmount } = renderHook(() => useUploadQueueProcessor());

    unmount();

    // Should not throw or leave dangling timers
  });

  it('sets up processing interval when online', async () => {
    (useNetworkState as jest.Mock).mockReturnValue({
      isOnline: true,
      networkState: { isConnected: true, isInternetReachable: true },
      refresh: jest.fn(),
    });

    renderHook(() => useUploadQueueProcessor());

    // processQueue should be called on mount when online
    await jest.advanceTimersByTimeAsync(100);
    expect(mockSetProcessing).toHaveBeenCalled();
  });
});
