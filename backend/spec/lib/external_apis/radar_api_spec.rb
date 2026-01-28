# frozen_string_literal: true

require "rails_helper"
require "active_support/all"
require "faraday"
require "webmock/rspec"
require_relative "../../../lib/external_apis/radar_api"

RSpec.describe ExternalApis::RadarApi do
  let(:api) { described_class.new }
  let(:lat) { 36.115 } # Shiojiri, Nagano
  let(:lng) { 137.954 }

  # Common URL patterns
  let(:maps_url_pattern) { %r{api\.rainviewer\.com/public/weather-maps\.json} }

  # Sample RainViewer API response
  let(:weather_maps_response) do
    {
      "version" => "2.0",
      "generated" => 1705900800,
      "host" => "https://tilecache.rainviewer.com",
      "radar" => {
        "past" => [
          { "time" => 1705899600, "path" => "/v2/radar/1705899600" },
          { "time" => 1705900200, "path" => "/v2/radar/1705900200" },
          { "time" => 1705900800, "path" => "/v2/radar/1705900800" }
        ],
        "nowcast" => [
          { "time" => 1705901400, "path" => "/v2/radar/1705901400" },
          { "time" => 1705902000, "path" => "/v2/radar/1705902000" }
        ]
      },
      "satellite" => {
        "infrared" => [
          { "time" => 1705899600, "path" => "/v2/satellite/1705899600" },
          { "time" => 1705900800, "path" => "/v2/satellite/1705900800" }
        ]
      }
    }
  end

  describe "#initialize" do
    it "creates an instance with default timeout" do
      expect(api).to be_a(described_class)
    end

    it "accepts custom timeout" do
      api_with_timeout = described_class.new(timeout: 5)
      expect(api_with_timeout).to be_a(described_class)
    end
  end

  describe "#available_timestamps" do
    context "with successful response" do
      before do
        stub_request(:get, maps_url_pattern)
          .to_return(
            status: 200,
            body: weather_maps_response.to_json,
            headers: { "Content-Type" => "application/json" }
          )
      end

      it "returns parsed timestamp data" do
        result = api.available_timestamps

        expect(result).to be_a(Hash)
        expect(result[:generated]).to be_a(Time)
        expect(result[:host]).to eq("https://tilecache.rainviewer.com")
      end

      it "includes radar past timestamps" do
        result = api.available_timestamps

        expect(result[:radar][:past]).to be_an(Array)
        expect(result[:radar][:past].length).to eq(3)
        expect(result[:radar][:past].first).to eq(1705899600)
      end

      it "includes radar nowcast timestamps" do
        result = api.available_timestamps

        expect(result[:radar][:nowcast]).to be_an(Array)
        expect(result[:radar][:nowcast].length).to eq(2)
      end

      it "includes satellite timestamps" do
        result = api.available_timestamps

        expect(result[:satellite][:infrared]).to be_an(Array)
        expect(result[:satellite][:infrared].length).to eq(2)
      end
    end

    context "with server error" do
      before do
        stub_request(:get, maps_url_pattern)
          .to_return(status: 500)
      end

      it "raises ApiError" do
        expect {
          api.available_timestamps
        }.to raise_error(ExternalApis::RadarApi::ApiError, /Server error/)
      end
    end

    context "with timeout" do
      before do
        stub_request(:get, maps_url_pattern)
          .to_timeout
      end

      it "raises Faraday error" do
        expect {
          api.available_timestamps
        }.to raise_error(Faraday::Error)
      end
    end
  end

  describe "#get_radar_data" do
    before do
      stub_request(:get, maps_url_pattern)
        .to_return(
          status: 200,
          body: weather_maps_response.to_json,
          headers: { "Content-Type" => "application/json" }
        )
    end

    context "without timestamp (latest)" do
      it "returns radar data for latest timestamp" do
        result = api.get_radar_data(lat: lat, lng: lng)

        expect(result).to be_a(Hash)
        expect(result[:timestamp]).to eq(Time.at(1705900800).utc)
        expect(result[:location][:lat]).to eq(lat)
        expect(result[:location][:lng]).to eq(lng)
      end

      it "includes tile URL" do
        result = api.get_radar_data(lat: lat, lng: lng)

        expect(result[:tile_url]).to be_a(String)
        expect(result[:tile_url]).to include("tilecache.rainviewer.com")
        expect(result[:tile_url]).to include("1705900800")
      end

      it "includes tile coordinates" do
        result = api.get_radar_data(lat: lat, lng: lng)

        expect(result[:tile_coords]).to be_a(Hash)
        expect(result[:tile_coords]).to include(:x, :y, :z)
      end

      it "indicates nowcast availability" do
        result = api.get_radar_data(lat: lat, lng: lng)

        expect(result[:nowcast_available]).to be true
        expect(result[:nowcast_timestamps]).to be_an(Array)
        expect(result[:nowcast_timestamps].first).to be_a(Time)
      end
    end

    context "with specific timestamp" do
      let(:target_time) { Time.at(1705899600) }

      it "finds closest available timestamp" do
        result = api.get_radar_data(lat: lat, lng: lng, timestamp: target_time)

        expect(result[:timestamp]).to eq(Time.at(1705899600).utc)
      end

      it "accepts Unix timestamp" do
        result = api.get_radar_data(lat: lat, lng: lng, timestamp: 1705899600)

        expect(result[:timestamp]).to eq(Time.at(1705899600).utc)
      end
    end

    context "with custom zoom level" do
      it "uses specified zoom level" do
        result = api.get_radar_data(lat: lat, lng: lng, zoom: 12)

        expect(result[:zoom]).to eq(12)
        expect(result[:tile_coords][:z]).to eq(12)
      end
    end
  end

  describe "#get_precipitation_timeline" do
    before do
      stub_request(:get, maps_url_pattern)
        .to_return(
          status: 200,
          body: weather_maps_response.to_json,
          headers: { "Content-Type" => "application/json" }
        )
    end

    it "returns timeline of precipitation data" do
      result = api.get_precipitation_timeline(lat: lat, lng: lng, count: 3)

      expect(result).to be_an(Array)
      expect(result.length).to eq(3)
    end

    it "includes timestamp for each entry" do
      result = api.get_precipitation_timeline(lat: lat, lng: lng, count: 3)

      result.each do |entry|
        expect(entry[:timestamp]).to be_a(Time)
        expect(entry[:tile_url]).to be_a(String)
        expect(entry[:tile_coords]).to be_a(Hash)
      end
    end

    it "returns entries in chronological order" do
      result = api.get_precipitation_timeline(lat: lat, lng: lng, count: 3)

      timestamps = result.map { |e| e[:timestamp] }
      expect(timestamps).to eq(timestamps.sort)
    end
  end

  describe "#get_nowcast" do
    before do
      stub_request(:get, maps_url_pattern)
        .to_return(
          status: 200,
          body: weather_maps_response.to_json,
          headers: { "Content-Type" => "application/json" }
        )
    end

    it "returns forecast data" do
      result = api.get_nowcast(lat: lat, lng: lng)

      expect(result).to be_an(Array)
      expect(result.length).to eq(2)
    end

    it "marks entries as forecast" do
      result = api.get_nowcast(lat: lat, lng: lng)

      result.each do |entry|
        expect(entry[:is_forecast]).to be true
      end
    end

    context "when no nowcast available" do
      let(:weather_maps_no_nowcast) do
        response = weather_maps_response.deep_dup
        response["radar"]["nowcast"] = []
        response
      end

      before do
        stub_request(:get, maps_url_pattern)
          .to_return(
            status: 200,
            body: weather_maps_no_nowcast.to_json,
            headers: { "Content-Type" => "application/json" }
          )
      end

      it "returns empty array" do
        result = api.get_nowcast(lat: lat, lng: lng)

        expect(result).to eq([])
      end
    end
  end

  describe "#estimate_movement" do
    it "returns movement estimation placeholder" do
      result = api.estimate_movement(lat: lat, lng: lng)

      expect(result).to be_a(Hash)
      expect(result[:estimated]).to be false
      expect(result[:note]).to include("not implemented")
    end
  end

  describe ".classify_intensity" do
    it "classifies no precipitation" do
      result = described_class.classify_intensity(10)

      expect(result[:level]).to eq(:none)
      expect(result[:mm_h]).to eq(0.0)
    end

    it "classifies light precipitation" do
      result = described_class.classify_intensity(20)

      expect(result[:level]).to eq(:light)
      expect(result[:mm_h]).to eq(0.5)
    end

    it "classifies moderate precipitation" do
      result = described_class.classify_intensity(30)

      expect(result[:level]).to eq(:moderate)
    end

    it "classifies heavy precipitation" do
      result = described_class.classify_intensity(40)

      expect(result[:level]).to eq(:heavy)
    end

    it "classifies very heavy precipitation" do
      result = described_class.classify_intensity(50)

      expect(result[:level]).to eq(:very_heavy)
    end

    it "classifies extreme precipitation" do
      result = described_class.classify_intensity(60)

      expect(result[:level]).to eq(:extreme)
    end
  end

  describe "tile coordinate calculation" do
    before do
      stub_request(:get, maps_url_pattern)
        .to_return(
          status: 200,
          body: weather_maps_response.to_json,
          headers: { "Content-Type" => "application/json" }
        )
    end

    it "calculates correct tile coordinates for Shiojiri" do
      result = api.get_radar_data(lat: lat, lng: lng, zoom: 10)

      # Expected tile coordinates for Shiojiri at zoom 10
      # lat: 36.115, lng: 137.954
      # x should be around 902-903, y should be around 404-405
      expect(result[:tile_coords][:x]).to be_between(900, 910)
      expect(result[:tile_coords][:y]).to be_between(400, 410)
      expect(result[:tile_coords][:z]).to eq(10)
    end

    it "calculates correct tile coordinates for Tokyo" do
      result = api.get_radar_data(lat: 35.6762, lng: 139.6503, zoom: 10)

      # Expected tile coordinates for Tokyo at zoom 10
      expect(result[:tile_coords][:x]).to be_between(905, 915)
      expect(result[:tile_coords][:y]).to be_between(400, 410)
    end
  end

  describe "URL generation" do
    before do
      stub_request(:get, maps_url_pattern)
        .to_return(
          status: 200,
          body: weather_maps_response.to_json,
          headers: { "Content-Type" => "application/json" }
        )
    end

    it "generates valid tile URL format" do
      result = api.get_radar_data(lat: lat, lng: lng, zoom: 10)

      url = result[:tile_url]

      expect(url).to match(%r{https://tilecache\.rainviewer\.com/v2/radar/\d+/256/10/\d+/\d+/\d/\d_\d\.png})
    end

    it "includes timestamp in URL" do
      result = api.get_radar_data(lat: lat, lng: lng)

      expect(result[:tile_url]).to include("1705900800")
    end

    it "includes zoom level in URL" do
      result = api.get_radar_data(lat: lat, lng: lng, zoom: 12)

      expect(result[:tile_url]).to include("/12/")
    end
  end
end
