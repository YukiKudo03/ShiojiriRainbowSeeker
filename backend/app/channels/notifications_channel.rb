# frozen_string_literal: true

# Streams per-user notifications in real time.
#
# Each user receives their own stream, so likes, comments,
# and rainbow alerts arrive instantly in the app.
#
# Stream: keyed to `current_user`
#
class NotificationsChannel < ApplicationCable::Channel
  def subscribed
    stream_for current_user
  end

  def unsubscribed
    # Cleanup if needed
  end
end
