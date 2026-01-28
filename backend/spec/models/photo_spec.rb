# frozen_string_literal: true

require "rails_helper"

RSpec.describe Photo, type: :model do
  subject(:photo) { build(:photo, :without_image) }

  describe "associations" do
    it { is_expected.to belong_to(:user) }
    it { is_expected.to have_many(:weather_conditions).dependent(:destroy) }
    it { is_expected.to have_many(:radar_data).dependent(:destroy) }
    it { is_expected.to have_many(:comments).dependent(:destroy) }
    it { is_expected.to have_many(:likes).dependent(:destroy) }
    it { is_expected.to have_many(:reports).dependent(:destroy) }
  end

  describe "validations" do
    it { is_expected.to validate_length_of(:title).is_at_most(100) }
    it { is_expected.to validate_length_of(:description).is_at_most(500) }
    it { is_expected.to validate_presence_of(:captured_at) }
  end

  describe "enums" do
    it { is_expected.to define_enum_for(:moderation_status).with_values(pending: 0, approved: 1, hidden: 2, deleted: 3) }
  end

  describe "constants" do
    it "has MAX_IMAGE_SIZE of 10 megabytes" do
      expect(Photo::MAX_IMAGE_SIZE).to eq(10.megabytes)
    end

    it "has allowed content types" do
      expect(Photo::ALLOWED_CONTENT_TYPES).to include("image/jpeg", "image/png", "image/gif", "image/webp")
    end

    it "has variant configurations" do
      expect(Photo::VARIANTS).to have_key(:thumbnail)
      expect(Photo::VARIANTS).to have_key(:medium)
      expect(Photo::VARIANTS).to have_key(:large)
    end
  end

  describe "scopes" do
    describe ".visible" do
      let!(:visible_photo) { create(:photo, :without_image, is_visible: true, moderation_status: :approved) }
      let!(:hidden_photo) { create(:photo, :without_image, is_visible: false, moderation_status: :approved) }
      let!(:pending_photo) { create(:photo, :without_image, is_visible: true, moderation_status: :pending) }

      it "returns only visible and approved photos" do
        expect(Photo.visible).to include(visible_photo)
        expect(Photo.visible).not_to include(hidden_photo, pending_photo)
      end
    end

    describe ".recent" do
      let!(:older_photo) { create(:photo, :without_image, captured_at: 2.days.ago) }
      let!(:newer_photo) { create(:photo, :without_image, captured_at: 1.day.ago) }

      it "orders by captured_at descending" do
        expect(Photo.recent.first).to eq(newer_photo)
        expect(Photo.recent.last).to eq(older_photo)
      end
    end

    describe ".by_user" do
      let(:user) { create(:user) }
      let!(:user_photo) { create(:photo, :without_image, user: user) }
      let!(:other_photo) { create(:photo, :without_image) }

      it "returns only photos by the specified user" do
        expect(Photo.by_user(user)).to include(user_photo)
        expect(Photo.by_user(user)).not_to include(other_photo)
      end
    end

    describe ".moderation_pending" do
      let!(:pending_photo) { create(:photo, :without_image, moderation_status: :pending) }
      let!(:approved_photo) { create(:photo, :without_image, moderation_status: :approved) }

      it "returns only pending photos" do
        expect(Photo.moderation_pending).to include(pending_photo)
        expect(Photo.moderation_pending).not_to include(approved_photo)
      end
    end
  end

  describe "location methods" do
    let(:lat) { 36.115 }
    let(:lng) { 137.954 }

    describe "#set_location" do
      it "sets the location from lat/lng coordinates" do
        photo.set_location(lat, lng)
        expect(photo.location).to be_present
      end
    end

    describe "#latitude" do
      it "returns the latitude from the location" do
        photo.set_location(lat, lng)
        expect(photo.latitude).to be_within(0.001).of(lat)
      end

      it "returns nil when location is not set" do
        photo.location = nil
        expect(photo.latitude).to be_nil
      end
    end

    describe "#longitude" do
      it "returns the longitude from the location" do
        photo.set_location(lat, lng)
        expect(photo.longitude).to be_within(0.001).of(lng)
      end

      it "returns nil when location is not set" do
        photo.location = nil
        expect(photo.longitude).to be_nil
      end
    end
  end

  describe "#liked_by?" do
    let(:photo) { create(:photo, :without_image) }
    let(:user) { create(:user) }
    let(:other_user) { create(:user) }

    before do
      create(:like, photo: photo, user: user)
    end

    it "returns true if user has liked the photo" do
      expect(photo.liked_by?(user)).to be true
    end

    it "returns false if user has not liked the photo" do
      expect(photo.liked_by?(other_user)).to be false
    end
  end

  describe "like count methods" do
    let(:photo) { create(:photo, :without_image, like_count: 5) }

    describe "#increment_like_count!" do
      it "increments the like count by 1" do
        expect { photo.increment_like_count! }.to change { photo.reload.like_count }.from(5).to(6)
      end
    end

    describe "#decrement_like_count!" do
      it "decrements the like count by 1" do
        expect { photo.decrement_like_count! }.to change { photo.reload.like_count }.from(5).to(4)
      end
    end
  end

  describe "image URL helpers" do
    context "when image is not attached" do
      let(:photo) { build(:photo, :without_image) }

      it "returns nil for thumbnail_url" do
        expect(photo.thumbnail_url).to be_nil
      end

      it "returns nil for medium_url" do
        expect(photo.medium_url).to be_nil
      end

      it "returns nil for large_url" do
        expect(photo.large_url).to be_nil
      end

      it "returns nil for original_url" do
        expect(photo.original_url).to be_nil
      end
    end

    describe "#image_urls" do
      let(:photo) { build(:photo, :without_image) }

      it "returns a hash with all variant keys" do
        urls = photo.image_urls
        expect(urls).to have_key(:thumbnail)
        expect(urls).to have_key(:medium)
        expect(urls).to have_key(:large)
        expect(urls).to have_key(:original)
      end
    end
  end

  describe "#image_processed?" do
    context "when image is not attached" do
      let(:photo) { build(:photo, :without_image) }

      it "returns false" do
        expect(photo.image_processed?).to be false
      end
    end
  end

  describe "#image_dimensions" do
    context "when image is not processed" do
      let(:photo) { build(:photo, :without_image) }

      it "returns nil" do
        expect(photo.image_dimensions).to be_nil
      end
    end
  end
end
