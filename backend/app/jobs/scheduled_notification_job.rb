# frozen_string_literal: true

# ScheduledNotificationJob handles delayed push notification delivery.
#
# This job is enqueued by NotificationService#schedule_notification
# and executes at the specified time to send the push notification.
#
# == Usage
#   ScheduledNotificationJob.set(wait_until: 1.hour.from_now).perform_later(
#     user_id: user.id,
#     title: "Reminder",
#     body: "Check for rainbows!",
#     notification_type: "system",
#     data: { key: "value" }.to_json
#   )
#
# == Requirements
# - FR-6: Rainbow Alert Notifications
# - FR-7: Notification Customization
#
class ScheduledNotificationJob < ApplicationJob
  queue_as :notifications

  # Retry configuration
  retry_on StandardError, wait: :polynomially_longer, attempts: 3
  discard_on ActiveRecord::RecordNotFound

  # Execute the scheduled notification
  #
  # @param user_id [String] UUID of the user to notify
  # @param title [String] Notification title
  # @param body [String] Notification body
  # @param notification_type [String] Type of notification
  # @param data [String] JSON-encoded data payload
  def perform(user_id:, title:, body:, notification_type:, data:)
    user = User.find(user_id)

    # Skip if user was deleted
    return if user.deleted?

    parsed_data = JSON.parse(data) rescue {}

    service = NotificationService.new
    result = service.send_push_notification(
      user: user,
      title: title,
      body: body,
      notification_type: notification_type.to_sym,
      data: parsed_data
    )

    unless result[:success]
      Rails.logger.warn(
        "[ScheduledNotificationJob] Failed to send notification to user #{user_id}: #{result[:error]}"
      )
    end
  end
end
