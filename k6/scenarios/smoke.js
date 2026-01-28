/**
 * Smoke Test Scenario
 *
 * Quick validation test to verify the system is functioning.
 * Runs with minimal load (10 VUs for 30 seconds).
 *
 * Purpose:
 * - Verify all endpoints are reachable
 * - Catch basic configuration issues
 * - Run before larger load tests
 *
 * Usage:
 *   k6 run k6/scenarios/smoke.js
 *   K6_ENV=staging k6 run k6/scenarios/smoke.js
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend } from "k6/metrics";
import { apiUrl, defaultHeaders, thresholds } from "../helpers/config.js";
import { loginTestUser, authHeaders, testUsers } from "../helpers/auth.js";
import {
  checkApiResponse,
  checkSuccess,
  checkResponseTime,
} from "../helpers/checks.js";

// Custom metrics
const smokeTestSuccess = new Rate("smoke_test_success");
const endpointAvailability = new Rate("endpoint_availability");

// Smoke test configuration
export const options = {
  stages: [
    { duration: "10s", target: 10 }, // Ramp up to 10 VUs
    { duration: "20s", target: 10 }, // Stay at 10 VUs
    { duration: "10s", target: 0 },  // Ramp down
  ],
  thresholds: {
    // All endpoints should be available
    endpoint_availability: ["rate>0.99"],
    // Basic response time
    http_req_duration: ["p(95)<500", "p(99)<1000"],
    // Low error rate
    http_req_failed: ["rate<0.05"],
    // Overall smoke test pass rate
    smoke_test_success: ["rate>0.95"],
  },
};

// Endpoints to smoke test
const endpoints = [
  { method: "GET", path: "/photos", name: "list_photos", requiresAuth: true },
  { method: "GET", path: "/maps/markers?north=36&south=35&east=138.5&west=137.5", name: "map_markers", requiresAuth: true },
  { method: "GET", path: "/maps/clusters?north=36&south=35&east=138.5&west=137.5&zoom=10", name: "map_clusters", requiresAuth: true },
  { method: "GET", path: "/users/me", name: "current_user", requiresAuth: true },
  { method: "GET", path: "/notifications", name: "notifications", requiresAuth: true },
];

// Setup function
export function setup() {
  console.log("=== SMOKE TEST ===");
  console.log("Starting quick validation...");

  // Verify we can authenticate
  const tokens = loginTestUser("standard");
  if (!tokens) {
    console.error("SMOKE TEST SETUP FAILED: Cannot authenticate");
    return { canAuthenticate: false };
  }

  // Quick health check
  const healthCheck = http.get(apiUrl("/../up"));
  const healthOk = healthCheck.status === 200;

  return {
    testStartTime: new Date().toISOString(),
    canAuthenticate: true,
    healthCheckPassed: healthOk,
  };
}

// Main test function
export default function (data) {
  if (!data.canAuthenticate) {
    console.error("Skipping test - authentication not available");
    smokeTestSuccess.add(false);
    return;
  }

  const tokens = loginTestUser("standard");
  if (!tokens) {
    smokeTestSuccess.add(false);
    return;
  }

  const headers = authHeaders(tokens.accessToken);

  group("Smoke Test - All Endpoints", function () {
    for (const endpoint of endpoints) {
      group(`${endpoint.name}`, function () {
        testEndpoint(endpoint, headers);
      });
      sleep(0.5);
    }
  });

  // Test authentication flow
  group("Smoke Test - Auth Flow", function () {
    testAuthFlow();
  });

  sleep(1);
}

/**
 * Test a single endpoint
 */
function testEndpoint(endpoint, headers) {
  let response;

  switch (endpoint.method) {
    case "GET":
      response = http.get(apiUrl(endpoint.path), {
        headers: endpoint.requiresAuth ? headers : defaultHeaders(),
        tags: { name: endpoint.name },
      });
      break;
    case "POST":
      response = http.post(
        apiUrl(endpoint.path),
        endpoint.body ? JSON.stringify(endpoint.body) : null,
        {
          headers: endpoint.requiresAuth ? headers : defaultHeaders(),
          tags: { name: endpoint.name },
        }
      );
      break;
    default:
      console.warn(`Unknown method: ${endpoint.method}`);
      return;
  }

  const success = check(response, {
    [`${endpoint.name} is available`]: (r) => r.status >= 200 && r.status < 500,
    [`${endpoint.name} response time < 500ms`]: (r) => r.timings.duration < 500,
  });

  endpointAvailability.add(response.status >= 200 && response.status < 500);
  smokeTestSuccess.add(success);

  // Log any errors for debugging
  if (response.status >= 400) {
    console.warn(
      `${endpoint.name}: ${response.status} - ${response.body.substring(0, 100)}`
    );
  }
}

/**
 * Test basic authentication flow
 */
function testAuthFlow() {
  // Login
  const loginPayload = JSON.stringify({
    email: testUsers.standard.email,
    password: testUsers.standard.password,
  });

  const loginResponse = http.post(apiUrl("/auth/login"), loginPayload, {
    headers: defaultHeaders(),
    tags: { name: "smoke_login" },
  });

  const loginSuccess = check(loginResponse, {
    "login works": (r) => r.status === 200,
    "login returns token": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.token || body.access_token;
      } catch {
        return false;
      }
    },
  });

  endpointAvailability.add(loginResponse.status === 200);
  smokeTestSuccess.add(loginSuccess);

  if (!loginSuccess) {
    console.error("Auth flow failed at login step");
    return;
  }

  // Extract token for logout
  let token;
  try {
    const body = JSON.parse(loginResponse.body);
    token = body.token || body.access_token;
  } catch {
    return;
  }

  sleep(0.5);

  // Logout
  const logoutResponse = http.del(apiUrl("/auth/logout"), null, {
    headers: authHeaders(token),
    tags: { name: "smoke_logout" },
  });

  const logoutSuccess = check(logoutResponse, {
    "logout works": (r) => r.status === 200 || r.status === 204,
  });

  endpointAvailability.add(logoutResponse.status === 200 || logoutResponse.status === 204);
  smokeTestSuccess.add(logoutSuccess);
}

// Teardown function
export function teardown(data) {
  console.log("\n=== SMOKE TEST COMPLETE ===");
  console.log(`Started at: ${data.testStartTime}`);
  console.log(`Health check: ${data.healthCheckPassed ? "PASSED" : "FAILED"}`);
  console.log(`Authentication: ${data.canAuthenticate ? "PASSED" : "FAILED"}`);
  console.log("");
}
