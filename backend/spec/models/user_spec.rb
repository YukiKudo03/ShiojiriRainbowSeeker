# frozen_string_literal: true

require "rails_helper"

RSpec.describe User, type: :model do
  describe "factory" do
    it "has a valid factory" do
      expect(build(:user)).to be_valid
    end

    it "has a valid unconfirmed factory" do
      user = build(:user, :unconfirmed)
      expect(user).to be_valid
      expect(user.confirmed_at).to be_nil
    end

    it "has a valid admin factory" do
      user = build(:user, :admin)
      expect(user).to be_valid
      expect(user).to be_admin
    end

    it "has a valid deleted factory" do
      user = build(:user, :deleted)
      expect(user).to be_valid
      expect(user).to be_deleted
    end

    it "has a valid locked factory" do
      user = build(:user, :locked)
      expect(user).to be_valid
      expect(user.locked_at).to be_present
    end
  end

  describe "associations" do
    it { is_expected.to have_many(:photos).dependent(:destroy) }
    it { is_expected.to have_many(:comments).dependent(:destroy) }
    it { is_expected.to have_many(:likes).dependent(:destroy) }
    it { is_expected.to have_many(:notifications).dependent(:destroy) }
    it { is_expected.to have_many(:device_tokens).dependent(:destroy) }
    it { is_expected.to have_one_attached(:profile_image) }
  end

  describe "validations" do
    subject { build(:user) }

    describe "email" do
      it { is_expected.to validate_presence_of(:email) }

      it "is invalid with duplicate email" do
        create(:user, email: "test@example.com")
        duplicate_user = build(:user, email: "test@example.com")
        expect(duplicate_user).not_to be_valid
      end

      it "is invalid with invalid email format" do
        user = build(:user, email: "invalid-email")
        expect(user).not_to be_valid
      end
    end

    describe "password" do
      it "is invalid with password shorter than 8 characters" do
        user = build(:user, password: "short")
        expect(user).not_to be_valid
      end

      it "is valid with password of 8 characters" do
        user = build(:user, password: "password")
        expect(user).to be_valid
      end
    end

    describe "display_name" do
      it { is_expected.to validate_presence_of(:display_name) }

      it "is invalid with display_name shorter than 3 characters" do
        user = build(:user, display_name: "ab")
        expect(user).not_to be_valid
      end

      it "is invalid with display_name longer than 30 characters" do
        user = build(:user, display_name: "a" * 31)
        expect(user).not_to be_valid
      end

      it "is valid with display_name of 3 characters" do
        user = build(:user, display_name: "abc")
        expect(user).to be_valid
      end

      it "is valid with display_name of 30 characters" do
        user = build(:user, display_name: "a" * 30)
        expect(user).to be_valid
      end
    end

    describe "locale" do
      it "is valid with 'ja'" do
        user = build(:user, locale: "ja")
        expect(user).to be_valid
      end

      it "is valid with 'en'" do
        user = build(:user, locale: "en")
        expect(user).to be_valid
      end

      it "is invalid with other locale" do
        user = build(:user, locale: "fr")
        expect(user).not_to be_valid
      end
    end
  end

  describe "enums" do
    it { is_expected.to define_enum_for(:role).with_values(user: 0, admin: 1) }
  end

  describe "scopes" do
    describe ".active" do
      it "returns users without deleted_at" do
        active_user = create(:user)
        deleted_user = create(:user, :deleted)

        expect(User.active).to include(active_user)
        expect(User.active).not_to include(deleted_user)
      end
    end

    describe ".deleted" do
      it "returns users with deleted_at" do
        active_user = create(:user)
        deleted_user = create(:user, :deleted)

        expect(User.deleted).to include(deleted_user)
        expect(User.deleted).not_to include(active_user)
      end
    end

    describe ".confirmed" do
      it "returns confirmed users" do
        confirmed_user = create(:user)
        unconfirmed_user = create(:user, :unconfirmed)

        expect(User.confirmed).to include(confirmed_user)
        expect(User.confirmed).not_to include(unconfirmed_user)
      end
    end

    describe ".admins" do
      it "returns admin users" do
        regular_user = create(:user)
        admin_user = create(:user, :admin)

        expect(User.admins).to include(admin_user)
        expect(User.admins).not_to include(regular_user)
      end
    end
  end

  describe "#deleted?" do
    it "returns true when deleted_at is present" do
      user = build(:user, deleted_at: Time.current)
      expect(user.deleted?).to be true
    end

    it "returns false when deleted_at is nil" do
      user = build(:user, deleted_at: nil)
      expect(user.deleted?).to be false
    end
  end

  describe "#soft_delete" do
    it "sets deleted_at to current time" do
      user = create(:user)
      expect { user.soft_delete }.to change { user.deleted_at }.from(nil)
      expect(user.deleted_at).to be_within(1.second).of(Time.current)
    end
  end

  describe "#restore" do
    it "sets deleted_at to nil" do
      user = create(:user, :deleted)
      expect { user.restore }.to change { user.deleted_at }.to(nil)
    end
  end

  describe "#active_for_authentication?" do
    it "returns true for active confirmed user" do
      user = create(:user)
      expect(user.active_for_authentication?).to be true
    end

    it "returns false for deleted user" do
      user = create(:user, :deleted)
      expect(user.active_for_authentication?).to be false
    end

    it "returns false for unconfirmed user" do
      user = create(:user, :unconfirmed)
      expect(user.active_for_authentication?).to be false
    end
  end

  describe "#inactive_message" do
    it "returns :deleted for deleted user" do
      user = build(:user, :deleted)
      expect(user.inactive_message).to eq(:deleted)
    end

    it "returns :unconfirmed for unconfirmed user" do
      user = build(:user, :unconfirmed)
      expect(user.inactive_message).to eq(:unconfirmed)
    end
  end

  describe "Devise confirmable" do
    it "sets confirmation_token on create" do
      user = create(:user, :unconfirmed)
      expect(user.confirmation_token).to be_present
    end

    it "confirms user with valid token" do
      user = create(:user, :unconfirmed)
      token = user.confirmation_token
      confirmed_user = User.confirm_by_token(token)
      expect(confirmed_user.confirmed?).to be true
    end
  end
end
