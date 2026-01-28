# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Auth", type: :request do
  describe "POST /api/v1/auth/register" do
    let(:valid_params) do
      {
        email: "newuser@example.com",
        password: "password123",
        display_name: "New User"
      }
    end

    context "with valid parameters" do
      it "creates a new user" do
        expect {
          post "/api/v1/auth/register", params: valid_params, as: :json
        }.to change(User, :count).by(1)
      end

      it "returns 201 status" do
        post "/api/v1/auth/register", params: valid_params, as: :json
        expect(response).to have_http_status(:created)
      end

      it "returns user data" do
        post "/api/v1/auth/register", params: valid_params, as: :json
        expect(json_data[:user][:email]).to eq("newuser@example.com")
        expect(json_data[:user][:displayName]).to eq("New User")
      end

      it "returns confirmation message" do
        post "/api/v1/auth/register", params: valid_params, as: :json
        expect(json_data[:message]).to include("check your email")
      end
    end

    context "with nested auth params" do
      it "also works" do
        post "/api/v1/auth/register", params: { auth: valid_params }, as: :json
        expect(response).to have_http_status(:created)
      end
    end

    context "with invalid email" do
      it "returns 401 status" do
        post "/api/v1/auth/register", params: valid_params.merge(email: "invalid"), as: :json
        expect(response).to have_http_status(:unauthorized)
      end

      it "returns error with INVALID_EMAIL code" do
        post "/api/v1/auth/register", params: valid_params.merge(email: "invalid"), as: :json
        expect(json_error[:code]).to eq(ErrorHandler::ErrorCodes::INVALID_EMAIL)
      end
    end

    context "with duplicate email" do
      before { create(:user, email: "newuser@example.com") }

      it "returns 401 status" do
        post "/api/v1/auth/register", params: valid_params, as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with short password" do
      it "returns 401 status with INVALID_PASSWORD code" do
        post "/api/v1/auth/register", params: valid_params.merge(password: "short"), as: :json
        expect(response).to have_http_status(:unauthorized)
        expect(json_error[:code]).to eq(ErrorHandler::ErrorCodes::INVALID_PASSWORD)
      end
    end

    context "with invalid display_name" do
      it "returns 422 status with VALIDATION_FAILED code" do
        post "/api/v1/auth/register", params: valid_params.merge(display_name: "ab"), as: :json
        expect(response).to have_http_status(:unprocessable_entity)
        expect(json_error[:code]).to eq(ErrorHandler::ErrorCodes::VALIDATION_FAILED)
      end
    end
  end

  describe "POST /api/v1/auth/login" do
    let!(:user) { create(:user, email: "test@example.com", password: "password123") }

    let(:valid_params) do
      { email: "test@example.com", password: "password123" }
    end

    context "with valid credentials" do
      it "returns 200 status" do
        post "/api/v1/auth/login", params: valid_params, as: :json
        expect(response).to have_http_status(:ok)
      end

      it "returns user data" do
        post "/api/v1/auth/login", params: valid_params, as: :json
        expect(json_data[:user][:email]).to eq("test@example.com")
      end

      it "returns tokens" do
        post "/api/v1/auth/login", params: valid_params, as: :json
        expect(json_data[:tokens][:accessToken]).to be_present
        expect(json_data[:tokens][:refreshToken]).to be_present
      end
    end

    context "with nested auth params" do
      it "also works" do
        post "/api/v1/auth/login", params: { auth: valid_params }, as: :json
        expect(response).to have_http_status(:ok)
      end
    end

    context "with invalid email" do
      it "returns 401 status" do
        post "/api/v1/auth/login", params: { email: "wrong@example.com", password: "password123" }, as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with invalid password" do
      it "returns 401 status" do
        post "/api/v1/auth/login", params: { email: "test@example.com", password: "wrongpassword" }, as: :json
        expect(response).to have_http_status(:unauthorized)
        expect(json_error[:code]).to eq(ErrorHandler::ErrorCodes::INVALID_PASSWORD)
      end

      it "returns remaining attempts" do
        post "/api/v1/auth/login", params: { email: "test@example.com", password: "wrongpassword" }, as: :json
        expect(json_error[:details][:attempts_remaining]).to eq(4)
      end
    end

    context "with unconfirmed user" do
      let!(:unconfirmed_user) { create(:user, :unconfirmed, email: "unconfirmed@example.com", password: "password123") }

      it "returns 403 status" do
        post "/api/v1/auth/login", params: { email: "unconfirmed@example.com", password: "password123" }, as: :json
        expect(response).to have_http_status(:forbidden)
        expect(json_error[:code]).to eq(ErrorHandler::ErrorCodes::EMAIL_NOT_CONFIRMED)
      end
    end

    context "with locked account" do
      let!(:locked_user) { create(:user, :locked, email: "locked@example.com", password: "password123") }

      it "returns 429 status" do
        post "/api/v1/auth/login", params: { email: "locked@example.com", password: "password123" }, as: :json
        expect(response).to have_http_status(:too_many_requests)
        expect(json_error[:code]).to eq(ErrorHandler::ErrorCodes::ACCOUNT_LOCKED)
      end
    end

    context "with deleted user" do
      let!(:deleted_user) { create(:user, :deleted, email: "deleted@example.com", password: "password123") }

      it "returns 403 status" do
        post "/api/v1/auth/login", params: { email: "deleted@example.com", password: "password123" }, as: :json
        expect(response).to have_http_status(:forbidden)
        expect(json_error[:code]).to eq(ErrorHandler::ErrorCodes::NOT_AUTHORIZED)
      end
    end
  end

  describe "DELETE /api/v1/auth/logout" do
    it "returns 200 status" do
      delete "/api/v1/auth/logout", as: :json
      expect(response).to have_http_status(:ok)
    end

    it "returns success message" do
      delete "/api/v1/auth/logout", as: :json
      expect(json_data[:message]).to eq("Logged out successfully")
    end
  end

  describe "POST /api/v1/auth/refresh" do
    let!(:user) { create(:user) }

    context "with valid refresh token" do
      let(:refresh_token) { JwtConfig.generate_refresh_token(user)[:refresh_token] }

      it "returns 200 status" do
        post "/api/v1/auth/refresh", params: { refresh_token: refresh_token }, as: :json
        expect(response).to have_http_status(:ok)
      end

      it "returns new access token" do
        post "/api/v1/auth/refresh", params: { refresh_token: refresh_token }, as: :json
        expect(json_data[:accessToken]).to be_present
        expect(json_data[:expiresIn]).to be_present
      end
    end

    context "with invalid refresh token" do
      it "returns 401 status" do
        post "/api/v1/auth/refresh", params: { refresh_token: "invalid_token" }, as: :json
        expect(response).to have_http_status(:unauthorized)
        expect(json_error[:code]).to eq(ErrorHandler::ErrorCodes::INVALID_TOKEN)
      end
    end

    context "with blank refresh token" do
      it "returns 401 status" do
        post "/api/v1/auth/refresh", params: { refresh_token: "" }, as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe "POST /api/v1/auth/password/reset" do
    let!(:user) { create(:user, email: "reset@example.com") }

    context "with existing email" do
      it "returns 200 status" do
        post "/api/v1/auth/password/reset", params: { email: "reset@example.com" }, as: :json
        expect(response).to have_http_status(:ok)
      end

      it "returns success message" do
        post "/api/v1/auth/password/reset", params: { email: "reset@example.com" }, as: :json
        expect(json_data[:message]).to include("If your email is registered")
      end
    end

    context "with non-existing email" do
      it "also returns 200 status for security" do
        post "/api/v1/auth/password/reset", params: { email: "nonexistent@example.com" }, as: :json
        expect(response).to have_http_status(:ok)
      end
    end
  end

  describe "PUT /api/v1/auth/password/reset" do
    let(:user) { create(:user) }
    # send_reset_password_instructions returns the raw token (not the digest stored in DB)
    let(:raw_token) { user.send_reset_password_instructions }

    context "with valid token and password" do
      it "returns 200 status" do
        put "/api/v1/auth/password/reset", params: { token: raw_token, password: "newpassword123" }, as: :json
        expect(response).to have_http_status(:ok)
      end

      it "returns user data and success message" do
        put "/api/v1/auth/password/reset", params: { token: raw_token, password: "newpassword123" }, as: :json
        expect(json_data[:user]).to be_present
        expect(json_data[:message]).to include("reset successfully")
      end
    end

    context "with invalid token" do
      before { raw_token } # ensure user has reset token set

      it "returns 401 status" do
        put "/api/v1/auth/password/reset", params: { token: "invalid_token", password: "newpassword123" }, as: :json
        expect(response).to have_http_status(:unauthorized)
        expect(json_error[:code]).to eq(ErrorHandler::ErrorCodes::INVALID_TOKEN)
      end
    end

    context "with weak password" do
      it "returns 401 status" do
        put "/api/v1/auth/password/reset", params: { token: raw_token, password: "short" }, as: :json
        expect(response).to have_http_status(:unauthorized)
        expect(json_error[:code]).to eq(ErrorHandler::ErrorCodes::INVALID_PASSWORD)
      end
    end
  end

  describe "GET /api/v1/auth/verify_email/:token" do
    context "with valid token" do
      let!(:unconfirmed_user) { create(:user, :unconfirmed) }

      it "returns 200 status" do
        get "/api/v1/auth/verify_email/#{unconfirmed_user.confirmation_token}", as: :json
        expect(response).to have_http_status(:ok)
      end

      it "confirms the user" do
        get "/api/v1/auth/verify_email/#{unconfirmed_user.confirmation_token}", as: :json
        expect(json_data[:user]).to be_present
        expect(json_data[:message]).to include("confirmed successfully")
      end

      it "updates user confirmed_at" do
        get "/api/v1/auth/verify_email/#{unconfirmed_user.confirmation_token}", as: :json
        expect(unconfirmed_user.reload.confirmed?).to be true
      end
    end

    context "with invalid token" do
      it "returns 401 status" do
        get "/api/v1/auth/verify_email/invalid_token", as: :json
        expect(response).to have_http_status(:unauthorized)
        expect(json_error[:code]).to eq(ErrorHandler::ErrorCodes::INVALID_TOKEN)
      end
    end

    context "with already confirmed user" do
      let!(:confirmed_user) { create(:user) }

      it "returns error for already used token" do
        # Confirmation token is cleared after confirmation
        get "/api/v1/auth/verify_email/some_token", as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe "Full authentication flow" do
    it "allows register -> confirm -> login -> refresh -> logout" do
      # 1. Register
      post "/api/v1/auth/register", params: {
        email: "flowtest@example.com",
        password: "password123",
        display_name: "Flow Test"
      }, as: :json
      expect(response).to have_http_status(:created)

      # Get the created user and confirm
      user = User.find_by(email: "flowtest@example.com")
      expect(user).to be_present
      expect(user.confirmed?).to be false

      # 2. Verify email
      get "/api/v1/auth/verify_email/#{user.confirmation_token}", as: :json
      expect(response).to have_http_status(:ok)
      expect(user.reload.confirmed?).to be true

      # 3. Login
      post "/api/v1/auth/login", params: {
        email: "flowtest@example.com",
        password: "password123"
      }, as: :json
      expect(response).to have_http_status(:ok)

      tokens = json_data[:tokens]
      expect(tokens[:accessToken]).to be_present
      expect(tokens[:refreshToken]).to be_present

      # 4. Refresh token
      post "/api/v1/auth/refresh", params: {
        refresh_token: tokens[:refreshToken]
      }, as: :json
      expect(response).to have_http_status(:ok)
      expect(json_data[:accessToken]).to be_present

      # 5. Logout
      delete "/api/v1/auth/logout", as: :json
      expect(response).to have_http_status(:ok)
    end
  end

  describe "Password reset flow" do
    it "allows request reset -> confirm reset -> login with new password" do
      user = create(:user, email: "resetflow@example.com", password: "oldpassword123")

      # Clear any previously sent emails
      ActionMailer::Base.deliveries.clear

      # 1. Request password reset
      post "/api/v1/auth/password/reset", params: { email: "resetflow@example.com" }, as: :json
      expect(response).to have_http_status(:ok)

      # Get the reset token from email body
      # The token in the email is the raw token, not the digest stored in DB
      email = ActionMailer::Base.deliveries.last
      expect(email).to be_present
      # Extract token from email body (Devise includes it in the URL)
      token_match = email.body.encoded.match(/reset_password_token=([^"&\s]+)/)
      expect(token_match).to be_present
      raw_token = token_match[1]

      # 2. Confirm password reset using raw token
      put "/api/v1/auth/password/reset", params: {
        token: raw_token,
        password: "newpassword123"
      }, as: :json
      expect(response).to have_http_status(:ok)

      # 3. Login with old password should fail
      post "/api/v1/auth/login", params: {
        email: "resetflow@example.com",
        password: "oldpassword123"
      }, as: :json
      expect(response).to have_http_status(:unauthorized)

      # 4. Login with new password should succeed
      post "/api/v1/auth/login", params: {
        email: "resetflow@example.com",
        password: "newpassword123"
      }, as: :json
      expect(response).to have_http_status(:ok)
    end
  end

  describe "Account lockout flow" do
    it "locks account after 5 failed attempts and unlocks after duration" do
      user = create(:user, email: "lockflow@example.com", password: "password123")

      # 5 failed login attempts
      5.times do
        post "/api/v1/auth/login", params: {
          email: "lockflow@example.com",
          password: "wrongpassword"
        }, as: :json
      end

      # Account should be locked
      expect(response).to have_http_status(:too_many_requests)
      expect(json_error[:code]).to eq(ErrorHandler::ErrorCodes::ACCOUNT_LOCKED)

      # Even correct password should fail
      post "/api/v1/auth/login", params: {
        email: "lockflow@example.com",
        password: "password123"
      }, as: :json
      expect(response).to have_http_status(:too_many_requests)

      # Simulate time passing
      user.update(locked_at: 31.minutes.ago)

      # Should be able to login now
      post "/api/v1/auth/login", params: {
        email: "lockflow@example.com",
        password: "password123"
      }, as: :json
      expect(response).to have_http_status(:ok)
    end
  end
end
