# frozen_string_literal: true

# Like model for user appreciation of rainbow photos.
#
# Tracks which users have liked which photos. Each user can only
# like a photo once (enforced by uniqueness validation).
#
# == Associations
# - belongs_to :user - The user who gave the like
# - belongs_to :photo - The photo being liked (with counter_cache)
#
# == Validations
# - user_id must be unique per photo (no duplicate likes)
#
# == Counter Cache
# The photo's like_count is automatically updated via counter_cache
# when likes are created or destroyed.
#
class Like < ApplicationRecord
  # Associations
  belongs_to :user
  belongs_to :photo, counter_cache: :like_count

  # Validations - prevent duplicate likes
  validates :user_id, uniqueness: { scope: :photo_id, message: "has already liked this photo" }

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :by_user, ->(user) { where(user: user) }
  scope :for_photo, ->(photo) { where(photo: photo) }

  # Check if like belongs to a given user
  #
  # @param check_user [User] The user to check ownership for
  # @return [Boolean] true if the like belongs to the user
  def owned_by?(check_user)
    user_id == check_user&.id
  end
end
