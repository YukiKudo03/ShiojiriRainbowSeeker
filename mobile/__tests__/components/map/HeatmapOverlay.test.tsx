/**
 * Component Tests for HeatmapOverlay
 *
 * Tests rendering and data-absent state.
 */

import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('react-native-maps', () => ({
  Heatmap: (props: any) => {
    const { View } = require('react-native');
    return <View testID="heatmap" {...props} />;
  },
}));

import { HeatmapOverlay } from '../../../src/components/map/HeatmapOverlay';

describe('HeatmapOverlay', () => {
  const samplePoints = [
    { latitude: 36.115, longitude: 137.954, weight: 5 },
    { latitude: 36.120, longitude: 137.960, weight: 3 },
    { latitude: 36.110, longitude: 137.950, weight: 8 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders heatmap with points', () => {
    const { getByTestId } = render(
      <HeatmapOverlay points={samplePoints} />
    );
    expect(getByTestId('heatmap')).toBeTruthy();
  });

  it('returns null when no points provided', () => {
    const { queryByTestId } = render(
      <HeatmapOverlay points={[]} />
    );
    expect(queryByTestId('heatmap')).toBeNull();
  });

  it('returns null when visible is false', () => {
    const { queryByTestId } = render(
      <HeatmapOverlay points={samplePoints} visible={false} />
    );
    expect(queryByTestId('heatmap')).toBeNull();
  });

  it('renders with default opacity and radius', () => {
    const { getByTestId } = render(
      <HeatmapOverlay points={samplePoints} />
    );
    const heatmap = getByTestId('heatmap');
    expect(heatmap.props.opacity).toBe(0.6);
    expect(heatmap.props.radius).toBe(30);
  });

  it('accepts custom opacity and radius', () => {
    const { getByTestId } = render(
      <HeatmapOverlay points={samplePoints} opacity={0.8} radius={50} />
    );
    const heatmap = getByTestId('heatmap');
    expect(heatmap.props.opacity).toBe(0.8);
    expect(heatmap.props.radius).toBe(50);
  });

  it('passes gradient configuration', () => {
    const { getByTestId } = render(
      <HeatmapOverlay points={samplePoints} />
    );
    const heatmap = getByTestId('heatmap');
    expect(heatmap.props.gradient).toBeDefined();
    expect(heatmap.props.gradient.colors).toHaveLength(6);
  });
});
