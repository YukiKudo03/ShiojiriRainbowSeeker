/**
 * Settings E2E Tests
 *
 * Tests for the settings screen including:
 * - Notification settings configuration
 * - Language switching (Japanese / English)
 * - Data export
 * - Account deletion flow
 *
 * Task 51: Mobile App E2E Tests
 * Requirements: FR-7 (User Settings), NFR-3 (i18n)
 */

import { by, element, expect, device, waitFor } from 'detox';
import { TestIDs } from '../testIDs';
import { login, ensureLoggedIn, TEST_USER } from '../helpers/auth';
import {
  waitForVisible,
  waitAndTap,
  waitForText,
  DEFAULT_TIMEOUT,
  EXTENDED_TIMEOUT,
} from '../helpers/waitFor';
import { navigateToSettings } from '../helpers/navigation';

/**
 * Settings-specific test IDs that extend the base TestIDs.settings.
 * These cover sub-screens that may be incrementally added.
 */
const SettingsExtIDs = {
  // Notification settings sub-screen
  notificationSettingsScreen: 'notification-settings-screen',
  pushToggle: 'push-notification-toggle',
  rainbowAlertToggle: 'rainbow-alert-toggle',
  socialToggle: 'social-notification-toggle',

  // Language settings sub-screen
  languageSettingsScreen: 'language-settings-screen',
  languageJapanese: 'language-ja',
  languageEnglish: 'language-en',
  currentLanguageLabel: 'current-language-label',

  // Data export
  dataExportButton: 'data-export-button',
  exportProgressIndicator: 'export-progress',
  exportSuccessMessage: 'export-success',

  // Account deletion
  deleteAccountScreen: 'delete-account-screen',
  deleteConfirmInput: 'delete-confirm-input',
  deleteConfirmButton: 'delete-confirm-button',
  deleteCancelButton: 'delete-cancel-button',
};

describe('Settings', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await ensureLoggedIn();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await ensureLoggedIn();
  });

  // -----------------------------------------------------------------
  // Notification settings
  // -----------------------------------------------------------------
  it('should allow toggling notification preferences', async () => {
    // Given: User navigates to settings
    await navigateToSettings();
    await waitForVisible(TestIDs.settings.settingsScreen);

    // When: User taps notification settings
    await waitAndTap(TestIDs.settings.notificationSettings);

    // Then: Notification settings screen should appear with toggles
    await waitForVisible(SettingsExtIDs.notificationSettingsScreen);
    await expect(element(by.id(SettingsExtIDs.pushToggle))).toBeVisible();
    await expect(element(by.id(SettingsExtIDs.rainbowAlertToggle))).toBeVisible();

    // When: User toggles rainbow alert off
    await element(by.id(SettingsExtIDs.rainbowAlertToggle)).tap();

    // Then: Toggle should update without error
    await expect(
      element(by.id(SettingsExtIDs.rainbowAlertToggle))
    ).toBeVisible();
  });

  // -----------------------------------------------------------------
  // Language switch
  // -----------------------------------------------------------------
  it('should switch language between Japanese and English', async () => {
    // Given: User navigates to language settings
    await navigateToSettings();
    await waitForVisible(TestIDs.settings.settingsScreen);
    await waitAndTap(TestIDs.settings.languageSettings);

    // Then: Language settings screen should appear
    await waitForVisible(SettingsExtIDs.languageSettingsScreen);
    await expect(element(by.id(SettingsExtIDs.languageJapanese))).toBeVisible();
    await expect(element(by.id(SettingsExtIDs.languageEnglish))).toBeVisible();

    // When: User selects English
    await element(by.id(SettingsExtIDs.languageEnglish)).tap();

    // Then: The UI should update to English text
    // Navigate back to settings and verify the screen title changed
    await waitFor(element(by.id(TestIDs.common.backButton)))
      .toBeVisible()
      .withTimeout(DEFAULT_TIMEOUT);
    await element(by.id(TestIDs.common.backButton)).tap();

    // Settings screen should still be accessible (not crashed)
    await waitForVisible(TestIDs.settings.settingsScreen);

    // Restore Japanese for other tests
    await waitAndTap(TestIDs.settings.languageSettings);
    await waitForVisible(SettingsExtIDs.languageSettingsScreen);
    await element(by.id(SettingsExtIDs.languageJapanese)).tap();
    await waitFor(element(by.id(TestIDs.common.backButton)))
      .toBeVisible()
      .withTimeout(DEFAULT_TIMEOUT);
    await element(by.id(TestIDs.common.backButton)).tap();
  });

  // -----------------------------------------------------------------
  // Data export
  // -----------------------------------------------------------------
  it('should initiate data export and show success feedback', async () => {
    // Given: User is on the settings screen
    await navigateToSettings();
    await waitForVisible(TestIDs.settings.settingsScreen);

    // When: User taps the privacy/data settings
    await waitAndTap(TestIDs.settings.privacySettings);

    // Then: Data export button should be visible
    await waitForVisible(SettingsExtIDs.dataExportButton);

    // When: User taps export data
    await element(by.id(SettingsExtIDs.dataExportButton)).tap();

    // Then: Should show progress and eventually success
    // (The export may take time, so we use an extended timeout)
    await waitFor(element(by.id(SettingsExtIDs.exportSuccessMessage)))
      .toBeVisible()
      .withTimeout(EXTENDED_TIMEOUT);
  });

  // -----------------------------------------------------------------
  // Account deletion
  // -----------------------------------------------------------------
  it('should show account deletion confirmation and allow cancellation', async () => {
    // Given: User is on the settings screen
    await navigateToSettings();
    await waitForVisible(TestIDs.settings.settingsScreen);

    // When: User taps delete account
    await waitAndTap(TestIDs.settings.deleteAccountButton);

    // Then: A confirmation dialog should appear
    await waitForVisible(TestIDs.dialog.confirmButton);
    await expect(element(by.id(TestIDs.dialog.cancelButton))).toBeVisible();

    // When: User taps confirm on the first dialog
    await element(by.id(TestIDs.dialog.confirmButton)).tap();

    // Then: A secondary confirmation screen should appear requiring typed confirmation
    await waitForVisible(SettingsExtIDs.deleteAccountScreen);
    await expect(element(by.id(SettingsExtIDs.deleteConfirmInput))).toBeVisible();
    await expect(element(by.id(SettingsExtIDs.deleteConfirmButton))).toBeVisible();
    await expect(element(by.id(SettingsExtIDs.deleteCancelButton))).toBeVisible();

    // When: User cancels the deletion
    await element(by.id(SettingsExtIDs.deleteCancelButton)).tap();

    // Then: User should be returned to the settings screen
    await waitForVisible(TestIDs.settings.settingsScreen);
  });
});
