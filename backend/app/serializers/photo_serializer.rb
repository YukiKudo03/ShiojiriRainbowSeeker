# frozen_string_literal: true

# PhotoSerializer provides Alba serialization for Photo resources.
#
# Offers multiple serialization modes:
# - Index (default): Optimized for list views with thumbnails
# - Detail: Full information for photo detail views
# - Minimal: Bare minimum for lightweight responses
#
# == CDN Support
# Automatically generates CloudFront CDN URLs in production for faster
# image delivery. Falls back to Rails blob URLs in development.
#
# == Security
# - Never exposes raw file paths
# - Excludes moderation_status for non-owners
# - Uses CDN URLs to prevent direct S3 access
#
# == Requirements Reference
# - FR-4: Photo feed and browsing
#
# == Usage
#   # Index/list view
#   PhotoSerializer.new(photo).serialize
#
#   # Detail view with current user context
#   PhotoSerializer::Detail.new(photo, params: { current_user: user }).serialize
#
#   # Collection
#   PhotoSerializer.new(photos).serialize
#
class PhotoSerializer < ApplicationSerializer
  attributes :id, :title, :description

  # Capture timestamp in ISO8601 format
  attribute :captured_at do |photo|
    photo.captured_at&.iso8601
  end

  # Location data (latitude, longitude, name)
  attribute :location do |photo|
    next nil unless photo.location.present?

    {
      latitude: photo.latitude,
      longitude: photo.longitude,
      name: photo.location_name
    }
  end

  # Image URLs for list view (thumbnail and medium only)
  attribute :image_urls do |photo|
    {
      thumbnail: generate_variant_url(photo, :thumbnail),
      medium: generate_variant_url(photo, :medium)
    }
  end

  # Social counts
  attributes :like_count, :comment_count

  # User who uploaded the photo
  one :user, serializer: UserSerializer::Summary

  # Creation timestamp
  attribute :created_at do |photo|
    photo.created_at&.iso8601
  end

  # Generate variant URL with CDN support
  #
  # @param photo [Photo] the photo
  # @param variant_name [Symbol] the variant (:thumbnail, :medium, :large)
  # @return [String, nil] the URL or nil
  def self.generate_variant_url(photo, variant_name)
    return nil unless photo.image.attached?

    variant = photo.image.variant(Photo::VARIANTS[variant_name])

    if Rails.env.production? && ENV["AWS_CLOUDFRONT_HOST"].present?
      processed = variant.processed
      "https://#{ENV['AWS_CLOUDFRONT_HOST']}/#{processed.key}"
    else
      Rails.application.routes.url_helpers.rails_blob_url(
        variant.processed,
        only_path: false
      )
    end
  rescue StandardError => e
    Rails.logger.warn("Failed to generate #{variant_name} URL for photo #{photo.id}: #{e.message}")
    nil
  end

  # Generate original image URL with CDN support
  #
  # @param photo [Photo] the photo
  # @return [String, nil] the URL or nil
  def self.generate_original_url(photo)
    return nil unless photo.image.attached?

    if Rails.env.production? && ENV["AWS_CLOUDFRONT_HOST"].present?
      "https://#{ENV['AWS_CLOUDFRONT_HOST']}/#{photo.image.key}"
    else
      Rails.application.routes.url_helpers.rails_blob_url(photo.image, only_path: false)
    end
  rescue StandardError => e
    Rails.logger.warn("Failed to generate original URL for photo #{photo.id}: #{e.message}")
    nil
  end

  # ===========================================================================
  # Detail Serializer - Full information for photo detail views
  # ===========================================================================

  class Detail < ApplicationSerializer
    attributes :id, :title, :description

    # Capture timestamp
    attribute :captured_at do |photo|
      photo.captured_at&.iso8601
    end

    # Location data
    attribute :location do |photo|
      next nil unless photo.location.present?

      {
        latitude: photo.latitude,
        longitude: photo.longitude,
        name: photo.location_name
      }
    end

    # Full image URLs (all variants + original)
    attribute :image_urls do |photo|
      {
        thumbnail: PhotoSerializer.generate_variant_url(photo, :thumbnail),
        medium: PhotoSerializer.generate_variant_url(photo, :medium),
        large: PhotoSerializer.generate_variant_url(photo, :large),
        original: PhotoSerializer.generate_original_url(photo)
      }
    end

    # Social counts
    attributes :like_count, :comment_count

    # User who uploaded the photo
    one :user, serializer: UserSerializer::Summary

    # Weather summary (closest to capture time)
    attribute :weather_summary do |photo|
      closest = photo.weather_conditions
        .order(Arel.sql("ABS(EXTRACT(EPOCH FROM (timestamp - '#{photo.captured_at&.to_fs(:db)}'::timestamp)))"))
        .first

      next nil unless closest

      {
        temperature: closest.temperature,
        humidity: closest.humidity,
        weather_description: closest.weather_description,
        sun_elevation: closest.sun_altitude,
        sun_azimuth: closest.sun_azimuth,
        cloud_cover: closest.cloud_cover
      }
    end

    # Recent comments (limited to 10)
    attribute :comments do |photo|
      photo.comments.visible.recent.limit(10).map do |comment|
        {
          id: comment.id,
          content: comment.content,
          user: {
            id: comment.user.id,
            display_name: comment.user.display_name
          },
          created_at: comment.created_at&.iso8601
        }
      end
    end

    # Whether current user has liked this photo
    attribute :liked_by_current_user do |photo, params|
      current_user = params[:current_user]
      next false unless current_user

      photo.liked_by?(current_user)
    end

    # Whether current user owns this photo
    attribute :is_owner do |photo, params|
      current_user = params[:current_user]
      next false unless current_user

      photo.user_id == current_user.id
    end

    # Moderation status (only for owner/admin)
    attribute :moderation_status do |photo, params|
      current_user = params[:current_user]

      # Only show to owner or admin
      if current_user && (photo.user_id == current_user.id || current_user.admin?)
        photo.moderation_status
      end
    end

    # Image dimensions
    attribute :dimensions do |photo|
      next nil unless photo.image_width.present? && photo.image_height.present?

      {
        width: photo.image_width,
        height: photo.image_height
      }
    end

    # Creation timestamp
    attribute :created_at do |photo|
      photo.created_at&.iso8601
    end

    # Update timestamp
    attribute :updated_at do |photo|
      photo.updated_at&.iso8601
    end
  end

  # ===========================================================================
  # Minimal Serializer - Lightweight for performance-critical responses
  # ===========================================================================

  class Minimal < ApplicationSerializer
    attributes :id, :title

    # Thumbnail only
    attribute :thumbnail_url do |photo|
      PhotoSerializer.generate_variant_url(photo, :thumbnail)
    end

    # Location name only
    attribute :location_name do |photo|
      photo.location_name
    end

    attribute :like_count
  end
end
