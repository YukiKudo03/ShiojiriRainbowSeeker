/**
 * Unit Tests for authStore (Zustand)
 *
 * Tests the authentication store actions and state transitions.
 * The authService is fully mocked.
 */

import type { User } from '../../src/types/auth';

// Mock the authService module before importing the store
jest.mock('../../src/services/authService', () => ({
  authService: {
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    refreshToken: jest.fn(),
    checkAuth: jest.fn(),
    requestPasswordReset: jest.fn(),
  },
  getErrorMessage: jest.fn((error: unknown) => {
    if (error instanceof Error) return error.message;
    return 'An unexpected error occurred';
  }),
}));

import { useAuthStore } from '../../src/store/authStore';
import { authService } from '../../src/services/authService';

const mockedAuthService = jest.mocked(authService);

/**
 * Helper: create a mock user object
 */
const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  role: 'user',
  locale: 'ja',
  confirmed: true,
  createdAt: '2025-01-01T00:00:00Z',
  ...overrides,
});

/**
 * Helper: reset the Zustand store to initial state between tests.
 * Zustand stores are singletons so we need to manually reset.
 */
const resetStore = () => {
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    isInitialized: false,
    error: null,
  });
};

describe('authStore', () => {
  beforeEach(() => {
    resetStore();
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------
  // Initial State
  // -------------------------------------------------------------------
  describe('initial state', () => {
    it('should have correct initial values', () => {
      const state = useAuthStore.getState();

      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.isInitialized).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  // -------------------------------------------------------------------
  // login
  // -------------------------------------------------------------------
  describe('login', () => {
    it('should set user and isAuthenticated on success', async () => {
      const mockUser = createMockUser();
      mockedAuthService.login.mockResolvedValue(mockUser);

      await useAuthStore.getState().login('test@example.com', 'password123');

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(mockedAuthService.login).toHaveBeenCalledWith(
        'test@example.com',
        'password123'
      );
    });

    it('should set isLoading to true during login', async () => {
      // Use a deferred promise so we can observe the loading state
      let resolveLogin!: (user: User) => void;
      mockedAuthService.login.mockImplementation(
        () =>
          new Promise<User>((resolve) => {
            resolveLogin = resolve;
          })
      );

      const loginPromise = useAuthStore.getState().login('a@b.com', 'pw');

      // While login is in-flight, isLoading should be true
      expect(useAuthStore.getState().isLoading).toBe(true);
      expect(useAuthStore.getState().error).toBeNull();

      resolveLogin(createMockUser());
      await loginPromise;

      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('should set error on failure', async () => {
      const loginError = new Error('Invalid credentials');
      mockedAuthService.login.mockRejectedValue(loginError);

      await expect(
        useAuthStore.getState().login('bad@example.com', 'wrong')
      ).rejects.toThrow('Invalid credentials');

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Invalid credentials');
    });

    it('should clear previous error before attempting login', async () => {
      // Set an existing error
      useAuthStore.setState({ error: 'Previous error' });

      const mockUser = createMockUser();
      mockedAuthService.login.mockResolvedValue(mockUser);

      await useAuthStore.getState().login('test@example.com', 'password123');

      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  // -------------------------------------------------------------------
  // register
  // -------------------------------------------------------------------
  describe('register', () => {
    it('should call authService.register and clear loading on success', async () => {
      mockedAuthService.register.mockResolvedValue({
        user: createMockUser(),
        message: 'Please verify your email',
      });

      await useAuthStore
        .getState()
        .register('new@example.com', 'password123', 'New User');

      const state = useAuthStore.getState();
      // User should NOT be set after registration (email verification needed)
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(mockedAuthService.register).toHaveBeenCalledWith(
        'new@example.com',
        'password123',
        'New User'
      );
    });

    it('should set error on registration failure', async () => {
      mockedAuthService.register.mockRejectedValue(
        new Error('Email already taken')
      );

      await expect(
        useAuthStore
          .getState()
          .register('dup@example.com', 'password123', 'Dup User')
      ).rejects.toThrow('Email already taken');

      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Email already taken');
    });
  });

  // -------------------------------------------------------------------
  // logout
  // -------------------------------------------------------------------
  describe('logout', () => {
    it('should clear user, isAuthenticated, and error', async () => {
      // Set up authenticated state
      useAuthStore.setState({
        user: createMockUser(),
        isAuthenticated: true,
        error: 'some error',
      });

      mockedAuthService.logout.mockResolvedValue(undefined);

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should still clear local state even if authService.logout fails', async () => {
      useAuthStore.setState({
        user: createMockUser(),
        isAuthenticated: true,
      });

      mockedAuthService.logout.mockRejectedValue(new Error('Network error'));

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });

  // -------------------------------------------------------------------
  // refreshToken
  // -------------------------------------------------------------------
  describe('refreshToken', () => {
    it('should return true when refresh succeeds', async () => {
      mockedAuthService.refreshToken.mockResolvedValue('new-token');

      const result = await useAuthStore.getState().refreshToken();

      expect(result).toBe(true);
      expect(mockedAuthService.refreshToken).toHaveBeenCalled();
    });

    it('should return false and logout when refresh fails', async () => {
      useAuthStore.setState({
        user: createMockUser(),
        isAuthenticated: true,
      });

      mockedAuthService.refreshToken.mockRejectedValue(
        new Error('Refresh token expired')
      );
      mockedAuthService.logout.mockResolvedValue(undefined);

      const result = await useAuthStore.getState().refreshToken();

      expect(result).toBe(false);
      // After failed refresh, the store's logout should have been called
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  // -------------------------------------------------------------------
  // checkAuth
  // -------------------------------------------------------------------
  describe('checkAuth', () => {
    it('should set user when checkAuth returns a user', async () => {
      const mockUser = createMockUser();
      mockedAuthService.checkAuth.mockResolvedValue(mockUser);

      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isInitialized).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('should set isAuthenticated false when checkAuth returns null', async () => {
      mockedAuthService.checkAuth.mockResolvedValue(null);

      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isInitialized).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('should set isInitialized true even on error', async () => {
      mockedAuthService.checkAuth.mockRejectedValue(
        new Error('Network error')
      );

      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isInitialized).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  // -------------------------------------------------------------------
  // resetPassword
  // -------------------------------------------------------------------
  describe('resetPassword', () => {
    it('should call requestPasswordReset and clear loading on success', async () => {
      mockedAuthService.requestPasswordReset.mockResolvedValue(
        'Reset email sent'
      );

      await useAuthStore.getState().resetPassword('test@example.com');

      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(mockedAuthService.requestPasswordReset).toHaveBeenCalledWith(
        'test@example.com'
      );
    });

    it('should set error on failure', async () => {
      mockedAuthService.requestPasswordReset.mockRejectedValue(
        new Error('Rate limit exceeded')
      );

      await expect(
        useAuthStore.getState().resetPassword('test@example.com')
      ).rejects.toThrow('Rate limit exceeded');

      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Rate limit exceeded');
    });
  });

  // -------------------------------------------------------------------
  // clearError
  // -------------------------------------------------------------------
  describe('clearError', () => {
    it('should reset error to null', () => {
      useAuthStore.setState({ error: 'Something went wrong' });

      useAuthStore.getState().clearError();

      expect(useAuthStore.getState().error).toBeNull();
    });

    it('should be a no-op when error is already null', () => {
      useAuthStore.setState({ error: null });

      useAuthStore.getState().clearError();

      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  // -------------------------------------------------------------------
  // setLoading
  // -------------------------------------------------------------------
  describe('setLoading', () => {
    it('should set isLoading to true', () => {
      expect(useAuthStore.getState().isLoading).toBe(false);

      useAuthStore.getState().setLoading(true);

      expect(useAuthStore.getState().isLoading).toBe(true);
    });

    it('should set isLoading to false', () => {
      useAuthStore.setState({ isLoading: true });

      useAuthStore.getState().setLoading(false);

      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });
});
