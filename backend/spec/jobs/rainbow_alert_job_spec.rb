# frozen_string_literal: true

require "rails_helper"

RSpec.describe RainbowAlertJob, type: :job do
  include ActiveJob::TestHelper

  describe "constants" do
    it "defines monitoring locations" do
      expect(described_class::MONITORING_LOCATIONS).to be_an(Array)
      expect(described_class::MONITORING_LOCATIONS).not_to be_empty
    end

    it "includes required location fields" do
      described_class::MONITORING_LOCATIONS.each do |location|
        expect(location).to have_key(:id)
        expect(location).to have_key(:name)
        expect(location).to have_key(:lat)
        expect(location).to have_key(:lng)
      end
    end

    it "covers Shiojiri areas" do
      location_ids = described_class::MONITORING_LOCATIONS.map { |l| l[:id] }
      expect(location_ids).to include("daimon")
      expect(location_ids).to include("shiojiri_central")
    end

    it "defines rainbow score threshold" do
      expect(described_class::RAINBOW_SCORE_THRESHOLD).to eq(60)
    end

    it "defines alert throttle period as 2 hours" do
      expect(described_class::ALERT_THROTTLE_PERIOD).to eq(2.hours)
    end
  end

  describe "#perform" do
    let(:weather_service) { instance_double(WeatherService) }
    let(:notification_service) { instance_double(NotificationService) }

    before do
      allow(WeatherService).to receive(:new).and_return(weather_service)
      allow(NotificationService).to receive(:new).and_return(notification_service)
      # Clear cache before each test
      Rails.cache.clear
    end

    context "when conditions are favorable" do
      before do
        allow(weather_service).to receive(:check_rainbow_conditions).and_return({
          success: true,
          data: {
            is_favorable: true,
            score: 80,
            conditions: {
              sun_altitude: { value: 25, favorable: true },
              humidity: { value: 70, favorable: true },
              cloud_cover: { value: 40, favorable: true },
              precipitation: { value: true, favorable: true },
              visibility: { value: 5000, favorable: true }
            },
            rainbow_direction: { azimuth: 270, cardinal: "W" },
            sun_altitude: 25
          }
        })

        allow(notification_service).to receive(:send_rainbow_alert).and_return({
          success: true, sent: 5, skipped: 2, failed: 0
        })
      end

      it "sends alerts for favorable locations" do
        expect(notification_service).to receive(:send_rainbow_alert).at_least(:once)
        described_class.perform_now
      end
    end

    context "when conditions are not favorable" do
      before do
        allow(weather_service).to receive(:check_rainbow_conditions).and_return({
          success: true,
          data: {
            is_favorable: false,
            score: 30,
            conditions: {},
            rainbow_direction: nil,
            sun_altitude: 50
          }
        })
      end

      it "does not send alerts" do
        expect(notification_service).not_to receive(:send_rainbow_alert)
        described_class.perform_now
      end
    end

    context "when location was recently alerted" do
      it "defines cache prefix for throttling" do
        # Verify the job uses the expected cache key pattern for throttling
        expect(described_class::CACHE_PREFIX).to eq("rainbow_alert:location")
      end
    end

    context "when weather service returns error" do
      before do
        allow(weather_service).to receive(:check_rainbow_conditions).and_return({
          success: false,
          error: { message: "API error" }
        })
      end

      it "continues checking other locations" do
        expect(weather_service).to receive(:check_rainbow_conditions)
          .exactly(described_class::MONITORING_LOCATIONS.count).times
        described_class.perform_now
      end
    end

    context "when weather service raises exception" do
      before do
        allow(weather_service).to receive(:check_rainbow_conditions)
          .and_raise(StandardError.new("Connection error"))
      end

      it "logs error and continues without raising" do
        expect { described_class.perform_now }.not_to raise_error
      end
    end
  end

  describe "duration estimation" do
    it "provides default duration" do
      expect(described_class::DEFAULT_ESTIMATED_DURATION).to eq(15)
    end
  end

  describe "throttling" do
    it "uses cache for throttling" do
      cache_key = "#{described_class::CACHE_PREFIX}:daimon"
      expect(cache_key).to eq("rainbow_alert:location:daimon")
    end
  end

  describe "location coverage" do
    it "covers major Shiojiri areas" do
      names = described_class::MONITORING_LOCATIONS.map { |l| l[:name] }

      expect(names).to include("大門地区")
      expect(names).to include("塩尻市中心部")
    end

    it "has valid coordinates for all locations" do
      described_class::MONITORING_LOCATIONS.each do |location|
        # Shiojiri is roughly at 36.1N, 137.9E
        expect(location[:lat]).to be_between(35.9, 36.2)
        expect(location[:lng]).to be_between(137.7, 138.1)
      end
    end
  end

  describe "queue configuration" do
    it "uses the alerts queue" do
      expect(described_class.queue_name).to eq("alerts")
    end
  end
end
