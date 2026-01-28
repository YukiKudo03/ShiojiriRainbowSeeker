# frozen_string_literal: true

# ApplicationSerializer is the base class for all Alba serializers.
#
# Provides common configuration and helper methods for API serialization.
# All resource-specific serializers inherit from this class.
#
# == Features
# - Consistent JSON formatting with camelCase keys for JavaScript clients
# - Helper methods for common patterns
# - ISO8601 date formatting
#
# == Usage
#   class PhotoSerializer < ApplicationSerializer
#     attributes :id, :title
#   end
#
class ApplicationSerializer
  include Alba::Resource

  # Transform all keys to camelCase for JavaScript/React Native clients
  transform_keys :lower_camel

  # Format timestamps as ISO8601 strings
  #
  # @param time [Time, DateTime, nil] the time to format
  # @return [String, nil] ISO8601 formatted string or nil
  def iso8601(time)
    time&.iso8601
  end
end
