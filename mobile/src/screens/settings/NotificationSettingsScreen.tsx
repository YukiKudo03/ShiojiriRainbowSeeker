/**
 * NotificationSettingsScreen - Detailed notification settings
 *
 * Features:
 * - Toggle individual notification types (rainbow alerts, likes, comments, system)
 * - Set alert radius (1, 5, 10, 25 km)
 * - Configure quiet hours
 * - Device token registration status
 */

import React, { useEffect, useState, useCallback } from 'react';

import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import {
  notificationService,
  getExpoPushToken,
  requestNotificationPermission,
} from '../../services/notificationService';
import { ALERT_RADIUS_OPTIONS, DEFAULT_NOTIFICATION_SETTINGS } from '../../types/notification';

import type { NotificationSettingsScreenProps } from '../../types/navigation';
import type { NotificationSettings } from '../../types/notification';

export const NotificationSettingsScreen: React.FC<NotificationSettingsScreenProps> = () => {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [showTimeModal, setShowTimeModal] = useState<'start' | 'end' | null>(null);
  const [tempTime, setTempTime] = useState('');

  // Fetch settings on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load settings
        const fetchedSettings = await notificationService.getSettings();
        setSettings(fetchedSettings);

        // Check permission status
        const permission = await requestNotificationPermission();
        setHasPermission(permission);

        // Get device token if permitted
        if (permission) {
          const token = await getExpoPushToken();
          setDeviceToken(token);
        }
      } catch (error) {
        console.error('Failed to load notification settings:', error);
        Alert.alert('Error', 'Failed to load notification settings');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Update settings on server
  const updateSetting = useCallback(
    async <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => {
      setIsSaving(true);
      const previousSettings = { ...settings };

      // Optimistic update
      setSettings((prev) => ({ ...prev, [key]: value }));

      try {
        const updatedSettings = await notificationService.updateSettings({ [key]: value });
        setSettings(updatedSettings);
      } catch (error) {
        console.error('Failed to update setting:', error);
        // Revert on failure
        setSettings(previousSettings);
        Alert.alert('Error', 'Failed to update setting. Please try again.');
      } finally {
        setIsSaving(false);
      }
    },
    [settings]
  );

  // Handle permission request
  const handleRequestPermission = async () => {
    const permission = await requestNotificationPermission();
    setHasPermission(permission);

    if (permission) {
      const token = await getExpoPushToken();
      setDeviceToken(token);

      if (token) {
        try {
          await notificationService.registerDeviceToken(token);
          Alert.alert('Success', 'Push notifications enabled');
        } catch (error) {
          console.error('Failed to register device token:', error);
          Alert.alert('Error', 'Failed to register device for notifications');
        }
      }
    } else {
      Alert.alert(
        'Permission Required',
        'Please enable notifications in your device settings to receive rainbow alerts.'
      );
    }
  };

  // Validate time format (HH:MM)
  const isValidTime = (time: string): boolean => {
    const regex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    return regex.test(time);
  };

  // Handle time modal open
  const openTimeModal = (type: 'start' | 'end') => {
    const currentValue = type === 'start' ? settings.quietHoursStart : settings.quietHoursEnd;
    setTempTime(currentValue || (type === 'start' ? '22:00' : '07:00'));
    setShowTimeModal(type);
  };

  // Handle time modal save
  const handleTimeSave = () => {
    if (isValidTime(tempTime) && showTimeModal) {
      if (showTimeModal === 'start') {
        updateSetting('quietHoursStart', tempTime);
      } else {
        updateSetting('quietHoursEnd', tempTime);
      }
    }
    setShowTimeModal(null);
    setTempTime('');
  };

  // Toggle quiet hours
  const toggleQuietHours = () => {
    if (settings.quietHoursStart) {
      // Disable quiet hours
      updateSetting('quietHoursStart', null);
      updateSetting('quietHoursEnd', null);
    } else {
      // Enable with default values
      updateSetting('quietHoursStart', '22:00');
      updateSetting('quietHoursEnd', '07:00');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90A4" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Permission Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Permission Status</Text>

          <View style={styles.permissionRow}>
            <View style={styles.permissionInfo}>
              <Text style={styles.permissionLabel}>
                {hasPermission ? 'Notifications Enabled' : 'Notifications Disabled'}
              </Text>
              <Text style={styles.permissionDescription}>
                {hasPermission
                  ? 'You will receive push notifications'
                  : 'Enable notifications to receive rainbow alerts'}
              </Text>
            </View>
            {!hasPermission && (
              <TouchableOpacity style={styles.enableButton} onPress={handleRequestPermission}>
                <Text style={styles.enableButtonText}>Enable</Text>
              </TouchableOpacity>
            )}
          </View>

          {deviceToken && (
            <Text style={styles.tokenInfo}>
              Device registered for push notifications
            </Text>
          )}
        </View>

        {/* Notification Types */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Types</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Rainbow Alerts</Text>
              <Text style={styles.settingDescription}>
                Get notified when conditions are favorable for rainbows
              </Text>
            </View>
            <Switch
              value={settings.rainbowAlerts}
              onValueChange={(value) => updateSetting('rainbowAlerts', value)}
              trackColor={{ false: '#ddd', true: '#4A90A4' }}
              disabled={isSaving}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Likes</Text>
              <Text style={styles.settingDescription}>
                When someone likes your photos
              </Text>
            </View>
            <Switch
              value={settings.likes}
              onValueChange={(value) => updateSetting('likes', value)}
              trackColor={{ false: '#ddd', true: '#4A90A4' }}
              disabled={isSaving}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Comments</Text>
              <Text style={styles.settingDescription}>
                When someone comments on your photos
              </Text>
            </View>
            <Switch
              value={settings.comments}
              onValueChange={(value) => updateSetting('comments', value)}
              trackColor={{ false: '#ddd', true: '#4A90A4' }}
              disabled={isSaving}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>System</Text>
              <Text style={styles.settingDescription}>
                App updates and important announcements
              </Text>
            </View>
            <Switch
              value={settings.system}
              onValueChange={(value) => updateSetting('system', value)}
              trackColor={{ false: '#ddd', true: '#4A90A4' }}
              disabled={isSaving}
            />
          </View>
        </View>

        {/* Alert Radius */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alert Radius</Text>
          <Text style={styles.sectionDescription}>
            Receive rainbow alerts within this distance from your location
          </Text>

          <View style={styles.radiusContainer}>
            {ALERT_RADIUS_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.radiusOption,
                  settings.alertRadiusKm === option.value && styles.radiusOptionSelected,
                ]}
                onPress={() => updateSetting('alertRadiusKm', option.value)}
                disabled={isSaving}
              >
                <Text
                  style={[
                    styles.radiusOptionText,
                    settings.alertRadiusKm === option.value && styles.radiusOptionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quiet Hours */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quiet Hours</Text>
          <Text style={styles.sectionDescription}>
            No notifications during this time period
          </Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Enable Quiet Hours</Text>
            </View>
            <Switch
              value={settings.quietHoursStart !== null}
              onValueChange={toggleQuietHours}
              trackColor={{ false: '#ddd', true: '#4A90A4' }}
              disabled={isSaving}
            />
          </View>

          {settings.quietHoursStart !== null && (
            <>
              <TouchableOpacity
                style={styles.timePickerButton}
                onPress={() => openTimeModal('start')}
                disabled={isSaving}
              >
                <Text style={styles.timePickerLabel}>Start Time</Text>
                <Text style={styles.timePickerValue}>{settings.quietHoursStart}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.timePickerButton}
                onPress={() => openTimeModal('end')}
                disabled={isSaving}
              >
                <Text style={styles.timePickerLabel}>End Time</Text>
                <Text style={styles.timePickerValue}>{settings.quietHoursEnd || '07:00'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Time Picker Modal */}
        <Modal
          visible={showTimeModal !== null}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowTimeModal(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {showTimeModal === 'start' ? 'Start Time' : 'End Time'}
              </Text>
              <Text style={styles.modalDescription}>
                Enter time in 24-hour format (HH:MM)
              </Text>
              <TextInput
                style={styles.timeInput}
                value={tempTime}
                onChangeText={setTempTime}
                placeholder="HH:MM"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                autoFocus
              />
              {tempTime && !isValidTime(tempTime) && (
                <Text style={styles.errorText}>Invalid time format</Text>
              )}
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setShowTimeModal(null)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalSaveButton,
                    !isValidTime(tempTime) && styles.modalButtonDisabled,
                  ]}
                  onPress={handleTimeSave}
                  disabled={!isValidTime(tempTime)}
                >
                  <Text style={styles.modalSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Timezone Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timezone</Text>
          <Text style={styles.timezoneValue}>{settings.timezone}</Text>
        </View>

        {isSaving && (
          <View style={styles.savingOverlay}>
            <ActivityIndicator size="small" color="#4A90A4" />
            <Text style={styles.savingText}>Saving...</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#999',
    marginBottom: 15,
  },
  permissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  permissionInfo: {
    flex: 1,
    marginRight: 15,
  },
  permissionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  permissionDescription: {
    fontSize: 13,
    color: '#999',
  },
  enableButton: {
    backgroundColor: '#4A90A4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  enableButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  tokenInfo: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 5,
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
  radiusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  radiusOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  radiusOptionSelected: {
    backgroundColor: '#4A90A4',
  },
  radiusOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  radiusOptionTextSelected: {
    color: '#fff',
  },
  timePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  timePickerLabel: {
    fontSize: 16,
    color: '#333',
  },
  timePickerValue: {
    fontSize: 16,
    color: '#4A90A4',
    fontWeight: '500',
  },
  timezoneValue: {
    fontSize: 16,
    color: '#333',
    marginTop: 5,
  },
  savingOverlay: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#fff',
    marginTop: 10,
  },
  savingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  timeInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#d9534f',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  modalSaveButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#4A90A4',
    alignItems: 'center',
  },
  modalButtonDisabled: {
    backgroundColor: '#ccc',
  },
  modalSaveText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
});
