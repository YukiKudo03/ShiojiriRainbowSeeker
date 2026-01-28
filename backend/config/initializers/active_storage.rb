# frozen_string_literal: true

# Active Storage Configuration
# ============================
# Additional configuration for Active Storage beyond what's in storage.yml

Rails.application.config.after_initialize do
  # Configure Active Storage routes for direct uploads (mobile app)
  # This enables presigned URL generation for uploading directly to S3
  Rails.application.routes.draw do
    direct :cdn_image do |blob, options|
      # Generate CDN URL if CloudFront is configured, otherwise use default
      if ENV["AWS_CLOUDFRONT_HOST"].present? && Rails.env.production?
        "https://#{ENV['AWS_CLOUDFRONT_HOST']}/#{blob.key}"
      else
        route_for(:rails_blob, blob, options)
      end
    end
  end

  # Configure analyzers (for image metadata extraction)
  # Disable video analyzer since we only handle images
  Rails.application.config.active_storage.analyzers = [
    ActiveStorage::Analyzer::ImageAnalyzer::Vips,
    ActiveStorage::Analyzer::ImageAnalyzer::ImageMagick
  ]

  # Configure variant processor (vips is faster and more memory efficient)
  Rails.application.config.active_storage.variant_processor = :vips

  # Configure content types that are considered variable (can have variants)
  Rails.application.config.active_storage.variable_content_types = %w[
    image/png
    image/gif
    image/jpeg
    image/webp
    image/heic
    image/heif
  ]

  # Configure content types allowed for upload
  # Restricting to common image formats for security
  Rails.application.config.active_storage.web_image_content_types = %w[
    image/png
    image/jpeg
    image/gif
    image/webp
  ]

  # Configure service URL expiration for presigned URLs (15 minutes)
  Rails.application.config.active_storage.service_urls_expire_in = 15.minutes

  # Configure direct upload URL expiration (5 minutes)
  Rails.application.config.active_storage.direct_upload_url_expiration = 5.minutes

  # Enable tracking for blob downloads (useful for analytics)
  Rails.application.config.active_storage.track_variants = true
end

# Custom URL helpers for Active Storage with CDN support
module ActiveStorageUrlHelpers
  extend ActiveSupport::Concern

  # Generate image URL with CDN support
  #
  # @param blob [ActiveStorage::Blob] The blob to generate URL for
  # @param variant [Hash, nil] Variant transformations (e.g., { resize_to_limit: [400, 400] })
  # @return [String] URL for the image
  def cdn_url_for(blob, variant: nil)
    return nil unless blob.attached?

    if variant
      blob_to_use = blob.variant(variant).processed
    else
      blob_to_use = blob
    end

    if ENV["AWS_CLOUDFRONT_HOST"].present? && Rails.env.production?
      # Return CloudFront CDN URL
      "https://#{ENV['AWS_CLOUDFRONT_HOST']}/#{blob_to_use.key}"
    else
      # Return standard Rails URL
      Rails.application.routes.url_helpers.rails_blob_url(blob_to_use, only_path: false)
    end
  rescue ActiveStorage::Error => e
    Rails.logger.warn("Failed to generate URL for blob: #{e.message}")
    nil
  end

  # Generate thumbnail URL (convenience method)
  #
  # @param blob [ActiveStorage::Blob] The blob to generate thumbnail for
  # @param size [Integer] Maximum dimension for the thumbnail
  # @return [String] URL for the thumbnail
  def thumbnail_url_for(blob, size: 400)
    cdn_url_for(blob, variant: { resize_to_limit: [ size, size ], format: :jpeg, saver: { quality: 80 } })
  end
end

# Include helpers in controllers and serializers
ActiveSupport.on_load(:action_controller) do
  include ActiveStorageUrlHelpers
end
