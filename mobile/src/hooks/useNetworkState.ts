/**
 * useNetworkState Hook
 *
 * Global network connectivity state management.
 * Provides real-time network status updates throughout the app.
 *
 * Requirements: FR-2 (AC-2.7 Offline Support)
 */

import { useEffect, useState, useCallback } from 'react';
import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';

/**
 * Network state interface
 */
export interface NetworkState {
  /** Whether the device is currently connected to the internet */
  isConnected: boolean;
  /** Whether the connection is reachable (can actually communicate) */
  isInternetReachable: boolean | null;
  /** Connection type (wifi, cellular, etc.) */
  type: NetInfoStateType;
  /** Whether the device is on WiFi */
  isWifi: boolean;
  /** Whether the device is on cellular */
  isCellular: boolean;
  /** Detailed network information */
  details: NetInfoState['details'];
}

/**
 * Return type for useNetworkState hook
 */
export interface UseNetworkStateReturn {
  /** Current network state */
  networkState: NetworkState;
  /** Whether the device is online (connected and reachable) */
  isOnline: boolean;
  /** Manually refresh network state */
  refresh: () => Promise<void>;
}

/**
 * Default network state
 */
const defaultNetworkState: NetworkState = {
  isConnected: true,
  isInternetReachable: null,
  type: NetInfoStateType.unknown,
  isWifi: false,
  isCellular: false,
  details: null,
};

/**
 * Convert NetInfo state to our NetworkState interface
 */
const parseNetInfoState = (state: NetInfoState): NetworkState => {
  return {
    isConnected: state.isConnected ?? false,
    isInternetReachable: state.isInternetReachable,
    type: state.type,
    isWifi: state.type === NetInfoStateType.wifi,
    isCellular: state.type === NetInfoStateType.cellular,
    details: state.details,
  };
};

/**
 * Global network state hook
 *
 * Provides real-time network connectivity monitoring with automatic
 * subscription to network state changes.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isOnline, networkState } = useNetworkState();
 *
 *   if (!isOnline) {
 *     return <OfflineBanner />;
 *   }
 *
 *   return <MainContent />;
 * }
 * ```
 */
export function useNetworkState(): UseNetworkStateReturn {
  const [networkState, setNetworkState] = useState<NetworkState>(defaultNetworkState);

  /**
   * Update network state from NetInfo
   */
  const updateNetworkState = useCallback((state: NetInfoState) => {
    setNetworkState(parseNetInfoState(state));
  }, []);

  /**
   * Manually refresh network state
   */
  const refresh = useCallback(async () => {
    try {
      const state = await NetInfo.fetch();
      updateNetworkState(state);
    } catch (error) {
      console.warn('[useNetworkState] Failed to fetch network state:', error);
    }
  }, [updateNetworkState]);

  /**
   * Subscribe to network state changes on mount
   */
  useEffect(() => {
    // Fetch initial state
    NetInfo.fetch().then(updateNetworkState);

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(updateNetworkState);

    return () => {
      unsubscribe();
    };
  }, [updateNetworkState]);

  /**
   * Determine if device is truly online
   * - isConnected: device has a network connection
   * - isInternetReachable: connection can reach the internet
   */
  const isOnline = networkState.isConnected && networkState.isInternetReachable !== false;

  return {
    networkState,
    isOnline,
    refresh,
  };
}

export default useNetworkState;
