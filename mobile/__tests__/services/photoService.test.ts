/**
 * Unit Tests for photoService
 *
 * Tests photo capture, gallery selection, location, file utilities, and API calls.
 */

jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  CameraType: { back: 'back', front: 'front' },
  useCameraPermissions: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' })
  ),
  requestMediaLibraryPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' })
  ),
  launchCameraAsync: jest.fn(() =>
    Promise.resolve({
      canceled: false,
      assets: [
        {
          uri: 'file:///photo.jpg',
          width: 1920,
          height: 1080,
          exif: null,
        },
      ],
    })
  ),
  launchImageLibraryAsync: jest.fn(() =>
    Promise.resolve({
      canceled: false,
      assets: [
        {
          uri: 'file:///gallery.jpg',
          width: 3000,
          height: 2000,
          exif: { GPSLatitude: 36.1, GPSLongitude: 137.9 },
        },
      ],
    })
  ),
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' })
  ),
  hasServicesEnabledAsync: jest.fn(() => Promise.resolve(true)),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({
      coords: {
        latitude: 36.115,
        longitude: 137.954,
        accuracy: 10,
        altitude: 750,
        altitudeAccuracy: 5,
      },
    })
  ),
  watchPositionAsync: jest.fn(() => Promise.resolve({ remove: jest.fn() })),
  Accuracy: {
    Lowest: 1,
    Low: 2,
    Balanced: 3,
    High: 4,
    Highest: 5,
    BestForNavigation: 6,
  },
}));

jest.mock('../../src/services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

import {
  requestCameraPermission,
  requestMediaLibraryPermission,
  requestLocationPermission,
  getCurrentLocation,
  watchLocation,
  extractExifData,
  capturePhoto,
  selectFromGallery,
  checkFileSize,
  getMimeType,
  generateFilename,
  prepareUploadRequest,
  uploadPhoto,
  getPhoto,
  getPhotos,
  updatePhoto,
  deletePhoto,
  getPhotoWeather,
  getMyPhotos,
} from '../../src/services/photoService';
import { apiClient } from '../../src/services/apiClient';

const mockedApiClient = jest.mocked(apiClient);

describe('photoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===== Permission functions =====
  describe('requestCameraPermission', () => {
    it('should return true when permission is granted', async () => {
      const result = await requestCameraPermission();
      expect(result).toBe(true);
      expect(ImagePicker.requestCameraPermissionsAsync).toHaveBeenCalled();
    });

    it('should return false when permission is denied', async () => {
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
      });
      const result = await requestCameraPermission();
      expect(result).toBe(false);
    });
  });

  describe('requestMediaLibraryPermission', () => {
    it('should return true when permission is granted', async () => {
      const result = await requestMediaLibraryPermission();
      expect(result).toBe(true);
    });

    it('should return false when denied', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
      });
      const result = await requestMediaLibraryPermission();
      expect(result).toBe(false);
    });
  });

  describe('requestLocationPermission', () => {
    it('should return true when permission is granted', async () => {
      const result = await requestLocationPermission();
      expect(result).toBe(true);
    });

    it('should return false when denied', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
      });
      const result = await requestLocationPermission();
      expect(result).toBe(false);
    });
  });

  // ===== Location functions =====
  describe('getCurrentLocation', () => {
    it('should return location with correct coordinates', async () => {
      const loc = await getCurrentLocation();
      expect(loc).toEqual({
        latitude: 36.115,
        longitude: 137.954,
        accuracy: 10,
        altitude: 750,
        altitudeAccuracy: 5,
      });
    });

    it('should return null when permission is denied', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
      });
      const loc = await getCurrentLocation();
      expect(loc).toBeNull();
    });

    it('should return null when location services are disabled', async () => {
      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValueOnce(false);
      const loc = await getCurrentLocation();
      expect(loc).toBeNull();
    });

    it('should return null on error', async () => {
      (Location.getCurrentPositionAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Location error')
      );
      const loc = await getCurrentLocation();
      expect(loc).toBeNull();
    });
  });

  describe('watchLocation', () => {
    it('should start watching location and return subscription', async () => {
      const callback = jest.fn();
      const subscription = await watchLocation(callback);
      expect(subscription).not.toBeNull();
      expect(Location.watchPositionAsync).toHaveBeenCalledWith(
        expect.objectContaining({ accuracy: Location.Accuracy.High }),
        expect.any(Function)
      );
    });

    it('should return null when permission denied', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
      });
      const result = await watchLocation(jest.fn());
      expect(result).toBeNull();
    });
  });

  describe('extractExifData', () => {
    it('should return null (stub implementation)', async () => {
      const result = await extractExifData();
      expect(result).toBeNull();
    });
  });

  // ===== Photo capture/select =====
  describe('capturePhoto', () => {
    it('should return captured photo with location', async () => {
      const result = await capturePhoto();
      expect(result).toEqual(
        expect.objectContaining({
          uri: 'file:///photo.jpg',
          width: 1920,
          height: 1080,
          location: expect.objectContaining({
            latitude: 36.115,
            longitude: 137.954,
          }),
        })
      );
    });

    it('should return null when user cancels', async () => {
      (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({
        canceled: true,
        assets: [],
      });
      const result = await capturePhoto();
      expect(result).toBeNull();
    });

    it('should throw when camera permission denied', async () => {
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
      });
      await expect(capturePhoto()).rejects.toThrow('Camera permission denied');
    });
  });

  describe('selectFromGallery', () => {
    it('should return selected photo with EXIF location', async () => {
      const result = await selectFromGallery();
      expect(result).toEqual(
        expect.objectContaining({
          uri: 'file:///gallery.jpg',
          width: 3000,
          height: 2000,
          location: expect.objectContaining({
            latitude: 36.1,
            longitude: 137.9,
          }),
        })
      );
    });

    it('should return null when user cancels', async () => {
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
        canceled: true,
        assets: [],
      });
      const result = await selectFromGallery();
      expect(result).toBeNull();
    });

    it('should throw when permission denied', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
      });
      await expect(selectFromGallery()).rejects.toThrow('Media library permission denied');
    });
  });

  // ===== File utilities =====
  describe('checkFileSize', () => {
    it('should return true for small files', async () => {
      const mockBlob = { size: 1024 * 1024 }; // 1MB
      global.fetch = jest.fn().mockResolvedValue({
        blob: () => Promise.resolve(mockBlob),
      }) as any;

      const result = await checkFileSize('file:///small.jpg');
      expect(result).toBe(true);
    });

    it('should return false for files exceeding 10MB', async () => {
      const mockBlob = { size: 11 * 1024 * 1024 }; // 11MB
      global.fetch = jest.fn().mockResolvedValue({
        blob: () => Promise.resolve(mockBlob),
      }) as any;

      const result = await checkFileSize('file:///large.jpg');
      expect(result).toBe(false);
    });

    it('should return true on fetch error', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('fetch error')) as any;
      const result = await checkFileSize('file:///error.jpg');
      expect(result).toBe(true);
    });
  });

  describe('getMimeType', () => {
    it('should return image/jpeg for .jpg', () => {
      expect(getMimeType('photo.jpg')).toBe('image/jpeg');
    });

    it('should return image/jpeg for .jpeg', () => {
      expect(getMimeType('photo.jpeg')).toBe('image/jpeg');
    });

    it('should return image/png for .png', () => {
      expect(getMimeType('photo.png')).toBe('image/png');
    });

    it('should return image/gif for .gif', () => {
      expect(getMimeType('photo.gif')).toBe('image/gif');
    });

    it('should return image/heic for .heic', () => {
      expect(getMimeType('photo.heic')).toBe('image/heic');
    });

    it('should return image/webp for .webp', () => {
      expect(getMimeType('photo.webp')).toBe('image/webp');
    });

    it('should default to image/jpeg for unknown extensions', () => {
      expect(getMimeType('photo.bmp')).toBe('image/jpeg');
    });
  });

  describe('generateFilename', () => {
    it('should generate filename with default jpg extension', () => {
      const filename = generateFilename();
      expect(filename).toMatch(/^rainbow_\d+_[a-z0-9]+\.jpg$/);
    });

    it('should generate filename with specified extension', () => {
      const filename = generateFilename('png');
      expect(filename).toMatch(/^rainbow_\d+_[a-z0-9]+\.png$/);
    });

    it('should generate unique filenames', () => {
      const name1 = generateFilename();
      const name2 = generateFilename();
      expect(name1).not.toBe(name2);
    });
  });

  describe('prepareUploadRequest', () => {
    it('should create upload request from captured photo', () => {
      const photo = {
        uri: 'file:///photo.jpg',
        width: 1920,
        height: 1080,
        timestamp: '2026-01-01T00:00:00Z',
      };
      const metadata = {
        title: 'Rainbow',
        latitude: 36.115,
        longitude: 137.954,
      };

      const request = prepareUploadRequest(photo as any, metadata as any);
      expect(request.image.uri).toBe('file:///photo.jpg');
      expect(request.image.type).toBe('image/jpeg');
      expect(request.image.name).toMatch(/^rainbow_.*\.jpeg$/);
      expect(request.metadata).toBe(metadata);
    });
  });

  // ===== API calls =====
  describe('uploadPhoto', () => {
    it('should POST to /photos with FormData', async () => {
      mockedApiClient.post.mockResolvedValue({
        data: { data: { id: 'photo-1', title: 'Rainbow' } },
      });

      const request = {
        image: { uri: 'file:///photo.jpg', type: 'image/jpeg', name: 'rainbow.jpg' },
        metadata: { title: 'Rainbow', latitude: 36.1, longitude: 137.9 },
      } as any;

      const result = await uploadPhoto(request);
      expect(mockedApiClient.post).toHaveBeenCalledWith(
        '/photos',
        expect.any(FormData),
        expect.objectContaining({ timeout: 60000 })
      );
      expect(result).toEqual({ id: 'photo-1', title: 'Rainbow' });
    });
  });

  describe('getPhoto', () => {
    it('should GET photo by ID', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: { data: { id: 'photo-1', title: 'Rainbow' } },
      });

      const result = await getPhoto('photo-1');
      expect(mockedApiClient.get).toHaveBeenCalledWith('/photos/photo-1');
      expect(result).toEqual({ id: 'photo-1', title: 'Rainbow' });
    });
  });

  describe('getPhotos', () => {
    it('should GET photos with filters', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: { data: [], meta: { total: 0 } },
      });

      await getPhotos({ page: 1, perPage: 10, keyword: 'rainbow' });
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('page=1')
      );
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('per_page=10')
      );
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('keyword=rainbow')
      );
    });

    it('should GET photos without filters', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: { data: [] },
      });

      await getPhotos();
      expect(mockedApiClient.get).toHaveBeenCalledWith('/photos?');
    });
  });

  describe('updatePhoto', () => {
    it('should PATCH photo with metadata', async () => {
      mockedApiClient.patch.mockResolvedValue({
        data: { data: { id: 'photo-1', title: 'Updated' } },
      });

      const result = await updatePhoto('photo-1', { title: 'Updated' } as any);
      expect(mockedApiClient.patch).toHaveBeenCalledWith('/photos/photo-1', {
        photo: { title: 'Updated' },
      });
      expect(result).toEqual({ id: 'photo-1', title: 'Updated' });
    });
  });

  describe('deletePhoto', () => {
    it('should DELETE photo by ID', async () => {
      mockedApiClient.delete.mockResolvedValue({});

      await deletePhoto('photo-1');
      expect(mockedApiClient.delete).toHaveBeenCalledWith('/photos/photo-1');
    });
  });

  describe('getPhotoWeather', () => {
    it('should GET weather data for a photo', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: {
          data: {
            weather_conditions: { temperature: 20 },
            radar_data: { precipitation: 0 },
          },
        },
      });

      const result = await getPhotoWeather('photo-1');
      expect(mockedApiClient.get).toHaveBeenCalledWith('/photos/photo-1/weather');
      expect(result).toEqual({
        weatherConditions: { temperature: 20 },
        radarData: { precipitation: 0 },
      });
    });
  });

  describe('getMyPhotos', () => {
    it('should GET user photos with default page', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: { data: [] },
      });

      await getMyPhotos();
      expect(mockedApiClient.get).toHaveBeenCalledWith('/users/me/photos?page=1');
    });

    it('should GET user photos with specified page', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: { data: [] },
      });

      await getMyPhotos(3);
      expect(mockedApiClient.get).toHaveBeenCalledWith('/users/me/photos?page=3');
    });
  });
});
