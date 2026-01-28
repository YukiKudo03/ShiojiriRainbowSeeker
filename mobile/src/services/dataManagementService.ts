/**
 * Data Management Service
 *
 * Provides API calls for privacy-related data management:
 * - Data export request (GDPR compliance)
 * - Account deletion request/cancel
 * - Deletion status check
 *
 * Implements FR-12: Data Export and Deletion requirements
 */

import { apiClient, getErrorMessage } from './apiClient';

import type { ApiResponse } from '../types/auth';

/**
 * Response for data export request
 */
export interface DataExportResponse {
  message: string;
  estimatedTime: string;
}

/**
 * Response for deletion request
 */
export interface DeletionRequestResponse {
  message: string;
  deletionScheduledAt: string;
  gracePeriodDays: number;
}

/**
 * Response for deletion cancellation
 */
export interface DeletionCancelResponse {
  message: string;
}

/**
 * Response for deletion status check
 */
export interface DeletionStatusResponse {
  deletionPending: boolean;
  message?: string;
  deletionRequestedAt?: string;
  deletionScheduledAt?: string;
  daysRemaining?: number;
  canCancel?: boolean;
}

/**
 * Raw API response format (snake_case)
 */
interface RawDeletionStatusResponse {
  deletion_pending: boolean;
  message?: string;
  deletion_requested_at?: string;
  deletion_scheduled_at?: string;
  days_remaining?: number;
  can_cancel?: boolean;
}

interface RawDataExportResponse {
  message: string;
  estimated_time: string;
}

interface RawDeletionRequestResponse {
  message: string;
  deletion_scheduled_at: string;
  grace_period_days: number;
}

/**
 * Data Management Service
 */
export const dataManagementService = {
  /**
   * Request a data export
   * Triggers a background job to collect and package user data.
   * User will receive an email with download link when ready.
   *
   * @returns Promise with export request confirmation
   */
  async requestDataExport(): Promise<DataExportResponse> {
    const response = await apiClient.post<ApiResponse<RawDataExportResponse>>(
      '/users/me/export'
    );

    const data = response.data.data;
    return {
      message: data.message,
      estimatedTime: data.estimated_time,
    };
  },

  /**
   * Request account deletion
   * Initiates a 14-day grace period during which the user
   * can cancel the deletion request.
   *
   * @returns Promise with deletion schedule information
   */
  async requestAccountDeletion(): Promise<DeletionRequestResponse> {
    const response = await apiClient.post<ApiResponse<RawDeletionRequestResponse>>(
      '/users/me/delete'
    );

    const data = response.data.data;
    return {
      message: data.message,
      deletionScheduledAt: data.deletion_scheduled_at,
      gracePeriodDays: data.grace_period_days,
    };
  },

  /**
   * Cancel a pending account deletion request
   * Only possible during the 14-day grace period.
   *
   * @returns Promise with cancellation confirmation
   */
  async cancelAccountDeletion(): Promise<DeletionCancelResponse> {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(
      '/users/me/delete'
    );

    return {
      message: response.data.data.message,
    };
  },

  /**
   * Get the current deletion status
   * Returns whether a deletion is pending and when it's scheduled.
   *
   * @returns Promise with deletion status information
   */
  async getDeletionStatus(): Promise<DeletionStatusResponse> {
    const response = await apiClient.get<ApiResponse<RawDeletionStatusResponse>>(
      '/users/me/deletion_status'
    );

    const data = response.data.data;
    return {
      deletionPending: data.deletion_pending,
      message: data.message,
      deletionRequestedAt: data.deletion_requested_at,
      deletionScheduledAt: data.deletion_scheduled_at,
      daysRemaining: data.days_remaining,
      canCancel: data.can_cancel,
    };
  },
};

/**
 * Export individual functions for direct use
 */
export const {
  requestDataExport,
  requestAccountDeletion,
  cancelAccountDeletion,
  getDeletionStatus,
} = dataManagementService;

/**
 * Export error message helper
 */
export { getErrorMessage };
