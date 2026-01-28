/**
 * Authentication E2E Tests
 *
 * Tests for the authentication flow including:
 * - User registration (FR-1, AC-1.1)
 * - Email/password login (FR-1, AC-1.2)
 * - Invalid credentials error handling
 * - Logout functionality
 *
 * Task 51: Mobile App E2E Tests
 * Requirements: FR-1 (Authentication)
 */

import { by, element, expect, device } from 'detox';
import { TestIDs } from '../testIDs';
import {
  TEST_USER,
  NEW_USER,
  INVALID_USER,
  login,
  register,
  logout,
  ensureLoggedOut,
} from '../helpers/auth';
import {
  waitForVisible,
  waitForText,
  waitAndTap,
  waitAndType,
  DEFAULT_TIMEOUT,
} from '../helpers/waitFor';

describe('Authentication Flow', () => {
  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('Login', () => {
    beforeEach(async () => {
      await ensureLoggedOut();
    });

    it('should display login screen on app launch when not authenticated', async () => {
      // Given: User is not logged in
      // Then: Login screen should be visible
      await waitForVisible(TestIDs.auth.loginScreen);
      await expect(element(by.id(TestIDs.auth.emailInput))).toBeVisible();
      await expect(element(by.id(TestIDs.auth.passwordInput))).toBeVisible();
      await expect(element(by.id(TestIDs.auth.loginButton))).toBeVisible();
    });

    it('should successfully login with valid credentials', async () => {
      // Given: User is on login screen
      await waitForVisible(TestIDs.auth.loginScreen);

      // When: User enters valid credentials and taps login
      await login(TEST_USER.email, TEST_USER.password);

      // Then: User should be navigated to main screen
      await waitForVisible(TestIDs.main.tabBar);
      await expect(element(by.id(TestIDs.main.feedTab))).toBeVisible();
    });

    it('should show error message with invalid credentials', async () => {
      // Given: User is on login screen
      await waitForVisible(TestIDs.auth.loginScreen);

      // When: User enters invalid credentials
      await waitForVisible(TestIDs.auth.emailInput);
      await element(by.id(TestIDs.auth.emailInput)).replaceText(INVALID_USER.email);
      await waitForVisible(TestIDs.auth.passwordInput);
      await element(by.id(TestIDs.auth.passwordInput)).replaceText(INVALID_USER.password);
      // Dismiss keyboard
      await element(by.id(TestIDs.auth.passwordInput)).tapReturnKey();
      await waitForVisible(TestIDs.auth.loginButton);
      await element(by.id(TestIDs.auth.loginButton)).tap();

      // Then: Error message should be displayed
      await waitForVisible(TestIDs.auth.errorAlert);
      // User should remain on login screen
      await expect(element(by.id(TestIDs.auth.loginScreen))).toBeVisible();
    });

    it('should show validation error for empty email', async () => {
      // Given: User is on login screen
      await waitForVisible(TestIDs.auth.loginScreen);

      // When: User enters only password and taps login
      await waitForVisible(TestIDs.auth.passwordInput);
      await element(by.id(TestIDs.auth.passwordInput)).replaceText(TEST_USER.password);
      // Dismiss keyboard
      await element(by.id(TestIDs.auth.passwordInput)).tapReturnKey();
      await waitForVisible(TestIDs.auth.loginButton);
      await element(by.id(TestIDs.auth.loginButton)).tap();

      // Then: Validation error should be shown
      await waitForText('Email is required', DEFAULT_TIMEOUT);
    });

    it('should show validation error for invalid email format', async () => {
      // Given: User is on login screen
      await waitForVisible(TestIDs.auth.loginScreen);

      // When: User enters invalid email format
      await waitForVisible(TestIDs.auth.emailInput);
      await element(by.id(TestIDs.auth.emailInput)).replaceText('invalidemail');
      await waitForVisible(TestIDs.auth.passwordInput);
      await element(by.id(TestIDs.auth.passwordInput)).replaceText(TEST_USER.password);
      // Dismiss keyboard
      await element(by.id(TestIDs.auth.passwordInput)).tapReturnKey();
      await waitForVisible(TestIDs.auth.loginButton);
      await element(by.id(TestIDs.auth.loginButton)).tap();

      // Then: Validation error should be shown
      await waitForText('Please enter a valid email address', DEFAULT_TIMEOUT);
    });

    it('should navigate to forgot password screen', async () => {
      // Given: User is on login screen
      await waitForVisible(TestIDs.auth.loginScreen);

      // When: User taps forgot password link
      await element(by.id(TestIDs.auth.forgotPasswordButton)).tap();

      // Then: Forgot password screen should be visible
      await waitForVisible(TestIDs.auth.forgotPasswordScreen);
    });

    it('should navigate to register screen', async () => {
      // Given: User is on login screen
      await waitForVisible(TestIDs.auth.loginScreen);

      // When: User taps create account link
      await element(by.id(TestIDs.auth.createAccountLink)).tap();

      // Then: Register screen should be visible
      await waitForVisible(TestIDs.auth.registerScreen);
    });
  });

  describe('Registration', () => {
    beforeEach(async () => {
      await ensureLoggedOut();
    });

    it('should display registration form', async () => {
      // Given: User navigates to register screen
      await waitForVisible(TestIDs.auth.loginScreen);
      await element(by.id(TestIDs.auth.createAccountLink)).tap();

      // Then: Registration form should be visible
      await waitForVisible(TestIDs.auth.registerScreen);
      await expect(element(by.id(TestIDs.auth.displayNameInput))).toBeVisible();
      await expect(element(by.id(TestIDs.auth.emailInput))).toBeVisible();
      await expect(element(by.id(TestIDs.auth.passwordInput))).toBeVisible();
      await expect(
        element(by.id(TestIDs.auth.confirmPasswordInput))
      ).toBeVisible();
      await expect(element(by.id(TestIDs.auth.registerButton))).toBeVisible();
    });

    it('should successfully register a new user', async () => {
      // Given: User is on register screen
      await waitForVisible(TestIDs.auth.loginScreen);
      await element(by.id(TestIDs.auth.createAccountLink)).tap();
      await waitForVisible(TestIDs.auth.registerScreen);

      // When: User fills in registration form and submits
      const uniqueEmail = `e2e-${Date.now()}@test.shiojiri-rainbow.app`;
      await register(NEW_USER.displayName, uniqueEmail, NEW_USER.password);

      // Then: Success message or login screen should be shown
      // (depends on if email verification is required)
      await waitForVisible(TestIDs.auth.loginScreen, 15000);
    });

    it('should show validation error for password mismatch', async () => {
      // Given: User is on register screen
      await waitForVisible(TestIDs.auth.loginScreen);
      await element(by.id(TestIDs.auth.createAccountLink)).tap();
      await waitForVisible(TestIDs.auth.registerScreen);

      // When: User enters mismatched passwords
      await waitForVisible(TestIDs.auth.displayNameInput);
      await element(by.id(TestIDs.auth.displayNameInput)).replaceText(NEW_USER.displayName);
      await waitForVisible(TestIDs.auth.emailInput);
      await element(by.id(TestIDs.auth.emailInput)).replaceText(NEW_USER.email);
      // Dismiss keyboard to allow scroll to password fields
      await element(by.id(TestIDs.auth.emailInput)).tapReturnKey();
      await waitForVisible(TestIDs.auth.passwordInput);
      await element(by.id(TestIDs.auth.passwordInput)).replaceText(NEW_USER.password);
      // Dismiss keyboard to access confirm password
      await element(by.id(TestIDs.auth.passwordInput)).tapReturnKey();
      await waitForVisible(TestIDs.auth.confirmPasswordInput);
      await element(by.id(TestIDs.auth.confirmPasswordInput)).replaceText('DifferentPassword123!');
      // Dismiss keyboard before tapping button
      await element(by.id(TestIDs.auth.confirmPasswordInput)).tapReturnKey();
      await waitForVisible(TestIDs.auth.registerButton);
      await element(by.id(TestIDs.auth.registerButton)).tap();

      // Then: Validation error should be shown
      await waitForText('Passwords do not match', DEFAULT_TIMEOUT);
    });

    it('should show validation error for short password', async () => {
      // Given: User is on register screen
      await waitForVisible(TestIDs.auth.loginScreen);
      await element(by.id(TestIDs.auth.createAccountLink)).tap();
      await waitForVisible(TestIDs.auth.registerScreen);

      // When: User enters a short password
      await waitForVisible(TestIDs.auth.displayNameInput);
      await element(by.id(TestIDs.auth.displayNameInput)).replaceText(NEW_USER.displayName);
      await waitForVisible(TestIDs.auth.emailInput);
      await element(by.id(TestIDs.auth.emailInput)).replaceText(NEW_USER.email);
      // Dismiss keyboard to allow scroll to password fields
      await element(by.id(TestIDs.auth.emailInput)).tapReturnKey();
      await waitForVisible(TestIDs.auth.passwordInput);
      await element(by.id(TestIDs.auth.passwordInput)).replaceText('short');
      // Dismiss keyboard to access confirm password
      await element(by.id(TestIDs.auth.passwordInput)).tapReturnKey();
      await waitForVisible(TestIDs.auth.confirmPasswordInput);
      await element(by.id(TestIDs.auth.confirmPasswordInput)).replaceText('short');
      // Dismiss keyboard before tapping button
      await element(by.id(TestIDs.auth.confirmPasswordInput)).tapReturnKey();
      await waitForVisible(TestIDs.auth.registerButton);
      await element(by.id(TestIDs.auth.registerButton)).tap();

      // Then: Validation error should be shown
      await waitForText('Password must be at least 8 characters', DEFAULT_TIMEOUT);
    });

    it('should navigate back to login screen', async () => {
      // Given: User is on register screen
      await waitForVisible(TestIDs.auth.loginScreen);
      await element(by.id(TestIDs.auth.createAccountLink)).tap();
      await waitForVisible(TestIDs.auth.registerScreen);

      // When: User taps back to login link
      await element(by.id(TestIDs.auth.backToLoginLink)).tap();

      // Then: Login screen should be visible
      await waitForVisible(TestIDs.auth.loginScreen);
    });
  });

  describe('Logout', () => {
    beforeEach(async () => {
      // Ensure user is logged in
      await login(TEST_USER.email, TEST_USER.password);
    });

    it('should successfully logout user', async () => {
      // Given: User is logged in and on main screen
      await waitForVisible(TestIDs.main.tabBar);

      // When: User performs logout
      await logout();

      // Then: Login screen should be visible
      await waitForVisible(TestIDs.auth.loginScreen);
    });

    it('should show confirmation dialog before logout', async () => {
      // Given: User is logged in
      await waitForVisible(TestIDs.main.tabBar);

      // When: User navigates to settings and taps logout
      await element(by.id(TestIDs.main.profileTab)).tap();
      await waitForVisible(TestIDs.profile.profileScreen);
      await element(by.id(TestIDs.profile.settingsButton)).tap();
      await waitForVisible(TestIDs.settings.settingsScreen);
      await element(by.id(TestIDs.settings.logoutButton)).tap();

      // Then: Confirmation dialog should be visible
      await waitForVisible(TestIDs.dialog.confirmButton);
      await expect(element(by.id(TestIDs.dialog.cancelButton))).toBeVisible();
    });

    it('should cancel logout when cancel is pressed', async () => {
      // Given: User is on logout confirmation dialog
      await element(by.id(TestIDs.main.profileTab)).tap();
      await waitForVisible(TestIDs.profile.profileScreen);
      await element(by.id(TestIDs.profile.settingsButton)).tap();
      await waitForVisible(TestIDs.settings.settingsScreen);
      await element(by.id(TestIDs.settings.logoutButton)).tap();
      await waitForVisible(TestIDs.dialog.confirmButton);

      // When: User taps cancel
      await element(by.id(TestIDs.dialog.cancelButton)).tap();

      // Then: User should remain logged in on settings screen
      await waitForVisible(TestIDs.settings.settingsScreen);
    });
  });
});
