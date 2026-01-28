# frozen_string_literal: true

require "rails_helper"
require "active_support/all"
require "active_job"
require "suncalc"
require_relative "../../lib/external_apis/weather_api"
require_relative "../../lib/external_apis/radar_api"
require_relative "../../app/controllers/concerns/error_handler"
require_relative "../../app/services/weather_service"

# Create a minimal ApplicationJob for testing without Rails dependencies
class ApplicationJob < ActiveJob::Base
  # Minimal implementation for testing
end unless defined?(ApplicationJob)

# Stub ActiveRecord::RecordNotFound for testing
module ActiveRecord
  class RecordNotFound < StandardError; end
end unless defined?(ActiveRecord::RecordNotFound)

# Stub Photo model for testing
class Photo
  def self.find(id)
    raise NotImplementedError, "Stubbed in tests"
  end
end unless defined?(Photo)

# Stub Rails.logger
module Rails
  def self.logger
    @logger ||= Logger.new("/dev/null")
  end
end unless defined?(Rails)

# Now require the job
require_relative "../../app/jobs/weather_fetch_job"

RSpec.describe WeatherFetchJob do
  let(:photo_id) { "test-photo-uuid" }
  let(:lat) { 36.115 } # Shiojiri, Nagano
  let(:lng) { 137.954 }
  let(:captured_at) { Time.utc(2024, 1, 21, 10, 0, 0) }

  # Mock Photo model
  let(:photo) do
    double("Photo",
           id: photo_id,
           latitude: lat,
           longitude: lng,
           captured_at: captured_at,
           weather_conditions: weather_conditions_relation,
           radar_data: radar_data_relation)
  end

  # Mock associations
  let(:weather_conditions_relation) do
    double("WeatherConditions").tap do |relation|
      allow(relation).to receive(:find_or_initialize_by).and_return(weather_condition)
      allow(relation).to receive(:find_by).and_return(weather_condition)
    end
  end

  let(:radar_data_relation) do
    double("RadarData").tap do |relation|
      allow(relation).to receive(:find_or_initialize_by).and_return(radar_datum)
    end
  end

  let(:weather_condition) do
    double("WeatherCondition").tap do |wc|
      allow(wc).to receive(:assign_attributes)
      allow(wc).to receive(:save!).and_return(true)
      allow(wc).to receive(:update).and_return(true)
    end
  end

  let(:radar_datum) do
    double("RadarDatum").tap do |rd|
      allow(rd).to receive(:set_center_location)
      allow(rd).to receive(:assign_attributes)
      allow(rd).to receive(:save!).and_return(true)
    end
  end

  # Mock weather service responses
  let(:weather_response) do
    {
      success: true,
      data: {
        weather: {
          temperature: 8.5,
          humidity: 65,
          pressure: 1015,
          weather_code: 500,
          weather_description: "light rain",
          wind_speed: 3.5,
          wind_direction: 180,
          rain_1h: 0.5,
          cloud_cover: 40,
          visibility: 10000,
          sun_position: {
            azimuth: 150.0,
            altitude: 35.0
          }
        }
      }
    }
  end

  let(:radar_response) do
    {
      success: true,
      data: {
        radar: {
          timestamp: captured_at,
          tile_url: "https://tilecache.rainviewer.com/v2/radar/1705900800/256/10/903/405/1/1_1.png",
          tile_coords: { x: 903, y: 405, z: 10 }
        }
      }
    }
  end

  before do
    # Stub Photo.find
    allow(Photo).to receive(:find).with(photo_id).and_return(photo)

    # Stub WeatherService
    allow_any_instance_of(WeatherService).to receive(:fetch_current_conditions)
      .and_return(weather_response)
    allow_any_instance_of(WeatherService).to receive(:fetch_historical_data)
      .and_return(weather_response)
    allow_any_instance_of(WeatherService).to receive(:fetch_radar_data)
      .and_return(radar_response)

    # Ensure API key is present
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with("OPENWEATHERMAP_API_KEY", nil).and_return("test_api_key")
  end

  describe "#perform" do
    context "with valid photo" do
      it "fetches and stores weather data" do
        expect(weather_condition).to receive(:assign_attributes).at_least(:once)
        expect(weather_condition).to receive(:save!).at_least(:once)

        described_class.new.perform(photo_id)
      end

      it "fetches and stores radar data" do
        expect(radar_datum).to receive(:set_center_location).with(lat, lng)
        expect(radar_datum).to receive(:save!)

        described_class.new.perform(photo_id)
      end

      it "generates correct number of timestamps" do
        # 3 hours before + center + 3 hours after = 7 hours
        # At 30 min intervals = 13 data points
        job = described_class.new
        job.instance_variable_set(:@captured_at, captured_at)

        timestamps = job.send(:generate_timestamps)

        expect(timestamps.length).to eq(13)
      end

      it "fetches weather for each timestamp" do
        # Should call historical_data for past times
        expect_any_instance_of(WeatherService).to receive(:fetch_historical_data)
          .at_least(:once)
          .and_return(weather_response)

        described_class.new.perform(photo_id)
      end
    end

    context "with photo missing location" do
      let(:photo) do
        double("Photo",
               id: photo_id,
               latitude: nil,
               longitude: nil,
               captured_at: captured_at)
      end

      it "skips processing without error" do
        expect_any_instance_of(WeatherService).not_to receive(:fetch_historical_data)

        described_class.new.perform(photo_id)
      end
    end

    context "with photo missing captured_at" do
      let(:photo) do
        double("Photo",
               id: photo_id,
               latitude: lat,
               longitude: lng,
               captured_at: nil)
      end

      it "skips processing without error" do
        expect_any_instance_of(WeatherService).not_to receive(:fetch_historical_data)

        described_class.new.perform(photo_id)
      end
    end

    context "when photo not found" do
      before do
        allow(Photo).to receive(:find).with(photo_id).and_raise(ActiveRecord::RecordNotFound)
      end

      it "raises RecordNotFound (to be discarded by job framework)" do
        expect {
          described_class.new.perform(photo_id)
        }.to raise_error(ActiveRecord::RecordNotFound)
      end
    end

    context "when weather API fails partially" do
      before do
        call_count = 0
        allow_any_instance_of(WeatherService).to receive(:fetch_historical_data) do
          call_count += 1
          if call_count <= 3
            { success: false, error: { message: "API error" } }
          else
            weather_response
          end
        end
      end

      it "continues with available data" do
        expect(weather_condition).to receive(:save!).at_least(:once)

        described_class.new.perform(photo_id)
      end
    end

    context "when radar API fails" do
      before do
        allow_any_instance_of(WeatherService).to receive(:fetch_radar_data)
          .and_return({ success: false, error: { message: "Radar unavailable" } })
      end

      it "continues without radar data" do
        expect(weather_condition).to receive(:save!).at_least(:once)
        expect(radar_datum).not_to receive(:save!)

        described_class.new.perform(photo_id)
      end
    end
  end

  describe "#round_to_interval" do
    let(:job) { described_class.new }

    it "rounds to nearest 30 minutes" do
      time = Time.utc(2024, 1, 21, 10, 15, 0)
      rounded = job.send(:round_to_interval, time)

      expect(rounded.min).to eq(0).or eq(30)
    end

    it "preserves exact 30-minute boundaries" do
      time = Time.utc(2024, 1, 21, 10, 30, 0)
      rounded = job.send(:round_to_interval, time)

      expect(rounded).to eq(time)
    end
  end

  describe "#determine_precipitation_type" do
    let(:job) { described_class.new }

    it "returns thunderstorm for code 200-299" do
      expect(job.send(:determine_precipitation_type, { weather_code: 201 })).to eq("thunderstorm")
    end

    it "returns drizzle for code 300-399" do
      expect(job.send(:determine_precipitation_type, { weather_code: 301 })).to eq("drizzle")
    end

    it "returns rain for code 500-599" do
      expect(job.send(:determine_precipitation_type, { weather_code: 500 })).to eq("rain")
    end

    it "returns snow for code 600-699" do
      expect(job.send(:determine_precipitation_type, { weather_code: 601 })).to eq("snow")
    end

    it "returns atmosphere for code 700-799" do
      expect(job.send(:determine_precipitation_type, { weather_code: 701 })).to eq("atmosphere")
    end

    it "returns nil for clear weather" do
      expect(job.send(:determine_precipitation_type, { weather_code: 800 })).to be_nil
    end
  end

  describe "timestamp generation" do
    let(:job) { described_class.new }

    before do
      job.instance_variable_set(:@captured_at, captured_at)
    end

    it "generates timestamps spanning 6 hours (3 before, 3 after)" do
      timestamps = job.send(:generate_timestamps)

      first_timestamp = timestamps.first
      last_timestamp = timestamps.last

      expect(first_timestamp).to eq(captured_at - 3.hours)
      expect(last_timestamp).to eq(captured_at + 3.hours)
    end

    it "includes the capture time" do
      timestamps = job.send(:generate_timestamps)

      expect(timestamps).to include(captured_at)
    end

    it "maintains 30-minute intervals" do
      timestamps = job.send(:generate_timestamps)

      timestamps.each_cons(2) do |t1, t2|
        expect(t2 - t1).to eq(30.minutes)
      end
    end
  end
end
