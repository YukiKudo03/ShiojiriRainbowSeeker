# frozen_string_literal: true

# Apple Push Notification service (APNs) configuration using rpush gem.
#
# rpush is used to send push notifications to iOS devices via APNs.
# This initializer configures the rpush daemon and APNs app settings.
#
# == Environment Variables
# - APNS_CERTIFICATE_PATH: Path to the APNs certificate file (.pem)
# - APNS_CERTIFICATE_PASSWORD: Password for the APNs certificate (optional)
# - APNS_CERTIFICATE_BASE64: Base64-encoded APNs certificate (for production)
# - APNS_BUNDLE_ID: iOS app bundle identifier
# - APNS_ENVIRONMENT: "production" or "sandbox" (default: based on Rails.env)
#
# == Usage
#   ApnsClient.send_notification(
#     token: device_token,
#     title: "虹が見える可能性があります！",
#     body: "東の空をご覧ください",
#     data: { photo_id: "uuid" }
#   )
#
# == Requirements
# - FR-6: Push notifications for rainbow alerts

module ApnsClient
  class ConfigurationError < StandardError; end
  class NotificationError < StandardError; end

  class << self
    # Send a push notification to a single iOS device
    #
    # @param token [String] APNs device token
    # @param title [String] Notification title
    # @param body [String] Notification body
    # @param data [Hash] Custom data payload
    # @param options [Hash] Additional notification options
    # @return [Hash] Result with success status
    def send_notification(token:, title:, body:, data: {}, options: {})
      ensure_configured!

      notification = build_notification(token, title, body, data, options)
      deliver_notification(notification)
    end

    # Send notifications to multiple iOS devices
    #
    # @param tokens [Array<String>] APNs device tokens
    # @param title [String] Notification title
    # @param body [String] Notification body
    # @param data [Hash] Custom data payload
    # @return [Array<Hash>] Results for each device
    def send_to_devices(tokens:, title:, body:, data: {})
      ensure_configured!

      tokens.map do |token|
        send_notification(token: token, title: title, body: body, data: data)
      rescue NotificationError => e
        { success: false, token: token, error: e.message }
      end
    end

    # Check if APNs is configured
    #
    # @return [Boolean] true if APNs is configured
    def configured?
      bundle_id.present? && (certificate_path.present? || certificate_base64.present?)
    end

    # Get the APNs environment
    #
    # @return [String] "production" or "sandbox"
    def environment
      ENV.fetch("APNS_ENVIRONMENT", nil) || (Rails.env.production? ? "production" : "sandbox")
    end

    # Get iOS app bundle ID
    #
    # @return [String, nil] Bundle identifier
    def bundle_id
      ENV.fetch("APNS_BUNDLE_ID", nil)
    end

    private

    def ensure_configured!
      return if configured?

      raise ConfigurationError, "APNs is not configured. Set APNS_BUNDLE_ID and certificate."
    end

    def build_notification(token, title, body, data, options)
      return mock_notification(token, title, body, data) if Rails.env.test?

      ensure_app_exists!

      notification = Rpush::Apns2::Notification.new
      notification.app = rpush_app
      notification.device_token = token
      notification.alert = {
        title: title,
        body: body
      }
      notification.data = data if data.present?
      notification.sound = options[:sound] || "default"
      notification.badge = options[:badge] if options[:badge]
      notification.content_available = options[:content_available] || false
      notification.mutable_content = options[:mutable_content] || true
      notification.category = options[:category] || "RAINBOW_ALERT"
      notification.thread_id = options[:thread_id]
      notification
    end

    def mock_notification(token, title, body, data)
      # Return a mock object for testing
      OpenStruct.new(
        device_token: token,
        alert: { title: title, body: body },
        data: data,
        mock: true
      )
    end

    def deliver_notification(notification)
      if notification.respond_to?(:mock) && notification.mock
        Rails.logger.info("[APNs] Mock send: token=#{notification.device_token}")
        return { success: true, notification_id: "mock_#{SecureRandom.hex(8)}" }
      end

      notification.save!

      {
        success: true,
        notification_id: notification.id
      }
    rescue StandardError => e
      raise NotificationError, "APNs Error: #{e.message}"
    end

    def rpush_app
      @rpush_app ||= Rpush::Apns2::App.find_by(name: app_name)
    end

    def ensure_app_exists!
      return if rpush_app.present?

      create_app!
      @rpush_app = Rpush::Apns2::App.find_by(name: app_name)
    end

    def create_app!
      app = Rpush::Apns2::App.new
      app.name = app_name
      app.certificate = load_certificate
      app.password = certificate_password
      app.environment = environment
      app.bundle_id = bundle_id
      app.connections = connection_count
      app.save!

      Rails.logger.info("[APNs] Created rpush app: #{app_name}")
    rescue StandardError => e
      Rails.logger.error("[APNs] Failed to create rpush app: #{e.message}")
      raise ConfigurationError, "Failed to configure APNs: #{e.message}"
    end

    def load_certificate
      if certificate_base64.present?
        # Production: Base64 encoded certificate
        Base64.decode64(certificate_base64)
      elsif certificate_path.present? && File.exist?(certificate_path)
        # Development: Certificate file path
        File.read(certificate_path)
      else
        raise ConfigurationError, "No APNs certificate found"
      end
    end

    def certificate_path
      ENV.fetch("APNS_CERTIFICATE_PATH", nil)
    end

    def certificate_base64
      ENV.fetch("APNS_CERTIFICATE_BASE64", nil)
    end

    def certificate_password
      ENV.fetch("APNS_CERTIFICATE_PASSWORD", nil)
    end

    def app_name
      "shiojiri_rainbow_seeker_#{environment}"
    end

    def connection_count
      Rails.env.production? ? 2 : 1
    end
  end
end

# Initialize rpush on Rails boot
Rails.application.config.after_initialize do
  if ApnsClient.configured?
    Rails.logger.info("[APNs] Apple Push Notification service configured for bundle: #{ApnsClient.bundle_id} (#{ApnsClient.environment})")
  else
    Rails.logger.warn("[APNs] Apple Push Notification service not configured. Push notifications to iOS will not work.")
  end
end
