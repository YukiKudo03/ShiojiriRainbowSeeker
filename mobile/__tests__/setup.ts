/**
 * Jest Setup File
 *
 * Mocks React Native and Expo modules that are not available
 * in the Node.js test environment.
 */

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => {
  const store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
        return Promise.resolve();
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        Object.keys(store).forEach((key) => delete store[key]);
        return Promise.resolve();
      }),
      getAllKeys: jest.fn(() => Promise.resolve(Object.keys(store))),
      multiGet: jest.fn((keys: string[]) =>
        Promise.resolve(keys.map((key) => [key, store[key] ?? null]))
      ),
      multiSet: jest.fn((entries: [string, string][]) => {
        entries.forEach(([key, value]) => {
          store[key] = value;
        });
        return Promise.resolve();
      }),
      multiRemove: jest.fn((keys: string[]) => {
        keys.forEach((key) => delete store[key]);
        return Promise.resolve();
      }),
    },
  };
});

// Mock expo-secure-store
jest.mock('expo-secure-store', () => {
  const secureStore: Record<string, string> = {};
  return {
    setItemAsync: jest.fn((key: string, value: string) => {
      secureStore[key] = value;
      return Promise.resolve();
    }),
    getItemAsync: jest.fn((key: string) =>
      Promise.resolve(secureStore[key] ?? null)
    ),
    deleteItemAsync: jest.fn((key: string) => {
      delete secureStore[key];
      return Promise.resolve();
    }),
    isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  };
});

// Mock @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() =>
    Promise.resolve({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
    })
  ),
}));

// Suppress console.warn in tests to reduce noise
const originalWarn = console.warn;
beforeAll(() => {
  console.warn = jest.fn();
});

afterAll(() => {
  console.warn = originalWarn;
});
