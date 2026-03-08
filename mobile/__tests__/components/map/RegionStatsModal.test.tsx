/**
 * Component Tests for RegionStatsModal
 *
 * Tests statistics display, loading state, error state, and close action.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('date-fns', () => ({
  format: (date: any, fmt: string) => '2026年3月1日',
}));

jest.mock('date-fns/locale', () => ({
  ja: {},
}));

jest.mock('../../../src/utils/accessibility', () => ({
  MIN_TOUCH_TARGET_SIZE: 44,
  formatNumberForScreenReader: (n: number) => n.toString(),
  createScreenReaderAnnouncement: (...parts: string[]) => parts.filter(Boolean).join(', '),
  accessibleColors: {
    primary: '#3D7A8C',
    primaryDark: '#2C5A68',
    textPrimary: '#1F1F1F',
    textSecondary: '#5C5C5C',
    textMuted: '#6B6B6B',
    error: '#C53030',
    warning: '#B45309',
    success: '#276749',
    backgroundLight: '#FFFFFF',
    backgroundMuted: '#F5F5F5',
    link: '#2563EB',
  },
}));

jest.mock('react-native-chart-kit', () => ({
  BarChart: (props: any) => {
    const { View } = require('react-native');
    return <View testID="bar-chart" {...props} />;
  },
}));

jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
}));

jest.mock('../../../src/components/ui/Button', () => ({
  Button: (props: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity
        testID={props.testID}
        onPress={props.onPress}
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel || props.title}
      >
        <Text>{props.title}</Text>
      </TouchableOpacity>
    );
  },
}));

import { RegionStatsModal } from '../../../src/components/map/RegionStatsModal';

describe('RegionStatsModal', () => {
  const mockStats = {
    regionId: 'region-1',
    regionName: '塩尻市',
    totalSightings: 142,
    averageSightingsPerMonth: 12,
    peakHours: [
      { hour: 16, count: 35 },
      { hour: 17, count: 42 },
      { hour: 18, count: 28 },
    ],
    peakMonths: [
      { month: 1, count: 10 },
      { month: 7, count: 45 },
      { month: 8, count: 38 },
    ],
    typicalWeather: {
      temperature: { min: 10, max: 30, avg: 20 },
      humidity: { min: 40, max: 80, avg: 60 },
      conditions: [
        { condition: 'sunny', count: 60 },
        { condition: 'cloudy', count: 30 },
      ],
    },
    lastSighting: {
      date: '2026-03-01T17:30:00Z',
      photoId: 'photo-123',
    },
  };

  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    stats: mockStats as any,
    loading: false,
    error: null as string | null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    expect(() => render(<RegionStatsModal {...defaultProps} />)).not.toThrow();
  });

  it('renders component tree', () => {
    const { toJSON } = render(<RegionStatsModal {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows loading state', () => {
    const { getByText } = render(
      <RegionStatsModal {...defaultProps} loading={true} stats={null as any} />
    );
    expect(getByText('統計データを読み込み中...')).toBeTruthy();
  });

  it('does not crash when visible is false', () => {
    expect(() =>
      render(<RegionStatsModal {...defaultProps} visible={false} />)
    ).not.toThrow();
  });

  it('renders total sightings value', () => {
    const { getByText } = render(<RegionStatsModal {...defaultProps} />);
    expect(getByText('142')).toBeTruthy();
  });

  it('renders error state with message', () => {
    const { getByText } = render(
      <RegionStatsModal
        {...defaultProps}
        stats={null as any}
        error="統計データの取得に失敗しました"
      />
    );
    expect(getByText('統計データの取得に失敗しました')).toBeTruthy();
  });

  it('shows retry button when onRetry is provided', () => {
    const onRetry = jest.fn();
    const { getByText } = render(
      <RegionStatsModal
        {...defaultProps}
        stats={null as any}
        error="Error"
        onRetry={onRetry}
      />
    );
    expect(getByText('再試行')).toBeTruthy();
    fireEvent.press(getByText('再試行'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('calls onClose when close button is pressed', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <RegionStatsModal {...defaultProps} onClose={onClose} />
    );
    fireEvent.press(getByTestId('region-stats-close-button'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders region name', () => {
    const { getByText } = render(<RegionStatsModal {...defaultProps} />);
    expect(getByText('塩尻市')).toBeTruthy();
  });

  it('renders section titles', () => {
    const { getByText } = render(<RegionStatsModal {...defaultProps} />);
    expect(getByText('出現しやすい時間帯')).toBeTruthy();
    expect(getByText('季節傾向')).toBeTruthy();
    expect(getByText('典型的な気象条件')).toBeTruthy();
  });

  it('renders weather conditions', () => {
    const { getByText } = render(<RegionStatsModal {...defaultProps} />);
    expect(getByText('よく見られる天気:')).toBeTruthy();
  });

  it('renders last sighting section', () => {
    const { getByText } = render(<RegionStatsModal {...defaultProps} />);
    expect(getByText('最新の目撃')).toBeTruthy();
  });

  it('renders view photo button when onViewPhoto provided', () => {
    const onViewPhoto = jest.fn();
    const { getByText } = render(
      <RegionStatsModal {...defaultProps} onViewPhoto={onViewPhoto} />
    );
    expect(getByText('写真を見る')).toBeTruthy();
    fireEvent.press(getByText('写真を見る'));
    expect(onViewPhoto).toHaveBeenCalledWith('photo-123');
  });

  it('renders bar charts for peak hours and monthly trends', () => {
    const { getAllByTestId } = render(<RegionStatsModal {...defaultProps} />);
    expect(getAllByTestId('bar-chart').length).toBe(2);
  });

  it('renders null content when stats is null and not loading/error', () => {
    const { toJSON } = render(
      <RegionStatsModal {...defaultProps} stats={null as any} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('handles invalid date string in formatDate', () => {
    const statsInvalidDate = {
      ...mockStats,
      lastSighting: { date: 'invalid-date', photoId: 'p1' },
    };
    expect(() =>
      render(<RegionStatsModal {...defaultProps} stats={statsInvalidDate as any} />)
    ).not.toThrow();
  });
});
