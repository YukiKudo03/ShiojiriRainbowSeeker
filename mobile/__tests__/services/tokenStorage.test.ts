/**
 * Unit Tests for tokenStorage
 *
 * Tests secure token storage operations using expo-secure-store.
 * expo-secure-store is already mocked in setup.ts.
 */

import * as SecureStore from 'expo-secure-store';

import {
  storeAccessToken,
  storeRefreshToken,
  storeTokens,
  getAccessToken,
  getRefreshToken,
  getStoredTokens,
  clearTokens,
  isAccessTokenExpired,
  isRefreshTokenExpired,
  hasValidTokens,
  isSecureStoreAvailable,
} from '../../src/services/tokenStorage';

const mockedSecureStore = jest.mocked(SecureStore);

describe('tokenStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------
  // storeAccessToken
  // -------------------------------------------------------------------
  describe('storeAccessToken', () => {
    it('should store access token and expiration timestamp', async () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      await storeAccessToken('access-token-123', 3600);

      expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
        'auth_access_token',
        'access-token-123'
      );
      expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
        'auth_access_expires',
        (now + 3600 * 1000).toString()
      );

      jest.restoreAllMocks();
    });

    it('should throw when storage fails', async () => {
      mockedSecureStore.setItemAsync.mockRejectedValueOnce(
        new Error('Storage failed')
      );

      await expect(storeAccessToken('token', 3600)).rejects.toThrow(
        'Storage failed'
      );
    });
  });

  // -------------------------------------------------------------------
  // storeRefreshToken
  // -------------------------------------------------------------------
  describe('storeRefreshToken', () => {
    it('should store refresh token and expiration string', async () => {
      await storeRefreshToken('refresh-token-456', '2026-12-31T23:59:59Z');

      expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
        'auth_refresh_token',
        'refresh-token-456'
      );
      expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
        'auth_refresh_expires',
        '2026-12-31T23:59:59Z'
      );
    });
  });

  // -------------------------------------------------------------------
  // storeTokens
  // -------------------------------------------------------------------
  describe('storeTokens', () => {
    it('should store both access and refresh tokens', async () => {
      await storeTokens(
        'access-123',
        'refresh-456',
        3600,
        '2026-12-31T23:59:59Z'
      );

      // Both access and refresh tokens should have been stored
      expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
        'auth_access_token',
        'access-123'
      );
      expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
        'auth_refresh_token',
        'refresh-456'
      );
    });
  });

  // -------------------------------------------------------------------
  // getAccessToken
  // -------------------------------------------------------------------
  describe('getAccessToken', () => {
    it('should return stored access token', async () => {
      mockedSecureStore.getItemAsync.mockResolvedValue('my-access-token');

      const token = await getAccessToken();

      expect(token).toBe('my-access-token');
      expect(mockedSecureStore.getItemAsync).toHaveBeenCalledWith(
        'auth_access_token'
      );
    });

    it('should return null on error', async () => {
      mockedSecureStore.getItemAsync.mockRejectedValue(new Error('Read error'));

      const token = await getAccessToken();

      expect(token).toBeNull();
    });
  });

  // -------------------------------------------------------------------
  // getRefreshToken
  // -------------------------------------------------------------------
  describe('getRefreshToken', () => {
    it('should return stored refresh token', async () => {
      mockedSecureStore.getItemAsync.mockResolvedValue('my-refresh-token');

      const token = await getRefreshToken();

      expect(token).toBe('my-refresh-token');
      expect(mockedSecureStore.getItemAsync).toHaveBeenCalledWith(
        'auth_refresh_token'
      );
    });
  });

  // -------------------------------------------------------------------
  // getStoredTokens
  // -------------------------------------------------------------------
  describe('getStoredTokens', () => {
    it('should return all stored tokens when present', async () => {
      mockedSecureStore.getItemAsync.mockImplementation((key: string) => {
        const store: Record<string, string> = {
          auth_access_token: 'access-token',
          auth_refresh_token: 'refresh-token',
          auth_access_expires: '1700000000000',
          auth_refresh_expires: '2026-12-31T23:59:59Z',
        };
        return Promise.resolve(store[key] ?? null);
      });

      const tokens = await getStoredTokens();

      expect(tokens.accessToken).toBe('access-token');
      expect(tokens.refreshToken).toBe('refresh-token');
      expect(tokens.accessExpiresAt).toBe(1700000000000);
      expect(tokens.refreshExpiresAt).toBe('2026-12-31T23:59:59Z');
    });

    it('should return nulls on error', async () => {
      mockedSecureStore.getItemAsync.mockRejectedValue(new Error('Read error'));

      const tokens = await getStoredTokens();

      expect(tokens.accessToken).toBeNull();
      expect(tokens.refreshToken).toBeNull();
      expect(tokens.accessExpiresAt).toBeNull();
      expect(tokens.refreshExpiresAt).toBeNull();
    });
  });

  // -------------------------------------------------------------------
  // clearTokens
  // -------------------------------------------------------------------
  describe('clearTokens', () => {
    it('should delete all token keys from secure store', async () => {
      await clearTokens();

      expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        'auth_access_token'
      );
      expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        'auth_refresh_token'
      );
      expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        'auth_access_expires'
      );
      expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        'auth_refresh_expires'
      );
    });
  });

  // -------------------------------------------------------------------
  // isAccessTokenExpired
  // -------------------------------------------------------------------
  describe('isAccessTokenExpired', () => {
    it('should return true when token is expired', async () => {
      const pastTime = (Date.now() - 10000).toString();
      mockedSecureStore.getItemAsync.mockResolvedValue(pastTime);

      const expired = await isAccessTokenExpired();

      expect(expired).toBe(true);
    });

    it('should return false when token is not expired', async () => {
      const futureTime = (Date.now() + 300000).toString(); // 5 minutes from now
      mockedSecureStore.getItemAsync.mockResolvedValue(futureTime);

      const expired = await isAccessTokenExpired();

      expect(expired).toBe(false);
    });

    it('should return true when no expiry is stored', async () => {
      mockedSecureStore.getItemAsync.mockResolvedValue(null);

      const expired = await isAccessTokenExpired();

      expect(expired).toBe(true);
    });

    it('should respect custom buffer seconds', async () => {
      // Token expires in 30 seconds, but buffer is 60 seconds
      const expiresInThirtySeconds = (Date.now() + 30000).toString();
      mockedSecureStore.getItemAsync.mockResolvedValue(expiresInThirtySeconds);

      const expiredWithDefaultBuffer = await isAccessTokenExpired(60);
      expect(expiredWithDefaultBuffer).toBe(true);

      const expiredWithSmallBuffer = await isAccessTokenExpired(10);
      expect(expiredWithSmallBuffer).toBe(false);
    });
  });

  // -------------------------------------------------------------------
  // isRefreshTokenExpired
  // -------------------------------------------------------------------
  describe('isRefreshTokenExpired', () => {
    it('should return true when refresh token is expired', async () => {
      mockedSecureStore.getItemAsync.mockResolvedValue('2020-01-01T00:00:00Z');

      const expired = await isRefreshTokenExpired();

      expect(expired).toBe(true);
    });

    it('should return false when refresh token is not expired', async () => {
      mockedSecureStore.getItemAsync.mockResolvedValue('2099-12-31T23:59:59Z');

      const expired = await isRefreshTokenExpired();

      expect(expired).toBe(false);
    });

    it('should return true when no expiry is stored', async () => {
      mockedSecureStore.getItemAsync.mockResolvedValue(null);

      const expired = await isRefreshTokenExpired();

      expect(expired).toBe(true);
    });
  });

  // -------------------------------------------------------------------
  // hasValidTokens
  // -------------------------------------------------------------------
  describe('hasValidTokens', () => {
    it('should return true when both tokens exist and refresh is not expired', async () => {
      mockedSecureStore.getItemAsync.mockImplementation((key: string) => {
        const store: Record<string, string> = {
          auth_access_token: 'access-token',
          auth_refresh_token: 'refresh-token',
          auth_access_expires: (Date.now() + 300000).toString(),
          auth_refresh_expires: '2099-12-31T23:59:59Z',
        };
        return Promise.resolve(store[key] ?? null);
      });

      const valid = await hasValidTokens();

      expect(valid).toBe(true);
    });

    it('should return false when access token is missing', async () => {
      mockedSecureStore.getItemAsync.mockImplementation((key: string) => {
        const store: Record<string, string> = {
          auth_refresh_token: 'refresh-token',
          auth_refresh_expires: '2099-12-31T23:59:59Z',
        };
        return Promise.resolve(store[key] ?? null);
      });

      const valid = await hasValidTokens();

      expect(valid).toBe(false);
    });

    it('should return false when refresh token is expired', async () => {
      mockedSecureStore.getItemAsync.mockImplementation((key: string) => {
        const store: Record<string, string> = {
          auth_access_token: 'access-token',
          auth_refresh_token: 'refresh-token',
          auth_access_expires: (Date.now() + 300000).toString(),
          auth_refresh_expires: '2020-01-01T00:00:00Z',
        };
        return Promise.resolve(store[key] ?? null);
      });

      const valid = await hasValidTokens();

      expect(valid).toBe(false);
    });
  });

  // -------------------------------------------------------------------
  // isSecureStoreAvailable
  // -------------------------------------------------------------------
  describe('isSecureStoreAvailable', () => {
    it('should return true when SecureStore is available', async () => {
      mockedSecureStore.isAvailableAsync.mockResolvedValue(true);

      const available = await isSecureStoreAvailable();

      expect(available).toBe(true);
    });

    it('should return false when SecureStore throws', async () => {
      mockedSecureStore.isAvailableAsync.mockRejectedValue(new Error('Not available'));

      const available = await isSecureStoreAvailable();

      expect(available).toBe(false);
    });
  });

  // -------------------------------------------------------------------
  // Error handling edge cases
  // -------------------------------------------------------------------
  describe('storeRefreshToken error', () => {
    it('should throw when storage fails', async () => {
      mockedSecureStore.setItemAsync.mockRejectedValueOnce(
        new Error('Storage failed')
      );

      await expect(
        storeRefreshToken('token', '2026-12-31T23:59:59Z')
      ).rejects.toThrow('Storage failed');
    });
  });

  describe('getRefreshToken error', () => {
    it('should return null on error', async () => {
      mockedSecureStore.getItemAsync.mockRejectedValue(new Error('Read error'));

      const token = await getRefreshToken();

      expect(token).toBeNull();
    });
  });

  describe('isAccessTokenExpired error', () => {
    it('should return true on error', async () => {
      mockedSecureStore.getItemAsync.mockRejectedValue(new Error('Read error'));

      const expired = await isAccessTokenExpired();

      expect(expired).toBe(true);
    });
  });

  describe('isRefreshTokenExpired error', () => {
    it('should return true on error', async () => {
      mockedSecureStore.getItemAsync.mockRejectedValue(new Error('Read error'));

      const expired = await isRefreshTokenExpired();

      expect(expired).toBe(true);
    });
  });
});
