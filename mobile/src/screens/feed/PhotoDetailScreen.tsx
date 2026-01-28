/**
 * PhotoDetailScreen - Photo details with weather info and social features
 *
 * Displays photo details including image, weather information, user info,
 * and social features (likes, comments, report). Enhanced with detailed
 * weather data, time-series charts, and radar viewer.
 *
 * Requirements: FR-8 (Social Features), FR-3 (AC-3.4), FR-13 (AC-13.3, AC-13.4)
 */

import React, { useState, useCallback, useEffect } from 'react';

import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Dimensions,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LikeButton, CommentList, ReportModal } from '../../components/social';
import { WeatherSummary, WeatherChart, RadarViewer } from '../../components/weather';
import { apiClient } from '../../services/apiClient';
import { getPhotoWeather } from '../../services/photoService';
import {
  accessibleColors,
  MIN_TOUCH_TARGET_SIZE,
} from '../../utils/accessibility';

import type { PhotoDetailScreenProps } from '../../types/navigation';
import type { WeatherCondition, RadarData } from '../../types/photo';
import type { PhotoWithSocial, ReportableType } from '../../types/social';

const screenHeight = Dimensions.get('window').height;

export const PhotoDetailScreen: React.FC<PhotoDetailScreenProps> = ({
  route,
}) => {
  const { photoId } = route.params;

  const [photo, setPhoto] = useState<PhotoWithSocial | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);

  // Weather data state
  const [weatherConditions, setWeatherConditions] = useState<WeatherCondition[] | undefined>();
  const [radarData, setRadarData] = useState<RadarData[] | undefined>();
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // Weather detail modal state
  const [showWeatherDetailModal, setShowWeatherDetailModal] = useState(false);

  // Report modal state
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    type: ReportableType;
    id: string;
  } | null>(null);

  // Load photo data
  const loadPhoto = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
        setError(null);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await apiClient.get<{ data: any }>(
          `/photos/${photoId}`
        );
        const data = response.data.data;

        setPhoto({
          id: data.id,
          title: data.title,
          description: data.description,
          capturedAt: data.capturedAt ?? data.captured_at,
          location: data.location ? {
            latitude: data.location.latitude,
            longitude: data.location.longitude,
            name: data.location.name,
          } : null,
          imageUrls: data.imageUrls ?? {
            thumbnail: data.image_url ?? data.imageUrl ?? '',
            medium: data.image_url ?? data.imageUrl ?? '',
          },
          createdAt: data.createdAt ?? data.created_at,
          user: {
            id: data.user.id,
            displayName: data.user.displayName ?? data.user.display_name,
          },
          likeCount: data.likeCount ?? data.like_count ?? 0,
          commentCount: data.commentCount ?? data.comment_count ?? 0,
          likedByCurrentUser: data.likedByCurrentUser ?? data.is_liked ?? false,
          isOwner: data.isOwner ?? data.is_own ?? false,
          weatherSummary: data.weatherSummary
            ? {
                temperature: data.weatherSummary.temperature,
                humidity: data.weatherSummary.humidity,
                weatherDescription: data.weatherSummary.weatherDescription,
              }
            : undefined,
        });
      } catch (err) {
        setError('Failed to load photo');
        console.error('Failed to load photo:', err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [photoId]
  );

  // Load weather data
  const loadWeatherData = useCallback(async () => {
    try {
      setIsLoadingWeather(true);
      setWeatherError(null);

      const weatherData = await getPhotoWeather(photoId);
      setWeatherConditions(weatherData.weatherConditions);
      setRadarData(weatherData.radarData);
    } catch (err) {
      setWeatherError('Failed to load weather data');
      console.error('Failed to load weather data:', err);
    } finally {
      setIsLoadingWeather(false);
    }
  }, [photoId]);

  // Initial load
  useEffect(() => {
    loadPhoto();
    loadWeatherData();
  }, [loadPhoto, loadWeatherData]);

  // Handle like change
  const handleLikeChange = useCallback((liked: boolean, likeCount: number) => {
    setPhoto((prev) => (prev ? { ...prev, isLiked: liked, likeCount } : null));
  }, []);

  // Handle comment count change
  const handleCommentCountChange = useCallback((count: number) => {
    setPhoto((prev) => (prev ? { ...prev, commentCount: count } : null));
  }, []);

  // Handle report press
  const handleReportPress = useCallback((type: ReportableType, id: string) => {
    setReportTarget({ type, id });
    setReportModalVisible(true);
  }, []);

  // Handle show weather details
  const handleShowWeatherDetails = useCallback(() => {
    setShowWeatherDetailModal(true);
  }, []);

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get the most recent weather condition for summary
  const getLatestWeatherCondition = (): WeatherCondition | undefined => {
    if (!weatherConditions || weatherConditions.length === 0) {
      return undefined;
    }
    // Sort by timestamp and get the most recent
    const sorted = [...weatherConditions].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return sorted[0];
  };

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90A4" />
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error || !photo) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Photo not found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadPhoto()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Comments view
  if (showComments) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.commentsHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setShowComments(false)}
            accessible={true}
            accessibilityLabel="Back to photo details"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={24} color={accessibleColors.primary} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
        <CommentList
          photoId={photoId}
          onCommentCountChange={handleCommentCountChange}
          onReportPress={handleReportPress}
        />
        <ReportModal
          visible={reportModalVisible}
          onClose={() => setReportModalVisible(false)}
          reportableType={reportTarget?.type || 'Comment'}
          reportableId={reportTarget?.id || ''}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']} testID="photo-detail-screen">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              loadPhoto(true);
              loadWeatherData();
            }}
            colors={['#4A90A4']}
          />
        }
      >
        {/* Photo Image */}
        <View style={styles.photoContainer}>
          <Image
            source={{ uri: photo.imageUrls.medium || photo.imageUrls.thumbnail }}
            style={styles.photo}
            resizeMode="cover"
            accessible={true}
            accessibilityLabel={`Rainbow photo taken at ${photo.location?.name || 'Shiojiri City'}`}
            testID="photo-image"
          />
          {/* Like button overlay */}
          <View style={styles.likeButtonOverlay}>
            <LikeButton
              photoId={photoId}
              initialLiked={photo.likedByCurrentUser}
              initialLikeCount={photo.likeCount}
              onLikeChange={handleLikeChange}
              size="large"
            />
          </View>
        </View>

        <View style={styles.detailsContainer}>
          {/* Location and Date (AC-3.4) */}
          <View
            accessible={true}
            accessibilityLabel={`Location: ${photo.location?.name || 'Shiojiri City'}, Date: ${formatDate(photo.capturedAt)}`}
          >
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={20} color={accessibleColors.primary} />
              <Text style={styles.location}>
                {photo.location?.name || 'Shiojiri City'}
              </Text>
            </View>
            <Text style={styles.date}>{formatDate(photo.capturedAt)}</Text>
          </View>

          {/* Social Actions */}
          <View style={styles.socialActions}>
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => setShowComments(true)}
              accessible={true}
              accessibilityLabel={`Comments ${photo.commentCount > 0 ? `${photo.commentCount} comments` : ''}`}
              accessibilityRole="button"
            >
              <Ionicons name="chatbubble-outline" size={18} color={accessibleColors.textSecondary} />
              <Text style={styles.socialButtonText}>
                Comments {photo.commentCount > 0 ? `(${photo.commentCount})` : ''}
              </Text>
            </TouchableOpacity>

            {!photo.isOwner && (
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => handleReportPress('Photo', photoId)}
                accessible={true}
                accessibilityLabel="Report photo"
                accessibilityRole="button"
              >
                <Ionicons name="flag-outline" size={18} color={accessibleColors.textSecondary} />
                <Text style={styles.socialButtonText}>Report</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Weather Summary (AC-13.3) */}
          {isLoadingWeather ? (
            <View style={styles.weatherLoadingContainer}>
              <ActivityIndicator size="small" color={accessibleColors.primary} />
              <Text style={styles.weatherLoadingText}>Loading weather data...</Text>
            </View>
          ) : weatherError ? (
            <View style={styles.weatherErrorContainer}>
              <Ionicons name="cloud-offline-outline" size={24} color={accessibleColors.textMuted} />
              <Text style={styles.weatherErrorText}>{weatherError}</Text>
              <TouchableOpacity
                style={styles.weatherRetryButton}
                onPress={loadWeatherData}
                accessible={true}
                accessibilityLabel="Retry loading weather data"
                accessibilityRole="button"
              >
                <Text style={styles.weatherRetryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <WeatherSummary
              weatherCondition={getLatestWeatherCondition()}
              onShowDetails={
                weatherConditions && weatherConditions.length > 0
                  ? handleShowWeatherDetails
                  : undefined
              }
              testID="weather-summary"
            />
          )}

          {/* Legacy Weather Info (from photo object) */}
          {photo.weatherSummary && !weatherConditions && (
            <View style={styles.weatherSection}>
              <Text style={styles.sectionTitle}>Weather at Time of Photo</Text>
              <View style={styles.weatherGrid}>
                {photo.weatherSummary.temperature !== undefined && (
                  <View style={styles.weatherItem}>
                    <Text style={styles.weatherLabel}>Temperature</Text>
                    <Text style={styles.weatherValue}>
                      {photo.weatherSummary.temperature}{'\u00B0'}C
                    </Text>
                  </View>
                )}
                {photo.weatherSummary.humidity !== undefined && (
                  <View style={styles.weatherItem}>
                    <Text style={styles.weatherLabel}>Humidity</Text>
                    <Text style={styles.weatherValue}>
                      {photo.weatherSummary.humidity}%
                    </Text>
                  </View>
                )}
                {photo.weatherSummary.weatherDescription && (
                  <View style={styles.weatherItem}>
                    <Text style={styles.weatherLabel}>Conditions</Text>
                    <Text style={styles.weatherValue}>
                      {photo.weatherSummary.weatherDescription}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* User Info */}
          <View style={styles.userSection}>
            <Text style={styles.sectionTitle}>Photographer</Text>
            <View style={styles.userInfo}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>
                  {photo.user.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.userName}>{photo.user.displayName}</Text>
              {photo.isOwner && (
                <View style={styles.ownBadge}>
                  <Text style={styles.ownBadgeText}>Your Post</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Weather Detail Modal (AC-13.4) */}
      <Modal
        visible={showWeatherDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowWeatherDetailModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Weather Details</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowWeatherDetailModal(false)}
              accessible={true}
              accessibilityLabel="Close weather details"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={24} color={accessibleColors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={styles.modalScrollContent}
          >
            {/* Time Series Charts */}
            {weatherConditions && weatherConditions.length > 0 && (
              <>
                <Text style={styles.modalSectionTitle}>Time Series Data</Text>
                <WeatherChart
                  weatherConditions={weatherConditions}
                  metric="temperature"
                  title="Temperature Change"
                  testID="temperature-chart"
                />
                <WeatherChart
                  weatherConditions={weatherConditions}
                  metric="humidity"
                  title="Humidity Change"
                  testID="humidity-chart"
                />
                <WeatherChart
                  weatherConditions={weatherConditions}
                  metric="pressure"
                  title="Pressure Change"
                  testID="pressure-chart"
                />
                <WeatherChart
                  weatherConditions={weatherConditions}
                  metric="windSpeed"
                  title="Wind Speed Change"
                  testID="wind-chart"
                />
              </>
            )}

            {/* Radar Viewer */}
            {radarData && radarData.length > 0 && (
              <>
                <Text style={styles.modalSectionTitle}>Radar Images</Text>
                <RadarViewer
                  radarData={radarData}
                  testID="radar-viewer"
                />
              </>
            )}

            {/* No data message */}
            {(!weatherConditions || weatherConditions.length === 0) &&
              (!radarData || radarData.length === 0) && (
                <View style={styles.noWeatherDataContainer}>
                  <Ionicons
                    name="cloud-offline-outline"
                    size={48}
                    color={accessibleColors.textMuted}
                  />
                  <Text style={styles.noWeatherDataText}>
                    No detailed weather data available
                  </Text>
                </View>
              )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Report Modal */}
      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        reportableType={reportTarget?.type || 'Photo'}
        reportableId={reportTarget?.id || photoId}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    color: accessibleColors.error,
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: accessibleColors.primary,
    borderRadius: 8,
    minHeight: MIN_TOUCH_TARGET_SIZE,
    justifyContent: 'center',
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  photoContainer: {
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: 350,
    backgroundColor: '#e0e0e0',
  },
  likeButtonOverlay: {
    position: 'absolute',
    bottom: 16,
    right: 16,
  },
  detailsContainer: {
    padding: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  location: {
    fontSize: 18,
    fontWeight: '600',
    color: accessibleColors.textPrimary,
    marginLeft: 6,
  },
  date: {
    fontSize: 14,
    color: accessibleColors.textSecondary,
    marginBottom: 16,
  },
  socialActions: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    minHeight: MIN_TOUCH_TARGET_SIZE,
    gap: 6,
  },
  socialButtonText: {
    fontSize: 14,
    color: accessibleColors.textSecondary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: accessibleColors.textPrimary,
    marginBottom: 12,
  },
  weatherSection: {
    marginBottom: 24,
  },
  weatherGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  weatherItem: {
    backgroundColor: '#E8F4F8',
    padding: 12,
    borderRadius: 8,
    minWidth: 100,
  },
  weatherLabel: {
    fontSize: 12,
    color: accessibleColors.textSecondary,
    marginBottom: 4,
  },
  weatherValue: {
    fontSize: 16,
    fontWeight: '600',
    color: accessibleColors.primary,
  },
  weatherLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginBottom: 16,
  },
  weatherLoadingText: {
    marginLeft: 12,
    fontSize: 14,
    color: accessibleColors.textSecondary,
  },
  weatherErrorContainer: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginBottom: 16,
  },
  weatherErrorText: {
    marginTop: 8,
    fontSize: 14,
    color: accessibleColors.textMuted,
  },
  weatherRetryButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: accessibleColors.primary,
    borderRadius: 8,
    minHeight: MIN_TOUCH_TARGET_SIZE,
    justifyContent: 'center',
  },
  weatherRetryText: {
    color: '#fff',
    fontWeight: '500',
  },
  userSection: {
    marginBottom: 20,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: accessibleColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  userName: {
    fontSize: 16,
    color: accessibleColors.textPrimary,
    flex: 1,
  },
  ownBadge: {
    backgroundColor: '#E8F4F8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  ownBadgeText: {
    fontSize: 12,
    color: accessibleColors.primary,
    fontWeight: '500',
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    minHeight: MIN_TOUCH_TARGET_SIZE,
  },
  backButtonText: {
    fontSize: 16,
    color: accessibleColors.primary,
    fontWeight: '500',
    marginLeft: 4,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: accessibleColors.textPrimary,
  },
  modalCloseButton: {
    width: MIN_TOUCH_TARGET_SIZE,
    height: MIN_TOUCH_TARGET_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: accessibleColors.textPrimary,
    marginTop: 16,
    marginBottom: 12,
  },
  noWeatherDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: screenHeight * 0.2,
  },
  noWeatherDataText: {
    marginTop: 16,
    fontSize: 16,
    color: accessibleColors.textMuted,
    textAlign: 'center',
  },
});
