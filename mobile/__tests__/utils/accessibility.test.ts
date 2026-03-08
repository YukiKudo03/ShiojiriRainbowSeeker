/**
 * Unit Tests for accessibility utilities
 *
 * Tests WCAG 2.1 AA compliance helpers including
 * accessibility props creation, contrast ratio calculations,
 * screen reader formatting, and touch target utilities.
 */

import {
  createButtonAccessibilityProps,
  createLinkAccessibilityProps,
  createImageAccessibilityProps,
  createInputAccessibilityProps,
  createCheckboxAccessibilityProps,
  createHeaderAccessibilityProps,
  createAlertAccessibilityProps,
  createProgressAccessibilityProps,
  getContrastRatio,
  meetsContrastRequirement,
  formatNumberForScreenReader,
  createScreenReaderAnnouncement,
  getHitSlop,
  MIN_TOUCH_TARGET_SIZE,
} from '../../src/utils/accessibility';

describe('accessibility', () => {
  // -------------------------------------------------------------------
  // createButtonAccessibilityProps
  // -------------------------------------------------------------------
  describe('createButtonAccessibilityProps', () => {
    it('should create basic button props with label', () => {
      const props = createButtonAccessibilityProps('Submit');
      expect(props.accessible).toBe(true);
      expect(props.accessibilityLabel).toBe('Submit');
      expect(props.accessibilityRole).toBe('button');
      expect(props.accessibilityState?.disabled).toBe(false);
      expect(props.accessibilityState?.selected).toBe(false);
      expect(props.accessibilityState?.busy).toBe(false);
    });

    it('should include disabled state when specified', () => {
      const props = createButtonAccessibilityProps('Submit', { disabled: true });
      expect(props.accessibilityState?.disabled).toBe(true);
    });

    it('should include hint when specified', () => {
      const props = createButtonAccessibilityProps('Submit', {
        hint: 'Submits the form',
      });
      expect(props.accessibilityHint).toBe('Submits the form');
    });
  });

  // -------------------------------------------------------------------
  // createLinkAccessibilityProps
  // -------------------------------------------------------------------
  describe('createLinkAccessibilityProps', () => {
    it('should create link props with default hint', () => {
      const props = createLinkAccessibilityProps('Privacy Policy');
      expect(props.accessible).toBe(true);
      expect(props.accessibilityLabel).toBe('Privacy Policy');
      expect(props.accessibilityRole).toBe('link');
      expect(props.accessibilityHint).toBe('Opens link');
    });

    it('should use custom hint when provided', () => {
      const props = createLinkAccessibilityProps(
        'Privacy Policy',
        'Opens in browser'
      );
      expect(props.accessibilityHint).toBe('Opens in browser');
    });
  });

  // -------------------------------------------------------------------
  // createImageAccessibilityProps
  // -------------------------------------------------------------------
  describe('createImageAccessibilityProps', () => {
    it('should create accessible image props for non-decorative image', () => {
      const props = createImageAccessibilityProps('Rainbow over Shiojiri');
      expect(props.accessible).toBe(true);
      expect(props.accessibilityLabel).toBe('Rainbow over Shiojiri');
      expect(props.accessibilityRole).toBe('image');
    });

    it('should hide decorative images from accessibility tree', () => {
      const props = createImageAccessibilityProps('decoration', true);
      expect(props.accessible).toBe(false);
      expect(props.importantForAccessibility).toBe('no-hide-descendants');
      expect(props.accessibilityLabel).toBeUndefined();
      expect(props.accessibilityRole).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------
  // createInputAccessibilityProps
  // -------------------------------------------------------------------
  describe('createInputAccessibilityProps', () => {
    it('should create input props with label', () => {
      const props = createInputAccessibilityProps('Email');
      expect(props.accessible).toBe(true);
      expect(props.accessibilityLabel).toBe('Email');
      expect(props.accessibilityState?.disabled).toBe(false);
    });

    it('should include error in label when error is provided', () => {
      const props = createInputAccessibilityProps('Email', {
        error: 'Email is required',
      });
      expect(props.accessibilityLabel).toBe('Email, error: Email is required');
    });
  });

  // -------------------------------------------------------------------
  // createCheckboxAccessibilityProps
  // -------------------------------------------------------------------
  describe('createCheckboxAccessibilityProps', () => {
    it('should create checkbox props with checked state', () => {
      const props = createCheckboxAccessibilityProps('Accept terms', true);
      expect(props.accessible).toBe(true);
      expect(props.accessibilityLabel).toBe('Accept terms');
      expect(props.accessibilityRole).toBe('checkbox');
      expect(props.accessibilityState?.checked).toBe(true);
      expect(props.accessibilityState?.disabled).toBe(false);
    });

    it('should create checkbox props with unchecked state', () => {
      const props = createCheckboxAccessibilityProps('Accept terms', false);
      expect(props.accessibilityState?.checked).toBe(false);
    });
  });

  // -------------------------------------------------------------------
  // createHeaderAccessibilityProps
  // -------------------------------------------------------------------
  describe('createHeaderAccessibilityProps', () => {
    it('should create header props with label and role', () => {
      const props = createHeaderAccessibilityProps('Settings');
      expect(props.accessible).toBe(true);
      expect(props.accessibilityLabel).toBe('Settings');
      expect(props.accessibilityRole).toBe('header');
    });
  });

  // -------------------------------------------------------------------
  // createAlertAccessibilityProps
  // -------------------------------------------------------------------
  describe('createAlertAccessibilityProps', () => {
    it('should create alert props with message', () => {
      const props = createAlertAccessibilityProps('Login failed');
      expect(props.accessible).toBe(true);
      expect(props.accessibilityLabel).toBe('Login failed');
      expect(props.accessibilityRole).toBe('alert');
    });
  });

  // -------------------------------------------------------------------
  // createProgressAccessibilityProps
  // -------------------------------------------------------------------
  describe('createProgressAccessibilityProps', () => {
    it('should create progress props with defaults', () => {
      const props = createProgressAccessibilityProps('Uploading');
      expect(props.accessible).toBe(true);
      expect(props.accessibilityLabel).toBe('Uploading');
      expect(props.accessibilityRole).toBe('progressbar');
      expect(props.accessibilityValue?.min).toBe(0);
      expect(props.accessibilityValue?.max).toBe(100);
      expect(props.accessibilityValue?.now).toBeUndefined();
    });

    it('should create progress props with custom values', () => {
      const props = createProgressAccessibilityProps('Uploading', {
        min: 0,
        max: 100,
        now: 50,
        text: '50%',
      });
      expect(props.accessibilityValue?.now).toBe(50);
      expect(props.accessibilityValue?.text).toBe('50%');
    });
  });

  // -------------------------------------------------------------------
  // getContrastRatio
  // -------------------------------------------------------------------
  describe('getContrastRatio', () => {
    it('should return 21 for black on white', () => {
      const ratio = getContrastRatio('#000000', '#FFFFFF');
      expect(ratio).toBeCloseTo(21, 0);
    });

    it('should return 1 for same colors', () => {
      const ratio = getContrastRatio('#FF0000', '#FF0000');
      expect(ratio).toBeCloseTo(1, 1);
    });

    it('should return 1 for invalid hex colors', () => {
      const ratio = getContrastRatio('not-a-color', '#FFFFFF');
      expect(ratio).toBe(1);
    });
  });

  // -------------------------------------------------------------------
  // meetsContrastRequirement
  // -------------------------------------------------------------------
  describe('meetsContrastRequirement', () => {
    it('should pass for black text on white background (normal text)', () => {
      expect(meetsContrastRequirement('#000000', '#FFFFFF')).toBe(true);
    });

    it('should fail for low contrast colors (normal text)', () => {
      // Light gray on white has very low contrast
      expect(meetsContrastRequirement('#CCCCCC', '#FFFFFF')).toBe(false);
    });

    it('should use lower threshold for large text', () => {
      // This color pair should pass for large text (3:1) but potentially fail for normal text
      // We test with a known ratio around 3.5
      const passes = meetsContrastRequirement('#767676', '#FFFFFF', true);
      // #767676 on white is ~4.54:1, which passes large text requirement
      expect(passes).toBe(true);
    });
  });

  // -------------------------------------------------------------------
  // formatNumberForScreenReader
  // -------------------------------------------------------------------
  describe('formatNumberForScreenReader', () => {
    it('should format numbers >= 100000000 with oku', () => {
      expect(formatNumberForScreenReader(100000000)).toBe('1\u5104');
      expect(formatNumberForScreenReader(300000000)).toBe('3\u5104');
    });

    it('should format numbers >= 10000 with man', () => {
      expect(formatNumberForScreenReader(10000)).toBe('1\u4E07');
      expect(formatNumberForScreenReader(50000)).toBe('5\u4E07');
    });

    it('should format numbers >= 1000 with sen', () => {
      expect(formatNumberForScreenReader(1000)).toBe('1\u5343');
      expect(formatNumberForScreenReader(3000)).toBe('3\u5343');
    });

    it('should return number as string for numbers < 1000', () => {
      expect(formatNumberForScreenReader(999)).toBe('999');
      expect(formatNumberForScreenReader(0)).toBe('0');
      expect(formatNumberForScreenReader(42)).toBe('42');
    });
  });

  // -------------------------------------------------------------------
  // createScreenReaderAnnouncement
  // -------------------------------------------------------------------
  describe('createScreenReaderAnnouncement', () => {
    it('should join multiple parts with comma separator', () => {
      const result = createScreenReaderAnnouncement('Photo uploaded', '3 likes');
      expect(result).toBe('Photo uploaded, 3 likes');
    });

    it('should filter out undefined parts', () => {
      const result = createScreenReaderAnnouncement('Photo', undefined, 'liked');
      expect(result).toBe('Photo, liked');
    });

    it('should handle single part', () => {
      const result = createScreenReaderAnnouncement('Rainbow spotted');
      expect(result).toBe('Rainbow spotted');
    });
  });

  // -------------------------------------------------------------------
  // getHitSlop
  // -------------------------------------------------------------------
  describe('getHitSlop', () => {
    it('should return padding to reach minimum touch target size', () => {
      const slop = getHitSlop(20, 20);
      expect(slop.left).toBe(12);
      expect(slop.right).toBe(12);
      expect(slop.top).toBe(12);
      expect(slop.bottom).toBe(12);
    });

    it('should return zero padding when already at minimum size', () => {
      const slop = getHitSlop(44, 44);
      expect(slop.left).toBe(0);
      expect(slop.right).toBe(0);
      expect(slop.top).toBe(0);
      expect(slop.bottom).toBe(0);
    });

    it('should return zero padding when larger than minimum size', () => {
      const slop = getHitSlop(60, 60);
      expect(slop.left).toBe(0);
      expect(slop.right).toBe(0);
      expect(slop.top).toBe(0);
      expect(slop.bottom).toBe(0);
    });
  });

  // -------------------------------------------------------------------
  // MIN_TOUCH_TARGET_SIZE
  // -------------------------------------------------------------------
  describe('MIN_TOUCH_TARGET_SIZE', () => {
    it('should be 44 (WCAG 2.5.5 minimum)', () => {
      expect(MIN_TOUCH_TARGET_SIZE).toBe(44);
    });
  });
});
