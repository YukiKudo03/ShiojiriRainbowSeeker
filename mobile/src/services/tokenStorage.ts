/**
 * Secure token storage using expo-secure-store
 *
 * Provides secure storage for JWT tokens with encryption on device.
 * Falls back gracefully if secure storage is unavailable.
 */

import * as SecureStore from 'expo-secure-store';

// Storage keys
const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const ACCESS_EXPIRES_KEY = 'auth_access_expires';
const REFRESH_EXPIRES_KEY = 'auth_refresh_expires';

/**
 * Token data structure
 */
export interface StoredTokens {
  accessToken: string | null;
  refreshToken: string | null;
  accessExpiresAt: number | null;
  refreshExpiresAt: string | null;
}

/**
 * Check if SecureStore is available
 */
export const isSecureStoreAvailable = async (): Promise<boolean> => {
  try {
    await SecureStore.isAvailableAsync();
    return true;
  } catch {
    return false;
  }
};

/**
 * Store access token securely
 */
export const storeAccessToken = async (
  token: string,
  expiresIn: number
): Promise<void> => {
  try {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
    // Store expiration time as timestamp
    const expiresAt = Date.now() + expiresIn * 1000;
    await SecureStore.setItemAsync(ACCESS_EXPIRES_KEY, expiresAt.toString());
  } catch (error) {
    console.error('Failed to store access token:', error);
    throw error;
  }
};

/**
 * Store refresh token securely
 */
export const storeRefreshToken = async (
  token: string,
  expiresAt: string
): Promise<void> => {
  try {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
    await SecureStore.setItemAsync(REFRESH_EXPIRES_KEY, expiresAt);
  } catch (error) {
    console.error('Failed to store refresh token:', error);
    throw error;
  }
};

/**
 * Store both tokens at once
 */
export const storeTokens = async (
  accessToken: string,
  refreshToken: string,
  accessExpiresIn: number,
  refreshExpiresAt: string
): Promise<void> => {
  await Promise.all([
    storeAccessToken(accessToken, accessExpiresIn),
    storeRefreshToken(refreshToken, refreshExpiresAt),
  ]);
};

/**
 * Retrieve access token
 */
export const getAccessToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to get access token:', error);
    return null;
  }
};

/**
 * Retrieve refresh token
 */
export const getRefreshToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to get refresh token:', error);
    return null;
  }
};

/**
 * Retrieve all stored tokens and expiration info
 */
export const getStoredTokens = async (): Promise<StoredTokens> => {
  try {
    const [accessToken, refreshToken, accessExpiresStr, refreshExpiresAt] =
      await Promise.all([
        SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
        SecureStore.getItemAsync(ACCESS_EXPIRES_KEY),
        SecureStore.getItemAsync(REFRESH_EXPIRES_KEY),
      ]);

    return {
      accessToken,
      refreshToken,
      accessExpiresAt: accessExpiresStr ? parseInt(accessExpiresStr, 10) : null,
      refreshExpiresAt,
    };
  } catch (error) {
    console.error('Failed to get stored tokens:', error);
    return {
      accessToken: null,
      refreshToken: null,
      accessExpiresAt: null,
      refreshExpiresAt: null,
    };
  }
};

/**
 * Clear all stored tokens (logout)
 */
export const clearTokens = async (): Promise<void> => {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
      SecureStore.deleteItemAsync(ACCESS_EXPIRES_KEY),
      SecureStore.deleteItemAsync(REFRESH_EXPIRES_KEY),
    ]);
  } catch (error) {
    console.error('Failed to clear tokens:', error);
    throw error;
  }
};

/**
 * Check if access token is expired or about to expire
 * Returns true if token expires within the buffer time (default 60 seconds)
 */
export const isAccessTokenExpired = async (
  bufferSeconds: number = 60
): Promise<boolean> => {
  try {
    const expiresStr = await SecureStore.getItemAsync(ACCESS_EXPIRES_KEY);
    if (!expiresStr) return true;

    const expiresAt = parseInt(expiresStr, 10);
    const now = Date.now();
    const bufferMs = bufferSeconds * 1000;

    return now >= expiresAt - bufferMs;
  } catch (error) {
    console.error('Failed to check token expiration:', error);
    return true;
  }
};

/**
 * Check if refresh token is expired
 */
export const isRefreshTokenExpired = async (): Promise<boolean> => {
  try {
    const expiresAt = await SecureStore.getItemAsync(REFRESH_EXPIRES_KEY);
    if (!expiresAt) return true;

    const expiresDate = new Date(expiresAt);
    return Date.now() >= expiresDate.getTime();
  } catch (error) {
    console.error('Failed to check refresh token expiration:', error);
    return true;
  }
};

/**
 * Check if user has valid tokens stored
 */
export const hasValidTokens = async (): Promise<boolean> => {
  const tokens = await getStoredTokens();

  // Must have both tokens
  if (!tokens.accessToken || !tokens.refreshToken) {
    return false;
  }

  // Refresh token must not be expired
  const refreshExpired = await isRefreshTokenExpired();
  return !refreshExpired;
};
