/**
 * ForgotPasswordScreen - Password recovery screen with email validation
 *
 * Features:
 * - Email input with validation
 * - Success state showing email sent message
 * - Error handling and display
 * - Loading state during request
 * - Navigation back to Login screen
 */

import React, { useState, useCallback } from 'react';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Input, Button } from '../../components/ui';
import { authService, getErrorMessage } from '../../services/authService';
import { validateEmail } from '../../utils/validation';

import type { ForgotPasswordScreenProps } from '../../types/navigation';

type ScreenState = 'form' | 'success';

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  navigation,
}) => {
  // Form state
  const [email, setEmail] = useState('');

  // UI state
  const [screenState, setScreenState] = useState<ScreenState>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    general?: string;
  }>({});

  // Clear field error when user starts typing
  const handleEmailChange = useCallback((text: string) => {
    setEmail(text);
    if (errors.email) {
      setErrors((prev) => ({ ...prev, email: undefined }));
    }
  }, [errors.email]);

  // Handle reset password request
  const handleResetPassword = useCallback(async () => {
    // Clear previous errors
    setErrors({});

    // Validate email
    const validation = validateEmail(email);
    if (!validation.isValid) {
      setErrors({ email: validation.error });
      return;
    }

    setIsLoading(true);

    try {
      // Call auth service reset password API
      await authService.requestPasswordReset(email);

      // Show success state
      setScreenState('success');
    } catch (error) {
      // Handle API errors
      const errorMessage = getErrorMessage(error);
      setErrors({ general: errorMessage });
    } finally {
      setIsLoading(false);
    }
  }, [email]);

  const handleBackToLogin = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleTryAgain = useCallback(() => {
    setScreenState('form');
    setEmail('');
    setErrors({});
  }, []);

  // Success state view
  if (screenState === 'success') {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.successContent}>
          <View style={styles.successIconContainer}>
            <Ionicons
              name="mail-open"
              size={60}
              color="#4A90A4"
              accessibilityLabel="Email sent"
            />
          </View>

          <Text style={styles.successTitle}>Check Your Email</Text>
          <Text style={styles.successMessage}>
            We've sent password reset instructions to:
          </Text>
          <Text style={styles.successEmail}>{email}</Text>

          <Text style={styles.successHint}>
            Didn't receive the email? Check your spam folder or try again.
          </Text>

          <View style={styles.successButtons}>
            <Button
              title="Back to Login"
              onPress={handleBackToLogin}
              fullWidth
              size="large"
            />

            <Button
              title="Try Different Email"
              onPress={handleTryAgain}
              variant="ghost"
              fullWidth
              style={styles.tryAgainButton}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Form state view
  return (
    <SafeAreaView style={styles.container} edges={['bottom']} testID="forgot-password-screen">
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Ionicons
                name="key"
                size={40}
                color="#4A90A4"
                accessibilityLabel="Reset Password"
              />
            </View>
            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>
              No worries! Enter your email address and we'll send you instructions to reset your password.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* General error message */}
            {errors.general && (
              <View style={styles.errorContainer} accessibilityRole="alert">
                <Text style={styles.errorText}>{errors.general}</Text>
              </View>
            )}

            <Input
              label="Email Address"
              placeholder="Enter your registered email"
              value={email}
              onChangeText={handleEmailChange}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              leftIcon="mail-outline"
              returnKeyType="done"
              disabled={isLoading}
              onSubmitEditing={handleResetPassword}
              accessibilityLabel="Email input"
              testID="auth-email-input"
            />

            <Button
              title="Send Reset Instructions"
              onPress={handleResetPassword}
              loading={isLoading}
              disabled={isLoading}
              fullWidth
              size="large"
              icon="paper-plane-outline"
            />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleBackToLogin}
              disabled={isLoading}
              style={styles.backLink}
              accessibilityRole="link"
              accessibilityLabel="Go back to login"
            >
              <Ionicons name="arrow-back" size={18} color="#4A90A4" />
              <Text style={styles.backLinkText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F4F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  form: {
    marginBottom: 24,
  },
  errorContainer: {
    backgroundColor: '#FDEAEA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#E74C3C',
  },
  errorText: {
    color: '#C0392B',
    fontSize: 14,
  },
  footer: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 24,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backLinkText: {
    color: '#4A90A4',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },

  // Success state styles
  successContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  successIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E8F4F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  successEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A90A4',
    marginBottom: 24,
  },
  successHint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 24,
    lineHeight: 18,
  },
  successButtons: {
    width: '100%',
    paddingHorizontal: 24,
  },
  tryAgainButton: {
    marginTop: 12,
  },
});
