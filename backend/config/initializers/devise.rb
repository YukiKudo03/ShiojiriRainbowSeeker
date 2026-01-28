# frozen_string_literal: true

# Devise configuration for Shiojiri Rainbow Seeker API
#
# This initializer configures Devise for API-only authentication with JWT support.
# Key features:
# - JWT-based authentication for API access
# - Email confirmation (confirmable)
# - Password recovery (recoverable)
# - Secure bcrypt password hashing (12 rounds)
#
# Environment variables required:
# - DEVISE_JWT_SECRET_KEY: Secret key for JWT signing (required in production)
# - DEVISE_MAILER_SENDER: Email address for Devise mailers

Devise.setup do |config|
  # ==> Security Configuration

  # Configure the number of stretches for bcrypt password hashing.
  # Higher values provide better security but slower authentication.
  # Minimum 12 rounds as per security requirements.
  config.stretches = Rails.env.test? ? 1 : 12

  # ==> Mailer Configuration

  # Configure the e-mail address which will be shown in Devise::Mailer,
  # note that it will be overwritten if you use your own mailer class
  # with default "from" parameter.
  config.mailer_sender = ENV.fetch("DEVISE_MAILER_SENDER", "noreply@shiojiri-rainbow.example.com")

  # Configure the class responsible to send e-mails.
  # config.mailer = 'Devise::Mailer'

  # Configure the parent class responsible to send e-mails.
  # config.parent_mailer = 'ActionMailer::Base'

  # ==> ORM Configuration

  # Load and configure the ORM. Supports :active_record (default) and
  # :mongoid (bson_ext recommended) by default. Other ORMs may be
  # available as additional gems.
  require "devise/orm/active_record"

  # ==> Configuration for any authentication mechanism

  # Configure which keys are used when authenticating a user.
  config.authentication_keys = [ :email ]

  # Configure parameters from the request object used for authentication.
  # config.request_keys = []

  # Configure which authentication keys should be case-insensitive.
  config.case_insensitive_keys = [ :email ]

  # Configure which authentication keys should have whitespace stripped.
  config.strip_whitespace_keys = [ :email ]

  # Tell if authentication through request.params is enabled. True by default.
  # It can be set to an array that will enable params authentication only for the
  # given strategies, for example, `config.params_authenticatable = [:database]` will
  # enable it only for database (email + password) authentication.
  config.params_authenticatable = true

  # Tell if authentication through HTTP Auth is enabled. False by default.
  # It can be set to an array that will enable http authentication only for the
  # given strategies, for example, `config.http_authenticatable = [:database]` will
  # enable it only for database authentication.
  # For API-only apps, we use JWT instead of HTTP Basic Auth.
  config.http_authenticatable = false

  # If 401 status code should be returned for AJAX requests. True by default.
  config.http_authenticatable_on_xhr = false

  # The realm used in Http Basic Authentication. 'Application' by default.
  # config.http_authentication_realm = 'Application'

  # It will change confirmation, currentpassword and unlock strategies to simply
  # emit a `navigational_format` response. This is used to make the Devise controllers
  # to serve a JSON response when receiving a request from mobile apps or API clients.
  # Setting this to true will result in a 204 No Content response for Devise controllers,
  # instead of redirecting to the application root URL.
  config.navigational_formats = []

  # ==> Database Authenticatable

  # By default Devise will store the user in session.
  # For API-only apps, we disable sessions.
  config.skip_session_storage = [ :http_auth, :params_auth ]

  # Pepper is used to add additional entropy to password hashing.
  # In Rails 8, this is typically handled via Rails credentials.
  # config.pepper = ENV.fetch('DEVISE_PEPPER', nil)

  # Send a notification to the original email when the user's email is changed.
  config.send_email_changed_notification = true

  # Send a notification email when the user's password is changed.
  config.send_password_change_notification = true

  # ==> Confirmable

  # A period that the user is allowed to access the website even without
  # confirming their account. Here are some examples:
  #   - 0.days: user is not allowed to access without confirmation
  #   - 2.days: user is allowed to access for 2 days without confirmation
  #   - nil: user is allowed to access forever without confirmation
  # For security, we require immediate confirmation for new accounts.
  config.allow_unconfirmed_access_for = 0.days

  # A period that the user is allowed to confirm their account before their
  # token becomes invalid. For example, if set to 3.days, the user can confirm
  # their account within 3 days after the mail was sent, but on the fourth day
  # their account can't be confirmed with the token any more.
  config.confirm_within = 3.days

  # If true, requires any email changes to be confirmed (exactly the same way as
  # initial account confirmation) to be applied. Requires additional unconfirmed_email
  # db field (see migrations). Until confirmed, new email is stored in
  # unconfirmed_email column, and copied to email column on successful confirmation.
  config.reconfirmable = true

  # Defines which key will be used when confirming an account
  config.confirmation_keys = [ :email ]

  # ==> Rememberable

  # The time the user will be remembered without asking for credentials again.
  # For API authentication, this is less relevant as we use JWT tokens.
  config.remember_for = 2.weeks

  # Invalidates all the remember me tokens when the user signs out.
  config.expire_all_remember_me_on_sign_out = true

  # If true, extends the user's remember period when remembered via cookie.
  config.extend_remember_period = false

  # Options to be passed to the created cookie. For instance, you can set
  # secure: true in order to force SSL only cookies.
  # config.rememberable_options = {}

  # ==> Validatable

  # Range for password length.
  # Minimum 8 characters as per security best practices.
  config.password_length = 8..128

  # Email regex used to validate email addresses. Uses a simplified regex.
  config.email_regexp = /\A[^@\s]+@[^@\s]+\z/

  # ==> Recoverable

  # Defines which key will be used when recovering the password for an account
  config.reset_password_keys = [ :email ]

  # Time interval you can reset your password with a reset password key.
  # Don't put a too short interval or your users won't have the time to
  # change their passwords.
  config.reset_password_within = 6.hours

  # When set to false, does not sign a user in automatically after their password is
  # reset. Defaults to true, so a user is signed in automatically after a reset.
  # For API apps, this doesn't apply as we use JWT.
  config.sign_in_after_reset_password = false

  # ==> Lockable (disabled for now, can be enabled if needed)

  # Defines which strategy will be used to lock an account.
  # :failed_attempts = Locks the user after a number of failed attempts to sign in.
  # :none            = No lock strategy. You should handle locking by yourself.
  # config.lock_strategy = :failed_attempts

  # Defines which key will be used when locking and unlocking an account
  # config.unlock_keys = [:email]

  # Defines which strategy will be used to unlock an account.
  # :email = Sends an unlock link to the user email
  # :time  = Re-enables login after a certain amount of time (see :unlock_in below)
  # :both  = Enables both strategies
  # :none  = No unlock strategy. You should handle unlocking by yourself.
  # config.unlock_strategy = :both

  # Number of authentication tries before locking an account if lock_strategy
  # is failed attempts.
  # config.maximum_attempts = 20

  # Time interval to unlock the account if :time is enabled as unlock_strategy.
  # config.unlock_in = 1.hour

  # Warn on the last attempt before the account is locked.
  # config.last_attempt_warning = true

  # ==> Scopes

  # Turn scoped views on. Before rendering "sessions/new", it will first check for
  # "users/sessions/new". It's turned off by default because it's slower if you
  # are using only default views.
  # config.scoped_views = false

  # Configure the default scope given to Warden. By default it's the first
  # devise role declared in your routes (usually :user).
  config.default_scope = :user

  # Set this configuration to false if you want /users/sign_out to sign out
  # only the current scope. By default, Devise signs out all scopes.
  # config.sign_out_all_scopes = true

  # ==> Navigation configuration

  # The default HTTP method used to sign out a resource. Default is :delete.
  config.sign_out_via = :delete

  # ==> Hotwire/Turbo configuration

  # When using Devise with Hotwire/Turbo, the http status for error responses
  # and some redirects must match the following. The default in Devise for existing
  # apps is `200`. The default for new apps is `:see_other` (303).
  config.responder.error_status = :unprocessable_entity
  config.responder.redirect_status = :see_other

  # ==> JWT Configuration (devise-jwt)

  config.jwt do |jwt|
    # Secret key for JWT signing
    # IMPORTANT: In production, always use a secure, randomly generated key
    # stored in environment variables or Rails credentials.
    jwt.secret = ENV.fetch("DEVISE_JWT_SECRET_KEY") do
      if Rails.env.production?
        raise "DEVISE_JWT_SECRET_KEY environment variable is required in production"
      else
        # Development/test fallback - DO NOT use in production
        Rails.application.secret_key_base || "development-jwt-secret-key-not-for-production"
      end
    end

    # Token dispatch: when to issue tokens
    # Tokens are dispatched on successful sign in (create session)
    jwt.dispatch_requests = [
      [ "POST", %r{^/api/v1/auth/sign_in$} ],
      [ "POST", %r{^/api/v1/auth/refresh$} ]
    ]

    # Token revocation: when to revoke tokens
    # Tokens are revoked on sign out (destroy session)
    jwt.revocation_requests = [
      [ "DELETE", %r{^/api/v1/auth/sign_out$} ]
    ]

    # Access token expiration time: 15 minutes
    # Short-lived for security; refresh tokens are used to obtain new access tokens
    jwt.expiration_time = 15.minutes.to_i

    # Request formats that should receive JWT responses
    jwt.request_formats = {
      user: [ :json ]
    }

    # Note: Revocation strategy is configured in the User model
    # using `jwt_revocation_strategy: JwtDenylist`
  end
end
