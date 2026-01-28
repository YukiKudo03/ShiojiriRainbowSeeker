# frozen_string_literal: true

# RainbowAlertJob checks weather conditions and sends rainbow alerts to users.
#
# This job runs periodically (every 15 minutes) to monitor weather conditions
# across the Shiojiri area and sends push notifications to users when conditions
# are favorable for rainbow sightings.
#
# == Features
# - Checks multiple monitoring locations across Shiojiri
# - Evaluates rainbow probability using WeatherService
# - Sends alerts via NotificationService with direction and duration info
# - Throttles alerts (2 hours between alerts per location)
# - Respects user quiet hours settings
#
# == Requirements
# - FR-6: Rainbow Alert Notifications (AC-6.1〜AC-6.8)
#
# == Usage
#   # Run manually
#   RainbowAlertJob.perform_later
#
#   # Schedule recurring (in solid_queue.yml or via recurring schedule)
#   RainbowAlertJob.set(wait: 15.minutes).perform_later
#
class RainbowAlertJob < ApplicationJob
  queue_as :alerts

  # Retry configuration
  retry_on StandardError, wait: 5.minutes, attempts: 3

  # Monitoring locations across Shiojiri City
  # These points cover major areas to detect rainbow-favorable conditions
  MONITORING_LOCATIONS = [
    { id: "daimon", name: "大門地区", lat: 36.115, lng: 137.954 },
    { id: "shiojiri_central", name: "塩尻市中心部", lat: 36.116, lng: 137.949 },
    { id: "hirooka", name: "広丘地区", lat: 36.135, lng: 137.975 },
    { id: "katasegawa", name: "片瀬川地区", lat: 36.080, lng: 137.920 },
    { id: "narai", name: "奈良井地区", lat: 35.972, lng: 137.809 }
  ].freeze

  # Minimum score to trigger rainbow alert
  RAINBOW_SCORE_THRESHOLD = 60

  # Throttle period for alerts per location (2 hours)
  ALERT_THROTTLE_PERIOD = 2.hours

  # Estimated rainbow viewing duration (minutes)
  DEFAULT_ESTIMATED_DURATION = 15

  # Cache key prefix for throttling
  CACHE_PREFIX = "rainbow_alert:location"

  # Execute the rainbow alert check
  def perform
    Rails.logger.info("[RainbowAlertJob] Starting rainbow condition check")

    favorable_locations = check_all_locations
    return if favorable_locations.empty?

    Rails.logger.info("[RainbowAlertJob] Found #{favorable_locations.count} favorable locations")

    # Send alerts for favorable locations
    send_alerts(favorable_locations)

    # Schedule next run
    schedule_next_run

    Rails.logger.info("[RainbowAlertJob] Completed rainbow alert processing")
  end

  private

  # Check all monitoring locations for rainbow-favorable conditions
  #
  # @return [Array<Hash>] Locations with favorable conditions
  def check_all_locations
    weather_service = WeatherService.new
    current_time = Time.current

    favorable = []

    MONITORING_LOCATIONS.each do |location|
      # Skip if recently alerted for this location
      next if recently_alerted?(location[:id])

      result = weather_service.check_rainbow_conditions(
        lat: location[:lat],
        lng: location[:lng],
        time: current_time
      )

      next unless result[:success]

      data = result[:data]

      if data[:is_favorable] && data[:score] >= RAINBOW_SCORE_THRESHOLD
        favorable << {
          location: location,
          score: data[:score],
          direction: data[:rainbow_direction],
          conditions: data[:conditions],
          sun_altitude: data[:sun_altitude],
          estimated_duration: estimate_duration(data)
        }

        # Mark as alerted
        mark_as_alerted(location[:id])
      end
    rescue StandardError => e
      Rails.logger.error("[RainbowAlertJob] Error checking location #{location[:id]}: #{e.message}")
    end

    favorable
  end

  # Send alerts for favorable locations
  #
  # @param favorable_locations [Array<Hash>] Locations to alert about
  def send_alerts(favorable_locations)
    return if favorable_locations.empty?

    notification_service = NotificationService.new

    # Get all users who have rainbow alerts enabled and are active
    users = User.active.where.not(confirmed_at: nil)

    favorable_locations.each do |location_data|
      location = location_data[:location]
      direction = location_data[:direction]
      score = location_data[:score]
      estimated_duration = location_data[:estimated_duration]

      # Build weather summary from conditions
      weather_summary = build_weather_summary(location_data[:conditions])

      result = notification_service.send_rainbow_alert(
        users: users,
        location: { lat: location[:lat], lng: location[:lng] },
        direction: direction[:cardinal],
        probability: score / 100.0,
        estimated_duration: estimated_duration,
        weather_summary: weather_summary
      )

      if result[:success]
        Rails.logger.info(
          "[RainbowAlertJob] Alert sent for #{location[:name]}: " \
          "sent=#{result[:sent]}, skipped=#{result[:skipped]}, failed=#{result[:failed]}"
        )
      else
        Rails.logger.error(
          "[RainbowAlertJob] Failed to send alert for #{location[:name]}: #{result[:error]}"
        )
      end
    end
  end

  # Check if an alert was recently sent for this location
  #
  # @param location_id [String] The location identifier
  # @return [Boolean] True if recently alerted
  def recently_alerted?(location_id)
    cache_key = "#{CACHE_PREFIX}:#{location_id}"
    Rails.cache.read(cache_key).present?
  end

  # Mark a location as alerted (for throttling)
  #
  # @param location_id [String] The location identifier
  def mark_as_alerted(location_id)
    cache_key = "#{CACHE_PREFIX}:#{location_id}"
    Rails.cache.write(cache_key, Time.current.to_i, expires_in: ALERT_THROTTLE_PERIOD)
  end

  # Estimate rainbow viewing duration based on conditions
  #
  # @param data [Hash] Rainbow condition data
  # @return [Integer] Estimated duration in minutes
  def estimate_duration(data)
    base_duration = DEFAULT_ESTIMATED_DURATION

    # Adjust based on conditions
    conditions = data[:conditions]

    # Higher score = potentially longer duration
    if data[:score] >= 80
      base_duration += 10
    elsif data[:score] >= 70
      base_duration += 5
    end

    # Recent precipitation = longer duration
    if conditions[:precipitation][:favorable]
      base_duration += 5
    end

    # Lower sun altitude = longer potential viewing
    sun_altitude = data[:sun_altitude] || 20
    if sun_altitude < 20
      base_duration += 5
    end

    base_duration.clamp(10, 45)
  end

  # Build a weather summary string from conditions
  #
  # @param conditions [Hash] Rainbow conditions data
  # @return [String] Weather summary
  def build_weather_summary(conditions)
    parts = []

    humidity = conditions.dig(:humidity, :value)
    parts << "湿度#{humidity}%" if humidity

    cloud_cover = conditions.dig(:cloud_cover, :value)
    if cloud_cover
      cloud_desc = case cloud_cover
      when 0..25 then "晴れ"
      when 26..50 then "晴れ時々曇り"
      when 51..75 then "曇り時々晴れ"
      else "曇り"
      end
      parts << cloud_desc
    end

    if conditions.dig(:precipitation, :favorable)
      parts << "雨上がり"
    end

    parts.join("、")
  end

  # Schedule the next run of this job
  def schedule_next_run
    # In production, this would be handled by solid_queue recurring jobs
    # For fallback, we can schedule the next run manually
    self.class.set(wait: 15.minutes).perform_later unless Rails.env.test?
  end
end
