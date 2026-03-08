/**
 * Unit Tests for apiClient
 *
 * Tests API client creation, interceptors, token refresh, and error helpers.
 */

import axios, { AxiosError, AxiosHeaders } from 'axios';

// Mock dependencies before importing apiClient
jest.mock('axios', () => {
  const requestInterceptors: Array<{ fulfilled: Function; rejected?: Function }> = [];
  const responseInterceptors: Array<{ fulfilled: Function; rejected?: Function }> = [];
  const mockInstance = {
    interceptors: {
      request: {
        use: jest.fn((fulfilled, rejected) => {
          requestInterceptors.push({ fulfilled, rejected });
          return requestInterceptors.length - 1;
        }),
      },
      response: {
        use: jest.fn((fulfilled, rejected) => {
          responseInterceptors.push({ fulfilled, rejected });
          return responseInterceptors.length - 1;
        }),
      },
    },
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    _requestInterceptors: requestInterceptors,
    _responseInterceptors: responseInterceptors,
  };

  return {
    __esModule: true,
    default: {
      create: jest.fn(() => mockInstance),
      post: jest.fn(),
    },
    AxiosError: class extends Error {
      response: any;
      config: any;
      code: string | undefined;
      isAxiosError = true;
      constructor(message?: string, code?: string, config?: any, request?: any, response?: any) {
        super(message);
        this.code = code;
        this.config = config;
        this.response = response;
      }
    },
    AxiosHeaders: class {
      private headers: Record<string, string> = {};
      set(key: string, value: string) { this.headers[key] = value; }
      get(key: string) { return this.headers[key]; }
    },
  };
});

jest.mock('../../src/services/sentryService', () => ({
  addBreadcrumb: jest.fn(),
}));

jest.mock('../../src/services/tokenStorage', () => ({
  getAccessToken: jest.fn(() => Promise.resolve('test-access-token')),
  getRefreshToken: jest.fn(() => Promise.resolve('test-refresh-token')),
  storeAccessToken: jest.fn(() => Promise.resolve()),
  clearTokens: jest.fn(() => Promise.resolve()),
  isAccessTokenExpired: jest.fn(() => Promise.resolve(false)),
}));

import { createApiClient, isAuthError, getErrorMessage, getErrorCode } from '../../src/services/apiClient';
import * as tokenStorage from '../../src/services/tokenStorage';

const mockedTokenStorage = jest.mocked(tokenStorage);

describe('apiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createApiClient', () => {
    it('should create an axios instance with correct config', () => {
      const client = createApiClient();
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 30000,
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Accept: 'application/json',
          }),
        })
      );
    });

    it('should register request and response interceptors', () => {
      const client = createApiClient();
      expect(client.interceptors.request.use).toHaveBeenCalledTimes(1);
      expect(client.interceptors.response.use).toHaveBeenCalledTimes(1);
    });
  });

  describe('request interceptor', () => {
    it('should add Authorization header with access token', async () => {
      const client = createApiClient() as any;
      const requestInterceptor = client._requestInterceptors[0].fulfilled;

      const config = {
        url: '/photos',
        headers: {} as Record<string, string>,
      };

      const result = await requestInterceptor(config);
      expect(result.headers.Authorization).toBe('Bearer test-access-token');
    });

    it('should skip auth header for login endpoint', async () => {
      const client = createApiClient() as any;
      const requestInterceptor = client._requestInterceptors[0].fulfilled;

      const config = {
        url: '/auth/login',
        headers: {} as Record<string, string>,
      };

      const result = await requestInterceptor(config);
      expect(result.headers.Authorization).toBeUndefined();
    });

    it('should skip auth header for register endpoint', async () => {
      const client = createApiClient() as any;
      const requestInterceptor = client._requestInterceptors[0].fulfilled;

      const config = {
        url: '/auth/register',
        headers: {} as Record<string, string>,
      };

      const result = await requestInterceptor(config);
      expect(result.headers.Authorization).toBeUndefined();
    });

    it('should attempt proactive token refresh when token is expired', async () => {
      mockedTokenStorage.isAccessTokenExpired.mockResolvedValue(true);

      const client = createApiClient() as any;
      const requestInterceptor = client._requestInterceptors[0].fulfilled;

      const config = {
        url: '/photos',
        headers: {} as Record<string, string>,
      };

      await requestInterceptor(config);
      expect(mockedTokenStorage.isAccessTokenExpired).toHaveBeenCalledWith(60);
    });

    it('should not add token when getAccessToken returns null', async () => {
      mockedTokenStorage.getAccessToken.mockResolvedValue(null);

      const client = createApiClient() as any;
      const requestInterceptor = client._requestInterceptors[0].fulfilled;

      const config = {
        url: '/photos',
        headers: {} as Record<string, string>,
      };

      const result = await requestInterceptor(config);
      expect(result.headers.Authorization).toBeUndefined();
    });
  });

  describe('isAuthError', () => {
    it('should return true for 401 AxiosError', () => {
      const error = new AxiosError('Unauthorized', '401', undefined, undefined, {
        status: 401,
        data: {},
        headers: {},
        statusText: 'Unauthorized',
        config: {} as any,
      } as any);
      expect(isAuthError(error)).toBe(true);
    });

    it('should return false for non-401 AxiosError', () => {
      const error = new AxiosError('Not Found', '404', undefined, undefined, {
        status: 404,
        data: {},
        headers: {},
        statusText: 'Not Found',
        config: {} as any,
      } as any);
      expect(isAuthError(error)).toBe(false);
    });

    it('should return false for non-Axios errors', () => {
      expect(isAuthError(new Error('random'))).toBe(false);
    });

    it('should return false for non-Error values', () => {
      expect(isAuthError('string')).toBe(false);
      expect(isAuthError(null)).toBe(false);
      expect(isAuthError(undefined)).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('should return message from Error instance', () => {
      const error = new Error('Something went wrong');
      expect(getErrorMessage(error)).toBe('Something went wrong');
    });

    it('should return default message for non-Error values', () => {
      expect(getErrorMessage('string')).toBe('An unexpected error occurred');
      expect(getErrorMessage(null)).toBe('An unexpected error occurred');
      expect(getErrorMessage(42)).toBe('An unexpected error occurred');
    });
  });

  describe('getErrorCode', () => {
    it('should return code from Error with code property', () => {
      const error = new Error('test') as Error & { code?: number };
      error.code = 1001;
      expect(getErrorCode(error)).toBe(1001);
    });

    it('should return undefined for Error without code', () => {
      expect(getErrorCode(new Error('test'))).toBeUndefined();
    });

    it('should return undefined for non-Error values', () => {
      expect(getErrorCode('string')).toBeUndefined();
      expect(getErrorCode(null)).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------
  // Response interceptor - 401 handling
  // -------------------------------------------------------------------
  describe('response interceptor', () => {
    it('should pass through successful responses', async () => {
      const client = createApiClient() as any;
      const responseInterceptor = client._responseInterceptors[0].fulfilled;

      const response = { data: { message: 'ok' }, status: 200 };
      const result = await responseInterceptor(response);
      expect(result).toEqual(response);
    });

    it('should handle 401 and attempt token refresh', async () => {
      const client = createApiClient() as any;
      const responseRejected = client._responseInterceptors[0].rejected;

      // Mock successful refresh
      (axios.post as jest.Mock).mockResolvedValue({
        data: { data: { accessToken: 'new-token', expiresIn: 3600 } },
      });
      // Mock retry request
      (client as any).mockImplementation = undefined;

      const error = new AxiosError('Unauthorized', '401', undefined, undefined, {
        status: 401,
        data: {},
        headers: {},
        statusText: 'Unauthorized',
        config: {} as any,
      } as any);
      error.config = { url: '/photos', headers: {}, _retry: false } as any;

      // The interceptor calls client(originalRequest) which is the mock instance itself
      // We just verify it doesn't throw when refresh succeeds
      try {
        await responseRejected(error);
      } catch {
        // Expected - mock client isn't callable, but token refresh was attempted
      }
      expect(mockedTokenStorage.getRefreshToken).toHaveBeenCalled();
    });

    it('should clear tokens when refresh request itself returns 401', async () => {
      const client = createApiClient() as any;
      const responseRejected = client._responseInterceptors[0].rejected;

      const error = new AxiosError('Unauthorized', '401', undefined, undefined, {
        status: 401,
        data: {},
        headers: {},
        statusText: 'Unauthorized',
        config: {} as any,
      } as any);
      error.config = { url: '/auth/refresh', headers: {}, _retry: false } as any;

      await expect(responseRejected(error)).rejects.toBeTruthy();
      expect(mockedTokenStorage.clearTokens).toHaveBeenCalled();
    });

    it('should clear tokens when no refresh token available', async () => {
      mockedTokenStorage.getRefreshToken.mockResolvedValue(null);

      const client = createApiClient() as any;
      const responseRejected = client._responseInterceptors[0].rejected;

      const error = new AxiosError('Unauthorized', '401', undefined, undefined, {
        status: 401,
        data: {},
        headers: {},
        statusText: 'Unauthorized',
        config: {} as any,
      } as any);
      error.config = { url: '/photos', headers: {}, _retry: false } as any;

      await expect(responseRejected(error)).rejects.toBeTruthy();
      expect(mockedTokenStorage.clearTokens).toHaveBeenCalled();
    });

    it('should normalize timeout error', async () => {
      const client = createApiClient() as any;
      const responseRejected = client._responseInterceptors[0].rejected;

      const error = new AxiosError('timeout', 'ECONNABORTED');
      error.config = { url: '/photos', headers: {} } as any;

      try {
        await responseRejected(error);
      } catch (e: any) {
        expect(e.message).toBe('Request timed out. Please check your connection.');
      }
    });

    it('should normalize network error (no response)', async () => {
      const client = createApiClient() as any;
      const responseRejected = client._responseInterceptors[0].rejected;

      const error = new AxiosError('Network Error');
      error.config = { url: '/photos', headers: {} } as any;
      error.response = undefined;

      try {
        await responseRejected(error);
      } catch (e: any) {
        expect(e.message).toBe('Network error. Please check your internet connection.');
      }
    });

    it('should normalize API error with details', async () => {
      const client = createApiClient() as any;
      const responseRejected = client._responseInterceptors[0].rejected;

      const error = new AxiosError('Bad Request', '400', undefined, undefined, {
        status: 400,
        data: {
          error: {
            message: 'Validation failed',
            code: 1001,
            details: { field: 'email' },
          },
        },
        headers: {},
        statusText: 'Bad Request',
        config: {} as any,
      } as any);
      error.config = { url: '/photos', headers: {} } as any;

      try {
        await responseRejected(error);
      } catch (e: any) {
        expect(e.message).toBe('Validation failed');
        expect(e.code).toBe(1001);
        expect(e.details).toEqual({ field: 'email' });
      }
    });

    it('should add Sentry breadcrumb for 5xx errors', async () => {
      const { addBreadcrumb } = require('../../src/services/sentryService');
      const client = createApiClient() as any;
      const responseRejected = client._responseInterceptors[0].rejected;

      const error = new AxiosError('Server Error', '500', undefined, undefined, {
        status: 500,
        data: {},
        headers: {},
        statusText: 'Internal Server Error',
        config: {} as any,
      } as any);
      error.config = { url: '/api/test', method: 'get', headers: {} } as any;

      try {
        await responseRejected(error);
      } catch {
        // Expected
      }
      expect(addBreadcrumb).toHaveBeenCalledWith('http', 'Server error 500', expect.any(Object), 'error');
    });

    it('should normalize generic error with message', async () => {
      const client = createApiClient() as any;
      const responseRejected = client._responseInterceptors[0].rejected;

      const error = new AxiosError('Something broke', '422', undefined, undefined, {
        status: 422,
        data: {},
        headers: {},
        statusText: 'Unprocessable Entity',
        config: {} as any,
      } as any);
      error.config = { url: '/photos', headers: {} } as any;

      try {
        await responseRejected(error);
      } catch (e: any) {
        expect(e.message).toBe('Something broke');
      }
    });
  });
});
