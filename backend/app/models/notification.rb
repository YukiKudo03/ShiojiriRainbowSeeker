# frozen_string_literal: true

# Notification model for in-app user notifications.
#
# Stores notifications for various events including rainbow alerts,
# likes, comments, and system messages.
#
# == Associations
# - belongs_to :user - The user who receives this notification
#
# == Notification Types
# - rainbow_alert (0): Weather conditions favorable for rainbow viewing
# - like (1): Someone liked the user's photo
# - comment (2): Someone commented on the user's photo
# - system (3): System announcements and administrative messages
#
# == Data Field
# The data JSONB field stores notification-specific payload:
# - For likes: { photo_id: '...', liker_id: '...', liker_name: '...' }
# - For comments: { photo_id: '...', commenter_id: '...', comment_preview: '...' }
# - For rainbow_alert: { location: '...', probability: 0.8, expires_at: '...' }
#
class Notification < ApplicationRecord
  # Associations
  belongs_to :user

  # Notification type enumeration
  enum :notification_type, { rainbow_alert: 0, like: 1, comment: 2, system: 3 }

  # Validations
  validates :notification_type, presence: true
  validates :title, length: { maximum: 200 }, allow_nil: true
  validates :body, length: { maximum: 1000 }, allow_nil: true

  # Scopes
  scope :unread, -> { where(is_read: false) }
  scope :read, -> { where(is_read: true) }
  scope :recent, -> { order(created_at: :desc) }
  scope :rainbow_alerts, -> { where(notification_type: :rainbow_alert) }
  scope :social, -> { where(notification_type: [ :like, :comment ]) }
  scope :system_notifications, -> { where(notification_type: :system) }

  # Mark notification as read
  #
  # @return [Boolean] true if update was successful
  def mark_as_read!
    update(is_read: true)
  end

  # Mark notification as unread
  #
  # @return [Boolean] true if update was successful
  def mark_as_unread!
    update(is_read: false)
  end

  # Get the associated photo ID from notification data
  #
  # @return [String, nil] Photo ID if present in data
  def photo_id
    data&.dig("photo_id")
  end

  # Get the actor ID (user who triggered the notification)
  #
  # @return [String, nil] User ID if present in data
  def actor_id
    data&.dig("liker_id") || data&.dig("commenter_id")
  end

  # Check if notification is for a social interaction (like or comment)
  #
  # @return [Boolean] true if notification is like or comment type
  def social?
    like? || comment?
  end

  # Class method to mark all notifications as read for a user
  #
  # @param user [User] The user whose notifications to mark as read
  # @return [Integer] Number of updated records
  def self.mark_all_read_for_user(user)
    where(user: user, is_read: false).update_all(is_read: true)
  end

  # Class method to create a like notification
  #
  # @param recipient [User] The user who will receive the notification
  # @param like [Like] The like that triggered this notification
  # @return [Notification] The created notification
  def self.create_like_notification(recipient, like)
    create(
      user: recipient,
      notification_type: :like,
      title: "#{like.user.display_name} liked your photo",
      body: like.photo.title.presence || "Your rainbow photo",
      data: {
        photo_id: like.photo_id,
        liker_id: like.user_id,
        liker_name: like.user.display_name
      }
    )
  end

  # Class method to create a comment notification
  #
  # @param recipient [User] The user who will receive the notification
  # @param comment [Comment] The comment that triggered this notification
  # @return [Notification] The created notification
  def self.create_comment_notification(recipient, comment)
    create(
      user: recipient,
      notification_type: :comment,
      title: "#{comment.user.display_name} commented on your photo",
      body: comment.content.truncate(100),
      data: {
        photo_id: comment.photo_id,
        commenter_id: comment.user_id,
        commenter_name: comment.user.display_name,
        comment_preview: comment.content.truncate(100)
      }
    )
  end
end
