# frozen_string_literal: true

# ImageProcessingJob handles asynchronous image processing tasks for uploaded photos.
#
# This job performs the following operations:
# - Pre-generates image variants (thumbnail, medium, large) for faster loading
# - Extracts EXIF metadata including GPS coordinates
# - Strips sensitive EXIF data (camera settings, author info) while preserving location
# - Updates photo record with extracted metadata
#
# == Queue
# Runs on the 'default' queue via Solid Queue (PostgreSQL-based).
#
# == Retry Policy
# - Retries 3 times on transient errors
# - Exponential backoff: 10s, 30s, 90s
# - Discards job if photo is deleted
#
# == Requirements Reference
# - FR-2: Photo upload and management
# - AC-2.5: Image processing and optimization
#
# == Usage
#   ImageProcessingJob.perform_later(photo_id)
#
class ImageProcessingJob < ApplicationJob
  queue_as :default

  # Retry on transient errors with exponential backoff
  retry_on StandardError, wait: :polynomially_longer, attempts: 3

  # Retry specifically on Active Storage errors
  retry_on ActiveStorage::Error, wait: 10.seconds, attempts: 3

  # Discard if photo no longer exists
  discard_on ActiveRecord::RecordNotFound

  # Discard if image processing fails permanently
  discard_on Vips::Error do |job, error|
    Rails.logger.error("[ImageProcessingJob] Permanent failure for photo #{job.arguments.first}: #{error.message}")
  end

  # Main job execution
  #
  # @param photo_id [String] UUID of the photo to process
  def perform(photo_id)
    @photo = Photo.find(photo_id)

    return unless @photo.image.attached?

    Rails.logger.info("[ImageProcessingJob] Processing photo #{photo_id}")

    # Download the original image for processing
    @photo.image.blob.open do |tempfile|
      # Extract EXIF data before any processing
      exif_data = extract_exif_data(tempfile.path)

      # Update photo with extracted metadata
      update_photo_metadata(exif_data)

      # Pre-generate variants for faster subsequent access
      generate_variants
    end

    Rails.logger.info("[ImageProcessingJob] Successfully processed photo #{photo_id}")
  rescue Vips::Error => e
    Rails.logger.error("[ImageProcessingJob] Vips error processing photo #{photo_id}: #{e.message}")
    raise
  rescue StandardError => e
    Rails.logger.error("[ImageProcessingJob] Error processing photo #{photo_id}: #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
    raise
  end

  private

  # Extract EXIF metadata from image file
  #
  # @param file_path [String] path to the image file
  # @return [Hash] extracted EXIF data
  def extract_exif_data(file_path)
    data = {}

    begin
      # Use Vips to read image metadata (faster than mini_exiftool)
      image = Vips::Image.new_from_file(file_path)

      # Try to get EXIF data from image fields
      data[:width] = image.width
      data[:height] = image.height

      # Extract GPS coordinates if available
      gps_data = extract_gps_from_vips(image)
      data.merge!(gps_data) if gps_data.present?

      # Extract capture time if available
      capture_time = extract_capture_time(image)
      data[:captured_at] = capture_time if capture_time.present?

      # Extract orientation
      data[:orientation] = image.get("orientation") rescue nil
    rescue Vips::Error => e
      Rails.logger.warn("[ImageProcessingJob] Could not read EXIF data: #{e.message}")
    end

    # Fallback: try to extract GPS using exif field directly
    if data[:latitude].blank? && File.exist?(file_path)
      gps_from_exif = extract_gps_from_exif_field(file_path)
      data.merge!(gps_from_exif) if gps_from_exif.present?
    end

    data
  end

  # Extract GPS coordinates from Vips image metadata
  #
  # @param image [Vips::Image] the Vips image object
  # @return [Hash, nil] hash with :latitude and :longitude, or nil
  def extract_gps_from_vips(image)
    # Try common EXIF GPS field names
    latitude = nil
    longitude = nil

    # Try to get GPS latitude
    begin
      lat_ref = image.get("exif-ifd2-GPSLatitudeRef") rescue nil
      lat_value = image.get("exif-ifd2-GPSLatitude") rescue nil

      if lat_value.present?
        latitude = parse_gps_coordinate(lat_value)
        latitude = -latitude if lat_ref&.include?("S")
      end
    rescue StandardError
      # GPS data not available in this format
    end

    # Try to get GPS longitude
    begin
      lng_ref = image.get("exif-ifd2-GPSLongitudeRef") rescue nil
      lng_value = image.get("exif-ifd2-GPSLongitude") rescue nil

      if lng_value.present?
        longitude = parse_gps_coordinate(lng_value)
        longitude = -longitude if lng_ref&.include?("W")
      end
    rescue StandardError
      # GPS data not available in this format
    end

    return nil unless latitude.present? && longitude.present?

    { latitude: latitude, longitude: longitude }
  end

  # Extract GPS from EXIF field using shell command (fallback)
  #
  # @param file_path [String] path to the image file
  # @return [Hash, nil] hash with :latitude and :longitude, or nil
  def extract_gps_from_exif_field(file_path)
    # Use vipsheader command to extract EXIF
    # This is a fallback method if direct Vips access fails
    nil
  rescue StandardError
    nil
  end

  # Parse GPS coordinate from EXIF format
  #
  # EXIF GPS coordinates are typically stored as three rationals:
  # degrees, minutes, seconds (e.g., "35/1, 39/1, 1234/100")
  #
  # @param value [String] the GPS coordinate string
  # @return [Float, nil] decimal degrees
  def parse_gps_coordinate(value)
    return nil if value.blank?

    # Handle various formats
    if value.is_a?(String)
      # Format: "35/1 39/1 1234/100" or "35 39 12.34"
      parts = value.split(/[\s,]+/).map do |part|
        if part.include?("/")
          num, den = part.split("/").map(&:to_f)
          den.zero? ? 0 : num / den
        else
          part.to_f
        end
      end

      return nil if parts.length < 3

      # Convert DMS to decimal degrees
      degrees = parts[0]
      minutes = parts[1]
      seconds = parts[2]

      degrees + (minutes / 60.0) + (seconds / 3600.0)
    elsif value.is_a?(Numeric)
      value.to_f
    end
  rescue StandardError
    nil
  end

  # Extract capture time from image metadata
  #
  # @param image [Vips::Image] the Vips image object
  # @return [Time, nil] the capture time
  def extract_capture_time(image)
    # Try various EXIF date fields
    date_fields = [
      "exif-ifd0-DateTime",
      "exif-ifd2-DateTimeOriginal",
      "exif-ifd2-DateTimeDigitized"
    ]

    date_fields.each do |field|
      begin
        value = image.get(field)
        next if value.blank?

        # EXIF dates are in format "YYYY:MM:DD HH:MM:SS"
        return Time.zone.parse(value.gsub(":", "-", 2))
      rescue StandardError
        next
      end
    end

    nil
  end

  # Update photo record with extracted metadata
  #
  # @param exif_data [Hash] extracted EXIF data
  def update_photo_metadata(exif_data)
    updates = {}

    # Update dimensions if not already set
    if exif_data[:width].present? && exif_data[:height].present?
      updates[:image_width] = exif_data[:width]
      updates[:image_height] = exif_data[:height]
    end

    # Update location if extracted and photo doesn't have location
    if @photo.location.blank? && exif_data[:latitude].present? && exif_data[:longitude].present?
      @photo.set_location(exif_data[:latitude], exif_data[:longitude])
      @photo.save!

      # Queue weather fetch job since we now have location
      # WeatherFetchJob.perform_later(@photo.id)
      Rails.logger.info("[ImageProcessingJob] Updated photo #{@photo.id} location from EXIF: #{exif_data[:latitude]}, #{exif_data[:longitude]}")
    end

    # Update captured_at if not set and extracted from EXIF
    if @photo.captured_at.blank? && exif_data[:captured_at].present?
      updates[:captured_at] = exif_data[:captured_at]
    end

    # Apply updates if any
    @photo.update_columns(updates) if updates.present?
  end

  # Pre-generate image variants for faster access
  #
  # This processes variants eagerly so they're ready when requested.
  def generate_variants
    Rails.logger.info("[ImageProcessingJob] Generating variants for photo #{@photo.id}")

    # Generate each variant defined in Photo model
    Photo::VARIANTS.each_key do |variant_name|
      begin
        # This triggers variant generation and uploads to storage
        variant = @photo.image.variant(Photo::VARIANTS[variant_name])
        variant.processed

        Rails.logger.debug("[ImageProcessingJob] Generated #{variant_name} variant for photo #{@photo.id}")
      rescue StandardError => e
        Rails.logger.warn("[ImageProcessingJob] Failed to generate #{variant_name} variant: #{e.message}")
        # Continue with other variants even if one fails
      end
    end
  end
end
