# frozen_string_literal: true

# LINE Messaging API Configuration
#
# Validates LINE channel access token presence in production.
# LINE notifications are optional - the app will function without them.

if Rails.env.production? && ENV["LINE_CHANNEL_ACCESS_TOKEN"].blank?
  Rails.logger.warn("LINE_CHANNEL_ACCESS_TOKEN is not set. LINE notifications will be disabled.")
end
