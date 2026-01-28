/**
 * Navigation type definitions for the app
 * Provides strict typing for React Navigation
 */

import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams , CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// ============================================
// Auth Stack - Unauthenticated screens
// ============================================

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

// ============================================
// Feed Stack - Photo feed screens
// ============================================

export type FeedStackParamList = {
  Feed: undefined;
  PhotoDetail: { photoId: string };
};

// ============================================
// Map Stack - Map screens
// ============================================

export type MapStackParamList = {
  Map: undefined;
};

// ============================================
// Camera Stack - Camera and photo upload screens
// ============================================

export type CameraStackParamList = {
  Camera: undefined;
  PhotoUpload: {
    photoUri: string;
    width: number;
    height: number;
    latitude?: number;
    longitude?: number;
    timestamp?: string;
  };
};

// ============================================
// Profile Stack - User profile and settings screens
// ============================================

export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  Settings: undefined;
  NotificationSettings: undefined;
};

// ============================================
// Main Tabs - Bottom tab navigator
// ============================================

export type MainTabParamList = {
  FeedTab: NavigatorScreenParams<FeedStackParamList>;
  MapTab: NavigatorScreenParams<MapStackParamList>;
  CameraTab: NavigatorScreenParams<CameraStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};

// ============================================
// Root Navigator - Top level navigation
// ============================================

export type RootStackParamList = {
  Onboarding: undefined;
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};

// ============================================
// Screen Props Types
// ============================================

// Onboarding Screen Props
export type OnboardingScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Onboarding'
>;

// Auth Stack Screen Props
export type LoginScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  'Login'
>;
export type RegisterScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  'Register'
>;
export type ForgotPasswordScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  'ForgotPassword'
>;

// Feed Stack Screen Props
export type FeedScreenProps = CompositeScreenProps<
  NativeStackScreenProps<FeedStackParamList, 'Feed'>,
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList>,
    NativeStackScreenProps<RootStackParamList>
  >
>;
export type PhotoDetailScreenProps = CompositeScreenProps<
  NativeStackScreenProps<FeedStackParamList, 'PhotoDetail'>,
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList>,
    NativeStackScreenProps<RootStackParamList>
  >
>;

// Map Stack Screen Props
export type MapScreenProps = CompositeScreenProps<
  NativeStackScreenProps<MapStackParamList, 'Map'>,
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList>,
    NativeStackScreenProps<RootStackParamList>
  >
>;

// Camera Stack Screen Props
export type CameraScreenProps = CompositeScreenProps<
  NativeStackScreenProps<CameraStackParamList, 'Camera'>,
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList>,
    NativeStackScreenProps<RootStackParamList>
  >
>;
export type PhotoUploadScreenProps = CompositeScreenProps<
  NativeStackScreenProps<CameraStackParamList, 'PhotoUpload'>,
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList>,
    NativeStackScreenProps<RootStackParamList>
  >
>;

// Profile Stack Screen Props
export type ProfileScreenProps = CompositeScreenProps<
  NativeStackScreenProps<ProfileStackParamList, 'Profile'>,
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList>,
    NativeStackScreenProps<RootStackParamList>
  >
>;
export type EditProfileScreenProps = CompositeScreenProps<
  NativeStackScreenProps<ProfileStackParamList, 'EditProfile'>,
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList>,
    NativeStackScreenProps<RootStackParamList>
  >
>;
export type SettingsScreenProps = CompositeScreenProps<
  NativeStackScreenProps<ProfileStackParamList, 'Settings'>,
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList>,
    NativeStackScreenProps<RootStackParamList>
  >
>;
export type NotificationSettingsScreenProps = CompositeScreenProps<
  NativeStackScreenProps<ProfileStackParamList, 'NotificationSettings'>,
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList>,
    NativeStackScreenProps<RootStackParamList>
  >
>;

// ============================================
// Global Navigation Type Declaration
// ============================================

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
