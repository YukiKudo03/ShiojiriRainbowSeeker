/**
 * Unit Tests for userService
 *
 * Tests user profile management: fetching profile, updating profile,
 * and display name validation.
 * apiClient is fully mocked.
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

import { apiClient } from '../../src/services/apiClient';
import {
  getMyProfile,
  updateMyProfile,
  validateDisplayName,
} from '../../src/services/userService';

const mockedApiClient = jest.mocked(apiClient);

/**
 * Helper: create a raw API profile response (snake_case)
 */
const createRawProfile = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-123',
  email: 'test@shiojiri.jp',
  display_name: 'Test User',
  profile_image_url: 'https://example.com/avatar.jpg',
  role: 'user' as const,
  locale: 'ja' as const,
  confirmed: true,
  created_at: '2025-01-01T00:00:00Z',
  stats: {
    photos_count: 10,
    total_likes_received: 42,
  },
  ...overrides,
});

describe('userService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------
  // getMyProfile
  // -------------------------------------------------------------------
  describe('getMyProfile', () => {
    it('should fetch profile and transform snake_case to camelCase', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: { data: createRawProfile() },
      });

      const profile = await getMyProfile();

      expect(mockedApiClient.get).toHaveBeenCalledWith('/users/me');
      expect(profile).toEqual({
        id: 'user-123',
        email: 'test@shiojiri.jp',
        displayName: 'Test User',
        profileImageUrl: 'https://example.com/avatar.jpg',
        role: 'user',
        locale: 'ja',
        confirmed: true,
        createdAt: '2025-01-01T00:00:00Z',
        stats: {
          photosCount: 10,
          totalLikesReceived: 42,
        },
      });
    });

    it('should propagate API errors', async () => {
      mockedApiClient.get.mockRejectedValue(new Error('Unauthorized'));

      await expect(getMyProfile()).rejects.toThrow('Unauthorized');
    });
  });

  // -------------------------------------------------------------------
  // updateMyProfile
  // -------------------------------------------------------------------
  describe('updateMyProfile', () => {
    it('should send FormData with display name and transform response', async () => {
      mockedApiClient.patch.mockResolvedValue({
        data: {
          data: createRawProfile({ display_name: 'Updated Name' }),
        },
      });

      const profile = await updateMyProfile({ displayName: 'Updated Name' });

      expect(mockedApiClient.patch).toHaveBeenCalledWith(
        '/users/me',
        expect.any(FormData),
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      expect(profile.displayName).toBe('Updated Name');
      expect(profile.stats.photosCount).toBe(10);
    });

    it('should include profile image in FormData when provided', async () => {
      mockedApiClient.patch.mockResolvedValue({
        data: { data: createRawProfile() },
      });

      await updateMyProfile({
        profileImage: {
          uri: 'file:///photo.jpg',
          type: 'image/jpeg',
          name: 'photo.jpg',
        },
      });

      expect(mockedApiClient.patch).toHaveBeenCalledWith(
        '/users/me',
        expect.any(FormData),
        expect.any(Object)
      );
    });

    it('should propagate API errors', async () => {
      mockedApiClient.patch.mockRejectedValue(new Error('Upload failed'));

      await expect(
        updateMyProfile({ displayName: 'Name' })
      ).rejects.toThrow('Upload failed');
    });
  });

  // -------------------------------------------------------------------
  // validateDisplayName
  // -------------------------------------------------------------------
  describe('validateDisplayName', () => {
    it('should return error for name too short', () => {
      const result = validateDisplayName('AB');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('3');
    });

    it('should return error for name too long', () => {
      const result = validateDisplayName('A'.repeat(31));
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('30');
    });

    it('should return valid for acceptable name', () => {
      const result = validateDisplayName('Valid Name');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});
