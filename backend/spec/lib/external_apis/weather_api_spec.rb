# frozen_string_literal: true

require "rails_helper"
require "active_support/all"
require "faraday"
require "webmock/rspec"
require_relative "../../../lib/external_apis/weather_api"

RSpec.describe ExternalApis::WeatherApi do
  let(:api_key) { "test_api_key" }
  let(:api) { described_class.new(api_key: api_key) }
  let(:lat) { 36.115 }
  let(:lng) { 137.954 }

  # Common URL patterns
  let(:onecall_url_pattern) { %r{api\.openweathermap\.org.*/onecall\?} }
  let(:timemachine_url_pattern) { %r{api\.openweathermap\.org.*/onecall/timemachine\?} }

  describe "#initialize" do
    context "with valid API key" do
      it "creates an instance" do
        expect(api).to be_a(described_class)
      end
    end

    context "with API key from environment" do
      before do
        allow(ENV).to receive(:fetch).with("OPENWEATHERMAP_API_KEY", nil).and_return("env_api_key")
      end

      it "uses the environment variable" do
        api = described_class.new
        expect(api).to be_a(described_class)
      end
    end

    context "without API key" do
      before do
        allow(ENV).to receive(:fetch).with("OPENWEATHERMAP_API_KEY", nil).and_return(nil)
      end

      it "raises ConfigurationError" do
        expect {
          described_class.new
        }.to raise_error(ExternalApis::WeatherApi::ConfigurationError, /API key is required/)
      end
    end
  end

  describe "#current_weather" do
    let(:current_weather_response) do
      {
        "lat" => lat,
        "lon" => lng,
        "timezone" => "Asia/Tokyo",
        "timezone_offset" => 32400,
        "current" => {
          "dt" => 1705900800,
          "sunrise" => 1705876800,
          "sunset" => 1705912800,
          "temp" => 8.5,
          "feels_like" => 6.2,
          "pressure" => 1015,
          "humidity" => 65,
          "dew_point" => 2.1,
          "uvi" => 1.5,
          "clouds" => 40,
          "visibility" => 10000,
          "wind_speed" => 3.5,
          "wind_deg" => 180,
          "wind_gust" => 5.2,
          "weather" => [
            {
              "id" => 802,
              "main" => "Clouds",
              "description" => "scattered clouds",
              "icon" => "03d"
            }
          ],
          "rain" => { "1h" => 0.5 }
        }
      }
    end

    context "with successful response" do
      before do
        stub_request(:get, onecall_url_pattern)
          .to_return(
            status: 200,
            body: current_weather_response.to_json,
            headers: { "Content-Type" => "application/json" }
          )
      end

      it "returns parsed weather data" do
        result = api.current_weather(lat: lat, lng: lng)

        expect(result).to be_a(Hash)
        expect(result[:temperature]).to eq(8.5)
        expect(result[:humidity]).to eq(65)
        expect(result[:pressure]).to eq(1015)
        expect(result[:wind_speed]).to eq(3.5)
        expect(result[:wind_direction]).to eq(180)
        expect(result[:cloud_cover]).to eq(40)
        expect(result[:visibility]).to eq(10000)
        expect(result[:weather_code]).to eq(802)
        expect(result[:weather_description]).to eq("scattered clouds")
        expect(result[:weather_main]).to eq("Clouds")
        expect(result[:rain_1h]).to eq(0.5)
      end

      it "includes location data" do
        result = api.current_weather(lat: lat, lng: lng)

        expect(result[:location][:lat]).to eq(lat)
        expect(result[:location][:lon]).to eq(lng)
        expect(result[:location][:timezone]).to eq("Asia/Tokyo")
      end

      it "parses timestamp correctly" do
        result = api.current_weather(lat: lat, lng: lng)

        expect(result[:timestamp]).to be_a(Time)
        expect(result[:sunrise]).to be_a(Time)
        expect(result[:sunset]).to be_a(Time)
      end
    end

    context "with 401 unauthorized response" do
      before do
        stub_request(:get, onecall_url_pattern)
          .to_return(status: 401, body: { message: "Invalid API key" }.to_json)
      end

      it "raises ApiError" do
        expect {
          api.current_weather(lat: lat, lng: lng)
        }.to raise_error(ExternalApis::WeatherApi::ApiError, /Invalid API key/)
      end
    end

    context "with 429 rate limit response" do
      before do
        stub_request(:get, onecall_url_pattern)
          .to_return(status: 429, body: { message: "Rate limit exceeded" }.to_json)
      end

      it "raises RateLimitError" do
        expect {
          api.current_weather(lat: lat, lng: lng)
        }.to raise_error(ExternalApis::WeatherApi::RateLimitError)
      end
    end

    context "with 500 server error" do
      before do
        stub_request(:get, onecall_url_pattern)
          .to_return(status: 500)
      end

      it "raises ApiError" do
        expect {
          api.current_weather(lat: lat, lng: lng)
        }.to raise_error(ExternalApis::WeatherApi::ApiError, /Server error/)
      end
    end

    context "with timeout" do
      before do
        stub_request(:get, onecall_url_pattern)
          .to_timeout
      end

      it "raises Faraday connection error" do
        expect {
          api.current_weather(lat: lat, lng: lng)
        }.to raise_error(Faraday::Error)
      end
    end
  end

  describe "#historical_weather" do
    let(:timestamp) { Time.utc(2024, 1, 20, 12, 0, 0) }
    let(:unix_timestamp) { timestamp.to_i }

    let(:historical_weather_response) do
      {
        "lat" => lat,
        "lon" => lng,
        "timezone" => "Asia/Tokyo",
        "timezone_offset" => 32400,
        "data" => [
          {
            "dt" => unix_timestamp,
            "sunrise" => unix_timestamp - 21600,
            "sunset" => unix_timestamp + 21600,
            "temp" => 5.2,
            "feels_like" => 2.8,
            "pressure" => 1018,
            "humidity" => 72,
            "dew_point" => 0.5,
            "uvi" => 0.8,
            "clouds" => 60,
            "visibility" => 8000,
            "wind_speed" => 2.1,
            "wind_deg" => 270,
            "weather" => [
              {
                "id" => 500,
                "main" => "Rain",
                "description" => "light rain",
                "icon" => "10d"
              }
            ]
          }
        ]
      }
    end

    context "with successful response" do
      before do
        stub_request(:get, timemachine_url_pattern)
          .to_return(
            status: 200,
            body: historical_weather_response.to_json,
            headers: { "Content-Type" => "application/json" }
          )
      end

      it "returns parsed historical weather data with Time object" do
        result = api.historical_weather(lat: lat, lng: lng, timestamp: timestamp)

        expect(result).to be_a(Hash)
        expect(result[:temperature]).to eq(5.2)
        expect(result[:humidity]).to eq(72)
        expect(result[:pressure]).to eq(1018)
        expect(result[:weather_code]).to eq(500)
        expect(result[:weather_description]).to eq("light rain")
      end

      it "returns parsed historical weather data with Unix timestamp" do
        result = api.historical_weather(lat: lat, lng: lng, timestamp: unix_timestamp)

        expect(result).to be_a(Hash)
        expect(result[:temperature]).to eq(5.2)
      end

      it "includes requested timestamp" do
        result = api.historical_weather(lat: lat, lng: lng, timestamp: timestamp)

        expect(result[:requested_timestamp]).to eq(timestamp)
      end
    end

    context "with 401 unauthorized response" do
      before do
        stub_request(:get, timemachine_url_pattern)
          .to_return(status: 401, body: { message: "Invalid API key" }.to_json)
      end

      it "raises ApiError" do
        expect {
          api.historical_weather(lat: lat, lng: lng, timestamp: timestamp)
        }.to raise_error(ExternalApis::WeatherApi::ApiError)
      end
    end
  end

  describe "#historical_weather_bulk" do
    let(:timestamps) do
      [
        Time.utc(2024, 1, 20, 10, 0, 0),
        Time.utc(2024, 1, 20, 10, 30, 0),
        Time.utc(2024, 1, 20, 11, 0, 0)
      ]
    end

    let(:successful_response) do
      {
        "lat" => lat,
        "lon" => lng,
        "timezone" => "Asia/Tokyo",
        "timezone_offset" => 32400,
        "data" => [
          {
            "dt" => timestamps.first.to_i,
            "temp" => 8.0,
            "humidity" => 70,
            "pressure" => 1015,
            "clouds" => 50,
            "visibility" => 10000,
            "wind_speed" => 2.0,
            "wind_deg" => 180,
            "weather" => [ { "id" => 800, "main" => "Clear", "description" => "clear sky", "icon" => "01d" } ]
          }
        ]
      }
    end

    context "with all successful responses" do
      before do
        stub_request(:get, timemachine_url_pattern)
          .to_return(
            status: 200,
            body: successful_response.to_json,
            headers: { "Content-Type" => "application/json" }
          )
      end

      it "returns array of weather data" do
        results = api.historical_weather_bulk(lat: lat, lng: lng, timestamps: timestamps)

        expect(results).to be_an(Array)
        expect(results.length).to eq(3)
        results.each do |result|
          expect(result).to be_a(Hash)
          expect(result[:temperature]).to eq(8.0)
        end
      end
    end

    context "with some failed responses" do
      before do
        # Return success for first call, then 500 error, then success
        stub_request(:get, timemachine_url_pattern)
          .to_return(
            { status: 200, body: successful_response.to_json, headers: { "Content-Type" => "application/json" } },
            { status: 500, body: "" },
            { status: 200, body: successful_response.to_json, headers: { "Content-Type" => "application/json" } }
          )
      end

      it "returns successful results and skips failures" do
        results = api.historical_weather_bulk(lat: lat, lng: lng, timestamps: timestamps)

        expect(results).to be_an(Array)
        expect(results.length).to eq(2) # Only 2 successful responses
      end
    end
  end

  describe "weather code parsing" do
    let(:response_with_rain) do
      {
        "lat" => lat,
        "lon" => lng,
        "timezone" => "Asia/Tokyo",
        "timezone_offset" => 32400,
        "current" => {
          "dt" => 1705900800,
          "temp" => 10.0,
          "humidity" => 80,
          "pressure" => 1010,
          "clouds" => 90,
          "visibility" => 5000,
          "wind_speed" => 4.0,
          "wind_deg" => 90,
          "weather" => [
            { "id" => 501, "main" => "Rain", "description" => "moderate rain", "icon" => "10d" }
          ],
          "rain" => { "1h" => 2.5 }
        }
      }
    end

    before do
      stub_request(:get, onecall_url_pattern)
        .to_return(
          status: 200,
          body: response_with_rain.to_json,
          headers: { "Content-Type" => "application/json" }
        )
    end

    it "parses rain weather correctly" do
      result = api.current_weather(lat: lat, lng: lng)

      expect(result[:weather_code]).to eq(501)
      expect(result[:weather_main]).to eq("Rain")
      expect(result[:rain_1h]).to eq(2.5)
    end
  end

  describe "custom timeout" do
    let(:api_with_custom_timeout) { described_class.new(api_key: api_key, timeout: 5) }

    before do
      stub_request(:get, onecall_url_pattern)
        .to_return(
          status: 200,
          body: { "lat" => lat, "lon" => lng, "current" => { "dt" => 1705900800, "temp" => 10.0 } }.to_json,
          headers: { "Content-Type" => "application/json" }
        )
    end

    it "uses custom timeout value" do
      # We can't directly test the timeout value, but we can verify the API works
      expect { api_with_custom_timeout.current_weather(lat: lat, lng: lng) }.not_to raise_error
    end
  end
end
