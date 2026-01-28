/**
 * Test Mode Detection Utility
 *
 * Provides utilities to detect if the app is running in E2E test mode
 * and adjust behavior accordingly (e.g., disable animations, timers).
 *
 * Task 51: Mobile App E2E Tests
 */

import { NativeModules, Platform } from 'react-native';

/**
 * Checks if the app is running in E2E test mode (Detox)
 *
 * Detection methods:
 * 1. Check for Detox injected global variable
 * 2. Check for launch arguments passed via Detox config
 * 3. Check for __DETOX_TESTING environment flag
 *
 * @returns boolean indicating if in test mode
 */
export const isE2ETestMode = (): boolean => {
  // Check for Detox global flag (iOS and Android)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const global_: { __DETOX_TESTING?: boolean } = global as any;
  if (global_.__DETOX_TESTING) {
    return true;
  }

  // Check for launch arguments on iOS
  if (Platform.OS === 'ios') {
    try {
      const launchArgs = NativeModules.RCTDevSettings?.launchArgs;
      if (launchArgs?.e2eTest === 'true' || launchArgs?.detoxTest === 'true') {
        return true;
      }
    } catch {
      // Module not available
    }
  }

  // Check for launch arguments on Android
  if (Platform.OS === 'android') {
    try {
      const launchArgs = NativeModules.LaunchArguments?.launchArguments;
      if (launchArgs?.e2eTest === 'true' || launchArgs?.detoxTest === 'true') {
        return true;
      }
    } catch {
      // Module not available
    }
  }

  // Check process.env for CI/test environments
  // This is set at build time by metro bundler
  if (__DEV__ && typeof process !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (process as any).env;
    if (env?.E2E_TEST === 'true' || env?.DETOX === 'true') {
      return true;
    }
  }

  return false;
};

/**
 * Gets the animation duration multiplier for test mode
 *
 * In test mode, animations should be instant (0ms) or very fast
 * to prevent Detox synchronization issues.
 *
 * @returns multiplier for animation duration (0 in test mode, 1 otherwise)
 */
export const getAnimationMultiplier = (): number => {
  return isE2ETestMode() ? 0 : 1;
};

/**
 * Returns the appropriate interval delay for test mode
 *
 * In test mode, we should avoid setInterval entirely or use very long intervals
 * to prevent keeping the JS thread busy.
 *
 * @param normalDelay - Normal delay in milliseconds
 * @returns adjusted delay (very large in test mode to effectively disable)
 */
export const getTestSafeInterval = (normalDelay: number): number => {
  // In test mode, return a very large interval to effectively disable
  // continuous animations/polling
  return isE2ETestMode() ? 999999999 : normalDelay;
};

/**
 * Checks if continuous animations should be enabled
 *
 * @returns false in test mode to disable looping animations
 */
export const shouldEnableContinuousAnimations = (): boolean => {
  return !isE2ETestMode();
};

/**
 * Sets the global E2E test mode flag
 * This can be called from test setup to ensure detection works
 */
export const setE2ETestMode = (enabled: boolean): void => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).__DETOX_TESTING = enabled;
};
