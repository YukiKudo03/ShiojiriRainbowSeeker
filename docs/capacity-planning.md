# キャパシティプランニング

塩尻レインボーシーカー キャパシティプランニングガイド

## 概要

本ドキュメントは、塩尻レインボーシーカーのリソース計画、スケーリング戦略、性能基準、およびコスト見積について説明します。NFR-2性能要件を満たしながら、コスト効率の高いインフラ運用を目指します。

---

## 現行リソース構成

`config/deploy.yml`に基づく現行リソース構成:

### サーバー構成

| コンポーネント | ホスト | メモリ | CPU | 役割 |
|-------------|-------|-------|-----|------|
| Web (Puma) | 192.168.1.10 | 2GB | 2コア | Rails APIサーバー |
| Job Worker (Solid Queue) | 192.168.1.10 | 1GB | 1コア | バックグラウンドジョブ処理 |
| DB (PostGIS 16-3.4) | 192.168.1.10 | 2GB | 2コア | PostgreSQL + PostGIS |

### Puma設定

| パラメータ | 現行値 | 環境変数 |
|----------|-------|---------|
| ワーカー数 | 2 | `WEB_CONCURRENCY=2` |
| スレッド数/ワーカー | 5 | `RAILS_MAX_THREADS=5` |
| 最大同時処理数 | 10 (2 x 5) | - |

### データベース接続プール

| データベース | プールサイズ | 用途 |
|-----------|----------|------|
| primary | 5 | メインDB |
| cache | 5 | Solid Cache |
| queue | 5 | Solid Queue |
| cable | 5 | Solid Cable |

---

## NFR-2性能基準

`k6/config/thresholds.json`に定義された非機能要件:

### 性能目標

| 指標 | 目標値 | 測定方法 |
|-----|-------|---------|
| API応答時間 (p95) | < 200ms | k6負荷テスト |
| API応答時間 (p99) | < 500ms | k6負荷テスト |
| API応答時間 (avg) | < 100ms | k6負荷テスト |
| 同時ユーザー数 | 1,000 | k6ストレステスト |
| 画像アップロード時間 | < 3秒 | k6フォトアップロードテスト |
| 地図読み込み時間 | < 2秒 | k6マップテスト |
| エラー率 | < 1% | k6全テストシナリオ |

### エンドポイント別性能基準

| エンドポイント | p95目標 | 成功率目標 |
|-------------|--------|----------|
| 認証 (ログイン) | < 200ms | > 95% |
| 認証 (登録) | < 300ms | > 90% |
| 認証 (トークン更新) | < 100ms | > 95% |
| 写真一覧 | < 200ms | > 95% |
| 写真詳細 | < 200ms | > 95% |
| 写真アップロード | < 3,000ms | > 90% |
| 地図マーカー | < 2,000ms | > 95% |
| 地図クラスター | < 2,000ms | > 95% |
| 地図ヒートマップ | < 2,000ms | > 95% |
| いいね | < 200ms | > 95% |
| コメント | < 200ms | > 90% |

---

## k6負荷テスト結果の読み方

### テストシナリオ一覧

| シナリオ | ファイル | VU数 | 実行時間 | 目的 |
|---------|--------|------|---------|------|
| Smoke | `k6/scenarios/smoke.js` | 10 | 40秒 | 基本動作確認 |
| Load | `k6/scenarios/load.js` | 最大120 | 7分 | NFR-2準拠テスト |
| Stress | `k6/scenarios/stress.js` | 最大1,000 | 18分 | システム限界確認 |
| Spike | `k6/scenarios/spike.js` | 突発1,000 | 7分 | スパイク耐性確認 |

### テスト実行方法

```bash
# スモークテスト (デプロイ後の基本確認)
k6 run k6/scenarios/smoke.js

# ロードテスト (NFR-2準拠確認)
k6 run k6/scenarios/load.js

# ストレステスト (限界確認)
k6 run k6/scenarios/stress.js

# スパイクテスト (突発負荷)
k6 run k6/scenarios/spike.js

# ステージング環境での実行
K6_ENV=staging k6 run k6/scenarios/load.js

# JSON形式で結果出力
k6 run --out json=results.json k6/scenarios/load.js
```

### 主要メトリクスの見方

#### 標準メトリクス

| メトリクス | 説明 | NFR-2閾値 |
|-----------|------|----------|
| `http_req_duration` | HTTPリクエスト応答時間 | p95 < 200ms |
| `http_req_failed` | リクエスト失敗率 | < 1% |
| `http_reqs` | 秒間リクエスト数 (スループット) | > 100 req/s |
| `http_req_waiting` | サーバー処理時間 (TTFB) | - |
| `http_req_connecting` | TCP接続時間 | - |

#### カスタムメトリクス (ロードテスト)

| メトリクス | 説明 | 閾値 |
|-----------|------|------|
| `load_test_success` | テスト成功率 | > 95% |
| `nfr2_compliance` | NFR-2準拠率 (200ms以内) | > 95% |
| `api_latency` | APIレイテンシ (カスタム計測) | p95 < 200ms |

#### カスタムメトリクス (ストレステスト)

| メトリクス | 説明 | 閾値 |
|-----------|------|------|
| `stress_test_success` | テスト成功率 | > 90% |
| `response_time_under_200ms` | 200ms以内の割合 | > 50% |
| `response_time_under_500ms` | 500ms以内の割合 | - |
| `response_time_under_1000ms` | 1000ms以内の割合 | - |
| `error_rate` | エラー率 | < 5% |

#### カスタムメトリクス (スパイクテスト)

| メトリクス | 説明 | 閾値 |
|-----------|------|------|
| `pre_spike_latency` | スパイク前ベースラインレイテンシ | - |
| `during_spike_latency` | スパイク中レイテンシ | - |
| `post_spike_latency` | スパイク後復旧レイテンシ | - |
| `recovery_rate` | 復旧率 (500ms以内の割合) | > 90% |

### テスト結果の分析ポイント

1. **p95とp99の乖離**: 大きな乖離がある場合、外れ値クエリや特定エンドポイントのボトルネックを示唆
2. **エラー率の推移**: VU数増加に伴う急激なエラー率上昇は、飽和点を示す
3. **スループットの頭打ち**: リクエスト数が増えない場合、リソースがボトルネック
4. **復旧時間**: スパイクテストで`post_spike_latency`が`pre_spike_latency`に戻るまでの時間を確認

---

## スケーリングトリガー

### アラート閾値

以下の条件が継続的に発生した場合、スケーリングを検討します。

| トリガー | 警告閾値 | アクション閾値 | 対応 |
|---------|---------|-------------|------|
| CPU使用率 | > 70% (5分平均) | > 80% (5分平均) | 水平/垂直スケーリング |
| メモリ使用率 | > 70% | > 80% | 垂直スケーリング |
| API応答時間 (p95) | > 150ms | > 200ms | 水平スケーリング or 最適化 |
| エラー率 | > 0.5% | > 1% | 原因調査 + スケーリング |
| DB接続数 | > 60 | > 80 | DBプール拡張 or レプリカ |
| DB クエリ時間 | > 200ms | > 500ms | クエリ最適化 or DBスケーリング |
| Solid Queue待機ジョブ | > 200 | > 500 | ワーカー追加 |
| ディスク使用率 | > 70% | > 80% | ディスク拡張 or クリーンアップ |

### 監視コマンド

```bash
# CPU・メモリ確認
bundle exec kamal app exec "cat /proc/loadavg && echo '---' && free -m"

# DB接続数確認
bundle exec kamal accessory exec db \
  "psql -U shiojiri_rainbow_seeker -c 'SELECT count(*) FROM pg_stat_activity;'"

# Solid Queue状態確認
bundle exec kamal app exec "bin/rails runner '
  puts \"Pending: #{SolidQueue::ReadyExecution.count}\"
  puts \"Claimed: #{SolidQueue::ClaimedExecution.count}\"
  puts \"Failed: #{SolidQueue::FailedExecution.count}\"
'"

# ディスク使用量確認
bundle exec kamal app exec "df -h"
```

---

## 水平スケーリング

### Webサーバーレプリカ追加

Kamalで複数のWebサーバーを追加してリクエストを分散します。

**deploy.yml変更**:
```yaml
servers:
  web:
    hosts:
      - 192.168.1.10  # 既存サーバー
      - 192.168.1.11  # 追加サーバー1
      - 192.168.1.12  # 追加サーバー2
    labels:
      traefik.http.routers.shiojiri-rainbow-seeker.rule: Host(`api.shiojiri-rainbow.app`)
    options:
      memory: 2g
      cpus: 2

  job:
    hosts:
      - 192.168.1.10  # ジョブワーカーは1台で運用
    cmd: ./bin/rails solid_queue:start
    options:
      memory: 1g
      cpus: 1
```

**追加サーバーのセットアップ**:
```bash
# 1. 新サーバーにDockerをインストール
ssh deploy@192.168.1.11 "curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker deploy"
ssh deploy@192.168.1.12 "curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker deploy"

# 2. deploy.ymlを更新後デプロイ
bundle exec kamal deploy

# 3. 全サーバーの状態確認
bundle exec kamal app details
```

### Puma同時処理数チューニング

**ワーカー数の増加 (WEB_CONCURRENCY)**:

| メモリ | 推奨ワーカー数 | 最大同時処理数 (スレッド5) |
|-------|-------------|----------------------|
| 2GB | 2 | 10 |
| 4GB | 4 | 20 |
| 8GB | 8 | 40 |

```yaml
# deploy.yml
env:
  clear:
    WEB_CONCURRENCY: 4      # メモリに応じて調整
    RAILS_MAX_THREADS: 5    # DB接続プールと一致させる
```

**スレッド数の調整 (RAILS_MAX_THREADS)**:

| スレッド数 | 用途 | 考慮事項 |
|----------|------|---------|
| 3 | I/O少ないAPI | CPU負荷を抑制 |
| 5 | 標準 (推奨) | バランスが良い |
| 10 | I/O多いAPI | DB接続プールの拡大が必要 |

スレッド数を変更する場合、`database.yml`の`pool`も合わせて調整が必要です:

```yaml
# database.yml
default: &default
  adapter: postgis
  pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>
```

### Solid Queueワーカーの追加

ジョブ処理が追いつかない場合、ジョブワーカーを追加します。

```yaml
# deploy.yml
servers:
  job:
    hosts:
      - 192.168.1.10
      - 192.168.1.13  # 追加ジョブワーカー
    cmd: ./bin/rails solid_queue:start
    options:
      memory: 1g
      cpus: 1
```

---

## 垂直スケーリング

### メモリ/CPU増加

各コンポーネントのリソース制限を引き上げます。

**段階的スケーリング計画**:

| フェーズ | Web | Job Worker | DB | 対象ユーザー数 |
|---------|-----|-----------|-----|-------------|
| Phase 1 (現行) | 2GB / 2CPU | 1GB / 1CPU | 2GB / 2CPU | ~500 |
| Phase 2 | 4GB / 4CPU | 2GB / 2CPU | 4GB / 4CPU | ~2,000 |
| Phase 3 | 8GB / 8CPU | 4GB / 2CPU | 8GB / 4CPU | ~5,000 |
| Phase 4 | マネージド | マネージド | マネージドDB | ~10,000+ |

**deploy.yml変更例 (Phase 2)**:
```yaml
servers:
  web:
    hosts:
      - 192.168.1.10
    options:
      memory: 4g
      cpus: 4

  job:
    hosts:
      - 192.168.1.10
    cmd: ./bin/rails solid_queue:start
    options:
      memory: 2g
      cpus: 2

accessories:
  db:
    image: postgis/postgis:16-3.4
    host: 192.168.1.10
    options:
      memory: 4g
      cpus: 4
```

---

## DBスケーリング

### 接続プール最適化

```yaml
# database.yml - 接続プール増加
default: &default
  adapter: postgis
  pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>
  # 接続タイムアウト (秒)
  checkout_timeout: 10
  # アイドル接続の回収 (秒)
  idle_timeout: 300
  # prepared statements (マネージドDB使用時はtrue推奨)
  prepared_statements: true
```

**接続数の計算式**:

```
必要接続数 = WEB_CONCURRENCY * RAILS_MAX_THREADS * DB数 + ジョブワーカー接続数
           = 2 * 5 * 4 + 5
           = 45接続

Webサーバー2台の場合:
           = (2 * 5 * 4) * 2 + 5
           = 85接続
```

PostgreSQLの`max_connections`は必要接続数の1.5倍以上を設定:

```bash
# PostgreSQL設定確認
bundle exec kamal accessory exec db \
  "psql -U shiojiri_rainbow_seeker -c 'SHOW max_connections;'"

# 変更が必要な場合
bundle exec kamal accessory exec db \
  "psql -U shiojiri_rainbow_seeker -c 'ALTER SYSTEM SET max_connections = 200;'"
```

### リードレプリカ

読み取り負荷が高い場合、リードレプリカを導入します。

**database.yml (リードレプリカ設定)**:
```yaml
production:
  primary:
    <<: *default
    database: shiojiri_rainbow_seeker_production
    username: shiojiri_rainbow_seeker
    password: <%= ENV["SHIOJIRI_RAINBOW_SEEKER_DATABASE_PASSWORD"] %>
    host: <%= ENV.fetch("DATABASE_HOST") { "localhost" } %>
  primary_replica:
    <<: *default
    database: shiojiri_rainbow_seeker_production
    username: shiojiri_rainbow_seeker
    password: <%= ENV["SHIOJIRI_RAINBOW_SEEKER_DATABASE_PASSWORD"] %>
    host: <%= ENV.fetch("DATABASE_REPLICA_HOST") { ENV.fetch("DATABASE_HOST") { "localhost" } } %>
    replica: true
```

**モデルでの読み書き分離**:
```ruby
# app/models/application_record.rb
class ApplicationRecord < ActiveRecord::Base
  self.abstract_class = true
  connects_to database: { writing: :primary, reading: :primary_replica }
end
```

### マネージドDB移行

規模拡大時はマネージドDBへの移行を推奨します。詳細は[マネージドDB移行ガイド](./managed-db-migration.md)を参照してください。

---

## コスト見積

### 現行構成 (VPS)

VPS (例: Conoha VPS, さくらVPS, Vultr) でのコスト見積:

| コンポーネント | スペック | 月額費用 (目安) |
|-------------|--------|-------------|
| VPSサーバー | 4GB RAM, 4CPU | 2,000 - 5,000円 |
| S3 (画像ストレージ) | 50GB + 転送量 | 500 - 1,500円 |
| ドメイン | .app | 1,500円/年 |
| SSL証明書 | Let's Encrypt | 無料 |
| **合計** | | **約 2,500 - 6,500円/月** |

### Phase 2構成 (VPS + 水平スケール)

| コンポーネント | スペック | 月額費用 (目安) |
|-------------|--------|-------------|
| VPSサーバー x2 | 4GB RAM, 4CPU 各 | 4,000 - 10,000円 |
| S3 (画像ストレージ) | 100GB + 転送量 | 1,000 - 3,000円 |
| ドメイン | .app | 1,500円/年 |
| SSL証明書 | Let's Encrypt | 無料 |
| **合計** | | **約 5,000 - 13,000円/月** |

### マネージドサービス構成

#### AWS構成

| コンポーネント | サービス | スペック | 月額費用 (目安) |
|-------------|---------|--------|-------------|
| Web + Worker | EC2 t3.medium | 2vCPU, 4GB | 5,000 - 6,000円 |
| DB | RDS db.t3.medium | 2vCPU, 4GB | 8,000 - 10,000円 |
| DB (Multi-AZ) | RDS Multi-AZ | 自動フェイルオーバー | 16,000 - 20,000円 |
| ストレージ | S3 | 100GB | 300 - 500円 |
| CDN | CloudFront | 100GB転送 | 1,000 - 2,000円 |
| ロードバランサー | ALB | - | 3,000 - 4,000円 |
| **合計 (Single-AZ)** | | | **約 17,000 - 23,000円/月** |
| **合計 (Multi-AZ)** | | | **約 25,000 - 33,000円/月** |

#### GCP構成

| コンポーネント | サービス | スペック | 月額費用 (目安) |
|-------------|---------|--------|-------------|
| Web + Worker | Cloud Run | 2vCPU, 4GB | 3,000 - 8,000円 |
| DB | Cloud SQL | 2vCPU, 4GB | 7,000 - 9,000円 |
| DB (HA) | Cloud SQL HA | 自動フェイルオーバー | 14,000 - 18,000円 |
| ストレージ | Cloud Storage | 100GB | 300 - 400円 |
| CDN | Cloud CDN | 100GB転送 | 1,000 - 1,500円 |
| ロードバランサー | Cloud LB | - | 2,500 - 3,500円 |
| **合計 (Single)** | | | **約 14,000 - 22,000円/月** |
| **合計 (HA)** | | | **約 21,000 - 31,000円/月** |

### コスト比較サマリー

| 構成 | 月額費用 | 可用性 | 運用負荷 | 推奨ユーザー数 |
|------|---------|-------|---------|-------------|
| VPS (現行) | 2,500 - 6,500円 | 手動対応 | 高 | ~500 |
| VPS x2 (水平) | 5,000 - 13,000円 | 手動対応 | 高 | ~2,000 |
| AWS (Single-AZ) | 17,000 - 23,000円 | 99.9% | 低 | ~5,000 |
| AWS (Multi-AZ) | 25,000 - 33,000円 | 99.95% | 低 | ~10,000 |
| GCP (Single) | 14,000 - 22,000円 | 99.9% | 低 | ~5,000 |
| GCP (HA) | 21,000 - 31,000円 | 99.95% | 低 | ~10,000 |

### コスト最適化のポイント

1. **リザーブドインスタンス**: AWS EC2/RDSの1年/3年予約で最大40%割引
2. **Committed Use Discounts**: GCPの1年/3年コミットで最大57%割引
3. **スポットインスタンス**: ジョブワーカーにスポット/プリエンプティブインスタンスを使用
4. **S3ストレージクラス**: アクセス頻度の低い画像をS3 Infrequent Accessに移行
5. **CDN活用**: 画像配信をCDN経由にし、オリジンサーバーの負荷を軽減

---

## 成長予測とスケーリングタイムライン

### トラフィック予測

| 期間 | 推定ユーザー数 | 日次投稿数 | 推奨構成 |
|------|-------------|----------|---------|
| リリース~3ヶ月 | ~200 | ~50 | Phase 1 (現行) |
| 3~6ヶ月 | ~500 | ~100 | Phase 1 (現行) |
| 6~12ヶ月 | ~1,000 | ~200 | Phase 2 (水平スケール) |
| 1年~2年 | ~3,000 | ~500 | Phase 3 (マネージドDB) |
| 2年~ | ~10,000+ | ~1,000+ | Phase 4 (フルマネージド) |

### 判断フロー

```
現行構成で問題なし?
├─ YES → 継続 (月次モニタリング)
└─ NO
    ├─ CPU/メモリが不足?
    │   ├─ YES → 垂直スケーリング (Phase 2)
    │   └─ NO
    ├─ リクエスト分散が必要?
    │   ├─ YES → Webサーバー追加 (水平スケーリング)
    │   └─ NO
    ├─ DB負荷が高い?
    │   ├─ YES
    │   │   ├─ 読み取り負荷 → リードレプリカ追加
    │   │   └─ 書き込み負荷 → マネージドDB移行
    │   └─ NO
    └─ ジョブ処理が遅い?
        ├─ YES → ジョブワーカー追加
        └─ NO → パフォーマンスチューニング
```

---

## 定期レビュースケジュール

| 頻度 | レビュー内容 |
|-----|-----------|
| 月次 | リソース使用率の確認、トレンド分析 |
| 四半期 | k6負荷テスト実施、スケーリング計画の見直し |
| 半期 | コスト最適化レビュー、構成変更の検討 |
| 年次 | 全体アーキテクチャレビュー、次年度計画策定 |

---

## 関連ドキュメント

- [運用マニュアル](./operations.md) - 監視閾値と日常運用
- [デプロイ手順書](./deployment.md) - Kamalデプロイ設定
- [災害復旧ランブック](./disaster-recovery.md) - バックアップ・復旧手順
- [マネージドDB移行ガイド](./managed-db-migration.md) - DB移行手順
