# frozen_string_literal: true

require "rails_helper"

RSpec.describe ApplicationSerializer, type: :serializer do
  # Create a test serializer that inherits from ApplicationSerializer
  let(:test_serializer_class) do
    Class.new(described_class) do
      attributes :id

      attribute :name do |obj|
        obj[:name]
      end

      attribute :created_at do |obj|
        iso8601(obj[:created_at])
      end

      # Override to work with plain hash objects
      def self.name
        "TestSerializer"
      end
    end
  end

  let(:test_object) do
    { id: 1, name: "test_item", created_at: Time.zone.parse("2026-03-01 12:00:00") }
  end

  describe "Alba::Resource inclusion" do
    it "includes Alba::Resource" do
      expect(described_class.ancestors).to include(Alba::Resource)
    end
  end

  describe "transform_keys :lower_camel" do
    it "transforms snake_case keys to camelCase" do
      # Use UserSerializer as a real-world test since it inherits ApplicationSerializer
      user = create(:user, display_name: "TestUser")
      serialized = UserSerializer.new(user).to_h

      expect(serialized).to have_key(:displayName)
      expect(serialized).not_to have_key(:display_name)
    end

    it "transforms createdAt from created_at" do
      user = create(:user)
      serialized = UserSerializer.new(user).to_h

      expect(serialized).to have_key(:createdAt)
      expect(serialized).not_to have_key(:created_at)
    end
  end

  describe "#iso8601 helper method" do
    let(:serializer_instance) { described_class.new(nil) }

    it "formats a Time object as ISO8601 string" do
      time = Time.zone.parse("2026-03-01 12:00:00")
      result = serializer_instance.iso8601(time)
      expect(result).to match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    end

    it "returns nil for nil input" do
      result = serializer_instance.iso8601(nil)
      expect(result).to be_nil
    end
  end

  describe "inheritance" do
    it "provides camelCase keys to all child serializers" do
      # Verify multiple serializers inherit the key transformation
      photo = create(:photo, :without_image)
      serialized = PhotoSerializer.new(photo).to_h

      expect(serialized).to have_key(:likeCount)
      expect(serialized).not_to have_key(:like_count)
    end
  end
end
