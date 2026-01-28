# API仕様書

塩尻レインボーシーカー バックエンドAPI仕様書

## 概要

- **ベースURL**: `https://api.shiojiri-rainbow.app/api/v1`
- **認証方式**: JWT Bearer Token
- **コンテンツタイプ**: `application/json`
- **文字エンコーディング**: UTF-8

## 認証

### 認証ヘッダー

```
Authorization: Bearer <access_token>
```

### トークン有効期限

| トークン種別 | 有効期限 |
|-------------|---------|
| アクセストークン | 15分 |
| リフレッシュトークン | 7日 |

---

## エンドポイント一覧

### 認証 (Authentication)

| メソッド | パス | 説明 | 認証 |
|---------|------|------|-----|
| POST | `/auth/register` | ユーザー登録 | 不要 |
| POST | `/auth/login` | ログイン | 不要 |
| DELETE | `/auth/logout` | ログアウト | 必要 |
| POST | `/auth/refresh` | トークン更新 | 必要 |
| POST | `/auth/password/reset` | パスワードリセット要求 | 不要 |
| PUT | `/auth/password/reset` | パスワードリセット確認 | 不要 |
| GET | `/auth/verify_email/:token` | メール認証 | 不要 |

### 写真 (Photos)

| メソッド | パス | 説明 | 認証 |
|---------|------|------|-----|
| GET | `/photos` | 写真一覧取得 | 不要 |
| GET | `/photos/:id` | 写真詳細取得 | 不要 |
| POST | `/photos` | 写真投稿 | 必要 |
| PATCH | `/photos/:id` | 写真更新 | 必要 |
| DELETE | `/photos/:id` | 写真削除 | 必要 |
| GET | `/photos/:id/weather` | 写真の気象データ取得 | 不要 |

### 地図 (Maps)

| メソッド | パス | 説明 | 認証 |
|---------|------|------|-----|
| GET | `/maps/markers` | マーカー取得 | 不要 |
| GET | `/maps/clusters` | クラスターマーカー取得 | 不要 |
| GET | `/maps/heatmap` | ヒートマップデータ取得 | 不要 |

### ソーシャル (Social)

| メソッド | パス | 説明 | 認証 |
|---------|------|------|-----|
| POST | `/photos/:photo_id/likes` | いいね追加 | 必要 |
| DELETE | `/photos/:photo_id/likes` | いいね削除 | 必要 |
| GET | `/photos/:photo_id/comments` | コメント一覧取得 | 不要 |
| POST | `/photos/:photo_id/comments` | コメント投稿 | 必要 |
| DELETE | `/comments/:id` | コメント削除 | 必要 |
| POST | `/reports` | コンテンツ報告 | 必要 |

### 通知 (Notifications)

| メソッド | パス | 説明 | 認証 |
|---------|------|------|-----|
| GET | `/notifications` | 通知一覧取得 | 必要 |
| POST | `/notifications/mark_read` | 既読にする | 必要 |
| GET | `/notifications/settings` | 通知設定取得 | 必要 |
| PUT | `/notifications/settings` | 通知設定更新 | 必要 |
| POST | `/notifications/devices` | デバイストークン登録 | 必要 |
| DELETE | `/notifications/devices` | デバイストークン削除 | 必要 |

### ユーザー (Users)

| メソッド | パス | 説明 | 認証 |
|---------|------|------|-----|
| GET | `/users/me` | 自分のプロフィール取得 | 必要 |
| PATCH | `/users/me` | プロフィール更新 | 必要 |
| GET | `/users/me/photos` | 自分の写真一覧 | 必要 |
| POST | `/users/me/export` | データエクスポート要求 | 必要 |
| POST | `/users/me/delete` | アカウント削除要求 | 必要 |
| DELETE | `/users/me/delete` | 削除要求キャンセル | 必要 |
| GET | `/users/me/deletion_status` | 削除ステータス確認 | 必要 |
| GET | `/users/:id` | ユーザープロフィール取得 | 不要 |
| GET | `/users/:id/photos` | ユーザーの写真一覧 | 不要 |

### 管理者 (Admin)

| メソッド | パス | 説明 | 認証 |
|---------|------|------|-----|
| GET | `/admin/reports` | 報告一覧取得 | 管理者 |
| GET | `/admin/reports/:id` | 報告詳細取得 | 管理者 |
| POST | `/admin/reports/:id/process` | 報告処理 | 管理者 |

### ヘルスチェック (Health)

| メソッド | パス | 説明 | 認証 |
|---------|------|------|-----|
| GET | `/health` | 詳細ヘルスチェック | 必要 |
| GET | `/health/ready` | 準備状態確認 | 不要 |
| GET | `/health/live` | 生存確認 | 不要 |

---

## 詳細仕様

### 認証API

#### POST /auth/register - ユーザー登録

**リクエスト**
```json
{
  "user": {
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "password_confirmation": "SecurePassword123!",
    "display_name": "虹ハンター"
  }
}
```

**レスポンス (201 Created)**
```json
{
  "message": "確認メールを送信しました。メール内のリンクをクリックして登録を完了してください。"
}
```

**バリデーション**
- `email`: 必須、有効なメールアドレス形式、一意
- `password`: 必須、8文字以上、大文字・小文字・数字・記号を含む
- `display_name`: 必須、2〜50文字

#### POST /auth/login - ログイン

**リクエスト**
```json
{
  "user": {
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }
}
```

**レスポンス (200 OK)**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "display_name": "虹ハンター",
    "profile_image_url": "https://...",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "tokens": {
    "access_token": "eyJhbG...",
    "refresh_token": "eyJhbG...",
    "expires_in": 900
  }
}
```

**エラーレスポンス (401 Unauthorized)**
```json
{
  "error": {
    "code": 1002,
    "message": "メールアドレスまたはパスワードが正しくありません"
  }
}
```

### 写真API

#### GET /photos - 写真一覧取得

**クエリパラメータ**
| パラメータ | 型 | 説明 | デフォルト |
|-----------|------|------|---------|
| page | integer | ページ番号 | 1 |
| per_page | integer | 1ページあたりの件数 | 20 |
| sort | string | ソート順 (recent, popular) | recent |
| lat | float | 中心緯度 | - |
| lng | float | 中心経度 | - |
| radius | integer | 検索半径(km) | 25 |
| start_date | date | 開始日 | - |
| end_date | date | 終了日 | - |
| user_id | uuid | ユーザーID | - |

**レスポンス (200 OK)**
```json
{
  "photos": [
    {
      "id": "uuid",
      "image_url": "https://...",
      "thumbnail_url": "https://...",
      "location": {
        "latitude": 36.1152,
        "longitude": 137.9542,
        "address": "長野県塩尻市大門一番町"
      },
      "taken_at": "2024-01-15T16:30:00Z",
      "user": {
        "id": "uuid",
        "display_name": "虹ハンター",
        "profile_image_url": "https://..."
      },
      "stats": {
        "likes_count": 42,
        "comments_count": 5
      },
      "liked_by_current_user": false
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 10,
    "total_count": 195,
    "per_page": 20
  }
}
```

#### POST /photos - 写真投稿

**リクエスト (multipart/form-data)**
```
photo[image]: <binary>
photo[latitude]: 36.1152
photo[longitude]: 137.9542
photo[taken_at]: 2024-01-15T16:30:00Z
photo[description]: 塩尻駅前で見つけた虹
photo[visibility]: public
```

**レスポンス (201 Created)**
```json
{
  "photo": {
    "id": "uuid",
    "image_url": "https://...",
    "status": "processing",
    "message": "写真がアップロードされました。処理完了後に公開されます。"
  }
}
```

### 通知設定API

#### PUT /notifications/settings - 通知設定更新

**リクエスト**
```json
{
  "settings": {
    "rainbow_alerts": true,
    "alert_radius_km": 10,
    "likes_enabled": true,
    "comments_enabled": true,
    "quiet_hours_enabled": true,
    "quiet_hours_start": "22:00",
    "quiet_hours_end": "07:00"
  }
}
```

**レスポンス (200 OK)**
```json
{
  "settings": {
    "rainbow_alerts": true,
    "alert_radius_km": 10,
    "likes_enabled": true,
    "comments_enabled": true,
    "quiet_hours_enabled": true,
    "quiet_hours_start": "22:00",
    "quiet_hours_end": "07:00",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

---

## エラーコード一覧

### 認証エラー (1000番台)

| コード | HTTPステータス | メッセージ |
|-------|--------------|-----------|
| 1001 | 401 | 認証が必要です |
| 1002 | 401 | メールアドレスまたはパスワードが正しくありません |
| 1003 | 401 | トークンが無効または期限切れです |
| 1004 | 403 | メールアドレスが未確認です |
| 1005 | 403 | アカウントがロックされています |
| 1006 | 422 | パスワードが要件を満たしていません |

### リソースエラー (2000番台)

| コード | HTTPステータス | メッセージ |
|-------|--------------|-----------|
| 2001 | 404 | リソースが見つかりません |
| 2002 | 403 | このリソースにアクセスする権限がありません |
| 2003 | 409 | リソースが既に存在します |
| 2004 | 422 | バリデーションエラー |

### 写真エラー (3000番台)

| コード | HTTPステータス | メッセージ |
|-------|--------------|-----------|
| 3001 | 422 | 画像ファイルが必要です |
| 3002 | 422 | 画像形式がサポートされていません (JPEG, PNG, HEIC) |
| 3003 | 422 | 画像サイズが上限を超えています (20MB) |
| 3004 | 422 | 位置情報が必要です |
| 3005 | 422 | 撮影日時が未来の日付です |

### サーバーエラー (5000番台)

| コード | HTTPステータス | メッセージ |
|-------|--------------|-----------|
| 5001 | 500 | 内部サーバーエラー |
| 5002 | 503 | サービス一時停止中 |
| 5003 | 504 | 外部サービスタイムアウト |

---

## レート制限

| エンドポイント | 制限 |
|--------------|------|
| 認証API | 10リクエスト/分 |
| 写真アップロード | 30リクエスト/時 |
| 一般API | 100リクエスト/分 |

レート制限超過時のレスポンス:
```json
{
  "error": {
    "code": 4001,
    "message": "リクエスト数が制限を超えました。しばらく待ってから再試行してください。",
    "retry_after": 60
  }
}
```

---

## 多言語対応

`Accept-Language`ヘッダーで言語を指定できます。

```
Accept-Language: ja
Accept-Language: en
```

サポート言語: `ja` (日本語), `en` (英語)

---

## Webhook (将来実装)

虹出現アラートやユーザーアクションに対するWebhook通知は将来のバージョンで実装予定です。

---

## 変更履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|---------|
| 1.0.0 | 2024-01-15 | 初版リリース |
