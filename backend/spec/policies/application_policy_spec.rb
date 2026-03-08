# frozen_string_literal: true

require "rails_helper"

RSpec.describe ApplicationPolicy, type: :policy do
  let(:admin_user) { create(:user, :admin) }
  let(:regular_user) { create(:user) }
  let(:photo) { create(:photo, :without_image, user: regular_user) }
  let(:other_photo) { create(:photo, :without_image, user: admin_user) }

  describe "default actions" do
    describe "#index?" do
      it "returns false by default" do
        policy = described_class.new(regular_user, photo)
        expect(policy.index?).to be false
      end
    end

    describe "#show?" do
      it "returns false by default" do
        policy = described_class.new(regular_user, photo)
        expect(policy.show?).to be false
      end
    end

    describe "#create?" do
      it "returns false by default" do
        policy = described_class.new(regular_user, Photo)
        expect(policy.create?).to be false
      end
    end

    describe "#update?" do
      it "returns false by default" do
        policy = described_class.new(regular_user, photo)
        expect(policy.update?).to be false
      end
    end

    describe "#destroy?" do
      it "returns false by default" do
        policy = described_class.new(regular_user, photo)
        expect(policy.destroy?).to be false
      end
    end

    it "denies all actions for guests" do
      actions = [ :index?, :show?, :create?, :update?, :destroy? ]
      actions.each do |action|
        policy = described_class.new(nil, photo)
        expect(policy.public_send(action)).to be(false), "Expected #{action} to return false for guest"
      end
    end
  end

  describe "delegation methods" do
    describe "#new?" do
      it "delegates to create?" do
        policy = described_class.new(regular_user, Photo)
        expect(policy.new?).to eq(policy.create?)
      end

      it "returns false by default" do
        policy = described_class.new(regular_user, Photo)
        expect(policy.new?).to be false
      end
    end

    describe "#edit?" do
      it "delegates to update?" do
        policy = described_class.new(regular_user, photo)
        expect(policy.edit?).to eq(policy.update?)
      end

      it "returns false by default" do
        policy = described_class.new(regular_user, photo)
        expect(policy.edit?).to be false
      end
    end
  end

  describe "#admin?" do
    context "with admin user" do
      it "returns true" do
        policy = described_class.new(admin_user, photo)
        expect(policy.admin?).to be true
      end
    end

    context "with regular user" do
      it "returns false" do
        policy = described_class.new(regular_user, photo)
        expect(policy.admin?).to be false
      end
    end

    context "with nil user (guest)" do
      it "returns false" do
        policy = described_class.new(nil, photo)
        expect(policy.admin?).to be false
      end
    end
  end

  describe "#owner?" do
    context "when user owns the record" do
      it "returns true" do
        policy = described_class.new(regular_user, photo)
        expect(policy.owner?).to be true
      end
    end

    context "when user does not own the record" do
      it "returns false" do
        policy = described_class.new(regular_user, other_photo)
        expect(policy.owner?).to be false
      end
    end

    context "with nil user (guest)" do
      it "returns false" do
        policy = described_class.new(nil, photo)
        expect(policy.owner?).to be false
      end
    end

    context "when record does not respond to user_id" do
      it "returns false" do
        record_without_user_id = double("Record")
        policy = described_class.new(regular_user, record_without_user_id)
        expect(policy.owner?).to be false
      end
    end
  end

  describe "#owner_or_admin?" do
    context "when user is the owner" do
      it "returns true" do
        policy = described_class.new(regular_user, photo)
        expect(policy.owner_or_admin?).to be true
      end
    end

    context "when user is admin but not owner" do
      it "returns true" do
        policy = described_class.new(admin_user, photo)
        expect(policy.owner_or_admin?).to be true
      end
    end

    context "when user is neither owner nor admin" do
      it "returns false" do
        other_user = create(:user)
        policy = described_class.new(other_user, photo)
        expect(policy.owner_or_admin?).to be false
      end
    end

    context "with nil user (guest)" do
      it "returns false" do
        policy = described_class.new(nil, photo)
        expect(policy.owner_or_admin?).to be false
      end
    end
  end

  describe "Scope" do
    describe "#resolve" do
      before do
        create_list(:photo, 3, :without_image)
      end

      context "for admin users" do
        it "returns an empty scope" do
          scope = described_class::Scope.new(admin_user, Photo.all).resolve
          expect(scope.count).to eq(0)
        end
      end

      context "for regular users" do
        it "returns an empty scope" do
          scope = described_class::Scope.new(regular_user, Photo.all).resolve
          expect(scope.count).to eq(0)
        end
      end

      context "for guests (nil user)" do
        it "returns an empty scope" do
          scope = described_class::Scope.new(nil, Photo.all).resolve
          expect(scope.count).to eq(0)
        end
      end
    end
  end

  describe "initialization" do
    it "stores the user" do
      policy = described_class.new(regular_user, photo)
      expect(policy.user).to eq(regular_user)
    end

    it "stores the record" do
      policy = described_class.new(regular_user, photo)
      expect(policy.record).to eq(photo)
    end

    it "accepts nil user for guest access" do
      policy = described_class.new(nil, photo)
      expect(policy.user).to be_nil
    end
  end
end
