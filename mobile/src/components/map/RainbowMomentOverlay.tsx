/**
 * RainbowMomentOverlay
 *
 * Floating overlay on MapScreen showing the active Rainbow Moment.
 * Displays real-time participant count ("N人が今、空を見上げています"),
 * countdown timer, participation toggle, and live photo thumbnails.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  Animated,
  AccessibilityInfo,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import {
  useActiveMoment,
  useIsParticipating,
  useParticipantCount,
  useLivePhotos,
  useRainbowMomentStore,
  type MomentPhoto,
} from '../../store/rainbowMomentStore';
import {
  subscribeToRainbowMoment,
  type RainbowMomentMessage,
} from '../../services/cableService';
import { accessibleColors, MIN_TOUCH_TARGET_SIZE } from '../../utils/accessibility';

// ============================================
// Countdown Hook
// ============================================

function useCountdown(endsAt: string | null): string {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    if (!endsAt) {
      setRemaining('');
      return;
    }

    const update = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining('0:00');
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemaining(`${mins}:${secs.toString().padStart(2, '0')}`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  return remaining;
}

// ============================================
// Component
// ============================================

export const RainbowMomentOverlay: React.FC = () => {
  const { t } = useTranslation();
  const activeMoment = useActiveMoment();
  const isParticipating = useIsParticipating();
  const participantCount = useParticipantCount();
  const livePhotos = useLivePhotos();

  const store = useRainbowMomentStore;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const countdown = useCountdown(activeMoment?.endsAt ?? null);

  // Pulse animation for participant count
  useEffect(() => {
    if (!activeMoment) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [activeMoment, pulseAnim]);

  // Subscribe to WebSocket when moment is active
  useEffect(() => {
    if (!activeMoment) {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      return;
    }

    const handleMessage = (message: RainbowMomentMessage) => {
      switch (message.type) {
        case 'initial_state':
          if (message.participant_count != null) {
            store.getState().updateParticipantCount(message.participant_count);
          }
          break;
        case 'participant_joined':
        case 'participant_left':
        case 'participant_count':
          if (message.participant_count != null) {
            store.getState().updateParticipantCount(message.participant_count);
          }
          break;
        case 'new_photo':
          if (message.photo) {
            store.getState().addLivePhoto({
              id: message.photo.id,
              user: {
                id: message.photo.user.id,
                displayName: message.photo.user.display_name,
              },
              thumbnailUrl: message.photo.thumbnail_url,
              latitude: message.photo.latitude,
              longitude: message.photo.longitude,
              capturedAt: message.photo.captured_at,
            });
          }
          break;
        case 'moment_closing':
          store.getState().updateMomentStatus('closing');
          break;
        case 'moment_archived':
          store.getState().updateMomentStatus('archived');
          store.getState().setActiveMoment(null);
          break;
      }
    };

    unsubscribeRef.current = subscribeToRainbowMoment(activeMoment.id, handleMessage);

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [activeMoment?.id, store]);

  const handleToggleParticipation = useCallback(() => {
    const next = !isParticipating;
    store.getState().setParticipating(next);

    AccessibilityInfo.announceForAccessibility(
      next
        ? t('moment.joined')
        : t('moment.left')
    );
  }, [isParticipating, store, t]);

  const renderPhotoThumbnail = useCallback(
    ({ item }: { item: MomentPhoto }) => (
      <View style={styles.thumbnailContainer}>
        {item.thumbnailUrl ? (
          <Image source={{ uri: item.thumbnailUrl }} style={styles.thumbnail} />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
            <Ionicons name="image-outline" size={16} color="#999" />
          </View>
        )}
      </View>
    ),
    []
  );

  if (!activeMoment) return null;

  const isClosing = activeMoment.status === 'closing';

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityRole="alert"
      accessibilityLabel={t('moment.overlayLabel', { count: participantCount })}
      testID="rainbow-moment-overlay"
    >
      {/* Header: Location + Countdown */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="color-palette" size={20} color="#FF6B6B" />
          <Text style={styles.locationName} numberOfLines={1}>
            {activeMoment.locationName}
          </Text>
        </View>
        {countdown ? (
          <View style={[styles.countdownBadge, isClosing && styles.countdownBadgeClosing]}>
            <Ionicons name="time-outline" size={14} color={isClosing ? '#FF6B6B' : '#666'} />
            <Text style={[styles.countdownText, isClosing && styles.countdownTextClosing]}>
              {countdown}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Participant Counter */}
      <Animated.View style={[styles.counterRow, { transform: [{ scale: pulseAnim }] }]}>
        <Ionicons name="people" size={24} color="#4A90D9" />
        <Text style={styles.counterText}>
          {t('moment.participantCount', { count: participantCount })}
        </Text>
      </Animated.View>

      {/* Participation Button */}
      <TouchableOpacity
        style={[
          styles.participateButton,
          isParticipating && styles.participateButtonActive,
        ]}
        onPress={handleToggleParticipation}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={
          isParticipating ? t('moment.leaveButton') : t('moment.joinButton')
        }
        accessibilityState={{ selected: isParticipating }}
        testID="participate-button"
      >
        <Ionicons
          name={isParticipating ? 'eye' : 'eye-outline'}
          size={20}
          color={isParticipating ? '#FFFFFF' : '#4A90D9'}
        />
        <Text
          style={[
            styles.participateButtonText,
            isParticipating && styles.participateButtonTextActive,
          ]}
        >
          {isParticipating ? t('moment.participating') : t('moment.joinMoment')}
        </Text>
      </TouchableOpacity>

      {/* Live Photo Thumbnails */}
      {livePhotos.length > 0 && (
        <FlatList
          data={livePhotos}
          horizontal
          keyExtractor={(item) => item.id}
          renderItem={renderPhotoThumbnail}
          showsHorizontalScrollIndicator={false}
          style={styles.photoList}
          contentContainerStyle={styles.photoListContent}
        />
      )}
    </View>
  );
};

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  locationName: {
    fontSize: 14,
    fontWeight: '600',
    color: accessibleColors.textPrimary,
    flex: 1,
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  countdownBadgeClosing: {
    backgroundColor: '#FFE0E0',
  },
  countdownText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  countdownTextClosing: {
    color: '#FF6B6B',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  counterText: {
    fontSize: 16,
    fontWeight: '700',
    color: accessibleColors.textPrimary,
  },
  participateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: '#4A90D9',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minHeight: MIN_TOUCH_TARGET_SIZE,
    marginBottom: 4,
  },
  participateButtonActive: {
    backgroundColor: '#4A90D9',
    borderColor: '#4A90D9',
  },
  participateButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4A90D9',
  },
  participateButtonTextActive: {
    color: '#FFFFFF',
  },
  photoList: {
    marginTop: 8,
  },
  photoListContent: {
    gap: 6,
  },
  thumbnailContainer: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  thumbnailPlaceholder: {
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default RainbowMomentOverlay;
