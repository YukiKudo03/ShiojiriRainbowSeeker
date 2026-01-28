# frozen_string_literal: true

# RadarDatumSerializer provides Alba serialization for RadarDatum resources.
#
# Serializes precipitation radar data for weather analysis.
#
# == CDN Support
# Radar images are served via CloudFront CDN in production.
#
# == Usage
#   RadarDatumSerializer.new(radar_datum).serialize
#   RadarDatumSerializer.new(radar_data).serialize
#
class RadarDatumSerializer < ApplicationSerializer
  attributes :id

  # Timestamp of the radar reading
  attribute :recorded_at do |rd|
    rd.recorded_at&.iso8601
  end

  # Precipitation intensity
  attribute :precipitation_intensity

  # Type of precipitation (rain, snow, etc.)
  attribute :precipitation_type

  # Radar image URL with CDN support
  attribute :radar_image_url do |rd|
    next nil unless rd.radar_image.attached?

    if Rails.env.production? && ENV["AWS_CLOUDFRONT_HOST"].present?
      "https://#{ENV['AWS_CLOUDFRONT_HOST']}/#{rd.radar_image.key}"
    else
      Rails.application.routes.url_helpers.rails_blob_url(rd.radar_image, only_path: false)
    end
  rescue StandardError
    nil
  end

  # Precipitation area data (if available)
  attribute :precipitation_area do |rd|
    rd.precipitation_area
  end

  # Movement direction of precipitation (if available)
  attribute :movement_direction do |rd|
    rd.movement_direction
  end
end
