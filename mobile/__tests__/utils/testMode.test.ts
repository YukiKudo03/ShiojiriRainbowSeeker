/**
 * Unit Tests for testMode utilities
 *
 * Tests E2E test mode detection and animation/timer adjustments.
 */

jest.mock('react-native', () => ({
  NativeModules: {
    RCTDevSettings: { launchArgs: {} },
    LaunchArguments: { launchArguments: {} },
  },
  Platform: { OS: 'ios' },
}));

import {
  isE2ETestMode,
  getAnimationMultiplier,
  getTestSafeInterval,
  shouldEnableContinuousAnimations,
  setE2ETestMode,
} from '../../src/utils/testMode';

describe('testMode', () => {
  beforeEach(() => {
    // Clear global flag before each test
    (global as any).__DETOX_TESTING = undefined;
    jest.clearAllMocks();
  });

  describe('isE2ETestMode', () => {
    it('should return false when no test flags are set', () => {
      expect(isE2ETestMode()).toBe(false);
    });

    it('should return true when __DETOX_TESTING global is set', () => {
      (global as any).__DETOX_TESTING = true;
      expect(isE2ETestMode()).toBe(true);
    });

    it('should return false when __DETOX_TESTING is falsy', () => {
      (global as any).__DETOX_TESTING = false;
      expect(isE2ETestMode()).toBe(false);
    });
  });

  describe('setE2ETestMode', () => {
    it('should set the global __DETOX_TESTING flag to true', () => {
      setE2ETestMode(true);
      expect((global as any).__DETOX_TESTING).toBe(true);
    });

    it('should set the global __DETOX_TESTING flag to false', () => {
      setE2ETestMode(true);
      setE2ETestMode(false);
      expect((global as any).__DETOX_TESTING).toBe(false);
    });
  });

  describe('getAnimationMultiplier', () => {
    it('should return 1 when not in test mode', () => {
      expect(getAnimationMultiplier()).toBe(1);
    });

    it('should return 0 when in test mode', () => {
      setE2ETestMode(true);
      expect(getAnimationMultiplier()).toBe(0);
    });
  });

  describe('getTestSafeInterval', () => {
    it('should return the normal delay when not in test mode', () => {
      expect(getTestSafeInterval(5000)).toBe(5000);
    });

    it('should return a very large number when in test mode', () => {
      setE2ETestMode(true);
      expect(getTestSafeInterval(5000)).toBe(999999999);
    });

    it('should return a very large number regardless of input delay in test mode', () => {
      setE2ETestMode(true);
      expect(getTestSafeInterval(100)).toBe(999999999);
      expect(getTestSafeInterval(0)).toBe(999999999);
    });
  });

  describe('shouldEnableContinuousAnimations', () => {
    it('should return true when not in test mode', () => {
      expect(shouldEnableContinuousAnimations()).toBe(true);
    });

    it('should return false when in test mode', () => {
      setE2ETestMode(true);
      expect(shouldEnableContinuousAnimations()).toBe(false);
    });
  });
});
