/**
 * Rainbow Moment Service
 *
 * API calls for Rainbow Moment endpoints.
 */

import { apiClient } from './apiClient';
import type { RainbowMoment } from '../store/rainbowMomentStore';

interface PaginationMeta {
  currentPage: number;
  perPage: number;
  totalPages: number;
  totalCount: number;
}

interface MomentsListResponse {
  data: { moments: RainbowMoment[] };
  meta: PaginationMeta;
}

interface ActiveMomentsResponse {
  data: { moments: RainbowMoment[] };
}

interface MomentDetailResponse {
  data: {
    moment: RainbowMoment & {
      participants?: Array<{ id: string; displayName: string; joinedAt: string }>;
    };
  };
}

/**
 * Fetch active rainbow moments.
 */
export async function fetchActiveMoments(): Promise<RainbowMoment[]> {
  const response = await apiClient.get<ActiveMomentsResponse>('/rainbow_moments/active');
  return response.data.data.moments;
}

/**
 * Fetch past rainbow moments with pagination.
 */
export async function fetchPastMoments(
  page = 1,
  perPage = 20,
  locationId?: string
): Promise<{ moments: RainbowMoment[]; meta: PaginationMeta }> {
  const params: Record<string, string | number> = { page, per_page: perPage };
  if (locationId) params.location_id = locationId;

  const response = await apiClient.get<MomentsListResponse>('/rainbow_moments', { params });
  return { moments: response.data.data.moments, meta: response.data.meta };
}

/**
 * Fetch a single rainbow moment detail.
 */
export async function fetchMomentDetail(momentId: string): Promise<MomentDetailResponse['data']['moment']> {
  const response = await apiClient.get<MomentDetailResponse>(`/rainbow_moments/${momentId}`);
  return response.data.data.moment;
}

/**
 * Trigger a demo rainbow moment (dev/staging only).
 */
export async function triggerDemoMoment(locationId?: string): Promise<RainbowMoment> {
  const response = await apiClient.post<{ data: { moment: RainbowMoment } }>(
    '/demo/trigger_moment',
    locationId ? { location_id: locationId } : {}
  );
  return response.data.data.moment;
}
