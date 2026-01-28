/**
 * PhotoUploadScreen - Photo upload and metadata entry screen
 *
 * Requirements: FR-2, FR-3 (AC-2.3, AC-2.5, AC-2.6, AC-2.7, AC-2.8, AC-3.1, AC-3.2, AC-3.3)
 * - Title input (max 100 chars) (AC-3.1)
 * - Comment/description input (max 500 chars) (AC-3.1, AC-3.3)
 * - Manual location selection (AC-2.3)
 * - Upload progress display (AC-2.6)
 * - Offline queue support (AC-2.7)
 * - Error handling (AC-2.8)
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import NetInfo from '@react-native-community/netinfo';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LocationPicker } from '../../components/photo';
import {
  uploadPhoto,
  prepareUploadRequest,
} from '../../services/photoService';
import { useUploadQueueStore } from '../../store';
import { isE2ETestMode } from '../../utils/testMode';

import type { PhotoUploadScreenProps } from '../../types/navigation';
import type { Location, PhotoUploadMetadata } from '../../types/photo';

// Character limits as per AC-3.1
const TITLE_MAX_LENGTH = 100;
const COMMENT_MAX_LENGTH = 500;

// Default location: Shiojiri, Nagano, Japan
const DEFAULT_LOCATION: Location = {
  latitude: 36.1157,
  longitude: 137.9644,
};

export const PhotoUploadScreen: React.FC<PhotoUploadScreenProps> = ({
  route,
  navigation,
}) => {
  const { photoUri, width, height, latitude, longitude, timestamp } = route.params;

  // Form state
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [location, setLocation] = useState<Location>(() =>
    latitude && longitude
      ? { latitude, longitude }
      : DEFAULT_LOCATION
  );
  const [isLocationPickerVisible, setIsLocationPickerVisible] = useState(false);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Network state
  const [isOnline, setIsOnline] = useState(true);

  // Upload queue
  const addToQueue = useUploadQueueStore((state) => state.addToQueue);

  // Check network status on mount
  useEffect(() => {
    const checkNetwork = async () => {
      const state = await NetInfo.fetch();
      setIsOnline(state.isConnected ?? true);
    };
    checkNetwork();

    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? true);
    });

    return () => unsubscribe();
  }, []);

  // Calculate remaining characters
  const titleRemaining = TITLE_MAX_LENGTH - title.length;
  const commentRemaining = COMMENT_MAX_LENGTH - comment.length;

  // Validation
  const isTitleValid = title.length <= TITLE_MAX_LENGTH;
  const isCommentValid = comment.length <= COMMENT_MAX_LENGTH;
  const isLocationValid = location.latitude !== 0 || location.longitude !== 0;
  const canUpload = isTitleValid && isCommentValid && isLocationValid && !isUploading;

  // Warning states
  const showTitleWarning = title.length > TITLE_MAX_LENGTH * 0.9;
  const showCommentWarning = comment.length > COMMENT_MAX_LENGTH * 0.9;

  /**
   * Handle title change
   */
  const handleTitleChange = useCallback((text: string) => {
    // Allow typing but show warning when over limit
    setTitle(text);
  }, []);

  /**
   * Handle comment change
   */
  const handleCommentChange = useCallback((text: string) => {
    // Allow typing but show warning when over limit
    setComment(text);
  }, []);

  /**
   * Open location picker
   */
  const handleOpenLocationPicker = useCallback(() => {
    setIsLocationPickerVisible(true);
  }, []);

  /**
   * Handle location selection
   */
  const handleLocationSelect = useCallback((newLocation: Location) => {
    setLocation(newLocation);
    setIsLocationPickerVisible(false);
  }, []);

  /**
   * Close location picker
   */
  const handleCloseLocationPicker = useCallback(() => {
    setIsLocationPickerVisible(false);
  }, []);

  /**
   * Prepare upload metadata
   */
  const prepareMetadata = useCallback((): PhotoUploadMetadata => {
    return {
      title: title.trim() || undefined,
      comment: comment.trim() || undefined,
      latitude: location.latitude,
      longitude: location.longitude,
      capturedAt: timestamp,
    };
  }, [title, comment, location, timestamp]);

  /**
   * Handle upload (direct or queued)
   * Requirements: FR-2 (AC-2.6, AC-2.7, AC-2.8)
   */
  const handleUpload = useCallback(async () => {
    // Validate before upload
    if (!isTitleValid) {
      Alert.alert('Error', `Title must be ${TITLE_MAX_LENGTH} characters or less.`);
      return;
    }
    if (!isCommentValid) {
      Alert.alert('Error', `Comment must be ${COMMENT_MAX_LENGTH} characters or less.`);
      return;
    }

    const metadata = prepareMetadata();

    // If offline, add to queue (AC-2.7)
    if (!isOnline) {
      addToQueue(photoUri, metadata);
      Alert.alert(
        'Queued for Upload',
        'Your photo has been saved and will be uploaded when you are back online.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
      return;
    }

    // Online upload
    setIsUploading(true);
    setUploadProgress(0);

    // Check if in E2E test mode to skip progress simulation
    const inTestMode = isE2ETestMode();
    let progressInterval: ReturnType<typeof setInterval> | null = null;

    try {
      // Simulate upload progress (skip in E2E test mode to prevent Detox sync issues)
      if (!inTestMode) {
        progressInterval = setInterval(() => {
          setUploadProgress((prev) => Math.min(prev + 10, 90));
        }, 200);
      }

      const request = prepareUploadRequest(
        {
          uri: photoUri,
          width,
          height,
          location,
          timestamp,
        },
        metadata
      );

      await uploadPhoto(request);

      if (progressInterval) {
        clearInterval(progressInterval);
      }
      setUploadProgress(100);

      // Success notification (AC-2.6)
      Alert.alert(
        'Upload Complete',
        'Your rainbow photo has been shared with the community!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Upload error:', error);
      setUploadProgress(0);

      // Check if it's a network error
      const isNetworkError =
        error instanceof Error &&
        (error.message.includes('Network') || error.message.includes('network'));

      if (isNetworkError) {
        // Add to queue on network error (AC-2.7)
        addToQueue(photoUri, metadata);
        Alert.alert(
          'Network Error',
          'Upload failed due to network issues. Your photo has been queued and will upload automatically when connected.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        // Server error - allow manual retry (AC-2.8)
        const errorMessage =
          error instanceof Error ? error.message : 'An unknown error occurred';
        Alert.alert('Upload Failed', `${errorMessage}\n\nPlease try again.`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: handleUpload },
        ]);
      }
    } finally {
      setIsUploading(false);
    }
  }, [
    isTitleValid,
    isCommentValid,
    prepareMetadata,
    isOnline,
    addToQueue,
    photoUri,
    navigation,
    width,
    height,
    location,
    timestamp,
  ]);

  /**
   * Handle cancel
   */
  const handleCancel = useCallback(() => {
    if (title || comment) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to go back?',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  }, [title, comment, navigation]);

  // Memoized location display
  const locationDisplay = useMemo(() => {
    const hasLocation = latitude && longitude;
    return {
      label: hasLocation ? 'GPS Location' : 'Tap to set location',
      coords: `${location.latitude.toFixed(4)}° N, ${location.longitude.toFixed(4)}° E`,
      needsManualLocation: !hasLocation,
    };
  }, [latitude, longitude, location]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']} testID="upload-screen">
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Photo Preview */}
          <View style={styles.photoPreviewContainer}>
            <Image
              source={{ uri: photoUri }}
              style={styles.photoPreview}
              contentFit="cover"
              transition={200}
              accessibilityLabel="Photo preview"
            />
            {isUploading && (
              <View style={styles.uploadOverlay}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.uploadProgressText}>
                  Uploading... {uploadProgress}%
                </Text>
              </View>
            )}
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>Photo Details</Text>

            {/* Offline indicator */}
            {!isOnline && (
              <View style={styles.offlineWarning}>
                <Text style={styles.offlineWarningText}>
                  You are offline. Photos will be queued for upload.
                </Text>
              </View>
            )}

            {/* Title Input (AC-3.1) */}
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Text style={styles.inputLabel}>Title</Text>
                <Text
                  style={[
                    styles.characterCount,
                    !isTitleValid && styles.characterCountError,
                    showTitleWarning && isTitleValid && styles.characterCountWarning,
                  ]}
                >
                  {titleRemaining}
                </Text>
              </View>
              <TextInput
                style={[
                  styles.textInput,
                  !isTitleValid && styles.textInputError,
                ]}
                value={title}
                onChangeText={handleTitleChange}
                placeholder="Give your rainbow photo a title (optional)"
                placeholderTextColor="#999"
                maxLength={TITLE_MAX_LENGTH + 10} // Allow slight overflow for user to see
                returnKeyType="next"
                accessibilityLabel="Photo title"
                accessibilityHint="Enter a title for your photo, maximum 100 characters"
                testID="upload-title-input"
              />
              {!isTitleValid && (
                <Text style={styles.errorText}>
                  Title cannot exceed {TITLE_MAX_LENGTH} characters
                </Text>
              )}
            </View>

            {/* Comment Input (AC-3.1, AC-3.3) */}
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Text style={styles.inputLabel}>Description</Text>
                <Text
                  style={[
                    styles.characterCount,
                    !isCommentValid && styles.characterCountError,
                    showCommentWarning && isCommentValid && styles.characterCountWarning,
                  ]}
                >
                  {commentRemaining}
                </Text>
              </View>
              <TextInput
                style={[
                  styles.textInput,
                  styles.textArea,
                  !isCommentValid && styles.textInputError,
                ]}
                value={comment}
                onChangeText={handleCommentChange}
                placeholder="Describe the moment you captured this rainbow (optional)"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                maxLength={COMMENT_MAX_LENGTH + 10}
                textAlignVertical="top"
                accessibilityLabel="Photo description"
                accessibilityHint="Enter a description for your photo, maximum 500 characters"
                testID="upload-description-input"
              />
              {!isCommentValid && (
                <Text style={styles.errorText}>
                  Description cannot exceed {COMMENT_MAX_LENGTH} characters
                </Text>
              )}
            </View>

            {/* Location (AC-2.3) */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Location</Text>
              <TouchableOpacity
                style={[
                  styles.locationBox,
                  locationDisplay.needsManualLocation && styles.locationBoxWarning,
                ]}
                onPress={handleOpenLocationPicker}
                accessibilityRole="button"
                accessibilityLabel="Change location"
                accessibilityHint="Opens map to select a different location"
              >
                <View style={styles.locationContent}>
                  <Text
                    style={[
                      styles.locationLabel,
                      locationDisplay.needsManualLocation && styles.locationLabelWarning,
                    ]}
                  >
                    {locationDisplay.label}
                  </Text>
                  <Text style={styles.locationCoords}>{locationDisplay.coords}</Text>
                </View>
                <Text style={styles.locationEditIcon}>Edit</Text>
              </TouchableOpacity>
              {locationDisplay.needsManualLocation && (
                <Text style={styles.warningText}>
                  No GPS data available. Please verify the location.
                </Text>
              )}
            </View>

            {/* Timestamp display */}
            {timestamp && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Captured</Text>
                <Text style={styles.timestampText}>
                  {new Date(timestamp).toLocaleString()}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={isUploading}
            accessibilityRole="button"
            accessibilityLabel="Cancel upload"
            testID="upload-cancel-button"
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.uploadButton,
              (!canUpload || isUploading) && styles.uploadButtonDisabled,
            ]}
            onPress={handleUpload}
            disabled={!canUpload || isUploading}
            accessibilityRole="button"
            accessibilityLabel={isUploading ? 'Uploading photo' : 'Upload photo'}
            accessibilityState={{ disabled: !canUpload || isUploading }}
            testID="upload-submit-button"
          >
            {isUploading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.uploadButtonText}>
                {isOnline ? 'Upload' : 'Queue Upload'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Location Picker Modal */}
      <LocationPicker
        visible={isLocationPickerVisible}
        initialLocation={location}
        onLocationSelect={handleLocationSelect}
        onClose={handleCloseLocationPicker}
        title="Set Rainbow Location"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  photoPreviewContainer: {
    height: 250,
    backgroundColor: '#000',
    position: 'relative',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadProgressText: {
    marginTop: 12,
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  form: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
  },
  offlineWarning: {
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  offlineWarningText: {
    color: '#856404',
    fontSize: 14,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
  },
  characterCountWarning: {
    color: '#FF9500',
  },
  characterCountError: {
    color: '#FF3B30',
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
    color: '#333',
  },
  textInputError: {
    borderColor: '#FF3B30',
    backgroundColor: '#FFF5F5',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    marginTop: 4,
    fontSize: 12,
    color: '#FF3B30',
  },
  warningText: {
    marginTop: 4,
    fontSize: 12,
    color: '#FF9500',
  },
  locationBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationBoxWarning: {
    borderColor: '#FF9500',
    backgroundColor: '#FFFBF5',
  },
  locationContent: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  locationLabelWarning: {
    color: '#FF9500',
  },
  locationCoords: {
    fontSize: 12,
    color: '#666',
  },
  locationEditIcon: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  timestampText: {
    fontSize: 14,
    color: '#666',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  uploadButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#4A90A4',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  uploadButtonDisabled: {
    backgroundColor: '#B0C4CE',
  },
  uploadButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
