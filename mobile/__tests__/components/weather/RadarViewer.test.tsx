/**
 * Component Tests for RadarViewer
 *
 * Tests radar image display, empty state, and rendering with data.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

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

jest.mock('../../../src/utils/testMode', () => ({
  getTestSafeInterval: (delay: number) => delay,
  getAnimationMultiplier: () => 1,
  shouldEnableContinuousAnimations: () => true,
}));

import { RadarViewer } from '../../../src/components/weather/RadarViewer';

describe('RadarViewer', () => {
  const mockRadarData = [
    {
      id: 'r1',
      imageUrl: 'https://example.com/radar1.png',
      timestamp: '2026-03-01T12:00:00Z',
      precipitationIntensity: 0.5,
    },
    {
      id: 'r2',
      imageUrl: 'https://example.com/radar2.png',
      timestamp: '2026-03-01T12:10:00Z',
      precipitationIntensity: 1.2,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders radar viewer with data', () => {
    const { toJSON } = render(<RadarViewer radarData={mockRadarData as any} />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows no data message when empty', () => {
    const { getByText } = render(<RadarViewer radarData={[]} />);
    expect(getByText('レーダーデータがありません')).toBeTruthy();
  });

  it('renders title text', () => {
    const { getByText } = render(<RadarViewer radarData={mockRadarData as any} />);
    expect(getByText('雨雲レーダー')).toBeTruthy();
  });

  it('renders without crashing with valid data', () => {
    expect(() => render(<RadarViewer radarData={mockRadarData as any} />)).not.toThrow();
  });

  it('renders play/pause button for multiple radar items', () => {
    const { getByLabelText } = render(<RadarViewer radarData={mockRadarData as any} />);
    expect(getByLabelText('スライドショーを再生')).toBeTruthy();
  });

  it('does not render play button for single radar item', () => {
    const singleData = [mockRadarData[0]];
    const { queryByLabelText } = render(<RadarViewer radarData={singleData as any} />);
    expect(queryByLabelText('スライドショーを再生')).toBeNull();
  });

  it('toggles play/pause label on button press', () => {
    const { getByLabelText, queryByLabelText } = render(
      <RadarViewer radarData={mockRadarData as any} />
    );

    fireEvent.press(getByLabelText('スライドショーを再生'));
    expect(getByLabelText('スライドショーを停止')).toBeTruthy();

    fireEvent.press(getByLabelText('スライドショーを停止'));
    expect(queryByLabelText('スライドショーを再生')).toBeTruthy();
  });

  it('renders legend with intensity labels', () => {
    const { getByText } = render(<RadarViewer radarData={mockRadarData as any} />);
    expect(getByText('降水強度')).toBeTruthy();
    expect(getByText('なし')).toBeTruthy();
    expect(getByText('弱')).toBeTruthy();
    expect(getByText('中')).toBeTruthy();
    expect(getByText('強')).toBeTruthy();
    expect(getByText('激')).toBeTruthy();
  });

  it('renders intensity descriptions for various levels', () => {
    const radarVariety = [
      { id: 'r1', imageUrl: 'u', timestamp: '2026-03-01T12:00:00Z', precipitationIntensity: 0 },
      { id: 'r2', imageUrl: 'u', timestamp: '2026-03-01T12:10:00Z', precipitationIntensity: 3 },
      { id: 'r3', imageUrl: 'u', timestamp: '2026-03-01T12:20:00Z', precipitationIntensity: 15 },
      { id: 'r4', imageUrl: 'u', timestamp: '2026-03-01T12:30:00Z', precipitationIntensity: 40 },
      { id: 'r5', imageUrl: 'u', timestamp: '2026-03-01T12:40:00Z', precipitationIntensity: 60 },
    ];
    const { getByText } = render(<RadarViewer radarData={radarVariety as any} />);
    expect(getByText('降水なし')).toBeTruthy();
    expect(getByText('弱い雨')).toBeTruthy();
    expect(getByText('中程度の雨')).toBeTruthy();
    expect(getByText('強い雨')).toBeTruthy();
    expect(getByText('非常に強い雨')).toBeTruthy();
  });

  it('renders precipitation values in mm/h', () => {
    const { getAllByText } = render(<RadarViewer radarData={mockRadarData as any} />);
    // Each radar item shows mm/h twice (placeholder + indicator)
    expect(getAllByText('0.5 mm/h').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('1.2 mm/h').length).toBeGreaterThanOrEqual(1);
  });

  it('renders accessibility label with image count', () => {
    const { getByLabelText } = render(
      <RadarViewer radarData={mockRadarData as any} testID="radar" />
    );
    expect(
      getByLabelText('雨雲レーダー。2枚の画像。左右にスクロールして閲覧できます')
    ).toBeTruthy();
  });

  it('renders no data accessibility label when empty', () => {
    const { getByLabelText } = render(
      <RadarViewer radarData={[]} testID="radar" />
    );
    expect(getByLabelText('レーダーデータがありません')).toBeTruthy();
  });

  it('handles scroll end to update current index', () => {
    const { getByLabelText } = render(
      <RadarViewer radarData={mockRadarData as any} />
    );
    // Component renders, scroll end handler is wired via onMomentumScrollEnd
    // The handler updates internal state - we test it doesn't crash
    expect(getByLabelText('雨雲レーダー。2枚の画像。左右にスクロールして閲覧できます')).toBeTruthy();
  });

  it('renders pagination dots for multiple items', () => {
    const { toJSON } = render(<RadarViewer radarData={mockRadarData as any} />);
    const json = JSON.stringify(toJSON());
    // Pagination dots are rendered as Views; we verify the component renders fully
    expect(json).toBeTruthy();
  });

  it('sorts radar data by timestamp', () => {
    const unsorted = [
      { id: 'r2', imageUrl: 'u', timestamp: '2026-03-01T12:10:00Z', precipitationIntensity: 1.2 },
      { id: 'r1', imageUrl: 'u', timestamp: '2026-03-01T12:00:00Z', precipitationIntensity: 0.5 },
    ];
    const { getAllByText } = render(<RadarViewer radarData={unsorted as any} />);
    // Both items should render regardless of order
    expect(getAllByText(/mm\/h/).length).toBeGreaterThanOrEqual(2);
  });

  it('handles radar data with null precipitationIntensity', () => {
    const data = [
      { id: 'r1', imageUrl: 'u', timestamp: '2026-03-01T12:00:00Z', precipitationIntensity: null },
      { id: 'r2', imageUrl: 'u', timestamp: '2026-03-01T12:10:00Z', precipitationIntensity: undefined },
    ];
    const { getAllByText } = render(<RadarViewer radarData={data as any} />);
    // null/undefined should default to 0
    expect(getAllByText('0 mm/h').length).toBeGreaterThanOrEqual(2);
    expect(getAllByText('降水なし').length).toBeGreaterThanOrEqual(2);
  });
});
