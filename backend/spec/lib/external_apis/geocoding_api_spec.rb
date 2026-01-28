# frozen_string_literal: true

require "rails_helper"
require "webmock/rspec"

RSpec.describe ExternalApis::GeocodingApi do
  let(:api_key) { "test_mapbox_token" }
  let(:api) { described_class.new(api_key: api_key) }
  let(:lat) { 36.115 }
  let(:lng) { 137.954 }

  # Use memory store for cache tests
  around do |example|
    original_cache = Rails.cache
    Rails.cache = ActiveSupport::Cache::MemoryStore.new
    example.run
    Rails.cache = original_cache
  end

  # Common URL patterns - Mapbox Geocoding API v5
  # Note: The actual URL structure is api.mapbox.com/geocoding/v5/mapbox.places/{query}.json
  let(:reverse_geocode_url) { "https://api.mapbox.com/geocoding/v5/mapbox.places/#{lng},#{lat}.json" }
  let(:reverse_geocode_url_pattern) { %r{api\.mapbox\.com/geocoding/v5/mapbox\.places/\d+\.\d+,\d+\.\d+\.json} }
  let(:forward_geocode_url_pattern) { %r{api\.mapbox\.com/geocoding/v5/mapbox\.places/.+\.json} }

  describe "#initialize" do
    context "with valid API key" do
      it "creates an instance" do
        expect(api).to be_a(described_class)
      end
    end

    context "with API key from environment" do
      before do
        allow(ENV).to receive(:fetch).with("MAPBOX_ACCESS_TOKEN", nil).and_return("env_token")
      end

      it "uses the environment variable" do
        api = described_class.new
        expect(api).to be_a(described_class)
      end
    end

    context "without API key" do
      before do
        allow(ENV).to receive(:fetch).with("MAPBOX_ACCESS_TOKEN", nil).and_return(nil)
      end

      it "raises ConfigurationError" do
        expect {
          described_class.new
        }.to raise_error(ExternalApis::GeocodingApi::ConfigurationError, /access token is required/)
      end
    end
  end

  describe "#reverse_geocode" do
    let(:reverse_geocode_response) do
      {
        "type" => "FeatureCollection",
        "features" => [
          {
            "id" => "place.12345",
            "type" => "Feature",
            "place_type" => [ "place" ],
            "relevance" => 1,
            "text" => "塩尻市",
            "place_name" => "塩尻市, 長野県, 日本",
            "center" => [ 137.954, 36.115 ],
            "context" => [
              {
                "id" => "region.67890",
                "text" => "長野県",
                "short_code" => "JP-20"
              },
              {
                "id" => "country.11111",
                "text" => "日本",
                "short_code" => "jp"
              }
            ],
            "properties" => {}
          }
        ],
        "attribution" => "© Mapbox"
      }
    end

    let(:empty_response) do
      {
        "type" => "FeatureCollection",
        "features" => [],
        "attribution" => "© Mapbox"
      }
    end

    context "with successful response" do
      before do
        stub_request(:get, reverse_geocode_url_pattern)
          .to_return(
            status: 200,
            body: reverse_geocode_response.to_json,
            headers: { "Content-Type" => "application/json" }
          )
      end

      it "returns parsed geocoding data" do
        result = api.reverse_geocode(lat: lat, lng: lng)

        expect(result).to be_a(Hash)
        expect(result[:success]).to be true
        expect(result[:place_name]).to eq("塩尻市, 長野県, 日本")
      end

      it "includes address components" do
        result = api.reverse_geocode(lat: lat, lng: lng)

        expect(result[:components]).to be_a(Hash)
        expect(result[:components][:place]).to eq("塩尻市")
        expect(result[:components][:region]).to eq("長野県")
        expect(result[:components][:country]).to eq("日本")
      end

      it "includes coordinates" do
        result = api.reverse_geocode(lat: lat, lng: lng)

        expect(result[:coordinates][:lat]).to eq(lat)
        expect(result[:coordinates][:lng]).to eq(lng)
      end

      it "includes short address" do
        result = api.reverse_geocode(lat: lat, lng: lng)

        expect(result[:short_address]).to be_present
      end

      it "includes formatted address" do
        result = api.reverse_geocode(lat: lat, lng: lng)

        expect(result[:formatted_address]).to be_present
      end

      it "includes feature type" do
        result = api.reverse_geocode(lat: lat, lng: lng)

        expect(result[:feature_type]).to eq("place")
      end

      it "includes relevance score" do
        result = api.reverse_geocode(lat: lat, lng: lng)

        expect(result[:relevance]).to eq(1)
      end
    end

    context "with cached result" do
      let(:cached_data) do
        {
          success: true,
          place_name: "Cached Place",
          components: { place: "Cached" }
        }
      end

      it "returns cached data without making API call" do
        # Pre-populate the cache
        cache_key = api.send(:build_cache_key, lat, lng, nil)
        Rails.cache.write(cache_key, cached_data)

        result = api.reverse_geocode(lat: lat, lng: lng)

        expect(result[:place_name]).to eq("Cached Place")
        expect(WebMock).not_to have_requested(:get, reverse_geocode_url_pattern)
      end
    end

    context "with empty response" do
      before do
        stub_request(:get, reverse_geocode_url_pattern)
          .to_return(
            status: 200,
            body: empty_response.to_json,
            headers: { "Content-Type" => "application/json" }
          )
      end

      it "returns error result" do
        result = api.reverse_geocode(lat: lat, lng: lng)

        expect(result[:success]).to be false
        expect(result[:place_name]).to be_nil
        expect(result[:error]).to include("No results")
      end
    end

    context "with API error" do
      context "with 401 Unauthorized" do
        before do
          stub_request(:get, reverse_geocode_url_pattern)
            .to_return(status: 401, body: "Unauthorized")
        end

        it "raises ApiError" do
          expect {
            api.reverse_geocode(lat: lat, lng: lng)
          }.to raise_error(ExternalApis::GeocodingApi::ApiError, /Invalid API key/)
        end
      end

      context "with 429 Rate Limit" do
        before do
          stub_request(:get, reverse_geocode_url_pattern)
            .to_return(status: 429, body: "Rate limit exceeded")
        end

        it "raises RateLimitError" do
          expect {
            api.reverse_geocode(lat: lat, lng: lng)
          }.to raise_error(ExternalApis::GeocodingApi::RateLimitError)
        end
      end

      context "with 500 Server Error" do
        before do
          stub_request(:get, reverse_geocode_url_pattern)
            .to_return(status: 500, body: "Internal Server Error")
        end

        it "raises ApiError" do
          expect {
            api.reverse_geocode(lat: lat, lng: lng)
          }.to raise_error(ExternalApis::GeocodingApi::ApiError, /Server error/)
        end
      end
    end

    context "with types filter" do
      before do
        stub_request(:get, reverse_geocode_url_pattern)
          .with(query: hash_including("types" => "place,locality"))
          .to_return(
            status: 200,
            body: reverse_geocode_response.to_json,
            headers: { "Content-Type" => "application/json" }
          )
      end

      it "includes types parameter in request" do
        api.reverse_geocode(lat: lat, lng: lng, types: [ "place", "locality" ])

        expect(WebMock).to have_requested(:get, reverse_geocode_url_pattern)
          .with(query: hash_including("types" => "place,locality"))
      end
    end
  end

  describe "#forward_geocode" do
    let(:forward_geocode_response) do
      {
        "type" => "FeatureCollection",
        "features" => [
          {
            "id" => "place.12345",
            "type" => "Feature",
            "place_type" => [ "place" ],
            "relevance" => 0.95,
            "text" => "塩尻市",
            "place_name" => "塩尻市, 長野県, 日本",
            "center" => [ 137.954, 36.115 ]
          }
        ],
        "attribution" => "© Mapbox"
      }
    end

    context "with successful response" do
      before do
        stub_request(:get, forward_geocode_url_pattern)
          .to_return(
            status: 200,
            body: forward_geocode_response.to_json,
            headers: { "Content-Type" => "application/json" }
          )
      end

      it "returns parsed coordinates" do
        result = api.forward_geocode(query: "塩尻市")

        expect(result[:success]).to be true
        expect(result[:coordinates][:lat]).to eq(36.115)
        expect(result[:coordinates][:lng]).to eq(137.954)
      end

      it "includes place name" do
        result = api.forward_geocode(query: "塩尻市")

        expect(result[:place_name]).to eq("塩尻市, 長野県, 日本")
      end

      it "includes relevance score" do
        result = api.forward_geocode(query: "塩尻市")

        expect(result[:relevance]).to eq(0.95)
      end
    end

    context "with empty response" do
      before do
        stub_request(:get, forward_geocode_url_pattern)
          .to_return(
            status: 200,
            body: { "type" => "FeatureCollection", "features" => [] }.to_json,
            headers: { "Content-Type" => "application/json" }
          )
      end

      it "returns error result" do
        result = api.forward_geocode(query: "存在しない場所")

        expect(result[:success]).to be false
        expect(result[:coordinates]).to be_nil
      end
    end
  end

  describe "caching behavior" do
    before do
      stub_request(:get, reverse_geocode_url_pattern)
        .to_return(
          status: 200,
          body: {
            "type" => "FeatureCollection",
            "features" => [ {
              "id" => "place.1",
              "place_type" => [ "place" ],
              "text" => "Test",
              "place_name" => "Test Place",
              "center" => [ lng, lat ],
              "context" => [],
              "relevance" => 1
            } ]
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )
    end

    it "caches successful results" do
      api.reverse_geocode(lat: lat, lng: lng)

      # Verify the result is cached
      cache_key = api.send(:build_cache_key, lat, lng, nil)
      cached_data = Rails.cache.read(cache_key)
      expect(cached_data[:success]).to be true
    end

    it "uses coordinate rounding for cache key consistency" do
      # First call
      api.reverse_geocode(lat: 36.11501, lng: 137.95401)

      # Second call with slightly different coordinates should hit same cache
      api.reverse_geocode(lat: 36.11502, lng: 137.95402)

      # Should only make one API request due to cache
      expect(WebMock).to have_requested(:get, /api\.mapbox\.com/).once
    end
  end

  describe "detailed response parsing" do
    let(:detailed_response) do
      {
        "type" => "FeatureCollection",
        "features" => [
          {
            "id" => "neighborhood.123",
            "type" => "Feature",
            "place_type" => [ "neighborhood" ],
            "relevance" => 1,
            "text" => "大門",
            "place_name" => "大門, 塩尻市, 長野県, 日本",
            "center" => [ 137.954, 36.115 ],
            "context" => [
              {
                "id" => "locality.456",
                "text" => "大門"
              },
              {
                "id" => "place.789",
                "text" => "塩尻市"
              },
              {
                "id" => "region.012",
                "text" => "長野県",
                "short_code" => "JP-20"
              },
              {
                "id" => "country.345",
                "text" => "日本",
                "short_code" => "jp"
              }
            ],
            "properties" => {
              "postcode" => "399-0703"
            }
          }
        ]
      }
    end

    before do
      stub_request(:get, reverse_geocode_url_pattern)
        .to_return(
          status: 200,
          body: detailed_response.to_json,
          headers: { "Content-Type" => "application/json" }
        )
    end

    it "parses all address components" do
      result = api.reverse_geocode(lat: lat, lng: lng)

      expect(result[:components][:neighborhood]).to eq("大門")
      expect(result[:components][:locality]).to eq("大門")
      expect(result[:components][:place]).to eq("塩尻市")
      expect(result[:components][:region]).to eq("長野県")
      expect(result[:components][:country]).to eq("日本")
    end

    it "extracts short codes" do
      result = api.reverse_geocode(lat: lat, lng: lng)

      expect(result[:components][:region_code]).to eq("JP-20")
      expect(result[:components][:country_code]).to eq("jp")
    end

    it "builds short address correctly" do
      result = api.reverse_geocode(lat: lat, lng: lng)

      # Short address should include place and locality/neighborhood
      expect(result[:short_address]).to include("塩尻市")
    end

    it "builds formatted address correctly" do
      result = api.reverse_geocode(lat: lat, lng: lng)

      expect(result[:formatted_address]).to include("日本")
      expect(result[:formatted_address]).to include("長野県")
      expect(result[:formatted_address]).to include("塩尻市")
    end
  end
end
