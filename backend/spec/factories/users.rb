# frozen_string_literal: true

FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "user#{n}@example.com" }
    password { "password123" }
    display_name { Faker::Name.name.truncate(30) }
    locale { "ja" }
    role { :user }
    confirmed_at { Time.current }
    failed_attempts { 0 }
    locked_at { nil }
    deleted_at { nil }

    trait :unconfirmed do
      confirmed_at { nil }
    end

    trait :admin do
      role { :admin }
    end

    trait :deleted do
      deleted_at { Time.current }
    end

    trait :locked do
      failed_attempts { 5 }
      locked_at { Time.current }
    end

    trait :with_expired_lock do
      failed_attempts { 5 }
      locked_at { 31.minutes.ago }
    end

    trait :with_failed_attempts do
      failed_attempts { 3 }
    end

    trait :english do
      locale { "en" }
    end

    trait :violation_flagged do
      violation_flagged { true }
      violation_count { 3 }
    end

    trait :with_violations do
      transient do
        violations { 2 }
      end

      violation_count { violations }
      violation_flagged { violations >= 3 }
    end

    trait :pending_deletion do
      deletion_requested_at { Time.current }
      deletion_scheduled_at { 14.days.from_now }
      deletion_job_id { SecureRandom.uuid }
    end

    trait :deletion_due do
      deletion_requested_at { 15.days.ago }
      deletion_scheduled_at { 1.day.ago }
      deletion_job_id { SecureRandom.uuid }
    end

    trait :deletion_soon do
      deletion_requested_at { 13.days.ago }
      deletion_scheduled_at { 1.day.from_now }
      deletion_job_id { SecureRandom.uuid }
    end
  end
end
