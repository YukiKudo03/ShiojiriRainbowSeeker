# frozen_string_literal: true

require "rails_helper"

RSpec.describe PhotoSerializer, type: :serializer do
  let(:user) { create(:user, display_name: "RainbowHunter") }
  let(:photo) do
    create(:photo, :without_image,
           user: user,
           title: "Double Rainbow",
           description: "A beautiful double rainbow over Shiojiri",
           captured_at: Time.zone.parse("2026-03-01 15:30:00"),
           like_count: 42,
           comment_count: 7)
  end

  describe "PhotoSerializer (base/index)" do
    subject(:serialized) { described_class.new(photo).to_h }

    it "includes id" do
      expect(serialized[:id]).to eq(photo.id)
    end

    it "includes title" do
      expect(serialized[:title]).to eq("Double Rainbow")
    end

    it "includes description" do
      expect(serialized[:description]).to eq("A beautiful double rainbow over Shiojiri")
    end

    it "includes capturedAt as ISO8601" do
      expect(serialized[:capturedAt]).to match(/\d{4}-\d{2}-\d{2}T/)
    end

    it "includes location as a hash with latitude, longitude, and name" do
      expect(serialized[:location]).to include(
        :latitude,
        :longitude,
        :name
      )
    end

    it "populates location name from the photo" do
      expect(serialized[:location][:name]).to eq(photo.location_name)
    end

    it "includes imageUrls with thumbnail and medium keys" do
      expect(serialized[:imageUrls]).to have_key(:thumbnail)
      expect(serialized[:imageUrls]).to have_key(:medium)
    end

    it "returns nil image URLs when no image is attached" do
      expect(serialized[:imageUrls][:thumbnail]).to be_nil
      expect(serialized[:imageUrls][:medium]).to be_nil
    end

    it "includes likeCount" do
      expect(serialized[:likeCount]).to eq(42)
    end

    it "includes commentCount" do
      expect(serialized[:commentCount]).to eq(7)
    end

    it "includes user as a summary serialization" do
      expect(serialized[:user]).to include(
        id: user.id,
        displayName: "RainbowHunter"
      )
    end

    it "includes createdAt as ISO8601" do
      expect(serialized[:createdAt]).to match(/\d{4}-\d{2}-\d{2}T/)
    end

    it "uses camelCase keys throughout" do
      snake_case_keys = serialized.keys.select { |k| k.to_s.include?("_") }
      expect(snake_case_keys).to be_empty
    end

    context "without location" do
      it "returns nil for location" do
        allow(photo).to receive(:location).and_return(nil)
        expect(serialized[:location]).to be_nil
      end
    end
  end

  describe "PhotoSerializer::Detail" do
    let(:current_user) { user }
    subject(:serialized) do
      described_class::Detail.new(photo, params: { current_user: current_user }).to_h
    end

    it "includes all base fields" do
      expect(serialized).to include(
        id: photo.id,
        title: "Double Rainbow",
        description: "A beautiful double rainbow over Shiojiri"
      )
    end

    it "includes imageUrls with all four variants" do
      expect(serialized[:imageUrls].keys).to match_array(%i[thumbnail medium large original])
    end

    it "includes weatherSummary attribute" do
      expect(serialized).to have_key(:weatherSummary)
    end

    it "includes comments attribute" do
      expect(serialized).to have_key(:comments)
    end

    it "returns empty array for comments when photo has none" do
      expect(serialized[:comments]).to eq([])
    end

    context "with comments" do
      before do
        create_list(:comment, 12, photo: photo)
      end

      it "limits comments to 10" do
        expect(serialized[:comments].length).to be <= 10
      end
    end

    it "includes likedByCurrentUser" do
      expect(serialized).to have_key(:likedByCurrentUser)
    end

    it "returns false for likedByCurrentUser when user has not liked" do
      expect(serialized[:likedByCurrentUser]).to be false
    end

    context "when user has liked the photo" do
      let(:other_user) { create(:user) }
      let(:current_user) { other_user }

      before { create(:like, photo: photo, user: other_user) }

      it "returns true for likedByCurrentUser" do
        expect(serialized[:likedByCurrentUser]).to be true
      end
    end

    it "includes isOwner" do
      expect(serialized[:isOwner]).to be true
    end

    context "when current user is not the owner" do
      let(:current_user) { create(:user) }

      it "returns false for isOwner" do
        expect(serialized[:isOwner]).to be false
      end
    end

    it "includes moderationStatus for the owner" do
      expect(serialized).to have_key(:moderationStatus)
      expect(serialized[:moderationStatus]).to eq("approved")
    end

    context "when current user is an admin" do
      let(:admin) { create(:user, :admin) }
      let(:current_user) { admin }

      it "includes moderationStatus" do
        expect(serialized[:moderationStatus]).to eq("approved")
      end
    end

    context "when current user is neither owner nor admin" do
      let(:current_user) { create(:user) }

      it "returns nil for moderationStatus" do
        expect(serialized[:moderationStatus]).to be_nil
      end
    end

    context "without current_user" do
      let(:current_user) { nil }

      it "returns false for likedByCurrentUser" do
        expect(serialized[:likedByCurrentUser]).to be false
      end

      it "returns false for isOwner" do
        expect(serialized[:isOwner]).to be false
      end

      it "returns nil for moderationStatus" do
        expect(serialized[:moderationStatus]).to be_nil
      end
    end

    it "includes dimensions attribute" do
      expect(serialized).to have_key(:dimensions)
    end

    it "includes updatedAt as ISO8601" do
      expect(serialized[:updatedAt]).to match(/\d{4}-\d{2}-\d{2}T/)
    end

    context "with weather conditions" do
      before do
        create(:weather_condition,
               photo: photo,
               timestamp: photo.captured_at,
               temperature: 18.5,
               humidity: 75,
               weather_description: "light rain",
               sun_altitude: 30.0,
               sun_azimuth: 210.0,
               cloud_cover: 60)
      end

      it "returns weather summary with expected fields" do
        expect(serialized[:weatherSummary]).to include(
          :temperature,
          :humidity,
          :weather_description,
          :sun_elevation,
          :sun_azimuth,
          :cloud_cover
        )
      end

      it "populates weather summary values" do
        expect(serialized[:weatherSummary][:temperature]).to eq(18.5)
        expect(serialized[:weatherSummary][:humidity]).to eq(75)
      end
    end
  end

  describe "PhotoSerializer::Minimal" do
    subject(:serialized) { described_class::Minimal.new(photo).to_h }

    it "includes id and title" do
      expect(serialized).to include(
        id: photo.id,
        title: "Double Rainbow"
      )
    end

    it "includes thumbnailUrl" do
      expect(serialized).to have_key(:thumbnailUrl)
    end

    it "includes locationName" do
      expect(serialized[:locationName]).to eq(photo.location_name)
    end

    it "includes likeCount" do
      expect(serialized[:likeCount]).to eq(42)
    end

    it "does NOT include description" do
      expect(serialized).not_to have_key(:description)
    end

    it "does NOT include commentCount" do
      expect(serialized).not_to have_key(:commentCount)
    end

    it "does NOT include user" do
      expect(serialized).not_to have_key(:user)
    end
  end
end
