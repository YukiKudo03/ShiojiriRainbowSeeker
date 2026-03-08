# frozen_string_literal: true

require "rails_helper"

RSpec.describe Notification, type: :model do
  subject(:notification) { build(:notification) }

  describe "associations" do
    it { is_expected.to belong_to(:user) }
  end

  describe "enums" do
    it { is_expected.to define_enum_for(:notification_type).with_values(rainbow_alert: 0, like: 1, comment: 2, system: 3) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:notification_type) }
    it { is_expected.to validate_length_of(:title).is_at_most(200) }
    it { is_expected.to validate_length_of(:body).is_at_most(1000) }
  end

  describe "scopes" do
    describe ".unread" do
      let!(:unread_notification) { create(:notification, :unread) }
      let!(:read_notification) { create(:notification, :read) }

      it "returns only unread notifications" do
        expect(Notification.unread).to include(unread_notification)
        expect(Notification.unread).not_to include(read_notification)
      end
    end

    describe ".read" do
      let!(:unread_notification) { create(:notification, :unread) }
      let!(:read_notification) { create(:notification, :read) }

      it "returns only read notifications" do
        expect(Notification.read).to include(read_notification)
        expect(Notification.read).not_to include(unread_notification)
      end
    end

    describe ".recent" do
      let!(:older_notification) { create(:notification, created_at: 2.days.ago) }
      let!(:newer_notification) { create(:notification, created_at: 1.day.ago) }

      it "orders by created_at descending" do
        expect(Notification.recent.first).to eq(newer_notification)
        expect(Notification.recent.last).to eq(older_notification)
      end
    end

    describe ".rainbow_alerts" do
      let!(:rainbow_notification) { create(:notification, :rainbow_alert) }
      let!(:like_notification) { create(:notification, :like) }

      it "returns only rainbow_alert notifications" do
        expect(Notification.rainbow_alerts).to include(rainbow_notification)
        expect(Notification.rainbow_alerts).not_to include(like_notification)
      end
    end

    describe ".social" do
      let!(:like_notification) { create(:notification, :like) }
      let!(:comment_notification) { create(:notification, :comment) }
      let!(:system_notification) { create(:notification) }

      it "returns only like and comment notifications" do
        expect(Notification.social).to include(like_notification, comment_notification)
        expect(Notification.social).not_to include(system_notification)
      end
    end

    describe ".system_notifications" do
      let!(:system_notification) { create(:notification, notification_type: :system) }
      let!(:like_notification) { create(:notification, :like) }

      it "returns only system notifications" do
        expect(Notification.system_notifications).to include(system_notification)
        expect(Notification.system_notifications).not_to include(like_notification)
      end
    end
  end

  describe "#mark_as_read!" do
    let(:notification) { create(:notification, :unread) }

    it "sets is_read to true" do
      expect { notification.mark_as_read! }.to change { notification.is_read }.from(false).to(true)
    end

    it "returns true on success" do
      expect(notification.mark_as_read!).to be true
    end
  end

  describe "#mark_as_unread!" do
    let(:notification) { create(:notification, :read) }

    it "sets is_read to false" do
      expect { notification.mark_as_unread! }.to change { notification.is_read }.from(true).to(false)
    end

    it "returns true on success" do
      expect(notification.mark_as_unread!).to be true
    end
  end

  describe "#photo_id" do
    it "returns photo_id from data when present" do
      notification = build(:notification, :like, data: { "photo_id" => "abc-123" })
      expect(notification.photo_id).to eq("abc-123")
    end

    it "returns nil when data is empty" do
      notification = build(:notification, data: {})
      expect(notification.photo_id).to be_nil
    end

    it "returns nil when data is nil" do
      notification = build(:notification, data: nil)
      expect(notification.photo_id).to be_nil
    end
  end

  describe "#actor_id" do
    it "returns liker_id for like notifications" do
      notification = build(:notification, :like, data: { "liker_id" => "user-123" })
      expect(notification.actor_id).to eq("user-123")
    end

    it "returns commenter_id for comment notifications" do
      notification = build(:notification, :comment, data: { "commenter_id" => "user-456" })
      expect(notification.actor_id).to eq("user-456")
    end

    it "returns nil when no actor data is present" do
      notification = build(:notification, data: {})
      expect(notification.actor_id).to be_nil
    end
  end

  describe "#social?" do
    it "returns true for like notifications" do
      notification = build(:notification, :like)
      expect(notification.social?).to be true
    end

    it "returns true for comment notifications" do
      notification = build(:notification, :comment)
      expect(notification.social?).to be true
    end

    it "returns false for system notifications" do
      notification = build(:notification, notification_type: :system)
      expect(notification.social?).to be false
    end

    it "returns false for rainbow_alert notifications" do
      notification = build(:notification, :rainbow_alert)
      expect(notification.social?).to be false
    end
  end

  describe ".mark_all_read_for_user" do
    let(:user) { create(:user) }
    let(:other_user) { create(:user) }

    before do
      create_list(:notification, 3, :unread, user: user)
      create(:notification, :read, user: user)
      create(:notification, :unread, user: other_user)
    end

    it "marks all unread notifications as read for the given user" do
      Notification.mark_all_read_for_user(user)
      expect(Notification.where(user: user).unread.count).to eq(0)
    end

    it "does not affect other users' notifications" do
      Notification.mark_all_read_for_user(user)
      expect(Notification.where(user: other_user).unread.count).to eq(1)
    end

    it "returns the number of updated records" do
      result = Notification.mark_all_read_for_user(user)
      expect(result).to eq(3)
    end
  end

  describe ".create_like_notification" do
    let(:photo_owner) { create(:user, display_name: "PhotoOwner") }
    let(:liker) { create(:user, display_name: "Liker") }
    let(:photo) { create(:photo, :without_image, user: photo_owner, title: "Beautiful Rainbow") }
    let(:like) { create(:like, user: liker, photo: photo) }

    it "creates a like notification for the recipient" do
      expect { Notification.create_like_notification(photo_owner, like) }
        .to change { Notification.count }.by(1)
    end

    it "sets the notification type to like" do
      notification = Notification.create_like_notification(photo_owner, like)
      expect(notification.notification_type).to eq("like")
    end

    it "includes the liker's display name in the title" do
      notification = Notification.create_like_notification(photo_owner, like)
      expect(notification.title).to include("Liker")
    end

    it "stores photo_id and liker_id in data" do
      notification = Notification.create_like_notification(photo_owner, like)
      expect(notification.data["photo_id"]).to eq(photo.id)
      expect(notification.data["liker_id"]).to eq(liker.id)
    end
  end

  describe ".create_comment_notification" do
    let(:photo_owner) { create(:user, display_name: "PhotoOwner") }
    let(:commenter) { create(:user, display_name: "Commenter") }
    let(:photo) { create(:photo, :without_image, user: photo_owner) }
    let(:comment) { create(:comment, user: commenter, photo: photo, content: "Great rainbow shot!") }

    it "creates a comment notification for the recipient" do
      expect { Notification.create_comment_notification(photo_owner, comment) }
        .to change { Notification.count }.by(1)
    end

    it "sets the notification type to comment" do
      notification = Notification.create_comment_notification(photo_owner, comment)
      expect(notification.notification_type).to eq("comment")
    end

    it "includes the commenter's display name in the title" do
      notification = Notification.create_comment_notification(photo_owner, comment)
      expect(notification.title).to include("Commenter")
    end

    it "stores photo_id and commenter_id in data" do
      notification = Notification.create_comment_notification(photo_owner, comment)
      expect(notification.data["photo_id"]).to eq(photo.id)
      expect(notification.data["commenter_id"]).to eq(commenter.id)
    end
  end
end
