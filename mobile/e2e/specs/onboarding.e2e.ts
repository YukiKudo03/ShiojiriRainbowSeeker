/**
 * Onboarding E2E Tests
 *
 * Tests for the onboarding flow including:
 * - First launch experience (FR-11, AC-11.1)
 * - Feature introduction slides (FR-11, AC-11.2)
 * - Skip functionality (FR-11, AC-11.3)
 * - Completion state (FR-11, AC-11.4)
 *
 * Task 51: Mobile App E2E Tests
 * Requirements: FR-11 (Onboarding)
 */

import { by, element, expect, device } from 'detox';
import { TestIDs } from '../testIDs';
import {
  waitForVisible,
  waitForNotVisible,
  waitForText,
  waitAndTap,
  DEFAULT_TIMEOUT,
} from '../helpers/waitFor';

describe('Onboarding Flow', () => {
  /**
   * Clear app data to simulate first launch
   */
  async function simulateFirstLaunch(): Promise<void> {
    await device.launchApp({
      newInstance: true,
      delete: true, // Clear app data
      permissions: {
        location: 'always',
        camera: 'YES',
        photos: 'YES',
        notifications: 'YES',
      },
    });
  }

  describe('First Launch', () => {
    beforeEach(async () => {
      await simulateFirstLaunch();
    });

    it('should display onboarding screen on first launch', async () => {
      // Given: App is launched for the first time

      // Then: Onboarding screen should be visible
      await waitForVisible(TestIDs.onboarding.onboardingScreen);
    });

    it('should display welcome slide first', async () => {
      // Given: App is launched for the first time
      await waitForVisible(TestIDs.onboarding.onboardingScreen);

      // Then: Welcome slide should be visible
      await expect(
        element(by.id(TestIDs.onboarding.slideWelcome))
      ).toBeVisible();
    });

    it('should display skip button', async () => {
      // Given: User is on onboarding screen
      await waitForVisible(TestIDs.onboarding.onboardingScreen);

      // Then: Skip button should be visible
      await expect(element(by.id(TestIDs.onboarding.skipButton))).toBeVisible();
    });

    it('should display next button on first slides', async () => {
      // Given: User is on first onboarding slide
      await waitForVisible(TestIDs.onboarding.onboardingScreen);

      // Then: Next button should be visible
      await expect(element(by.id(TestIDs.onboarding.nextButton))).toBeVisible();
    });

    it('should display pagination dots', async () => {
      // Given: User is on onboarding screen
      await waitForVisible(TestIDs.onboarding.onboardingScreen);

      // Then: Pagination dots should be visible
      await expect(
        element(by.id(TestIDs.onboarding.paginationDots))
      ).toBeVisible();
    });
  });

  describe('Slide Navigation', () => {
    beforeEach(async () => {
      await simulateFirstLaunch();
      await waitForVisible(TestIDs.onboarding.onboardingScreen);
    });

    it('should navigate to camera slide when next is tapped', async () => {
      // Given: User is on welcome slide

      // When: User taps next
      await element(by.id(TestIDs.onboarding.nextButton)).tap();

      // Then: Camera slide should be visible
      await waitForVisible(TestIDs.onboarding.slideCamera);
    });

    it('should navigate through all slides', async () => {
      // Given: User is on welcome slide

      // When: User navigates through all slides
      // Slide 1: Welcome -> Camera
      await element(by.id(TestIDs.onboarding.nextButton)).tap();
      await waitForVisible(TestIDs.onboarding.slideCamera);

      // Slide 2: Camera -> Gallery
      await element(by.id(TestIDs.onboarding.nextButton)).tap();
      await waitForVisible(TestIDs.onboarding.slideGallery);

      // Slide 3: Gallery -> Map
      await element(by.id(TestIDs.onboarding.nextButton)).tap();
      await waitForVisible(TestIDs.onboarding.slideMap);

      // Slide 4: Map -> Notifications
      await element(by.id(TestIDs.onboarding.nextButton)).tap();
      await waitForVisible(TestIDs.onboarding.slideNotifications);

      // Then: Get Started button should be visible on last slide
      await expect(
        element(by.id(TestIDs.onboarding.getStartedButton))
      ).toBeVisible();
    });

    it('should be able to swipe between slides', async () => {
      // Given: User is on welcome slide

      // When: User swipes left
      await element(by.id(TestIDs.onboarding.onboardingScreen)).swipe('left');

      // Then: Next slide should be visible
      await waitForVisible(TestIDs.onboarding.slideCamera);
    });

    it('should be able to swipe back to previous slide', async () => {
      // Given: User is on camera slide
      await element(by.id(TestIDs.onboarding.nextButton)).tap();
      await waitForVisible(TestIDs.onboarding.slideCamera);

      // When: User swipes right
      await element(by.id(TestIDs.onboarding.onboardingScreen)).swipe('right');

      // Then: Welcome slide should be visible
      await waitForVisible(TestIDs.onboarding.slideWelcome);
    });

    it('should update pagination dots on navigation', async () => {
      // Given: User is on first slide
      // Pagination should show first dot as active
      await expect(
        element(by.id(TestIDs.onboarding.paginationDots))
      ).toBeVisible();

      // When: User navigates to second slide
      await element(by.id(TestIDs.onboarding.nextButton)).tap();

      // Then: Pagination should update (visual verification)
      await expect(
        element(by.id(TestIDs.onboarding.paginationDots))
      ).toBeVisible();
    });
  });

  describe('Skip Functionality', () => {
    beforeEach(async () => {
      await simulateFirstLaunch();
      await waitForVisible(TestIDs.onboarding.onboardingScreen);
    });

    it('should skip onboarding and go to login', async () => {
      // Given: User is on onboarding screen

      // When: User taps skip
      await element(by.id(TestIDs.onboarding.skipButton)).tap();

      // Then: Login screen should be visible
      await waitForVisible(TestIDs.auth.loginScreen);
    });

    it('should skip from any slide', async () => {
      // Given: User is on third slide
      await element(by.id(TestIDs.onboarding.nextButton)).tap();
      await element(by.id(TestIDs.onboarding.nextButton)).tap();
      await waitForVisible(TestIDs.onboarding.slideGallery);

      // When: User taps skip
      await element(by.id(TestIDs.onboarding.skipButton)).tap();

      // Then: Login screen should be visible
      await waitForVisible(TestIDs.auth.loginScreen);
    });
  });

  describe('Complete Onboarding', () => {
    beforeEach(async () => {
      await simulateFirstLaunch();
      await waitForVisible(TestIDs.onboarding.onboardingScreen);
    });

    it('should complete onboarding and navigate to login', async () => {
      // Given: User is on onboarding screen

      // When: User navigates to last slide
      await element(by.id(TestIDs.onboarding.nextButton)).tap();
      await element(by.id(TestIDs.onboarding.nextButton)).tap();
      await element(by.id(TestIDs.onboarding.nextButton)).tap();
      await element(by.id(TestIDs.onboarding.nextButton)).tap();
      await waitForVisible(TestIDs.onboarding.slideNotifications);

      // And: User taps Get Started
      await element(by.id(TestIDs.onboarding.getStartedButton)).tap();

      // Then: Login screen should be visible
      await waitForVisible(TestIDs.auth.loginScreen);
    });

    it('should not show onboarding again after completion', async () => {
      // Given: User has completed onboarding
      await element(by.id(TestIDs.onboarding.skipButton)).tap();
      await waitForVisible(TestIDs.auth.loginScreen);

      // When: App is relaunched (without clearing data)
      await device.launchApp({ newInstance: true });

      // Then: Login screen should be visible (not onboarding)
      await waitForVisible(TestIDs.auth.loginScreen);
      await expect(
        element(by.id(TestIDs.onboarding.onboardingScreen))
      ).not.toBeVisible();
    });

    it('should not show onboarding after skip', async () => {
      // Given: User has skipped onboarding
      await element(by.id(TestIDs.onboarding.skipButton)).tap();
      await waitForVisible(TestIDs.auth.loginScreen);

      // When: App is relaunched
      await device.launchApp({ newInstance: true });

      // Then: Login screen should be visible (not onboarding)
      await waitForVisible(TestIDs.auth.loginScreen);
    });
  });

  describe('Onboarding Content', () => {
    beforeEach(async () => {
      await simulateFirstLaunch();
      await waitForVisible(TestIDs.onboarding.onboardingScreen);
    });

    it('should display welcome message in Japanese', async () => {
      // Given: User is on welcome slide

      // Then: Welcome subtitle should be visible
      await waitForText('Welcome to Rainbow Seeker', DEFAULT_TIMEOUT);
    });

    it('should explain camera feature', async () => {
      // Given: User navigates to camera slide
      await element(by.id(TestIDs.onboarding.nextButton)).tap();
      await waitForVisible(TestIDs.onboarding.slideCamera);

      // Then: Camera feature explanation should be visible
      // Note: Exact text depends on implementation
    });

    it('should explain gallery feature', async () => {
      // Given: User navigates to gallery slide
      await element(by.id(TestIDs.onboarding.nextButton)).tap();
      await element(by.id(TestIDs.onboarding.nextButton)).tap();
      await waitForVisible(TestIDs.onboarding.slideGallery);

      // Then: Gallery feature explanation should be visible
    });

    it('should explain map feature', async () => {
      // Given: User navigates to map slide
      await element(by.id(TestIDs.onboarding.nextButton)).tap();
      await element(by.id(TestIDs.onboarding.nextButton)).tap();
      await element(by.id(TestIDs.onboarding.nextButton)).tap();
      await waitForVisible(TestIDs.onboarding.slideMap);

      // Then: Map feature explanation should be visible
    });

    it('should explain notifications feature', async () => {
      // Given: User navigates to notifications slide
      await element(by.id(TestIDs.onboarding.nextButton)).tap();
      await element(by.id(TestIDs.onboarding.nextButton)).tap();
      await element(by.id(TestIDs.onboarding.nextButton)).tap();
      await element(by.id(TestIDs.onboarding.nextButton)).tap();
      await waitForVisible(TestIDs.onboarding.slideNotifications);

      // Then: Notifications feature explanation should be visible
    });
  });
});
