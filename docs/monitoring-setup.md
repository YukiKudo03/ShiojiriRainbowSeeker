# パフォーマンスモニタリング セットアップガイド

InfluxDB + Grafana を使用した k6 負荷テスト結果の可視化と API モニタリング。

---

## 概要

| コンポーネント | バージョン | 用途 | ポート |
|--------------|-----------|------|-------|
| InfluxDB | 2.7 | 時系列データストア | 8086 |
| Grafana | 10.4 | ダッシュボード表示 | 3001 |

---

## ローカル環境セットアップ

### 1. サービス起動

```bash
cd backend
docker compose up -d influxdb grafana
```

### 2. Grafana アクセス

- URL: http://localhost:3001
- ユーザー名: `admin`
- パスワード: `grafana_dev_password` (デフォルト)

### 3. プロビジョニング済みダッシュボード

起動と同時に以下のダッシュボードが自動設定されます：

| ダッシュボード | UID | 内容 |
|--------------|-----|------|
| k6 Performance Dashboard | `k6-performance` | レスポンスタイム(p95), RPS, エラー率, VU数, エンドポイント別応答時間 |
| API Monitoring Dashboard | `api-monitoring` | 平均応答時間, リクエスト総数, エラー数, スループット, データ転送量 |

---

## k6 テスト結果の送信

### InfluxDB に出力する方法

```bash
# 環境変数で指定
K6_OUT=influxdb=http://localhost:8086/k6 k6 run k6/scenarios/smoke.js

# または K6_INFLUXDB_URL 環境変数を使用
K6_INFLUXDB_URL=http://localhost:8086/k6 k6 run k6/scenarios/load.js
```

### CI/CD パイプラインでの使用

`.github/workflows/load-test.yml` で `K6_INFLUXDB_URL` シークレットを設定すると、テスト結果が自動的に InfluxDB に送信されます。

---

## 本番環境セットアップ

### 1. 環境変数の設定

```bash
# .kamal/secrets に追加
INFLUXDB_PASSWORD=<strong_password>
INFLUXDB_TOKEN=<generated_token>
GRAFANA_PASSWORD=<strong_password>
```

### 2. デプロイ

```bash
docker compose -f docker-compose.prod.yml up -d influxdb grafana
```

### 3. アクセス

- Grafana: https://monitoring.shiojiri-rainbow.app (要リバースプロキシ設定)
- InfluxDB: 内部アクセスのみ (ポート非公開)

---

## NFR-2 パフォーマンス基準

ダッシュボードのしきい値は NFR-2 に準拠：

| メトリクス | 正常 (緑) | 警告 (黄) | 異常 (赤) |
|-----------|----------|----------|----------|
| API応答時間 (p95) | < 200ms | 200-500ms | > 500ms |
| エラー率 | < 1% | 1-5% | > 5% |
| 平均応答時間 | < 100ms | 100-200ms | > 200ms |

---

## トラブルシューティング

### InfluxDB に接続できない

```bash
# ヘルスチェック
docker compose exec influxdb influx ping

# ログ確認
docker compose logs influxdb
```

### Grafana にダッシュボードが表示されない

```bash
# プロビジョニングファイルの確認
docker compose exec grafana ls /etc/grafana/provisioning/datasources/
docker compose exec grafana ls /var/lib/grafana/dashboards/

# Grafana 再起動
docker compose restart grafana
```

### k6 データが表示されない

```bash
# InfluxDB にデータが書き込まれているか確認
docker compose exec influxdb influx query \
  'from(bucket: "k6") |> range(start: -1h) |> count()' \
  --org shiojiri-rainbow
```
