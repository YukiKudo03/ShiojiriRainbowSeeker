# frozen_string_literal: true

# ErrorHandler concern provides unified error handling for API controllers.
# It follows the error code system defined in the design documentation:
#   1000-1999: Authentication errors
#   2000-2999: Validation errors
#   3000-3999: Resource errors
#   4000-4999: External service errors
#   5000-5999: Server errors
module ErrorHandler
  extend ActiveSupport::Concern

  # Error Code Constants
  module ErrorCodes
    # Authentication errors (1000-1999)
    INVALID_EMAIL = 1001
    INVALID_PASSWORD = 1002
    NOT_AUTHORIZED = 1003
    ACCOUNT_LOCKED = 1004
    EMAIL_NOT_CONFIRMED = 1005
    INVALID_TOKEN = 1006

    # Validation errors (2000-2999)
    REQUIRED_FIELD_MISSING = 2001
    CHARACTER_LIMIT_EXCEEDED = 2002
    VALIDATION_FAILED = 2003

    # Resource errors (3000-3999)
    PHOTO_NOT_FOUND = 3001
    USER_NOT_FOUND = 3002
    RESOURCE_NOT_FOUND = 3003

    # External service errors (4000-4999)
    WEATHER_API_ERROR = 4001
    S3_UPLOAD_ERROR = 4002
    RATE_LIMIT_ERROR = 4003
    FILE_TOO_LARGE = 4004
    INVALID_FILE_TYPE = 4005

    # Server errors (5000-5999)
    DATABASE_ERROR = 5001
    INTERNAL_ERROR = 5002
    TIMEOUT_ERROR = 5003
  end

  # Custom exception classes
  class ApiError < StandardError
    attr_reader :code, :message, :details, :http_status

    def initialize(code:, message:, details: nil, http_status: :internal_server_error)
      @code = code
      @message = message
      @details = details
      @http_status = http_status
      super(message)
    end
  end

  # Authentication error (1000-1999)
  class AuthenticationError < ApiError
    def initialize(code: ErrorCodes::NOT_AUTHORIZED, message: "Authentication failed", details: nil)
      super(code: code, message: message, details: details, http_status: :unauthorized)
    end
  end

  # Authorization error (1003)
  class AuthorizationError < ApiError
    def initialize(code: ErrorCodes::NOT_AUTHORIZED, message: "Permission denied", details: nil)
      super(code: code, message: message, details: details, http_status: :forbidden)
    end
  end

  # Validation error (2000-2999)
  class ValidationError < ApiError
    def initialize(code: ErrorCodes::VALIDATION_FAILED, message: "Validation failed", details: nil)
      super(code: code, message: message, details: details, http_status: :unprocessable_entity)
    end
  end

  # Resource not found error (3000-3999)
  class ResourceNotFoundError < ApiError
    def initialize(code: ErrorCodes::RESOURCE_NOT_FOUND, message: "Resource not found", details: nil)
      super(code: code, message: message, details: details, http_status: :not_found)
    end
  end

  # External service error (4000-4999)
  class ExternalServiceError < ApiError
    def initialize(code: ErrorCodes::WEATHER_API_ERROR, message: "External service error", details: nil)
      super(code: code, message: message, details: details, http_status: :service_unavailable)
    end
  end

  # Server error (5000-5999)
  class ServerError < ApiError
    def initialize(code: ErrorCodes::INTERNAL_ERROR, message: "Internal server error", details: nil)
      super(code: code, message: message, details: details, http_status: :internal_server_error)
    end
  end

  included do
    # Handle custom API errors
    rescue_from ApiError, with: :handle_api_error

    # Handle ActiveRecord::RecordNotFound -> 3001 (not_found)
    rescue_from ActiveRecord::RecordNotFound, with: :handle_record_not_found

    # Handle ActiveRecord::RecordInvalid -> 2001 (unprocessable_entity)
    rescue_from ActiveRecord::RecordInvalid, with: :handle_record_invalid

    # Handle ActionController::ParameterMissing -> 2002 (bad_request)
    rescue_from ActionController::ParameterMissing, with: :handle_parameter_missing

    # Handle Pundit::NotAuthorizedError -> 1003 (forbidden)
    # Note: Only rescue if Pundit is loaded
    if defined?(Pundit::NotAuthorizedError)
      rescue_from Pundit::NotAuthorizedError, with: :handle_not_authorized
    end

    # Handle StandardError -> 5002 (internal_server_error) in production only
    rescue_from StandardError, with: :handle_standard_error if Rails.env.production?
  end

  private

  # Render standardized error response
  def render_error(code:, message:, details: nil, status:)
    error_body = {
      error: {
        code: code,
        message: message
      }
    }
    error_body[:error][:details] = details if details.present?

    render json: error_body, status: status
  end

  # Handle custom API errors
  def handle_api_error(exception)
    render_error(
      code: exception.code,
      message: exception.message,
      details: exception.details,
      status: exception.http_status
    )
  end

  # Handle ActiveRecord::RecordNotFound
  def handle_record_not_found(exception)
    model_name = exception.model || "Resource"
    render_error(
      code: ErrorCodes::RESOURCE_NOT_FOUND,
      message: "Resource not found",
      details: { resource: model_name, id: exception.id },
      status: :not_found
    )
  end

  # Handle ActiveRecord::RecordInvalid
  def handle_record_invalid(exception)
    render_error(
      code: ErrorCodes::REQUIRED_FIELD_MISSING,
      message: "Validation failed",
      details: { errors: exception.record.errors.full_messages },
      status: :unprocessable_entity
    )
  end

  # Handle ActionController::ParameterMissing
  def handle_parameter_missing(exception)
    render_error(
      code: ErrorCodes::REQUIRED_FIELD_MISSING,
      message: "Required parameter missing",
      details: { param: exception.param.to_s },
      status: :bad_request
    )
  end

  # Handle Pundit::NotAuthorizedError
  def handle_not_authorized(exception)
    render_error(
      code: ErrorCodes::NOT_AUTHORIZED,
      message: "Permission denied",
      details: { policy: exception.policy.class.to_s, query: exception.query.to_s },
      status: :forbidden
    )
  end

  # Handle StandardError (production only)
  def handle_standard_error(exception)
    # Log the error for debugging
    Rails.logger.error("Internal Server Error: #{exception.class} - #{exception.message}")
    Rails.logger.error(exception.backtrace.first(10).join("\n")) if exception.backtrace

    render_error(
      code: ErrorCodes::INTERNAL_ERROR,
      message: "Internal server error",
      details: nil, # Don't expose internal details in production
      status: :internal_server_error
    )
  end
end
