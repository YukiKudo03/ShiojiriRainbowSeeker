# frozen_string_literal: true

require "rails_helper"

RSpec.describe ImageModerationService do
  let(:service) { described_class.new }

  describe "constants" do
    it "defines AUTO_REJECT_THRESHOLD at 0.90" do
      expect(described_class::AUTO_REJECT_THRESHOLD).to eq(0.90)
    end

    it "defines FLAG_THRESHOLD at 0.60" do
      expect(described_class::FLAG_THRESHOLD).to eq(0.60)
    end

    it "defines MAX_FILE_SIZE as 20 megabytes" do
      expect(described_class::MAX_FILE_SIZE).to eq(20.megabytes)
    end

    it "defines ALLOWED_CONTENT_TYPES including common image formats" do
      expected = %w[image/jpeg image/png image/webp image/heic image/heif]
      expect(described_class::ALLOWED_CONTENT_TYPES).to match_array(expected)
    end

    it "defines MODERATION_CATEGORIES" do
      expected = %w[explicit_nudity violence visually_disturbing drugs hate_symbols]
      expect(described_class::MODERATION_CATEGORIES).to match_array(expected)
    end
  end

  describe "#moderate" do
    context "when photo is nil" do
      it "returns rejected result" do
        result = service.moderate(nil)

        expect(result[:approved]).to be false
        expect(result[:action]).to eq(:rejected)
        expect(result[:reasons]).to include("Photo is required")
        expect(result[:confidence]).to eq(1.0)
      end
    end

    context "when photo has no image attached" do
      let(:photo) { build(:photo, :without_image) }

      before do
        allow(photo).to receive_message_chain(:image, :attached?).and_return(false)
      end

      it "returns rejected result" do
        result = service.moderate(photo)

        expect(result[:approved]).to be false
        expect(result[:action]).to eq(:rejected)
        expect(result[:reasons]).to include("Photo has no image attached")
      end
    end

    context "when file size exceeds MAX_FILE_SIZE" do
      let(:photo) { instance_double("Photo") }
      let(:blob) { instance_double("ActiveStorage::Blob", byte_size: 25.megabytes, content_type: "image/jpeg") }
      let(:image) { double("ActiveStorage::Attached::One") }

      before do
        allow(photo).to receive(:image).and_return(image)
        allow(image).to receive(:attached?).and_return(true)
        allow(image).to receive(:blob).and_return(blob)
      end

      it "returns rejected result with file size reason" do
        result = service.moderate(photo)

        expect(result[:approved]).to be false
        expect(result[:action]).to eq(:rejected)
        expect(result[:reasons].first).to include("File size exceeds")
      end
    end

    context "when content type is invalid" do
      let(:photo) { instance_double("Photo") }
      let(:blob) { instance_double("ActiveStorage::Blob", byte_size: 1.megabyte, content_type: "application/pdf") }
      let(:image) { double("ActiveStorage::Attached::One") }

      before do
        allow(photo).to receive(:image).and_return(image)
        allow(image).to receive(:attached?).and_return(true)
        allow(image).to receive(:blob).and_return(blob)
      end

      it "returns rejected result with invalid content type reason" do
        result = service.moderate(photo)

        expect(result[:approved]).to be false
        expect(result[:action]).to eq(:rejected)
        expect(result[:reasons].first).to include("Invalid content type")
      end
    end

    context "when both file size and content type are invalid" do
      let(:photo) { instance_double("Photo") }
      let(:blob) { instance_double("ActiveStorage::Blob", byte_size: 25.megabytes, content_type: "video/mp4") }
      let(:image) { double("ActiveStorage::Attached::One") }

      before do
        allow(photo).to receive(:image).and_return(image)
        allow(image).to receive(:attached?).and_return(true)
        allow(image).to receive(:blob).and_return(blob)
      end

      it "returns rejected result with multiple reasons" do
        result = service.moderate(photo)

        expect(result[:approved]).to be false
        expect(result[:action]).to eq(:rejected)
        expect(result[:reasons].length).to eq(2)
      end
    end

    context "when filename contains suspicious patterns" do
      %w[nsfw adult xxx explicit].each do |keyword|
        it "flags file with '#{keyword}' in filename at 0.8 confidence" do
          photo = instance_double("Photo", id: "test-id")
          filename = ActiveStorage::Filename.new("#{keyword}_photo.jpg")
          blob = instance_double("ActiveStorage::Blob",
            byte_size: 1.megabyte,
            content_type: "image/jpeg",
            filename: filename,
            metadata: {})
          image = double("ActiveStorage::Attached::One")

          allow(photo).to receive(:image).and_return(image)
          allow(image).to receive(:attached?).and_return(true)
          allow(image).to receive(:blob).and_return(blob)

          result = service.moderate(photo)

          expect(result[:approved]).to be true
          expect(result[:action]).to eq(:flagged)
          expect(result[:confidence]).to eq(0.8)
          expect(result[:categories]).to have_key("suspicious_filename")
          expect(result[:reasons]).to include("Suspicious filename detected")
        end
      end
    end

    context "when image has unusual dimensions" do
      it "flags image with aspect ratio > 10" do
        photo = instance_double("Photo", id: "test-id")
        filename = ActiveStorage::Filename.new("normal_photo.jpg")
        blob = instance_double("ActiveStorage::Blob",
          byte_size: 1.megabyte,
          content_type: "image/jpeg",
          filename: filename,
          metadata: { width: 10000, height: 100 })
        image = double("ActiveStorage::Attached::One")

        allow(photo).to receive(:image).and_return(image)
        allow(image).to receive(:attached?).and_return(true)
        allow(image).to receive(:blob).and_return(blob)

        result = service.moderate(photo)

        expect(result[:approved]).to be true
        expect(result[:action]).to eq(:flagged)
        expect(result[:confidence]).to eq(0.7)
        expect(result[:categories]).to have_key("unusual_dimensions")
      end

      it "flags image with aspect ratio < 0.1" do
        photo = instance_double("Photo", id: "test-id")
        filename = ActiveStorage::Filename.new("normal_photo.jpg")
        blob = instance_double("ActiveStorage::Blob",
          byte_size: 1.megabyte,
          content_type: "image/jpeg",
          filename: filename,
          metadata: { width: 100, height: 10000 })
        image = double("ActiveStorage::Attached::One")

        allow(photo).to receive(:image).and_return(image)
        allow(image).to receive(:attached?).and_return(true)
        allow(image).to receive(:blob).and_return(blob)

        result = service.moderate(photo)

        expect(result[:approved]).to be true
        expect(result[:action]).to eq(:flagged)
        expect(result[:reasons]).to include("Unusual image dimensions")
      end
    end

    context "when image is normal" do
      let(:photo) { instance_double("Photo", id: "test-id") }
      let(:filename) { ActiveStorage::Filename.new("rainbow_photo.jpg") }
      let(:blob) do
        instance_double("ActiveStorage::Blob",
          byte_size: 2.megabytes,
          content_type: "image/jpeg",
          filename: filename,
          metadata: { width: 1920, height: 1080 })
      end
      let(:image) { double("ActiveStorage::Attached::One") }

      before do
        allow(photo).to receive(:image).and_return(image)
        allow(image).to receive(:attached?).and_return(true)
        allow(image).to receive(:blob).and_return(blob)
      end

      it "returns approved result" do
        result = service.moderate(photo)

        expect(result[:approved]).to be true
        expect(result[:action]).to eq(:approved)
        expect(result[:reasons]).to be_empty
        expect(result[:confidence]).to eq(0.0)
      end
    end

    context "when an error occurs during moderation" do
      let(:photo) { instance_double("Photo", id: "test-id") }
      let(:image) { double("ActiveStorage::Attached::One") }

      before do
        allow(photo).to receive(:image).and_return(image)
        allow(image).to receive(:attached?).and_return(true)
        allow(image).to receive(:blob).and_raise(StandardError, "Unexpected error")
      end

      it "returns approved with flagged action" do
        result = service.moderate(photo)

        expect(result[:approved]).to be true
        expect(result[:action]).to eq(:flagged)
        expect(result[:reasons]).to include("Moderation check failed - flagged for manual review")
        expect(result[:confidence]).to eq(0.0)
        expect(result[:error]).to eq("Unexpected error")
      end
    end
  end

  describe "#moderate_batch" do
    it "returns an array of results for multiple photos" do
      photo1 = instance_double("Photo", id: "photo-1")
      photo2 = instance_double("Photo", id: "photo-2")

      allow(service).to receive(:moderate).with(photo1).and_return({
        approved: true, action: :approved, reasons: [], confidence: 0.0, categories: {}
      })
      allow(service).to receive(:moderate).with(photo2).and_return({
        approved: false, action: :rejected, reasons: [ "Photo is required" ], confidence: 1.0, categories: {}
      })

      results = service.moderate_batch([ photo1, photo2 ])

      expect(results.length).to eq(2)
      expect(results[0][:photo_id]).to eq("photo-1")
      expect(results[0][:result][:approved]).to be true
      expect(results[1][:photo_id]).to eq("photo-2")
      expect(results[1][:result][:approved]).to be false
    end

    it "returns empty array for empty input" do
      results = service.moderate_batch([])

      expect(results).to eq([])
    end
  end

  describe "#detect_backend" do
    context "when no external API env vars are set" do
      before do
        allow(ENV).to receive(:[]).and_call_original
        allow(ENV).to receive(:[]).with("AWS_REKOGNITION_ENABLED").and_return(nil)
        allow(ENV).to receive(:[]).with("GOOGLE_VISION_ENABLED").and_return(nil)
      end

      it "returns :basic" do
        new_service = described_class.new
        backend = new_service.send(:detect_backend)

        expect(backend).to eq(:basic)
      end
    end
  end
end
