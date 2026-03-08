/**
 * Component Tests for AccessibleTouchable
 *
 * Tests accessibility props, onPress, hitSlop, and minimum touch target size.
 */

import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('../../../src/utils/accessibility', () => ({
  MIN_TOUCH_TARGET_SIZE: 44,
}));

import {
  AccessibleTouchable,
  AccessibleIconButton,
} from '../../../src/components/accessibility/AccessibleTouchable';

describe('AccessibleTouchable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children', () => {
    const { getByText } = render(
      <AccessibleTouchable accessibilityLabel="Submit">
        <Text>Submit</Text>
      </AccessibleTouchable>
    );
    expect(getByText('Submit')).toBeTruthy();
  });

  it('has accessibilityRole="button" by default', () => {
    const { getByRole } = render(
      <AccessibleTouchable accessibilityLabel="Submit">
        <Text>Submit</Text>
      </AccessibleTouchable>
    );
    expect(getByRole('button')).toBeTruthy();
  });

  it('sets accessibility label', () => {
    const { getByLabelText } = render(
      <AccessibleTouchable accessibilityLabel="Submit form">
        <Text>Submit</Text>
      </AccessibleTouchable>
    );
    expect(getByLabelText('Submit form')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <AccessibleTouchable accessibilityLabel="Submit" onPress={onPress}>
        <Text>Submit</Text>
      </AccessibleTouchable>
    );

    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <AccessibleTouchable
        accessibilityLabel="Submit"
        onPress={onPress}
        disabled={true}
      >
        <Text>Submit</Text>
      </AccessibleTouchable>
    );

    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('sets disabled in accessibilityState', () => {
    const { getByRole } = render(
      <AccessibleTouchable accessibilityLabel="Submit" disabled={true}>
        <Text>Submit</Text>
      </AccessibleTouchable>
    );

    const button = getByRole('button');
    expect(button.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true })
    );
  });

  it('applies hitSlop when useHitSlop is true with content dimensions', () => {
    const { getByRole } = render(
      <AccessibleTouchable
        accessibilityLabel="Small button"
        useHitSlop={true}
        contentWidth={24}
        contentHeight={24}
      >
        <Text>X</Text>
      </AccessibleTouchable>
    );

    const button = getByRole('button');
    expect(button.props.hitSlop).toBeDefined();
    expect(button.props.hitSlop.top).toBe(10);
    expect(button.props.hitSlop.bottom).toBe(10);
    expect(button.props.hitSlop.left).toBe(10);
    expect(button.props.hitSlop.right).toBe(10);
  });

  it('does not apply hitSlop when useHitSlop is false', () => {
    const { getByRole } = render(
      <AccessibleTouchable accessibilityLabel="Normal">
        <Text>Normal</Text>
      </AccessibleTouchable>
    );

    const button = getByRole('button');
    expect(button.props.hitSlop).toBeUndefined();
  });

  it('accepts testID prop', () => {
    const { getByTestId } = render(
      <AccessibleTouchable accessibilityLabel="Test" testID="accessible-btn">
        <Text>Test</Text>
      </AccessibleTouchable>
    );
    expect(getByTestId('accessible-btn')).toBeTruthy();
  });

  it('accepts custom accessibilityHint', () => {
    const { getByA11yHint } = render(
      <AccessibleTouchable
        accessibilityLabel="Submit"
        accessibilityHint="Double tap to submit the form"
      >
        <Text>Submit</Text>
      </AccessibleTouchable>
    );
    expect(getByA11yHint('Double tap to submit the form')).toBeTruthy();
  });
});

describe('AccessibleIconButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the icon', () => {
    const { getByText } = render(
      <AccessibleIconButton
        icon={<Text>X</Text>}
        accessibilityLabel="Close"
      />
    );
    expect(getByText('X')).toBeTruthy();
  });

  it('has required accessibility label', () => {
    const { getByLabelText } = render(
      <AccessibleIconButton
        icon={<Text>X</Text>}
        accessibilityLabel="Close dialog"
      />
    );
    expect(getByLabelText('Close dialog')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <AccessibleIconButton
        icon={<Text>X</Text>}
        accessibilityLabel="Close"
        onPress={onPress}
      />
    );

    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('applies hitSlop based on iconSize', () => {
    const { getByRole } = render(
      <AccessibleIconButton
        icon={<Text>X</Text>}
        accessibilityLabel="Close"
        iconSize={24}
      />
    );

    const button = getByRole('button');
    expect(button.props.hitSlop).toBeDefined();
  });
});
