/**
 * Form validation utilities
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate email format
 */
export const validateEmail = (email: string): ValidationResult => {
  if (!email || email.trim() === '') {
    return { isValid: false, error: 'Email is required' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  return { isValid: true };
};

/**
 * Validate password requirements
 */
export const validatePassword = (password: string): ValidationResult => {
  if (!password || password === '') {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters' };
  }

  if (password.length > 128) {
    return { isValid: false, error: 'Password must be less than 128 characters' };
  }

  return { isValid: true };
};

/**
 * Validate password confirmation matches
 */
export const validatePasswordConfirmation = (
  password: string,
  confirmation: string
): ValidationResult => {
  if (!confirmation || confirmation === '') {
    return { isValid: false, error: 'Please confirm your password' };
  }

  if (password !== confirmation) {
    return { isValid: false, error: 'Passwords do not match' };
  }

  return { isValid: true };
};

/**
 * Validate display name
 */
export const validateDisplayName = (displayName: string): ValidationResult => {
  if (!displayName || displayName.trim() === '') {
    return { isValid: false, error: 'Display name is required' };
  }

  const trimmed = displayName.trim();

  if (trimmed.length < 3) {
    return { isValid: false, error: 'Display name must be at least 3 characters' };
  }

  if (trimmed.length > 30) {
    return { isValid: false, error: 'Display name must be less than 30 characters' };
  }

  return { isValid: true };
};

/**
 * Validate login form
 */
export const validateLoginForm = (
  email: string,
  password: string
): { isValid: boolean; errors: { email?: string; password?: string } } => {
  const emailResult = validateEmail(email);
  const passwordResult = validatePassword(password);

  return {
    isValid: emailResult.isValid && passwordResult.isValid,
    errors: {
      email: emailResult.error,
      password: passwordResult.error,
    },
  };
};

/**
 * Validate registration form
 */
export const validateRegisterForm = (
  email: string,
  password: string,
  passwordConfirmation: string,
  displayName: string
): {
  isValid: boolean;
  errors: {
    email?: string;
    password?: string;
    passwordConfirmation?: string;
    displayName?: string;
  };
} => {
  const emailResult = validateEmail(email);
  const passwordResult = validatePassword(password);
  const confirmResult = validatePasswordConfirmation(password, passwordConfirmation);
  const displayNameResult = validateDisplayName(displayName);

  return {
    isValid:
      emailResult.isValid &&
      passwordResult.isValid &&
      confirmResult.isValid &&
      displayNameResult.isValid,
    errors: {
      email: emailResult.error,
      password: passwordResult.error,
      passwordConfirmation: confirmResult.error,
      displayName: displayNameResult.error,
    },
  };
};
