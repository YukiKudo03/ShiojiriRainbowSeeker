# frozen_string_literal: true

# Base controller for all API controllers.
#
# Includes common functionality:
# - ErrorHandler: Unified error handling and response format
# - LocaleSetter: Internationalization based on user preference or Accept-Language header
#
class ApplicationController < ActionController::API
  include ErrorHandler
  include LocaleSetter
end
