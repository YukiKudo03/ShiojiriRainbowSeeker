# frozen_string_literal: true

# RainbowMomentParticipation tracks user participation in a rainbow moment.
#
# Created when a user subscribes to the RainbowMomentChannel during an
# active moment. The 30-second grace period for app switching is handled
# at the channel level, not in this model.
#
# == Associations
# - belongs_to :rainbow_moment (counter_cache: :participants_count)
# - belongs_to :user
#
class RainbowMomentParticipation < ApplicationRecord
  belongs_to :rainbow_moment, counter_cache: :participants_count
  belongs_to :user

  validates :joined_at, presence: true
  validates :user_id, uniqueness: { scope: :rainbow_moment_id }

  scope :active, -> { where(left_at: nil) }
  scope :recent, -> { order(joined_at: :desc) }
end
