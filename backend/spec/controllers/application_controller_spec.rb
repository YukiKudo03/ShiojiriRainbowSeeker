# frozen_string_literal: true

RSpec.describe ApplicationController, type: :request do
  let(:json_headers) { { "Accept" => "application/json" } }

  after { I18n.locale = I18n.default_locale }

  describe "ErrorHandler integration" do
    it "returns standardized error response for not found resources" do
      get "/api/v1/photos/00000000-0000-0000-0000-000000000000", headers: json_headers
      expect(response).to have_http_status(:not_found)

      body = JSON.parse(response.body)
      expect(body).to have_key("error")
      expect(body["error"]).to have_key("code")
      expect(body["error"]["code"]).to eq(ErrorHandler::ErrorCodes::RESOURCE_NOT_FOUND)
    end

    it "handles ParameterMissing with bad_request status" do
      post "/api/v1/auth/register", params: {}, as: :json, headers: json_headers
      expect(response.status).to be_between(400, 422)
    end
  end

  describe "LocaleSetter integration" do
    it "defaults to Japanese locale" do
      get "/api/v1/health", headers: json_headers
      expect(response).to have_http_status(:ok)
    end

    it "respects Accept-Language: en header" do
      get "/api/v1/health", headers: json_headers.merge("Accept-Language" => "en")
      expect(response).to have_http_status(:ok)
    end

    it "respects Accept-Language with quality values" do
      get "/api/v1/health", headers: json_headers.merge("Accept-Language" => "en;q=0.9,ja;q=1.0")
      expect(response).to have_http_status(:ok)
    end

    it "falls back to default for unsupported locales" do
      get "/api/v1/health", headers: json_headers.merge("Accept-Language" => "zh-CN")
      expect(response).to have_http_status(:ok)
    end

    context "with authenticated user locale" do
      let(:user) { create(:user, locale: "en") }

      it "uses user locale preference over header" do
        get "/api/v1/health", headers: json_headers
          .merge("Accept-Language" => "ja")
          .merge("Authorization" => "Bearer #{generate_jwt_token(user)}")
        expect(response).to have_http_status(:ok)
      end
    end
  end
end
