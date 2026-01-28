/**
 * Social Features Load Test
 *
 * Tests the social interaction API endpoints:
 * - POST /api/v1/photos/:id/likes - Add like to photo
 * - DELETE /api/v1/photos/:id/likes - Remove like from photo
 * - GET /api/v1/photos/:id/comments - List comments
 * - POST /api/v1/photos/:id/comments - Add comment
 * - DELETE /api/v1/comments/:id - Delete comment
 * - POST /api/v1/reports - Report content
 *
 * NFR-2 Compliance: p95 response time < 200ms
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { apiUrl, thresholds, defaultHeaders } from "../helpers/config.js";
import { loginTestUser, authHeaders } from "../helpers/auth.js";
import { checkApiResponse, checkCreateResponse } from "../helpers/checks.js";

// Custom metrics for social operations
const likeSuccessRate = new Rate("like_success");
const likeDuration = new Trend("like_duration");
const unlikeSuccessRate = new Rate("unlike_success");
const commentListSuccessRate = new Rate("comment_list_success");
const commentListDuration = new Trend("comment_list_duration");
const commentCreateSuccessRate = new Rate("comment_create_success");
const commentCreateDuration = new Trend("comment_create_duration");
const commentDeleteSuccessRate = new Rate("comment_delete_success");
const reportSuccessRate = new Rate("report_success");
const socialOverallSuccessRate = new Rate("social_overall_success");

// Test configuration
export const options = {
  scenarios: {
    social_interactions: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 50 },
        { duration: "2m", target: 100 },
        { duration: "1m", target: 100 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    ...thresholds,
    like_success: ["rate>0.95"],
    like_duration: ["p(95)<200"],
    unlike_success: ["rate>0.95"],
    comment_list_success: ["rate>0.95"],
    comment_list_duration: ["p(95)<200"],
    comment_create_success: ["rate>0.90"],
    comment_create_duration: ["p(95)<200"],
    comment_delete_success: ["rate>0.95"],
    report_success: ["rate>0.90"],
    social_overall_success: ["rate>0.95"],
  },
};

// Sample photo IDs for testing
let samplePhotoIds = [];

// Setup function
export function setup() {
  console.log("Setting up social features load test...");

  // Login and fetch some photo IDs
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

// Main test function
export default function (data) {
  const tokens = loginTestUser("standard");
  if (!tokens) {
    console.error("Failed to authenticate");
    return;
  }

  const headers = authHeaders(tokens.accessToken);
  const photoIds = data.photoIds || [];

  if (photoIds.length === 0) {
    console.warn("No photo IDs available for testing");
    return;
  }

  // Select random photo for interactions
  const randomPhotoId = photoIds[Math.floor(Math.random() * photoIds.length)];

  group("Social Interactions", function () {
    // Like/Unlike flow
    group("Likes", function () {
      testLikeUnlikeFlow(headers, randomPhotoId);
    });

    sleep(0.5);

    // Comments flow
    group("Comments", function () {
      testCommentsFlow(headers, randomPhotoId);
    });

    // Occasionally test reporting (less frequent)
    if (__ITER % 20 === 0) {
      sleep(0.5);
      group("Reports", function () {
        testReport(headers, randomPhotoId);
      });
    }
  });

  sleep(Math.random() * 2 + 1);
}

/**
 * Test like and unlike flow
 */
function testLikeUnlikeFlow(headers, photoId) {
  // Like the photo
  const likeStartTime = new Date().getTime();

  const likeResponse = http.post(
    apiUrl(`/photos/${photoId}/likes`),
    null,
    {
      headers: headers,
      tags: { name: "like_photo" },
    }
  );

  const likeDurationValue = new Date().getTime() - likeStartTime;
  likeDuration.add(likeDurationValue);

  // Like may return 200 (created) or 409/422 (already liked)
  const likeSuccess = check(likeResponse, {
    "like status is 200 or 201 or 422": (r) =>
      r.status === 200 || r.status === 201 || r.status === 422,
    "like response time < 200ms": (r) => r.timings.duration < 200,
  });

  likeSuccessRate.add(likeSuccess);
  socialOverallSuccessRate.add(likeSuccess);

  sleep(0.5);

  // Unlike the photo
  const unlikeResponse = http.del(
    apiUrl(`/photos/${photoId}/likes`),
    null,
    {
      headers: headers,
      tags: { name: "unlike_photo" },
    }
  );

  // Unlike may return 200/204 (removed) or 404 (not liked)
  const unlikeSuccess = check(unlikeResponse, {
    "unlike status is 200 or 204 or 404": (r) =>
      r.status === 200 || r.status === 204 || r.status === 404,
    "unlike response time < 200ms": (r) => r.timings.duration < 200,
  });

  unlikeSuccessRate.add(unlikeSuccess);
  socialOverallSuccessRate.add(unlikeSuccess);
}

/**
 * Test comments flow
 */
function testCommentsFlow(headers, photoId) {
  // List comments
  const listStartTime = new Date().getTime();

  const listResponse = http.get(apiUrl(`/photos/${photoId}/comments`), {
    headers: headers,
    tags: { name: "list_comments" },
  });

  const listDurationValue = new Date().getTime() - listStartTime;
  commentListDuration.add(listDurationValue);

  const listSuccess = check(listResponse, {
    "comment list status is 200": (r) => r.status === 200,
    "comment list is valid JSON": (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
    "comment list response time < 200ms": (r) => r.timings.duration < 200,
  });

  commentListSuccessRate.add(listSuccess);
  socialOverallSuccessRate.add(listSuccess);

  sleep(0.5);

  // Create a comment
  const createStartTime = new Date().getTime();

  const commentPayload = JSON.stringify({
    content: `Load test comment ${Date.now()} - Beautiful rainbow!`,
  });

  const createResponse = http.post(
    apiUrl(`/photos/${photoId}/comments`),
    commentPayload,
    {
      headers: headers,
      tags: { name: "create_comment" },
    }
  );

  const createDurationValue = new Date().getTime() - createStartTime;
  commentCreateDuration.add(createDurationValue);

  const createSuccess = check(createResponse, {
    "create comment status is 200 or 201": (r) =>
      r.status === 200 || r.status === 201,
    "create comment response time < 200ms": (r) => r.timings.duration < 200,
  });

  commentCreateSuccessRate.add(createSuccess);
  socialOverallSuccessRate.add(createSuccess);

  // If comment was created, delete it (cleanup)
  if (createSuccess) {
    try {
      const body = JSON.parse(createResponse.body);
      const commentId = body.id || (body.data && body.data.id);

      if (commentId) {
        sleep(0.5);

        const deleteResponse = http.del(apiUrl(`/comments/${commentId}`), null, {
          headers: headers,
          tags: { name: "delete_comment" },
        });

        const deleteSuccess = check(deleteResponse, {
          "delete comment status is 200 or 204": (r) =>
            r.status === 200 || r.status === 204,
          "delete comment response time < 200ms": (r) =>
            r.timings.duration < 200,
        });

        commentDeleteSuccessRate.add(deleteSuccess);
        socialOverallSuccessRate.add(deleteSuccess);
      }
    } catch (e) {
      console.warn("Could not parse comment ID for deletion");
    }
  }
}

/**
 * Test content reporting
 */
function testReport(headers, photoId) {
  const reportPayload = JSON.stringify({
    reportable_type: "Photo",
    reportable_id: photoId,
    reason: "spam",
    description: "Load test report - please ignore",
  });

  const response = http.post(apiUrl("/reports"), reportPayload, {
    headers: headers,
    tags: { name: "create_report" },
  });

  // Report may return 200/201 (created) or 422 (already reported)
  const success = check(response, {
    "create report status is 200 or 201 or 422": (r) =>
      r.status === 200 || r.status === 201 || r.status === 422,
    "create report response time < 200ms": (r) => r.timings.duration < 200,
  });

  reportSuccessRate.add(success);
  socialOverallSuccessRate.add(success);
}

/**
 * Test rapid-fire likes (simulating popular photo scenario)
 */
export function rapidFireLikes(data) {
  const tokens = loginTestUser("standard");
  if (!tokens) return;

  const headers = authHeaders(tokens.accessToken);
  const photoIds = data.photoIds || [];

  if (photoIds.length === 0) return;

  // Select a random photo
  const photoId = photoIds[Math.floor(Math.random() * photoIds.length)];

  // Rapid fire likes
  for (let i = 0; i < 5; i++) {
    http.post(apiUrl(`/photos/${photoId}/likes`), null, {
      headers: headers,
      tags: { name: "rapid_like" },
    });
    sleep(0.1);
  }
}

/**
 * Test comment thread loading (deep pagination)
 */
function testCommentPagination(headers, photoId) {
  const pages = [1, 2, 3];
  let allSuccess = true;

  for (const page of pages) {
    const response = http.get(
      apiUrl(`/photos/${photoId}/comments?page=${page}&per_page=20`),
      {
        headers: headers,
        tags: { name: "comment_pagination" },
      }
    );

    const success = check(response, {
      [`comment page ${page} status is 200`]: (r) => r.status === 200,
      [`comment page ${page} response time < 200ms`]: (r) =>
        r.timings.duration < 200,
    });

    allSuccess = allSuccess && success;
    sleep(0.2);
  }

  return allSuccess;
}

// Teardown function
export function teardown(data) {
  console.log(`Social features load test completed. Started at: ${data.testStartTime}`);
}
