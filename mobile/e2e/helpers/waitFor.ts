/**
 * Custom Wait Utilities for E2E Tests
 *
 * Provides additional wait utilities beyond Detox defaults
 *
 * Task 51: Mobile App E2E Tests
 */

import { by, element, waitFor, device } from 'detox';

/**
 * Default timeout for wait operations in milliseconds
 */
export const DEFAULT_TIMEOUT = 10000;

/**
 * Extended timeout for slow operations in milliseconds
 */
export const EXTENDED_TIMEOUT = 30000;

/**
 * Short timeout for quick checks in milliseconds
 */
export const SHORT_TIMEOUT = 3000;

/**
 * Waits for an element to be visible
 *
 * @param testId - The testID of the element
 * @param timeout - Maximum time to wait in milliseconds
 */
export async function waitForVisible(
  testId: string,
  timeout: number = DEFAULT_TIMEOUT
): Promise<void> {
  await waitFor(element(by.id(testId)))
    .toBeVisible()
    .withTimeout(timeout);
}

/**
 * Waits for an element to not be visible
 *
 * @param testId - The testID of the element
 * @param timeout - Maximum time to wait in milliseconds
 */
export async function waitForNotVisible(
  testId: string,
  timeout: number = DEFAULT_TIMEOUT
): Promise<void> {
  await waitFor(element(by.id(testId)))
    .not.toBeVisible()
    .withTimeout(timeout);
}

/**
 * Waits for an element to exist in the view hierarchy
 *
 * @param testId - The testID of the element
 * @param timeout - Maximum time to wait in milliseconds
 */
export async function waitForExists(
  testId: string,
  timeout: number = DEFAULT_TIMEOUT
): Promise<void> {
  await waitFor(element(by.id(testId)))
    .toExist()
    .withTimeout(timeout);
}

/**
 * Waits for an element to not exist in the view hierarchy
 *
 * @param testId - The testID of the element
 * @param timeout - Maximum time to wait in milliseconds
 */
export async function waitForNotExists(
  testId: string,
  timeout: number = DEFAULT_TIMEOUT
): Promise<void> {
  await waitFor(element(by.id(testId)))
    .not.toExist()
    .withTimeout(timeout);
}

/**
 * Waits for an element with specific text to be visible
 *
 * @param text - The text to look for
 * @param timeout - Maximum time to wait in milliseconds
 */
export async function waitForText(
  text: string,
  timeout: number = DEFAULT_TIMEOUT
): Promise<void> {
  await waitFor(element(by.text(text)))
    .toBeVisible()
    .withTimeout(timeout);
}

/**
 * Waits for an element with specific text to not be visible
 *
 * @param text - The text to look for
 * @param timeout - Maximum time to wait in milliseconds
 */
export async function waitForTextToDisappear(
  text: string,
  timeout: number = DEFAULT_TIMEOUT
): Promise<void> {
  await waitFor(element(by.text(text)))
    .not.toBeVisible()
    .withTimeout(timeout);
}

/**
 * Waits for a loading indicator to disappear
 *
 * @param loadingTestId - The testID of the loading indicator
 * @param timeout - Maximum time to wait in milliseconds
 */
export async function waitForLoadingToComplete(
  loadingTestId: string,
  timeout: number = EXTENDED_TIMEOUT
): Promise<void> {
  await waitForNotVisible(loadingTestId, timeout);
}

/**
 * Waits for network request to complete (useful for API calls)
 * Uses a simple delay as Detox doesn't have built-in network sync
 *
 * @param ms - Time to wait in milliseconds
 */
export async function waitForNetwork(ms: number = 2000): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Waits for app to be ready after launch or reload
 *
 * @param timeout - Maximum time to wait in milliseconds
 */
export async function waitForAppReady(
  timeout: number = DEFAULT_TIMEOUT
): Promise<void> {
  // Wait for either onboarding screen, login screen, or feed tab (main screen indicator)
  // depending on app state
  await Promise.race([
    waitForVisible('onboarding-screen', timeout).catch(() => {}),
    waitForVisible('login-screen', timeout).catch(() => {}),
    waitForVisible('tab-feed', timeout).catch(() => {}),
  ]);
}

/**
 * Waits for keyboard to be visible
 *
 * @param timeout - Maximum time to wait in milliseconds
 */
export async function waitForKeyboard(
  timeout: number = SHORT_TIMEOUT
): Promise<void> {
  // Simple delay to allow keyboard animation to complete
  await new Promise((resolve) => setTimeout(resolve, 500));
}

/**
 * Dismisses the keyboard if visible
 */
export async function dismissKeyboard(): Promise<void> {
  await device.pressBack();
}

/**
 * Waits for an animation to complete
 *
 * @param ms - Time to wait in milliseconds (default 300ms for standard animations)
 */
export async function waitForAnimation(ms: number = 300): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Waits for element and then taps it
 *
 * @param testId - The testID of the element
 * @param timeout - Maximum time to wait in milliseconds
 */
export async function waitAndTap(
  testId: string,
  timeout: number = DEFAULT_TIMEOUT
): Promise<void> {
  await waitForVisible(testId, timeout);
  await element(by.id(testId)).tap();
}

/**
 * Waits for element and then types text
 *
 * @param testId - The testID of the element
 * @param text - Text to type
 * @param timeout - Maximum time to wait in milliseconds
 */
export async function waitAndType(
  testId: string,
  text: string,
  timeout: number = DEFAULT_TIMEOUT
): Promise<void> {
  await waitForVisible(testId, timeout);
  await element(by.id(testId)).typeText(text);
}

/**
 * Waits for element and replaces text
 *
 * @param testId - The testID of the element
 * @param text - Text to replace with
 * @param timeout - Maximum time to wait in milliseconds
 */
export async function waitAndReplaceText(
  testId: string,
  text: string,
  timeout: number = DEFAULT_TIMEOUT
): Promise<void> {
  await waitForVisible(testId, timeout);
  await element(by.id(testId)).replaceText(text);
}

/**
 * Retries an action until it succeeds or times out
 *
 * @param action - The async action to retry
 * @param maxAttempts - Maximum number of attempts
 * @param delayMs - Delay between attempts in milliseconds
 */
export async function retry<T>(
  action: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await action();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}
