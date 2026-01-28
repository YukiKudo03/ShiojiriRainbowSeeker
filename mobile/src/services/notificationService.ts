/**
 * Notification Service
 *
 * Handles push notification registration, receiving, and settings management.
 * Uses expo-notifications for cross-platform (iOS/Android) support.
 *
 * Features:
 * - Device token registration with backend
 * - Push notification permission handling
 * - Notification settings management
 * - Background notification handling
 */

import { Platform } from 'react-native';

import * as Notifications from 'expo-notifications';

import { apiClient } from './apiClient';

import type {
  NotificationSettings,
  MarkReadResponse,
  DeviceRegistrationResponse,
  NotificationType,
  Notification,
} from '../types/notification';

/**
 * Configure notification handler for foreground notifications
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Get the platform identifier for device registration
 */
const getPlatform = (): 'ios' | 'android' => {
  return Platform.OS === 'ios' ? 'ios' : 'android';
};

/**
 * Request notification permissions from the user
 * @returns true if permission granted, false otherwise
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') {
    return true;
  }

  // Request permission if not already granted
  const { status } = await Notifications.requestPermissionsAsync();

  return status === 'granted';
};

/**
 * Get the Expo push token for this device
 * @returns The Expo push token string or null if unavailable
 */
export const getExpoPushToken = async (): Promise<string | null> => {
  try {
    // Get the Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });

    return tokenData.data;
  } catch (error) {
    console.error('Failed to get push token:', error);
    return null;
  }
};

/**
 * Register device token with the backend
 * @param token The push notification token
 */
export const registerDeviceToken = async (token: string): Promise<DeviceRegistrationResponse> => {
  const response = await apiClient.post<DeviceRegistrationResponse>('/notifications/devices', {
    token,
    platform: getPlatform(),
  });

  return response.data;
};

/**
 * Unregister device token from the backend
 * @param token The push notification token to unregister
 */
export const unregisterDeviceToken = async (token: string): Promise<void> => {
  await apiClient.delete('/notifications/devices', {
    data: { token },
  });
};

/**
 * Fetch notifications from the API
 * @param page Page number (default: 1)
 * @param perPage Items per page (default: 20)
 * @param filter Optional filter type
 */
export const fetchNotifications = async (
  page = 1,
  perPage = 20,
  filter?: NotificationType
): Promise<{
  notifications: Notification[];
  pagination: { currentPage: number; totalPages: number; totalCount: number; perPage: number };
  unreadCount: number;
}> => {
  const params: Record<string, string | number> = { page, per_page: perPage };
  if (filter) {
    params.filter = filter;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await apiClient.get<{ data: any }>('/notifications', { params });

  // Transform snake_case to camelCase
  const data = response.data.data;
  return {
    notifications: (data.notifications || []).map(transformNotification),
    pagination: {
      currentPage: data.pagination?.current_page ?? data.pagination?.currentPage ?? 1,
      totalPages: data.pagination?.total_pages ?? data.pagination?.totalPages ?? 1,
      totalCount: data.pagination?.total_count ?? data.pagination?.totalCount ?? 0,
      perPage: data.pagination?.per_page ?? data.pagination?.perPage ?? 20,
    },
    unreadCount: data.unread_count ?? data.unreadCount ?? 0,
  };
};

/**
 * Transform notification from API response to local type
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transformNotification = (notification: any): Notification => ({
  id: notification.id,
  type: notification.type,
  title: notification.title,
  body: notification.body,
  data: notification.data || {},
  isRead: notification.is_read ?? notification.isRead ?? false,
  createdAt: notification.created_at ?? notification.createdAt,
});

/**
 * Mark notifications as read
 * @param notificationIds Array of notification IDs to mark as read. If empty, marks all as read.
 */
export const markNotificationsAsRead = async (notificationIds?: string[]): Promise<number> => {
  const response = await apiClient.post<MarkReadResponse>('/notifications/mark_read', {
    notification_ids: notificationIds,
  });

  return response.data.data.markedCount;
};

/**
 * Get notification settings from the API
 */
export const getNotificationSettings = async (): Promise<NotificationSettings> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await apiClient.get<{ data: { settings: any } }>('/notifications/settings');

  const settings = response.data.data.settings;

  // Transform snake_case to camelCase
  return {
    rainbowAlerts: settings.rainbow_alerts ?? settings.rainbowAlerts ?? true,
    likes: settings.likes ?? true,
    comments: settings.comments ?? true,
    system: settings.system ?? true,
    alertRadiusKm: settings.alert_radius_km ?? settings.alertRadiusKm ?? 10,
    quietHoursStart: settings.quiet_hours_start ?? settings.quietHoursStart ?? null,
    quietHoursEnd: settings.quiet_hours_end ?? settings.quietHoursEnd ?? null,
    timezone: settings.timezone ?? 'Asia/Tokyo',
  };
};

/**
 * Update notification settings
 * @param settings Partial settings to update
 */
export const updateNotificationSettings = async (
  settings: Partial<NotificationSettings>
): Promise<NotificationSettings> => {
  // Transform camelCase to snake_case for API
  const apiSettings: Record<string, unknown> = {};

  if (settings.rainbowAlerts !== undefined) apiSettings.rainbow_alerts = settings.rainbowAlerts;
  if (settings.likes !== undefined) apiSettings.likes = settings.likes;
  if (settings.comments !== undefined) apiSettings.comments = settings.comments;
  if (settings.system !== undefined) apiSettings.system = settings.system;
  if (settings.alertRadiusKm !== undefined) apiSettings.alert_radius_km = settings.alertRadiusKm;
  if (settings.quietHoursStart !== undefined) apiSettings.quiet_hours_start = settings.quietHoursStart;
  if (settings.quietHoursEnd !== undefined) apiSettings.quiet_hours_end = settings.quietHoursEnd;
  if (settings.timezone !== undefined) apiSettings.timezone = settings.timezone;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await apiClient.put<{ data: { settings: any } }>('/notifications/settings', apiSettings);

  const responseSettings = response.data.data.settings;

  return {
    rainbowAlerts: responseSettings.rainbow_alerts ?? responseSettings.rainbowAlerts ?? true,
    likes: responseSettings.likes ?? true,
    comments: responseSettings.comments ?? true,
    system: responseSettings.system ?? true,
    alertRadiusKm: responseSettings.alert_radius_km ?? responseSettings.alertRadiusKm ?? 10,
    quietHoursStart: responseSettings.quiet_hours_start ?? responseSettings.quietHoursStart ?? null,
    quietHoursEnd: responseSettings.quiet_hours_end ?? responseSettings.quietHoursEnd ?? null,
    timezone: responseSettings.timezone ?? 'Asia/Tokyo',
  };
};

/**
 * Set up notification listeners
 * @param onNotificationReceived Callback for when a notification is received
 * @param onNotificationResponse Callback for when user interacts with a notification
 * @returns Cleanup function to remove listeners
 */
export const setupNotificationListeners = (
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationResponse?: (response: Notifications.NotificationResponse) => void
): (() => void) => {
  const subscriptions: Notifications.EventSubscription[] = [];

  // Listen for notifications received while app is in foreground
  if (onNotificationReceived) {
    const receivedSubscription = Notifications.addNotificationReceivedListener(onNotificationReceived);
    subscriptions.push(receivedSubscription);
  }

  // Listen for user interactions with notifications
  if (onNotificationResponse) {
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(onNotificationResponse);
    subscriptions.push(responseSubscription);
  }

  // Return cleanup function
  return () => {
    subscriptions.forEach((subscription) => subscription.remove());
  };
};

/**
 * Get the last notification response (for handling app launch via notification)
 */
export const getLastNotificationResponse = async (): Promise<Notifications.NotificationResponse | null> => {
  return Notifications.getLastNotificationResponseAsync();
};

/**
 * Get the current badge count
 */
export const getBadgeCount = async (): Promise<number> => {
  return Notifications.getBadgeCountAsync();
};

/**
 * Set the badge count
 * @param count The badge count to set
 */
export const setBadgeCount = async (count: number): Promise<void> => {
  await Notifications.setBadgeCountAsync(count);
};

/**
 * Clear all delivered notifications
 */
export const clearAllNotifications = async (): Promise<void> => {
  await Notifications.dismissAllNotificationsAsync();
};

/**
 * Schedule a local notification (for testing or reminders)
 * @param title Notification title
 * @param body Notification body
 * @param data Optional data payload
 * @param trigger When to show the notification
 */
export const scheduleLocalNotification = async (
  title: string,
  body: string,
  data?: Record<string, unknown>,
  trigger?: Notifications.NotificationTriggerInput
): Promise<string> => {
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
    },
    trigger: trigger ?? null, // null = immediate
  });
};

/**
 * Cancel a scheduled notification
 * @param notificationId The notification identifier to cancel
 */
export const cancelScheduledNotification = async (notificationId: string): Promise<void> => {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
};

/**
 * Cancel all scheduled notifications
 */
export const cancelAllScheduledNotifications = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};

/**
 * Notification service object for convenience
 */
export const notificationService = {
  requestPermission: requestNotificationPermission,
  getExpoPushToken,
  registerDeviceToken,
  unregisterDeviceToken,
  fetchNotifications,
  markAsRead: markNotificationsAsRead,
  getSettings: getNotificationSettings,
  updateSettings: updateNotificationSettings,
  setupListeners: setupNotificationListeners,
  getLastResponse: getLastNotificationResponse,
  getBadgeCount,
  setBadgeCount,
  clearAll: clearAllNotifications,
  scheduleLocal: scheduleLocalNotification,
  cancelScheduled: cancelScheduledNotification,
  cancelAllScheduled: cancelAllScheduledNotifications,
};
