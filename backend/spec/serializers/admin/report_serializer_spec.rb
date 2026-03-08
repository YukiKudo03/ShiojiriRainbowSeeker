# frozen_string_literal: true

require "rails_helper"

RSpec.describe Admin::ReportSerializer, type: :serializer do
  let(:reporter) { create(:user, display_name: "Reporter") }
  let(:photo_owner) { create(:user, display_name: "PhotoOwner") }
  let(:reported_photo) { create(:photo, :without_image, user: photo_owner, title: "Suspicious Photo") }
  let(:report) { create(:report, reporter: reporter, reportable: reported_photo, reason: "Inappropriate content") }

  describe "Admin::ReportSerializer (index)" do
    subject(:serialized) { described_class.new(report).to_h }

    it "includes id" do
      expect(serialized[:id]).to eq(report.id)
    end

    it "includes reason" do
      expect(serialized[:reason]).to eq("Inappropriate content")
    end

    it "includes status" do
      expect(serialized[:status]).to eq("pending")
    end

    it "includes adminNote" do
      expect(serialized[:adminNote]).to be_nil
    end

    it "includes reporter with id, displayName, and email" do
      expect(serialized[:reporter]).to include(
        id: reporter.id,
        display_name: reporter.display_name,
        email: reporter.email
      )
    end

    it "includes reportable with id, type, and preview" do
      expect(serialized[:reportable]).to include(
        id: reported_photo.id,
        type: "Photo"
      )
      expect(serialized[:reportable][:preview]).to be_present
    end

    it "includes contentOwner with id and displayName" do
      expect(serialized[:contentOwner]).to include(
        id: photo_owner.id,
        display_name: photo_owner.display_name
      )
    end

    it "returns nil for resolvedBy when report is pending" do
      expect(serialized[:resolvedBy]).to be_nil
    end

    it "includes createdAt as ISO8601" do
      expect(serialized[:createdAt]).to match(/\d{4}-\d{2}-\d{2}T/)
    end

    it "includes updatedAt as ISO8601" do
      expect(serialized[:updatedAt]).to match(/\d{4}-\d{2}-\d{2}T/)
    end

    context "when report is resolved" do
      let(:admin) { create(:user, :admin, display_name: "AdminUser") }
      let(:report) do
        create(:report, :resolved,
               reporter: reporter,
               reportable: reported_photo,
               resolved_by: admin,
               admin_note: "Content removed.")
      end

      it "includes resolvedBy with id and displayName" do
        expect(serialized[:resolvedBy]).to include(
          id: admin.id,
          display_name: admin.display_name
        )
      end

      it "includes adminNote" do
        expect(serialized[:adminNote]).to eq("Content removed.")
      end
    end
  end

  describe ".reportable_preview" do
    context "with a Photo that has a title" do
      it "returns the photo title" do
        preview = described_class.reportable_preview(reported_photo)
        expect(preview).to eq("Suspicious Photo")
      end
    end

    context "with a Photo without a title" do
      let(:untitled_photo) { create(:photo, :without_image, title: nil) }

      it "returns fallback Photo #id" do
        preview = described_class.reportable_preview(untitled_photo)
        expect(preview).to eq("Photo ##{untitled_photo.id}")
      end
    end

    context "with a Comment" do
      let(:comment) { create(:comment, content: "This is a very long comment " * 10) }

      it "returns truncated content" do
        preview = described_class.reportable_preview(comment)
        expect(preview.length).to be <= 100
      end
    end
  end

  describe "Admin::ReportSerializer::Detail" do
    let(:admin) { create(:user, :admin, display_name: "AdminResolver") }
    let(:report) do
      create(:report, :resolved,
             reporter: reporter,
             reportable: reported_photo,
             resolved_by: admin,
             admin_note: "Violation confirmed.")
    end

    subject(:serialized) { described_class::Detail.new(report).to_h }

    it "includes reporter with report_count" do
      expect(serialized[:reporter]).to have_key(:report_count)
    end

    it "counts reporter's total reports" do
      create(:report, reporter: reporter) # second report by same reporter
      result = described_class::Detail.new(report).to_h
      expect(result[:reporter][:report_count]).to be >= 2
    end

    it "includes reportable with Photo-specific fields" do
      expect(serialized[:reportable]).to include(
        id: reported_photo.id,
        type: "Photo",
        title: "Suspicious Photo"
      )
    end

    it "includes reportable moderation_status for Photo" do
      expect(serialized[:reportable]).to have_key(:moderation_status)
    end

    it "includes contentOwner with extended fields" do
      expect(serialized[:contentOwner]).to include(
        id: photo_owner.id,
        display_name: photo_owner.display_name,
        email: photo_owner.email
      )
      expect(serialized[:contentOwner]).to have_key(:photo_count)
      expect(serialized[:contentOwner]).to have_key(:total_reports_against)
    end

    it "includes resolvedBy" do
      expect(serialized[:resolvedBy]).to include(
        id: admin.id,
        display_name: "AdminResolver"
      )
    end

    it "includes relatedReports" do
      expect(serialized).to have_key(:relatedReports)
    end

    context "with related reports for the same content" do
      before do
        create(:report, reportable: reported_photo, reporter: create(:user))
        create(:report, reportable: reported_photo, reporter: create(:user))
      end

      it "lists related reports excluding the current one" do
        expect(serialized[:relatedReports].length).to eq(2)
        related_ids = serialized[:relatedReports].map { |r| r[:id] }
        expect(related_ids).not_to include(report.id)
      end
    end

    context "with a Comment reportable" do
      let(:comment) { create(:comment, content: "Spam content here") }
      let(:comment_report) do
        create(:report, reporter: reporter, reportable: comment, reason: "Spam")
      end

      subject(:serialized) { described_class::Detail.new(comment_report).to_h }

      it "includes Comment-specific fields in reportable" do
        expect(serialized[:reportable]).to include(
          type: "Comment",
          content: "Spam content here"
        )
      end

      it "includes photo_id in reportable for Comment" do
        expect(serialized[:reportable]).to have_key(:photo_id)
      end
    end
  end

  describe ".count_reports_against" do
    let(:owner) { create(:user) }

    it "returns 0 when user has no reported content" do
      count = Admin::ReportSerializer::Detail.count_reports_against(owner)
      expect(count).to eq(0)
    end

    context "with reports against user's photos" do
      before do
        owner_photo = create(:photo, :without_image, user: owner)
        create(:report, reportable: owner_photo)
        create(:report, reportable: owner_photo)
      end

      it "counts photo reports" do
        count = Admin::ReportSerializer::Detail.count_reports_against(owner)
        expect(count).to eq(2)
      end
    end

    context "with reports against user's comments" do
      before do
        owner_comment = create(:comment, user: owner)
        create(:report, reportable: owner_comment)
      end

      it "counts comment reports" do
        count = Admin::ReportSerializer::Detail.count_reports_against(owner)
        expect(count).to eq(1)
      end
    end
  end
end
