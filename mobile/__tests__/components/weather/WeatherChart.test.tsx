/**
 * Component Tests for WeatherChart
 *
 * Tests chart rendering, data transformation, and empty state.
 */

import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('../../../src/utils/accessibility', () => ({
  MIN_TOUCH_TARGET_SIZE: 44,
  formatNumberForScreenReader: (n: number) => n.toString(),
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
  LineChart: (props: any) => {
    const { View } = require('react-native');
    return <View testID="line-chart" {...props} />;
  },
}));

jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
}));

import { WeatherChart } from '../../../src/components/weather/WeatherChart';

describe('WeatherChart', () => {
  const mockWeatherConditions = [
    {
      id: 'wc1',
      observedAt: '2026-03-01T12:00:00Z',
      temperature: 22.5,
      humidity: 65,
      pressure: 1013,
      windSpeed: 5.2,
    },
    {
      id: 'wc2',
      observedAt: '2026-03-01T13:00:00Z',
      temperature: 23.0,
      humidity: 60,
      pressure: 1012,
      windSpeed: 4.8,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing with data', () => {
    expect(() =>
      render(
        <WeatherChart
          weatherConditions={mockWeatherConditions as any}
          metric="temperature"
        />
      )
    ).not.toThrow();
  });

  it('renders component tree', () => {
    const { toJSON } = render(
      <WeatherChart
        weatherConditions={mockWeatherConditions as any}
        metric="temperature"
      />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('shows no data message when empty', () => {
    const { getByText } = render(
      <WeatherChart weatherConditions={[]} metric="temperature" />
    );
    expect(getByText('データがありません')).toBeTruthy();
  });

  it('renders with different metrics', () => {
    expect(() =>
      render(
        <WeatherChart
          weatherConditions={mockWeatherConditions as any}
          metric="humidity"
        />
      )
    ).not.toThrow();
  });
});
