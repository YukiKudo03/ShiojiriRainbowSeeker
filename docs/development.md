# 開発環境セットアップガイド

塩尻レインボーシーカー 開発環境構築手順

## システム要件

### バックエンド (Rails)

| ソフトウェア | バージョン |
|-------------|-----------|
| Ruby | 3.2以上 |
| Rails | 8.0以上 |
| PostgreSQL | 14以上 |
| PostGIS | 3.0以上 |
| Node.js | 18以上 (アセット用) |

### モバイル (React Native)

| ソフトウェア | バージョン |
|-------------|-----------|
| Node.js | 20以上 |
| npm | 10以上 |
| Expo CLI | 最新 |
| iOS: Xcode | 15以上 (macOS) |
| Android: Android Studio | 最新 |

---

## バックエンドセットアップ

### 1. 依存ソフトウェアのインストール

#### macOS (Homebrew)

```bash
# Ruby (rbenv推奨)
brew install rbenv ruby-build
rbenv install 3.2.2
rbenv global 3.2.2

# PostgreSQL + PostGIS
brew install postgresql@16 postgis
brew services start postgresql@16

# その他
brew install imagemagick vips
```

#### Ubuntu/Debian

```bash
# Ruby (rbenv推奨)
sudo apt-get update
sudo apt-get install -y git curl libssl-dev libreadline-dev zlib1g-dev
git clone https://github.com/rbenv/rbenv.git ~/.rbenv
echo 'export PATH="$HOME/.rbenv/bin:$PATH"' >> ~/.bashrc
echo 'eval "$(rbenv init -)"' >> ~/.bashrc
source ~/.bashrc
git clone https://github.com/rbenv/ruby-build.git ~/.rbenv/plugins/ruby-build
rbenv install 3.2.2
rbenv global 3.2.2

# PostgreSQL + PostGIS
sudo apt-get install -y postgresql-16 postgresql-16-postgis-3 libpq-dev

# その他
sudo apt-get install -y imagemagick libvips-dev
```

### 2. プロジェクトのクローン

```bash
git clone https://github.com/your-org/shiojiri-rainbow-seeker.git
cd shiojiri-rainbow-seeker/backend
```

### 3. 依存パッケージのインストール

```bash
bundle install
```

### 4. データベースのセットアップ

```bash
# データベース作成
bundle exec rails db:create

# PostGIS拡張の有効化とマイグレーション実行
bundle exec rails db:migrate

# シードデータ投入 (オプション)
bundle exec rails db:seed
```

### 5. 環境変数の設定

```bash
# .envファイルを作成 (dotenv-rails使用)
cp .env.example .env

# 必要な値を設定
# OPENWEATHER_API_KEY=your_api_key
# AWS_ACCESS_KEY_ID=your_key (開発用)
# AWS_SECRET_ACCESS_KEY=your_secret (開発用)
```

### 6. サーバー起動

```bash
# Railsサーバー起動
bundle exec rails server

# http://localhost:3000/up でヘルスチェック
```

### 7. Docker Compose使用 (代替方法)

```bash
# Docker Compose起動
docker-compose up -d

# データベースセットアップ
docker-compose exec backend bundle exec rails db:setup
```

---

## モバイルアプリセットアップ

### 1. Node.jsのインストール

```bash
# nvm使用推奨
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
```

### 2. プロジェクトセットアップ

```bash
cd shiojiri-rainbow-seeker/mobile
npm install
```

### 3. 環境設定

```bash
# .envファイルを作成
cp .env.example .env

# API URLを設定
# API_URL=http://localhost:3000/api/v1
```

### 4. アプリ起動

```bash
# Expo開発サーバー起動
npx expo start

# iOSシミュレーター起動 (macOSのみ)
npx expo start --ios

# Androidエミュレーター起動
npx expo start --android
```

### 5. 実機テスト

1. Expo Goアプリをインストール (App Store / Play Store)
2. QRコードをスキャン
3. アプリが実機で起動

---

## 開発フロー

### ブランチ戦略

```
main (本番)
  └── develop (開発統合)
        ├── feature/xxx (機能開発)
        ├── fix/xxx (バグ修正)
        └── hotfix/xxx (緊急修正)
```

### コミットメッセージ規約

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメント
- `style`: フォーマット
- `refactor`: リファクタリング
- `test`: テスト
- `chore`: 雑務

**例:**
```
feat(auth): メール認証機能を追加

- メール送信ジョブの実装
- 認証トークンの生成と検証
- 認証完了画面の追加

Closes #123
```

### Pull Request

1. ブランチを作成: `git checkout -b feature/xxx`
2. 変更をコミット
3. プッシュ: `git push origin feature/xxx`
4. PRを作成 (テンプレート使用)
5. レビューを受ける
6. CIが通過したらマージ

---

## テスト

### バックエンドテスト

```bash
cd backend

# 全テスト実行
bundle exec rspec

# 特定のテスト実行
bundle exec rspec spec/models/user_spec.rb

# カバレッジ付き
COVERAGE=true bundle exec rspec

# 並列実行
bundle exec rspec --parallel
```

### モバイルテスト

```bash
cd mobile

# Jestテスト実行
npm test

# カバレッジ付き
npm test -- --coverage

# 監視モード
npm test -- --watch
```

### E2Eテスト (Detox)

```bash
cd mobile

# iOSビルド
npx detox build --configuration ios.sim.debug

# iOSテスト実行
npx detox test --configuration ios.sim.debug
```

---

## コード品質

### Linting

```bash
# バックエンド (RuboCop)
cd backend
bundle exec rubocop
bundle exec rubocop --auto-correct

# モバイル (ESLint)
cd mobile
npm run lint
npm run lint -- --fix
```

### 型チェック

```bash
# モバイル (TypeScript)
cd mobile
npm run type-check
# または
npx tsc --noEmit
```

### セキュリティスキャン

```bash
# バックエンド
cd backend
bundle exec brakeman
bundle exec bundler-audit check --update
```

---

## デバッグ

### バックエンド

```bash
# Railsコンソール
bundle exec rails console

# デバッグログ有効化
RAILS_LOG_LEVEL=debug bundle exec rails server

# Bulletで N+1検出
# development.rbで設定済み
```

### モバイル

```bash
# React Native Debugger
# https://github.com/jhen0409/react-native-debugger

# Expo Go内でシェイク → Debug Remote JS

# Flipper (推奨)
# https://fbflipper.com/
```

---

## API テスト (curl)

```bash
# ユーザー登録
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"user":{"email":"test@example.com","password":"Password123!","password_confirmation":"Password123!","display_name":"テスト"}}'

# ログイン
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"user":{"email":"test@example.com","password":"Password123!"}}'

# 認証付きリクエスト
curl http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer <access_token>"
```

---

## トラブルシューティング

### PostgreSQL接続エラー

```bash
# PostgreSQLが起動しているか確認
brew services list | grep postgresql
# または
sudo systemctl status postgresql

# 再起動
brew services restart postgresql@16
```

### PostGIS関連エラー

```bash
# PostGIS拡張が有効か確認
psql -d shiojiri_rainbow_seeker_development -c "SELECT PostGIS_Version();"

# 手動で有効化
psql -d shiojiri_rainbow_seeker_development -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

### npm依存関係エラー

```bash
# node_modules削除して再インストール
rm -rf node_modules package-lock.json
npm install

# キャッシュクリア
npm cache clean --force
```

### Expoビルドエラー

```bash
# Expoキャッシュクリア
npx expo start --clear

# iOSシミュレーターリセット
xcrun simctl erase all
```

---

## 参考リンク

- [Rails Guides](https://guides.rubyonrails.org/)
- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [PostGIS Documentation](https://postgis.net/documentation/)
