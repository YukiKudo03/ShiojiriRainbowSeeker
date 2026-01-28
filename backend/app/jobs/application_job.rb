# frozen_string_literal: true

# Base class for all background jobs in ShiojiriRainbowSeeker
# Uses Solid Queue (PostgreSQL-based) - no Redis required
class ApplicationJob < ActiveJob::Base
  # Automatically retry jobs that encountered a deadlock
  retry_on ActiveRecord::Deadlocked, wait: 5.seconds, attempts: 3

  # Most jobs are safe to ignore if the underlying records are no longer available
  discard_on ActiveJob::DeserializationError

  # Available queues (configured in config/queue.yml):
  # - default: General purpose tasks
  # - mailers: Email delivery jobs
  # - notifications: Push notification jobs (high priority)
  # - weather: Weather data fetching and processing jobs

  # Log job execution details
  around_perform do |job, block|
    Rails.logger.info("[#{job.class.name}] Starting job #{job.job_id}")
    start_time = Time.current
    block.call
    duration = Time.current - start_time
    Rails.logger.info("[#{job.class.name}] Completed job #{job.job_id} in #{duration.round(2)}s")
  end
end
