# frozen_string_literal: true

FactoryBot.define do
  factory :radar_datum do
    association :photo
    timestamp { Time.current }
    precipitation_intensity { rand(0.0..10.0).round(2) }
    precipitation_area { rand(500..5000) }
    radius { 50000 }
    movement_direction { rand(0..359) }
    movement_speed { rand(0.0..20.0).round(1) }

    # Set center location using PostGIS
    after(:build) do |radar_datum|
      lat = 36.1 + rand(-0.1..0.1)
      lng = 137.9 + rand(-0.1..0.1)
      radar_datum.set_center_location(lat, lng)
    end

    trait :with_active_precipitation do
      precipitation_intensity { rand(2.0..10.0).round(2) }
    end

    trait :no_precipitation do
      precipitation_intensity { 0 }
    end
  end
end
