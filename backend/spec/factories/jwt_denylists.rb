# frozen_string_literal: true

FactoryBot.define do
  factory :jwt_denylist do
    jti { SecureRandom.uuid }
    exp { 1.hour.from_now }
  end
end
