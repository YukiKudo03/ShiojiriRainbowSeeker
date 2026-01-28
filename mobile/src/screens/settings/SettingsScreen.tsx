/**
 * SettingsScreen - Notification, privacy, and language settings
 *
 * Features:
 * - Notification settings (push notifications, rainbow alerts)
 * - Privacy settings (public profile, blocked users)
 * - Data management (export, account deletion)
 * - Language settings with Japanese/English support (NFR-5)
 *
 * Includes data management features (FR-12):
 * - Data export request
 * - Account deletion with 2-step confirmation
 * - Deletion status display with cancel option
 */

import React, { useState, useEffect, useCallback } from 'react';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Switch,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLanguage } from '../../hooks';
import { SUPPORTED_LANGUAGES } from '../../i18n';
import {
  requestDataExport,
  requestAccountDeletion,
  cancelAccountDeletion,
  getDeletionStatus,
  getErrorMessage,
  logout,
} from '../../services';

import type { SupportedLanguage } from '../../i18n';
import type { DeletionStatusResponse } from '../../services/dataManagementService';
import type { SettingsScreenProps } from '../../types/navigation';

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const { currentLanguage, changeLanguage } = useLanguage();

  const [pushNotifications, setPushNotifications] = useState(true);
  const [rainbowAlerts, setRainbowAlerts] = useState(true);
  const [publicProfile, setPublicProfile] = useState(false);

  // Data management state
  const [isLoading, setIsLoading] = useState(false);
  const [deletionStatus, setDeletionStatus] = useState<DeletionStatusResponse | null>(null);

  // Modal states
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDeleteStep1Modal, setShowDeleteStep1Modal] = useState(false);
  const [showDeleteStep2Modal, setShowDeleteStep2Modal] = useState(false);
  const [showCancelDeletionModal, setShowCancelDeletionModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  // Fetch deletion status on mount
  const fetchDeletionStatus = useCallback(async () => {
    try {
      const status = await getDeletionStatus();
      setDeletionStatus(status);
    } catch (error) {
      console.warn('Failed to fetch deletion status:', getErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    fetchDeletionStatus();
  }, [fetchDeletionStatus]);

  // Handle data export request
  const handleExportData = async () => {
    setIsLoading(true);
    try {
      const result = await requestDataExport();
      setShowExportModal(false);
      Alert.alert(
        t('settings.exportRequested'),
        result.message,
        [{ text: t('common.ok') }]
      );
    } catch (error) {
      Alert.alert(t('common.error'), getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle account deletion request (step 2 confirmation)
  const handleRequestDeletion = async () => {
    setIsLoading(true);
    try {
      const result = await requestAccountDeletion();
      setShowDeleteStep2Modal(false);
      await fetchDeletionStatus();
      Alert.alert(
        t('settings.deletionScheduled'),
        `${result.message}\n\n${t('settings.accountWillBeDeleted', { date: formatDate(result.deletionScheduledAt) })}\n\n${t('settings.gracePeriodInfo', { days: result.gracePeriodDays })}`,
        [{ text: t('common.ok') }]
      );
    } catch (error) {
      Alert.alert(t('common.error'), getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle cancel deletion request
  const handleCancelDeletion = async () => {
    setIsLoading(true);
    try {
      const result = await cancelAccountDeletion();
      setShowCancelDeletionModal(false);
      await fetchDeletionStatus();
      Alert.alert(t('settings.cancellationSuccessful'), result.message);
    } catch (error) {
      Alert.alert(t('common.error'), getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      // Navigation will be handled by auth state change
    } catch (error) {
      console.warn('Logout error:', getErrorMessage(error));
    }
  };

  // Handle language change
  const handleLanguageChange = async (language: SupportedLanguage) => {
    try {
      await changeLanguage(language);
      setShowLanguageModal(false);
    } catch (error) {
      console.warn('Failed to change language:', error);
    }
  };

  // Format date for display based on current language
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const locale = currentLanguage === 'ja' ? 'ja-JP' : 'en-US';
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Get current language display name
  const getCurrentLanguageName = (): string => {
    return SUPPORTED_LANGUAGES[currentLanguage].nativeName;
  };

  // Render deletion status banner if pending
  const renderDeletionBanner = () => {
    if (!deletionStatus?.deletionPending) return null;

    return (
      <View style={styles.deletionBanner}>
        <Text style={styles.deletionBannerTitle}>
          {t('settings.accountDeletionScheduled')}
        </Text>
        <Text style={styles.deletionBannerText}>
          {t('settings.accountWillBeDeleted', {
            date: formatDate(deletionStatus.deletionScheduledAt!),
          })}
        </Text>
        <Text style={styles.deletionBannerText}>
          {t('settings.daysRemaining', { days: deletionStatus.daysRemaining })}
        </Text>
        {deletionStatus.canCancel && (
          <TouchableOpacity
            style={styles.cancelDeletionButton}
            onPress={() => setShowCancelDeletionModal(true)}
          >
            <Text style={styles.cancelDeletionButtonText}>
              {t('settings.cancelDeletion')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']} testID="settings-screen">
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderDeletionBanner()}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.notifications')}</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>
                {t('settings.pushNotifications')}
              </Text>
              <Text style={styles.settingDescription}>
                {t('settings.pushNotificationsDesc')}
              </Text>
            </View>
            <Switch
              value={pushNotifications}
              onValueChange={setPushNotifications}
              trackColor={{ false: '#ddd', true: '#4A90A4' }}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>
                {t('settings.rainbowAlerts')}
              </Text>
              <Text style={styles.settingDescription}>
                {t('settings.rainbowAlertsDesc')}
              </Text>
            </View>
            <Switch
              value={rainbowAlerts}
              onValueChange={setRainbowAlerts}
              trackColor={{ false: '#ddd', true: '#4A90A4' }}
            />
          </View>

          <TouchableOpacity
            style={styles.settingButton}
            onPress={() => navigation.navigate('NotificationSettings')}
          >
            <Text style={styles.settingButtonText}>
              {t('settings.advancedSettings')}
            </Text>
            <Text style={styles.settingValue}>{'>'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.privacy')}</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>
                {t('settings.publicProfile')}
              </Text>
              <Text style={styles.settingDescription}>
                {t('settings.publicProfileDesc')}
              </Text>
            </View>
            <Switch
              value={publicProfile}
              onValueChange={setPublicProfile}
              trackColor={{ false: '#ddd', true: '#4A90A4' }}
            />
          </View>

          <TouchableOpacity style={styles.settingButton}>
            <Text style={styles.settingButtonText}>
              {t('settings.manageBlockedUsers')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.dataManagement')}</Text>

          <TouchableOpacity
            style={styles.settingButton}
            onPress={() => setShowExportModal(true)}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingButtonText}>
                {t('settings.downloadMyData')}
              </Text>
              <Text style={styles.settingDescription}>
                {t('settings.downloadMyDataDesc')}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.app')}</Text>

          <TouchableOpacity
            style={styles.settingButton}
            onPress={() => setShowLanguageModal(true)}
          >
            <Text style={styles.settingButtonText}>{t('settings.language')}</Text>
            <Text style={styles.settingValue}>{getCurrentLanguageName()}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingButton}>
            <Text style={styles.settingButtonText}>{t('settings.about')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingButton}>
            <Text style={styles.settingButtonText}>
              {t('auth.termsOfService')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingButton}>
            <Text style={styles.settingButtonText}>
              {t('auth.privacyPolicy')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.dangerButton} onPress={handleLogout} testID="logout-button">
            <Text style={styles.dangerButtonText}>{t('auth.logout')}</Text>
          </TouchableOpacity>

          {!deletionStatus?.deletionPending && (
            <TouchableOpacity
              style={styles.dangerButton}
              onPress={() => setShowDeleteStep1Modal(true)}
            >
              <Text style={styles.dangerButtonText}>
                {t('settings.deleteAccount')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.versionSection}>
          <Text style={styles.versionText}>{t('common.version')} 1.0.0</Text>
        </View>
      </ScrollView>

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('settings.language')}</Text>
            {Object.entries(SUPPORTED_LANGUAGES).map(([code, names]) => (
              <TouchableOpacity
                key={code}
                style={[
                  styles.languageOption,
                  currentLanguage === code && styles.languageOptionSelected,
                ]}
                onPress={() => handleLanguageChange(code as SupportedLanguage)}
              >
                <Text
                  style={[
                    styles.languageOptionText,
                    currentLanguage === code && styles.languageOptionTextSelected,
                  ]}
                >
                  {names.nativeName}
                </Text>
                {currentLanguage === code && (
                  <Text style={styles.checkmark}>{'check'}</Text>
                )}
              </TouchableOpacity>
            ))}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowLanguageModal(false)}
              >
                <Text style={styles.modalCancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Export Data Confirmation Modal */}
      <Modal
        visible={showExportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('settings.exportData')}</Text>
            <Text style={styles.modalText}>
              {t('settings.exportDataMessage')}
            </Text>
            <Text style={styles.modalText}>
              {t('settings.downloadLinkValidity')}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowExportModal(false)}
                disabled={isLoading}
              >
                <Text style={styles.modalCancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleExportData}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmButtonText}>
                    {t('settings.requestExport')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Account Step 1 Modal - Warning */}
      <Modal
        visible={showDeleteStep1Modal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteStep1Modal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitleDanger}>
              {t('settings.deleteAccountQuestion')}
            </Text>
            <Text style={styles.modalText}>
              {t('settings.deleteAccountConfirmMessage')}
            </Text>
            <Text style={styles.modalTextWarning}>
              {currentLanguage === 'ja' ? 'この操作により:' : 'This action will:'}
            </Text>
            <View style={styles.warningList}>
              <Text style={styles.warningItem}>
                - {t('settings.deleteAccountWarningList.photos')}
              </Text>
              <Text style={styles.warningItem}>
                - {t('settings.deleteAccountWarningList.profile')}
              </Text>
              <Text style={styles.warningItem}>
                - {t('settings.deleteAccountWarningList.comments')}
              </Text>
            </View>
            <Text style={styles.modalText}>
              {t('settings.gracePeriodInfo', { days: 14 })}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowDeleteStep1Modal(false)}
              >
                <Text style={styles.modalCancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDangerButton}
                onPress={() => {
                  setShowDeleteStep1Modal(false);
                  setShowDeleteStep2Modal(true);
                }}
              >
                <Text style={styles.modalDangerButtonText}>{t('common.next')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Account Step 2 Modal - Final Confirmation */}
      <Modal
        visible={showDeleteStep2Modal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteStep2Modal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitleDanger}>
              {t('settings.finalConfirmation')}
            </Text>
            <Text style={styles.modalTextWarning}>
              {t('settings.finalConfirmationMessage', { days: 14 })}
            </Text>
            <Text style={styles.modalText}>
              {t('settings.afterGracePeriod', { days: 14 })}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowDeleteStep2Modal(false)}
                disabled={isLoading}
              >
                <Text style={styles.modalCancelButtonText}>
                  {t('settings.goBack')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDangerButton}
                onPress={handleRequestDeletion}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalDangerButtonText}>
                    {t('settings.deleteMyAccount')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancel Deletion Modal */}
      <Modal
        visible={showCancelDeletionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCancelDeletionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {t('settings.cancelAccountDeletion')}
            </Text>
            <Text style={styles.modalText}>
              {t('settings.cancelDeletionQuestion')}
            </Text>
            <Text style={styles.modalText}>
              {t('settings.cancelDeletionMessage')}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowCancelDeletionModal(false)}
                disabled={isLoading}
              >
                <Text style={styles.modalCancelButtonText}>
                  {t('settings.noKeepDeletion')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleCancelDeletion}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmButtonText}>
                    {t('settings.yesCancelDeletion')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  deletionBanner: {
    backgroundColor: '#fff3cd',
    marginHorizontal: 10,
    marginTop: 10,
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  deletionBannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 8,
  },
  deletionBannerText: {
    fontSize: 14,
    color: '#856404',
    marginBottom: 4,
  },
  cancelDeletionButton: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginTop: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#856404',
  },
  cancelDeletionButtonText: {
    color: '#856404',
    fontWeight: '600',
    fontSize: 14,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 10,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingInfo: {
    flex: 1,
    marginRight: 15,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: '#999',
  },
  settingButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingButtonText: {
    fontSize: 16,
    color: '#333',
  },
  settingValue: {
    fontSize: 14,
    color: '#999',
  },
  dangerButton: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dangerButtonText: {
    fontSize: 16,
    color: '#d9534f',
  },
  versionSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  versionText: {
    fontSize: 12,
    color: '#999',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalTitleDanger: {
    fontSize: 20,
    fontWeight: '600',
    color: '#d9534f',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 15,
    color: '#666',
    marginBottom: 12,
    lineHeight: 22,
  },
  modalTextWarning: {
    fontSize: 15,
    color: '#856404',
    marginBottom: 12,
    lineHeight: 22,
    fontWeight: '500',
  },
  warningList: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  warningItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 12,
  },
  modalCancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  modalCancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  modalConfirmButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#4A90A4',
    minWidth: 120,
    alignItems: 'center',
  },
  modalConfirmButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  modalDangerButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#d9534f',
    minWidth: 120,
    alignItems: 'center',
  },
  modalDangerButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  // Language modal styles
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    borderRadius: 8,
    marginBottom: 8,
  },
  languageOptionSelected: {
    backgroundColor: '#E8F4F8',
    borderColor: '#4A90A4',
    borderWidth: 1,
  },
  languageOptionText: {
    fontSize: 16,
    color: '#333',
  },
  languageOptionTextSelected: {
    color: '#4A90A4',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 16,
    color: '#4A90A4',
    fontWeight: '600',
  },
});
