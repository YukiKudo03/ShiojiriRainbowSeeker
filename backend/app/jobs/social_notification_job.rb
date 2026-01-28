# frozen_string_literal: true

# SocialNotificationJob handles asynchronous delivery of social notifications.
#
# This job is queued when a user performs social actions (likes, comments)
# and processes the notification delivery in the background to avoid
# blocking the API response.
#
# == Requirements
# - FR-8: Social Features (AC-8.3)
#
# == Usage
#   # Queue a like notification
#   SocialNotificationJob.perform_later(
#     notification_type: "like",
#     liker_id: user.id,
#     photo_id: photo.id
#   )
#
#   # Queue a comment notification
#   SocialNotificationJob.perform_later(
#     notification_type: "comment",
#     commenter_id: user.id,
#     photo_id: photo.id,
#     comment_id: comment.id
#   )
#
class SocialNotificationJob < ApplicationJob
  queue_as :notifications

  # Retry up to 3 times with exponential backoff
  retry_on StandardError, wait: :polynomially_longer, attempts: 3

  # Don't retry if notification resources are not found
  discard_on ActiveRecord::RecordNotFound

  # @param notification_type [String] "like" or "comment"
  # @param liker_id [String] User ID who liked (for like notifications)
  # @param commenter_id [String] User ID who commented (for comment notifications)
  # @param photo_id [String] Photo ID
  # @param comment_id [String, nil] Comment ID (for comment notifications)
  def perform(notification_type:, photo_id:, liker_id: nil, commenter_id: nil, comment_id: nil)
    service = NotificationService.new

    case notification_type
    when "like"
      send_like_notification(service, liker_id, photo_id)
    when "comment"
      send_comment_notification(service, commenter_id, photo_id, comment_id)
    else
      Rails.logger.warn("[SocialNotificationJob] Unknown notification type: #{notification_type}")
    end
  end

  private

  def send_like_notification(service, liker_id, photo_id)
    liker = User.find(liker_id)
    photo = Photo.find(photo_id)

    result = service.send_like_notification(liker: liker, photo: photo)

    if result[:success]
      if result[:skipped]
        Rails.logger.info("[SocialNotificationJob] Like notification skipped: #{result[:reason]}")
      else
        Rails.logger.info("[SocialNotificationJob] Like notification sent for photo #{photo_id}")
      end
    else
      Rails.logger.error("[SocialNotificationJob] Like notification failed: #{result.dig(:error, :message)}")
    end
  end

  def send_comment_notification(service, commenter_id, photo_id, comment_id)
    commenter = User.find(commenter_id)
    photo = Photo.find(photo_id)
    comment = Comment.find(comment_id)

    result = service.send_comment_notification(commenter: commenter, photo: photo, comment: comment)

    if result[:success]
      if result[:skipped]
        Rails.logger.info("[SocialNotificationJob] Comment notification skipped: #{result[:reason]}")
      else
        Rails.logger.info("[SocialNotificationJob] Comment notification sent for photo #{photo_id}")
      end
    else
      Rails.logger.error("[SocialNotificationJob] Comment notification failed: #{result.dig(:error, :message)}")
    end
  end
end
