# frozen_string_literal: true

RSpec.describe Api::V1::BaseController, type: :request do
  let(:json_headers) { { "Accept" => "application/json", "Content-Type" => "application/json" } }
  let(:user) { create(:user) }

  describe "render_success" do
    it "returns data in standardized format" do
      get "/api/v1/health", headers: json_headers
      expect(response).to have_http_status(:ok)

      body = JSON.parse(response.body)
      expect(body).to have_key("data")
    end
  end

  describe "authenticate_user!" do
    it "rejects requests without Authorization header" do
      get "/api/v1/users/me", headers: json_headers
      expect(response).to have_http_status(:unauthorized)
    end

    it "rejects requests with invalid JWT token" do
      get "/api/v1/users/me",
        headers: json_headers.merge("Authorization" => "Bearer invalid_token")
      expect(response).to have_http_status(:unauthorized)
    end

    it "accepts requests with valid JWT token" do
      get "/api/v1/users/me",
        headers: json_headers.merge("Authorization" => "Bearer #{generate_jwt_token(user)}")
      expect(response).to have_http_status(:ok)
    end
  end

  describe "authenticate_user_optional" do
    it "allows unauthenticated access to public endpoints" do
      get "/api/v1/photos", headers: json_headers
      expect(response).to have_http_status(:ok)
    end

    it "does not fail with expired JWT on optional auth endpoints" do
      get "/api/v1/photos",
        headers: json_headers.merge("Authorization" => "Bearer expired.token.here")
      # Should not raise — optional auth swallows JWT errors
      expect(response.status).not_to eq(500)
    end
  end

  describe "http_status_for_error" do
    # Test via controller behavior since method is private
    it "returns not_found for missing photo" do
      get "/api/v1/photos/00000000-0000-0000-0000-000000000000", headers: json_headers
      expect(response).to have_http_status(:not_found)
    end

    it "returns unauthorized for unauthenticated user" do
      delete "/api/v1/auth/logout", headers: json_headers
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "render_service_error" do
    it "renders errors from service results" do
      # Test via a validation error (e.g., register with empty params)
      post "/api/v1/auth/register", params: { email: "" }.to_json, headers: json_headers
      body = JSON.parse(response.body)
      expect(body).to have_key("error")
    end
  end
end
