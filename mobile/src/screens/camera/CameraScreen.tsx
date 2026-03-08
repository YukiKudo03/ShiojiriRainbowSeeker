/**
 * CameraScreen - Photo capture and gallery selection screen
 *
 * Requirements: FR-2 (AC-2.1 to AC-2.9)
 * - Camera capture with GPS tagging (AC-2.1, AC-2.2)
 * - Gallery selection with EXIF extraction (AC-2.4)
 * - Location permission handling (AC-2.3)
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';

import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getCurrentLocation,
  watchLocation,
  selectFromGallery,
  checkFileSize,
  requestLocationPermission,
} from '../../services/photoService';

import type { CameraScreenProps } from '../../types/navigation';
import type { Location as LocationType, CapturedPhoto } from '../../types/photo';
import type { LocationSubscription } from 'expo-location';


// Maximum file size (10MB) as per AC-2.9
const MAX_FILE_SIZE_MB = 10;

export const CameraScreen: React.FC<CameraScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();

  // Camera state
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  // Location state
  const [location, setLocation] = useState<LocationType | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocationLoading, setIsLocationLoading] = useState(true);
  const locationSubscription = useRef<LocationSubscription | null>(null);

  // Request location permission and start watching on mount
  useEffect(() => {
    const initLocation = async () => {
      setIsLocationLoading(true);
      setLocationError(null);

      try {
        const hasPermission = await requestLocationPermission();
        if (!hasPermission) {
          setLocationError(t('camera.locationDenied'));
          setIsLocationLoading(false);
          return;
        }

        // Get initial location
        const currentLocation = await getCurrentLocation();
        if (currentLocation) {
          setLocation(currentLocation);
        }

        // Watch for location updates
        const subscription = await watchLocation((newLocation) => {
          setLocation(newLocation);
        });
        if (subscription) {
          locationSubscription.current = subscription;
        }
      } catch (error) {
        console.error('Location error:', error);
        setLocationError(t('camera.locationError'));
      } finally {
        setIsLocationLoading(false);
      }
    };

    initLocation();

    // Cleanup subscription on unmount
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  /**
   * Toggle camera facing (front/back)
   */
  const toggleCameraFacing = useCallback(() => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  }, []);

  /**
   * Navigate to upload screen with photo data
   */
  const navigateToUpload = useCallback(
    (photo: CapturedPhoto) => {
      navigation.navigate('PhotoUpload', {
        photoUri: photo.uri,
        width: photo.width,
        height: photo.height,
        latitude: photo.location?.latitude,
        longitude: photo.location?.longitude,
        timestamp: photo.timestamp,
      });
    },
    [navigation]
  );

  /**
   * Capture photo from camera
   * Requirements: FR-2 (AC-2.1, AC-2.2, AC-2.5)
   */
  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isCapturing) {
      return;
    }

    setIsCapturing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        exif: true,
        skipProcessing: false,
      });

      if (!photo) {
        Alert.alert(t('common.error'), t('camera.captureError'));
        return;
      }

      // Create captured photo object with current location
      const capturedPhoto: CapturedPhoto = {
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
        location: location ?? undefined,
        exifData: photo.exif,
        timestamp: new Date().toISOString(),
      };

      navigateToUpload(capturedPhoto);
    } catch (error) {
      console.error('Capture error:', error);
      Alert.alert(t('common.error'), t('camera.captureRetry'));
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, location, navigateToUpload]);

  /**
   * Select photo from gallery
   * Requirements: FR-2 (AC-2.4)
   */
  const handleSelectFromGallery = useCallback(async () => {
    if (isLoadingGallery) {
      return;
    }

    setIsLoadingGallery(true);

    try {
      const photo = await selectFromGallery();

      if (!photo) {
        // User cancelled selection
        setIsLoadingGallery(false);
        return;
      }

      // Check file size (AC-2.9)
      const isValidSize = await checkFileSize(photo.uri);
      if (!isValidSize) {
        Alert.alert(
          t('camera.fileTooLarge'),
          t('camera.fileTooLargeMessage', { size: MAX_FILE_SIZE_MB })
        );
        setIsLoadingGallery(false);
        return;
      }

      // If no GPS in EXIF and we have current location, offer to use it
      if (!photo.location && location) {
        Alert.alert(
          t('camera.noLocationData'),
          t('camera.noLocationDataMessage'),
          [
            {
              text: t('camera.useCurrentLocation'),
              onPress: () => {
                navigateToUpload({
                  ...photo,
                  location,
                });
              },
            },
            {
              text: t('camera.setLocationManually'),
              onPress: () => navigateToUpload(photo),
            },
          ]
        );
      } else {
        navigateToUpload(photo);
      }
    } catch (error) {
      console.error('Gallery selection error:', error);
      if (error instanceof Error && error.message.includes('permission')) {
        Alert.alert(
          t('camera.permissionRequired'),
          t('camera.permissionRequiredMessage')
        );
      } else {
        Alert.alert(t('common.error'), t('camera.galleryError'));
      }
    } finally {
      setIsLoadingGallery(false);
    }
  }, [isLoadingGallery, location, navigateToUpload]);

  /**
   * Render permission request view
   */
  const renderPermissionRequest = () => (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>{t('camera.permissionTitle')}</Text>
        <Text style={styles.permissionText}>
          {t('camera.permissionText')}
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
          accessibilityRole="button"
          accessibilityLabel={t('camera.grantPermission')}
        >
          <Text style={styles.permissionButtonText}>{t('camera.grantPermission')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.permissionButton, styles.galleryButton]}
          onPress={handleSelectFromGallery}
          accessibilityRole="button"
          accessibilityLabel={t('camera.selectFromGallery')}
        >
          <Text style={styles.permissionButtonText}>
            {t('camera.selectFromGallery')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  /**
   * Render loading state
   */
  const renderLoading = () => (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>{t('camera.initializing')}</Text>
      </View>
    </SafeAreaView>
  );

  // Handle permission states
  if (!permission) {
    return renderLoading();
  }

  if (!permission.granted) {
    return renderPermissionRequest();
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="camera-screen">
      {/* Header with location indicator */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{t('camera.title')}</Text>
          <View style={styles.locationIndicator}>
            {isLocationLoading ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.locationText}>{t('camera.gettingLocation')}</Text>
              </>
            ) : locationError ? (
              <>
                <View style={[styles.locationDot, styles.locationDotError]} />
                <Text style={styles.locationTextError}>{locationError}</Text>
              </>
            ) : location ? (
              <>
                <View style={[styles.locationDot, styles.locationDotActive]} />
                <Text style={styles.locationText}>
                  GPS: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                </Text>
              </>
            ) : (
              <>
                <View style={[styles.locationDot, styles.locationDotInactive]} />
                <Text style={styles.locationText}>{t('camera.locationUnavailable')}</Text>
              </>
            )}
          </View>
        </View>
      </View>

      {/* Camera View */}
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          mode="picture"
        >
          {/* Camera overlay with capture indicator */}
          <View style={styles.cameraOverlay}>
            {isCapturing && (
              <View style={styles.capturingIndicator}>
                <ActivityIndicator size="large" color="#fff" />
              </View>
            )}
          </View>
        </CameraView>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {/* Gallery Button */}
        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleSelectFromGallery}
          disabled={isLoadingGallery || isCapturing}
          accessibilityRole="button"
          accessibilityLabel={t('camera.gallery')}
          accessibilityHint={t('camera.galleryHint')}
          testID="gallery-button"
        >
          {isLoadingGallery ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.controlButtonText}>{t('camera.gallery')}</Text>
          )}
        </TouchableOpacity>

        {/* Capture Button */}
        <TouchableOpacity
          style={[
            styles.captureButton,
            (isCapturing || isLoadingGallery) && styles.captureButtonDisabled,
          ]}
          onPress={handleCapture}
          disabled={isCapturing || isLoadingGallery}
          accessibilityRole="button"
          accessibilityLabel={t('camera.capturePhoto')}
          accessibilityHint={t('camera.captureHint')}
          testID="capture-button"
        >
          <View
            style={[
              styles.captureButtonInner,
              isCapturing && styles.captureButtonInnerCapturing,
            ]}
          />
        </TouchableOpacity>

        {/* Flip Camera Button */}
        <TouchableOpacity
          style={styles.controlButton}
          onPress={toggleCameraFacing}
          disabled={isCapturing || isLoadingGallery}
          accessibilityRole="button"
          accessibilityLabel={t('camera.flipCamera')}
          accessibilityHint={t('camera.flipHint')}
          testID="flip-camera-button"
        >
          <Text style={styles.controlButtonText}>{t('camera.flip')}</Text>
        </TouchableOpacity>
      </View>

      {/* Tips */}
      <View style={styles.tipsContainer}>
        <Text style={styles.tipsText}>
          {t('camera.tip')}
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#fff',
    fontSize: 16,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    minWidth: 200,
    alignItems: 'center',
  },
  galleryButton: {
    backgroundColor: '#333',
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerContent: {
    flexDirection: 'column',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  locationIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  locationDotActive: {
    backgroundColor: '#4CD964',
  },
  locationDotInactive: {
    backgroundColor: '#FF9500',
  },
  locationDotError: {
    backgroundColor: '#FF3B30',
  },
  locationText: {
    fontSize: 12,
    color: '#ccc',
  },
  locationTextError: {
    fontSize: 12,
    color: '#FF9500',
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  capturingIndicator: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 24,
    borderRadius: 16,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  controlButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // Accessibility: minimum touch target
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
  },
  captureButtonInnerCapturing: {
    backgroundColor: '#FF3B30',
  },
  tipsContainer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  tipsText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});
