# frozen_string_literal: true

# User model for the Shiojiri Rainbow Seeker application.
#
# Handles user authentication via Devise with JWT support for API access.
# Includes profile management, role-based access control, soft delete support,
# and GDPR-compliant account deletion with grace period.
#
# == Associations
# - has_many :photos - Rainbow photos submitted by this user
# - has_many :comments - Comments made on photos
# - has_many :likes - Likes given to photos
# - has_many :notifications - In-app notifications
# - has_many :device_tokens - Push notification tokens
# - has_one_attached :profile_image - User's profile avatar
#
# == Validations
# - display_name: 3-30 characters, required
# - locale: Must be 'ja' or 'en'
#
# == Roles
# - user (0): Regular user
# - admin (1): Administrator with moderation privileges
#
# == Account Deletion (FR-12, GDPR)
# - deletion_requested_at: When user requested account deletion
# - deletion_scheduled_at: When deletion will be executed (14 days after request)
# - deletion_job_id: ID of scheduled deletion job (for cancellation)
#
class User < ApplicationRecord
  # Include default devise modules.
  # Others available are: :lockable, :timeoutable, :trackable and :omniauthable
  devise :database_authenticatable, :registerable, :recoverable,
         :rememberable, :validatable, :confirmable, :jwt_authenticatable,
         jwt_revocation_strategy: JwtDenylist

  # Profile image attachment via Active Storage
  has_one_attached :profile_image

  # Associations
  has_many :photos, dependent: :destroy
  has_many :comments, dependent: :destroy
  has_many :likes, dependent: :destroy
  has_many :notifications, dependent: :destroy
  has_many :device_tokens, dependent: :destroy

  # Validations
  validates :display_name, presence: true, length: { in: 3..30 }
  validates :locale, inclusion: { in: %w[ja en] }

  # Role enumeration
  enum :role, { user: 0, admin: 1 }

  # Scopes
  scope :active, -> { where(deleted_at: nil) }
  scope :deleted, -> { where.not(deleted_at: nil) }
  scope :confirmed, -> { where.not(confirmed_at: nil) }
  scope :admins, -> { where(role: :admin) }
  scope :flagged, -> { where(violation_flagged: true) }
  scope :pending_deletion, -> { where.not(deletion_requested_at: nil) }
  scope :deletion_due, -> { where("deletion_scheduled_at <= ?", Time.current) }

  # Check if user has been soft deleted
  #
  # @return [Boolean] true if user is deleted
  def deleted?
    deleted_at.present?
  end

  # Soft delete the user
  #
  # @return [Boolean] true if update was successful
  def soft_delete
    update(deleted_at: Time.current)
  end

  # Restore a soft deleted user
  #
  # @return [Boolean] true if update was successful
  def restore
    update(deleted_at: nil)
  end

  # Override Devise's active_for_authentication? to prevent deleted users from logging in
  #
  # @return [Boolean] true if user can authenticate
  def active_for_authentication?
    super && !deleted?
  end

  # Message shown when deleted user tries to log in
  #
  # @return [Symbol] the inactive message key
  def inactive_message
    deleted? ? :deleted : super
  end

  # Check if user has requested account deletion
  #
  # @return [Boolean] true if deletion has been requested
  def deletion_pending?
    deletion_requested_at.present?
  end

  # Check if account deletion can still be canceled
  #
  # @return [Boolean] true if within grace period
  def deletion_cancelable?
    deletion_pending? && deletion_scheduled_at.present? && Time.current < deletion_scheduled_at
  end

  # Get remaining days until deletion
  #
  # @return [Integer, nil] Days remaining or nil if no deletion pending
  def deletion_days_remaining
    return nil unless deletion_pending? && deletion_scheduled_at.present?

    remaining = (deletion_scheduled_at - Time.current) / 1.day
    [ remaining.ceil, 0 ].max
  end
end
