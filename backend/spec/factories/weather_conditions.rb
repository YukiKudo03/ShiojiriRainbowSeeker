# frozen_string_literal: true

FactoryBot.define do
  factory :weather_condition do
    association :photo
    timestamp { Faker::Time.backward(days: 7) }
    temperature { rand(10.0..30.0).round(1) }
    humidity { rand(40..90) }
    pressure { rand(990..1030) }
    wind_speed { rand(0.0..15.0).round(1) }
    wind_direction { rand(0..359) }
    weather_code { [ 200, 300, 500, 800, 801 ].sample }
    weather_description { [ "thunderstorm", "drizzle", "rain", "clear sky", "few clouds" ].sample }
    cloud_cover { rand(0..100) }
    visibility { rand(1000..10000) }
    sun_azimuth { rand(0.0..360.0).round(1) }
    sun_altitude { rand(-10.0..80.0).round(1) }
    precipitation { rand(0.0..5.0).round(1) }
    precipitation_type { [ "rain", "drizzle", nil ].sample }

    trait :rainbow_favorable do
      precipitation { rand(1.0..3.0).round(1) }
      precipitation_type { "rain" }
      humidity { rand(60..90) }
      cloud_cover { rand(20..80) }
      sun_altitude { rand(10..40) }
    end

    trait :not_favorable do
      humidity { rand(10..40) }
      cloud_cover { 100 }
      sun_altitude { rand(-10..5) }
    end
  end
end
