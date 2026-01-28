# frozen_string_literal: true

require "rails_helper"

RSpec.describe ReportPolicy, type: :policy do
  let(:admin_user) { create(:user, :admin) }
  let(:regular_user) { create(:user) }
  let(:photo) { create(:photo) }
  let(:report) { create(:report, reportable: photo) }

  describe "Scope" do
    before do
      create_list(:report, 5)
    end

    describe "#resolve" do
      context "for admin users" do
        it "returns all reports" do
          scope = described_class::Scope.new(admin_user, Report.all).resolve
          expect(scope.count).to eq(5)
        end
      end

      context "for regular users" do
        it "returns no reports" do
          scope = described_class::Scope.new(regular_user, Report.all).resolve
          expect(scope.count).to eq(0)
        end
      end

      context "for guests (nil user)" do
        it "returns no reports" do
          scope = described_class::Scope.new(nil, Report.all).resolve
          expect(scope.count).to eq(0)
        end
      end
    end
  end

  describe "#index?" do
    context "for admin users" do
      it "returns true" do
        policy = described_class.new(admin_user, Report)
        expect(policy.index?).to be true
      end
    end

    context "for regular users" do
      it "returns false" do
        policy = described_class.new(regular_user, Report)
        expect(policy.index?).to be false
      end
    end

    context "for guests" do
      it "returns false" do
        policy = described_class.new(nil, Report)
        expect(policy.index?).to be false
      end
    end
  end

  describe "#show?" do
    context "for admin users" do
      it "returns true" do
        policy = described_class.new(admin_user, report)
        expect(policy.show?).to be true
      end
    end

    context "for regular users" do
      it "returns false" do
        policy = described_class.new(regular_user, report)
        expect(policy.show?).to be false
      end
    end

    context "for guests" do
      it "returns false" do
        policy = described_class.new(nil, report)
        expect(policy.show?).to be false
      end
    end
  end

  describe "#process_report?" do
    context "for admin users" do
      it "returns true" do
        policy = described_class.new(admin_user, report)
        expect(policy.process_report?).to be true
      end
    end

    context "for regular users" do
      it "returns false" do
        policy = described_class.new(regular_user, report)
        expect(policy.process_report?).to be false
      end
    end

    context "for guests" do
      it "returns false" do
        policy = described_class.new(nil, report)
        expect(policy.process_report?).to be false
      end
    end
  end

  describe "#create?" do
    context "for admin users" do
      it "returns true" do
        policy = described_class.new(admin_user, Report)
        expect(policy.create?).to be true
      end
    end

    context "for regular users" do
      it "returns false" do
        policy = described_class.new(regular_user, Report)
        expect(policy.create?).to be false
      end
    end
  end

  describe "#update?" do
    context "for admin users" do
      it "returns true" do
        policy = described_class.new(admin_user, report)
        expect(policy.update?).to be true
      end
    end

    context "for regular users" do
      it "returns false" do
        policy = described_class.new(regular_user, report)
        expect(policy.update?).to be false
      end
    end
  end

  describe "#destroy?" do
    context "for admin users" do
      it "returns true" do
        policy = described_class.new(admin_user, report)
        expect(policy.destroy?).to be true
      end
    end

    context "for regular users" do
      it "returns false" do
        policy = described_class.new(regular_user, report)
        expect(policy.destroy?).to be false
      end
    end
  end

  describe "consistent admin-only behavior" do
    let(:all_actions) { [ :index?, :show?, :process_report?, :create?, :update?, :destroy? ] }

    it "grants all permissions to admin users" do
      all_actions.each do |action|
        policy = described_class.new(admin_user, report)
        expect(policy.public_send(action)).to be(true), "Expected #{action} to return true for admin"
      end
    end

    it "denies all permissions to regular users" do
      all_actions.each do |action|
        policy = described_class.new(regular_user, report)
        expect(policy.public_send(action)).to be(false), "Expected #{action} to return false for regular user"
      end
    end

    it "denies all permissions to guest users" do
      all_actions.each do |action|
        policy = described_class.new(nil, report)
        expect(policy.public_send(action)).to be(false), "Expected #{action} to return false for guest"
      end
    end
  end

  describe "Scope with different report statuses" do
    let!(:pending_reports) { create_list(:report, 2, :pending) }
    let!(:resolved_reports) { create_list(:report, 2, :resolved) }
    let!(:dismissed_reports) { create_list(:report, 2, :dismissed) }

    context "for admin users" do
      it "returns all reports regardless of status" do
        scope = described_class::Scope.new(admin_user, Report.all).resolve
        expect(scope.count).to eq(6)
        expect(scope).to include(*pending_reports, *resolved_reports, *dismissed_reports)
      end
    end

    context "for regular users" do
      it "returns no reports regardless of status" do
        scope = described_class::Scope.new(regular_user, Report.all).resolve
        expect(scope.count).to eq(0)
      end
    end
  end
end
