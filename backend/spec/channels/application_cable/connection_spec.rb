# frozen_string_literal: true

require "rails_helper"

RSpec.describe ApplicationCable::Connection, type: :channel do
  let(:user) { create(:user) }
  let(:jwt_secret) do
    Rails.application.credentials.devise_jwt_secret_key ||
      ENV.fetch("DEVISE_JWT_SECRET_KEY", "test-secret-key")
  end

  def encode_jwt(payload, secret: jwt_secret, algorithm: "HS256")
    JWT.encode(payload, secret, algorithm)
  end

  describe "identified_by" do
    it "identifies connection by :current_user" do
      identifiers = described_class.identifiers
      expect(identifiers).to include(:current_user)
    end
  end

  describe "#connect" do
    context "with a valid JWT token" do
      it "successfully connects and sets current_user" do
        token = encode_jwt({ sub: user.id })
        connect "/cable", params: { token: token }
        expect(connection.current_user).to eq(user)
      end

      it "decodes the JWT using the devise_jwt_secret_key" do
        token = encode_jwt({ sub: user.id })
        connect "/cable", params: { token: token }
        expect(connection.current_user.id).to eq(user.id)
      end
    end

    context "without a token" do
      it "rejects the connection" do
        expect { connect "/cable" }.to have_rejected_connection
      end

      it "rejects when token param is empty string" do
        expect { connect "/cable", params: { token: "" } }.to have_rejected_connection
      end
    end

    context "with an invalid JWT" do
      it "rejects the connection for a malformed token" do
        expect { connect "/cable", params: { token: "not.a.valid.jwt" } }.to have_rejected_connection
      end

      it "rejects the connection for a token signed with wrong secret" do
        wrong_secret_token = encode_jwt({ sub: user.id }, secret: "wrong-secret-key")
        expect { connect "/cable", params: { token: wrong_secret_token } }.to have_rejected_connection
      end
    end

    context "with an expired JWT" do
      it "rejects the connection" do
        expired_token = encode_jwt({ sub: user.id, exp: 1.hour.ago.to_i })
        expect { connect "/cable", params: { token: expired_token } }.to have_rejected_connection
      end
    end

    context "when user is not found" do
      it "rejects the connection for a non-existent user ID" do
        non_existent_id = SecureRandom.uuid
        token = encode_jwt({ sub: non_existent_id })
        expect { connect "/cable", params: { token: token } }.to have_rejected_connection
      end
    end

    context "when JWT secret is nil" do
      it "rejects the connection" do
        allow(Rails.application.credentials).to receive(:devise_jwt_secret_key).and_return(nil)
        allow(ENV).to receive(:fetch).with("DEVISE_JWT_SECRET_KEY", nil).and_return(nil)

        token = encode_jwt({ sub: user.id })
        expect { connect "/cable", params: { token: token } }.to have_rejected_connection
      end
    end
  end
end
