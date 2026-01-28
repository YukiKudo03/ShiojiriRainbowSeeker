/**
 * Photo Service
 *
 * Handles photo capture, gallery selection, location retrieval,
 * image compression, and photo upload/management API calls.
 *
 * Requirements: FR-2 (AC-2.1 to AC-2.9)
 */

import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

import { apiClient } from './apiClient';

import type {
  CapturedPhoto,
  Location as LocationType,
  PhotoUploadRequest,
  PhotoUploadMetadata,
  Photo,
  PhotoDetail,
  PhotoListResponse,
  PhotoFilters,
  ExifData,
} from '../types/photo';

// Maximum file size before compression (10MB as per AC-2.9)
const MAX_FILE_SIZE_BEFORE_COMPRESSION = 10 * 1024 * 1024;

// JPEG quality for compression (80% as per AC-2.5)
const JPEG_QUALITY = 0.8;

/**
 * Request camera permissions
 * @returns Permission granted status
 */
export async function requestCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
}

/**
 * Request media library permissions
 * @returns Permission granted status
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

/**
 * Request location permissions
 * @returns Permission granted status
 */
export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

/**
 * Get current device location
 * Requirements: FR-2 (AC-2.1, AC-2.2)
 * @returns Current location or null if unavailable
 */
export async function getCurrentLocation(): Promise<LocationType | null> {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      return null;
    }

    // Check if location services are enabled
    const isEnabled = await Location.hasServicesEnabledAsync();
    if (!isEnabled) {
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy ?? undefined,
      altitude: location.coords.altitude ?? undefined,
      altitudeAccuracy: location.coords.altitudeAccuracy ?? undefined,
    };
  } catch (error) {
    console.error('Error getting location:', error);
    return null;
  }
}

/**
 * Watch location changes
 * @param callback Function to call on location update
 * @returns Subscription to remove when done
 */
export async function watchLocation(
  callback: (location: LocationType) => void
): Promise<Location.LocationSubscription | null> {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      return null;
    }

    return await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      (location) => {
        callback({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy ?? undefined,
          altitude: location.coords.altitude ?? undefined,
          altitudeAccuracy: location.coords.altitudeAccuracy ?? undefined,
        });
      }
    );
  } catch (error) {
    console.error('Error watching location:', error);
    return null;
  }
}

/**
 * Extract EXIF data from image URI (basic extraction)
 * Requirements: FR-2 (AC-2.4)
 * Note: Full EXIF extraction would require a native module like react-native-exif
 * For now, we rely on the exif property from ImagePicker
 * @returns EXIF data if available
 */
export async function extractExifData(): Promise<ExifData | null> {
  // For now, we return null and rely on the exif property from ImagePicker
  return null;
}

/**
 * Get image info from URI
 * Note: ImagePicker provides this in the result
 * @returns Width and height
 */
export async function getImageInfo(): Promise<{ width: number; height: number } | null> {
  // ImagePicker provides this in the result
  return null;
}

/**
 * Launch camera to capture photo
 * Requirements: FR-2 (AC-2.1, AC-2.2, AC-2.5)
 * @returns Captured photo data or null if cancelled
 */
export async function capturePhoto(): Promise<CapturedPhoto | null> {
  try {
    // Request camera permission
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      throw new Error('Camera permission denied');
    }

    // Launch camera
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: JPEG_QUALITY,
      exif: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];

    // Get current location
    const location = await getCurrentLocation();

    // Extract EXIF GPS if available
    let exifLocation: LocationType | undefined;
    if (asset.exif) {
      const exif = asset.exif as Record<string, unknown>;
      if (exif.GPSLatitude && exif.GPSLongitude) {
        exifLocation = {
          latitude: exif.GPSLatitude as number,
          longitude: exif.GPSLongitude as number,
          altitude: exif.GPSAltitude as number | undefined,
        };
      }
    }

    // Prefer device location over EXIF location for freshness
    const finalLocation = location ?? exifLocation;

    return {
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      location: finalLocation,
      exifData: asset.exif as ExifData | undefined,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error capturing photo:', error);
    throw error;
  }
}

/**
 * Select photo from gallery
 * Requirements: FR-2 (AC-2.4)
 * @returns Selected photo data or null if cancelled
 */
export async function selectFromGallery(): Promise<CapturedPhoto | null> {
  try {
    // Request media library permission
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) {
      throw new Error('Media library permission denied');
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: JPEG_QUALITY,
      exif: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];

    // Try to extract location from EXIF
    let location: LocationType | undefined;
    if (asset.exif) {
      const exif = asset.exif as Record<string, unknown>;
      if (exif.GPSLatitude && exif.GPSLongitude) {
        location = {
          latitude: exif.GPSLatitude as number,
          longitude: exif.GPSLongitude as number,
          altitude: exif.GPSAltitude as number | undefined,
        };
      }
    }

    // Extract timestamp from EXIF if available
    let timestamp: string | undefined;
    if (asset.exif) {
      const exif = asset.exif as Record<string, unknown>;
      if (exif.DateTimeOriginal) {
        timestamp = exif.DateTimeOriginal as string;
      }
    }

    return {
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      location,
      exifData: asset.exif as ExifData | undefined,
      timestamp: timestamp ?? new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error selecting from gallery:', error);
    throw error;
  }
}

/**
 * Check if file size is within limits
 * Requirements: FR-2 (AC-2.9)
 * @param uri Image URI
 * @returns True if within limits
 */
export async function checkFileSize(uri: string): Promise<boolean> {
  try {
    // In React Native, we'd use fetch to get blob size
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob.size <= MAX_FILE_SIZE_BEFORE_COMPRESSION;
  } catch {
    // If we can't check, assume it's okay
    return true;
  }
}

/**
 * Get MIME type from file URI
 * @param uri File URI
 * @returns MIME type
 */
export function getMimeType(uri: string): string {
  const extension = uri.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'heic':
      return 'image/heic';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/jpeg';
  }
}

/**
 * Generate filename for upload
 * @param extension File extension
 * @returns Generated filename
 */
export function generateFilename(extension: string = 'jpg'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `rainbow_${timestamp}_${random}.${extension}`;
}

/**
 * Prepare photo for upload
 * @param photo Captured photo
 * @param metadata Upload metadata
 * @returns Upload request
 */
export function prepareUploadRequest(
  photo: CapturedPhoto,
  metadata: PhotoUploadMetadata
): PhotoUploadRequest {
  const mimeType = getMimeType(photo.uri);
  const extension = mimeType.split('/')[1] || 'jpg';
  const filename = generateFilename(extension);

  return {
    image: {
      uri: photo.uri,
      type: mimeType,
      name: filename,
    },
    metadata,
  };
}

/**
 * Upload photo to server
 * Requirements: FR-2 (AC-2.6, AC-2.7, AC-2.8)
 * @param request Upload request
 * @returns Uploaded photo data
 */
export async function uploadPhoto(request: PhotoUploadRequest): Promise<Photo> {
  const formData = new FormData();

  // Add image file
  // @ts-expect-error - FormData.append accepts this format in React Native
  formData.append('photo[image]', {
    uri: request.image.uri,
    type: request.image.type,
    name: request.image.name,
  });

  // Add metadata
  if (request.metadata.title) {
    formData.append('photo[title]', request.metadata.title);
  }
  if (request.metadata.comment) {
    formData.append('photo[comment]', request.metadata.comment);
  }
  formData.append('photo[latitude]', request.metadata.latitude.toString());
  formData.append('photo[longitude]', request.metadata.longitude.toString());
  if (request.metadata.locationName) {
    formData.append('photo[location_name]', request.metadata.locationName);
  }
  if (request.metadata.capturedAt) {
    formData.append('photo[captured_at]', request.metadata.capturedAt);
  }

  const response = await apiClient.post<{ data: Photo }>('/photos', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 60000, // 60 second timeout for uploads
  });

  return response.data.data;
}

/**
 * Get photo by ID
 * @param photoId Photo ID
 * @returns Photo detail
 */
export async function getPhoto(photoId: string): Promise<PhotoDetail> {
  const response = await apiClient.get<{ data: PhotoDetail }>(
    `/photos/${photoId}`
  );
  return response.data.data;
}

/**
 * Get photos list
 * @param filters Optional filters
 * @returns Photo list response
 */
export async function getPhotos(
  filters?: PhotoFilters
): Promise<PhotoListResponse> {
  const params = new URLSearchParams();

  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.perPage) params.append('per_page', filters.perPage.toString());
  if (filters?.latitude) params.append('latitude', filters.latitude.toString());
  if (filters?.longitude)
    params.append('longitude', filters.longitude.toString());
  if (filters?.radiusKm) params.append('radius_km', filters.radiusKm.toString());
  if (filters?.startDate) params.append('start_date', filters.startDate);
  if (filters?.endDate) params.append('end_date', filters.endDate);
  if (filters?.keyword) params.append('keyword', filters.keyword);
  if (filters?.userId) params.append('user_id', filters.userId);

  const response = await apiClient.get<PhotoListResponse>(
    `/photos?${params.toString()}`
  );
  return response.data;
}

/**
 * Update photo metadata
 * @param photoId Photo ID
 * @param metadata Updated metadata
 * @returns Updated photo
 */
export async function updatePhoto(
  photoId: string,
  metadata: Partial<PhotoUploadMetadata>
): Promise<Photo> {
  const response = await apiClient.patch<{ data: Photo }>(
    `/photos/${photoId}`,
    { photo: metadata }
  );
  return response.data.data;
}

/**
 * Delete photo
 * @param photoId Photo ID
 */
export async function deletePhoto(photoId: string): Promise<void> {
  await apiClient.delete(`/photos/${photoId}`);
}

/**
 * Get weather data for a photo
 * Requirements: FR-13 (AC-13.3, AC-13.4)
 * @param photoId Photo ID
 * @returns Weather conditions and radar data
 */
export async function getPhotoWeather(photoId: string): Promise<{
  weatherConditions: PhotoDetail['weatherConditions'];
  radarData: PhotoDetail['radarData'];
}> {
  const response = await apiClient.get<{
    data: {
      weather_conditions: PhotoDetail['weatherConditions'];
      radar_data: PhotoDetail['radarData'];
    };
  }>(`/photos/${photoId}/weather`);

  return {
    weatherConditions: response.data.data.weather_conditions,
    radarData: response.data.data.radar_data,
  };
}

/**
 * Get user's photos
 * @param page Page number
 * @returns Photo list response
 */
export async function getMyPhotos(page: number = 1): Promise<PhotoListResponse> {
  const response = await apiClient.get<PhotoListResponse>(
    `/users/me/photos?page=${page}`
  );
  return response.data;
}

export { useCameraPermissions, CameraView, CameraType };
