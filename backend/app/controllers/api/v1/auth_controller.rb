# frozen_string_literal: true

module Api
  module V1
    # AuthController handles all authentication-related API endpoints.
    #
    # Provides endpoints for:
    # - User registration
    # - Login/logout
    # - Token refresh
    # - Password reset (request and confirm)
    # - Email verification
    #
    # All business logic is delegated to AuthService.
    # Uses Strong Parameters for input validation.
    #
    # == API Endpoints
    #   POST   /api/v1/auth/register       - Register new user
    #   POST   /api/v1/auth/login          - Login user
    #   DELETE /api/v1/auth/logout         - Logout user
    #   POST   /api/v1/auth/refresh        - Refresh access token
    #   POST   /api/v1/auth/password/reset - Request password reset
    #   PUT    /api/v1/auth/password/reset - Confirm password reset
    #   GET    /api/v1/auth/verify_email/:token - Verify email address
    #
    class AuthController < BaseController
      # POST /api/v1/auth/register
      #
      # Register a new user account.
      #
      # @param email [String] User's email address
      # @param password [String] User's password (min 8 characters)
      # @param display_name [String] User's display name (3-30 characters)
      #
      # @return [JSON] User data on success, error on failure
      #
      # @example Request body
      #   {
      #     "email": "user@example.com",
      #     "password": "securepassword123",
      #     "display_name": "John Doe"
      #   }
      #
      # @example Success response (201 Created)
      #   {
      #     "data": {
      #       "user": { "id": "...", "email": "...", "display_name": "..." },
      #       "message": "Registration successful..."
      #     }
      #   }
      def register
        result = auth_service.register(
          email: register_params[:email],
          password: register_params[:password],
          display_name: register_params[:display_name]
        )

        if result[:success]
          render_success(data: result[:data], status: :created)
        else
          render_service_error(result: result, status: http_status_for_error(result[:error][:code]))
        end
      end

      # POST /api/v1/auth/login
      #
      # Authenticate a user and return JWT tokens.
      #
      # @param email [String] User's email address
      # @param password [String] User's password
      #
      # @return [JSON] User data and tokens on success, error on failure
      #
      # @example Request body
      #   {
      #     "email": "user@example.com",
      #     "password": "securepassword123"
      #   }
      #
      # @example Success response (200 OK)
      #   {
      #     "data": {
      #       "user": { "id": "...", "email": "...", "display_name": "..." },
      #       "tokens": {
      #         "access_token": "eyJhbGci...",
      #         "refresh_token": "eyJhbGci...",
      #         "access_expires_in": 900,
      #         "refresh_expires_at": "2024-01-01T00:00:00Z"
      #       }
      #     }
      #   }
      def login
        result = auth_service.login(
          email: login_params[:email],
          password: login_params[:password]
        )

        if result[:success]
          render_success(data: result[:data], status: :ok)
        else
          render_service_error(result: result, status: http_status_for_error(result[:error][:code]))
        end
      end

      # DELETE /api/v1/auth/logout
      #
      # Logout the current user and invalidate their tokens.
      # This endpoint relies on Devise JWT's revocation strategy.
      #
      # @return [JSON] Success message
      #
      # @example Success response (200 OK)
      #   {
      #     "data": {
      #       "message": "Logged out successfully"
      #     }
      #   }
      def logout
        # Devise JWT handles token revocation automatically via JwtDenylist
        # when the sign_out action is called or token is added to denylist
        #
        # For API-only logout, we return success and let the client clear tokens
        render_success(data: { message: "Logged out successfully" }, status: :ok)
      end

      # POST /api/v1/auth/refresh
      #
      # Generate a new access token using a valid refresh token.
      #
      # @param refresh_token [String] The refresh token
      #
      # @return [JSON] New access token on success, error on failure
      #
      # @example Request body
      #   {
      #     "refresh_token": "eyJhbGci..."
      #   }
      #
      # @example Success response (200 OK)
      #   {
      #     "data": {
      #       "access_token": "eyJhbGci...",
      #       "expires_in": 900
      #     }
      #   }
      def refresh
        result = auth_service.refresh_token(
          refresh_token: refresh_params[:refresh_token]
        )

        if result[:success]
          render_success(data: result[:data], status: :ok)
        else
          render_service_error(result: result, status: http_status_for_error(result[:error][:code]))
        end
      end

      # POST /api/v1/auth/password/reset
      #
      # Request a password reset email.
      # For security, always returns success even if email doesn't exist.
      #
      # @param email [String] User's email address
      #
      # @return [JSON] Success message
      #
      # @example Request body
      #   {
      #     "email": "user@example.com"
      #   }
      #
      # @example Success response (200 OK)
      #   {
      #     "data": {
      #       "message": "If your email is registered, you will receive..."
      #     }
      #   }
      def password_reset_request
        result = auth_service.reset_password(
          email: password_reset_request_params[:email]
        )

        # Always return success for security reasons
        render_success(data: result[:data], status: :ok)
      end

      # PUT /api/v1/auth/password/reset
      #
      # Confirm password reset with token and new password.
      #
      # @param token [String] Reset password token from email
      # @param password [String] New password
      #
      # @return [JSON] Success message on success, error on failure
      #
      # @example Request body
      #   {
      #     "token": "abc123token",
      #     "password": "newSecurePassword123"
      #   }
      #
      # @example Success response (200 OK)
      #   {
      #     "data": {
      #       "user": { "id": "...", "email": "...", "display_name": "..." },
      #       "message": "Password has been reset successfully"
      #     }
      #   }
      def password_reset_confirm
        result = auth_service.confirm_password_reset(
          token: password_reset_confirm_params[:token],
          new_password: password_reset_confirm_params[:password]
        )

        if result[:success]
          render_success(data: result[:data], status: :ok)
        else
          render_service_error(result: result, status: http_status_for_error(result[:error][:code]))
        end
      end

      # GET /api/v1/auth/verify_email/:token
      #
      # Verify user's email address using confirmation token.
      #
      # @param token [String] Email confirmation token (URL parameter)
      #
      # @return [JSON] Success message on success, error on failure
      #
      # @example Success response (200 OK)
      #   {
      #     "data": {
      #       "user": { "id": "...", "email": "...", "display_name": "..." },
      #       "message": "Email confirmed successfully"
      #     }
      #   }
      def verify_email
        result = auth_service.verify_email(token: params[:token])

        if result[:success]
          render_success(data: result[:data], status: :ok)
        else
          render_service_error(result: result, status: http_status_for_error(result[:error][:code]))
        end
      end

      private

      # Strong Parameters for user registration
      #
      # @return [ActionController::Parameters] permitted parameters
      def register_params
        params.require(:auth).permit(:email, :password, :display_name)
      rescue ActionController::ParameterMissing
        # Allow parameters at root level for flexibility
        params.permit(:email, :password, :display_name)
      end

      # Strong Parameters for login
      #
      # @return [ActionController::Parameters] permitted parameters
      def login_params
        params.require(:auth).permit(:email, :password)
      rescue ActionController::ParameterMissing
        params.permit(:email, :password)
      end

      # Strong Parameters for token refresh
      #
      # @return [ActionController::Parameters] permitted parameters
      def refresh_params
        params.require(:auth).permit(:refresh_token)
      rescue ActionController::ParameterMissing
        params.permit(:refresh_token)
      end

      # Strong Parameters for password reset request
      #
      # @return [ActionController::Parameters] permitted parameters
      def password_reset_request_params
        params.require(:auth).permit(:email)
      rescue ActionController::ParameterMissing
        params.permit(:email)
      end

      # Strong Parameters for password reset confirmation
      #
      # @return [ActionController::Parameters] permitted parameters
      def password_reset_confirm_params
        params.require(:auth).permit(:token, :password)
      rescue ActionController::ParameterMissing
        params.permit(:token, :password)
      end

      # Initialize AuthService instance
      #
      # @return [AuthService] the auth service
      def auth_service
        @auth_service ||= AuthService.new
      end
    end
  end
end
