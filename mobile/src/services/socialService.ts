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

/** Raw comment shape from the API (snake_case or camelCase) */
interface RawComment {
  id: string;
  content: string;
  user: { id: string; display_name?: string; displayName?: string };
  created_at?: string;
  createdAt?: string;
  is_own?: boolean;
  isOwn?: boolean;
}

/** Raw like/unlike response from the API */
interface RawLikeResponse {
  liked: boolean;
  like_count?: number;
  likeCount?: number;
}

/** Raw paginated comments response from the API */
interface RawCommentsResponse {
  comments: RawComment[];
  pagination?: {
    current_page?: number;
    currentPage?: number;
    total_pages?: number;
    totalPages?: number;
    total_count?: number;
    totalCount?: number;
    per_page?: number;
    perPage?: number;
  };
}

/** Raw create-comment response from the API */
interface RawCreateCommentResponse {
  comment: RawComment;
  comment_count?: number;
  commentCount?: number;
}

/** Raw delete-comment response from the API */
interface RawDeleteCommentResponse {
  message: string;
  comment_count?: number;
  commentCount?: number;
}

/** Raw report response from the API */
interface RawReportResponse {
  report_id?: string;
  reportId?: string;
  message: string;
}

/**
 * Transform snake_case API response to camelCase
 */
const transformComment = (comment: RawComment): Comment => ({
  id: comment.id,
  content: comment.content,
  user: {
    id: comment.user.id,
    displayName: comment.user.display_name ?? comment.user.displayName ?? '',
  },
  createdAt: comment.created_at ?? comment.createdAt ?? '',
  isOwn: comment.is_own ?? comment.isOwn ?? false,
});

/**
 * Add a like to a photo
 * @param photoId The photo ID to like
 */
export const likePhoto = async (photoId: string): Promise<LikeResponse> => {
  const response = await apiClient.post<{ data: RawLikeResponse }>(
    `/photos/${photoId}/likes`
  );

  const data = response.data.data;
  return {
    liked: data.liked,
    likeCount: data.like_count ?? data.likeCount ?? 0,
  };
};

/**
 * Remove a like from a photo
 * @param photoId The photo ID to unlike
 */
export const unlikePhoto = async (photoId: string): Promise<LikeResponse> => {
  const response = await apiClient.delete<{ data: RawLikeResponse }>(
    `/photos/${photoId}/likes`
  );

  const data = response.data.data;
  return {
    liked: data.liked,
    likeCount: data.like_count ?? data.likeCount ?? 0,
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
  const response = await apiClient.get<{ data: RawCommentsResponse }>(
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
  const response = await apiClient.post<{ data: RawCreateCommentResponse }>(
    `/photos/${photoId}/comments`,
    { content }
  );

  const data = response.data.data;
  return {
    comment: transformComment(data.comment),
    commentCount: data.comment_count ?? data.commentCount ?? 0,
  };
};

/**
 * Delete a comment
 * @param commentId The comment ID to delete
 */
export const deleteComment = async (
  commentId: string
): Promise<DeleteCommentResponse> => {
  const response = await apiClient.delete<{ data: RawDeleteCommentResponse }>(
    `/comments/${commentId}`
  );

  const data = response.data.data;
  return {
    message: data.message,
    commentCount: data.comment_count ?? data.commentCount ?? 0,
  };
};

/**
 * Report inappropriate content
 * @param request The report request data
 */
export const reportContent = async (
  request: CreateReportRequest
): Promise<ReportResponse> => {
  const response = await apiClient.post<{ data: RawReportResponse }>('/reports', {
    reportable_type: request.reportableType,
    reportable_id: request.reportableId,
    reason: request.reason,
  });

  const data = response.data.data;
  return {
    reportId: data.report_id ?? data.reportId ?? '',
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
