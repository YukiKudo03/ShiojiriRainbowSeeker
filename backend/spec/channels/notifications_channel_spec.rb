# frozen_string_literal: true

require "rails_helper"

RSpec.describe NotificationsChannel, type: :channel do
  let(:user) { create(:user) }

  before { stub_connection current_user: user }

  describe "#subscribed" do
    it "confirms the subscription" do
      subscribe
      expect(subscription).to be_confirmed
    end

    it "streams for the current user" do
      subscribe
      expect(subscription).to have_stream_for(user)
    end

    it "does not reject the subscription for an authenticated user" do
      subscribe
      expect(subscription).not_to be_rejected
    end
  end

  describe "broadcast_to" do
    it "delivers notification data to the subscribed user" do
      subscribe

      notification_data = {
        type: "new_comment",
        photo_id: SecureRandom.uuid,
        comment: {
          id: SecureRandom.uuid,
          content: "Beautiful rainbow!",
          user: { id: SecureRandom.uuid, display_name: "TestUser" }
        },
        comment_count: 5
      }

      expect {
        NotificationsChannel.broadcast_to(user, notification_data)
      }.to have_broadcasted_to(user).with(notification_data)
    end

    it "delivers like notification data to the correct user" do
      subscribe

      like_data = {
        type: "like",
        photo_id: SecureRandom.uuid,
        liker: { id: SecureRandom.uuid, display_name: "Liker" }
      }

      expect {
        NotificationsChannel.broadcast_to(user, like_data)
      }.to have_broadcasted_to(user).with(like_data)
    end
  end
end
