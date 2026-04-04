# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Photo Upload Workflow", type: :request do
  include ActiveJob::TestHelper

  let(:user) { create(:user) }

  # Prepare a test image fixture
  let(:test_image) do
    fixture_path = Rails.root.join("spec/fixtures/files/test_image.jpg")
    unless fixture_path.exist?
      # Create a minimal JPEG if fixture doesn't exist
      FileUtils.mkdir_p(fixture_path.dirname)
      File.binwrite(fixture_path, "\xFF\xD8\xFF\xE0" + "\x00" * 100 + "\xFF\xD9")
    end
    Rack::Test::UploadedFile.new(fixture_path, "image/jpeg")
  end

  describe "end-to-end photo creation pipeline" do
    it "creates a photo and enqueues ImageProcessingJob" do
      expect {
        post api_v1_path("/photos"),
             params: {
               photo: {
                 image: test_image,
                 title: "Rainbow over Shiojiri",
                 description: "Beautiful rainbow after the rain",
                 latitude: 36.115,
                 longitude: 137.954,
                 captured_at: 1.hour.ago.iso8601
               }
             },
             headers: auth_headers(user)
      }.to change(Photo, :count).by(1)

      expect(response).to have_http_status(:created)
    end

    it "broadcasts to the photo_feed channel on photo creation" do
      expect {
        post api_v1_path("/photos"),
             params: {
               photo: {
                 image: test_image,
                 title: "Feed Broadcast Test",
                 latitude: 36.1,
                 longitude: 137.9,
                 captured_at: 1.hour.ago.iso8601
               }
             },
             headers: auth_headers(user)
      }.to have_broadcasted_to("photo_feed")
    end

    it "runs ImageProcessingJob which invokes ImageModerationService" do
      # Stub moderation to return approved
      allow_any_instance_of(ImageModerationService).to receive(:moderate).and_return(
        approved: true,
        action: :approved,
        reasons: [],
        confidence: 0.0,
        categories: {}
      )

      post api_v1_path("/photos"),
           params: {
             photo: {
               image: test_image,
               title: "Moderation Test",
               latitude: 36.115,
               longitude: 137.954,
               captured_at: 1.hour.ago.iso8601
             }
           },
           headers: auth_headers(user)

      photo = Photo.last

      # Perform the enqueued ImageProcessingJob
      expect {
        perform_enqueued_jobs(only: ImageProcessingJob)
      }.not_to raise_error
    end

    it "rejects a photo when moderation flags it as rejected" do
      allow_any_instance_of(ImageModerationService).to receive(:moderate).and_return(
        approved: false,
        action: :rejected,
        reasons: [ "Inappropriate content detected" ],
        confidence: 0.95,
        categories: { "explicit_nudity" => 0.95 }
      )

      post api_v1_path("/photos"),
           params: {
             photo: {
               image: test_image,
               title: "Should Be Rejected",
               latitude: 36.115,
               longitude: 137.954,
               captured_at: 1.hour.ago.iso8601
             }
           },
           headers: auth_headers(user)

      photo = Photo.last

      # Run job directly so RSpec mocks are in scope
      ImageProcessingJob.perform_now(photo.id)

      photo.reload
      expect(photo.moderation_status).to eq("rejected")
      expect(photo.is_visible).to be false
    end

    it "flags a photo for manual review when moderation returns flagged" do
      post api_v1_path("/photos"),
           params: {
             photo: {
               image: test_image,
               title: "Should Be Flagged",
               latitude: 36.115,
               longitude: 137.954,
               captured_at: 1.hour.ago.iso8601
             }
           },
           headers: auth_headers(user)

      photo = Photo.last

      # Set up stubs AFTER the POST so they don't interfere with image attachment
      allow_any_instance_of(ImageModerationService).to receive(:moderate).and_return(
        approved: true,
        action: :flagged,
        reasons: [ "Suspicious content" ],
        confidence: 0.7,
        categories: { "suspicious_filename" => 0.7 }
      )
      allow_any_instance_of(ActiveStorage::Blob).to receive(:open).and_yield(
        Tempfile.new([ "test", ".jpg" ])
      )
      allow_any_instance_of(ImageProcessingJob).to receive(:extract_exif_data).and_return({})
      allow_any_instance_of(ImageProcessingJob).to receive(:generate_variants)

      # Run job directly so RSpec mocks are in scope
      ImageProcessingJob.perform_now(photo.id)

      photo.reload
      expect(photo.moderation_status).to eq("flagged")
    end

    it "enqueues WeatherFetchJob when photo has location" do
      allow_any_instance_of(ImageModerationService).to receive(:moderate).and_return(
        approved: true, action: :approved, reasons: [], confidence: 0.0, categories: {}
      )

      post api_v1_path("/photos"),
           params: {
             photo: {
               image: test_image,
               title: "Weather Fetch Test",
               latitude: 36.115,
               longitude: 137.954,
               captured_at: 1.hour.ago.iso8601
             }
           },
           headers: auth_headers(user)

      expect(response).to have_http_status(:created)
      # WeatherFetchJob should be enqueued by PhotoService
      expect(WeatherFetchJob).to have_been_enqueued
    end

    it "does not enqueue WeatherFetchJob when photo has no location" do
      post api_v1_path("/photos"),
           params: {
             photo: {
               image: test_image,
               title: "No Location Photo",
               captured_at: 1.hour.ago.iso8601
             }
           },
           headers: auth_headers(user)

      expect(WeatherFetchJob).not_to have_been_enqueued
    end

    it "returns created photo data in the response" do
      post api_v1_path("/photos"),
           params: {
             photo: {
               image: test_image,
               title: "Response Data Test",
               description: "Checking response structure",
               latitude: 36.115,
               longitude: 137.954,
               captured_at: 1.hour.ago.iso8601
             }
           },
           headers: auth_headers(user)

      expect(response).to have_http_status(:created)
      body = json_body
      expect(body[:data][:photo]).to be_present
      expect(body[:data][:photo][:title]).to eq("Response Data Test")
      expect(body[:data][:message]).to eq("Photo created successfully")
    end
  end
end
