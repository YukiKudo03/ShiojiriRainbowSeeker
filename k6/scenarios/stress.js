/**
 * Stress Test Scenario
 *
 * Stress test to find system limits by ramping up to 1000 VUs.
 * Tests NFR-2 requirement for 1000 concurrent user support.
 *
 * Purpose:
 * - Find breaking points and performance degradation thresholds
 * - Verify system handles 1000 concurrent users
 * - Identify bottlenecks under extreme load
 *
 * Usage:
 *   k6 run k6/scenarios/stress.js
 *   K6_ENV=staging k6 run k6/scenarios/stress.js
 *
 * WARNING: This test generates significant load. Use with caution.
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter, Gauge } from "k6/metrics";
import { apiUrl, defaultHeaders, thresholds } from "../helpers/config.js";
import { loginTestUser, authHeaders } from "../helpers/auth.js";

// Custom metrics for stress test
const stressTestSuccess = new Rate("stress_test_success");
const responseTimeUnder200ms = new Rate("response_time_under_200ms");
const responseTimeUnder500ms = new Rate("response_time_under_500ms");
const responseTimeUnder1000ms = new Rate("response_time_under_1000ms");
const apiLatency = new Trend("api_latency");
const errorRate = new Rate("error_rate");
const currentVUs = new Gauge("current_vus");

// Stress test configuration
export const options = {
  scenarios: {
    stress_ramp: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        // Warm up
        { duration: "1m", target: 100 },   // Ramp to 100 VUs

        // Stress phase 1
        { duration: "2m", target: 250 },   // Ramp to 250 VUs
        { duration: "2m", target: 250 },   // Hold at 250

        // Stress phase 2
        { duration: "2m", target: 500 },   // Ramp to 500 VUs
        { duration: "2m", target: 500 },   // Hold at 500

        // Maximum stress (NFR-2: 1000 users)
        { duration: "2m", target: 750 },   // Ramp to 750 VUs
        { duration: "2m", target: 1000 },  // Ramp to 1000 VUs
        { duration: "3m", target: 1000 },  // Hold at 1000

        // Recovery
        { duration: "2m", target: 0 },     // Ramp down
      ],
      gracefulRampDown: "1m",
    },
  },
  thresholds: {
    // Under stress, we accept higher latencies but still want reasonable performance
    http_req_duration: ["p(95)<1000", "p(99)<3000"],

    // Error rate should stay reasonable even under stress
    http_req_failed: ["rate<0.05"], // Allow up to 5% errors under extreme load

    // NFR-2 compliance tracking (not threshold, just monitoring)
    response_time_under_200ms: ["rate>0.5"], // At least 50% should still meet NFR-2

    // Overall success
    stress_test_success: ["rate>0.90"],
  },
};

// Sample data
let samplePhotoIds = [];

// Setup function
export function setup() {
  console.log("=== STRESS TEST ===");
  console.log("Testing system limits with up to 1000 concurrent users");
  console.log("NFR-2 Target: 1000 concurrent user support");
  console.log("");
  console.log("WARNING: This test generates significant load!");
  console.log("");

  // Fetch sample data
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
        console.warn("Could not parse photo list");
      }
    }
  }

  return {
    testStartTime: new Date().toISOString(),
    photoIds: samplePhotoIds,
  };
}

// Main test function - simulates typical user behavior under stress
export default function (data) {
  currentVUs.add(__VU);

  const tokens = loginTestUser("standard");
  if (!tokens) {
    errorRate.add(true);
    stressTestSuccess.add(false);
    return;
  }

  const headers = authHeaders(tokens.accessToken);
  const photoIds = data.photoIds || [];

  // Random action based on typical usage patterns
  const action = Math.random();

  if (action < 0.5) {
    // 50% - Browse gallery
    stressBrowseGallery(headers);
  } else if (action < 0.75) {
    // 25% - View map
    stressBrowseMap(headers);
  } else if (action < 0.9) {
    // 15% - View photo detail
    if (photoIds.length > 0) {
      const photoId = photoIds[Math.floor(Math.random() * photoIds.length)];
      stressViewPhoto(headers, photoId);
    } else {
      stressBrowseGallery(headers);
    }
  } else {
    // 10% - Social interaction
    if (photoIds.length > 0) {
      const photoId = photoIds[Math.floor(Math.random() * photoIds.length)];
      stressSocialInteraction(headers, photoId);
    } else {
      stressBrowseGallery(headers);
    }
  }

  // Minimal sleep to maximize load
  sleep(0.5 + Math.random() * 1);
}

/**
 * Stress test gallery browsing
 */
function stressBrowseGallery(headers) {
  const page = Math.floor(Math.random() * 5) + 1;
  const response = http.get(apiUrl(`/photos?page=${page}&per_page=20`), {
    headers,
    tags: { name: "stress_gallery" },
  });

  recordMetrics(response, "gallery");
}

/**
 * Stress test map browsing
 */
function stressBrowseMap(headers) {
  const bounds = getRandomBounds();
  const response = http.get(
    apiUrl(`/maps/markers?north=${bounds.north}&south=${bounds.south}&east=${bounds.east}&west=${bounds.west}`),
    {
      headers,
      tags: { name: "stress_map" },
    }
  );

  recordMetrics(response, "map");
}

/**
 * Stress test photo detail view
 */
function stressViewPhoto(headers, photoId) {
  const response = http.get(apiUrl(`/photos/${photoId}`), {
    headers,
    tags: { name: "stress_photo_detail" },
  });

  recordMetrics(response, "photo_detail");
}

/**
 * Stress test social interactions
 */
function stressSocialInteraction(headers, photoId) {
  // Like
  const likeResponse = http.post(apiUrl(`/photos/${photoId}/likes`), null, {
    headers,
    tags: { name: "stress_like" },
  });

  // Accept various valid responses
  const likeSuccess = check(likeResponse, {
    "like status valid": (r) =>
      r.status === 200 || r.status === 201 || r.status === 422,
  });
  stressTestSuccess.add(likeSuccess);
  errorRate.add(!likeSuccess);

  sleep(0.2);

  // Unlike
  http.del(apiUrl(`/photos/${photoId}/likes`), null, {
    headers,
    tags: { name: "stress_unlike" },
  });
}

/**
 * Record metrics for a response
 */
function recordMetrics(response, name) {
  const duration = response.timings.duration;
  apiLatency.add(duration);

  // Track response time distribution
  responseTimeUnder200ms.add(duration < 200);
  responseTimeUnder500ms.add(duration < 500);
  responseTimeUnder1000ms.add(duration < 1000);

  const success = check(response, {
    [`${name} status is valid`]: (r) => r.status >= 200 && r.status < 500,
    [`${name} responds within 3s`]: (r) => r.timings.duration < 3000,
  });

  stressTestSuccess.add(success);
  errorRate.add(!success);
}

/**
 * Get random bounds near Shiojiri
 */
function getRandomBounds() {
  const centerLat = 35.95 + (Math.random() - 0.5) * 0.2;
  const centerLng = 138.1 + (Math.random() - 0.5) * 0.2;
  const size = 0.05 + Math.random() * 0.15;

  return {
    north: centerLat + size / 2,
    south: centerLat - size / 2,
    east: centerLng + size / 2,
    west: centerLng - size / 2,
  };
}

// Teardown function
export function teardown(data) {
  console.log("\n=== STRESS TEST COMPLETE ===");
  console.log(`Started at: ${data.testStartTime}`);
  console.log(`Ended at: ${new Date().toISOString()}`);
  console.log("");
  console.log("Review the following metrics:");
  console.log("  - response_time_under_200ms: % meeting NFR-2");
  console.log("  - http_req_duration: Latency distribution");
  console.log("  - http_req_failed: Error rate");
  console.log("  - stress_test_success: Overall success rate");
  console.log("");
  console.log("Look for degradation points at different VU levels.");
  console.log("");
}
