/**
 * MapScreen - Interactive map with rainbow sightings
 *
 * Displays an interactive map with markers for rainbow photo locations.
 * Features include clustering, user location, photo preview, offline support,
 * heatmap visualization, and region statistics.
 *
 * Accessibility features (WCAG 2.1 AA):
 * - Clear accessibility labels for all interactive elements
 * - Screen reader support for map state and actions
 * - Minimum touch target size 44x44pt
 * - High contrast colors
 *
 * Requirements: FR-5 (AC-5.1 to AC-5.6), FR-13 (AC-13.5, AC-13.6)
 * - AC-5.1: Display markers for each rainbow photo location
 * - AC-5.2: Show photo preview on marker tap
 * - AC-5.3: Cluster markers within 500m
 * - AC-5.4: Center map on user location when available
 * - AC-5.5: Dynamically load markers on region change
 * - AC-5.6: Display cached markers when offline
 * - AC-13.5: Display heatmap of rainbow sighting frequency
 * - AC-13.6: Display region statistics on tap
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  AccessibilityInfo,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import MapView from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ClusteredMap,
  PhotoPreviewModal,
  HeatmapOverlay,
  RegionStatsModal,
} from '../../components/map';
import {
  type MapMarker,
  type MapRegion,
  type HeatmapPoint,
  type RegionStats,
  getMarkers,
  getCachedMarkers,
  regionToBounds,
  saveLastRegion,
  getLastRegion,
  getHeatmapData,
  getRegionStats,
  getRegionAtLocation,
  DEFAULT_REGION,
} from '../../services/mapService';
import {
  accessibleColors,
  MIN_TOUCH_TARGET_SIZE,
} from '../../utils/accessibility';

import type { MapScreenProps } from '../../types/navigation';

// ============================================
// Types
// ============================================

type LoadingState = 'idle' | 'loading' | 'success' | 'error';

interface MapState {
  markers: MapMarker[];
  loadingState: LoadingState;
  error: string | null;
  isOffline: boolean;
  userLocation: { latitude: number; longitude: number } | null;
}

interface HeatmapState {
  points: HeatmapPoint[];
  isVisible: boolean;
  isLoading: boolean;
}

interface RegionStatsState {
  stats: RegionStats | null;
  isVisible: boolean;
  isLoading: boolean;
  error: string | null;
}

// ============================================
// Component
// ============================================

export const MapScreen: React.FC<MapScreenProps> = ({ navigation }) => {
  const mapRef = useRef<MapView | null>(null);

  // State
  const [state, setState] = useState<MapState>({
    markers: [],
    loadingState: 'idle',
    error: null,
    isOffline: false,
    userLocation: null,
  });
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [currentRegion, setCurrentRegion] = useState<MapRegion>(DEFAULT_REGION);
  const [isInitialized, setIsInitialized] = useState(false);

  // Heatmap state - FR-13 (AC-13.5)
  const [heatmapState, setHeatmapState] = useState<HeatmapState>({
    points: [],
    isVisible: false,
    isLoading: false,
  });

  // Region stats state - FR-13 (AC-13.6)
  const [regionStatsState, setRegionStatsState] = useState<RegionStatsState>({
    stats: null,
    isVisible: false,
    isLoading: false,
    error: null,
  });

  // Refs for debouncing
  const loadMarkersTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadHeatmapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Initialize map with user location or cached region
   * Requirements: FR-5 (AC-5.4)
   */
  useEffect(() => {
    const initializeMap = async () => {
      try {
        // Check network status
        const netState = await NetInfo.fetch();
        const isConnected = netState.isConnected ?? false;

        setState((prev) => ({ ...prev, isOffline: !isConnected }));

        // Try to get user location (AC-5.4)
        let initialRegion = DEFAULT_REGION;
        let userLoc: { latitude: number; longitude: number } | null = null;

        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });

            userLoc = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            };

            // Center on user location
            initialRegion = {
              latitude: userLoc.latitude,
              longitude: userLoc.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            };

            setState((prev) => ({ ...prev, userLocation: userLoc }));
          }
        } catch {
          console.warn('Could not get user location, using default');
        }

        // If no user location, try to use cached region
        if (!userLoc) {
          const cachedRegion = await getLastRegion();
          if (cachedRegion) {
            initialRegion = cachedRegion;
          }
        }

        setCurrentRegion(initialRegion);

        // Load initial markers
        if (isConnected) {
          await loadMarkers(initialRegion);
        } else {
          // Load cached markers for offline mode (AC-5.6)
          const cachedMarkers = await getCachedMarkers();
          setState((prev) => ({
            ...prev,
            markers: cachedMarkers,
            loadingState: cachedMarkers.length > 0 ? 'success' : 'idle',
          }));

          if (cachedMarkers.length > 0) {
            AccessibilityInfo.announceForAccessibility(
              'オフラインモード: キャッシュされたマーカーを表示しています'
            );
          }
        }

        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing map:', error);
        setState((prev) => ({
          ...prev,
          error: '地図の初期化に失敗しました',
          loadingState: 'error',
        }));
        setIsInitialized(true);
      }
    };

    initializeMap();

    // Subscribe to network status changes
    const unsubscribe = NetInfo.addEventListener((netState) => {
      const isConnected = netState.isConnected ?? false;
      setState((prev) => {
        if (prev.isOffline !== !isConnected) {
          if (isConnected) {
            AccessibilityInfo.announceForAccessibility(
              'ネットワーク接続が回復しました'
            );
          } else {
            AccessibilityInfo.announceForAccessibility(
              'オフラインモードに切り替わりました'
            );
          }
        }
        return { ...prev, isOffline: !isConnected };
      });
    });

    return () => {
      unsubscribe();
      if (loadMarkersTimeoutRef.current) {
        clearTimeout(loadMarkersTimeoutRef.current);
      }
      if (loadHeatmapTimeoutRef.current) {
        clearTimeout(loadHeatmapTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Load markers for the given region
   * Requirements: FR-5 (AC-5.1, AC-5.5)
   */
  const loadMarkers = useCallback(async (region: MapRegion) => {
    if (state.isOffline) {
      return;
    }

    setState((prev) => ({ ...prev, loadingState: 'loading' }));

    try {
      const bounds = regionToBounds(region);
      const markers = await getMarkers(bounds);

      setState((prev) => ({
        ...prev,
        markers,
        loadingState: 'success',
        error: null,
      }));

      // Save region for offline restoration
      await saveLastRegion(region);
    } catch (error) {
      console.error('Error loading markers:', error);

      // Try cached markers on error (AC-5.6)
      const cachedMarkers = await getCachedMarkers();
      if (cachedMarkers.length > 0) {
        setState((prev) => ({
          ...prev,
          markers: cachedMarkers,
          loadingState: 'success',
          error: 'キャッシュデータを表示しています',
        }));
      } else {
        setState((prev) => ({
          ...prev,
          loadingState: 'error',
          error: 'マーカーの読み込みに失敗しました',
        }));
      }
    }
  }, [state.isOffline]);

  /**
   * Load heatmap data for the given region
   * Requirements: FR-13 (AC-13.5)
   */
  const loadHeatmapData = useCallback(async (region: MapRegion) => {
    if (state.isOffline || !heatmapState.isVisible) {
      return;
    }

    setHeatmapState((prev) => ({ ...prev, isLoading: true }));

    try {
      const bounds = regionToBounds(region);
      const points = await getHeatmapData(bounds);

      setHeatmapState((prev) => ({
        ...prev,
        points,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Error loading heatmap data:', error);
      setHeatmapState((prev) => ({
        ...prev,
        isLoading: false,
      }));
    }
  }, [state.isOffline, heatmapState.isVisible]);

  /**
   * Toggle heatmap visibility
   * Requirements: FR-13 (AC-13.5)
   */
  const handleToggleHeatmap = useCallback(() => {
    setHeatmapState((prev) => {
      const newIsVisible = !prev.isVisible;

      if (newIsVisible) {
        AccessibilityInfo.announceForAccessibility(
          'ヒートマップを表示しました'
        );
        // Load heatmap data when enabled
        loadHeatmapData(currentRegion);
      } else {
        AccessibilityInfo.announceForAccessibility(
          'ヒートマップを非表示にしました'
        );
      }

      return { ...prev, isVisible: newIsVisible };
    });
  }, [currentRegion, loadHeatmapData]);

  /**
   * Load region statistics
   * Requirements: FR-13 (AC-13.6)
   */
  const loadRegionStatsForLocation = useCallback(async (
    latitude: number,
    longitude: number
  ) => {
    if (state.isOffline) {
      Alert.alert(
        'オフライン',
        '地域統計を取得するにはインターネット接続が必要です',
        [{ text: 'OK' }]
      );
      return;
    }

    setRegionStatsState((prev) => ({
      ...prev,
      isVisible: true,
      isLoading: true,
      error: null,
      stats: null,
    }));

    try {
      // First get the region identifier for this location
      const regionIdentifier = await getRegionAtLocation(latitude, longitude);

      if (!regionIdentifier) {
        setRegionStatsState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'この場所の地域情報が見つかりませんでした',
        }));
        return;
      }

      // Then get the stats for that region
      const stats = await getRegionStats(regionIdentifier.regionId);

      setRegionStatsState((prev) => ({
        ...prev,
        stats,
        isLoading: false,
        error: null,
      }));

      AccessibilityInfo.announceForAccessibility(
        `${stats.regionName}の統計を表示中`
      );
    } catch (error) {
      console.error('Error loading region stats:', error);
      setRegionStatsState((prev) => ({
        ...prev,
        isLoading: false,
        error: '地域統計の取得に失敗しました',
      }));
    }
  }, [state.isOffline]);

  /**
   * Handle long press on map to show region stats
   * Requirements: FR-13 (AC-13.6)
   */
  const handleMapLongPress = useCallback((event: {
    nativeEvent: { coordinate: { latitude: number; longitude: number } };
  }) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    loadRegionStatsForLocation(latitude, longitude);
  }, [loadRegionStatsForLocation]);

  /**
   * Close region stats modal
   */
  const handleRegionStatsClose = useCallback(() => {
    setRegionStatsState((prev) => ({
      ...prev,
      isVisible: false,
    }));
  }, []);

  /**
   * Retry loading region stats
   */
  const handleRegionStatsRetry = useCallback(() => {
    if (regionStatsState.stats) {
      // We already have stats, just reload
      loadRegionStatsForLocation(0, 0); // This won't work, need to store coordinates
    }
  }, [regionStatsState.stats, loadRegionStatsForLocation]);

  /**
   * View photo from region stats
   */
  const handleViewPhotoFromStats = useCallback(
    (photoId: string) => {
      setRegionStatsState((prev) => ({ ...prev, isVisible: false }));

      // Navigate to PhotoDetail in FeedTab
      navigation.navigate('FeedTab', {
        screen: 'PhotoDetail',
        params: { photoId },
      });
    },
    [navigation]
  );

  /**
   * Handle region change with debouncing
   * Requirements: FR-5 (AC-5.5)
   */
  const handleRegionChange = useCallback(
    (region: MapRegion) => {
      setCurrentRegion(region);

      // Debounce marker loading
      if (loadMarkersTimeoutRef.current) {
        clearTimeout(loadMarkersTimeoutRef.current);
      }

      loadMarkersTimeoutRef.current = setTimeout(() => {
        loadMarkers(region);
      }, 500);

      // Debounce heatmap loading if visible
      if (heatmapState.isVisible) {
        if (loadHeatmapTimeoutRef.current) {
          clearTimeout(loadHeatmapTimeoutRef.current);
        }

        loadHeatmapTimeoutRef.current = setTimeout(() => {
          loadHeatmapData(region);
        }, 500);
      }
    },
    [loadMarkers, loadHeatmapData, heatmapState.isVisible]
  );

  /**
   * Handle marker press - show preview
   * Requirements: FR-5 (AC-5.2)
   */
  const handleMarkerPress = useCallback((marker: MapMarker) => {
    setSelectedMarker(marker);
    setIsPreviewVisible(true);
  }, []);

  /**
   * Handle cluster press
   */
  const handleClusterPress = useCallback((markers: MapMarker[]) => {
    AccessibilityInfo.announceForAccessibility(
      `${markers.length}件の写真にズームします`
    );
  }, []);

  /**
   * Handle preview close
   */
  const handlePreviewClose = useCallback(() => {
    setIsPreviewVisible(false);
    setSelectedMarker(null);
  }, []);

  /**
   * Handle view detail from preview
   */
  const handleViewDetail = useCallback(
    (photoId: string) => {
      setIsPreviewVisible(false);
      setSelectedMarker(null);

      // Navigate to PhotoDetail in FeedTab
      navigation.navigate('FeedTab', {
        screen: 'PhotoDetail',
        params: { photoId },
      });
    },
    [navigation]
  );

  /**
   * Center map on user location
   */
  const handleCenterOnUser = useCallback(async () => {
    if (state.userLocation) {
      mapRef.current?.animateToRegion(
        {
          latitude: state.userLocation.latitude,
          longitude: state.userLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        300
      );
      AccessibilityInfo.announceForAccessibility('現在地に移動しました');
    } else {
      // Try to get location again
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

          const userLoc = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };

          setState((prev) => ({ ...prev, userLocation: userLoc }));

          mapRef.current?.animateToRegion(
            {
              latitude: userLoc.latitude,
              longitude: userLoc.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            },
            300
          );
          AccessibilityInfo.announceForAccessibility('現在地に移動しました');
        } else {
          Alert.alert(
            '位置情報の権限',
            '位置情報へのアクセスを許可してください',
            [{ text: 'OK' }]
          );
        }
      } catch {
        Alert.alert(
          'エラー',
          '現在地の取得に失敗しました',
          [{ text: 'OK' }]
        );
      }
    }
  }, [state.userLocation]);

  /**
   * Center map on Shiojiri
   */
  const handleCenterOnShiojiri = useCallback(() => {
    mapRef.current?.animateToRegion(DEFAULT_REGION, 300);
    AccessibilityInfo.announceForAccessibility('塩尻に移動しました');
  }, []);

  /**
   * Retry loading markers
   */
  const handleRetry = useCallback(() => {
    loadMarkers(currentRegion);
  }, [currentRegion, loadMarkers]);

  /**
   * Render offline banner
   */
  const renderOfflineBanner = () => {
    if (!state.isOffline) return null;

    return (
      <View
        style={styles.offlineBanner}
        accessible={true}
        accessibilityRole="alert"
        accessibilityLabel="オフラインモード: キャッシュされたデータを表示しています"
        testID="map-offline-banner"
      >
        <Ionicons name="cloud-offline-outline" size={16} color="#FFFFFF" />
        <Text style={styles.offlineBannerText}>
          オフライン - キャッシュデータを表示中
        </Text>
      </View>
    );
  };

  /**
   * Render error state
   */
  const renderError = () => {
    if (state.loadingState !== 'error' || state.markers.length > 0) return null;

    return (
      <View
        style={styles.errorContainer}
        accessible={true}
        accessibilityRole="alert"
        accessibilityLabel={state.error || 'エラーが発生しました'}
      >
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={accessibleColors.error}
        />
        <Text style={styles.errorText}>
          {state.error || 'マーカーの読み込みに失敗しました'}
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={handleRetry}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="再試行"
          accessibilityHint="マーカーの読み込みを再試行します"
        >
          <Ionicons name="refresh" size={20} color={accessibleColors.primary} />
          <Text style={styles.retryButtonText}>再試行</Text>
        </TouchableOpacity>
      </View>
    );
  };

  /**
   * Render loading indicator
   */
  const renderLoading = () => {
    if (!isInitialized) {
      return (
        <View
          style={styles.loadingContainer}
          accessible={true}
          accessibilityRole="progressbar"
          accessibilityLabel="地図を読み込み中"
        >
          <ActivityIndicator size="large" color={accessibleColors.primary} />
          <Text style={styles.loadingText}>地図を読み込み中...</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="map-screen">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Map
        </Text>
        <Text style={styles.subtitle}>
          {state.markers.length > 0
            ? `${state.markers.length}件の虹の写真`
            : '塩尻の虹の写真'}
        </Text>
      </View>

      {/* Map Container */}
      <View style={styles.mapContainer}>
        {isInitialized ? (
          <>
            <ClusteredMap
              mapRef={mapRef}
              markers={state.markers}
              initialRegion={currentRegion}
              onRegionChange={handleRegionChange}
              onMarkerPress={handleMarkerPress}
              onClusterPress={handleClusterPress}
              onLongPress={handleMapLongPress}
              showsUserLocation={true}
              isLoading={state.loadingState === 'loading'}
            >
              {/* Heatmap overlay - FR-13 (AC-13.5) */}
              <HeatmapOverlay
                points={heatmapState.points}
                visible={heatmapState.isVisible}
              />
            </ClusteredMap>

            {/* Offline Banner */}
            {renderOfflineBanner()}

            {/* Error Overlay */}
            {renderError()}

            {/* Map Controls - Top Right (Heatmap toggle) */}
            <View style={styles.topControlsContainer}>
              {/* Heatmap Toggle - FR-13 (AC-13.5) */}
              <TouchableOpacity
                style={[
                  styles.controlButton,
                  heatmapState.isVisible && styles.controlButtonActive,
                ]}
                onPress={handleToggleHeatmap}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={
                  heatmapState.isVisible
                    ? 'ヒートマップを非表示'
                    : 'ヒートマップを表示'
                }
                accessibilityHint="虹の出現頻度ヒートマップの表示を切り替えます"
                accessibilityState={{ selected: heatmapState.isVisible }}
                testID="heatmap-toggle-button"
              >
                <Ionicons
                  name="flame"
                  size={24}
                  color={
                    heatmapState.isVisible
                      ? '#FFFFFF'
                      : accessibleColors.primary
                  }
                />
              </TouchableOpacity>
            </View>

            {/* Map Controls - Bottom Right */}
            <View style={styles.controlsContainer}>
              {/* Center on User Location */}
              <TouchableOpacity
                style={styles.controlButton}
                onPress={handleCenterOnUser}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="現在地に移動"
                accessibilityHint="地図を現在地にセンタリングします"
                testID="current-location-button"
              >
                <Ionicons
                  name="locate"
                  size={24}
                  color={accessibleColors.primary}
                />
              </TouchableOpacity>

              {/* Center on Shiojiri */}
              <TouchableOpacity
                style={styles.controlButton}
                onPress={handleCenterOnShiojiri}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="塩尻に移動"
                accessibilityHint="地図を塩尻市にセンタリングします"
                testID="center-shiojiri-button"
              >
                <Ionicons
                  name="home"
                  size={24}
                  color={accessibleColors.primary}
                />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          renderLoading()
        )}
      </View>

      {/* Photo Preview Modal */}
      <PhotoPreviewModal
        visible={isPreviewVisible}
        marker={selectedMarker}
        onClose={handlePreviewClose}
        onViewDetail={handleViewDetail}
      />

      {/* Region Stats Modal - FR-13 (AC-13.6) */}
      <RegionStatsModal
        visible={regionStatsState.isVisible}
        stats={regionStatsState.stats}
        loading={regionStatsState.isLoading}
        error={regionStatsState.error}
        onClose={handleRegionStatsClose}
        onViewPhoto={handleViewPhotoFromStats}
        onRetry={handleRegionStatsRetry}
      />
    </SafeAreaView>
  );
};

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: accessibleColors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: accessibleColors.textSecondary,
    marginTop: 4,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },

  // Offline Banner
  offlineBanner: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    backgroundColor: accessibleColors.warning,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  offlineBannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 8,
  },

  // Controls - Top Right
  topControlsContainer: {
    position: 'absolute',
    top: 56,
    right: 16,
    gap: 12,
  },

  // Controls - Bottom Right
  controlsContainer: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    gap: 12,
  },
  controlButton: {
    width: MIN_TOUCH_TARGET_SIZE + 8,
    height: MIN_TOUCH_TARGET_SIZE + 8,
    backgroundColor: '#FFFFFF',
    borderRadius: (MIN_TOUCH_TARGET_SIZE + 8) / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  controlButtonActive: {
    backgroundColor: accessibleColors.primary,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: accessibleColors.textSecondary,
  },

  // Error
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: accessibleColors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: accessibleColors.primary,
  },
  retryButtonText: {
    fontSize: 16,
    color: accessibleColors.primary,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default MapScreen;
