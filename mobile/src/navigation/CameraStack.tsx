/**
 * CameraStack - Navigation stack for camera screens
 */

import React from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CameraScreen, PhotoUploadScreen } from '../screens/camera';

import type { CameraStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<CameraStackParamList>();

export const CameraStack: React.FC = () => {
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
        name="Camera"
        component={CameraScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="PhotoUpload"
        component={PhotoUploadScreen}
        options={{
          title: 'Upload Photo',
        }}
      />
    </Stack.Navigator>
  );
};
