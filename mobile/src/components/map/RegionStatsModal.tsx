/**
 * RegionStatsModal - Modal for displaying region rainbow statistics
 *
 * Displays detailed statistics about rainbow sightings in a specific region,
 * including peak hours, seasonal trends, and typical weather conditions.
 *
 * Accessibility features (WCAG 2.1 AA):
 * - Clear accessibility labels for all interactive elements
 * - Screen reader support for charts and data
 * - Minimum touch target size 44x44pt
 * - Focus trap within modal
 *
 * Requirements: FR-13 (AC-13.6)
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
  ScrollView,
  ActivityIndicator,
  AccessibilityInfo,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { BarChart } from 'react-native-chart-kit';

import {
  accessibleColors,
  MIN_TOUCH_TARGET_SIZE,
  createScreenReaderAnnouncement,
} from '../../utils/accessibility';
import { Button } from '../ui/Button';

import type { RegionStats } from '../../services/mapService';

// ============================================
// Types
// ============================================

interface RegionStatsModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Region statistics data */
  stats: RegionStats | null;
  /** Loading state */
  loading?: boolean;
  /** Error message */
  error?: string | null;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when user wants to view last sighting photo */
  onViewPhoto?: (photoId: string) => void;
  /** Callback to retry loading */
  onRetry?: () => void;
}

// ============================================
// Constants
// ============================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MODAL_WIDTH = Math.min(SCREEN_WIDTH - 32, 400);
const CHART_WIDTH = MODAL_WIDTH - 48;

/**
 * Month names in Japanese
 */
const MONTH_NAMES = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
];

/**
 * Chart configuration
 */
const CHART_CONFIG = {
  backgroundColor: '#FFFFFF',
  backgroundGradientFrom: '#FFFFFF',
  backgroundGradientTo: '#FFFFFF',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(61, 122, 140, ${opacity})`,
  labelColor: () => accessibleColors.textSecondary,
  propsForBackgroundLines: {
    strokeDasharray: '',
    stroke: '#E0E0E0',
  },
  propsForLabels: {
    fontSize: 10,
  },
};

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

/**
 * Get weather condition display name in Japanese
 */
const getWeatherConditionName = (condition: string): string => {
  const conditionMap: Record<string, string> = {
    sunny: '晴れ',
    cloudy: '曇り',
    rainy: '雨',
    partly_cloudy: '曇りがち',
    light_rain: '小雨',
    shower: 'にわか雨',
  };
  return conditionMap[condition] || condition;
};

/**
 * Format hour for display (e.g., "14:00")
 */
const formatHour = (hour: number): string => {
  return `${hour.toString().padStart(2, '0')}:00`;
};

// ============================================
// Sub Components
// ============================================

interface StatCardProps {
  title: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  accessibilityLabel,
}) => (
  <View
    style={styles.statCard}
    accessible={true}
    accessibilityLabel={accessibilityLabel}
  >
    <Ionicons name={icon} size={24} color={accessibleColors.primary} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statTitle}>{title}</Text>
  </View>
);

// ============================================
// Component
// ============================================

export const RegionStatsModal: React.FC<RegionStatsModalProps> = ({
  visible,
  stats,
  loading = false,
  error = null,
  onClose,
  onViewPhoto,
  onRetry,
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
        stats
          ? `${stats.regionName}の虹の統計を表示中`
          : '地域の統計を読み込み中'
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
  }, [visible, fadeAnim, slideAnim, stats]);

  /**
   * Handle view photo button press
   */
  const handleViewPhoto = useCallback(() => {
    if (stats?.lastSighting?.photoId && onViewPhoto) {
      onViewPhoto(stats.lastSighting.photoId);
    }
  }, [stats, onViewPhoto]);

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

  /**
   * Prepare peak hours chart data
   */
  const peakHoursChartData = stats
    ? {
        labels: stats.peakHours.slice(0, 6).map((p) => `${p.hour}時`),
        datasets: [
          {
            data: stats.peakHours.slice(0, 6).map((p) => p.count),
          },
        ],
      }
    : null;

  /**
   * Prepare monthly chart data
   */
  const monthlyChartData = stats
    ? {
        labels: stats.peakMonths.map((p) => MONTH_NAMES[p.month - 1]),
        datasets: [
          {
            data: stats.peakMonths.map((p) => p.count),
          },
        ],
      }
    : null;

  /**
   * Render loading state
   */
  const renderLoading = () => (
    <View
      style={styles.loadingContainer}
      accessible={true}
      accessibilityRole="progressbar"
      accessibilityLabel="統計データを読み込み中"
    >
      <ActivityIndicator size="large" color={accessibleColors.primary} />
      <Text style={styles.loadingText}>統計データを読み込み中...</Text>
    </View>
  );

  /**
   * Render error state
   */
  const renderError = () => (
    <View
      style={styles.errorContainer}
      accessible={true}
      accessibilityRole="alert"
      accessibilityLabel={error || 'エラーが発生しました'}
    >
      <Ionicons
        name="alert-circle-outline"
        size={48}
        color={accessibleColors.error}
      />
      <Text style={styles.errorText}>
        {error || '統計データの取得に失敗しました'}
      </Text>
      {onRetry && (
        <Button
          title="再試行"
          onPress={onRetry}
          variant="outline"
          size="medium"
          icon="refresh"
          accessibilityLabel="再試行"
          accessibilityHint="統計データの取得を再試行します"
        />
      )}
    </View>
  );

  /**
   * Render stats content
   */
  const renderContent = () => {
    if (!stats) return null;

    const contentAccessibilityLabel = createScreenReaderAnnouncement(
      stats.regionName,
      `合計${stats.totalSightings}回の虹の目撃`,
      `月平均${stats.averageSightingsPerMonth.toFixed(1)}回`
    );

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        accessible={false}
      >
        {/* Header */}
        <View
          style={styles.header}
          accessible={true}
          accessibilityLabel={contentAccessibilityLabel}
        >
          <Text style={styles.regionName}>{stats.regionName}</Text>
          <Text style={styles.regionSubtitle}>の虹の出現傾向</Text>
        </View>

        {/* Summary Stats */}
        <View style={styles.statsRow}>
          <StatCard
            title="合計"
            value={stats.totalSightings}
            icon="sunny-outline"
            accessibilityLabel={`合計${stats.totalSightings}回の虹の目撃`}
          />
          <StatCard
            title="月平均"
            value={stats.averageSightingsPerMonth.toFixed(1)}
            icon="calendar-outline"
            accessibilityLabel={`月平均${stats.averageSightingsPerMonth.toFixed(1)}回`}
          />
        </View>

        {/* Peak Hours Chart */}
        <View style={styles.chartSection}>
          <Text
            style={styles.sectionTitle}
            accessibilityRole="header"
          >
            出現しやすい時間帯
          </Text>
          {peakHoursChartData && peakHoursChartData.datasets[0].data.length > 0 && (
            <View
              accessible={true}
              accessibilityLabel={`最も多い時間帯: ${formatHour(stats.peakHours[0]?.hour ?? 0)}に${stats.peakHours[0]?.count ?? 0}回`}
            >
              <BarChart
                data={peakHoursChartData}
                width={CHART_WIDTH}
                height={160}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={CHART_CONFIG}
                style={styles.chart}
                fromZero={true}
                showValuesOnTopOfBars={true}
              />
            </View>
          )}
        </View>

        {/* Monthly Trends Chart */}
        <View style={styles.chartSection}>
          <Text
            style={styles.sectionTitle}
            accessibilityRole="header"
          >
            季節傾向
          </Text>
          {monthlyChartData && monthlyChartData.datasets[0].data.length > 0 && (
            <View
              accessible={true}
              accessibilityLabel={`最も多い月: ${MONTH_NAMES[(stats.peakMonths[0]?.month ?? 1) - 1]}に${stats.peakMonths[0]?.count ?? 0}回`}
            >
              <BarChart
                data={monthlyChartData}
                width={CHART_WIDTH}
                height={160}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={CHART_CONFIG}
                style={styles.chart}
                fromZero={true}
                showValuesOnTopOfBars={true}
              />
            </View>
          )}
        </View>

        {/* Weather Conditions */}
        <View style={styles.weatherSection}>
          <Text
            style={styles.sectionTitle}
            accessibilityRole="header"
          >
            典型的な気象条件
          </Text>
          <View style={styles.weatherGrid}>
            {/* Temperature */}
            <View
              style={styles.weatherItem}
              accessible={true}
              accessibilityLabel={`気温: ${stats.typicalWeather.temperature.min}度から${stats.typicalWeather.temperature.max}度、平均${stats.typicalWeather.temperature.avg}度`}
            >
              <Ionicons
                name="thermometer-outline"
                size={20}
                color={accessibleColors.primary}
              />
              <Text style={styles.weatherLabel}>気温</Text>
              <Text style={styles.weatherValue}>
                {stats.typicalWeather.temperature.min}-{stats.typicalWeather.temperature.avg}-{stats.typicalWeather.temperature.max}度
              </Text>
            </View>

            {/* Humidity */}
            <View
              style={styles.weatherItem}
              accessible={true}
              accessibilityLabel={`湿度: ${stats.typicalWeather.humidity.min}%から${stats.typicalWeather.humidity.max}%、平均${stats.typicalWeather.humidity.avg}%`}
            >
              <Ionicons
                name="water-outline"
                size={20}
                color={accessibleColors.primary}
              />
              <Text style={styles.weatherLabel}>湿度</Text>
              <Text style={styles.weatherValue}>
                {stats.typicalWeather.humidity.min}-{stats.typicalWeather.humidity.avg}-{stats.typicalWeather.humidity.max}%
              </Text>
            </View>
          </View>

          {/* Weather Conditions List */}
          {stats.typicalWeather.conditions.length > 0 && (
            <View style={styles.conditionsList}>
              <Text style={styles.conditionsLabel}>よく見られる天気:</Text>
              <View style={styles.conditionsChips}>
                {stats.typicalWeather.conditions.slice(0, 4).map((c, index) => (
                  <View
                    key={index}
                    style={styles.conditionChip}
                    accessible={true}
                    accessibilityLabel={`${getWeatherConditionName(c.condition)}: ${c.count}回`}
                  >
                    <Text style={styles.conditionChipText}>
                      {getWeatherConditionName(c.condition)} ({c.count})
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Last Sighting */}
        {stats.lastSighting && (
          <View style={styles.lastSightingSection}>
            <Text
              style={styles.sectionTitle}
              accessibilityRole="header"
            >
              最新の目撃
            </Text>
            <View
              style={styles.lastSightingContent}
              accessible={true}
              accessibilityLabel={`最新の目撃: ${formatDate(stats.lastSighting.date)}`}
            >
              <View style={styles.lastSightingInfo}>
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={accessibleColors.textMuted}
                />
                <Text style={styles.lastSightingDate}>
                  {formatDate(stats.lastSighting.date)}
                </Text>
              </View>
              {onViewPhoto && (
                <Button
                  title="写真を見る"
                  onPress={handleViewPhoto}
                  variant="outline"
                  size="small"
                  icon="image-outline"
                  accessibilityLabel="最新の虹の写真を見る"
                  accessibilityHint="写真の詳細画面に移動します"
                />
              )}
            </View>
          </View>
        )}
      </ScrollView>
    );
  };

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
      accessibilityLabel="地域の虹の統計"
    >
      <TouchableWithoutFeedback
        onPress={handleBackdropPress}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="閉じる"
        accessibilityHint="モーダルを閉じます"
      >
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.modalContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              {/* Close Button */}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClosePress}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="閉じる"
                accessibilityHint="統計モーダルを閉じます"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                testID="region-stats-close-button"
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={accessibleColors.textSecondary}
                />
              </TouchableOpacity>

              {/* Content */}
              {loading && renderLoading()}
              {!loading && error && renderError()}
              {!loading && !error && renderContent()}
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
    maxHeight: '85%',
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 40,
  },

  // Header
  header: {
    marginBottom: 20,
  },
  regionName: {
    fontSize: 22,
    fontWeight: '700',
    color: accessibleColors.textPrimary,
  },
  regionSubtitle: {
    fontSize: 16,
    color: accessibleColors.textSecondary,
    marginTop: 4,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  statCard: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    minWidth: 100,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: accessibleColors.textPrimary,
    marginTop: 8,
  },
  statTitle: {
    fontSize: 12,
    color: accessibleColors.textSecondary,
    marginTop: 4,
  },

  // Chart Section
  chartSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: accessibleColors.textPrimary,
    marginBottom: 12,
  },
  chart: {
    borderRadius: 8,
    marginLeft: -16,
  },

  // Weather Section
  weatherSection: {
    marginBottom: 24,
  },
  weatherGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  weatherItem: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    minWidth: 120,
  },
  weatherLabel: {
    fontSize: 12,
    color: accessibleColors.textSecondary,
    marginTop: 4,
  },
  weatherValue: {
    fontSize: 14,
    fontWeight: '600',
    color: accessibleColors.textPrimary,
    marginTop: 4,
  },
  conditionsList: {
    marginTop: 8,
  },
  conditionsLabel: {
    fontSize: 14,
    color: accessibleColors.textSecondary,
    marginBottom: 8,
  },
  conditionsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  conditionChip: {
    backgroundColor: '#E8F4F8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  conditionChipText: {
    fontSize: 13,
    color: accessibleColors.primary,
  },

  // Last Sighting
  lastSightingSection: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 16,
  },
  lastSightingContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastSightingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastSightingDate: {
    fontSize: 14,
    color: accessibleColors.textSecondary,
    marginLeft: 8,
  },

  // Loading
  loadingContainer: {
    padding: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: accessibleColors.textSecondary,
  },

  // Error
  errorContainer: {
    padding: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: accessibleColors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
});

export default RegionStatsModal;
