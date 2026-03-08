# frozen_string_literal: true

require "rails_helper"

RSpec.describe ScheduledNotificationJob, type: :job do
  include ActiveJob::TestHelper

  let(:user) { create(:user) }
  let(:notification_service) { instance_double(NotificationService) }

  before do
    allow(NotificationService).to receive(:new).and_return(notification_service)
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

  describe "#perform" do
    let(:job_params) do
      {
        user_id: user.id,
        title: "Rainbow Reminder",
        body: "Check the sky for rainbows!",
        notification_type: "system",
        data: { key: "value" }.to_json
      }
    end

    context "with valid user" do
      before do
        allow(notification_service).to receive(:send_push_notification).and_return({ success: true })
      end

      it "calls NotificationService#send_push_notification" do
        expect(notification_service).to receive(:send_push_notification).with(
          user: user,
          title: "Rainbow Reminder",
          body: "Check the sky for rainbows!",
          notification_type: :system,
          data: { "key" => "value" }
        )

        described_class.perform_now(**job_params)
      end
    end

    context "when user is not found" do
      it "discards the job without raising" do
        expect {
          described_class.perform_now(
            user_id: SecureRandom.uuid,
            title: "Test",
            body: "Test",
            notification_type: "system",
            data: "{}".to_json
          )
        }.not_to raise_error
      end
    end

    context "when user is deleted (soft delete)" do
      let(:deleted_user) { create(:user, :deleted) }

      it "skips sending notification" do
        expect(notification_service).not_to receive(:send_push_notification)

        described_class.perform_now(
          user_id: deleted_user.id,
          title: "Test",
          body: "Test",
          notification_type: "system",
          data: "{}"
        )
      end
    end

    context "when NotificationService returns failure" do
      before do
        allow(notification_service).to receive(:send_push_notification).and_return(
          { success: false, error: { message: "Device token expired" } }
        )
      end

      it "does not raise error" do
        expect {
          described_class.perform_now(**job_params)
        }.not_to raise_error
      end

      it "logs warning" do
        expect(Rails.logger).to receive(:warn).with(/Failed to send notification/)

        described_class.perform_now(**job_params)
      end
    end

    context "when data is invalid JSON" do
      it "falls back to empty hash" do
        allow(notification_service).to receive(:send_push_notification).and_return({ success: true })

        expect(notification_service).to receive(:send_push_notification).with(
          hash_including(data: {})
        )

        described_class.perform_now(
          user_id: user.id,
          title: "Test",
          body: "Test",
          notification_type: "system",
          data: "invalid json{{"
        )
      end
    end
  end
end
