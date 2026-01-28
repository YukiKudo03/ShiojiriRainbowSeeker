# frozen_string_literal: true

require "rails_helper"

RSpec.describe UserSerializer, type: :serializer do
  let(:user) { create(:user, display_name: "TestUser", locale: "ja") }

  describe "UserSerializer (public)" do
    subject(:serialized) { described_class.new(user).to_h }

    it "includes basic profile fields" do
      expect(serialized).to include(
        id: user.id,
        displayName: "TestUser"
      )
    end

    it "includes created_at as ISO8601" do
      expect(serialized[:createdAt]).to match(/\d{4}-\d{2}-\d{2}T/)
    end

    it "includes stats with required fields" do
      expect(serialized[:stats]).to include(
        :photoCount,
        :likesReceived,
        :commentsCount
      )
    end

    it "does NOT include email (private field)" do
      expect(serialized).not_to have_key(:email)
    end

    it "does NOT include notification settings (private field)" do
      expect(serialized).not_to have_key(:notificationEnabled)
      expect(serialized).not_to have_key(:notificationRadius)
    end

    context "with photos" do
      before { create_list(:photo, 3, user: user) }

      it "counts photos correctly" do
        expect(serialized[:stats][:photoCount]).to eq(3)
      end
    end

    context "with likes received" do
      let(:photo) { create(:photo, user: user) }
      let(:other_user) { create(:user) }

      before { create(:like, photo: photo, user: other_user) }

      it "counts likes received correctly" do
        expect(serialized[:stats][:likesReceived]).to eq(1)
      end
    end

    context "with comments made" do
      let(:other_photo) { create(:photo) }

      before { create_list(:comment, 2, user: user, photo: other_photo) }

      it "counts comments correctly" do
        expect(serialized[:stats][:commentsCount]).to eq(2)
      end
    end
  end

  describe "UserSerializer::Summary" do
    subject(:serialized) { described_class::Summary.new(user).to_h }

    it "includes only minimal fields" do
      expect(serialized.keys).to match_array(%i[id displayName profileImageUrl])
    end

    it "includes correct values" do
      expect(serialized).to include(
        id: user.id,
        displayName: "TestUser"
      )
    end

    it "does NOT include stats" do
      expect(serialized).not_to have_key(:stats)
    end
  end

  describe "UserSerializer::Private" do
    subject(:serialized) { described_class::Private.new(user).to_h }

    it "includes all public fields" do
      expect(serialized).to include(
        id: user.id,
        displayName: "TestUser"
      )
    end

    it "includes stats" do
      expect(serialized[:stats]).to include(
        :photoCount,
        :likesReceived,
        :commentsCount
      )
    end

    it "includes email (private field)" do
      expect(serialized).to have_key(:email)
      expect(serialized[:email]).to eq(user.email)
    end

    it "includes locale" do
      expect(serialized[:locale]).to eq("ja")
    end

    it "includes notification settings" do
      expect(serialized).to have_key(:notificationEnabled)
      expect(serialized).to have_key(:notificationRadius)
    end

    it "includes quiet hours" do
      expect(serialized).to have_key(:quietHoursStart)
      expect(serialized).to have_key(:quietHoursEnd)
    end

    it "includes timestamps" do
      expect(serialized).to have_key(:createdAt)
      expect(serialized).to have_key(:updatedAt)
    end

    context "with quiet hours set" do
      before do
        user.update(
          notification_settings: {
            "enabled" => true,
            "radius" => 5000,
            "quiet_hours_start" => "22:00",
            "quiet_hours_end" => "07:00"
          }
        )
      end

      it "formats quiet hours as HH:MM" do
        expect(serialized[:quietHoursStart]).to eq("22:00")
        expect(serialized[:quietHoursEnd]).to eq("07:00")
      end
    end
  end

  describe ".profile_image_url_for" do
    context "without profile image" do
      it "returns nil" do
        expect(described_class.profile_image_url_for(user)).to be_nil
      end
    end

    context "with profile image attached" do
      before do
        user.profile_image.attach(
          io: StringIO.new("fake image"),
          filename: "avatar.jpg",
          content_type: "image/jpeg"
        )
      end

      it "returns a URL" do
        url = described_class.profile_image_url_for(user)
        expect(url).to be_present
      end
    end
  end

  describe ".calculate_stats" do
    let(:stats) { described_class.calculate_stats(user) }

    context "with no activity" do
      it "returns zero counts" do
        expect(stats).to eq(
          photoCount: 0,
          likesReceived: 0,
          commentsCount: 0
        )
      end
    end

    context "with deleted photos" do
      before do
        create(:photo, user: user)
        create(:photo, user: user, deleted_at: Time.current)
      end

      it "excludes deleted photos from count" do
        expect(stats[:photoCount]).to eq(1)
      end
    end

    context "with likes on deleted photos" do
      let(:other_user) { create(:user) }

      before do
        active_photo = create(:photo, user: user)
        deleted_photo = create(:photo, user: user, deleted_at: Time.current)
        create(:like, photo: active_photo, user: other_user)
        create(:like, photo: deleted_photo, user: other_user)
      end

      it "excludes likes on deleted photos" do
        expect(stats[:likesReceived]).to eq(1)
      end
    end
  end
end
