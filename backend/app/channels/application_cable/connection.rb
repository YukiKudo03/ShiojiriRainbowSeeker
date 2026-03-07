# frozen_string_literal: true

module ApplicationCable
  # WebSocket connection with JWT authentication.
  #
  # Clients connect with a token parameter:
  #   ws://host/cable?token=<jwt>
  #
  # The token is decoded using the same Devise JWT secret
  # used by the REST API, ensuring a single auth mechanism.
  class Connection < ActionCable::Connection::Base
    identified_by :current_user

    def connect
      self.current_user = find_verified_user
    end

    private

    def find_verified_user
      token = request.params[:token]
      reject_unauthorized_connection unless token.present?

      secret = Rails.application.credentials.devise_jwt_secret_key ||
               ENV.fetch("DEVISE_JWT_SECRET_KEY", nil)
      reject_unauthorized_connection unless secret

      payload = JWT.decode(token, secret, true, algorithm: "HS256").first
      user = User.find_by(id: payload["sub"])
      reject_unauthorized_connection unless user

      user
    rescue JWT::DecodeError, JWT::ExpiredSignature
      reject_unauthorized_connection
    end
  end
end
