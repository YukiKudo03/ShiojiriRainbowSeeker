/**
 * RainbowMomentArchiveScreen
 *
 * Lists past Rainbow Moments with participant counts, photo counts,
 * and weather snapshots.
 */

import React, { useCallback, useEffect, useState } from 'react';

import {
  StyleSheet,
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchPastMoments } from '../../services/rainbowMomentService';
import type { RainbowMoment } from '../../store/rainbowMomentStore';
import { accessibleColors } from '../../utils/accessibility';

export const RainbowMomentArchiveScreen: React.FC = () => {
  const { t } = useTranslation();
  const [moments, setMoments] = useState<RainbowMoment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadMoments = useCallback(async (pageNum: number, refresh = false) => {
    try {
      const { moments: newMoments, meta } = await fetchPastMoments(pageNum);
      if (refresh) {
        setMoments(newMoments);
      } else {
        setMoments((prev) => [...prev, ...newMoments]);
      }
      setHasMore(pageNum < meta.totalPages);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to load past moments:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMoments(1, true);
  }, [loadMoments]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadMoments(1, true);
  }, [loadMoments]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      loadMoments(page + 1);
    }
  }, [hasMore, isLoading, page, loadMoments]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (startsAt: string, endsAt: string) => {
    const diff = new Date(endsAt).getTime() - new Date(startsAt).getTime();
    const mins = Math.round(diff / 60000);
    return `${mins}${t('common.loading').includes('分') ? '分' : 'min'}`;
  };

  const renderMoment = useCallback(
    ({ item }: { item: RainbowMoment }) => (
      <View style={styles.card} testID={`moment-card-${item.id}`}>
        <View style={styles.cardHeader}>
          <Ionicons name="color-palette" size={18} color="#FF6B6B" />
          <Text style={styles.cardLocation}>{item.locationName}</Text>
          <Text style={styles.cardDate}>{formatDate(item.startsAt)}</Text>
        </View>

        <View style={styles.cardStats}>
          <View style={styles.stat}>
            <Ionicons name="people-outline" size={16} color="#4A90D9" />
            <Text style={styles.statText}>{item.participantsCount}</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="camera-outline" size={16} color="#4A90D9" />
            <Text style={styles.statText}>{item.photosCount}</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="time-outline" size={16} color="#4A90D9" />
            <Text style={styles.statText}>
              {formatDuration(item.startsAt, item.endsAt)}
            </Text>
          </View>
        </View>
      </View>
    ),
    [t]
  );

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="color-palette-outline" size={48} color="#CCC" />
        <Text style={styles.emptyText}>{t('moment.noMoments')}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="moment-archive-screen">
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {t('moment.archiveTitle')}
        </Text>
      </View>

      {isLoading && moments.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={accessibleColors.primary} />
        </View>
      ) : (
        <FlatList
          data={moments}
          keyExtractor={(item) => item.id}
          renderItem={renderMoment}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: accessibleColors.textPrimary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    gap: 12,
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  cardLocation: {
    fontSize: 15,
    fontWeight: '600',
    color: accessibleColors.textPrimary,
    flex: 1,
  },
  cardDate: {
    fontSize: 13,
    color: accessibleColors.textSecondary,
  },
  cardStats: {
    flexDirection: 'row',
    gap: 20,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 14,
    color: accessibleColors.textSecondary,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: accessibleColors.textSecondary,
  },
});

export default RainbowMomentArchiveScreen;
