/**
 * Feed/Gallery Endpoints Load Test
 *
 * Tests the feed and gallery related API endpoints:
 * - GET /api/v1/photos - Photo gallery listing
 * - GET /api/v1/users/:id/photos - User's public photos
 * - GET /api/v1/users/me/photos - Current user's photos
 *
 * NFR-2 Compliance: p95 response time < 200ms
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { apiUrl, thresholds } from "../helpers/config.js";
import { loginTestUser, authHeaders } from "../helpers/auth.js";
import { checkApiResponse, checkListResponse } from "../helpers/checks.js";

// Custom metrics for feed operations
const feedSuccessRate = new Rate("feed_success");
const feedDuration = new Trend("feed_duration");
const feedPaginationSuccessRate = new Rate("feed_pagination_success");
const userFeedSuccessRate = new Rate("user_feed_success");
const myFeedSuccessRate = new Rate("my_feed_success");

// Test configuration
export const options = {
  scenarios: {
    feed_browse: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 100 },  // Ramp up
        { duration: "2m", target: 200 },   // High load
        { duration: "1m", target: 200 },   // Sustained load
        { duration: "30s", target: 0 },    // Ramp down
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    ...thresholds,
    feed_success: ["rate>0.95"],
    feed_duration: ["p(95)<200"],
    feed_pagination_success: ["rate>0.95"],
    user_feed_success: ["rate>0.95"],
    my_feed_success: ["rate>0.95"],
  },
};

// Sample user IDs for testing
let sampleUserIds = [];

// Setup function
export function setup() {
  console.log("Setting up feed load test...");

  // Login and fetch some user IDs
  const tokens = loginTestUser("standard");
  if (tokens) {
    const response = http.get(apiUrl("/photos?limit=50"), {
      headers: authHeaders(tokens.accessToken),
    });

    if (response.status === 200) {
      try {
        const body = JSON.parse(response.body);
        const photos = body.data || body.photos || body;
        if (Array.isArray(photos)) {
          // Extract unique user IDs from photos
          const userIds = [...new Set(photos.map((p) => p.user_id).filter(Boolean))];
          sampleUserIds = userIds.slice(0, 20);
        }
      } catch (e) {
        console.warn("Could not parse photo list for user IDs");
      }
    }
  }

  return {
    testStartTime: new Date().toISOString(),
    userIds: sampleUserIds,
  };
}

// Main test function
export default function (data) {
  const tokens = loginTestUser("standard");
  if (!tokens) {
    console.error("Failed to authenticate");
    return;
  }

  const headers = authHeaders(tokens.accessToken);
  const userIds = data.userIds || [];

  group("Feed Operations", function () {
    // Main feed/gallery
    group("Main Feed", function () {
      testMainFeed(headers);
    });

    sleep(0.5);

    // Paginated feed
    group("Feed Pagination", function () {
      testFeedPagination(headers);
    });

    sleep(0.5);

    // Filtered feed
    group("Filtered Feed", function () {
      testFilteredFeed(headers);
    });

    sleep(1);

    // My photos feed
    group("My Photos", function () {
      testMyPhotosFeed(headers);
    });

    sleep(0.5);

    // Other user's photos
    if (userIds.length > 0) {
      group("User Photos", function () {
        const randomUserId = userIds[Math.floor(Math.random() * userIds.length)];
        testUserPhotosFeed(headers, randomUserId);
      });
    }
  });

  sleep(Math.random() * 2 + 1);
}

/**
 * Test main feed endpoint
 */
function testMainFeed(headers) {
  const startTime = new Date().getTime();

  const response = http.get(apiUrl("/photos"), {
    headers: headers,
    tags: { name: "main_feed" },
  });

  const duration = new Date().getTime() - startTime;
  feedDuration.add(duration);

  const success = check(response, {
    "main feed status is 200": (r) => r.status === 200,
    "main feed is valid JSON": (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
    "main feed response time < 200ms": (r) => r.timings.duration < 200,
  });

  feedSuccessRate.add(success);
  return success;
}

/**
 * Test feed pagination
 */
function testFeedPagination(headers) {
  // Simulate user scrolling through feed pages
  const pages = [1, 2, 3];
  let allSuccess = true;

  for (const page of pages) {
    const response = http.get(apiUrl(`/photos?page=${page}&per_page=20`), {
      headers: headers,
      tags: { name: "feed_pagination" },
    });

    const success = check(response, {
      [`feed page ${page} status is 200`]: (r) => r.status === 200,
      [`feed page ${page} response time < 200ms`]: (r) => r.timings.duration < 200,
    });

    allSuccess = allSuccess && success;
    sleep(0.3);
  }

  feedPaginationSuccessRate.add(allSuccess);
  return allSuccess;
}

/**
 * Test filtered feed with various filters
 */
function testFilteredFeed(headers) {
  // Different filter scenarios users might use
  const filterScenarios = [
    // By rainbow type
    { params: "rainbow_type=full", name: "full_rainbow" },
    { params: "rainbow_type=double", name: "double_rainbow" },
    { params: "rainbow_type=partial", name: "partial_rainbow" },

    // By date range
    {
      params: `start_date=${getDateDaysAgo(30)}&end_date=${getDateDaysAgo(0)}`,
      name: "last_30_days",
    },

    // By location (near Shiojiri)
    { params: "lat=35.9&lng=138.1&radius=5", name: "near_shiojiri" },

    // Sorting options
    { params: "sort_by=likes_count&order=desc", name: "most_liked" },
    { params: "sort_by=created_at&order=desc", name: "newest" },
  ];

  // Test random filter scenario
  const scenario = filterScenarios[Math.floor(Math.random() * filterScenarios.length)];

  const response = http.get(apiUrl(`/photos?${scenario.params}`), {
    headers: headers,
    tags: { name: `feed_filter_${scenario.name}` },
  });

  const success = check(response, {
    [`filtered feed (${scenario.name}) status is 200`]: (r) => r.status === 200,
    [`filtered feed (${scenario.name}) response time < 200ms`]: (r) =>
      r.timings.duration < 200,
  });

  feedSuccessRate.add(success);
  return success;
}

/**
 * Test my photos feed
 */
function testMyPhotosFeed(headers) {
  const response = http.get(apiUrl("/users/me/photos"), {
    headers: headers,
    tags: { name: "my_photos_feed" },
  });

  const success = check(response, {
    "my photos feed status is 200": (r) => r.status === 200,
    "my photos feed response time < 200ms": (r) => r.timings.duration < 200,
  });

  myFeedSuccessRate.add(success);
  return success;
}

/**
 * Test user's photos feed
 */
function testUserPhotosFeed(headers, userId) {
  const response = http.get(apiUrl(`/users/${userId}/photos`), {
    headers: headers,
    tags: { name: "user_photos_feed" },
  });

  const success = check(response, {
    "user photos feed status is 200": (r) => r.status === 200,
    "user photos feed response time < 200ms": (r) => r.timings.duration < 200,
  });

  userFeedSuccessRate.add(success);
  return success;
}

/**
 * Helper function to get date string for days ago
 */
function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}

// Teardown function
export function teardown(data) {
  console.log(`Feed load test completed. Started at: ${data.testStartTime}`);
}
