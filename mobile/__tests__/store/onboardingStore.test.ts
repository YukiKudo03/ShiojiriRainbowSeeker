/**
 * Unit Tests for onboardingStore (Zustand)
 *
 * Tests the onboarding store state management and persistence
 * to AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useOnboardingStore } from '../../src/store/onboardingStore';

const mockedAsyncStorage = jest.mocked(AsyncStorage);

/**
 * Helper: reset the Zustand store to initial state between tests.
 * Zustand stores are singletons so we need to manually reset.
 */
const resetStore = () => {
  useOnboardingStore.setState({
    isCompleted: false,
    isInitialized: false,
    isLoading: false,
  });
};

describe('onboardingStore', () => {
  beforeEach(() => {
    resetStore();
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------
  // Initial State
  // -------------------------------------------------------------------
  describe('initial state', () => {
    it('should have isCompleted as false', () => {
      expect(useOnboardingStore.getState().isCompleted).toBe(false);
    });

    it('should have isInitialized as false', () => {
      expect(useOnboardingStore.getState().isInitialized).toBe(false);
    });

    it('should have isLoading as false', () => {
      expect(useOnboardingStore.getState().isLoading).toBe(false);
    });
  });

  // -------------------------------------------------------------------
  // initializeOnboarding
  // -------------------------------------------------------------------
  describe('initializeOnboarding', () => {
    it('should load completed state from AsyncStorage when value is true', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue('true');

      await useOnboardingStore.getState().initializeOnboarding();

      const state = useOnboardingStore.getState();
      expect(state.isCompleted).toBe(true);
      expect(state.isInitialized).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(mockedAsyncStorage.getItem).toHaveBeenCalledWith(
        'shiojiri_rainbow_onboarding_completed'
      );
    });

    it('should set isCompleted to false when AsyncStorage value is not true', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue(null);

      await useOnboardingStore.getState().initializeOnboarding();

      const state = useOnboardingStore.getState();
      expect(state.isCompleted).toBe(false);
      expect(state.isInitialized).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('should set isInitialized true and isCompleted false on error', async () => {
      mockedAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      await useOnboardingStore.getState().initializeOnboarding();

      const state = useOnboardingStore.getState();
      expect(state.isCompleted).toBe(false);
      expect(state.isInitialized).toBe(true);
      expect(state.isLoading).toBe(false);
    });
  });

  // -------------------------------------------------------------------
  // completeOnboarding
  // -------------------------------------------------------------------
  describe('completeOnboarding', () => {
    it('should set isCompleted to true and save to AsyncStorage', async () => {
      await useOnboardingStore.getState().completeOnboarding();

      const state = useOnboardingStore.getState();
      expect(state.isCompleted).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
        'shiojiri_rainbow_onboarding_completed',
        'true'
      );
    });

    it('should still set isCompleted to true even when storage fails', async () => {
      mockedAsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));

      await useOnboardingStore.getState().completeOnboarding();

      const state = useOnboardingStore.getState();
      expect(state.isCompleted).toBe(true);
      expect(state.isLoading).toBe(false);
    });
  });

  // -------------------------------------------------------------------
  // resetOnboarding
  // -------------------------------------------------------------------
  describe('resetOnboarding', () => {
    it('should clear AsyncStorage and set isCompleted to false', async () => {
      // Start from completed state
      useOnboardingStore.setState({ isCompleted: true });

      await useOnboardingStore.getState().resetOnboarding();

      const state = useOnboardingStore.getState();
      expect(state.isCompleted).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(mockedAsyncStorage.removeItem).toHaveBeenCalledWith(
        'shiojiri_rainbow_onboarding_completed'
      );
    });

    it('should still set isCompleted to false even when storage fails', async () => {
      useOnboardingStore.setState({ isCompleted: true });
      mockedAsyncStorage.removeItem.mockRejectedValue(
        new Error('Storage error')
      );

      await useOnboardingStore.getState().resetOnboarding();

      const state = useOnboardingStore.getState();
      expect(state.isCompleted).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });
});
