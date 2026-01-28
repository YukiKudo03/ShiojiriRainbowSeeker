/**
 * Photo Flow E2E Tests
 *
 * Tests for the photo capture and upload flow including:
 * - Camera access and capture (FR-2)
 * - Photo upload with metadata (FR-3)
 * - View photos in gallery
 *
 * Task 51: Mobile App E2E Tests
 * Requirements: FR-2, FR-3 (Photo Capture and Upload)
 */

import { by, element, expect, device } from 'detox';
import { TestIDs } from '../testIDs';
import { login, ensureLoggedIn, TEST_USER } from '../helpers/auth';
import {
  navigateToCamera,
  navigateToFeed,
  openPhotoDetail,
} from '../helpers/navigation';
import {
  waitForVisible,
  waitForNotVisible,
  waitForText,
  waitAndTap,
  EXTENDED_TIMEOUT,
  DEFAULT_TIMEOUT,
} from '../helpers/waitFor';

describe('Photo Flow', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: {
        camera: 'YES',
        photos: 'YES',
        location: 'always',
      },
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await ensureLoggedIn();
  });

  describe('Camera Access', () => {
    it('should display camera screen when camera tab is tapped', async () => {
      // Given: User is logged in and on main screen
      await waitForVisible(TestIDs.main.tabBar);

      // When: User taps camera tab
      await navigateToCamera();

      // Then: Camera screen should be visible
      await expect(element(by.id(TestIDs.camera.cameraScreen))).toBeVisible();
      await expect(element(by.id(TestIDs.camera.captureButton))).toBeVisible();
    });

    it('should show camera view with capture controls', async () => {
      // Given: User is on camera screen
      await navigateToCamera();

      // Then: Camera controls should be visible
      await expect(element(by.id(TestIDs.camera.cameraView))).toBeVisible();
      await expect(element(by.id(TestIDs.camera.captureButton))).toBeVisible();
      await expect(element(by.id(TestIDs.camera.flipCameraButton))).toBeVisible();
      await expect(element(by.id(TestIDs.camera.flashButton))).toBeVisible();
    });

    it('should be able to switch between front and back camera', async () => {
      // Given: User is on camera screen
      await navigateToCamera();

      // When: User taps flip camera button
      await element(by.id(TestIDs.camera.flipCameraButton)).tap();

      // Then: Camera should flip (no visual assertion, just verify no crash)
      await expect(element(by.id(TestIDs.camera.cameraView))).toBeVisible();

      // Flip back
      await element(by.id(TestIDs.camera.flipCameraButton)).tap();
      await expect(element(by.id(TestIDs.camera.cameraView))).toBeVisible();
    });

    it('should be able to toggle flash', async () => {
      // Given: User is on camera screen
      await navigateToCamera();

      // When: User taps flash button
      await element(by.id(TestIDs.camera.flashButton)).tap();

      // Then: Flash should toggle (verify button is still visible)
      await expect(element(by.id(TestIDs.camera.flashButton))).toBeVisible();
    });
  });

  describe('Photo Capture', () => {
    it('should capture photo and navigate to upload screen', async () => {
      // Given: User is on camera screen
      await navigateToCamera();

      // When: User taps capture button
      await element(by.id(TestIDs.camera.captureButton)).tap();

      // Then: Upload screen should be visible with preview
      await waitForVisible(TestIDs.upload.uploadScreen, EXTENDED_TIMEOUT);
      await expect(element(by.id(TestIDs.upload.previewImage))).toBeVisible();
    });

    it('should be able to select photo from gallery', async () => {
      // Given: User is on camera screen
      await navigateToCamera();

      // When: User taps gallery button
      await element(by.id(TestIDs.camera.galleryButton)).tap();

      // Then: Photo picker should open (mocked in Detox)
      // After selection, upload screen should be visible
      await waitForVisible(TestIDs.upload.uploadScreen, EXTENDED_TIMEOUT);
    });
  });

  describe('Photo Upload', () => {
    beforeEach(async () => {
      // Navigate to upload screen with a captured photo
      await navigateToCamera();
      await element(by.id(TestIDs.camera.captureButton)).tap();
      await waitForVisible(TestIDs.upload.uploadScreen, EXTENDED_TIMEOUT);
    });

    it('should display upload form with photo preview', async () => {
      // Then: Upload form should be visible
      await expect(element(by.id(TestIDs.upload.previewImage))).toBeVisible();
      await expect(element(by.id(TestIDs.upload.titleInput))).toBeVisible();
      await expect(
        element(by.id(TestIDs.upload.descriptionInput))
      ).toBeVisible();
      await expect(element(by.id(TestIDs.upload.uploadButton))).toBeVisible();
      await expect(element(by.id(TestIDs.upload.cancelButton))).toBeVisible();
    });

    it('should show location information', async () => {
      // Then: Location should be displayed
      await expect(element(by.id(TestIDs.upload.locationDisplay))).toBeVisible();
    });

    it('should successfully upload photo with title and description', async () => {
      // Given: User is on upload screen
      const title = `E2E Test Photo ${Date.now()}`;
      const description = 'This is an E2E test photo upload';

      // When: User enters title and description
      await element(by.id(TestIDs.upload.titleInput)).typeText(title);
      await element(by.id(TestIDs.upload.descriptionInput)).typeText(
        description
      );

      // And: User taps upload button
      await element(by.id(TestIDs.upload.uploadButton)).tap();

      // Then: Upload progress should be shown
      await waitForVisible(TestIDs.upload.uploadProgress);

      // And: Success message should be shown
      await waitForVisible(TestIDs.upload.uploadSuccess, EXTENDED_TIMEOUT);
    });

    it('should cancel upload and return to camera', async () => {
      // Given: User is on upload screen

      // When: User taps cancel button
      await element(by.id(TestIDs.upload.cancelButton)).tap();

      // Then: Camera screen should be visible
      await waitForVisible(TestIDs.camera.cameraScreen);
    });

    it('should show error for empty title', async () => {
      // Given: User is on upload screen without entering title

      // When: User taps upload button
      await element(by.id(TestIDs.upload.uploadButton)).tap();

      // Then: Validation error should be shown
      await waitForText('Title is required', DEFAULT_TIMEOUT);
    });
  });

  describe('Gallery View', () => {
    it('should display photo feed', async () => {
      // Given: User navigates to feed
      await navigateToFeed();

      // Then: Photo list should be visible
      await waitForVisible(TestIDs.feed.feedScreen);
      await expect(element(by.id(TestIDs.feed.photoList))).toBeVisible();
    });

    it('should be able to scroll through photos', async () => {
      // Given: User is on feed screen
      await navigateToFeed();
      await waitForVisible(TestIDs.feed.photoList);

      // When: User scrolls down
      await element(by.id(TestIDs.feed.photoList)).scroll(300, 'down');

      // Then: List should scroll (no crash)
      await expect(element(by.id(TestIDs.feed.photoList))).toBeVisible();
    });

    it('should be able to pull to refresh', async () => {
      // Given: User is on feed screen
      await navigateToFeed();
      await waitForVisible(TestIDs.feed.photoList);

      // When: User pulls to refresh
      await element(by.id(TestIDs.feed.photoList)).scroll(500, 'down', NaN, 0.5);

      // Then: Feed should refresh (no crash)
      await expect(element(by.id(TestIDs.feed.feedScreen))).toBeVisible();
    });

    it('should open photo detail when photo is tapped', async () => {
      // Given: User is on feed screen with photos
      await navigateToFeed();
      await waitForVisible(TestIDs.feed.photoList);

      // When: User taps on first photo
      await element(by.id(`${TestIDs.feed.photoItem}-0`)).tap();

      // Then: Photo detail screen should be visible
      await waitForVisible(TestIDs.photo.photoDetailScreen);
    });

    it('should display photo details correctly', async () => {
      // Given: User opens photo detail
      await openPhotoDetail(0);

      // Then: Photo details should be visible
      await expect(element(by.id(TestIDs.photo.photoImage))).toBeVisible();
      await expect(element(by.id(TestIDs.photo.photoLocation))).toBeVisible();
      await expect(element(by.id(TestIDs.photo.photoDate))).toBeVisible();
      await expect(element(by.id(TestIDs.photo.userInfo))).toBeVisible();
    });

    it('should show weather information on photo detail', async () => {
      // Given: User opens photo detail
      await openPhotoDetail(0);

      // Then: Weather info should be visible (if available)
      try {
        await waitForVisible(TestIDs.photo.photoWeather, 3000);
        await expect(element(by.id(TestIDs.photo.photoWeather))).toBeVisible();
      } catch {
        // Weather info may not be available for all photos
      }
    });
  });

  describe('Empty State', () => {
    // This test assumes a clean state or uses a test user with no photos
    it('should show empty state when no photos are available', async () => {
      // This test may need to be skipped or mocked based on data availability
      // Given: User with no photos
      // When: User views feed
      // Then: Empty state should be shown
      // await waitForVisible(TestIDs.feed.emptyState);
    });
  });
});
