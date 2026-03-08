# frozen_string_literal: true

RSpec.describe Api::V1::Admin::BaseController, type: :request do
  let(:json_headers) { { "Accept" => "application/json", "Content-Type" => "application/json" } }
  let(:admin_user) { create(:user, :admin) }
  let(:regular_user) { create(:user) }

  # Use an admin endpoint to test base controller behavior
  # Admin photos endpoint: GET /api/v1/admin/photos
  let(:admin_endpoint) { "/api/v1/admin/photos" }

  describe "authentication requirement" do
    it "rejects unauthenticated requests" do
      get admin_endpoint, headers: json_headers
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "admin role verification" do
    it "rejects non-admin users with forbidden" do
      get admin_endpoint,
        headers: json_headers.merge("Authorization" => "Bearer #{generate_jwt_token(regular_user)}")
      expect(response).to have_http_status(:forbidden)
    end

    it "returns forbidden error code 1003" do
      get admin_endpoint,
        headers: json_headers.merge("Authorization" => "Bearer #{generate_jwt_token(regular_user)}")
      body = JSON.parse(response.body)
      expect(body["error"]["code"]).to eq(ErrorHandler::ErrorCodes::NOT_AUTHORIZED)
    end

    it "allows admin users" do
      get admin_endpoint,
        headers: json_headers.merge("Authorization" => "Bearer #{generate_jwt_token(admin_user)}")
      expect(response).to have_http_status(:ok)
    end
  end

  describe "Pundit integration" do
    it "includes Pundit error details in forbidden response" do
      get admin_endpoint,
        headers: json_headers.merge("Authorization" => "Bearer #{generate_jwt_token(regular_user)}")
      body = JSON.parse(response.body)
      expect(body["error"]).to have_key("details")
    end
  end
end
