/**
 * PhotoPreviewModal - Modal for previewing photo from map marker
 *
 * Displays a preview of the photo when a map marker is tapped.
 * Includes photo thumbnail, title, location, date, and navigation to detail screen.
 *
 * Accessibility features (WCAG 2.1 AA):
 * - Clear accessibility labels and hints
 * - Focus trap within modal
 * - Screen reader announcements
 * - Minimum touch target size 44x44pt
 *
 * Requirements: FR-5 (AC-5.2)
 */

import React, { useCallback, useEffect, useRef } from 'react';

import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  AccessibilityInfo,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Image } from 'expo-image';

import {
  accessibleColors,
  MIN_TOUCH_TARGET_SIZE,
  createScreenReaderAnnouncement,
} from '../../utils/accessibility';
import { Button } from '../ui/Button';

import type { MapMarker } from '../../services/mapService';

// ============================================
// Types
// ============================================

interface PhotoPreviewModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Marker data to display */
  marker: MapMarker | null;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when user wants to view full photo detail */
  onViewDetail: (photoId: string) => void;
}

// ============================================
// Constants
// ============================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MODAL_WIDTH = Math.min(SCREEN_WIDTH - 32, 400);

// ============================================
// Helper Functions
// ============================================

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

// ============================================
// Component
// ============================================

export const PhotoPreviewModal: React.FC<PhotoPreviewModalProps> = ({
  visible,
  marker,
  onClose,
  onViewDetail,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  /**
   * Animate modal in/out
   */
  useEffect(() => {
    if (visible) {
      // Announce to screen readers
      AccessibilityInfo.announceForAccessibility(
        marker?.title
          ? `${marker.title}のプレビューを表示中`
          : '写真のプレビューを表示中'
      );

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 50,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim, marker?.title]);

  /**
   * Handle view detail button press
   */
  const handleViewDetail = useCallback(() => {
    if (marker) {
      onViewDetail(marker.id);
    }
  }, [marker, onViewDetail]);

  /**
   * Handle backdrop press
   */
  const handleBackdropPress = useCallback(() => {
    onClose();
  }, [onClose]);

  /**
   * Handle close button press
   */
  const handleClosePress = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!marker) {
    return null;
  }

  // Generate accessibility label for the modal content
  const contentAccessibilityLabel = createScreenReaderAnnouncement(
    marker.title || '虹の写真',
    `撮影日: ${formatDate(marker.capturedAt)}`,
    '詳細を見るボタンで写真の詳細画面に移動できます'
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent={true}
      supportedOrientations={['portrait', 'landscape']}
      accessible={true}
      accessibilityViewIsModal={true}
      accessibilityLabel="写真プレビュー"
    >
      <TouchableWithoutFeedback
        onPress={handleBackdropPress}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="閉じる"
        accessibilityHint="モーダルを閉じます"
      >
        <Animated.View
          style={[styles.backdrop, { opacity: fadeAnim }]}
        >
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.modalContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
              accessible={true}
              accessibilityLabel={contentAccessibilityLabel}
            >
              {/* Close Button */}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClosePress}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="閉じる"
                accessibilityHint="プレビューを閉じます"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                testID="preview-close-button"
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={accessibleColors.textSecondary}
                />
              </TouchableOpacity>

              {/* Photo Thumbnail */}
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: marker.thumbnailUrl }}
                  style={styles.image}
                  contentFit="cover"
                  transition={200}
                  accessibilityLabel={marker.title || '虹の写真'}
                  accessibilityRole="image"
                />
              </View>

              {/* Content */}
              <View style={styles.content}>
                {/* Title */}
                {marker.title && (
                  <Text
                    style={styles.title}
                    numberOfLines={2}
                    accessible={false}
                    importantForAccessibility="no-hide-descendants"
                  >
                    {marker.title}
                  </Text>
                )}

                {/* Meta Info */}
                <View style={styles.metaContainer}>
                  {/* Date */}
                  <View style={styles.metaItem}>
                    <Ionicons
                      name="calendar-outline"
                      size={16}
                      color={accessibleColors.textMuted}
                      style={styles.metaIcon}
                    />
                    <Text
                      style={styles.metaText}
                      accessible={false}
                      importantForAccessibility="no-hide-descendants"
                    >
                      {formatDate(marker.capturedAt)}
                    </Text>
                  </View>

                  {/* Location coordinates (simplified) */}
                  <View style={styles.metaItem}>
                    <Ionicons
                      name="location-outline"
                      size={16}
                      color={accessibleColors.textMuted}
                      style={styles.metaIcon}
                    />
                    <Text
                      style={styles.metaText}
                      accessible={false}
                      importantForAccessibility="no-hide-descendants"
                    >
                      {`${marker.latitude.toFixed(4)}, ${marker.longitude.toFixed(4)}`}
                    </Text>
                  </View>
                </View>

                {/* View Detail Button */}
                <Button
                  title="詳細を見る"
                  onPress={handleViewDetail}
                  variant="primary"
                  size="medium"
                  fullWidth={true}
                  icon="arrow-forward"
                  iconPosition="right"
                  accessibilityLabel="写真の詳細を見る"
                  accessibilityHint="写真の詳細画面に移動します"
                  testID="preview-view-detail-button"
                />
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: MODAL_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: MIN_TOUCH_TARGET_SIZE,
    height: MIN_TOUCH_TARGET_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: MIN_TOUCH_TARGET_SIZE / 2,
  },
  imageContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#F5F5F5',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: accessibleColors.textPrimary,
    marginBottom: 12,
    lineHeight: 24,
  },
  metaContainer: {
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaIcon: {
    marginRight: 8,
  },
  metaText: {
    fontSize: 14,
    color: accessibleColors.textSecondary,
  },
});

export default PhotoPreviewModal;
