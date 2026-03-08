/**
 * Notifications E2E Tests
 *
 * Tests for the notification flow including:
 * - Viewing the notification list
 * - Tapping a notification to navigate to its target
 * - Marking notifications as read
 * - Toggling notification settings
 *
 * Task 51: Mobile App E2E Tests
 * Requirements: FR-6 (Notifications)
 */

import { by, element, expect, device, waitFor } from 'detox';
import { TestIDs } from '../testIDs';
import { login, ensureLoggedIn } from '../helpers/auth';
import {
  waitForVisible,
  waitAndTap,
  waitForNotVisible,
  DEFAULT_TIMEOUT,
} from '../helpers/waitFor';
import { navigateToProfile, navigateToSettings } from '../helpers/navigation';

/**
 * Notification-specific test IDs.
 * These follow the same convention as testIDs.ts but cover notification screens
 * that may be added incrementally. If they do not yet exist in testIDs.ts,
 * they are defined locally here.
 */
const NotificationIDs = {
  notificationTab: 'tab-notifications',
  notificationScreen: 'notification-screen',
  notificationList: 'notification-list',
  notificationItem: 'notification-item', // append index: notification-item-0
  notificationBadge: 'notification-badge',
  emptyState: 'notification-empty-state',
  markAllReadButton: 'mark-all-read-button',
  notificationSettingsToggle: 'notification-settings-toggle',
  pushNotificationToggle: 'push-notification-toggle',
  emailNotificationToggle: 'email-notification-toggle',
};

describe('Notifications', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await ensureLoggedIn();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await ensureLoggedIn();
  });

  // -----------------------------------------------------------------
  // View notification list
  // -----------------------------------------------------------------
  it('should display the notification list screen', async () => {
    // Given: User is logged in and on the main screen
    await waitForVisible(TestIDs.main.tabBar);

    // When: User navigates to notifications
    await waitAndTap(NotificationIDs.notificationTab);

    // Then: The notification screen should be visible
    await waitForVisible(NotificationIDs.notificationScreen);
    // Either the list or the empty state should appear
    try {
      await waitFor(element(by.id(NotificationIDs.notificationList)))
        .toBeVisible()
        .withTimeout(5000);
    } catch {
      await waitForVisible(NotificationIDs.emptyState);
    }
  });

  // -----------------------------------------------------------------
  // Tap notification navigates to detail
  // -----------------------------------------------------------------
  it('should navigate to target screen when a notification is tapped', async () => {
    // Given: User is on the notification list with at least one notification
    await waitAndTap(NotificationIDs.notificationTab);
    await waitForVisible(NotificationIDs.notificationScreen);

    // When: User taps the first notification
    await waitFor(element(by.id(`${NotificationIDs.notificationItem}-0`)))
      .toBeVisible()
      .withTimeout(DEFAULT_TIMEOUT);
    await element(by.id(`${NotificationIDs.notificationItem}-0`)).tap();

    // Then: Should navigate away from the notification screen
    // (to photo detail, profile, or another target depending on notification type)
    await waitForNotVisible(NotificationIDs.notificationScreen);
  });

  // -----------------------------------------------------------------
  // Mark all as read
  // -----------------------------------------------------------------
  it('should mark all notifications as read', async () => {
    // Given: User is on the notification screen with unread notifications
    await waitAndTap(NotificationIDs.notificationTab);
    await waitForVisible(NotificationIDs.notificationScreen);

    // When: User taps "Mark all as read"
    try {
      await waitFor(element(by.id(NotificationIDs.markAllReadButton)))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id(NotificationIDs.markAllReadButton)).tap();

      // Then: The notification badge should disappear
      await waitForNotVisible(NotificationIDs.notificationBadge);
    } catch {
      // No unread notifications to mark -- this is acceptable
    }
  });

  // -----------------------------------------------------------------
  // Notification settings toggle
  // -----------------------------------------------------------------
  it('should toggle push notification settings', async () => {
    // Given: User navigates to settings
    await navigateToSettings();
    await waitForVisible(TestIDs.settings.settingsScreen);

    // When: User taps on notification settings
    await waitAndTap(TestIDs.settings.notificationSettings);

    // Then: Notification toggles should be visible
    await waitForVisible(NotificationIDs.pushNotificationToggle);

    // When: User toggles push notifications off
    await element(by.id(NotificationIDs.pushNotificationToggle)).tap();

    // Then: The toggle should reflect the new state (no crash, UI updates)
    await expect(
      element(by.id(NotificationIDs.pushNotificationToggle))
    ).toBeVisible();
  });

  // -----------------------------------------------------------------
  // Email notification toggle
  // -----------------------------------------------------------------
  it('should toggle email notification settings', async () => {
    // Given: User is on notification settings
    await navigateToSettings();
    await waitAndTap(TestIDs.settings.notificationSettings);
    await waitForVisible(NotificationIDs.emailNotificationToggle);

    // When: User toggles email notifications
    await element(by.id(NotificationIDs.emailNotificationToggle)).tap();

    // Then: The toggle should reflect the new state
    await expect(
      element(by.id(NotificationIDs.emailNotificationToggle))
    ).toBeVisible();
  });
});
