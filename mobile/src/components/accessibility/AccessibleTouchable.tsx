/**
 * AccessibleTouchable - A wrapper component ensuring WCAG 2.1 AA compliant touch targets
 *
 * Features:
 * - Ensures minimum 44x44pt touch target size (WCAG 2.5.5)
 * - Provides consistent accessibility props
 * - Supports all standard touchable properties
 * - Uses hitSlop to expand touch area without affecting layout when needed
 *
 * Requirements: NFR-5 (Accessibility)
 */

import React from 'react';

import {
  StyleSheet,
  TouchableOpacity,
  View,
  type TouchableOpacityProps,
  type ViewStyle,
  type StyleProp,
} from 'react-native';

import {
  MIN_TOUCH_TARGET_SIZE,
  type AccessibilityProps,
} from '../../utils/accessibility';

interface AccessibleTouchableProps
  extends Omit<TouchableOpacityProps, keyof AccessibilityProps>,
    AccessibilityProps {
  /** Child components to render inside the touchable */
  children: React.ReactNode;
  /** Style for the touchable container */
  style?: StyleProp<ViewStyle>;
  /** Whether to enforce minimum touch target size by expanding the component */
  enforceMinSize?: boolean;
  /** Whether to use hitSlop to expand touch area (useful when visual size must be smaller) */
  useHitSlop?: boolean;
  /** Measured width of the content (for calculating hitSlop) */
  contentWidth?: number;
  /** Measured height of the content (for calculating hitSlop) */
  contentHeight?: number;
  /** Test ID for testing frameworks */
  testID?: string;
}

/**
 * AccessibleTouchable ensures touch targets meet WCAG 2.5.5 requirements
 * while providing consistent accessibility props.
 *
 * @example
 * // Basic usage - enforces 44x44pt minimum size
 * <AccessibleTouchable
 *   onPress={handlePress}
 *   accessibilityLabel="Submit form"
 *   accessibilityRole="button"
 * >
 *   <Text>Submit</Text>
 * </AccessibleTouchable>
 *
 * @example
 * // Using hitSlop for visually smaller elements
 * <AccessibleTouchable
 *   onPress={handlePress}
 *   accessibilityLabel="Close"
 *   accessibilityRole="button"
 *   useHitSlop
 *   contentWidth={24}
 *   contentHeight={24}
 * >
 *   <CloseIcon size={24} />
 * </AccessibleTouchable>
 */
export const AccessibleTouchable: React.FC<AccessibleTouchableProps> = ({
  children,
  style,
  enforceMinSize = true,
  useHitSlop = false,
  contentWidth,
  contentHeight,
  accessible = true,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  accessibilityState,
  accessibilityValue,
  importantForAccessibility = 'yes',
  disabled,
  testID,
  ...touchableProps
}) => {
  // Calculate hitSlop if needed
  const hitSlop = React.useMemo(() => {
    if (!useHitSlop || !contentWidth || !contentHeight) {
      return undefined;
    }

    const horizontalPadding = Math.max(0, (MIN_TOUCH_TARGET_SIZE - contentWidth) / 2);
    const verticalPadding = Math.max(0, (MIN_TOUCH_TARGET_SIZE - contentHeight) / 2);

    return {
      top: verticalPadding,
      bottom: verticalPadding,
      left: horizontalPadding,
      right: horizontalPadding,
    };
  }, [useHitSlop, contentWidth, contentHeight]);

  const containerStyle = [
    enforceMinSize && styles.minTouchTarget,
    style,
  ];

  return (
    <TouchableOpacity
      style={containerStyle}
      disabled={disabled}
      hitSlop={hitSlop}
      accessible={accessible}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole={accessibilityRole}
      accessibilityState={{
        disabled: disabled ?? false,
        ...accessibilityState,
      }}
      accessibilityValue={accessibilityValue}
      importantForAccessibility={importantForAccessibility}
      testID={testID}
      {...touchableProps}
    >
      {children}
    </TouchableOpacity>
  );
};

/**
 * AccessibleIconButton - A specialized wrapper for icon-only buttons
 *
 * Ensures icon buttons meet accessibility requirements with proper labels
 * and minimum touch target size.
 */
interface AccessibleIconButtonProps extends Omit<AccessibleTouchableProps, 'children'> {
  /** The icon component to render */
  icon: React.ReactNode;
  /** Required label for screen readers (icons have no inherent meaning) */
  accessibilityLabel: string;
  /** Size of the icon (used for hitSlop calculation) */
  iconSize?: number;
}

export const AccessibleIconButton: React.FC<AccessibleIconButtonProps> = ({
  icon,
  accessibilityLabel,
  iconSize = 24,
  style,
  ...props
}) => {
  return (
    <AccessibleTouchable
      style={[styles.iconButton, style]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      useHitSlop
      contentWidth={iconSize}
      contentHeight={iconSize}
      {...props}
    >
      <View style={styles.iconContainer}>{icon}</View>
    </AccessibleTouchable>
  );
};

const styles = StyleSheet.create({
  minTouchTarget: {
    minWidth: MIN_TOUCH_TARGET_SIZE,
    minHeight: MIN_TOUCH_TARGET_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButton: {
    minWidth: MIN_TOUCH_TARGET_SIZE,
    minHeight: MIN_TOUCH_TARGET_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AccessibleTouchable;
