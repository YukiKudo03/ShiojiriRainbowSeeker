# frozen_string_literal: true

# Comment model for user comments on rainbow photos.
#
# Allows users to discuss and share thoughts about rainbow sightings.
# Supports moderation via visibility flag and content reports.
# Supports anonymization when user accounts are deleted (GDPR compliance).
#
# == Associations
# - belongs_to :user - The user who wrote the comment (nullable for deleted users)
# - belongs_to :photo - The photo being commented on (with counter_cache)
# - has_many :reports - Content moderation reports for this comment
#
# == Validations
# - content: Required, maximum 500 characters, no banned words (FR-8 AC-8.6)
#
# == Counter Cache
# The photo's comment_count is automatically updated via counter_cache
# when comments are created or destroyed.
#
# == Anonymization (FR-12, AC-12.3)
# When a user deletes their account, their comments are anonymized:
# - user_id is set to nil
# - deleted_user_display_name is set to "deleted_user"
# The author_display_name method returns the appropriate name.
#
class Comment < ApplicationRecord
  # Associations
  belongs_to :user, optional: true  # Optional to support anonymized comments
  belongs_to :photo, counter_cache: :comment_count
  has_many :reports, as: :reportable, dependent: :destroy

  # Validations
  validates :content, presence: true, length: { maximum: 500 }
  validates :content, content: true  # Banned word filter (FR-8 AC-8.6)

  # Scopes
  scope :visible, -> { where(is_visible: true) }
  scope :hidden, -> { where(is_visible: false) }
  scope :recent, -> { order(created_at: :desc) }
  scope :oldest_first, -> { order(created_at: :asc) }
  scope :by_user, ->(user) { where(user: user) }
  scope :anonymized, -> { where(user_id: nil).where.not(deleted_user_display_name: nil) }
  scope :with_user, -> { where.not(user_id: nil) }

  # Hide the comment (soft moderation)
  #
  # @return [Boolean] true if update was successful
  def hide!
    update(is_visible: false)
  end

  # Restore a hidden comment
  #
  # @return [Boolean] true if update was successful
  def show!
    update(is_visible: true)
  end

  # Check if comment belongs to a given user
  #
  # @param check_user [User] The user to check ownership for
  # @return [Boolean] true if the comment belongs to the user
  def owned_by?(check_user)
    user_id == check_user&.id
  end

  # Check if this comment has been anonymized (user deleted)
  #
  # @return [Boolean] true if the comment is from a deleted user
  def anonymized?
    user_id.nil? && deleted_user_display_name.present?
  end

  # Get the display name for the comment author
  #
  # Returns the user's display name if available, or the deleted user
  # placeholder if the comment has been anonymized.
  #
  # @return [String] The author's display name
  def author_display_name
    if user.present?
      user.display_name
    elsif deleted_user_display_name.present?
      I18n.t("account_deletion.deleted_user_name", default: deleted_user_display_name)
    else
      I18n.t("account_deletion.unknown_user", default: "Unknown")
    end
  end
end
