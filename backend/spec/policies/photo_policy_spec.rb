# frozen_string_literal: true

require "rails_helper"

RSpec.describe PhotoPolicy, type: :policy do
  let(:admin_user) { create(:user, :admin) }
  let(:regular_user) { create(:user) }
  let(:other_user) { create(:user) }
  let(:photo) { create(:photo, :without_image, user: regular_user) }
  let(:pending_photo) { create(:photo, :without_image, :pending, user: regular_user) }
  let(:hidden_photo) { create(:photo, :without_image, :hidden, user: regular_user) }

  describe "Scope" do
    let!(:visible_photos) { create_list(:photo, 3, :without_image) }
    let!(:pending_photos) { create_list(:photo, 2, :without_image, :pending) }
    let!(:hidden_photos) { create_list(:photo, 2, :without_image, :hidden) }

    describe "#resolve" do
      context "for admin users" do
        it "returns all photos" do
          scope = described_class::Scope.new(admin_user, Photo.all).resolve
          expect(scope.count).to eq(7)
        end
      end

      context "for regular users" do
        it "returns visible approved photos and own photos" do
          own_pending = create(:photo, :without_image, :pending, user: regular_user)
          scope = described_class::Scope.new(regular_user, Photo.all).resolve
          expect(scope).to include(*visible_photos, own_pending)
          expect(scope).not_to include(*pending_photos, *hidden_photos)
        end

        it "includes own hidden photos" do
          own_hidden = create(:photo, :without_image, :hidden, user: regular_user)
          scope = described_class::Scope.new(regular_user, Photo.all).resolve
          expect(scope).to include(own_hidden)
        end
      end

      context "for guests (nil user)" do
        it "returns only visible approved photos" do
          scope = described_class::Scope.new(nil, Photo.all).resolve
          expect(scope.count).to eq(3)
          expect(scope).to match_array(visible_photos)
        end
      end
    end
  end

  describe "#index?" do
    it "returns true for anyone including guests" do
      expect(described_class.new(admin_user, Photo).index?).to be true
      expect(described_class.new(regular_user, Photo).index?).to be true
      expect(described_class.new(nil, Photo).index?).to be true
    end
  end

  describe "#show?" do
    context "for approved visible photos" do
      it "returns true for any user including guests" do
        expect(described_class.new(admin_user, photo).show?).to be true
        expect(described_class.new(other_user, photo).show?).to be true
        expect(described_class.new(nil, photo).show?).to be true
      end
    end

    context "for pending photos" do
      it "returns true for admin users" do
        policy = described_class.new(admin_user, pending_photo)
        expect(policy.show?).to be true
      end

      it "returns true for the owner" do
        policy = described_class.new(regular_user, pending_photo)
        expect(policy.show?).to be true
      end

      it "returns false for other users" do
        policy = described_class.new(other_user, pending_photo)
        expect(policy.show?).to be false
      end

      it "returns false for guests" do
        policy = described_class.new(nil, pending_photo)
        expect(policy.show?).to be false
      end
    end

    context "for hidden photos" do
      it "returns true for admin users" do
        policy = described_class.new(admin_user, hidden_photo)
        expect(policy.show?).to be true
      end

      it "returns true for the owner" do
        policy = described_class.new(regular_user, hidden_photo)
        expect(policy.show?).to be true
      end

      it "returns false for other users" do
        policy = described_class.new(other_user, hidden_photo)
        expect(policy.show?).to be false
      end

      it "returns false for guests" do
        policy = described_class.new(nil, hidden_photo)
        expect(policy.show?).to be false
      end
    end
  end

  describe "#create?" do
    it "returns true for authenticated users" do
      expect(described_class.new(admin_user, Photo).create?).to be true
      expect(described_class.new(regular_user, Photo).create?).to be true
    end

    it "returns false for guests" do
      policy = described_class.new(nil, Photo)
      expect(policy.create?).to be false
    end
  end

  describe "#update?" do
    it "returns true for admin users" do
      policy = described_class.new(admin_user, photo)
      expect(policy.update?).to be true
    end

    it "returns true for the owner" do
      policy = described_class.new(regular_user, photo)
      expect(policy.update?).to be true
    end

    it "returns false for other users" do
      policy = described_class.new(other_user, photo)
      expect(policy.update?).to be false
    end

    it "returns false for guests" do
      policy = described_class.new(nil, photo)
      expect(policy.update?).to be false
    end
  end

  describe "#destroy?" do
    it "returns true for admin users" do
      policy = described_class.new(admin_user, photo)
      expect(policy.destroy?).to be true
    end

    it "returns true for the owner" do
      policy = described_class.new(regular_user, photo)
      expect(policy.destroy?).to be true
    end

    it "returns false for other users" do
      policy = described_class.new(other_user, photo)
      expect(policy.destroy?).to be false
    end

    it "returns false for guests" do
      policy = described_class.new(nil, photo)
      expect(policy.destroy?).to be false
    end
  end

  describe "#weather?" do
    it "returns true for approved visible photos (delegates to show?)" do
      policy = described_class.new(nil, photo)
      expect(policy.weather?).to be true
    end

    it "returns false for pending photos as guest" do
      policy = described_class.new(nil, pending_photo)
      expect(policy.weather?).to be false
    end

    it "returns true for pending photos as owner" do
      policy = described_class.new(regular_user, pending_photo)
      expect(policy.weather?).to be true
    end
  end

  describe "consistent admin behavior" do
    let(:all_actions) { [ :index?, :show?, :create?, :update?, :destroy?, :weather? ] }

    it "grants all permissions to admin users" do
      all_actions.each do |action|
        policy = described_class.new(admin_user, photo)
        expect(policy.public_send(action)).to be(true), "Expected #{action} to return true for admin"
      end
    end
  end
end
