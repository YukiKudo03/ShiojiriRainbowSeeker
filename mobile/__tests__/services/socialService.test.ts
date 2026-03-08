/**
 * Unit Tests for socialService
 *
 * Tests social features API calls: likes, comments, and reports.
 * apiClient is fully mocked.
 */

// Mock apiClient
jest.mock('../../src/services/apiClient', () => ({
  apiClient: {
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
  },
  getErrorMessage: jest.fn((e: unknown) =>
    e instanceof Error ? e.message : 'error'
  ),
}));

import { apiClient } from '../../src/services/apiClient';
import {
  likePhoto,
  unlikePhoto,
  toggleLike,
  getComments,
  createComment,
  deleteComment,
  reportContent,
} from '../../src/services/socialService';

const mockedApiClient = jest.mocked(apiClient);

describe('socialService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------
  // likePhoto
  // -------------------------------------------------------------------
  describe('likePhoto', () => {
    it('should call correct endpoint and transform response', async () => {
      mockedApiClient.post.mockResolvedValue({
        data: {
          data: {
            liked: true,
            like_count: 5,
          },
        },
      });

      const result = await likePhoto('photo-123');

      expect(mockedApiClient.post).toHaveBeenCalledWith(
        '/photos/photo-123/likes'
      );
      expect(result).toEqual({
        liked: true,
        likeCount: 5,
      });
    });
  });

  // -------------------------------------------------------------------
  // unlikePhoto
  // -------------------------------------------------------------------
  describe('unlikePhoto', () => {
    it('should call correct endpoint and transform response', async () => {
      mockedApiClient.delete.mockResolvedValue({
        data: {
          data: {
            liked: false,
            like_count: 4,
          },
        },
      });

      const result = await unlikePhoto('photo-123');

      expect(mockedApiClient.delete).toHaveBeenCalledWith(
        '/photos/photo-123/likes'
      );
      expect(result).toEqual({
        liked: false,
        likeCount: 4,
      });
    });
  });

  // -------------------------------------------------------------------
  // toggleLike
  // -------------------------------------------------------------------
  describe('toggleLike', () => {
    it('should call unlikePhoto when currently liked', async () => {
      mockedApiClient.delete.mockResolvedValue({
        data: {
          data: {
            liked: false,
            like_count: 3,
          },
        },
      });

      const result = await toggleLike('photo-123', true);

      expect(mockedApiClient.delete).toHaveBeenCalledWith(
        '/photos/photo-123/likes'
      );
      expect(result.liked).toBe(false);
    });

    it('should call likePhoto when not currently liked', async () => {
      mockedApiClient.post.mockResolvedValue({
        data: {
          data: {
            liked: true,
            like_count: 4,
          },
        },
      });

      const result = await toggleLike('photo-123', false);

      expect(mockedApiClient.post).toHaveBeenCalledWith(
        '/photos/photo-123/likes'
      );
      expect(result.liked).toBe(true);
    });
  });

  // -------------------------------------------------------------------
  // getComments
  // -------------------------------------------------------------------
  describe('getComments', () => {
    it('should fetch comments with pagination and transform snake_case', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: {
          data: {
            comments: [
              {
                id: 'comment-1',
                content: 'Beautiful rainbow!',
                user: { id: 'user-1', display_name: 'Tester' },
                created_at: '2026-03-07T10:00:00Z',
                is_own: true,
              },
            ],
            pagination: {
              current_page: 1,
              total_pages: 3,
              total_count: 25,
              per_page: 10,
            },
          },
        },
      });

      const result = await getComments('photo-123', 1, 10);

      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/photos/photo-123/comments',
        { params: { page: 1, per_page: 10 } }
      );

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0]).toEqual({
        id: 'comment-1',
        content: 'Beautiful rainbow!',
        user: { id: 'user-1', displayName: 'Tester' },
        createdAt: '2026-03-07T10:00:00Z',
        isOwn: true,
      });
      expect(result.pagination).toEqual({
        currentPage: 1,
        totalPages: 3,
        totalCount: 25,
        perPage: 10,
      });
    });

    it('should use default pagination values', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: {
          data: {
            comments: [],
            pagination: {},
          },
        },
      });

      const result = await getComments('photo-123');

      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/photos/photo-123/comments',
        { params: { page: 1, per_page: 20 } }
      );
      expect(result.pagination.currentPage).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.perPage).toBe(20);
    });
  });

  // -------------------------------------------------------------------
  // createComment
  // -------------------------------------------------------------------
  describe('createComment', () => {
    it('should post comment and transform response', async () => {
      mockedApiClient.post.mockResolvedValue({
        data: {
          data: {
            comment: {
              id: 'comment-new',
              content: 'Great shot!',
              user: { id: 'user-1', display_name: 'Me' },
              created_at: '2026-03-07T11:00:00Z',
              is_own: true,
            },
            comment_count: 10,
          },
        },
      });

      const result = await createComment('photo-123', 'Great shot!');

      expect(mockedApiClient.post).toHaveBeenCalledWith(
        '/photos/photo-123/comments',
        { content: 'Great shot!' }
      );
      expect(result.comment.content).toBe('Great shot!');
      expect(result.comment.user.displayName).toBe('Me');
      expect(result.commentCount).toBe(10);
    });
  });

  // -------------------------------------------------------------------
  // deleteComment
  // -------------------------------------------------------------------
  describe('deleteComment', () => {
    it('should delete comment and return transformed response', async () => {
      mockedApiClient.delete.mockResolvedValue({
        data: {
          data: {
            message: 'Comment deleted',
            comment_count: 9,
          },
        },
      });

      const result = await deleteComment('comment-123');

      expect(mockedApiClient.delete).toHaveBeenCalledWith(
        '/comments/comment-123'
      );
      expect(result.message).toBe('Comment deleted');
      expect(result.commentCount).toBe(9);
    });
  });

  // -------------------------------------------------------------------
  // reportContent
  // -------------------------------------------------------------------
  describe('reportContent', () => {
    it('should post report with snake_case payload and transform response', async () => {
      mockedApiClient.post.mockResolvedValue({
        data: {
          data: {
            report_id: 'report-abc',
            message: 'Report submitted',
          },
        },
      });

      const result = await reportContent({
        reportableType: 'Photo',
        reportableId: 'photo-123',
        reason: 'inappropriate_content',
      });

      expect(mockedApiClient.post).toHaveBeenCalledWith('/reports', {
        reportable_type: 'Photo',
        reportable_id: 'photo-123',
        reason: 'inappropriate_content',
      });
      expect(result.reportId).toBe('report-abc');
      expect(result.message).toBe('Report submitted');
    });
  });
});
