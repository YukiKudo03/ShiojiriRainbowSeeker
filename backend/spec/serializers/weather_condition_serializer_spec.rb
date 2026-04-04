# frozen_string_literal: true

require "rails_helper"

RSpec.describe WeatherConditionSerializer, type: :serializer do
  let(:photo) { create(:photo, :without_image) }
  let(:weather_condition) do
    create(:weather_condition,
           photo: photo,
           timestamp: Time.zone.parse("2026-03-01 14:00:00"),
           temperature: 22.5,
           humidity: 68,
           pressure: 1013,
           wind_speed: 3.2,
           wind_direction: 180,
           weather_code: 500,
           weather_description: "light rain",
           cloud_cover: 45,
           visibility: 8000,
           sun_azimuth: 210.5,
           sun_altitude: 35.0)
  end

  describe "WeatherConditionSerializer (default)" do
    subject(:serialized) { described_class.new(weather_condition).to_h }

    it "includes id" do
      expect(serialized[:id]).to eq(weather_condition.id)
    end

    it "includes recordedAt as ISO8601" do
      expect(serialized[:recordedAt]).to match(/\d{4}-\d{2}-\d{2}T/)
    end

    it "maps recordedAt from the timestamp column" do
      expect(serialized[:recordedAt]).to eq(weather_condition.timestamp.iso8601)
    end

    it "includes temperature" do
      expect(serialized[:temperature]).to eq(22.5)
    end

    it "includes humidity" do
      expect(serialized[:humidity]).to eq(68)
    end

    it "includes pressure" do
      expect(serialized[:pressure]).to eq(1013)
    end

    it "includes windSpeed" do
      expect(serialized[:windSpeed]).to eq(3.2)
    end

    it "includes windDirection" do
      expect(serialized[:windDirection]).to eq(180)
    end

    it "includes weatherCode" do
      expect(serialized[:weatherCode]).to eq("500")
    end

    it "includes weatherDescription" do
      expect(serialized[:weatherDescription]).to eq("light rain")
    end

    it "includes cloudCoverage mapped from cloud_cover" do
      expect(serialized[:cloudCoverage]).to eq(45)
    end

    it "includes visibility" do
      expect(serialized[:visibility]).to eq(8000)
    end

    it "includes sunPosition with azimuth and elevation" do
      expect(serialized[:sunPosition]).to eq(
        azimuth: 210.5,
        elevation: 35.0
      )
    end

    it "includes rainbowConditions with favorability flags" do
      expect(serialized[:rainbowConditions]).to include(
        :favorable_sun_position,
        :favorable_weather
      )
    end

    it "evaluates favorable_sun_position based on sun altitude" do
      # sun_altitude 35.0 is between 0 and 42, so favorable
      expect(serialized[:rainbowConditions][:favorable_sun_position]).to be true
    end

    it "evaluates favorable_weather based on humidity and cloud cover" do
      # humidity 68 >= 50 and cloud_cover 45 < 100, so favorable
      expect(serialized[:rainbowConditions][:favorable_weather]).to be true
    end

    it "uses camelCase keys at the top level" do
      snake_case_keys = serialized.keys.select { |k| k.to_s.include?("_") }
      expect(snake_case_keys).to be_empty
    end

    context "without sun position data" do
      let(:weather_condition) do
        create(:weather_condition,
               photo: photo,
               sun_azimuth: nil,
               sun_altitude: nil)
      end

      it "returns nil for sunPosition" do
        expect(serialized[:sunPosition]).to be_nil
      end
    end
  end

  describe "WeatherConditionSerializer::Summary" do
    subject(:serialized) { described_class::Summary.new(weather_condition).to_h }

    it "includes recordedAt as ISO8601" do
      expect(serialized[:recordedAt]).to match(/\d{4}-\d{2}-\d{2}T/)
    end

    it "includes temperature" do
      expect(serialized[:temperature]).to eq(22.5)
    end

    it "includes humidity" do
      expect(serialized[:humidity]).to eq(68)
    end

    it "includes weatherDescription" do
      expect(serialized[:weatherDescription]).to eq("light rain")
    end

    it "includes sunElevation mapped from sun_altitude" do
      expect(serialized[:sunElevation]).to eq(35.0)
    end

    it "does NOT include pressure" do
      expect(serialized).not_to have_key(:pressure)
    end

    it "does NOT include rainbowConditions" do
      expect(serialized).not_to have_key(:rainbowConditions)
    end

    it "does NOT include sunPosition" do
      expect(serialized).not_to have_key(:sunPosition)
    end
  end
end
