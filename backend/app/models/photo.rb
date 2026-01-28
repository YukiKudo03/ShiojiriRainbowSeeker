# frozen_string_literal: true

# Photo model for rainbow photo submissions.
#
# The core content model of the Shiojiri Rainbow Seeker application.
# Stores user-submitted rainbow photos with geolocation data using PostGIS.
#
# == Associations
# - belongs_to :user - The user who submitted the photo
# - has_many :weather_conditions - Weather data at capture time
# - has_many :radar_data - Precipitation radar snapshots
# - has_many :comments - User comments on this photo
# - has_many :likes - User likes on this photo
# - has_many :reports - Content moderation reports
# - has_one_attached :image - The original photo (variants generated on-demand)
#
# == Image Variants
# - thumbnail: 400x400 pixels, JPEG 80% quality (for feed/list views)
# - medium: 800x800 pixels, JPEG 85% quality (for detail views)
# - large: 2000x2000 pixels max, JPEG 90% quality (for full-screen views)
#
# == Validations
# - title: Maximum 100 characters (optional)
# - description: Maximum 500 characters (optional)
# - captured_at: Required timestamp of when photo was taken
# - image: Required, max 10MB, formats: JPEG, PNG, GIF, WebP, HEIC
#
# == Moderation Status
# - pending (0): Awaiting review
# - approved (1): Visible to all users
# - hidden (2): Hidden by moderator
# - deleted (3): Soft deleted
#
# == Geographic Features
# Uses PostGIS geography type for location with SRID 4326 (WGS84).
# Provides efficient spatial queries via GiST index.
#
class Photo < ApplicationRecord
  # =============================================================================
  # Constants
  # =============================================================================

  # Maximum file size for uploaded images (10MB)
  MAX_IMAGE_SIZE = 10.megabytes

  # Allowed content types for image uploads
  ALLOWED_CONTENT_TYPES = %w[
    image/jpeg
    image/png
    image/gif
    image/webp
    image/heic
    image/heif
  ].freeze

  # Image variant configurations
  VARIANTS = {
    # Thumbnail for feed/list views (400x400)
    thumbnail: {
      resize_to_limit: [ 400, 400 ],
      format: :jpeg,
      saver: { quality: 80, strip: true }
    },
    # Medium size for detail views (800x800)
    medium: {
      resize_to_limit: [ 800, 800 ],
      format: :jpeg,
      saver: { quality: 85, strip: true }
    },
    # Large size for full-screen views (2000x2000 max)
    large: {
      resize_to_limit: [ 2000, 2000 ],
      format: :jpeg,
      saver: { quality: 90, strip: true }
    }
  }.freeze

  # =============================================================================
  # Active Storage
  # =============================================================================

  # Main image attachment (original uploaded image)
  # Variants are generated on-demand using the VARIANTS configuration
  has_one_attached :image do |attachable|
    # Pre-process variants for faster initial load
    attachable.variant :thumbnail, VARIANTS[:thumbnail]
    attachable.variant :medium, VARIANTS[:medium]
    attachable.variant :large, VARIANTS[:large]
  end

  # Associations
  belongs_to :user
  has_many :weather_conditions, dependent: :destroy
  has_many :radar_data, dependent: :destroy
  has_many :comments, dependent: :destroy
  has_many :likes, dependent: :destroy
  has_many :reports, as: :reportable, dependent: :destroy

  # =============================================================================
  # Validations
  # =============================================================================

  validates :title, length: { maximum: 100 }, allow_nil: true
  validates :description, length: { maximum: 500 }, allow_nil: true
  validates :captured_at, presence: true

  # Image validations
  validate :validate_image_attachment, if: -> { image.attached? }
  validate :validate_image_content_type, if: -> { image.attached? }
  validate :validate_image_size, if: -> { image.attached? }

  # Moderation status enumeration
  enum :moderation_status, { pending: 0, approved: 1, hidden: 2, deleted: 3 }

  # Scopes
  scope :visible, -> { where(is_visible: true, moderation_status: :approved) }
  scope :recent, -> { order(captured_at: :desc) }
  scope :by_user, ->(user) { where(user: user) }
  scope :moderation_pending, -> { where(moderation_status: :pending) }

  # Geographic scopes using PostGIS
  # Find photos within a bounding box defined by southwest and northeast corners
  #
  # @param sw_lat [Float] Southwest corner latitude
  # @param sw_lng [Float] Southwest corner longitude
  # @param ne_lat [Float] Northeast corner latitude
  # @param ne_lng [Float] Northeast corner longitude
  # @return [ActiveRecord::Relation] photos within the bounds
  scope :within_bounds, ->(sw_lat, sw_lng, ne_lat, ne_lng) {
    where("ST_Within(location::geometry, ST_MakeEnvelope(?, ?, ?, ?, 4326))", sw_lng, sw_lat, ne_lng, ne_lat)
  }

  # Find photos within a radius of a center point
  #
  # @param lat [Float] Center latitude
  # @param lng [Float] Center longitude
  # @param radius_meters [Float] Radius in meters
  # @return [ActiveRecord::Relation] photos within the radius
  scope :within_radius, ->(lat, lng, radius_meters) {
    where("ST_DWithin(location, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, ?)", lng, lat, radius_meters)
  }

  # Order by distance from a point (closest first)
  #
  # @param lat [Float] Reference point latitude
  # @param lng [Float] Reference point longitude
  # @return [ActiveRecord::Relation] photos ordered by distance
  scope :nearest_to, ->(lat, lng) {
    select("photos.*, ST_Distance(location, ST_SetSRID(ST_MakePoint(#{connection.quote(lng)}, #{connection.quote(lat)}), 4326)::geography) AS distance")
      .order("distance ASC")
  }

  # Get latitude from PostGIS point
  #
  # @return [Float, nil] Latitude coordinate
  def latitude
    location&.y
  end

  # Get longitude from PostGIS point
  #
  # @return [Float, nil] Longitude coordinate
  def longitude
    location&.x
  end

  # Set location from latitude and longitude
  #
  # @param lat [Float] Latitude coordinate
  # @param lng [Float] Longitude coordinate
  def set_location(lat, lng)
    factory = RGeo::Geographic.spherical_factory(srid: 4326)
    self.location = factory.point(lng, lat)
  end

  # Check if photo has been liked by a user
  #
  # @param user [User] The user to check
  # @return [Boolean] true if the user has liked this photo
  def liked_by?(user)
    likes.exists?(user: user)
  end

  # Increment like count (called by counter_cache on Like)
  # Note: counter_cache handles this automatically
  # This method is here for manual updates if needed
  def increment_like_count!
    increment!(:like_count)
  end

  # Decrement like count
  def decrement_like_count!
    decrement!(:like_count)
  end

  # =============================================================================
  # Image URL Helpers
  # =============================================================================

  # Get URL for image thumbnail variant
  #
  # @return [String, nil] URL for the thumbnail image
  def thumbnail_url
    return nil unless image.attached?

    variant_url(:thumbnail)
  end

  # Get URL for medium-sized image variant
  #
  # @return [String, nil] URL for the medium image
  def medium_url
    return nil unless image.attached?

    variant_url(:medium)
  end

  # Get URL for large image variant
  #
  # @return [String, nil] URL for the large image
  def large_url
    return nil unless image.attached?

    variant_url(:large)
  end

  # Get URL for original image
  #
  # @return [String, nil] URL for the original image
  def original_url
    return nil unless image.attached?

    if Rails.env.production? && ENV["AWS_CLOUDFRONT_HOST"].present?
      "https://#{ENV['AWS_CLOUDFRONT_HOST']}/#{image.key}"
    else
      Rails.application.routes.url_helpers.rails_blob_url(image, only_path: false)
    end
  rescue StandardError => e
    Rails.logger.warn("Failed to generate original URL for photo #{id}: #{e.message}")
    nil
  end

  # Get all image URLs as a hash
  #
  # @return [Hash] Hash containing all image variant URLs
  def image_urls
    {
      thumbnail: thumbnail_url,
      medium: medium_url,
      large: large_url,
      original: original_url
    }
  end

  # Check if image has been processed
  #
  # @return [Boolean] true if the image is attached and analyzed
  def image_processed?
    return false unless image.attached?

    image.analyzed? == true
  end

  # Get image dimensions
  #
  # @return [Hash, nil] Hash with :width and :height, or nil if not available
  def image_dimensions
    return nil unless image_processed?

    metadata = image.metadata
    return nil unless metadata[:width] && metadata[:height]

    { width: metadata[:width], height: metadata[:height] }
  end

  private

  # =============================================================================
  # Private Validation Methods
  # =============================================================================

  # Validate that an image is attached
  def validate_image_attachment
    # This validation is conditional on image.attached?, so if we're here, it's valid
    true
  end

  # Validate image content type
  def validate_image_content_type
    return if ALLOWED_CONTENT_TYPES.include?(image.content_type)

    errors.add(:image, :invalid_content_type,
      message: "must be a JPEG, PNG, GIF, WebP, or HEIC image")
  end

  # Validate image file size
  def validate_image_size
    return if image.byte_size <= MAX_IMAGE_SIZE

    errors.add(:image, :file_too_large,
      message: "must be less than #{MAX_IMAGE_SIZE / 1.megabyte}MB")
  end

  # Generate URL for a specific variant
  #
  # @param variant_name [Symbol] Name of the variant (:thumbnail, :medium, :large)
  # @return [String, nil] URL for the variant
  def variant_url(variant_name)
    return nil unless image.attached?

    variant = image.variant(VARIANTS[variant_name])

    if Rails.env.production? && ENV["AWS_CLOUDFRONT_HOST"].present?
      # Process variant and get CloudFront URL
      processed = variant.processed
      "https://#{ENV['AWS_CLOUDFRONT_HOST']}/#{processed.key}"
    else
      # Use Rails URL helpers for development/test
      Rails.application.routes.url_helpers.rails_blob_url(
        variant.processed,
        only_path: false
      )
    end
  rescue StandardError => e
    Rails.logger.warn("Failed to generate #{variant_name} URL for photo #{id}: #{e.message}")
    nil
  end
end
