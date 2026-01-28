# frozen_string_literal: true

# WeatherConditionSerializer provides Alba serialization for WeatherCondition resources.
#
# Serializes weather data for photo detail views and weather analysis.
#
# == Usage
#   WeatherConditionSerializer.new(weather_condition).serialize
#   WeatherConditionSerializer.new(weather_conditions).serialize
#
class WeatherConditionSerializer < ApplicationSerializer
  attributes :id

  # Timestamp of the weather reading
  attribute :recorded_at do |wc|
    wc.timestamp&.iso8601
  end

  # Temperature in Celsius
  attribute :temperature

  # Humidity percentage
  attribute :humidity

  # Atmospheric pressure in hPa
  attribute :pressure

  # Wind speed in m/s
  attribute :wind_speed

  # Wind direction in degrees (0-360)
  attribute :wind_direction

  # Weather code from API
  attribute :weather_code

  # Human-readable weather description
  attribute :weather_description

  # Cloud coverage percentage
  attribute :cloud_coverage do |wc|
    wc.cloud_cover
  end

  # Visibility in meters
  attribute :visibility

  # Sun position data
  attribute :sun_position do |wc|
    next nil unless wc.sun_azimuth.present? || wc.sun_altitude.present?

    {
      azimuth: wc.sun_azimuth,
      elevation: wc.sun_altitude
    }
  end

  # Rainbow favorability indicators
  attribute :rainbow_conditions do |wc|
    {
      favorable_sun_position: wc.rainbow_favorable_sun_position?,
      favorable_weather: wc.rainbow_favorable_weather?
    }
  end

  # ===========================================================================
  # Summary Serializer - Key metrics only
  # ===========================================================================

  class Summary < ApplicationSerializer
    attribute :recorded_at do |wc|
      wc.timestamp&.iso8601
    end

    attributes :temperature, :humidity

    attribute :weather_description

    attribute :sun_elevation do |wc|
      wc.sun_altitude
    end
  end
end
