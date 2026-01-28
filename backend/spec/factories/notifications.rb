# frozen_string_literal: true

FactoryBot.define do
  factory :notification do
    association :user
    notification_type { :system }
    title { Faker::Lorem.sentence(word_count: 5) }
    body { Faker::Lorem.paragraph(sentence_count: 2) }
    is_read { false }
    data { {} }

    trait :rainbow_alert do
      notification_type { :rainbow_alert }
      title { "Rainbow conditions detected!" }
      body { "Favorable conditions for rainbow viewing in your area." }
      data do
        {
          location: "Shiojiri, Nagano",
          probability: 0.85,
          expires_at: 2.hours.from_now.iso8601
        }
      end
    end

    trait :like do
      notification_type { :like }
      title { "Someone liked your photo" }
      body { "Your rainbow photo received a new like." }
      data do
        {
          photo_id: SecureRandom.uuid,
          liker_id: SecureRandom.uuid,
          liker_name: Faker::Name.name
        }
      end
    end

    trait :comment do
      notification_type { :comment }
      title { "New comment on your photo" }
      body { Faker::Lorem.sentence }
      data do
        {
          photo_id: SecureRandom.uuid,
          commenter_id: SecureRandom.uuid,
          commenter_name: Faker::Name.name,
          comment_preview: Faker::Lorem.sentence
        }
      end
    end

    trait :read do
      is_read { true }
    end

    trait :unread do
      is_read { false }
    end
  end
end
