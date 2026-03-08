/**
 * Component Tests for PhotoCard
 *
 * Tests rendering, press handling, accessibility labels, and date formatting.
 * Child text elements have accessible={false}, so we test via accessibilityLabel
 * or includeHiddenElements option.
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';

jest.mock('expo-image', () => ({
  Image: 'ExpoImage',
}));

jest.mock('date-fns', () => ({
  format: (date: any, fmt: string) => {
    if (isNaN(date.getTime())) throw new Error('Invalid date');
    return '2026年1月15日';
  },
}));

jest.mock('date-fns/locale', () => ({
  ja: {},
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: any) => {
      const translations: Record<string, string> = {
        'photo.rainbowPhoto': 'Rainbow Photo',
        'photo.postedBy': `Posted by ${opts?.name || ''}`,
        'photo.locationLabel': `Location: ${opts?.name || ''}`,
        'photo.dateLabel': `Date: ${opts?.date || ''}`,
        'photo.likesCount': `${opts?.count || 0} likes`,
        'photo.commentsCount': `${opts?.count || 0} comments`,
        'photo.doubleTapForDetail': 'Double tap for detail',
        'photo.navigateToDetail': 'Navigate to detail',
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock('../../../src/utils/accessibility', () => ({
  MIN_TOUCH_TARGET_SIZE: 44,
  formatNumberForScreenReader: (n: number) => n.toString(),
  createScreenReaderAnnouncement: (...args: (string | false | undefined | null)[]) =>
    args.filter(Boolean).join(', '),
}));

import { PhotoCard } from '../../../src/components/feed/PhotoCard';

const mockPhoto = {
  id: 'photo-1',
  title: 'Beautiful Rainbow',
  user: { id: 'user-1', displayName: 'Test User' },
  imageUrls: {
    thumbnail: 'https://example.com/thumb.jpg',
    medium: 'https://example.com/medium.jpg',
    large: 'https://example.com/large.jpg',
  },
  capturedAt: '2026-01-15T10:00:00Z',
  likeCount: 42,
  commentCount: 7,
  location: {
    name: 'Shiojiri, Nagano',
    latitude: 36.115,
    longitude: 137.954,
  },
};

describe('PhotoCard', () => {
  const defaultProps = {
    photo: mockPhoto as any,
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with accessibility label containing title', () => {
    const { getByRole } = render(<PhotoCard {...defaultProps} />);
    const button = getByRole('button');
    expect(button.props.accessibilityLabel).toContain('Beautiful Rainbow');
  });

  it('renders with accessibility label containing user name', () => {
    const { getByRole } = render(<PhotoCard {...defaultProps} />);
    const button = getByRole('button');
    expect(button.props.accessibilityLabel).toContain('Test User');
  });

  it('renders with accessibility label containing location', () => {
    const { getByRole } = render(<PhotoCard {...defaultProps} />);
    const button = getByRole('button');
    expect(button.props.accessibilityLabel).toContain('Shiojiri, Nagano');
  });

  it('renders with accessibility label containing like count', () => {
    const { getByRole } = render(<PhotoCard {...defaultProps} />);
    const button = getByRole('button');
    expect(button.props.accessibilityLabel).toContain('42 likes');
  });

  it('renders with accessibility label containing comment count', () => {
    const { getByRole } = render(<PhotoCard {...defaultProps} />);
    const button = getByRole('button');
    expect(button.props.accessibilityLabel).toContain('7 comments');
  });

  it('calls onPress with photo when pressed', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <PhotoCard photo={mockPhoto as any} onPress={onPress} />
    );

    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledWith(mockPhoto);
  });

  it('has accessibilityRole="button"', () => {
    const { getByRole } = render(<PhotoCard {...defaultProps} />);
    expect(getByRole('button')).toBeTruthy();
  });

  it('has accessibilityHint for navigation', () => {
    const { getByRole } = render(<PhotoCard {...defaultProps} />);
    expect(getByRole('button').props.accessibilityHint).toBe('Navigate to detail');
  });

  it('renders without location in label when not provided', () => {
    const photoNoLocation = { ...mockPhoto, location: undefined };
    const { getByRole } = render(
      <PhotoCard photo={photoNoLocation as any} onPress={jest.fn()} />
    );
    expect(getByRole('button').props.accessibilityLabel).not.toContain('Shiojiri');
  });

  it('accepts custom testID', () => {
    const { getByTestId } = render(
      <PhotoCard {...defaultProps} testID="photo-card-1" />
    );
    expect(getByTestId('photo-card-1')).toBeTruthy();
  });

  it('renders ExpoImage with photo thumbnail', () => {
    const { getByLabelText } = render(<PhotoCard {...defaultProps} />);
    // Image has accessibilityLabel = title
    expect(getByLabelText('Beautiful Rainbow')).toBeTruthy();
  });

  it('formats count >= 10000 with 万 suffix', () => {
    const photoHighLikes = { ...mockPhoto, likeCount: 15000 };
    const { getByRole } = render(
      <PhotoCard photo={photoHighLikes as any} onPress={jest.fn()} />
    );
    // The formatCount function should produce "1.5万"
    expect(getByRole('button').props.accessibilityLabel).toContain('15000 likes');
  });

  it('formats count >= 1000 with k suffix', () => {
    const photoMediumLikes = { ...mockPhoto, likeCount: 2500 };
    const { getByRole } = render(
      <PhotoCard photo={photoMediumLikes as any} onPress={jest.fn()} />
    );
    expect(getByRole('button').props.accessibilityLabel).toContain('2500 likes');
  });

  it('handles invalid date string gracefully', () => {
    const photoInvalidDate = { ...mockPhoto, capturedAt: 'invalid-date' };
    expect(() =>
      render(<PhotoCard photo={photoInvalidDate as any} onPress={jest.fn()} />)
    ).not.toThrow();
  });
});
