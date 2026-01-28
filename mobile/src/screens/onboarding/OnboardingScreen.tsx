/**
 * OnboardingScreen - First-time user onboarding flow
 *
 * Features:
 * - 5 swipeable slides introducing app features
 * - Welcome, Camera, Gallery, Map, and Notifications slides
 * - Skip button to bypass onboarding
 * - Next and Get Started buttons
 * - Pagination dots indicator
 *
 * Requirements: FR-11 (AC-11.1 ~ AC-11.4)
 * - AC-11.1: Display onboarding on first launch
 * - AC-11.2: Explain main features (camera, gallery, map, notifications)
 * - AC-11.3: Provide skip functionality
 * - AC-11.4: Don't show again after completion (managed by AsyncStorage)
 */

import React, { useCallback, useRef, useState } from 'react';

import {
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ListRenderItem,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../components/ui';
import { useOnboardingStore } from '../../store/onboardingStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Slide data interface
 */
interface OnboardingSlide {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  subtitle: string;
  description: string;
}

/**
 * Onboarding slides data
 */
const SLIDES: OnboardingSlide[] = [
  {
    id: 'welcome',
    icon: 'color-palette',
    iconColor: '#4A90A4',
    title: 'Shiojiri Rainbow Seeker へようこそ',
    subtitle: 'Welcome to Rainbow Seeker',
    description:
      '塩尻市で見つけた美しい虹を撮影し、共有しましょう。虹の発見を通じて、地域コミュニティとつながりましょう。',
  },
  {
    id: 'camera',
    icon: 'camera',
    iconColor: '#27AE60',
    title: '虹を撮影',
    subtitle: 'Capture Rainbows',
    description:
      '虹を見つけたら、アプリ内のカメラで撮影しましょう。位置情報と一緒に記録され、あなたの発見が共有されます。',
  },
  {
    id: 'gallery',
    icon: 'images',
    iconColor: '#9B59B6',
    title: 'ギャラリーで閲覧',
    subtitle: 'Browse Gallery',
    description:
      '他のユーザーが撮影した虹の写真をギャラリーで閲覧できます。いいねやコメントで交流しましょう。',
  },
  {
    id: 'map',
    icon: 'map',
    iconColor: '#E67E22',
    title: 'マップで探索',
    subtitle: 'Explore on Map',
    description:
      '塩尻市のマップ上で虹の発見場所を確認できます。どこで虹が見られるか、探索してみましょう。',
  },
  {
    id: 'notifications',
    icon: 'notifications',
    iconColor: '#3498DB',
    title: '通知を受け取る',
    subtitle: 'Get Notifications',
    description:
      '新しい虹の発見や、あなたの投稿へのいいね・コメントがあった時に通知でお知らせします。',
  },
];

/**
 * OnboardingScreen component
 */
export const OnboardingScreen: React.FC = () => {
  const flatListRef = useRef<FlatList<OnboardingSlide>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const completeOnboarding = useOnboardingStore(
    (state) => state.completeOnboarding
  );

  const isLastSlide = currentIndex === SLIDES.length - 1;

  /**
   * Handle scroll end to update current index
   */
  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / SCREEN_WIDTH);
      setCurrentIndex(index);
    },
    []
  );

  /**
   * Handle skip button press
   */
  const handleSkip = useCallback(async () => {
    await completeOnboarding();
  }, [completeOnboarding]);

  /**
   * Handle next button press
   */
  const handleNext = useCallback(() => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    }
  }, [currentIndex]);

  /**
   * Handle get started button press
   */
  const handleGetStarted = useCallback(async () => {
    await completeOnboarding();
  }, [completeOnboarding]);

  /**
   * Render a single slide
   */
  const renderSlide: ListRenderItem<OnboardingSlide> = useCallback(
    ({ item }) => (
      <View style={styles.slide} testID={`onboarding-slide-${item.id}`}>
        <View style={styles.slideContent}>
          {/* Icon */}
          <View
            style={[styles.iconContainer, { backgroundColor: `${item.iconColor}15` }]}
          >
            <Ionicons name={item.icon} size={80} color={item.iconColor} />
          </View>

          {/* Text content */}
          <View style={styles.textContainer}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>
        </View>
      </View>
    ),
    []
  );

  /**
   * Render pagination dots
   */
  const renderPagination = useCallback(() => {
    return (
      <View style={styles.pagination} testID="onboarding-pagination-dots">
        {SLIDES.map((slide, index) => (
          <View
            key={slide.id}
            style={[
              styles.paginationDot,
              index === currentIndex && styles.paginationDotActive,
            ]}
          />
        ))}
      </View>
    );
  }, [currentIndex]);

  return (
    <SafeAreaView style={styles.container} testID="onboarding-screen">
      {/* Skip button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          accessibilityRole="button"
          accessibilityLabel="オンボーディングをスキップ"
          testID="onboarding-skip-button"
        >
          <Text style={styles.skipText}>スキップ</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        bounces={false}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Footer with pagination and buttons */}
      <View style={styles.footer}>
        {renderPagination()}

        <View style={styles.buttonContainer}>
          {isLastSlide ? (
            <Button
              title="はじめる"
              onPress={handleGetStarted}
              fullWidth
              size="large"
              icon="arrow-forward"
              iconPosition="right"
              testID="onboarding-get-started-button"
            />
          ) : (
            <Button
              title="次へ"
              onPress={handleNext}
              fullWidth
              size="large"
              icon="arrow-forward"
              iconPosition="right"
              testID="onboarding-next-button"
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  skipButton: {
    padding: 10,
  },
  skipText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 80,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#4A90A4',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: '#4A90A4',
    width: 24,
  },
  buttonContainer: {
    width: '100%',
  },
});
