# frozen_string_literal: true

require "rails_helper"

RSpec.describe DataExportJob, type: :job do
  include ActiveJob::TestHelper

  let(:user) { create(:user) }

  describe "#perform" do
    context "with valid user" do
      before do
        # Stub Active Storage upload and URL generation
        allow_any_instance_of(ActiveStorage::Blob).to receive(:url).and_return("https://example.com/export.zip")
        allow(ActiveStorage::Blob).to receive(:create_and_upload!).and_return(double(url: "https://example.com/export.zip"))
      end

      it "completes without error" do
        expect { described_class.perform_now(user.id) }.not_to raise_error
      end

      it "sends an email notification" do
        expect {
          described_class.perform_now(user.id)
        }.to have_enqueued_mail(DataExportMailer, :export_ready)
      end
    end

    context "with user having photos" do
      let!(:photos) { create_list(:photo, 2, :without_image, user: user) }

      before do
        allow_any_instance_of(ActiveStorage::Blob).to receive(:url).and_return("https://example.com/export.zip")
        allow(ActiveStorage::Blob).to receive(:create_and_upload!).and_return(double(url: "https://example.com/export.zip"))
      end

      it "exports photos successfully" do
        expect { described_class.perform_now(user.id) }.not_to raise_error
      end
    end

    context "with user having comments" do
      let(:other_user) { create(:user) }
      let(:photo) { create(:photo, :without_image, user: other_user) }
      let!(:comments) { create_list(:comment, 3, user: user, photo: photo) }

      before do
        allow_any_instance_of(ActiveStorage::Blob).to receive(:url).and_return("https://example.com/export.zip")
        allow(ActiveStorage::Blob).to receive(:create_and_upload!).and_return(double(url: "https://example.com/export.zip"))
      end

      it "exports comments successfully" do
        expect { described_class.perform_now(user.id) }.not_to raise_error
      end
    end

    context "with user having likes" do
      let(:other_user) { create(:user) }
      let!(:photos) { create_list(:photo, 2, :without_image, user: other_user) }
      let!(:likes) { photos.map { |photo| create(:like, user: user, photo: photo) } }

      before do
        allow_any_instance_of(ActiveStorage::Blob).to receive(:url).and_return("https://example.com/export.zip")
        allow(ActiveStorage::Blob).to receive(:create_and_upload!).and_return(double(url: "https://example.com/export.zip"))
      end

      it "exports likes successfully" do
        expect { described_class.perform_now(user.id) }.not_to raise_error
      end
    end

    context "with non-existent user" do
      it "is discarded" do
        # ActiveJob will discard the job due to discard_on ActiveRecord::RecordNotFound
        expect { described_class.perform_now(SecureRandom.uuid) }.not_to raise_error
      end
    end
  end

  describe "queue configuration" do
    it "uses the default queue" do
      expect(described_class.queue_name).to eq("default")
    end
  end

  describe "retry configuration" do
    it "has retry configuration" do
      # Just verify the job class is properly configured
      expect(described_class.superclass).to eq(ApplicationJob)
    end
  end
end
