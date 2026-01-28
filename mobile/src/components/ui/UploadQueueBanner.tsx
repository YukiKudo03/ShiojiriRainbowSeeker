/**
 * UploadQueueBanner Component
 *
 * Displays status of pending/failed uploads as a persistent banner.
 * Provides user feedback and actions for queue management.
 *
 * Requirements: FR-2 (AC-2.7 Offline Support)
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

import { useUploadQueueProcessor, useNetworkState } from '../../hooks';

/**
 * Props for UploadQueueBanner
 */
interface UploadQueueBannerProps {
  /** Whether to show network status */
  showNetworkStatus?: boolean;
}

/**
 * Upload queue status banner
 *
 * Shows:
 * - Pending uploads count
 * - Failed uploads count with retry option
 * - Processing indicator
 * - Offline indicator
 *
 * @example
 * ```tsx
 * <UploadQueueBanner />
 * ```
 */
export function UploadQueueBanner({
  showNetworkStatus = true,
}: UploadQueueBannerProps): React.ReactElement | null {
  const { isOnline } = useNetworkState();
  const {
    isProcessing,
    pendingCount,
    failedCount,
    retryFailed,
  } = useUploadQueueProcessor();

  // Don't render if nothing to show
  if (pendingCount === 0 && failedCount === 0 && isOnline) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Offline indicator */}
      {!isOnline && showNetworkStatus && (
        <View style={[styles.banner, styles.offlineBanner]}>
          <Text style={styles.offlineText}>Offline - Uploads will resume when connected</Text>
        </View>
      )}

      {/* Pending uploads */}
      {pendingCount > 0 && (
        <View style={[styles.banner, styles.pendingBanner]}>
          <View style={styles.bannerContent}>
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FFFFFF" style={styles.spinner} />
            ) : (
              <View style={styles.iconPlaceholder}>
                <Text style={styles.iconText}>&#8593;</Text>
              </View>
            )}
            <Text style={styles.bannerText}>
              {isProcessing
                ? `Uploading ${pendingCount} photo${pendingCount > 1 ? 's' : ''}...`
                : `${pendingCount} photo${pendingCount > 1 ? 's' : ''} pending upload`}
            </Text>
          </View>
        </View>
      )}

      {/* Failed uploads */}
      {failedCount > 0 && (
        <View style={[styles.banner, styles.errorBanner]}>
          <View style={styles.bannerContent}>
            <View style={styles.iconPlaceholder}>
              <Text style={styles.iconText}>!</Text>
            </View>
            <Text style={styles.bannerText}>
              {failedCount} upload{failedCount > 1 ? 's' : ''} failed
            </Text>
          </View>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={retryFailed}
            accessibilityLabel="Retry failed uploads"
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  offlineBanner: {
    backgroundColor: '#6B7280', // Gray
  },
  pendingBanner: {
    backgroundColor: '#3B82F6', // Blue
  },
  errorBanner: {
    backgroundColor: '#EF4444', // Red
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  spinner: {
    marginRight: 12,
  },
  iconPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  offlineText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    flex: 1,
  },
  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default UploadQueueBanner;
