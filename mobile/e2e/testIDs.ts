/**
 * Test IDs for E2E Testing
 *
 * Centralized collection of all testID values used in the app
 * These IDs are used by Detox to find and interact with elements
 *
 * Task 51: Mobile App E2E Tests
 */

export const TestIDs = {
  // Common elements
  common: {
    backButton: 'back-button',
    closeButton: 'close-button',
    loadingIndicator: 'loading-indicator',
    errorMessage: 'error-message',
    successMessage: 'success-message',
  },

  // Onboarding screen
  onboarding: {
    onboardingScreen: 'onboarding-screen',
    skipButton: 'onboarding-skip-button',
    nextButton: 'onboarding-next-button',
    getStartedButton: 'onboarding-get-started-button',
    slideWelcome: 'onboarding-slide-welcome',
    slideCamera: 'onboarding-slide-camera',
    slideGallery: 'onboarding-slide-gallery',
    slideMap: 'onboarding-slide-map',
    slideNotifications: 'onboarding-slide-notifications',
    paginationDots: 'onboarding-pagination-dots',
  },

  // Auth screens
  auth: {
    loginScreen: 'login-screen',
    registerScreen: 'register-screen',
    forgotPasswordScreen: 'forgot-password-screen',
    emailInput: 'auth-email-input',
    passwordInput: 'auth-password-input',
    confirmPasswordInput: 'auth-confirm-password-input',
    displayNameInput: 'auth-display-name-input',
    loginButton: 'login-button',
    registerButton: 'register-button',
    forgotPasswordButton: 'forgot-password-button',
    createAccountLink: 'create-account-link',
    backToLoginLink: 'back-to-login-link',
    errorAlert: 'auth-error-alert',
  },

  // Main navigation
  main: {
    tabBar: 'main-tab-bar',
    feedTab: 'tab-feed',
    cameraTab: 'tab-camera',
    mapTab: 'tab-map',
    profileTab: 'tab-profile',
  },

  // Feed screen
  feed: {
    feedScreen: 'feed-screen',
    photoList: 'photo-list',
    photoItem: 'photo-item', // Append index: photo-item-0, photo-item-1, etc.
    refreshControl: 'feed-refresh-control',
    emptyState: 'feed-empty-state',
    loadMoreIndicator: 'feed-load-more',
  },

  // Photo detail screen
  photo: {
    photoDetailScreen: 'photo-detail-screen',
    photoImage: 'photo-image',
    photoTitle: 'photo-title',
    photoDescription: 'photo-description',
    photoLocation: 'photo-location',
    photoDate: 'photo-date',
    photoWeather: 'photo-weather',
    userInfo: 'photo-user-info',
    userName: 'photo-user-name',
  },

  // Social features
  social: {
    likeButton: 'like-button',
    likeCount: 'like-count',
    commentButton: 'comment-button',
    commentCount: 'comment-count',
    commentList: 'comment-list',
    commentItem: 'comment-item', // Append index: comment-item-0, etc.
    commentInput: 'comment-input',
    submitCommentButton: 'submit-comment-button',
    deleteCommentButton: 'delete-comment-button',
    reportButton: 'report-button',
    reportModal: 'report-modal',
    reportReasonPicker: 'report-reason-picker',
    reportDescription: 'report-description-input',
    submitReportButton: 'submit-report-button',
    cancelReportButton: 'cancel-report-button',
  },

  // Camera screen
  camera: {
    cameraScreen: 'camera-screen',
    cameraView: 'camera-view',
    captureButton: 'capture-button',
    flipCameraButton: 'flip-camera-button',
    flashButton: 'flash-button',
    galleryButton: 'gallery-button',
    permissionDenied: 'camera-permission-denied',
    permissionButton: 'camera-permission-button',
  },

  // Photo upload screen
  upload: {
    uploadScreen: 'upload-screen',
    previewImage: 'upload-preview-image',
    titleInput: 'upload-title-input',
    descriptionInput: 'upload-description-input',
    locationDisplay: 'upload-location-display',
    uploadButton: 'upload-submit-button',
    cancelButton: 'upload-cancel-button',
    uploadProgress: 'upload-progress',
    uploadSuccess: 'upload-success',
    uploadError: 'upload-error',
  },

  // Map screen
  map: {
    mapScreen: 'map-screen',
    mapView: 'map-view',
    photoMarker: 'photo-marker', // Append id: photo-marker-{id}
    markerCallout: 'marker-callout',
    currentLocationButton: 'current-location-button',
    centerUserButton: 'center-user-button',
    centerShiojiriButton: 'center-shiojiri-button',
    heatmapToggleButton: 'heatmap-toggle-button',
    zoomInButton: 'zoom-in-button',
    zoomOutButton: 'zoom-out-button',
    filterButton: 'map-filter-button',
    offlineBanner: 'map-offline-banner',
    regionStatsModal: 'region-stats-modal',
  },

  // Profile screen
  profile: {
    profileScreen: 'profile-screen',
    userAvatar: 'user-avatar',
    userName: 'profile-user-name',
    userHandle: 'profile-user-handle',
    photoCount: 'profile-photo-count',
    followerCount: 'profile-follower-count',
    followingCount: 'profile-following-count',
    editProfileButton: 'edit-profile-button',
    settingsButton: 'settings-button',
    photoGrid: 'profile-photo-grid',
    editProfileScreen: 'edit-profile-screen',
    displayNameInput: 'edit-display-name-input',
    saveProfileButton: 'save-profile-button',
    cancelEditButton: 'cancel-edit-button',
  },

  // Settings screen
  settings: {
    settingsScreen: 'settings-screen',
    notificationSettings: 'notification-settings',
    languageSettings: 'language-settings',
    privacySettings: 'privacy-settings',
    aboutApp: 'about-app',
    logoutButton: 'logout-button',
    deleteAccountButton: 'delete-account-button',
  },

  // Dialogs and modals
  dialog: {
    confirmButton: 'dialog-confirm-button',
    cancelButton: 'dialog-cancel-button',
    closeButton: 'dialog-close-button',
    alertTitle: 'dialog-alert-title',
    alertMessage: 'dialog-alert-message',
  },
} as const;

/**
 * Type for accessing TestIDs with dot notation
 */
export type TestIDCategory = keyof typeof TestIDs;
export type TestIDKey<T extends TestIDCategory> = keyof (typeof TestIDs)[T];
