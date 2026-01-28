/**
 * ProfileScreen - User profile display with photo grid
 *
 * Displays user profile information, stats, and uploaded photos.
 * Supports photo grid view, pull-to-refresh, and photo management.
 *
 * Accessibility features (WCAG 2.1 AA):
 * - Screen reader support for all UI elements
 * - Minimum touch target size 44x44pt
 * - Color contrast ratio 4.5:1 or higher
 * - Accessible announcements for state changes
 *
 * Requirements: FR-9 (AC-9.1 to AC-9.5)
 */

import React, { useState, useCallback, useMemo } from 'react';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Dimensions,
  AccessibilityInfo,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMyPhotos, deletePhoto } from '../../services/photoService';
import { getMyProfile, type UserProfile } from '../../services/userService';
import { useCurrentUser } from '../../store/authStore';
import {
  accessibleColors,
  MIN_TOUCH_TARGET_SIZE,
  formatNumberForScreenReader,
  createScreenReaderAnnouncement,
} from '../../utils/accessibility';

import type { ProfileScreenProps } from '../../types/navigation';
import type { Photo, PhotoListResponse } from '../../types/photo';

const { width: screenWidth } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const GRID_GAP = 2;
const PHOTO_SIZE = (screenWidth - GRID_GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

/**
 * Format count for display with abbreviation
 */
const formatCount = (count: number): string => {
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1)}`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
};

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

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch user profile with stats
  const {
    data: profile,
    isLoading: isLoadingProfile,
    error: profileError,
    refetch: refetchProfile,
  } = useQuery<UserProfile>({
    queryKey: ['userProfile'],
    queryFn: getMyProfile,
    enabled: !!user,
  });

  // Fetch user's photos
  const {
    data: photosData,
    isLoading: isLoadingPhotos,
    error: photosError,
    refetch: refetchPhotos,
  } = useQuery<PhotoListResponse>({
    queryKey: ['myPhotos'],
    queryFn: () => getMyPhotos(1),
    enabled: !!user,
  });

  // Delete photo mutation
  const deletePhotoMutation = useMutation({
    mutationFn: deletePhoto,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myPhotos'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      queryClient.invalidateQueries({ queryKey: ['photos'] });
      AccessibilityInfo.announceForAccessibility('Photo deleted successfully');
    },
    onError: (error) => {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to delete photo',
        [{ text: 'OK' }]
      );
    },
  });

  // Photos array from query data
  const photos = useMemo(() => photosData?.data ?? [], [photosData]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refetchProfile(), refetchPhotos()]);
    setIsRefreshing(false);
    AccessibilityInfo.announceForAccessibility('Profile refreshed');
  }, [refetchProfile, refetchPhotos]);

  // Navigate to photo detail (AC-9.5)
  const handlePhotoPress = useCallback(
    (photo: Photo) => {
      navigation.getParent()?.navigate('FeedTab', {
        screen: 'PhotoDetail',
        params: { photoId: photo.id },
      });
    },
    [navigation]
  );

  // Show delete confirmation (AC-9.4)
  const handlePhotoLongPress = useCallback(
    (photo: Photo) => {
      Alert.alert(
        'Delete Photo',
        'Are you sure you want to delete this photo? This action cannot be undone.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              deletePhotoMutation.mutate(photo.id);
            },
          },
        ]
      );
    },
    [deletePhotoMutation]
  );

  // Navigate to edit profile
  const handleEditProfile = useCallback(() => {
    navigation.navigate('EditProfile');
  }, [navigation]);

  // Navigate to settings
  const handleSettings = useCallback(() => {
    navigation.navigate('Settings');
  }, [navigation]);

  // Render photo grid item (AC-9.3)
  const renderPhotoItem = useCallback(
    ({ item, index }: { item: Photo; index: number }) => {
      const accessibilityLabel = createScreenReaderAnnouncement(
        item.title || 'Rainbow photo',
        item.location?.name || '',
        `${formatNumberForScreenReader(item.likeCount)} likes`,
        'Double tap to view, long press to delete'
      );

      return (
        <TouchableOpacity
          style={styles.photoItem}
          onPress={() => handlePhotoPress(item)}
          onLongPress={() => handlePhotoLongPress(item)}
          delayLongPress={500}
          accessible={true}
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          accessibilityHint="Double tap to view details, long press to delete"
          testID={`photo-grid-item-${index}`}
        >
          <Image
            source={{ uri: item.imageUrls.thumbnail || item.imageUrls.medium }}
            style={styles.photoImage}
            contentFit="cover"
            transition={200}
          />
          {/* Like count overlay */}
          <View style={styles.photoOverlay}>
            <View style={styles.photoStats}>
              <Ionicons name="heart" size={12} color="#FFFFFF" />
              <Text style={styles.photoStatsText}>
                {formatCount(item.likeCount)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [handlePhotoPress, handlePhotoLongPress]
  );

  // Render header with profile info (AC-9.1)
  const renderHeader = useCallback(() => {
    const displayName = profile?.displayName || user?.displayName || 'User';
    const profileImageUrl = profile?.profileImageUrl;
    const photosCount = profile?.stats.photosCount ?? photos.length;
    const likesReceived = profile?.stats.totalLikesReceived ?? 0;

    const profileAccessibilityLabel = createScreenReaderAnnouncement(
      `Profile: ${displayName}`,
      `${formatNumberForScreenReader(photosCount)} photos`,
      `${formatNumberForScreenReader(likesReceived)} total likes received`
    );

    return (
      <View accessible={false}>
        {/* Header Bar */}
        <View style={styles.header}>
          <Text
            style={styles.title}
            accessible={true}
            accessibilityRole="header"
            accessibilityLabel="Profile"
          >
            Profile
          </Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={handleSettings}
            accessible={true}
            accessibilityLabel="Settings"
            accessibilityRole="button"
            accessibilityHint="Go to settings screen"
            testID="settings-button"
          >
            <Ionicons name="settings-outline" size={24} color={accessibleColors.primary} />
          </TouchableOpacity>
        </View>

        {/* Profile Section */}
        <View
          style={styles.profileSection}
          accessible={true}
          accessibilityLabel={profileAccessibilityLabel}
        >
          {/* Avatar */}
          {profileImageUrl ? (
            <Image
              source={{ uri: profileImageUrl }}
              style={styles.avatar}
              contentFit="cover"
              accessibilityLabel={`${displayName}'s profile picture`}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
            </View>
          )}

          {/* User Name */}
          <Text
            style={styles.userName}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          >
            {displayName}
          </Text>

          {/* Edit Profile Button */}
          <TouchableOpacity
            style={styles.editButton}
            onPress={handleEditProfile}
            accessible={true}
            accessibilityLabel="Edit profile"
            accessibilityRole="button"
            accessibilityHint="Navigate to edit profile screen"
            testID="edit-profile-button"
          >
            <Ionicons
              name="pencil-outline"
              size={16}
              color={accessibleColors.primary}
              style={styles.editButtonIcon}
            />
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Section (AC-9.1) */}
        <View style={styles.statsSection} accessible={false}>
          <View style={styles.statItem}>
            <Text
              style={styles.statValue}
              accessible={true}
              accessibilityLabel={`${formatNumberForScreenReader(photosCount)} photos`}
            >
              {formatCount(photosCount)}
            </Text>
            <Text
              style={styles.statLabel}
              accessible={false}
              importantForAccessibility="no-hide-descendants"
            >
              Photos
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text
              style={styles.statValue}
              accessible={true}
              accessibilityLabel={`${formatNumberForScreenReader(likesReceived)} likes received`}
            >
              {formatCount(likesReceived)}
            </Text>
            <Text
              style={styles.statLabel}
              accessible={false}
              importantForAccessibility="no-hide-descendants"
            >
              Likes Received
            </Text>
          </View>
        </View>

        {/* Photos Section Header */}
        <View style={styles.photosHeader}>
          <Text
            style={styles.photosTitle}
            accessible={true}
            accessibilityRole="header"
          >
            Your Photos
          </Text>
        </View>
      </View>
    );
  }, [profile, user, photos.length, handleSettings, handleEditProfile]);

  // Render empty state
  const renderEmptyState = useCallback(() => {
    if (isLoadingPhotos) return null;

    return (
      <View
        style={styles.emptyState}
        accessible={true}
        accessibilityLabel="You haven't uploaded any photos yet. Start capturing rainbows!"
      >
        <Ionicons name="camera-outline" size={64} color="#CCCCCC" />
        <Text style={styles.emptyTitle}>No photos yet</Text>
        <Text style={styles.emptyDescription}>
          Start capturing rainbows in Shiojiri!
        </Text>
      </View>
    );
  }, [isLoadingPhotos]);

  // Loading state
  if (isLoadingProfile && isLoadingPhotos) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={accessibleColors.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (profileError || photosError) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={accessibleColors.error} />
          <Text style={styles.errorText}>Failed to load profile</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRefresh}
            accessible={true}
            accessibilityLabel="Retry loading profile"
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="profile-screen">
      <FlatList
        data={photos}
        renderItem={renderPhotoItem}
        keyExtractor={(item) => item.id}
        numColumns={NUM_COLUMNS}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={photos.length > 0 ? styles.columnWrapper : undefined}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={accessibleColors.primary}
            title="Updating..."
            titleColor={accessibleColors.textSecondary}
          />
        }
        showsVerticalScrollIndicator={false}
        accessible={true}
        accessibilityLabel="Your photo gallery"
        accessibilityRole="list"
        testID="profile-photo-grid"
      />

      {/* Delete loading overlay */}
      {deletePhotoMutation.isPending && (
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteOverlayContent}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.deleteOverlayText}>Deleting...</Text>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: accessibleColors.error,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: accessibleColors.primary,
    borderRadius: 8,
    minHeight: MIN_TOUCH_TARGET_SIZE,
    justifyContent: 'center',
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  listContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: accessibleColors.textPrimary,
  },
  settingsButton: {
    minWidth: MIN_TOUCH_TARGET_SIZE,
    minHeight: MIN_TOUCH_TARGET_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileSection: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
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
  userName: {
    fontSize: 22,
    fontWeight: '600',
    color: accessibleColors.textPrimary,
    marginBottom: 16,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: accessibleColors.primary,
    minHeight: MIN_TOUCH_TARGET_SIZE,
  },
  editButtonIcon: {
    marginRight: 6,
  },
  editButtonText: {
    color: accessibleColors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  statsSection: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginTop: 1,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: accessibleColors.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: accessibleColors.textSecondary,
  },
  statDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#E0E0E0',
  },
  photosHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  photosTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: accessibleColors.textPrimary,
  },
  columnWrapper: {
    paddingHorizontal: GRID_GAP / 2,
  },
  photoItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    margin: GRID_GAP / 2,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  photoStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  photoStatsText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: accessibleColors.textPrimary,
  },
  emptyDescription: {
    marginTop: 8,
    fontSize: 14,
    color: accessibleColors.textSecondary,
    textAlign: 'center',
  },
  deleteOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteOverlayContent: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  deleteOverlayText: {
    marginTop: 12,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});
