# モバイルアプリ アーキテクチャ

塩尻レインボーシーカー React Nativeアプリのアーキテクチャドキュメント

## 技術スタック

| カテゴリ | ライブラリ | 用途 |
|---------|-----------|------|
| フレームワーク | React Native (Expo) | クロスプラットフォーム開発 |
| 言語 | TypeScript | 型安全性 |
| 状態管理 | Zustand | グローバル状態管理 |
| データ取得 | React Query | サーバー状態管理、キャッシュ |
| ナビゲーション | React Navigation | 画面遷移 |
| フォーム | React Hook Form | フォーム管理 |
| 国際化 | i18next | 多言語対応 |
| 地図 | react-native-maps | 地図表示 |
| カメラ | expo-camera | 写真撮影 |
| 通知 | expo-notifications | プッシュ通知 |

---

## プロジェクト構造

```
mobile/
├── src/
│   ├── components/           # 再利用可能なUIコンポーネント
│   │   ├── common/           # 汎用コンポーネント
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   └── Card.tsx
│   │   ├── photo/            # 写真関連コンポーネント
│   │   │   ├── PhotoCard.tsx
│   │   │   └── PhotoGrid.tsx
│   │   ├── map/              # 地図関連コンポーネント
│   │   │   └── MapMarker.tsx
│   │   └── accessibility/    # アクセシビリティコンポーネント
│   │       └── AccessibleTouchable.tsx
│   │
│   ├── screens/              # 画面コンポーネント
│   │   ├── auth/             # 認証画面
│   │   │   ├── LoginScreen.tsx
│   │   │   └── RegisterScreen.tsx
│   │   ├── home/             # ホーム画面
│   │   │   └── FeedScreen.tsx
│   │   ├── camera/           # カメラ画面
│   │   │   └── CameraScreen.tsx
│   │   ├── map/              # 地図画面
│   │   │   └── MapScreen.tsx
│   │   ├── profile/          # プロフィール画面
│   │   │   └── ProfileScreen.tsx
│   │   └── settings/         # 設定画面
│   │       ├── SettingsScreen.tsx
│   │       └── NotificationSettingsScreen.tsx
│   │
│   ├── navigation/           # ナビゲーション設定
│   │   ├── index.tsx         # ルートナビゲーター
│   │   ├── AuthNavigator.tsx
│   │   ├── MainNavigator.tsx
│   │   └── types.ts          # ナビゲーション型定義
│   │
│   ├── services/             # APIサービス
│   │   ├── api.ts            # Axiosインスタンス
│   │   ├── authService.ts    # 認証API
│   │   ├── photoService.ts   # 写真API
│   │   └── notificationService.ts
│   │
│   ├── hooks/                # カスタムフック
│   │   ├── useAuth.ts        # 認証フック
│   │   ├── usePhotos.ts      # 写真フック (React Query)
│   │   └── useLocation.ts    # 位置情報フック
│   │
│   ├── store/                # Zustandストア
│   │   ├── authStore.ts      # 認証状態
│   │   ├── settingsStore.ts  # 設定
│   │   └── onboardingStore.ts
│   │
│   ├── utils/                # ユーティリティ
│   │   ├── storage.ts        # AsyncStorage
│   │   ├── validation.ts     # バリデーション
│   │   └── accessibility.ts  # アクセシビリティヘルパー
│   │
│   ├── types/                # TypeScript型定義
│   │   ├── api.ts            # APIレスポンス型
│   │   ├── models.ts         # データモデル型
│   │   └── navigation.ts
│   │
│   ├── i18n/                 # 国際化
│   │   ├── index.ts          # i18n設定
│   │   └── locales/
│   │       ├── ja.json       # 日本語
│   │       └── en.json       # 英語
│   │
│   ├── constants/            # 定数
│   │   ├── colors.ts
│   │   ├── spacing.ts
│   │   └── config.ts
│   │
│   └── assets/               # 静的アセット
│       ├── images/
│       └── fonts/
│
├── e2e/                      # E2Eテスト (Detox)
│   ├── specs/
│   └── helpers/
│
├── __tests__/                # ユニットテスト
│
├── App.tsx                   # エントリーポイント
├── app.json                  # Expo設定
├── tsconfig.json             # TypeScript設定
└── package.json
```

---

## アーキテクチャパターン

### 状態管理戦略

```
┌─────────────────────────────────────────────────┐
│                  React Query                     │
│         (サーバー状態、キャッシュ、同期)          │
└─────────────────────────────────────────────────┘
                      ↑ ↓
┌─────────────────────────────────────────────────┐
│                    Zustand                       │
│       (クライアント状態、認証、設定)             │
└─────────────────────────────────────────────────┘
                      ↑ ↓
┌─────────────────────────────────────────────────┐
│              Component State                     │
│           (UIのローカル状態)                     │
└─────────────────────────────────────────────────┘
```

#### サーバー状態 (React Query)

```typescript
// hooks/usePhotos.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { photoService } from '@/services/photoService';

export function usePhotos(filters?: PhotoFilters) {
  return useQuery({
    queryKey: ['photos', filters],
    queryFn: () => photoService.getPhotos(filters),
    staleTime: 5 * 60 * 1000, // 5分
  });
}

export function useLikePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: photoService.likePhoto,
    onMutate: async (photoId) => {
      // オプティミスティック更新
      await queryClient.cancelQueries(['photos']);
      const previous = queryClient.getQueryData(['photos']);
      queryClient.setQueryData(['photos'], (old) => /* 更新 */);
      return { previous };
    },
    onError: (err, photoId, context) => {
      // ロールバック
      queryClient.setQueryData(['photos'], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries(['photos']);
    },
  });
}
```

#### クライアント状態 (Zustand)

```typescript
// store/authStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthState {
  user: User | null;
  tokens: Tokens | null;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  setTokens: (tokens: Tokens) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: true }),
      setTokens: (tokens) => set({ tokens }),
      logout: () => set({ user: null, tokens: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

---

## ナビゲーション構造

```
RootNavigator
├── AuthNavigator (未認証)
│   ├── LoginScreen
│   ├── RegisterScreen
│   └── ForgotPasswordScreen
│
└── MainNavigator (認証済み)
    └── TabNavigator
        ├── FeedStack
        │   ├── FeedScreen
        │   └── PhotoDetailScreen
        │
        ├── CameraStack
        │   ├── CameraScreen
        │   └── PhotoPreviewScreen
        │
        ├── MapStack
        │   ├── MapScreen
        │   └── LocationDetailScreen
        │
        └── ProfileStack
            ├── ProfileScreen
            ├── EditProfileScreen
            ├── SettingsScreen
            └── NotificationSettingsScreen
```

---

## API通信

### Axiosインスタンス

```typescript
// services/api.ts
import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

const api = axios.create({
  baseURL: process.env.API_URL,
  timeout: 30000,
});

// リクエストインターセプター (トークン付与)
api.interceptors.request.use((config) => {
  const tokens = useAuthStore.getState().tokens;
  if (tokens?.access_token) {
    config.headers.Authorization = `Bearer ${tokens.access_token}`;
  }
  return config;
});

// レスポンスインターセプター (トークンリフレッシュ)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // トークンリフレッシュロジック
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

## テスト戦略

### ユニットテスト (Jest)

```typescript
// __tests__/components/PhotoCard.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { PhotoCard } from '@/components/photo/PhotoCard';

describe('PhotoCard', () => {
  const mockPhoto = {
    id: '1',
    image_url: 'https://example.com/photo.jpg',
    user: { display_name: 'テスト' },
    stats: { likes_count: 10 },
  };

  it('写真が表示される', () => {
    const { getByTestId } = render(<PhotoCard photo={mockPhoto} />);
    expect(getByTestId('photo-image')).toBeTruthy();
  });

  it('いいねボタンが動作する', () => {
    const onLike = jest.fn();
    const { getByTestId } = render(
      <PhotoCard photo={mockPhoto} onLike={onLike} />
    );
    fireEvent.press(getByTestId('like-button'));
    expect(onLike).toHaveBeenCalledWith('1');
  });
});
```

### E2Eテスト (Detox)

```typescript
// e2e/specs/auth.e2e.ts
describe('認証フロー', () => {
  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('ログインできる', async () => {
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('Password123!');
    await element(by.id('login-button')).tap();

    await waitFor(element(by.id('feed-screen')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
```

---

## パフォーマンス最適化

### 画像最適化

```typescript
// components/photo/OptimizedImage.tsx
import { Image } from 'expo-image';

export function OptimizedImage({ uri, ...props }) {
  return (
    <Image
      source={{ uri }}
      placeholder={blurhash}
      contentFit="cover"
      transition={200}
      cachePolicy="memory-disk"
      {...props}
    />
  );
}
```

### リスト最適化

```typescript
// screens/home/FeedScreen.tsx
import { FlashList } from '@shopify/flash-list';

export function FeedScreen() {
  return (
    <FlashList
      data={photos}
      renderItem={({ item }) => <PhotoCard photo={item} />}
      estimatedItemSize={300}
      onEndReached={fetchNextPage}
      onEndReachedThreshold={0.5}
    />
  );
}
```

---

## アクセシビリティ

### ガイドライン

- タッチターゲット: 最小44x44pt
- コントラスト比: 4.5:1以上
- すべてのインタラクティブ要素にaccessibilityLabel
- スクリーンリーダー対応

```typescript
// components/accessibility/AccessibleTouchable.tsx
export function AccessibleTouchable({
  label,
  hint,
  onPress,
  children,
  ...props
}) {
  return (
    <TouchableOpacity
      accessible={true}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.touchTarget}
      {...props}
    >
      {children}
    </TouchableOpacity>
  );
}
```

---

## エラーハンドリング

```typescript
// App.tsx
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <View style={styles.container}>
      <Text>エラーが発生しました</Text>
      <Button onPress={resetErrorBoundary}>再試行</Button>
    </View>
  );
}

export default function App() {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error) => Sentry.captureException(error)}
    >
      <Navigation />
    </ErrorBoundary>
  );
}
```

---

## 参考リンク

- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [React Query](https://tanstack.com/query/latest)
- [Zustand](https://docs.pmnd.rs/zustand/getting-started/introduction)
