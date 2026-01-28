# frozen_string_literal: true

# AuthService provides authentication business logic for the Shiojiri Rainbow Seeker API.
#
# This service object encapsulates all authentication-related operations including:
# - User registration with email confirmation
# - Login with failed attempt tracking and account lockout
# - Email verification
# - Token refresh
# - Password reset workflow
#
# == Error Codes
# Uses ErrorHandler error codes for consistency:
# - 1001: Invalid email
# - 1002: Invalid password
# - 1003: Not authorized
# - 1004: Account locked (after 5 failed attempts)
# - 1005: Email not confirmed
# - 1006: Invalid/expired token
#
# == Lockout Logic
# - Accounts are locked after 5 consecutive failed login attempts
# - Lockout duration: 30 minutes
# - Failed attempts reset on successful login
#
# == Usage
#   result = AuthService.new.register(
#     email: 'user@example.com',
#     password: 'securepassword123',
#     display_name: 'John Doe'
#   )
#
#   if result[:success]
#     user = result[:data][:user]
#   else
#     error_code = result[:error][:code]
#   end
#
class AuthService
  # Maximum number of failed login attempts before account lockout
  MAX_FAILED_ATTEMPTS = 5

  # Duration of account lockout in minutes
  LOCKOUT_DURATION = 30.minutes

  # Result structure for successful operations
  #
  # @param data [Hash] the data to return
  # @return [Hash] success result with data
  def success_result(data)
    { success: true, data: data }
  end

  # Result structure for failed operations
  #
  # @param code [Integer] error code
  # @param message [String] error message
  # @param details [Hash, nil] additional error details
  # @return [Hash] failure result with error info
  def failure_result(code:, message:, details: nil)
    result = {
      success: false,
      error: {
        code: code,
        message: message
      }
    }
    result[:error][:details] = details if details.present?
    result
  end

  # Register a new user account
  #
  # Creates a new user with the provided credentials and profile information.
  # Automatically sends a confirmation email via Devise.
  #
  # @param email [String] user's email address
  # @param password [String] user's password (min 8 characters)
  # @param display_name [String] user's display name (3-30 characters)
  # @return [Hash] result with :success, :data or :error
  #
  # @example
  #   result = AuthService.new.register(
  #     email: 'user@example.com',
  #     password: 'securepassword123',
  #     display_name: 'John Doe'
  #   )
  def register(email:, password:, display_name:)
    # Validate email format
    unless valid_email?(email)
      return failure_result(
        code: ErrorHandler::ErrorCodes::INVALID_EMAIL,
        message: "Invalid email format"
      )
    end

    # Check if email already exists
    if User.exists?(email: email.downcase.strip)
      return failure_result(
        code: ErrorHandler::ErrorCodes::INVALID_EMAIL,
        message: "Email already registered",
        details: { email: email }
      )
    end

    # Create the user (Devise will automatically send confirmation email)
    user = User.new(
      email: email,
      password: password,
      display_name: display_name
    )

    if user.save
      success_result(
        user: user_data(user),
        message: "Registration successful. Please check your email to confirm your account."
      )
    else
      # Map validation errors to appropriate error codes
      if user.errors[:password].present?
        failure_result(
          code: ErrorHandler::ErrorCodes::INVALID_PASSWORD,
          message: "Password validation failed",
          details: { errors: user.errors[:password] }
        )
      elsif user.errors[:email].present?
        failure_result(
          code: ErrorHandler::ErrorCodes::INVALID_EMAIL,
          message: "Email validation failed",
          details: { errors: user.errors[:email] }
        )
      else
        failure_result(
          code: ErrorHandler::ErrorCodes::VALIDATION_FAILED,
          message: "Registration failed",
          details: { errors: user.errors.full_messages }
        )
      end
    end
  end

  # Authenticate a user with email and password
  #
  # Validates credentials, checks account status, and tracks failed attempts.
  # Returns JWT tokens on successful authentication.
  #
  # @param email [String] user's email address
  # @param password [String] user's password
  # @return [Hash] result with :success, :data (including tokens) or :error
  #
  # @example
  #   result = AuthService.new.login(email: 'user@example.com', password: 'password123')
  #   if result[:success]
  #     access_token = result[:data][:tokens][:access_token]
  #     refresh_token = result[:data][:tokens][:refresh_token]
  #   end
  def login(email:, password:)
    user = User.find_by(email: email.downcase.strip)

    # Check if user exists
    unless user
      return failure_result(
        code: ErrorHandler::ErrorCodes::INVALID_EMAIL,
        message: "Invalid email or password"
      )
    end

    # Check if user is soft-deleted
    if user.deleted?
      return failure_result(
        code: ErrorHandler::ErrorCodes::NOT_AUTHORIZED,
        message: "Account has been deactivated"
      )
    end

    # Check if account is locked
    if account_locked?(user)
      remaining_time = lockout_remaining_time(user)
      return failure_result(
        code: error_code_account_locked,
        message: "Account is temporarily locked due to too many failed login attempts",
        details: { unlock_in_minutes: remaining_time }
      )
    end

    # Validate password
    unless user.valid_password?(password)
      increment_failed_attempts(user)

      # Check if this failure caused a lockout
      if account_locked?(user)
        return failure_result(
          code: error_code_account_locked,
          message: "Account locked due to too many failed login attempts. Please try again later.",
          details: { unlock_in_minutes: LOCKOUT_DURATION.to_i / 60 }
        )
      end

      attempts_remaining = MAX_FAILED_ATTEMPTS - user.failed_attempts
      return failure_result(
        code: ErrorHandler::ErrorCodes::INVALID_PASSWORD,
        message: "Invalid email or password",
        details: { attempts_remaining: attempts_remaining }
      )
    end

    # Check if email is confirmed
    unless user.confirmed?
      return failure_result(
        code: error_code_email_not_confirmed,
        message: "Please confirm your email address before logging in"
      )
    end

    # Reset failed attempts on successful login
    reset_failed_attempts(user)

    # Generate tokens
    tokens = generate_tokens(user)

    success_result(
      user: user_data(user),
      tokens: tokens
    )
  end

  # Verify user email with confirmation token
  #
  # Confirms the user's email address using the token sent via email.
  #
  # @param token [String] the confirmation token from the email
  # @return [Hash] result with :success, :data or :error
  #
  # @example
  #   result = AuthService.new.verify_email(token: 'abc123token')
  def verify_email(token:)
    return invalid_token_result if token.blank?

    user = User.confirm_by_token(token)

    if user.errors.empty?
      success_result(
        user: user_data(user),
        message: "Email confirmed successfully"
      )
    else
      failure_result(
        code: error_code_invalid_token,
        message: "Invalid or expired confirmation token",
        details: { errors: user.errors.full_messages }
      )
    end
  end

  # Generate new access token from refresh token
  #
  # Validates the refresh token and issues a new access token.
  # The refresh token remains valid until its expiration.
  #
  # @param refresh_token [String] the refresh token
  # @return [Hash] result with :success, :data (including new access token) or :error
  #
  # @example
  #   result = AuthService.new.refresh_token(refresh_token: 'eyJhbGciOiJIUzI1NiJ9...')
  def refresh_token(refresh_token:)
    return invalid_token_result if refresh_token.blank?

    # Decode and validate refresh token
    payload = JwtConfig.decode_refresh_token(refresh_token)

    unless payload
      return failure_result(
        code: error_code_invalid_token,
        message: "Invalid or expired refresh token"
      )
    end

    # Find the user
    user = User.find_by(id: payload[:sub])

    unless user
      return failure_result(
        code: ErrorHandler::ErrorCodes::USER_NOT_FOUND,
        message: "User not found"
      )
    end

    # Check if user is still active
    if user.deleted?
      return failure_result(
        code: ErrorHandler::ErrorCodes::NOT_AUTHORIZED,
        message: "Account has been deactivated"
      )
    end

    # Generate new access token using Warden/Devise JWT
    access_token = generate_access_token(user)

    success_result(
      accessToken: access_token,
      expiresIn: JwtConfig.access_token_expiration
    )
  end

  # Initiate password reset process
  #
  # Sends a password reset email to the user with a reset token.
  # For security, always returns success even if email doesn't exist.
  #
  # @param email [String] user's email address
  # @return [Hash] result with :success and :data
  #
  # @example
  #   result = AuthService.new.reset_password(email: 'user@example.com')
  def reset_password(email:)
    user = User.find_by(email: email.downcase.strip)

    # Send reset instructions if user exists
    # Devise will handle the email sending
    if user && !user.deleted?
      user.send_reset_password_instructions
    end

    # Always return success for security (don't reveal if email exists)
    success_result(
      message: "If your email is registered, you will receive password reset instructions shortly."
    )
  end

  # Complete password reset with token
  #
  # Validates the reset token and updates the user's password.
  #
  # @param token [String] the reset password token from the email
  # @param new_password [String] the new password
  # @return [Hash] result with :success, :data or :error
  #
  # @example
  #   result = AuthService.new.confirm_password_reset(
  #     token: 'abc123token',
  #     new_password: 'newSecurePassword123'
  #   )
  def confirm_password_reset(token:, new_password:)
    return invalid_token_result if token.blank?

    # Validate password before attempting reset
    unless valid_password?(new_password)
      return failure_result(
        code: ErrorHandler::ErrorCodes::INVALID_PASSWORD,
        message: "Password does not meet requirements",
        details: { requirements: "Password must be 8-128 characters" }
      )
    end

    # Find user by reset token and reset password
    user = User.reset_password_by_token(
      reset_password_token: token,
      password: new_password,
      password_confirmation: new_password
    )

    if user.errors.empty?
      # Reset failed attempts after successful password reset
      reset_failed_attempts(user) if user.persisted?

      success_result(
        user: user_data(user),
        message: "Password has been reset successfully"
      )
    else
      # Check for specific errors
      if user.errors[:reset_password_token].present?
        failure_result(
          code: error_code_invalid_token,
          message: "Invalid or expired reset token"
        )
      else
        failure_result(
          code: ErrorHandler::ErrorCodes::INVALID_PASSWORD,
          message: "Password reset failed",
          details: { errors: user.errors.full_messages }
        )
      end
    end
  end

  private

  # Check if account is currently locked
  #
  # @param user [User] the user to check
  # @return [Boolean] true if account is locked
  def account_locked?(user)
    return false unless user.locked_at.present?

    # Check if lockout period has expired
    if user.locked_at > LOCKOUT_DURATION.ago
      true
    else
      # Lockout expired, reset the lock
      user.update_columns(locked_at: nil, failed_attempts: 0)
      false
    end
  end

  # Calculate remaining lockout time in minutes
  #
  # @param user [User] the locked user
  # @return [Integer] minutes until unlock
  def lockout_remaining_time(user)
    return 0 unless user.locked_at.present?

    unlock_at = user.locked_at + LOCKOUT_DURATION
    remaining_seconds = (unlock_at - Time.current).to_i
    (remaining_seconds / 60.0).ceil
  end

  # Increment failed login attempts and lock if threshold reached
  #
  # @param user [User] the user who failed to authenticate
  def increment_failed_attempts(user)
    new_attempts = user.failed_attempts + 1

    if new_attempts >= MAX_FAILED_ATTEMPTS
      # Lock the account
      user.update_columns(
        failed_attempts: new_attempts,
        locked_at: Time.current
      )
    else
      user.update_column(:failed_attempts, new_attempts)
    end
  end

  # Reset failed attempts counter after successful login
  #
  # @param user [User] the user who successfully authenticated
  def reset_failed_attempts(user)
    return if user.failed_attempts.zero? && user.locked_at.nil?

    user.update_columns(failed_attempts: 0, locked_at: nil)
  end

  # Validate email format
  #
  # @param email [String] email to validate
  # @return [Boolean] true if valid
  def valid_email?(email)
    return false if email.blank?

    # Use Devise's email regex
    email.match?(Devise.email_regexp)
  end

  # Validate password requirements
  #
  # @param password [String] password to validate
  # @return [Boolean] true if valid
  def valid_password?(password)
    return false if password.blank?

    password.length.between?(8, 128)
  end

  # Generate access token using Devise JWT
  #
  # @param user [User] the user to generate token for
  # @return [String] the JWT access token
  def generate_access_token(user)
    Warden::JWTAuth::UserEncoder.new.call(user, :user, nil).first
  end

  # Generate both access and refresh tokens
  #
  # @param user [User] the user to generate tokens for
  # @return [Hash] hash with accessToken, refreshToken, and expiration info (camelCase for JS clients)
  def generate_tokens(user)
    access_token = generate_access_token(user)
    refresh_data = JwtConfig.generate_refresh_token(user)

    {
      accessToken: access_token,
      accessExpiresIn: JwtConfig.access_token_expiration,
      refreshToken: refresh_data[:refresh_token],
      refreshExpiresAt: refresh_data[:refresh_expires_at]
    }
  end

  # Format user data for API response
  #
  # @param user [User] the user to format
  # @return [Hash] formatted user data (camelCase for JS clients)
  def user_data(user)
    {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      locale: user.locale,
      confirmed: user.confirmed?,
      createdAt: user.created_at&.iso8601
    }
  end

  # Standard invalid/expired token error result
  #
  # @return [Hash] failure result for invalid token
  def invalid_token_result
    failure_result(
      code: error_code_invalid_token,
      message: "Invalid or expired token"
    )
  end

  # Error code for account locked (1004)
  #
  # @return [Integer] error code
  def error_code_account_locked
    ErrorHandler::ErrorCodes::ACCOUNT_LOCKED
  end

  # Error code for email not confirmed (1005)
  #
  # @return [Integer] error code
  def error_code_email_not_confirmed
    ErrorHandler::ErrorCodes::EMAIL_NOT_CONFIRMED
  end

  # Error code for invalid/expired token (1006)
  #
  # @return [Integer] error code
  def error_code_invalid_token
    ErrorHandler::ErrorCodes::INVALID_TOKEN
  end
end
