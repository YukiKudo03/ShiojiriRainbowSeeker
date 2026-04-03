# frozen_string_literal: true

# Handles the grace period for Rainbow Moment participation.
#
# When a user disconnects from the RainbowMomentChannel, this job
# runs after 30 seconds to check if they reconnected. If not,
# the participation is marked as left.
#
class RainbowMomentLeaveJob < ApplicationJob
  queue_as :default

  def perform(moment_id:, user_id:)
    moment = RainbowMoment.find_by(id: moment_id)
    return unless moment

    user = User.find_by(id: user_id)
    return unless user

    # Check if the user has an active subscription
    # If they reconnected within the grace period, they'll have a new subscription
    # and the channel will not have called leave
    subscription_active = ActionCable.server.connections.any? do |conn|
      conn.current_user&.id == user.id &&
        conn.subscriptions.identifiers.any? { |id| id.include?("RainbowMomentChannel") }
    end

    unless subscription_active
      moment.leave(user)
    end
  end
end
