# frozen_string_literal: true

# Broadcasts new photos to all subscribed clients.
#
# Subscribe from the mobile app to receive real-time feed updates
# when any user uploads a new rainbow photo.
#
# Stream: "photo_feed" (global — all authenticated users)
#
class PhotoFeedChannel < ApplicationCable::Channel
  def subscribed
    stream_from "photo_feed"
  end

  def unsubscribed
    # Cleanup if needed
  end
end
