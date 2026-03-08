/**
 * Component Tests for useNetworkState hook
 *
 * Uses renderHook from @testing-library/react-native to test
 * the hook with proper React lifecycle.
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';

const mockedNetInfo = jest.mocked(NetInfo);

import { useNetworkState } from '../../src/hooks/useNetworkState';

describe('useNetworkState hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns default state initially', () => {
    const { result } = renderHook(() => useNetworkState());

    expect(result.current.networkState).toBeDefined();
    expect(result.current.isOnline).toBeDefined();
    expect(result.current.refresh).toBeDefined();
    expect(typeof result.current.refresh).toBe('function');
  });

  it('subscribes to NetInfo on mount', () => {
    renderHook(() => useNetworkState());

    expect(mockedNetInfo.addEventListener).toHaveBeenCalled();
    expect(mockedNetInfo.fetch).toHaveBeenCalled();
  });

  it('unsubscribes on unmount', () => {
    const mockUnsubscribe = jest.fn();
    mockedNetInfo.addEventListener.mockReturnValue(mockUnsubscribe);

    const { unmount } = renderHook(() => useNetworkState());
    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('updates state when NetInfo fetch resolves', async () => {
    mockedNetInfo.fetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi' as any,
      details: null,
    } as any);

    const { result } = renderHook(() => useNetworkState());

    await waitFor(() => {
      expect(result.current.networkState.isConnected).toBe(true);
    });
    expect(result.current.isOnline).toBe(true);
  });

  it('detects offline state', async () => {
    mockedNetInfo.fetch.mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
      type: 'none' as any,
      details: null,
    } as any);

    const { result } = renderHook(() => useNetworkState());

    await waitFor(() => {
      expect(result.current.networkState.isConnected).toBe(false);
    });
    expect(result.current.isOnline).toBe(false);
  });

  it('refresh fetches current state', async () => {
    mockedNetInfo.fetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi' as any,
      details: null,
    } as any);

    const { result } = renderHook(() => useNetworkState());

    await act(async () => {
      await result.current.refresh();
    });

    // fetch is called once on mount + once on refresh
    expect(mockedNetInfo.fetch).toHaveBeenCalledTimes(2);
  });
});
