/**
 * LocationPicker - Map-based location selection component
 *
 * Requirements: FR-2 (AC-2.3)
 * Allows manual location selection when GPS is unavailable or inaccurate
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';

import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';

import MapView, { Marker, Region, PROVIDER_DEFAULT } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Location } from '../../types/photo';

// Default location: Shiojiri, Nagano, Japan
const DEFAULT_LOCATION: Location = {
  latitude: 36.1157,
  longitude: 137.9644,
};

// Default map delta (zoom level)
const DEFAULT_DELTA = {
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

interface LocationPickerProps {
  /**
   * Initial location to display
   */
  initialLocation?: Location;
  /**
   * Callback when location is selected
   */
  onLocationSelect: (location: Location) => void;
  /**
   * Whether the picker is visible
   */
  visible: boolean;
  /**
   * Callback to close the picker
   */
  onClose: () => void;
  /**
   * Optional title for the picker
   */
  title?: string;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  initialLocation,
  onLocationSelect,
  visible,
  onClose,
  title = 'Select Location',
}) => {
  const mapRef = useRef<MapView>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location>(
    initialLocation ?? DEFAULT_LOCATION
  );
  const [isLoading, setIsLoading] = useState(false);
  const [region, setRegion] = useState<Region>({
    ...DEFAULT_LOCATION,
    ...DEFAULT_DELTA,
  });

  // Update selected location when initial location changes
  useEffect(() => {
    if (initialLocation) {
      setSelectedLocation(initialLocation);
      setRegion({
        ...initialLocation,
        ...DEFAULT_DELTA,
      });
    }
  }, [initialLocation]);

  /**
   * Handle map press to select location
   */
  const handleMapPress = useCallback(
    (event: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
      const { latitude, longitude } = event.nativeEvent.coordinate;
      setSelectedLocation({ latitude, longitude });
    },
    []
  );

  /**
   * Handle marker drag end
   */
  const handleMarkerDragEnd = useCallback(
    (event: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
      const { latitude, longitude } = event.nativeEvent.coordinate;
      setSelectedLocation({ latitude, longitude });
    },
    []
  );

  /**
   * Handle region change
   */
  const handleRegionChange = useCallback((newRegion: Region) => {
    setRegion(newRegion);
  }, []);

  /**
   * Handle confirm button press
   */
  const handleConfirm = useCallback(() => {
    setIsLoading(true);
    // Small delay for better UX
    setTimeout(() => {
      onLocationSelect(selectedLocation);
      setIsLoading(false);
      onClose();
    }, 200);
  }, [selectedLocation, onLocationSelect, onClose]);

  /**
   * Center map on current location
   */
  const handleCenterOnLocation = useCallback(() => {
    if (mapRef.current && selectedLocation) {
      mapRef.current.animateToRegion({
        ...selectedLocation,
        ...DEFAULT_DELTA,
      });
    }
  }, [selectedLocation]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel location selection"
          >
            <Text style={styles.headerButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <TouchableOpacity
            style={[styles.headerButton, styles.confirmButton]}
            onPress={handleConfirm}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Confirm location selection"
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Text style={[styles.headerButtonText, styles.confirmButtonText]}>
                Confirm
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionsText}>
            Tap on the map or drag the marker to set the location where you saw the rainbow.
          </Text>
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            initialRegion={region}
            onRegionChangeComplete={handleRegionChange}
            onPress={handleMapPress}
            showsUserLocation
            showsMyLocationButton={false}
            showsCompass
            showsScale
          >
            <Marker
              coordinate={selectedLocation}
              draggable
              onDragEnd={handleMarkerDragEnd}
              title="Rainbow location"
              description="Drag to adjust"
            />
          </MapView>

          {/* Center on location button */}
          <TouchableOpacity
            style={styles.centerButton}
            onPress={handleCenterOnLocation}
            accessibilityRole="button"
            accessibilityLabel="Center map on selected location"
          >
            <Text style={styles.centerButtonText}>Center</Text>
          </TouchableOpacity>
        </View>

        {/* Location info */}
        <View style={styles.locationInfo}>
          <Text style={styles.locationLabel}>Selected Location:</Text>
          <Text style={styles.locationCoords}>
            {selectedLocation.latitude.toFixed(6)}° N, {selectedLocation.longitude.toFixed(6)}° E
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 70,
  },
  headerButtonText: {
    fontSize: 16,
    color: '#666',
  },
  confirmButton: {
    alignItems: 'flex-end',
  },
  confirmButtonText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  instructions: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f5f5f5',
  },
  instructionsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  centerButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  centerButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
  },
  locationInfo: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  locationLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  locationCoords: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
});
