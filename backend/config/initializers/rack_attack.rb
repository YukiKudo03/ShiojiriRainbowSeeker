# frozen_string_literal: true

# Rack::Attack configuration for API rate limiting.
#
# Protects API endpoints from abuse with per-IP and per-user throttling.
# Uses Solid Cache as the cache store for distributed deployments.
#
# == Rate Limits
# - General API: 300 requests/5 min per IP
# - Authentication: 10 requests/min per IP
# - Photo upload: 20 requests/hour per user
# - Health check: exempt from rate limiting
#
class Rack::Attack
  # Use Rails cache (Solid Cache) as the backing store
  Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new

  ### Throttle Rules ###

  # General API rate limit: 300 requests per 5 minutes per IP
  throttle("api/ip", limit: 300, period: 5.minutes) do |req|
    req.ip if req.path.start_with?("/api/")
  end

  # Authentication endpoints: stricter limit (10 per minute per IP)
  throttle("auth/ip", limit: 10, period: 1.minute) do |req|
    if req.path.match?(%r{/api/v1/auth/(login|register|password)}) && req.post?
      req.ip
    end
  end

  # Photo upload: 20 per hour per user (identified by Authorization header)
  throttle("uploads/token", limit: 20, period: 1.hour) do |req|
    if req.path.match?(%r{/api/v1/photos}) && req.post?
      # Use JWT token as identifier (first 32 chars to avoid long keys)
      token = req.env["HTTP_AUTHORIZATION"]&.sub(/^Bearer\s+/, "")
      token&.first(32)
    end
  end

  # Social actions: 60 per minute per user
  throttle("social/token", limit: 60, period: 1.minute) do |req|
    if req.path.match?(%r{/api/v1/(photos/.+/likes|photos/.+/comments|reports)})
      token = req.env["HTTP_AUTHORIZATION"]&.sub(/^Bearer\s+/, "")
      token&.first(32)
    end
  end

  ### Safelist Rules ###

  # Allow health check endpoints without rate limiting
  safelist("health-checks") do |req|
    req.path.match?(%r{/api/v1/health})
  end

  ### Response Configuration ###

  # Custom throttled response
  self.throttled_responder = lambda do |req|
    match_data = req.env["rack.attack.match_data"]
    now = match_data[:epoch_time]
    retry_after = match_data[:period] - (now % match_data[:period])

    headers = {
      "Content-Type" => "application/json; charset=utf-8",
      "Retry-After" => retry_after.to_s
    }

    body = {
      error: {
        code: "RATE_LIMITED",
        message: "リクエスト数が制限を超えました。#{retry_after.to_i}秒後にお試しください。",
        retry_after: retry_after.to_i
      }
    }.to_json

    [ 429, headers, [ body ] ]
  end
end

# Use Rails cache store in production (Solid Cache)
Rails.application.config.after_initialize do
  if Rails.env.production?
    Rack::Attack.cache.store = Rails.cache
  end
end
