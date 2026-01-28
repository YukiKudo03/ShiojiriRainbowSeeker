# frozen_string_literal: true

# RequestIdMiddleware adds a unique request ID to each incoming request.
#
# This middleware:
# - Generates a UUID for each request (or uses X-Request-Id if provided)
# - Stores the request ID in Thread.current for access throughout the request
# - Adds the request ID to the response header
# - Tags Rails logs with the request ID for easier debugging
#
# == Usage
#   The request ID can be accessed anywhere in the request cycle:
#     RequestIdMiddleware.request_id
#
# == Example Log Output
#   [req_id=550e8400-e29b-41d4-a716-446655440000] Processing PhotosController#show
#
class RequestIdMiddleware
  HEADER_NAME = "X-Request-Id"
  THREAD_KEY = :request_id

  def initialize(app)
    @app = app
  end

  def call(env)
    request_id = extract_or_generate_request_id(env)

    # Store in Thread.current for access throughout the request
    Thread.current[THREAD_KEY] = request_id

    # Add to request environment for ActionDispatch::RequestId compatibility
    env["action_dispatch.request_id"] = request_id

    begin
      status, headers, body = @app.call(env)

      # Add request ID to response headers
      headers[HEADER_NAME] = request_id

      [ status, headers, body ]
    ensure
      # Clean up Thread.current
      Thread.current[THREAD_KEY] = nil
    end
  end

  # Get current request ID (class method for easy access)
  #
  # @return [String, nil] the current request ID
  def self.request_id
    Thread.current[THREAD_KEY]
  end

  private

  # Extract request ID from header or generate a new one
  #
  # @param env [Hash] Rack environment
  # @return [String] request ID
  def extract_or_generate_request_id(env)
    # Check for existing request ID in header (e.g., from load balancer)
    existing_id = env["HTTP_X_REQUEST_ID"]

    if existing_id.present? && valid_request_id?(existing_id)
      existing_id
    else
      SecureRandom.uuid
    end
  end

  # Validate request ID format (UUID or alphanumeric)
  #
  # @param id [String] request ID to validate
  # @return [Boolean] true if valid
  def valid_request_id?(id)
    # Allow UUID format or alphanumeric up to 255 chars
    id.match?(/\A[\w\-]{1,255}\z/)
  end
end
