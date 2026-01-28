# frozen_string_literal: true

FactoryBot.define do
  factory :device_token do
    association :user
    token { "token_#{SecureRandom.hex(32)}" }
    platform { %w[ios android].sample }
    is_active { true }

    trait :ios do
      platform { "ios" }
    end

    trait :android do
      platform { "android" }
    end

    trait :inactive do
      is_active { false }
    end
  end
end
