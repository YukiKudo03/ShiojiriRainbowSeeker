/**
 * Authentication Store (Zustand)
 *
 * Global state management for authentication:
 * - User session state
 * - Loading/error states
 * - Authentication actions
 * - Auto-login on app start
 */

import { create } from 'zustand';

import { authService, getErrorMessage } from '../services/authService';

import type { User, AuthState, AuthActions } from '../types/auth';

/**
 * Combined auth store type
 */
type AuthStore = AuthState & AuthActions;

/**
 * Initial state
 */
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  error: null,
};

/**
 * Create auth store
 */
export const useAuthStore = create<AuthStore>((set, get) => ({
  // Initial state
  ...initialState,

  /**
   * Login with email and password
   */
  login: async (email: string, password: string): Promise<void> => {
    set({ isLoading: true, error: null });

    try {
      const user = await authService.login(email, password);
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: message,
      });
      throw error;
    }
  },

  /**
   * Register new user
   */
  register: async (
    email: string,
    password: string,
    displayName: string
  ): Promise<void> => {
    set({ isLoading: true, error: null });

    try {
      await authService.register(email, password, displayName);
      set({ isLoading: false, error: null });
      // Note: User is not authenticated after registration
      // They must verify email first
    } catch (error) {
      const message = getErrorMessage(error);
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  /**
   * Logout user
   */
  logout: async (): Promise<void> => {
    set({ isLoading: true, error: null });

    try {
      await authService.logout();
    } catch (error) {
      // Log but don't throw - still clear local state
      console.warn('Logout error:', error);
    } finally {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  /**
   * Refresh access token
   * Returns true if successful, false otherwise
   */
  refreshToken: async (): Promise<boolean> => {
    try {
      await authService.refreshToken();
      return true;
    } catch (error) {
      console.warn('Token refresh failed:', error);
      // If refresh fails, log out the user
      const { logout } = get();
      await logout();
      return false;
    }
  },

  /**
   * Check authentication status on app start
   * Attempts to restore session from stored tokens
   */
  checkAuth: async (): Promise<void> => {
    set({ isLoading: true, error: null });

    try {
      const user = await authService.checkAuth();

      if (user) {
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
          isInitialized: true,
          error: null,
        });
      } else {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          isInitialized: true,
          error: null,
        });
      }
    } catch (error) {
      console.warn('Auth check failed:', error);
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isInitialized: true,
        error: null,
      });
    }
  },

  /**
   * Request password reset
   */
  resetPassword: async (email: string): Promise<void> => {
    set({ isLoading: true, error: null });

    try {
      await authService.requestPasswordReset(email);
      set({ isLoading: false, error: null });
    } catch (error) {
      const message = getErrorMessage(error);
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  /**
   * Clear error state
   */
  clearError: (): void => {
    set({ error: null });
  },

  /**
   * Set loading state manually
   */
  setLoading: (loading: boolean): void => {
    set({ isLoading: loading });
  },
}));

/**
 * Selectors for common state access patterns
 */
export const selectUser = (state: AuthStore): User | null => state.user;
export const selectIsAuthenticated = (state: AuthStore): boolean =>
  state.isAuthenticated;
export const selectIsLoading = (state: AuthStore): boolean => state.isLoading;
export const selectIsInitialized = (state: AuthStore): boolean =>
  state.isInitialized;
export const selectError = (state: AuthStore): string | null => state.error;

/**
 * Hook for auth status only (minimal re-renders)
 */
export const useIsAuthenticated = (): boolean =>
  useAuthStore(selectIsAuthenticated);

/**
 * Hook for current user
 */
export const useCurrentUser = (): User | null => useAuthStore(selectUser);

/**
 * Hook for loading state
 */
export const useAuthLoading = (): boolean => useAuthStore(selectIsLoading);

/**
 * Hook for error state
 */
export const useAuthError = (): string | null => useAuthStore(selectError);

/**
 * Hook for initialization state
 */
export const useIsInitialized = (): boolean => useAuthStore(selectIsInitialized);
