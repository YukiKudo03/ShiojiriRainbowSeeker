# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Users", type: :request do
  let(:user) { create(:user) }
  let(:other_user) { create(:user) }
  let(:json_headers) { { "Accept" => "application/json" } }

  def auth_headers_for(user)
    token = Warden::JWTAuth::UserEncoder.new.call(user, :user, nil).first
    json_headers.merge("Authorization" => "Bearer #{token}")
  end

  # Helper to create photo without image
  def create_photo(photo_user)
    photo = Photo.new(
      user: photo_user,
      title: "Test Rainbow",
      captured_at: Time.current,
      moderation_status: :approved,
      is_visible: true
    )
    photo.set_location(36.115, 137.954)
    photo.save!
    photo
  end

  describe "GET /api/v1/users/me" do
    context "without authentication" do
      it "returns 401" do
        get "/api/v1/users/me", headers: json_headers
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with authentication" do
      it "returns 200 status" do
        get "/api/v1/users/me", headers: auth_headers_for(user)
        expect(response).to have_http_status(:ok)
      end

      it "returns user profile" do
        get "/api/v1/users/me", headers: auth_headers_for(user)
        expect(json_data[:user][:id]).to eq(user.id)
        expect(json_data[:user][:displayName]).to eq(user.display_name)
      end

      it "includes private fields" do
        get "/api/v1/users/me", headers: auth_headers_for(user)
        expect(json_data[:user]).to have_key(:email)
      end
    end
  end

  describe "PATCH /api/v1/users/me" do
    let(:update_params) do
      { user: { display_name: "Updated Name" } }
    end

    context "without authentication" do
      it "returns 401" do
        patch "/api/v1/users/me", params: update_params, headers: json_headers
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with authentication" do
      it "updates user profile" do
        patch "/api/v1/users/me",
              params: update_params,
              headers: auth_headers_for(user)
        expect(response).to have_http_status(:ok)
        expect(json_data[:user][:displayName]).to eq("Updated Name")
      end

      it "returns error for invalid data" do
        patch "/api/v1/users/me",
              params: { user: { display_name: "ab" } }, # Too short
              headers: auth_headers_for(user)
        expect(response).to have_http_status(:unprocessable_entity)
      end
    end
  end

  describe "GET /api/v1/users/me/photos" do
    let!(:user_photos) { 3.times.map { create_photo(user) } }
    let!(:other_photos) { 2.times.map { create_photo(other_user) } }

    context "without authentication" do
      it "returns 401" do
        get "/api/v1/users/me/photos", headers: json_headers
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with authentication" do
      it "returns 200 status" do
        get "/api/v1/users/me/photos", headers: auth_headers_for(user)
        expect(response).to have_http_status(:ok)
      end

      it "returns only user's photos" do
        get "/api/v1/users/me/photos", headers: auth_headers_for(user)
        expect(json_data[:photos]).to be_an(Array)
        expect(json_data[:photos].length).to eq(3)
      end

      it "returns pagination info" do
        get "/api/v1/users/me/photos", headers: auth_headers_for(user)
        expect(json_data[:pagination]).to be_present
        expect(json_data[:pagination][:totalCount]).to eq(3)
      end
    end
  end

  describe "POST /api/v1/users/me/export" do
    context "without authentication" do
      it "returns 401" do
        post "/api/v1/users/me/export", headers: json_headers
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with authentication" do
      it "returns 202 accepted" do
        post "/api/v1/users/me/export", headers: auth_headers_for(user)
        expect(response).to have_http_status(:accepted)
      end

      it "returns success message" do
        post "/api/v1/users/me/export", headers: auth_headers_for(user)
        expect(json_data[:message]).to be_present
      end

      it "enqueues export job" do
        expect {
          post "/api/v1/users/me/export", headers: auth_headers_for(user)
        }.to have_enqueued_job(DataExportJob).with(user.id)
      end
    end
  end

  describe "POST /api/v1/users/me/delete" do
    context "without authentication" do
      it "returns 401" do
        post "/api/v1/users/me/delete", headers: json_headers
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with authentication" do
      it "returns 200 status" do
        post "/api/v1/users/me/delete", headers: auth_headers_for(user)
        expect(response).to have_http_status(:ok)
      end

      it "returns deletion schedule info" do
        post "/api/v1/users/me/delete", headers: auth_headers_for(user)
        expect(json_data[:deletion_scheduled_at]).to be_present
        expect(json_data[:grace_period_days]).to be_present
      end

      it "sets deletion timestamp on user" do
        post "/api/v1/users/me/delete", headers: auth_headers_for(user)
        user.reload
        expect(user.deletion_requested_at).to be_present
      end
    end
  end

  describe "DELETE /api/v1/users/me/delete" do
    context "without authentication" do
      it "returns 401" do
        delete "/api/v1/users/me/delete", headers: json_headers
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with pending deletion" do
      before do
        user.update!(deletion_requested_at: Time.current)
      end

      it "cancels deletion" do
        delete "/api/v1/users/me/delete", headers: auth_headers_for(user)
        expect(response).to have_http_status(:ok)
        user.reload
        expect(user.deletion_requested_at).to be_nil
      end
    end

    context "without pending deletion" do
      it "returns error" do
        delete "/api/v1/users/me/delete", headers: auth_headers_for(user)
        expect(response).to have_http_status(:unprocessable_entity)
      end
    end
  end

  describe "GET /api/v1/users/me/deletion_status" do
    context "without authentication" do
      it "returns 401" do
        get "/api/v1/users/me/deletion_status", headers: json_headers
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with no pending deletion" do
      it "returns status" do
        get "/api/v1/users/me/deletion_status", headers: auth_headers_for(user)
        expect(response).to have_http_status(:ok)
        expect(json_data[:deletion_pending]).to eq(false)
      end
    end

    context "with pending deletion" do
      before do
        user.update!(
          deletion_requested_at: Time.current,
          deletion_scheduled_at: 14.days.from_now
        )
      end

      it "returns deletion info" do
        get "/api/v1/users/me/deletion_status", headers: auth_headers_for(user)
        expect(response).to have_http_status(:ok)
        expect(json_data[:deletion_pending]).to eq(true)
        expect(json_data[:deletion_requested_at]).to be_present
      end
    end
  end

  describe "GET /api/v1/users/:id" do
    context "without authentication" do
      it "returns 401" do
        get "/api/v1/users/#{other_user.id}", headers: json_headers
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with authentication" do
      it "returns 200 status" do
        get "/api/v1/users/#{other_user.id}", headers: auth_headers_for(user)
        expect(response).to have_http_status(:ok)
      end

      it "returns public user profile" do
        get "/api/v1/users/#{other_user.id}", headers: auth_headers_for(user)
        expect(json_data[:user][:id]).to eq(other_user.id)
        expect(json_data[:user][:displayName]).to eq(other_user.display_name)
      end

      it "excludes private fields" do
        get "/api/v1/users/#{other_user.id}", headers: auth_headers_for(user)
        # Public serializer should not include email
        expect(json_data[:user]).not_to have_key(:email)
      end
    end

    context "with non-existent user" do
      it "returns 404" do
        get "/api/v1/users/00000000-0000-0000-0000-000000000000",
            headers: auth_headers_for(user)
        expect(response).to have_http_status(:not_found)
      end
    end
  end

  describe "GET /api/v1/users/:id/photos" do
    let!(:user_photos) { 3.times.map { create_photo(other_user) } }

    context "without authentication" do
      it "returns 401" do
        get "/api/v1/users/#{other_user.id}/photos", headers: json_headers
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with authentication" do
      it "returns 200 status" do
        get "/api/v1/users/#{other_user.id}/photos", headers: auth_headers_for(user)
        expect(response).to have_http_status(:ok)
      end

      it "returns user's photos" do
        get "/api/v1/users/#{other_user.id}/photos", headers: auth_headers_for(user)
        expect(json_data[:photos]).to be_an(Array)
        expect(json_data[:photos].length).to eq(3)
      end

      it "returns pagination info" do
        get "/api/v1/users/#{other_user.id}/photos", headers: auth_headers_for(user)
        expect(json_data[:pagination]).to be_present
      end
    end
  end
end
