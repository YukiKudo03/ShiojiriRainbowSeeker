/**
 * EditProfileScreen - Edit user profile
 *
 * Allows users to edit their display name and profile image.
 * Validates input and handles API updates with loading states.
 *
 * Accessibility features (WCAG 2.1 AA):
 * - Screen reader support for all UI elements
 * - Minimum touch target size 44x44pt
 * - Color contrast ratio 4.5:1 or higher
 * - Input validation with accessible error messages
 * - Loading state announcements
 *
 * Requirements: FR-9 (AC-9.2)
 */

import React, { useState, useCallback, useEffect } from 'react';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  AccessibilityInfo,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getMyProfile,
  updateMyProfile,
  validateDisplayName,
  type UserProfile,
  type UpdateProfileRequest,
} from '../../services/userService';
import { useCurrentUser } from '../../store/authStore';
import {
  accessibleColors,
  MIN_TOUCH_TARGET_SIZE,
  createInputAccessibilityProps,
} from '../../utils/accessibility';

import type { EditProfileScreenProps } from '../../types/navigation';

// Display name validation constants
const DISPLAY_NAME_MIN_LENGTH = 3;
const DISPLAY_NAME_MAX_LENGTH = 30;

/**
 * Get initials from display name
 */
const getInitials = (displayName: string): string => {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return displayName.slice(0, 2).toUpperCase();
};

/**
 * Generate a filename for profile image
 */
const generateImageFilename = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `profile_${timestamp}_${random}.jpg`;
};

export const EditProfileScreen: React.FC<EditProfileScreenProps> = ({
  navigation,
}) => {
  const user = useCurrentUser();
  const queryClient = useQueryClient();

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<{
    uri: string;
    type: string;
    name: string;
  } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch current profile
  const {
    data: profile,
    isLoading: isLoadingProfile,
  } = useQuery<UserProfile>({
    queryKey: ['userProfile'],
    queryFn: getMyProfile,
    enabled: !!user,
  });

  // Initialize form with current values
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
    } else if (user) {
      setDisplayName(user.displayName);
    }
  }, [profile, user]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: (request: UpdateProfileRequest) => updateMyProfile(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      AccessibilityInfo.announceForAccessibility('Profile updated successfully');
      navigation.goBack();
    },
    onError: (error) => {
      Alert.alert(
        'Update Failed',
        error instanceof Error ? error.message : 'Failed to update profile',
        [{ text: 'OK' }]
      );
    },
  });

  // Handle display name change with validation
  const handleDisplayNameChange = useCallback((text: string) => {
    setDisplayName(text);
    setHasChanges(true);

    // Real-time validation
    if (text.trim().length > 0) {
      const validation = validateDisplayName(text);
      setDisplayNameError(validation.isValid ? null : validation.error || null);
    } else {
      setDisplayNameError(null);
    }
  }, []);

  // Show image source picker
  const handleChangePhoto = useCallback(() => {
    Alert.alert(
      'Change Profile Photo',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: () => pickImage('camera'),
        },
        {
          text: 'Choose from Library',
          onPress: () => pickImage('library'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  }, []);

  // Pick image from camera or library (AC-9.2)
  const pickImage = useCallback(async (source: 'camera' | 'library') => {
    try {
      // Request permissions
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Camera permission is needed to take photos.',
            [{ text: 'OK' }]
          );
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Photo library permission is needed to select photos.',
            [{ text: 'OK' }]
          );
          return;
        }
      }

      // Launch picker
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedImage({
          uri: asset.uri,
          type: 'image/jpeg',
          name: generateImageFilename(),
        });
        setHasChanges(true);
        AccessibilityInfo.announceForAccessibility('Profile photo selected');
      }
    } catch {
      Alert.alert(
        'Error',
        'Failed to pick image. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, []);

  // Handle save
  const handleSave = useCallback(() => {
    // Validate display name
    const validation = validateDisplayName(displayName);
    if (!validation.isValid) {
      setDisplayNameError(validation.error || 'Invalid display name');
      return;
    }

    // Check if there are actual changes
    const nameChanged = displayName.trim() !== (profile?.displayName || user?.displayName);
    const imageChanged = selectedImage !== null;

    if (!nameChanged && !imageChanged) {
      navigation.goBack();
      return;
    }

    // Build update request
    const request: UpdateProfileRequest = {};

    if (nameChanged) {
      request.displayName = displayName.trim();
    }

    if (imageChanged && selectedImage) {
      request.profileImage = selectedImage;
    }

    updateProfileMutation.mutate(request);
  }, [displayName, selectedImage, profile, user, navigation, updateProfileMutation]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (hasChanges) {
      Alert.alert(
        'Discard Changes',
        'Are you sure you want to discard your changes?',
        [
          {
            text: 'Keep Editing',
            style: 'cancel',
          },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } else {
      navigation.goBack();
    }
  }, [hasChanges, navigation]);

  // Determine if save button should be enabled
  const canSave = displayName.trim().length >= DISPLAY_NAME_MIN_LENGTH &&
    displayName.trim().length <= DISPLAY_NAME_MAX_LENGTH &&
    !displayNameError &&
    hasChanges;

  // Get current display image
  const currentDisplayName = displayName || profile?.displayName || user?.displayName || 'User';
  const currentImageUri = selectedImage?.uri || profile?.profileImageUrl;

  // Loading state
  if (isLoadingProfile) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={accessibleColors.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']} testID="edit-profile-screen">
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            {currentImageUri ? (
              <Image
                source={{ uri: currentImageUri }}
                style={styles.avatar}
                contentFit="cover"
                accessibilityLabel="Profile picture"
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {getInitials(currentDisplayName)}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.changePhotoButton}
              onPress={handleChangePhoto}
              accessible={true}
              accessibilityLabel="Change profile photo"
              accessibilityRole="button"
              accessibilityHint="Opens options to take or select a photo"
            >
              <Ionicons
                name="camera-outline"
                size={18}
                color={accessibleColors.primary}
                style={styles.changePhotoIcon}
              />
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </TouchableOpacity>
          </View>

          {/* Form Section */}
          <View style={styles.form}>
            {/* Display Name Input (AC-9.2) */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Display Name
                <Text style={styles.requiredIndicator}> *</Text>
              </Text>
              <TextInput
                style={[
                  styles.inputBox,
                  displayNameError && styles.inputBoxError,
                ]}
                value={displayName}
                onChangeText={handleDisplayNameChange}
                placeholder="Enter your display name"
                placeholderTextColor="#999"
                maxLength={DISPLAY_NAME_MAX_LENGTH}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                {...createInputAccessibilityProps(
                  'Display name',
                  {
                    hint: `Enter 3 to 30 characters`,
                    error: displayNameError || undefined,
                  }
                )}
                testID="display-name-input"
              />
              <View style={styles.inputHelpRow}>
                {displayNameError ? (
                  <Text
                    style={styles.inputError}
                    accessible={true}
                    accessibilityRole="alert"
                  >
                    {displayNameError}
                  </Text>
                ) : (
                  <Text style={styles.inputHint}>
                    {DISPLAY_NAME_MIN_LENGTH}-{DISPLAY_NAME_MAX_LENGTH} characters
                  </Text>
                )}
                <Text style={styles.inputCounter}>
                  {displayName.trim().length}/{DISPLAY_NAME_MAX_LENGTH}
                </Text>
              </View>
            </View>

            {/* Email (read-only) */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <View style={[styles.inputBox, styles.inputBoxDisabled]}>
                <Text style={styles.inputTextDisabled}>
                  {profile?.email || user?.email || ''}
                </Text>
              </View>
              <Text style={styles.inputHint}>Email cannot be changed</Text>
            </View>
          </View>
        </ScrollView>

        {/* Footer with buttons */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={updateProfileMutation.isPending}
            accessible={true}
            accessibilityLabel="Cancel"
            accessibilityRole="button"
            accessibilityHint="Discard changes and go back"
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.saveButton,
              (!canSave || updateProfileMutation.isPending) && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!canSave || updateProfileMutation.isPending}
            accessible={true}
            accessibilityLabel="Save"
            accessibilityRole="button"
            accessibilityHint="Save profile changes"
            accessibilityState={{
              disabled: !canSave || updateProfileMutation.isPending,
            }}
          >
            {updateProfileMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Saving overlay */}
      {updateProfileMutation.isPending && (
        <View style={styles.savingOverlay}>
          <View style={styles.savingOverlayContent}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.savingOverlayText}>Saving...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: accessibleColors.textSecondary,
  },
  scrollContent: {
    flexGrow: 1,
  },
  avatarSection: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingVertical: 30,
    marginBottom: 8,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    backgroundColor: accessibleColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: MIN_TOUCH_TARGET_SIZE,
  },
  changePhotoIcon: {
    marginRight: 6,
  },
  changePhotoText: {
    color: accessibleColors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  form: {
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: accessibleColors.textSecondary,
    marginBottom: 8,
  },
  requiredIndicator: {
    color: accessibleColors.error,
  },
  inputBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: accessibleColors.textPrimary,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minHeight: MIN_TOUCH_TARGET_SIZE,
  },
  inputBoxError: {
    borderColor: accessibleColors.error,
  },
  inputBoxDisabled: {
    backgroundColor: '#EBEBEB',
  },
  inputTextDisabled: {
    fontSize: 16,
    color: accessibleColors.textMuted,
  },
  inputHelpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  inputHint: {
    fontSize: 12,
    color: accessibleColors.textMuted,
  },
  inputError: {
    fontSize: 12,
    color: accessibleColors.error,
    flex: 1,
  },
  inputCounter: {
    fontSize: 12,
    color: accessibleColors.textMuted,
    marginLeft: 8,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET_SIZE,
  },
  cancelButtonText: {
    fontSize: 16,
    color: accessibleColors.textSecondary,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: accessibleColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET_SIZE,
  },
  saveButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  savingOverlayContent: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  savingOverlayText: {
    marginTop: 12,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});
