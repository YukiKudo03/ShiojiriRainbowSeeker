/**
 * Authentication Service
 *
 * Provides authentication-related API calls:
 * - Login/logout
 * - Registration
 * - Password reset
 * - Token refresh
 * - Email verification
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { apiClient, getErrorMessage } from './apiClient';
import {
  storeTokens,
  clearTokens,
  getRefreshToken,
  hasValidTokens,
} from './tokenStorage';

import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  RefreshTokenResponse,
  PasswordResetRequest,
  PasswordResetConfirmRequest,
  User,
  ApiResponse,
} from '../types/auth';

/**
 * User data stored in AsyncStorage for quick access
 */

const USER_DATA_KEY = 'auth_user_data';

/**
 * Store user data in AsyncStorage
 */
const storeUserData = async (user: User): Promise<void> => {
  await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
};

/**
 * Get stored user data
 */
const getStoredUserData = async (): Promise<User | null> => {
  try {
    const data = await AsyncStorage.getItem(USER_DATA_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

/**
 * Clear stored user data
 */
const clearUserData = async (): Promise<void> => {
  await AsyncStorage.removeItem(USER_DATA_KEY);
};

/**
 * Authentication Service
 */
export const authService = {
  /**
   * Login with email and password
   * Stores tokens and user data on success
   */
  async login(email: string, password: string): Promise<User> {
    const request: LoginRequest = { email, password };

    const response = await apiClient.post<LoginResponse>('/auth/login', request);

    const { user, tokens } = response.data.data;

    // Store tokens securely
    await storeTokens(
      tokens.accessToken,
      tokens.refreshToken,
      tokens.accessExpiresIn,
      tokens.refreshExpiresAt
    );

    // Store user data for quick access
    await storeUserData(user);

    return user;
  },

  /**
   * Register a new user
   * Does not auto-login - user must verify email first
   */
  async register(
    email: string,
    password: string,
    displayName: string
  ): Promise<{ user: User; message: string }> {
    const request: RegisterRequest = { email, password, displayName };

    const response = await apiClient.post<RegisterResponse>(
      '/auth/register',
      request
    );

    return response.data.data;
  },

  /**
   * Logout - clear all tokens and user data
   */
  async logout(): Promise<void> {
    try {
      // Call logout endpoint to invalidate token on server
      await apiClient.delete('/auth/logout');
    } catch {
      // Ignore errors - still clear local data
      console.warn('Logout API call failed, clearing local data anyway');
    }

    // Clear all stored data
    await Promise.all([clearTokens(), clearUserData()]);
  },

  /**
   * Refresh access token using refresh token
   * Returns the new access token
   */
  async refreshToken(): Promise<string> {
    const refreshToken = await getRefreshToken();

    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await apiClient.post<RefreshTokenResponse>('/auth/refresh', {
      refresh_token: refreshToken,
    });

    const { accessToken, expiresIn } = response.data.data;

    // Store new access token (refresh token remains the same)
    const { storeAccessToken } = await import('./tokenStorage');
    await storeAccessToken(accessToken, expiresIn);

    return accessToken;
  },

  /**
   * Request password reset email
   * Always returns success for security (doesn't reveal if email exists)
   */
  async requestPasswordReset(email: string): Promise<string> {
    const request: PasswordResetRequest = { email };

    const response = await apiClient.post<ApiResponse<{ message: string }>>(
      '/auth/password/reset',
      request
    );

    return response.data.data.message;
  },

  /**
   * Confirm password reset with token and new password
   */
  async confirmPasswordReset(token: string, newPassword: string): Promise<User> {
    const request: PasswordResetConfirmRequest = {
      token,
      password: newPassword,
    };

    const response = await apiClient.put<ApiResponse<{ user: User; message: string }>>(
      '/auth/password/reset',
      request
    );

    return response.data.data.user;
  },

  /**
   * Verify email with confirmation token
   */
  async verifyEmail(token: string): Promise<User> {
    const response = await apiClient.get<ApiResponse<{ user: User; message: string }>>(
      `/auth/verify_email/${token}`
    );

    return response.data.data.user;
  },

  /**
   * Check if user has valid authentication
   * Returns user data if authenticated, null otherwise
   */
  async checkAuth(): Promise<User | null> {
    // First check if we have valid tokens
    const hasTokens = await hasValidTokens();
    if (!hasTokens) {
      return null;
    }

    // Try to get stored user data
    const storedUser = await getStoredUserData();

    // Optionally validate with server (commented out to reduce API calls)
    // If you want to validate on every app start:
    // try {
    //   const response = await apiClient.get<ApiResponse<{ user: User }>>('/auth/me');
    //   const user = response.data.data.user;
    //   await storeUserData(user);
    //   return user;
    // } catch {
    //   await this.logout();
    //   return null;
    // }

    return storedUser;
  },

  /**
   * Get current stored user data (sync, no API call)
   */
  getStoredUser: getStoredUserData,

  /**
   * Update stored user data after profile changes
   */
  updateStoredUser: storeUserData,
};

/**
 * Export individual functions for direct use
 */
export const {
  login,
  register,
  logout,
  refreshToken,
  requestPasswordReset,
  confirmPasswordReset,
  verifyEmail,
  checkAuth,
} = authService;

/**
 * Export error message helper
 */
export { getErrorMessage };
