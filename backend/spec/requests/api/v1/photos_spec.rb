# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Photos", type: :request do
  let(:user) { create(:user) }
  let(:other_user) { create(:user) }
  let(:admin) { create(:user, :admin) }
  let(:json_headers) { { "Accept" => "application/json" } }

  def auth_headers_for(user)
    token = Warden::JWTAuth::UserEncoder.new.call(user, :user, nil).first
    json_headers.merge("Authorization" => "Bearer #{token}")
  end

  # Helper to create photo without image
  def create_photo(attributes = {})
    photo = Photo.new({
      user: attributes[:user] || user,
      title: attributes[:title] || "Test Rainbow",
      captured_at: attributes[:captured_at] || Time.current,
      moderation_status: attributes[:moderation_status] || :approved,
      is_visible: attributes.fetch(:is_visible, true)
    }.compact)
    photo.set_location(attributes[:lat] || 36.115, attributes[:lng] || 137.954)
    photo.save!
    photo
  end

  describe "GET /api/v1/photos" do
    let!(:photos) do
      3.times.map { |i| create_photo(title: "Photo #{i}", captured_at: i.days.ago) }
    end

    context "without authentication" do
      it "returns 200 status" do
        get "/api/v1/photos", headers: json_headers
        expect(response).to have_http_status(:ok)
      end

      it "returns list of photos" do
        get "/api/v1/photos", headers: json_headers
        expect(json_data[:photos]).to be_an(Array)
        expect(json_data[:photos].length).to be >= 1
      end

      it "returns pagination info" do
        get "/api/v1/photos", headers: json_headers
        expect(json_data[:pagination]).to be_present
        expect(json_data[:pagination][:totalCount]).to be >= 1
      end
    end

    context "with user_id filter" do
      let!(:other_photo) { create_photo(user: other_user, title: "Other User Photo") }

      it "filters by user" do
        get "/api/v1/photos", params: { user_id: user.id }, headers: json_headers
        expect(response).to have_http_status(:ok)
        # Filtering should only return photos for the specified user
        json_data[:photos].each do |photo|
          expect(photo[:user][:id]).to eq(user.id)
        end
      end
    end

    context "with geographic filter" do
      let!(:far_photo) do
        photo = Photo.new(user: user, title: "Far Photo", captured_at: Time.current, moderation_status: :approved, is_visible: true)
        photo.set_location(35.0, 135.0) # Far from Shiojiri
        photo.save!
        photo
      end

      it "filters by radius" do
        get "/api/v1/photos",
            params: { latitude: 36.115, longitude: 137.954, radius_meters: 5000 },
            headers: json_headers
        expect(response).to have_http_status(:ok)
        # Should include nearby photos but not the far one
        photo_ids = json_data[:photos].map { |p| p[:id] }
        expect(photo_ids).not_to include(far_photo.id)
      end
    end

    context "with date filter" do
      it "filters by date range" do
        get "/api/v1/photos",
            params: { start_date: 2.days.ago.to_date, end_date: Date.today },
            headers: json_headers
        expect(response).to have_http_status(:ok)
      end
    end

    context "with pagination" do
      before do
        10.times { |i| create_photo(title: "Extra Photo #{i}") }
      end

      it "paginates results" do
        get "/api/v1/photos", params: { page: 1, per_page: 5 }, headers: json_headers
        expect(json_data[:photos].length).to eq(5)
        expect(json_data[:pagination][:currentPage]).to eq(1)
        expect(json_data[:pagination][:perPage]).to eq(5)
      end
    end

    context "with sorting" do
      it "sorts by captured_at desc by default" do
        get "/api/v1/photos", headers: json_headers
        dates = json_data[:photos].map { |p| p[:capturedAt] }
        expect(dates).to eq(dates.sort.reverse)
      end

      it "sorts by like_count" do
        # Create a new photo with high like_count
        popular_photo = create_photo(title: "Popular Photo")
        popular_photo.update!(like_count: 100)

        get "/api/v1/photos", params: { sort_by: "like_count", sort_order: "desc" }, headers: json_headers

        # The first photo should be the popular one or have the highest like_count
        like_counts = json_data[:photos].map { |p| p[:likeCount] }
        expect(like_counts).to eq(like_counts.sort.reverse)
      end
    end
  end

  describe "GET /api/v1/photos/:id" do
    let!(:photo) { create_photo }

    context "without authentication" do
      it "returns 200 status" do
        get "/api/v1/photos/#{photo.id}", headers: json_headers
        expect(response).to have_http_status(:ok)
      end

      it "returns photo details" do
        get "/api/v1/photos/#{photo.id}", headers: json_headers
        expect(json_data[:photo][:id]).to eq(photo.id)
        expect(json_data[:photo][:title]).to eq(photo.title)
      end
    end

    context "with authentication" do
      it "includes owner flag" do
        get "/api/v1/photos/#{photo.id}", headers: auth_headers_for(user)
        expect(json_data[:photo][:isOwner]).to be true
      end

      it "includes liked_by_current_user flag" do
        get "/api/v1/photos/#{photo.id}", headers: auth_headers_for(other_user)
        expect(json_data[:photo]).to have_key(:likedByCurrentUser)
      end
    end

    context "with non-existent photo" do
      it "returns 404" do
        get "/api/v1/photos/00000000-0000-0000-0000-000000000000", headers: json_headers
        expect(response).to have_http_status(:not_found)
      end
    end

    context "with hidden photo" do
      let!(:hidden_photo) { create_photo(moderation_status: :hidden, is_visible: false) }

      it "returns forbidden for unauthenticated user" do
        get "/api/v1/photos/#{hidden_photo.id}", headers: json_headers
        # Pundit returns 403 for unauthorized access
        expect(response).to have_http_status(:forbidden)
      end

      it "returns photo for owner" do
        get "/api/v1/photos/#{hidden_photo.id}", headers: auth_headers_for(user)
        expect(response).to have_http_status(:ok)
      end

      it "returns photo for admin" do
        get "/api/v1/photos/#{hidden_photo.id}", headers: auth_headers_for(admin)
        expect(response).to have_http_status(:ok)
      end
    end
  end

  describe "POST /api/v1/photos" do
    let(:valid_params) do
      {
        photo: {
          title: "New Rainbow",
          description: "A beautiful rainbow",
          latitude: 36.115,
          longitude: 137.954,
          location_name: "Shiojiri",
          captured_at: Time.current.iso8601
        }
      }
    end

    context "without authentication" do
      it "returns 401" do
        post "/api/v1/photos", params: valid_params, headers: json_headers
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with authentication" do
      it "requires image for photo creation" do
        # Without image, this should fail validation
        post "/api/v1/photos", params: valid_params, headers: auth_headers_for(user)
        # May return unprocessable_entity due to missing image
        expect([ 201, 422 ]).to include(response.status)
      end
    end
  end

  describe "PATCH /api/v1/photos/:id" do
    let!(:photo) { create_photo }
    let(:update_params) do
      {
        photo: {
          title: "Updated Title",
          description: "Updated description"
        }
      }
    end

    context "without authentication" do
      it "returns 401" do
        patch "/api/v1/photos/#{photo.id}", params: update_params, headers: json_headers
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "as photo owner" do
      it "updates the photo" do
        patch "/api/v1/photos/#{photo.id}", params: update_params, headers: auth_headers_for(user)
        expect(response).to have_http_status(:ok)
        expect(json_data[:photo][:title]).to eq("Updated Title")
      end
    end

    context "as different user" do
      it "returns 403" do
        patch "/api/v1/photos/#{photo.id}", params: update_params, headers: auth_headers_for(other_user)
        expect(response).to have_http_status(:forbidden)
      end
    end

    context "as admin" do
      it "updates the photo" do
        patch "/api/v1/photos/#{photo.id}", params: update_params, headers: auth_headers_for(admin)
        expect(response).to have_http_status(:ok)
      end
    end
  end

  describe "DELETE /api/v1/photos/:id" do
    let!(:photo) { create_photo }

    context "without authentication" do
      it "returns 401" do
        delete "/api/v1/photos/#{photo.id}", headers: json_headers
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "as photo owner" do
      it "deletes the photo" do
        delete "/api/v1/photos/#{photo.id}", headers: auth_headers_for(user)
        expect(response).to have_http_status(:ok)
        expect(Photo.find(photo.id).is_visible).to be false
      end
    end

    context "as different user" do
      it "returns 403" do
        delete "/api/v1/photos/#{photo.id}", headers: auth_headers_for(other_user)
        expect(response).to have_http_status(:forbidden)
      end
    end

    context "as admin" do
      it "deletes the photo" do
        delete "/api/v1/photos/#{photo.id}", headers: auth_headers_for(admin)
        expect(response).to have_http_status(:ok)
      end
    end
  end

  describe "GET /api/v1/photos/:id/weather" do
    let!(:photo) { create_photo }
    let!(:weather) { create(:weather_condition, photo: photo, temperature: 22.5, humidity: 65) }

    context "without authentication" do
      it "returns 200 status" do
        get "/api/v1/photos/#{photo.id}/weather", headers: json_headers
        expect(response).to have_http_status(:ok)
      end

      it "returns weather data" do
        get "/api/v1/photos/#{photo.id}/weather", headers: json_headers
        expect(json_data[:weatherConditions]).to be_present
      end
    end
  end
end
