# frozen_string_literal: true

FactoryBot.define do
  factory :rainbow_moment do
    starts_at { Time.current }
    ends_at { Time.current + 15.minutes }
    location_id { "daimon" }
    status { "active" }
    weather_snapshot { { temperature: 20.5, humidity: 75, precipitation_mm: 1.2 } }
    participants_count { 0 }
    photos_count { 0 }

    trait :closing do
      status { "closing" }
      starts_at { 20.minutes.ago }
      ends_at { 5.minutes.ago }
    end

    trait :archived do
      status { "archived" }
      starts_at { 1.hour.ago }
      ends_at { 45.minutes.ago }
    end

    trait :expired do
      starts_at { 20.minutes.ago }
      ends_at { 1.minute.ago }
    end
  end
end
