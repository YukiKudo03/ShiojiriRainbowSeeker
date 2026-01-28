/**
 * Map Endpoints Load Test
 *
 * Tests the map-related API endpoints:
 * - GET /api/v1/maps/markers - Get photo markers within bounds
 * - GET /api/v1/maps/clusters - Get clustered markers within bounds
 * - GET /api/v1/maps/heatmap - Get heatmap data within bounds
 *
 * NFR-2 Compliance: Map loading < 2 seconds
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { apiUrl, thresholds, mapThresholds } from "../helpers/config.js";
import { loginTestUser, authHeaders } from "../helpers/auth.js";
import { checkApiResponse } from "../helpers/checks.js";

// Custom metrics for map operations
const mapMarkersSuccessRate = new Rate("map_markers_success");
const mapMarkersDuration = new Trend("map_markers_duration");
const mapClustersSuccessRate = new Rate("map_clusters_success");
const mapClustersDuration = new Trend("map_clusters_duration");
const mapHeatmapSuccessRate = new Rate("map_heatmap_success");
const mapHeatmapDuration = new Trend("map_heatmap_duration");
const mapOverallSuccessRate = new Rate("map_overall_success");

// Test configuration
export const options = {
  scenarios: {
    map_browse: {
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
    ...mapThresholds,
    map_markers_success: ["rate>0.95"],
    map_markers_duration: ["p(95)<2000"], // 2 second threshold for maps
    map_clusters_success: ["rate>0.95"],
    map_clusters_duration: ["p(95)<2000"],
    map_heatmap_success: ["rate>0.95"],
    map_heatmap_duration: ["p(95)<2000"],
    map_overall_success: ["rate>0.95"],
  },
};

// Shiojiri area bounding boxes for testing
const shiojiriBounds = {
  // Main Shiojiri area
  main: {
    north: 36.15,
    south: 35.85,
    east: 138.3,
    west: 137.9,
  },
  // Zoomed in to city center
  center: {
    north: 36.0,
    south: 35.95,
    east: 138.15,
    west: 138.05,
  },
  // Wider Nagano prefecture view
  wide: {
    north: 36.5,
    south: 35.5,
    east: 138.8,
    west: 137.5,
  },
  // Very zoomed in (high zoom level)
  detailed: {
    north: 35.98,
    south: 35.96,
    east: 138.12,
    west: 138.08,
  },
};

// Setup function
export function setup() {
  console.log("Setting up map load test...");
  return {
    testStartTime: new Date().toISOString(),
    bounds: shiojiriBounds,
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
  const bounds = data.bounds;

  group("Map Operations", function () {
    // Simulate typical map browsing behavior
    const boundsTypes = ["main", "center", "wide", "detailed"];
    const randomBoundsType = boundsTypes[Math.floor(Math.random() * boundsTypes.length)];
    const currentBounds = bounds[randomBoundsType];

    // Initial map load - markers
    group("Map Markers", function () {
      testMapMarkers(headers, currentBounds);
    });

    sleep(0.5);

    // Cluster view (typically for wider views)
    group("Map Clusters", function () {
      testMapClusters(headers, bounds.wide);
    });

    sleep(0.5);

    // Heatmap view
    group("Map Heatmap", function () {
      testMapHeatmap(headers, currentBounds);
    });

    sleep(1);

    // Simulate pan/zoom operations
    group("Map Pan/Zoom", function () {
      simulatePanZoom(headers, currentBounds);
    });
  });

  sleep(Math.random() * 2 + 1);
}

/**
 * Test map markers endpoint
 */
function testMapMarkers(headers, bounds) {
  const startTime = new Date().getTime();

  const params = new URLSearchParams({
    north: bounds.north,
    south: bounds.south,
    east: bounds.east,
    west: bounds.west,
  });

  const response = http.get(apiUrl(`/maps/markers?${params.toString()}`), {
    headers: headers,
    tags: { name: "map_markers" },
  });

  const duration = new Date().getTime() - startTime;
  mapMarkersDuration.add(duration);

  const success = check(response, {
    "map markers status is 200": (r) => r.status === 200,
    "map markers is valid JSON": (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
    "map markers response time < 2000ms": (r) => r.timings.duration < 2000,
  });

  mapMarkersSuccessRate.add(success);
  mapOverallSuccessRate.add(success);
  return success;
}

/**
 * Test map clusters endpoint
 */
function testMapClusters(headers, bounds) {
  const startTime = new Date().getTime();

  const params = new URLSearchParams({
    north: bounds.north,
    south: bounds.south,
    east: bounds.east,
    west: bounds.west,
    zoom: 10, // Typical zoom level for clustering
  });

  const response = http.get(apiUrl(`/maps/clusters?${params.toString()}`), {
    headers: headers,
    tags: { name: "map_clusters" },
  });

  const duration = new Date().getTime() - startTime;
  mapClustersDuration.add(duration);

  const success = check(response, {
    "map clusters status is 200": (r) => r.status === 200,
    "map clusters is valid JSON": (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
    "map clusters response time < 2000ms": (r) => r.timings.duration < 2000,
  });

  mapClustersSuccessRate.add(success);
  mapOverallSuccessRate.add(success);
  return success;
}

/**
 * Test map heatmap endpoint
 */
function testMapHeatmap(headers, bounds) {
  const startTime = new Date().getTime();

  const params = new URLSearchParams({
    north: bounds.north,
    south: bounds.south,
    east: bounds.east,
    west: bounds.west,
  });

  const response = http.get(apiUrl(`/maps/heatmap?${params.toString()}`), {
    headers: headers,
    tags: { name: "map_heatmap" },
  });

  const duration = new Date().getTime() - startTime;
  mapHeatmapDuration.add(duration);

  const success = check(response, {
    "map heatmap status is 200": (r) => r.status === 200,
    "map heatmap is valid JSON": (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
    "map heatmap response time < 2000ms": (r) => r.timings.duration < 2000,
  });

  mapHeatmapSuccessRate.add(success);
  mapOverallSuccessRate.add(success);
  return success;
}

/**
 * Simulate map pan and zoom operations
 * This tests rapid-fire requests that happen during user interaction
 */
function simulatePanZoom(headers, startBounds) {
  let currentBounds = { ...startBounds };

  // Simulate 3-5 pan/zoom operations
  const operations = Math.floor(Math.random() * 3) + 3;

  for (let i = 0; i < operations; i++) {
    // Random operation: pan or zoom
    const operation = Math.random() > 0.5 ? "pan" : "zoom";

    if (operation === "pan") {
      // Pan by small amount
      const latOffset = (Math.random() - 0.5) * 0.05;
      const lngOffset = (Math.random() - 0.5) * 0.05;
      currentBounds.north += latOffset;
      currentBounds.south += latOffset;
      currentBounds.east += lngOffset;
      currentBounds.west += lngOffset;
    } else {
      // Zoom in (reduce bounds)
      const zoomFactor = 0.8;
      const centerLat = (currentBounds.north + currentBounds.south) / 2;
      const centerLng = (currentBounds.east + currentBounds.west) / 2;
      const latRange = (currentBounds.north - currentBounds.south) * zoomFactor;
      const lngRange = (currentBounds.east - currentBounds.west) * zoomFactor;
      currentBounds = {
        north: centerLat + latRange / 2,
        south: centerLat - latRange / 2,
        east: centerLng + lngRange / 2,
        west: centerLng - lngRange / 2,
      };
    }

    // Make request for new bounds
    const params = new URLSearchParams({
      north: currentBounds.north,
      south: currentBounds.south,
      east: currentBounds.east,
      west: currentBounds.west,
    });

    const response = http.get(apiUrl(`/maps/markers?${params.toString()}`), {
      headers: headers,
      tags: { name: "map_pan_zoom" },
    });

    const success = check(response, {
      "pan/zoom markers status is 200": (r) => r.status === 200,
      "pan/zoom response time < 2000ms": (r) => r.timings.duration < 2000,
    });

    mapOverallSuccessRate.add(success);

    // Short delay between operations (simulating user interaction speed)
    sleep(0.2);
  }
}

/**
 * Test map with time filters
 */
function testMapWithTimeFilter(headers, bounds) {
  const params = new URLSearchParams({
    north: bounds.north,
    south: bounds.south,
    east: bounds.east,
    west: bounds.west,
    start_date: getDateDaysAgo(7),
    end_date: getDateDaysAgo(0),
  });

  const response = http.get(apiUrl(`/maps/markers?${params.toString()}`), {
    headers: headers,
    tags: { name: "map_time_filter" },
  });

  const success = check(response, {
    "time-filtered map status is 200": (r) => r.status === 200,
    "time-filtered map response time < 2000ms": (r) => r.timings.duration < 2000,
  });

  mapOverallSuccessRate.add(success);
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
  console.log(`Map load test completed. Started at: ${data.testStartTime}`);
}
