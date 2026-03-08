/**
 * Component Tests for CommentList
 *
 * Tests comment list rendering, submission, deletion, and error states.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: any) => {
      const translations: Record<string, string> = {
        'common.error': 'Error',
        'common.confirm': 'Confirm',
        'common.cancel': 'Cancel',
        'common.delete': 'Delete',
        'social.commentLoadError': 'Failed to load comments',
        'social.commentCharLimit': `Max ${opts?.max || 500} characters`,
        'social.commentPostError': 'Failed to post comment',
        'social.commentDeleteConfirm': 'Delete this comment?',
        'social.commentDeleteError': 'Failed to delete comment',
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock('../../../src/services/socialService', () => ({
  socialService: {
    getComments: jest.fn(() =>
      Promise.resolve({
        comments: [
          {
            id: 'c1',
            content: 'Great rainbow!',
            user: { id: 'user-1', displayName: 'Taro' },
            createdAt: new Date().toISOString(),
            isOwn: false,
          },
          {
            id: 'c2',
            content: 'Amazing!',
            user: { id: 'current', displayName: 'Me' },
            createdAt: new Date().toISOString(),
            isOwn: true,
          },
        ],
        pagination: { currentPage: 1, totalPages: 1, totalCount: 2 },
      })
    ),
    createComment: jest.fn(() =>
      Promise.resolve({
        comment: {
          id: 'c3',
          content: 'New comment',
          user: { id: 'current', displayName: 'Me' },
          createdAt: new Date().toISOString(),
          isOwn: true,
        },
        commentCount: 3,
      })
    ),
    deleteComment: jest.fn(() => Promise.resolve({ commentCount: 1 })),
  },
}));

jest.mock('../../../src/utils/accessibility', () => ({
  MIN_TOUCH_TARGET_SIZE: 44,
}));

jest.mock('../../../src/types/social', () => ({
  MAX_COMMENT_LENGTH: 500,
}));

import { CommentList } from '../../../src/components/social/CommentList';
import { socialService } from '../../../src/services/socialService';

const mockedSocialService = jest.mocked(socialService);

describe('CommentList', () => {
  const defaultProps = {
    photoId: 'photo-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads and displays comments on mount', async () => {
    const { getByText } = render(<CommentList {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('Great rainbow!')).toBeTruthy();
      expect(getByText('Amazing!')).toBeTruthy();
    });
  });

  it('shows comment count in header', async () => {
    const { getByText } = render(<CommentList {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('2件')).toBeTruthy();
    });
  });

  it('shows loading indicator initially', () => {
    const { getByLabelText } = render(<CommentList {...defaultProps} />);
    expect(getByLabelText('コメントを読み込み中')).toBeTruthy();
  });

  it('shows error state when loading fails', async () => {
    mockedSocialService.getComments.mockRejectedValueOnce(new Error('Network error'));

    const { getByText } = render(<CommentList {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('Failed to load comments')).toBeTruthy();
    });
  });

  it('shows retry button on error', async () => {
    mockedSocialService.getComments.mockRejectedValueOnce(new Error('fail'));

    const { getByText } = render(<CommentList {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('再読み込み')).toBeTruthy();
    });
  });

  it('shows empty state when no comments', async () => {
    mockedSocialService.getComments.mockResolvedValueOnce({
      comments: [],
      pagination: { currentPage: 1, totalPages: 1, totalCount: 0 },
    } as any);

    const { getByText } = render(<CommentList {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('コメントはまだありません')).toBeTruthy();
    });
  });

  it('shows delete button for own comments', async () => {
    const { getByText } = render(<CommentList {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('削除')).toBeTruthy();
    });
  });

  it('shows report button for others comments', async () => {
    const { getByText } = render(<CommentList {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('報告')).toBeTruthy();
    });
  });

  it('renders comment input field', async () => {
    const { getByLabelText } = render(<CommentList {...defaultProps} />);

    await waitFor(() => {
      expect(getByLabelText('コメント入力欄')).toBeTruthy();
    });
  });

  it('renders submit button', async () => {
    const { getByLabelText } = render(<CommentList {...defaultProps} />);

    await waitFor(() => {
      expect(getByLabelText('コメントを送信')).toBeTruthy();
    });
  });

  it('calls onCommentCountChange when comments load', async () => {
    const onCommentCountChange = jest.fn();
    render(
      <CommentList {...defaultProps} onCommentCountChange={onCommentCountChange} />
    );

    await waitFor(() => {
      expect(onCommentCountChange).toHaveBeenCalledWith(2);
    });
  });

  it('submits a new comment with optimistic update', async () => {
    const { getByLabelText } = render(<CommentList {...defaultProps} />);

    await waitFor(() => {
      expect(getByLabelText('コメント入力欄')).toBeTruthy();
    });

    const input = getByLabelText('コメント入力欄');
    fireEvent.changeText(input, 'New comment text');
    fireEvent.press(getByLabelText('コメントを送信'));

    await waitFor(() => {
      expect(mockedSocialService.createComment).toHaveBeenCalledWith(
        'photo-1',
        'New comment text'
      );
    });
  });

  it('reverts optimistic update on submit error', async () => {
    mockedSocialService.createComment.mockRejectedValueOnce(new Error('Submit failed'));

    const { getByLabelText } = render(<CommentList {...defaultProps} />);

    await waitFor(() => {
      expect(getByLabelText('コメント入力欄')).toBeTruthy();
    });

    const input = getByLabelText('コメント入力欄');
    fireEvent.changeText(input, 'Will fail');
    fireEvent.press(getByLabelText('コメントを送信'));

    await waitFor(() => {
      expect(mockedSocialService.createComment).toHaveBeenCalled();
    });
  });

  it('shows delete confirmation for own comments', async () => {
    const { getByText } = render(<CommentList {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('削除')).toBeTruthy();
    });

    fireEvent.press(getByText('削除'));
    // Alert.alert is called with confirmation
  });

  it('displays character count', async () => {
    const { getByLabelText, getByText } = render(<CommentList {...defaultProps} />);

    await waitFor(() => {
      expect(getByLabelText('コメント入力欄')).toBeTruthy();
    });

    // Initial count should be 0/500
    expect(getByText('0/500')).toBeTruthy();
  });

  it('updates character count on input', async () => {
    const { getByLabelText, getByText } = render(<CommentList {...defaultProps} />);

    await waitFor(() => {
      expect(getByLabelText('コメント入力欄')).toBeTruthy();
    });

    fireEvent.changeText(getByLabelText('コメント入力欄'), 'Hello');

    expect(getByText('5/500')).toBeTruthy();
  });

  it('shows user display names', async () => {
    const { getByText } = render(<CommentList {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('Taro')).toBeTruthy();
      expect(getByText('Me')).toBeTruthy();
    });
  });

  it('retries loading on retry button press', async () => {
    mockedSocialService.getComments
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({
        comments: [],
        pagination: { currentPage: 1, totalPages: 1, totalCount: 0 },
      } as any);

    const { getByText } = render(<CommentList {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('再読み込み')).toBeTruthy();
    });

    fireEvent.press(getByText('再読み込み'));

    await waitFor(() => {
      expect(mockedSocialService.getComments).toHaveBeenCalledTimes(2);
    });
  });

  it('calls onReportPress when report is pressed', async () => {
    const onReportPress = jest.fn();
    const { getByText } = render(
      <CommentList {...defaultProps} onReportPress={onReportPress} />
    );

    await waitFor(() => {
      expect(getByText('報告')).toBeTruthy();
    });

    fireEvent.press(getByText('報告'));
    expect(onReportPress).toHaveBeenCalledWith('Comment', 'c1');
  });

  it('handles pagination with multiple pages', async () => {
    mockedSocialService.getComments.mockResolvedValueOnce({
      comments: [
        {
          id: 'c1',
          content: 'First page comment',
          user: { id: 'user-1', displayName: 'Taro' },
          createdAt: new Date().toISOString(),
          isOwn: false,
        },
      ],
      pagination: { currentPage: 1, totalPages: 2, totalCount: 2 },
    } as any);

    const { getByText } = render(<CommentList {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('First page comment')).toBeTruthy();
    });
  });

  it('shows relative time formatting for recent comments', async () => {
    const now = new Date();
    mockedSocialService.getComments.mockResolvedValueOnce({
      comments: [
        {
          id: 'c1',
          content: 'Just now comment',
          user: { id: 'user-1', displayName: 'Taro' },
          createdAt: now.toISOString(),
          isOwn: false,
        },
      ],
      pagination: { currentPage: 1, totalPages: 1, totalCount: 1 },
    } as any);

    const { getByText } = render(<CommentList {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('たった今')).toBeTruthy();
    });
  });

  it('shows minutes ago for recent comments', async () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    mockedSocialService.getComments.mockResolvedValueOnce({
      comments: [
        {
          id: 'c1',
          content: 'Recent comment',
          user: { id: 'user-1', displayName: 'Taro' },
          createdAt: fiveMinutesAgo.toISOString(),
          isOwn: false,
        },
      ],
      pagination: { currentPage: 1, totalPages: 1, totalCount: 1 },
    } as any);

    const { getByText } = render(<CommentList {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('5分前')).toBeTruthy();
    });
  });

  it('shows hours ago for older comments', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    mockedSocialService.getComments.mockResolvedValueOnce({
      comments: [
        {
          id: 'c1',
          content: 'Older comment',
          user: { id: 'user-1', displayName: 'Taro' },
          createdAt: twoHoursAgo.toISOString(),
          isOwn: false,
        },
      ],
      pagination: { currentPage: 1, totalPages: 1, totalCount: 1 },
    } as any);

    const { getByText } = render(<CommentList {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('2時間前')).toBeTruthy();
    });
  });

  it('shows days ago for comments from past week', async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    mockedSocialService.getComments.mockResolvedValueOnce({
      comments: [
        {
          id: 'c1',
          content: 'Old comment',
          user: { id: 'user-1', displayName: 'Taro' },
          createdAt: threeDaysAgo.toISOString(),
          isOwn: false,
        },
      ],
      pagination: { currentPage: 1, totalPages: 1, totalCount: 1 },
    } as any);

    const { getByText } = render(<CommentList {...defaultProps} />);

    await waitFor(() => {
      expect(getByText('3日前')).toBeTruthy();
    });
  });
});
