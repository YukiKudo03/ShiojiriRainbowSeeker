# デプロイ手順書

塩尻レインボーシーカー バックエンドAPIのデプロイ手順

## 概要

本プロジェクトは**Kamal 2**を使用してDockerコンテナをデプロイします。

### デプロイフロー

```
開発 → GitHub Push → CI/CD → Docker Build → Kamal Deploy → 本番
```

### 環境構成

| 環境 | ブランチ | URL |
|-----|---------|-----|
| 本番 | main | https://api.shiojiri-rainbow.app |
| ステージング | develop | https://staging-api.shiojiri-rainbow.app |

---

## 前提条件

### サーバー要件

- **OS**: Ubuntu 22.04 LTS以上
- **CPU**: 2コア以上
- **メモリ**: 4GB以上
- **ストレージ**: 50GB以上 (SSD推奨)
- **Docker**: 24.0以上
- **SSH**: 公開鍵認証でアクセス可能

### 必要なアカウント・サービス

1. **Docker Hub** (または他のコンテナレジストリ)
2. **AWS** (S3, CloudFront)
3. **OpenWeatherMap API**
4. **Firebase** (Cloud Messaging)
5. **Sentry** (エラートラッキング)
6. **ドメイン** (DNS設定済み)

---

## 初期セットアップ

### 1. サーバー準備

```bash
# サーバーにSSH接続
ssh deploy@your-server-ip

# Dockerインストール (Ubuntu)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker deploy

# 再ログインしてDocker確認
docker --version
```

### 2. ローカル環境準備

```bash
# リポジトリをクローン
git clone https://github.com/your-org/shiojiri-rainbow-seeker.git
cd shiojiri-rainbow-seeker/backend

# 依存関係インストール
bundle install

# Kamalインストール確認
bundle exec kamal version
```

### 3. シークレット設定

`.kamal/secrets`ファイルを編集し、環境変数を設定:

```bash
# 環境変数をエクスポート
export KAMAL_REGISTRY_PASSWORD="your-docker-hub-token"
export RAILS_MASTER_KEY=$(cat config/master.key)
export SHIOJIRI_RAINBOW_SEEKER_DATABASE_PASSWORD="secure-db-password"
export AWS_ACCESS_KEY_ID="your-aws-key"
export AWS_SECRET_ACCESS_KEY="your-aws-secret"
export OPENWEATHER_API_KEY="your-openweather-key"
export FCM_SERVER_KEY="your-fcm-key"
export SENTRY_DSN="your-sentry-dsn"
```

### 4. deploy.yml設定

`config/deploy.yml`を環境に合わせて編集:

```yaml
# サーバーIPを設定
servers:
  web:
    hosts:
      - your-server-ip

# ドメインを設定
proxy:
  ssl: true
  host: api.shiojiri-rainbow.app

# レジストリ設定
registry:
  username: your-dockerhub-username
```

---

## デプロイ手順

### 初回デプロイ

```bash
cd backend

# Kamalセットアップ (初回のみ)
bundle exec kamal setup

# これにより以下が実行されます:
# - Dockerのインストール確認
# - Traefik (リバースプロキシ) のセットアップ
# - SSL証明書の取得 (Let's Encrypt)
# - データベースアクセサリの起動
# - アプリケーションのデプロイ
```

### 通常デプロイ

```bash
# 本番環境へデプロイ
bundle exec kamal deploy

# ステージング環境へデプロイ
bundle exec kamal deploy -d staging
```

### CI/CDによる自動デプロイ

GitHub Actionsにより以下のタイミングで自動デプロイが実行されます:

- `main`ブランチへのプッシュ → 本番環境
- `develop`ブランチへのプッシュ → ステージング環境

### 手動デプロイ (GitHub Actions)

1. GitHubリポジトリの「Actions」タブを開く
2. 「Deploy」ワークフローを選択
3. 「Run workflow」をクリック
4. 環境を選択して実行

---

## デプロイ後の確認

### ヘルスチェック

```bash
# 簡易チェック
curl -f https://api.shiojiri-rainbow.app/up

# 詳細チェック (認証必要)
curl -H "Authorization: Bearer <token>" \
  https://api.shiojiri-rainbow.app/api/v1/health
```

### ログ確認

```bash
# リアルタイムログ
bundle exec kamal logs -f

# 特定サーバーのログ
bundle exec kamal logs -f --host your-server-ip
```

### Railsコンソール

```bash
bundle exec kamal console
```

---

## ロールバック

### 直前のバージョンに戻す

```bash
# 利用可能なバージョン確認
bundle exec kamal app versions

# ロールバック実行
bundle exec kamal rollback <version>
```

### 緊急時のロールバック

```bash
# 強制停止
bundle exec kamal app stop

# 特定バージョンで再起動
bundle exec kamal deploy --version <version>
```

---

## データベース操作

### マイグレーション

```bash
# マイグレーション実行
bundle exec kamal app exec "bin/rails db:migrate"

# マイグレーション状態確認
bundle exec kamal app exec "bin/rails db:migrate:status"
```

### バックアップ

```bash
# データベースバックアップ
bundle exec kamal accessory exec db \
  "pg_dump -U shiojiri_rainbow_seeker shiojiri_rainbow_seeker_production > /backup/backup_$(date +%Y%m%d).sql"
```

### リストア

```bash
# データベースリストア (注意: 本番データが上書きされます)
bundle exec kamal accessory exec db \
  "psql -U shiojiri_rainbow_seeker shiojiri_rainbow_seeker_production < /backup/backup_YYYYMMDD.sql"
```

---

## トラブルシューティング

### デプロイ失敗時

1. **ログ確認**
   ```bash
   bundle exec kamal logs
   ```

2. **コンテナ状態確認**
   ```bash
   bundle exec kamal app details
   ```

3. **ヘルスチェック確認**
   ```bash
   bundle exec kamal app exec "curl -f http://localhost:3000/up"
   ```

### SSL証明書の問題

```bash
# 証明書の再取得
bundle exec kamal proxy reboot
```

### データベース接続エラー

```bash
# DBアクセサリの状態確認
bundle exec kamal accessory details db

# DB再起動
bundle exec kamal accessory reboot db
```

### ディスク容量不足

```bash
# 古いイメージの削除
bundle exec kamal prune all
```

---

## 環境変数一覧

| 変数名 | 説明 | 必須 |
|-------|------|-----|
| RAILS_MASTER_KEY | Rails credentials復号キー | ○ |
| SHIOJIRI_RAINBOW_SEEKER_DATABASE_PASSWORD | データベースパスワード | ○ |
| DATABASE_HOST | データベースホスト | ○ |
| DATABASE_PORT | データベースポート | - |
| AWS_ACCESS_KEY_ID | AWS認証キー | ○ |
| AWS_SECRET_ACCESS_KEY | AWSシークレットキー | ○ |
| AWS_REGION | AWSリージョン | ○ |
| AWS_BUCKET | S3バケット名 | ○ |
| OPENWEATHER_API_KEY | OpenWeatherMap APIキー | ○ |
| FCM_SERVER_KEY | Firebase Cloud Messagingキー | ○ |
| SENTRY_DSN | Sentry接続文字列 | - |
| SENTRY_ENVIRONMENT | Sentry環境名 | - |
| WEB_CONCURRENCY | Pumaワーカー数 | - |
| RAILS_MAX_THREADS | Pumaスレッド数 | - |
| SOLID_QUEUE_IN_PUMA | Puma内でSolid Queue実行 | - |

---

## セキュリティ注意事項

1. **master.keyは絶対にGitにコミットしない**
2. **本番環境のシークレットは環境変数またはシークレット管理サービスで管理**
3. **SSHキーは定期的にローテーション**
4. **ファイアウォールで必要なポートのみ開放**
   - 80 (HTTP → HTTPS redirect)
   - 443 (HTTPS)
   - 22 (SSH、可能なら制限)

---

## 参考リンク

- [Kamal 2 ドキュメント](https://kamal-deploy.org/)
- [Rails 8 ガイド](https://guides.rubyonrails.org/)
- [Docker ドキュメント](https://docs.docker.com/)
