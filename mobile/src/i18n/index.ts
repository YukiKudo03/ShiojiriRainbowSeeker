/**
 * i18n Configuration
 *
 * Internationalization setup using i18next and react-i18next
 *
 * Features:
 * - Japanese (ja) and English (en) language support
 * - Automatic device language detection
 * - Fallback to English when translation is missing
 * - AsyncStorage persistence for user language preference
 *
 * Requirements: NFR-5 (Internationalization)
 */

import { Platform, NativeModules } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import ja from './locales/ja.json';

// Storage key for language preference
export const LANGUAGE_STORAGE_KEY = '@app_language';

// Supported languages
export const SUPPORTED_LANGUAGES = {
  ja: { name: '日本語', nativeName: '日本語' },
  en: { name: 'English', nativeName: 'English' },
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

/**
 * Get device language code
 * Returns 'ja' for Japanese devices, 'en' otherwise
 */
const getDeviceLanguage = (): SupportedLanguage => {
  let deviceLanguage: string | undefined;

  if (Platform.OS === 'ios') {
    deviceLanguage =
      NativeModules.SettingsManager?.settings?.AppleLocale ||
      NativeModules.SettingsManager?.settings?.AppleLanguages?.[0];
  } else if (Platform.OS === 'android') {
    deviceLanguage = NativeModules.I18nManager?.localeIdentifier;
  }

  // Extract language code (e.g., 'ja_JP' -> 'ja', 'en_US' -> 'en')
  const languageCode = deviceLanguage?.split(/[-_]/)[0]?.toLowerCase();

  // Return 'ja' if Japanese, otherwise default to 'en'
  return languageCode === 'ja' ? 'ja' : 'en';
};

/**
 * Load stored language preference from AsyncStorage
 */
export const loadStoredLanguage = async (): Promise<SupportedLanguage | null> => {
  try {
    const storedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (storedLanguage && (storedLanguage === 'ja' || storedLanguage === 'en')) {
      return storedLanguage as SupportedLanguage;
    }
    return null;
  } catch (error) {
    console.warn('Failed to load stored language:', error);
    return null;
  }
};

/**
 * Save language preference to AsyncStorage
 */
export const saveLanguagePreference = async (language: SupportedLanguage): Promise<void> => {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch (error) {
    console.warn('Failed to save language preference:', error);
  }
};

/**
 * Initialize i18n with the appropriate language
 * Priority: 1) Stored preference 2) Device language 3) English fallback
 */
export const initializeI18n = async (): Promise<void> => {
  // Try to get stored language preference
  const storedLanguage = await loadStoredLanguage();
  const initialLanguage = storedLanguage || getDeviceLanguage();

  await i18n.use(initReactI18next).init({
    resources: {
      ja: { translation: ja },
      en: { translation: en },
    },
    lng: initialLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false, // Disable suspense for React Native
    },
    compatibilityJSON: 'v4', // Use v4 compatibility mode
  });
};

/**
 * Change the current language
 */
export const changeLanguage = async (language: SupportedLanguage): Promise<void> => {
  await i18n.changeLanguage(language);
  await saveLanguagePreference(language);
};

/**
 * Get current language
 */
export const getCurrentLanguage = (): SupportedLanguage => {
  return i18n.language as SupportedLanguage;
};

export default i18n;
