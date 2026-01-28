/**
 * Input - Reusable text input component with validation support
 *
 * Accessibility features (WCAG 2.1 AA):
 * - accessibilityLabel for screen readers (uses label prop)
 * - accessibilityHint for input guidance
 * - accessibilityState for disabled state
 * - Error messages announced as alerts
 * - Minimum touch target size 44x44pt for buttons
 * - Color contrast ratio 4.5:1 or higher
 *
 * Requirements: NFR-5 (Accessibility)
 */

import React, { useState, useId } from 'react';

import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { MIN_TOUCH_TARGET_SIZE } from '../../utils/accessibility';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  disabled?: boolean;
  /** Custom accessibility label. Defaults to label prop. */
  accessibilityLabelOverride?: string;
  /** Accessibility label for right icon button */
  rightIconAccessibilityLabel?: string;
  /** Test ID for testing frameworks */
  testID?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  disabled = false,
  secureTextEntry,
  accessibilityLabelOverride,
  rightIconAccessibilityLabel,
  testID,
  ...textInputProps
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const isPassword = secureTextEntry !== undefined;
  const showPassword = isPassword && isPasswordVisible;

  // Generate a unique ID for accessibility associations
  const inputId = useId();

  const handleTogglePassword = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  // Generate accessibility label with error context
  const getAccessibilityLabel = (): string => {
    if (accessibilityLabelOverride) {
      return error ? `${accessibilityLabelOverride}, error: ${error}` : accessibilityLabelOverride;
    }
    if (label) {
      return error ? `${label}, error: ${error}` : label;
    }
    return error ? `Input field, error: ${error}` : 'Input field';
  };

  return (
    <View
      style={[styles.container, containerStyle]}
      accessible={false}
    >
      {label && (
        <Text
          style={[styles.label, error && styles.labelError]}
          accessibilityRole="text"
          nativeID={`${inputId}-label`}
        >
          {label}
        </Text>
      )}

      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
          error && styles.inputContainerError,
          disabled && styles.inputContainerDisabled,
        ]}
        accessible={false}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={20}
            color={error ? '#C53030' : isFocused ? '#3D7A8C' : '#6B6B6B'}
            style={styles.leftIcon}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          />
        )}

        <TextInput
          style={[
            styles.input,
            leftIcon ? styles.inputWithLeftIcon : null,
            (rightIcon || isPassword) ? styles.inputWithRightIcon : null,
            disabled ? styles.inputDisabled : null,
          ]}
          placeholderTextColor="#6B6B6B"
          editable={!disabled}
          secureTextEntry={isPassword ? !showPassword : false}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          accessible={true}
          accessibilityLabel={getAccessibilityLabel()}
          accessibilityState={{ disabled }}
          accessibilityHint={hint}
          accessibilityLabelledBy={label ? `${inputId}-label` : undefined}
          testID={testID}
          {...textInputProps}
        />

        {isPassword && (
          <TouchableOpacity
            onPress={handleTogglePassword}
            style={styles.rightIconButton}
            accessible={true}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            accessibilityRole="button"
            accessibilityHint={showPassword ? 'Double tap to hide password' : 'Double tap to show password'}
          >
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={20}
              color="#6B6B6B"
            />
          </TouchableOpacity>
        )}

        {rightIcon && !isPassword && (
          <TouchableOpacity
            onPress={onRightIconPress}
            style={styles.rightIconButton}
            disabled={!onRightIconPress}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={rightIconAccessibilityLabel || 'Action button'}
            accessibilityState={{ disabled: !onRightIconPress }}
          >
            <Ionicons
              name={rightIcon}
              size={20}
              color={error ? '#C53030' : '#6B6B6B'}
            />
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <Text
          style={styles.error}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          nativeID={`${inputId}-error`}
        >
          {error}
        </Text>
      )}

      {hint && !error && (
        <Text
          style={styles.hint}
          accessibilityRole="text"
          nativeID={`${inputId}-hint`}
        >
          {hint}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1F1F', // High contrast text color (16.1:1 on white)
    marginBottom: 6,
  },
  labelError: {
    color: '#C53030', // Accessible error color (5.89:1 on white)
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    backgroundColor: '#FFF',
    // Ensure minimum touch target height
    minHeight: MIN_TOUCH_TARGET_SIZE,
  },
  inputContainerFocused: {
    borderColor: '#3D7A8C', // Accessible primary color
    borderWidth: 2,
  },
  inputContainerError: {
    borderColor: '#C53030', // Accessible error color
    borderWidth: 2,
  },
  inputContainerDisabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  input: {
    flex: 1,
    height: 48, // Ensures comfortable touch target
    fontSize: 16,
    color: '#1F1F1F', // High contrast text
    paddingHorizontal: 12,
  },
  inputWithLeftIcon: {
    paddingLeft: 0,
  },
  inputWithRightIcon: {
    paddingRight: 0,
  },
  inputDisabled: {
    color: '#6B6B6B', // Accessible muted text (4.54:1 on white)
  },
  leftIcon: {
    marginLeft: 12,
    marginRight: 8,
  },
  rightIconButton: {
    // Ensure minimum touch target size (WCAG 2.5.5)
    minWidth: MIN_TOUCH_TARGET_SIZE,
    minHeight: MIN_TOUCH_TARGET_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  error: {
    fontSize: 12,
    color: '#C53030', // Accessible error color
    marginTop: 4,
  },
  hint: {
    fontSize: 12,
    color: '#6B6B6B', // Accessible muted text (4.54:1 on white)
    marginTop: 4,
  },
});
