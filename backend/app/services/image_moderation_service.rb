# frozen_string_literal: true

# ImageModerationService handles automated content filtering for uploaded images.
#
# Provides an interface for detecting inappropriate content in photo uploads.
# Uses a pluggable backend architecture - can integrate with various moderation APIs:
# - AWS Rekognition Content Moderation
# - Google Cloud Vision SafeSearch
# - Azure Content Moderator
#
# Falls back to basic filename/metadata checks when no external API is configured.
#
# == Requirements
# - F-2: Image Content Moderation
#
# == Usage
#   service = ImageModerationService.new
#   result = service.moderate(photo)
#
#   if result[:approved]
#     # Photo passed moderation
#   else
#     # Photo flagged for manual review
#     photo.update(moderation_status: :flagged)
#   end
#
class ImageModerationService
  # Confidence threshold for auto-rejection (0.0-1.0)
  AUTO_REJECT_THRESHOLD = 0.90

  # Confidence threshold for flagging for manual review (0.0-1.0)
  FLAG_THRESHOLD = 0.60

  # Categories to check for inappropriate content
  MODERATION_CATEGORIES = %w[
    explicit_nudity
    violence
    visually_disturbing
    drugs
    hate_symbols
  ].freeze

  # Maximum file size (20MB)
  MAX_FILE_SIZE = 20.megabytes

  # Allowed content types
  ALLOWED_CONTENT_TYPES = %w[
    image/jpeg
    image/png
    image/webp
    image/heic
    image/heif
  ].freeze

  def initialize
    @logger = Rails.logger
    @backend = detect_backend
  end

  # Moderate an uploaded photo
  #
  # @param photo [Photo] The photo to moderate
  # @return [Hash] Moderation result
  #   - :approved [Boolean] Whether the photo passed moderation
  #   - :action [Symbol] :approved, :flagged, or :rejected
  #   - :reasons [Array<String>] Reasons for flagging/rejection
  #   - :confidence [Float] Overall moderation confidence (0.0-1.0)
  #   - :categories [Hash] Per-category moderation scores
  def moderate(photo)
    return validation_error("Photo is required") unless photo
    return validation_error("Photo has no image attached") unless photo.image.attached?

    # Step 1: Basic validation checks
    validation_result = validate_image_metadata(photo)
    return validation_result unless validation_result[:approved]

    # Step 2: Run content moderation
    moderation_result = run_moderation(photo)

    # Step 3: Determine action based on results
    determine_action(moderation_result)
  rescue StandardError => e
    @logger.error("[ImageModerationService] Error moderating photo #{photo&.id}: #{e.message}")
    # On error, approve but flag for manual review
    {
      approved: true,
      action: :flagged,
      reasons: ["Moderation check failed - flagged for manual review"],
      confidence: 0.0,
      error: e.message
    }
  end

  # Batch moderate multiple photos
  #
  # @param photos [Array<Photo>] Photos to moderate
  # @return [Array<Hash>] Moderation results
  def moderate_batch(photos)
    photos.map { |photo| { photo_id: photo.id, result: moderate(photo) } }
  end

  private

  def detect_backend
    if ENV["AWS_REKOGNITION_ENABLED"].present?
      :aws_rekognition
    elsif ENV["GOOGLE_VISION_ENABLED"].present?
      :google_vision
    else
      :basic
    end
  end

  # Validate basic image metadata (size, type, etc.)
  def validate_image_metadata(photo)
    reasons = []

    # Check file size
    blob = photo.image.blob
    if blob.byte_size > MAX_FILE_SIZE
      reasons << "File size exceeds #{MAX_FILE_SIZE / 1.megabyte}MB limit"
    end

    # Check content type
    unless ALLOWED_CONTENT_TYPES.include?(blob.content_type)
      reasons << "Invalid content type: #{blob.content_type}"
    end

    if reasons.any?
      {
        approved: false,
        action: :rejected,
        reasons: reasons,
        confidence: 1.0,
        categories: {}
      }
    else
      { approved: true }
    end
  end

  # Run content moderation based on configured backend
  def run_moderation(photo)
    case @backend
    when :aws_rekognition
      moderate_with_rekognition(photo)
    when :google_vision
      moderate_with_google_vision(photo)
    else
      moderate_basic(photo)
    end
  end

  # Basic moderation (no external API)
  # Checks filename patterns and image metadata
  def moderate_basic(photo)
    categories = {}
    reasons = []

    blob = photo.image.blob

    # Check filename for suspicious patterns
    filename = blob.filename.to_s.downcase
    suspicious_patterns = /(nsfw|adult|xxx|explicit)/
    if filename.match?(suspicious_patterns)
      categories["suspicious_filename"] = 0.8
      reasons << "Suspicious filename detected"
    end

    # Check if image dimensions are reasonable
    if blob.metadata.present?
      width = blob.metadata[:width]
      height = blob.metadata[:height]

      if width && height
        aspect_ratio = width.to_f / height.to_f
        # Extremely unusual aspect ratios might indicate non-photo content
        if aspect_ratio > 10.0 || aspect_ratio < 0.1
          categories["unusual_dimensions"] = 0.7
          reasons << "Unusual image dimensions"
        end
      end
    end

    {
      categories: categories,
      reasons: reasons,
      max_confidence: categories.values.max || 0.0
    }
  end

  # AWS Rekognition content moderation (stub - implement when API is configured)
  def moderate_with_rekognition(photo)
    # This would call AWS Rekognition DetectModerationLabels API
    # For now, fall back to basic moderation
    @logger.info("[ImageModerationService] AWS Rekognition moderation would run here")
    moderate_basic(photo)
  end

  # Google Cloud Vision SafeSearch (stub - implement when API is configured)
  def moderate_with_google_vision(photo)
    # This would call Google Cloud Vision SafeSearch Detection API
    # For now, fall back to basic moderation
    @logger.info("[ImageModerationService] Google Vision moderation would run here")
    moderate_basic(photo)
  end

  # Determine final action based on moderation results
  def determine_action(moderation_result)
    max_confidence = moderation_result[:max_confidence]
    categories = moderation_result[:categories]
    reasons = moderation_result[:reasons]

    if max_confidence >= AUTO_REJECT_THRESHOLD
      {
        approved: false,
        action: :rejected,
        reasons: reasons,
        confidence: max_confidence,
        categories: categories
      }
    elsif max_confidence >= FLAG_THRESHOLD
      {
        approved: true,
        action: :flagged,
        reasons: reasons,
        confidence: max_confidence,
        categories: categories
      }
    else
      {
        approved: true,
        action: :approved,
        reasons: [],
        confidence: max_confidence,
        categories: categories
      }
    end
  end

  def validation_error(message)
    {
      approved: false,
      action: :rejected,
      reasons: [message],
      confidence: 1.0,
      categories: {}
    }
  end
end
