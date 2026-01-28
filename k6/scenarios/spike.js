/**
 * Spike Test Scenario
 *
 * Tests system behavior during sudden traffic spikes.
 * Simulates sudden surge to 1000 concurrent users.
 *
 * Purpose:
 * - Test system resilience to sudden load spikes
 * - Verify auto-scaling capabilities
 * - Ensure graceful degradation under spike conditions
 * - Test recovery after spike
 *
 * Usage:
 *   k6 run k6/scenarios/spike.js
 *   K6_ENV=staging k6 run k6/scenarios/spike.js
 *
 * WARNING: This test generates sudden extreme load. Use with caution.
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter, Gauge } from "k6/metrics";
import { apiUrl, defaultHeaders } from "../helpers/config.js";
import { loginTestUser, authHeaders } from "../helpers/auth.js";

// Custom metrics for spike test
const spikeTestSuccess = new Rate("spike_test_success");
const preSpikeLatency = new Trend("pre_spike_latency");
const duringSpjikeLatency = new Trend("during_spike_latency");
const postSpikeLatency = new Trend("post_spike_latency");
const recoveryRate = new Rate("recovery_rate");
const errorRate = new Rate("error_rate");
const currentVUs = new Gauge("current_vus");
const currentPhase = new Gauge("current_phase"); // 1=pre, 2=spike, 3=post

// Spike test configuration
export const options = {
  scenarios: {
    spike_test: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        // Phase 1: Normal load (baseline)
        { duration: "1m", target: 50 },    // Ramp to normal
        { duration: "2m", target: 50 },    // Baseline measurement

        // Phase 2: SPIKE! Sudden surge to 1000 users
        { duration: "10s", target: 1000 }, // Rapid spike to 1000!
        { duration: "1m", target: 1000 },  // Hold spike

        // Phase 3: Sudden drop (spike ends)
        { duration: "10s", target: 50 },   // Rapid drop back

        // Phase 4: Recovery observation
        { duration: "2m", target: 50 },    // Measure recovery

        // Cleanup
        { duration: "30s", target: 0 },    // Ramp down
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    // During spike, we accept degraded performance
    http_req_duration: ["p(95)<3000", "p(99)<5000"],

    // But should not have too many errors
    http_req_failed: ["rate<0.10"], // Allow up to 10% during spike

    // Post-spike recovery should be good
    recovery_rate: ["rate>0.90"],

    // Overall success
    spike_test_success: ["rate>0.85"],
  },
};

// Phase tracking
let testPhase = "baseline";

// Sample data
let samplePhotoIds = [];

// Setup function
export function setup() {
  console.log("=== SPIKE TEST ===");
  console.log("Testing sudden traffic surge to 1000 users");
  console.log("");
  console.log("Phases:");
  console.log("  1. Baseline: 50 VUs (3 minutes)");
  console.log("  2. SPIKE: Sudden jump to 1000 VUs (70 seconds)");
  console.log("  3. Recovery: Back to 50 VUs (2 minutes)");
  console.log("");
  console.log("WARNING: This test generates sudden extreme load!");
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
    phases: {
      baseline: { start: 0, end: 180 },           // 0-3 min
      spike: { start: 180, end: 250 },            // 3-4:10 min
      recovery: { start: 250, end: 380 },         // 4:10-6:20 min
    },
  };
}

// Main test function
export default function (data) {
  currentVUs.add(__VU);

  // Determine current phase based on elapsed time
  const elapsedSeconds = (Date.now() - new Date(data.testStartTime).getTime()) / 1000;
  const phase = determinePhase(elapsedSeconds, data.phases);

  // Update phase gauge for monitoring
  if (phase === "baseline") currentPhase.add(1);
  else if (phase === "spike") currentPhase.add(2);
  else currentPhase.add(3);

  const tokens = loginTestUser("standard");
  if (!tokens) {
    errorRate.add(true);
    spikeTestSuccess.add(false);
    return;
  }

  const headers = authHeaders(tokens.accessToken);
  const photoIds = data.photoIds || [];

  // Run typical user actions
  group("Spike Test Actions", function () {
    // Primary action: Gallery browsing (most common)
    const galleryResponse = testGallery(headers);
    recordPhaseMetrics(galleryResponse, phase);

    sleep(0.3);

    // Secondary action: View photo
    if (photoIds.length > 0 && Math.random() > 0.5) {
      const photoId = photoIds[Math.floor(Math.random() * photoIds.length)];
      const photoResponse = testPhotoDetail(headers, photoId);
      recordPhaseMetrics(photoResponse, phase);
    }

    // Tertiary action: Map (less frequent during spike)
    if (phase !== "spike" || Math.random() > 0.7) {
      const mapResponse = testMap(headers);
      recordPhaseMetrics(mapResponse, phase);
    }
  });

  // Adjust sleep based on phase
  if (phase === "spike") {
    sleep(0.2); // Minimal sleep during spike
  } else {
    sleep(0.5 + Math.random() * 1);
  }
}

/**
 * Determine current test phase
 */
function determinePhase(elapsedSeconds, phases) {
  if (elapsedSeconds < phases.baseline.end) return "baseline";
  if (elapsedSeconds < phases.spike.end) return "spike";
  return "recovery";
}

/**
 * Test gallery endpoint
 */
function testGallery(headers) {
  const response = http.get(apiUrl("/photos?page=1&per_page=20"), {
    headers,
    tags: { name: "spike_gallery" },
  });
  return response;
}

/**
 * Test photo detail endpoint
 */
function testPhotoDetail(headers, photoId) {
  const response = http.get(apiUrl(`/photos/${photoId}`), {
    headers,
    tags: { name: "spike_photo_detail" },
  });
  return response;
}

/**
 * Test map endpoint
 */
function testMap(headers) {
  const response = http.get(
    apiUrl("/maps/markers?north=36&south=35.9&east=138.2&west=138"),
    {
      headers,
      tags: { name: "spike_map" },
    }
  );
  return response;
}

/**
 * Record metrics based on current phase
 */
function recordPhaseMetrics(response, phase) {
  const duration = response.timings.duration;
  const success = response.status >= 200 && response.status < 500;

  // Record to appropriate phase metric
  switch (phase) {
    case "baseline":
      preSpikeLatency.add(duration);
      break;
    case "spike":
      duringSpjikeLatency.add(duration);
      break;
    case "recovery":
      postSpikeLatency.add(duration);
      // Check if recovery is meeting baseline performance
      recoveryRate.add(duration < 500); // Should recover to < 500ms
      break;
  }

  // Record overall success
  spikeTestSuccess.add(success);
  errorRate.add(!success);

  // Detailed checks
  check(response, {
    "status is valid": (r) => r.status >= 200 && r.status < 500,
    "responds within timeout": (r) => r.timings.duration < 10000,
  });
}

// Teardown function
export function teardown(data) {
  console.log("\n=== SPIKE TEST COMPLETE ===");
  console.log(`Started at: ${data.testStartTime}`);
  console.log(`Ended at: ${new Date().toISOString()}`);
  console.log("");
  console.log("Key Metrics to Review:");
  console.log("  - pre_spike_latency: Baseline performance");
  console.log("  - during_spike_latency: Performance during 1000 VU spike");
  console.log("  - post_spike_latency: Recovery performance");
  console.log("  - recovery_rate: % of requests meeting recovery threshold");
  console.log("  - error_rate: Overall error rate");
  console.log("");
  console.log("Analysis Guidelines:");
  console.log("  1. Compare baseline vs spike latencies");
  console.log("  2. Check error rate increase during spike");
  console.log("  3. Verify post-spike latency returns to baseline");
  console.log("  4. Look for any cascading failures");
  console.log("");
}
