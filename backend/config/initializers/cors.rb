# frozen_string_literal: true

# Be sure to restart your server when you modify this file.

# Avoid CORS issues when API is called from the frontend app.
# Handle Cross-Origin Resource Sharing (CORS) in order to accept cross-origin Ajax requests.

# Read more: https://github.com/cyu/rack-cors

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    # Configure origins based on environment
    if Rails.env.development? || Rails.env.test?
      # Development/Test: Allow all origins for easier development
      origins "*"
    else
      # Production: Only allow specific domains from environment variable
      # ALLOWED_ORIGINS should be a comma-separated list of allowed domains
      # Example: "https://shiojiri-rainbow.com,https://api.shiojiri-rainbow.com"
      allowed = ENV.fetch("ALLOWED_ORIGINS", "").split(",").map(&:strip).reject(&:empty?)

      if allowed.any?
        origins(*allowed)
      else
        # Fallback: deny all if no origins configured (safer default)
        origins "https://shiojiri-rainbow.example.com"
        Rails.logger.warn "CORS: No ALLOWED_ORIGINS configured. Using placeholder domain."
      end
    end

    resource "*",
      headers: :any,
      methods: %i[get post put patch delete options head],
      expose: %w[Authorization X-Request-Id X-Runtime X-Total-Count X-Page X-Per-Page],
      credentials: !(Rails.env.development? || Rails.env.test?), # Credentials not allowed with origin "*"
      max_age: 86_400 # Cache preflight requests for 24 hours
  end
end
