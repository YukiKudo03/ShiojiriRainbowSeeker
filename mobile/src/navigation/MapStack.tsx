/**
 * MapStack - Navigation stack for map screens
 */

import React from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { MapScreen } from '../screens/map';

import type { MapStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<MapStackParamList>();

export const MapStack: React.FC = () => {
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
        name="Map"
        component={MapScreen}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
};
