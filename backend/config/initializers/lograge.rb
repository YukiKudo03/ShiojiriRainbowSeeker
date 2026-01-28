# frozen_string_literal: true

# =============================================================================
# Lograge Configuration - Structured JSON Logging
# =============================================================================
# This initializer configures Lograge for structured JSON logging in production.
# Lograge replaces the default Rails request logging with a single-line
# JSON format that's easier to parse by log aggregation tools.
#
# Task 56: Monitoring & Logging Setup
# Requirements: NFR-8
#
# Output format (JSON):
# {
#   "method": "GET",
#   "path": "/api/v1/photos",
#   "format": "json",
#   "controller": "Api::V1::PhotosController",
#   "action": "index",
#   "status": 200,
#   "duration": 50.23,
#   "view": 2.15,
#   "db": 25.67,
#   "request_id": "abc-123",
#   "user_id": 42,
#   "ip": "[FILTERED]",
#   "timestamp": "2024-01-15T10:30:00Z"
# }
# =============================================================================

Rails.application.configure do
  # Enable Lograge only in production and staging
  config.lograge.enabled = Rails.env.production? || Rails.env.staging?

  # Use JSON format for easy parsing
  config.lograge.formatter = Lograge::Formatters::Json.new

  # Don't log certain paths (reduce noise)
  config.lograge.ignore_actions = [
    "Rails::HealthController#show",      # Health checks
    "ActionController::RenderError#show" # Error pages
  ]

  # Ignore parameters that should never be logged
  config.lograge.ignore_custom = lambda do |event|
    # Skip logging for certain patterns
    event.payload[:path]&.start_with?("/assets/") ||
    event.payload[:path]&.start_with?("/packs/")
  end

  # Add custom data to each log line
  config.lograge.custom_options = lambda do |event|
    request = event.payload[:request]
    exception = event.payload[:exception_object]
    params = event.payload[:params]

    # Base data
    data = {
      timestamp: Time.current.iso8601,
      request_id: request&.request_id || event.payload[:headers]&.fetch("action_dispatch.request_id", nil),
      host: request&.host,
      remote_ip: "[FILTERED]", # PII filtering - don't log actual IPs
      user_agent: sanitize_user_agent(request&.user_agent)
    }

    # Add user ID if authenticated (from current_user set in controller)
    if event.payload[:user_id].present?
      data[:user_id] = event.payload[:user_id]
    end

    # Add request parameters (filtered)
    if params.present?
      filtered_params = filter_sensitive_params(params.to_unsafe_h)
      data[:params] = filtered_params if filtered_params.present?
    end

    # Add exception info if present
    if exception.present?
      data[:exception] = {
        class: exception.class.name,
        message: exception.message.truncate(200)
      }
    end

    # Add query count for N+1 detection (if Bullet is enabled in dev)
    if event.payload[:db_runtime].present?
      data[:db_queries] = event.payload[:db_runtime].round(2)
    end

    # Add Sentry trace ID for correlation
    if defined?(Sentry) && Sentry.get_current_scope&.span
      data[:sentry_trace_id] = Sentry.get_current_scope.span.trace_id
    end

    data.compact
  end

  # Add custom payload from controllers
  # Usage in controller: append_info_to_payload(payload)
  config.lograge.custom_payload do |controller|
    {
      user_id: controller.respond_to?(:current_user) && controller.current_user&.id
    }
  end

  # Keep original Rails logger for debug mode
  config.lograge.keep_original_rails_log = false

  # Log to STDOUT in production (for Docker/Kamal)
  if Rails.env.production? || Rails.env.staging?
    config.lograge.logger = ActiveSupport::Logger.new(STDOUT)
    config.lograge.logger.formatter = proc do |severity, datetime, _progname, msg|
      "#{msg}\n"
    end
  end
end

# ===========================================================================
# Helper Methods for Log Sanitization
# ===========================================================================

def filter_sensitive_params(params)
  return {} if params.blank?

  sensitive_keys = Rails.application.config.filter_parameters

  params.deep_transform_keys(&:to_s).each_with_object({}) do |(key, value), result|
    if sensitive_keys.any? { |pattern| key.to_s.match?(pattern) }
      result[key] = "[FILTERED]"
    elsif value.is_a?(Hash)
      result[key] = filter_sensitive_params(value)
    elsif value.is_a?(Array)
      result[key] = value.map { |v| v.is_a?(Hash) ? filter_sensitive_params(v) : v }
    else
      # Truncate long values
      result[key] = value.to_s.truncate(100) if value.present?
    end
  end
end

def sanitize_user_agent(user_agent)
  return nil if user_agent.blank?

  # Truncate and remove potentially sensitive info
  user_agent.to_s.truncate(150)
end

# ===========================================================================
# Custom Log Tags Configuration
# ===========================================================================
Rails.application.configure do
  # Add request ID and timestamp to all log messages
  config.log_tags = [
    :request_id,
    ->(request) { Time.current.iso8601 }
  ]
end
