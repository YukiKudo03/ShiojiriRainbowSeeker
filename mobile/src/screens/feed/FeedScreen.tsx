/**
 * FeedScreen - Photo feed screen with infinite scroll, search, and filtering
 *
 * Features:
 * - Infinite scroll pagination (20 items per page) via FlatList
 * - Keyword search with debounce (300ms)
 * - Location and date range filters
 * - Pull-to-refresh
 * - Empty state and error handling with retry
 *
 * Accessibility features (WCAG 2.1 AA):
 * - Screen reader support for all UI elements
 * - Minimum touch target size 44x44pt
 * - Color contrast ratio 4.5:1 or higher
 * - Accessible announcements for state changes
 *
 * Requirements: FR-4 (AC-4.1 to AC-4.8)
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';

import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  RefreshControl,
  AccessibilityInfo,
  Platform,
  Keyboard,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PhotoCard } from '../../components/feed';
import { Button } from '../../components/ui/Button';
import { getPhotos } from '../../services/photoService';
import { MIN_TOUCH_TARGET_SIZE } from '../../utils/accessibility';

import type { FeedScreenProps } from '../../types/navigation';
import type { Photo, PhotoFilters, PhotoListResponse } from '../../types/photo';

// Constants
const ITEMS_PER_PAGE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_RADIUS_KM = 10;
const MAX_RADIUS_KM = 100;

// Default location for Shiojiri, Nagano
const SHIOJIRI_LOCATION = {
  latitude: 36.1151,
  longitude: 137.9465,
};

/**
 * Filter state interface
 */
interface FilterState {
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Format date for display
 */
const formatDateDisplay = (date: Date): string => {
  return format(date, 'yyyy/MM/dd', { locale: ja });
};

/**
 * Check if filters are active
 */
const hasActiveFilters = (filters: FilterState): boolean => {
  return !!(
    filters.latitude !== undefined ||
    filters.longitude !== undefined ||
    filters.startDate !== undefined ||
    filters.endDate !== undefined
  );
};

export const FeedScreen: React.FC<FeedScreenProps> = ({ navigation }) => {
  // Search state
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter state
  const [filters, setFilters] = useState<FilterState>({});
  const [tempFilters, setTempFilters] = useState<FilterState>({});
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  // Date picker state
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Query client for refresh
  const queryClient = useQueryClient();

  // Debounced search handler
  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(text.trim());
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchText('');
    setDebouncedSearch('');
    Keyboard.dismiss();
  }, []);

  // Build query filters
  const queryFilters = useMemo((): PhotoFilters => {
    const filterParams: PhotoFilters = {
      perPage: ITEMS_PER_PAGE,
    };

    if (debouncedSearch) {
      filterParams.keyword = debouncedSearch;
    }

    if (filters.latitude !== undefined && filters.longitude !== undefined) {
      filterParams.latitude = filters.latitude;
      filterParams.longitude = filters.longitude;
      filterParams.radiusKm = filters.radiusKm || DEFAULT_RADIUS_KM;
    }

    if (filters.startDate) {
      filterParams.startDate = filters.startDate.toISOString().split('T')[0];
    }

    if (filters.endDate) {
      filterParams.endDate = filters.endDate.toISOString().split('T')[0];
    }

    return filterParams;
  }, [debouncedSearch, filters]);

  // Infinite query for photos
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['photos', queryFilters],
    queryFn: async ({ pageParam = 1 }) => {
      return getPhotos({ ...queryFilters, page: pageParam });
    },
    getNextPageParam: (lastPage: PhotoListResponse) => {
      if (lastPage.meta.currentPage < lastPage.meta.totalPages) {
        return lastPage.meta.currentPage + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });

  // Flatten pages into single array
  const photos = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.data);
  }, [data]);

  // Handle photo press - navigate to detail
  const handlePhotoPress = useCallback(
    (photo: Photo) => {
      navigation.navigate('PhotoDetail', { photoId: photo.id });
    },
    [navigation]
  );

  // Handle load more (infinite scroll)
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['photos', queryFilters] });
    await refetch();
    AccessibilityInfo.announceForAccessibility('フィードを更新しました');
  }, [queryClient, queryFilters, refetch]);

  // Handle retry on error
  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  // Filter modal handlers
  const handleOpenFilterModal = useCallback(() => {
    setTempFilters(filters);
    setIsFilterModalVisible(true);
  }, [filters]);

  const handleCloseFilterModal = useCallback(() => {
    setIsFilterModalVisible(false);
    setShowStartDatePicker(false);
    setShowEndDatePicker(false);
  }, []);

  const handleApplyFilters = useCallback(() => {
    setFilters(tempFilters);
    setIsFilterModalVisible(false);
    setShowStartDatePicker(false);
    setShowEndDatePicker(false);
    AccessibilityInfo.announceForAccessibility('フィルタを適用しました');
  }, [tempFilters]);

  const handleClearFilters = useCallback(() => {
    setTempFilters({});
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setFilters({});
    setSearchText('');
    setDebouncedSearch('');
    AccessibilityInfo.announceForAccessibility('すべてのフィルタをクリアしました');
  }, []);

  // Location filter toggle
  const handleToggleLocationFilter = useCallback(() => {
    if (tempFilters.latitude !== undefined) {
      // Clear location filter
      setTempFilters((prev) => ({
        ...prev,
        latitude: undefined,
        longitude: undefined,
        radiusKm: undefined,
      }));
    } else {
      // Set default location (Shiojiri)
      setTempFilters((prev) => ({
        ...prev,
        latitude: SHIOJIRI_LOCATION.latitude,
        longitude: SHIOJIRI_LOCATION.longitude,
        radiusKm: DEFAULT_RADIUS_KM,
      }));
    }
  }, [tempFilters.latitude]);

  // Date picker handlers
  const handleStartDateChange = useCallback(
    (_event: unknown, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        setShowStartDatePicker(false);
      }
      if (selectedDate) {
        setTempFilters((prev) => ({ ...prev, startDate: selectedDate }));
      }
    },
    []
  );

  const handleEndDateChange = useCallback(
    (_event: unknown, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        setShowEndDatePicker(false);
      }
      if (selectedDate) {
        setTempFilters((prev) => ({ ...prev, endDate: selectedDate }));
      }
    },
    []
  );

  const handleClearStartDate = useCallback(() => {
    setTempFilters((prev) => ({ ...prev, startDate: undefined }));
    setShowStartDatePicker(false);
  }, []);

  const handleClearEndDate = useCallback(() => {
    setTempFilters((prev) => ({ ...prev, endDate: undefined }));
    setShowEndDatePicker(false);
  }, []);

  // Radius slider handler
  const handleRadiusChange = useCallback((value: number) => {
    setTempFilters((prev) => ({ ...prev, radiusKm: Math.round(value) }));
  }, []);

  // Render photo card
  const renderPhotoCard = useCallback(
    ({ item }: { item: Photo }) => (
      <PhotoCard
        photo={item}
        onPress={handlePhotoPress}
        testID={`photo-card-${item.id}`}
      />
    ),
    [handlePhotoPress]
  );

  // Key extractor
  const keyExtractor = useCallback((item: Photo) => item.id, []);

  // Render footer (loading indicator for load more)
  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#3D7A8C" />
        <Text style={styles.loadingText}>読み込み中...</Text>
      </View>
    );
  }, [isFetchingNextPage]);

  // Render empty state (AC-4.7)
  const renderEmptyState = useCallback(() => {
    if (isLoading) return null;

    const hasFiltersOrSearch = hasActiveFilters(filters) || debouncedSearch;

    return (
      <View
        style={styles.emptyState}
        accessible={true}
        accessibilityLabel={
          hasFiltersOrSearch
            ? '検索条件に一致する写真が見つかりませんでした。検索条件を変更してお試しください'
            : '虹の写真がまだありません。最初の写真を投稿してください'
        }
        accessibilityRole="text"
      >
        <Ionicons
          name={hasFiltersOrSearch ? 'search-outline' : 'images-outline'}
          size={64}
          color="#CCCCCC"
          style={styles.emptyIcon}
        />
        <Text style={styles.emptyTitle}>
          {hasFiltersOrSearch
            ? '写真が見つかりませんでした'
            : '虹の写真がまだありません'}
        </Text>
        <Text style={styles.emptyDescription}>
          {hasFiltersOrSearch
            ? '検索条件を変更してお試しください'
            : '最初の虹の写真を投稿してみましょう'}
        </Text>
        {hasFiltersOrSearch && (
          <Button
            title="フィルタをクリア"
            onPress={handleClearAllFilters}
            variant="outline"
            style={styles.emptyButton}
            accessibilityLabel="すべてのフィルタをクリア"
            accessibilityHint="検索条件とフィルタをクリアします"
          />
        )}
      </View>
    );
  }, [isLoading, filters, debouncedSearch, handleClearAllFilters]);

  // Render error state (AC-4.8)
  if (isError && !isRefetching) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View
          style={styles.errorState}
          accessible={true}
          accessibilityLabel="フィードの読み込みに失敗しました。再試行ボタンを押してください"
          accessibilityRole="alert"
        >
          <Ionicons
            name="cloud-offline-outline"
            size={64}
            color="#C53030"
            style={styles.errorIcon}
          />
          <Text style={styles.errorTitle}>読み込みに失敗しました</Text>
          <Text style={styles.errorDescription}>
            {error instanceof Error
              ? error.message
              : 'ネットワーク接続を確認してください'}
          </Text>
          <Button
            title="再試行"
            onPress={handleRetry}
            variant="primary"
            icon="refresh"
            style={styles.retryButton}
            accessibilityLabel="再試行"
            accessibilityHint="フィードの読み込みを再試行します"
          />
        </View>
      </SafeAreaView>
    );
  }

  // Active filter count for badge
  const activeFilterCount = [
    filters.latitude !== undefined,
    filters.startDate !== undefined,
    filters.endDate !== undefined,
  ].filter(Boolean).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="feed-screen">
      {/* Header */}
      <View style={styles.header}>
        <Text
          style={styles.title}
          accessible={true}
          accessibilityRole="header"
          accessibilityLabel="塩尻レインボーシーカー、フィード画面"
        >
          Rainbow Seeker
        </Text>
        <Text style={styles.subtitle}>塩尻の虹を探そう</Text>
      </View>

      {/* Search and Filter Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons
            name="search"
            size={20}
            color="#6B6B6B"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="キーワードで検索..."
            placeholderTextColor="#999"
            value={searchText}
            onChangeText={handleSearchChange}
            returnKeyType="search"
            clearButtonMode="never"
            accessible={true}
            accessibilityLabel="キーワード検索"
            accessibilityHint="写真のタイトルやコメントを検索します"
          />
          {searchText.length > 0 && (
            <TouchableOpacity
              onPress={handleClearSearch}
              style={styles.clearButton}
              accessible={true}
              accessibilityLabel="検索をクリア"
              accessibilityRole="button"
            >
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          onPress={handleOpenFilterModal}
          style={styles.filterButton}
          accessible={true}
          accessibilityLabel={
            activeFilterCount > 0
              ? `フィルタ、${activeFilterCount}個のフィルタが適用中`
              : 'フィルタ'
          }
          accessibilityHint="フィルタモーダルを開きます"
          accessibilityRole="button"
        >
          <Ionicons name="options-outline" size={24} color="#3D7A8C" />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Photo List */}
      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#3D7A8C" />
          <Text style={styles.loadingText}>写真を読み込み中...</Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          renderItem={renderPhotoCard}
          keyExtractor={keyExtractor}
          contentContainerStyle={[
            styles.listContent,
            photos.length === 0 && styles.listContentEmpty,
          ]}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor="#3D7A8C"
              title="更新中..."
              titleColor="#6B6B6B"
            />
          }
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={10}
          accessible={true}
          accessibilityLabel="虹の写真フィード"
          accessibilityRole="list"
          testID="photo-list"
        />
      )}

      {/* Filter Modal */}
      <Modal
        visible={isFilterModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseFilterModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={handleCloseFilterModal}
              style={styles.modalCloseButton}
              accessible={true}
              accessibilityLabel="閉じる"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={28} color="#1F1F1F" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>フィルタ</Text>
            <TouchableOpacity
              onPress={handleClearFilters}
              style={styles.modalClearButton}
              accessible={true}
              accessibilityLabel="すべてクリア"
              accessibilityRole="button"
            >
              <Text style={styles.modalClearText}>クリア</Text>
            </TouchableOpacity>
          </View>

          {/* Modal Content */}
          <View style={styles.modalContent}>
            {/* Location Filter (AC-4.4) */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>場所でフィルタ</Text>
              <TouchableOpacity
                style={styles.filterToggle}
                onPress={handleToggleLocationFilter}
                accessible={true}
                accessibilityLabel={
                  tempFilters.latitude !== undefined
                    ? '塩尻周辺エリアフィルタ有効、タップして無効にする'
                    : '塩尻周辺エリアフィルタ無効、タップして有効にする'
                }
                accessibilityRole="switch"
                accessibilityState={{ checked: tempFilters.latitude !== undefined }}
              >
                <View style={styles.filterToggleContent}>
                  <Ionicons
                    name="location-outline"
                    size={24}
                    color={tempFilters.latitude !== undefined ? '#3D7A8C' : '#6B6B6B'}
                  />
                  <Text
                    style={[
                      styles.filterToggleText,
                      tempFilters.latitude !== undefined && styles.filterToggleTextActive,
                    ]}
                  >
                    塩尻周辺エリア
                  </Text>
                </View>
                <View
                  style={[
                    styles.filterToggleSwitch,
                    tempFilters.latitude !== undefined && styles.filterToggleSwitchActive,
                  ]}
                >
                  <View
                    style={[
                      styles.filterToggleKnob,
                      tempFilters.latitude !== undefined && styles.filterToggleKnobActive,
                    ]}
                  />
                </View>
              </TouchableOpacity>

              {tempFilters.latitude !== undefined && (
                <View style={styles.radiusSliderContainer}>
                  <Text style={styles.radiusLabel}>
                    半径: {tempFilters.radiusKm || DEFAULT_RADIUS_KM}km
                  </Text>
                  <Slider
                    style={styles.radiusSlider}
                    minimumValue={1}
                    maximumValue={MAX_RADIUS_KM}
                    value={tempFilters.radiusKm || DEFAULT_RADIUS_KM}
                    onValueChange={handleRadiusChange}
                    minimumTrackTintColor="#3D7A8C"
                    maximumTrackTintColor="#DDD"
                    thumbTintColor="#3D7A8C"
                    accessible={true}
                    accessibilityLabel={`検索半径、${tempFilters.radiusKm || DEFAULT_RADIUS_KM}キロメートル`}
                    accessibilityRole="adjustable"
                    accessibilityValue={{
                      min: 1,
                      max: MAX_RADIUS_KM,
                      now: tempFilters.radiusKm || DEFAULT_RADIUS_KM,
                      text: `${tempFilters.radiusKm || DEFAULT_RADIUS_KM}km`,
                    }}
                  />
                  <View style={styles.radiusLabels}>
                    <Text style={styles.radiusMinMax}>1km</Text>
                    <Text style={styles.radiusMinMax}>{MAX_RADIUS_KM}km</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Date Filter (AC-4.5) */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>日付でフィルタ</Text>

              {/* Start Date */}
              <View style={styles.datePickerRow}>
                <Text style={styles.dateLabel}>開始日:</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowStartDatePicker(true)}
                  accessible={true}
                  accessibilityLabel={
                    tempFilters.startDate
                      ? `開始日、${formatDateDisplay(tempFilters.startDate)}`
                      : '開始日を選択'
                  }
                  accessibilityRole="button"
                  accessibilityHint="日付選択ピッカーを開きます"
                >
                  <Ionicons name="calendar-outline" size={20} color="#3D7A8C" />
                  <Text style={styles.dateButtonText}>
                    {tempFilters.startDate
                      ? formatDateDisplay(tempFilters.startDate)
                      : '選択してください'}
                  </Text>
                </TouchableOpacity>
                {tempFilters.startDate && (
                  <TouchableOpacity
                    style={styles.dateClearButton}
                    onPress={handleClearStartDate}
                    accessible={true}
                    accessibilityLabel="開始日をクリア"
                    accessibilityRole="button"
                  >
                    <Ionicons name="close-circle" size={20} color="#6B6B6B" />
                  </TouchableOpacity>
                )}
              </View>

              {showStartDatePicker && (
                <DateTimePicker
                  value={tempFilters.startDate || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleStartDateChange}
                  maximumDate={tempFilters.endDate || new Date()}
                  locale="ja-JP"
                />
              )}

              {/* End Date */}
              <View style={styles.datePickerRow}>
                <Text style={styles.dateLabel}>終了日:</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowEndDatePicker(true)}
                  accessible={true}
                  accessibilityLabel={
                    tempFilters.endDate
                      ? `終了日、${formatDateDisplay(tempFilters.endDate)}`
                      : '終了日を選択'
                  }
                  accessibilityRole="button"
                  accessibilityHint="日付選択ピッカーを開きます"
                >
                  <Ionicons name="calendar-outline" size={20} color="#3D7A8C" />
                  <Text style={styles.dateButtonText}>
                    {tempFilters.endDate
                      ? formatDateDisplay(tempFilters.endDate)
                      : '選択してください'}
                  </Text>
                </TouchableOpacity>
                {tempFilters.endDate && (
                  <TouchableOpacity
                    style={styles.dateClearButton}
                    onPress={handleClearEndDate}
                    accessible={true}
                    accessibilityLabel="終了日をクリア"
                    accessibilityRole="button"
                  >
                    <Ionicons name="close-circle" size={20} color="#6B6B6B" />
                  </TouchableOpacity>
                )}
              </View>

              {showEndDatePicker && (
                <DateTimePicker
                  value={tempFilters.endDate || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleEndDateChange}
                  minimumDate={tempFilters.startDate}
                  maximumDate={new Date()}
                  locale="ja-JP"
                />
              )}
            </View>
          </View>

          {/* Modal Footer */}
          <View style={styles.modalFooter}>
            <Button
              title="フィルタを適用"
              onPress={handleApplyFilters}
              variant="primary"
              fullWidth
              accessibilityLabel="フィルタを適用"
              accessibilityHint="選択したフィルタで写真を絞り込みます"
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3D7A8C', // Primary brand color
  },
  subtitle: {
    fontSize: 14,
    color: '#5C5C5C', // Accessible secondary text (5.91:1 on white)
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    minHeight: MIN_TOUCH_TARGET_SIZE,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F1F1F',
    paddingVertical: 10,
  },
  clearButton: {
    padding: 4,
    minWidth: MIN_TOUCH_TARGET_SIZE,
    minHeight: MIN_TOUCH_TARGET_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButton: {
    padding: 10,
    minWidth: MIN_TOUCH_TARGET_SIZE,
    minHeight: MIN_TOUCH_TARGET_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#C53030',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  listContent: {
    paddingVertical: 8,
  },
  listContentEmpty: {
    flex: 1,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#5C5C5C',
  },
  loadingFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F1F1F',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    color: '#5C5C5C',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyButton: {
    minWidth: 160,
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#C53030',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorDescription: {
    fontSize: 14,
    color: '#5C5C5C',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    minWidth: 120,
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalCloseButton: {
    minWidth: MIN_TOUCH_TARGET_SIZE,
    minHeight: MIN_TOUCH_TARGET_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  modalClearButton: {
    minWidth: MIN_TOUCH_TARGET_SIZE,
    minHeight: MIN_TOUCH_TARGET_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalClearText: {
    fontSize: 16,
    color: '#3D7A8C',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F1F1F',
    marginBottom: 12,
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    minHeight: MIN_TOUCH_TARGET_SIZE,
  },
  filterToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterToggleText: {
    fontSize: 16,
    color: '#5C5C5C',
  },
  filterToggleTextActive: {
    color: '#3D7A8C',
    fontWeight: '500',
  },
  filterToggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DDD',
    padding: 2,
    justifyContent: 'center',
  },
  filterToggleSwitchActive: {
    backgroundColor: '#3D7A8C',
  },
  filterToggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  filterToggleKnobActive: {
    alignSelf: 'flex-end',
  },
  radiusSliderContainer: {
    marginTop: 16,
    paddingHorizontal: 4,
  },
  radiusLabel: {
    fontSize: 14,
    color: '#5C5C5C',
    marginBottom: 8,
    textAlign: 'center',
  },
  radiusSlider: {
    width: '100%',
    height: 40,
  },
  radiusLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  radiusMinMax: {
    fontSize: 12,
    color: '#6B6B6B',
  },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  dateLabel: {
    fontSize: 14,
    color: '#5C5C5C',
    width: 60,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: MIN_TOUCH_TARGET_SIZE,
    gap: 8,
  },
  dateButtonText: {
    fontSize: 14,
    color: '#1F1F1F',
  },
  dateClearButton: {
    minWidth: MIN_TOUCH_TARGET_SIZE,
    minHeight: MIN_TOUCH_TARGET_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
