/**
 * Unit Tests for authService
 *
 * Tests the authentication service functions.
 * apiClient and tokenStorage are fully mocked.
 */

import type { User } from '../../src/types/auth';

// Mock apiClient
jest.mock('../../src/services/apiClient', () => ({
  apiClient: {
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  getErrorMessage: jest.fn((error: unknown) => {
    if (error instanceof Error) return error.message;
    return 'An unexpected error occurred';
  }),
}));

// Mock tokenStorage
jest.mock('../../src/services/tokenStorage', () => ({
  storeTokens: jest.fn(() => Promise.resolve()),
  clearTokens: jest.fn(() => Promise.resolve()),
  getRefreshToken: jest.fn(() => Promise.resolve(null)),
  hasValidTokens: jest.fn(() => Promise.resolve(false)),
  storeAccessToken: jest.fn(() => Promise.resolve()),
}));

// AsyncStorage is already mocked in setup.ts, but we need to access the mock
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../../src/services/apiClient';
import {
  storeTokens,
  clearTokens,
  getRefreshToken,
  hasValidTokens,
} from '../../src/services/tokenStorage';
import { authService } from '../../src/services/authService';

const mockedApiClient = jest.mocked(apiClient);
const mockedStoreTokens = jest.mocked(storeTokens);
const mockedClearTokens = jest.mocked(clearTokens);
const mockedGetRefreshToken = jest.mocked(getRefreshToken);
const mockedHasValidTokens = jest.mocked(hasValidTokens);
const mockedAsyncStorage = jest.mocked(AsyncStorage);

/**
 * Helper: create a mock User
 */
const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-abc',
  email: 'tester@shiojiri.jp',
  displayName: 'Tester',
  role: 'user',
  locale: 'ja',
  confirmed: true,
  createdAt: '2025-03-01T00:00:00Z',
  ...overrides,
});

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------
  // login
  // -------------------------------------------------------------------
  describe('login', () => {
    it('should call API with correct payload and store tokens', async () => {
      const mockUser = createMockUser();
      const mockTokens = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
        accessExpiresIn: 3600,
        refreshExpiresAt: '2025-12-31T23:59:59Z',
      };

      mockedApiClient.post.mockResolvedValue({
        data: {
          data: {
            user: mockUser,
            tokens: mockTokens,
          },
        },
      });

      const result = await authService.login(
        'tester@shiojiri.jp',
        'securePass123'
      );

      // Verify API was called correctly
      expect(mockedApiClient.post).toHaveBeenCalledWith('/auth/login', {
        email: 'tester@shiojiri.jp',
        password: 'securePass123',
      });

      // Verify tokens were stored
      expect(mockedStoreTokens).toHaveBeenCalledWith(
        'access-token-123',
        'refresh-token-456',
        3600,
        '2025-12-31T23:59:59Z'
      );

      // Verify user data was stored in AsyncStorage
      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
        'auth_user_data',
        JSON.stringify(mockUser)
      );

      // Verify returned user
      expect(result).toEqual(mockUser);
    });

    it('should propagate API errors', async () => {
      mockedApiClient.post.mockRejectedValue(new Error('Invalid credentials'));

      await expect(
        authService.login('bad@email.com', 'wrong')
      ).rejects.toThrow('Invalid credentials');

      // Tokens should NOT have been stored
      expect(mockedStoreTokens).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------
  // register
  // -------------------------------------------------------------------
  describe('register', () => {
    it('should call API with correct payload', async () => {
      const mockUser = createMockUser({ email: 'new@example.com' });
      const mockResponse = {
        user: mockUser,
        message: 'Please verify your email',
      };

      mockedApiClient.post.mockResolvedValue({
        data: { data: mockResponse },
      });

      const result = await authService.register(
        'new@example.com',
        'password123',
        'New User'
      );

      expect(mockedApiClient.post).toHaveBeenCalledWith('/auth/register', {
        email: 'new@example.com',
        password: 'password123',
        displayName: 'New User',
      });

      expect(result).toEqual(mockResponse);
    });

    it('should not store tokens on registration', async () => {
      mockedApiClient.post.mockResolvedValue({
        data: {
          data: {
            user: createMockUser(),
            message: 'Verify email',
          },
        },
      });

      await authService.register('a@b.com', 'pw', 'User');

      expect(mockedStoreTokens).not.toHaveBeenCalled();
    });

    it('should propagate registration errors', async () => {
      mockedApiClient.post.mockRejectedValue(
        new Error('Email already registered')
      );

      await expect(
        authService.register('dup@example.com', 'pw', 'Dup')
      ).rejects.toThrow('Email already registered');
    });
  });

  // -------------------------------------------------------------------
  // logout
  // -------------------------------------------------------------------
  describe('logout', () => {
    it('should call delete API and clear tokens and user data', async () => {
      mockedApiClient.delete.mockResolvedValue({ data: {} });

      await authService.logout();

      expect(mockedApiClient.delete).toHaveBeenCalledWith('/auth/logout');
      expect(mockedClearTokens).toHaveBeenCalled();
      expect(mockedAsyncStorage.removeItem).toHaveBeenCalledWith(
        'auth_user_data'
      );
    });

    it('should still clear local data even if API call fails', async () => {
      mockedApiClient.delete.mockRejectedValue(new Error('Network error'));

      await authService.logout();

      // Local data should still be cleared
      expect(mockedClearTokens).toHaveBeenCalled();
      expect(mockedAsyncStorage.removeItem).toHaveBeenCalledWith(
        'auth_user_data'
      );
    });
  });

  // -------------------------------------------------------------------
  // refreshToken
  // -------------------------------------------------------------------
  describe('refreshToken', () => {
    it('should send refresh token and store new access token', async () => {
      mockedGetRefreshToken.mockResolvedValue('my-refresh-token');
      mockedApiClient.post.mockResolvedValue({
        data: {
          data: {
            accessToken: 'new-access-token',
            expiresIn: 7200,
          },
        },
      });

      const result = await authService.refreshToken();

      expect(mockedGetRefreshToken).toHaveBeenCalled();
      expect(mockedApiClient.post).toHaveBeenCalledWith('/auth/refresh', {
        refresh_token: 'my-refresh-token',
      });
      expect(result).toBe('new-access-token');
    });

    it('should throw if no refresh token is available', async () => {
      mockedGetRefreshToken.mockResolvedValue(null);

      await expect(authService.refreshToken()).rejects.toThrow(
        'No refresh token available'
      );

      expect(mockedApiClient.post).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------
  // checkAuth
  // -------------------------------------------------------------------
  describe('checkAuth', () => {
    it('should return user when tokens are valid and user data exists', async () => {
      const mockUser = createMockUser();
      mockedHasValidTokens.mockResolvedValue(true);
      mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockUser));

      const result = await authService.checkAuth();

      expect(mockedHasValidTokens).toHaveBeenCalled();
      expect(mockedAsyncStorage.getItem).toHaveBeenCalledWith('auth_user_data');
      expect(result).toEqual(mockUser);
    });

    it('should return null when no valid tokens', async () => {
      mockedHasValidTokens.mockResolvedValue(false);

      const result = await authService.checkAuth();

      expect(result).toBeNull();
      // Should not try to read user data
      expect(mockedAsyncStorage.getItem).not.toHaveBeenCalledWith(
        'auth_user_data'
      );
    });

    it('should return null when tokens exist but no stored user data', async () => {
      mockedHasValidTokens.mockResolvedValue(true);
      mockedAsyncStorage.getItem.mockResolvedValue(null);

      const result = await authService.checkAuth();

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------
  // requestPasswordReset
  // -------------------------------------------------------------------
  describe('requestPasswordReset', () => {
    it('should call API with email', async () => {
      mockedApiClient.post.mockResolvedValue({
        data: {
          data: {
            message: 'If that email exists, a reset link has been sent.',
          },
        },
      });

      const result = await authService.requestPasswordReset(
        'test@shiojiri.jp'
      );

      expect(mockedApiClient.post).toHaveBeenCalledWith(
        '/auth/password/reset',
        { email: 'test@shiojiri.jp' }
      );
      expect(result).toBe(
        'If that email exists, a reset link has been sent.'
      );
    });
  });

  // -------------------------------------------------------------------
  // confirmPasswordReset
  // -------------------------------------------------------------------
  describe('confirmPasswordReset', () => {
    it('should call API with token and new password', async () => {
      const mockUser = createMockUser();
      mockedApiClient.put.mockResolvedValue({
        data: {
          data: {
            user: mockUser,
            message: 'Password reset successfully',
          },
        },
      });

      const result = await authService.confirmPasswordReset(
        'reset-token-xyz',
        'newSecurePass456'
      );

      expect(mockedApiClient.put).toHaveBeenCalledWith(
        '/auth/password/reset',
        { token: 'reset-token-xyz', password: 'newSecurePass456' }
      );
      expect(result).toEqual(mockUser);
    });
  });

  // -------------------------------------------------------------------
  // verifyEmail
  // -------------------------------------------------------------------
  describe('verifyEmail', () => {
    it('should call API with verification token', async () => {
      const mockUser = createMockUser({ confirmed: true });
      mockedApiClient.get.mockResolvedValue({
        data: {
          data: {
            user: mockUser,
            message: 'Email verified',
          },
        },
      });

      const result = await authService.verifyEmail('verify-token-123');

      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/auth/verify_email/verify-token-123'
      );
      expect(result).toEqual(mockUser);
    });
  });
});
