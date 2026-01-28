/**
 * LikeButton Component
 *
 * A button that allows users to like/unlike photos with optimistic UI updates.
 * Displays like count and visual feedback for the current state.
 *
 * Accessibility features (WCAG 2.1 AA):
 * - Clear accessibility labels in Japanese
 * - accessibilityState.selected to indicate like status
 * - Minimum touch target size 44x44pt
 * - Screen reader announcements for state changes
 *
 * Requirements: FR-8 (Social Features), NFR-5 (Accessibility)
 */

import React, { useState, useCallback, useRef } from 'react';

import {
  StyleSheet,
  Text,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  AccessibilityInfo,
} from 'react-native';

import { socialService } from '../../services/socialService';
import {
  MIN_TOUCH_TARGET_SIZE,
  formatNumberForScreenReader,
} from '../../utils/accessibility';

interface LikeButtonProps {
  photoId: string;
  initialLiked: boolean;
  initialLikeCount: number;
  onLikeChange?: (liked: boolean, likeCount: number) => void;
  size?: 'small' | 'medium' | 'large';
  showCount?: boolean;
  /** Test ID for testing frameworks */
  testID?: string;
}

export const LikeButton: React.FC<LikeButtonProps> = ({
  photoId,
  initialLiked,
  initialLikeCount,
  onLikeChange,
  size = 'medium',
  showCount = true,
  testID,
}) => {
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isLoading, setIsLoading] = useState(false);

  // Animation value for the heart scale
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Get size-specific styles
  const sizeStyles = getSizeStyles(size);

  // Generate accessibility label with like count for screen readers
  const getAccessibilityLabel = (): string => {
    const likeCountText = formatNumberForScreenReader(likeCount);
    if (isLiked) {
      return showCount
        ? `いいね済み、${likeCountText}件のいいね、ダブルタップでいいねを取り消す`
        : 'いいね済み、ダブルタップでいいねを取り消す';
    }
    return showCount
      ? `いいね、${likeCountText}件のいいね、ダブルタップでいいねする`
      : 'いいね、ダブルタップでいいねする';
  };

  // Announce state change to screen readers
  const announceStateChange = (liked: boolean, count: number) => {
    const countText = formatNumberForScreenReader(count);
    const message = liked
      ? `いいねしました。${countText}件のいいね`
      : `いいねを取り消しました。${countText}件のいいね`;
    AccessibilityInfo.announceForAccessibility(message);
  };

  // Handle like/unlike action
  const handlePress = useCallback(async () => {
    if (isLoading) return;

    // Optimistic update
    const newLiked = !isLiked;
    const newCount = newLiked ? likeCount + 1 : likeCount - 1;

    setIsLiked(newLiked);
    setLikeCount(newCount);

    // Animate the heart
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.3,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    setIsLoading(true);

    try {
      const response = await socialService.toggleLike(photoId, isLiked);

      // Update with actual server values
      setIsLiked(response.liked);
      setLikeCount(response.likeCount);
      onLikeChange?.(response.liked, response.likeCount);

      // Announce state change to screen readers
      announceStateChange(response.liked, response.likeCount);
    } catch (err) {
      // Revert optimistic update on error
      setIsLiked(isLiked);
      setLikeCount(likeCount);
      console.error('Failed to toggle like:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isLiked, likeCount, isLoading, photoId, scaleAnim, onLikeChange]);

  // Format like count for display
  const formatCount = (count: number): string => {
    if (count >= 10000) {
      return `${(count / 10000).toFixed(1)}万`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  return (
    <TouchableOpacity
      style={[styles.container, sizeStyles.container]}
      onPress={handlePress}
      disabled={isLoading}
      activeOpacity={0.7}
      accessible={true}
      accessibilityLabel={getAccessibilityLabel()}
      accessibilityRole="button"
      accessibilityState={{
        selected: isLiked,
        disabled: isLoading,
        busy: isLoading,
      }}
      testID={testID}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={isLiked ? '#C53030' : '#6B6B6B'}
          accessibilityLabel="Loading"
        />
      ) : (
        <Animated.Text
          style={[
            styles.heartIcon,
            sizeStyles.icon,
            isLiked && styles.heartIconLiked,
            { transform: [{ scale: scaleAnim }] },
          ]}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          {isLiked ? '❤️' : '🤍'}
        </Animated.Text>
      )}

      {showCount && (
        <Text
          style={[
            styles.countText,
            sizeStyles.countText,
            isLiked && styles.countTextLiked,
          ]}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          {formatCount(likeCount)}
        </Text>
      )}
    </TouchableOpacity>
  );
};

// Get size-specific styles - all sizes ensure minimum 44pt touch target
const getSizeStyles = (size: 'small' | 'medium' | 'large') => {
  switch (size) {
    case 'small':
      return {
        // Still maintains 44pt minimum height for accessibility
        container: { paddingHorizontal: 8, paddingVertical: 12 },
        icon: { fontSize: 16 },
        countText: { fontSize: 12 },
      };
    case 'large':
      return {
        container: { paddingHorizontal: 16, paddingVertical: 14 },
        icon: { fontSize: 28 },
        countText: { fontSize: 18 },
      };
    case 'medium':
    default:
      return {
        container: { paddingHorizontal: 12, paddingVertical: 12 },
        icon: { fontSize: 22 },
        countText: { fontSize: 14 },
      };
  }
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    // Ensure minimum touch target size (WCAG 2.5.5)
    minWidth: MIN_TOUCH_TARGET_SIZE,
    minHeight: MIN_TOUCH_TARGET_SIZE,
  },
  heartIcon: {
    textAlign: 'center',
  },
  heartIconLiked: {
    // Additional styles for liked state if needed
  },
  countText: {
    marginLeft: 4,
    color: '#5C5C5C', // Accessible secondary text color (5.91:1 on white)
    fontWeight: '500',
  },
  countTextLiked: {
    color: '#C53030', // Accessible error/like color (5.89:1 on white)
  },
});
