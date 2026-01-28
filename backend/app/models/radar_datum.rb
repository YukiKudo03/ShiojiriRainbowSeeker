# frozen_string_literal: true

# RadarDatum model for precipitation radar data.
#
# Stores weather radar information captured at the time of photo submission.
# This data helps correlate rainbow sightings with precipitation patterns.
#
# == Associations
# - belongs_to :photo - The photo this radar data relates to
# - has_many :weather_conditions - Associated weather conditions
# - has_one_attached :radar_image - Radar visualization image
#
# == Data Fields
# - timestamp: When the radar observation was made
# - center_location: Geographic center point of observation
# - radius: Observation area radius
# - precipitation_intensity: Rainfall intensity level
# - precipitation_area: JSONB polygon data for precipitation coverage
# - movement_direction: Direction precipitation is moving (degrees)
# - movement_speed: Speed of precipitation movement
#
# == Geographic Features
# Uses PostGIS geography type for center_location with SRID 4326 (WGS84).
#
class RadarDatum < ApplicationRecord
  # Active Storage attachment for radar visualization
  has_one_attached :radar_image

  # Associations
  belongs_to :photo
  has_many :weather_conditions, dependent: :nullify

  # Validations
  validates :timestamp, presence: true
  validates :precipitation_intensity, numericality: { greater_than_or_equal_to: 0, allow_nil: true }
  validates :movement_direction, numericality: { greater_than_or_equal_to: 0, less_than: 360, allow_nil: true }
  validates :movement_speed, numericality: { greater_than_or_equal_to: 0, allow_nil: true }

  # Scopes
  scope :recent, -> { order(timestamp: :desc) }
  scope :with_precipitation, -> { where("precipitation_intensity > 0") }

  # Get latitude from center location
  #
  # @return [Float, nil] Latitude coordinate
  def center_latitude
    center_location&.y
  end

  # Get longitude from center location
  #
  # @return [Float, nil] Longitude coordinate
  def center_longitude
    center_location&.x
  end

  # Set center location from latitude and longitude
  #
  # @param lat [Float] Latitude coordinate
  # @param lng [Float] Longitude coordinate
  def set_center_location(lat, lng)
    factory = RGeo::Geographic.spherical_factory(srid: 4326)
    self.center_location = factory.point(lng, lat)
  end

  # Check if there is active precipitation
  #
  # @return [Boolean] true if precipitation is occurring
  def active_precipitation?
    precipitation_intensity.present? && precipitation_intensity > 0
  end

  # Check if precipitation is moving away (favorable for rainbow)
  # When precipitation moves away from observer, clearing skies can reveal rainbows
  #
  # @param observer_direction [Float] Direction from observer to precipitation (degrees)
  # @return [Boolean] true if precipitation is moving away
  def precipitation_moving_away?(observer_direction)
    return false unless movement_direction.present?

    # Calculate if movement direction is roughly aligned with observer direction
    diff = (movement_direction - observer_direction).abs
    diff = 360 - diff if diff > 180
    diff < 45
  end
end
