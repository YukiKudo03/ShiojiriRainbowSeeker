/**
 * Photo Endpoints Load Test
 *
 * Tests the photo API endpoints:
 * - GET /api/v1/photos - List photos with filters
 * - GET /api/v1/photos/:id - Show photo details
 * - POST /api/v1/photos - Create new photo (upload)
 * - PATCH /api/v1/photos/:id - Update photo metadata
 * - DELETE /api/v1/photos/:id - Delete photo
 * - GET /api/v1/photos/:id/weather - Get weather data
 *
 * NFR-2 Compliance:
 * - p95 response time < 200ms (standard endpoints)
 * - Image upload < 3 seconds
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { SharedArray } from "k6/data";
import { apiUrl, defaultHeaders, thresholds, photoUploadThresholds } from "../helpers/config.js";
import { loginTestUser, getAuthHeaders, authHeaders } from "../helpers/auth.js";
import {
  checkApiResponse,
  checkListResponse,
  checkDetailResponse,
  checkCreateResponse,
} from "../helpers/checks.js";

// Custom metrics for photo operations
const photoListSuccessRate = new Rate("photo_list_success");
const photoListDuration = new Trend("photo_list_duration");
const photoDetailSuccessRate = new Rate("photo_detail_success");
const photoDetailDuration = new Trend("photo_detail_duration");
const photoUploadSuccessRate = new Rate("photo_upload_success");
const photoUploadDuration = new Trend("photo_upload_duration");
const photoUpdateSuccessRate = new Rate("photo_update_success");
const photoDeleteSuccessRate = new Rate("photo_delete_success");
const photoWeatherSuccessRate = new Rate("photo_weather_success");

// Test configuration
export const options = {
  scenarios: {
    photo_browse: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 50 },
        { duration: "2m", target: 100 },
        { duration: "1m", target: 100 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "30s",
      exec: "browsePhotos",
    },
    photo_upload: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 10 },
        { duration: "2m", target: 20 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "30s",
      exec: "uploadPhotos",
      startTime: "30s", // Start after browse scenario warms up
    },
  },
  thresholds: {
    ...thresholds,
    ...photoUploadThresholds,
    photo_list_success: ["rate>0.95"],
    photo_list_duration: ["p(95)<200"],
    photo_detail_success: ["rate>0.95"],
    photo_detail_duration: ["p(95)<200"],
    photo_upload_success: ["rate>0.90"],
    photo_upload_duration: ["p(95)<3000"], // 3 second threshold for uploads
    photo_update_success: ["rate>0.95"],
    photo_delete_success: ["rate>0.95"],
    photo_weather_success: ["rate>0.95"],
  },
};

// Sample photo IDs for testing (would be populated from setup in real scenario)
let samplePhotoIds = [];

// Setup function
export function setup() {
  console.log("Setting up photo load test...");

  // Login and fetch some photo IDs for detail/update/delete tests
  const tokens = loginTestUser("standard");
  if (tokens) {
    const response = http.get(apiUrl("/photos?limit=100"), {
      headers: authHeaders(tokens.accessToken),
    });

    if (response.status === 200) {
      try {
        const body = JSON.parse(response.body);
        const photos = body.data || body.photos || body;
        if (Array.isArray(photos)) {
          samplePhotoIds = photos.slice(0, 50).map((p) => p.id);
        }
      } catch (e) {
        console.warn("Could not parse photo list for setup");
      }
    }
  }

  return {
    testStartTime: new Date().toISOString(),
    photoIds: samplePhotoIds,
  };
}

/**
 * Browse photos scenario - simulates users browsing the gallery
 */
export function browsePhotos(data) {
  const tokens = loginTestUser("standard");
  if (!tokens) {
    console.error("Failed to authenticate for browse scenario");
    return;
  }

  const headers = authHeaders(tokens.accessToken);
  const photoIds = data.photoIds || [];

  group("Photo Browsing", function () {
    // List photos with various filters
    group("List Photos", function () {
      testListPhotos(headers);
      sleep(0.5);
      testListPhotosWithFilters(headers);
    });

    sleep(1);

    // View photo details
    if (photoIds.length > 0) {
      group("View Photo Details", function () {
        const randomId = photoIds[Math.floor(Math.random() * photoIds.length)];
        testPhotoDetail(headers, randomId);
        sleep(0.5);
        testPhotoWeather(headers, randomId);
      });
    }
  });

  sleep(Math.random() * 2 + 1);
}

/**
 * Upload photos scenario - simulates users uploading photos
 */
export function uploadPhotos() {
  const tokens = loginTestUser("standard");
  if (!tokens) {
    console.error("Failed to authenticate for upload scenario");
    return;
  }

  const headers = authHeaders(tokens.accessToken);

  group("Photo Upload", function () {
    const photoId = testPhotoUpload(headers);

    if (photoId) {
      sleep(1);

      // Update the uploaded photo
      group("Update Photo", function () {
        testPhotoUpdate(headers, photoId);
      });

      sleep(1);

      // Delete the uploaded photo (cleanup)
      group("Delete Photo", function () {
        testPhotoDelete(headers, photoId);
      });
    }
  });

  sleep(Math.random() * 3 + 2);
}

/**
 * Test listing photos
 */
function testListPhotos(headers) {
  const startTime = new Date().getTime();

  const response = http.get(apiUrl("/photos"), {
    headers: headers,
    tags: { name: "photo_list" },
  });

  const duration = new Date().getTime() - startTime;
  photoListDuration.add(duration);

  const success = check(response, {
    "photo list status is 200": (r) => r.status === 200,
    "photo list is valid JSON": (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
    "photo list response time < 200ms": (r) => r.timings.duration < 200,
  });

  photoListSuccessRate.add(success);
  return success;
}

/**
 * Test listing photos with various filters
 */
function testListPhotosWithFilters(headers) {
  // Test different filter combinations
  const filters = [
    "?page=1&per_page=20",
    "?rainbow_type=full",
    "?sort_by=created_at&order=desc",
    "?lat=35.9&lng=138.1&radius=10", // Near Shiojiri
  ];

  const filter = filters[Math.floor(Math.random() * filters.length)];

  const response = http.get(apiUrl(`/photos${filter}`), {
    headers: headers,
    tags: { name: "photo_list_filtered" },
  });

  const success = check(response, {
    "filtered photo list status is 200": (r) => r.status === 200,
    "filtered photo list response time < 200ms": (r) => r.timings.duration < 200,
  });

  photoListSuccessRate.add(success);
  return success;
}

/**
 * Test photo detail endpoint
 */
function testPhotoDetail(headers, photoId) {
  const startTime = new Date().getTime();

  const response = http.get(apiUrl(`/photos/${photoId}`), {
    headers: headers,
    tags: { name: "photo_detail" },
  });

  const duration = new Date().getTime() - startTime;
  photoDetailDuration.add(duration);

  const success = check(response, {
    "photo detail status is 200": (r) => r.status === 200,
    "photo detail has id": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.id || (body.data && body.data.id);
      } catch {
        return false;
      }
    },
    "photo detail response time < 200ms": (r) => r.timings.duration < 200,
  });

  photoDetailSuccessRate.add(success);
  return success;
}

/**
 * Test photo weather endpoint
 */
function testPhotoWeather(headers, photoId) {
  const response = http.get(apiUrl(`/photos/${photoId}/weather`), {
    headers: headers,
    tags: { name: "photo_weather" },
  });

  const success = check(response, {
    "photo weather status is 200": (r) => r.status === 200,
    "photo weather response time < 200ms": (r) => r.timings.duration < 200,
  });

  photoWeatherSuccessRate.add(success);
  return success;
}

/**
 * Test photo upload
 * Note: This simulates upload with metadata only for load testing.
 * Actual file upload would require multipart form data.
 */
function testPhotoUpload(headers) {
  const startTime = new Date().getTime();

  // For load testing, we simulate the upload with metadata
  // In real scenario, you would use multipart form data with actual image
  const payload = JSON.stringify({
    title: `Load Test Photo ${Date.now()}`,
    description: "Photo uploaded during load test",
    latitude: 35.9 + Math.random() * 0.1,
    longitude: 138.1 + Math.random() * 0.1,
    rainbow_type: ["full", "double", "partial"][Math.floor(Math.random() * 3)],
    captured_at: new Date().toISOString(),
    // In real scenario: image would be multipart form data
    // image_url: "https://example.com/test-image.jpg", // For testing
  });

  const response = http.post(apiUrl("/photos"), payload, {
    headers: headers,
    tags: { name: "photo_upload" },
  });

  const duration = new Date().getTime() - startTime;
  photoUploadDuration.add(duration);

  const success = check(response, {
    "photo upload status is 201 or 200": (r) =>
      r.status === 201 || r.status === 200,
    "photo upload response time < 3000ms": (r) => r.timings.duration < 3000,
  });

  photoUploadSuccessRate.add(success);

  if (success) {
    try {
      const body = JSON.parse(response.body);
      return body.id || (body.data && body.data.id);
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Test photo update
 */
function testPhotoUpdate(headers, photoId) {
  const payload = JSON.stringify({
    title: `Updated Photo ${Date.now()}`,
    description: "Updated during load test",
  });

  const response = http.patch(apiUrl(`/photos/${photoId}`), payload, {
    headers: headers,
    tags: { name: "photo_update" },
  });

  const success = check(response, {
    "photo update status is 200": (r) => r.status === 200,
    "photo update response time < 200ms": (r) => r.timings.duration < 200,
  });

  photoUpdateSuccessRate.add(success);
  return success;
}

/**
 * Test photo delete
 */
function testPhotoDelete(headers, photoId) {
  const response = http.del(apiUrl(`/photos/${photoId}`), null, {
    headers: headers,
    tags: { name: "photo_delete" },
  });

  const success = check(response, {
    "photo delete status is 200 or 204": (r) =>
      r.status === 200 || r.status === 204,
    "photo delete response time < 200ms": (r) => r.timings.duration < 200,
  });

  photoDeleteSuccessRate.add(success);
  return success;
}

// Default function for standalone execution
export default function (data) {
  browsePhotos(data);
}

// Teardown function
export function teardown(data) {
  console.log(`Photo load test completed. Started at: ${data.testStartTime}`);
}
