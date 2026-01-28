/**
 * RadarViewer - Radar image viewer component
 *
 * Displays radar images in a horizontal scrollable list with timestamps
 * and intensity indicators. Supports animation/slideshow of radar images.
 *
 * Accessibility features (WCAG 2.1 AA):
 * - accessibilityLabel for each radar image
 * - Description of intensity levels
 * - Navigation hints for horizontal scroll
 *
 * Requirements: FR-13 (AC-13.4)
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';

import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {
  accessibleColors,
  MIN_TOUCH_TARGET_SIZE,
} from '../../utils/accessibility';
import { shouldEnableContinuousAnimations } from '../../utils/testMode';

import type { RadarData } from '../../types/photo';

interface RadarViewerProps {
  /** Radar data array */
  radarData: RadarData[];
  /** Test ID for testing */
  testID?: string;
}

const screenWidth = Dimensions.get('window').width;
const RADAR_IMAGE_WIDTH = screenWidth - 64;
const RADAR_IMAGE_HEIGHT = 200;

/**
 * Get intensity description for accessibility
 */
const getIntensityDescription = (intensity: number): string => {
  if (intensity === 0) return '降水なし';
  if (intensity < 5) return '弱い雨';
  if (intensity < 20) return '中程度の雨';
  if (intensity < 50) return '強い雨';
  return '非常に強い雨';
};

/**
 * Get intensity color for visual indicator
 */
const getIntensityColor = (intensity: number): string => {
  if (intensity === 0) return '#E0E0E0';
  if (intensity < 5) return '#90CDF4'; // Light blue
  if (intensity < 20) return '#4299E1'; // Blue
  if (intensity < 50) return '#F6AD55'; // Orange
  return '#FC8181'; // Red
};

/**
 * Format timestamp for display
 */
const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Format timestamp for accessibility
 */
const formatTimestampForAccessibility = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('ja-JP', {
    hour: 'numeric',
    minute: 'numeric',
  });
};

export const RadarViewer: React.FC<RadarViewerProps> = ({
  radarData,
  testID,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const animationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sort radar data by timestamp
  const sortedData = [...radarData].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Handle play/pause animation
  const togglePlayback = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Animation effect
  // Note: Disabled in E2E test mode to prevent Detox synchronization issues
  useEffect(() => {
    // Skip animations in E2E test mode to allow Detox to synchronize
    const enableAnimations = shouldEnableContinuousAnimations();

    if (isPlaying && sortedData.length > 1 && enableAnimations) {
      animationRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          const nextIndex = (prev + 1) % sortedData.length;
          scrollViewRef.current?.scrollTo({
            x: nextIndex * (RADAR_IMAGE_WIDTH + 16),
            animated: true,
          });
          return nextIndex;
        });
      }, 1000);
    } else {
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
    }

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, [isPlaying, sortedData.length]);

  // Handle scroll end to update current index
  const handleScrollEnd = useCallback(
    (event: { nativeEvent: { contentOffset: { x: number } } }) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const newIndex = Math.round(offsetX / (RADAR_IMAGE_WIDTH + 16));
      setCurrentIndex(Math.max(0, Math.min(newIndex, sortedData.length - 1)));
    },
    [sortedData.length]
  );

  if (!sortedData || sortedData.length === 0) {
    return (
      <View
        style={styles.container}
        accessible={true}
        accessibilityLabel="レーダーデータがありません"
        testID={testID}
      >
        <View style={styles.header}>
          <Ionicons
            name="radio-outline"
            size={20}
            color={accessibleColors.primary}
          />
          <Text style={styles.title}>雨雲レーダー</Text>
        </View>
        <View style={styles.noDataContainer}>
          <Ionicons
            name="cloud-offline-outline"
            size={32}
            color={accessibleColors.textMuted}
          />
          <Text style={styles.noDataText}>レーダーデータがありません</Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityLabel={`雨雲レーダー。${sortedData.length}枚の画像。左右にスクロールして閲覧できます`}
      testID={testID}
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Ionicons
            name="radio-outline"
            size={20}
            color={accessibleColors.primary}
          />
          <Text style={styles.title}>雨雲レーダー</Text>
        </View>
        {sortedData.length > 1 && (
          <TouchableOpacity
            style={styles.playButton}
            onPress={togglePlayback}
            accessible={true}
            accessibilityLabel={isPlaying ? 'スライドショーを停止' : 'スライドショーを再生'}
            accessibilityRole="button"
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={20}
              color={accessibleColors.primary}
            />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled={false}
        snapToInterval={RADAR_IMAGE_WIDTH + 16}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {sortedData.map((radar, index) => (
          <View
            key={radar.timestamp}
            style={styles.radarItem}
            accessible={true}
            accessibilityLabel={`${formatTimestampForAccessibility(radar.timestamp)}のレーダー画像。${getIntensityDescription(radar.precipitationIntensity ?? 0)}`}
          >
            <View style={styles.imageContainer}>
              {/* Radar data visualization placeholder */}
              <View style={styles.placeholderImage}>
                <Ionicons
                  name="rainy-outline"
                  size={48}
                  color={accessibleColors.textMuted}
                />
                <Text style={styles.placeholderText}>
                  {radar.precipitationIntensity ?? 0} mm/h
                </Text>
              </View>

              {/* Intensity indicator overlay */}
              <View
                style={[
                  styles.intensityIndicator,
                  { backgroundColor: getIntensityColor(radar.precipitationIntensity ?? 0) },
                ]}
              >
                <Text style={styles.intensityText}>
                  {radar.precipitationIntensity ?? 0} mm/h
                </Text>
              </View>
            </View>

            {/* Timestamp */}
            <View style={styles.timestampContainer}>
              <Text style={styles.timestamp}>
                {formatTimestamp(radar.timestamp)}
              </Text>
              <Text style={styles.intensityLabel}>
                {getIntensityDescription(radar.precipitationIntensity ?? 0)}
              </Text>
            </View>

            {/* Current indicator dot */}
            {index === currentIndex && (
              <View
                style={styles.currentIndicator}
                accessible={true}
                accessibilityLabel="現在表示中"
              />
            )}
          </View>
        ))}
      </ScrollView>

      {/* Pagination dots */}
      {sortedData.length > 1 && (
        <View style={styles.pagination}>
          {sortedData.map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                index === currentIndex && styles.paginationDotActive,
              ]}
            />
          ))}
        </View>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>降水強度</Text>
        <View style={styles.legendItems}>
          <LegendItem intensity={0} label="なし" />
          <LegendItem intensity={3} label="弱" />
          <LegendItem intensity={15} label="中" />
          <LegendItem intensity={40} label="強" />
          <LegendItem intensity={60} label="激" />
        </View>
      </View>
    </View>
  );
};

/**
 * Legend item component
 */
const LegendItem: React.FC<{ intensity: number; label: string }> = ({
  intensity,
  label,
}) => (
  <View style={styles.legendItem}>
    <View
      style={[
        styles.legendColor,
        { backgroundColor: getIntensityColor(intensity) },
      ]}
    />
    <Text style={styles.legendLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: accessibleColors.textPrimary,
    marginLeft: 8,
  },
  playButton: {
    width: MIN_TOUCH_TARGET_SIZE,
    height: MIN_TOUCH_TARGET_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E8F4F8',
    borderRadius: MIN_TOUCH_TARGET_SIZE / 2,
  },
  noDataContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  noDataText: {
    marginTop: 8,
    fontSize: 14,
    color: accessibleColors.textMuted,
  },
  scrollView: {
    marginHorizontal: -8,
  },
  scrollContent: {
    paddingHorizontal: 8,
  },
  radarItem: {
    width: RADAR_IMAGE_WIDTH,
    marginHorizontal: 8,
    position: 'relative',
  },
  imageContainer: {
    width: '100%',
    height: RADAR_IMAGE_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  radarImage: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 12,
    color: accessibleColors.textMuted,
  },
  intensityIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  intensityText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  timestampContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 14,
    fontWeight: '600',
    color: accessibleColors.textPrimary,
  },
  intensityLabel: {
    fontSize: 12,
    color: accessibleColors.textSecondary,
    marginTop: 2,
  },
  currentIndicator: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: accessibleColors.primary,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: accessibleColors.primary,
    width: 16,
  },
  legend: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  legendTitle: {
    fontSize: 12,
    color: accessibleColors.textSecondary,
    marginBottom: 8,
  },
  legendItems: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 4,
  },
  legendLabel: {
    fontSize: 12,
    color: accessibleColors.textSecondary,
  },
});
