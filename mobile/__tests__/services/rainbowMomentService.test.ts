/**
 * Unit Tests for rainbowMomentService
 *
 * Tests API calls for Rainbow Moment endpoints.
 */

import { apiClient } from '../../src/services/apiClient';
import {
  fetchActiveMoments,
  fetchPastMoments,
  fetchMomentDetail,
  triggerDemoMoment,
} from '../../src/services/rainbowMomentService';

jest.mock('../../src/services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedApiClient = jest.mocked(apiClient);

const mockMoment = {
  id: 'moment-1',
  locationId: 'daimon',
  locationName: '大門地区',
  status: 'active',
  startsAt: '2026-04-04T10:00:00Z',
  endsAt: '2026-04-04T10:15:00Z',
  participantsCount: 5,
  photosCount: 2,
  weatherSnapshot: {},
};

describe('rainbowMomentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchActiveMoments', () => {
    it('should call GET /rainbow_moments/active', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: { data: { moments: [mockMoment] } },
      });

      const result = await fetchActiveMoments();

      expect(mockedApiClient.get).toHaveBeenCalledWith('/rainbow_moments/active');
      expect(result).toEqual([mockMoment]);
    });

    it('should return empty array when no active moments', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: { data: { moments: [] } },
      });

      const result = await fetchActiveMoments();
      expect(result).toEqual([]);
    });
  });

  describe('fetchPastMoments', () => {
    it('should call GET /rainbow_moments with pagination params', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: {
          data: { moments: [mockMoment] },
          meta: { currentPage: 1, perPage: 20, totalPages: 1, totalCount: 1 },
        },
      });

      const result = await fetchPastMoments(1, 20);

      expect(mockedApiClient.get).toHaveBeenCalledWith('/rainbow_moments', {
        params: { page: 1, per_page: 20 },
      });
      expect(result.moments).toHaveLength(1);
      expect(result.meta.totalCount).toBe(1);
    });

    it('should include location_id when provided', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: {
          data: { moments: [] },
          meta: { currentPage: 1, perPage: 20, totalPages: 0, totalCount: 0 },
        },
      });

      await fetchPastMoments(1, 20, 'daimon');

      expect(mockedApiClient.get).toHaveBeenCalledWith('/rainbow_moments', {
        params: { page: 1, per_page: 20, location_id: 'daimon' },
      });
    });
  });

  describe('fetchMomentDetail', () => {
    it('should call GET /rainbow_moments/:id', async () => {
      const detailedMoment = { ...mockMoment, participants: [] };
      mockedApiClient.get.mockResolvedValue({
        data: { data: { moment: detailedMoment } },
      });

      const result = await fetchMomentDetail('moment-1');

      expect(mockedApiClient.get).toHaveBeenCalledWith('/rainbow_moments/moment-1');
      expect(result.id).toBe('moment-1');
    });
  });

  describe('triggerDemoMoment', () => {
    it('should call POST /demo/trigger_moment', async () => {
      mockedApiClient.post.mockResolvedValue({
        data: { data: { moment: mockMoment } },
      });

      const result = await triggerDemoMoment();

      expect(mockedApiClient.post).toHaveBeenCalledWith('/demo/trigger_moment', {});
      expect(result.id).toBe('moment-1');
    });

    it('should include location_id when provided', async () => {
      mockedApiClient.post.mockResolvedValue({
        data: { data: { moment: mockMoment } },
      });

      await triggerDemoMoment('hirooka');

      expect(mockedApiClient.post).toHaveBeenCalledWith('/demo/trigger_moment', {
        location_id: 'hirooka',
      });
    });
  });
});
