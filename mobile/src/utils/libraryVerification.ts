/**
 * Library Verification File
 *
 * This file verifies that all installed libraries can be imported correctly.
 * It serves as a smoke test for package installation.
 *
 * Run `npm run type-check` to verify all imports are valid.
 */

// External libraries (alphabetical order)
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import axios from "axios";
import { format, parseISO, addDays, differenceInDays } from "date-fns";
import { Camera, CameraView } from "expo-camera";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import i18n from "i18next";
import { useForm, Controller } from "react-hook-form";
import { useTranslation, initReactI18next } from "react-i18next";
import { LineChart, BarChart } from "react-native-chart-kit";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { create } from "zustand";

// ============================================================================
// Export verification object
// This ensures TypeScript validates all imports
// ============================================================================
export const libraryVerification = {
  // Navigation
  NavigationContainer,
  createNativeStackNavigator,
  createBottomTabNavigator,
  GestureHandlerRootView,
  SafeAreaProvider,

  // State Management
  zustandCreate: create,
  QueryClient,
  QueryClientProvider,
  useQuery,

  // HTTP Client
  axios,

  // Maps
  MapView,
  Marker,
  PROVIDER_GOOGLE,

  // Expo Camera & Image
  Camera,
  CameraView,
  ImagePicker,
  ExpoImage: Image,

  // Expo Location
  Location,

  // Expo Notifications
  Notifications,

  // Storage
  AsyncStorage,
  SecureStore,

  // Charts & SVG
  LineChart,
  BarChart,
  Svg,
  SvgCircle: Circle,
  SvgPath: Path,
  SvgRect: Rect,

  // i18n
  i18n,
  useTranslation,
  initReactI18next,

  // Date utilities
  formatDate: format,
  parseISO,
  addDays,
  differenceInDays,

  // Form handling
  useForm,
  Controller,
};

/**
 * Summary of installed packages:
 *
 * Navigation:
 * - @react-navigation/native
 * - @react-navigation/native-stack
 * - @react-navigation/bottom-tabs
 * - react-native-screens
 * - react-native-safe-area-context
 * - react-native-gesture-handler
 *
 * State Management:
 * - zustand
 * - @tanstack/react-query
 *
 * API/HTTP:
 * - axios
 *
 * Maps:
 * - react-native-maps
 *
 * Camera & Location:
 * - expo-camera
 * - expo-image-picker
 * - expo-location
 *
 * Notifications:
 * - expo-notifications
 *
 * Charts:
 * - react-native-chart-kit
 * - react-native-svg
 *
 * Internationalization:
 * - i18next
 * - react-i18next
 *
 * Storage:
 * - @react-native-async-storage/async-storage
 * - expo-secure-store
 *
 * Image handling:
 * - expo-image
 *
 * Date/Time:
 * - date-fns
 *
 * Form handling:
 * - react-hook-form
 */
