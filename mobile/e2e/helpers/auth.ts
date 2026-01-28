/**
 * Authentication Helpers for E2E Tests
 *
 * Provides reusable authentication functions for E2E test scenarios
 *
 * Task 51: Mobile App E2E Tests
 * Requirements: FR-1 (Authentication)
 */

import { by, element, expect, waitFor } from 'detox';
import { TestIDs } from '../testIDs';

/**
 * Test user credentials
 * Note: This user must exist in the backend database and be confirmed
 * Create with: rails runner "User.create!(email: 'test_e2e@example.com', password: 'testpassword123', display_name: 'E2E Test User', confirmed_at: Time.current)"
 */
export const TEST_USER = {
  email: 'test_e2e@example.com',
  password: 'testpassword123',
  displayName: 'E2E Test User',
};

/**
 * New user for registration tests
 */
export const NEW_USER = {
  email: `e2e-new-${Date.now()}@shiojiri-rainbow.app`,
  password: 'NewUserPassword123!',
  displayName: 'New E2E User',
};

/**
 * Invalid credentials for error testing
 */
export const INVALID_USER = {
  email: 'invalid@shiojiri-rainbow.app',
  password: 'WrongPassword123!',
};

/**
 * Skips onboarding if visible
 */
export async function skipOnboardingIfVisible(): Promise<void> {
  try {
    // Check if onboarding screen is visible
    await waitFor(element(by.id(TestIDs.onboarding.onboardingScreen)))
      .toBeVisible()
      .withTimeout(3000);

    // Skip onboarding
    await element(by.id(TestIDs.onboarding.skipButton)).tap();
  } catch {
    // Onboarding not visible, continue
  }
}

/**
 * Performs login with the provided credentials
 *
 * @param email - User email address
 * @param password - User password
 */
export async function login(
  email: string = TEST_USER.email,
  password: string = TEST_USER.password
): Promise<void> {
  // Skip onboarding if it appears
  await skipOnboardingIfVisible();

  // Wait for login screen to be visible
  await waitFor(element(by.id(TestIDs.auth.loginScreen)))
    .toBeVisible()
    .withTimeout(10000);

  // Wait for email input to be visible (it should scroll into view)
  await waitFor(element(by.id(TestIDs.auth.emailInput)))
    .toBeVisible()
    .withTimeout(5000);

  // Enter email using replaceText (doesn't require tap)
  await element(by.id(TestIDs.auth.emailInput)).replaceText(email);

  // Wait for password input to be visible
  await waitFor(element(by.id(TestIDs.auth.passwordInput)))
    .toBeVisible()
    .withTimeout(5000);

  // Enter password
  await element(by.id(TestIDs.auth.passwordInput)).replaceText(password);

  // Dismiss keyboard by tapping return key
  await element(by.id(TestIDs.auth.passwordInput)).tapReturnKey();

  // Wait for login button to be visible
  await waitFor(element(by.id(TestIDs.auth.loginButton)))
    .toBeVisible()
    .withTimeout(5000);

  // Tap login button
  await element(by.id(TestIDs.auth.loginButton)).tap();

  // Wait for navigation to complete (use feed tab as indicator)
  await waitFor(element(by.id(TestIDs.main.feedTab)))
    .toBeVisible()
    .withTimeout(15000);
}

/**
 * Performs user registration with the provided details
 *
 * @param displayName - User display name
 * @param email - User email address
 * @param password - User password
 */
export async function register(
  displayName: string = NEW_USER.displayName,
  email: string = NEW_USER.email,
  password: string = NEW_USER.password
): Promise<void> {
  // Skip onboarding if it appears
  await skipOnboardingIfVisible();

  // Navigate to register screen
  await waitFor(element(by.id(TestIDs.auth.loginScreen)))
    .toBeVisible()
    .withTimeout(10000);

  await element(by.id(TestIDs.auth.createAccountLink)).tap();

  // Wait for register screen
  await waitFor(element(by.id(TestIDs.auth.registerScreen)))
    .toBeVisible()
    .withTimeout(5000);

  // Wait for display name input to be visible and enter text
  await waitFor(element(by.id(TestIDs.auth.displayNameInput)))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id(TestIDs.auth.displayNameInput)).replaceText(displayName);

  // Wait for email input to be visible and enter text
  await waitFor(element(by.id(TestIDs.auth.emailInput)))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id(TestIDs.auth.emailInput)).replaceText(email);

  // Wait for password input to be visible and enter text
  await waitFor(element(by.id(TestIDs.auth.passwordInput)))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id(TestIDs.auth.passwordInput)).replaceText(password);

  // Wait for confirm password input to be visible and enter text
  await waitFor(element(by.id(TestIDs.auth.confirmPasswordInput)))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id(TestIDs.auth.confirmPasswordInput)).replaceText(password);

  // Dismiss keyboard by tapping return key
  await element(by.id(TestIDs.auth.confirmPasswordInput)).tapReturnKey();

  // Wait for register button to be visible
  await waitFor(element(by.id(TestIDs.auth.registerButton)))
    .toBeVisible()
    .withTimeout(5000);

  // Tap register button
  await element(by.id(TestIDs.auth.registerButton)).tap();
}

/**
 * Performs logout from the app
 */
export async function logout(): Promise<void> {
  // Navigate to profile tab
  await element(by.id(TestIDs.main.profileTab)).tap();

  // Wait for profile screen
  await waitFor(element(by.id(TestIDs.profile.profileScreen)))
    .toBeVisible()
    .withTimeout(5000);

  // Navigate to settings
  await element(by.id(TestIDs.profile.settingsButton)).tap();

  // Wait for settings screen
  await waitFor(element(by.id(TestIDs.settings.settingsScreen)))
    .toBeVisible()
    .withTimeout(5000);

  // Tap logout button
  await element(by.id(TestIDs.settings.logoutButton)).tap();

  // Confirm logout dialog
  await waitFor(element(by.id(TestIDs.dialog.confirmButton)))
    .toBeVisible()
    .withTimeout(3000);
  await element(by.id(TestIDs.dialog.confirmButton)).tap();

  // Wait for login screen
  await waitFor(element(by.id(TestIDs.auth.loginScreen)))
    .toBeVisible()
    .withTimeout(10000);
}

/**
 * Ensures the user is logged out before a test
 */
export async function ensureLoggedOut(): Promise<void> {
  // Skip onboarding if it appears
  await skipOnboardingIfVisible();

  try {
    // Check if feed tab is visible (user is logged in)
    await expect(element(by.id(TestIDs.main.feedTab))).toBeVisible();
    // If visible, logout
    await logout();
  } catch {
    // User is already logged out
  }
}

/**
 * Ensures the user is logged in before a test
 */
export async function ensureLoggedIn(): Promise<void> {
  // Skip onboarding if it appears
  await skipOnboardingIfVisible();

  try {
    // Check if feed tab is visible
    await expect(element(by.id(TestIDs.main.feedTab))).toBeVisible();
    // Already logged in
  } catch {
    // Need to login
    await login();
  }
}
