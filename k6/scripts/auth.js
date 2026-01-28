/**
 * Authentication Endpoints Load Test
 *
 * Tests the authentication API endpoints:
 * - POST /api/v1/auth/register
 * - POST /api/v1/auth/login
 * - POST /api/v1/auth/refresh
 * - DELETE /api/v1/auth/logout
 *
 * NFR-2 Compliance: p95 response time < 200ms
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { apiUrl, defaultHeaders, authHeaders, thresholds } from "../helpers/config.js";
import { testUsers, login, loginTestUser, refreshToken, logout } from "../helpers/auth.js";
import { checkApiResponse, checkStatus, checkHasField } from "../helpers/checks.js";

// Custom metrics for authentication
const loginSuccessRate = new Rate("auth_login_success");
const loginDuration = new Trend("auth_login_duration");
const registerSuccessRate = new Rate("auth_register_success");
const registerDuration = new Trend("auth_register_duration");
const refreshSuccessRate = new Rate("auth_refresh_success");
const logoutSuccessRate = new Rate("auth_logout_success");

// Test configuration
export const options = {
  scenarios: {
    auth_load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 50 },  // Ramp up to 50 VUs
        { duration: "1m", target: 50 },   // Stay at 50 VUs
        { duration: "30s", target: 100 }, // Ramp up to 100 VUs
        { duration: "1m", target: 100 },  // Stay at 100 VUs
        { duration: "30s", target: 0 },   // Ramp down
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    ...thresholds,
    auth_login_success: ["rate>0.95"],      // 95% success rate
    auth_login_duration: ["p(95)<200"],     // p95 < 200ms
    auth_register_success: ["rate>0.90"],   // 90% success rate (may have conflicts)
    auth_refresh_success: ["rate>0.95"],    // 95% success rate
    auth_logout_success: ["rate>0.95"],     // 95% success rate
  },
};

// Setup function - runs once before the test
export function setup() {
  console.log("Setting up authentication load test...");
  return {
    testStartTime: new Date().toISOString(),
  };
}

// Main test function
export default function () {
  const vuId = __VU;
  const iteration = __ITER;

  group("Authentication Flow", function () {
    // Test login
    group("Login", function () {
      testLogin();
    });

    sleep(1);

    // Test token refresh (only if logged in)
    group("Token Refresh", function () {
      testRefresh();
    });

    sleep(1);

    // Test logout
    group("Logout", function () {
      testLogout();
    });
  });

  // Occasionally test registration with unique users
  if (iteration % 10 === 0) {
    group("Registration", function () {
      testRegister(vuId, iteration);
    });
  }

  sleep(Math.random() * 2 + 1); // Random sleep between 1-3 seconds
}

/**
 * Test user login
 */
function testLogin() {
  const payload = JSON.stringify({
    email: testUsers.standard.email,
    password: testUsers.standard.password,
  });

  const startTime = new Date().getTime();

  const response = http.post(apiUrl("/auth/login"), payload, {
    headers: defaultHeaders(),
    tags: { name: "auth_login" },
  });

  const duration = new Date().getTime() - startTime;
  loginDuration.add(duration);

  const success = check(response, {
    "login status is 200": (r) => r.status === 200,
    "login has token": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.token || body.access_token;
      } catch {
        return false;
      }
    },
    "login response time < 200ms": (r) => r.timings.duration < 200,
  });

  loginSuccessRate.add(success);

  if (success) {
    try {
      const body = JSON.parse(response.body);
      // Store token for subsequent requests
      return body.token || body.access_token;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Test token refresh
 */
function testRefresh() {
  // First login to get tokens
  const tokens = loginTestUser("standard");
  if (!tokens) {
    refreshSuccessRate.add(false);
    return;
  }

  sleep(0.5);

  // Attempt refresh
  const refreshPayload = JSON.stringify({
    refresh_token: tokens.refreshToken,
  });

  const response = http.post(apiUrl("/auth/refresh"), refreshPayload, {
    headers: defaultHeaders(),
    tags: { name: "auth_refresh" },
  });

  const success = check(response, {
    "refresh status is 200": (r) => r.status === 200,
    "refresh has new token": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.token || body.access_token;
      } catch {
        return false;
      }
    },
    "refresh response time < 200ms": (r) => r.timings.duration < 200,
  });

  refreshSuccessRate.add(success);
}

/**
 * Test user logout
 */
function testLogout() {
  // First login to get token
  const tokens = loginTestUser("standard");
  if (!tokens) {
    logoutSuccessRate.add(false);
    return;
  }

  sleep(0.5);

  const response = http.del(apiUrl("/auth/logout"), null, {
    headers: authHeaders(tokens.accessToken),
    tags: { name: "auth_logout" },
  });

  const success = check(response, {
    "logout status is 200 or 204": (r) => r.status === 200 || r.status === 204,
    "logout response time < 200ms": (r) => r.timings.duration < 200,
  });

  logoutSuccessRate.add(success);
}

/**
 * Test user registration
 * @param {number} vuId - Virtual user ID
 * @param {number} iteration - Current iteration
 */
function testRegister(vuId, iteration) {
  const timestamp = Date.now();
  const uniqueEmail = `loadtest-${vuId}-${iteration}-${timestamp}@example.com`;

  const payload = JSON.stringify({
    email: uniqueEmail,
    password: "LoadTest123!",
    username: `loadtest_${vuId}_${iteration}`,
  });

  const startTime = new Date().getTime();

  const response = http.post(apiUrl("/auth/register"), payload, {
    headers: defaultHeaders(),
    tags: { name: "auth_register" },
  });

  const duration = new Date().getTime() - startTime;
  registerDuration.add(duration);

  const success = check(response, {
    "register status is 201 or 200": (r) => r.status === 201 || r.status === 200,
    "register response time < 200ms": (r) => r.timings.duration < 200,
  });

  registerSuccessRate.add(success);
}

// Teardown function - runs once after the test
export function teardown(data) {
  console.log(`Authentication load test completed. Started at: ${data.testStartTime}`);
}
