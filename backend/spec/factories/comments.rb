# frozen_string_literal: true

FactoryBot.define do
  factory :comment do
    association :user
    association :photo
    content { Faker::Lorem.paragraph(sentence_count: 2).truncate(500) }
    is_visible { true }

    trait :hidden do
      is_visible { false }
    end

    trait :long do
      content { Faker::Lorem.characters(number: 500) }
    end
  end
end
