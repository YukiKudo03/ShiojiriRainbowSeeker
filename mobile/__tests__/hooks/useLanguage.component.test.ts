/**
 * Component Tests for useLanguage hook
 *
 * Tests language management hook including current language,
 * language list, change language, and isCurrentLanguage.
 */

import { renderHook, act } from '@testing-library/react-native';

const mockChangeLanguage = jest.fn(() => Promise.resolve());

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(() => ({
    t: (key: string) => key,
    i18n: {
      language: 'ja',
      changeLanguage: mockChangeLanguage,
    },
  })),
}));

jest.mock('../../src/i18n', () => ({
  changeLanguage: jest.fn(() => Promise.resolve()),
  getCurrentLanguage: jest.fn(() => 'ja'),
  SUPPORTED_LANGUAGES: {
    ja: { name: '日本語', nativeName: '日本語' },
    en: { name: 'English', nativeName: 'English' },
  },
}));

import { useLanguage } from '../../src/hooks/useLanguage';
import { changeLanguage as changeI18nLanguage } from '../../src/i18n';

describe('useLanguage hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns current language', () => {
    const { result } = renderHook(() => useLanguage());

    expect(result.current.currentLanguage).toBe('ja');
  });

  it('returns supported languages list', () => {
    const { result } = renderHook(() => useLanguage());

    expect(result.current.languages).toHaveLength(2);
    expect(result.current.languages[0]).toEqual({
      code: 'ja',
      name: '日本語',
      nativeName: '日本語',
    });
    expect(result.current.languages[1]).toEqual({
      code: 'en',
      name: 'English',
      nativeName: 'English',
    });
  });

  it('provides changeLanguage function', () => {
    const { result } = renderHook(() => useLanguage());

    expect(typeof result.current.changeLanguage).toBe('function');
  });

  it('calls i18n changeLanguage when language differs', async () => {
    const { result } = renderHook(() => useLanguage());

    await act(async () => {
      await result.current.changeLanguage('en');
    });

    expect(changeI18nLanguage).toHaveBeenCalledWith('en');
  });

  it('does not call changeLanguage when same language', async () => {
    const { result } = renderHook(() => useLanguage());

    await act(async () => {
      await result.current.changeLanguage('ja');
    });

    expect(changeI18nLanguage).not.toHaveBeenCalled();
  });

  it('isCurrentLanguage returns true for current language', () => {
    const { result } = renderHook(() => useLanguage());

    expect(result.current.isCurrentLanguage('ja')).toBe(true);
  });

  it('isCurrentLanguage returns false for different language', () => {
    const { result } = renderHook(() => useLanguage());

    expect(result.current.isCurrentLanguage('en')).toBe(false);
  });
});
