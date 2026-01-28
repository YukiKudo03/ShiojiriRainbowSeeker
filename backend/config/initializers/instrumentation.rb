# frozen_string_literal: true

# =============================================================================
# Application Instrumentation & Custom Metrics
# =============================================================================
# This initializer configures ActiveSupport::Notifications for custom
# application metrics and event tracking.
#
# Task 56: Monitoring & Logging Setup
# Requirements: NFR-8
# =============================================================================

# ===========================================================================
# Custom Event Subscribers
# ===========================================================================
# These subscribers capture key application events for monitoring and alerting.

module ApplicationInstrumentation
  # =========================================================================
  # Photo Upload Metrics
  # =========================================================================
  class PhotoUploadSubscriber
    def self.subscribe
      ActiveSupport::Notifications.subscribe("photo.uploaded") do |name, start, finish, id, payload|
        duration = finish - start

        Rails.logger.info({
          event: "photo_uploaded",
          photo_id: payload[:photo_id],
          user_id: payload[:user_id],
          file_size: payload[:file_size],
          duration_ms: (duration * 1000).round(2),
          timestamp: Time.current.iso8601
        }.to_json)

        # Report to Sentry if enabled
        if defined?(Sentry) && Sentry.initialized?
          Sentry.metrics.distribution(
            "photo.upload.duration",
            duration * 1000,
            unit: "millisecond"
          )
          Sentry.metrics.increment("photo.upload.count")
        end
      end
    end
  end

  # =========================================================================
  # Rainbow Alert Metrics
  # =========================================================================
  class RainbowAlertSubscriber
    def self.subscribe
      ActiveSupport::Notifications.subscribe("rainbow.alert_sent") do |name, start, finish, id, payload|
        Rails.logger.info({
          event: "rainbow_alert_sent",
          location: payload[:location],
          recipients_count: payload[:recipients_count],
          probability: payload[:probability],
          timestamp: Time.current.iso8601
        }.to_json)

        if defined?(Sentry) && Sentry.initialized?
          Sentry.metrics.increment("rainbow.alerts.sent")
          Sentry.metrics.gauge(
            "rainbow.alert.recipients",
            payload[:recipients_count] || 0
          )
        end
      end

      ActiveSupport::Notifications.subscribe("rainbow.condition_detected") do |name, start, finish, id, payload|
        Rails.logger.info({
          event: "rainbow_condition_detected",
          location: payload[:location],
          probability: payload[:probability],
          weather_conditions: payload[:weather_conditions],
          timestamp: Time.current.iso8601
        }.to_json)

        if defined?(Sentry) && Sentry.initialized?
          Sentry.metrics.increment("rainbow.conditions.detected")
        end
      end
    end
  end

  # =========================================================================
  # Authentication Metrics
  # =========================================================================
  class AuthenticationSubscriber
    def self.subscribe
      # Successful login
      ActiveSupport::Notifications.subscribe("auth.login.success") do |name, start, finish, id, payload|
        Rails.logger.info({
          event: "auth_login_success",
          user_id: payload[:user_id],
          ip_address: "[FILTERED]",
          timestamp: Time.current.iso8601
        }.to_json)

        if defined?(Sentry) && Sentry.initialized?
          Sentry.metrics.increment("auth.login.success")
        end
      end

      # Failed login
      ActiveSupport::Notifications.subscribe("auth.login.failure") do |name, start, finish, id, payload|
        Rails.logger.warn({
          event: "auth_login_failure",
          email: "[FILTERED]",
          reason: payload[:reason],
          attempts: payload[:attempts],
          timestamp: Time.current.iso8601
        }.to_json)

        if defined?(Sentry) && Sentry.initialized?
          Sentry.metrics.increment("auth.login.failure")

          # Alert on potential brute force
          if payload[:attempts].to_i >= 5
            Sentry.capture_message(
              "Potential brute force attack detected",
              level: :warning,
              extra: { attempts: payload[:attempts] }
            )
          end
        end
      end

      # Account lockout
      ActiveSupport::Notifications.subscribe("auth.account.locked") do |name, start, finish, id, payload|
        Rails.logger.warn({
          event: "auth_account_locked",
          user_id: payload[:user_id],
          reason: payload[:reason],
          timestamp: Time.current.iso8601
        }.to_json)

        if defined?(Sentry) && Sentry.initialized?
          Sentry.metrics.increment("auth.account.locked")
        end
      end
    end
  end

  # =========================================================================
  # Weather API Metrics
  # =========================================================================
  class WeatherApiSubscriber
    def self.subscribe
      ActiveSupport::Notifications.subscribe("weather.api.request") do |name, start, finish, id, payload|
        duration = finish - start

        Rails.logger.info({
          event: "weather_api_request",
          provider: payload[:provider],
          success: payload[:success],
          duration_ms: (duration * 1000).round(2),
          timestamp: Time.current.iso8601
        }.to_json)

        if defined?(Sentry) && Sentry.initialized?
          Sentry.metrics.distribution(
            "weather.api.duration",
            duration * 1000,
            unit: "millisecond",
            tags: { provider: payload[:provider] }
          )

          if payload[:success]
            Sentry.metrics.increment("weather.api.success")
          else
            Sentry.metrics.increment("weather.api.failure")
          end
        end
      end
    end
  end

  # =========================================================================
  # Job Processing Metrics
  # =========================================================================
  class JobProcessingSubscriber
    def self.subscribe
      ActiveSupport::Notifications.subscribe(/perform\.active_job/) do |name, start, finish, id, payload|
        duration = finish - start
        job = payload[:job]

        log_data = {
          event: "job_processed",
          job_class: job.class.name,
          job_id: job.job_id,
          queue: job.queue_name,
          duration_ms: (duration * 1000).round(2),
          timestamp: Time.current.iso8601
        }

        if payload[:exception_object]
          log_data[:status] = "failed"
          log_data[:error] = payload[:exception_object].class.name
          Rails.logger.error(log_data.to_json)
        else
          log_data[:status] = "success"
          Rails.logger.info(log_data.to_json)
        end

        if defined?(Sentry) && Sentry.initialized?
          Sentry.metrics.distribution(
            "job.processing.duration",
            duration * 1000,
            unit: "millisecond",
            tags: { job_class: job.class.name, queue: job.queue_name }
          )
        end
      end
    end
  end

  # =========================================================================
  # Database Query Metrics
  # =========================================================================
  class DatabaseQuerySubscriber
    SLOW_QUERY_THRESHOLD = 500 # milliseconds

    def self.subscribe
      ActiveSupport::Notifications.subscribe("sql.active_record") do |name, start, finish, id, payload|
        next if payload[:name] == "SCHEMA" || payload[:cached]

        duration_ms = (finish - start) * 1000

        # Log slow queries
        if duration_ms > SLOW_QUERY_THRESHOLD
          Rails.logger.warn({
            event: "slow_query",
            sql: payload[:sql]&.truncate(500),
            duration_ms: duration_ms.round(2),
            name: payload[:name],
            timestamp: Time.current.iso8601
          }.to_json)

          if defined?(Sentry) && Sentry.initialized?
            Sentry.metrics.increment("database.slow_queries")
            Sentry.add_breadcrumb(Sentry::Breadcrumb.new(
              category: "db.query",
              message: "Slow query detected",
              level: "warning",
              data: {
                duration_ms: duration_ms.round(2),
                query_name: payload[:name]
              }
            ))
          end
        end
      end
    end
  end

  # =========================================================================
  # API Rate Limiting Metrics (if implemented)
  # =========================================================================
  class RateLimitSubscriber
    def self.subscribe
      ActiveSupport::Notifications.subscribe("rate_limit.exceeded") do |name, start, finish, id, payload|
        Rails.logger.warn({
          event: "rate_limit_exceeded",
          ip: "[FILTERED]",
          endpoint: payload[:endpoint],
          limit: payload[:limit],
          timestamp: Time.current.iso8601
        }.to_json)

        if defined?(Sentry) && Sentry.initialized?
          Sentry.metrics.increment("rate_limit.exceeded")
        end
      end
    end
  end

  # =========================================================================
  # Initialize All Subscribers
  # =========================================================================
  def self.setup!
    PhotoUploadSubscriber.subscribe
    RainbowAlertSubscriber.subscribe
    AuthenticationSubscriber.subscribe
    WeatherApiSubscriber.subscribe
    JobProcessingSubscriber.subscribe
    DatabaseQuerySubscriber.subscribe
    RateLimitSubscriber.subscribe

    Rails.logger.info "[Instrumentation] Application instrumentation initialized"
  end
end

# Initialize instrumentation on Rails boot
Rails.application.config.after_initialize do
  ApplicationInstrumentation.setup!
end

# ===========================================================================
# Helper Module for Emitting Custom Events
# ===========================================================================
# Usage:
#   ApplicationEvents.emit(:photo_uploaded, photo_id: photo.id, user_id: user.id)
#
module ApplicationEvents
  EVENTS = {
    photo_uploaded: "photo.uploaded",
    rainbow_alert_sent: "rainbow.alert_sent",
    rainbow_condition_detected: "rainbow.condition_detected",
    auth_login_success: "auth.login.success",
    auth_login_failure: "auth.login.failure",
    auth_account_locked: "auth.account.locked",
    weather_api_request: "weather.api.request",
    rate_limit_exceeded: "rate_limit.exceeded"
  }.freeze

  def self.emit(event_name, **payload)
    event_key = EVENTS[event_name]
    raise ArgumentError, "Unknown event: #{event_name}" unless event_key

    ActiveSupport::Notifications.instrument(event_key, payload)
  end

  def self.measure(event_name, **payload, &block)
    event_key = EVENTS[event_name]
    raise ArgumentError, "Unknown event: #{event_name}" unless event_key

    ActiveSupport::Notifications.instrument(event_key, payload, &block)
  end
end
