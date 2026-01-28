# frozen_string_literal: true

# =============================================================================
# Sentry Error Tracking & Performance Monitoring Configuration
# =============================================================================
# This initializer configures Sentry for error tracking and performance
# monitoring with privacy-first PII filtering.
#
# Task 56: Monitoring & Logging Setup
# Requirements: NFR-8
#
# Environment Variables Required:
#   SENTRY_DSN - Sentry Data Source Name
#   SENTRY_ENVIRONMENT - Environment name (production, staging, etc.)
#   SENTRY_TRACES_SAMPLE_RATE - Transaction sampling rate (0.0 - 1.0)
#   SENTRY_PROFILES_SAMPLE_RATE - Profiling sampling rate (0.0 - 1.0)
# =============================================================================

if ENV["SENTRY_DSN"].present?
  Sentry.init do |config|
    # =========================================================================
    # Basic Configuration
    # =========================================================================
    config.dsn = ENV["SENTRY_DSN"]
    config.environment = ENV.fetch("SENTRY_ENVIRONMENT", Rails.env)
    config.release = ENV.fetch("GIT_COMMIT_SHA") { `git rev-parse HEAD 2>/dev/null`.strip.presence || "unknown" }

    # Application breadcrumb logging
    config.breadcrumbs_logger = [ :active_support_logger, :http_logger ]

    # Enable Rails-specific integrations
    config.enabled_environments = %w[production staging]

    # =========================================================================
    # Performance Monitoring (Tracing)
    # =========================================================================
    # Set traces sample rate (0.0 - 1.0)
    # Production: start low (0.1-0.2), adjust based on budget
    config.traces_sample_rate = ENV.fetch("SENTRY_TRACES_SAMPLE_RATE", "0.1").to_f

    # Custom transaction sampling for high-value endpoints
    config.traces_sampler = lambda do |sampling_context|
      transaction_context = sampling_context[:transaction_context]
      transaction_name = transaction_context[:name]

      case transaction_name
      # Always sample health checks at lower rate
      when /\A(GET|HEAD)\s+\/up\z/
        0.01
      # Sample authentication at higher rate (security critical)
      when /auth/
        0.5
      # Sample photo uploads at higher rate (core feature)
      when /photos.*create/
        0.3
      # Sample rainbow alerts at higher rate (core feature)
      when /rainbow.*alert/
        0.5
      # Default sampling rate
      else
        ENV.fetch("SENTRY_TRACES_SAMPLE_RATE", "0.1").to_f
      end
    end

    # =========================================================================
    # Profiling (Optional - requires additional setup)
    # =========================================================================
    config.profiles_sample_rate = ENV.fetch("SENTRY_PROFILES_SAMPLE_RATE", "0.0").to_f

    # =========================================================================
    # PII Filtering - CRITICAL for GDPR/Privacy Compliance
    # =========================================================================
    # Enable automatic PII scrubbing
    config.send_default_pii = false

    # Custom data scrubbing before events are sent
    config.before_send = lambda do |event, hint|
      # List of sensitive fields to redact
      sensitive_fields = %w[
        password
        password_confirmation
        current_password
        new_password
        token
        access_token
        refresh_token
        api_key
        secret
        authorization
        cookie
        session
        credit_card
        card_number
        cvv
        ssn
        social_security
        email
        phone
        address
        ip
        location
        latitude
        longitude
        lat
        lng
      ]

      # Scrub sensitive data from request parameters
      if event.request&.data.is_a?(Hash)
        event.request.data = scrub_hash(event.request.data.deep_dup, sensitive_fields)
      end

      # Scrub sensitive data from extra context
      if event.extra.is_a?(Hash)
        event.extra = scrub_hash(event.extra.deep_dup, sensitive_fields)
      end

      # Scrub sensitive data from user context (keep only id for debugging)
      if event.user
        event.user = {
          id: event.user[:id],
          # Mask email but keep domain for context
          email: event.user[:email]&.gsub(/[^@]+@/, "***@")
        }.compact
      end

      # Scrub breadcrumb data
      event.breadcrumbs&.each do |breadcrumb|
        if breadcrumb.data.is_a?(Hash)
          breadcrumb.data = scrub_hash(breadcrumb.data.deep_dup, sensitive_fields)
        end
      end

      event
    end

    # Filter out specific exceptions that shouldn't be reported
    config.excluded_exceptions += [
      "ActionController::RoutingError",
      "ActionController::BadRequest",
      "ActionController::InvalidAuthenticityToken",
      "ActiveRecord::RecordNotFound",
      "Pundit::NotAuthorizedError"
    ]

    # =========================================================================
    # Context and Tags
    # =========================================================================
    # Add global tags to all events
    config.before_send_transaction = lambda do |event, _hint|
      event.tags ||= {}
      event.tags[:rails_env] = Rails.env
      event.tags[:ruby_version] = RUBY_VERSION
      event.tags[:rails_version] = Rails.version
      event
    end

    # =========================================================================
    # Background Jobs Integration
    # =========================================================================
    # Automatic Solid Queue integration (if available)
    if defined?(SolidQueue)
      config.background_worker_threads = 2
    end

    # =========================================================================
    # Logging Configuration
    # =========================================================================
    config.logger = Rails.logger
    config.debug = Rails.env.development?
  end

  # ===========================================================================
  # Helper Method for Scrubbing Sensitive Data
  # ===========================================================================
  def scrub_hash(hash, sensitive_fields)
    return hash unless hash.is_a?(Hash)

    hash.transform_values! do |value|
      case value
      when Hash
        scrub_hash(value, sensitive_fields)
      when Array
        value.map { |v| v.is_a?(Hash) ? scrub_hash(v, sensitive_fields) : v }
      else
        value
      end
    end

    hash.each do |key, value|
      key_str = key.to_s.downcase
      if sensitive_fields.any? { |field| key_str.include?(field) }
        hash[key] = "[FILTERED]"
      end
    end

    hash
  end

  # Make scrub_hash available globally for the lambda
  module_function :scrub_hash

  Rails.logger.info "[Sentry] Initialized for environment: #{Sentry.configuration.environment}"
else
  Rails.logger.warn "[Sentry] SENTRY_DSN not configured, error tracking disabled"
end
