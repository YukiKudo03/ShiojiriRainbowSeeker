# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Statistics", type: :request do
  let(:user) { create(:user) }
  let(:json_headers) { { "Accept" => "application/json" } }

  # Create test photos with weather data for statistics
  # Use a simpler approach that doesn't rely on complex FactoryBot traits
  let!(:daimon_photos) do
    # Photos in Daimon area (36.115, 137.954)
    photos = []
    3.times do |i|
      photo = Photo.new(
        user: user,
        title: "Test Photo #{i}",
        captured_at: i.days.ago,
        moderation_status: :approved,
        is_visible: true
      )
      # Set location before saving (required field)
      photo.set_location(36.115, 137.954)
      photo.save!
      create(:weather_condition, photo: photo, temperature: 20 + i, humidity: 60 + i)
      photos << photo
    end
    photos
  end

  describe "GET /api/v1/statistics/regions" do
    it "returns list of available regions" do
      get "/api/v1/statistics/regions", headers: json_headers
      expect(response).to have_http_status(:ok)
      expect(json_data[:regions]).to be_an(Array)
      expect(json_data[:regions].length).to eq(3)
    end

    it "includes region metadata" do
      get "/api/v1/statistics/regions", headers: json_headers
      daimon = json_data[:regions].find { |r| r[:id] == "daimon" }
      expect(daimon).to be_present
      expect(daimon[:name]).to eq("大門地区")
      expect(daimon[:center]).to include(:lat, :lng)
      expect(daimon[:radius]).to eq(3000)
    end
  end

  describe "GET /api/v1/statistics/region/:region_id" do
    context "with valid region" do
      it "returns 200 status" do
        get "/api/v1/statistics/region/daimon", headers: json_headers
        expect(response).to have_http_status(:ok)
      end

      it "returns region statistics" do
        get "/api/v1/statistics/region/daimon", headers: json_headers
        expect(json_data[:region][:id]).to eq("daimon")
        expect(json_data[:statistics]).to be_present
        expect(json_data[:statistics][:total_sightings]).to be >= 0
      end
    end

    context "with period filter" do
      it "filters by date range" do
        get "/api/v1/statistics/region/daimon",
            params: { start_date: 1.week.ago.to_date, end_date: Date.today },
            headers: json_headers
        expect(response).to have_http_status(:ok)
        expect(json_data[:period][:start_date]).to be_present
        expect(json_data[:period][:end_date]).to be_present
      end
    end

    context "with invalid region" do
      it "returns error" do
        get "/api/v1/statistics/region/invalid_region", headers: json_headers
        expect(response).to have_http_status(:unprocessable_entity)
      end
    end

    context "with custom region" do
      it "requires center and radius" do
        get "/api/v1/statistics/region/custom", headers: json_headers
        expect(response).to have_http_status(:unprocessable_entity)
      end

      it "accepts custom parameters" do
        get "/api/v1/statistics/region/custom",
            params: { lat: 36.1, lng: 137.9, radius: 5000 },
            headers: json_headers
        expect(response).to have_http_status(:ok)
        expect(json_data[:region][:name]).to eq("カスタム領域")
      end
    end
  end

  describe "GET /api/v1/statistics/trends" do
    it "returns 200 status" do
      get "/api/v1/statistics/trends", headers: json_headers
      expect(response).to have_http_status(:ok)
    end

    it "returns trend data" do
      get "/api/v1/statistics/trends", headers: json_headers
      expect(json_data[:trends]).to be_an(Array)
      expect(json_data[:summary]).to be_present
    end

    context "with grouping" do
      %w[day week month year].each do |group|
        it "accepts #{group} grouping" do
          get "/api/v1/statistics/trends", params: { group_by: group }, headers: json_headers
          expect(response).to have_http_status(:ok)
          expect(json_data[:group_by]).to eq(group)
        end
      end
    end

    context "with region filter" do
      it "filters by region" do
        get "/api/v1/statistics/trends", params: { region_id: "daimon" }, headers: json_headers
        expect(response).to have_http_status(:ok)
        expect(json_data[:region_id]).to eq("daimon")
      end
    end
  end

  describe "GET /api/v1/statistics/weather" do
    it "returns 200 status" do
      get "/api/v1/statistics/weather", headers: json_headers
      expect(response).to have_http_status(:ok)
    end

    it "returns weather correlation data" do
      get "/api/v1/statistics/weather", headers: json_headers
      expect(json_data[:correlations]).to be_present
    end

    context "with region filter" do
      it "filters by region" do
        get "/api/v1/statistics/weather", params: { region_id: "daimon" }, headers: json_headers
        expect(response).to have_http_status(:ok)
        expect(json_data[:region_id]).to eq("daimon")
      end
    end
  end

  describe "GET /api/v1/statistics/compare" do
    context "with valid regions" do
      it "returns 200 status" do
        get "/api/v1/statistics/compare",
            params: { region_ids: "daimon,shiojiri_central" },
            headers: json_headers
        expect(response).to have_http_status(:ok)
      end

      it "returns comparison data" do
        get "/api/v1/statistics/compare",
            params: { region_ids: "daimon,shiojiri_central" },
            headers: json_headers
        expect(json_data[:regions]).to be_an(Array)
        expect(json_data[:rankings]).to be_present
      end
    end

    context "without region_ids" do
      it "returns error" do
        get "/api/v1/statistics/compare", headers: json_headers
        expect(response).to have_http_status(:unprocessable_entity)
      end
    end

    context "with array parameter" do
      it "accepts array format" do
        get "/api/v1/statistics/compare",
            params: { region_ids: %w[daimon shiojiri_city] },
            headers: json_headers
        expect(response).to have_http_status(:ok)
      end
    end
  end

  describe "GET /api/v1/statistics/export" do
    it "returns 200 status" do
      get "/api/v1/statistics/export", headers: json_headers
      expect(response).to have_http_status(:ok)
    end

    it "returns export data" do
      get "/api/v1/statistics/export", headers: json_headers
      expect(json_data[:status]).to eq("complete")
      expect(json_data[:data]).to be_an(Array)
    end

    context "with export_format parameter" do
      it "accepts json format" do
        get "/api/v1/statistics/export", params: { export_format: "json" }, headers: json_headers
        expect(response).to have_http_status(:ok)
        expect(json_data[:format]).to eq("json")
      end

      it "accepts csv format" do
        get "/api/v1/statistics/export", params: { export_format: "csv" }, headers: json_headers
        expect(response).to have_http_status(:ok)
        expect(json_data[:format]).to eq("csv")
      end
    end

    context "with include_weather parameter" do
      it "includes weather data by default" do
        get "/api/v1/statistics/export", headers: json_headers
        expect(response).to have_http_status(:ok)
      end

      it "can exclude weather data" do
        get "/api/v1/statistics/export", params: { include_weather: "false" }, headers: json_headers
        expect(response).to have_http_status(:ok)
      end
    end

    context "with region filter" do
      it "filters by region" do
        get "/api/v1/statistics/export", params: { region_id: "daimon" }, headers: json_headers
        expect(response).to have_http_status(:ok)
        expect(json_data[:metadata][:region_id]).to eq("daimon")
      end
    end
  end

  describe "Authentication" do
    it "allows unauthenticated access to all endpoints" do
      endpoints = [
        "/api/v1/statistics/regions",
        "/api/v1/statistics/region/daimon",
        "/api/v1/statistics/trends",
        "/api/v1/statistics/weather",
        "/api/v1/statistics/compare?region_ids=daimon",
        "/api/v1/statistics/export"
      ]

      endpoints.each do |endpoint|
        get endpoint, headers: json_headers
        expect(response).not_to have_http_status(:unauthorized),
          "Expected #{endpoint} to allow unauthenticated access"
      end
    end
  end
end
