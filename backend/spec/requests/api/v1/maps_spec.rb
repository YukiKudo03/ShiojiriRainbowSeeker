# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Maps", type: :request do
  let(:user) { create(:user) }
  let(:json_headers) { { "Accept" => "application/json" } }

  # Shiojiri area bounds
  let(:valid_bounds) do
    {
      sw_lat: 36.0,
      sw_lng: 137.8,
      ne_lat: 36.2,
      ne_lng: 138.1
    }
  end

  # Helper to create photo without image
  def create_photo(attributes = {})
    photo = Photo.new({
      user: attributes[:user] || user,
      title: attributes[:title] || "Test Rainbow",
      captured_at: attributes[:captured_at] || Time.current,
      moderation_status: :approved,
      is_visible: true
    })
    photo.set_location(attributes[:lat] || 36.115, attributes[:lng] || 137.954)
    photo.save!
    photo
  end

  describe "GET /api/v1/maps/markers" do
    let!(:photos) do
      [
        create_photo(lat: 36.115, lng: 137.954, title: "Photo 1"),
        create_photo(lat: 36.12, lng: 137.96, title: "Photo 2"),
        create_photo(lat: 36.11, lng: 137.95, title: "Photo 3")
      ]
    end

    context "with valid bounds" do
      it "returns 200 status" do
        get "/api/v1/maps/markers", params: valid_bounds, headers: json_headers
        expect(response).to have_http_status(:ok)
      end

      it "returns markers array" do
        get "/api/v1/maps/markers", params: valid_bounds, headers: json_headers
        expect(json_data[:markers]).to be_an(Array)
      end

      it "includes marker details" do
        get "/api/v1/maps/markers", params: valid_bounds, headers: json_headers
        expect(json_data[:markers]).not_to be_empty
        marker = json_data[:markers].first
        expect(marker).to have_key(:id)
        expect(marker).to have_key(:latitude)
        expect(marker).to have_key(:longitude)
      end

      it "includes bounds in response" do
        get "/api/v1/maps/markers", params: valid_bounds, headers: json_headers
        expect(json_data[:bounds]).to be_present
      end
    end

    context "without required bounds" do
      it "returns 400 status" do
        get "/api/v1/maps/markers", headers: json_headers
        expect(response).to have_http_status(:bad_request)
      end

      it "returns error message" do
        get "/api/v1/maps/markers", headers: json_headers
        expect(json_error[:message]).to include("Bounding box parameters are required")
      end
    end

    context "with partial bounds" do
      it "returns 400 status when missing sw_lat" do
        get "/api/v1/maps/markers",
            params: { sw_lng: 137.8, ne_lat: 36.2, ne_lng: 138.1 },
            headers: json_headers
        expect(response).to have_http_status(:bad_request)
      end
    end

    context "with date filters" do
      it "filters by date range" do
        get "/api/v1/maps/markers",
            params: valid_bounds.merge(start_date: 1.week.ago.to_date, end_date: Date.today),
            headers: json_headers
        expect(response).to have_http_status(:ok)
      end
    end

    context "with limit parameter" do
      it "respects limit" do
        get "/api/v1/maps/markers",
            params: valid_bounds.merge(limit: 1),
            headers: json_headers
        expect(response).to have_http_status(:ok)
      end
    end
  end

  describe "GET /api/v1/maps/clusters" do
    let!(:photos) do
      # Create clustered photos
      [
        create_photo(lat: 36.115, lng: 137.954),
        create_photo(lat: 36.1151, lng: 137.9541),
        create_photo(lat: 36.1152, lng: 137.9542),
        create_photo(lat: 36.12, lng: 137.96)
      ]
    end

    context "with valid bounds" do
      it "returns 200 status" do
        get "/api/v1/maps/clusters", params: valid_bounds, headers: json_headers
        expect(response).to have_http_status(:ok)
      end

      it "returns clusters array" do
        get "/api/v1/maps/clusters", params: valid_bounds, headers: json_headers
        expect(json_data[:clusters]).to be_an(Array)
      end

      it "includes cluster count info" do
        get "/api/v1/maps/clusters", params: valid_bounds, headers: json_headers
        expect(json_data).to have_key(:totalPhotos)
        expect(json_data).to have_key(:totalClusters)
      end
    end

    context "without required bounds" do
      it "returns 400 status" do
        get "/api/v1/maps/clusters", headers: json_headers
        expect(response).to have_http_status(:bad_request)
      end
    end

    context "with custom clustering parameters" do
      it "accepts cluster_distance parameter" do
        get "/api/v1/maps/clusters",
            params: valid_bounds.merge(cluster_distance: 1000),
            headers: json_headers
        expect(response).to have_http_status(:ok)
      end

      it "accepts min_points parameter" do
        get "/api/v1/maps/clusters",
            params: valid_bounds.merge(min_points: 3),
            headers: json_headers
        expect(response).to have_http_status(:ok)
      end
    end
  end

  describe "GET /api/v1/maps/heatmap" do
    let!(:photos) do
      5.times.map do |i|
        create_photo(lat: 36.115 + (i * 0.001), lng: 137.954 + (i * 0.001))
      end
    end

    context "with valid bounds" do
      it "returns 200 status" do
        get "/api/v1/maps/heatmap", params: valid_bounds, headers: json_headers
        expect(response).to have_http_status(:ok)
      end

      it "returns heatmap points" do
        get "/api/v1/maps/heatmap", params: valid_bounds, headers: json_headers
        expect(json_data[:heatmapPoints]).to be_an(Array)
      end

      it "includes intensity information" do
        get "/api/v1/maps/heatmap", params: valid_bounds, headers: json_headers
        expect(json_data).to have_key(:maxIntensity)
        expect(json_data).to have_key(:totalPhotos)
      end
    end

    context "without required bounds" do
      it "returns 400 status" do
        get "/api/v1/maps/heatmap", headers: json_headers
        expect(response).to have_http_status(:bad_request)
      end
    end

    context "with custom grid size" do
      it "accepts grid_size parameter" do
        get "/api/v1/maps/heatmap",
            params: valid_bounds.merge(grid_size: 200),
            headers: json_headers
        expect(response).to have_http_status(:ok)
      end
    end
  end

  describe "Authentication" do
    let!(:photo) { create_photo }

    it "allows unauthenticated access to all map endpoints" do
      endpoints = [
        { path: "/api/v1/maps/markers", params: valid_bounds },
        { path: "/api/v1/maps/clusters", params: valid_bounds },
        { path: "/api/v1/maps/heatmap", params: valid_bounds }
      ]

      endpoints.each do |endpoint|
        get endpoint[:path], params: endpoint[:params], headers: json_headers
        expect(response).not_to have_http_status(:unauthorized),
          "Expected #{endpoint[:path]} to allow unauthenticated access"
      end
    end
  end
end
