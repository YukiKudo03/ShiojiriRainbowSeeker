/**
 * Social Service
 *
 * Handles API calls for social features: likes, comments, and reports.
 * Requirements: FR-8 (Social Features)
 */

import { apiClient } from './apiClient';

import type {
  LikeResponse,
  CommentsResponse,
  CreateCommentResponse,
  DeleteCommentResponse,
  CreateReportRequest,
  ReportResponse,
  Comment,
} from '../types/social';

/**
 * Transform snake_case API response to camelCase
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transformComment = (comment: any): Comment => ({
  id: comment.id,
  content: comment.content,
  user: {
    id: comment.user.id,
    displayName: comment.user.display_name ?? comment.user.displayName,
  },
  createdAt: comment.created_at ?? comment.createdAt,
  isOwn: comment.is_own ?? comment.isOwn ?? false,
});

/**
 * Add a like to a photo
 * @param photoId The photo ID to like
 */
export const likePhoto = async (photoId: string): Promise<LikeResponse> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await apiClient.post<{ data: any }>(
    `/photos/${photoId}/likes`
  );

  const data = response.data.data;
  return {
    liked: data.liked,
    likeCount: data.like_count ?? data.likeCount,
  };
};

/**
 * Remove a like from a photo
 * @param photoId The photo ID to unlike
 */
export const unlikePhoto = async (photoId: string): Promise<LikeResponse> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await apiClient.delete<{ data: any }>(
    `/photos/${photoId}/likes`
  );

  const data = response.data.data;
  return {
    liked: data.liked,
    likeCount: data.like_count ?? data.likeCount,
  };
};

/**
 * Toggle like status on a photo
 * @param photoId The photo ID
 * @param isCurrentlyLiked Whether the photo is currently liked
 */
export const toggleLike = async (
  photoId: string,
  isCurrentlyLiked: boolean
): Promise<LikeResponse> => {
  if (isCurrentlyLiked) {
    return unlikePhoto(photoId);
  }
  return likePhoto(photoId);
};

/**
 * Get comments for a photo with pagination
 * @param photoId The photo ID
 * @param page Page number (default: 1)
 * @param perPage Items per page (default: 20)
 */
export const getComments = async (
  photoId: string,
  page = 1,
  perPage = 20
): Promise<CommentsResponse> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await apiClient.get<{ data: any }>(
    `/photos/${photoId}/comments`,
    {
      params: { page, per_page: perPage },
    }
  );

  const data = response.data.data;
  return {
    comments: (data.comments || []).map(transformComment),
    pagination: {
      currentPage: data.pagination?.current_page ?? data.pagination?.currentPage ?? page,
      totalPages: data.pagination?.total_pages ?? data.pagination?.totalPages ?? 1,
      totalCount: data.pagination?.total_count ?? data.pagination?.totalCount ?? 0,
      perPage: data.pagination?.per_page ?? data.pagination?.perPage ?? perPage,
    },
  };
};

/**
 * Create a comment on a photo
 * @param photoId The photo ID
 * @param content The comment text
 */
export const createComment = async (
  photoId: string,
  content: string
): Promise<CreateCommentResponse> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await apiClient.post<{ data: any }>(
    `/photos/${photoId}/comments`,
    { content }
  );

  const data = response.data.data;
  return {
    comment: transformComment(data.comment),
    commentCount: data.comment_count ?? data.commentCount,
  };
};

/**
 * Delete a comment
 * @param commentId The comment ID to delete
 */
export const deleteComment = async (
  commentId: string
): Promise<DeleteCommentResponse> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await apiClient.delete<{ data: any }>(
    `/comments/${commentId}`
  );

  const data = response.data.data;
  return {
    message: data.message,
    commentCount: data.comment_count ?? data.commentCount,
  };
};

/**
 * Report inappropriate content
 * @param request The report request data
 */
export const reportContent = async (
  request: CreateReportRequest
): Promise<ReportResponse> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await apiClient.post<{ data: any }>('/reports', {
    reportable_type: request.reportableType,
    reportable_id: request.reportableId,
    reason: request.reason,
  });

  const data = response.data.data;
  return {
    reportId: data.report_id ?? data.reportId,
    message: data.message,
  };
};

/**
 * Social service object for convenience
 */
export const socialService = {
  likePhoto,
  unlikePhoto,
  toggleLike,
  getComments,
  createComment,
  deleteComment,
  reportContent,
};
