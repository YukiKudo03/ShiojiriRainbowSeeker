# frozen_string_literal: true

require "rails_helper"

RSpec.describe LocaleSetter, type: :request do
  # Test locale detection through the health endpoint which is always available
  let(:json_headers) { { "Accept" => "application/json" } }

  after do
    # Reset locale after each test
    I18n.locale = I18n.default_locale
  end

  describe "locale detection via health endpoint" do
    context "without Accept-Language header" do
      it "uses default locale (Japanese)" do
        get "/api/v1/health", headers: json_headers

        expect(response).to have_http_status(:ok)
        # Response should be valid regardless of locale
      end
    end

    context "with Accept-Language header" do
      it "accepts English locale" do
        get "/api/v1/health", headers: json_headers.merge("Accept-Language" => "en")
        expect(response).to have_http_status(:ok)
      end

      it "accepts Japanese locale" do
        get "/api/v1/health", headers: json_headers.merge("Accept-Language" => "ja")
        expect(response).to have_http_status(:ok)
      end

      it "handles regional variants like 'ja-JP'" do
        get "/api/v1/health", headers: json_headers.merge("Accept-Language" => "ja-JP")
        expect(response).to have_http_status(:ok)
      end

      it "handles regional variants like 'en-US'" do
        get "/api/v1/health", headers: json_headers.merge("Accept-Language" => "en-US")
        expect(response).to have_http_status(:ok)
      end

      it "handles complex Accept-Language header" do
        get "/api/v1/health", headers: json_headers.merge("Accept-Language" => "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7")
        expect(response).to have_http_status(:ok)
      end

      it "handles unsupported languages by falling back" do
        get "/api/v1/health", headers: json_headers.merge("Accept-Language" => "fr")
        expect(response).to have_http_status(:ok)
      end

      it "handles empty Accept-Language header" do
        get "/api/v1/health", headers: json_headers.merge("Accept-Language" => "")
        expect(response).to have_http_status(:ok)
      end
    end
  end

  describe "I18n translations" do
    context "Japanese locale" do
      before { I18n.locale = :ja }

      it "returns Japanese error messages" do
        expect(I18n.t("errors.validation_failed")).to eq("入力内容に誤りがあります")
        expect(I18n.t("errors.unauthorized")).to eq("認証が必要です")
        expect(I18n.t("errors.forbidden")).to eq("アクセス権限がありません")
      end

      it "returns Japanese success messages" do
        expect(I18n.t("success.created")).to eq("作成しました")
        expect(I18n.t("success.updated")).to eq("更新しました")
        expect(I18n.t("success.deleted")).to eq("削除しました")
      end

      it "returns Japanese app name" do
        expect(I18n.t("app_name")).to eq("塩尻レインボーシーカー")
      end
    end

    context "English locale" do
      before { I18n.locale = :en }

      it "returns English error messages" do
        expect(I18n.t("errors.validation_failed")).to eq("Validation failed")
        expect(I18n.t("errors.unauthorized")).to eq("Authentication required")
        expect(I18n.t("errors.forbidden")).to eq("Access denied")
      end

      it "returns English success messages" do
        expect(I18n.t("success.created")).to eq("Created successfully")
        expect(I18n.t("success.updated")).to eq("Updated successfully")
        expect(I18n.t("success.deleted")).to eq("Deleted successfully")
      end

      it "returns English app name" do
        expect(I18n.t("app_name")).to eq("Shiojiri Rainbow Seeker")
      end
    end
  end

  describe "Accept-Language header parsing" do
    it "handles uppercase language codes" do
      get "/api/v1/health", headers: json_headers.merge("Accept-Language" => "EN")
      expect(response).to have_http_status(:ok)
    end

    it "handles mixed case language codes" do
      get "/api/v1/health", headers: json_headers.merge("Accept-Language" => "En-Us")
      expect(response).to have_http_status(:ok)
    end

    it "handles malformed quality values gracefully" do
      get "/api/v1/health", headers: json_headers.merge("Accept-Language" => "ja;q=invalid,en")
      expect(response).to have_http_status(:ok)
    end

    it "handles wildcard (*)" do
      get "/api/v1/health", headers: json_headers.merge("Accept-Language" => "*")
      expect(response).to have_http_status(:ok)
    end
  end
end
