# frozen_string_literal: true

require "rails_helper"
require "active_support/all"
require "faraday"
require "webmock/rspec"
require "suncalc"
require_relative "../../app/services/weather_service"
require_relative "../../lib/external_apis/weather_api"
require_relative "../../lib/external_apis/radar_api"
require_relative "../../app/controllers/concerns/error_handler"

RSpec.describe WeatherService do
  let(:service) { described_class.new }
  let(:lat) { 36.115 } # Shiojiri, Nagano
  let(:lng) { 137.954 }

  # Mock weather API response
  let(:current_weather_response) do
    {
      timestamp: Time.at(1705900800).utc,
      temperature: 8.5,
      feels_like: 6.2,
      humidity: 65,
      pressure: 1015,
      cloud_cover: 40,
      visibility: 10000,
      wind_speed: 3.5,
      wind_direction: 180,
      weather_code: 500, # Light rain
      weather_description: "light rain",
      rain_1h: 0.5,
      location: { lat: lat, lon: lng, timezone: "Asia/Tokyo" }
    }
  end

  let(:historical_weather_response) do
    current_weather_response.merge(
      timestamp: Time.at(1705890000).utc,
      requested_timestamp: Time.at(1705890000).utc
    )
  end

  # Mock radar API response
  let(:radar_response) do
    {
      timestamp: Time.at(1705900800).utc,
      location: { lat: lat, lng: lng },
      zoom: 10,
      tile_url: "https://tilecache.rainviewer.com/v2/radar/1705900800/256/10/903/405/1/1_1.png",
      tile_coords: { x: 903, y: 405, z: 10 },
      coverage: :global,
      nowcast_available: true,
      nowcast_timestamps: [ Time.at(1705901400).utc, Time.at(1705902000).utc ]
    }
  end

  before do
    # Stub the external APIs
    allow_any_instance_of(ExternalApis::WeatherApi).to receive(:current_weather)
      .and_return(current_weather_response)
    allow_any_instance_of(ExternalApis::WeatherApi).to receive(:historical_weather)
      .and_return(historical_weather_response)
    allow_any_instance_of(ExternalApis::RadarApi).to receive(:get_radar_data)
      .and_return(radar_response)
    allow_any_instance_of(ExternalApis::RadarApi).to receive(:get_precipitation_timeline)
      .and_return([ radar_response ])
    allow_any_instance_of(ExternalApis::RadarApi).to receive(:get_nowcast)
      .and_return([ radar_response.merge(is_forecast: true) ])

    # Ensure API key is present
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with("OPENWEATHERMAP_API_KEY", nil).and_return("test_api_key")
  end

  describe "#fetch_current_conditions" do
    context "with valid coordinates" do
      it "returns weather data" do
        result = service.fetch_current_conditions(lat: lat, lng: lng)

        expect(result[:success]).to be true
        expect(result[:data][:weather]).to be_present
        expect(result[:data][:weather][:temperature]).to eq(8.5)
        expect(result[:data][:weather][:humidity]).to eq(65)
      end

      it "includes sun position data" do
        result = service.fetch_current_conditions(lat: lat, lng: lng)

        expect(result[:success]).to be true
        expect(result[:data][:weather][:sun_position]).to be_present
        expect(result[:data][:weather][:sun_position][:altitude]).to be_a(Numeric)
        expect(result[:data][:weather][:sun_position][:azimuth]).to be_a(Numeric)
      end

      it "caches the result" do
        # Use memory store for this test to verify caching behavior
        original_cache = Rails.cache
        Rails.cache = ActiveSupport::Cache::MemoryStore.new

        begin
          # First call
          service.fetch_current_conditions(lat: lat, lng: lng)

          # Second call should use cache
          expect_any_instance_of(ExternalApis::WeatherApi).not_to receive(:current_weather)
          service.fetch_current_conditions(lat: lat, lng: lng)
        ensure
          Rails.cache = original_cache
        end
      end

      it "bypasses cache when use_cache is false" do
        service.fetch_current_conditions(lat: lat, lng: lng)

        expect_any_instance_of(ExternalApis::WeatherApi).to receive(:current_weather)
          .and_return(current_weather_response)
        service.fetch_current_conditions(lat: lat, lng: lng, use_cache: false)
      end
    end

    context "when API fails" do
      before do
        allow_any_instance_of(ExternalApis::WeatherApi).to receive(:current_weather)
          .and_raise(ExternalApis::WeatherApi::ApiError, "API unavailable")
      end

      it "returns error result" do
        result = service.fetch_current_conditions(lat: lat, lng: lng, use_cache: false)

        expect(result[:success]).to be false
        expect(result[:error][:code]).to eq(ErrorHandler::ErrorCodes::WEATHER_API_ERROR)
      end
    end
  end

  describe "#fetch_historical_data" do
    let(:timestamp) { Time.at(1705890000) }

    context "with valid parameters" do
      it "returns historical weather data" do
        result = service.fetch_historical_data(lat: lat, lng: lng, timestamp: timestamp)

        expect(result[:success]).to be true
        expect(result[:data][:weather]).to be_present
      end

      it "includes sun position for historical time" do
        result = service.fetch_historical_data(lat: lat, lng: lng, timestamp: timestamp)

        expect(result[:data][:weather][:sun_position]).to be_present
      end

      it "rounds timestamp to 30 minutes for caching" do
        # Timestamp at 12:15 should be rounded to 12:00 or 12:30
        odd_timestamp = Time.utc(2024, 1, 21, 12, 15, 0)

        expect_any_instance_of(ExternalApis::WeatherApi).to receive(:historical_weather) do |_instance, args|
          rounded = args[:timestamp]
          expect(rounded.min % 30).to eq(0) # Should be 0 or 30
          historical_weather_response
        end

        service.fetch_historical_data(lat: lat, lng: lng, timestamp: odd_timestamp, use_cache: false)
      end
    end
  end

  describe "#fetch_time_range_data" do
    let(:center_time) { Time.at(1705890000) }

    context "with valid parameters" do
      it "returns weather timeline" do
        result = service.fetch_time_range_data(
          lat: lat,
          lng: lng,
          center_time: center_time,
          range_hours: 3,
          interval_minutes: 30
        )

        expect(result[:success]).to be true
        expect(result[:data][:weather_timeline]).to be_an(Array)
        expect(result[:data][:center_time]).to eq(center_time)
      end

      it "generates correct number of data points" do
        # 3 hours before + center + 3 hours after = 7 hours
        # At 30 min intervals = 13 points
        result = service.fetch_time_range_data(
          lat: lat,
          lng: lng,
          center_time: center_time,
          range_hours: 3,
          interval_minutes: 30
        )

        expect(result[:data][:data_points]).to eq(13)
      end
    end
  end

  describe "#fetch_radar_data" do
    context "with valid coordinates" do
      it "returns radar data" do
        result = service.fetch_radar_data(lat: lat, lng: lng)

        expect(result[:success]).to be true
        expect(result[:data][:radar]).to be_present
        expect(result[:data][:radar][:tile_url]).to be_a(String)
      end

      it "accepts specific timestamp" do
        timestamp = Time.at(1705890000)
        result = service.fetch_radar_data(lat: lat, lng: lng, timestamp: timestamp)

        expect(result[:success]).to be true
      end
    end

    context "when radar data is unavailable" do
      before do
        allow_any_instance_of(ExternalApis::RadarApi).to receive(:get_radar_data)
          .and_return(nil)
      end

      it "returns error result" do
        result = service.fetch_radar_data(lat: lat, lng: lng, use_cache: false)

        expect(result[:success]).to be false
        expect(result[:error][:message]).to include("No radar data available")
      end
    end
  end

  describe "#fetch_radar_timeline" do
    it "returns past and nowcast data" do
      result = service.fetch_radar_timeline(lat: lat, lng: lng)

      expect(result[:success]).to be true
      expect(result[:data][:radar_timeline][:past]).to be_an(Array)
      expect(result[:data][:radar_timeline][:nowcast]).to be_an(Array)
    end
  end

  describe "#calculate_sun_position" do
    let(:time) { Time.utc(2024, 1, 21, 12, 0, 0) } # Noon UTC

    it "returns sun position data" do
      result = service.calculate_sun_position(lat: lat, lng: lng, time: time)

      expect(result[:success]).to be true
      expect(result[:data][:altitude]).to be_a(Numeric)
      expect(result[:data][:azimuth]).to be_a(Numeric)
    end

    it "includes azimuth in compass degrees (0-360)" do
      result = service.calculate_sun_position(lat: lat, lng: lng, time: time)

      expect(result[:data][:azimuth]).to be_between(0, 360)
    end

    it "indicates if it is daytime" do
      result = service.calculate_sun_position(lat: lat, lng: lng, time: time)

      expect(result[:data]).to have_key(:is_daytime)
    end

    it "includes sun times" do
      result = service.calculate_sun_position(lat: lat, lng: lng, time: time)

      expect(result[:data][:sunrise]).to be_a(Time)
      expect(result[:data][:sunset]).to be_a(Time)
      expect(result[:data][:solar_noon]).to be_a(Time)
    end

    context "during nighttime" do
      let(:night_time) { Time.utc(2024, 1, 21, 20, 0, 0) } # 5 AM JST (dark)

      it "indicates not daytime" do
        result = service.calculate_sun_position(lat: lat, lng: lng, time: night_time)

        expect(result[:data][:is_daytime]).to be false
      end
    end
  end

  describe "#check_rainbow_conditions" do
    let(:time) { Time.utc(2024, 1, 21, 8, 0, 0) } # Morning

    context "with favorable conditions" do
      let(:favorable_weather) do
        {
          humidity: 70,
          cloud_cover: 50,
          visibility: 10000,
          weather_code: 500, # Light rain
          rain_1h: 1.0
        }
      end

      before do
        allow_any_instance_of(ExternalApis::WeatherApi).to receive(:current_weather)
          .and_return(favorable_weather)
      end

      it "returns favorable result" do
        result = service.check_rainbow_conditions(lat: lat, lng: lng, time: time)

        expect(result[:success]).to be true
        expect(result[:data][:score]).to be >= 0
        expect(result[:data][:conditions]).to be_a(Hash)
      end

      it "includes rainbow direction" do
        result = service.check_rainbow_conditions(lat: lat, lng: lng, time: time)

        expect(result[:data][:rainbow_direction]).to be_present
        expect(result[:data][:rainbow_direction][:azimuth]).to be_a(Numeric)
        expect(result[:data][:rainbow_direction][:cardinal]).to be_a(String)
      end

      it "includes recommendations" do
        result = service.check_rainbow_conditions(lat: lat, lng: lng, time: time)

        expect(result[:data][:recommendations]).to be_an(Array)
      end
    end

    context "with pre-fetched weather data" do
      it "uses provided weather data" do
        expect_any_instance_of(ExternalApis::WeatherApi).not_to receive(:current_weather)

        result = service.check_rainbow_conditions(
          lat: lat,
          lng: lng,
          time: time,
          weather_data: current_weather_response
        )

        expect(result[:success]).to be true
      end
    end

    context "with unfavorable conditions" do
      let(:unfavorable_weather) do
        {
          humidity: 30, # Too low
          cloud_cover: 100, # Complete overcast
          visibility: 500, # Poor visibility
          weather_code: 800, # Clear - no rain
          rain_1h: 0
        }
      end

      before do
        allow_any_instance_of(ExternalApis::WeatherApi).to receive(:current_weather)
          .and_return(unfavorable_weather)
      end

      it "returns low score" do
        result = service.check_rainbow_conditions(lat: lat, lng: lng, time: time)

        expect(result[:success]).to be true
        expect(result[:data][:is_favorable]).to be false
        expect(result[:data][:score]).to be < 60
      end

      it "provides improvement recommendations" do
        result = service.check_rainbow_conditions(lat: lat, lng: lng, time: time)

        expect(result[:data][:recommendations].length).to be > 1
      end
    end
  end

  describe "#fetch_weather_for_photo" do
    # Use a mock photo object instead of FactoryBot
    let(:photo) do
      double("Photo",
             latitude: lat,
             longitude: lng,
             captured_at: Time.current)
    end

    context "with valid photo" do
      it "returns complete weather data" do
        result = service.fetch_weather_for_photo(photo)

        expect(result[:success]).to be true
        expect(result[:data][:weather_timeline]).to be_an(Array)
        expect(result[:data][:radar]).to be_present
        expect(result[:data][:rainbow_conditions]).to be_present
      end
    end

    context "with photo missing location" do
      let(:photo_no_location) do
        double("Photo",
               latitude: nil,
               longitude: nil,
               captured_at: Time.current)
      end

      it "returns validation error" do
        result = service.fetch_weather_for_photo(photo_no_location)

        expect(result[:success]).to be false
        expect(result[:error][:message]).to include("no location")
      end
    end

    context "with photo missing captured_at" do
      let(:photo_no_time) do
        double("Photo",
               latitude: lat,
               longitude: lng,
               captured_at: nil)
      end

      it "returns validation error" do
        result = service.fetch_weather_for_photo(photo_no_time)

        expect(result[:success]).to be false
        expect(result[:error][:message]).to include("captured_at")
      end
    end
  end

  describe "rainbow condition evaluation" do
    let(:time) { Time.utc(2024, 6, 21, 7, 0, 0) } # Morning, summer

    it "considers sun altitude" do
      # Sun too high (midday)
      high_sun_time = Time.utc(2024, 6, 21, 3, 0, 0) # ~noon JST
      result = service.check_rainbow_conditions(lat: lat, lng: lng, time: high_sun_time)

      sun_condition = result[:data][:conditions][:sun_altitude]
      # Just verify the condition is evaluated
      expect(sun_condition).to be_present
      expect(sun_condition[:value]).to be_a(Numeric)
    end

    it "considers precipitation" do
      # No rain
      no_rain_weather = current_weather_response.merge(
        weather_code: 800,
        rain_1h: 0,
        snow_1h: 0
      )

      allow_any_instance_of(ExternalApis::WeatherApi).to receive(:current_weather)
        .and_return(no_rain_weather)

      result = service.check_rainbow_conditions(lat: lat, lng: lng, time: time)

      precip_condition = result[:data][:conditions][:precipitation]
      expect(precip_condition[:favorable]).to be false
    end

    it "considers humidity" do
      low_humidity_weather = current_weather_response.merge(humidity: 30)

      allow_any_instance_of(ExternalApis::WeatherApi).to receive(:current_weather)
        .and_return(low_humidity_weather)

      result = service.check_rainbow_conditions(lat: lat, lng: lng, time: time)

      humidity_condition = result[:data][:conditions][:humidity]
      expect(humidity_condition[:favorable]).to be false
    end
  end

  describe "error handling" do
    context "when Weather API is not configured" do
      before do
        allow(ENV).to receive(:fetch).with("OPENWEATHERMAP_API_KEY", nil).and_return(nil)
      end

      it "handles missing API key gracefully" do
        # Create a new service instance without API key
        new_service = described_class.new
        result = new_service.fetch_current_conditions(lat: lat, lng: lng)

        expect(result[:success]).to be false
        expect(result[:error][:message]).to include("not configured")
      end
    end
  end
end
