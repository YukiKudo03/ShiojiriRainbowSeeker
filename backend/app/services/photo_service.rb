# frozen_string_literal: true

# PhotoService provides photo management business logic for the Shiojiri Rainbow Seeker API.
#
# This service object encapsulates all photo-related operations including:
# - Photo creation with image upload and geolocation
# - Photo retrieval with associated data (weather, comments, likes)
# - Photo listing with filtering, pagination, and sorting
# - Photo update and deletion
# - Weather data fetching via background jobs
#
# == Error Codes
# Uses ErrorHandler error codes for consistency:
# - 2003: Validation failed
# - 3001: Photo not found
# - 4002: S3 upload error
#
# == Usage
#   service = PhotoService.new
#   result = service.create(
#     user: current_user,
#     image: uploaded_file,
#     metadata: { title: 'Rainbow', latitude: 36.115, longitude: 137.954 }
#   )
#
#   if result[:success]
#     photo = result[:data][:photo]
#   else
#     error_code = result[:error][:code]
#   end
#
class PhotoService
  # Default number of items per page for listing
  DEFAULT_PER_PAGE = 20

  # Maximum items per page
  MAX_PER_PAGE = 100

  # Result structure for successful operations
  #
  # @param data [Hash] the data to return
  # @return [Hash] success result with data
  def success_result(data)
    { success: true, data: data }
  end

  # Result structure for failed operations
  #
  # @param code [Integer] error code
  # @param message [String] error message
  # @param details [Hash, nil] additional error details
  # @return [Hash] failure result with error info
  def failure_result(code:, message:, details: nil)
    result = {
      success: false,
      error: {
        code: code,
        message: message
      }
    }
    result[:error][:details] = details if details.present?
    result
  end

  # Create a new photo with image upload
  #
  # Creates a photo record, attaches the uploaded image, sets geolocation,
  # and queues a background job to fetch weather data.
  #
  # @param user [User] the user creating the photo
  # @param image [ActionDispatch::Http::UploadedFile] the uploaded image file
  # @param metadata [Hash] photo metadata
  # @option metadata [String] :title optional title (max 100 chars)
  # @option metadata [String] :description optional description (max 500 chars)
  # @option metadata [Float] :latitude GPS latitude coordinate
  # @option metadata [Float] :longitude GPS longitude coordinate
  # @option metadata [String] :location_name optional location name
  # @option metadata [DateTime] :captured_at when the photo was taken
  # @return [Hash] result with :success, :data or :error
  #
  # @example
  #   result = PhotoService.new.create(
  #     user: current_user,
  #     image: params[:image],
  #     metadata: {
  #       title: 'Beautiful Rainbow',
  #       latitude: 36.115,
  #       longitude: 137.954,
  #       captured_at: Time.current
  #     }
  #   )
  def create(user:, image:, metadata:)
    # Validate required parameters
    unless image.present?
      return failure_result(
        code: ErrorHandler::ErrorCodes::VALIDATION_FAILED,
        message: "Image is required"
      )
    end

    unless metadata[:captured_at].present?
      return failure_result(
        code: ErrorHandler::ErrorCodes::VALIDATION_FAILED,
        message: "captured_at is required"
      )
    end

    # Build photo record
    photo = user.photos.build(
      title: metadata[:title],
      description: metadata[:description],
      location_name: metadata[:location_name],
      captured_at: parse_datetime(metadata[:captured_at])
    )

    # Set geolocation if provided
    if metadata[:latitude].present? && metadata[:longitude].present?
      photo.set_location(
        metadata[:latitude].to_f,
        metadata[:longitude].to_f
      )
    end

    # Attach image
    photo.image.attach(image)

    # Validate and save
    if photo.save
      # Queue weather data fetch job if location is provided
      enqueue_weather_fetch(photo) if photo.location.present?

      success_result(
        photo: photo_data(photo),
        message: "Photo created successfully"
      )
    else
      failure_result(
        code: ErrorHandler::ErrorCodes::VALIDATION_FAILED,
        message: "Failed to create photo",
        details: { errors: photo.errors.full_messages }
      )
    end
  rescue ActiveStorage::Error => e
    Rails.logger.error("S3 upload error: #{e.message}")
    failure_result(
      code: ErrorHandler::ErrorCodes::S3_UPLOAD_ERROR,
      message: "Failed to upload image",
      details: { error: e.message }
    )
  rescue ActiveRecord::NotNullViolation => e
    Rails.logger.error("Database constraint violation: #{e.message}")
    failure_result(
      code: ErrorHandler::ErrorCodes::VALIDATION_FAILED,
      message: "Required field missing",
      details: { error: e.message }
    )
  end

  # Find a photo with all associated details
  #
  # Retrieves a photo with eager-loaded associations to prevent N+1 queries.
  # Includes weather conditions, comments, and like status.
  #
  # @param photo_id [String] the photo UUID
  # @param current_user [User, nil] optional current user for like status
  # @return [Hash] result with :success, :data or :error
  #
  # @example
  #   result = PhotoService.new.find_with_details(
  #     photo_id: '123e4567-e89b-12d3-a456-426614174000',
  #     current_user: current_user
  #   )
  def find_with_details(photo_id:, current_user: nil)
    photo = Photo
      .includes(:user, :weather_conditions, :radar_data, comments: :user, image_attachment: :blob)
      .find_by(id: photo_id)

    unless photo
      return failure_result(
        code: ErrorHandler::ErrorCodes::PHOTO_NOT_FOUND,
        message: "Photo not found"
      )
    end

    # Check visibility
    unless photo_visible?(photo, current_user)
      return failure_result(
        code: ErrorHandler::ErrorCodes::NOT_AUTHORIZED,
        message: "Photo is not accessible"
      )
    end

    success_result(
      photo: photo_data_with_details(photo, current_user)
    )
  end

  # List photos with filtering and pagination
  #
  # Returns a paginated list of photos with optional filtering.
  # Uses includes to prevent N+1 queries.
  #
  # @param filters [Hash] filter options
  # @option filters [String] :user_id filter by user
  # @option filters [Float] :latitude center latitude for radius search
  # @option filters [Float] :longitude center longitude for radius search
  # @option filters [Float] :radius_meters search radius in meters (default 10km)
  # @option filters [Float] :sw_lat southwest latitude for bounds
  # @option filters [Float] :sw_lng southwest longitude for bounds
  # @option filters [Float] :ne_lat northeast latitude for bounds
  # @option filters [Float] :ne_lng northeast longitude for bounds
  # @option filters [Date] :start_date filter by captured_at >= date
  # @option filters [Date] :end_date filter by captured_at <= date
  # @option filters [String] :keyword search in title/description
  # @option filters [String] :sort_by sort field (default: captured_at)
  # @option filters [String] :sort_order asc or desc (default: desc)
  # @param page [Integer] page number (1-based)
  # @param per_page [Integer] items per page
  # @param current_user [User, nil] optional current user for owned photos
  # @return [Hash] result with :success, :data (including pagination) or :error
  #
  # @example
  #   result = PhotoService.new.list(
  #     filters: { latitude: 36.115, longitude: 137.954, radius_meters: 5000 },
  #     page: 1,
  #     per_page: 20
  #   )
  def list(filters: {}, page: 1, per_page: DEFAULT_PER_PAGE, current_user: nil)
    # Sanitize pagination parameters
    page = [ page.to_i, 1 ].max
    per_page = [ [ per_page.to_i, 1 ].max, MAX_PER_PAGE ].min

    # Build base query with eager loading
    # Include user and Active Storage attachments to prevent N+1 queries
    photos = Photo
      .includes(:user, image_attachment: :blob)
      .visible

    # Apply filters
    photos = apply_filters(photos, filters, current_user)

    # Apply sorting
    photos = apply_sorting(photos, filters)

    # Apply pagination
    paginated = photos.page(page).per(per_page)

    # Build response with optional caching
    photos_data = paginated.map { |p| cached_photo_data(p) }

    success_result(
      photos: photos_data,
      pagination: {
        currentPage: paginated.current_page,
        totalPages: paginated.total_pages,
        totalCount: paginated.total_count,
        perPage: per_page
      }
    )
  end

  # Update a photo's metadata
  #
  # Updates photo title, description, or location.
  # Only the photo owner can update.
  #
  # @param photo [Photo] the photo to update
  # @param params [Hash] update parameters
  # @option params [String] :title new title (max 100 chars)
  # @option params [String] :description new description (max 500 chars)
  # @option params [Float] :latitude new latitude
  # @option params [Float] :longitude new longitude
  # @option params [String] :location_name new location name
  # @param current_user [User] the user performing the update
  # @return [Hash] result with :success, :data or :error
  #
  # @example
  #   result = PhotoService.new.update(
  #     photo: photo,
  #     params: { title: 'Updated Title' },
  #     current_user: current_user
  #   )
  def update(photo:, params:, current_user:)
    # Check ownership
    unless photo.user_id == current_user.id || current_user.admin?
      return failure_result(
        code: ErrorHandler::ErrorCodes::NOT_AUTHORIZED,
        message: "You can only update your own photos"
      )
    end

    # Build update attributes
    update_attrs = {}
    update_attrs[:title] = params[:title] if params.key?(:title)
    update_attrs[:description] = params[:description] if params.key?(:description)
    update_attrs[:location_name] = params[:location_name] if params.key?(:location_name)

    # Update geolocation if both coordinates provided
    if params[:latitude].present? && params[:longitude].present?
      photo.set_location(params[:latitude].to_f, params[:longitude].to_f)

      # Re-fetch weather data for new location
      enqueue_weather_fetch(photo)
    end

    # Apply updates
    if photo.update(update_attrs)
      success_result(
        photo: photo_data(photo),
        message: "Photo updated successfully"
      )
    else
      failure_result(
        code: ErrorHandler::ErrorCodes::VALIDATION_FAILED,
        message: "Failed to update photo",
        details: { errors: photo.errors.full_messages }
      )
    end
  end

  # Delete a photo
  #
  # Soft deletes the photo by setting moderation_status to :deleted.
  # Also removes the attached image from storage.
  # Only the photo owner or admin can delete.
  #
  # @param photo [Photo] the photo to delete
  # @param current_user [User] the user performing the deletion
  # @return [Hash] result with :success, :data or :error
  #
  # @example
  #   result = PhotoService.new.destroy(
  #     photo: photo,
  #     current_user: current_user
  #   )
  def destroy(photo:, current_user:)
    # Check ownership
    unless photo.user_id == current_user.id || current_user.admin?
      return failure_result(
        code: ErrorHandler::ErrorCodes::NOT_AUTHORIZED,
        message: "You can only delete your own photos"
      )
    end

    # Soft delete by setting moderation status
    photo.update!(
      moderation_status: :deleted,
      is_visible: false
    )

    # Optionally purge the image (uncomment if you want hard delete of files)
    # photo.image.purge_later if photo.image.attached?

    success_result(
      message: "Photo deleted successfully"
    )
  rescue ActiveRecord::RecordInvalid => e
    failure_result(
      code: ErrorHandler::ErrorCodes::DATABASE_ERROR,
      message: "Failed to delete photo",
      details: { error: e.message }
    )
  end

  # Get weather data for a photo
  #
  # Retrieves all associated weather conditions and radar data.
  #
  # @param photo_id [String] the photo UUID
  # @return [Hash] result with :success, :data or :error
  #
  # @example
  #   result = PhotoService.new.weather_data(photo_id: photo.id)
  def weather_data(photo_id:)
    photo = Photo
      .includes(:weather_conditions, :radar_data)
      .find_by(id: photo_id)

    unless photo
      return failure_result(
        code: ErrorHandler::ErrorCodes::PHOTO_NOT_FOUND,
        message: "Photo not found"
      )
    end

    success_result(
      weatherConditions: photo.weather_conditions.order(timestamp: :asc).map { |wc| weather_condition_data(wc) },
      radarData: photo.radar_data.order(timestamp: :asc).map { |rd| radar_datum_data(rd) },
      rainbowConditions: rainbow_conditions_summary(photo)
    )
  end

  private

  # =============================================================================
  # Filter & Sort Methods
  # =============================================================================

  # Apply filters to the query
  #
  # @param query [ActiveRecord::Relation] base query
  # @param filters [Hash] filter options
  # @param current_user [User, nil] current user
  # @return [ActiveRecord::Relation] filtered query
  def apply_filters(query, filters, current_user)
    # User filter
    query = query.by_user(User.find(filters[:user_id])) if filters[:user_id].present?

    # Include own photos (even if not approved) for current user
    if current_user.present? && filters[:include_own]
      query = query.or(Photo.where(user_id: current_user.id))
    end

    # Radius filter (latitude, longitude, radius_meters)
    if filters[:latitude].present? && filters[:longitude].present?
      radius = filters[:radius_meters].presence || 10_000 # Default 10km
      query = query.within_radius(
        filters[:latitude].to_f,
        filters[:longitude].to_f,
        radius.to_f
      )
    end

    # Bounding box filter
    if filters[:sw_lat].present? && filters[:sw_lng].present? &&
       filters[:ne_lat].present? && filters[:ne_lng].present?
      query = query.within_bounds(
        filters[:sw_lat].to_f,
        filters[:sw_lng].to_f,
        filters[:ne_lat].to_f,
        filters[:ne_lng].to_f
      )
    end

    # Date range filter
    if filters[:start_date].present?
      query = query.where("captured_at >= ?", parse_date(filters[:start_date]).beginning_of_day)
    end

    if filters[:end_date].present?
      query = query.where("captured_at <= ?", parse_date(filters[:end_date]).end_of_day)
    end

    # Keyword search
    if filters[:keyword].present?
      keyword = "%#{filters[:keyword]}%"
      query = query.where("title ILIKE ? OR description ILIKE ?", keyword, keyword)
    end

    query
  end

  # Apply sorting to the query
  #
  # @param query [ActiveRecord::Relation] base query
  # @param filters [Hash] filter options including sort_by, sort_order
  # @return [ActiveRecord::Relation] sorted query
  def apply_sorting(query, filters)
    sort_by = filters[:sort_by].presence || "captured_at"
    sort_order = filters[:sort_order]&.downcase == "asc" ? :asc : :desc

    # Whitelist of allowed sort columns
    allowed_sorts = %w[captured_at created_at like_count comment_count]
    sort_by = "captured_at" unless allowed_sorts.include?(sort_by)

    query.order(sort_by => sort_order)
  end

  # =============================================================================
  # Data Formatting Methods
  # =============================================================================

  # Format photo data for API response (list view)
  #
  # @param photo [Photo] the photo to format
  # @return [Hash] formatted photo data
  def photo_data(photo)
    {
      id: photo.id,
      title: photo.title,
      description: photo.description,
      capturedAt: photo.captured_at&.iso8601,
      location: location_data(photo),
      imageUrls: {
        thumbnail: photo.thumbnail_url,
        medium: photo.medium_url
      },
      likeCount: photo.like_count,
      commentCount: photo.comment_count,
      user: user_summary(photo.user),
      createdAt: photo.created_at&.iso8601
    }
  end

  # Format photo data with caching for list views
  # Uses Solid Cache for fragment caching to improve feed performance
  #
  # @param photo [Photo] the photo to format
  # @return [Hash] formatted photo data (cached)
  def cached_photo_data(photo)
    cache_key = "photo_data/v1/#{photo.id}/#{photo.updated_at.to_i}"
    Rails.cache.fetch(cache_key, expires_in: 15.minutes) do
      photo_data(photo)
    end
  end

  # Format photo data with full details for API response (detail view)
  #
  # @param photo [Photo] the photo to format
  # @param current_user [User, nil] optional current user for like status
  # @return [Hash] formatted photo data with details (camelCase for JS clients)
  def photo_data_with_details(photo, current_user = nil)
    photo_data(photo).merge(
      imageUrls: photo.image_urls,
      weatherSummary: weather_summary(photo),
      comments: photo.comments.limit(10).map { |c| comment_data(c) },
      likedByCurrentUser: current_user ? photo.liked_by?(current_user) : false,
      moderationStatus: photo.moderation_status,
      isOwner: current_user ? photo.user_id == current_user.id : false
    )
  end

  # Format location data
  #
  # @param photo [Photo] the photo
  # @return [Hash, nil] location data or nil
  def location_data(photo)
    return nil unless photo.location.present?

    {
      latitude: photo.latitude,
      longitude: photo.longitude,
      name: photo.location_name
    }
  end

  # Format user summary
  #
  # @param user [User] the user
  # @return [Hash] user summary
  def user_summary(user)
    return nil unless user

    {
      id: user.id,
      displayName: user.display_name
    }
  end

  # Format weather condition data
  #
  # @param wc [WeatherCondition] weather condition
  # @return [Hash] formatted weather data
  def weather_condition_data(wc)
    {
      id: wc.id,
      timestamp: wc.timestamp&.iso8601,
      temperature: wc.temperature,
      humidity: wc.humidity,
      pressure: wc.pressure,
      windSpeed: wc.wind_speed,
      windDirection: wc.wind_direction,
      windGust: wc.wind_gust,
      weatherCode: wc.weather_code,
      weatherDescription: wc.weather_description,
      precipitation: wc.precipitation,
      precipitationType: wc.precipitation_type,
      cloudCover: wc.cloud_cover,
      visibility: wc.visibility,
      sunAzimuth: wc.sun_azimuth,
      sunAltitude: wc.sun_altitude,
      rainbowFavorable: wc.rainbow_favorable_sun_position? && wc.rainbow_favorable_weather?
    }
  end

  # Format radar datum data
  #
  # @param rd [RadarDatum] radar datum
  # @return [Hash] formatted radar data
  def radar_datum_data(rd)
    {
      id: rd.id,
      timestamp: rd.timestamp&.iso8601,
      precipitationIntensity: rd.precipitation_intensity,
      precipitationArea: rd.precipitation_area,
      radius: rd.radius,
      centerLatitude: rd.center_latitude,
      centerLongitude: rd.center_longitude
    }
  end

  # Format comment data
  #
  # @param comment [Comment] the comment
  # @return [Hash] formatted comment data
  def comment_data(comment)
    {
      id: comment.id,
      content: comment.content,
      user: user_summary(comment.user),
      createdAt: comment.created_at&.iso8601
    }
  end

  # Get weather summary for a photo
  #
  # @param photo [Photo] the photo
  # @return [Hash, nil] weather summary at capture time
  def weather_summary(photo)
    return nil unless photo.captured_at

    # Find weather condition closest to capture time
    closest = photo.weather_conditions
      .order(Arel.sql("ABS(EXTRACT(EPOCH FROM (timestamp - '#{photo.captured_at.to_fs(:db)}'::timestamp)))"))
      .first

    return nil unless closest

    {
      temperature: closest.temperature,
      humidity: closest.humidity,
      weatherDescription: closest.weather_description,
      cloudCover: closest.cloud_cover,
      sunAzimuth: closest.sun_azimuth,
      sunAltitude: closest.sun_altitude,
      rainbowFavorable: closest.rainbow_favorable_sun_position? && closest.rainbow_favorable_weather?
    }
  end

  # Get rainbow conditions summary for a photo
  #
  # @param photo [Photo] the photo
  # @return [Hash] rainbow conditions summary
  def rainbow_conditions_summary(photo)
    return { available: false, message: "No weather data available" } if photo.weather_conditions.empty?

    # Find weather at capture time
    capture_weather = weather_at_capture_time(photo)
    return { available: false, message: "No weather data at capture time" } unless capture_weather

    # Check if conditions are favorable
    sun_favorable = capture_weather.rainbow_favorable_sun_position?
    weather_favorable = capture_weather.rainbow_favorable_weather?
    overall_favorable = sun_favorable && weather_favorable

    {
      available: true,
      isFavorable: overall_favorable,
      sunPositionFavorable: sun_favorable,
      weatherFavorable: weather_favorable,
      sunAltitude: capture_weather.sun_altitude,
      sunAzimuth: capture_weather.sun_azimuth,
      humidity: capture_weather.humidity,
      precipitation: capture_weather.precipitation,
      cloudCover: capture_weather.cloud_cover,
      recommendations: generate_recommendations(capture_weather)
    }
  end

  # Find weather condition at capture time
  #
  # @param photo [Photo] the photo
  # @return [WeatherCondition, nil] weather condition at capture time
  def weather_at_capture_time(photo)
    return nil unless photo.captured_at

    photo.weather_conditions
      .order(Arel.sql("ABS(EXTRACT(EPOCH FROM (timestamp - '#{photo.captured_at.to_fs(:db)}'::timestamp)))"))
      .first
  end

  # Generate rainbow recommendations based on conditions
  #
  # @param weather [WeatherCondition] the weather condition
  # @return [Array<String>] recommendations
  def generate_recommendations(weather)
    recommendations = []

    # Sun position recommendations
    if weather.sun_altitude.present?
      if weather.sun_altitude < 0
        recommendations << "Sun is below horizon - rainbows not visible"
      elsif weather.sun_altitude > 42
        recommendations << "Sun is too high for optimal rainbow viewing"
      elsif weather.sun_altitude.between?(5, 42)
        recommendations << "Sun angle is favorable for rainbow visibility"
      end
    end

    # Weather recommendations
    if weather.precipitation.present? && weather.precipitation > 0
      recommendations << "Precipitation present - good for rainbow formation"
    else
      recommendations << "No precipitation detected - rainbows unlikely"
    end

    if weather.humidity.present?
      if weather.humidity >= 60
        recommendations << "High humidity supports rainbow formation"
      else
        recommendations << "Low humidity may reduce rainbow intensity"
      end
    end

    if weather.cloud_cover.present?
      if weather.cloud_cover < 70
        recommendations << "Partial cloud cover allows sunlight through"
      else
        recommendations << "Heavy cloud cover may block sunlight needed for rainbows"
      end
    end

    recommendations
  end

  # =============================================================================
  # Helper Methods
  # =============================================================================

  # Check if photo is visible to user
  #
  # @param photo [Photo] the photo
  # @param current_user [User, nil] the current user
  # @return [Boolean] true if visible
  def photo_visible?(photo, current_user)
    return true if photo.approved? && photo.is_visible

    # Owner can always see their own photos
    return true if current_user && photo.user_id == current_user.id

    # Admin can see all photos
    return true if current_user&.admin?

    false
  end

  # Parse datetime string or return value if already a time
  #
  # @param value [String, Time, DateTime] the datetime value
  # @return [Time, nil] parsed time
  def parse_datetime(value)
    return nil if value.blank?
    return value if value.is_a?(Time) || value.is_a?(DateTime)

    Time.zone.parse(value.to_s)
  rescue ArgumentError
    nil
  end

  # Parse date string or return value if already a date
  #
  # @param value [String, Date] the date value
  # @return [Date, nil] parsed date
  def parse_date(value)
    return nil if value.blank?
    return value if value.is_a?(Date)

    Date.parse(value.to_s)
  rescue ArgumentError
    nil
  end

  # Enqueue weather fetch job for a photo
  #
  # @param photo [Photo] the photo
  def enqueue_weather_fetch(photo)
    Rails.logger.info("[PhotoService] Enqueuing WeatherFetchJob for photo #{photo.id}")
    WeatherFetchJob.perform_later(photo.id)
  end
end
