/**
 * k6 Common Check Functions
 *
 * Provides reusable check functions for API response validation.
 * Ensures consistent validation across all test scripts.
 */

import { check } from "k6";

/**
 * Check for successful response (2xx status codes)
 * @param {Object} response - k6 HTTP response object
 * @param {string} name - Name for the check (for reporting)
 * @returns {boolean} True if all checks pass
 */
export function checkSuccess(response, name = "request") {
  return check(response, {
    [`${name} status is 2xx`]: (r) => r.status >= 200 && r.status < 300,
  });
}

/**
 * Check for specific status code
 * @param {Object} response - k6 HTTP response object
 * @param {number} expectedStatus - Expected HTTP status code
 * @param {string} name - Name for the check
 * @returns {boolean} True if check passes
 */
export function checkStatus(response, expectedStatus, name = "request") {
  return check(response, {
    [`${name} status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
  });
}

/**
 * Check response time against threshold
 * @param {Object} response - k6 HTTP response object
 * @param {number} maxDuration - Maximum allowed duration in milliseconds
 * @param {string} name - Name for the check
 * @returns {boolean} True if check passes
 */
export function checkResponseTime(response, maxDuration, name = "request") {
  return check(response, {
    [`${name} response time < ${maxDuration}ms`]: (r) =>
      r.timings.duration < maxDuration,
  });
}

/**
 * Check NFR-2 compliance (p95 < 200ms threshold)
 * @param {Object} response - k6 HTTP response object
 * @param {string} name - Name for the check
 * @returns {boolean} True if response time is under 200ms
 */
export function checkNFR2Compliance(response, name = "request") {
  return checkResponseTime(response, 200, name);
}

/**
 * Check that response is valid JSON
 * @param {Object} response - k6 HTTP response object
 * @param {string} name - Name for the check
 * @returns {boolean} True if response is valid JSON
 */
export function checkJsonResponse(response, name = "request") {
  return check(response, {
    [`${name} response is valid JSON`]: (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
  });
}

/**
 * Check that response contains expected field
 * @param {Object} response - k6 HTTP response object
 * @param {string} field - Field name to check for
 * @param {string} name - Name for the check
 * @returns {boolean} True if field exists
 */
export function checkHasField(response, field, name = "request") {
  return check(response, {
    [`${name} has ${field} field`]: (r) => {
      try {
        const body = JSON.parse(r.body);
        return field in body;
      } catch {
        return false;
      }
    },
  });
}

/**
 * Check that response is a non-empty array
 * @param {Object} response - k6 HTTP response object
 * @param {string} name - Name for the check
 * @returns {boolean} True if response is a non-empty array
 */
export function checkNonEmptyArray(response, name = "request") {
  return check(response, {
    [`${name} returns non-empty array`]: (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body) && body.length > 0;
      } catch {
        return false;
      }
    },
  });
}

/**
 * Check that response array has specific field
 * @param {Object} response - k6 HTTP response object
 * @param {string} arrayField - Field containing the array (e.g., 'data', 'photos')
 * @param {string} name - Name for the check
 * @returns {boolean} True if array field exists
 */
export function checkArrayField(response, arrayField, name = "request") {
  return check(response, {
    [`${name} has ${arrayField} array`]: (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body[arrayField]);
      } catch {
        return false;
      }
    },
  });
}

/**
 * Check pagination response structure
 * @param {Object} response - k6 HTTP response object
 * @param {string} name - Name for the check
 * @returns {boolean} True if pagination structure is valid
 */
export function checkPagination(response, name = "request") {
  return check(response, {
    [`${name} has pagination info`]: (r) => {
      try {
        const body = JSON.parse(r.body);
        return (
          "total" in body ||
          "page" in body ||
          "per_page" in body ||
          "total_pages" in body ||
          "meta" in body
        );
      } catch {
        return false;
      }
    },
  });
}

/**
 * Comprehensive API response check
 * Checks status, response time, and JSON validity
 * @param {Object} response - k6 HTTP response object
 * @param {Object} options - Check options
 * @param {number} options.status - Expected status code (default: 200)
 * @param {number} options.maxDuration - Max response time in ms (default: 200)
 * @param {boolean} options.checkJson - Whether to check JSON validity (default: true)
 * @param {string} options.name - Name for checks
 * @returns {boolean} True if all checks pass
 */
export function checkApiResponse(response, options = {}) {
  const {
    status = 200,
    maxDuration = 200,
    checkJson = true,
    name = "request",
  } = options;

  let allPassed = true;

  allPassed = checkStatus(response, status, name) && allPassed;
  allPassed = checkResponseTime(response, maxDuration, name) && allPassed;

  if (checkJson) {
    allPassed = checkJsonResponse(response, name) && allPassed;
  }

  return allPassed;
}

/**
 * Check list endpoint response
 * @param {Object} response - k6 HTTP response object
 * @param {string} dataField - Field containing the data array
 * @param {string} name - Name for the check
 * @returns {boolean} True if all checks pass
 */
export function checkListResponse(response, dataField = "data", name = "list") {
  let allPassed = true;

  allPassed = checkApiResponse(response, { name }) && allPassed;
  allPassed = checkArrayField(response, dataField, name) && allPassed;

  return allPassed;
}

/**
 * Check detail endpoint response
 * @param {Object} response - k6 HTTP response object
 * @param {string} idField - Field name for the ID
 * @param {string} name - Name for the check
 * @returns {boolean} True if all checks pass
 */
export function checkDetailResponse(response, idField = "id", name = "detail") {
  let allPassed = true;

  allPassed = checkApiResponse(response, { name }) && allPassed;
  allPassed = checkHasField(response, idField, name) && allPassed;

  return allPassed;
}

/**
 * Check create endpoint response
 * @param {Object} response - k6 HTTP response object
 * @param {string} name - Name for the check
 * @returns {boolean} True if all checks pass
 */
export function checkCreateResponse(response, name = "create") {
  return checkApiResponse(response, {
    status: 201,
    name,
  });
}

/**
 * Check update endpoint response
 * @param {Object} response - k6 HTTP response object
 * @param {string} name - Name for the check
 * @returns {boolean} True if all checks pass
 */
export function checkUpdateResponse(response, name = "update") {
  return checkApiResponse(response, { name });
}

/**
 * Check delete endpoint response
 * @param {Object} response - k6 HTTP response object
 * @param {string} name - Name for the check
 * @returns {boolean} True if all checks pass
 */
export function checkDeleteResponse(response, name = "delete") {
  return check(response, {
    [`${name} status is 200 or 204`]: (r) =>
      r.status === 200 || r.status === 204,
  });
}

/**
 * Check error response structure
 * @param {Object} response - k6 HTTP response object
 * @param {number} expectedStatus - Expected error status
 * @param {string} name - Name for the check
 * @returns {boolean} True if error response is valid
 */
export function checkErrorResponse(response, expectedStatus, name = "error") {
  let allPassed = true;

  allPassed = checkStatus(response, expectedStatus, name) && allPassed;
  allPassed =
    check(response, {
      [`${name} has error message`]: (r) => {
        try {
          const body = JSON.parse(r.body);
          return "error" in body || "message" in body || "errors" in body;
        } catch {
          return false;
        }
      },
    }) && allPassed;

  return allPassed;
}

export default {
  checkSuccess,
  checkStatus,
  checkResponseTime,
  checkNFR2Compliance,
  checkJsonResponse,
  checkHasField,
  checkNonEmptyArray,
  checkArrayField,
  checkPagination,
  checkApiResponse,
  checkListResponse,
  checkDetailResponse,
  checkCreateResponse,
  checkUpdateResponse,
  checkDeleteResponse,
  checkErrorResponse,
};
