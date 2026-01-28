/**
 * MainTabs - Bottom tab navigator for authenticated users
 */

import React from 'react';

import { StyleSheet, View, Text } from 'react-native';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { CameraStack } from './CameraStack';
import { FeedStack } from './FeedStack';
import { MapStack } from './MapStack';
import { ProfileStack } from './ProfileStack';

import type { MainTabParamList } from '../types/navigation';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Simple icon component placeholder
// In production, use a proper icon library like @expo/vector-icons
interface TabIconProps {
  label: string;
  focused: boolean;
}

const TabIcon: React.FC<TabIconProps> = ({ label, focused }) => (
  <View style={styles.iconContainer}>
    <Text style={[styles.iconText, focused && styles.iconTextFocused]}>
      {label.charAt(0)}
    </Text>
  </View>
);

export const MainTabs: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#4A90A4',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#e0e0e0',
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tab.Screen
        name="FeedTab"
        component={FeedStack}
        options={{
          tabBarLabel: 'Feed',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Feed" focused={focused} />
          ),
          tabBarAccessibilityLabel: 'tab-feed',
          tabBarButtonTestID: 'tab-feed',
        }}
      />
      <Tab.Screen
        name="MapTab"
        component={MapStack}
        options={{
          tabBarLabel: 'Map',
          tabBarIcon: ({ focused }) => <TabIcon label="Map" focused={focused} />,
          tabBarAccessibilityLabel: 'tab-map',
          tabBarButtonTestID: 'tab-map',
        }}
      />
      <Tab.Screen
        name="CameraTab"
        component={CameraStack}
        options={{
          tabBarLabel: 'Camera',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Camera" focused={focused} />
          ),
          tabBarAccessibilityLabel: 'tab-camera',
          tabBarButtonTestID: 'tab-camera',
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Profile" focused={focused} />
          ),
          tabBarAccessibilityLabel: 'tab-profile',
          tabBarButtonTestID: 'tab-profile',
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  iconTextFocused: {
    color: '#4A90A4',
  },
});
