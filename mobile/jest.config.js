/**
 * Jest Configuration for Unit Tests
 *
 * Uses ts-jest to transpile TypeScript test files.
 * Mocks React Native and Expo modules for a Node-based test environment.
 *
 * Note: Component tests (in __tests__/components/) require jest-expo.
 * Run component tests with: npx jest --config jest.config.components.js
 */

/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/__tests__/**/*.test.ts', '<rootDir>/__tests__/**/*.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '/e2e/', '/__tests__/components/', '\\.component\\.test\\.'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        diagnostics: false,
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFiles: ['<rootDir>/__tests__/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/index.ts',
    '!src/types/**',
    '!src/i18n/**',
    '!src/navigation/**',
    '!src/screens/**',
    '!src/hooks/**',
    '!src/components/**',
  ],
  clearMocks: true,
  restoreMocks: true,
};
