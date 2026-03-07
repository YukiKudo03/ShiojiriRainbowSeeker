# 災害復旧 (DR) ランブック

塩尻レインボーシーカー 災害復旧手順書

## 概要

本ドキュメントは、塩尻レインボーシーカーの災害復旧 (Disaster Recovery) 計画について説明します。バックアップ戦略、RTO/RPO定義、障害シナリオ別の対応手順、およびDR訓練計画を含みます。

---

## RTO/RPO定義

| 指標 | 目標値 | 説明 |
|-----|-------|------|
| RTO (目標復旧時間) | 1時間 | 障害発生からサービス復旧までの最大許容時間 |
| RPO (目標復旧時点) | 6時間 | 最大許容データ損失期間 (差分バックアップ間隔) |

### 復旧優先度

| 優先度 | コンポーネント | RTO | 根拠 |
|-------|-------------|-----|------|
| 1 | データベース (PostgreSQL + PostGIS) | 30分 | 全機能の基盤 |
| 2 | Webアプリケーション (Rails + Puma) | 15分 | ユーザーアクセス |
| 3 | ジョブワーカー (Solid Queue) | 15分 | 天気取得、通知送信 |
| 4 | S3画像ストレージ | 即時 | AWS側で冗長化済み |

---

## バックアップ戦略

### バックアップ一覧

| 種類 | 頻度 | 保持期間 | 保存先 | 方式 |
|-----|------|---------|-------|------|
| フルバックアップ | 日次 (AM 3:00 JST) | 30日 | S3 (`s3://shiojiri-rainbow-backups/daily/`) | pg_dump -Fc |
| 差分バックアップ | 6時間毎 (0:00, 6:00, 12:00, 18:00) | 7日 | S3 (`s3://shiojiri-rainbow-backups/differential/`) | pg_dump -Fc |
| S3画像 | リアルタイム | 無期限 | S3 (`s3://shiojiri-rainbow-seeker-production/`) | Active Storage |

### データベースバックアップの構成

対象データベース:

| データベース名 | 用途 | バックアップ対象 |
|--------------|------|---------------|
| `shiojiri_rainbow_seeker_production` | メインDB (投稿、ユーザー、地理データ) | フル + 差分 |
| `shiojiri_rainbow_seeker_production_cache` | Solid Cache | フルのみ (復旧不要の場合スキップ可) |
| `shiojiri_rainbow_seeker_production_queue` | Solid Queue | フルのみ (復旧不要の場合スキップ可) |
| `shiojiri_rainbow_seeker_production_cable` | Solid Cable | バックアップ不要 (一時データ) |

### 日次フルバックアップスクリプト

```bash
#!/bin/bash
# /opt/scripts/daily_backup.sh
# cron: 0 3 * * * /opt/scripts/daily_backup.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/daily"
S3_BUCKET="s3://shiojiri-rainbow-backups/daily"
DB_USER="shiojiri_rainbow_seeker"

# メインDBバックアップ
bundle exec kamal accessory exec db \
  "pg_dump -U ${DB_USER} -Fc -Z6 \
    shiojiri_rainbow_seeker_production \
    > ${BACKUP_DIR}/main_${TIMESTAMP}.dump"

# Solid Cache DBバックアップ
bundle exec kamal accessory exec db \
  "pg_dump -U ${DB_USER} -Fc -Z6 \
    shiojiri_rainbow_seeker_production_cache \
    > ${BACKUP_DIR}/cache_${TIMESTAMP}.dump"

# Solid Queue DBバックアップ
bundle exec kamal accessory exec db \
  "pg_dump -U ${DB_USER} -Fc -Z6 \
    shiojiri_rainbow_seeker_production_queue \
    > ${BACKUP_DIR}/queue_${TIMESTAMP}.dump"

# S3にアップロード
aws s3 cp ${BACKUP_DIR}/main_${TIMESTAMP}.dump ${S3_BUCKET}/main_${TIMESTAMP}.dump
aws s3 cp ${BACKUP_DIR}/cache_${TIMESTAMP}.dump ${S3_BUCKET}/cache_${TIMESTAMP}.dump
aws s3 cp ${BACKUP_DIR}/queue_${TIMESTAMP}.dump ${S3_BUCKET}/queue_${TIMESTAMP}.dump

# 30日以上前のローカルバックアップを削除
find ${BACKUP_DIR} -name "*.dump" -mtime +30 -delete

# バックアップ完了通知
echo "[$(date)] Daily backup completed: main_${TIMESTAMP}.dump"
```

### 差分バックアップスクリプト

```bash
#!/bin/bash
# /opt/scripts/differential_backup.sh
# cron: 0 0,6,12,18 * * * /opt/scripts/differential_backup.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/differential"
S3_BUCKET="s3://shiojiri-rainbow-backups/differential"
DB_USER="shiojiri_rainbow_seeker"

# メインDBの差分バックアップ (カスタムフォーマット)
bundle exec kamal accessory exec db \
  "pg_dump -U ${DB_USER} -Fc -Z6 \
    shiojiri_rainbow_seeker_production \
    > ${BACKUP_DIR}/main_diff_${TIMESTAMP}.dump"

# S3にアップロード
aws s3 cp ${BACKUP_DIR}/main_diff_${TIMESTAMP}.dump \
  ${S3_BUCKET}/main_diff_${TIMESTAMP}.dump

# 7日以上前のローカル差分バックアップを削除
find ${BACKUP_DIR} -name "*.dump" -mtime +7 -delete

echo "[$(date)] Differential backup completed: main_diff_${TIMESTAMP}.dump"
```

### バックアップ検証

```bash
# バックアップファイルの整合性確認
bundle exec kamal accessory exec db \
  "pg_restore -l /backup/daily/main_20260307_030000.dump | head -20"

# S3上のバックアップ一覧確認
aws s3 ls s3://shiojiri-rainbow-backups/daily/ --human-readable | tail -10
aws s3 ls s3://shiojiri-rainbow-backups/differential/ --human-readable | tail -10
```

---

## リストア手順

### 手順1: 事前準備

```bash
# 1-1. 最新のバックアップファイルを確認
aws s3 ls s3://shiojiri-rainbow-backups/daily/ --human-readable | sort | tail -5
aws s3 ls s3://shiojiri-rainbow-backups/differential/ --human-readable | sort | tail -5

# 1-2. 使用するバックアップファイルを決定
# RPO 6時間以内の最新差分バックアップ、または日次フルバックアップを選択

# 1-3. バックアップファイルをダウンロード
aws s3 cp s3://shiojiri-rainbow-backups/differential/main_diff_YYYYMMDD_HHMMSS.dump /backup/restore/
```

### 手順2: アプリケーション停止

```bash
# 2-1. Webアプリケーション停止
bundle exec kamal app stop

# 2-2. ジョブワーカー停止
bundle exec kamal app stop -r job

# 2-3. 停止確認
bundle exec kamal app details
```

### 手順3: データベースリストア

```bash
# 3-1. 既存の接続を切断
bundle exec kamal accessory exec db \
  "psql -U shiojiri_rainbow_seeker -c \"
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = 'shiojiri_rainbow_seeker_production'
    AND pid <> pg_backend_pid();\""

# 3-2. メインDBリストア
bundle exec kamal accessory exec db \
  "pg_restore -U shiojiri_rainbow_seeker \
    -d shiojiri_rainbow_seeker_production \
    --clean --if-exists \
    /backup/restore/main_diff_YYYYMMDD_HHMMSS.dump"

# 3-3. PostGIS拡張の確認
bundle exec kamal accessory exec db \
  "psql -U shiojiri_rainbow_seeker -d shiojiri_rainbow_seeker_production \
    -c 'SELECT PostGIS_Version();'"

# 3-4. Solid Cache DBリストア (必要な場合)
bundle exec kamal accessory exec db \
  "pg_restore -U shiojiri_rainbow_seeker \
    -d shiojiri_rainbow_seeker_production_cache \
    --clean --if-exists \
    /backup/restore/cache_YYYYMMDD_HHMMSS.dump"

# 3-5. Solid Queue DBリストア (必要な場合)
bundle exec kamal accessory exec db \
  "pg_restore -U shiojiri_rainbow_seeker \
    -d shiojiri_rainbow_seeker_production_queue \
    --clean --if-exists \
    /backup/restore/queue_YYYYMMDD_HHMMSS.dump"
```

### 手順4: データ整合性確認

```bash
# 4-1. テーブル数確認
bundle exec kamal accessory exec db \
  "psql -U shiojiri_rainbow_seeker -d shiojiri_rainbow_seeker_production \
    -c \"SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';\""

# 4-2. 主要テーブルのレコード数確認
bundle exec kamal accessory exec db \
  "psql -U shiojiri_rainbow_seeker -d shiojiri_rainbow_seeker_production \
    -c \"SELECT 'users' as table_name, count(*) FROM users
         UNION ALL SELECT 'photos', count(*) FROM photos
         UNION ALL SELECT 'comments', count(*) FROM comments
         UNION ALL SELECT 'likes', count(*) FROM likes;\""

# 4-3. PostGIS空間データの確認
bundle exec kamal accessory exec db \
  "psql -U shiojiri_rainbow_seeker -d shiojiri_rainbow_seeker_production \
    -c \"SELECT count(*) FROM photos WHERE location IS NOT NULL;\""

# 4-4. マイグレーション状態確認
bundle exec kamal app exec "bin/rails db:migrate:status"
```

### 手順5: アプリケーション起動

```bash
# 5-1. 未実行のマイグレーションがある場合は実行
bundle exec kamal app exec "bin/rails db:migrate"

# 5-2. Webアプリケーション起動
bundle exec kamal app boot

# 5-3. ジョブワーカー起動
bundle exec kamal app boot -r job

# 5-4. ヘルスチェック
curl -f https://api.shiojiri-rainbow.app/up

# 5-5. 詳細動作確認
bundle exec kamal app exec "bin/rails runner 'puts User.count; puts Photo.count'"
```

### 手順6: 復旧後の確認

```bash
# 6-1. ログでエラーがないか確認
bundle exec kamal logs --since 5m

# 6-2. Sentryでエラーが発生していないか確認
# https://sentry.io/ でダッシュボードを確認

# 6-3. 主要APIエンドポイントの応答確認
curl -s -o /dev/null -w "%{http_code}" https://api.shiojiri-rainbow.app/up
curl -s -o /dev/null -w "%{http_code}" https://api.shiojiri-rainbow.app/api/v1/photos
```

---

## 障害シナリオ別対応

### シナリオ1: データベース障害

**症状**: データベース接続エラー、クエリタイムアウト

**想定原因**: ディスク障害、メモリ不足、接続数上限、データ破損

#### 対応手順

```bash
# 1. DB状態確認
bundle exec kamal accessory details db

# 2. DBログ確認
bundle exec kamal accessory logs db --since 10m

# 3. 接続数確認
bundle exec kamal accessory exec db \
  "psql -U shiojiri_rainbow_seeker -c 'SELECT count(*) FROM pg_stat_activity;'"

# 4. ディスク使用量確認
bundle exec kamal accessory exec db "df -h /var/lib/postgresql/data"
```

**復旧方法A: DB再起動 (軽度の場合)**

```bash
# DBアクセサリ再起動
bundle exec kamal accessory reboot db

# アプリケーション再起動
bundle exec kamal app boot
```

**復旧方法B: バックアップからのリストア (データ破損の場合)**

```bash
# 上記「リストア手順」の全ステップを実行
```

**復旧方法C: DBコンテナ再構築 (コンテナ障害の場合)**

```bash
# 1. 既存のDBアクセサリを停止
bundle exec kamal accessory stop db

# 2. DBアクセサリを再作成 (データボリュームは保持)
bundle exec kamal accessory boot db

# 3. PostGIS拡張の確認
bundle exec kamal accessory exec db \
  "psql -U shiojiri_rainbow_seeker -d shiojiri_rainbow_seeker_production \
    -c 'CREATE EXTENSION IF NOT EXISTS postgis;'"

# 4. アプリケーション再起動
bundle exec kamal app boot
```

---

### シナリオ2: アプリケーション障害

**症状**: HTTP 5xxエラー、ヘルスチェック失敗、応答遅延

**想定原因**: メモリリーク、デプロイ不良、設定ミス、外部サービス障害

#### 対応手順

```bash
# 1. アプリケーション状態確認
bundle exec kamal app details

# 2. ログ確認
bundle exec kamal logs --since 10m

# 3. メモリ・CPU確認
bundle exec kamal app exec "free -m && echo '---' && cat /proc/loadavg"

# 4. Puma接続状態確認
bundle exec kamal app exec "curl -s http://localhost:3000/up"
```

**復旧方法A: アプリケーション再起動**

```bash
bundle exec kamal app boot
```

**復旧方法B: ロールバック (デプロイ不良の場合)**

```bash
# 利用可能なバージョン確認
bundle exec kamal app versions

# 直前のバージョンにロールバック
bundle exec kamal rollback <previous-version>
```

**復旧方法C: 環境変数・設定の確認**

```bash
# 環境変数確認
bundle exec kamal app exec "env | grep -E '(RAILS|DATABASE|SOLID)' | sort"

# 設定ファイル確認
bundle exec kamal app exec "bin/rails runner 'puts Rails.application.config.database_configuration[\"production\"]'"
```

---

### シナリオ3: S3障害

**症状**: 画像アップロード失敗、画像表示不可

**想定原因**: S3サービス障害、IAM権限問題、バケットポリシー変更

#### 対応手順

```bash
# 1. S3接続確認
bundle exec kamal app exec \
  "bin/rails runner 'puts ActiveStorage::Blob.service.exist?(ActiveStorage::Blob.last.key)'"

# 2. AWS認証情報確認
bundle exec kamal app exec \
  "bin/rails runner 'require \"aws-sdk-s3\"; s3 = Aws::S3::Client.new; puts s3.list_buckets.buckets.map(&:name)'"

# 3. S3バケット状態確認
aws s3 ls s3://shiojiri-rainbow-seeker-production/ --summarize --region ap-northeast-1
```

**復旧方法A: 認証情報更新**

```bash
# .kamal/secretsのAWS認証情報を更新後
bundle exec kamal env push
bundle exec kamal app boot
```

**復旧方法B: S3アクセスのデバッグ**

```bash
# S3への直接テスト
aws s3 cp /tmp/test.txt s3://shiojiri-rainbow-seeker-production/test.txt --region ap-northeast-1
aws s3 rm s3://shiojiri-rainbow-seeker-production/test.txt --region ap-northeast-1
```

**一時的な対処**: S3が完全に利用不可の場合、ローカルストレージへの一時切替を検討。

---

### シナリオ4: サーバー全体障害

**症状**: SSH接続不可、全サービス応答なし

**想定原因**: ハードウェア障害、ネットワーク障害、ホスティング事業者障害

#### 対応手順

**フェーズ1: 状況把握 (目標: 15分以内)**

```bash
# 1. サーバーへのSSH接続確認
ssh deploy@192.168.1.10 "echo 'alive'"

# 2. ホスティング事業者のステータスページ確認

# 3. DNSの応答確認
dig api.shiojiri-rainbow.app

# 4. 外部からのHTTPS接続確認
curl -I https://api.shiojiri-rainbow.app/up
```

**フェーズ2: 新サーバーでの復旧 (目標: 1時間以内)**

```bash
# 1. 新しいサーバーを調達 (VPS/クラウド)

# 2. DNSを新サーバーIPに変更 (TTL短縮済みであること)

# 3. deploy.ymlのホストIPを更新
# servers:
#   web:
#     hosts:
#       - <新サーバーIP>

# 4. 新サーバーへKamalセットアップ
bundle exec kamal setup

# 5. S3から最新バックアップをダウンロード
aws s3 cp s3://shiojiri-rainbow-backups/daily/ /backup/restore/ --recursive \
  --exclude "*" --include "*$(date +%Y%m%d)*"

# 最新の差分バックアップがあればそちらを使用
aws s3 ls s3://shiojiri-rainbow-backups/differential/ | sort | tail -1

# 6. データベースリストア
bundle exec kamal accessory exec db \
  "pg_restore -U shiojiri_rainbow_seeker \
    -d shiojiri_rainbow_seeker_production \
    --clean --if-exists \
    /backup/restore/main_YYYYMMDD_HHMMSS.dump"

# 7. PostGIS拡張の有効化確認
bundle exec kamal accessory exec db \
  "psql -U shiojiri_rainbow_seeker -d shiojiri_rainbow_seeker_production \
    -c 'CREATE EXTENSION IF NOT EXISTS postgis;'"

# 8. マイグレーション実行
bundle exec kamal app exec "bin/rails db:migrate"

# 9. 動作確認
curl -f https://api.shiojiri-rainbow.app/up
```

**フェーズ3: 復旧後の確認**

```bash
# ログ確認
bundle exec kamal logs --since 10m

# 全エンドポイントの動作確認
curl -s https://api.shiojiri-rainbow.app/up
curl -s https://api.shiojiri-rainbow.app/api/v1/photos | head -c 200

# Solid Queue ジョブの動作確認
bundle exec kamal app exec "bin/rails runner 'puts SolidQueue::Job.count'"

# 画像表示確認
bundle exec kamal app exec \
  "bin/rails runner 'puts ActiveStorage::Blob.last.url'"
```

---

## 障害時コミュニケーション

### ステークホルダー通知テンプレート

**障害発生時 (Slack #rainbow-incident)**:
```
[障害発生] 塩尻レインボーシーカー
- 発生時刻: YYYY-MM-DD HH:MM JST
- 影響: (サービス全体/一部機能)
- 原因: (調査中/判明した原因)
- 対応状況: (対応中/復旧中)
- 担当: (担当者名)
- 次回更新: (予定時刻)
```

**復旧完了時**:
```
[復旧完了] 塩尻レインボーシーカー
- 復旧時刻: YYYY-MM-DD HH:MM JST
- 障害期間: X時間X分
- 原因: (根本原因)
- 対応内容: (実施した対応)
- データ損失: (なし/あり - 詳細)
- ポストモーテム: (予定日)
```

---

## DR訓練スケジュール

### 四半期DR訓練計画

| 四半期 | 訓練内容 | 対象環境 | 所要時間 |
|-------|---------|---------|---------|
| Q1 (4月) | バックアップリストア訓練 | ステージング | 2時間 |
| Q2 (7月) | DB障害復旧訓練 | ステージング | 3時間 |
| Q3 (10月) | 全サーバー障害復旧訓練 | ステージング | 4時間 |
| Q4 (1月) | 総合DR訓練 (全シナリオ) | ステージング | 6時間 |

### 訓練手順: バックアップリストア訓練 (Q1)

```bash
# 1. ステージング環境でバックアップ取得
bundle exec kamal accessory exec db -d staging \
  "pg_dump -U shiojiri_rainbow_seeker -Fc \
    shiojiri_rainbow_seeker_staging \
    > /backup/dr_drill_$(date +%Y%m%d).dump"

# 2. データベースを意図的に破壊 (ステージングのみ)
bundle exec kamal accessory exec db -d staging \
  "psql -U shiojiri_rainbow_seeker -d shiojiri_rainbow_seeker_staging \
    -c 'DROP TABLE photos CASCADE;'"

# 3. 障害検知の確認
curl -f https://staging-api.shiojiri-rainbow.app/up
# Expected: 失敗

# 4. リストア実行 (タイマー開始)
bundle exec kamal app stop -d staging

bundle exec kamal accessory exec db -d staging \
  "pg_restore -U shiojiri_rainbow_seeker \
    -d shiojiri_rainbow_seeker_staging \
    --clean --if-exists \
    /backup/dr_drill_$(date +%Y%m%d).dump"

bundle exec kamal app boot -d staging

# 5. 復旧確認 (タイマー停止)
curl -f https://staging-api.shiojiri-rainbow.app/up
# Expected: 成功

# 6. 復旧時間を記録し、RTOの1時間以内であることを確認
```

### 訓練チェックリスト

- [ ] バックアップファイルがS3に存在することを確認
- [ ] バックアップファイルの整合性を検証 (`pg_restore -l`で確認)
- [ ] リストア手順を実行し復旧時間を計測
- [ ] PostGIS拡張が正しく復元されたか確認
- [ ] 空間データ (位置情報) が正しく復元されたか確認
- [ ] 全エンドポイントの動作確認
- [ ] 画像ファイル (S3) のアクセス確認
- [ ] Solid Queue ジョブの処理確認
- [ ] 結果をドキュメントに記録
- [ ] 改善点を洗い出し、次回訓練までに対応

### 訓練結果記録テンプレート

```markdown
# DR訓練結果 - YYYY年 QX

- 実施日: YYYY-MM-DD
- 訓練種別: (バックアップリストア/DB障害/全サーバー障害/総合)
- 参加者:
- 対象環境: ステージング

## 実績

| 項目 | 目標 | 実績 | 判定 |
|-----|------|------|------|
| RTO | 1時間 | XX分 | OK/NG |
| RPO | 6時間 | X時間 | OK/NG |
| データ整合性 | 100% | XX% | OK/NG |

## 手順の問題点

- (発見した問題点)

## 改善アクション

| アクション | 担当 | 期限 |
|-----------|------|------|
| (改善内容) | (担当者) | (期限) |
```

---

## deploy.yml参照情報

本番環境の構成 (`config/deploy.yml`) より:

```yaml
# PostgreSQL + PostGIS
accessories:
  db:
    image: postgis/postgis:16-3.4
    host: 192.168.1.10
    port: "127.0.0.1:5432:5432"
    options:
      memory: 2g
      cpus: 2

# Webサーバー
servers:
  web:
    hosts:
      - 192.168.1.10
    options:
      memory: 2g
      cpus: 2

# ジョブワーカー
  job:
    hosts:
      - 192.168.1.10
    cmd: ./bin/rails solid_queue:start
    options:
      memory: 1g
      cpus: 1
```

---

## 関連ドキュメント

- [運用マニュアル](./operations.md) - 日常運用手順
- [デプロイ手順書](./deployment.md) - デプロイ・ロールバック手順
- [キャパシティプランニング](./capacity-planning.md) - リソース計画
- [マネージドDB移行ガイド](./managed-db-migration.md) - DB移行手順
