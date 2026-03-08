# frozen_string_literal: true

require "rails_helper"

RSpec.describe Report, type: :model do
  subject(:report) { build(:report) }

  describe "associations" do
    it { is_expected.to belong_to(:reporter).class_name("User") }
    it { is_expected.to belong_to(:reportable) }
    it { is_expected.to belong_to(:resolved_by).class_name("User").optional }
  end

  describe "enums" do
    it { is_expected.to define_enum_for(:status).with_values(pending: 0, resolved: 1, dismissed: 2) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:reason) }
    it { is_expected.to validate_length_of(:reason).is_at_most(1000) }
    it { is_expected.to validate_length_of(:admin_note).is_at_most(2000) }
  end

  describe "scopes" do
    describe ".recent" do
      let!(:older_report) { create(:report, created_at: 2.days.ago) }
      let!(:newer_report) { create(:report, created_at: 1.day.ago) }

      it "orders by created_at descending" do
        expect(Report.recent.first).to eq(newer_report)
        expect(Report.recent.last).to eq(older_report)
      end
    end

    describe ".unresolved" do
      let!(:pending_report) { create(:report, :pending) }
      let!(:resolved_report) { create(:report, :resolved) }
      let!(:dismissed_report) { create(:report, :dismissed) }

      it "returns only pending reports" do
        expect(Report.unresolved).to include(pending_report)
        expect(Report.unresolved).not_to include(resolved_report, dismissed_report)
      end
    end

    describe ".photo_reports" do
      let!(:photo_report) { create(:report) }
      let!(:comment_report) { create(:report, :comment_report) }

      it "returns only reports for photos" do
        expect(Report.photo_reports).to include(photo_report)
        expect(Report.photo_reports).not_to include(comment_report)
      end
    end

    describe ".comment_reports" do
      let!(:photo_report) { create(:report) }
      let!(:comment_report) { create(:report, :comment_report) }

      it "returns only reports for comments" do
        expect(Report.comment_reports).to include(comment_report)
        expect(Report.comment_reports).not_to include(photo_report)
      end
    end
  end

  describe "#resolve!" do
    let(:report) { create(:report, :pending) }
    let(:admin) { create(:user, :admin) }

    it "sets status to resolved" do
      report.resolve!(admin)
      expect(report.reload.status).to eq("resolved")
    end

    it "sets the resolved_by admin" do
      report.resolve!(admin)
      expect(report.reload.resolved_by).to eq(admin)
    end

    it "sets the admin note when provided" do
      report.resolve!(admin, note: "Action taken")
      expect(report.reload.admin_note).to eq("Action taken")
    end

    it "returns true on success" do
      expect(report.resolve!(admin)).to be true
    end
  end

  describe "#dismiss!" do
    let(:report) { create(:report, :pending) }
    let(:admin) { create(:user, :admin) }

    it "sets status to dismissed" do
      report.dismiss!(admin)
      expect(report.reload.status).to eq("dismissed")
    end

    it "sets the resolved_by admin" do
      report.dismiss!(admin)
      expect(report.reload.resolved_by).to eq(admin)
    end

    it "sets the admin note when provided" do
      report.dismiss!(admin, note: "No violation found")
      expect(report.reload.admin_note).to eq("No violation found")
    end

    it "returns true on success" do
      expect(report.dismiss!(admin)).to be true
    end
  end

  describe "#reviewed?" do
    it "returns true for resolved reports" do
      report = build(:report, :resolved)
      expect(report.reviewed?).to be true
    end

    it "returns true for dismissed reports" do
      report = build(:report, :dismissed)
      expect(report.reviewed?).to be true
    end

    it "returns false for pending reports" do
      report = build(:report, :pending)
      expect(report.reviewed?).to be false
    end
  end

  describe "#reporter_name" do
    let(:user) { create(:user, display_name: "Reporter User") }
    let(:report) { create(:report, reporter: user) }

    it "returns the reporter's display name" do
      expect(report.reporter_name).to eq("Reporter User")
    end
  end

  describe "#resolver_name" do
    let(:admin) { create(:user, :admin, display_name: "Admin User") }

    it "returns the resolver's display name when resolved" do
      report = create(:report, :resolved, resolved_by: admin)
      expect(report.resolver_name).to eq("Admin User")
    end

    it "returns nil when not yet resolved" do
      report = create(:report, :pending)
      expect(report.resolver_name).to be_nil
    end
  end

  describe "#filed_by?" do
    let(:user) { create(:user) }
    let(:other_user) { create(:user) }
    let(:report) { create(:report, reporter: user) }

    it "returns true for the reporter" do
      expect(report.filed_by?(user)).to be true
    end

    it "returns false for other users" do
      expect(report.filed_by?(other_user)).to be false
    end

    it "returns false for nil user" do
      expect(report.filed_by?(nil)).to be false
    end
  end
end
