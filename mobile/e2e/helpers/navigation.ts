/**
 * Navigation Helpers for E2E Tests
 *
 * Provides reusable navigation functions for E2E test scenarios
 *
 * Task 51: Mobile App E2E Tests
 */

import { by, element, waitFor } from 'detox';
import { TestIDs } from '../testIDs';

/**
 * Tab names in the main navigation
 */
export type TabName = 'feed' | 'camera' | 'map' | 'profile';

/**
 * Navigates to a specific tab in the main tab bar
 *
 * @param tab - The tab to navigate to
 */
export async function navigateToTab(tab: TabName): Promise<void> {
  const tabId = {
    feed: TestIDs.main.feedTab,
    camera: TestIDs.main.cameraTab,
    map: TestIDs.main.mapTab,
    profile: TestIDs.main.profileTab,
  }[tab];

  await waitFor(element(by.id(TestIDs.main.tabBar)))
    .toBeVisible()
    .withTimeout(10000);

  await element(by.id(tabId)).tap();
}

/**
 * Navigates to the feed screen
 */
export async function navigateToFeed(): Promise<void> {
  await navigateToTab('feed');
  await waitFor(element(by.id(TestIDs.feed.feedScreen)))
    .toBeVisible()
    .withTimeout(5000);
}

/**
 * Navigates to the camera screen
 */
export async function navigateToCamera(): Promise<void> {
  await navigateToTab('camera');
  await waitFor(element(by.id(TestIDs.camera.cameraScreen)))
    .toBeVisible()
    .withTimeout(5000);
}

/**
 * Navigates to the map screen
 */
export async function navigateToMap(): Promise<void> {
  await navigateToTab('map');
  await waitFor(element(by.id(TestIDs.map.mapScreen)))
    .toBeVisible()
    .withTimeout(5000);
}

/**
 * Navigates to the profile screen
 */
export async function navigateToProfile(): Promise<void> {
  await navigateToTab('profile');
  await waitFor(element(by.id(TestIDs.profile.profileScreen)))
    .toBeVisible()
    .withTimeout(5000);
}

/**
 * Navigates to the settings screen from profile
 */
export async function navigateToSettings(): Promise<void> {
  await navigateToProfile();
  await element(by.id(TestIDs.profile.settingsButton)).tap();
  await waitFor(element(by.id(TestIDs.settings.settingsScreen)))
    .toBeVisible()
    .withTimeout(5000);
}

/**
 * Navigates to the edit profile screen from profile
 */
export async function navigateToEditProfile(): Promise<void> {
  await navigateToProfile();
  await element(by.id(TestIDs.profile.editProfileButton)).tap();
  await waitFor(element(by.id(TestIDs.profile.editProfileScreen)))
    .toBeVisible()
    .withTimeout(5000);
}

/**
 * Opens photo detail from feed
 *
 * @param index - The index of the photo in the feed (0-based)
 */
export async function openPhotoDetail(index: number = 0): Promise<void> {
  await navigateToFeed();

  // Wait for feed to load
  await waitFor(element(by.id(TestIDs.feed.photoList)))
    .toBeVisible()
    .withTimeout(10000);

  // Tap on the photo at the specified index
  await element(by.id(`${TestIDs.feed.photoItem}-${index}`)).tap();

  // Wait for photo detail screen
  await waitFor(element(by.id(TestIDs.photo.photoDetailScreen)))
    .toBeVisible()
    .withTimeout(5000);
}

/**
 * Goes back to the previous screen
 */
export async function goBack(): Promise<void> {
  await element(by.id(TestIDs.common.backButton)).tap();
}

/**
 * Scrolls down in a scrollable view
 *
 * @param scrollViewId - The testID of the scrollable view
 * @param distance - Distance to scroll in pixels
 */
export async function scrollDown(
  scrollViewId: string,
  distance: number = 200
): Promise<void> {
  await element(by.id(scrollViewId)).scroll(distance, 'down');
}

/**
 * Scrolls up in a scrollable view
 *
 * @param scrollViewId - The testID of the scrollable view
 * @param distance - Distance to scroll in pixels
 */
export async function scrollUp(
  scrollViewId: string,
  distance: number = 200
): Promise<void> {
  await element(by.id(scrollViewId)).scroll(distance, 'up');
}

/**
 * Pulls to refresh on a scrollable view
 *
 * @param scrollViewId - The testID of the scrollable view
 */
export async function pullToRefresh(scrollViewId: string): Promise<void> {
  await element(by.id(scrollViewId)).scroll(500, 'down', NaN, 0.5);
}
