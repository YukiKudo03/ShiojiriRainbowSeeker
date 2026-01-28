# frozen_string_literal: true

# AccountDeletionJob executes scheduled account deletion after the grace period.
#
# This job is scheduled by AccountDeletionService.request_deletion to run
# 14 days after the initial deletion request. It performs the actual
# permanent deletion of all user data.
#
# == Safety Checks
# - Verifies user still exists
# - Confirms deletion is still requested (wasn't canceled)
# - Confirms scheduled time has passed
#
# == Queue
# Runs on the 'default' queue via Solid Queue (PostgreSQL-based).
#
# == Requirements Reference
# - FR-12: Data export and deletion (GDPR compliance)
# - AC-12.2: 14-day grace period for account deletion
# - AC-12.3: Comments anonymized as "deleted user"
# - AC-12.4: Complete deletion of all data after grace period
#
# == Usage
#   AccountDeletionJob.set(wait_until: 14.days.from_now).perform_later(user_id)
#
class AccountDeletionJob < ApplicationJob
  queue_as :default

  # Retry on transient database errors
  retry_on ActiveRecord::Deadlocked, wait: 5.seconds, attempts: 3

  # Retry on Active Storage errors (for image purging)
  retry_on ActiveStorage::Error, wait: 10.seconds, attempts: 3

  # Discard if user no longer exists (already deleted)
  discard_on ActiveRecord::RecordNotFound

  # Main job execution
  #
  # @param user_id [String] UUID of the user to delete
  def perform(user_id)
    user = User.find(user_id)

    Rails.logger.info("[AccountDeletionJob] Processing deletion for user #{user_id}")

    # Safety check: Verify deletion is still requested
    unless user.deletion_requested_at.present?
      Rails.logger.info("[AccountDeletionJob] Deletion was canceled for user #{user_id}, skipping")
      return
    end

    # Safety check: Verify user hasn't already been deleted
    if user.deleted?
      Rails.logger.info("[AccountDeletionJob] User #{user_id} already deleted (soft delete), skipping")
      return
    end

    # Safety check: Verify scheduled time has passed
    if user.deletion_scheduled_at.present? && Time.current < user.deletion_scheduled_at
      # Reschedule for the correct time
      remaining_wait = user.deletion_scheduled_at - Time.current
      Rails.logger.info(
        "[AccountDeletionJob] Rescheduling deletion for user #{user_id}, " \
        "wait #{remaining_wait.to_i} seconds"
      )
      AccountDeletionJob.set(wait: remaining_wait).perform_later(user_id)
      return
    end

    # Execute the deletion
    service = AccountDeletionService.new
    result = service.execute_deletion(user)

    if result[:success]
      Rails.logger.info(
        "[AccountDeletionJob] Successfully deleted user #{user_id}: " \
        "#{result[:summary][:comments_anonymized]} comments anonymized, " \
        "#{result[:summary][:photos_deleted]} photos deleted, " \
        "#{result[:summary][:images_purged]} images purged"
      )
    else
      Rails.logger.error(
        "[AccountDeletionJob] Failed to delete user #{user_id}: #{result[:error][:message]}"
      )
      raise StandardError, "Deletion failed: #{result[:error][:message]}"
    end
  rescue StandardError => e
    Rails.logger.error("[AccountDeletionJob] Error processing deletion for user #{user_id}: #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
    raise
  end
end
