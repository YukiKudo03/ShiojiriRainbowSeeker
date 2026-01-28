# frozen_string_literal: true

# ModerationService handles content moderation business logic.
#
# This service provides a unified interface for:
# - Hiding reported content (Photo/Comment)
# - Deleting reported content (soft delete)
# - Approving reports (no action needed on content)
# - Tracking user violations
# - Flagging users with repeated violations
# - Notifying content owners of moderation actions
#
# == Requirements
# - FR-10: Content Moderation
# - AC-10.1: View report list (handled by controller)
# - AC-10.2: Process reports (approve/hide/delete)
# - AC-10.3: Flag users with 3+ violations
# - AC-10.4: Notify content owner on hide/delete
#
# == Usage
#   service = ModerationService.new
#   result = service.hide_content(report: report, admin: current_admin, note: "Violates guidelines")
#
#   if result[:success]
#     # Content hidden, user violation count updated, owner notified
#   else
#     # Handle error: result[:error][:message]
#   end
#
class ModerationService
  # Number of violations required to flag a user
  VIOLATION_THRESHOLD = 3

  def initialize(notification_service: nil)
    @notification_service = notification_service || NotificationService.new
    @logger = Rails.logger
  end

  # Hide reported content from public view.
  #
  # Sets the content's visibility to hidden without deleting it.
  # Updates violation count for content owner and notifies them.
  #
  # @param report [Report] The report to process
  # @param admin [User] The admin processing the report
  # @param note [String, nil] Optional admin note
  # @return [Hash] Result with success status and user_flagged indicator
  #
  # @example
  #   result = service.hide_content(report: report, admin: admin, note: "Inappropriate")
  #   result[:success] # => true
  #   result[:user_flagged] # => false
  def hide_content(report:, admin:, note: nil)
    return not_found_error("Report not found") unless report
    return not_found_error("Admin not found") unless admin
    return validation_error("Report already processed") if report.reviewed?

    ActiveRecord::Base.transaction do
      reportable = report.reportable
      return not_found_error("Reported content not found") unless reportable

      # Update content visibility based on content type
      update_content_visibility(reportable, :hidden)

      # Resolve the report
      report.resolve!(admin, note: note)

      # Increment violation count and check for flagging
      content_owner = get_content_owner(reportable)
      user_flagged = false

      if content_owner
        increment_violation_count(content_owner)
        user_flagged = flag_user_if_needed(content_owner)
        notify_content_owner(content_owner, reportable, :hidden)
      end

      @logger.info("[ModerationService] Content hidden: #{reportable.class.name}##{reportable.id} by admin #{admin.id}")

      success_result(
        report_id: report.id,
        action: :hidden,
        user_flagged: user_flagged
      )
    end
  rescue StandardError => e
    @logger.error("[ModerationService] hide_content error: #{e.message}")
    error_result(e.message)
  end

  # Delete (soft delete) reported content.
  #
  # Marks the content as deleted and removes it from public view.
  # This is a more severe action than hiding.
  # Updates violation count for content owner and notifies them.
  #
  # @param report [Report] The report to process
  # @param admin [User] The admin processing the report
  # @param note [String, nil] Optional admin note
  # @return [Hash] Result with success status and user_flagged indicator
  #
  # @example
  #   result = service.delete_content(report: report, admin: admin)
  #   result[:success] # => true
  def delete_content(report:, admin:, note: nil)
    return not_found_error("Report not found") unless report
    return not_found_error("Admin not found") unless admin
    return validation_error("Report already processed") if report.reviewed?

    ActiveRecord::Base.transaction do
      reportable = report.reportable
      return not_found_error("Reported content not found") unless reportable

      # Update content to deleted status based on content type
      update_content_visibility(reportable, :deleted)

      # Resolve the report
      report.resolve!(admin, note: note)

      # Increment violation count and check for flagging
      content_owner = get_content_owner(reportable)
      user_flagged = false

      if content_owner
        increment_violation_count(content_owner)
        user_flagged = flag_user_if_needed(content_owner)
        notify_content_owner(content_owner, reportable, :deleted)
      end

      @logger.info("[ModerationService] Content deleted: #{reportable.class.name}##{reportable.id} by admin #{admin.id}")

      success_result(
        report_id: report.id,
        action: :deleted,
        user_flagged: user_flagged
      )
    end
  rescue StandardError => e
    @logger.error("[ModerationService] delete_content error: #{e.message}")
    error_result(e.message)
  end

  # Approve a report (dismiss without action on content).
  #
  # Used when the reported content does not violate guidelines.
  # The content remains visible and no violation is recorded.
  #
  # @param report [Report] The report to approve/dismiss
  # @param admin [User] The admin processing the report
  # @param note [String, nil] Optional admin note
  # @return [Hash] Result with success status
  #
  # @example
  #   result = service.approve_report(report: report, admin: admin, note: "Content is appropriate")
  def approve_report(report:, admin:, note: nil)
    return not_found_error("Report not found") unless report
    return not_found_error("Admin not found") unless admin
    return validation_error("Report already processed") if report.reviewed?

    report.dismiss!(admin, note: note)

    @logger.info("[ModerationService] Report approved/dismissed: Report##{report.id} by admin #{admin.id}")

    success_result(
      report_id: report.id,
      action: :approved
    )
  rescue StandardError => e
    @logger.error("[ModerationService] approve_report error: #{e.message}")
    error_result(e.message)
  end

  # Increment violation count for a user.
  #
  # Called when content is hidden or deleted due to a report.
  #
  # @param user [User] The user whose violation count to increment
  # @return [Integer] The new violation count
  #
  # @example
  #   new_count = service.increment_violation_count(user)
  def increment_violation_count(user)
    return 0 unless user
    return user.violation_count unless user.respond_to?(:violation_count)

    new_count = (user.violation_count || 0) + 1
    user.update!(violation_count: new_count)

    @logger.info("[ModerationService] User #{user.id} violation count updated to #{new_count}")

    new_count
  rescue StandardError => e
    @logger.error("[ModerationService] increment_violation_count error: #{e.message}")
    user.violation_count || 0
  end

  # Flag user if they have reached the violation threshold.
  #
  # Users with 3 or more violations are flagged for additional review.
  #
  # @param user [User] The user to potentially flag
  # @return [Boolean] true if user was flagged, false otherwise
  #
  # @example
  #   was_flagged = service.flag_user_if_needed(user)
  def flag_user_if_needed(user)
    return false unless user
    return false unless user.respond_to?(:violation_count)
    return false unless user.respond_to?(:violation_flagged)
    return false if user.violation_flagged

    if user.violation_count >= VIOLATION_THRESHOLD
      user.update!(violation_flagged: true)
      @logger.warn("[ModerationService] User #{user.id} flagged with #{user.violation_count} violations")
      true
    else
      false
    end
  rescue StandardError => e
    @logger.error("[ModerationService] flag_user_if_needed error: #{e.message}")
    false
  end

  # Count total violations for a user across all their content.
  #
  # @param user [User] The user to count violations for
  # @return [Integer] Total violation count
  def count_user_violations(user)
    return 0 unless user

    # Count resolved reports against user's photos
    photo_violations = Report.resolved
      .where(reportable_type: "Photo")
      .joins("INNER JOIN photos ON photos.id = reports.reportable_id")
      .where(photos: { user_id: user.id })
      .count

    # Count resolved reports against user's comments
    comment_violations = Report.resolved
      .where(reportable_type: "Comment")
      .joins("INNER JOIN comments ON comments.id = reports.reportable_id")
      .where(comments: { user_id: user.id })
      .count

    photo_violations + comment_violations
  rescue StandardError => e
    @logger.error("[ModerationService] count_user_violations error: #{e.message}")
    0
  end

  private

  # Update content visibility based on action and content type
  #
  # @param reportable [Photo, Comment] The content to update
  # @param action [Symbol] :hidden or :deleted
  def update_content_visibility(reportable, action)
    case action
    when :hidden
      if reportable.respond_to?(:moderation_status)
        # Photo model with moderation_status enum
        reportable.update!(moderation_status: :hidden, is_visible: false)
      elsif reportable.respond_to?(:is_visible)
        # Comment model with is_visible flag
        reportable.update!(is_visible: false)
      end
    when :deleted
      if reportable.respond_to?(:moderation_status)
        # Photo model with moderation_status enum
        reportable.update!(moderation_status: :deleted, is_visible: false)
      elsif reportable.respond_to?(:deleted_at)
        # Models with soft delete via deleted_at
        reportable.update!(deleted_at: Time.current)
      elsif reportable.respond_to?(:is_visible)
        # Fall back to hiding if no delete mechanism
        reportable.update!(is_visible: false)
      end
    end
  end

  # Get the owner of the reported content
  #
  # @param reportable [Photo, Comment] The reported content
  # @return [User, nil] The content owner
  def get_content_owner(reportable)
    reportable.user if reportable.respond_to?(:user)
  end

  # Notify content owner when their content is hidden/deleted
  #
  # @param owner [User] The content owner
  # @param reportable [Photo, Comment] The reported content
  # @param action [Symbol] The action taken (:hidden or :deleted)
  def notify_content_owner(owner, reportable, action)
    return unless owner

    content_type = reportable.class.name.downcase
    content_type_ja = content_type == "photo" ? "写真" : "コメント"

    title = action == :hidden ? "コンテンツが非表示になりました" : "コンテンツが削除されました"
    body = if action == :hidden
      "あなたの#{content_type_ja}がコミュニティガイドラインに基づき非表示になりました。"
    else
      "あなたの#{content_type_ja}がコミュニティガイドラインに基づき削除されました。"
    end

    @notification_service.send_push_notification(
      user: owner,
      title: title,
      body: body,
      data: {
        type: "moderation",
        action: action.to_s,
        content_type: content_type,
        content_id: reportable.id
      },
      notification_type: :system
    )
  rescue StandardError => e
    # Log but don't fail the main operation
    @logger.warn("[ModerationService] Failed to send notification: #{e.message}")
  end

  # Build a success result hash
  #
  # @param data [Hash] Additional data to include
  # @return [Hash] Success result
  def success_result(data = {})
    { success: true }.merge(data)
  end

  # Build an error result hash
  #
  # @param message [String] Error message
  # @param code [Integer] Error code from ErrorHandler::ErrorCodes
  # @return [Hash] Error result
  def error_result(message, code: ErrorHandler::ErrorCodes::INTERNAL_ERROR)
    { success: false, error: { code: code, message: message } }
  end

  def validation_error(message)
    error_result(message, code: ErrorHandler::ErrorCodes::VALIDATION_FAILED)
  end

  def not_found_error(message)
    error_result(message, code: ErrorHandler::ErrorCodes::RESOURCE_NOT_FOUND)
  end
end
