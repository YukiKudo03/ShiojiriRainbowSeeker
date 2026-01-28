/**
 * Map Service
 *
 * Handles map-related API calls including fetching markers and clusters.
 * Includes offline caching support using AsyncStorage.
 *
 * Requirements: FR-5 (AC-5.1 to AC-5.6)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { apiClient } from './apiClient';

// ============================================
// Types
// ============================================

/**
 * Geographic bounds for querying markers
 */
export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Map marker representing a single photo location
 * Matches backend MapService.marker_data response
 */
export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  thumbnailUrl: string;
  title?: string;
  capturedAt: string;
}

/**
 * Map cluster representing grouped markers
 */
export interface MapCluster {
  id: string;
  latitude: number;
  longitude: number;
  count: number;
  photoIds: string[];
}

/**
 * Heatmap data point for rainbow sighting frequency
 * Requirements: FR-13 (AC-13.5)
 */
export interface HeatmapPoint {
  latitude: number;
  longitude: number;
  weight: number; // Rainbow sighting frequency
}

/**
 * Region statistics for rainbow sightings
 * Requirements: FR-13 (AC-13.6)
 */
export interface RegionStats {
  regionId: string;
  regionName: string;
  totalSightings: number;
  averageSightingsPerMonth: number;
  peakHours: { hour: number; count: number }[];
  peakMonths: { month: number; count: number }[];
  typicalWeather: {
    temperature: { min: number; max: number; avg: number };
    humidity: { min: number; max: number; avg: number };
    conditions: { condition: string; count: number }[];
  };
  lastSighting?: {
    date: string;
    photoId: string;
  };
}

/**
 * Region identifier response from location lookup
 */
export interface RegionIdentifier {
  regionId: string;
  regionName: string;
}

/**
 * Region for map display
 */
export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/**
 * Markers API response
 */
interface MarkersResponse {
  data: MapMarker[];
  meta: {
    total: number;
    bounds: MapBounds;
  };
}

/**
 * Clusters API response
 */
interface ClustersResponse {
  data: MapCluster[];
  meta: {
    zoomLevel: number;
    bounds: MapBounds;
  };
}

/**
 * Heatmap API response
 * Requirements: FR-13 (AC-13.5)
 */
interface HeatmapResponse {
  data: HeatmapPoint[];
  meta: {
    bounds: MapBounds;
    maxWeight: number;
  };
}

/**
 * Region stats API response
 * Requirements: FR-13 (AC-13.6)
 */
interface RegionStatsResponse {
  data: RegionStats;
}

/**
 * Region at location API response
 */
interface RegionAtLocationResponse {
  data: RegionIdentifier | null;
}

// ============================================
// Constants
// ============================================

/**
 * Cache keys for AsyncStorage
 */
const CACHE_KEYS = {
  MARKERS: 'map_markers_cache',
  MARKERS_TIMESTAMP: 'map_markers_timestamp',
  LAST_REGION: 'map_last_region',
};

/**
 * Cache duration in milliseconds (30 minutes)
 */
const CACHE_DURATION_MS = 30 * 60 * 1000;

/**
 * Default location (Shiojiri, Nagano)
 */
export const SHIOJIRI_LOCATION = {
  latitude: 36.1151,
  longitude: 137.9465,
};

/**
 * Default region with zoom level for Shiojiri area
 */
export const DEFAULT_REGION: MapRegion = {
  latitude: SHIOJIRI_LOCATION.latitude,
  longitude: SHIOJIRI_LOCATION.longitude,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

/**
 * Clustering radius in meters (500m as per AC-5.3)
 */
export const CLUSTERING_RADIUS_METERS = 500;

// ============================================
// API Functions
// ============================================

/**
 * Get markers within specified bounds
 * Requirements: FR-5 (AC-5.1, AC-5.5)
 *
 * @param bounds - Geographic bounds to query
 * @returns Array of markers within bounds
 */
export async function getMarkers(bounds: MapBounds): Promise<MapMarker[]> {
  try {
    const params = new URLSearchParams({
      north: bounds.north.toString(),
      south: bounds.south.toString(),
      east: bounds.east.toString(),
      west: bounds.west.toString(),
    });

    const response = await apiClient.get<MarkersResponse>(
      `/maps/markers?${params.toString()}`
    );

    const markers = response.data.data;

    // Cache the markers for offline use (AC-5.6)
    await cacheMarkers(markers);

    return markers;
  } catch (error) {
    console.error('Error fetching markers:', error);

    // Try to return cached markers if available (AC-5.6)
    const cachedMarkers = await getCachedMarkers();
    if (cachedMarkers.length > 0) {
      return filterMarkersByBounds(cachedMarkers, bounds);
    }

    throw error;
  }
}

/**
 * Get clustered markers for the specified bounds and zoom level
 * Requirements: FR-5 (AC-5.3)
 *
 * @param bounds - Geographic bounds to query
 * @param zoomLevel - Current map zoom level
 * @returns Array of clusters
 */
export async function getClusters(
  bounds: MapBounds,
  zoomLevel: number
): Promise<MapCluster[]> {
  try {
    const params = new URLSearchParams({
      north: bounds.north.toString(),
      south: bounds.south.toString(),
      east: bounds.east.toString(),
      west: bounds.west.toString(),
      zoom_level: zoomLevel.toString(),
    });

    const response = await apiClient.get<ClustersResponse>(
      `/maps/clusters?${params.toString()}`
    );

    return response.data.data;
  } catch (error) {
    console.error('Error fetching clusters:', error);
    throw error;
  }
}

/**
 * Get heatmap data for rainbow sighting frequency
 * Requirements: FR-13 (AC-13.5)
 *
 * @param bounds - Geographic bounds to query
 * @returns Array of heatmap points with weights
 */
export async function getHeatmapData(bounds: MapBounds): Promise<HeatmapPoint[]> {
  try {
    const params = new URLSearchParams({
      north: bounds.north.toString(),
      south: bounds.south.toString(),
      east: bounds.east.toString(),
      west: bounds.west.toString(),
    });

    const response = await apiClient.get<HeatmapResponse>(
      `/maps/heatmap?${params.toString()}`
    );

    return response.data.data;
  } catch (error) {
    console.error('Error fetching heatmap data:', error);
    throw error;
  }
}

/**
 * Get statistics for a specific region
 * Requirements: FR-13 (AC-13.6)
 *
 * @param regionId - ID of the region
 * @returns Region statistics
 */
export async function getRegionStats(regionId: string): Promise<RegionStats> {
  try {
    const response = await apiClient.get<RegionStatsResponse>(
      `/maps/regions/${regionId}/stats`
    );

    return response.data.data;
  } catch (error) {
    console.error('Error fetching region stats:', error);
    throw error;
  }
}

/**
 * Get region identifier from coordinates
 * Requirements: FR-13 (AC-13.6)
 *
 * @param latitude - Latitude coordinate
 * @param longitude - Longitude coordinate
 * @returns Region identifier or null if no region found
 */
export async function getRegionAtLocation(
  latitude: number,
  longitude: number
): Promise<RegionIdentifier | null> {
  try {
    const params = new URLSearchParams({
      lat: latitude.toString(),
      lng: longitude.toString(),
    });

    const response = await apiClient.get<RegionAtLocationResponse>(
      `/maps/regions/at-location?${params.toString()}`
    );

    return response.data.data;
  } catch (error) {
    console.error('Error fetching region at location:', error);
    throw error;
  }
}

// ============================================
// Cache Functions
// ============================================

/**
 * Cache markers for offline use
 * Requirements: FR-5 (AC-5.6)
 *
 * @param markers - Markers to cache
 */
async function cacheMarkers(markers: MapMarker[]): Promise<void> {
  try {
    // Get existing cached markers
    const existingMarkers = await getCachedMarkers();

    // Merge new markers with existing ones (avoid duplicates)
    const markerMap = new Map<string, MapMarker>();
    existingMarkers.forEach((marker) => markerMap.set(marker.id, marker));
    markers.forEach((marker) => markerMap.set(marker.id, marker));

    // Limit cache size to prevent storage issues
    const allMarkers = Array.from(markerMap.values());
    const limitedMarkers = allMarkers.slice(-1000); // Keep last 1000 markers

    await AsyncStorage.setItem(CACHE_KEYS.MARKERS, JSON.stringify(limitedMarkers));
    await AsyncStorage.setItem(
      CACHE_KEYS.MARKERS_TIMESTAMP,
      Date.now().toString()
    );
  } catch (error) {
    console.error('Error caching markers:', error);
  }
}

/**
 * Get cached markers
 * Requirements: FR-5 (AC-5.6)
 *
 * @returns Cached markers or empty array
 */
export async function getCachedMarkers(): Promise<MapMarker[]> {
  try {
    const data = await AsyncStorage.getItem(CACHE_KEYS.MARKERS);
    if (!data) {
      return [];
    }

    return JSON.parse(data) as MapMarker[];
  } catch (error) {
    console.error('Error reading cached markers:', error);
    return [];
  }
}

/**
 * Check if marker cache is still valid
 *
 * @returns True if cache is valid
 */
export async function isMarkerCacheValid(): Promise<boolean> {
  try {
    const timestamp = await AsyncStorage.getItem(CACHE_KEYS.MARKERS_TIMESTAMP);
    if (!timestamp) {
      return false;
    }

    const cacheTime = parseInt(timestamp, 10);
    return Date.now() - cacheTime < CACHE_DURATION_MS;
  } catch {
    return false;
  }
}

/**
 * Clear marker cache
 */
export async function clearMarkerCache(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      CACHE_KEYS.MARKERS,
      CACHE_KEYS.MARKERS_TIMESTAMP,
    ]);
  } catch (error) {
    console.error('Error clearing marker cache:', error);
  }
}

/**
 * Save last viewed region for restoring map state
 *
 * @param region - Map region to save
 */
export async function saveLastRegion(region: MapRegion): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEYS.LAST_REGION, JSON.stringify(region));
  } catch (error) {
    console.error('Error saving last region:', error);
  }
}

/**
 * Get last viewed region
 *
 * @returns Last region or null
 */
export async function getLastRegion(): Promise<MapRegion | null> {
  try {
    const data = await AsyncStorage.getItem(CACHE_KEYS.LAST_REGION);
    if (!data) {
      return null;
    }

    return JSON.parse(data) as MapRegion;
  } catch (error) {
    console.error('Error reading last region:', error);
    return null;
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Filter markers by geographic bounds
 *
 * @param markers - Markers to filter
 * @param bounds - Geographic bounds
 * @returns Filtered markers
 */
export function filterMarkersByBounds(
  markers: MapMarker[],
  bounds: MapBounds
): MapMarker[] {
  return markers.filter(
    (marker) =>
      marker.latitude >= bounds.south &&
      marker.latitude <= bounds.north &&
      marker.longitude >= bounds.west &&
      marker.longitude <= bounds.east
  );
}

/**
 * Convert map region to bounds
 *
 * @param region - Map region
 * @returns Geographic bounds
 */
export function regionToBounds(region: MapRegion): MapBounds {
  return {
    north: region.latitude + region.latitudeDelta / 2,
    south: region.latitude - region.latitudeDelta / 2,
    east: region.longitude + region.longitudeDelta / 2,
    west: region.longitude - region.longitudeDelta / 2,
  };
}

/**
 * Calculate approximate zoom level from region
 * Used for clustering decisions
 *
 * @param region - Map region
 * @returns Approximate zoom level (1-20)
 */
export function getZoomLevelFromRegion(region: MapRegion): number {
  const ZOOM_MAX = 20;

  const latRad = (lat: number) => {
    const sin = Math.sin((lat * Math.PI) / 180);
    const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
    return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
  };

  const latFraction =
    (latRad(region.latitude + region.latitudeDelta / 2) -
      latRad(region.latitude - region.latitudeDelta / 2)) /
    Math.PI;
  const lngFraction = region.longitudeDelta / 360;

  const latZoom = Math.log2(1 / latFraction);
  const lngZoom = Math.log2(1 / lngFraction);

  return Math.min(Math.max(Math.floor(Math.min(latZoom, lngZoom)), 1), ZOOM_MAX);
}

/**
 * Calculate distance between two coordinates in meters
 * Uses Haversine formula
 *
 * @param lat1 - First latitude
 * @param lon1 - First longitude
 * @param lat2 - Second latitude
 * @param lon2 - Second longitude
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
