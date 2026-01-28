/**
 * CommentList Component
 *
 * Displays a list of comments with the ability to add new comments.
 * Supports pagination, delete own comments, and report functionality.
 *
 * Accessibility features (WCAG 2.1 AA):
 * - Accessible labels for all interactive elements
 * - Live region announcements for dynamic content
 * - Minimum touch target sizes (44x44pt)
 * - High contrast colors
 * - Screen reader optimized navigation
 *
 * Requirements: FR-8 (Social Features), NFR-5 (Accessibility)
 */

import React, { useState, useCallback, useEffect } from 'react';

import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { socialService } from '../../services/socialService';
import { MAX_COMMENT_LENGTH } from '../../types/social';
import { MIN_TOUCH_TARGET_SIZE } from '../../utils/accessibility';

import type { Comment, ReportableType } from '../../types/social';

interface CommentListProps {
  photoId: string;
  onCommentCountChange?: (count: number) => void;
  onReportPress?: (type: ReportableType, id: string) => void;
}

export const CommentList: React.FC<CommentListProps> = ({
  photoId,
  onCommentCountChange,
  onReportPress,
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Load comments
  const loadComments = useCallback(
    async (page = 1, refresh = false) => {
      try {
        if (refresh) {
          setIsRefreshing(true);
        } else if (page === 1) {
          setIsLoading(true);
        } else {
          setIsLoadingMore(true);
        }
        setError(null);

        const response = await socialService.getComments(photoId, page);

        if (page === 1 || refresh) {
          setComments(response.comments);
        } else {
          setComments((prev) => [...prev, ...response.comments]);
        }

        setCurrentPage(response.pagination.currentPage);
        setTotalPages(response.pagination.totalPages);
        onCommentCountChange?.(response.pagination.totalCount);
      } catch (err) {
        setError('コメントの読み込みに失敗しました');
        console.error('Failed to load comments:', err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [photoId, onCommentCountChange]
  );

  // Initial load
  useEffect(() => {
    loadComments(1);
  }, [loadComments]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    loadComments(1, true);
  }, [loadComments]);

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && currentPage < totalPages) {
      loadComments(currentPage + 1);
    }
  }, [isLoadingMore, currentPage, totalPages, loadComments]);

  // Handle submit comment
  const handleSubmitComment = useCallback(async () => {
    const content = newComment.trim();
    if (!content || isSubmitting) return;

    if (content.length > MAX_COMMENT_LENGTH) {
      Alert.alert('エラー', `コメントは${MAX_COMMENT_LENGTH}文字以内で入力してください`);
      return;
    }

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimisticComment: Comment = {
      id: tempId,
      content,
      user: { id: 'current', displayName: 'あなた' },
      createdAt: new Date().toISOString(),
      isOwn: true,
    };

    setComments((prev) => [optimisticComment, ...prev]);
    setNewComment('');
    setIsSubmitting(true);

    try {
      const response = await socialService.createComment(photoId, content);

      // Replace optimistic comment with real one
      setComments((prev) =>
        prev.map((c) => (c.id === tempId ? response.comment : c))
      );
      onCommentCountChange?.(response.commentCount);
    } catch (err) {
      // Revert optimistic update
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setNewComment(content);

      const errorMessage = err instanceof Error ? err.message : 'コメントの投稿に失敗しました';
      Alert.alert('エラー', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [newComment, isSubmitting, photoId, onCommentCountChange]);

  // Handle delete comment
  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      Alert.alert('確認', 'このコメントを削除しますか？', [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            // Optimistic update
            const deletedComment = comments.find((c) => c.id === commentId);
            setComments((prev) => prev.filter((c) => c.id !== commentId));

            try {
              const response = await socialService.deleteComment(commentId);
              onCommentCountChange?.(response.commentCount);
            } catch {
              // Revert optimistic update
              if (deletedComment) {
                setComments((prev) => [...prev, deletedComment]);
              }
              Alert.alert('エラー', 'コメントの削除に失敗しました');
            }
          },
        },
      ]);
    },
    [comments, onCommentCountChange]
  );

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'たった今';
    if (diffMins < 60) return `${diffMins}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    if (diffDays < 7) return `${diffDays}日前`;

    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Render comment item with accessibility support
  const renderComment = ({ item }: { item: Comment }) => (
    <View
      style={styles.commentItem}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={`${item.user.displayName}のコメント、${formatDate(item.createdAt)}、${item.content}`}
    >
      <View style={styles.commentHeader} accessible={false}>
        <View
          style={styles.commentAvatar}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={styles.avatarText}>
            {item.user.displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.commentMeta} accessible={false}>
          <Text style={styles.commentAuthor}>{item.user.displayName}</Text>
          <Text style={styles.commentDate}>{formatDate(item.createdAt)}</Text>
        </View>
        {item.isOwn ? (
          <TouchableOpacity
            style={styles.commentAction}
            onPress={() => handleDeleteComment(item.id)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`${item.user.displayName}のコメントを削除`}
            accessibilityHint="ダブルタップで削除確認ダイアログを表示"
          >
            <Text style={styles.deleteText}>削除</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.commentAction}
            onPress={() => onReportPress?.('Comment', item.id)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`${item.user.displayName}のコメントを報告`}
            accessibilityHint="ダブルタップで報告画面を表示"
          >
            <Text style={styles.reportText}>報告</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.commentContent} accessible={false}>
        {item.content}
      </Text>
    </View>
  );

  // Render footer (loading more indicator)
  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View
        style={styles.loadingMore}
        accessible={true}
        accessibilityLabel="コメントを読み込み中"
        accessibilityRole="progressbar"
      >
        <ActivityIndicator size="small" color="#3D7A8C" />
      </View>
    );
  };

  // Render empty state
  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View
        style={styles.emptyContainer}
        accessible={true}
        accessibilityRole="text"
        accessibilityLabel="コメントはまだありません。最初のコメントを投稿しましょう"
      >
        <Text style={styles.emptyText}>コメントはまだありません</Text>
        <Text style={styles.emptySubtext}>最初のコメントを投稿しましょう</Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View
        style={styles.loadingContainer}
        accessible={true}
        accessibilityLabel="コメントを読み込み中"
        accessibilityRole="progressbar"
      >
        <ActivityIndicator size="large" color="#3D7A8C" />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={styles.errorContainer}
        accessible={true}
        accessibilityRole="alert"
        accessibilityLabel={`エラー: ${error}`}
      >
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={handleRefresh}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="再読み込み"
          accessibilityHint="ダブルタップでコメントを再読み込み"
        >
          <Text style={styles.retryText}>再読み込み</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <View
        style={styles.header}
        accessible={true}
        accessibilityRole="header"
        accessibilityLabel={`コメント、${comments.length}件`}
      >
        <Text style={styles.headerTitle}>コメント</Text>
        <Text style={styles.commentCount}>{comments.length}件</Text>
      </View>

      <FlatList
        data={comments}
        renderItem={renderComment}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onRefresh={handleRefresh}
        refreshing={isRefreshing}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        accessibilityLabel="コメント一覧"
        accessibilityRole="list"
      />

      <View style={styles.inputContainer} accessible={false}>
        <TextInput
          style={styles.input}
          placeholder="コメントを入力..."
          placeholderTextColor="#6B6B6B"
          value={newComment}
          onChangeText={setNewComment}
          multiline
          maxLength={MAX_COMMENT_LENGTH}
          editable={!isSubmitting}
          accessible={true}
          accessibilityLabel="コメント入力欄"
          accessibilityHint={`最大${MAX_COMMENT_LENGTH}文字まで入力できます`}
          accessibilityState={{ disabled: isSubmitting }}
        />
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!newComment.trim() || isSubmitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmitComment}
          disabled={!newComment.trim() || isSubmitting}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={isSubmitting ? 'コメント送信中' : 'コメントを送信'}
          accessibilityHint="ダブルタップでコメントを投稿"
          accessibilityState={{
            disabled: !newComment.trim() || isSubmitting,
            busy: isSubmitting,
          }}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" accessibilityLabel="送信中" />
          ) : (
            <Text style={styles.submitText}>送信</Text>
          )}
        </TouchableOpacity>
      </View>
      <View
        style={styles.characterCount}
        accessible={true}
        accessibilityRole="text"
        accessibilityLabel={`${newComment.length}文字入力中、最大${MAX_COMMENT_LENGTH}文字`}
        accessibilityLiveRegion="polite"
      >
        <Text
          style={[
            styles.characterCountText,
            newComment.length > MAX_COMMENT_LENGTH && styles.characterCountOver,
          ]}
        >
          {newComment.length}/{MAX_COMMENT_LENGTH}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#C53030', // Accessible error color (5.89:1 on white)
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 12, // Increased for touch target
    backgroundColor: '#3D7A8C', // Accessible primary color
    borderRadius: 8,
    minHeight: MIN_TOUCH_TARGET_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F1F1F', // High contrast text (16.1:1 on white)
  },
  commentCount: {
    fontSize: 14,
    color: '#5C5C5C', // Accessible secondary text (5.91:1 on white)
  },
  listContent: {
    flexGrow: 1,
    paddingVertical: 8,
  },
  commentItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3D7A8C', // Accessible primary color
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  commentMeta: {
    flex: 1,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1F1F', // High contrast text
  },
  commentDate: {
    fontSize: 12,
    color: '#6B6B6B', // Accessible muted text (4.54:1 on white)
    marginTop: 2,
  },
  commentAction: {
    // Ensure minimum touch target size (WCAG 2.5.5)
    minWidth: MIN_TOUCH_TARGET_SIZE,
    minHeight: MIN_TOUCH_TARGET_SIZE,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteText: {
    fontSize: 12,
    color: '#C53030', // Accessible error/delete color
  },
  reportText: {
    fontSize: 12,
    color: '#5C5C5C', // Accessible secondary text
  },
  commentContent: {
    fontSize: 14,
    color: '#1F1F1F', // High contrast text
    lineHeight: 20,
    marginLeft: 42,
  },
  loadingMore: {
    padding: 16,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#5C5C5C', // Accessible secondary text
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B6B6B', // Accessible muted text
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET_SIZE, // Ensure minimum touch target
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    fontSize: 14,
    color: '#1F1F1F', // High contrast text
  },
  submitButton: {
    // Ensure minimum touch target size
    minWidth: MIN_TOUCH_TARGET_SIZE,
    minHeight: MIN_TOUCH_TARGET_SIZE,
    width: 60,
    height: MIN_TOUCH_TARGET_SIZE,
    backgroundColor: '#3D7A8C', // Accessible primary color
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#B0B0B0', // Slightly darker for better visibility
  },
  submitText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  characterCount: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  characterCountText: {
    fontSize: 12,
    color: '#6B6B6B', // Accessible muted text
  },
  characterCountOver: {
    color: '#C53030', // Accessible error color
  },
});
