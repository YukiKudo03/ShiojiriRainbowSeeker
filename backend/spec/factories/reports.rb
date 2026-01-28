# frozen_string_literal: true

FactoryBot.define do
  factory :report do
    association :reporter, factory: :user
    reason { Faker::Lorem.paragraph(sentence_count: 2).truncate(500) }
    status { :pending }
    admin_note { nil }
    resolved_by { nil }

    # Default: report a photo
    transient do
      reportable { nil }
    end

    after(:build) do |report, evaluator|
      if evaluator.reportable
        report.reportable = evaluator.reportable
      else
        # Create a photo if no reportable is provided (without image for faster tests)
        report.reportable = create(:photo, :without_image)
      end
    end

    trait :photo_report do
      after(:build) do |report|
        report.reportable = create(:photo)
      end
    end

    trait :comment_report do
      after(:build) do |report|
        photo = create(:photo)
        report.reportable = create(:comment, photo: photo)
      end
    end

    trait :pending do
      status { :pending }
      resolved_by { nil }
      admin_note { nil }
    end

    trait :resolved do
      status { :resolved }
      association :resolved_by, factory: [ :user, :admin ]
      admin_note { "Content violates community guidelines." }
    end

    trait :dismissed do
      status { :dismissed }
      association :resolved_by, factory: [ :user, :admin ]
      admin_note { "Report reviewed. No action needed." }
    end

    trait :with_admin_note do
      admin_note { Faker::Lorem.sentence(word_count: 10) }
    end

    trait :spam do
      reason { "This appears to be spam content." }
    end

    trait :inappropriate do
      reason { "This content is inappropriate and violates community standards." }
    end

    trait :copyright do
      reason { "This content infringes on copyright." }
    end
  end
end
