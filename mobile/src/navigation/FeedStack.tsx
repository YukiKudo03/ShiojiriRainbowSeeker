/**
 * FeedStack - Navigation stack for feed screens
 */

import React from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { FeedScreen, PhotoDetailScreen } from '../screens/feed';

import type { FeedStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<FeedStackParamList>();

export const FeedStack: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#4A90A4',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      <Stack.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="PhotoDetail"
        component={PhotoDetailScreen}
        options={{
          title: 'Photo Details',
        }}
      />
    </Stack.Navigator>
  );
};
