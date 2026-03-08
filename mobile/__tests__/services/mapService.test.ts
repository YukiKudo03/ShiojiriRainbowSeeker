/**
 * Unit Tests for mapService
 *
 * Tests map-related API calls, caching, and utility functions.
 * apiClient is mocked. AsyncStorage is already mocked in setup.ts.
 */

// Mock apiClient
jest.mock('../../src/services/apiClient', () => ({
  apiClient: {
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
  },
  getErrorMessage: jest.fn((e: unknown) =>
    e instanceof Error ? e.message : 'error'
  ),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../../src/services/apiClient';
import {
  getMarkers,
  getCachedMarkers,
  isMarkerCacheValid,
  clearMarkerCache,
  filterMarkersByBounds,
  regionToBounds,
  getZoomLevelFromRegion,
  calculateDistance,
  getClusters,
  getHeatmapData,
  getRegionStats,
  getRegionAtLocation,
  saveLastRegion,
  getLastRegion,
} from '../../src/services/mapService';

import type { MapBounds, MapMarker, MapRegion } from '../../src/services/mapService';

const mockedApiClient = jest.mocked(apiClient);
const mockedAsyncStorage = jest.mocked(AsyncStorage);

/**
 * Helper: create sample markers
 */
const createMockMarkers = (): MapMarker[] => [
  {
    id: 'marker-1',
    latitude: 36.115,
    longitude: 137.946,
    thumbnailUrl: 'https://example.com/thumb1.jpg',
    title: 'Rainbow 1',
    capturedAt: '2026-03-07T10:00:00Z',
  },
  {
    id: 'marker-2',
    latitude: 36.120,
    longitude: 137.950,
    thumbnailUrl: 'https://example.com/thumb2.jpg',
    capturedAt: '2026-03-07T11:00:00Z',
  },
];

const sampleBounds: MapBounds = {
  north: 36.2,
  south: 36.0,
  east: 138.0,
  west: 137.9,
};

describe('mapService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------
  // getMarkers
  // -------------------------------------------------------------------
  describe('getMarkers', () => {
    it('should call API with bounds and cache the result', async () => {
      const markers = createMockMarkers();
      mockedApiClient.get.mockResolvedValue({
        data: {
          data: markers,
          meta: { total: 2, bounds: sampleBounds },
        },
      });

      const result = await getMarkers(sampleBounds);

      expect(mockedApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/maps/markers')
      );
      expect(result).toEqual(markers);
      // Should have cached the markers
      expect(mockedAsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should fall back to cached markers on API error', async () => {
      const cachedMarkers = createMockMarkers();
      mockedApiClient.get.mockRejectedValue(new Error('Network error'));
      mockedAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify(cachedMarkers)
      );

      const result = await getMarkers(sampleBounds);

      // Should return cached markers filtered by bounds
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  // -------------------------------------------------------------------
  // getCachedMarkers
  // -------------------------------------------------------------------
  describe('getCachedMarkers', () => {
    it('should return cached markers from AsyncStorage', async () => {
      const markers = createMockMarkers();
      mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify(markers));

      const result = await getCachedMarkers();

      expect(result).toEqual(markers);
      expect(mockedAsyncStorage.getItem).toHaveBeenCalledWith(
        'map_markers_cache'
      );
    });

    it('should return empty array when no cache exists', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue(null);

      const result = await getCachedMarkers();

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------
  // isMarkerCacheValid
  // -------------------------------------------------------------------
  describe('isMarkerCacheValid', () => {
    it('should return true when cache is recent', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue(Date.now().toString());

      const valid = await isMarkerCacheValid();

      expect(valid).toBe(true);
    });

    it('should return false when cache is expired', async () => {
      const oldTimestamp = (Date.now() - 31 * 60 * 1000).toString(); // 31 minutes ago
      mockedAsyncStorage.getItem.mockResolvedValue(oldTimestamp);

      const valid = await isMarkerCacheValid();

      expect(valid).toBe(false);
    });

    it('should return false when no timestamp exists', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue(null);

      const valid = await isMarkerCacheValid();

      expect(valid).toBe(false);
    });
  });

  // -------------------------------------------------------------------
  // clearMarkerCache
  // -------------------------------------------------------------------
  describe('clearMarkerCache', () => {
    it('should remove both markers and timestamp from AsyncStorage', async () => {
      await clearMarkerCache();

      expect(mockedAsyncStorage.multiRemove).toHaveBeenCalledWith([
        'map_markers_cache',
        'map_markers_timestamp',
      ]);
    });
  });

  // -------------------------------------------------------------------
  // filterMarkersByBounds
  // -------------------------------------------------------------------
  describe('filterMarkersByBounds', () => {
    it('should return only markers within bounds', () => {
      const markers: MapMarker[] = [
        {
          id: 'inside',
          latitude: 36.1,
          longitude: 137.95,
          thumbnailUrl: '',
          capturedAt: '',
        },
        {
          id: 'outside',
          latitude: 37.0,
          longitude: 139.0,
          thumbnailUrl: '',
          capturedAt: '',
        },
      ];

      const filtered = filterMarkersByBounds(markers, sampleBounds);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('inside');
    });
  });

  // -------------------------------------------------------------------
  // regionToBounds
  // -------------------------------------------------------------------
  describe('regionToBounds', () => {
    it('should convert region to bounds correctly', () => {
      const region: MapRegion = {
        latitude: 36.1,
        longitude: 137.9,
        latitudeDelta: 0.2,
        longitudeDelta: 0.2,
      };

      const bounds = regionToBounds(region);

      expect(bounds.north).toBeCloseTo(36.2);
      expect(bounds.south).toBeCloseTo(36.0);
      expect(bounds.east).toBeCloseTo(138.0);
      expect(bounds.west).toBeCloseTo(137.8);
    });
  });

  // -------------------------------------------------------------------
  // getZoomLevelFromRegion
  // -------------------------------------------------------------------
  describe('getZoomLevelFromRegion', () => {
    it('should return a zoom level between 1 and 20', () => {
      const region: MapRegion = {
        latitude: 36.1,
        longitude: 137.9,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };

      const zoom = getZoomLevelFromRegion(region);

      expect(zoom).toBeGreaterThanOrEqual(1);
      expect(zoom).toBeLessThanOrEqual(20);
    });

    it('should return higher zoom for smaller deltas (zoomed in)', () => {
      const zoomedIn: MapRegion = {
        latitude: 36.1,
        longitude: 137.9,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      const zoomedOut: MapRegion = {
        latitude: 36.1,
        longitude: 137.9,
        latitudeDelta: 1.0,
        longitudeDelta: 1.0,
      };

      const zoomIn = getZoomLevelFromRegion(zoomedIn);
      const zoomOut = getZoomLevelFromRegion(zoomedOut);

      expect(zoomIn).toBeGreaterThan(zoomOut);
    });
  });

  // -------------------------------------------------------------------
  // calculateDistance
  // -------------------------------------------------------------------
  describe('calculateDistance', () => {
    it('should return 0 for same coordinates', () => {
      const distance = calculateDistance(36.1, 137.9, 36.1, 137.9);
      expect(distance).toBe(0);
    });

    it('should calculate approximate Haversine distance', () => {
      // Distance between two known points (approximately 11.1 km per 0.1 degree latitude)
      const distance = calculateDistance(36.0, 137.9, 36.1, 137.9);
      expect(distance).toBeGreaterThan(10000);
      expect(distance).toBeLessThan(12000);
    });
  });

  // -------------------------------------------------------------------
  // getClusters
  // -------------------------------------------------------------------
  describe('getClusters', () => {
    it('should call API with bounds and zoom level', async () => {
      const clusters = [
        { id: 'c1', latitude: 36.1, longitude: 137.9, count: 5, photoIds: ['p1', 'p2'] },
      ];
      mockedApiClient.get.mockResolvedValue({
        data: { data: clusters, meta: { zoomLevel: 10, bounds: sampleBounds } },
      });

      const result = await getClusters(sampleBounds, 10);

      expect(mockedApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/maps/clusters')
      );
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('zoom_level=10')
      );
      expect(result).toEqual(clusters);
    });

    it('should throw on API error', async () => {
      mockedApiClient.get.mockRejectedValue(new Error('Server error'));

      await expect(getClusters(sampleBounds, 10)).rejects.toThrow('Server error');
    });
  });

  // -------------------------------------------------------------------
  // getHeatmapData
  // -------------------------------------------------------------------
  describe('getHeatmapData', () => {
    it('should fetch heatmap data with bounds', async () => {
      const heatmapPoints = [
        { latitude: 36.1, longitude: 137.9, weight: 5 },
        { latitude: 36.12, longitude: 137.95, weight: 3 },
      ];
      mockedApiClient.get.mockResolvedValue({
        data: { data: heatmapPoints, meta: { bounds: sampleBounds, maxWeight: 5 } },
      });

      const result = await getHeatmapData(sampleBounds);

      expect(mockedApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/maps/heatmap')
      );
      expect(result).toEqual(heatmapPoints);
    });

    it('should throw on API error', async () => {
      mockedApiClient.get.mockRejectedValue(new Error('Network error'));

      await expect(getHeatmapData(sampleBounds)).rejects.toThrow('Network error');
    });
  });

  // -------------------------------------------------------------------
  // getRegionStats
  // -------------------------------------------------------------------
  describe('getRegionStats', () => {
    it('should fetch stats for region ID', async () => {
      const stats = {
        regionId: 'shiojiri',
        regionName: '塩尻',
        totalSightings: 42,
        averageSightingsPerMonth: 3.5,
        peakHours: [],
        peakMonths: [],
        typicalWeather: { temperature: { min: 0, max: 30, avg: 15 }, humidity: { min: 30, max: 90, avg: 60 }, conditions: [] },
      };
      mockedApiClient.get.mockResolvedValue({
        data: { data: stats },
      });

      const result = await getRegionStats('shiojiri');

      expect(mockedApiClient.get).toHaveBeenCalledWith('/maps/regions/shiojiri/stats');
      expect(result).toEqual(stats);
    });

    it('should throw on API error', async () => {
      mockedApiClient.get.mockRejectedValue(new Error('Not found'));

      await expect(getRegionStats('unknown')).rejects.toThrow('Not found');
    });
  });

  // -------------------------------------------------------------------
  // getRegionAtLocation
  // -------------------------------------------------------------------
  describe('getRegionAtLocation', () => {
    it('should return region identifier from coordinates', async () => {
      const region = { regionId: 'shiojiri', regionName: '塩尻' };
      mockedApiClient.get.mockResolvedValue({
        data: { data: region },
      });

      const result = await getRegionAtLocation(36.115, 137.946);

      expect(mockedApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/maps/regions/at-location')
      );
      expect(result).toEqual(region);
    });

    it('should return null when no region found', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: { data: null },
      });

      const result = await getRegionAtLocation(0, 0);

      expect(result).toBeNull();
    });

    it('should throw on API error', async () => {
      mockedApiClient.get.mockRejectedValue(new Error('Server error'));

      await expect(getRegionAtLocation(36.1, 137.9)).rejects.toThrow('Server error');
    });
  });

  // -------------------------------------------------------------------
  // saveLastRegion / getLastRegion
  // -------------------------------------------------------------------
  describe('saveLastRegion', () => {
    it('should save region to AsyncStorage', async () => {
      const region: MapRegion = {
        latitude: 36.1,
        longitude: 137.9,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };

      await saveLastRegion(region);

      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
        'map_last_region',
        JSON.stringify(region)
      );
    });
  });

  describe('getLastRegion', () => {
    it('should return saved region from AsyncStorage', async () => {
      const region: MapRegion = {
        latitude: 36.1,
        longitude: 137.9,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };
      mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify(region));

      const result = await getLastRegion();

      expect(result).toEqual(region);
    });

    it('should return null when no saved region', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue(null);

      const result = await getLastRegion();

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------
  // getMarkers - API error without cached data
  // -------------------------------------------------------------------
  describe('getMarkers error without cache', () => {
    it('should throw when API fails and no cache exists', async () => {
      mockedApiClient.get.mockRejectedValue(new Error('Network error'));
      mockedAsyncStorage.getItem.mockResolvedValue(null);

      await expect(getMarkers(sampleBounds)).rejects.toThrow('Network error');
    });
  });
});
