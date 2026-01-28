/**
 * RootNavigator - Top level navigation that handles auth and onboarding state
 */

import React from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';
import { OnboardingScreen } from '../screens/onboarding';

import type { RootStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

interface RootNavigatorProps {
  /**
   * Whether the user is authenticated
   * When true, shows MainTabs; when false, shows AuthStack
   */
  isAuthenticated?: boolean;
  /**
   * Whether onboarding has been completed
   * When false, shows OnboardingScreen first
   */
  isOnboardingCompleted?: boolean;
}

export const RootNavigator: React.FC<RootNavigatorProps> = ({
  isAuthenticated = false,
  isOnboardingCompleted = true,
}) => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isOnboardingCompleted ? (
        // Show onboarding for first-time users
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : isAuthenticated ? (
        // Show main app for authenticated users
        <Stack.Screen name="Main" component={MainTabs} />
      ) : (
        // Show auth flow for unauthenticated users
        <Stack.Screen name="Auth" component={AuthStack} />
      )}
    </Stack.Navigator>
  );
};
