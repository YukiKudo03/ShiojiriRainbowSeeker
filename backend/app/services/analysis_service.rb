# frozen_string_literal: true

# AnalysisService provides rainbow sighting analysis and statistics
# for the Shiojiri Rainbow Seeker API.
#
# This service handles:
# - Regional statistics and comparison
# - Rainbow occurrence trends and patterns
# - Weather condition correlations
# - Data export for research purposes
#
# == Requirements
# - FR-13: Rainbow condition analysis
# - AC-13.5: Region-based statistics
# - AC-13.6: Trend analysis
# - AC-13.8: Dataset export
#
# == Usage
#   service = AnalysisService.new
#   result = service.region_stats(
#     region_id: "daimon",
#     period: { start_date: "2024-01-01", end_date: "2024-12-31" }
#   )
#
class AnalysisService
  # Cache TTL for analysis data (longer than map data due to computational cost)
  CACHE_TTL = 30.minutes

  # Default period for trend analysis (days)
  DEFAULT_TREND_PERIOD = 365

  # Maximum records for export
  MAX_EXPORT_RECORDS = 10_000

  # Predefined regions for Shiojiri area
  REGIONS = {
    "daimon" => {
      name: "大門地区",
      center: { lat: 36.115, lng: 137.954 },
      radius: 3000 # meters
    },
    "shiojiri_central" => {
      name: "塩尻市中心部",
      center: { lat: 36.116, lng: 137.949 },
      radius: 5000
    },
    "shiojiri_city" => {
      name: "塩尻市全域",
      center: { lat: 36.100, lng: 137.950 },
      radius: 15000
    }
  }.freeze

  # Get regional statistics for rainbow sightings
  #
  # @param region_id [String] predefined region identifier or "custom"
  # @param period [Hash] time period with :start_date and :end_date
  # @param center [Hash] custom center point (for region_id: "custom")
  # @param radius [Float] custom radius in meters (for region_id: "custom")
  # @return [Hash] result with regional statistics
  def region_stats(region_id:, period: {}, center: nil, radius: nil)
    region = resolve_region(region_id, center, radius)
    return region if region[:success] == false

    cache_key = build_cache_key("region_stats", region_id, period)
    cached_result = fetch_from_cache(cache_key)
    return cached_result if cached_result

    stats = calculate_region_stats(region, period)

    result = success_result(
      region: {
        id: region_id,
        name: region[:name],
        center: region[:center],
        radius: region[:radius]
      },
      period: format_period(period),
      statistics: stats
    )

    store_in_cache(cache_key, result)
    result
  rescue StandardError => e
    log_error("Failed to calculate region stats: #{e.message}")
    failure_result(
      code: ErrorHandler::ErrorCodes::INTERNAL_ERROR,
      message: "Failed to calculate regional statistics"
    )
  end

  # Get rainbow occurrence trends over time
  #
  # @param period [Hash] time period
  # @param group_by [String] grouping (day, week, month, year)
  # @param region_id [String] optional region filter
  # @return [Hash] result with trend data
  def rainbow_trends(period: {}, group_by: "month", region_id: nil)
    cache_key = build_cache_key("rainbow_trends", period, group_by, region_id)
    cached_result = fetch_from_cache(cache_key)
    return cached_result if cached_result

    trends = calculate_trends(period, group_by, region_id)

    result = success_result(
      period: format_period(period),
      group_by: group_by,
      region_id: region_id,
      trends: trends[:time_series],
      summary: trends[:summary]
    )

    store_in_cache(cache_key, result)
    result
  rescue StandardError => e
    log_error("Failed to calculate trends: #{e.message}")
    failure_result(
      code: ErrorHandler::ErrorCodes::INTERNAL_ERROR,
      message: "Failed to calculate rainbow trends"
    )
  end

  # Get weather condition correlations with rainbow sightings
  #
  # @param period [Hash] time period
  # @param region_id [String] optional region filter
  # @return [Hash] result with correlation data
  def weather_correlations(period: {}, region_id: nil)
    cache_key = build_cache_key("weather_correlations", period, region_id)
    cached_result = fetch_from_cache(cache_key)
    return cached_result if cached_result

    correlations = calculate_weather_correlations(period, region_id)

    result = success_result(
      period: format_period(period),
      region_id: region_id,
      correlations: correlations
    )

    store_in_cache(cache_key, result)
    result
  rescue StandardError => e
    log_error("Failed to calculate weather correlations: #{e.message}")
    failure_result(
      code: ErrorHandler::ErrorCodes::INTERNAL_ERROR,
      message: "Failed to calculate weather correlations"
    )
  end

  # Export dataset for research purposes
  #
  # @param period [Hash] time period
  # @param region_id [String] optional region filter
  # @param format [String] export format (json, csv)
  # @param include_weather [Boolean] include weather data
  # @return [Hash] result with export data or job ID for async export
  def export_dataset(period: {}, region_id: nil, format: "json", include_weather: true)
    # Count total records first
    count = count_export_records(period, region_id)

    if count > MAX_EXPORT_RECORDS
      # Queue background job for large exports
      job_id = queue_export_job(period, region_id, format, include_weather)
      return success_result(
        status: "queued",
        job_id: job_id,
        estimated_records: count,
        message: "Export job queued. Large dataset will be processed in background."
      )
    end

    # Perform synchronous export for smaller datasets
    data = build_export_data(period, region_id, include_weather)

    success_result(
      status: "complete",
      format: format,
      record_count: data.length,
      data: format_export(data, format),
      metadata: export_metadata(period, region_id)
    )
  rescue StandardError => e
    log_error("Failed to export dataset: #{e.message}")
    failure_result(
      code: ErrorHandler::ErrorCodes::INTERNAL_ERROR,
      message: "Failed to export dataset"
    )
  end

  # Compare statistics between regions
  #
  # @param region_ids [Array<String>] regions to compare
  # @param period [Hash] time period
  # @return [Hash] result with comparison data
  def compare_regions(region_ids:, period: {})
    cache_key = build_cache_key("compare_regions", region_ids.sort, period)
    cached_result = fetch_from_cache(cache_key)
    return cached_result if cached_result

    comparisons = region_ids.map do |region_id|
      stats_result = region_stats(region_id: region_id, period: period)
      next nil unless stats_result[:success]

      {
        region_id: region_id,
        region_name: stats_result[:data][:region][:name],
        statistics: stats_result[:data][:statistics]
      }
    end.compact

    # Calculate rankings
    rankings = calculate_rankings(comparisons)

    result = success_result(
      period: format_period(period),
      regions: comparisons,
      rankings: rankings
    )

    store_in_cache(cache_key, result)
    result
  rescue StandardError => e
    log_error("Failed to compare regions: #{e.message}")
    failure_result(
      code: ErrorHandler::ErrorCodes::INTERNAL_ERROR,
      message: "Failed to compare regions"
    )
  end

  private

  # Resolve region configuration
  def resolve_region(region_id, center, radius)
    if region_id == "custom"
      if center.nil? || radius.nil?
        return failure_result(
          code: ErrorHandler::ErrorCodes::VALIDATION_FAILED,
          message: "Custom region requires center and radius parameters"
        )
      end
      {
        name: "カスタム領域",
        center: center,
        radius: radius.to_f
      }
    elsif REGIONS.key?(region_id)
      REGIONS[region_id]
    else
      failure_result(
        code: ErrorHandler::ErrorCodes::VALIDATION_FAILED,
        message: "Unknown region: #{region_id}. Available: #{REGIONS.keys.join(', ')}, custom"
      )
    end
  end

  # Calculate statistics for a region
  def calculate_region_stats(region, period)
    photos = photos_in_region(region, period)

    total_count = photos.count
    return empty_stats if total_count.zero?

    weather_stats = calculate_weather_stats(photos)
    time_stats = calculate_time_stats(photos)

    {
      total_sightings: total_count,
      unique_users: photos.distinct.count(:user_id),
      date_range: {
        first_sighting: photos.minimum(:captured_at)&.iso8601,
        last_sighting: photos.maximum(:captured_at)&.iso8601
      },
      weather: weather_stats,
      time_distribution: time_stats,
      sightings_per_month: calculate_monthly_average(photos, period),
      comparison_to_average: calculate_comparison_score(total_count, period)
    }
  end

  # Get photos within a region
  def photos_in_region(region, period)
    query = Photo.visible.within_radius(
      region[:center][:lat],
      region[:center][:lng],
      region[:radius]
    )

    query = apply_period_filter(query, period)
    query
  end

  # Calculate weather statistics for photos
  def calculate_weather_stats(photos)
    weather_conditions = WeatherCondition
      .joins(:photo)
      .where(photo_id: photos.select(:id))

    return {} if weather_conditions.empty?

    {
      average_temperature: weather_conditions.average(:temperature)&.round(1),
      average_humidity: weather_conditions.average(:humidity)&.round(1),
      average_cloud_cover: weather_conditions.average(:cloud_cover)&.round(1),
      typical_sun_altitude: weather_conditions.average(:sun_altitude)&.round(1),
      precipitation_present_rate: calculate_precipitation_rate(weather_conditions),
      common_weather_codes: most_common_weather_codes(weather_conditions)
    }
  end

  # Calculate time distribution statistics
  def calculate_time_stats(photos)
    # Group by hour of day
    hour_counts = photos.group("EXTRACT(HOUR FROM captured_at)::integer").count
    total = hour_counts.values.sum.to_f

    return {} if total.zero?

    # Find peak hours
    peak_hour = hour_counts.max_by { |_, v| v }&.first
    morning_count = hour_counts.select { |h, _| h.between?(6, 11) }.values.sum
    afternoon_count = hour_counts.select { |h, _| h.between?(12, 17) }.values.sum
    evening_count = hour_counts.select { |h, _| h.between?(18, 20) }.values.sum

    {
      peak_hour: peak_hour,
      hour_distribution: hour_counts.sort.to_h,
      morning_rate: (morning_count / total * 100).round(1),
      afternoon_rate: (afternoon_count / total * 100).round(1),
      evening_rate: (evening_count / total * 100).round(1)
    }
  end

  # Calculate trend data over time
  def calculate_trends(period, group_by, region_id)
    query = Photo.visible
    query = apply_period_filter(query, period)
    query = apply_region_filter(query, region_id) if region_id

    group_format = case group_by
    when "day" then "DATE(captured_at)"
    when "week" then "DATE_TRUNC('week', captured_at)"
    when "month" then "DATE_TRUNC('month', captured_at)"
    when "year" then "DATE_TRUNC('year', captured_at)"
    else "DATE_TRUNC('month', captured_at)"
    end

    time_series = query.group(Arel.sql(group_format)).count.map do |date, count|
      {
        date: date.to_date.iso8601,
        count: count
      }
    end.sort_by { |t| t[:date] }

    # Calculate summary statistics
    counts = time_series.map { |t| t[:count] }
    {
      time_series: time_series,
      summary: {
        total: counts.sum,
        average: counts.empty? ? 0 : (counts.sum.to_f / counts.length).round(2),
        max: counts.max || 0,
        min: counts.min || 0,
        trend_direction: calculate_trend_direction(counts)
      }
    }
  end

  # Calculate weather correlations
  def calculate_weather_correlations(period, region_id)
    query = WeatherCondition.joins(:photo).merge(Photo.visible)
    query = apply_period_filter_to_weather(query, period)
    query = apply_region_filter_to_weather(query, region_id) if region_id

    return {} if query.count.zero?

    # Group by weather code
    weather_distribution = query.group(:weather_code).count

    # Calculate favorable conditions rate
    favorable_query = query.where("sun_altitude BETWEEN 10 AND 42")
    favorable_count = favorable_query.count
    total_count = query.count

    {
      total_samples: total_count,
      weather_distribution: weather_distribution,
      favorable_sun_position_rate: (favorable_count.to_f / total_count * 100).round(1),
      temperature_range: {
        min: query.minimum(:temperature),
        max: query.maximum(:temperature),
        average: query.average(:temperature)&.round(1)
      },
      humidity_range: {
        min: query.minimum(:humidity),
        max: query.maximum(:humidity),
        average: query.average(:humidity)&.round(1)
      },
      precipitation_correlation: calculate_precipitation_correlation(query)
    }
  end

  # Build export data
  def build_export_data(period, region_id, include_weather)
    query = Photo.visible.includes(:user)
    query = query.includes(:weather_conditions) if include_weather
    query = apply_period_filter(query, period)
    query = apply_region_filter(query, region_id) if region_id
    query = query.limit(MAX_EXPORT_RECORDS)

    query.map do |photo|
      data = {
        id: photo.id,
        captured_at: photo.captured_at&.iso8601,
        latitude: photo.latitude,
        longitude: photo.longitude,
        location_name: photo.location_name,
        title: photo.title
      }

      if include_weather && photo.weather_conditions.any?
        wc = photo.weather_conditions.first
        data[:weather] = {
          temperature: wc.temperature,
          humidity: wc.humidity,
          pressure: wc.pressure,
          cloud_cover: wc.cloud_cover,
          sun_altitude: wc.sun_altitude,
          sun_azimuth: wc.sun_azimuth,
          weather_code: wc.weather_code,
          precipitation: wc.precipitation
        }
      end

      data
    end
  end

  # Count export records
  def count_export_records(period, region_id)
    query = Photo.visible
    query = apply_period_filter(query, period)
    query = apply_region_filter(query, region_id) if region_id
    query.count
  end

  # Queue background export job
  def queue_export_job(period, region_id, format, include_weather)
    # Generate unique job ID
    job_id = SecureRandom.uuid

    # Queue the job (DataExportJob to be implemented)
    if defined?(DataExportJob)
      DataExportJob.perform_later(
        job_id: job_id,
        period: period,
        region_id: region_id,
        format: format,
        include_weather: include_weather
      )
    end

    job_id
  end

  # Format export data based on format
  def format_export(data, format)
    case format
    when "csv"
      convert_to_csv(data)
    else
      data
    end
  end

  # Convert data to CSV format
  def convert_to_csv(data)
    return "" if data.empty?

    headers = data.first.keys
    csv_rows = [ headers.join(",") ]

    data.each do |row|
      values = headers.map do |h|
        value = row[h]
        value = value.to_json if value.is_a?(Hash)
        "\"#{value}\""
      end
      csv_rows << values.join(",")
    end

    csv_rows.join("\n")
  end

  # Export metadata
  def export_metadata(period, region_id)
    {
      exported_at: Time.current.iso8601,
      period: format_period(period),
      region_id: region_id,
      version: "1.0"
    }
  end

  # Helper methods

  def apply_period_filter(query, period)
    if period[:start_date].present?
      query = query.where("captured_at >= ?", Date.parse(period[:start_date].to_s))
    end
    if period[:end_date].present?
      query = query.where("captured_at <= ?", Date.parse(period[:end_date].to_s).end_of_day)
    end
    query
  end

  def apply_period_filter_to_weather(query, period)
    if period[:start_date].present?
      query = query.where("weather_conditions.timestamp >= ?", Date.parse(period[:start_date].to_s))
    end
    if period[:end_date].present?
      query = query.where("weather_conditions.timestamp <= ?", Date.parse(period[:end_date].to_s).end_of_day)
    end
    query
  end

  def apply_region_filter(query, region_id)
    region = REGIONS[region_id]
    return query unless region

    query.within_radius(region[:center][:lat], region[:center][:lng], region[:radius])
  end

  def apply_region_filter_to_weather(query, region_id)
    region = REGIONS[region_id]
    return query unless region

    query.joins(:photo).merge(
      Photo.within_radius(region[:center][:lat], region[:center][:lng], region[:radius])
    )
  end

  def format_period(period)
    {
      start_date: period[:start_date],
      end_date: period[:end_date]
    }
  end

  def empty_stats
    {
      total_sightings: 0,
      unique_users: 0,
      date_range: nil,
      weather: {},
      time_distribution: {},
      sightings_per_month: 0,
      comparison_to_average: nil
    }
  end

  def calculate_precipitation_rate(weather_conditions)
    with_precipitation = weather_conditions.where("precipitation > 0").count
    total = weather_conditions.count
    return 0 if total.zero?

    (with_precipitation.to_f / total * 100).round(1)
  end

  def most_common_weather_codes(weather_conditions)
    weather_conditions
      .where.not(weather_code: nil)
      .group(:weather_code)
      .order("count_all DESC")
      .limit(5)
      .count
  end

  def calculate_monthly_average(photos, period)
    total = photos.count
    return 0 if total.zero?

    start_date = period[:start_date].present? ? Date.parse(period[:start_date].to_s) : photos.minimum(:captured_at)&.to_date
    end_date = period[:end_date].present? ? Date.parse(period[:end_date].to_s) : photos.maximum(:captured_at)&.to_date

    return total if start_date.nil? || end_date.nil?

    months = ((end_date.year * 12 + end_date.month) - (start_date.year * 12 + start_date.month)).abs + 1
    (total.to_f / months).round(2)
  end

  def calculate_comparison_score(count, period)
    # Placeholder for comparison to historical average
    # This would compare against a baseline or other regions
    nil
  end

  def calculate_trend_direction(counts)
    return "stable" if counts.length < 2

    first_half = counts[0...(counts.length / 2)]
    second_half = counts[(counts.length / 2)..]

    first_avg = first_half.sum.to_f / first_half.length
    second_avg = second_half.sum.to_f / second_half.length

    diff_percent = ((second_avg - first_avg) / first_avg * 100).round(1) rescue 0

    if diff_percent > 10
      "increasing"
    elsif diff_percent < -10
      "decreasing"
    else
      "stable"
    end
  end

  def calculate_precipitation_correlation(query)
    with_rain = query.where("precipitation > 0").count
    total = query.count
    return nil if total.zero?

    {
      with_precipitation: with_rain,
      without_precipitation: total - with_rain,
      correlation_rate: (with_rain.to_f / total * 100).round(1)
    }
  end

  def calculate_rankings(comparisons)
    return {} if comparisons.empty?

    {
      by_total_sightings: comparisons
        .sort_by { |c| -(c[:statistics][:total_sightings] || 0) }
        .map { |c| { region_id: c[:region_id], value: c[:statistics][:total_sightings] } },
      by_monthly_average: comparisons
        .sort_by { |c| -(c[:statistics][:sightings_per_month] || 0) }
        .map { |c| { region_id: c[:region_id], value: c[:statistics][:sightings_per_month] } }
    }
  end

  # Cache helpers

  def build_cache_key(*parts)
    "analysis_service/v1/#{Digest::MD5.hexdigest(parts.map(&:to_s).join('/'))}"
  end

  def fetch_from_cache(key)
    return nil unless cache_available?

    cached = Rails.cache.read(key)
    log_debug("Cache #{cached ? 'hit' : 'miss'} for #{key}")
    cached
  end

  def store_in_cache(key, value)
    return unless cache_available?

    Rails.cache.write(key, value, expires_in: CACHE_TTL)
    log_debug("Cached #{key} for #{CACHE_TTL}")
  end

  def cache_available?
    defined?(Rails) && Rails.respond_to?(:cache) && Rails.cache
  end

  # Result helpers

  def success_result(data)
    { success: true, data: data }
  end

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

  # Logging helpers

  def log_error(message)
    Rails.logger.error("[AnalysisService] #{message}") if defined?(Rails) && Rails.logger
  end

  def log_debug(message)
    Rails.logger.debug("[AnalysisService] #{message}") if defined?(Rails) && Rails.logger
  end
end
