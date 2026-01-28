/**
 * useLanguage Hook
 *
 * Custom hook for managing language preferences
 *
 * Features:
 * - Get current language
 * - Change language with persistence
 * - Get list of supported languages
 *
 * Requirements: NFR-5 (Internationalization)
 */

import { useCallback, useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import {
  changeLanguage as changeI18nLanguage,
  getCurrentLanguage,
  SUPPORTED_LANGUAGES,
} from '../i18n';

import type { SupportedLanguage } from '../i18n';

/**
 * Language option for UI display
 */
export interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
}

/**
 * Hook return type
 */
export interface UseLanguageReturn {
  /** Current language code */
  currentLanguage: SupportedLanguage;
  /** List of available language options */
  languages: LanguageOption[];
  /** Change the current language */
  changeLanguage: (language: SupportedLanguage) => Promise<void>;
  /** Check if a language is currently active */
  isCurrentLanguage: (language: SupportedLanguage) => boolean;
}

/**
 * Custom hook for language management
 */
export const useLanguage = (): UseLanguageReturn => {
  const { i18n } = useTranslation();

  // Get current language from i18n instance
  const currentLanguage = (i18n.language || getCurrentLanguage()) as SupportedLanguage;

  // Build language options list
  const languages = useMemo<LanguageOption[]>(() => {
    return Object.entries(SUPPORTED_LANGUAGES).map(([code, names]) => ({
      code: code as SupportedLanguage,
      name: names.name,
      nativeName: names.nativeName,
    }));
  }, []);

  // Change language handler
  const changeLanguage = useCallback(async (language: SupportedLanguage): Promise<void> => {
    if (language !== currentLanguage) {
      await changeI18nLanguage(language);
    }
  }, [currentLanguage]);

  // Check if language is current
  const isCurrentLanguage = useCallback(
    (language: SupportedLanguage): boolean => {
      return language === currentLanguage;
    },
    [currentLanguage]
  );

  return {
    currentLanguage,
    languages,
    changeLanguage,
    isCurrentLanguage,
  };
};

export default useLanguage;
