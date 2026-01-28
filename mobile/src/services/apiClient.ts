/**
 * API Client with automatic token refresh
 *
 * Axios instance configured with:
 * - Request interceptor for adding Authorization header
 * - Response interceptor for automatic token refresh on 401
 * - Error handling and normalization
 */

import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';

import {
  getAccessToken,
  getRefreshToken,
  storeAccessToken,
  clearTokens,
  isAccessTokenExpired,
} from './tokenStorage';

import type { ApiError, RefreshTokenResponse } from '../types/auth';

// API base URL - should be configured via environment variables
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Flag to prevent multiple simultaneous refresh attempts
 */
let isRefreshing = false;

/**
 * Queue of requests waiting for token refresh
 */
let refreshSubscribers: Array<(token: string) => void> = [];

/**
 * Subscribe to token refresh completion
 */
const subscribeToTokenRefresh = (callback: (token: string) => void): void => {
  refreshSubscribers.push(callback);
};

/**
 * Notify all subscribers with new token
 */
const onTokenRefreshed = (newToken: string): void => {
  refreshSubscribers.forEach((callback) => callback(newToken));
  refreshSubscribers = [];
};

/**
 * Reject all subscribers (refresh failed)
 */
const onRefreshFailed = (): void => {
  refreshSubscribers = [];
};

/**
 * Create base axios instance
 */
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: `${API_BASE_URL}/api/v1`,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  // Request interceptor - add auth token
  client.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      // Skip auth header for auth endpoints that don't need it
      const noAuthEndpoints = [
        '/auth/login',
        '/auth/register',
        '/auth/password/reset',
        '/auth/verify_email',
      ];

      const isNoAuthEndpoint = noAuthEndpoints.some((endpoint) =>
        config.url?.includes(endpoint)
      );

      if (!isNoAuthEndpoint) {
        // Check if token is about to expire and refresh proactively
        const accessExpired = await isAccessTokenExpired(60);
        if (accessExpired && !config.url?.includes('/auth/refresh')) {
          const refreshToken = await getRefreshToken();
          if (refreshToken) {
            try {
              await refreshAccessToken(refreshToken);
            } catch {
              // Refresh failed, will be handled by response interceptor
            }
          }
        }

        const token = await getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor - handle 401 and refresh token
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<ApiError>) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };

      // Handle 401 Unauthorized
      if (error.response?.status === 401 && !originalRequest._retry) {
        // Don't retry if it's already a refresh request
        if (originalRequest.url?.includes('/auth/refresh')) {
          await clearTokens();
          return Promise.reject(error);
        }

        originalRequest._retry = true;

        // If already refreshing, queue this request
        if (isRefreshing) {
          return new Promise((resolve) => {
            subscribeToTokenRefresh((newToken: string) => {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              resolve(client(originalRequest));
            });
          });
        }

        isRefreshing = true;

        try {
          const refreshToken = await getRefreshToken();
          if (!refreshToken) {
            throw new Error('No refresh token available');
          }

          const newToken = await refreshAccessToken(refreshToken);
          onTokenRefreshed(newToken);

          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return client(originalRequest);
        } catch (refreshError) {
          onRefreshFailed();
          await clearTokens();
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(normalizeError(error));
    }
  );

  return client;
};

/**
 * Refresh the access token using refresh token
 */
const refreshAccessToken = async (refreshToken: string): Promise<string> => {
  const response = await axios.post<RefreshTokenResponse>(
    `${API_BASE_URL}/api/v1/auth/refresh`,
    { refresh_token: refreshToken },
    {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    }
  );

  const { accessToken, expiresIn } = response.data.data;
  await storeAccessToken(accessToken, expiresIn);

  return accessToken;
};

/**
 * Normalize axios errors to a consistent format
 */
const normalizeError = (error: AxiosError<ApiError>): Error => {
  if (error.response?.data?.error) {
    const apiError = error.response.data.error;
    const normalizedError = new Error(apiError.message) as Error & {
      code?: number;
      details?: Record<string, unknown>;
    };
    normalizedError.code = apiError.code;
    normalizedError.details = apiError.details;
    return normalizedError;
  }

  if (error.code === 'ECONNABORTED') {
    return new Error('Request timed out. Please check your connection.');
  }

  if (!error.response) {
    return new Error('Network error. Please check your internet connection.');
  }

  return new Error(error.message || 'An unexpected error occurred.');
};

/**
 * Export singleton API client instance
 */
export const apiClient = createApiClient();

/**
 * Export API client creator for testing
 */
export { createApiClient };

/**
 * Helper to check if error is an auth error (requires re-login)
 */
export const isAuthError = (error: unknown): boolean => {
  if (error instanceof AxiosError) {
    return error.response?.status === 401;
  }
  return false;
};

/**
 * Helper to get error message from API error
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
};

/**
 * Helper to get error code from API error
 */
export const getErrorCode = (error: unknown): number | undefined => {
  if (error instanceof Error && 'code' in error) {
    return (error as Error & { code?: number }).code;
  }
  return undefined;
};
