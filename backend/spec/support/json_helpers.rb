# frozen_string_literal: true

module JsonHelpers
  # Parse the response body as JSON
  # Note: Not memoized to ensure each request gets fresh data
  def json_response
    JSON.parse(response.body, symbolize_names: true)
  end

  def json_data
    json_response[:data]
  end

  def json_error
    json_response[:error]
  end
end

RSpec.configure do |config|
  config.include JsonHelpers, type: :request
end
