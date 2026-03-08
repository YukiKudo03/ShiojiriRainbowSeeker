/**
 * Unit Tests for sentryService
 *
 * Tests Sentry initialization, user context, exception capture, and breadcrumbs.
 * @sentry/react-native is already mocked in setup.ts.
 */

import * as Sentry from '@sentry/react-native';

import {
  initSentry,
  setUserContext,
  clearUserContext,
  captureException,
  addBreadcrumb,
  wrapWithSentry,
} from '../../src/services/sentryService';

const mockedSentry = jest.mocked(Sentry);

describe('sentryService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('initSentry', () => {
    it('should not initialize when DSN is not set', () => {
      delete process.env.EXPO_PUBLIC_SENTRY_DSN;
      initSentry();
      expect(mockedSentry.init).not.toHaveBeenCalled();
    });

    it('should initialize with DSN when set', () => {
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123';
      initSentry();
      expect(mockedSentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://test@sentry.io/123',
          enableAutoSessionTracking: true,
          enableNativeCrashHandling: true,
        })
      );
    });

    it('should enable debug in dev mode', () => {
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123';
      initSentry();
      expect(mockedSentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          debug: true, // __DEV__ is true in test setup
          environment: 'development',
          tracesSampleRate: 1.0,
        })
      );
    });
  });

  describe('setUserContext', () => {
    it('should set Sentry user with id, email, and username', () => {
      setUserContext({ id: 'user-1', email: 'test@example.com', displayName: 'Test' });
      expect(mockedSentry.setUser).toHaveBeenCalledWith({
        id: 'user-1',
        email: 'test@example.com',
        username: 'Test',
      });
    });

    it('should handle missing displayName', () => {
      setUserContext({ id: 'user-1', email: 'test@example.com' });
      expect(mockedSentry.setUser).toHaveBeenCalledWith({
        id: 'user-1',
        email: 'test@example.com',
        username: undefined,
      });
    });
  });

  describe('clearUserContext', () => {
    it('should set user to null', () => {
      clearUserContext();
      expect(mockedSentry.setUser).toHaveBeenCalledWith(null);
    });
  });

  describe('captureException', () => {
    it('should capture exception without context', () => {
      const error = new Error('test error');
      captureException(error);
      expect(mockedSentry.captureException).toHaveBeenCalledWith(error);
    });

    it('should capture exception with context using withScope', () => {
      const error = new Error('test error');
      const context = { userId: '123', action: 'upload' };

      captureException(error, context);
      expect(mockedSentry.withScope).toHaveBeenCalled();
    });
  });

  describe('addBreadcrumb', () => {
    it('should add breadcrumb with default info level', () => {
      addBreadcrumb('navigation', 'User navigated to feed');
      expect(mockedSentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'navigation',
        message: 'User navigated to feed',
        data: undefined,
        level: 'info',
      });
    });

    it('should add breadcrumb with custom data and level', () => {
      addBreadcrumb('http', 'API call', { url: '/photos' }, 'error');
      expect(mockedSentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'http',
        message: 'API call',
        data: { url: '/photos' },
        level: 'error',
      });
    });
  });

  describe('wrapWithSentry', () => {
    it('should be Sentry.wrap', () => {
      expect(wrapWithSentry).toBe(mockedSentry.wrap);
    });
  });
});
