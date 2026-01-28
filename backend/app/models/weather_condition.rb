# frozen_string_literal: true

# WeatherCondition model for storing weather data at photo capture time.
#
# Records comprehensive weather information at the time and location
# when a rainbow photo was taken. This data is fetched from external
# weather APIs and stored for analysis and display.
#
# == Associations
# - belongs_to :photo - The photo this weather data relates to
# - belongs_to :radar_datum - Associated radar data (optional)
#
# == Weather Metrics
# - temperature: Temperature in Celsius
# - humidity: Relative humidity percentage
# - pressure: Atmospheric pressure in hPa
# - wind_speed: Wind speed in m/s
# - wind_direction: Wind direction in degrees
# - cloud_cover: Cloud coverage percentage
# - visibility: Visibility in meters
#
# == Sun Position
# - sun_azimuth: Sun's compass direction (0-360 degrees)
# - sun_altitude: Sun's elevation angle (-90 to 90 degrees)
#
# Sun position data is crucial for determining rainbow visibility,
# as rainbows appear opposite the sun at specific angles.
#
class WeatherCondition < ApplicationRecord
  # Associations
  belongs_to :photo
  belongs_to :radar_datum, optional: true

  # Validations
  validates :timestamp, presence: true
  validates :temperature, numericality: { allow_nil: true }
  validates :humidity, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100, allow_nil: true }
  validates :pressure, numericality: { allow_nil: true }
  validates :cloud_cover, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100, allow_nil: true }
  validates :wind_direction, numericality: { greater_than_or_equal_to: 0, less_than: 360, allow_nil: true }
  validates :sun_azimuth, numericality: { greater_than_or_equal_to: 0, less_than: 360, allow_nil: true }
  validates :sun_altitude, numericality: { greater_than_or_equal_to: -90, less_than_or_equal_to: 90, allow_nil: true }

  # Scopes
  scope :recent, -> { order(timestamp: :desc) }
  scope :with_radar, -> { where.not(radar_datum_id: nil) }
  scope :with_sun_position, -> { where.not(sun_azimuth: nil, sun_altitude: nil) }

  # Check if sun position is favorable for rainbow viewing
  # Rainbows typically appear when sun altitude is between 0 and 42 degrees
  #
  # @return [Boolean] true if sun position is favorable
  def rainbow_favorable_sun_position?
    return false unless sun_altitude.present?

    sun_altitude.between?(0, 42)
  end

  # Check if weather conditions are favorable for rainbow formation
  # Requires precipitation and clearing skies
  #
  # @return [Boolean] true if weather is favorable
  def rainbow_favorable_weather?
    # Humidity should be moderate to high for precipitation
    # Cloud cover should not be 100% (need some clearing)
    humidity.present? && humidity >= 50 && cloud_cover.present? && cloud_cover < 100
  end
end
