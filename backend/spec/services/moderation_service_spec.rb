# frozen_string_literal: true

require "rails_helper"

RSpec.describe ModerationService do
  let(:notification_service) { instance_double(NotificationService) }
  let(:service) { described_class.new(notification_service: notification_service) }

  let(:admin) { create(:user, :admin) }
  let(:content_owner) { create(:user, violation_count: 0, violation_flagged: false) }
  let(:reporter) { create(:user) }

  let(:photo) do
    create(:photo, :without_image, user: content_owner, moderation_status: :approved, is_visible: true)
  end

  let(:comment) do
    photo_for_comment = create(:photo, :without_image, user: create(:user))
    create(:comment, user: content_owner, photo: photo_for_comment, is_visible: true)
  end

  let(:photo_report) do
    Report.create!(reporter: reporter, reportable: photo, reason: "Inappropriate content", status: :pending)
  end

  let(:comment_report) do
    Report.create!(reporter: reporter, reportable: comment, reason: "Spam", status: :pending)
  end

  before do
    allow(notification_service).to receive(:send_push_notification).and_return({ success: true })
  end

  describe "#hide_content" do
    context "when hiding a photo" do
      it "returns success and hides the photo" do
        result = service.hide_content(report: photo_report, admin: admin)

        expect(result[:success]).to be true
        expect(result[:action]).to eq :hidden
        expect(photo.reload.moderation_status).to eq "hidden"
        expect(photo.reload.is_visible).to be false
      end

      it "resolves the report" do
        service.hide_content(report: photo_report, admin: admin)

        expect(photo_report.reload.status).to eq "resolved"
        expect(photo_report.reload.resolved_by).to eq admin
      end

      it "increments violation count for content owner" do
        expect {
          service.hide_content(report: photo_report, admin: admin)
        }.to change { content_owner.reload.violation_count }.by(1)
      end

      it "sends notification to content owner" do
        expect(notification_service).to receive(:send_push_notification).with(
          hash_including(user: content_owner, notification_type: :system)
        )

        service.hide_content(report: photo_report, admin: admin)
      end

      it "includes admin note when provided" do
        service.hide_content(report: photo_report, admin: admin, note: "Test note")

        expect(photo_report.reload.admin_note).to eq "Test note"
      end
    end

    context "when hiding a comment" do
      it "returns success and hides the comment" do
        result = service.hide_content(report: comment_report, admin: admin)

        expect(result[:success]).to be true
        expect(result[:action]).to eq :hidden
        expect(comment.reload.is_visible).to be false
      end
    end

    context "when user reaches violation threshold" do
      before do
        content_owner.update!(violation_count: 2)
      end

      it "flags the user when reaching 3 violations" do
        result = service.hide_content(report: photo_report, admin: admin)

        expect(result[:user_flagged]).to be true
        expect(content_owner.reload.violation_flagged).to be true
      end
    end

    context "with validation errors" do
      it "returns error when report is nil" do
        result = service.hide_content(report: nil, admin: admin)

        expect(result[:success]).to be false
      end

      it "returns error when admin is nil" do
        result = service.hide_content(report: photo_report, admin: nil)

        expect(result[:success]).to be false
      end

      it "returns error when report is already processed" do
        photo_report.resolve!(admin)

        result = service.hide_content(report: photo_report, admin: admin)

        expect(result[:success]).to be false
      end
    end
  end

  describe "#delete_content" do
    context "when deleting a photo" do
      it "returns success and deletes the photo" do
        result = service.delete_content(report: photo_report, admin: admin)

        expect(result[:success]).to be true
        expect(result[:action]).to eq :deleted
        expect(photo.reload.moderation_status).to eq "deleted"
        expect(photo.reload.is_visible).to be false
      end

      it "resolves the report" do
        service.delete_content(report: photo_report, admin: admin)

        expect(photo_report.reload.status).to eq "resolved"
        expect(photo_report.reload.resolved_by).to eq admin
      end

      it "sends deletion notification to content owner" do
        expect(notification_service).to receive(:send_push_notification).with(
          hash_including(user: content_owner, notification_type: :system)
        )

        service.delete_content(report: photo_report, admin: admin)
      end
    end

    context "when user reaches violation threshold" do
      before do
        content_owner.update!(violation_count: 2)
      end

      it "flags the user" do
        result = service.delete_content(report: photo_report, admin: admin)

        expect(result[:user_flagged]).to be true
        expect(content_owner.reload.violation_flagged).to be true
      end
    end

    context "with validation errors" do
      it "returns error when report is nil" do
        result = service.delete_content(report: nil, admin: admin)

        expect(result[:success]).to be false
      end

      it "returns error when admin is nil" do
        result = service.delete_content(report: photo_report, admin: nil)

        expect(result[:success]).to be false
      end

      it "returns error when report is already processed" do
        photo_report.dismiss!(admin)

        result = service.delete_content(report: photo_report, admin: admin)

        expect(result[:success]).to be false
      end
    end
  end

  describe "#approve_report" do
    it "returns success and dismisses the report" do
      result = service.approve_report(report: photo_report, admin: admin)

      expect(result[:success]).to be true
      expect(result[:action]).to eq :approved
      expect(photo_report.reload.status).to eq "dismissed"
    end

    it "does not modify the reported content" do
      service.approve_report(report: photo_report, admin: admin)

      expect(photo.reload.moderation_status).to eq "approved"
      expect(photo.reload.is_visible).to be true
    end

    it "does not increment violation count" do
      expect {
        service.approve_report(report: photo_report, admin: admin)
      }.not_to change { content_owner.reload.violation_count }
    end

    it "does not send notification to content owner" do
      expect(notification_service).not_to receive(:send_push_notification)

      service.approve_report(report: photo_report, admin: admin)
    end

    it "includes admin note when provided" do
      service.approve_report(report: photo_report, admin: admin, note: "Content is appropriate")

      expect(photo_report.reload.admin_note).to eq "Content is appropriate"
    end

    context "with validation errors" do
      it "returns error when report is nil" do
        result = service.approve_report(report: nil, admin: admin)

        expect(result[:success]).to be false
      end

      it "returns error when admin is nil" do
        result = service.approve_report(report: photo_report, admin: nil)

        expect(result[:success]).to be false
      end

      it "returns error when report is already processed" do
        photo_report.resolve!(admin)

        result = service.approve_report(report: photo_report, admin: admin)

        expect(result[:success]).to be false
      end
    end
  end

  describe "#count_user_violations" do
    it "returns 0 when user is nil" do
      expect(service.count_user_violations(nil)).to eq 0
    end

    it "counts violations from photos" do
      resolved_photo_report = Report.create!(
        reporter: reporter,
        reportable: photo,
        reason: "Test",
        status: :resolved
      )

      count = service.count_user_violations(content_owner)
      expect(count).to be >= 1
    end
  end

  describe "notification failure handling" do
    it "does not fail the operation when notification fails" do
      allow(notification_service).to receive(:send_push_notification).and_raise(StandardError.new("Network error"))

      result = service.hide_content(report: photo_report, admin: admin)

      expect(result[:success]).to be true
      expect(photo.reload.is_visible).to be false
    end
  end

  describe "logging" do
    it "logs when content is hidden" do
      expect(Rails.logger).to receive(:info).at_least(:once)

      service.hide_content(report: photo_report, admin: admin)
    end

    it "logs when content is deleted" do
      expect(Rails.logger).to receive(:info).at_least(:once)

      service.delete_content(report: photo_report, admin: admin)
    end

    it "logs when report is approved" do
      expect(Rails.logger).to receive(:info).at_least(:once)

      service.approve_report(report: photo_report, admin: admin)
    end
  end
end
