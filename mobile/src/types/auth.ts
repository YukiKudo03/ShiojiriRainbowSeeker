/**
 * Authentication type definitions
 */

/**
 * User data from API response
 */
export interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  locale: 'ja' | 'en';
  confirmed: boolean;
  createdAt: string;
}

/**
 * Token pair for authentication
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
  refreshExpiresAt: string;
}

/**
 * Login request parameters
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Login response from API
 */
export interface LoginResponse {
  data: {
    user: User;
    tokens: AuthTokens;
  };
}

/**
 * Register request parameters
 */
export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

/**
 * Register response from API
 */
export interface RegisterResponse {
  data: {
    user: User;
    message: string;
  };
}

/**
 * Token refresh response from API
 */
export interface RefreshTokenResponse {
  data: {
    accessToken: string;
    expiresIn: number;
  };
}

/**
 * Password reset request parameters
 */
export interface PasswordResetRequest {
  email: string;
}

/**
 * Password reset confirmation parameters
 */
export interface PasswordResetConfirmRequest {
  token: string;
  password: string;
}

/**
 * API error response format
 */
export interface ApiError {
  error: {
    code: number;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

/**
 * Authentication state for store
 */
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
}

/**
 * Authentication actions for store
 */
export interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  checkAuth: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}
