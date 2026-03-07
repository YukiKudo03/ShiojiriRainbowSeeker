/**
 * Type declarations for @rails/actioncable
 *
 * The package does not ship its own TypeScript types.
 */
declare module '@rails/actioncable' {
  export interface Subscription {
    unsubscribe(): void;
    perform(action: string, data?: Record<string, unknown>): void;
    send(data: Record<string, unknown>): boolean;
  }

  export interface SubscriptionCallbacks {
    received?(data: unknown): void;
    initialized?(): void;
    connected?(): void;
    disconnected?(): void;
    rejected?(): void;
  }

  export interface Subscriptions {
    create(
      channel: string | { channel: string; [key: string]: unknown },
      callbacks?: SubscriptionCallbacks
    ): Subscription;
  }

  export interface Consumer {
    subscriptions: Subscriptions;
    connect(): void;
    disconnect(): void;
    send(data: Record<string, unknown>): void;
  }

  export function createConsumer(url?: string): Consumer;
}
