# frozen_string_literal: true

require "rails_helper"

RSpec.describe SocialNotificationJob, type: :job do
  include ActiveJob::TestHelper

  let(:user) { create(:user) }
  let(:other_user) { create(:user) }
  let(:photo) { create(:photo, :without_image, user: user) }
  let(:notification_service) { instance_double(NotificationService) }

  before do
    allow(NotificationService).to receive(:new).and_return(notification_service)
  end

  describe "#perform" do
    context "with like notification" do
      before do
        allow(notification_service).to receive(:send_like_notification).and_return({ success: true })
      end

      it "sends like notification" do
        expect(notification_service).to receive(:send_like_notification)

        described_class.perform_now(
          notification_type: "like",
          liker_id: other_user.id,
          photo_id: photo.id
        )
      end

      context "when notification is skipped" do
        before do
          allow(notification_service).to receive(:send_like_notification).and_return({
            success: true,
            skipped: true,
            reason: "self_action"
          })
        end

        it "does not raise error" do
          expect {
            described_class.perform_now(
              notification_type: "like",
              liker_id: other_user.id,
              photo_id: photo.id
            )
          }.not_to raise_error
        end
      end

      context "when notification fails" do
        before do
          allow(notification_service).to receive(:send_like_notification).and_return({
            success: false,
            error: { message: "Failed to send" }
          })
        end

        it "does not raise error" do
          expect {
            described_class.perform_now(
              notification_type: "like",
              liker_id: other_user.id,
              photo_id: photo.id
            )
          }.not_to raise_error
        end
      end
    end

    context "with comment notification" do
      let(:comment) { create(:comment, user: other_user, photo: photo) }

      before do
        allow(notification_service).to receive(:send_comment_notification).and_return({ success: true })
      end

      it "sends comment notification" do
        expect(notification_service).to receive(:send_comment_notification)

        described_class.perform_now(
          notification_type: "comment",
          commenter_id: other_user.id,
          photo_id: photo.id,
          comment_id: comment.id
        )
      end

      context "when notification is skipped" do
        before do
          allow(notification_service).to receive(:send_comment_notification).and_return({
            success: true,
            skipped: true,
            reason: "disabled_by_user"
          })
        end

        it "does not raise error" do
          expect {
            described_class.perform_now(
              notification_type: "comment",
              commenter_id: other_user.id,
              photo_id: photo.id,
              comment_id: comment.id
            )
          }.not_to raise_error
        end
      end
    end

    context "with unknown notification type" do
      it "does not raise error" do
        expect {
          described_class.perform_now(
            notification_type: "unknown",
            photo_id: photo.id
          )
        }.not_to raise_error
      end
    end

    # Note: SocialNotificationJob uses discard_on ActiveRecord::RecordNotFound
    # So it won't raise errors when records are not found - it will silently discard the job
    context "when user not found" do
      it "silently discards for like (does not call notification service)" do
        expect(notification_service).not_to receive(:send_like_notification)

        # Job is discarded, no error raised
        expect {
          described_class.perform_now(
            notification_type: "like",
            liker_id: SecureRandom.uuid,
            photo_id: photo.id
          )
        }.not_to raise_error
      end

      it "silently discards for comment" do
        expect(notification_service).not_to receive(:send_comment_notification)

        expect {
          described_class.perform_now(
            notification_type: "comment",
            commenter_id: SecureRandom.uuid,
            photo_id: photo.id,
            comment_id: SecureRandom.uuid
          )
        }.not_to raise_error
      end
    end

    context "when photo not found" do
      it "silently discards (does not call notification service)" do
        expect(notification_service).not_to receive(:send_like_notification)

        expect {
          described_class.perform_now(
            notification_type: "like",
            liker_id: other_user.id,
            photo_id: SecureRandom.uuid
          )
        }.not_to raise_error
      end
    end

    context "when comment not found" do
      it "silently discards (does not call notification service)" do
        expect(notification_service).not_to receive(:send_comment_notification)

        expect {
          described_class.perform_now(
            notification_type: "comment",
            commenter_id: other_user.id,
            photo_id: photo.id,
            comment_id: SecureRandom.uuid
          )
        }.not_to raise_error
      end
    end
  end

  describe "queue configuration" do
    it "uses the notifications queue" do
      expect(described_class.queue_name).to eq("notifications")
    end
  end

  describe "retry configuration" do
    it "inherits from ApplicationJob" do
      expect(described_class.superclass).to eq(ApplicationJob)
    end
  end
end
