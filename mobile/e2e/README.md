# E2E Testing with Detox

This directory contains End-to-End (E2E) tests for the Shiojiri Rainbow Seeker mobile application using Detox framework.

## Overview

These tests cover the main user flows:
- **Authentication** (FR-1): Registration, Login, Logout
- **Photo Capture** (FR-2, FR-3): Camera access, capture, upload
- **Social Features** (FR-7): Like, Comment, Report
- **Profile Management** (FR-9): View and edit profile
- **Onboarding** (FR-11): First-time user experience

## Prerequisites

1. **Node.js** (v18 or later)
2. **Xcode** (for iOS testing)
3. **Android Studio** (for Android testing)
4. **Detox CLI** installed globally:
   ```bash
   npm install -g detox-cli
   ```
5. **iOS Simulator** (iPhone 15 recommended)
6. **Android Emulator** (Pixel 4 API 30 recommended)

## Setup

1. Install dependencies:
   ```bash
   cd mobile
   npm install
   ```

2. For iOS, install CocoaPods dependencies:
   ```bash
   cd ios && pod install && cd ..
   ```

3. For Android, ensure you have the correct emulator configured:
   ```bash
   emulator -list-avds
   ```
   If you don't have `Pixel_4_API_30`, create it using Android Studio's AVD Manager.

## Running Tests

### iOS (Simulator)

Build and run tests in debug mode:
```bash
npm run e2e:ios
```

Or separately:
```bash
# Build
npm run e2e:build:ios

# Run tests
npm run e2e:test:ios
```

For release mode:
```bash
npm run e2e:build:ios:release
npm run e2e:test:ios:release
```

### Android (Emulator)

Build and run tests in debug mode:
```bash
npm run e2e:android
```

Or separately:
```bash
# Build
npm run e2e:build:android

# Run tests
npm run e2e:test:android
```

For release mode:
```bash
npm run e2e:build:android:release
npm run e2e:test:android:release
```

## Directory Structure

```
e2e/
  helpers/           # Reusable test helpers
    auth.ts          # Authentication helpers (login, register, logout)
    navigation.ts    # Navigation helpers (tab navigation, screen transitions)
    waitFor.ts       # Custom wait utilities
    index.ts         # Helper exports
  specs/             # Test specifications
    auth.e2e.ts      # Authentication flow tests
    photo.e2e.ts     # Photo capture and upload tests
    social.e2e.ts    # Social features tests (like, comment, report)
    profile.e2e.ts   # Profile management tests
    onboarding.e2e.ts # Onboarding flow tests
  testIDs.ts         # Centralized test ID definitions
  setup.ts           # Detox setup and teardown
  jest.config.js     # Jest configuration for Detox
```

## Test IDs

All test IDs are centralized in `e2e/testIDs.ts`. When adding new components that need to be tested:

1. Add the testID to `testIDs.ts`:
   ```typescript
   export const TestIDs = {
     myScreen: {
       myButton: 'my-button',
     },
   };
   ```

2. Add the testID prop to your component:
   ```tsx
   <Button testID={TestIDs.myScreen.myButton} title="Click me" />
   ```

## Writing Tests

### Basic Test Structure

```typescript
import { by, element, expect, device } from 'detox';
import { TestIDs } from '../testIDs';
import { login } from '../helpers/auth';
import { waitForVisible } from '../helpers/waitFor';

describe('Feature Name', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should do something', async () => {
    // Given: Initial state
    await login();

    // When: User action
    await element(by.id(TestIDs.feature.button)).tap();

    // Then: Expected result
    await expect(element(by.id(TestIDs.feature.result))).toBeVisible();
  });
});
```

### Useful Detox APIs

```typescript
// Finding elements
element(by.id('testId'))           // By testID
element(by.text('Button Text'))     // By text
element(by.label('Accessibility')) // By accessibility label

// Interactions
await element.tap()                 // Tap
await element.typeText('text')      // Type text
await element.clearText()           // Clear text input
await element.scroll(200, 'down')   // Scroll

// Assertions
await expect(element).toBeVisible()
await expect(element).not.toBeVisible()
await expect(element).toExist()
await expect(element).toHaveText('expected')

// Waiting
await waitFor(element).toBeVisible().withTimeout(5000)

// Device
await device.launchApp()
await device.reloadReactNative()
await device.pressBack()
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on:
  pull_request:
    branches: [main]

jobs:
  e2e-ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci
        working-directory: ./mobile

      - name: Install Detox CLI
        run: npm install -g detox-cli

      - name: Build for E2E
        run: npm run e2e:build:ios:release
        working-directory: ./mobile

      - name: Run E2E tests
        run: npm run e2e:test:ios:release
        working-directory: ./mobile
```

## Troubleshooting

### Common Issues

1. **Test timeout**: Increase timeout in `jest.config.js`:
   ```javascript
   testTimeout: 180000,
   ```

2. **Element not found**:
   - Verify the testID is correctly set on the component
   - Use `waitForVisible` instead of immediate assertion
   - Check if the element is inside a ScrollView (may need to scroll)

3. **iOS build failures**:
   ```bash
   cd ios && pod install --repo-update && cd ..
   ```

4. **Android emulator issues**:
   - Ensure the emulator is running before tests
   - Check AVD name matches configuration in `.detoxrc.js`

5. **Permissions not granted**:
   - Reset simulator: `xcrun simctl erase all`
   - Ensure permissions are set in `setup.ts`

### Debug Mode

Run tests with verbose logging:
```bash
detox test --configuration ios.sim.debug --loglevel trace
```

## Test Data

### Test User Credentials

For consistent testing, use the test user defined in `helpers/auth.ts`:

```typescript
export const TEST_USER = {
  email: 'e2e-test@shiojiri-rainbow.app',
  password: 'TestPassword123!',
  displayName: 'E2E Test User',
};
```

**Important**: Ensure this test user exists in your test environment's database.

## Best Practices

1. **Use descriptive test names**: Follow the pattern "should [action] when [condition]"
2. **Keep tests independent**: Each test should be able to run in isolation
3. **Use helper functions**: Centralize common actions in helper files
4. **Wait for elements**: Always use `waitFor` instead of fixed delays
5. **Clean up state**: Reset app state in `beforeEach` hooks
6. **Use testIDs consistently**: Centralize all testIDs in `testIDs.ts`
7. **Handle flaky tests**: Add appropriate timeouts and retry logic

## Contributing

When adding new tests:
1. Follow the existing file structure
2. Add new testIDs to `testIDs.ts`
3. Create helper functions for reusable actions
4. Document any new test data requirements
5. Ensure tests pass locally before committing
