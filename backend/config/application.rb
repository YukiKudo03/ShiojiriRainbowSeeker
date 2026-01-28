require_relative "boot"

require "rails/all"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module Backend
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 8.0

    # Please, add to the `ignore` list any other `lib` subdirectories that do
    # not contain `.rb` files, or that should not be reloaded or eager loaded.
    # Common ones are `templates`, `generators`, or `middleware`, for example.
    config.autoload_lib(ignore: %w[assets tasks])

    # Configuration for the application, engines, and railties goes here.
    #
    # These settings can be overridden in specific environments using the files
    # in config/environments, which are processed later.

    # Set timezone for Shiojiri, Japan
    config.time_zone = "Asia/Tokyo"

    # Internationalization (i18n) configuration (NFR-5)
    # Support Japanese and English, with Japanese as default
    config.i18n.default_locale = :ja
    config.i18n.available_locales = %i[ja en]
    config.i18n.fallbacks = true
    config.i18n.fallbacks = [ :ja ] # English falls back to Japanese

    # Load locale files from nested directories
    config.i18n.load_path += Dir[Rails.root.join("config/locales/**/*.yml")]

    # Only loads a smaller set of middleware suitable for API only apps.
    # Middleware like session, flash, cookies can be added back manually.
    # Skip views, helpers and assets when generating a new resource.
    config.api_only = true

    # Devise configuration for API-only mode
    # Use ActionController::API as the parent class for Devise controllers
    config.to_prepare do
      Devise::SessionsController.respond_to :json
      Devise::RegistrationsController.respond_to :json
      Devise::ConfirmationsController.respond_to :json
      Devise::PasswordsController.respond_to :json
    end
  end
end
