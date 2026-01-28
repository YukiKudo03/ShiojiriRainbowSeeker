# frozen_string_literal: true

FactoryBot.define do
  factory :photo do
    association :user
    title { Faker::Lorem.sentence(word_count: 3).truncate(100) }
    description { Faker::Lorem.paragraph(sentence_count: 2).truncate(500) }
    captured_at { Faker::Time.backward(days: 30) }
    location_name { "#{Faker::Address.city}, #{Faker::Address.state}" }
    moderation_status { :approved }
    is_visible { true }
    like_count { 0 }
    comment_count { 0 }

    transient do
      skip_image { false }
    end

    # Set location using PostGIS
    after(:build) do |photo|
      # Shiojiri area coordinates (around 36.1, 137.9)
      lat = 36.1 + rand(-0.1..0.1)
      lng = 137.9 + rand(-0.1..0.1)
      photo.set_location(lat, lng)
    end

    # Attach a test image (unless skip_image is true)
    after(:build) do |photo, evaluator|
      unless evaluator.skip_image
        image_path = Rails.root.join("spec/fixtures/files/test_image.jpg")
        if image_path.exist?
          photo.image.attach(
            io: image_path.open,
            filename: "test_image.jpg",
            content_type: "image/jpeg"
          )
        end
      end
    end

    trait :without_image do
      skip_image { true }
    end

    trait :without_location do
      after(:build) do |photo|
        photo.location = nil
      end
      location_name { nil }
    end

    trait :pending do
      moderation_status { :pending }
    end

    trait :hidden do
      moderation_status { :hidden }
      is_visible { false }
    end

    trait :deleted do
      moderation_status { :deleted }
      is_visible { false }
    end

    trait :with_likes do
      transient do
        likes_count { 5 }
      end

      after(:create) do |photo, evaluator|
        create_list(:like, evaluator.likes_count, photo: photo)
        photo.update_column(:like_count, evaluator.likes_count)
      end
    end

    trait :with_comments do
      transient do
        comments_count { 3 }
      end

      after(:create) do |photo, evaluator|
        create_list(:comment, evaluator.comments_count, photo: photo)
        photo.update_column(:comment_count, evaluator.comments_count)
      end
    end

    trait :with_weather do
      after(:create) do |photo|
        create_list(:weather_condition, 3, photo: photo)
      end
    end

    trait :with_favorable_weather do
      after(:create) do |photo|
        # Create weather at capture time with favorable conditions
        create(:weather_condition, :rainbow_favorable,
               photo: photo,
               timestamp: photo.captured_at,
               precipitation: 1.5)
      end
    end

    trait :old do
      captured_at { 6.months.ago }
    end

    trait :recent do
      captured_at { 1.day.ago }
    end
  end
end
