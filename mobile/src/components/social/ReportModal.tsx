/**
 * ReportModal Component
 *
 * Modal dialog for reporting inappropriate content (photos or comments).
 * Provides predefined reason options and handles submission to the API.
 *
 * Requirements: FR-8 (Social Features)
 */

import React, { useState, useCallback } from 'react';

import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { socialService } from '../../services/socialService';
import { REPORT_REASONS, type ReportableType } from '../../types/social';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  reportableType: ReportableType;
  reportableId: string;
  onReportSuccess?: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  visible,
  onClose,
  reportableType,
  reportableId,
  onReportSuccess,
}) => {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get title based on reportable type
  const getTitle = (): string => {
    switch (reportableType) {
      case 'Photo':
        return '写真を報告';
      case 'Comment':
        return 'コメントを報告';
      default:
        return 'コンテンツを報告';
    }
  };

  // Handle reason selection
  const handleSelectReason = useCallback((value: string) => {
    setSelectedReason(value);
  }, []);

  // Handle submit report
  const handleSubmit = useCallback(async () => {
    if (!selectedReason || isSubmitting) return;

    setIsSubmitting(true);

    try {
      await socialService.reportContent({
        reportableType,
        reportableId,
        reason: selectedReason,
      });

      Alert.alert(
        '報告を受け付けました',
        'ご報告ありがとうございます。内容を確認の上、適切に対応いたします。',
        [
          {
            text: 'OK',
            onPress: () => {
              setSelectedReason(null);
              onClose();
              onReportSuccess?.();
            },
          },
        ]
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '報告の送信に失敗しました';
      Alert.alert('エラー', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    selectedReason,
    isSubmitting,
    reportableType,
    reportableId,
    onClose,
    onReportSuccess,
  ]);

  // Handle close
  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      setSelectedReason(null);
      onClose();
    }
  }, [isSubmitting, onClose]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <View style={styles.header}>
                <Text style={styles.title}>{getTitle()}</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={handleClose}
                  disabled={isSubmitting}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.description}>
                報告の理由を選択してください
              </Text>

              <View style={styles.reasonsContainer}>
                {REPORT_REASONS.map((reason) => (
                  <TouchableOpacity
                    key={reason.value}
                    style={[
                      styles.reasonOption,
                      selectedReason === reason.value &&
                        styles.reasonOptionSelected,
                    ]}
                    onPress={() => handleSelectReason(reason.value)}
                    disabled={isSubmitting}
                  >
                    <View style={styles.radioCircle}>
                      {selectedReason === reason.value && (
                        <View style={styles.radioSelected} />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.reasonText,
                        selectedReason === reason.value &&
                          styles.reasonTextSelected,
                      ]}
                    >
                      {reason.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleClose}
                  disabled={isSubmitting}
                >
                  <Text style={styles.cancelButtonText}>キャンセル</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    (!selectedReason || isSubmitting) &&
                      styles.submitButtonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={!selectedReason || isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>報告する</Text>
                  )}
                </TouchableOpacity>
              </View>

              <Text style={styles.disclaimer}>
                虚偽の報告は利用規約に違反する場合があります。
              </Text>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#999',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  reasonsContainer: {
    marginBottom: 20,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
  },
  reasonOptionSelected: {
    backgroundColor: '#E8F4F8',
    borderWidth: 1,
    borderColor: '#4A90A4',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4A90A4',
  },
  reasonText: {
    fontSize: 14,
    color: '#333',
  },
  reasonTextSelected: {
    fontWeight: '500',
    color: '#4A90A4',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginBottom: 12,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  submitButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#d9534f',
    minWidth: 100,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});
