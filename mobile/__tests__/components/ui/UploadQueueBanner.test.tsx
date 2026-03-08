/**
 * Unit Tests for UploadQueueBanner component
 *
 * Tests the upload queue status banner: offline state, pending uploads,
 * failed uploads with retry, and hidden when nothing to show.
 *
 * Requirements: FR-2 (AC-2.7 Offline Support)
 *
 * NOTE: @testing-library/react-native is required but not yet in package.json.
 * Install with: npm install --save-dev @testing-library/react-native
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// Mock the hooks before importing the component
const mockUseNetworkState = jest.fn(() => ({ isOnline: true }));
const mockRetryFailed = jest.fn();
const mockUseUploadQueueProcessor = jest.fn(() => ({
  isProcessing: false,
  pendingCount: 0,
  failedCount: 0,
  retryFailed: mockRetryFailed,
}));

jest.mock('../../../src/hooks', () => ({
  useNetworkState: (...args: unknown[]) => mockUseNetworkState(...args),
  useUploadQueueProcessor: (...args: unknown[]) => mockUseUploadQueueProcessor(...args),
}));

import { UploadQueueBanner } from '../../../src/components/ui/UploadQueueBanner';

describe('UploadQueueBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to defaults
    mockUseNetworkState.mockReturnValue({ isOnline: true });
    mockUseUploadQueueProcessor.mockReturnValue({
      isProcessing: false,
      pendingCount: 0,
      failedCount: 0,
      retryFailed: mockRetryFailed,
    });
  });

  // -----------------------------------------------------------------
  // Hidden when nothing to show
  // -----------------------------------------------------------------
  it('returns null when online, no pending, and no failed uploads', () => {
    const { toJSON } = render(<UploadQueueBanner />);

    // Component should render nothing
    expect(toJSON()).toBeNull();
  });

  // -----------------------------------------------------------------
  // Offline banner
  // -----------------------------------------------------------------
  it('shows offline banner when not online', () => {
    mockUseNetworkState.mockReturnValue({ isOnline: false });

    const { getByText } = render(<UploadQueueBanner />);

    expect(
      getByText('Offline - Uploads will resume when connected')
    ).toBeTruthy();
  });

  // -----------------------------------------------------------------
  // Pending uploads with spinner
  // -----------------------------------------------------------------
  it('shows pending count with processing indicator when uploading', () => {
    mockUseUploadQueueProcessor.mockReturnValue({
      isProcessing: true,
      pendingCount: 3,
      failedCount: 0,
      retryFailed: mockRetryFailed,
    });

    const { getByText } = render(<UploadQueueBanner />);

    expect(getByText('Uploading 3 photos...')).toBeTruthy();
  });

  // -----------------------------------------------------------------
  // Failed uploads with retry button
  // -----------------------------------------------------------------
  it('shows failed count and retry button when uploads have failed', () => {
    mockUseUploadQueueProcessor.mockReturnValue({
      isProcessing: false,
      pendingCount: 0,
      failedCount: 2,
      retryFailed: mockRetryFailed,
    });

    const { getByText } = render(<UploadQueueBanner />);

    expect(getByText('2 uploads failed')).toBeTruthy();
    expect(getByText('Retry')).toBeTruthy();
  });

  // -----------------------------------------------------------------
  // Retry button calls retryFailed
  // -----------------------------------------------------------------
  it('calls retryFailed when retry button is pressed', () => {
    mockUseUploadQueueProcessor.mockReturnValue({
      isProcessing: false,
      pendingCount: 0,
      failedCount: 1,
      retryFailed: mockRetryFailed,
    });

    const { getByText } = render(<UploadQueueBanner />);

    fireEvent.press(getByText('Retry'));

    expect(mockRetryFailed).toHaveBeenCalledTimes(1);
  });
});
