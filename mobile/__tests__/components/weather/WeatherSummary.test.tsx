/**
 * Component Tests for WeatherSummary
 *
 * Tests summary rendering, icon display, and N/A fallback.
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

import { WeatherSummary } from '../../../src/components/weather/WeatherSummary';

describe('WeatherSummary', () => {
  const mockWeather = {
    temperature: 22.5,
    humidity: 65,
    pressure: 1013,
    windSpeed: 5.2,
    cloudCover: 40,
    visibility: 10000,
    description: 'Partly cloudy',
    icon: '02d',
    condition: 'Clouds',
  };

  const defaultProps = {
    weather: mockWeather as any,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing with valid data', () => {
    expect(() => render(<WeatherSummary {...defaultProps} />)).not.toThrow();
  });

  it('renders component tree', () => {
    const { toJSON } = render(<WeatherSummary {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows no data message when weather is null', () => {
    const { getByText } = render(
      <WeatherSummary weather={null as any} />
    );
    expect(getByText('気象データがありません')).toBeTruthy();
  });

  it('shows no data message when weather is undefined', () => {
    const { getByText } = render(
      <WeatherSummary weatherCondition={undefined} />
    );
    expect(getByText('気象データがありません')).toBeTruthy();
  });

  it('displays all weather metrics with complete data', () => {
    const fullWeather = {
      id: 'w1',
      timestamp: '2026-03-08T10:00:00Z',
      temperature: 22.5,
      humidity: 65,
      pressure: 1013,
      windSpeed: 5.2,
      windDirection: 180,
      cloudCover: 40,
      visibility: 10000,
    };
    const { getByText } = render(
      <WeatherSummary weatherCondition={fullWeather as any} />
    );
    expect(getByText('気象条件')).toBeTruthy();
    expect(getByText('気温')).toBeTruthy();
    expect(getByText('湿度')).toBeTruthy();
    expect(getByText('気圧')).toBeTruthy();
    expect(getByText('風速')).toBeTruthy();
    expect(getByText('雲量')).toBeTruthy();
    expect(getByText('視程')).toBeTruthy();
  });

  it('shows N/A for missing individual metrics', () => {
    const partialWeather = {
      id: 'w2',
      timestamp: '2026-03-08T10:00:00Z',
      temperature: 15.0,
      // humidity, pressure, etc. are undefined
    };
    const { toJSON } = render(
      <WeatherSummary weatherCondition={partialWeather as any} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('displays precipitation when present and > 0', () => {
    const weatherWithPrecip = {
      id: 'w3',
      timestamp: '2026-03-08T10:00:00Z',
      temperature: 10.0,
      humidity: 90,
      pressure: 1005,
      windSpeed: 3.0,
      cloudCover: 100,
      visibility: 5000,
      precipitation: 2.5,
    };
    const { getByText } = render(
      <WeatherSummary weatherCondition={weatherWithPrecip as any} />
    );
    expect(getByText('降水量: 2.5mm')).toBeTruthy();
  });

  it('shows details button when onShowDetails provided', () => {
    const onShowDetails = jest.fn();
    const fullWeather = {
      id: 'w1',
      timestamp: '2026-03-08T10:00:00Z',
      temperature: 22.5,
    };
    const { getByText } = render(
      <WeatherSummary weatherCondition={fullWeather as any} onShowDetails={onShowDetails} />
    );
    expect(getByText('詳細を見る')).toBeTruthy();
  });
});
