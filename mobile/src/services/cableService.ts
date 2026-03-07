/**
 * Cable Service
 *
 * ActionCable (WebSocket) client for real-time features.
 * Connects to the Rails backend via /cable with JWT authentication.
 *
 * Channels:
 * - PhotoFeedChannel: new photo broadcasts
 * - NotificationsChannel: per-user like/comment/alert notifications
 *
 * Requirements: F-5 (Real-time Updates)
 */

import { createConsumer, Consumer, Subscription } from '@rails/actioncable';

import { getAccessToken } from './tokenStorage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

let consumer: Consumer | null = null;
let photoFeedSubscription: Subscription | null = null;
let notificationsSubscription: Subscription | null = null;

/**
 * Build the WebSocket URL with JWT token for authentication.
 */
async function buildCableUrl(): Promise<string> {
  const token = await getAccessToken();
  const wsBase = API_BASE_URL.replace(/^http/, 'ws');
  return `${wsBase}/cable?token=${token ?? ''}`;
}

/**
 * Connect to ActionCable.
 * Call after successful login or session restore.
 */
export async function connectCable(): Promise<void> {
  if (consumer) {
    return; // Already connected
  }

  const url = await buildCableUrl();
  consumer = createConsumer(url);
}

/**
 * Disconnect from ActionCable.
 * Call on logout.
 */
export function disconnectCable(): void {
  if (photoFeedSubscription) {
    photoFeedSubscription.unsubscribe();
    photoFeedSubscription = null;
  }
  if (notificationsSubscription) {
    notificationsSubscription.unsubscribe();
    notificationsSubscription = null;
  }
  if (consumer) {
    consumer.disconnect();
    consumer = null;
  }
}

/** Payload received from the PhotoFeedChannel */
export interface PhotoFeedMessage {
  type: 'new_photo';
  photo: {
    id: string;
    title?: string;
    user: { id: string; display_name: string };
    latitude: number;
    longitude: number;
    thumbnail_url: string | null;
    captured_at: string;
    created_at: string;
  };
}

/**
 * Subscribe to the global photo feed.
 * @param onReceived callback for each new photo broadcast
 * @returns unsubscribe function
 */
export function subscribeToPhotoFeed(
  onReceived: (message: PhotoFeedMessage) => void
): () => void {
  if (!consumer) {
    console.warn('[Cable] Not connected — call connectCable() first');
    return () => {};
  }

  photoFeedSubscription = consumer.subscriptions.create('PhotoFeedChannel', {
    received(data: PhotoFeedMessage) {
      onReceived(data);
    },
  });

  return () => {
    photoFeedSubscription?.unsubscribe();
    photoFeedSubscription = null;
  };
}

/** Payload received from the NotificationsChannel */
export interface NotificationMessage {
  type: 'new_like' | 'new_comment' | 'rainbow_alert';
  photo_id?: string;
  user?: { id: string; display_name: string };
  like_count?: number;
  comment?: {
    id: string;
    content: string;
    user: { id: string; display_name: string };
  };
  comment_count?: number;
}

/**
 * Subscribe to the current user's notifications channel.
 * @param onReceived callback for each notification
 * @returns unsubscribe function
 */
export function subscribeToNotifications(
  onReceived: (message: NotificationMessage) => void
): () => void {
  if (!consumer) {
    console.warn('[Cable] Not connected — call connectCable() first');
    return () => {};
  }

  notificationsSubscription = consumer.subscriptions.create('NotificationsChannel', {
    received(data: NotificationMessage) {
      onReceived(data);
    },
  });

  return () => {
    notificationsSubscription?.unsubscribe();
    notificationsSubscription = null;
  };
}
