/**
 * LoginScreen - User login screen with form validation
 *
 * Features:
 * - Email and password input with validation
 * - Show/hide password toggle
 * - Error handling and display
 * - Loading state during authentication
 * - Navigation to Register and Forgot Password screens
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
import { getErrorMessage } from '../../services/apiClient';
import { useAuthStore } from '../../store/authStore';
import { validateLoginForm } from '../../utils/validation';

import type { LoginScreenProps } from '../../types/navigation';

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  // Auth store
  const login = useAuthStore((state) => state.login);
  const isStoreLoading = useAuthStore((state) => state.isLoading);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    general?: string;
  }>({});

  const isLoading = isSubmitting || isStoreLoading;

  // Clear field error when user starts typing
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

  // Handle login submission
  const handleLogin = useCallback(async () => {
    // Clear previous errors
    setErrors({});

    // Validate form
    const validation = validateLoginForm(email, password);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);

    try {
      // Call auth store login
      await login(email, password);
      // Navigation is handled by RootNavigator based on auth state
    } catch (error) {
      // Handle API errors
      const errorMessage = getErrorMessage(error);
      setErrors({ general: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, login]);

  const handleForgotPassword = useCallback(() => {
    navigation.navigate('ForgotPassword');
  }, [navigation]);

  const handleCreateAccount = useCallback(() => {
    navigation.navigate('Register');
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container} testID="login-screen">
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
                name="color-palette"
                size={50}
                color="#4A90A4"
                accessibilityLabel="Rainbow Seeker Logo"
              />
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Shiojiri Rainbow Seeker</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* General error message */}
            {errors.general && (
              <View style={styles.errorContainer} accessibilityRole="alert" testID="auth-error-alert">
                <Text style={styles.errorText}>{errors.general}</Text>
              </View>
            )}

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
              accessibilityLabel="Email input"
              testID="auth-email-input"
            />

            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={handlePasswordChange}
              error={errors.password}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              leftIcon="lock-closed-outline"
              returnKeyType="done"
              disabled={isLoading}
              accessibilityLabel="Password input"
              testID="auth-password-input"
            />

            <TouchableOpacity
              style={styles.forgotPasswordLink}
              onPress={handleForgotPassword}
              disabled={isLoading}
              accessibilityRole="link"
              accessibilityLabel="Forgot password"
              testID="forgot-password-button"
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            <Button
              title="Login"
              onPress={handleLogin}
              loading={isLoading}
              disabled={isLoading}
              fullWidth
              size="large"
              testID="login-button"
            />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <TouchableOpacity
              onPress={handleCreateAccount}
              disabled={isLoading}
              accessibilityRole="link"
              accessibilityLabel="Create a new account"
              testID="create-account-link"
            >
              <Text style={styles.createAccountText}>Create Account</Text>
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
    paddingTop: 40,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E8F4F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
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
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    marginTop: -8,
  },
  forgotPasswordText: {
    color: '#4A90A4',
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 24,
  },
  footerText: {
    color: '#666',
    fontSize: 14,
    marginRight: 4,
  },
  createAccountText: {
    color: '#4A90A4',
    fontSize: 14,
    fontWeight: '600',
  },
});
