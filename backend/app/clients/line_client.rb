# frozen_string_literal: true

# LineClient handles communication with the LINE Messaging API.
#
# Sends push notifications to users who have linked their LINE accounts.
# Uses the LINE Messaging API v2 push message endpoint.
#
# == Configuration
# Requires the following environment variables:
# - LINE_CHANNEL_ACCESS_TOKEN: Channel access token from LINE Developers Console
#
# == Usage
#   LineClient.send_push_message(
#     line_user_id: "U1234567890",
#     title: "虹アラート",
#     body: "東の空をご覧ください",
#     data: { type: "rainbow_alert" }
#   )
#
class LineClient
  class ConfigurationError < StandardError; end
  class DeliveryError < StandardError; end

  PUSH_URL = "https://api.line.me/v2/bot/message/push"
  MULTICAST_URL = "https://api.line.me/v2/bot/message/multicast"
  MAX_MULTICAST_USERS = 500

  class << self
    # Check if LINE notifications are configured
    #
    # @return [Boolean] true if LINE channel access token is set
    def configured?
      ENV["LINE_CHANNEL_ACCESS_TOKEN"].present?
    end

    # Send a push message to a single LINE user
    #
    # @param line_user_id [String] LINE user ID
    # @param title [String] Message title (used in Flex Message header)
    # @param body [String] Message body
    # @param data [Hash] Additional data (included as postback action data)
    # @return [Hash] Result with :success and optional :error
    def send_push_message(line_user_id:, title:, body:, data: {})
      raise ConfigurationError, "LINE channel access token not configured" unless configured?

      payload = {
        to: line_user_id,
        messages: [build_flex_message(title, body, data)]
      }

      response = connection.post(PUSH_URL) do |req|
        req.headers["Authorization"] = "Bearer #{access_token}"
        req.headers["Content-Type"] = "application/json"
        req.body = payload.to_json
      end

      handle_response(response, line_user_id)
    rescue Faraday::Error => e
      { success: false, error: e.message }
    end

    # Send a message to multiple LINE users at once
    #
    # @param line_user_ids [Array<String>] LINE user IDs (max 500)
    # @param title [String] Message title
    # @param body [String] Message body
    # @param data [Hash] Additional data
    # @return [Array<Hash>] Results for each batch
    def send_multicast(line_user_ids:, title:, body:, data: {})
      raise ConfigurationError, "LINE channel access token not configured" unless configured?

      results = []

      line_user_ids.each_slice(MAX_MULTICAST_USERS) do |batch|
        payload = {
          to: batch,
          messages: [build_flex_message(title, body, data)]
        }

        response = connection.post(MULTICAST_URL) do |req|
          req.headers["Authorization"] = "Bearer #{access_token}"
          req.headers["Content-Type"] = "application/json"
          req.body = payload.to_json
        end

        results << {
          success: response.status == 200,
          batch_size: batch.size,
          status: response.status
        }
      end

      results
    rescue Faraday::Error => e
      [{ success: false, error: e.message }]
    end

    private

    def access_token
      ENV.fetch("LINE_CHANNEL_ACCESS_TOKEN")
    end

    def connection
      @connection ||= Faraday.new do |conn|
        conn.options.timeout = 10
        conn.options.open_timeout = 5
        conn.adapter Faraday.default_adapter
      end
    end

    # Build a LINE Flex Message for rich notification display
    def build_flex_message(title, body, data)
      {
        type: "flex",
        altText: "#{title}: #{body}",
        contents: {
          type: "bubble",
          header: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: title,
                weight: "bold",
                size: "lg",
                color: "#1DB446"
              }
            ]
          },
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: body,
                wrap: true,
                size: "md",
                color: "#333333"
              }
            ]
          },
          footer: build_footer(data)
        }.compact
      }
    end

    def build_footer(data)
      return nil if data.blank? || data[:type].blank?

      {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            action: {
              type: "uri",
              label: "アプリで確認",
              uri: "shiojiri-rainbow://#{data[:type]}"
            },
            style: "primary",
            color: "#1DB446"
          }
        ]
      }
    end

    def handle_response(response, line_user_id)
      case response.status
      when 200
        { success: true, line_user_id: line_user_id }
      when 400
        { success: false, error: "Invalid request", line_user_id: line_user_id }
      when 401
        { success: false, error: "Invalid channel access token" }
      when 429
        { success: false, error: "Rate limit exceeded" }
      else
        { success: false, error: "LINE API error: #{response.status}", line_user_id: line_user_id }
      end
    end
  end
end
