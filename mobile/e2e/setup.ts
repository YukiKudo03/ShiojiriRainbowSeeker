/**
 * Detox E2E Test Setup
 *
 * Global setup and teardown hooks for E2E tests
 *
 * Task 51: Mobile App E2E Tests
 */

import { device } from 'detox';

/**
 * Run before all tests
 */
beforeAll(async () => {
  // Launch the app with clean state (delete app data)
  // Pass launchArgs to enable E2E test mode detection in the app
  await device.launchApp({
    newInstance: true,
    delete: true, // Delete app data to reset AsyncStorage, etc.
    permissions: {
      location: 'always',
      camera: 'YES',
      photos: 'YES',
      notifications: 'YES',
    },
    launchArgs: {
      // Flag to indicate E2E test mode - used by app to disable animations
      detoxTest: 'true',
      // Disable animations in the app for reliable testing
      detoxDisableAnimations: 'true',
    },
  });
});

/**
 * Run before each test
 */
beforeEach(async () => {
  // Reload React Native to reset app state
  await device.reloadReactNative();
});

/**
 * Run after all tests
 */
afterAll(async () => {
  // Clean up
  await device.terminateApp();
});
