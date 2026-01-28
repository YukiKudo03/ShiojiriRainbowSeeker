# frozen_string_literal: true

require "rails_helper"

RSpec.describe NotificationService do
  let(:service) { described_class.new }
  let(:user) { create(:user) }

  before do
    # Stub external push notification clients
    allow(FcmClient).to receive(:configured?).and_return(true)
    allow(FcmClient).to receive(:send_to_devices).and_return([ { success: true } ])
    allow(ApnsClient).to receive(:configured?).and_return(true)
    allow(ApnsClient).to receive(:send_to_devices).and_return([ { success: true } ])
  end

  describe "#send_push_notification" do
    it "returns success for valid user" do
      result = service.send_push_notification(
        user: user,
        title: "Test Title",
        body: "Test Body",
        notification_type: :system
      )

      expect(result[:success]).to be true
    end

    it "returns error for nil user" do
      result = service.send_push_notification(
        user: nil,
        title: "Test",
        body: "Test"
      )

      expect(result[:success]).to be false
      expect(result[:error][:message]).to include("User not found")
    end

    context "with quiet hours enabled" do
      before do
        user.update!(notification_settings: {
          "quiet_hours_start" => "00:00",
          "quiet_hours_end" => "23:59",
          "timezone" => "Asia/Tokyo"
        })
      end

      it "skips notification during quiet hours" do
        result = service.send_push_notification(
          user: user,
          title: "Test",
          body: "Test"
        )

        expect(result[:success]).to be true
        expect(result[:skipped]).to be true
        expect(result[:reason]).to eq("quiet_hours")
      end

      it "sends notification when skip_quiet_hours_check is true" do
        result = service.send_push_notification(
          user: user,
          title: "Test",
          body: "Test",
          options: { skip_quiet_hours_check: true }
        )

        expect(result[:success]).to be true
        expect(result[:skipped]).to be_falsy
      end
    end

    context "with notification type disabled" do
      before do
        user.update!(notification_settings: { "likes" => false })
      end

      it "skips notification when type is disabled" do
        result = service.send_push_notification(
          user: user,
          title: "New Like",
          body: "Someone liked your photo",
          notification_type: :like
        )

        expect(result[:success]).to be true
        expect(result[:skipped]).to be true
        expect(result[:reason]).to eq("disabled_by_user")
      end
    end

    context "with active devices" do
      let!(:device_token) { create(:device_token, :ios, user: user) }

      it "sends to iOS devices" do
        result = service.send_push_notification(
          user: user,
          title: "Test",
          body: "Test"
        )

        expect(result[:success]).to be true
        expect(result[:devices_sent]).to be >= 0
      end
    end
  end

  describe "#send_rainbow_alert" do
    let(:users) { User.where(id: user.id) }
    let(:location) { { lat: 36.115, lng: 137.954 } }

    it "returns success with valid parameters" do
      result = service.send_rainbow_alert(
        users: users,
        location: location,
        direction: "east",
        probability: 0.85
      )

      expect(result[:success]).to be true
      expect(result).to have_key(:sent)
      expect(result).to have_key(:skipped)
      expect(result).to have_key(:failed)
    end

    it "returns error without location" do
      result = service.send_rainbow_alert(
        users: users,
        location: nil,
        direction: "east",
        probability: 0.85
      )

      expect(result[:success]).to be false
      expect(result[:error][:message]).to include("Location required")
    end

    it "builds correct notification body" do
      result = service.send_rainbow_alert(
        users: users,
        location: location,
        direction: "east",
        probability: 0.85,
        estimated_duration: 15,
        weather_summary: "晴れ時々曇り"
      )

      expect(result[:success]).to be true
    end
  end

  describe "#schedule_notification" do
    it "returns success with valid parameters" do
      result = service.schedule_notification(
        user: user,
        title: "Scheduled Test",
        body: "This is scheduled",
        deliver_at: 1.hour.from_now,
        notification_type: :system
      )

      expect(result[:success]).to be true
      expect(result).to have_key(:job_id)
      expect(result).to have_key(:scheduled_for)
    end

    it "returns error for nil user" do
      result = service.schedule_notification(
        user: nil,
        title: "Test",
        body: "Test",
        deliver_at: 1.hour.from_now
      )

      expect(result[:success]).to be false
      expect(result[:error][:message]).to include("User not found")
    end

    it "returns error for past deliver_at" do
      result = service.schedule_notification(
        user: user,
        title: "Test",
        body: "Test",
        deliver_at: 1.hour.ago
      )

      expect(result[:success]).to be false
      expect(result[:error][:message]).to include("must be in the future")
    end
  end

  describe "#list_for_user" do
    it "returns success with empty notifications" do
      result = service.list_for_user(user: user)

      expect(result[:success]).to be true
      expect(result[:notifications]).to eq([])
      expect(result[:pagination]).to be_a(Hash)
      expect(result[:unreadCount]).to eq(0)
    end

    it "returns error for nil user" do
      result = service.list_for_user(user: nil)

      expect(result[:success]).to be false
      expect(result[:error][:message]).to include("User not found")
    end

    it "respects pagination parameters" do
      result = service.list_for_user(user: user, page: 2, per_page: 10)

      expect(result[:success]).to be true
      expect(result[:pagination][:currentPage]).to eq(2)
      expect(result[:pagination][:perPage]).to eq(10)
    end

    it "enforces maximum page size" do
      result = service.list_for_user(user: user, per_page: 1000)

      expect(result[:success]).to be true
      expect(result[:pagination][:perPage]).to eq(100)
    end

    context "with notifications" do
      before do
        create_list(:notification, 5, user: user)
        create_list(:notification, 3, user: user, is_read: true)
      end

      it "returns all notifications" do
        result = service.list_for_user(user: user)

        expect(result[:success]).to be true
        expect(result[:notifications].length).to eq(8)
        expect(result[:unreadCount]).to eq(5)
      end

      it "filters unread notifications" do
        result = service.list_for_user(user: user, filter: :unread)

        expect(result[:success]).to be true
        expect(result[:notifications].length).to eq(5)
      end
    end
  end

  describe "#get_settings" do
    it "returns default settings for new user with camelCase keys" do
      result = service.get_settings(user: user)

      expect(result[:success]).to be true
      expect(result[:settings]["rainbowAlerts"]).to be true
      expect(result[:settings]["alertRadiusKm"]).to eq(10)
    end

    it "merges user settings with defaults" do
      user.update!(notification_settings: {
        "alert_radius_km" => 25,
        "rainbow_alerts" => false
      })

      result = service.get_settings(user: user)

      expect(result[:success]).to be true
      expect(result[:settings]["alertRadiusKm"]).to eq(25)
      expect(result[:settings]["rainbowAlerts"]).to be false
      expect(result[:settings]["likes"]).to be true  # Default value
    end
  end

  describe "#update_settings" do
    it "updates valid settings" do
      result = service.update_settings(
        user: user,
        settings: { "alert_radius_km" => 25 }
      )

      expect(result[:success]).to be true
      expect(user.reload.notification_settings["alert_radius_km"]).to eq(25)
    end

    it "returns error for invalid alert_radius_km" do
      result = service.update_settings(
        user: user,
        settings: { "alert_radius_km" => 15 }
      )

      expect(result[:success]).to be false
      expect(result[:error][:message]).to include("alert_radius_km must be 1, 5, 10, or 25")
    end

    it "validates quiet hours format" do
      result = service.update_settings(
        user: user,
        settings: { "quiet_hours_start" => "invalid" }
      )

      expect(result[:success]).to be false
      expect(result[:error][:message]).to include("quiet_hours_start must be in HH:MM format")
    end

    it "accepts valid quiet hours" do
      result = service.update_settings(
        user: user,
        settings: { "quiet_hours_start" => "22:00", "quiet_hours_end" => "07:00" }
      )

      expect(result[:success]).to be true
    end
  end

  describe "#mark_as_read" do
    let!(:notifications) { create_list(:notification, 5, user: user, is_read: false) }

    it "marks all notifications as read" do
      result = service.mark_as_read(user: user)

      expect(result[:success]).to be true
      expect(result[:markedCount]).to eq(5)
      expect(user.notifications.unread.count).to eq(0)
    end

    it "marks specific notifications as read" do
      notification_ids = notifications.first(2).map(&:id)
      result = service.mark_as_read(user: user, notification_ids: notification_ids)

      expect(result[:success]).to be true
      expect(result[:markedCount]).to eq(2)
      expect(user.notifications.unread.count).to eq(3)
    end
  end

  describe "DEFAULT_NOTIFICATION_SETTINGS" do
    it "has required keys" do
      settings = described_class::DEFAULT_NOTIFICATION_SETTINGS

      expect(settings).to have_key("rainbow_alerts")
      expect(settings).to have_key("likes")
      expect(settings).to have_key("comments")
      expect(settings).to have_key("system")
      expect(settings).to have_key("alert_radius_km")
      expect(settings).to have_key("quiet_hours_start")
      expect(settings).to have_key("quiet_hours_end")
      expect(settings).to have_key("timezone")
    end

    it "has correct default values" do
      settings = described_class::DEFAULT_NOTIFICATION_SETTINGS

      expect(settings["rainbow_alerts"]).to be true
      expect(settings["alert_radius_km"]).to eq(10)
      expect(settings["timezone"]).to eq("Asia/Tokyo")
    end
  end

  describe "#send_like_notification" do
    let(:photo_owner) { create(:user) }
    let(:liker) { create(:user) }
    let(:photo) { create(:photo, :without_image, user: photo_owner) }

    it "returns success for valid like notification" do
      result = service.send_like_notification(liker: liker, photo: photo)

      expect(result[:success]).to be true
    end

    it "returns error for nil liker" do
      result = service.send_like_notification(liker: nil, photo: photo)

      expect(result[:success]).to be false
      expect(result[:error][:message]).to include("Liker not found")
    end

    it "returns error for nil photo" do
      result = service.send_like_notification(liker: liker, photo: nil)

      expect(result[:success]).to be false
      expect(result[:error][:message]).to include("Photo not found")
    end

    context "when user likes their own photo" do
      let(:self_photo) { create(:photo, :without_image, user: liker) }

      it "skips notification with self_action reason" do
        result = service.send_like_notification(liker: liker, photo: self_photo)

        expect(result[:success]).to be true
        expect(result[:skipped]).to be true
        expect(result[:reason]).to eq("self_action")
      end
    end

    context "when likes notifications are disabled" do
      before do
        photo_owner.update!(notification_settings: { "likes" => false })
      end

      it "skips notification with disabled_by_user reason" do
        result = service.send_like_notification(liker: liker, photo: photo)

        expect(result[:success]).to be true
        expect(result[:skipped]).to be true
        expect(result[:reason]).to eq("disabled_by_user")
      end
    end
  end

  describe "#send_comment_notification" do
    let(:photo_owner) { create(:user) }
    let(:commenter) { create(:user) }
    let(:photo) { create(:photo, :without_image, user: photo_owner) }
    let(:comment) { create(:comment, user: commenter, photo: photo) }

    it "returns success for valid comment notification" do
      result = service.send_comment_notification(commenter: commenter, photo: photo, comment: comment)

      expect(result[:success]).to be true
    end

    it "returns error for nil commenter" do
      result = service.send_comment_notification(commenter: nil, photo: photo, comment: comment)

      expect(result[:success]).to be false
      expect(result[:error][:message]).to include("Commenter not found")
    end

    it "returns error for nil photo" do
      result = service.send_comment_notification(commenter: commenter, photo: nil, comment: comment)

      expect(result[:success]).to be false
      expect(result[:error][:message]).to include("Photo not found")
    end

    it "returns error for nil comment" do
      result = service.send_comment_notification(commenter: commenter, photo: photo, comment: nil)

      expect(result[:success]).to be false
      expect(result[:error][:message]).to include("Comment not found")
    end

    context "when user comments on their own photo" do
      let(:self_photo) { create(:photo, :without_image, user: commenter) }
      let(:self_comment) { create(:comment, user: commenter, photo: self_photo) }

      it "skips notification with self_action reason" do
        result = service.send_comment_notification(commenter: commenter, photo: self_photo, comment: self_comment)

        expect(result[:success]).to be true
        expect(result[:skipped]).to be true
        expect(result[:reason]).to eq("self_action")
      end
    end

    context "when comments notifications are disabled" do
      before do
        photo_owner.update!(notification_settings: { "comments" => false })
      end

      it "skips notification with disabled_by_user reason" do
        result = service.send_comment_notification(commenter: commenter, photo: photo, comment: comment)

        expect(result[:success]).to be true
        expect(result[:skipped]).to be true
        expect(result[:reason]).to eq("disabled_by_user")
      end
    end

    context "with long comment content" do
      let(:long_comment) { create(:comment, user: commenter, photo: photo, content: "Beautiful rainbow! " * 20) }

      it "truncates comment in notification body" do
        result = service.send_comment_notification(commenter: commenter, photo: photo, comment: long_comment)

        expect(result[:success]).to be true
      end
    end
  end
end
