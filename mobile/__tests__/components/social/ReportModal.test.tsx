/**
 * Component Tests for ReportModal
 *
 * Tests modal visibility, reason selection, report submission, and validation.
 */

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../../../src/services/socialService', () => ({
  socialService: {
    reportContent: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../../../src/types/social', () => ({
  REPORT_REASONS: [
    { value: 'spam', label: 'スパム' },
    { value: 'inappropriate', label: '不適切なコンテンツ' },
    { value: 'harassment', label: 'ハラスメント' },
  ],
}));

import { ReportModal } from '../../../src/components/social/ReportModal';
import { socialService } from '../../../src/services/socialService';

const mockedSocialService = jest.mocked(socialService);

describe('ReportModal', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    reportableType: 'Photo' as const,
    reportableId: 'photo-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders modal when visible is true', () => {
    const { getByText } = render(<ReportModal {...defaultProps} />);
    expect(getByText('写真を報告')).toBeTruthy();
  });

  it('shows "コメントを報告" for Comment type', () => {
    const { getByText } = render(
      <ReportModal {...defaultProps} reportableType="Comment" />
    );
    expect(getByText('コメントを報告')).toBeTruthy();
  });

  it('displays all report reasons', () => {
    const { getByText } = render(<ReportModal {...defaultProps} />);
    expect(getByText('スパム')).toBeTruthy();
    expect(getByText('不適切なコンテンツ')).toBeTruthy();
    expect(getByText('ハラスメント')).toBeTruthy();
  });

  it('shows description text', () => {
    const { getByText } = render(<ReportModal {...defaultProps} />);
    expect(getByText('報告の理由を選択してください')).toBeTruthy();
  });

  it('shows disclaimer text', () => {
    const { getByText } = render(<ReportModal {...defaultProps} />);
    expect(getByText('虚偽の報告は利用規約に違反する場合があります。')).toBeTruthy();
  });

  it('has cancel and submit buttons', () => {
    const { getByText } = render(<ReportModal {...defaultProps} />);
    expect(getByText('キャンセル')).toBeTruthy();
    expect(getByText('報告する')).toBeTruthy();
  });

  it('calls onClose when cancel is pressed', () => {
    const onClose = jest.fn();
    const { getByText } = render(
      <ReportModal {...defaultProps} onClose={onClose} />
    );

    fireEvent.press(getByText('キャンセル'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when close button (✕) is pressed', () => {
    const onClose = jest.fn();
    const { getByText } = render(
      <ReportModal {...defaultProps} onClose={onClose} />
    );

    fireEvent.press(getByText('✕'));
    expect(onClose).toHaveBeenCalled();
  });

  it('allows selecting a reason', () => {
    const { getByText } = render(<ReportModal {...defaultProps} />);

    fireEvent.press(getByText('スパム'));
    // The reason option should be visually selected (we can check the submit button becomes enabled)
  });

  it('submits report with selected reason', async () => {
    const onReportSuccess = jest.fn();
    const { getByText } = render(
      <ReportModal {...defaultProps} onReportSuccess={onReportSuccess} />
    );

    fireEvent.press(getByText('スパム'));
    fireEvent.press(getByText('報告する'));

    await waitFor(() => {
      expect(mockedSocialService.reportContent).toHaveBeenCalledWith({
        reportableType: 'Photo',
        reportableId: 'photo-1',
        reason: 'spam',
      });
    });
  });

  it('shows default title for unknown type', () => {
    const { getByText } = render(
      <ReportModal {...defaultProps} reportableType={'Unknown' as any} />
    );
    expect(getByText('コンテンツを報告')).toBeTruthy();
  });

  it('does not submit without selecting a reason', () => {
    const { getByText } = render(<ReportModal {...defaultProps} />);

    fireEvent.press(getByText('報告する'));

    expect(mockedSocialService.reportContent).not.toHaveBeenCalled();
  });

  it('handles submit error and shows error alert', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    mockedSocialService.reportContent.mockRejectedValueOnce(new Error('Server error'));

    const { getByText } = render(<ReportModal {...defaultProps} />);

    fireEvent.press(getByText('スパム'));
    fireEvent.press(getByText('報告する'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('エラー', 'Server error');
    });

    alertSpy.mockRestore();
  });

  it('handles submit error with non-Error object', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    mockedSocialService.reportContent.mockRejectedValueOnce('some string error');

    const { getByText } = render(<ReportModal {...defaultProps} />);

    fireEvent.press(getByText('不適切なコンテンツ'));
    fireEvent.press(getByText('報告する'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('エラー', '報告の送信に失敗しました');
    });

    alertSpy.mockRestore();
  });

  it('shows success alert after successful submission', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');

    const { getByText } = render(<ReportModal {...defaultProps} />);

    fireEvent.press(getByText('ハラスメント'));
    fireEvent.press(getByText('報告する'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        '報告を受け付けました',
        'ご報告ありがとうございます。内容を確認の上、適切に対応いたします。',
        expect.any(Array)
      );
    });

    alertSpy.mockRestore();
  });
});
