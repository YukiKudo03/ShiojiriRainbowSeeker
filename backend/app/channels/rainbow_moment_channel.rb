# frozen_string_literal: true

# Real-time channel for Rainbow Moment shared viewing events.
#
# When a RainbowMoment is active, users subscribe to receive:
# - Participant count updates (heartbeat every 5 seconds)
# - New photo broadcasts from other participants
# - Moment status changes (closing, archived)
#
# == Grace Period
# A 30-second grace period handles app switching (e.g., user opens camera).
# On unsubscribe, a delayed job checks if the user reconnected. If not,
# the participation is marked as left.
#
# == Authentication
# Inherits JWT auth from ApplicationCable::Connection.
#
class RainbowMomentChannel < ApplicationCable::Channel
  GRACE_PERIOD = 30.seconds

  def subscribed
    @moment = RainbowMoment.find_by(id: params[:moment_id])

    if @moment.nil? || @moment.archived?
      reject
      return
    end

    stream_from "rainbow_moment:#{@moment.id}"

    # Join the moment (creates participation record)
    if @moment.active?
      @moment.join(current_user)
    end

    # Send current state to the newly subscribed client
    transmit(
      type: "initial_state",
      moment: serialize_moment(@moment),
      participant_count: @moment.active_participants_count
    )
  end

  def unsubscribed
    return unless @moment

    # Schedule a grace period check instead of immediate leave
    RainbowMomentLeaveJob.set(wait: GRACE_PERIOD).perform_later(
      moment_id: @moment.id,
      user_id: current_user.id
    )
  end

  # Client can send a heartbeat to confirm they're still watching.
  # This extends the grace period.
  def heartbeat
    # No-op: the subscription itself is the heartbeat.
    # The grace period handles temporary disconnects.
  end

  # Client broadcasts a new photo taken during the moment.
  def new_photo(data)
    return unless @moment&.active?

    ActionCable.server.broadcast(
      "rainbow_moment:#{@moment.id}",
      {
        type: "new_photo",
        photo: {
          id: data["photo_id"],
          user: {
            id: current_user.id,
            display_name: current_user.display_name
          },
          thumbnail_url: data["thumbnail_url"],
          latitude: data["latitude"],
          longitude: data["longitude"],
          captured_at: data["captured_at"]
        }
      }
    )
  end

  private

  def serialize_moment(moment)
    {
      id: moment.id,
      location_id: moment.location_id,
      location_name: moment.location_name,
      status: moment.status,
      starts_at: moment.starts_at.iso8601,
      ends_at: moment.ends_at.iso8601,
      weather_snapshot: moment.weather_snapshot,
      participants_count: moment.active_participants_count,
      photos_count: moment.photos.count
    }
  end
end
