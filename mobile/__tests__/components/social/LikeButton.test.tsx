/**
 * Component Tests for LikeButton
 *
 * Tests like/unlike toggle, API call, disabled state, and accessibility.
 * Child text elements have accessible={false}, so we test via accessibilityLabel.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../../../src/services/socialService', () => ({
  socialService: {
    toggleLike: jest.fn(() =>
      Promise.resolve({ liked: true, likeCount: 43 })
    ),
  },
}));

jest.mock('../../../src/utils/accessibility', () => ({
  MIN_TOUCH_TARGET_SIZE: 44,
  formatNumberForScreenReader: (n: number) => n.toString(),
}));

import { LikeButton } from '../../../src/components/social/LikeButton';
import { socialService } from '../../../src/services/socialService';

const mockedSocialService = jest.mocked(socialService);

describe('LikeButton', () => {
  const defaultProps = {
    photoId: 'photo-1',
    initialLiked: false,
    initialLikeCount: 42,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with like count in accessibility label', () => {
    const { getByRole } = render(<LikeButton {...defaultProps} />);
    const button = getByRole('button');
    expect(button.props.accessibilityLabel).toContain('42件');
  });

  it('has selected=false accessibility state when not liked', () => {
    const { getByRole } = render(<LikeButton {...defaultProps} />);
    const button = getByRole('button');
    expect(button.props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false })
    );
  });

  it('has selected=true accessibility state when liked', () => {
    const { getByRole } = render(
      <LikeButton {...defaultProps} initialLiked={true} />
    );
    const button = getByRole('button');
    expect(button.props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true })
    );
  });

  it('includes "いいね済み" in label when liked', () => {
    const { getByRole } = render(
      <LikeButton {...defaultProps} initialLiked={true} />
    );
    expect(getByRole('button').props.accessibilityLabel).toContain('いいね済み');
  });

  it('includes "ダブルタップでいいねする" when not liked', () => {
    const { getByRole } = render(<LikeButton {...defaultProps} />);
    expect(getByRole('button').props.accessibilityLabel).toContain('ダブルタップでいいねする');
  });

  it('calls toggleLike on press', async () => {
    const { getByRole } = render(<LikeButton {...defaultProps} />);

    fireEvent.press(getByRole('button'));

    await waitFor(() => {
      expect(mockedSocialService.toggleLike).toHaveBeenCalledWith('photo-1', false);
    });
  });

  it('updates accessibility label optimistically on press', () => {
    const { getByRole } = render(<LikeButton {...defaultProps} />);

    fireEvent.press(getByRole('button'));

    // After press, should show liked state
    const button = getByRole('button');
    expect(button.props.accessibilityLabel).toContain('いいね済み');
    expect(button.props.accessibilityLabel).toContain('43件');
  });

  it('calls onLikeChange callback after successful toggle', async () => {
    const onLikeChange = jest.fn();
    const { getByRole } = render(
      <LikeButton {...defaultProps} onLikeChange={onLikeChange} />
    );

    fireEvent.press(getByRole('button'));

    await waitFor(() => {
      expect(onLikeChange).toHaveBeenCalledWith(true, 43);
    });
  });

  it('reverts state on API error', async () => {
    mockedSocialService.toggleLike.mockRejectedValueOnce(new Error('fail'));

    const { getByRole } = render(<LikeButton {...defaultProps} />);

    fireEvent.press(getByRole('button'));

    await waitFor(() => {
      // Should revert back to unliked state with 42
      const button = getByRole('button');
      expect(button.props.accessibilityState).toEqual(
        expect.objectContaining({ selected: false })
      );
      expect(button.props.accessibilityLabel).toContain('42件');
    });
  });

  it('accepts testID prop', () => {
    const { getByTestId } = render(
      <LikeButton {...defaultProps} testID="like-btn" />
    );
    expect(getByTestId('like-btn')).toBeTruthy();
  });
});
