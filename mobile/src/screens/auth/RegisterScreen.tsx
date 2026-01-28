/**
 * RegisterScreen - User registration screen with form validation
 *
 * Features:
 * - Display name, email, password, and confirmation inputs
 * - Real-time form validation
 * - Error handling and display
 * - Loading state during registration
 * - Navigation back to Login screen
 */

import React, { useState, useCallback, useRef } from 'react';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Input, Button } from '../../components/ui';
import { getErrorMessage } from '../../services/apiClient';
import { useAuthStore } from '../../store/authStore';
import { validateRegisterForm } from '../../utils/validation';

import type { RegisterScreenProps } from '../../types/navigation';

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  // Auth store
  const register = useAuthStore((state) => state.register);
  const isStoreLoading = useAuthStore((state) => state.isLoading);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isLoading = isSubmitting || isStoreLoading;
  const [errors, setErrors] = useState<{
    displayName?: string;
    email?: string;
    password?: string;
    passwordConfirmation?: string;
    general?: string;
  }>({});

  // Refs for input focus management
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  // Clear field errors when user starts typing
  const handleDisplayNameChange = useCallback((text: string) => {
    setDisplayName(text);
    if (errors.displayName) {
      setErrors((prev) => ({ ...prev, displayName: undefined }));
    }
  }, [errors.displayName]);

  const handleEmailChange = useCallback((text: string) => {
    setEmail(text);
    if (errors.email) {
      setErrors((prev) => ({ ...prev, email: undefined }));
    }
  }, [errors.email]);

  const handlePasswordChange = useCallback((text: string) => {
    setPassword(text);
    if (errors.password) {
      setErrors((prev) => ({ ...prev, password: undefined }));
    }
  }, [errors.password]);

  const handlePasswordConfirmationChange = useCallback((text: string) => {
    setPasswordConfirmation(text);
    if (errors.passwordConfirmation) {
      setErrors((prev) => ({ ...prev, passwordConfirmation: undefined }));
    }
  }, [errors.passwordConfirmation]);

  // Handle registration submission
  const handleRegister = useCallback(async () => {
    // Clear previous errors
    setErrors({});

    // Validate form
    const validation = validateRegisterForm(
      email,
      password,
      passwordConfirmation,
      displayName
    );
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);

    try {
      // Call auth store register
      await register(email, password, displayName);

      // Show success message
      Alert.alert(
        'Registration Successful',
        'Please check your email to verify your account before logging in.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      // Handle API errors
      const errorMessage = getErrorMessage(error);
      setErrors({ general: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, passwordConfirmation, displayName, navigation, register]);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']} testID="register-screen">
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
                name="person-add"
                size={40}
                color="#4A90A4"
                accessibilityLabel="Create Account"
              />
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Join Shiojiri Rainbow Seeker community
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
              label="Display Name"
              placeholder="How should we call you?"
              value={displayName}
              onChangeText={handleDisplayNameChange}
              error={errors.displayName}
              autoCapitalize="words"
              autoCorrect={false}
              autoComplete="name"
              leftIcon="person-outline"
              returnKeyType="next"
              disabled={isLoading}
              onSubmitEditing={() => emailRef.current?.focus()}
              accessibilityLabel="Display name input"
              hint="3-30 characters"
              testID="auth-display-name-input"
            />

            <Input
              label="Email"
              placeholder="Enter your email"
              value={email}
              onChangeText={handleEmailChange}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              leftIcon="mail-outline"
              returnKeyType="next"
              disabled={isLoading}
              onSubmitEditing={() => passwordRef.current?.focus()}
              accessibilityLabel="Email input"
              testID="auth-email-input"
            />

            <Input
              label="Password"
              placeholder="Create a password"
              value={password}
              onChangeText={handlePasswordChange}
              error={errors.password}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              leftIcon="lock-closed-outline"
              returnKeyType="next"
              disabled={isLoading}
              onSubmitEditing={() => confirmRef.current?.focus()}
              accessibilityLabel="Password input"
              hint="At least 8 characters"
              testID="auth-password-input"
            />

            <Input
              label="Confirm Password"
              placeholder="Enter password again"
              value={passwordConfirmation}
              onChangeText={handlePasswordConfirmationChange}
              error={errors.passwordConfirmation}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              leftIcon="lock-closed-outline"
              returnKeyType="done"
              disabled={isLoading}
              accessibilityLabel="Confirm password input"
              testID="auth-confirm-password-input"
            />

            <Button
              title="Create Account"
              onPress={handleRegister}
              loading={isLoading}
              disabled={isLoading}
              fullWidth
              size="large"
              icon="checkmark-circle-outline"
              testID="register-button"
            />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity
              onPress={handleGoBack}
              disabled={isLoading}
              accessibilityRole="link"
              accessibilityLabel="Go back to login"
              testID="back-to-login-link"
            >
              <Text style={styles.loginText}>Login</Text>
            </TouchableOpacity>
          </View>

          {/* Terms */}
          <Text style={styles.termsText}>
            By creating an account, you agree to our{' '}
            <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
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
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  footerText: {
    color: '#666',
    fontSize: 14,
    marginRight: 4,
  },
  loginText: {
    color: '#4A90A4',
    fontSize: 14,
    fontWeight: '600',
  },
  termsText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: '#4A90A4',
    fontWeight: '500',
  },
});
