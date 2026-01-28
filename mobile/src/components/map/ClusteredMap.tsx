/**
 * ClusteredMap - Interactive map with marker clustering
 *
 * Displays rainbow photo locations with automatic clustering based on zoom level.
 * Uses react-native-map-clustering for supercluster implementation.
 *
 * Accessibility features (WCAG 2.1 AA):
 * - Clear accessibility labels for markers and clusters
 * - Screen reader support for all map elements
 * - Minimum touch target size 44x44pt
 *
 * Requirements: FR-5 (AC-5.1, AC-5.3, AC-5.5)
 */

import React, { useCallback, useMemo, useRef } from 'react';

import { StyleSheet, View, Text, Platform } from 'react-native';

import { Image } from 'expo-image';
import ClusterMapView from 'react-native-map-clustering';
import MapView, {
  Marker,
  type Region,
  PROVIDER_GOOGLE,
} from 'react-native-maps';

import { DEFAULT_REGION } from '../../services/mapService';
import { accessibleColors, MIN_TOUCH_TARGET_SIZE } from '../../utils/accessibility';

import type { MapMarker, MapRegion } from '../../services/mapService';

// ============================================
// Types
// ============================================

interface ClusteredMapProps {
  /** Array of markers to display */
  markers: MapMarker[];
  /** Initial region for the map */
  initialRegion?: MapRegion;
  /** Callback when map region changes */
  onRegionChange?: (region: MapRegion) => void;
  /** Callback when a marker is pressed */
  onMarkerPress?: (marker: MapMarker) => void;
  /** Callback when a cluster is pressed */
  onClusterPress?: (markers: MapMarker[]) => void;
  /** Callback when map is long pressed - FR-13 (AC-13.6) */
  onLongPress?: (event: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => void;
  /** Whether to show user location */
  showsUserLocation?: boolean;
  /** Reference to the map view */
  mapRef?: React.RefObject<MapView | null>;
  /** Loading state */
  isLoading?: boolean;
  /** Children to render inside the map (e.g., heatmap overlay) */
  children?: React.ReactNode;
}

interface ClusterMarkerProps {
  /** Number of markers in the cluster */
  count: number;
  /** Cluster ID for accessibility */
  clusterId: string;
}

// ============================================
// Cluster Marker Component
// ============================================

/**
 * Custom cluster marker displaying count
 * Memoized for performance optimization
 */
const ClusterMarkerComponent: React.FC<ClusterMarkerProps> = ({ count, clusterId }) => {
  // Determine cluster size category for styling
  const sizeCategory = useMemo(() => {
    if (count >= 100) return 'large';
    if (count >= 20) return 'medium';
    return 'small';
  }, [count]);

  const containerStyle = useMemo(
    () => [
      styles.clusterContainer,
      sizeCategory === 'large' && styles.clusterContainerLarge,
      sizeCategory === 'medium' && styles.clusterContainerMedium,
    ],
    [sizeCategory]
  );

  return (
    <View
      style={containerStyle}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`${count}件の虹の写真がこのエリアにあります`}
      accessibilityHint="タップしてズームイン"
      testID={`cluster-${clusterId}`}
    >
      <Text style={styles.clusterText} accessible={false}>
        {count >= 100 ? '99+' : count}
      </Text>
    </View>
  );
};

const ClusterMarker = React.memo(ClusterMarkerComponent);

// ============================================
// Photo Marker Component
// ============================================

interface PhotoMarkerProps {
  marker: MapMarker;
  onPress: (marker: MapMarker) => void;
}

/**
 * Custom marker showing photo thumbnail
 * Memoized for performance optimization
 */
const PhotoMarkerComponent: React.FC<PhotoMarkerProps> = ({ marker, onPress }) => {
  const handlePress = useCallback(() => {
    onPress(marker);
  }, [marker, onPress]);

  return (
    <Marker
      key={marker.id}
      coordinate={{
        latitude: marker.latitude,
        longitude: marker.longitude,
      }}
      onPress={handlePress}
      tracksViewChanges={false}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={
        marker.title
          ? `${marker.title}の虹の写真`
          : '虹の写真'
      }
      accessibilityHint="タップしてプレビューを表示"
      testID={`marker-${marker.id}`}
    >
      <View style={styles.markerContainer}>
        <View style={styles.markerImageContainer}>
          <Image
            source={{ uri: marker.thumbnailUrl }}
            style={styles.markerImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        </View>
        <View style={styles.markerPin} />
      </View>
    </Marker>
  );
};

const PhotoMarker = React.memo(PhotoMarkerComponent);

// ============================================
// Main Component
// ============================================

export const ClusteredMap: React.FC<ClusteredMapProps> = ({
  markers,
  initialRegion = DEFAULT_REGION,
  onRegionChange,
  onMarkerPress,
  onClusterPress,
  onLongPress,
  showsUserLocation = true,
  mapRef,
  isLoading = false,
  children,
}) => {
  const internalMapRef = useRef<MapView>(null);
  const effectiveMapRef = mapRef ?? internalMapRef;

  /**
   * Handle region change after user interaction completes
   */
  const handleRegionChangeComplete = useCallback(
    (region: Region) => {
      if (onRegionChange) {
        onRegionChange({
          latitude: region.latitude,
          longitude: region.longitude,
          latitudeDelta: region.latitudeDelta,
          longitudeDelta: region.longitudeDelta,
        });
      }
    },
    [onRegionChange]
  );

  /**
   * Handle marker press
   */
  const handleMarkerPress = useCallback(
    (marker: MapMarker) => {
      if (onMarkerPress) {
        onMarkerPress(marker);
      }
    },
    [onMarkerPress]
  );

  /**
   * Handle cluster press - zoom into the cluster area
   */
  const handleClusterPress = useCallback(
    (_cluster: { geometry: { coordinates: number[] }; properties: { point_count: number } }, clusterMarkers: MapMarker[]) => {
      if (onClusterPress) {
        onClusterPress(clusterMarkers);
      }

      // Zoom into the cluster area
      if (effectiveMapRef.current && clusterMarkers.length > 0) {
        const latitudes = clusterMarkers.map((m) => m.latitude);
        const longitudes = clusterMarkers.map((m) => m.longitude);

        const minLat = Math.min(...latitudes);
        const maxLat = Math.max(...latitudes);
        const minLng = Math.min(...longitudes);
        const maxLng = Math.max(...longitudes);

        const midLat = (minLat + maxLat) / 2;
        const midLng = (minLng + maxLng) / 2;
        const deltaLat = Math.max(maxLat - minLat, 0.01) * 1.5;
        const deltaLng = Math.max(maxLng - minLng, 0.01) * 1.5;

        effectiveMapRef.current.animateToRegion(
          {
            latitude: midLat,
            longitude: midLng,
            latitudeDelta: deltaLat,
            longitudeDelta: deltaLng,
          },
          300
        );
      }
    },
    [onClusterPress, effectiveMapRef]
  );

  /**
   * Render custom cluster marker
   */
  const renderCluster = useCallback(
    (cluster: { id: string; geometry: { coordinates: number[] }; onPress: () => void; properties: { point_count: number }; getExpansionRegion?: () => Region }) => {
      const { geometry, properties, onPress } = cluster;
      const count = properties.point_count;

      return (
        <Marker
          key={`cluster-${cluster.id}`}
          coordinate={{
            latitude: geometry.coordinates[1],
            longitude: geometry.coordinates[0],
          }}
          onPress={onPress}
          tracksViewChanges={false}
        >
          <ClusterMarker count={count} clusterId={cluster.id} />
        </Marker>
      );
    },
    []
  );

  /**
   * Render loading overlay
   */
  const renderLoadingOverlay = useMemo(() => {
    if (!isLoading) return null;

    return (
      <View
        style={styles.loadingOverlay}
        accessible={true}
        accessibilityRole="progressbar"
        accessibilityLabel="地図を読み込み中"
      >
        <View style={styles.loadingIndicator}>
          <Text style={styles.loadingText}>読み込み中...</Text>
        </View>
      </View>
    );
  }, [isLoading]);

  return (
    <View style={styles.container}>
      <ClusterMapView
        ref={effectiveMapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        onRegionChangeComplete={handleRegionChangeComplete}
        onLongPress={onLongPress}
        showsUserLocation={showsUserLocation}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
        rotateEnabled={true}
        pitchEnabled={false}
        toolbarEnabled={false}
        loadingEnabled={true}
        loadingIndicatorColor={accessibleColors.primary}
        // Clustering configuration
        clusterColor={accessibleColors.primary}
        clusterTextColor="#FFFFFF"
        clusterFontFamily={undefined}
        radius={50} // Screen pixel radius for clustering
        extent={512}
        minPoints={2}
        maxZoom={16}
        minZoom={1}
        preserveClusterPressBehavior={true}
        renderCluster={renderCluster}
        onClusterPress={handleClusterPress as never}
        accessible={true}
        accessibilityLabel="塩尻の虹の写真マップ。長押しで地域の統計を表示できます"
        testID="clustered-map"
      >
        {/* Heatmap overlay and other children */}
        {children}
        {/* Photo markers */}
        {markers.map((marker) => (
          <PhotoMarker
            key={marker.id}
            marker={marker}
            onPress={handleMarkerPress}
          />
        ))}
      </ClusterMapView>
      {renderLoadingOverlay}
    </View>
  );
};

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },

  // Marker styles
  markerContainer: {
    alignItems: 'center',
  },
  markerImageContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: accessibleColors.primary,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  markerImage: {
    width: '100%',
    height: '100%',
  },
  markerPin: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: accessibleColors.primary,
    marginTop: -2,
  },

  // Cluster styles
  clusterContainer: {
    width: MIN_TOUCH_TARGET_SIZE,
    height: MIN_TOUCH_TARGET_SIZE,
    borderRadius: MIN_TOUCH_TARGET_SIZE / 2,
    backgroundColor: accessibleColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  clusterContainerMedium: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  clusterContainerLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  clusterText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  // Loading overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIndicator: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingText: {
    fontSize: 14,
    color: accessibleColors.textSecondary,
  },
});

export default ClusteredMap;
