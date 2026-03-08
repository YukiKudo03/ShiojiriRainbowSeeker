/**
 * Jest Configuration for Component Tests
 *
 * Uses jest-expo preset for proper React Native/Expo module resolution.
 *
 * Run with: npm run test:components
 */

/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  preset: 'jest-expo',
  rootDir: '.',
  testMatch: [
    '<rootDir>/__tests__/components/**/*.test.tsx',
    '<rootDir>/__tests__/hooks/**/*.component.test.ts',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@expo/vector-icons$': '<rootDir>/__tests__/__mocks__/@expo/vector-icons.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)',
  ],
  setupFiles: ['<rootDir>/__tests__/setup.ts'],
  collectCoverageFrom: [
    'src/components/**/*.{ts,tsx}',
    'src/hooks/**/*.{ts,tsx}',
    '!src/**/index.ts',
  ],
  clearMocks: true,
  restoreMocks: true,
};
