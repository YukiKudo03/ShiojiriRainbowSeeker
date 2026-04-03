/**
 * Store index
 */

export {
  useAuthStore,
  selectUser,
  selectIsAuthenticated,
  selectIsLoading,
  selectIsInitialized,
  selectError,
  useIsAuthenticated,
  useCurrentUser,
  useAuthLoading,
  useAuthError,
  useIsInitialized,
} from './authStore';

export {
  useOnboardingStore,
  selectIsOnboardingCompleted,
  selectIsOnboardingInitialized,
  selectIsOnboardingLoading,
  useIsOnboardingCompleted,
  useIsOnboardingInitialized,
  useIsOnboardingLoading,
} from './onboardingStore';

export {
  useUploadQueueStore,
  usePendingUploadCount,
  useFailedUploadCount,
} from './uploadQueueStore';
export type { QueuedUpload, UploadStatus } from './uploadQueueStore';

export {
  useRainbowMomentStore,
  useActiveMoment,
  useIsParticipating,
  useParticipantCount,
  useLivePhotos,
  selectActiveMoment,
  selectIsParticipating,
  selectParticipantCount,
  selectLivePhotos,
} from './rainbowMomentStore';
export type { RainbowMoment, MomentPhoto } from './rainbowMomentStore';
