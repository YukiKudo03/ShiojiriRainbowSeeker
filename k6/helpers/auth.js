/**
 * k6 Authentication Helper
 *
 * Provides JWT token management for authenticated API tests.
 * Handles login, token refresh, and token storage.
 */

import http from "k6/http";
import { check, fail } from "k6";
import { apiUrl, defaultHeaders, authHeaders } from "./config.js";

// Shared data store for tokens (per VU)
const tokenStore = {};

/**
 * Test user credentials for load testing
 * These should be pre-created test users in the test environment
 */
export const testUsers = {
  standard: {
    email: "loadtest-user@example.com",
    password: "LoadTest123!",
  },
  premium: {
    email: "loadtest-premium@example.com",
    password: "LoadTest123!",
  },
  admin: {
    email: "loadtest-admin@example.com",
    password: "LoadTest123!",
  },
};

/**
 * Generate unique test user credentials based on VU ID
 * Useful for tests requiring unique users
 * @param {number} vuId - Virtual user ID
 * @returns {Object} User credentials
 */
export function generateTestUser(vuId) {
  return {
    email: `loadtest-vu${vuId}@example.com`,
    password: "LoadTest123!",
  };
}

/**
 * Login and obtain JWT tokens
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Object|null} Token object with access and refresh tokens, or null on failure
 */
export function login(email, password) {
  const payload = JSON.stringify({
    email: email,
    password: password,
  });

  const response = http.post(apiUrl("/auth/login"), payload, {
    headers: defaultHeaders(),
    tags: { name: "auth_login" },
  });

  const success = check(response, {
    "login status is 200": (r) => r.status === 200,
    "login response has token": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.token || body.access_token;
      } catch {
        return false;
      }
    },
  });

  if (!success) {
    console.error(`Login failed for ${email}: ${response.status} - ${response.body}`);
    return null;
  }

  try {
    const body = JSON.parse(response.body);
    const tokens = {
      accessToken: body.token || body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: Date.now() + (body.expires_in || 3600) * 1000,
    };

    // Store tokens for this VU
    tokenStore[__VU] = tokens;
    return tokens;
  } catch (e) {
    console.error(`Failed to parse login response: ${e.message}`);
    return null;
  }
}

/**
 * Login with test user credentials
 * @param {string} userType - Type of test user ('standard', 'premium', 'admin')
 * @returns {Object|null} Token object or null on failure
 */
export function loginTestUser(userType = "standard") {
  const user = testUsers[userType] || testUsers.standard;
  return login(user.email, user.password);
}

/**
 * Get current access token for the VU
 * Automatically refreshes if expired
 * @returns {string|null} Access token or null if not authenticated
 */
export function getAccessToken() {
  const tokens = tokenStore[__VU];
  if (!tokens) {
    return null;
  }

  // Check if token is expired or about to expire (within 30 seconds)
  if (tokens.expiresAt && tokens.expiresAt - Date.now() < 30000) {
    const refreshed = refreshToken();
    if (refreshed) {
      return refreshed.accessToken;
    }
    return null;
  }

  return tokens.accessToken;
}

/**
 * Get authorization headers with current token
 * @returns {Object} Headers object with Authorization
 */
export function getAuthHeaders() {
  const token = getAccessToken();
  if (!token) {
    console.warn("No access token available, using default headers");
    return defaultHeaders();
  }
  return authHeaders(token);
}

/**
 * Refresh the access token using refresh token
 * @returns {Object|null} New token object or null on failure
 */
export function refreshToken() {
  const tokens = tokenStore[__VU];
  if (!tokens || !tokens.refreshToken) {
    console.warn("No refresh token available");
    return null;
  }

  const payload = JSON.stringify({
    refresh_token: tokens.refreshToken,
  });

  const response = http.post(apiUrl("/auth/refresh"), payload, {
    headers: defaultHeaders(),
    tags: { name: "auth_refresh" },
  });

  const success = check(response, {
    "refresh status is 200": (r) => r.status === 200,
    "refresh response has token": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.token || body.access_token;
      } catch {
        return false;
      }
    },
  });

  if (!success) {
    console.error(`Token refresh failed: ${response.status}`);
    // Clear stored tokens
    delete tokenStore[__VU];
    return null;
  }

  try {
    const body = JSON.parse(response.body);
    const newTokens = {
      accessToken: body.token || body.access_token,
      refreshToken: body.refresh_token || tokens.refreshToken,
      expiresAt: Date.now() + (body.expires_in || 3600) * 1000,
    };

    tokenStore[__VU] = newTokens;
    return newTokens;
  } catch (e) {
    console.error(`Failed to parse refresh response: ${e.message}`);
    return null;
  }
}

/**
 * Logout and clear tokens
 * @returns {boolean} True if logout was successful
 */
export function logout() {
  const token = getAccessToken();
  if (!token) {
    return true;
  }

  const response = http.del(apiUrl("/auth/logout"), null, {
    headers: authHeaders(token),
    tags: { name: "auth_logout" },
  });

  const success = check(response, {
    "logout status is 200 or 204": (r) => r.status === 200 || r.status === 204,
  });

  // Clear stored tokens regardless of response
  delete tokenStore[__VU];

  return success;
}

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @returns {Object|null} User object or null on failure
 */
export function register(userData) {
  const payload = JSON.stringify({
    email: userData.email,
    password: userData.password,
    username: userData.username || userData.email.split("@")[0],
  });

  const response = http.post(apiUrl("/auth/register"), payload, {
    headers: defaultHeaders(),
    tags: { name: "auth_register" },
  });

  const success = check(response, {
    "register status is 201 or 200": (r) => r.status === 201 || r.status === 200,
  });

  if (!success) {
    console.error(`Registration failed: ${response.status} - ${response.body}`);
    return null;
  }

  try {
    return JSON.parse(response.body);
  } catch (e) {
    return { success: true };
  }
}

/**
 * Setup function for authenticated tests
 * Should be called in the test setup phase
 * @param {string} userType - Type of test user to use
 * @returns {Object} Setup data including tokens
 */
export function setupAuth(userType = "standard") {
  const tokens = loginTestUser(userType);
  if (!tokens) {
    fail(`Failed to authenticate test user: ${userType}`);
  }
  return { tokens };
}

export default {
  testUsers,
  generateTestUser,
  login,
  loginTestUser,
  getAccessToken,
  getAuthHeaders,
  refreshToken,
  logout,
  register,
  setupAuth,
};
