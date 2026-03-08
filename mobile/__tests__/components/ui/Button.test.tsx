/**
 * Unit Tests for Button component
 *
 * Tests the reusable Button component rendering, interactions,
 * loading state, disabled state, and accessibility attributes.
 *
 * Requirements: NFR-5 (Accessibility)
 *
 * NOTE: @testing-library/react-native is required but not yet in package.json.
 * Install with: npm install --save-dev @testing-library/react-native
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../../../src/components/ui/Button';

describe('Button', () => {
  const defaultProps = {
    title: 'Press me',
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------
  it('renders the title text', () => {
    const { getByText } = render(<Button {...defaultProps} />);

    expect(getByText('Press me')).toBeTruthy();
  });

  // -----------------------------------------------------------------
  // onPress
  // -----------------------------------------------------------------
  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Button title="Tap" onPress={onPress} />
    );

    fireEvent.press(getByText('Tap'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------
  it('shows ActivityIndicator and hides title when loading is true', () => {
    const { queryByText, getByLabelText } = render(
      <Button {...defaultProps} loading={true} />
    );

    // Title text should not be rendered when loading
    expect(queryByText('Press me')).toBeNull();

    // ActivityIndicator should be present (it has accessibilityLabel="Loading")
    expect(getByLabelText('Loading')).toBeTruthy();
  });

  // -----------------------------------------------------------------
  // Disabled state
  // -----------------------------------------------------------------
  it('is disabled when disabled prop is true', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <Button title="Disabled" onPress={onPress} disabled={true} />
    );

    const button = getByRole('button');

    // TouchableOpacity sets accessibilityState.disabled
    expect(button.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true })
    );

    // Pressing a disabled TouchableOpacity should not fire onPress
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('is disabled when loading prop is true', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <Button title="Loading" onPress={onPress} loading={true} />
    );

    const button = getByRole('button');

    expect(button.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true, busy: true })
    );

    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------
  // Accessibility
  // -----------------------------------------------------------------
  it('has accessibilityRole="button"', () => {
    const { getByRole } = render(<Button {...defaultProps} />);

    const button = getByRole('button');
    expect(button).toBeTruthy();
  });

  it('uses title as default accessibilityLabel and appends loading status', () => {
    // Default: label equals title
    const { getByLabelText, rerender } = render(
      <Button {...defaultProps} />
    );
    expect(getByLabelText('Press me')).toBeTruthy();

    // When loading: label becomes "title, loading"
    rerender(<Button {...defaultProps} loading={true} />);
    expect(getByLabelText('Press me, loading')).toBeTruthy();
  });

  it('uses custom accessibilityLabel when provided', () => {
    const { getByLabelText } = render(
      <Button {...defaultProps} accessibilityLabel="Custom label" />
    );
    expect(getByLabelText('Custom label')).toBeTruthy();
  });

  it('sets accessibilityHint when provided', () => {
    const { getByRole } = render(
      <Button {...defaultProps} accessibilityHint="Opens settings" />
    );
    expect(getByRole('button').props.accessibilityHint).toBe('Opens settings');
  });

  it('renders with secondary variant', () => {
    const { getByText } = render(
      <Button {...defaultProps} variant="secondary" />
    );
    expect(getByText('Press me')).toBeTruthy();
  });

  it('renders with outline variant', () => {
    const { getByText } = render(
      <Button {...defaultProps} variant="outline" />
    );
    expect(getByText('Press me')).toBeTruthy();
  });

  it('renders with ghost variant', () => {
    const { getByText } = render(
      <Button {...defaultProps} variant="ghost" />
    );
    expect(getByText('Press me')).toBeTruthy();
  });

  it('renders with danger variant', () => {
    const { getByText } = render(
      <Button {...defaultProps} variant="danger" />
    );
    expect(getByText('Press me')).toBeTruthy();
  });

  it('renders with small size', () => {
    const { getByText } = render(
      <Button {...defaultProps} size="small" />
    );
    expect(getByText('Press me')).toBeTruthy();
  });

  it('renders with large size', () => {
    const { getByText } = render(
      <Button {...defaultProps} size="large" />
    );
    expect(getByText('Press me')).toBeTruthy();
  });

  it('renders icon on the left side by default', () => {
    const { getByText } = render(
      <Button {...defaultProps} icon="add" />
    );
    expect(getByText('Press me')).toBeTruthy();
  });

  it('renders icon on the right side', () => {
    const { getByText } = render(
      <Button {...defaultProps} icon="arrow-forward" iconPosition="right" />
    );
    expect(getByText('Press me')).toBeTruthy();
  });

  it('renders with fullWidth prop', () => {
    const { getByRole } = render(
      <Button {...defaultProps} fullWidth={true} />
    );
    expect(getByRole('button')).toBeTruthy();
  });

  it('passes testID prop', () => {
    const { getByTestId } = render(
      <Button {...defaultProps} testID="my-button" />
    );
    expect(getByTestId('my-button')).toBeTruthy();
  });

  it('renders loading spinner with white color for primary variant', () => {
    const { getByLabelText } = render(
      <Button {...defaultProps} variant="primary" loading={true} />
    );
    const indicator = getByLabelText('Loading');
    expect(indicator.props.color).toBe('#FFFFFF');
  });

  it('renders loading spinner with white color for danger variant', () => {
    const { getByLabelText } = render(
      <Button {...defaultProps} variant="danger" loading={true} />
    );
    const indicator = getByLabelText('Loading');
    expect(indicator.props.color).toBe('#FFFFFF');
  });

  it('renders loading spinner with primary color for secondary variant', () => {
    const { getByLabelText } = render(
      <Button {...defaultProps} variant="secondary" loading={true} />
    );
    const indicator = getByLabelText('Loading');
    expect(indicator.props.color).toBe('#3D7A8C');
  });
});
