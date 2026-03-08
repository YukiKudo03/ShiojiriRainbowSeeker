/**
 * Unit Tests for libraryVerification
 *
 * Verifies that the library verification export object contains all expected packages.
 */

// Mock all the heavy native dependencies
jest.mock('react-native-maps', () => ({
  __esModule: true,
  default: 'MapView',
  Marker: 'Marker',
  PROVIDER_GOOGLE: 'google',
}));

jest.mock('expo-camera', () => ({
  Camera: 'Camera',
  CameraView: 'CameraView',
}));

jest.mock('expo-image', () => ({
  Image: 'ExpoImage',
}));

jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-location', () => ({}));
jest.mock('expo-notifications', () => ({}));

jest.mock('react-native-chart-kit', () => ({
  LineChart: 'LineChart',
  BarChart: 'BarChart',
}));

jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Circle: 'Circle',
  Path: 'Path',
  Rect: 'Rect',
}));

jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: 'GestureHandlerRootView',
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: 'SafeAreaProvider',
}));

jest.mock('@react-navigation/native', () => ({
  NavigationContainer: 'NavigationContainer',
}));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: jest.fn(),
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: jest.fn(),
}));

jest.mock('react-hook-form', () => ({
  useForm: jest.fn(),
  Controller: 'Controller',
}));

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(),
  initReactI18next: {},
}));

jest.mock('i18next', () => ({
  __esModule: true,
  default: {},
}));

import { libraryVerification } from '../../src/utils/libraryVerification';

describe('libraryVerification', () => {
  it('should export a verification object', () => {
    expect(libraryVerification).toBeDefined();
    expect(typeof libraryVerification).toBe('object');
  });

  it('should include navigation libraries', () => {
    expect(libraryVerification.NavigationContainer).toBeDefined();
    expect(libraryVerification.createNativeStackNavigator).toBeDefined();
    expect(libraryVerification.createBottomTabNavigator).toBeDefined();
    expect(libraryVerification.GestureHandlerRootView).toBeDefined();
    expect(libraryVerification.SafeAreaProvider).toBeDefined();
  });

  it('should include state management libraries', () => {
    expect(libraryVerification.zustandCreate).toBeDefined();
    expect(libraryVerification.QueryClient).toBeDefined();
    expect(libraryVerification.QueryClientProvider).toBeDefined();
    expect(libraryVerification.useQuery).toBeDefined();
  });

  it('should include HTTP client', () => {
    expect(libraryVerification.axios).toBeDefined();
  });

  it('should include map libraries', () => {
    expect(libraryVerification.MapView).toBeDefined();
    expect(libraryVerification.Marker).toBeDefined();
    expect(libraryVerification.PROVIDER_GOOGLE).toBeDefined();
  });

  it('should include camera and image libraries', () => {
    expect(libraryVerification.Camera).toBeDefined();
    expect(libraryVerification.CameraView).toBeDefined();
    expect(libraryVerification.ImagePicker).toBeDefined();
    expect(libraryVerification.ExpoImage).toBeDefined();
  });

  it('should include location library', () => {
    expect(libraryVerification.Location).toBeDefined();
  });

  it('should include storage libraries', () => {
    expect(libraryVerification.AsyncStorage).toBeDefined();
    expect(libraryVerification.SecureStore).toBeDefined();
  });

  it('should include chart and SVG libraries', () => {
    expect(libraryVerification.LineChart).toBeDefined();
    expect(libraryVerification.BarChart).toBeDefined();
    expect(libraryVerification.Svg).toBeDefined();
  });

  it('should include i18n libraries', () => {
    expect(libraryVerification.i18n).toBeDefined();
    expect(libraryVerification.useTranslation).toBeDefined();
    expect(libraryVerification.initReactI18next).toBeDefined();
  });

  it('should include date utilities', () => {
    expect(libraryVerification.formatDate).toBeDefined();
    expect(libraryVerification.parseISO).toBeDefined();
    expect(libraryVerification.addDays).toBeDefined();
    expect(libraryVerification.differenceInDays).toBeDefined();
  });

  it('should include form handling', () => {
    expect(libraryVerification.useForm).toBeDefined();
    expect(libraryVerification.Controller).toBeDefined();
  });
});
