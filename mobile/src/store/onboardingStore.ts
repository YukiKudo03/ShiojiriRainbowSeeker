/**
 * Onboarding Store (Zustand)
 *
 * Global state management for onboarding:
 * - Tracks onboarding completion status
 * - Persists state to AsyncStorage
 * - Provides actions to complete/reset onboarding
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

/**
 * AsyncStorage key for onboarding completion
 */
const ONBOARDING_COMPLETED_KEY = 'shiojiri_rainbow_onboarding_completed';

/**
 * Onboarding state interface
 */
interface OnboardingState {
  /**
   * Whether onboarding has been completed
   */
  isCompleted: boolean;
  /**
   * Whether the onboarding state has been loaded from storage
   */
  isInitialized: boolean;
  /**
   * Loading state for async operations
   */
  isLoading: boolean;
}

/**
 * Onboarding actions interface
 */
interface OnboardingActions {
  /**
   * Initialize onboarding state from AsyncStorage
   */
  initializeOnboarding: () => Promise<void>;
  /**
   * Mark onboarding as completed and persist to storage
   */
  completeOnboarding: () => Promise<void>;
  /**
   * Reset onboarding state (for debugging/testing)
   */
  resetOnboarding: () => Promise<void>;
}

/**
 * Combined onboarding store type
 */
type OnboardingStore = OnboardingState & OnboardingActions;

/**
 * Initial state
 */
const initialState: OnboardingState = {
  isCompleted: false,
  isInitialized: false,
  isLoading: false,
};

/**
 * Create onboarding store
 */
export const useOnboardingStore = create<OnboardingStore>((set) => ({
  // Initial state
  ...initialState,

  /**
   * Initialize onboarding state from AsyncStorage
   * Should be called on app start
   */
  initializeOnboarding: async (): Promise<void> => {
    set({ isLoading: true });

    try {
      const value = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
      const isCompleted = value === 'true';

      set({
        isCompleted,
        isInitialized: true,
        isLoading: false,
      });
    } catch (error) {
      console.warn('Failed to load onboarding state:', error);
      // Default to not completed if there's an error
      set({
        isCompleted: false,
        isInitialized: true,
        isLoading: false,
      });
    }
  },

  /**
   * Mark onboarding as completed and persist to storage
   */
  completeOnboarding: async (): Promise<void> => {
    set({ isLoading: true });

    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
      set({
        isCompleted: true,
        isLoading: false,
      });
    } catch (error) {
      console.warn('Failed to save onboarding state:', error);
      // Still update local state even if storage fails
      set({
        isCompleted: true,
        isLoading: false,
      });
    }
  },

  /**
   * Reset onboarding state (for debugging/testing)
   */
  resetOnboarding: async (): Promise<void> => {
    set({ isLoading: true });

    try {
      await AsyncStorage.removeItem(ONBOARDING_COMPLETED_KEY);
      set({
        isCompleted: false,
        isLoading: false,
      });
    } catch (error) {
      console.warn('Failed to reset onboarding state:', error);
      set({
        isCompleted: false,
        isLoading: false,
      });
    }
  },
}));

/**
 * Selectors for onboarding state
 */
export const selectIsOnboardingCompleted = (
  state: OnboardingStore
): boolean => state.isCompleted;
export const selectIsOnboardingInitialized = (
  state: OnboardingStore
): boolean => state.isInitialized;
export const selectIsOnboardingLoading = (state: OnboardingStore): boolean =>
  state.isLoading;

/**
 * Hook for onboarding completion status
 */
export const useIsOnboardingCompleted = (): boolean =>
  useOnboardingStore(selectIsOnboardingCompleted);

/**
 * Hook for onboarding initialization status
 */
export const useIsOnboardingInitialized = (): boolean =>
  useOnboardingStore(selectIsOnboardingInitialized);

/**
 * Hook for onboarding loading status
 */
export const useIsOnboardingLoading = (): boolean =>
  useOnboardingStore(selectIsOnboardingLoading);
