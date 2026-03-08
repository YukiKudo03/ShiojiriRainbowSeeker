# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Social Notification Workflow", type: :request do
  include ActiveJob::TestHelper

  let(:photo_owner) { create(:user, display_name: "PhotoOwner") }
  let(:other_user) { create(:user, display_name: "OtherUser") }
  let(:photo) { create(:photo, :without_image, user: photo_owner) }

  describe "like -> notification -> broadcast workflow" do
    it "creates a like and enqueues SocialNotificationJob" do
      expect {
        post api_v1_path("/photos/#{photo.id}/likes"),
             headers: auth_headers(other_user)
      }.to have_enqueued_job(SocialNotificationJob).with(
        notification_type: "like",
        liker_id: other_user.id,
        photo_id: photo.id
      )

      expect(response).to have_http_status(:created)
      body = json_body
      expect(body[:data][:liked]).to be true
    end

    it "creates an in-app notification for the photo owner when job is performed" do
      post api_v1_path("/photos/#{photo.id}/likes"),
           headers: auth_headers(other_user)

      expect {
        perform_enqueued_jobs(only: SocialNotificationJob)
      }.to change { photo_owner.notifications.count }.by(1)

      notification = photo_owner.notifications.last
      expect(notification.notification_type).to eq("like")
      expect(notification.title).to eq("いいね！")
      expect(notification.body).to include(other_user.display_name)
    end

    it "does not create a notification when a user likes their own photo" do
      post api_v1_path("/photos/#{photo.id}/likes"),
           headers: auth_headers(photo_owner)

      perform_enqueued_jobs(only: SocialNotificationJob)

      # Check that no like notification was created for the owner
      like_notifications = photo_owner.notifications.where(notification_type: :like)
      expect(like_notifications.count).to eq(0)
    end
  end

  describe "comment -> notification -> broadcast workflow" do
    it "creates a comment and enqueues SocialNotificationJob" do
      expect {
        post api_v1_path("/photos/#{photo.id}/comments"),
             params: { content: "Wonderful rainbow!" }.to_json,
             headers: auth_headers(other_user).merge("Content-Type" => "application/json")
      }.to have_enqueued_job(SocialNotificationJob)

      expect(response).to have_http_status(:created)
      body = json_body
      expect(body[:data][:comment]).to be_present
    end

    it "creates an in-app notification for the photo owner when comment job is performed" do
      post api_v1_path("/photos/#{photo.id}/comments"),
           params: { content: "Amazing shot!" }.to_json,
           headers: auth_headers(other_user).merge("Content-Type" => "application/json")

      expect {
        perform_enqueued_jobs(only: SocialNotificationJob)
      }.to change { photo_owner.notifications.count }.by(1)

      notification = photo_owner.notifications.last
      expect(notification.notification_type).to eq("comment")
      expect(notification.title).to eq("コメント")
      expect(notification.body).to include(other_user.display_name)
    end

    it "broadcasts to NotificationsChannel when a comment is created" do
      expect {
        post api_v1_path("/photos/#{photo.id}/comments"),
             params: { content: "Broadcasting test!" }.to_json,
             headers: auth_headers(other_user).merge("Content-Type" => "application/json")
      }.to have_broadcasted_to(photo_owner).from_channel(NotificationsChannel)
    end

    it "does not broadcast when a user comments on their own photo" do
      expect {
        post api_v1_path("/photos/#{photo.id}/comments"),
             params: { content: "Commenting on my own photo" }.to_json,
             headers: auth_headers(photo_owner).merge("Content-Type" => "application/json")
      }.not_to have_broadcasted_to(photo_owner).from_channel(NotificationsChannel)
    end
  end
end
