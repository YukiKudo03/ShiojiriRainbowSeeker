# frozen_string_literal: true

module Api
  module V1
    # NotificationsController handles notification-related API endpoints.
    #
    # Provides operations for:
    # - Listing user notifications with pagination and filtering
    # - Marking notifications as read
    # - Managing notification settings
    # - Registering device tokens for push notifications
    #
    # == API Endpoints
    #   GET    /api/v1/notifications           - List notifications
    #   POST   /api/v1/notifications/mark_read - Mark notifications as read
    #   GET    /api/v1/notifications/settings  - Get notification settings
    #   PUT    /api/v1/notifications/settings  - Update notification settings
    #   POST   /api/v1/notifications/devices   - Register device token
    #   DELETE /api/v1/notifications/devices   - Unregister device token
    #
    # == Requirements
    #   - FR-7: Notification Customization (AC-7.1〜AC-7.6)
    #
    class NotificationsController < BaseController
      # Authentication required for all actions
      before_action :authenticate_user!

      # GET /api/v1/notifications
      #
      # List notifications for the current user with pagination.
      #
      # @param page [Integer] Page number (default: 1)
      # @param per_page [Integer] Items per page (default: 20, max: 100)
      # @param filter [String] Filter type (unread, rainbow_alerts, social, system)
      #
      # @return [JSON] Paginated list of notifications
      #
      # @example Success response (200 OK)
      #   {
      #     "data": {
      #       "notifications": [
      #         {
      #           "id": "uuid",
      #           "type": "rainbow_alert",
      #           "title": "虹が見える可能性があります！",
      #           "body": "東の空をご覧ください",
      #           "data": { "location": {...} },
      #           "is_read": false,
      #           "created_at": "2024-01-21T10:00:00Z"
      #         }
      #       ],
      #       "pagination": {
      #         "current_page": 1,
      #         "total_pages": 5,
      #         "total_count": 100,
      #         "per_page": 20
      #       },
      #       "unread_count": 5
      #     }
      #   }
      def index
        result = notification_service.list_for_user(
          user: current_user,
          page: params[:page]&.to_i || 1,
          per_page: params[:per_page]&.to_i || 20,
          filter: params[:filter]&.to_sym
        )

        if result[:success]
          render_success(data: {
            notifications: result[:notifications],
            pagination: result[:pagination],
            unreadCount: result[:unreadCount]
          })
        else
          render_error(
            code: result.dig(:error, :code) || ErrorHandler::ErrorCodes::INTERNAL_ERROR,
            message: result.dig(:error, :message) || "An error occurred",
            status: error_status_for_code(result.dig(:error, :code))
          )
        end
      end

      # POST /api/v1/notifications/mark_read
      #
      # Mark notifications as read.
      #
      # @param notification_ids [Array<String>] Specific notification IDs to mark (optional, marks all if empty)
      #
      # @return [JSON] Number of marked notifications
      #
      # @example Request body
      #   { "notification_ids": ["uuid1", "uuid2"] }
      #
      # @example Success response (200 OK)
      #   { "data": { "marked_count": 2 } }
      def mark_read
        notification_ids = params[:notification_ids]

        result = notification_service.mark_as_read(
          user: current_user,
          notification_ids: notification_ids.presence
        )

        if result[:success]
          render_success(data: { markedCount: result[:markedCount] })
        else
          render_error(
            code: result.dig(:error, :code) || ErrorHandler::ErrorCodes::INTERNAL_ERROR,
            message: result.dig(:error, :message) || "An error occurred",
            status: error_status_for_code(result.dig(:error, :code))
          )
        end
      end

      # GET /api/v1/notifications/settings
      #
      # Get notification settings for the current user.
      #
      # @return [JSON] Notification settings
      #
      # @example Success response (200 OK)
      #   {
      #     "data": {
      #       "settings": {
      #         "rainbow_alerts": true,
      #         "likes": true,
      #         "comments": true,
      #         "system": true,
      #         "alert_radius_km": 10,
      #         "quiet_hours_start": "22:00",
      #         "quiet_hours_end": "07:00",
      #         "timezone": "Asia/Tokyo"
      #       }
      #     }
      #   }
      def settings_show
        result = notification_service.get_settings(user: current_user)

        if result[:success]
          render_success(data: { settings: result[:settings] })
        else
          render_error(
            code: result.dig(:error, :code) || ErrorHandler::ErrorCodes::INTERNAL_ERROR,
            message: result.dig(:error, :message) || "An error occurred",
            status: error_status_for_code(result.dig(:error, :code))
          )
        end
      end

      # PUT /api/v1/notifications/settings
      #
      # Update notification settings for the current user.
      #
      # @param rainbow_alerts [Boolean] Enable rainbow alert notifications
      # @param likes [Boolean] Enable like notifications
      # @param comments [Boolean] Enable comment notifications
      # @param system [Boolean] Enable system notifications
      # @param alert_radius_km [Integer] Alert radius (1, 5, 10, or 25 km)
      # @param quiet_hours_start [String] Quiet hours start time (HH:MM format)
      # @param quiet_hours_end [String] Quiet hours end time (HH:MM format)
      # @param timezone [String] Timezone identifier
      #
      # @return [JSON] Updated notification settings
      #
      # @example Request body
      #   {
      #     "alert_radius_km": 25,
      #     "quiet_hours_start": "23:00",
      #     "quiet_hours_end": "06:00"
      #   }
      #
      # @example Success response (200 OK)
      #   { "data": { "settings": {...} } }
      def settings_update
        result = notification_service.update_settings(
          user: current_user,
          settings: settings_params.to_h
        )

        if result[:success]
          render_success(data: { settings: result[:settings] })
        else
          render_error(
            code: result.dig(:error, :code) || ErrorHandler::ErrorCodes::VALIDATION_FAILED,
            message: result.dig(:error, :message) || "Validation failed",
            status: error_status_for_code(result.dig(:error, :code))
          )
        end
      end

      # POST /api/v1/notifications/devices
      #
      # Register a device token for push notifications.
      #
      # @param token [String] Device token (FCM or APNs)
      # @param platform [String] Platform identifier ("ios" or "android")
      #
      # @return [JSON] Registration result
      #
      # @example Request body
      #   { "token": "fcm_token_abc123", "platform": "android" }
      #
      # @example Success response (201 Created)
      #   { "data": { "device_token_id": "uuid", "platform": "android" } }
      def register_device
        token = params.require(:token)
        platform = params.require(:platform)

        unless %w[ios android].include?(platform)
          return render_error(
            code: ErrorHandler::ErrorCodes::VALIDATION_FAILED,
            message: "Platform must be 'ios' or 'android'",
            status: :unprocessable_entity
          )
        end

        device_token = DeviceToken.register(
          user: current_user,
          token: token,
          platform: platform
        )

        if device_token.persisted?
          render_success(
            data: {
              device_token_id: device_token.id,
              platform: device_token.platform
            },
            status: :created
          )
        else
          render_error(
            code: ErrorHandler::ErrorCodes::VALIDATION_FAILED,
            message: device_token.errors.full_messages.join(", "),
            status: :unprocessable_entity
          )
        end
      end

      # DELETE /api/v1/notifications/devices
      #
      # Unregister a device token.
      #
      # @param token [String] Device token to unregister
      #
      # @return [JSON] Unregistration result
      #
      # @example Success response (200 OK)
      #   { "data": { "message": "Device token unregistered" } }
      def unregister_device
        token = params.require(:token)

        device_token = current_user.device_tokens.find_by(token: token)

        if device_token
          device_token.deactivate!
          render_success(data: { message: "Device token unregistered" })
        else
          render_error(
            code: ErrorHandler::ErrorCodes::RESOURCE_NOT_FOUND,
            message: "Device token not found",
            status: :not_found
          )
        end
      end

      private

      def notification_service
        @notification_service ||= NotificationService.new
      end

      def settings_params
        params.permit(
          :rainbow_alerts,
          :likes,
          :comments,
          :system,
          :alert_radius_km,
          :quiet_hours_start,
          :quiet_hours_end,
          :timezone
        )
      end
    end
  end
end
