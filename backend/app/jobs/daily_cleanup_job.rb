# frozen_string_literal: true

# DailyCleanupJob handles routine data maintenance tasks.
#
# Runs daily via Solid Queue recurring schedule to:
# - Remove expired JWT denylist entries
# - Remove inactive device tokens (30+ days)
#
# == Queue
# Runs on the 'default' queue.
#
# == Usage
#   DailyCleanupJob.perform_later
#
class DailyCleanupJob < ApplicationJob
  queue_as :default

  def perform
    jwt_count = JwtDenylist.cleanup_expired
    Rails.logger.info("[DailyCleanupJob] Cleaned up #{jwt_count} expired JWT denylist entries")

    token_count = DeviceToken.cleanup_inactive(days_old: 30)
    Rails.logger.info("[DailyCleanupJob] Cleaned up #{token_count} inactive device tokens")
  end
end
