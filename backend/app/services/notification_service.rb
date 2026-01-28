# frozen_string_literal: true

# NotificationService handles all notification-related business logic.
#
# This service provides a unified interface for:
# - Sending push notifications to iOS (APNs) and Android (FCM) devices
# - Creating in-app notifications
# - Sending rainbow alerts with location-based targeting
# - Sending social notifications (likes, comments)
# - Scheduling delayed notifications
# - Managing user notification preferences
#
# == Requirements
# - FR-6: Rainbow Alert Notifications
# - FR-7: Notification Customization
# - FR-8: Social Features (AC-8.3)
#
# == Usage
#   service = NotificationService.new
#   service.send_rainbow_alert(
#     users: User.active,
#     location: { lat: 36.115, lng: 137.954 },
#     direction: "east",
#     probability: 0.85
#   )
#
class NotificationService
  # Default notification settings for new users
  DEFAULT_NOTIFICATION_SETTINGS = {
    "rainbow_alerts" => true,
    "likes" => true,
    "comments" => true,
    "system" => true,
    "alert_radius_km" => 10,
    "quiet_hours_start" => nil,  # e.g., "22:00"
    "quiet_hours_end" => nil,    # e.g., "07:00"
    "timezone" => "Asia/Tokyo"
  }.freeze

  # Maximum number of notifications to return in list
  DEFAULT_PAGE_SIZE = 20
  MAX_PAGE_SIZE = 100

  # Throttling interval for rainbow alerts (in seconds)
  RAINBOW_ALERT_THROTTLE = 2.hours.to_i

  def initialize
    @logger = Rails.logger
  end

  # Send a push notification to a specific user
  #
  # @param user [User] The user to send notification to
  # @param title [String] Notification title
  # @param body [String] Notification body
  # @param data [Hash] Custom data payload
  # @param notification_type [Symbol] Type of notification (:rainbow_alert, :like, :comment, :system)
  # @param options [Hash] Additional options (save_to_db, skip_quiet_hours_check)
  # @return [Hash] Result with success status
  def send_push_notification(user:, title:, body:, data: {}, notification_type: :system, options: {})
    return not_found_error("User not found") unless user

    # Check quiet hours unless explicitly skipped
    unless options[:skip_quiet_hours_check]
      return success_result(skipped: true, reason: "quiet_hours") if in_quiet_hours?(user)
    end

    # Check if user has this notification type enabled
    unless notification_enabled?(user, notification_type)
      return success_result(skipped: true, reason: "disabled_by_user")
    end

    # Save to database if requested (default: true)
    if options.fetch(:save_to_db, true)
      create_in_app_notification(
        user: user,
        title: title,
        body: body,
        notification_type: notification_type,
        data: data
      )
    end

    # Send push to all active devices
    results = send_to_user_devices(user, title, body, data)

    success_result(
      devices_sent: results.count { |r| r[:success] },
      devices_failed: results.count { |r| !r[:success] },
      results: results
    )
  rescue StandardError => e
    @logger.error("[NotificationService] send_push_notification error: #{e.message}")
    error_result(e.message)
  end

  # Send a rainbow alert to multiple users based on location
  #
  # @param users [ActiveRecord::Relation] Users to potentially notify
  # @param location [Hash] Rainbow location { lat:, lng: }
  # @param direction [String] Direction to look (e.g., "east", "northeast")
  # @param probability [Float] Rainbow probability (0.0-1.0)
  # @param estimated_duration [Integer] Estimated viewing duration in minutes
  # @param weather_summary [String] Brief weather description
  # @return [Hash] Result with notification counts
  def send_rainbow_alert(users:, location:, direction:, probability:, estimated_duration: nil, weather_summary: nil)
    return validation_error("Location required") unless location && location[:lat] && location[:lng]

    title = "虹が見える可能性があります！"
    body = build_rainbow_alert_body(direction, probability, estimated_duration, weather_summary)

    data = {
      type: "rainbow_alert",
      location: location,
      direction: direction,
      probability: probability,
      estimated_duration: estimated_duration,
      expires_at: (Time.current + (estimated_duration || 30).minutes).iso8601
    }

    sent_count = 0
    skipped_count = 0
    failed_count = 0

    users.find_each do |user|
      # Check if user is within alert radius
      unless within_alert_radius?(user, location)
        skipped_count += 1
        next
      end

      # Check throttling - don't send if recently notified
      if recently_notified?(user, :rainbow_alert)
        skipped_count += 1
        next
      end

      result = send_push_notification(
        user: user,
        title: title,
        body: body,
        data: data,
        notification_type: :rainbow_alert
      )

      if result[:success]
        if result[:skipped]
          skipped_count += 1
        else
          sent_count += 1
        end
      else
        failed_count += 1
      end
    end

    success_result(
      sent: sent_count,
      skipped: skipped_count,
      failed: failed_count
    )
  rescue StandardError => e
    @logger.error("[NotificationService] send_rainbow_alert error: #{e.message}")
    error_result(e.message)
  end

  # Send notification when a user likes a photo
  #
  # @param liker [User] The user who liked the photo
  # @param photo [Photo] The photo that was liked
  # @return [Hash] Result with success status
  #
  # @example
  #   service.send_like_notification(liker: current_user, photo: photo)
  def send_like_notification(liker:, photo:)
    return not_found_error("Liker not found") unless liker
    return not_found_error("Photo not found") unless photo

    photo_owner = photo.user

    # Don't notify if user liked their own photo
    if liker.id == photo_owner.id
      return success_result(skipped: true, reason: "self_action")
    end

    title = "いいね！"
    body = "#{liker.display_name}さんがあなたの写真にいいねしました"

    data = {
      type: "like",
      liker_id: liker.id,
      liker_name: liker.display_name,
      photo_id: photo.id,
      photo_thumbnail_url: photo_thumbnail_url(photo)
    }

    send_push_notification(
      user: photo_owner,
      title: title,
      body: body,
      data: data,
      notification_type: :like
    )
  rescue StandardError => e
    @logger.error("[NotificationService] send_like_notification error: #{e.message}")
    error_result(e.message)
  end

  # Send notification when a user comments on a photo
  #
  # @param commenter [User] The user who commented
  # @param photo [Photo] The photo that was commented on
  # @param comment [Comment] The comment that was created
  # @return [Hash] Result with success status
  #
  # @example
  #   service.send_comment_notification(commenter: current_user, photo: photo, comment: comment)
  def send_comment_notification(commenter:, photo:, comment:)
    return not_found_error("Commenter not found") unless commenter
    return not_found_error("Photo not found") unless photo
    return not_found_error("Comment not found") unless comment

    photo_owner = photo.user

    # Don't notify if user commented on their own photo
    if commenter.id == photo_owner.id
      return success_result(skipped: true, reason: "self_action")
    end

    title = "コメント"
    # Truncate comment content for notification body
    truncated_content = truncate_text(comment.content, 50)
    body = "#{commenter.display_name}さんがコメントしました: 「#{truncated_content}」"

    data = {
      type: "comment",
      commenter_id: commenter.id,
      commenter_name: commenter.display_name,
      photo_id: photo.id,
      comment_id: comment.id,
      comment_preview: truncated_content,
      photo_thumbnail_url: photo_thumbnail_url(photo)
    }

    send_push_notification(
      user: photo_owner,
      title: title,
      body: body,
      data: data,
      notification_type: :comment
    )
  rescue StandardError => e
    @logger.error("[NotificationService] send_comment_notification error: #{e.message}")
    error_result(e.message)
  end

  # Schedule a notification for later delivery
  #
  # @param user [User] The user to send notification to
  # @param title [String] Notification title
  # @param body [String] Notification body
  # @param deliver_at [Time] When to deliver the notification
  # @param notification_type [Symbol] Type of notification
  # @param data [Hash] Custom data payload
  # @return [Hash] Result with job_id
  def schedule_notification(user:, title:, body:, deliver_at:, notification_type: :system, data: {})
    return not_found_error("User not found") unless user
    return validation_error("deliver_at must be in the future") if deliver_at <= Time.current

    # Queue the job for later execution
    job = ScheduledNotificationJob.set(wait_until: deliver_at).perform_later(
      user_id: user.id,
      title: title,
      body: body,
      notification_type: notification_type.to_s,
      data: data.to_json
    )

    success_result(
      job_id: job.job_id,
      scheduled_for: deliver_at.iso8601
    )
  rescue StandardError => e
    @logger.error("[NotificationService] schedule_notification error: #{e.message}")
    error_result(e.message)
  end

  # List notifications for a user with pagination
  #
  # @param user [User] The user to get notifications for
  # @param page [Integer] Page number (1-indexed)
  # @param per_page [Integer] Items per page
  # @param filter [Symbol, nil] Filter by type (:unread, :rainbow_alerts, :social, etc.)
  # @return [Hash] Result with notifications and pagination info
  def list_for_user(user:, page: 1, per_page: DEFAULT_PAGE_SIZE, filter: nil)
    return not_found_error("User not found") unless user

    per_page = [ per_page.to_i, MAX_PAGE_SIZE ].min
    per_page = DEFAULT_PAGE_SIZE if per_page <= 0
    page = [ page.to_i, 1 ].max

    scope = user.notifications.recent

    # Apply filter
    scope = apply_filter(scope, filter)

    total_count = scope.count
    notifications = scope.offset((page - 1) * per_page).limit(per_page)

    success_result(
      notifications: notifications.map { |n| serialize_notification(n) },
      pagination: {
        currentPage: page,
        perPage: per_page,
        totalPages: (total_count.to_f / per_page).ceil,
        totalCount: total_count
      },
      unreadCount: user.notifications.unread.count
    )
  rescue StandardError => e
    @logger.error("[NotificationService] list_for_user error: #{e.message}")
    error_result(e.message)
  end

  # Get user notification settings
  #
  # @param user [User] The user
  # @return [Hash] Notification settings (camelCase keys)
  def get_settings(user:)
    return not_found_error("User not found") unless user

    settings = DEFAULT_NOTIFICATION_SETTINGS.merge(user.notification_settings || {})

    success_result(settings: camelize_settings(settings))
  rescue StandardError => e
    error_result(e.message)
  end

  # Update user notification settings
  #
  # @param user [User] The user
  # @param settings [Hash] Settings to update
  # @return [Hash] Result with updated settings
  def update_settings(user:, settings:)
    return not_found_error("User not found") unless user

    current_settings = DEFAULT_NOTIFICATION_SETTINGS.merge(user.notification_settings || {})
    new_settings = current_settings.merge(settings.stringify_keys.slice(*DEFAULT_NOTIFICATION_SETTINGS.keys))

    # Validate alert_radius_km
    radius = new_settings["alert_radius_km"]
    unless [ 1, 5, 10, 25 ].include?(radius.to_i)
      return validation_error("alert_radius_km must be 1, 5, 10, or 25")
    end

    # Validate quiet hours format
    %w[quiet_hours_start quiet_hours_end].each do |field|
      value = new_settings[field]
      if value.present? && !valid_time_format?(value)
        return validation_error("#{field} must be in HH:MM format")
      end
    end

    user.update!(notification_settings: new_settings)

    success_result(settings: camelize_settings(new_settings))
  rescue ActiveRecord::RecordInvalid => e
    error_result(e.message)
  rescue StandardError => e
    @logger.error("[NotificationService] update_settings error: #{e.message}")
    error_result(e.message)
  end

  # Mark notification(s) as read
  #
  # @param user [User] The user
  # @param notification_ids [Array<String>, nil] Specific notification IDs, or nil for all
  # @return [Hash] Result with count of marked notifications
  def mark_as_read(user:, notification_ids: nil)
    return not_found_error("User not found") unless user

    scope = user.notifications.unread

    if notification_ids.present?
      scope = scope.where(id: notification_ids)
    end

    count = scope.update_all(is_read: true)

    success_result(markedCount: count)
  rescue StandardError => e
    error_result(e.message)
  end

  private

  # Build rainbow alert notification body
  def build_rainbow_alert_body(direction, probability, estimated_duration, weather_summary)
    direction_ja = direction_to_japanese(direction)
    probability_text = (probability * 100).round

    parts = [ "#{direction_ja}の空をご覧ください（確率#{probability_text}%）" ]
    parts << "推定#{estimated_duration}分間" if estimated_duration
    parts << weather_summary if weather_summary.present?

    parts.join("。")
  end

  # Convert direction to Japanese
  def direction_to_japanese(direction)
    directions = {
      "north" => "北",
      "northeast" => "北東",
      "east" => "東",
      "southeast" => "南東",
      "south" => "南",
      "southwest" => "南西",
      "west" => "西",
      "northwest" => "北西"
    }
    directions[direction.to_s.downcase] || direction
  end

  # Check if user is within their configured alert radius
  def within_alert_radius?(user, location)
    # Get user's last known location from their most recent photo or device
    user_location = get_user_location(user)
    return true unless user_location # If no location known, send anyway

    radius_km = get_alert_radius(user)
    distance = haversine_distance(
      user_location[:lat], user_location[:lng],
      location[:lat], location[:lng]
    )

    distance <= radius_km
  end

  # Get user's alert radius setting
  def get_alert_radius(user)
    settings = user.notification_settings || {}
    (settings["alert_radius_km"] || 10).to_i
  end

  # Get user's approximate location from their most recent photo
  def get_user_location(user)
    recent_photo = user.photos.order(created_at: :desc).first
    return nil unless recent_photo&.latitude && recent_photo&.longitude

    { lat: recent_photo.latitude, lng: recent_photo.longitude }
  end

  # Calculate distance between two points using Haversine formula
  def haversine_distance(lat1, lon1, lat2, lon2)
    rad_per_deg = Math::PI / 180
    earth_radius_km = 6371

    dlat = (lat2 - lat1) * rad_per_deg
    dlon = (lon2 - lon1) * rad_per_deg

    a = Math.sin(dlat / 2)**2 +
        Math.cos(lat1 * rad_per_deg) * Math.cos(lat2 * rad_per_deg) *
        Math.sin(dlon / 2)**2
    c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    earth_radius_km * c
  end

  # Check if user was recently notified for this type
  def recently_notified?(user, notification_type)
    return false unless notification_type == :rainbow_alert

    user.notifications
        .where(notification_type: notification_type)
        .where("created_at > ?", RAINBOW_ALERT_THROTTLE.seconds.ago)
        .exists?
  end

  # Check if current time is within user's quiet hours
  def in_quiet_hours?(user)
    settings = user.notification_settings || {}
    start_time = settings["quiet_hours_start"]
    end_time = settings["quiet_hours_end"]

    return false if start_time.blank? || end_time.blank?

    timezone = settings["timezone"] || "Asia/Tokyo"
    current_time = Time.current.in_time_zone(timezone)
    current_minutes = current_time.hour * 60 + current_time.min

    start_minutes = parse_time_to_minutes(start_time)
    end_minutes = parse_time_to_minutes(end_time)

    if start_minutes <= end_minutes
      # Normal range (e.g., 08:00 - 20:00)
      current_minutes >= start_minutes && current_minutes < end_minutes
    else
      # Overnight range (e.g., 22:00 - 07:00)
      current_minutes >= start_minutes || current_minutes < end_minutes
    end
  end

  # Parse "HH:MM" to minutes since midnight
  def parse_time_to_minutes(time_str)
    return 0 unless time_str.is_a?(String)

    parts = time_str.split(":")
    return 0 unless parts.length == 2

    hours = parts[0].to_i
    minutes = parts[1].to_i
    hours * 60 + minutes
  end

  # Validate time format "HH:MM"
  def valid_time_format?(value)
    return true if value.nil?

    value.match?(/\A([01]?[0-9]|2[0-3]):[0-5][0-9]\z/)
  end

  # Check if notification type is enabled for user
  def notification_enabled?(user, notification_type)
    settings = user.notification_settings || {}

    case notification_type.to_sym
    when :rainbow_alert
      settings.fetch("rainbow_alerts", true)
    when :like
      settings.fetch("likes", true)
    when :comment
      settings.fetch("comments", true)
    when :system
      settings.fetch("system", true)
    else
      true
    end
  end

  # Create in-app notification record
  def create_in_app_notification(user:, title:, body:, notification_type:, data:)
    Notification.create!(
      user: user,
      notification_type: notification_type,
      title: title,
      body: body,
      data: data,
      is_read: false
    )
  end

  # Send push notification to all user's active devices
  def send_to_user_devices(user, title, body, data)
    tokens = user.device_tokens.active

    results = []

    # Send to iOS devices
    ios_tokens = tokens.ios_devices.pluck(:token)
    if ios_tokens.any? && ApnsClient.configured?
      ios_results = ApnsClient.send_to_devices(
        tokens: ios_tokens,
        title: title,
        body: body,
        data: data
      )
      results.concat(ios_results.map { |r| r.merge(platform: "ios") })
    end

    # Send to Android devices
    android_tokens = tokens.android_devices.pluck(:token)
    if android_tokens.any? && FcmClient.configured?
      android_results = FcmClient.send_to_devices(
        tokens: android_tokens,
        title: title,
        body: body,
        data: data
      )
      results.concat(android_results.map { |r| r.merge(platform: "android") })
    end

    results
  end

  # Apply filter to notification scope
  def apply_filter(scope, filter)
    case filter&.to_sym
    when :unread
      scope.unread
    when :rainbow_alerts
      scope.rainbow_alerts
    when :social
      scope.social
    when :system
      scope.system_notifications
    else
      scope
    end
  end

  # Serialize notification for API response
  def serialize_notification(notification)
    {
      id: notification.id,
      type: notification.notification_type,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      isRead: notification.is_read,
      createdAt: notification.created_at.iso8601
    }
  end

  # Transform settings keys from snake_case to camelCase
  def camelize_settings(settings)
    key_mapping = {
      "rainbow_alerts" => "rainbowAlerts",
      "alert_radius_km" => "alertRadiusKm",
      "quiet_hours_start" => "quietHoursStart",
      "quiet_hours_end" => "quietHoursEnd"
    }

    settings.transform_keys do |key|
      key_mapping[key] || key
    end
  end

  def success_result(data = {})
    { success: true }.merge(data)
  end

  def error_result(message, code: ErrorHandler::ErrorCodes::INTERNAL_ERROR)
    { success: false, error: { code: code, message: message } }
  end

  def validation_error(message)
    error_result(message, code: ErrorHandler::ErrorCodes::VALIDATION_FAILED)
  end

  def not_found_error(message)
    error_result(message, code: ErrorHandler::ErrorCodes::RESOURCE_NOT_FOUND)
  end

  # Truncate text to specified length with ellipsis
  def truncate_text(text, max_length)
    return "" if text.blank?
    return text if text.length <= max_length

    text[0, max_length - 1] + "…"
  end

  # Get photo thumbnail URL for notification
  def photo_thumbnail_url(photo)
    return nil unless photo.respond_to?(:image) && photo.image.attached?

    # Return thumbnail variant URL if available
    if photo.image.variant(:thumb).processed?
      Rails.application.routes.url_helpers.rails_blob_url(
        photo.image.variant(:thumb),
        only_path: true
      )
    else
      nil
    end
  rescue StandardError
    nil
  end
end
