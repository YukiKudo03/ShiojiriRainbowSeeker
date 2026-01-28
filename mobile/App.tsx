/**
 * Shiojiri Rainbow Seeker - Mobile App
 * Main entry point with navigation setup
 *
 * Features:
 * - i18n (internationalization) with Japanese and English support
 * - Onboarding flow for first-time users
 * - Authentication state management
 */

import React, { useEffect, useState } from 'react';

import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initializeI18n } from './src/i18n';
import { RootNavigator } from './src/navigation';
import { useAuthStore } from './src/store/authStore';
import { useOnboardingStore } from './src/store/onboardingStore';

export default function App() {
  // Authentication state from Zustand store
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isAuthInitialized = useAuthStore((state) => state.isInitialized);
  const checkAuth = useAuthStore((state) => state.checkAuth);

  // i18n initialization state
  const [isI18nInitialized, setIsI18nInitialized] = useState(false);

  // Onboarding state
  const isOnboardingCompleted = useOnboardingStore(
    (state) => state.isCompleted
  );
  const isOnboardingInitialized = useOnboardingStore(
    (state) => state.isInitialized
  );
  const initializeOnboarding = useOnboardingStore(
    (state) => state.initializeOnboarding
  );

  // Initialize i18n on app start
  useEffect(() => {
    const initI18n = async () => {
      try {
        await initializeI18n();
        setIsI18nInitialized(true);
      } catch (error) {
        console.warn('Failed to initialize i18n:', error);
        // Still allow app to continue with default language
        setIsI18nInitialized(true);
      }
    };
    initI18n();
  }, []);

  // Initialize onboarding state on app start
  useEffect(() => {
    initializeOnboarding();
  }, [initializeOnboarding]);

  // Initialize auth state on app start
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Show loading screen while initializing i18n, onboarding, and auth
  if (!isI18nInitialized || !isOnboardingInitialized || !isAuthInitialized) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaProvider>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4A90A4" />
          </View>
          <StatusBar style="auto" />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <NavigationContainer>
          <RootNavigator
            isAuthenticated={isAuthenticated}
            isOnboardingCompleted={isOnboardingCompleted}
          />
          <StatusBar style="auto" />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
  },
});
