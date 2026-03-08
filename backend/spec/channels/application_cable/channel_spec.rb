# frozen_string_literal: true

require "rails_helper"

RSpec.describe ApplicationCable::Channel, type: :channel do
  describe "inheritance" do
    it "inherits from ActionCable::Channel::Base" do
      expect(described_class.superclass).to eq(ActionCable::Channel::Base)
    end

    it "serves as the base class for application channels" do
      expect(NotificationsChannel.superclass).to eq(described_class)
      expect(PhotoFeedChannel.superclass).to eq(described_class)
    end
  end
end
