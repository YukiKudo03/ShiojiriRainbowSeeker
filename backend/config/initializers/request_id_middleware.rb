# frozen_string_literal: true

# Load and configure Request ID middleware for log correlation
#
# This middleware adds a unique request ID to each request for:
# - Log correlation across services
# - Request tracing in monitoring tools
# - Debugging production issues

require_relative "../../app/middleware/request_id_middleware"

Rails.application.config.middleware.insert_before 0, RequestIdMiddleware
