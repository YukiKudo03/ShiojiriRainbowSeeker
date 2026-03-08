/**
 * Unit Tests for Input component
 *
 * Tests the reusable Input component rendering, validation messages,
 * text input handling, password visibility toggle, and disabled state.
 *
 * Requirements: NFR-5 (Accessibility)
 *
 * NOTE: @testing-library/react-native is required but not yet in package.json.
 * Install with: npm install --save-dev @testing-library/react-native
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Input } from '../../../src/components/ui/Input';

describe('Input', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------
  // Label rendering
  // -----------------------------------------------------------------
  it('renders the label text', () => {
    const { getByText } = render(
      <Input label="Email" testID="email-input" />
    );

    expect(getByText('Email')).toBeTruthy();
  });

  // -----------------------------------------------------------------
  // Error message
  // -----------------------------------------------------------------
  it('shows error message when error prop is provided', () => {
    const { getByText, queryByText } = render(
      <Input
        label="Email"
        error="Email is required"
        hint="Enter your email address"
        testID="email-input"
      />
    );

    // Error message should be visible
    expect(getByText('Email is required')).toBeTruthy();

    // Hint should NOT be visible when error is present
    expect(queryByText('Enter your email address')).toBeNull();
  });

  // -----------------------------------------------------------------
  // Hint message
  // -----------------------------------------------------------------
  it('shows hint when there is no error', () => {
    const { getByText } = render(
      <Input
        label="Password"
        hint="Must be at least 8 characters"
        testID="password-input"
      />
    );

    expect(getByText('Must be at least 8 characters')).toBeTruthy();
  });

  // -----------------------------------------------------------------
  // onChangeText
  // -----------------------------------------------------------------
  it('handles onChangeText callback', () => {
    const onChangeText = jest.fn();
    const { getByTestId } = render(
      <Input
        label="Name"
        onChangeText={onChangeText}
        testID="name-input"
      />
    );

    fireEvent.changeText(getByTestId('name-input'), 'Tanaka');

    expect(onChangeText).toHaveBeenCalledWith('Tanaka');
  });

  // -----------------------------------------------------------------
  // Password toggle
  // -----------------------------------------------------------------
  it('toggles password visibility when eye icon is pressed', () => {
    const { getByTestId, getByLabelText } = render(
      <Input
        label="Password"
        secureTextEntry={true}
        testID="password-input"
      />
    );

    const input = getByTestId('password-input');

    // Initially the password should be hidden (secureTextEntry = true)
    expect(input.props.secureTextEntry).toBe(true);

    // Tap the "Show password" button to reveal
    const toggleButton = getByLabelText('Show password');
    fireEvent.press(toggleButton);

    // After toggle, password should be visible (secureTextEntry = false)
    expect(getByTestId('password-input').props.secureTextEntry).toBe(false);

    // Tap the "Hide password" button to conceal again
    const hideButton = getByLabelText('Hide password');
    fireEvent.press(hideButton);

    expect(getByTestId('password-input').props.secureTextEntry).toBe(true);
  });

  // -----------------------------------------------------------------
  // Disabled state
  // -----------------------------------------------------------------
  it('disables the input when disabled prop is true', () => {
    const { getByTestId } = render(
      <Input
        label="Read Only"
        disabled={true}
        testID="readonly-input"
      />
    );

    const input = getByTestId('readonly-input');

    // TextInput should not be editable when disabled
    expect(input.props.editable).toBe(false);

    // Accessibility state should reflect disabled
    expect(input.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true })
    );
  });

  it('uses accessibilityLabelOverride when provided', () => {
    const { getByTestId } = render(
      <Input
        label="Email"
        accessibilityLabelOverride="メールアドレス入力"
        testID="email-input"
      />
    );
    expect(getByTestId('email-input').props.accessibilityLabel).toBe('メールアドレス入力');
  });

  it('includes error in accessibilityLabelOverride', () => {
    const { getByTestId } = render(
      <Input
        label="Email"
        accessibilityLabelOverride="メールアドレス入力"
        error="Invalid email"
        testID="email-input"
      />
    );
    expect(getByTestId('email-input').props.accessibilityLabel).toBe(
      'メールアドレス入力, error: Invalid email'
    );
  });

  it('falls back to generic accessibility label when no label or override', () => {
    const { getByTestId } = render(
      <Input testID="generic-input" />
    );
    expect(getByTestId('generic-input').props.accessibilityLabel).toBe('Input field');
  });

  it('falls back to generic accessibility label with error when no label or override', () => {
    const { getByTestId } = render(
      <Input testID="generic-input" error="Required" />
    );
    expect(getByTestId('generic-input').props.accessibilityLabel).toBe(
      'Input field, error: Required'
    );
  });

  it('renders left icon', () => {
    const { getByTestId } = render(
      <Input
        label="Search"
        leftIcon="search"
        testID="search-input"
      />
    );
    expect(getByTestId('search-input')).toBeTruthy();
  });

  it('renders right icon with press handler', () => {
    const onRightIconPress = jest.fn();
    const { getByLabelText } = render(
      <Input
        label="Search"
        rightIcon="close"
        onRightIconPress={onRightIconPress}
        rightIconAccessibilityLabel="Clear search"
        testID="search-input"
      />
    );

    fireEvent.press(getByLabelText('Clear search'));
    expect(onRightIconPress).toHaveBeenCalled();
  });

  it('renders right icon with default accessibility label', () => {
    const { getByLabelText } = render(
      <Input
        label="Field"
        rightIcon="information-circle"
        testID="field-input"
      />
    );
    expect(getByLabelText('Action button')).toBeTruthy();
  });

  it('sets accessibilityHint from hint prop', () => {
    const { getByTestId } = render(
      <Input
        label="Email"
        hint="Enter a valid email"
        testID="email-input"
      />
    );
    expect(getByTestId('email-input').props.accessibilityHint).toBe('Enter a valid email');
  });

  it('handles focus and blur events', () => {
    const { getByTestId } = render(
      <Input
        label="Name"
        testID="name-input"
      />
    );

    const input = getByTestId('name-input');

    // Trigger focus
    fireEvent(input, 'focus');

    // Trigger blur
    fireEvent(input, 'blur');

    // Component should still render properly after focus/blur cycle
    expect(getByTestId('name-input')).toBeTruthy();
  });
});
