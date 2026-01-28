/**
 * User Service
 *
 * Handles user profile management:
 * - Get user profile with stats
 * - Update user profile (display name, profile image)
 *
 * Requirements: FR-9 (AC-9.1, AC-9.2)
 */

import { apiClient } from './apiClient';

import type { User } from '../types/auth';

/**
 * User profile with extended information
 */
export interface UserProfile extends User {
  profileImageUrl?: string;
  stats: {
    photosCount: number;
    totalLikesReceived: number;
  };
}

/**
 * User profile update request
 */
export interface UpdateProfileRequest {
  displayName?: string;
  profileImage?: {
    uri: string;
    type: string;
    name: string;
  };
}

/**
 * Get current user's profile with stats
 * Requirements: FR-9 (AC-9.1)
 * @returns User profile with stats
 */
export async function getMyProfile(): Promise<UserProfile> {
  const response = await apiClient.get<{ data: {
    id: string;
    email: string;
    display_name: string;
    profile_image_url?: string;
    role: 'user' | 'admin';
    locale: 'ja' | 'en';
    confirmed: boolean;
    created_at: string;
    stats: {
      photos_count: number;
      total_likes_received: number;
    };
  } }>('/users/me');

  const data = response.data.data;

  return {
    id: data.id,
    email: data.email,
    displayName: data.display_name,
    profileImageUrl: data.profile_image_url,
    role: data.role,
    locale: data.locale,
    confirmed: data.confirmed,
    createdAt: data.created_at,
    stats: {
      photosCount: data.stats.photos_count,
      totalLikesReceived: data.stats.total_likes_received,
    },
  };
}

/**
 * Update current user's profile
 * Requirements: FR-9 (AC-9.2)
 * @param request Update request with display name and/or profile image
 * @returns Updated user profile
 */
export async function updateMyProfile(
  request: UpdateProfileRequest
): Promise<UserProfile> {
  const formData = new FormData();

  if (request.displayName) {
    formData.append('user[display_name]', request.displayName);
  }

  if (request.profileImage) {
    // @ts-expect-error - FormData.append accepts this format in React Native
    formData.append('user[profile_image]', {
      uri: request.profileImage.uri,
      type: request.profileImage.type,
      name: request.profileImage.name,
    });
  }

  const response = await apiClient.patch<{ data: {
    id: string;
    email: string;
    display_name: string;
    profile_image_url?: string;
    role: 'user' | 'admin';
    locale: 'ja' | 'en';
    confirmed: boolean;
    created_at: string;
    stats: {
      photos_count: number;
      total_likes_received: number;
    };
  } }>('/users/me', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  const data = response.data.data;

  return {
    id: data.id,
    email: data.email,
    displayName: data.display_name,
    profileImageUrl: data.profile_image_url,
    role: data.role,
    locale: data.locale,
    confirmed: data.confirmed,
    createdAt: data.created_at,
    stats: {
      photosCount: data.stats.photos_count,
      totalLikesReceived: data.stats.total_likes_received,
    },
  };
}

/**
 * Validate display name
 * Requirements: FR-9 (AC-9.2) - 3-30 characters
 * @param displayName The display name to validate
 * @returns Validation result with error message if invalid
 */
export function validateDisplayName(displayName: string): {
  isValid: boolean;
  error?: string;
} {
  const trimmed = displayName.trim();

  if (trimmed.length < 3) {
    return {
      isValid: false,
      error: '表示名は3文字以上で入力してください',
    };
  }

  if (trimmed.length > 30) {
    return {
      isValid: false,
      error: '表示名は30文字以内で入力してください',
    };
  }

  return { isValid: true };
}
