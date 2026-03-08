/**
 * Unit Tests for notificationService
 *
 * Tests notification API calls: device registration, fetching,
 * marking read, and settings management.
 * apiClient and expo-notifications are mocked.
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

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  addNotificationReceivedListener: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(),
  getBadgeCountAsync: jest.fn(),
  setBadgeCountAsync: jest.fn(),
  dismissAllNotificationsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
}));

// Mock react-native Platform
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

import * as Notifications from 'expo-notifications';
import { apiClient } from '../../src/services/apiClient';
import {
  registerDeviceToken,
  unregisterDeviceToken,
  fetchNotifications,
  markNotificationsAsRead,
  getNotificationSettings,
  updateNotificationSettings,
  requestNotificationPermission,
  getExpoPushToken,
  setupNotificationListeners,
  getBadgeCount,
  setBadgeCount,
  scheduleLocalNotification,
  cancelScheduledNotification,
  cancelAllScheduledNotifications,
  clearAllNotifications,
  getLastNotificationResponse,
} from '../../src/services/notificationService';

const mockedApiClient = jest.mocked(apiClient);
const mockedNotifications = jest.mocked(Notifications);

describe('notificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------
  // registerDeviceToken
  // -------------------------------------------------------------------
  describe('registerDeviceToken', () => {
    it('should post device token with platform', async () => {
      mockedApiClient.post.mockResolvedValue({
        data: {
          data: {
            deviceTokenId: 'device-123',
            platform: 'ios',
          },
        },
      });

      const result = await registerDeviceToken('expo-push-token-abc');

      expect(mockedApiClient.post).toHaveBeenCalledWith(
        '/notifications/devices',
        {
          token: 'expo-push-token-abc',
          platform: 'ios',
        }
      );
      expect(result).toEqual({
        data: {
          deviceTokenId: 'device-123',
          platform: 'ios',
        },
      });
    });
  });

  // -------------------------------------------------------------------
  // unregisterDeviceToken
  // -------------------------------------------------------------------
  describe('unregisterDeviceToken', () => {
    it('should delete device token', async () => {
      mockedApiClient.delete.mockResolvedValue({ data: {} });

      await unregisterDeviceToken('expo-push-token-abc');

      expect(mockedApiClient.delete).toHaveBeenCalledWith(
        '/notifications/devices',
        { data: { token: 'expo-push-token-abc' } }
      );
    });
  });

  // -------------------------------------------------------------------
  // fetchNotifications
  // -------------------------------------------------------------------
  describe('fetchNotifications', () => {
    it('should fetch and transform snake_case notifications with pagination', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: {
          data: {
            notifications: [
              {
                id: 'notif-1',
                type: 'rainbow_alert',
                title: 'Rainbow Spotted!',
                body: 'A rainbow was seen near Shiojiri',
                is_read: false,
                created_at: '2026-03-07T10:00:00Z',
              },
            ],
            pagination: {
              current_page: 1,
              total_pages: 5,
              total_count: 50,
              per_page: 10,
            },
            unread_count: 3,
          },
        },
      });

      const result = await fetchNotifications(1, 10);

      expect(mockedApiClient.get).toHaveBeenCalledWith('/notifications', {
        params: { page: 1, per_page: 10 },
      });

      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]).toEqual({
        id: 'notif-1',
        type: 'rainbow_alert',
        title: 'Rainbow Spotted!',
        body: 'A rainbow was seen near Shiojiri',
        data: {},
        isRead: false,
        createdAt: '2026-03-07T10:00:00Z',
      });
      expect(result.pagination).toEqual({
        currentPage: 1,
        totalPages: 5,
        totalCount: 50,
        perPage: 10,
      });
      expect(result.unreadCount).toBe(3);
    });

    it('should pass filter param when provided', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: {
          data: {
            notifications: [],
            pagination: {},
            unread_count: 0,
          },
        },
      });

      await fetchNotifications(1, 20, 'like');

      expect(mockedApiClient.get).toHaveBeenCalledWith('/notifications', {
        params: { page: 1, per_page: 20, filter: 'like' },
      });
    });
  });

  // -------------------------------------------------------------------
  // markNotificationsAsRead
  // -------------------------------------------------------------------
  describe('markNotificationsAsRead', () => {
    it('should post notification IDs and return marked count', async () => {
      mockedApiClient.post.mockResolvedValue({
        data: {
          data: {
            markedCount: 3,
          },
        },
      });

      const result = await markNotificationsAsRead([
        'notif-1',
        'notif-2',
        'notif-3',
      ]);

      expect(mockedApiClient.post).toHaveBeenCalledWith(
        '/notifications/mark_read',
        { notification_ids: ['notif-1', 'notif-2', 'notif-3'] }
      );
      expect(result).toBe(3);
    });
  });

  // -------------------------------------------------------------------
  // getNotificationSettings
  // -------------------------------------------------------------------
  describe('getNotificationSettings', () => {
    it('should fetch and transform snake_case settings', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: {
          data: {
            settings: {
              rainbow_alerts: true,
              likes: false,
              comments: true,
              system: true,
              alert_radius_km: 25,
              quiet_hours_start: '22:00',
              quiet_hours_end: '07:00',
              timezone: 'Asia/Tokyo',
            },
          },
        },
      });

      const result = await getNotificationSettings();

      expect(result).toEqual({
        rainbowAlerts: true,
        likes: false,
        comments: true,
        system: true,
        alertRadiusKm: 25,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        timezone: 'Asia/Tokyo',
      });
    });
  });

  // -------------------------------------------------------------------
  // updateNotificationSettings
  // -------------------------------------------------------------------
  describe('updateNotificationSettings', () => {
    it('should transform camelCase to snake_case for API and return transformed response', async () => {
      mockedApiClient.put.mockResolvedValue({
        data: {
          data: {
            settings: {
              rainbow_alerts: false,
              likes: true,
              comments: true,
              system: true,
              alert_radius_km: 5,
              quiet_hours_start: null,
              quiet_hours_end: null,
              timezone: 'Asia/Tokyo',
            },
          },
        },
      });

      const result = await updateNotificationSettings({
        rainbowAlerts: false,
        alertRadiusKm: 5,
      });

      expect(mockedApiClient.put).toHaveBeenCalledWith(
        '/notifications/settings',
        {
          rainbow_alerts: false,
          alert_radius_km: 5,
        }
      );
      expect(result.rainbowAlerts).toBe(false);
      expect(result.alertRadiusKm).toBe(5);
    });
  });

  // -------------------------------------------------------------------
  // requestNotificationPermission
  // -------------------------------------------------------------------
  describe('requestNotificationPermission', () => {
    it('should return true when already granted', async () => {
      mockedNotifications.getPermissionsAsync.mockResolvedValue({
        status: 'granted',
      } as any);

      const result = await requestNotificationPermission();

      expect(result).toBe(true);
      expect(mockedNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    });

    it('should request permission and return result', async () => {
      mockedNotifications.getPermissionsAsync.mockResolvedValue({
        status: 'undetermined',
      } as any);
      mockedNotifications.requestPermissionsAsync.mockResolvedValue({
        status: 'granted',
      } as any);

      const result = await requestNotificationPermission();

      expect(result).toBe(true);
      expect(mockedNotifications.requestPermissionsAsync).toHaveBeenCalled();
    });

    it('should return false when permission denied', async () => {
      mockedNotifications.getPermissionsAsync.mockResolvedValue({
        status: 'undetermined',
      } as any);
      mockedNotifications.requestPermissionsAsync.mockResolvedValue({
        status: 'denied',
      } as any);

      const result = await requestNotificationPermission();

      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------
  // getExpoPushToken
  // -------------------------------------------------------------------
  describe('getExpoPushToken', () => {
    it('should return push token on success', async () => {
      mockedNotifications.getExpoPushTokenAsync.mockResolvedValue({
        data: 'ExponentPushToken[abc123]',
        type: 'expo',
      });

      const token = await getExpoPushToken();

      expect(token).toBe('ExponentPushToken[abc123]');
    });

    it('should return null on error', async () => {
      mockedNotifications.getExpoPushTokenAsync.mockRejectedValue(
        new Error('No project ID')
      );

      const token = await getExpoPushToken();

      expect(token).toBeNull();
    });
  });

  // -------------------------------------------------------------------
  // setupNotificationListeners
  // -------------------------------------------------------------------
  describe('setupNotificationListeners', () => {
    it('should register received listener', () => {
      const onReceived = jest.fn();
      const mockSubscription = { remove: jest.fn() };
      mockedNotifications.addNotificationReceivedListener.mockReturnValue(
        mockSubscription as any
      );

      const cleanup = setupNotificationListeners(onReceived);

      expect(mockedNotifications.addNotificationReceivedListener).toHaveBeenCalledWith(onReceived);
      expect(typeof cleanup).toBe('function');
    });

    it('should register response listener', () => {
      const onResponse = jest.fn();
      const mockSubscription = { remove: jest.fn() };
      mockedNotifications.addNotificationResponseReceivedListener.mockReturnValue(
        mockSubscription as any
      );

      const cleanup = setupNotificationListeners(undefined, onResponse);

      expect(mockedNotifications.addNotificationResponseReceivedListener).toHaveBeenCalledWith(onResponse);
    });

    it('should cleanup all listeners on dispose', () => {
      const mockSub1 = { remove: jest.fn() };
      const mockSub2 = { remove: jest.fn() };
      mockedNotifications.addNotificationReceivedListener.mockReturnValue(mockSub1 as any);
      mockedNotifications.addNotificationResponseReceivedListener.mockReturnValue(mockSub2 as any);

      const cleanup = setupNotificationListeners(jest.fn(), jest.fn());
      cleanup();

      expect(mockSub1.remove).toHaveBeenCalled();
      expect(mockSub2.remove).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------
  // Badge and scheduling
  // -------------------------------------------------------------------
  describe('getBadgeCount', () => {
    it('should return badge count', async () => {
      mockedNotifications.getBadgeCountAsync.mockResolvedValue(5);

      const count = await getBadgeCount();

      expect(count).toBe(5);
    });
  });

  describe('setBadgeCount', () => {
    it('should set badge count', async () => {
      mockedNotifications.setBadgeCountAsync.mockResolvedValue(true);

      await setBadgeCount(3);

      expect(mockedNotifications.setBadgeCountAsync).toHaveBeenCalledWith(3);
    });
  });

  describe('scheduleLocalNotification', () => {
    it('should schedule notification with content', async () => {
      mockedNotifications.scheduleNotificationAsync.mockResolvedValue('notif-id');

      const id = await scheduleLocalNotification('Title', 'Body', { key: 'value' });

      expect(mockedNotifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: { title: 'Title', body: 'Body', data: { key: 'value' } },
        trigger: null,
      });
      expect(id).toBe('notif-id');
    });
  });

  describe('cancelScheduledNotification', () => {
    it('should cancel by ID', async () => {
      mockedNotifications.cancelScheduledNotificationAsync.mockResolvedValue();

      await cancelScheduledNotification('notif-id');

      expect(mockedNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-id');
    });
  });

  describe('cancelAllScheduledNotifications', () => {
    it('should cancel all', async () => {
      mockedNotifications.cancelAllScheduledNotificationsAsync.mockResolvedValue();

      await cancelAllScheduledNotifications();

      expect(mockedNotifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    });
  });

  describe('clearAllNotifications', () => {
    it('should dismiss all notifications', async () => {
      mockedNotifications.dismissAllNotificationsAsync.mockResolvedValue();

      await clearAllNotifications();

      expect(mockedNotifications.dismissAllNotificationsAsync).toHaveBeenCalled();
    });
  });

  describe('getLastNotificationResponse', () => {
    it('should return last response', async () => {
      const mockResponse = { actionIdentifier: 'default' };
      mockedNotifications.getLastNotificationResponseAsync.mockResolvedValue(mockResponse as any);

      const result = await getLastNotificationResponse();

      expect(result).toEqual(mockResponse);
    });
  });
});
