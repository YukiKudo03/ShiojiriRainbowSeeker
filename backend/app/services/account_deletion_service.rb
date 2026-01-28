# frozen_string_literal: true

# AccountDeletionService handles GDPR-compliant account deletion.
#
# Provides a 14-day grace period for users to reconsider their deletion request.
# During this period, users can cancel the deletion. After the grace period,
# the deletion is executed permanently and irreversibly.
#
# == Deletion Process
# 1. User requests deletion -> deletion_requested_at is set
# 2. A background job is scheduled for 14 days later
# 3. During grace period, user can cancel (clears deletion fields, cancels job)
# 4. After grace period, execute_deletion is called:
#    - Comments are anonymized (author becomes "deleted user")
#    - Photos and their images are permanently deleted
#    - Likes, notifications, device_tokens are deleted
#    - User record is hard deleted
#
# == Requirements Reference
# - FR-12: Data export and deletion (GDPR compliance)
# - AC-12.2: Account deletion with 14-day grace period
# - AC-12.3: Comments anonymized as "deleted user"
# - AC-12.4: Complete deletion of all data after grace period
#
# == Usage
#   service = AccountDeletionService.new
#   result = service.request_deletion(user)
#   result = service.cancel_deletion(user)
#   result = service.execute_deletion(user)
#
class AccountDeletionService
  # Grace period before account deletion is executed
  GRACE_PERIOD = 14.days

  # Placeholder name for anonymized comments
  DELETED_USER_NAME = "deleted_user"

  def initialize
    @logger = Rails.logger
  end

  # Request account deletion for a user
  #
  # Sets the deletion request timestamp and schedules a job to execute
  # the deletion after the grace period.
  #
  # @param user [User] The user requesting deletion
  # @return [Hash] Result with success status and scheduled deletion time
  def request_deletion(user)
    return error_result("User not found") unless user
    return error_result("User is already deleted") if user.deleted?
    return error_result("Deletion already requested") if user.deletion_requested_at.present?

    scheduled_at = Time.current + GRACE_PERIOD

    ActiveRecord::Base.transaction do
      # Schedule the deletion job
      job = AccountDeletionJob.set(wait_until: scheduled_at).perform_later(user.id)

      # Update user with deletion request information
      user.update!(
        deletion_requested_at: Time.current,
        deletion_scheduled_at: scheduled_at,
        deletion_job_id: job.job_id
      )
    end

    @logger.info("[AccountDeletionService] Deletion requested for user #{user.id}, scheduled for #{scheduled_at}")

    # Send confirmation notification
    send_deletion_requested_notification(user, scheduled_at)

    success_result(
      message: I18n.t("account_deletion.request_success"),
      deletion_scheduled_at: scheduled_at.iso8601,
      grace_period_days: GRACE_PERIOD.to_i / 1.day.to_i
    )
  rescue ActiveRecord::RecordInvalid => e
    @logger.error("[AccountDeletionService] Failed to request deletion for user #{user&.id}: #{e.message}")
    error_result("Failed to request deletion: #{e.message}")
  rescue StandardError => e
    @logger.error("[AccountDeletionService] Error requesting deletion for user #{user&.id}: #{e.message}")
    error_result(e.message)
  end

  # Cancel a pending deletion request
  #
  # Only possible during the grace period. Clears deletion fields and
  # attempts to cancel the scheduled job.
  #
  # @param user [User] The user canceling deletion
  # @return [Hash] Result with success status
  def cancel_deletion(user)
    return error_result("User not found") unless user
    return error_result("User is already deleted") if user.deleted?
    return error_result("No deletion request found") if user.deletion_requested_at.blank?

    # Check if grace period has passed
    if user.deletion_scheduled_at.present? && Time.current >= user.deletion_scheduled_at
      return error_result("Grace period has expired, deletion cannot be canceled")
    end

    job_id = user.deletion_job_id

    ActiveRecord::Base.transaction do
      # Clear deletion fields
      user.update!(
        deletion_requested_at: nil,
        deletion_scheduled_at: nil,
        deletion_job_id: nil
      )

      # Attempt to cancel the scheduled job
      cancel_scheduled_job(job_id) if job_id.present?
    end

    @logger.info("[AccountDeletionService] Deletion canceled for user #{user.id}")

    # Send cancellation confirmation notification
    send_deletion_canceled_notification(user)

    success_result(message: I18n.t("account_deletion.cancel_success"))
  rescue ActiveRecord::RecordInvalid => e
    @logger.error("[AccountDeletionService] Failed to cancel deletion for user #{user&.id}: #{e.message}")
    error_result("Failed to cancel deletion: #{e.message}")
  rescue StandardError => e
    @logger.error("[AccountDeletionService] Error canceling deletion for user #{user&.id}: #{e.message}")
    error_result(e.message)
  end

  # Execute the permanent deletion of a user account
  #
  # This is called by the background job after the grace period.
  # All user data is permanently deleted and cannot be recovered.
  #
  # @param user [User] The user to delete
  # @return [Hash] Result with success status and deletion summary
  def execute_deletion(user)
    return error_result("User not found") unless user
    return error_result("User is already deleted") if user.deleted?
    return error_result("No deletion request found") if user.deletion_requested_at.blank?

    user_id = user.id
    email = user.email

    @logger.info("[AccountDeletionService] Executing deletion for user #{user_id}")

    deletion_summary = {
      comments_anonymized: 0,
      photos_deleted: 0,
      images_purged: 0,
      likes_deleted: 0,
      notifications_deleted: 0,
      device_tokens_deleted: 0
    }

    ActiveRecord::Base.transaction do
      # Step 1: Anonymize comments
      anonymize_result = anonymize_user_content(user)
      deletion_summary[:comments_anonymized] = anonymize_result[:comments_anonymized] if anonymize_result[:success]

      # Step 2: Delete photos and their images
      photo_result = delete_user_photos(user)
      deletion_summary[:photos_deleted] = photo_result[:photos_deleted] if photo_result[:success]
      deletion_summary[:images_purged] = photo_result[:images_purged] if photo_result[:success]

      # Step 3: Delete likes
      deletion_summary[:likes_deleted] = user.likes.delete_all

      # Step 4: Delete notifications
      deletion_summary[:notifications_deleted] = user.notifications.delete_all

      # Step 5: Delete device tokens
      deletion_summary[:device_tokens_deleted] = user.device_tokens.delete_all

      # Step 6: Delete profile image if attached
      user.profile_image.purge if user.profile_image.attached?

      # Step 7: Hard delete the user record
      user.destroy!
    end

    @logger.info(
      "[AccountDeletionService] Successfully deleted user #{user_id}: " \
      "#{deletion_summary[:comments_anonymized]} comments anonymized, " \
      "#{deletion_summary[:photos_deleted]} photos deleted"
    )

    # Note: We cannot send notification as user is deleted
    # Email notification about successful deletion should be sent before deletion
    # or handled separately if required

    success_result(
      message: "Account successfully deleted",
      user_id: user_id,
      email: email,
      summary: deletion_summary
    )
  rescue ActiveRecord::RecordNotDestroyed => e
    @logger.error("[AccountDeletionService] Failed to delete user #{user&.id}: #{e.message}")
    error_result("Failed to delete account: #{e.message}")
  rescue StandardError => e
    @logger.error("[AccountDeletionService] Error executing deletion for user #{user&.id}: #{e.message}")
    @logger.error(e.backtrace.first(5).join("\n"))
    error_result(e.message)
  end

  # Anonymize user's comments
  #
  # Replaces user reference with null and updates the display name
  # shown for the comment to "deleted user".
  #
  # @param user [User] The user whose comments should be anonymized
  # @return [Hash] Result with count of anonymized comments
  def anonymize_user_content(user)
    return error_result("User not found") unless user

    count = 0

    # Anonymize comments by setting user_id to nil and marking as from deleted user
    user.comments.find_each do |comment|
      # Update comment to remove user reference
      # Note: We set user_id to nil and store a flag that this was from a deleted user
      # The Comment model should handle displaying "deleted user" when user_id is nil
      comment.update_columns(
        user_id: nil,
        deleted_user_display_name: DELETED_USER_NAME
      )
      count += 1
    end

    @logger.info("[AccountDeletionService] Anonymized #{count} comments for user #{user.id}")

    success_result(comments_anonymized: count)
  rescue StandardError => e
    @logger.error("[AccountDeletionService] Error anonymizing content for user #{user&.id}: #{e.message}")
    error_result(e.message)
  end

  # Check if a user has a pending deletion request
  #
  # @param user [User] The user to check
  # @return [Hash] Result with deletion status information
  def deletion_status(user)
    return error_result("User not found") unless user

    if user.deletion_requested_at.blank?
      return success_result(
        deletion_pending: false,
        message: I18n.t("account_deletion.no_pending_deletion")
      )
    end

    time_remaining = user.deletion_scheduled_at - Time.current
    days_remaining = (time_remaining / 1.day).ceil

    success_result(
      deletion_pending: true,
      deletion_requested_at: user.deletion_requested_at.iso8601,
      deletion_scheduled_at: user.deletion_scheduled_at.iso8601,
      days_remaining: [ days_remaining, 0 ].max,
      can_cancel: Time.current < user.deletion_scheduled_at
    )
  end

  private

  # Delete all user photos and their associated images
  #
  # @param user [User] The user whose photos should be deleted
  # @return [Hash] Result with deletion counts
  def delete_user_photos(user)
    photos_count = 0
    images_count = 0

    user.photos.find_each do |photo|
      # Purge image from Active Storage (and S3 in production)
      if photo.image.attached?
        photo.image.purge
        images_count += 1
      end

      # Delete associated records
      photo.weather_conditions.delete_all
      photo.radar_data.delete_all
      photo.comments.delete_all
      photo.likes.delete_all
      photo.reports.delete_all

      # Delete the photo record
      photo.destroy!
      photos_count += 1
    end

    success_result(photos_deleted: photos_count, images_purged: images_count)
  rescue StandardError => e
    @logger.error("[AccountDeletionService] Error deleting photos: #{e.message}")
    error_result(e.message)
  end

  # Cancel a scheduled Solid Queue job
  #
  # @param job_id [String] The job ID to cancel
  def cancel_scheduled_job(job_id)
    return if job_id.blank?

    # Find and discard the scheduled job in Solid Queue
    # Solid Queue stores scheduled jobs in solid_queue_scheduled_executions
    # Check if table exists to avoid errors in test environment
    return unless defined?(SolidQueue::ScheduledExecution) &&
                  SolidQueue::ScheduledExecution.table_exists?

    scheduled_execution = SolidQueue::ScheduledExecution.find_by(job_id: job_id)
    scheduled_execution&.destroy

    @logger.info("[AccountDeletionService] Canceled scheduled job #{job_id}")
  rescue StandardError => e
    # Log but don't fail if job cancellation fails
    # The job will check if deletion is still requested before executing
    @logger.warn("[AccountDeletionService] Failed to cancel job #{job_id}: #{e.message}")
  end

  # Send notification when deletion is requested
  #
  # @param user [User] The user who requested deletion
  # @param scheduled_at [Time] When deletion will be executed
  def send_deletion_requested_notification(user, scheduled_at)
    NotificationService.new.send_push_notification(
      user: user,
      title: I18n.t("account_deletion.notifications.requested.title"),
      body: I18n.t(
        "account_deletion.notifications.requested.body",
        date: I18n.l(scheduled_at, format: :short)
      ),
      notification_type: :system,
      data: {
        type: "account_deletion_requested",
        scheduled_at: scheduled_at.iso8601
      }
    )
  rescue StandardError => e
    @logger.warn("[AccountDeletionService] Failed to send deletion requested notification: #{e.message}")
  end

  # Send notification when deletion is canceled
  #
  # @param user [User] The user who canceled deletion
  def send_deletion_canceled_notification(user)
    NotificationService.new.send_push_notification(
      user: user,
      title: I18n.t("account_deletion.notifications.canceled.title"),
      body: I18n.t("account_deletion.notifications.canceled.body"),
      notification_type: :system,
      data: {
        type: "account_deletion_canceled"
      }
    )
  rescue StandardError => e
    @logger.warn("[AccountDeletionService] Failed to send deletion canceled notification: #{e.message}")
  end

  # Standard success result
  #
  # @param data [Hash] Additional data to include
  # @return [Hash] Success result
  def success_result(data = {})
    { success: true }.merge(data)
  end

  # Standard error result
  #
  # @param message [String] Error message
  # @return [Hash] Error result
  def error_result(message)
    { success: false, error: { message: message } }
  end
end
