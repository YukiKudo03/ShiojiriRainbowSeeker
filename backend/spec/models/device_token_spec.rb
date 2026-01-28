# frozen_string_literal: true

require "rails_helper"

RSpec.describe DeviceToken, type: :model do
  let(:user) { create(:user) }

  # Set English locale for validation error message assertions
  around do |example|
    I18n.with_locale(:en) { example.run }
  end

  describe "validations" do
    it "is valid with valid attributes" do
      device_token = DeviceToken.new(
        user: user,
        token: "test_token_#{SecureRandom.hex(16)}",
        platform: "ios",
        is_active: true
      )
      expect(device_token).to be_valid
    end

    it "requires a token" do
      device_token = DeviceToken.new(user: user, platform: "ios")
      expect(device_token).not_to be_valid
      expect(device_token.errors[:token]).to include("can't be blank")
    end

    it "requires a unique token" do
      existing = DeviceToken.create!(
        user: user,
        token: "duplicate_token",
        platform: "ios",
        is_active: true
      )
      device_token = DeviceToken.new(
        user: user,
        token: "duplicate_token",
        platform: "android"
      )
      expect(device_token).not_to be_valid
      expect(device_token.errors[:token]).to include("has already been taken")
    end

    it "requires a platform" do
      device_token = DeviceToken.new(user: user, token: "test_token")
      expect(device_token).not_to be_valid
      expect(device_token.errors[:platform]).to include("can't be blank")
    end

    it "requires platform to be ios or android" do
      device_token = DeviceToken.new(
        user: user,
        token: "test_token",
        platform: "windows"
      )
      expect(device_token).not_to be_valid
      expect(device_token.errors[:platform]).to include("is not included in the list")
    end
  end

  describe "associations" do
    it "belongs to user" do
      association = DeviceToken.reflect_on_association(:user)
      expect(association.macro).to eq(:belongs_to)
    end
  end

  describe "scopes" do
    let!(:active_ios) do
      DeviceToken.create!(user: user, token: "ios_active", platform: "ios", is_active: true)
    end
    let!(:active_android) do
      DeviceToken.create!(user: user, token: "android_active", platform: "android", is_active: true)
    end
    let!(:inactive_ios) do
      DeviceToken.create!(user: user, token: "ios_inactive", platform: "ios", is_active: false)
    end

    describe ".active" do
      it "returns only active tokens" do
        expect(DeviceToken.active).to include(active_ios, active_android)
        expect(DeviceToken.active).not_to include(inactive_ios)
      end
    end

    describe ".inactive" do
      it "returns only inactive tokens" do
        expect(DeviceToken.inactive).to include(inactive_ios)
        expect(DeviceToken.inactive).not_to include(active_ios, active_android)
      end
    end

    describe ".ios_devices" do
      it "returns only iOS tokens" do
        expect(DeviceToken.ios_devices).to include(active_ios, inactive_ios)
        expect(DeviceToken.ios_devices).not_to include(active_android)
      end
    end

    describe ".android_devices" do
      it "returns only Android tokens" do
        expect(DeviceToken.android_devices).to include(active_android)
        expect(DeviceToken.android_devices).not_to include(active_ios, inactive_ios)
      end
    end
  end

  describe "instance methods" do
    let(:device_token) do
      DeviceToken.create!(
        user: user,
        token: "test_token_instance",
        platform: "android",
        is_active: true
      )
    end

    describe "#ios?" do
      it "returns true for iOS platform" do
        device_token.update!(platform: "ios")
        expect(device_token.ios?).to be true
      end

      it "returns false for Android platform" do
        expect(device_token.ios?).to be false
      end
    end

    describe "#android?" do
      it "returns true for Android platform" do
        expect(device_token.android?).to be true
      end

      it "returns false for iOS platform" do
        device_token.update!(platform: "ios")
        expect(device_token.android?).to be false
      end
    end

    describe "#activate!" do
      it "sets is_active to true" do
        device_token.update!(is_active: false)
        device_token.activate!
        expect(device_token.reload.is_active).to be true
      end
    end

    describe "#deactivate!" do
      it "sets is_active to false" do
        device_token.deactivate!
        expect(device_token.reload.is_active).to be false
      end
    end

    describe "#refresh_token!" do
      it "updates token and sets is_active to true" do
        device_token.update!(is_active: false)
        device_token.refresh_token!("new_token_xyz")
        device_token.reload
        expect(device_token.token).to eq("new_token_xyz")
        expect(device_token.is_active).to be true
      end
    end
  end

  describe "class methods" do
    describe ".register" do
      it "creates a new token for new device" do
        result = DeviceToken.register(
          user: user,
          token: "new_device_token",
          platform: "ios"
        )
        expect(result).to be_persisted
        expect(result.token).to eq("new_device_token")
        expect(result.platform).to eq("ios")
        expect(result.is_active).to be true
      end

      it "updates existing token with new user" do
        existing = DeviceToken.create!(
          user: user,
          token: "existing_token",
          platform: "android",
          is_active: false
        )
        other_user = create(:user)

        result = DeviceToken.register(
          user: other_user,
          token: "existing_token",
          platform: "android"
        )

        expect(result.id).to eq(existing.id)
        expect(result.user_id).to eq(other_user.id)
        expect(result.is_active).to be true
      end
    end

    describe ".deactivate_all_for_user" do
      it "deactivates all tokens for user" do
        DeviceToken.create!(user: user, token: "token1", platform: "ios", is_active: true)
        DeviceToken.create!(user: user, token: "token2", platform: "android", is_active: true)

        DeviceToken.deactivate_all_for_user(user)

        expect(DeviceToken.where(user: user).active.count).to eq(0)
      end
    end

    describe ".cleanup_inactive" do
      it "deletes old inactive tokens" do
        old_token = DeviceToken.create!(
          user: user,
          token: "old_token",
          platform: "ios",
          is_active: false
        )
        old_token.update_column(:updated_at, 60.days.ago)

        recent_inactive = DeviceToken.create!(
          user: user,
          token: "recent_inactive",
          platform: "android",
          is_active: false
        )

        deleted_count = DeviceToken.cleanup_inactive(days_old: 30)

        expect(deleted_count).to eq(1)
        expect(DeviceToken.find_by(id: old_token.id)).to be_nil
        expect(DeviceToken.find_by(id: recent_inactive.id)).not_to be_nil
      end
    end
  end
end
