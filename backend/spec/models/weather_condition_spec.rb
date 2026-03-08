# frozen_string_literal: true

require "rails_helper"

RSpec.describe WeatherCondition, type: :model do
  subject(:weather_condition) { build(:weather_condition) }

  describe "associations" do
    it { is_expected.to belong_to(:photo) }
    it { is_expected.to belong_to(:radar_datum).optional }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:timestamp) }
    it { is_expected.to validate_numericality_of(:temperature).allow_nil }
    it { is_expected.to validate_numericality_of(:humidity).is_greater_than_or_equal_to(0).is_less_than_or_equal_to(100).allow_nil }
    it { is_expected.to validate_numericality_of(:pressure).allow_nil }
    it { is_expected.to validate_numericality_of(:cloud_cover).is_greater_than_or_equal_to(0).is_less_than_or_equal_to(100).allow_nil }
    it { is_expected.to validate_numericality_of(:wind_direction).is_greater_than_or_equal_to(0).is_less_than(360).allow_nil }
    it { is_expected.to validate_numericality_of(:sun_azimuth).is_greater_than_or_equal_to(0).is_less_than(360).allow_nil }
    it { is_expected.to validate_numericality_of(:sun_altitude).is_greater_than_or_equal_to(-90).is_less_than_or_equal_to(90).allow_nil }
  end

  describe "scopes" do
    describe ".recent" do
      let!(:older_condition) { create(:weather_condition, timestamp: 2.days.ago) }
      let!(:newer_condition) { create(:weather_condition, timestamp: 1.day.ago) }

      it "orders by timestamp descending" do
        expect(WeatherCondition.recent.first).to eq(newer_condition)
        expect(WeatherCondition.recent.last).to eq(older_condition)
      end
    end

    describe ".with_radar" do
      let(:radar_datum) { create(:radar_datum) }
      let!(:with_radar) { create(:weather_condition, radar_datum: radar_datum) }
      let!(:without_radar) { create(:weather_condition, radar_datum: nil) }

      it "returns only weather conditions with associated radar data" do
        expect(WeatherCondition.with_radar).to include(with_radar)
        expect(WeatherCondition.with_radar).not_to include(without_radar)
      end
    end

    describe ".with_sun_position" do
      let!(:with_sun) { create(:weather_condition, sun_azimuth: 180.0, sun_altitude: 45.0) }
      let!(:without_sun) { create(:weather_condition, sun_azimuth: nil, sun_altitude: nil) }

      it "returns only weather conditions with sun position data" do
        expect(WeatherCondition.with_sun_position).to include(with_sun)
        expect(WeatherCondition.with_sun_position).not_to include(without_sun)
      end
    end
  end

  describe "#rainbow_favorable_sun_position?" do
    it "returns true when sun altitude is between 0 and 42" do
      weather_condition = build(:weather_condition, sun_altitude: 20.0)
      expect(weather_condition.rainbow_favorable_sun_position?).to be true
    end

    it "returns true at the lower boundary (0 degrees)" do
      weather_condition = build(:weather_condition, sun_altitude: 0.0)
      expect(weather_condition.rainbow_favorable_sun_position?).to be true
    end

    it "returns true at the upper boundary (42 degrees)" do
      weather_condition = build(:weather_condition, sun_altitude: 42.0)
      expect(weather_condition.rainbow_favorable_sun_position?).to be true
    end

    it "returns false when sun altitude is above 42" do
      weather_condition = build(:weather_condition, sun_altitude: 50.0)
      expect(weather_condition.rainbow_favorable_sun_position?).to be false
    end

    it "returns false when sun altitude is below 0" do
      weather_condition = build(:weather_condition, sun_altitude: -10.0)
      expect(weather_condition.rainbow_favorable_sun_position?).to be false
    end

    it "returns false when sun altitude is nil" do
      weather_condition = build(:weather_condition, sun_altitude: nil)
      expect(weather_condition.rainbow_favorable_sun_position?).to be false
    end
  end

  describe "#rainbow_favorable_weather?" do
    it "returns true when humidity >= 50 and cloud_cover < 100" do
      weather_condition = build(:weather_condition, :rainbow_favorable)
      expect(weather_condition.rainbow_favorable_weather?).to be true
    end

    it "returns false when humidity is below 50" do
      weather_condition = build(:weather_condition, humidity: 30, cloud_cover: 50)
      expect(weather_condition.rainbow_favorable_weather?).to be false
    end

    it "returns false when cloud_cover is 100" do
      weather_condition = build(:weather_condition, humidity: 70, cloud_cover: 100)
      expect(weather_condition.rainbow_favorable_weather?).to be false
    end

    it "returns false when humidity is nil" do
      weather_condition = build(:weather_condition, humidity: nil, cloud_cover: 50)
      expect(weather_condition.rainbow_favorable_weather?).to be false
    end

    it "returns false when cloud_cover is nil" do
      weather_condition = build(:weather_condition, humidity: 70, cloud_cover: nil)
      expect(weather_condition.rainbow_favorable_weather?).to be false
    end
  end
end
