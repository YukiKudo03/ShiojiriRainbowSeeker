/**
 * Unit Tests for dataManagementService
 *
 * Tests privacy-related data management API calls:
 * data export, account deletion, cancellation, and status checks.
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
  requestDataExport,
  requestAccountDeletion,
  cancelAccountDeletion,
  getDeletionStatus,
} from '../../src/services/dataManagementService';

const mockedApiClient = jest.mocked(apiClient);

describe('dataManagementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------
  // requestDataExport
  // -------------------------------------------------------------------
  describe('requestDataExport', () => {
    it('should post to export endpoint and transform response', async () => {
      mockedApiClient.post.mockResolvedValue({
        data: {
          data: {
            message: 'Data export has been queued',
            estimated_time: '24 hours',
          },
        },
      });

      const result = await requestDataExport();

      expect(mockedApiClient.post).toHaveBeenCalledWith('/users/me/export');
      expect(result).toEqual({
        message: 'Data export has been queued',
        estimatedTime: '24 hours',
      });
    });
  });

  // -------------------------------------------------------------------
  // requestAccountDeletion
  // -------------------------------------------------------------------
  describe('requestAccountDeletion', () => {
    it('should post to delete endpoint and transform snake_case response', async () => {
      mockedApiClient.post.mockResolvedValue({
        data: {
          data: {
            message: 'Account deletion scheduled',
            deletion_scheduled_at: '2026-03-21T00:00:00Z',
            grace_period_days: 14,
          },
        },
      });

      const result = await requestAccountDeletion();

      expect(mockedApiClient.post).toHaveBeenCalledWith('/users/me/delete');
      expect(result).toEqual({
        message: 'Account deletion scheduled',
        deletionScheduledAt: '2026-03-21T00:00:00Z',
        gracePeriodDays: 14,
      });
    });
  });

  // -------------------------------------------------------------------
  // cancelAccountDeletion
  // -------------------------------------------------------------------
  describe('cancelAccountDeletion', () => {
    it('should delete to cancel deletion and return message', async () => {
      mockedApiClient.delete.mockResolvedValue({
        data: {
          data: {
            message: 'Account deletion cancelled',
          },
        },
      });

      const result = await cancelAccountDeletion();

      expect(mockedApiClient.delete).toHaveBeenCalledWith('/users/me/delete');
      expect(result).toEqual({
        message: 'Account deletion cancelled',
      });
    });
  });

  // -------------------------------------------------------------------
  // getDeletionStatus
  // -------------------------------------------------------------------
  describe('getDeletionStatus', () => {
    it('should fetch and transform all snake_case fields', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: {
          data: {
            deletion_pending: true,
            message: 'Deletion scheduled',
            deletion_requested_at: '2026-03-07T00:00:00Z',
            deletion_scheduled_at: '2026-03-21T00:00:00Z',
            days_remaining: 14,
            can_cancel: true,
          },
        },
      });

      const result = await getDeletionStatus();

      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/users/me/deletion_status'
      );
      expect(result).toEqual({
        deletionPending: true,
        message: 'Deletion scheduled',
        deletionRequestedAt: '2026-03-07T00:00:00Z',
        deletionScheduledAt: '2026-03-21T00:00:00Z',
        daysRemaining: 14,
        canCancel: true,
      });
    });

    it('should handle non-pending deletion status', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: {
          data: {
            deletion_pending: false,
            message: 'No pending deletion',
          },
        },
      });

      const result = await getDeletionStatus();

      expect(result.deletionPending).toBe(false);
      expect(result.message).toBe('No pending deletion');
      expect(result.deletionRequestedAt).toBeUndefined();
      expect(result.daysRemaining).toBeUndefined();
      expect(result.canCancel).toBeUndefined();
    });
  });
});
