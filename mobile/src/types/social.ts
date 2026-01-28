/**
 * Social Features Type Definitions
 *
 * Types for likes, comments, and reports functionality.
 * Requirements: FR-8 (Social Features)
 */

/**
 * User information in social context
 */
export interface SocialUser {
  id: string;
  displayName: string;
}

/**
 * Comment on a photo
 */
export interface Comment {
  id: string;
  content: string;
  user: SocialUser;
  createdAt: string;
  isOwn: boolean;
}

/**
 * Like/Unlike response
 */
export interface LikeResponse {
  liked: boolean;
  likeCount: number;
}

/**
 * Paginated comments response
 */
export interface CommentsResponse {
  comments: Comment[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    perPage: number;
  };
}

/**
 * Create comment response
 */
export interface CreateCommentResponse {
  comment: Comment;
  commentCount: number;
}

/**
 * Delete comment response
 */
export interface DeleteCommentResponse {
  message: string;
  commentCount: number;
}

/**
 * Report types
 */
export type ReportableType = 'Photo' | 'Comment';

/**
 * Create report request
 */
export interface CreateReportRequest {
  reportableType: ReportableType;
  reportableId: string;
  reason: string;
}

/**
 * Report response
 */
export interface ReportResponse {
  reportId: string;
  message: string;
}

/**
 * Photo with social information
 * Updated to match backend PhotoService response format
 */
export interface PhotoWithSocial {
  id: string;
  title?: string;
  description?: string;
  capturedAt: string;
  location: {
    latitude: number;
    longitude: number;
    name?: string;
  } | null;
  imageUrls: {
    thumbnail: string;
    medium: string;
    large?: string;
    original?: string;
  };
  createdAt: string;
  user: SocialUser;
  likeCount: number;
  commentCount: number;
  likedByCurrentUser: boolean;
  isOwner: boolean;
  weatherSummary?: {
    temperature?: number;
    humidity?: number;
    weatherDescription?: string;
  };
}

/**
 * Comment form data
 */
export interface CommentFormData {
  content: string;
}

/**
 * Report form data
 */
export interface ReportFormData {
  reason: string;
}

/**
 * Report reason options
 */
export const REPORT_REASONS = [
  { label: '不適切なコンテンツ', value: 'inappropriate_content' },
  { label: 'スパム・広告', value: 'spam' },
  { label: '著作権侵害', value: 'copyright' },
  { label: 'その他', value: 'other' },
] as const;

/**
 * Maximum comment length
 */
export const MAX_COMMENT_LENGTH = 500;
