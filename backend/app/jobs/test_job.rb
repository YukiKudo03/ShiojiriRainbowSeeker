# frozen_string_literal: true

# TestJob - A simple job for verifying Solid Queue is working correctly
#
# Usage:
#   TestJob.perform_later("Hello from Solid Queue!")
#   TestJob.set(queue: :default).perform_later("Custom message")
#
# To verify the job ran, check the Rails log for:
#   "TestJob executed successfully: <message>"
#
class TestJob < ApplicationJob
  queue_as :default

  # Retry configuration for transient failures
  retry_on StandardError, wait: :polynomially_longer, attempts: 3

  def perform(message = "Test message")
    Rails.logger.info("[TestJob] Starting execution...")
    Rails.logger.info("[TestJob] Message: #{message}")
    Rails.logger.info("[TestJob] Queue: #{queue_name}")
    Rails.logger.info("[TestJob] Job ID: #{job_id}")
    Rails.logger.info("[TestJob] Executed at: #{Time.current}")
    Rails.logger.info("[TestJob] TestJob executed successfully: #{message}")

    # Return true to indicate successful execution
    true
  end
end
