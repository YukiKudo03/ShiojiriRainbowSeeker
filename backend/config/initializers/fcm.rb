# frozen_string_literal: true

# Firebase Cloud Messaging (FCM) configuration for Android push notifications.
#
# FCM is used to send push notifications to Android devices.
# The service account credentials are loaded from environment variables.
#
# == Environment Variables
# - FIREBASE_PROJECT_ID: Firebase project ID
# - FIREBASE_CREDENTIALS_JSON: Service account JSON (base64 encoded for production)
# - FIREBASE_CREDENTIALS_PATH: Path to service account JSON file (development)
#
# == Usage
#   FcmClient.send_notification(
#     token: device_token,
#     title: "虹が見える可能性があります！",
#     body: "東の空をご覧ください",
#     data: { photo_id: "uuid" }
#   )
#
# == Requirements
# - FR-6: Push notifications for rainbow alerts

module FcmClient
  class ConfigurationError < StandardError; end
  class NotificationError < StandardError; end

  # FCM HTTP v1 API endpoint
  FCM_API_BASE = "https://fcm.googleapis.com/v1/projects"

  class << self
    # Send a push notification to a single device
    #
    # @param token [String] FCM device token
    # @param title [String] Notification title
    # @param body [String] Notification body
    # @param data [Hash] Custom data payload
    # @param options [Hash] Additional notification options
    # @return [Hash] Response from FCM
    def send_notification(token:, title:, body:, data: {}, options: {})
      ensure_configured!

      message = build_message(token, title, body, data, options)
      send_message(message)
    end

    # Send notifications to multiple devices
    #
    # @param tokens [Array<String>] FCM device tokens
    # @param title [String] Notification title
    # @param body [String] Notification body
    # @param data [Hash] Custom data payload
    # @return [Array<Hash>] Responses from FCM
    def send_to_devices(tokens:, title:, body:, data: {})
      ensure_configured!

      tokens.map do |token|
        send_notification(token: token, title: title, body: body, data: data)
      rescue NotificationError => e
        { success: false, token: token, error: e.message }
      end
    end

    # Check if FCM is configured
    #
    # @return [Boolean] true if FCM is configured
    def configured?
      project_id.present? && (credentials_json.present? || credentials_path.present?)
    end

    # Get Firebase project ID
    #
    # @return [String, nil] Firebase project ID
    def project_id
      ENV.fetch("FIREBASE_PROJECT_ID", nil)
    end

    private

    def ensure_configured!
      return if configured?

      raise ConfigurationError, "FCM is not configured. Set FIREBASE_PROJECT_ID and credentials."
    end

    def build_message(token, title, body, data, options)
      {
        message: {
          token: token,
          notification: {
            title: title,
            body: body
          },
          data: stringify_data(data),
          android: android_config(options),
          apns: nil # APNs handled separately by rpush
        }
      }
    end

    def android_config(options)
      {
        priority: options[:priority] || "high",
        notification: {
          channel_id: options[:channel_id] || "rainbow_alerts",
          icon: options[:icon] || "ic_notification",
          color: options[:color] || "#4285F4",
          sound: options[:sound] || "default",
          click_action: options[:click_action] || "FLUTTER_NOTIFICATION_CLICK"
        },
        ttl: "#{options[:ttl] || 3600}s"
      }
    end

    def stringify_data(data)
      data.transform_values(&:to_s)
    end

    def send_message(message)
      return mock_send(message) if Rails.env.test? || !configured?

      response = fcm_client.send_v1(message)
      handle_response(response)
    end

    def mock_send(message)
      Rails.logger.info("[FCM] Mock send: #{message.to_json}")
      { success: true, message_id: "mock_#{SecureRandom.hex(8)}" }
    end

    def fcm_client
      @fcm_client ||= begin
        credentials = load_credentials
        FCM.new(
          credentials[:project_id],
          credentials[:json_key_io],
          nil # No legacy server key needed for HTTP v1 API
        )
      end
    end

    def load_credentials
      if credentials_json.present?
        # Production: Base64 encoded JSON from environment variable
        json_content = Base64.decode64(credentials_json)
        {
          project_id: project_id,
          json_key_io: StringIO.new(json_content)
        }
      elsif credentials_path.present? && File.exist?(credentials_path)
        # Development: JSON file path
        {
          project_id: project_id,
          json_key_io: File.open(credentials_path)
        }
      else
        raise ConfigurationError, "No Firebase credentials found"
      end
    end

    def credentials_json
      ENV.fetch("FIREBASE_CREDENTIALS_JSON", nil)
    end

    def credentials_path
      ENV.fetch("FIREBASE_CREDENTIALS_PATH", nil)
    end

    def handle_response(response)
      if response[:status_code] == 200
        {
          success: true,
          message_id: response[:body]["name"]
        }
      else
        error_message = response[:body]["error"]["message"] rescue "Unknown error"
        raise NotificationError, "FCM Error: #{error_message}"
      end
    end
  end
end

# Initialize FCM on Rails boot
Rails.application.config.after_initialize do
  if FcmClient.configured?
    Rails.logger.info("[FCM] Firebase Cloud Messaging configured for project: #{FcmClient.project_id}")
  else
    Rails.logger.warn("[FCM] Firebase Cloud Messaging not configured. Push notifications to Android will not work.")
  end
end
