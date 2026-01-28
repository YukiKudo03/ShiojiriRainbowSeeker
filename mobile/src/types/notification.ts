/**
 * Notification Types
 *
 * Type definitions for push notifications and notification settings
 */

/**
 * Notification type enum
 */
export type NotificationType = 'rainbow_alert' | 'like' | 'comment' | 'system';

/**
 * Notification item from API
 */
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: NotificationData;
  isRead: boolean;
  createdAt: string;
}

/**
 * Notification data payload
 */
export interface NotificationData {
  // Rainbow alert specific
  location?: {
    lat: number;
    lng: number;
  };
  direction?: string;
  probability?: number;
  estimatedDuration?: number;
  // Social specific
  photoId?: string;
  userId?: string;
  userName?: string;
  // Generic
  [key: string]: unknown;
}

/**
 * Notification settings
 */
export interface NotificationSettings {
  rainbowAlerts: boolean;
  likes: boolean;
  comments: boolean;
  system: boolean;
  alertRadiusKm: 1 | 5 | 10 | 25;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string;
}

/**
 * Alert radius options
 */
export const ALERT_RADIUS_OPTIONS = [
  { value: 1, label: '1 km' },
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 25, label: '25 km' },
] as const;

/**
 * Default notification settings
 */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  rainbowAlerts: true,
  likes: true,
  comments: true,
  system: true,
  alertRadiusKm: 10,
  quietHoursStart: null,
  quietHoursEnd: null,
  timezone: 'Asia/Tokyo',
};

/**
 * Pagination info
 */
export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  perPage: number;
}

/**
 * API response for notification list
 */
export interface NotificationListResponse {
  data: {
    notifications: Notification[];
    pagination: PaginationInfo;
    unreadCount: number;
  };
}

/**
 * API response for mark read
 */
export interface MarkReadResponse {
  data: {
    markedCount: number;
  };
}

/**
 * API response for settings
 */
export interface NotificationSettingsResponse {
  data: {
    settings: NotificationSettings;
  };
}

/**
 * API response for device registration
 */
export interface DeviceRegistrationResponse {
  data: {
    deviceTokenId: string;
    platform: 'ios' | 'android';
  };
}

/**
 * Device registration request
 */
export interface DeviceRegistrationRequest {
  token: string;
  platform: 'ios' | 'android';
}

/**
 * Notification state for store
 */
export interface NotificationState {
  notifications: Notification[];
  settings: NotificationSettings;
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  hasPermission: boolean;
  expoPushToken: string | null;
}

/**
 * Notification actions for store
 */
export interface NotificationActions {
  fetchNotifications: (page?: number, filter?: NotificationType) => Promise<void>;
  markAsRead: (notificationIds?: string[]) => Promise<void>;
  fetchSettings: () => Promise<void>;
  updateSettings: (settings: Partial<NotificationSettings>) => Promise<void>;
  registerDevice: () => Promise<void>;
  unregisterDevice: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
  clearError: () => void;
}
