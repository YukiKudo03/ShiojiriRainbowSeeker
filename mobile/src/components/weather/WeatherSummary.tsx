/**
 * WeatherSummary - Weather data summary card component
 *
 * Displays a grid of current weather metrics with icons and values.
 * Shows "N/A" for missing data and supports tap to expand.
 *
 * Accessibility features (WCAG 2.1 AA):
 * - accessibilityLabel for each metric
 * - High contrast text colors
 * - Minimum touch target sizes
 *
 * Requirements: FR-13 (AC-13.3)
 */

import React, { useMemo } from 'react';

import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {
  accessibleColors,
  MIN_TOUCH_TARGET_SIZE,
} from '../../utils/accessibility';

import type { WeatherCondition } from '../../types/photo';

interface WeatherSummaryProps {
  /** Weather condition data (uses the first entry for summary) */
  weatherCondition?: WeatherCondition;
  /** Callback when user taps to see details */
  onShowDetails?: () => void;
  /** Test ID for testing */
  testID?: string;
}

interface MetricItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string | number | undefined;
  unit: string;
  accessibilityLabel: string;
}

/**
 * Format wind direction degrees to cardinal direction
 */
const formatWindDirection = (degrees: number): string => {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
};

/**
 * Get weather metrics from condition data
 */
const getMetrics = (condition?: WeatherCondition): MetricItem[] => {
  if (!condition) {
    return [
      {
        key: 'temperature',
        label: '気温',
        icon: 'thermometer-outline',
        value: undefined,
        unit: '\u00B0C',
        accessibilityLabel: '気温: データなし',
      },
      {
        key: 'humidity',
        label: '湿度',
        icon: 'water-outline',
        value: undefined,
        unit: '%',
        accessibilityLabel: '湿度: データなし',
      },
      {
        key: 'pressure',
        label: '気圧',
        icon: 'speedometer-outline',
        value: undefined,
        unit: 'hPa',
        accessibilityLabel: '気圧: データなし',
      },
      {
        key: 'windSpeed',
        label: '風速',
        icon: 'flag-outline',
        value: undefined,
        unit: 'm/s',
        accessibilityLabel: '風速: データなし',
      },
      {
        key: 'cloudCover',
        label: '雲量',
        icon: 'cloud-outline',
        value: undefined,
        unit: '%',
        accessibilityLabel: '雲量: データなし',
      },
      {
        key: 'visibility',
        label: '視程',
        icon: 'eye-outline',
        value: undefined,
        unit: 'km',
        accessibilityLabel: '視程: データなし',
      },
    ];
  }

  return [
    {
      key: 'temperature',
      label: '気温',
      icon: 'thermometer-outline',
      value: condition.temperature?.toFixed(1),
      unit: '\u00B0C',
      accessibilityLabel: condition.temperature !== undefined
        ? `気温: ${condition.temperature.toFixed(1)}度`
        : '気温: データなし',
    },
    {
      key: 'humidity',
      label: '湿度',
      icon: 'water-outline',
      value: condition.humidity,
      unit: '%',
      accessibilityLabel: condition.humidity !== undefined
        ? `湿度: ${condition.humidity}パーセント`
        : '湿度: データなし',
    },
    {
      key: 'pressure',
      label: '気圧',
      icon: 'speedometer-outline',
      value: condition.pressure,
      unit: 'hPa',
      accessibilityLabel: condition.pressure !== undefined
        ? `気圧: ${condition.pressure}ヘクトパスカル`
        : '気圧: データなし',
    },
    {
      key: 'windSpeed',
      label: '風速',
      icon: 'flag-outline',
      value: condition.windSpeed !== undefined
        ? `${condition.windSpeed.toFixed(1)}${condition.windDirection !== undefined ? ` ${formatWindDirection(condition.windDirection)}` : ''}`
        : undefined,
      unit: 'm/s',
      accessibilityLabel: condition.windSpeed !== undefined
        ? `風速: ${condition.windSpeed.toFixed(1)}メートル毎秒${condition.windDirection !== undefined ? `、${formatWindDirection(condition.windDirection)}方向` : ''}`
        : '風速: データなし',
    },
    {
      key: 'cloudCover',
      label: '雲量',
      icon: 'cloud-outline',
      value: condition.cloudCover,
      unit: '%',
      accessibilityLabel: condition.cloudCover !== undefined
        ? `雲量: ${condition.cloudCover}パーセント`
        : '雲量: データなし',
    },
    {
      key: 'visibility',
      label: '視程',
      icon: 'eye-outline',
      value: condition.visibility !== undefined
        ? (condition.visibility / 1000).toFixed(1)
        : undefined,
      unit: 'km',
      accessibilityLabel: condition.visibility !== undefined
        ? `視程: ${(condition.visibility / 1000).toFixed(1)}キロメートル`
        : '視程: データなし',
    },
  ];
};

export const WeatherSummary: React.FC<WeatherSummaryProps> = ({
  weatherCondition,
  onShowDetails,
  testID,
}) => {
  const metrics = useMemo(
    () => getMetrics(weatherCondition),
    [weatherCondition]
  );

  const hasData = weatherCondition !== undefined;

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityLabel={
        hasData
          ? '気象条件サマリー。詳細を表示するにはボタンをタップしてください'
          : '気象条件データがありません'
      }
      accessibilityRole="summary"
      testID={testID}
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Ionicons
            name="partly-sunny-outline"
            size={20}
            color={accessibleColors.primary}
          />
          <Text style={styles.title}>気象条件</Text>
        </View>
        {onShowDetails && hasData && (
          <TouchableOpacity
            style={styles.detailButton}
            onPress={onShowDetails}
            accessible={true}
            accessibilityLabel="気象条件詳細を表示"
            accessibilityHint="時系列グラフと詳細データを表示します"
            accessibilityRole="button"
          >
            <Text style={styles.detailButtonText}>詳細を見る</Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={accessibleColors.primary}
            />
          </TouchableOpacity>
        )}
      </View>

      {!hasData ? (
        <View style={styles.noDataContainer}>
          <Ionicons
            name="cloud-offline-outline"
            size={32}
            color={accessibleColors.textMuted}
          />
          <Text style={styles.noDataText}>気象データがありません</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {metrics.map((metric) => (
            <View
              key={metric.key}
              style={styles.metricItem}
              accessible={true}
              accessibilityLabel={metric.accessibilityLabel}
            >
              <Ionicons
                name={metric.icon}
                size={20}
                color={accessibleColors.primary}
                style={styles.metricIcon}
              />
              <Text style={styles.metricLabel}>{metric.label}</Text>
              <Text style={styles.metricValue}>
                {metric.value !== undefined ? (
                  <>
                    {metric.value}
                    <Text style={styles.metricUnit}>{metric.unit}</Text>
                  </>
                ) : (
                  <Text style={styles.metricNA}>N/A</Text>
                )}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Additional weather info if available */}
      {hasData && (
        <View style={styles.additionalInfo}>
          {weatherCondition?.precipitation !== undefined &&
            weatherCondition.precipitation > 0 && (
              <View
                style={styles.infoItem}
                accessible={true}
                accessibilityLabel={`降水量: ${weatherCondition.precipitation}ミリメートル`}
              >
                <Ionicons
                  name="rainy-outline"
                  size={16}
                  color={accessibleColors.primary}
                />
                <Text style={styles.infoText}>
                  降水量: {weatherCondition.precipitation}mm
                </Text>
              </View>
            )}
          {/* UV index not currently available from backend */}
        </View>
      )}
    </View>
  );
};

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
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: MIN_TOUCH_TARGET_SIZE,
    backgroundColor: '#E8F4F8',
    borderRadius: 20,
  },
  detailButtonText: {
    fontSize: 14,
    color: accessibleColors.primary,
    fontWeight: '500',
    marginRight: 4,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  metricItem: {
    width: '33.33%',
    padding: 4,
    alignItems: 'center',
    marginBottom: 12,
  },
  metricIcon: {
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: accessibleColors.textSecondary,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: accessibleColors.textPrimary,
  },
  metricUnit: {
    fontSize: 12,
    fontWeight: '400',
    color: accessibleColors.textSecondary,
  },
  metricNA: {
    fontSize: 14,
    color: accessibleColors.textMuted,
    fontStyle: 'italic',
  },
  additionalInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 14,
    color: accessibleColors.textSecondary,
    marginLeft: 6,
  },
});
