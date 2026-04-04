# frozen_string_literal: true

# WeatherFetchJob handles asynchronous weather data fetching for uploaded photos.
#
# This job is triggered after a photo is uploaded with valid location and capture time.
# It fetches weather data for a time range around the photo's capture time and stores
# it in the database for later analysis and display.
#
# == Data Fetched
# - Weather conditions at 30-minute intervals (13 data points: 3 hours before and after)
# - Radar data at capture time
# - Sun position data (embedded in weather conditions)
# - Rainbow conditions evaluation
#
# == Queue
# Runs on the 'default' queue via Solid Queue (PostgreSQL-based).
#
# == Retry Policy
# - Retries 3 times on transient errors
# - Exponential backoff: 10s, 30s, 90s
# - Discards job if photo is deleted
# - Partial failures are tolerated: available data is saved even if some API calls fail
#
# == Requirements Reference
# - FR-13: Weather condition data
# - AC-13.1: Fetch weather data at capture time
# - AC-13.7: Handle API failures gracefully
#
# == Usage
#   WeatherFetchJob.perform_later(photo_id)
#
class WeatherFetchJob < ApplicationJob
  queue_as :default

  # Retry on transient errors with exponential backoff
  retry_on StandardError, wait: :polynomially_longer, attempts: 3

  # Retry specifically on API errors
  retry_on ExternalApis::WeatherApi::ApiError, wait: 10.seconds, attempts: 3
  retry_on ExternalApis::RadarApi::ApiError, wait: 10.seconds, attempts: 3

  # Discard if photo no longer exists
  discard_on ActiveRecord::RecordNotFound

  # Configuration
  RANGE_HOURS = 3 # Hours before and after capture time
  INTERVAL_MINUTES = 30 # Interval between data points (13 total)

  # Main job execution
  #
  # @param photo_id [String] UUID of the photo to fetch weather for
  def perform(photo_id)
    @photo = Photo.find(photo_id)

    # Validate photo has required data
    unless valid_photo?
      Rails.logger.warn("[WeatherFetchJob] Skipping photo #{photo_id}: missing location or capture time")
      return
    end

    Rails.logger.info("[WeatherFetchJob] Fetching weather data for photo #{photo_id}")

    @weather_service = WeatherService.new
    @lat = @photo.latitude
    @lng = @photo.longitude
    @captured_at = @photo.captured_at

    # Fetch and store weather data
    weather_data_saved = fetch_and_store_weather_data
    radar_data_saved = fetch_and_store_radar_data

    # Log completion status
    if weather_data_saved || radar_data_saved
      Rails.logger.info("[WeatherFetchJob] Successfully processed photo #{photo_id}: " \
                        "weather=#{weather_data_saved}, radar=#{radar_data_saved}")
    else
      Rails.logger.warn("[WeatherFetchJob] No weather data saved for photo #{photo_id}")
    end
  rescue ExternalApis::WeatherApi::ConfigurationError => e
    # Don't retry if API is not configured
    Rails.logger.error("[WeatherFetchJob] Weather API not configured: #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[WeatherFetchJob] Error processing photo #{photo_id}: #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
    raise
  end

  private

  # Validate that photo has required location and capture time
  #
  # @return [Boolean] true if photo has valid data
  def valid_photo?
    @photo.latitude.present? && @photo.longitude.present? && @photo.captured_at.present?
  end

  # Fetch weather data for time range and store in database
  #
  # @return [Boolean] true if any data was saved
  def fetch_and_store_weather_data
    # Generate timestamps for the time range
    timestamps = generate_timestamps

    saved_count = 0

    timestamps.each do |timestamp|
      begin
        weather_data = fetch_weather_at_timestamp(timestamp)
        next unless weather_data

        # Create or update weather condition record
        save_weather_condition(timestamp, weather_data)
        saved_count += 1
      rescue StandardError => e
        Rails.logger.warn("[WeatherFetchJob] Failed to fetch weather at #{timestamp}: #{e.message}")
        # Continue with other timestamps even if one fails
      end
    end

    Rails.logger.info("[WeatherFetchJob] Saved #{saved_count}/#{timestamps.length} weather data points for photo #{@photo.id}")
    saved_count > 0
  end

  # Fetch radar data at capture time and store in database
  #
  # @return [Boolean] true if radar data was saved
  def fetch_and_store_radar_data
    result = @weather_service.fetch_radar_data(lat: @lat, lng: @lng, timestamp: @captured_at)

    unless result[:success]
      Rails.logger.warn("[WeatherFetchJob] Failed to fetch radar data: #{result[:error][:message]}")
      return false
    end

    radar_data = result[:data][:radar]
    save_radar_data(radar_data)
    true
  rescue StandardError => e
    Rails.logger.warn("[WeatherFetchJob] Error fetching radar data: #{e.message}")
    false
  end

  # Generate timestamps for the time range
  #
  # @return [Array<Time>] array of timestamps at INTERVAL_MINUTES intervals
  def generate_timestamps
    timestamps = []
    interval_seconds = INTERVAL_MINUTES * 60
    range_seconds = RANGE_HOURS * 3600

    start_time = @captured_at - range_seconds
    end_time = @captured_at + range_seconds

    current = start_time
    while current <= end_time
      timestamps << current
      current += interval_seconds
    end

    timestamps
  end

  # Fetch weather data at a specific timestamp
  #
  # @param timestamp [Time] the timestamp to fetch weather for
  # @return [Hash, nil] weather data hash or nil if failed
  def fetch_weather_at_timestamp(timestamp)
    # Use historical data fetch for past times, current for recent times
    if timestamp > Time.current - 5.minutes
      result = @weather_service.fetch_current_conditions(lat: @lat, lng: @lng)
    else
      result = @weather_service.fetch_historical_data(lat: @lat, lng: @lng, timestamp: timestamp)
    end

    return nil unless result[:success]

    result[:data][:weather]
  end

  # Save weather condition to database
  #
  # @param timestamp [Time] the weather observation timestamp
  # @param weather_data [Hash] the weather data from API
  def save_weather_condition(timestamp, weather_data)
    # Find existing or build new weather condition
    weather_condition = @photo.weather_conditions.find_or_initialize_by(
      timestamp: round_to_interval(timestamp)
    )

    # Update with fetched data
    weather_condition.assign_attributes(
      temperature: weather_data[:temperature],
      humidity: weather_data[:humidity],
      pressure: weather_data[:pressure],
      weather_code: weather_data[:weather_code]&.to_s,
      weather_description: weather_data[:weather_description],
      wind_speed: weather_data[:wind_speed],
      wind_direction: weather_data[:wind_direction],
      wind_gust: weather_data[:wind_gust],
      precipitation: weather_data[:rain_1h] || weather_data[:snow_1h] || 0,
      precipitation_type: determine_precipitation_type(weather_data),
      cloud_cover: weather_data[:cloud_cover],
      visibility: weather_data[:visibility],
      sun_azimuth: weather_data.dig(:sun_position, :azimuth),
      sun_altitude: weather_data.dig(:sun_position, :altitude)
    )

    weather_condition.save!

    Rails.logger.debug("[WeatherFetchJob] Saved weather condition for #{timestamp}: " \
                       "temp=#{weather_data[:temperature]}, humidity=#{weather_data[:humidity]}")
  end

  # Save radar data to database
  #
  # @param radar_data [Hash] the radar data from API
  def save_radar_data(radar_data)
    # Find existing or build new radar data
    radar_datum = @photo.radar_data.find_or_initialize_by(
      timestamp: radar_data[:timestamp]
    )

    # Set center location
    radar_datum.set_center_location(@lat, @lng)

    # Extract precipitation data from weather conditions at capture time
    capture_weather = @photo.weather_conditions.find_by(
      timestamp: round_to_interval(@captured_at)
    )

    precipitation_intensity = extract_precipitation_intensity(capture_weather)
    precipitation_area = build_precipitation_area(@lat, @lng, capture_weather)

    # Update with fetched data
    radar_datum.assign_attributes(
      radius: 50_000, # 50km default radius
      precipitation_intensity: precipitation_intensity,
      precipitation_area: precipitation_area
    )

    radar_datum.save!

    # Update weather conditions at capture time with radar reference
    capture_weather = @photo.weather_conditions.find_by(timestamp: round_to_interval(@captured_at))
    capture_weather&.update(radar_datum: radar_datum)

    Rails.logger.debug("[WeatherFetchJob] Saved radar data for #{radar_data[:timestamp]}: " \
                       "tile_url=#{radar_data[:tile_url]&.truncate(50)}")
  end

  # Round timestamp to nearest interval for consistent storage
  #
  # @param time [Time] the time to round
  # @return [Time] rounded time
  def round_to_interval(time)
    interval_seconds = INTERVAL_MINUTES * 60
    Time.at((time.to_i / interval_seconds.to_f).round * interval_seconds).utc
  end

  # Determine precipitation type from weather data
  #
  # @param weather_data [Hash] the weather data
  # @return [String, nil] precipitation type
  def determine_precipitation_type(weather_data)
    return nil unless weather_data[:weather_code]

    code = weather_data[:weather_code].to_i

    case code
    when 200..299
      "thunderstorm"
    when 300..399
      "drizzle"
    when 500..599
      "rain"
    when 600..699
      "snow"
    when 700..799
      "atmosphere" # fog, mist, etc.
    else
      nil
    end
  end

  # Extract precipitation intensity from weather conditions
  #
  # Uses rain_1h/snow_1h from weather data if available,
  # otherwise estimates from weather code.
  #
  # @param weather_condition [WeatherCondition, nil] the weather condition record
  # @return [Float, nil] precipitation intensity in mm/h
  def extract_precipitation_intensity(weather_condition)
    return nil unless weather_condition

    # Direct precipitation measurement if available
    return weather_condition.precipitation if weather_condition.precipitation&.positive?

    # Estimate from weather code
    code = weather_condition.weather_code&.to_i
    return nil unless code

    case code
    when 500      then 0.5   # light rain
    when 501      then 2.5   # moderate rain
    when 502      then 7.5   # heavy rain
    when 503, 504 then 15.0  # very heavy rain
    when 511      then 1.0   # freezing rain
    when 520      then 1.0   # light shower rain
    when 521      then 5.0   # shower rain
    when 522      then 10.0  # heavy shower rain
    when 300..321 then 0.3   # drizzle
    when 200..232 then 3.0   # thunderstorm
    when 600..622 then 1.0   # snow (water equivalent)
    end
  end

  # Build a simplified precipitation area polygon around the observation point
  #
  # Creates a bounding box based on weather conditions to approximate
  # the precipitation coverage area.
  #
  # @param lat [Float] center latitude
  # @param lng [Float] center longitude
  # @param weather_condition [WeatherCondition, nil] the weather condition
  # @return [Hash, nil] GeoJSON-style polygon or nil
  def build_precipitation_area(lat, lng, weather_condition)
    return nil unless weather_condition
    return nil unless weather_condition.precipitation&.positive? || weather_condition.weather_code&.to_i&.between?(200, 622)

    # Estimate area radius based on weather code (in degrees, ~1 degree ≈ 111km)
    code = weather_condition.weather_code&.to_i
    radius_deg = case code
    when 200..232 then 0.3  # thunderstorms - localized
    when 300..321 then 0.5  # drizzle - wider coverage
    when 500..531 then 0.4  # rain
    when 600..622 then 0.5  # snow - wider coverage
    else 0.3
    end

    # Build a simple bounding box as GeoJSON polygon
    {
      type: "Polygon",
      coordinates: [ [
        [ lng - radius_deg, lat - radius_deg ],
        [ lng + radius_deg, lat - radius_deg ],
        [ lng + radius_deg, lat + radius_deg ],
        [ lng - radius_deg, lat + radius_deg ],
        [ lng - radius_deg, lat - radius_deg ]
      ] ]
    }
  end
end
