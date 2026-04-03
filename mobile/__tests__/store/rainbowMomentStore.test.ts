/**
 * Unit Tests for rainbowMomentStore (Zustand)
 *
 * Tests Rainbow Moment state management including active moments,
 * participation, participant counts, and live photos.
 */

import { useRainbowMomentStore } from '../../src/store/rainbowMomentStore';
import type { RainbowMoment, MomentPhoto } from '../../src/store/rainbowMomentStore';

const mockMoment: RainbowMoment = {
  id: 'moment-1',
  locationId: 'daimon',
  locationName: '大門地区',
  status: 'active',
  startsAt: '2026-04-04T10:00:00Z',
  endsAt: '2026-04-04T10:15:00Z',
  participantsCount: 5,
  photosCount: 2,
  weatherSnapshot: { temperature: 18.5, humidity: 72 },
};

const mockPhoto: MomentPhoto = {
  id: 'photo-1',
  user: { id: 'user-1', displayName: 'テストユーザー' },
  thumbnailUrl: 'https://example.com/thumb.jpg',
  latitude: 36.115,
  longitude: 137.954,
  capturedAt: '2026-04-04T10:05:00Z',
};

const resetStore = () => {
  useRainbowMomentStore.getState().reset();
};

describe('rainbowMomentStore', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('initial state', () => {
    it('should have null activeMoment', () => {
      expect(useRainbowMomentStore.getState().activeMoment).toBeNull();
    });

    it('should not be participating', () => {
      expect(useRainbowMomentStore.getState().isParticipating).toBe(false);
    });

    it('should have zero participantCount', () => {
      expect(useRainbowMomentStore.getState().participantCount).toBe(0);
    });

    it('should have empty livePhotos', () => {
      expect(useRainbowMomentStore.getState().livePhotos).toEqual([]);
    });

    it('should have empty pastMoments', () => {
      expect(useRainbowMomentStore.getState().pastMoments).toEqual([]);
    });

    it('should not be loading', () => {
      expect(useRainbowMomentStore.getState().isLoading).toBe(false);
    });
  });

  describe('setActiveMoment', () => {
    it('should set the active moment', () => {
      useRainbowMomentStore.getState().setActiveMoment(mockMoment);
      expect(useRainbowMomentStore.getState().activeMoment).toEqual(mockMoment);
    });

    it('should set participantCount from moment.participantsCount', () => {
      useRainbowMomentStore.getState().setActiveMoment(mockMoment);
      expect(useRainbowMomentStore.getState().participantCount).toBe(5);
    });

    it('should clear livePhotos when setting a new moment', () => {
      useRainbowMomentStore.getState().addLivePhoto(mockPhoto);
      useRainbowMomentStore.getState().setActiveMoment(mockMoment);
      expect(useRainbowMomentStore.getState().livePhotos).toEqual([]);
    });

    it('should handle null (clear active moment)', () => {
      useRainbowMomentStore.getState().setActiveMoment(mockMoment);
      useRainbowMomentStore.getState().setActiveMoment(null);
      expect(useRainbowMomentStore.getState().activeMoment).toBeNull();
      expect(useRainbowMomentStore.getState().participantCount).toBe(0);
    });
  });

  describe('setParticipating', () => {
    it('should set participation to true', () => {
      useRainbowMomentStore.getState().setParticipating(true);
      expect(useRainbowMomentStore.getState().isParticipating).toBe(true);
    });

    it('should set participation to false', () => {
      useRainbowMomentStore.getState().setParticipating(true);
      useRainbowMomentStore.getState().setParticipating(false);
      expect(useRainbowMomentStore.getState().isParticipating).toBe(false);
    });
  });

  describe('updateParticipantCount', () => {
    it('should update the participant count', () => {
      useRainbowMomentStore.getState().updateParticipantCount(12);
      expect(useRainbowMomentStore.getState().participantCount).toBe(12);
    });
  });

  describe('addLivePhoto', () => {
    it('should add a photo to the beginning of the list', () => {
      useRainbowMomentStore.getState().addLivePhoto(mockPhoto);
      expect(useRainbowMomentStore.getState().livePhotos).toHaveLength(1);
      expect(useRainbowMomentStore.getState().livePhotos[0].id).toBe('photo-1');
    });

    it('should prepend new photos', () => {
      const photo2: MomentPhoto = { ...mockPhoto, id: 'photo-2' };
      useRainbowMomentStore.getState().addLivePhoto(mockPhoto);
      useRainbowMomentStore.getState().addLivePhoto(photo2);
      expect(useRainbowMomentStore.getState().livePhotos[0].id).toBe('photo-2');
      expect(useRainbowMomentStore.getState().livePhotos[1].id).toBe('photo-1');
    });

    it('should cap at 50 photos', () => {
      for (let i = 0; i < 55; i++) {
        useRainbowMomentStore.getState().addLivePhoto({ ...mockPhoto, id: `photo-${i}` });
      }
      expect(useRainbowMomentStore.getState().livePhotos).toHaveLength(50);
    });
  });

  describe('clearLivePhotos', () => {
    it('should clear all live photos', () => {
      useRainbowMomentStore.getState().addLivePhoto(mockPhoto);
      useRainbowMomentStore.getState().clearLivePhotos();
      expect(useRainbowMomentStore.getState().livePhotos).toEqual([]);
    });
  });

  describe('updateMomentStatus', () => {
    it('should update active moment status', () => {
      useRainbowMomentStore.getState().setActiveMoment(mockMoment);
      useRainbowMomentStore.getState().updateMomentStatus('closing');
      expect(useRainbowMomentStore.getState().activeMoment?.status).toBe('closing');
    });

    it('should handle null activeMoment gracefully', () => {
      useRainbowMomentStore.getState().updateMomentStatus('closing');
      expect(useRainbowMomentStore.getState().activeMoment).toBeNull();
    });
  });

  describe('setPastMoments', () => {
    it('should set past moments', () => {
      const archived = { ...mockMoment, id: 'past-1', status: 'archived' as const };
      useRainbowMomentStore.getState().setPastMoments([archived]);
      expect(useRainbowMomentStore.getState().pastMoments).toHaveLength(1);
    });
  });

  describe('setLoading', () => {
    it('should set loading state', () => {
      useRainbowMomentStore.getState().setLoading(true);
      expect(useRainbowMomentStore.getState().isLoading).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      useRainbowMomentStore.getState().setActiveMoment(mockMoment);
      useRainbowMomentStore.getState().setParticipating(true);
      useRainbowMomentStore.getState().addLivePhoto(mockPhoto);
      useRainbowMomentStore.getState().setLoading(true);

      useRainbowMomentStore.getState().reset();

      const state = useRainbowMomentStore.getState();
      expect(state.activeMoment).toBeNull();
      expect(state.isParticipating).toBe(false);
      expect(state.participantCount).toBe(0);
      expect(state.livePhotos).toEqual([]);
      expect(state.pastMoments).toEqual([]);
      expect(state.isLoading).toBe(false);
    });
  });
});
