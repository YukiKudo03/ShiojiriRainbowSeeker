# frozen_string_literal: true

# WeatherService provides weather data processing business logic for the Shiojiri Rainbow Seeker API.
#
# This service object encapsulates all weather-related operations including:
# - Current weather conditions fetching from OpenWeatherMap
# - Historical weather data retrieval
# - Radar data fetching from RainViewer
# - Sun position calculation using SunCalc
# - Rainbow conditions evaluation
#
# == Caching
# Weather data is cached using Solid Cache for 15 minutes to reduce API calls.
#
# == Error Handling
# All external API calls are wrapped in error handling to gracefully handle failures.
#
# == Usage
#   service = WeatherService.new
#
#   # Fetch current conditions
#   result = service.fetch_current_conditions(lat: 36.115, lng: 137.954)
#
#   # Check rainbow conditions
#   conditions = service.check_rainbow_conditions(
#     lat: 36.115, lng: 137.954, time: Time.current
#   )
#
class WeatherService
  # Cache duration for weather data (15 minutes)
  CACHE_DURATION = 15.minutes

  # Cache key prefixes
  CACHE_PREFIX_CURRENT = "weather:current"
  CACHE_PREFIX_HISTORICAL = "weather:historical"
  CACHE_PREFIX_RADAR = "weather:radar"
  CACHE_PREFIX_SUN = "weather:sun"

  # Rainbow formation conditions thresholds
  RAINBOW_CONDITIONS = {
    # Sun altitude range for rainbow visibility (degrees)
    # Rainbows are most visible when sun is 40-42° from horizon (opposite direction)
    # This means sun altitude should be between ~0° and ~42°
    sun_altitude_min: 0,
    sun_altitude_max: 42,

    # Humidity threshold (%)
    humidity_min: 50,

    # Cloud cover max (%) - need some clear sky to see rainbow
    cloud_cover_max: 80,

    # Recent precipitation required
    precipitation_required: true,

    # Visibility minimum (meters)
    visibility_min: 1000
  }.freeze

  def initialize
    @weather_api = ExternalApis::WeatherApi.new
    @radar_api = ExternalApis::RadarApi.new
    @cache = {}
  rescue ExternalApis::WeatherApi::ConfigurationError => e
    log_warn("WeatherService: Weather API not configured - #{e.message}")
    @weather_api = nil
    @radar_api = ExternalApis::RadarApi.new
    @cache = {}
  end

  # Result structure for successful operations
  def success_result(data)
    { success: true, data: data }
  end

  # Result structure for failed operations
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

  # Fetch current weather conditions for a location
  #
  # @param lat [Float] latitude
  # @param lng [Float] longitude
  # @param use_cache [Boolean] whether to use cached data (default: true)
  # @return [Hash] result with :success, :data or :error
  def fetch_current_conditions(lat:, lng:, use_cache: true)
    return api_not_configured_error unless @weather_api

    cache_key = "#{CACHE_PREFIX_CURRENT}:#{lat.round(3)}:#{lng.round(3)}"

    data = if use_cache
             cache_fetch(cache_key, expires_in: CACHE_DURATION) do
               fetch_current_from_api(lat, lng)
             end
    else
             fetch_current_from_api(lat, lng)
    end

    return data if data.is_a?(Hash) && data[:success] == false

    # Add sun position data
    sun_position = calculate_sun_position(lat: lat, lng: lng, time: Time.current)
    data = data.merge(sun_position: sun_position[:data]) if sun_position[:success]

    success_result(weather: data)
  rescue Faraday::TimeoutError, Faraday::ConnectionFailed => e
    log_error("WeatherService#fetch_current_conditions timeout: #{e.message}")
    failure_result(
      code: ErrorHandler::ErrorCodes::TIMEOUT_ERROR,
      message: "Weather API request timed out. Please try again."
    )
  rescue ExternalApis::WeatherApi::RateLimitError => e
    failure_result(
      code: ErrorHandler::ErrorCodes::RATE_LIMIT_ERROR,
      message: "Weather API rate limit exceeded. Please try again later."
    )
  rescue ExternalApis::WeatherApi::ApiError => e
    failure_result(
      code: ErrorHandler::ErrorCodes::WEATHER_API_ERROR,
      message: "Failed to fetch weather data: #{e.message}"
    )
  rescue StandardError => e
    log_error("WeatherService#fetch_current_conditions error: #{e.message}")
    failure_result(
      code: ErrorHandler::ErrorCodes::INTERNAL_ERROR,
      message: "An unexpected error occurred"
    )
  end

  # Fetch historical weather data for a specific time
  #
  # @param lat [Float] latitude
  # @param lng [Float] longitude
  # @param timestamp [Time] the time to fetch weather for
  # @param use_cache [Boolean] whether to use cached data (default: true)
  # @return [Hash] result with :success, :data or :error
  def fetch_historical_data(lat:, lng:, timestamp:, use_cache: true)
    return api_not_configured_error unless @weather_api

    # Round timestamp to nearest 30 minutes for cache efficiency
    rounded_timestamp = round_to_30_minutes(timestamp)
    cache_key = "#{CACHE_PREFIX_HISTORICAL}:#{lat.round(3)}:#{lng.round(3)}:#{rounded_timestamp.to_i}"

    data = if use_cache
             cache_fetch(cache_key, expires_in: 24.hours) do
               fetch_historical_from_api(lat, lng, rounded_timestamp)
             end
    else
             fetch_historical_from_api(lat, lng, rounded_timestamp)
    end

    return data if data.is_a?(Hash) && data[:success] == false

    # Add sun position data for the historical time
    sun_position = calculate_sun_position(lat: lat, lng: lng, time: rounded_timestamp)
    data = data.merge(sun_position: sun_position[:data]) if sun_position[:success]

    success_result(weather: data)
  rescue ExternalApis::WeatherApi::ApiError => e
    failure_result(
      code: ErrorHandler::ErrorCodes::WEATHER_API_ERROR,
      message: "Failed to fetch historical weather data: #{e.message}"
    )
  rescue StandardError => e
    log_error("WeatherService#fetch_historical_data error: #{e.message}")
    failure_result(
      code: ErrorHandler::ErrorCodes::INTERNAL_ERROR,
      message: "An unexpected error occurred"
    )
  end

  # Fetch weather data for multiple timestamps (for a photo's time range)
  #
  # @param lat [Float] latitude
  # @param lng [Float] longitude
  # @param center_time [Time] the center time (usually photo captured_at)
  # @param range_hours [Integer] hours before and after center_time (default: 3)
  # @param interval_minutes [Integer] interval between data points (default: 30)
  # @return [Hash] result with :success, :data or :error
  def fetch_time_range_data(lat:, lng:, center_time:, range_hours: 3, interval_minutes: 30)
    return api_not_configured_error unless @weather_api

    timestamps = generate_timestamps(center_time, range_hours, interval_minutes)

    weather_data = timestamps.filter_map do |ts|
      result = fetch_historical_data(lat: lat, lng: lng, timestamp: ts)
      if result[:success]
        result[:data][:weather].merge(requested_time: ts)
      else
        log_warn("Failed to fetch weather for #{ts}: #{result[:error][:message]}")
        nil
      end
    end

    success_result(
      weather_timeline: weather_data,
      center_time: center_time,
      range_hours: range_hours,
      data_points: weather_data.length
    )
  rescue StandardError => e
    log_error("WeatherService#fetch_time_range_data error: #{e.message}")
    failure_result(
      code: ErrorHandler::ErrorCodes::INTERNAL_ERROR,
      message: "An unexpected error occurred"
    )
  end

  # Fetch radar data for a location
  #
  # @param lat [Float] latitude
  # @param lng [Float] longitude
  # @param timestamp [Time, nil] specific timestamp (nil for latest)
  # @param use_cache [Boolean] whether to use cached data (default: true)
  # @return [Hash] result with :success, :data or :error
  def fetch_radar_data(lat:, lng:, timestamp: nil, use_cache: true)
    ts_key = timestamp&.to_i || "latest"
    cache_key = "#{CACHE_PREFIX_RADAR}:#{lat.round(3)}:#{lng.round(3)}:#{ts_key}"

    data = if use_cache
             cache_fetch(cache_key, expires_in: 5.minutes) do
               @radar_api.get_radar_data(lat: lat, lng: lng, timestamp: timestamp)
             end
    else
             @radar_api.get_radar_data(lat: lat, lng: lng, timestamp: timestamp)
    end

    return failure_result(code: ErrorHandler::ErrorCodes::WEATHER_API_ERROR, message: "No radar data available") unless data

    success_result(radar: data)
  rescue ExternalApis::RadarApi::ApiError => e
    failure_result(
      code: ErrorHandler::ErrorCodes::WEATHER_API_ERROR,
      message: "Failed to fetch radar data: #{e.message}"
    )
  rescue StandardError => e
    log_error("WeatherService#fetch_radar_data error: #{e.message}")
    failure_result(
      code: ErrorHandler::ErrorCodes::INTERNAL_ERROR,
      message: "An unexpected error occurred"
    )
  end

  # Fetch radar timeline data (past + nowcast)
  #
  # @param lat [Float] latitude
  # @param lng [Float] longitude
  # @return [Hash] result with :success, :data or :error
  def fetch_radar_timeline(lat:, lng:)
    past_data = @radar_api.get_precipitation_timeline(lat: lat, lng: lng, count: 7)
    nowcast_data = @radar_api.get_nowcast(lat: lat, lng: lng)

    success_result(
      radar_timeline: {
        past: past_data,
        nowcast: nowcast_data
      }
    )
  rescue ExternalApis::RadarApi::ApiError => e
    failure_result(
      code: ErrorHandler::ErrorCodes::WEATHER_API_ERROR,
      message: "Failed to fetch radar timeline: #{e.message}"
    )
  rescue StandardError => e
    log_error("WeatherService#fetch_radar_timeline error: #{e.message}")
    failure_result(
      code: ErrorHandler::ErrorCodes::INTERNAL_ERROR,
      message: "An unexpected error occurred"
    )
  end

  # Calculate sun position for a given location and time
  #
  # @param lat [Float] latitude
  # @param lng [Float] longitude
  # @param time [Time] the time to calculate for
  # @return [Hash] result with :success, :data or :error
  def calculate_sun_position(lat:, lng:, time:)
    # SunCalc returns azimuth and altitude in radians
    position = SunCalc.get_position(time, lat, lng)

    # Convert radians to degrees
    altitude_deg = radians_to_degrees(position[:altitude])
    azimuth_deg = radians_to_degrees(position[:azimuth])

    # Normalize azimuth to 0-360 (SunCalc uses -π to π, where 0 is south)
    # Convert to standard compass bearing (0 = north, 90 = east)
    azimuth_compass = normalize_azimuth(azimuth_deg)

    # Get sun times for the day
    sun_times = SunCalc.get_times(time, lat, lng)

    success_result(
      altitude: altitude_deg,
      azimuth: azimuth_compass,
      azimuth_raw: azimuth_deg,
      is_daytime: altitude_deg > 0,
      sunrise: sun_times[:sunrise]&.to_time,
      sunset: sun_times[:sunset]&.to_time,
      solar_noon: sun_times[:solar_noon]&.to_time,
      golden_hour_start: sun_times[:golden_hour]&.to_time,
      golden_hour_end: sun_times[:golden_hour_end]&.to_time
    )
  rescue StandardError => e
    log_error("WeatherService#calculate_sun_position error: #{e.message}")
    failure_result(
      code: ErrorHandler::ErrorCodes::INTERNAL_ERROR,
      message: "Failed to calculate sun position"
    )
  end

  # Check if conditions are favorable for rainbow formation
  #
  # @param lat [Float] latitude
  # @param lng [Float] longitude
  # @param time [Time] the time to check
  # @param weather_data [Hash, nil] pre-fetched weather data (optional)
  # @return [Hash] result with :success, :data or :error
  def check_rainbow_conditions(lat:, lng:, time:, weather_data: nil)
    # Get weather data if not provided
    if weather_data.nil?
      weather_result = fetch_current_conditions(lat: lat, lng: lng)
      return weather_result unless weather_result[:success]

      weather_data = weather_result[:data][:weather]
    end

    # Get sun position
    sun_result = calculate_sun_position(lat: lat, lng: lng, time: time)
    return sun_result unless sun_result[:success]

    sun_data = sun_result[:data]

    # Evaluate each condition
    conditions = evaluate_rainbow_conditions(weather_data, sun_data)

    # Calculate overall score (0-100)
    score = calculate_rainbow_score(conditions)

    # Determine rainbow direction (opposite of sun)
    rainbow_direction = calculate_rainbow_direction(sun_data[:azimuth])

    success_result(
      is_favorable: score >= 60,
      score: score,
      conditions: conditions,
      rainbow_direction: rainbow_direction,
      sun_altitude: sun_data[:altitude],
      sun_azimuth: sun_data[:azimuth],
      recommendations: generate_recommendations(conditions, score)
    )
  rescue StandardError => e
    log_error("WeatherService#check_rainbow_conditions error: #{e.message}")
    failure_result(
      code: ErrorHandler::ErrorCodes::INTERNAL_ERROR,
      message: "Failed to check rainbow conditions"
    )
  end

  # Fetch all weather data for a photo (for WeatherFetchJob)
  #
  # @param photo [Photo] the photo record
  # @return [Hash] result with :success, :data or :error
  def fetch_weather_for_photo(photo)
    return failure_result(code: ErrorHandler::ErrorCodes::VALIDATION_FAILED, message: "Photo has no location") unless photo.latitude && photo.longitude
    return failure_result(code: ErrorHandler::ErrorCodes::VALIDATION_FAILED, message: "Photo has no captured_at") unless photo.captured_at

    lat = photo.latitude
    lng = photo.longitude
    captured_at = photo.captured_at

    # Fetch time range weather data
    weather_result = fetch_time_range_data(
      lat: lat,
      lng: lng,
      center_time: captured_at,
      range_hours: 3,
      interval_minutes: 30
    )

    # Fetch radar data
    radar_result = fetch_radar_data(lat: lat, lng: lng, timestamp: captured_at)

    # Check rainbow conditions at capture time
    rainbow_result = check_rainbow_conditions(lat: lat, lng: lng, time: captured_at)

    success_result(
      weather_timeline: weather_result[:success] ? weather_result[:data][:weather_timeline] : [],
      radar: radar_result[:success] ? radar_result[:data][:radar] : nil,
      rainbow_conditions: rainbow_result[:success] ? rainbow_result[:data] : nil
    )
  rescue StandardError => e
    log_error("WeatherService#fetch_weather_for_photo error: #{e.message}")
    failure_result(
      code: ErrorHandler::ErrorCodes::INTERNAL_ERROR,
      message: "Failed to fetch weather data for photo"
    )
  end

  private

  def api_not_configured_error
    failure_result(
      code: ErrorHandler::ErrorCodes::WEATHER_API_ERROR,
      message: "Weather API is not configured. Please set OPENWEATHERMAP_API_KEY environment variable."
    )
  end

  def fetch_current_from_api(lat, lng)
    @weather_api.current_weather(lat: lat, lng: lng)
  end

  def fetch_historical_from_api(lat, lng, timestamp)
    @weather_api.historical_weather(lat: lat, lng: lng, timestamp: timestamp)
  end

  def round_to_30_minutes(time)
    Time.at((time.to_i / 1800.0).round * 1800).utc
  end

  def generate_timestamps(center_time, range_hours, interval_minutes)
    interval_seconds = interval_minutes * 60
    range_seconds = range_hours * 3600

    start_time = center_time - range_seconds
    end_time = center_time + range_seconds

    timestamps = []
    current = start_time
    while current <= end_time
      timestamps << current
      current += interval_seconds
    end
    timestamps
  end

  def radians_to_degrees(radians)
    radians * 180.0 / Math::PI
  end

  def normalize_azimuth(azimuth_deg)
    # SunCalc azimuth: 0 = south, positive = west
    # Convert to compass: 0 = north, 90 = east
    compass = azimuth_deg + 180
    compass -= 360 while compass >= 360
    compass += 360 while compass < 0
    compass.round(1)
  end

  def evaluate_rainbow_conditions(weather_data, sun_data)
    {
      sun_altitude: {
        value: sun_data[:altitude]&.round(1),
        favorable: sun_data[:altitude].present? &&
                   sun_data[:altitude] >= RAINBOW_CONDITIONS[:sun_altitude_min] &&
                   sun_data[:altitude] <= RAINBOW_CONDITIONS[:sun_altitude_max],
        reason: sun_altitude_reason(sun_data[:altitude])
      },
      humidity: {
        value: weather_data[:humidity],
        favorable: weather_data[:humidity].present? &&
                   weather_data[:humidity] >= RAINBOW_CONDITIONS[:humidity_min],
        reason: humidity_reason(weather_data[:humidity])
      },
      cloud_cover: {
        value: weather_data[:cloud_cover],
        favorable: weather_data[:cloud_cover].present? &&
                   weather_data[:cloud_cover] <= RAINBOW_CONDITIONS[:cloud_cover_max],
        reason: cloud_cover_reason(weather_data[:cloud_cover])
      },
      precipitation: {
        value: has_recent_precipitation?(weather_data),
        favorable: has_recent_precipitation?(weather_data),
        reason: precipitation_reason(weather_data)
      },
      visibility: {
        value: weather_data[:visibility],
        favorable: weather_data[:visibility].present? &&
                   weather_data[:visibility] >= RAINBOW_CONDITIONS[:visibility_min],
        reason: visibility_reason(weather_data[:visibility])
      }
    }
  end

  def has_recent_precipitation?(weather_data)
    rain = weather_data[:rain_1h] || 0
    snow = weather_data[:snow_1h] || 0
    weather_code = weather_data[:weather_code]

    # Rain codes: 200-531, Snow codes: 600-622
    precipitation_codes = (200..531).to_a + (600..622).to_a

    rain > 0 || snow > 0 || precipitation_codes.include?(weather_code)
  end

  def sun_altitude_reason(altitude)
    return "Sun position unknown" unless altitude

    if altitude < RAINBOW_CONDITIONS[:sun_altitude_min]
      "Sun is below horizon (#{altitude.round(1)}°)"
    elsif altitude > RAINBOW_CONDITIONS[:sun_altitude_max]
      "Sun is too high (#{altitude.round(1)}°) - rainbows form when sun is lower"
    else
      "Sun altitude is optimal (#{altitude.round(1)}°)"
    end
  end

  def humidity_reason(humidity)
    return "Humidity unknown" unless humidity

    if humidity < RAINBOW_CONDITIONS[:humidity_min]
      "Humidity too low (#{humidity}%) - need moisture in the air"
    else
      "Humidity is sufficient (#{humidity}%)"
    end
  end

  def cloud_cover_reason(cloud_cover)
    return "Cloud cover unknown" unless cloud_cover

    if cloud_cover > RAINBOW_CONDITIONS[:cloud_cover_max]
      "Too cloudy (#{cloud_cover}%) - need some clear sky to see rainbow"
    else
      "Cloud cover is acceptable (#{cloud_cover}%)"
    end
  end

  def precipitation_reason(weather_data)
    if has_recent_precipitation?(weather_data)
      "Recent precipitation detected - water droplets present"
    else
      "No recent precipitation - rainbows need water droplets"
    end
  end

  def visibility_reason(visibility)
    return "Visibility unknown" unless visibility

    if visibility < RAINBOW_CONDITIONS[:visibility_min]
      "Visibility too low (#{visibility}m)"
    else
      "Visibility is good (#{visibility}m)"
    end
  end

  def calculate_rainbow_score(conditions)
    weights = {
      sun_altitude: 30,
      precipitation: 30,
      humidity: 15,
      cloud_cover: 15,
      visibility: 10
    }

    total_weight = weights.values.sum
    score = 0

    conditions.each do |key, condition|
      score += weights[key] if condition[:favorable]
    end

    ((score.to_f / total_weight) * 100).round
  end

  def calculate_rainbow_direction(sun_azimuth)
    return nil unless sun_azimuth

    # Rainbow appears opposite to the sun
    rainbow_azimuth = (sun_azimuth + 180) % 360

    {
      azimuth: rainbow_azimuth.round(1),
      cardinal: azimuth_to_cardinal(rainbow_azimuth),
      description: "Look #{azimuth_to_cardinal(rainbow_azimuth)} (opposite the sun)"
    }
  end

  def azimuth_to_cardinal(azimuth)
    directions = %w[N NNE NE ENE E ESE SE SSE S SSW SW WSW W WNW NW NNW]
    index = ((azimuth + 11.25) / 22.5).floor % 16
    directions[index]
  end

  def generate_recommendations(conditions, score)
    recommendations = []

    if score >= 80
      recommendations << "Excellent rainbow conditions! Keep watching the sky."
    elsif score >= 60
      recommendations << "Good chance of seeing a rainbow."
    elsif score >= 40
      recommendations << "Some favorable conditions, but rainbow unlikely."
    else
      recommendations << "Conditions not favorable for rainbows."
    end

    conditions.each do |key, condition|
      next if condition[:favorable]

      case key
      when :sun_altitude
        recommendations << "Wait for sun to be lower in the sky (early morning or late afternoon)."
      when :precipitation
        recommendations << "Watch for rain showers with breaks in the clouds."
      when :humidity
        recommendations << "Humidity is low - rainbows more likely after rain."
      when :cloud_cover
        recommendations << "Wait for some clearing in the clouds."
      when :visibility
        recommendations << "Poor visibility may obscure any rainbow."
      end
    end

    recommendations
  end

  # Cache helper that works with or without Rails
  def cache_fetch(key, expires_in:)
    if defined?(Rails) && Rails.respond_to?(:cache) && Rails.cache
      Rails.cache.fetch(key, expires_in: expires_in) { yield }
    else
      # Simple in-memory cache for testing
      if @cache[key] && @cache[key][:expires_at] > Time.current
        @cache[key][:value]
      else
        value = yield
        @cache[key] = { value: value, expires_at: Time.current + expires_in }
        value
      end
    end
  end

  # Logging helpers that work with or without Rails
  def log_error(message)
    if defined?(Rails) && Rails.respond_to?(:logger) && Rails.logger
      Rails.logger.error(message)
    end
  end

  def log_warn(message)
    if defined?(Rails) && Rails.respond_to?(:logger) && Rails.logger
      Rails.logger.warn(message)
    end
  end
end
