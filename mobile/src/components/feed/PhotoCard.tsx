/**
 * PhotoCard - Reusable photo card component for the feed
 *
 * Displays photo thumbnail with user info, location, date, and engagement stats.
 * Supports tap to navigate to photo detail and accessibility features.
 *
 * Accessibility features (WCAG 2.1 AA):
 * - Clear accessibility labels with photo context
 * - Minimum touch target size 44x44pt
 * - Color contrast ratio 4.5:1 or higher
 * - Screen reader support for all information
 *
 * Requirements: FR-4 (AC-4.1, AC-4.3)
 */

import React, { useCallback } from 'react';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  type ViewStyle,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Image } from 'expo-image';

import {
  MIN_TOUCH_TARGET_SIZE,
  formatNumberForScreenReader,
  createScreenReaderAnnouncement,
} from '../../utils/accessibility';

import type { Photo } from '../../types/photo';

interface PhotoCardProps {
  /** Photo data to display */
  photo: Photo;
  /** Callback when the card is pressed */
  onPress: (photo: Photo) => void;
  /** Optional container style override */
  style?: ViewStyle;
  /** Test ID for testing frameworks */
  testID?: string;
}

/**
 * Format date for display
 */
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return format(date, 'yyyy年M月d日', { locale: ja });
  } catch {
    return dateString;
  }
};

/**
 * Format count for display (e.g., 10000 -> 1万)
 */
const formatCount = (count: number): string => {
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1)}万`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
};

const PhotoCardComponent: React.FC<PhotoCardProps> = ({
  photo,
  onPress,
  style,
  testID,
}) => {
  const handlePress = useCallback(() => {
    onPress(photo);
  }, [photo, onPress]);

  // Generate accessibility label with all relevant information
  const accessibilityLabel = createScreenReaderAnnouncement(
    photo.title || '虹の写真',
    `投稿者: ${photo.user.displayName}`,
    photo.location?.name && `場所: ${photo.location.name}`,
    `日付: ${formatDate(photo.capturedAt)}`,
    `${formatNumberForScreenReader(photo.likeCount)}件のいいね`,
    `${formatNumberForScreenReader(photo.commentCount)}件のコメント`,
    'ダブルタップで詳細を表示'
  );

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessible={true}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityHint="写真の詳細画面に移動します"
      testID={testID}
    >
      {/* Photo Thumbnail */}
      <Image
        source={{ uri: photo.imageUrls.thumbnail || photo.imageUrls.medium }}
        style={styles.thumbnail}
        contentFit="cover"
        placeholderContentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
        accessibilityLabel={photo.title || '虹の写真'}
        accessibilityRole="image"
      />

      {/* Content Container */}
      <View style={styles.content}>
        {/* Header: User Info */}
        <View style={styles.header}>
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={14} color="#6B6B6B" />
          </View>
          <Text
            style={styles.userName}
            numberOfLines={1}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          >
            {photo.user.displayName}
          </Text>
        </View>

        {/* Title */}
        {photo.title && (
          <Text
            style={styles.title}
            numberOfLines={2}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          >
            {photo.title}
          </Text>
        )}

        {/* Meta: Location and Date */}
        <View style={styles.meta}>
          {photo.location?.name && (
            <View style={styles.metaItem}>
              <Ionicons
                name="location-outline"
                size={14}
                color="#6B6B6B"
                style={styles.metaIcon}
              />
              <Text
                style={styles.metaText}
                numberOfLines={1}
                accessible={false}
                importantForAccessibility="no-hide-descendants"
              >
                {photo.location.name}
              </Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color="#6B6B6B"
              style={styles.metaIcon}
            />
            <Text
              style={styles.metaText}
              accessible={false}
              importantForAccessibility="no-hide-descendants"
            >
              {formatDate(photo.capturedAt)}
            </Text>
          </View>
        </View>

        {/* Footer: Stats */}
        <View style={styles.footer}>
          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <Ionicons
                name="heart-outline"
                size={16}
                color="#6B6B6B"
                style={styles.statIcon}
              />
              <Text
                style={styles.statText}
                accessible={false}
                importantForAccessibility="no-hide-descendants"
              >
                {formatCount(photo.likeCount)}
              </Text>
            </View>
            <View style={styles.stat}>
              <Ionicons
                name="chatbubble-outline"
                size={16}
                color="#6B6B6B"
                style={styles.statIcon}
              />
              <Text
                style={styles.statText}
                accessible={false}
                importantForAccessibility="no-hide-descendants"
              >
                {formatCount(photo.commentCount)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    // Ensure minimum touch target size
    minHeight: MIN_TOUCH_TARGET_SIZE,
  },
  thumbnail: {
    width: '100%',
    height: 200,
    backgroundColor: '#F5F5F5',
  },
  content: {
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
  avatarPlaceholder: {
    backgroundColor: '#E8F4F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#1F1F1F', // High contrast text (16.1:1 on white)
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F1F1F', // High contrast text (16.1:1 on white)
    marginBottom: 8,
    lineHeight: 22,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  metaIcon: {
    marginRight: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#5C5C5C', // Accessible secondary text (5.91:1 on white)
    flexShrink: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    marginRight: 4,
  },
  statText: {
    fontSize: 13,
    color: '#5C5C5C', // Accessible secondary text (5.91:1 on white)
    fontWeight: '500',
  },
});

/**
 * Memoized PhotoCard component for performance optimization
 * Prevents unnecessary re-renders when props haven't changed
 */
export const PhotoCard = React.memo(PhotoCardComponent);
