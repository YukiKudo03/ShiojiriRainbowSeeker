/**
 * k6 Configuration Helper
 *
 * Provides environment configuration for k6 load tests.
 * Supports multiple environments (local, staging, production).
 */

// Environment configuration
const environments = {
  local: {
    baseUrl: "http://localhost:3000",
    apiVersion: "v1",
  },
  staging: {
    baseUrl: "https://staging-api.shiojiri-rainbow.example.com",
    apiVersion: "v1",
  },
  production: {
    baseUrl: "https://api.shiojiri-rainbow.example.com",
    apiVersion: "v1",
  },
};

// Get current environment from k6 options or default to local
const ENV = __ENV.K6_ENV || "local";

/**
 * Get configuration for the current environment
 * @returns {Object} Environment configuration
 */
export function getConfig() {
  const config = environments[ENV] || environments.local;
  return {
    ...config,
    env: ENV,
    apiBaseUrl: `${config.baseUrl}/api/${config.apiVersion}`,
  };
}

/**
 * Build full API URL for an endpoint
 * @param {string} endpoint - API endpoint path (e.g., '/photos')
 * @returns {string} Full API URL
 */
export function apiUrl(endpoint) {
  const config = getConfig();
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${config.apiBaseUrl}${cleanEndpoint}`;
}

/**
 * Get base URL for the environment
 * @returns {string} Base URL
 */
export function getBaseUrl() {
  return getConfig().baseUrl;
}

/**
 * Default headers for API requests
 * @returns {Object} Headers object
 */
export function defaultHeaders() {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/**
 * Headers with authentication
 * @param {string} token - JWT access token
 * @returns {Object} Headers object with Authorization
 */
export function authHeaders(token) {
  return {
    ...defaultHeaders(),
    Authorization: `Bearer ${token}`,
  };
}

// Performance thresholds based on NFR-2 requirements
export const thresholds = {
  // API response time: p95 < 200ms
  http_req_duration: ["p(95)<200", "p(99)<500", "avg<100"],
  // Error rate: < 1%
  http_req_failed: ["rate<0.01"],
  // Minimum throughput
  http_reqs: ["rate>100"],
};

// Extended thresholds for specific scenarios
export const photoUploadThresholds = {
  // Image upload: < 3 seconds
  "http_req_duration{name:photo_upload}": ["p(95)<3000"],
};

export const mapThresholds = {
  // Map loading: < 2 seconds
  "http_req_duration{name:map_markers}": ["p(95)<2000"],
  "http_req_duration{name:map_clusters}": ["p(95)<2000"],
  "http_req_duration{name:map_heatmap}": ["p(95)<2000"],
};

export default {
  getConfig,
  apiUrl,
  getBaseUrl,
  defaultHeaders,
  authHeaders,
  thresholds,
  photoUploadThresholds,
  mapThresholds,
};
