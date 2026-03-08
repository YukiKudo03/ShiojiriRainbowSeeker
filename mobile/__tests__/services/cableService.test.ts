/**
 * Unit Tests for cableService
 *
 * Tests WebSocket (ActionCable) connection, subscription, and disconnection.
 * @rails/actioncable is already mocked in setup.ts.
 */

import { createConsumer } from '@rails/actioncable';

// Mock tokenStorage
jest.mock('../../src/services/tokenStorage', () => ({
  getAccessToken: jest.fn(() => Promise.resolve('test-token')),
}));

import {
  connectCable,
  disconnectCable,
  subscribeToPhotoFeed,
  subscribeToNotifications,
} from '../../src/services/cableService';

const mockedCreateConsumer = jest.mocked(createConsumer);

describe('cableService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset module state by disconnecting
    disconnectCable();
  });

  describe('connectCable', () => {
    it('should create a consumer with WebSocket URL containing token', async () => {
      await connectCable();
      expect(mockedCreateConsumer).toHaveBeenCalledWith(
        expect.stringContaining('token=test-token')
      );
    });

    it('should use ws:// protocol instead of http://', async () => {
      await connectCable();
      expect(mockedCreateConsumer).toHaveBeenCalledWith(
        expect.stringMatching(/^ws:\/\//)
      );
    });

    it('should not create multiple consumers on repeated calls', async () => {
      await connectCable();
      await connectCable();
      expect(mockedCreateConsumer).toHaveBeenCalledTimes(1);
    });
  });

  describe('disconnectCable', () => {
    it('should disconnect the consumer', async () => {
      await connectCable();
      const consumer = mockedCreateConsumer.mock.results[0].value;

      disconnectCable();
      expect(consumer.disconnect).toHaveBeenCalled();
    });

    it('should not throw when not connected', () => {
      expect(() => disconnectCable()).not.toThrow();
    });
  });

  describe('subscribeToPhotoFeed', () => {
    it('should subscribe to PhotoFeedChannel when connected', async () => {
      await connectCable();
      const consumer = mockedCreateConsumer.mock.results[0].value;

      const callback = jest.fn();
      subscribeToPhotoFeed(callback);

      expect(consumer.subscriptions.create).toHaveBeenCalledWith(
        'PhotoFeedChannel',
        expect.objectContaining({ received: expect.any(Function) })
      );
    });

    it('should return an unsubscribe function', async () => {
      await connectCable();

      const callback = jest.fn();
      const unsubscribe = subscribeToPhotoFeed(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should return noop when not connected', () => {
      const callback = jest.fn();
      const unsubscribe = subscribeToPhotoFeed(callback);

      expect(typeof unsubscribe).toBe('function');
      // Should not throw
      unsubscribe();
    });
  });

  describe('subscribeToNotifications', () => {
    it('should subscribe to NotificationsChannel when connected', async () => {
      await connectCable();
      const consumer = mockedCreateConsumer.mock.results[0].value;

      const callback = jest.fn();
      subscribeToNotifications(callback);

      expect(consumer.subscriptions.create).toHaveBeenCalledWith(
        'NotificationsChannel',
        expect.objectContaining({ received: expect.any(Function) })
      );
    });

    it('should return noop when not connected', () => {
      const callback = jest.fn();
      const unsubscribe = subscribeToNotifications(callback);
      expect(typeof unsubscribe).toBe('function');
    });
  });
});
