/**
 * Unit Tests for validation utilities
 *
 * Tests form validation functions for email, password, display name,
 * and complete form validation.
 */

import {
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  validateDisplayName,
  validateLoginForm,
  validateRegisterForm,
} from '../../src/utils/validation';

describe('validation', () => {
  // -------------------------------------------------------------------
  // validateEmail
  // -------------------------------------------------------------------
  describe('validateEmail', () => {
    it('should return error for empty string', () => {
      const result = validateEmail('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Email is required');
    });

    it('should return error for whitespace-only string', () => {
      const result = validateEmail('   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Email is required');
    });

    it('should return error for invalid email format (no @)', () => {
      const result = validateEmail('invalidemail');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please enter a valid email address');
    });

    it('should return error for invalid email format (no domain)', () => {
      const result = validateEmail('user@');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please enter a valid email address');
    });

    it('should return error for invalid email format (no TLD)', () => {
      const result = validateEmail('user@domain');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please enter a valid email address');
    });

    it('should return valid for correct email format', () => {
      const result = validateEmail('user@example.com');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return valid for email with subdomain', () => {
      const result = validateEmail('user@sub.domain.co.jp');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------
  // validatePassword
  // -------------------------------------------------------------------
  describe('validatePassword', () => {
    it('should return error for empty string', () => {
      const result = validatePassword('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password is required');
    });

    it('should return error for password shorter than 8 characters', () => {
      const result = validatePassword('short');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password must be at least 8 characters');
    });

    it('should return error for password exactly 7 characters', () => {
      const result = validatePassword('1234567');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password must be at least 8 characters');
    });

    it('should return error for password longer than 128 characters', () => {
      const result = validatePassword('a'.repeat(129));
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password must be less than 128 characters');
    });

    it('should return valid for password exactly 8 characters', () => {
      const result = validatePassword('12345678');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return valid for password exactly 128 characters', () => {
      const result = validatePassword('a'.repeat(128));
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------
  // validatePasswordConfirmation
  // -------------------------------------------------------------------
  describe('validatePasswordConfirmation', () => {
    it('should return error for empty confirmation', () => {
      const result = validatePasswordConfirmation('password123', '');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please confirm your password');
    });

    it('should return error when passwords do not match', () => {
      const result = validatePasswordConfirmation('password123', 'password456');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Passwords do not match');
    });

    it('should return valid when passwords match', () => {
      const result = validatePasswordConfirmation('password123', 'password123');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------
  // validateDisplayName
  // -------------------------------------------------------------------
  describe('validateDisplayName', () => {
    it('should return error for empty string', () => {
      const result = validateDisplayName('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Display name is required');
    });

    it('should return error for whitespace-only string', () => {
      const result = validateDisplayName('   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Display name is required');
    });

    it('should return error for name shorter than 3 characters', () => {
      const result = validateDisplayName('AB');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Display name must be at least 3 characters');
    });

    it('should return error for name longer than 30 characters', () => {
      const result = validateDisplayName('A'.repeat(31));
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Display name must be less than 30 characters');
    });

    it('should return valid for name exactly 3 characters', () => {
      const result = validateDisplayName('ABC');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return valid for name exactly 30 characters', () => {
      const result = validateDisplayName('A'.repeat(30));
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------
  // validateLoginForm
  // -------------------------------------------------------------------
  describe('validateLoginForm', () => {
    it('should return invalid with errors when all fields are empty', () => {
      const result = validateLoginForm('', '');
      expect(result.isValid).toBe(false);
      expect(result.errors.email).toBe('Email is required');
      expect(result.errors.password).toBe('Password is required');
    });

    it('should return valid when all fields are correct', () => {
      const result = validateLoginForm('user@example.com', 'password123');
      expect(result.isValid).toBe(true);
      expect(result.errors.email).toBeUndefined();
      expect(result.errors.password).toBeUndefined();
    });

    it('should return invalid when only email is invalid', () => {
      const result = validateLoginForm('bademail', 'password123');
      expect(result.isValid).toBe(false);
      expect(result.errors.email).toBe('Please enter a valid email address');
      expect(result.errors.password).toBeUndefined();
    });

    it('should return invalid when only password is invalid', () => {
      const result = validateLoginForm('user@example.com', 'short');
      expect(result.isValid).toBe(false);
      expect(result.errors.email).toBeUndefined();
      expect(result.errors.password).toBe('Password must be at least 8 characters');
    });
  });

  // -------------------------------------------------------------------
  // validateRegisterForm
  // -------------------------------------------------------------------
  describe('validateRegisterForm', () => {
    it('should return invalid with all errors when all fields are empty', () => {
      const result = validateRegisterForm('', '', '', '');
      expect(result.isValid).toBe(false);
      expect(result.errors.email).toBe('Email is required');
      expect(result.errors.password).toBe('Password is required');
      expect(result.errors.passwordConfirmation).toBe('Please confirm your password');
      expect(result.errors.displayName).toBe('Display name is required');
    });

    it('should return valid when all fields are correct', () => {
      const result = validateRegisterForm(
        'user@example.com',
        'password123',
        'password123',
        'Test User'
      );
      expect(result.isValid).toBe(true);
      expect(result.errors.email).toBeUndefined();
      expect(result.errors.password).toBeUndefined();
      expect(result.errors.passwordConfirmation).toBeUndefined();
      expect(result.errors.displayName).toBeUndefined();
    });

    it('should return invalid when passwords do not match', () => {
      const result = validateRegisterForm(
        'user@example.com',
        'password123',
        'password456',
        'Test User'
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.passwordConfirmation).toBe('Passwords do not match');
    });
  });
});
