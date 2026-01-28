# frozen_string_literal: true

require "rails_helper"

RSpec.describe ErrorHandler, type: :request do
  let(:json_headers) { { "Accept" => "application/json" } }

  describe "error response format for not found" do
    it "returns standardized error response for non-existent photo" do
      get "/api/v1/photos/00000000-0000-0000-0000-000000000000", headers: json_headers

      expect(response).to have_http_status(:not_found)
      json_response = JSON.parse(response.body)
      expect(json_response).to have_key("error")
      expect(json_response["error"]).to have_key("code")
      expect(json_response["error"]).to have_key("message")
    end
  end

  describe "error response for bad request" do
    it "returns 400 for missing required parameters" do
      get "/api/v1/maps/markers", headers: json_headers

      expect(response).to have_http_status(:bad_request)
      json_response = JSON.parse(response.body)
      expect(json_response).to have_key("error")
      expect(json_response["error"]).to have_key("message")
    end
  end

  describe "error response for unauthorized" do
    it "returns 401 for protected endpoints without auth" do
      get "/api/v1/users/me", headers: json_headers

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "error response for forbidden" do
    let(:user) { create(:user) }
    let(:other_user) { create(:user) }
    let(:photo) do
      photo = Photo.new(
        user: other_user,
        title: "Test Photo",
        captured_at: Time.current,
        moderation_status: :approved,
        is_visible: true
      )
      photo.set_location(36.115, 137.954)
      photo.save!
      photo
    end

    it "returns 403 for unauthorized modification" do
      token = Warden::JWTAuth::UserEncoder.new.call(user, :user, nil).first
      auth_headers = json_headers.merge("Authorization" => "Bearer #{token}")

      patch "/api/v1/photos/#{photo.id}",
            params: { photo: { title: "New Title" } },
            headers: auth_headers,
            as: :json

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "error code ranges" do
    it "authentication errors are in 1000-1999 range" do
      expect(ErrorHandler::ErrorCodes::INVALID_EMAIL).to be_between(1000, 1999)
      expect(ErrorHandler::ErrorCodes::INVALID_PASSWORD).to be_between(1000, 1999)
      expect(ErrorHandler::ErrorCodes::NOT_AUTHORIZED).to be_between(1000, 1999)
    end

    it "validation errors are in 2000-2999 range" do
      expect(ErrorHandler::ErrorCodes::REQUIRED_FIELD_MISSING).to be_between(2000, 2999)
      expect(ErrorHandler::ErrorCodes::CHARACTER_LIMIT_EXCEEDED).to be_between(2000, 2999)
      expect(ErrorHandler::ErrorCodes::VALIDATION_FAILED).to be_between(2000, 2999)
    end

    it "resource errors are in 3000-3999 range" do
      expect(ErrorHandler::ErrorCodes::PHOTO_NOT_FOUND).to be_between(3000, 3999)
      expect(ErrorHandler::ErrorCodes::USER_NOT_FOUND).to be_between(3000, 3999)
      expect(ErrorHandler::ErrorCodes::RESOURCE_NOT_FOUND).to be_between(3000, 3999)
    end

    it "external service errors are in 4000-4999 range" do
      expect(ErrorHandler::ErrorCodes::WEATHER_API_ERROR).to be_between(4000, 4999)
      expect(ErrorHandler::ErrorCodes::S3_UPLOAD_ERROR).to be_between(4000, 4999)
    end

    it "server errors are in 5000-5999 range" do
      expect(ErrorHandler::ErrorCodes::DATABASE_ERROR).to be_between(5000, 5999)
      expect(ErrorHandler::ErrorCodes::INTERNAL_ERROR).to be_between(5000, 5999)
    end
  end
end
