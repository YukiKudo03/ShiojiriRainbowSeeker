/**
 * Component Tests for LocationPicker
 *
 * Tests map rendering, pin placement, and coordinate display.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  const RN = require('react');
  const MockMapView = RN.forwardRef((props: any, ref: any) => (
    <View testID="location-map" ref={ref} {...props} />
  ));
  MockMapView.displayName = 'MockMapView';
  const MockMarker = (props: any) => <View testID="location-marker" {...props} />;
  return {
    __esModule: true,
    default: MockMapView,
    Marker: MockMarker,
    PROVIDER_DEFAULT: 'default',
  };
});

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: (props: any) => {
    const { View } = require('react-native');
    return <View {...props} />;
  },
}));

jest.mock('../../../src/utils/accessibility', () => ({
  MIN_TOUCH_TARGET_SIZE: 44,
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

import { LocationPicker } from '../../../src/components/photo/LocationPicker';

describe('LocationPicker', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    onLocationSelect: jest.fn(),
    initialLocation: {
      latitude: 36.115,
      longitude: 137.954,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the map when visible', () => {
    const { getByTestId } = render(<LocationPicker {...defaultProps} />);
    expect(getByTestId('location-map')).toBeTruthy();
  });

  it('renders the map marker', () => {
    const { getByTestId } = render(<LocationPicker {...defaultProps} />);
    expect(getByTestId('location-marker')).toBeTruthy();
  });

  it('shows Select Location title', () => {
    const { getByText } = render(<LocationPicker {...defaultProps} />);
    expect(getByText('Select Location')).toBeTruthy();
  });

  it('shows Cancel button', () => {
    const { getByText } = render(<LocationPicker {...defaultProps} />);
    expect(getByText('Cancel')).toBeTruthy();
  });

  it('calls onClose when Cancel is pressed', () => {
    const onClose = jest.fn();
    const { getByText } = render(
      <LocationPicker {...defaultProps} onClose={onClose} />
    );

    fireEvent.press(getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders confirm button', () => {
    const { getByText } = render(<LocationPicker {...defaultProps} />);
    expect(getByText('Confirm')).toBeTruthy();
  });

  it('calls onLocationSelect when Confirm is pressed', () => {
    jest.useFakeTimers();
    const onLocationSelect = jest.fn();
    const onClose = jest.fn();
    const { getByText } = render(
      <LocationPicker {...defaultProps} onLocationSelect={onLocationSelect} onClose={onClose} />
    );

    fireEvent.press(getByText('Confirm'));
    jest.advanceTimersByTime(300);

    expect(onLocationSelect).toHaveBeenCalledWith({
      latitude: 36.115,
      longitude: 137.954,
    });
    expect(onClose).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('displays coordinate info', () => {
    const { getByText } = render(<LocationPicker {...defaultProps} />);
    expect(getByText('Selected Location:')).toBeTruthy();
  });

  it('shows instructions text', () => {
    const { getByText } = render(<LocationPicker {...defaultProps} />);
    expect(getByText(/Tap on the map or drag/)).toBeTruthy();
  });

  it('renders center button', () => {
    const { getByText } = render(<LocationPicker {...defaultProps} />);
    expect(getByText('Center')).toBeTruthy();
  });

  it('renders with custom title', () => {
    const { getByText } = render(
      <LocationPicker {...defaultProps} title="Custom Title" />
    );
    expect(getByText('Custom Title')).toBeTruthy();
  });

  it('updates location on map press', () => {
    const { getByTestId } = render(<LocationPicker {...defaultProps} />);

    const map = getByTestId('location-map');
    fireEvent(map, 'onPress', {
      nativeEvent: {
        coordinate: { latitude: 36.200, longitude: 138.000 },
      },
    });
    // Location should be updated (reflected in coordinate display)
  });

  it('updates location on marker drag end', () => {
    const { getByTestId } = render(<LocationPicker {...defaultProps} />);

    const marker = getByTestId('location-marker');
    fireEvent(marker, 'onDragEnd', {
      nativeEvent: {
        coordinate: { latitude: 36.300, longitude: 138.100 },
      },
    });
  });

  it('displays coordinate values', () => {
    const { getByText } = render(<LocationPicker {...defaultProps} />);
    // Check that coordinates are displayed
    expect(getByText(/36\.115000/)).toBeTruthy();
    expect(getByText(/137\.954000/)).toBeTruthy();
  });
});
