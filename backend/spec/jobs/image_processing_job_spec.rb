# frozen_string_literal: true

require "rails_helper"

RSpec.describe ImageProcessingJob, type: :job do
  include ActiveJob::TestHelper

  let(:user) { create(:user) }
  let(:photo) { create(:photo, :without_image, user: user) }
  let(:moderation_service) { instance_double(ImageModerationService) }

  before do
    allow(ImageModerationService).to receive(:new).and_return(moderation_service)
  end

  describe "queue configuration" do
    it "uses the default queue" do
      expect(described_class.queue_name).to eq("default")
    end
  end

  describe "retry configuration" do
    it "inherits from ApplicationJob" do
      expect(described_class.superclass).to eq(ApplicationJob)
    end
  end

  describe "#perform" do
    context "when photo is not found" do
      it "discards the job without raising" do
        expect {
          described_class.perform_now(SecureRandom.uuid)
        }.not_to raise_error
      end
    end

    context "when photo has no image attached" do
      it "returns early without running moderation" do
        expect(moderation_service).not_to receive(:moderate)

        described_class.perform_now(photo.id)
      end
    end

    context "when moderation rejects the photo" do
      let(:photo_with_image) { create(:photo, user: user) }
      let(:rejection_result) do
        {
          approved: false,
          action: :rejected,
          reasons: ["Suspicious filename detected"],
          confidence: 0.95,
          categories: { "suspicious_filename" => 0.95 }
        }
      end

      before do
        # Skip if test image fixture doesn't exist
        skip "Test image fixture not available" unless photo_with_image.image.attached?
        allow(moderation_service).to receive(:moderate).and_return(rejection_result)
      end

      it "updates photo moderation_status to rejected" do
        described_class.perform_now(photo_with_image.id)

        photo_with_image.reload
        expect(photo_with_image.moderation_status).to eq("rejected")
      end

      it "sets photo is_visible to false" do
        described_class.perform_now(photo_with_image.id)

        photo_with_image.reload
        expect(photo_with_image.is_visible).to be false
      end

      it "does not proceed with EXIF extraction or variant generation" do
        expect(photo_with_image.image.blob).not_to receive(:open)

        described_class.perform_now(photo_with_image.id)
      end
    end

    context "when moderation flags the photo" do
      let(:photo_with_image) { create(:photo, user: user) }
      let(:flagged_result) do
        {
          approved: true,
          action: :flagged,
          reasons: ["Unusual image dimensions"],
          confidence: 0.5,
          categories: { "unusual_dimensions" => 0.5 }
        }
      end

      before do
        skip "Test image fixture not available" unless photo_with_image.image.attached?
        allow(moderation_service).to receive(:moderate).and_return(flagged_result)
        # Allow the blob.open to proceed without Vips processing
        allow(photo_with_image.image.blob).to receive(:open).and_yield(
          Tempfile.new(["test", ".jpg"])
        )
        allow_any_instance_of(described_class).to receive(:extract_exif_data).and_return({})
        allow_any_instance_of(described_class).to receive(:generate_variants)
      end

      it "updates photo moderation_status to flagged" do
        described_class.perform_now(photo_with_image.id)

        photo_with_image.reload
        expect(photo_with_image.moderation_status).to eq("flagged")
      end
    end

    context "when moderation approves the photo" do
      let(:photo_with_image) { create(:photo, user: user) }
      let(:approved_result) do
        {
          approved: true,
          action: :approved,
          reasons: [],
          confidence: 0.0,
          categories: {}
        }
      end

      before do
        skip "Test image fixture not available" unless photo_with_image.image.attached?
        allow(moderation_service).to receive(:moderate).and_return(approved_result)
        allow(photo_with_image.image.blob).to receive(:open).and_yield(
          Tempfile.new(["test", ".jpg"])
        )
        allow_any_instance_of(described_class).to receive(:extract_exif_data).and_return(
          { width: 1920, height: 1080 }
        )
        allow_any_instance_of(described_class).to receive(:generate_variants)
      end

      it "proceeds with EXIF extraction and variant generation" do
        expect_any_instance_of(described_class).to receive(:extract_exif_data)
        expect_any_instance_of(described_class).to receive(:generate_variants)

        described_class.perform_now(photo_with_image.id)
      end
    end

    context "when moderation service raises an error" do
      let(:photo_with_image) { create(:photo, user: user) }

      before do
        skip "Test image fixture not available" unless photo_with_image.image.attached?
        allow(moderation_service).to receive(:moderate).and_raise(StandardError, "Service unavailable")
      end

      it "raises the error for retry" do
        expect {
          described_class.perform_now(photo_with_image.id)
        }.to raise_error(StandardError, "Service unavailable")
      end
    end
  end
end
