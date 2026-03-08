/**
 * Component Tests for PhotoPreviewModal
 *
 * Tests modal rendering, photo display, and close/detail actions.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('expo-image', () => ({
  Image: (props: any) => {
    const { View } = require('react-native');
    return <View testID="expo-image" {...props} />;
  },
}));

jest.mock('date-fns', () => ({
  format: (date: any, fmt: string) => '2026年1月15日',
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

import { PhotoPreviewModal } from '../../../src/components/map/PhotoPreviewModal';

describe('PhotoPreviewModal', () => {
  const mockMarker = {
    id: 'photo-1',
    title: 'Rainbow over mountains',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    capturedAt: '2026-01-15T10:00:00Z',
    latitude: 36.115,
    longitude: 137.954,
  };

  const defaultProps = {
    visible: true,
    marker: mockMarker as any,
    onClose: jest.fn(),
    onViewDetail: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing when visible with marker', () => {
    expect(() => render(<PhotoPreviewModal {...defaultProps} />)).not.toThrow();
  });

  it('renders component tree when visible', () => {
    const { toJSON } = render(<PhotoPreviewModal {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('returns null when marker is null', () => {
    const { toJSON } = render(
      <PhotoPreviewModal {...defaultProps} marker={null} />
    );
    // When marker is null, the component returns null
    expect(toJSON()).toBeNull();
  });

  it('calls onClose when close button is pressed', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <PhotoPreviewModal {...defaultProps} onClose={onClose} />
    );

    fireEvent.press(getByTestId('preview-close-button'));
    expect(onClose).toHaveBeenCalled();
  });

  it('includes marker title in rendered output', () => {
    const { toJSON } = render(<PhotoPreviewModal {...defaultProps} />);
    const json = JSON.stringify(toJSON());
    expect(json).toContain('Rainbow over mountains');
  });

  it('includes formatted date in rendered output', () => {
    const { toJSON } = render(<PhotoPreviewModal {...defaultProps} />);
    const json = JSON.stringify(toJSON());
    expect(json).toContain('2026年1月15日');
  });

  it('includes coordinates in rendered output', () => {
    const { toJSON } = render(<PhotoPreviewModal {...defaultProps} />);
    const json = JSON.stringify(toJSON());
    expect(json).toContain('36.1150, 137.9540');
  });

  it('renders view detail button', () => {
    const { getByText } = render(<PhotoPreviewModal {...defaultProps} />);
    expect(getByText('詳細を見る')).toBeTruthy();
  });

  it('calls onViewDetail when detail button is pressed', () => {
    const onViewDetail = jest.fn();
    const { getByTestId } = render(
      <PhotoPreviewModal {...defaultProps} onViewDetail={onViewDetail} />
    );

    fireEvent.press(getByTestId('preview-view-detail-button'));
    expect(onViewDetail).toHaveBeenCalledWith('photo-1');
  });

  it('renders without title when marker has no title', () => {
    const markerNoTitle = { ...mockMarker, title: undefined };
    const { queryByText } = render(
      <PhotoPreviewModal {...defaultProps} marker={markerNoTitle as any} />
    );
    expect(queryByText('Rainbow over mountains')).toBeNull();
  });

  it('renders photo image', () => {
    const { getByTestId } = render(<PhotoPreviewModal {...defaultProps} />);
    expect(getByTestId('expo-image')).toBeTruthy();
  });
});
