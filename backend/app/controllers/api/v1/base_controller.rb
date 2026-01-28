# frozen_string_literal: true

module Api
  module V1
    # BaseController serves as the parent controller for all API v1 endpoints.
    #
    # Provides common functionality for the API including:
    # - JSON response formatting
    # - Error handling via ErrorHandler concern
    # - Authentication helpers
    #
    # All API v1 controllers should inherit from this class.
    class BaseController < ApplicationController
      # Render a successful JSON response
      #
      # @param data [Hash] the data to include in the response
      # @param status [Symbol] HTTP status code (default: :ok)
      # @param meta [Hash, nil] optional metadata to include
      def render_success(data:, status: :ok, meta: nil)
        response_body = { data: data }
        response_body[:meta] = meta if meta.present?

        render json: response_body, status: status
      end

      # Render an error response using the service result format
      #
      # @param result [Hash] service result with :error key containing :code and :message
      # @param status [Symbol] HTTP status code
      def render_service_error(result:, status:)
        render_error(
          code: result[:error][:code],
          message: result[:error][:message],
          details: result[:error][:details],
          status: status
        )
      end

      private

      # Authenticate user using JWT token from Authorization header
      # Uses Warden/Devise-JWT for authentication
      def authenticate_user!
        warden.authenticate!(:jwt, scope: :user)
      end

      # Get the current authenticated user
      def current_user
        warden.user(:user)
      end

      # Authenticate user but don't require it (for optional auth endpoints)
      # This allows personalization features for logged-in users
      def authenticate_user_optional
        # Try to authenticate, but don't fail if no token
        authenticate_user! if request.headers["Authorization"].present?
      rescue StandardError
        # Ignore authentication errors for optional auth
        nil
      end

      # Access to Warden instance
      def warden
        request.env["warden"]
      end

      # Determine appropriate HTTP status from error code
      #
      # @param error_code [Integer] the error code from the service
      # @return [Symbol] HTTP status symbol
      def http_status_for_error(error_code)
        case error_code
        when ErrorHandler::ErrorCodes::INVALID_EMAIL,
             ErrorHandler::ErrorCodes::INVALID_PASSWORD,
             ErrorHandler::ErrorCodes::INVALID_TOKEN
          :unauthorized
        when ErrorHandler::ErrorCodes::NOT_AUTHORIZED
          :forbidden
        when ErrorHandler::ErrorCodes::ACCOUNT_LOCKED,
             ErrorHandler::ErrorCodes::RATE_LIMIT_ERROR
          :too_many_requests
        when ErrorHandler::ErrorCodes::EMAIL_NOT_CONFIRMED
          :forbidden
        when ErrorHandler::ErrorCodes::USER_NOT_FOUND,
             ErrorHandler::ErrorCodes::PHOTO_NOT_FOUND,
             ErrorHandler::ErrorCodes::RESOURCE_NOT_FOUND
          :not_found
        when ErrorHandler::ErrorCodes::VALIDATION_FAILED,
             ErrorHandler::ErrorCodes::REQUIRED_FIELD_MISSING,
             ErrorHandler::ErrorCodes::CHARACTER_LIMIT_EXCEEDED,
             ErrorHandler::ErrorCodes::FILE_TOO_LARGE,
             ErrorHandler::ErrorCodes::INVALID_FILE_TYPE
          :unprocessable_entity
        when ErrorHandler::ErrorCodes::WEATHER_API_ERROR,
             ErrorHandler::ErrorCodes::S3_UPLOAD_ERROR
          :service_unavailable
        when ErrorHandler::ErrorCodes::TIMEOUT_ERROR
          :gateway_timeout
        else
          :internal_server_error
        end
      end

      # Alias for consistency with service result error codes
      alias_method :error_status_for_code, :http_status_for_error
    end
  end
end
