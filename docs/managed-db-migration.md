# マネージドDB移行ガイド

塩尻レインボーシーカー マネージドデータベースサービスへの移行手順

## 概要

本ドキュメントは、現行のKamalアクセサリとして運用しているPostGIS (postgis/postgis:16-3.4) コンテナから、AWS RDSまたはGCP Cloud SQLなどのマネージドデータベースサービスへの移行手順を説明します。

### 移行対象データベース

| データベース名 | 用途 | アダプタ | 移行先 |
|--------------|------|---------|-------|
| `shiojiri_rainbow_seeker_production` | メインDB (ユーザー、投稿、地理データ) | postgis | マネージドDB |
| `shiojiri_rainbow_seeker_production_cache` | Solid Cache | postgis | マネージドDB |
| `shiojiri_rainbow_seeker_production_queue` | Solid Queue | postgresql | マネージドDB |
| `shiojiri_rainbow_seeker_production_cable` | Solid Cable | postgis | マネージドDB |

### 移行の判断基準

マネージドDBへの移行を検討すべきタイミング:

- データベースサイズが50GBを超えた場合
- HA (高可用性) 構成が必要になった場合
- 自動バックアップ・PITR (ポイントインタイムリカバリ) が必要な場合
- リードレプリカが必要な場合
- DBA専任者がいない場合

---

## 移行前チェックリスト

### 共通チェック項目

- [ ] 移行先サービスがPostGIS拡張をサポートしていることを確認
- [ ] PostgreSQLバージョンの互換性確認 (現行: PostgreSQL 16)
- [ ] PostGISバージョンの互換性確認 (現行: PostGIS 3.4)
- [ ] 移行先リージョンがap-northeast-1 (東京) であることを確認
- [ ] ネットワークレイテンシが許容範囲内であることを確認 (p95 < 200ms達成のため)
- [ ] メンテナンスウィンドウを設定・周知
- [ ] バックアップを取得し、S3にアップロード済み
- [ ] ステージング環境で移行手順をテスト済み
- [ ] ロールバック手順を確認済み
- [ ] 関係者に通知済み (メンテナンス告知)

### 現行データベースの情報収集

```bash
# データベースサイズ確認
bundle exec kamal accessory exec db \
  "psql -U shiojiri_rainbow_seeker -c \"
    SELECT datname, pg_size_pretty(pg_database_size(datname))
    FROM pg_database
    WHERE datname LIKE 'shiojiri_rainbow_seeker%';\""

# PostGISバージョン確認
bundle exec kamal accessory exec db \
  "psql -U shiojiri_rainbow_seeker -d shiojiri_rainbow_seeker_production \
    -c 'SELECT PostGIS_Full_Version();'"

# テーブル一覧と行数確認
bundle exec kamal accessory exec db \
  "psql -U shiojiri_rainbow_seeker -d shiojiri_rainbow_seeker_production \
    -c \"SELECT schemaname, relname, n_live_tup
         FROM pg_stat_user_tables
         ORDER BY n_live_tup DESC;\""

# PostGIS空間インデックス確認
bundle exec kamal accessory exec db \
  "psql -U shiojiri_rainbow_seeker -d shiojiri_rainbow_seeker_production \
    -c \"SELECT indexname, tablename
         FROM pg_indexes
         WHERE indexdef LIKE '%gist%' OR indexdef LIKE '%spatial%';\""

# 接続プール設定確認
bundle exec kamal app exec \
  "bin/rails runner 'puts ActiveRecord::Base.connection_pool.size'"
```

---

## AWS RDS移行手順

### 手順1: RDSインスタンス作成

```bash
# AWS CLIでRDSインスタンスを作成
aws rds create-db-instance \
  --db-instance-identifier shiojiri-rainbow-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 16.4 \
  --master-username shiojiri_rainbow_seeker \
  --master-user-password '<secure-password>' \
  --allocated-storage 50 \
  --storage-type gp3 \
  --vpc-security-group-ids sg-xxxxxxxx \
  --db-subnet-group-name shiojiri-db-subnet-group \
  --availability-zone ap-northeast-1a \
  --backup-retention-period 7 \
  --preferred-backup-window "18:00-18:30" \
  --preferred-maintenance-window "sun:19:00-sun:19:30" \
  --multi-az \
  --storage-encrypted \
  --region ap-northeast-1 \
  --tags Key=Project,Value=ShiojiriRainbowSeeker Key=Environment,Value=production

# インスタンス作成完了まで待機
aws rds wait db-instance-available \
  --db-instance-identifier shiojiri-rainbow-db \
  --region ap-northeast-1
```

### 手順2: PostGIS拡張の有効化

```bash
# RDSエンドポイントを取得
RDS_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier shiojiri-rainbow-db \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text --region ap-northeast-1)

# データベース作成
psql -h ${RDS_ENDPOINT} -U shiojiri_rainbow_seeker -d postgres -c "
  CREATE DATABASE shiojiri_rainbow_seeker_production;
  CREATE DATABASE shiojiri_rainbow_seeker_production_cache;
  CREATE DATABASE shiojiri_rainbow_seeker_production_queue;
  CREATE DATABASE shiojiri_rainbow_seeker_production_cable;
"

# PostGIS拡張を有効化
psql -h ${RDS_ENDPOINT} -U shiojiri_rainbow_seeker \
  -d shiojiri_rainbow_seeker_production -c "
  CREATE EXTENSION IF NOT EXISTS postgis;
  CREATE EXTENSION IF NOT EXISTS postgis_topology;
  SELECT PostGIS_Version();
"

# cache/cable DBにもPostGIS拡張を有効化 (postgisアダプタを使用しているため)
psql -h ${RDS_ENDPOINT} -U shiojiri_rainbow_seeker \
  -d shiojiri_rainbow_seeker_production_cache -c "
  CREATE EXTENSION IF NOT EXISTS postgis;
"

psql -h ${RDS_ENDPOINT} -U shiojiri_rainbow_seeker \
  -d shiojiri_rainbow_seeker_production_cable -c "
  CREATE EXTENSION IF NOT EXISTS postgis;
"
```

### 手順3: データ移行 (pg_dump/pg_restore)

```bash
# 1. 現行DBからバックアップ取得
bundle exec kamal accessory exec db \
  "pg_dump -U shiojiri_rainbow_seeker -Fc -Z6 \
    shiojiri_rainbow_seeker_production \
    > /backup/migration_main.dump"

bundle exec kamal accessory exec db \
  "pg_dump -U shiojiri_rainbow_seeker -Fc -Z6 \
    shiojiri_rainbow_seeker_production_cache \
    > /backup/migration_cache.dump"

bundle exec kamal accessory exec db \
  "pg_dump -U shiojiri_rainbow_seeker -Fc -Z6 \
    shiojiri_rainbow_seeker_production_queue \
    > /backup/migration_queue.dump"

bundle exec kamal accessory exec db \
  "pg_dump -U shiojiri_rainbow_seeker -Fc -Z6 \
    shiojiri_rainbow_seeker_production_cable \
    > /backup/migration_cable.dump"

# 2. バックアップファイルをサーバーに取得
scp deploy@192.168.1.10:/backup/migration_*.dump /tmp/

# 3. RDSにリストア
pg_restore -h ${RDS_ENDPOINT} -U shiojiri_rainbow_seeker \
  -d shiojiri_rainbow_seeker_production \
  --no-owner --no-privileges \
  /tmp/migration_main.dump

pg_restore -h ${RDS_ENDPOINT} -U shiojiri_rainbow_seeker \
  -d shiojiri_rainbow_seeker_production_cache \
  --no-owner --no-privileges \
  /tmp/migration_cache.dump

pg_restore -h ${RDS_ENDPOINT} -U shiojiri_rainbow_seeker \
  -d shiojiri_rainbow_seeker_production_queue \
  --no-owner --no-privileges \
  /tmp/migration_queue.dump

pg_restore -h ${RDS_ENDPOINT} -U shiojiri_rainbow_seeker \
  -d shiojiri_rainbow_seeker_production_cable \
  --no-owner --no-privileges \
  /tmp/migration_cable.dump
```

### 手順4: PostGISデータ検証

```bash
# PostGIS拡張の確認
psql -h ${RDS_ENDPOINT} -U shiojiri_rainbow_seeker \
  -d shiojiri_rainbow_seeker_production -c "
  SELECT PostGIS_Full_Version();
"

# 空間データの検証
psql -h ${RDS_ENDPOINT} -U shiojiri_rainbow_seeker \
  -d shiojiri_rainbow_seeker_production -c "
  SELECT count(*) as total_photos,
         count(location) as photos_with_location,
         ST_AsText(ST_Centroid(ST_Collect(location))) as centroid
  FROM photos
  WHERE location IS NOT NULL;
"

# 空間インデックスの確認
psql -h ${RDS_ENDPOINT} -U shiojiri_rainbow_seeker \
  -d shiojiri_rainbow_seeker_production -c "
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE indexdef LIKE '%gist%';
"
```

---

## GCP Cloud SQL移行手順

### 手順1: Cloud SQLインスタンス作成

```bash
# Cloud SQLインスタンス作成
gcloud sql instances create shiojiri-rainbow-db \
  --database-version=POSTGRES_16 \
  --tier=db-custom-2-4096 \
  --region=asia-northeast1 \
  --availability-type=REGIONAL \
  --storage-type=SSD \
  --storage-size=50GB \
  --storage-auto-increase \
  --backup-start-time=18:00 \
  --enable-bin-log \
  --maintenance-window-day=SUN \
  --maintenance-window-hour=19 \
  --database-flags=max_connections=200

# データベースフラグでPostGIS有効化
gcloud sql instances patch shiojiri-rainbow-db \
  --database-flags=cloudsql.enable_pgaudit=off

# ユーザー作成
gcloud sql users create shiojiri_rainbow_seeker \
  --instance=shiojiri-rainbow-db \
  --password='<secure-password>'
```

### 手順2: データベース作成とPostGIS有効化

```bash
# Cloud SQL Proxyを起動
cloud-sql-proxy shiojiri-rainbow-db \
  --port=15432 &

# データベース作成
psql -h 127.0.0.1 -p 15432 -U shiojiri_rainbow_seeker -d postgres -c "
  CREATE DATABASE shiojiri_rainbow_seeker_production;
  CREATE DATABASE shiojiri_rainbow_seeker_production_cache;
  CREATE DATABASE shiojiri_rainbow_seeker_production_queue;
  CREATE DATABASE shiojiri_rainbow_seeker_production_cable;
"

# PostGIS拡張の有効化
psql -h 127.0.0.1 -p 15432 -U shiojiri_rainbow_seeker \
  -d shiojiri_rainbow_seeker_production -c "
  CREATE EXTENSION IF NOT EXISTS postgis;
  SELECT PostGIS_Version();
"

psql -h 127.0.0.1 -p 15432 -U shiojiri_rainbow_seeker \
  -d shiojiri_rainbow_seeker_production_cache -c "
  CREATE EXTENSION IF NOT EXISTS postgis;
"

psql -h 127.0.0.1 -p 15432 -U shiojiri_rainbow_seeker \
  -d shiojiri_rainbow_seeker_production_cable -c "
  CREATE EXTENSION IF NOT EXISTS postgis;
"
```

### 手順3: データ移行

```bash
# pg_dump/pg_restoreの手順はAWS RDSと同様
# Cloud SQL ProxyのローカルポートをRDSエンドポイントの代わりに使用

# メインDB
pg_restore -h 127.0.0.1 -p 15432 -U shiojiri_rainbow_seeker \
  -d shiojiri_rainbow_seeker_production \
  --no-owner --no-privileges \
  /tmp/migration_main.dump

# Solid Cache DB
pg_restore -h 127.0.0.1 -p 15432 -U shiojiri_rainbow_seeker \
  -d shiojiri_rainbow_seeker_production_cache \
  --no-owner --no-privileges \
  /tmp/migration_cache.dump

# Solid Queue DB
pg_restore -h 127.0.0.1 -p 15432 -U shiojiri_rainbow_seeker \
  -d shiojiri_rainbow_seeker_production_queue \
  --no-owner --no-privileges \
  /tmp/migration_queue.dump

# Solid Cable DB
pg_restore -h 127.0.0.1 -p 15432 -U shiojiri_rainbow_seeker \
  -d shiojiri_rainbow_seeker_production_cable \
  --no-owner --no-privileges \
  /tmp/migration_cable.dump
```

---

## Kamal設定変更

### deploy.yml変更

マネージドDBに移行後、`config/deploy.yml`から`db`アクセサリを削除し、環境変数を更新します。

**変更前**:
```yaml
accessories:
  db:
    image: postgis/postgis:16-3.4
    host: 192.168.1.10
    port: "127.0.0.1:5432:5432"
    env:
      clear:
        POSTGRES_DB: shiojiri_rainbow_seeker_production
        POSTGRES_USER: shiojiri_rainbow_seeker
      secret:
        - POSTGRES_PASSWORD
    directories:
      - data:/var/lib/postgresql/data
    options:
      memory: 2g
      cpus: 2
```

**変更後**:
```yaml
# accessories セクションからdbを削除
# accessories:
#   (dbアクセサリは不要)
```

**環境変数の更新**:
```yaml
env:
  secret:
    - RAILS_MASTER_KEY
    - SHIOJIRI_RAINBOW_SEEKER_DATABASE_PASSWORD
    - AWS_ACCESS_KEY_ID
    - AWS_SECRET_ACCESS_KEY
    - OPENWEATHERMAP_API_KEY
    - FCM_SERVER_KEY
    - LINE_CHANNEL_ACCESS_TOKEN
    - SENTRY_DSN

  clear:
    RAILS_ENV: production

    # AWS RDSの場合
    DATABASE_HOST: shiojiri-rainbow-db.xxxxxxxxxxxx.ap-northeast-1.rds.amazonaws.com
    DATABASE_PORT: 5432

    # GCP Cloud SQLの場合 (Cloud SQL Proxy使用時)
    # DATABASE_HOST: 127.0.0.1
    # DATABASE_PORT: 5432

    # 接続プール設定 (マネージドDB向けに調整)
    RAILS_MAX_THREADS: 5

    # その他は変更なし
    WEB_CONCURRENCY: 2
    SOLID_QUEUE_IN_PUMA: false
    AWS_REGION: ap-northeast-1
    AWS_BUCKET: shiojiri-rainbow-seeker-production
    HOST: api.shiojiri-rainbow.app
    FRONTEND_URL: https://shiojiri-rainbow.app
    WEATHER_FETCH_INTERVAL: 15
    SENTRY_ENVIRONMENT: production
```

### database.yml設定変更

マネージドDBの接続先に合わせて`config/database.yml`を更新します。

**変更前** (production セクション):
```yaml
production:
  primary: &primary_production
    <<: *default
    database: shiojiri_rainbow_seeker_production
    username: shiojiri_rainbow_seeker
    password: <%= ENV["SHIOJIRI_RAINBOW_SEEKER_DATABASE_PASSWORD"] %>
    host: <%= ENV.fetch("DATABASE_HOST") { "localhost" } %>
    port: <%= ENV.fetch("DATABASE_PORT") { 5432 } %>
  cache:
    <<: *primary_production
    database: shiojiri_rainbow_seeker_production_cache
    migrations_paths: db/cache_migrate
  queue:
    <<: *primary_production
    database: shiojiri_rainbow_seeker_production_queue
    migrations_paths: db/queue_migrate
  cable:
    <<: *primary_production
    database: shiojiri_rainbow_seeker_production_cable
    migrations_paths: db/cable_migrate
```

**変更後** (マネージドDB向けに接続パラメータを追加):
```yaml
production:
  primary: &primary_production
    <<: *default
    database: shiojiri_rainbow_seeker_production
    username: shiojiri_rainbow_seeker
    password: <%= ENV["SHIOJIRI_RAINBOW_SEEKER_DATABASE_PASSWORD"] %>
    host: <%= ENV.fetch("DATABASE_HOST") { "localhost" } %>
    port: <%= ENV.fetch("DATABASE_PORT") { 5432 } %>
    # マネージドDB向け接続設定
    prepared_statements: true
    advisory_locks: true
    connect_timeout: 5
    checkout_timeout: 10
    # SSL接続 (RDS/Cloud SQL)
    sslmode: require
  cache:
    <<: *primary_production
    database: shiojiri_rainbow_seeker_production_cache
    migrations_paths: db/cache_migrate
  queue:
    <<: *primary_production
    database: shiojiri_rainbow_seeker_production_queue
    migrations_paths: db/queue_migrate
  cable:
    <<: *primary_production
    database: shiojiri_rainbow_seeker_production_cable
    migrations_paths: db/cable_migrate
```

### cable.yml設定

`config/cable.yml`のproductionセクションは変更不要です。Solid Cableは`database.yml`の`cable`設定を参照します。

```yaml
# 現行設定 (変更不要)
production:
  adapter: solid_cable
  connects_to:
    database:
      writing: cable
  polling_interval: 0.1.seconds
  message_retention: 1.day
```

---

## 移行実行手順

### フェーズ1: 移行前準備

```bash
# 1. メンテナンス告知 (1週間前)

# 2. ステージング環境で全手順をテスト

# 3. 本番バックアップ取得
bundle exec kamal accessory exec db \
  "pg_dump -U shiojiri_rainbow_seeker -Fc -Z6 \
    shiojiri_rainbow_seeker_production \
    > /backup/pre_migration_main.dump"

bundle exec kamal accessory exec db \
  "pg_dump -U shiojiri_rainbow_seeker -Fc -Z6 \
    shiojiri_rainbow_seeker_production_cache \
    > /backup/pre_migration_cache.dump"

bundle exec kamal accessory exec db \
  "pg_dump -U shiojiri_rainbow_seeker -Fc -Z6 \
    shiojiri_rainbow_seeker_production_queue \
    > /backup/pre_migration_queue.dump"

bundle exec kamal accessory exec db \
  "pg_dump -U shiojiri_rainbow_seeker -Fc -Z6 \
    shiojiri_rainbow_seeker_production_cable \
    > /backup/pre_migration_cable.dump"

# S3にもアップロード
aws s3 cp /backup/pre_migration_main.dump \
  s3://shiojiri-rainbow-backups/migration/pre_migration_main.dump
aws s3 cp /backup/pre_migration_cache.dump \
  s3://shiojiri-rainbow-backups/migration/pre_migration_cache.dump
aws s3 cp /backup/pre_migration_queue.dump \
  s3://shiojiri-rainbow-backups/migration/pre_migration_queue.dump
aws s3 cp /backup/pre_migration_cable.dump \
  s3://shiojiri-rainbow-backups/migration/pre_migration_cable.dump
```

### フェーズ2: サービス停止と移行

```bash
# 1. アプリケーション停止
bundle exec kamal app stop
bundle exec kamal app stop -r job

# 2. 最終バックアップ取得 (停止後のため整合性保証)
bundle exec kamal accessory exec db \
  "pg_dump -U shiojiri_rainbow_seeker -Fc -Z6 \
    shiojiri_rainbow_seeker_production \
    > /backup/final_migration_main.dump"

bundle exec kamal accessory exec db \
  "pg_dump -U shiojiri_rainbow_seeker -Fc -Z6 \
    shiojiri_rainbow_seeker_production_cache \
    > /backup/final_migration_cache.dump"

bundle exec kamal accessory exec db \
  "pg_dump -U shiojiri_rainbow_seeker -Fc -Z6 \
    shiojiri_rainbow_seeker_production_queue \
    > /backup/final_migration_queue.dump"

# 3. マネージドDBへリストア (上記AWS RDSまたはGCP Cloud SQL手順を参照)

# 4. deploy.ymlのDATABASE_HOSTを更新

# 5. database.ymlの設定更新 (sslmode等)

# 6. 環境変数の反映
bundle exec kamal env push

# 7. アプリケーション起動
bundle exec kamal deploy
```

### フェーズ3: 移行後検証

```bash
# 1. ヘルスチェック
curl -f https://api.shiojiri-rainbow.app/up

# 2. データ整合性確認
bundle exec kamal app exec "bin/rails runner '
  puts \"Users: #{User.count}\"
  puts \"Photos: #{Photo.count}\"
  puts \"Photos with location: #{Photo.where.not(location: nil).count}\"
  puts \"Comments: #{Comment.count}\"
  puts \"Likes: #{Like.count}\"
'"

# 3. PostGIS機能確認
bundle exec kamal app exec "bin/rails runner '
  photo = Photo.where.not(location: nil).first
  if photo
    puts \"PostGIS OK: #{photo.location}\"
    nearby = Photo.where(\"ST_DWithin(location, ST_SetSRID(ST_MakePoint(#{photo.location.x}, #{photo.location.y}), 4326), 0.1)\")
    puts \"Nearby photos: #{nearby.count}\"
  end
'"

# 4. Solid Queue動作確認
bundle exec kamal app exec "bin/rails runner '
  puts \"Queue jobs: #{SolidQueue::Job.count}\"
  puts \"Failed jobs: #{SolidQueue::FailedExecution.count}\"
'"

# 5. Solid Cache動作確認
bundle exec kamal app exec "bin/rails runner '
  Rails.cache.write(\"migration_test\", \"ok\", expires_in: 1.minute)
  puts \"Cache test: #{Rails.cache.read(\"migration_test\")}\"
'"

# 6. Solid Cable動作確認 (WebSocket接続テスト)
# ブラウザまたはモバイルアプリからリアルタイム通知の受信を確認

# 7. パフォーマンス確認 (k6スモークテスト)
k6 run k6/scenarios/smoke.js

# 8. ログ確認
bundle exec kamal logs --since 10m
```

### フェーズ4: 旧DBアクセサリの削除

移行後、一定期間 (推奨: 1週間) 問題がないことを確認してから旧DBを削除します。

```bash
# 旧DBアクセサリの停止
bundle exec kamal accessory stop db

# 旧DBアクセサリの削除 (データボリュームも削除される)
# 注意: 実行前にバックアップが確実にS3に保存されていることを確認
bundle exec kamal accessory remove db
```

---

## 移行後の運用変更

### 監視変更

| 項目 | 移行前 | 移行後 |
|-----|-------|-------|
| DB監視 | `kamal accessory details db` | AWS CloudWatch / GCP Monitoring |
| バックアップ | 手動スクリプト | 自動 (RDS/Cloud SQL) |
| ログ | `kamal accessory logs db` | CloudWatch Logs / Cloud Logging |
| メンテナンス | 手動 | 自動メンテナンスウィンドウ |

### Kamalコマンドの変更

移行後、DBアクセサリ関連のKamalコマンドは使用できなくなります。

```bash
# 移行前: Kamalアクセサリ経由
bundle exec kamal accessory exec db "psql -U shiojiri_rainbow_seeker ..."

# 移行後: 直接接続
psql -h <マネージドDB-ホスト> -U shiojiri_rainbow_seeker \
  -d shiojiri_rainbow_seeker_production

# または、Railsコンソール経由
bundle exec kamal console
# > ActiveRecord::Base.connection.execute("SELECT ...")
```

### バックアップ運用の変更

```bash
# AWS RDSの場合:
# - 自動バックアップ: RDS設定で有効化済み
# - 手動スナップショット作成
aws rds create-db-snapshot \
  --db-instance-identifier shiojiri-rainbow-db \
  --db-snapshot-identifier manual-$(date +%Y%m%d)

# GCP Cloud SQLの場合:
# - 自動バックアップ: Cloud SQL設定で有効化済み
# - 手動バックアップ作成
gcloud sql backups create --instance=shiojiri-rainbow-db
```

---

## ロールバック手順

移行に問題が発生した場合のロールバック手順です。

```bash
# 1. アプリケーション停止
bundle exec kamal app stop
bundle exec kamal app stop -r job

# 2. deploy.ymlのDATABASE_HOSTを旧設定に戻す
# DATABASE_HOST: shiojiri-rainbow-seeker-db

# 3. database.ymlのsslmode設定を削除

# 4. 旧DBアクセサリを再起動 (停止していた場合)
bundle exec kamal accessory boot db

# 5. 環境変数の反映
bundle exec kamal env push

# 6. アプリケーション再起動
bundle exec kamal deploy

# 7. 動作確認
curl -f https://api.shiojiri-rainbow.app/up
```

---

## 関連ドキュメント

- [運用マニュアル](./operations.md) - 日常運用手順
- [デプロイ手順書](./deployment.md) - Kamalデプロイ設定の詳細
- [災害復旧ランブック](./disaster-recovery.md) - バックアップ・リストア手順
- [キャパシティプランニング](./capacity-planning.md) - DBスケーリング戦略
