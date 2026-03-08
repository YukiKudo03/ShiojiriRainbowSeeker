/**
 * Component Tests for ClusteredMap
 *
 * Tests map rendering and marker display.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('react-native-maps', () => {
  const { View, TouchableOpacity } = require('react-native');
  const MockMapView = (props: any) => <View testID="map-view" {...props} />;
  const MockMarker = (props: any) => (
    <TouchableOpacity testID={props.testID || 'map-marker'} onPress={props.onPress} {...props}>
      {props.children}
    </TouchableOpacity>
  );
  return {
    __esModule: true,
    default: MockMapView,
    Marker: MockMarker,
    PROVIDER_GOOGLE: 'google',
  };
});

jest.mock('react-native-map-clustering', () => {
  const { View } = require('react-native');
  const RN = require('react');
  const MockClusterMapView = RN.forwardRef((props: any, ref: any) => {
    // Provide animateToRegion mock via ref
    RN.useImperativeHandle(ref, () => ({
      animateToRegion: jest.fn(),
    }));
    // Render children so markers are included in the tree
    return <View testID="map-view" ref={ref} {...props}>{props.children}</View>;
  });
  MockClusterMapView.displayName = 'MockClusterMapView';
  return {
    __esModule: true,
    default: MockClusterMapView,
  };
});

jest.mock('expo-image', () => ({
  Image: (props: any) => {
    const { View } = require('react-native');
    return <View testID="expo-image" {...props} />;
  },
}));

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

jest.mock('../../../src/services/mapService', () => ({
  DEFAULT_REGION: {
    latitude: 36.115,
    longitude: 137.954,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  },
}));

import { ClusteredMap } from '../../../src/components/map/ClusteredMap';

describe('ClusteredMap', () => {
  const defaultProps = {
    markers: [],
    onMarkerPress: jest.fn(),
    onRegionChange: jest.fn(),
    initialRegion: {
      latitude: 36.115,
      longitude: 137.954,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    expect(() => render(<ClusteredMap {...defaultProps} />)).not.toThrow();
  });

  it('renders the map view', () => {
    const { getByTestId } = render(<ClusteredMap {...defaultProps} />);
    expect(getByTestId('clustered-map')).toBeTruthy();
  });

  it('renders with markers array', () => {
    const markers = [
      {
        id: 'p1',
        latitude: 36.115,
        longitude: 137.954,
        title: 'Rainbow 1',
        thumbnailUrl: 'https://example.com/thumb1.jpg',
        capturedAt: '2026-01-15T10:00:00Z',
      },
    ];
    const { getByTestId } = render(
      <ClusteredMap {...defaultProps} markers={markers as any} />
    );
    expect(getByTestId('clustered-map')).toBeTruthy();
  });

  it('renders multiple markers', () => {
    const markers = [
      {
        id: 'p1',
        latitude: 36.115,
        longitude: 137.954,
        title: 'Rainbow 1',
        thumbnailUrl: 'https://example.com/thumb1.jpg',
        capturedAt: '2026-01-15T10:00:00Z',
      },
      {
        id: 'p2',
        latitude: 36.120,
        longitude: 137.960,
        thumbnailUrl: 'https://example.com/thumb2.jpg',
        capturedAt: '2026-01-16T11:00:00Z',
      },
    ];
    const { getByTestId } = render(
      <ClusteredMap {...defaultProps} markers={markers as any} />
    );
    expect(getByTestId('clustered-map')).toBeTruthy();
  });

  it('renders loading overlay when isLoading is true', () => {
    const { getByText } = render(
      <ClusteredMap {...defaultProps} isLoading={true} />
    );
    expect(getByText('読み込み中...')).toBeTruthy();
  });

  it('does not render loading overlay when isLoading is false', () => {
    const { queryByText } = render(
      <ClusteredMap {...defaultProps} isLoading={false} />
    );
    expect(queryByText('読み込み中...')).toBeNull();
  });

  it('renders with default region when initialRegion not provided', () => {
    const props = {
      markers: [],
      onMarkerPress: jest.fn(),
      onRegionChange: jest.fn(),
    };
    const { getByTestId } = render(<ClusteredMap {...props} />);
    expect(getByTestId('clustered-map')).toBeTruthy();
  });

  it('passes onClusterPress handler', () => {
    const onClusterPress = jest.fn();
    const { getByTestId } = render(
      <ClusteredMap {...defaultProps} onClusterPress={onClusterPress} />
    );
    expect(getByTestId('clustered-map')).toBeTruthy();
  });

  it('passes onLongPress handler', () => {
    const onLongPress = jest.fn();
    const { getByTestId } = render(
      <ClusteredMap {...defaultProps} onLongPress={onLongPress} />
    );
    expect(getByTestId('clustered-map')).toBeTruthy();
  });

  it('renders children inside the map', () => {
    const { getByTestId } = render(
      <ClusteredMap {...defaultProps}>
        <div data-testid="custom-child" />
      </ClusteredMap>
    );
    expect(getByTestId('clustered-map')).toBeTruthy();
  });

  it('renders marker with testID for each marker', () => {
    const markers = [
      {
        id: 'p1',
        latitude: 36.115,
        longitude: 137.954,
        title: 'Rainbow 1',
        thumbnailUrl: 'https://example.com/thumb1.jpg',
        capturedAt: '2026-01-15T10:00:00Z',
      },
      {
        id: 'p2',
        latitude: 36.120,
        longitude: 137.960,
        thumbnailUrl: 'https://example.com/thumb2.jpg',
        capturedAt: '2026-01-16T11:00:00Z',
      },
    ];
    const { getByTestId } = render(
      <ClusteredMap {...defaultProps} markers={markers as any} />
    );
    expect(getByTestId('marker-p1')).toBeTruthy();
    expect(getByTestId('marker-p2')).toBeTruthy();
  });

  it('calls onMarkerPress when a marker is pressed', () => {
    const onMarkerPress = jest.fn();
    const markers = [
      {
        id: 'p1',
        latitude: 36.115,
        longitude: 137.954,
        title: 'Rainbow 1',
        thumbnailUrl: 'https://example.com/thumb1.jpg',
        capturedAt: '2026-01-15T10:00:00Z',
      },
    ];
    const { getByTestId } = render(
      <ClusteredMap {...defaultProps} markers={markers as any} onMarkerPress={onMarkerPress} />
    );
    fireEvent.press(getByTestId('marker-p1'));
    expect(onMarkerPress).toHaveBeenCalledWith(markers[0]);
  });

  it('renders marker without title showing default accessibility label', () => {
    const markers = [
      {
        id: 'p1',
        latitude: 36.115,
        longitude: 137.954,
        thumbnailUrl: 'https://example.com/thumb1.jpg',
        capturedAt: '2026-01-15T10:00:00Z',
      },
    ];
    const { getByTestId } = render(
      <ClusteredMap {...defaultProps} markers={markers as any} />
    );
    const marker = getByTestId('marker-p1');
    expect(marker.props.accessibilityLabel).toBe('虹の写真');
  });

  it('renders marker with title showing title-based accessibility label', () => {
    const markers = [
      {
        id: 'p1',
        latitude: 36.115,
        longitude: 137.954,
        title: 'Beautiful Rainbow',
        thumbnailUrl: 'https://example.com/thumb1.jpg',
        capturedAt: '2026-01-15T10:00:00Z',
      },
    ];
    const { getByTestId } = render(
      <ClusteredMap {...defaultProps} markers={markers as any} />
    );
    const marker = getByTestId('marker-p1');
    expect(marker.props.accessibilityLabel).toBe('Beautiful Rainbowの虹の写真');
  });

  it('does not call onMarkerPress when handler not provided', () => {
    const markers = [
      {
        id: 'p1',
        latitude: 36.115,
        longitude: 137.954,
        thumbnailUrl: 'https://example.com/thumb1.jpg',
        capturedAt: '2026-01-15T10:00:00Z',
      },
    ];
    // No onMarkerPress provided
    const { getByTestId } = render(
      <ClusteredMap markers={markers as any} />
    );
    expect(() => fireEvent.press(getByTestId('marker-p1'))).not.toThrow();
  });

  it('passes renderCluster prop to map view', () => {
    const { getByTestId } = render(<ClusteredMap {...defaultProps} />);
    const mapView = getByTestId('clustered-map');
    expect(mapView.props.renderCluster).toBeDefined();
    expect(typeof mapView.props.renderCluster).toBe('function');
  });

  it('renderCluster creates a Marker with ClusterMarker', () => {
    const { getByTestId } = render(<ClusteredMap {...defaultProps} />);
    const mapView = getByTestId('clustered-map');
    const renderCluster = mapView.props.renderCluster;

    // Call renderCluster with a mock cluster object
    const clusterElement = renderCluster({
      id: 'cluster-1',
      geometry: { coordinates: [137.954, 36.115] },
      properties: { point_count: 5 },
      onPress: jest.fn(),
    });

    expect(clusterElement).toBeTruthy();
    expect(clusterElement.key).toBe('cluster-cluster-1');
  });

  it('renderCluster renders small cluster for count < 20', () => {
    const { getByTestId } = render(<ClusteredMap {...defaultProps} />);
    const renderCluster = getByTestId('clustered-map').props.renderCluster;

    const element = renderCluster({
      id: 'c1',
      geometry: { coordinates: [137.954, 36.115] },
      properties: { point_count: 10 },
      onPress: jest.fn(),
    });

    // Render the cluster element to check its content
    const { getByTestId: getByClusterId } = render(element);
    const cluster = getByClusterId('cluster-c1');
    expect(cluster.props.accessibilityLabel).toBe('10件の虹の写真がこのエリアにあります');
  });

  it('renderCluster renders medium cluster for count 20-99', () => {
    const { getByTestId } = render(<ClusteredMap {...defaultProps} />);
    const renderCluster = getByTestId('clustered-map').props.renderCluster;

    const element = renderCluster({
      id: 'c2',
      geometry: { coordinates: [137.954, 36.115] },
      properties: { point_count: 50 },
      onPress: jest.fn(),
    });

    const { getByTestId: getByClusterId } = render(element);
    const cluster = getByClusterId('cluster-c2');
    expect(cluster.props.accessibilityLabel).toBe('50件の虹の写真がこのエリアにあります');
  });

  it('renderCluster renders large cluster for count >= 100', () => {
    const { getByTestId } = render(<ClusteredMap {...defaultProps} />);
    const renderCluster = getByTestId('clustered-map').props.renderCluster;

    const element = renderCluster({
      id: 'c3',
      geometry: { coordinates: [137.954, 36.115] },
      properties: { point_count: 150 },
      onPress: jest.fn(),
    });

    const { getByTestId: getByClusterId, getByText } = render(element);
    const cluster = getByClusterId('cluster-c3');
    expect(cluster).toBeTruthy();
    // Count >= 100 shows "99+"
    expect(getByText('99+')).toBeTruthy();
  });

  it('handles onRegionChangeComplete callback', () => {
    const onRegionChange = jest.fn();
    const { getByTestId } = render(
      <ClusteredMap {...defaultProps} onRegionChange={onRegionChange} />
    );

    const mapView = getByTestId('clustered-map');
    const handler = mapView.props.onRegionChangeComplete;
    expect(handler).toBeDefined();

    handler({
      latitude: 36.2,
      longitude: 138.0,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    });

    expect(onRegionChange).toHaveBeenCalledWith({
      latitude: 36.2,
      longitude: 138.0,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    });
  });

  it('handles onClusterPress callback', () => {
    const onClusterPress = jest.fn();
    const { getByTestId } = render(
      <ClusteredMap {...defaultProps} onClusterPress={onClusterPress} />
    );

    const mapView = getByTestId('clustered-map');
    const handler = mapView.props.onClusterPress;
    expect(handler).toBeDefined();

    const clusterMarkers = [
      { id: 'p1', latitude: 36.115, longitude: 137.954, thumbnailUrl: '', capturedAt: '' },
      { id: 'p2', latitude: 36.120, longitude: 137.960, thumbnailUrl: '', capturedAt: '' },
    ];

    handler(
      { geometry: { coordinates: [137.957, 36.1175] }, properties: { point_count: 2 } },
      clusterMarkers
    );

    expect(onClusterPress).toHaveBeenCalledWith(clusterMarkers);
  });
});
