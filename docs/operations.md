# 運用マニュアル

塩尻レインボーシーカー システム運用マニュアル

## 概要

本ドキュメントは、塩尻レインボーシーカーの日常運用、監視、トラブルシューティングについて説明します。

---

## システム構成

```
[ユーザー] → [CloudFlare CDN] → [Kamal Proxy (Traefik)]
                                       ↓
                              [Rails API (Puma)]
                                   ↓       ↓
                            [PostgreSQL] [S3]
                                   ↓
                            [Solid Queue Worker]
```

### コンポーネント

| コンポーネント | 役割 | ポート |
|--------------|------|-------|
| Traefik | リバースプロキシ、SSL終端 | 80, 443 |
| Puma | Railsアプリケーションサーバー | 3000 |
| PostgreSQL + PostGIS | データベース | 5432 |
| Solid Queue | バックグラウンドジョブ | - |
| S3 | 画像ストレージ | - |

---

## 日常運用

### 毎日の確認事項

1. **ヘルスチェック**
   ```bash
   curl -f https://api.shiojiri-rainbow.app/up
   ```

2. **エラー監視 (Sentry)**
   - [Sentry Dashboard](https://sentry.io/)でエラー発生状況を確認
   - 新規エラーがないか確認

3. **ログ確認**
   ```bash
   bundle exec kamal logs --since 1h
   ```

### 週次の確認事項

1. **パフォーマンスメトリクス確認**
   - 平均応答時間
   - エラー率
   - リクエスト数

2. **ディスク使用量確認**
   ```bash
   bundle exec kamal app exec "df -h"
   ```

3. **データベースサイズ確認**
   ```bash
   bundle exec kamal accessory exec db \
     "psql -U shiojiri_rainbow_seeker -c \"SELECT pg_size_pretty(pg_database_size('shiojiri_rainbow_seeker_production'));\""
   ```

4. **セキュリティアップデート確認**
   - Dependabotアラートの確認
   - bundler-auditの実行

---

## 監視項目

### アプリケーション監視

| 項目 | 正常値 | 警告閾値 | 緊急閾値 |
|-----|-------|---------|---------|
| 応答時間 (p95) | < 200ms | > 500ms | > 1000ms |
| エラー率 | < 0.1% | > 1% | > 5% |
| メモリ使用率 | < 70% | > 80% | > 90% |
| CPU使用率 | < 60% | > 80% | > 95% |

### データベース監視

| 項目 | 正常値 | 警告閾値 | 緊急閾値 |
|-----|-------|---------|---------|
| 接続数 | < 50 | > 80 | > 95 |
| クエリ時間 | < 100ms | > 500ms | > 1000ms |
| ディスク使用率 | < 70% | > 80% | > 90% |

### ジョブキュー監視

| 項目 | 正常値 | 警告閾値 | 緊急閾値 |
|-----|-------|---------|---------|
| 待機ジョブ数 | < 100 | > 500 | > 1000 |
| 失敗ジョブ数 | 0 | > 10 | > 50 |
| 処理時間 | < 30s | > 60s | > 120s |

---

## アラート対応

### エラーレベル

| レベル | 対応 | 対応時間 |
|-------|-----|---------|
| Critical | 即時対応 | 15分以内 |
| High | 緊急対応 | 1時間以内 |
| Medium | 当日対応 | 8時間以内 |
| Low | 計画対応 | 1週間以内 |

### Critical: サービス停止

1. **状況確認**
   ```bash
   bundle exec kamal app details
   bundle exec kamal logs --since 5m
   ```

2. **復旧手順**
   ```bash
   # コンテナ再起動
   bundle exec kamal app boot

   # 改善しない場合はロールバック
   bundle exec kamal rollback <previous-version>
   ```

3. **根本原因分析**
   - ログ分析
   - Sentryエラー確認
   - 直近のデプロイ内容確認

### High: データベース接続エラー

1. **DB状態確認**
   ```bash
   bundle exec kamal accessory details db
   ```

2. **接続数確認**
   ```bash
   bundle exec kamal accessory exec db \
     "psql -U shiojiri_rainbow_seeker -c \"SELECT count(*) FROM pg_stat_activity;\""
   ```

3. **復旧手順**
   ```bash
   # DB再起動
   bundle exec kamal accessory reboot db

   # アプリ再起動
   bundle exec kamal app boot
   ```

### Medium: メモリ使用量増加

1. **メモリ確認**
   ```bash
   bundle exec kamal app exec "free -m"
   ```

2. **対応**
   - ワーカープロセスの調整
   - メモリリーク調査
   - アプリ再起動 (一時的対処)

---

## 定期メンテナンス

### 月次メンテナンス

1. **依存パッケージ更新**
   ```bash
   bundle update --patch
   npm update --save
   ```

2. **セキュリティパッチ適用**
   ```bash
   bundle exec brakeman
   bundle exec bundler-audit update && bundle exec bundler-audit check
   ```

3. **データベースメンテナンス**
   ```bash
   bundle exec kamal accessory exec db \
     "psql -U shiojiri_rainbow_seeker -c \"VACUUM ANALYZE;\""
   ```

4. **不要データ削除**
   - 古いセッションデータ
   - 期限切れトークン
   - 古いジョブログ

### 四半期メンテナンス

1. **SSL証明書確認**
   ```bash
   openssl s_client -connect api.shiojiri-rainbow.app:443 -servername api.shiojiri-rainbow.app 2>/dev/null | openssl x509 -noout -dates
   ```

2. **パフォーマンスレビュー**
   - 遅いクエリの最適化
   - インデックスの見直し
   - キャッシュ戦略の見直し

3. **災害復旧訓練**
   - バックアップからのリストアテスト
   - フェイルオーバー手順確認

---

## バックアップ・リストア

### バックアップ戦略

| 種類 | 頻度 | 保持期間 |
|-----|------|---------|
| フルバックアップ | 日次 | 30日 |
| 差分バックアップ | 6時間毎 | 7日 |
| S3画像 | リアルタイム | 無期限 |

### 手動バックアップ

```bash
# データベースバックアップ
bundle exec kamal accessory exec db \
  "pg_dump -U shiojiri_rainbow_seeker -Fc shiojiri_rainbow_seeker_production > /backup/manual_$(date +%Y%m%d_%H%M%S).dump"

# バックアップファイルのコピー
scp deploy@server:/backup/manual_*.dump ./backups/
```

### リストア手順

```bash
# 1. サービス停止
bundle exec kamal app stop

# 2. データベースリストア
bundle exec kamal accessory exec db \
  "pg_restore -U shiojiri_rainbow_seeker -d shiojiri_rainbow_seeker_production --clean /backup/backup.dump"

# 3. サービス再開
bundle exec kamal app boot
```

---

## セキュリティ

### 定期的なセキュリティタスク

1. **パスワードローテーション** (四半期)
   - データベースパスワード
   - APIキー
   - SSHキー

2. **アクセスログ監査** (月次)
   - 不審なアクセスパターン
   - 失敗した認証試行

3. **脆弱性スキャン** (月次)
   - Brakeman実行
   - OWASP ZAP (ステージング環境)

### インシデント対応

1. **検知**: Sentryアラート、異常なログ
2. **封じ込め**: 影響範囲の特定、必要に応じてサービス停止
3. **根絶**: 脆弱性の修正、パッチ適用
4. **復旧**: サービス再開、監視強化
5. **教訓**: ポストモーテム作成、再発防止策

---

## コンタクト

### 緊急連絡先

| 担当 | 役割 | 連絡先 |
|-----|------|-------|
| オンコール | 一次対応 | PagerDuty |
| 開発リード | 技術判断 | Slack #rainbow-dev |
| インフラ担当 | サーバー問題 | Slack #rainbow-infra |

### エスカレーション

1. **Level 1**: オンコール担当 (15分以内)
2. **Level 2**: 開発リード (30分以内)
3. **Level 3**: プロジェクトマネージャー (1時間以内)

---

## 付録

### よく使うコマンド

```bash
# アプリログ確認
bundle exec kamal logs -f

# Railsコンソール
bundle exec kamal console

# シェルアクセス
bundle exec kamal shell

# DBコンソール
bundle exec kamal dbconsole

# コンテナ詳細
bundle exec kamal app details

# キャッシュクリア
bundle exec kamal app exec "bin/rails tmp:cache:clear"

# 監視ステータス
bundle exec kamal app exec "bin/rails monitoring:status"
```

### 参考ドキュメント

- [API仕様書](./api.md)
- [デプロイ手順書](./deployment.md)
- [開発環境セットアップ](./development.md)
