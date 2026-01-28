/**
 * WeatherChart - Time-series chart for weather data visualization
 *
 * Displays weather metrics (temperature, humidity, pressure, wind speed)
 * using react-native-chart-kit for line charts.
 *
 * Accessibility features (WCAG 2.1 AA):
 * - accessibilityLabel for chart description
 * - Data summary for screen readers
 * - High contrast colors for visibility
 *
 * Requirements: FR-13 (AC-13.4)
 */

import React, { useMemo } from 'react';

import { StyleSheet, Text, View, Dimensions, ScrollView } from 'react-native';

import { LineChart } from 'react-native-chart-kit';

import { accessibleColors } from '../../utils/accessibility';

import type { WeatherCondition } from '../../types/photo';

type MetricType = 'temperature' | 'humidity' | 'pressure' | 'windSpeed';

interface WeatherChartProps {
  /** Weather condition data array */
  weatherConditions: WeatherCondition[];
  /** Metric to display */
  metric: MetricType;
  /** Optional title override */
  title?: string;
  /** Test ID for testing */
  testID?: string;
}

interface MetricConfig {
  label: string;
  unit: string;
  accessor: (condition: WeatherCondition) => number | undefined;
  color: string;
  decimalDigits: number;
  accessibilityDescription: string;
}

const METRIC_CONFIGS: Record<MetricType, MetricConfig> = {
  temperature: {
    label: '気温',
    unit: '\u00B0C',
    accessor: (c) => c.temperature,
    color: '#E53E3E', // Red for temperature
    decimalDigits: 1,
    accessibilityDescription: '気温の時系列変化を示すグラフ',
  },
  humidity: {
    label: '湿度',
    unit: '%',
    accessor: (c) => c.humidity,
    color: '#3182CE', // Blue for humidity
    decimalDigits: 0,
    accessibilityDescription: '湿度の時系列変化を示すグラフ',
  },
  pressure: {
    label: '気圧',
    unit: 'hPa',
    accessor: (c) => c.pressure,
    color: '#805AD5', // Purple for pressure
    decimalDigits: 0,
    accessibilityDescription: '気圧の時系列変化を示すグラフ',
  },
  windSpeed: {
    label: '風速',
    unit: 'm/s',
    accessor: (c) => c.windSpeed,
    color: '#38A169', // Green for wind
    decimalDigits: 1,
    accessibilityDescription: '風速の時系列変化を示すグラフ',
  },
};

const screenWidth = Dimensions.get('window').width;

/**
 * Format timestamp for chart labels
 */
const formatTimeLabel = (timestamp: string): string => {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

/**
 * Create accessibility summary for weather data
 */
const createDataSummary = (
  data: number[],
  config: MetricConfig
): string => {
  if (data.length === 0) return 'データなし';

  const min = Math.min(...data);
  const max = Math.max(...data);
  const avg = data.reduce((a, b) => a + b, 0) / data.length;

  return `${config.label}は最低${min.toFixed(config.decimalDigits)}${config.unit}、` +
    `最高${max.toFixed(config.decimalDigits)}${config.unit}、` +
    `平均${avg.toFixed(config.decimalDigits)}${config.unit}です`;
};

export const WeatherChart: React.FC<WeatherChartProps> = ({
  weatherConditions,
  metric,
  title,
  testID,
}) => {
  const config = METRIC_CONFIGS[metric];

  const chartData = useMemo(() => {
    if (!weatherConditions || weatherConditions.length === 0) {
      return null;
    }

    // Sort by timestamp
    const sorted = [...weatherConditions].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Extract labels and data (filter out entries with undefined values)
    const validEntries = sorted.filter((c) => config.accessor(c) !== undefined);
    const labels = validEntries.map((c) => formatTimeLabel(c.timestamp));
    const data = validEntries.map((c) => config.accessor(c) ?? 0);

    // Limit labels for readability (show every nth label)
    const labelInterval = Math.max(1, Math.floor(labels.length / 5));
    const displayLabels = labels.map((label, index) =>
      index % labelInterval === 0 ? label : ''
    );

    return {
      labels: displayLabels,
      datasets: [
        {
          data,
          color: () => config.color,
          strokeWidth: 2,
        },
      ],
      legend: [config.label],
    };
  }, [weatherConditions, config]);

  const accessibilitySummary = useMemo(() => {
    if (!chartData) return 'データがありません';
    const data = chartData.datasets[0].data;
    return createDataSummary(data, config);
  }, [chartData, config]);

  if (!chartData || chartData.datasets[0].data.length === 0) {
    return (
      <View
        style={styles.container}
        accessible={true}
        accessibilityLabel={`${config.label}のデータがありません`}
        testID={testID}
      >
        <Text style={styles.title}>{title || config.label}</Text>
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>データがありません</Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityLabel={`${title || config.label}のグラフ。${accessibilitySummary}`}
      accessibilityRole="image"
      testID={testID}
    >
      <Text style={styles.title}>{title || config.label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <LineChart
          data={chartData}
          width={Math.max(screenWidth - 40, chartData.labels.length * 50)}
          height={200}
          chartConfig={{
            backgroundColor: '#FFFFFF',
            backgroundGradientFrom: '#FFFFFF',
            backgroundGradientTo: '#F5F5F5',
            decimalPlaces: config.decimalDigits,
            color: () => config.color,
            labelColor: () => accessibleColors.textSecondary,
            style: {
              borderRadius: 8,
            },
            propsForDots: {
              r: '4',
              strokeWidth: '2',
              stroke: config.color,
            },
            propsForBackgroundLines: {
              strokeDasharray: '',
              stroke: '#E0E0E0',
            },
          }}
          bezier
          style={styles.chart}
          withInnerLines={true}
          withOuterLines={true}
          withVerticalLabels={true}
          withHorizontalLabels={true}
          fromZero={false}
          yAxisSuffix={config.unit}
        />
      </ScrollView>

      {/* Data summary for visual users */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>最低</Text>
          <Text style={styles.summaryValue}>
            {Math.min(...chartData.datasets[0].data).toFixed(config.decimalDigits)}
            {config.unit}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>最高</Text>
          <Text style={styles.summaryValue}>
            {Math.max(...chartData.datasets[0].data).toFixed(config.decimalDigits)}
            {config.unit}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>平均</Text>
          <Text style={styles.summaryValue}>
            {(
              chartData.datasets[0].data.reduce((a, b) => a + b, 0) /
              chartData.datasets[0].data.length
            ).toFixed(config.decimalDigits)}
            {config.unit}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: accessibleColors.textPrimary,
    marginBottom: 12,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 8,
  },
  noDataContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  noDataText: {
    fontSize: 14,
    color: accessibleColors.textSecondary,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: accessibleColors.textSecondary,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: accessibleColors.textPrimary,
  },
});
