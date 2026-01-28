/**
 * Load Test Scenario
 *
 * Normal load test simulating typical usage patterns.
 * Runs with 100 VUs for 5 minutes.
 *
 * Purpose:
 * - Verify NFR-2 performance requirements under normal load
 * - API response time: p95 < 200ms
 * - Concurrent users: 100 (typical load)
 *
 * Usage:
 *   k6 run k6/scenarios/load.js
 *   K6_ENV=staging k6 run k6/scenarios/load.js
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";
import { apiUrl, defaultHeaders, thresholds } from "../helpers/config.js";
import { loginTestUser, authHeaders } from "../helpers/auth.js";
import {
  checkApiResponse,
  checkResponseTime,
  checkNFR2Compliance,
} from "../helpers/checks.js";

// Custom metrics for load test
const loadTestSuccess = new Rate("load_test_success");
const nfr2Compliance = new Rate("nfr2_compliance");
const apiLatency = new Trend("api_latency");
const requestsCompleted = new Counter("requests_completed");

// Load test configuration
export const options = {
  scenarios: {
    // Main browsing users
    browsing_users: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 50 },   // Ramp up to 50 VUs
        { duration: "3m", target: 100 },  // Ramp up to 100 VUs
        { duration: "2m", target: 100 },  // Stay at 100 VUs
        { duration: "1m", target: 0 },    // Ramp down
      ],
      gracefulRampDown: "30s",
      exec: "browsingUser",
    },
    // Active contributors (uploading, commenting)
    active_users: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 10 },
        { duration: "4m", target: 20 },
        { duration: "1m", target: 20 },
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "30s",
      exec: "activeUser",
      startTime: "30s",
    },
  },
  thresholds: {
    // NFR-2: API response time p95 < 200ms
    http_req_duration: ["p(95)<200", "p(99)<500", "avg<100"],
    // NFR-2: Error rate < 1%
    http_req_failed: ["rate<0.01"],
    // Throughput
    http_reqs: ["rate>50"],
    // Custom thresholds
    load_test_success: ["rate>0.95"],
    nfr2_compliance: ["rate>0.95"],
    api_latency: ["p(95)<200"],
  },
};

// Sample data for tests
let samplePhotoIds = [];

// Setup function
export function setup() {
  console.log("=== LOAD TEST ===");
  console.log("Testing NFR-2 compliance under normal load (100 VUs)");
  console.log("");

  // Fetch sample photo IDs
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
 * Browsing user scenario
 * Simulates a user browsing the gallery and map
 */
export function browsingUser(data) {
  const tokens = loginTestUser("standard");
  if (!tokens) {
    loadTestSuccess.add(false);
    return;
  }

  const headers = authHeaders(tokens.accessToken);
  const photoIds = data.photoIds || [];

  group("Browsing Session", function () {
    // Browse photo gallery
    group("Gallery", function () {
      const galleryResponse = http.get(apiUrl("/photos?page=1&per_page=20"), {
        headers,
        tags: { name: "gallery_list" },
      });

      const success = verifyNFR2Response(galleryResponse, "gallery_list");
      loadTestSuccess.add(success);
    });

    sleep(randomThinkTime());

    // View photo detail
    if (photoIds.length > 0) {
      group("Photo Detail", function () {
        const photoId = photoIds[Math.floor(Math.random() * photoIds.length)];
        const detailResponse = http.get(apiUrl(`/photos/${photoId}`), {
          headers,
          tags: { name: "photo_detail" },
        });

        const success = verifyNFR2Response(detailResponse, "photo_detail");
        loadTestSuccess.add(success);
      });
    }

    sleep(randomThinkTime());

    // Browse map
    group("Map", function () {
      const bounds = getRandomBounds();
      const mapResponse = http.get(
        apiUrl(`/maps/markers?north=${bounds.north}&south=${bounds.south}&east=${bounds.east}&west=${bounds.west}`),
        {
          headers,
          tags: { name: "map_markers" },
        }
      );

      // Map has 2 second threshold
      const success = check(mapResponse, {
        "map status is 200": (r) => r.status === 200,
        "map response time < 2000ms": (r) => r.timings.duration < 2000,
      });
      loadTestSuccess.add(success);
    });

    sleep(randomThinkTime());

    // View comments
    if (photoIds.length > 0) {
      group("Comments", function () {
        const photoId = photoIds[Math.floor(Math.random() * photoIds.length)];
        const commentsResponse = http.get(
          apiUrl(`/photos/${photoId}/comments`),
          {
            headers,
            tags: { name: "comments_list" },
          }
        );

        const success = verifyNFR2Response(commentsResponse, "comments_list");
        loadTestSuccess.add(success);
      });
    }
  });

  sleep(randomThinkTime() * 2);
}

/**
 * Active user scenario
 * Simulates a user who likes, comments, and interacts
 */
export function activeUser(data) {
  const tokens = loginTestUser("standard");
  if (!tokens) {
    loadTestSuccess.add(false);
    return;
  }

  const headers = authHeaders(tokens.accessToken);
  const photoIds = data.photoIds || [];

  if (photoIds.length === 0) {
    loadTestSuccess.add(true);
    return;
  }

  const photoId = photoIds[Math.floor(Math.random() * photoIds.length)];

  group("Active Session", function () {
    // Like a photo
    group("Like", function () {
      const likeResponse = http.post(
        apiUrl(`/photos/${photoId}/likes`),
        null,
        {
          headers,
          tags: { name: "like_photo" },
        }
      );

      // Accept 200, 201, or 422 (already liked)
      const success = check(likeResponse, {
        "like status is valid": (r) =>
          r.status === 200 || r.status === 201 || r.status === 422,
        "like response time < 200ms": (r) => r.timings.duration < 200,
      });
      loadTestSuccess.add(success);
    });

    sleep(randomThinkTime());

    // Add a comment
    group("Comment", function () {
      const commentPayload = JSON.stringify({
        content: `Beautiful rainbow! (Load test ${Date.now()})`,
      });

      const commentResponse = http.post(
        apiUrl(`/photos/${photoId}/comments`),
        commentPayload,
        {
          headers,
          tags: { name: "add_comment" },
        }
      );

      const success = check(commentResponse, {
        "comment status is 200 or 201": (r) =>
          r.status === 200 || r.status === 201,
        "comment response time < 200ms": (r) => r.timings.duration < 200,
      });
      loadTestSuccess.add(success);

      // Cleanup: delete the comment
      if (success) {
        try {
          const body = JSON.parse(commentResponse.body);
          const commentId = body.id || (body.data && body.data.id);
          if (commentId) {
            sleep(0.5);
            http.del(apiUrl(`/comments/${commentId}`), null, { headers });
          }
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    sleep(randomThinkTime());

    // Unlike the photo
    group("Unlike", function () {
      http.del(apiUrl(`/photos/${photoId}/likes`), null, {
        headers,
        tags: { name: "unlike_photo" },
      });
    });
  });

  sleep(randomThinkTime() * 3);
}

/**
 * Verify response meets NFR-2 requirements
 */
function verifyNFR2Response(response, name) {
  apiLatency.add(response.timings.duration);
  requestsCompleted.add(1);

  const success = check(response, {
    [`${name} status is 200`]: (r) => r.status === 200,
    [`${name} response time < 200ms`]: (r) => r.timings.duration < 200,
  });

  nfr2Compliance.add(response.timings.duration < 200);

  return success;
}

/**
 * Get random bounds near Shiojiri
 */
function getRandomBounds() {
  const centerLat = 35.95 + (Math.random() - 0.5) * 0.1;
  const centerLng = 138.1 + (Math.random() - 0.5) * 0.1;
  const size = 0.1 + Math.random() * 0.2;

  return {
    north: centerLat + size / 2,
    south: centerLat - size / 2,
    east: centerLng + size / 2,
    west: centerLng - size / 2,
  };
}

/**
 * Random think time between 1-3 seconds
 */
function randomThinkTime() {
  return 1 + Math.random() * 2;
}

// Teardown function
export function teardown(data) {
  console.log("\n=== LOAD TEST COMPLETE ===");
  console.log(`Started at: ${data.testStartTime}`);
  console.log(`Ended at: ${new Date().toISOString()}`);
  console.log("");
  console.log("NFR-2 Requirements:");
  console.log("  - API response time p95 < 200ms");
  console.log("  - Error rate < 1%");
  console.log("  - 100 concurrent users supported");
  console.log("");
}
