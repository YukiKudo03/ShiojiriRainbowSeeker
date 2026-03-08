# frozen_string_literal: true

require "rails_helper"

RSpec.describe PhotoFeedChannel, type: :channel do
  let(:user) { create(:user) }

  before { stub_connection current_user: user }

  describe "#subscribed" do
    it "confirms the subscription" do
      subscribe
      expect(subscription).to be_confirmed
    end

    it "streams from the photo_feed stream" do
      subscribe
      expect(subscription).to have_stream_from("photo_feed")
    end

    it "does not reject the subscription for an authenticated user" do
      subscribe
      expect(subscription).not_to be_rejected
    end
  end

  describe "broadcasting" do
    it "receives new photo broadcasts on the photo_feed stream" do
      subscribe

      photo_data = {
        type: "new_photo",
        photo: {
          id: SecureRandom.uuid,
          title: "Double Rainbow",
          user: { id: user.id, display_name: user.display_name },
          latitude: 36.115,
          longitude: 137.954,
          thumbnail_url: nil,
          captured_at: Time.current.iso8601,
          created_at: Time.current.iso8601
        }
      }

      expect {
        ActionCable.server.broadcast("photo_feed", photo_data)
      }.to have_broadcasted_to("photo_feed").with(photo_data)
    end

    it "delivers broadcasts with correct structure" do
      subscribe

      expect {
        ActionCable.server.broadcast("photo_feed", { type: "new_photo", photo: { id: "test" } })
      }.to have_broadcasted_to("photo_feed").with(
        hash_including(type: "new_photo")
      )
    end
  end
end
