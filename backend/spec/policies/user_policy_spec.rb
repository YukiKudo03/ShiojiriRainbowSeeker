# frozen_string_literal: true

require "rails_helper"

RSpec.describe UserPolicy, type: :policy do
  let(:admin_user) { create(:user, :admin) }
  let(:regular_user) { create(:user) }
  let(:other_user) { create(:user) }

  describe "Scope" do
    let!(:active_users) { create_list(:user, 3) }
    let!(:deleted_users) { create_list(:user, 2, :deleted) }

    describe "#resolve" do
      context "for admin users" do
        it "returns only active users" do
          scope = described_class::Scope.new(admin_user, User.all).resolve
          expect(scope).to include(*active_users, admin_user)
          expect(scope).not_to include(*deleted_users)
        end
      end

      context "for regular users" do
        it "returns only active users" do
          scope = described_class::Scope.new(regular_user, User.all).resolve
          expect(scope).to include(*active_users, regular_user)
          expect(scope).not_to include(*deleted_users)
        end
      end

      context "for guests (nil user)" do
        it "returns only active users" do
          scope = described_class::Scope.new(nil, User.all).resolve
          expect(scope).to include(*active_users)
          expect(scope).not_to include(*deleted_users)
        end
      end

      context "with mixed user states" do
        let!(:locked_user) { create(:user, :locked) }

        it "includes locked but not deleted users" do
          scope = described_class::Scope.new(admin_user, User.all).resolve
          expect(scope).to include(locked_user)
          expect(scope).not_to include(*deleted_users)
        end
      end
    end
  end

  describe "#show?" do
    context "for admin users" do
      it "returns true for viewing another user" do
        policy = described_class.new(admin_user, other_user)
        expect(policy.show?).to be true
      end

      it "returns true for viewing themselves" do
        policy = described_class.new(admin_user, admin_user)
        expect(policy.show?).to be true
      end
    end

    context "for regular users" do
      it "returns true for viewing another user" do
        policy = described_class.new(regular_user, other_user)
        expect(policy.show?).to be true
      end

      it "returns true for viewing themselves" do
        policy = described_class.new(regular_user, regular_user)
        expect(policy.show?).to be true
      end
    end

    context "for guests" do
      it "returns false" do
        policy = described_class.new(nil, regular_user)
        expect(policy.show?).to be false
      end
    end
  end

  describe "#update?" do
    context "for admin users" do
      it "returns true for updating another user" do
        policy = described_class.new(admin_user, other_user)
        expect(policy.update?).to be true
      end

      it "returns true for updating themselves" do
        policy = described_class.new(admin_user, admin_user)
        expect(policy.update?).to be true
      end
    end

    context "for regular users" do
      it "returns true for updating themselves" do
        policy = described_class.new(regular_user, regular_user)
        expect(policy.update?).to be true
      end

      it "returns false for updating another user" do
        policy = described_class.new(regular_user, other_user)
        expect(policy.update?).to be false
      end
    end

    context "for guests" do
      it "returns false" do
        policy = described_class.new(nil, regular_user)
        expect(policy.update?).to be false
      end
    end
  end

  describe "inherited default actions" do
    describe "#index?" do
      it "returns false for admin users (inherits default deny)" do
        policy = described_class.new(admin_user, User)
        expect(policy.index?).to be false
      end

      it "returns false for regular users" do
        policy = described_class.new(regular_user, User)
        expect(policy.index?).to be false
      end
    end

    describe "#create?" do
      it "returns false for admin users (inherits default deny)" do
        policy = described_class.new(admin_user, User)
        expect(policy.create?).to be false
      end

      it "returns false for regular users" do
        policy = described_class.new(regular_user, User)
        expect(policy.create?).to be false
      end
    end

    describe "#destroy?" do
      it "returns false for admin users (inherits default deny)" do
        policy = described_class.new(admin_user, other_user)
        expect(policy.destroy?).to be false
      end

      it "returns false for regular users" do
        policy = described_class.new(regular_user, regular_user)
        expect(policy.destroy?).to be false
      end
    end
  end

  describe "self vs other user behavior" do
    it "allows a user to update only their own profile" do
      self_policy = described_class.new(regular_user, regular_user)
      other_policy = described_class.new(regular_user, other_user)
      expect(self_policy.update?).to be true
      expect(other_policy.update?).to be false
    end

    it "allows admin to update any user's profile" do
      [ regular_user, other_user, admin_user ].each do |target|
        policy = described_class.new(admin_user, target)
        expect(policy.update?).to be(true), "Expected admin to update #{target.email}"
      end
    end
  end
end
