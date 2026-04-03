/**
 * Rainbow Moment Store
 *
 * Zustand store for managing Rainbow Moment state.
 * Tracks active moments, participation status, and real-time counts.
 */

import { create } from 'zustand';

export interface RainbowMoment {
  id: string;
  locationId: string;
  locationName: string;
  status: 'active' | 'closing' | 'archived';
  startsAt: string;
  endsAt: string;
  participantsCount: number;
  photosCount: number;
  weatherSnapshot: Record<string, unknown>;
}

export interface MomentPhoto {
  id: string;
  user: { id: string; displayName: string };
  thumbnailUrl: string | null;
  latitude: number;
  longitude: number;
  capturedAt: string;
}

interface RainbowMomentState {
  /** Currently active moment (if any) */
  activeMoment: RainbowMoment | null;
  /** Whether the current user is participating */
  isParticipating: boolean;
  /** Real-time participant count */
  participantCount: number;
  /** Photos streamed during the moment */
  livePhotos: MomentPhoto[];
  /** Past moments for the archive */
  pastMoments: RainbowMoment[];
  /** Loading state */
  isLoading: boolean;
}

interface RainbowMomentActions {
  setActiveMoment: (moment: RainbowMoment | null) => void;
  setParticipating: (participating: boolean) => void;
  updateParticipantCount: (count: number) => void;
  addLivePhoto: (photo: MomentPhoto) => void;
  clearLivePhotos: () => void;
  updateMomentStatus: (status: 'active' | 'closing' | 'archived') => void;
  setPastMoments: (moments: RainbowMoment[]) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

const initialState: RainbowMomentState = {
  activeMoment: null,
  isParticipating: false,
  participantCount: 0,
  livePhotos: [],
  pastMoments: [],
  isLoading: false,
};

export const useRainbowMomentStore = create<RainbowMomentState & RainbowMomentActions>(
  (set) => ({
    ...initialState,

    setActiveMoment: (moment) =>
      set({
        activeMoment: moment,
        participantCount: moment?.participantsCount ?? 0,
        livePhotos: [],
      }),

    setParticipating: (participating) => set({ isParticipating: participating }),

    updateParticipantCount: (count) => set({ participantCount: count }),

    addLivePhoto: (photo) =>
      set((state) => ({
        livePhotos: [photo, ...state.livePhotos].slice(0, 50), // Keep last 50
      })),

    clearLivePhotos: () => set({ livePhotos: [] }),

    updateMomentStatus: (status) =>
      set((state) => ({
        activeMoment: state.activeMoment
          ? { ...state.activeMoment, status }
          : null,
      })),

    setPastMoments: (moments) => set({ pastMoments: moments }),

    setLoading: (loading) => set({ isLoading: loading }),

    reset: () => set(initialState),
  })
);

// Selectors
export const selectActiveMoment = (state: RainbowMomentState & RainbowMomentActions) =>
  state.activeMoment;
export const selectIsParticipating = (state: RainbowMomentState & RainbowMomentActions) =>
  state.isParticipating;
export const selectParticipantCount = (state: RainbowMomentState & RainbowMomentActions) =>
  state.participantCount;
export const selectLivePhotos = (state: RainbowMomentState & RainbowMomentActions) =>
  state.livePhotos;

// Hooks
export const useActiveMoment = () => useRainbowMomentStore(selectActiveMoment);
export const useIsParticipating = () => useRainbowMomentStore(selectIsParticipating);
export const useParticipantCount = () => useRainbowMomentStore(selectParticipantCount);
export const useLivePhotos = () => useRainbowMomentStore(selectLivePhotos);
