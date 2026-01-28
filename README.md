# 塩尻レインボーシーカー (Shiojiri Rainbow Seeker)

長野県塩尻市（特に大門地区）における虹の目撃情報を収集・分析し、「大門地区が日本の他の地域に比べて虹を目撃しやすい」という仮説を科学的に検証するためのデータプラットフォームです。

## 機能

### コア機能
- **虹の目撃投稿** - 写真アップロード、GPS位置情報（自動/手動）、コメント・詳細情報
- **気象データ自動記録** - 投稿時の雨雲レーダースナップショット、気温・湿度・風向・風速・気圧・日照条件
- **地図表示** - 目撃位置のマップ表示、大門地区のフォーカスビュー、ヒートマップ表示
- **LINE通知** - 新規目撃情報のリアルタイム通知、エリア設定による通知フィルタリング

### 分析機能
- **統計ダッシュボード** - 地域別・期間別の目撃頻度、気象条件との相関分析、他地域との比較データ

### 管理機能
- 投稿のモデレーション
- 不適切コンテンツの管理
- ユーザー管理

## 技術スタック

### バックエンド
| コンポーネント | 技術 | バージョン |
|--------------|------|----------|
| Framework | Ruby on Rails | 8.0.4 |
| Language | Ruby | 3.2+ |
| Database | PostgreSQL + PostGIS | 15+ |
| Job Queue | Solid Queue | - |
| Cache | Solid Cache | - |
| Authentication | Devise + JWT | - |

### モバイルアプリ
| コンポーネント | 技術 | バージョン |
|--------------|------|----------|
| Framework | React Native | 0.81.5 |
| Platform | Expo | 54.0.31 |
| Language | TypeScript | 5.9 |
| State Management | Zustand | 5.0 |
| Navigation | React Navigation | 7.x |
| Maps | react-native-maps | 1.20 |

## プロジェクト構成

```
.
├── backend/          # Ruby on Rails APIサーバー
├── mobile/           # React Native / Expoモバイルアプリ
├── docs/             # ドキュメント
├── k6/               # 負荷テストスクリプト
└── .github/          # GitHub Actions設定
```

## セットアップ

### 前提条件
- Ruby 3.2以上
- Node.js 18以上
- PostgreSQL 15以上（PostGIS拡張込み）
- Redis（開発環境では任意）

### バックエンド

```bash
cd backend

# 依存関係のインストール
bundle install

# 環境変数の設定
cp .env.example .env
# .envを編集して必要な値を設定

# データベースのセットアップ
rails db:create db:migrate db:seed

# サーバー起動
rails server
```

### モバイルアプリ

```bash
cd mobile

# 依存関係のインストール
npm install

# 開発サーバー起動
npm start

# iOS/Androidで実行
npm run ios
npm run android
```

## テスト

### バックエンド
```bash
cd backend
bundle exec rspec
```

### モバイルアプリ
```bash
cd mobile

# Lint
npm run lint

# 型チェック
npm run type-check

# E2Eテスト (iOS)
npm run e2e:ios

# E2Eテスト (Android)
npm run e2e:android
```

## ドキュメント

詳細なドキュメントは `docs/` ディレクトリを参照してください。

- [API仕様](docs/api.md)
- [デプロイメント](docs/deployment.md)
- [開発ガイド](docs/development.md)
- [モバイルアーキテクチャ](docs/mobile-architecture.md)
- [運用ガイド](docs/operations.md)

## ライセンス

MIT License
