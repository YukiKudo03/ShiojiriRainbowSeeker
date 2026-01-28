# frozen_string_literal: true

require "rails_helper"

RSpec.describe AuthService, type: :service do
  subject(:service) { described_class.new }

  describe "#register" do
    context "with valid parameters" do
      let(:params) do
        {
          email: "newuser@example.com",
          password: "password123",
          display_name: "New User"
        }
      end

      it "creates a new user" do
        expect { service.register(**params) }.to change(User, :count).by(1)
      end

      it "returns success result" do
        result = service.register(**params)
        expect(result[:success]).to be true
      end

      it "returns user data with camelCase keys" do
        result = service.register(**params)
        expect(result[:data][:user]).to include(
          email: "newuser@example.com",
          displayName: "New User"
        )
      end

      it "returns confirmation message" do
        result = service.register(**params)
        expect(result[:data][:message]).to include("Please check your email")
      end
    end

    context "with invalid email format" do
      let(:params) do
        {
          email: "invalid-email",
          password: "password123",
          display_name: "New User"
        }
      end

      it "does not create a user" do
        expect { service.register(**params) }.not_to change(User, :count)
      end

      it "returns failure with INVALID_EMAIL code" do
        result = service.register(**params)
        expect(result[:success]).to be false
        expect(result[:error][:code]).to eq(ErrorHandler::ErrorCodes::INVALID_EMAIL)
      end
    end

    context "with already registered email" do
      let!(:existing_user) { create(:user, email: "existing@example.com") }
      let(:params) do
        {
          email: "existing@example.com",
          password: "password123",
          display_name: "New User"
        }
      end

      it "does not create a user" do
        expect { service.register(**params) }.not_to change(User, :count)
      end

      it "returns failure with INVALID_EMAIL code" do
        result = service.register(**params)
        expect(result[:success]).to be false
        expect(result[:error][:code]).to eq(ErrorHandler::ErrorCodes::INVALID_EMAIL)
        expect(result[:error][:message]).to include("already registered")
      end
    end

    context "with short password" do
      let(:params) do
        {
          email: "newuser@example.com",
          password: "short",
          display_name: "New User"
        }
      end

      it "returns failure with INVALID_PASSWORD code" do
        result = service.register(**params)
        expect(result[:success]).to be false
        expect(result[:error][:code]).to eq(ErrorHandler::ErrorCodes::INVALID_PASSWORD)
      end
    end

    context "with invalid display_name" do
      let(:params) do
        {
          email: "newuser@example.com",
          password: "password123",
          display_name: "ab"
        }
      end

      it "returns failure with VALIDATION_FAILED code" do
        result = service.register(**params)
        expect(result[:success]).to be false
        expect(result[:error][:code]).to eq(ErrorHandler::ErrorCodes::VALIDATION_FAILED)
      end
    end
  end

  describe "#login" do
    let!(:user) { create(:user, email: "test@example.com", password: "password123") }

    context "with valid credentials" do
      it "returns success result" do
        result = service.login(email: "test@example.com", password: "password123")
        expect(result[:success]).to be true
      end

      it "returns user data" do
        result = service.login(email: "test@example.com", password: "password123")
        expect(result[:data][:user][:email]).to eq("test@example.com")
      end

      it "returns tokens with camelCase keys" do
        result = service.login(email: "test@example.com", password: "password123")
        expect(result[:data][:tokens]).to include(
          :accessToken,
          :refreshToken,
          :accessExpiresIn,
          :refreshExpiresAt
        )
      end

      it "resets failed attempts after successful login" do
        user.update(failed_attempts: 3)
        service.login(email: "test@example.com", password: "password123")
        expect(user.reload.failed_attempts).to eq(0)
      end
    end

    context "with non-existent email" do
      it "returns failure with INVALID_EMAIL code" do
        result = service.login(email: "nonexistent@example.com", password: "password123")
        expect(result[:success]).to be false
        expect(result[:error][:code]).to eq(ErrorHandler::ErrorCodes::INVALID_EMAIL)
      end
    end

    context "with wrong password" do
      it "returns failure with INVALID_PASSWORD code" do
        result = service.login(email: "test@example.com", password: "wrongpassword")
        expect(result[:success]).to be false
        expect(result[:error][:code]).to eq(ErrorHandler::ErrorCodes::INVALID_PASSWORD)
      end

      it "increments failed_attempts" do
        expect {
          service.login(email: "test@example.com", password: "wrongpassword")
        }.to change { user.reload.failed_attempts }.by(1)
      end

      it "returns remaining attempts" do
        result = service.login(email: "test@example.com", password: "wrongpassword")
        expect(result[:error][:details][:attempts_remaining]).to eq(4)
      end
    end

    context "with unconfirmed user" do
      let!(:unconfirmed_user) { create(:user, :unconfirmed, email: "unconfirmed@example.com", password: "password123") }

      it "returns failure with EMAIL_NOT_CONFIRMED code" do
        result = service.login(email: "unconfirmed@example.com", password: "password123")
        expect(result[:success]).to be false
        expect(result[:error][:code]).to eq(ErrorHandler::ErrorCodes::EMAIL_NOT_CONFIRMED)
      end
    end

    context "with deleted user" do
      let!(:deleted_user) { create(:user, :deleted, email: "deleted@example.com", password: "password123") }

      it "returns failure with NOT_AUTHORIZED code" do
        result = service.login(email: "deleted@example.com", password: "password123")
        expect(result[:success]).to be false
        expect(result[:error][:code]).to eq(ErrorHandler::ErrorCodes::NOT_AUTHORIZED)
      end
    end

    context "with locked account" do
      let!(:locked_user) { create(:user, :locked, email: "locked@example.com", password: "password123") }

      it "returns failure with ACCOUNT_LOCKED code" do
        result = service.login(email: "locked@example.com", password: "password123")
        expect(result[:success]).to be false
        expect(result[:error][:code]).to eq(ErrorHandler::ErrorCodes::ACCOUNT_LOCKED)
      end

      it "returns unlock time in details" do
        result = service.login(email: "locked@example.com", password: "password123")
        expect(result[:error][:details][:unlock_in_minutes]).to be_present
      end
    end

    context "when account gets locked after 5 failed attempts" do
      let!(:failing_user) { create(:user, email: "failing@example.com", password: "password123", failed_attempts: 4) }

      it "locks the account on 5th failed attempt" do
        service.login(email: "failing@example.com", password: "wrongpassword")
        expect(failing_user.reload.locked_at).to be_present
      end

      it "returns ACCOUNT_LOCKED code" do
        result = service.login(email: "failing@example.com", password: "wrongpassword")
        expect(result[:error][:code]).to eq(ErrorHandler::ErrorCodes::ACCOUNT_LOCKED)
      end
    end

    context "with expired lock" do
      let!(:expired_lock_user) { create(:user, :with_expired_lock, email: "expired@example.com", password: "password123") }

      it "allows login after lockout expires" do
        result = service.login(email: "expired@example.com", password: "password123")
        expect(result[:success]).to be true
      end

      it "resets failed attempts and locked_at" do
        service.login(email: "expired@example.com", password: "password123")
        expired_lock_user.reload
        expect(expired_lock_user.failed_attempts).to eq(0)
        expect(expired_lock_user.locked_at).to be_nil
      end
    end
  end

  describe "#verify_email" do
    context "with valid token" do
      let!(:unconfirmed_user) { create(:user, :unconfirmed) }

      it "confirms the user" do
        token = unconfirmed_user.confirmation_token
        result = service.verify_email(token: token)
        expect(result[:success]).to be true
        expect(unconfirmed_user.reload.confirmed?).to be true
      end

      it "returns user data" do
        token = unconfirmed_user.confirmation_token
        result = service.verify_email(token: token)
        expect(result[:data][:user][:email]).to eq(unconfirmed_user.email)
      end
    end

    context "with blank token" do
      it "returns failure with INVALID_TOKEN code" do
        result = service.verify_email(token: "")
        expect(result[:success]).to be false
        expect(result[:error][:code]).to eq(ErrorHandler::ErrorCodes::INVALID_TOKEN)
      end
    end

    context "with invalid token" do
      it "returns failure with INVALID_TOKEN code" do
        result = service.verify_email(token: "invalid_token")
        expect(result[:success]).to be false
        expect(result[:error][:code]).to eq(ErrorHandler::ErrorCodes::INVALID_TOKEN)
      end
    end
  end

  describe "#refresh_token" do
    let!(:user) { create(:user) }

    context "with valid refresh token" do
      it "returns a new access token with camelCase keys" do
        # Generate a valid refresh token
        refresh_data = JwtConfig.generate_refresh_token(user)
        result = service.refresh_token(refresh_token: refresh_data[:refresh_token])

        expect(result[:success]).to be true
        expect(result[:data][:accessToken]).to be_present
        expect(result[:data][:expiresIn]).to be_present
      end
    end

    context "with blank refresh token" do
      it "returns failure with INVALID_TOKEN code" do
        result = service.refresh_token(refresh_token: "")
        expect(result[:success]).to be false
        expect(result[:error][:code]).to eq(ErrorHandler::ErrorCodes::INVALID_TOKEN)
      end
    end

    context "with invalid refresh token" do
      it "returns failure with INVALID_TOKEN code" do
        result = service.refresh_token(refresh_token: "invalid_token")
        expect(result[:success]).to be false
        expect(result[:error][:code]).to eq(ErrorHandler::ErrorCodes::INVALID_TOKEN)
      end
    end

    context "with deleted user" do
      let!(:deleted_user) { create(:user, :deleted) }

      it "returns failure with NOT_AUTHORIZED code" do
        refresh_data = JwtConfig.generate_refresh_token(deleted_user)
        result = service.refresh_token(refresh_token: refresh_data[:refresh_token])

        expect(result[:success]).to be false
        expect(result[:error][:code]).to eq(ErrorHandler::ErrorCodes::NOT_AUTHORIZED)
      end
    end
  end

  describe "#reset_password" do
    let!(:user) { create(:user, email: "reset@example.com") }

    context "with existing email" do
      it "always returns success" do
        result = service.reset_password(email: "reset@example.com")
        expect(result[:success]).to be true
      end

      it "sets reset_password_token on user" do
        service.reset_password(email: "reset@example.com")
        expect(user.reload.reset_password_token).to be_present
      end
    end

    context "with non-existing email" do
      it "still returns success for security" do
        result = service.reset_password(email: "nonexistent@example.com")
        expect(result[:success]).to be true
      end
    end

    context "with deleted user" do
      let!(:deleted_user) { create(:user, :deleted, email: "deleted_reset@example.com") }

      it "returns success but does not send email" do
        result = service.reset_password(email: "deleted_reset@example.com")
        expect(result[:success]).to be true
        expect(deleted_user.reload.reset_password_token).to be_nil
      end
    end
  end

  describe "#confirm_password_reset" do
    let!(:user) { create(:user) }
    # send_reset_password_instructions returns the raw token before hashing
    let!(:raw_token) { user.send_reset_password_instructions }

    context "with valid token and password" do
      it "resets the password" do
        result = service.confirm_password_reset(token: raw_token, new_password: "newpassword123")

        expect(result[:success]).to be true
      end

      it "allows login with new password" do
        service.confirm_password_reset(token: raw_token, new_password: "newpassword123")

        login_result = service.login(email: user.email, password: "newpassword123")
        expect(login_result[:success]).to be true
      end

      it "resets failed attempts" do
        user.update(failed_attempts: 3, locked_at: Time.current)
        service.confirm_password_reset(token: raw_token, new_password: "newpassword123")

        expect(user.reload.failed_attempts).to eq(0)
        expect(user.locked_at).to be_nil
      end
    end

    context "with blank token" do
      it "returns failure with INVALID_TOKEN code" do
        result = service.confirm_password_reset(token: "", new_password: "newpassword123")
        expect(result[:success]).to be false
        expect(result[:error][:code]).to eq(ErrorHandler::ErrorCodes::INVALID_TOKEN)
      end
    end

    context "with invalid token" do
      it "returns failure with INVALID_TOKEN code" do
        result = service.confirm_password_reset(token: "invalid_token", new_password: "newpassword123")
        expect(result[:success]).to be false
        expect(result[:error][:code]).to eq(ErrorHandler::ErrorCodes::INVALID_TOKEN)
      end
    end

    context "with weak password" do
      it "returns failure with INVALID_PASSWORD code" do
        token = user.reset_password_token
        result = service.confirm_password_reset(token: token, new_password: "short")

        expect(result[:success]).to be false
        expect(result[:error][:code]).to eq(ErrorHandler::ErrorCodes::INVALID_PASSWORD)
      end
    end
  end

  describe "private methods behavior" do
    describe "account lockout logic" do
      it "locks account after MAX_FAILED_ATTEMPTS" do
        user = create(:user, email: "locktest@example.com", password: "password123")

        5.times do
          service.login(email: "locktest@example.com", password: "wrongpassword")
        end

        expect(user.reload.locked_at).to be_present
        expect(user.failed_attempts).to eq(5)
      end

      it "lockout expires after LOCKOUT_DURATION" do
        user = create(:user, :locked, email: "expiretest@example.com", password: "password123")
        user.update(locked_at: 31.minutes.ago)

        result = service.login(email: "expiretest@example.com", password: "password123")
        expect(result[:success]).to be true
      end
    end
  end
end
