# frozen_string_literal: true

module Admin
  # ReportSerializer provides Alba serialization for Report resources in admin context.
  #
  # Offers two serialization modes:
  # - Index (default): Summary for list views
  # - Detail: Full information including reportable content
  #
  # == Security
  # Admin serializers expose more information than public serializers.
  # Should only be used in admin-authenticated contexts.
  #
  # == Requirements
  # - FR-10: Content Moderation (AC-10.1~AC-10.4)
  #
  # == Usage
  #   # List view
  #   Admin::ReportSerializer.new(report).to_h
  #
  #   # Detail view
  #   Admin::ReportSerializer::Detail.new(report).to_h
  #
  class ReportSerializer < ApplicationSerializer
    attributes :id, :reason, :status, :admin_note

    # Reporter summary
    attribute :reporter do |report|
      reporter = report.reporter
      next nil unless reporter

      {
        id: reporter.id,
        display_name: reporter.display_name,
        email: reporter.email
      }
    end

    # Reportable content summary
    attribute :reportable do |report|
      reportable = report.reportable
      next nil unless reportable

      {
        id: reportable.id,
        type: report.reportable_type,
        preview: ReportSerializer.reportable_preview(reportable)
      }
    end

    # Content owner summary
    attribute :content_owner do |report|
      reportable = report.reportable
      owner = reportable&.user if reportable.respond_to?(:user)
      next nil unless owner

      {
        id: owner.id,
        display_name: owner.display_name,
        violation_flagged: owner.respond_to?(:violation_flagged) ? owner.violation_flagged : false
      }
    end

    # Resolved by admin info
    attribute :resolved_by do |report|
      resolver = report.resolved_by
      next nil unless resolver

      {
        id: resolver.id,
        display_name: resolver.display_name
      }
    end

    # Timestamps
    attribute :created_at do |report|
      report.created_at&.iso8601
    end

    attribute :updated_at do |report|
      report.updated_at&.iso8601
    end

    # Generate preview text for reportable content
    def self.reportable_preview(reportable)
      case reportable
      when Photo
        reportable.title.presence || "Photo ##{reportable.id}"
      when Comment
        reportable.content.truncate(100)
      else
        "#{reportable.class.name} ##{reportable.id}"
      end
    rescue StandardError
      nil
    end

    # =========================================================================
    # Detail Serializer - Full information for report detail views
    # =========================================================================

    class Detail < ApplicationSerializer
      attributes :id, :reason, :status, :admin_note

      # Full reporter info
      attribute :reporter do |report|
        reporter = report.reporter
        next nil unless reporter

        {
          id: reporter.id,
          display_name: reporter.display_name,
          email: reporter.email,
          created_at: reporter.created_at&.iso8601,
          report_count: Report.where(reporter_id: reporter.id).count
        }
      end

      # Full reportable content
      attribute :reportable do |report|
        reportable = report.reportable
        next nil unless reportable

        base = {
          id: reportable.id,
          type: report.reportable_type,
          created_at: reportable.created_at&.iso8601
        }

        case reportable
        when Photo
          base.merge(
            title: reportable.title,
            description: reportable.description,
            moderation_status: reportable.moderation_status,
            is_visible: reportable.is_visible,
            image_url: reportable.thumbnail_url,
            like_count: reportable.like_count,
            comment_count: reportable.comment_count
          )
        when Comment
          base.merge(
            content: reportable.content,
            is_visible: reportable.respond_to?(:is_visible) ? reportable.is_visible : true,
            photo_id: reportable.photo_id
          )
        else
          base
        end
      end

      # Full content owner info with violation history
      attribute :content_owner do |report|
        reportable = report.reportable
        owner = reportable&.user if reportable.respond_to?(:user)
        next nil unless owner

        {
          id: owner.id,
          display_name: owner.display_name,
          email: owner.email,
          violation_flagged: owner.respond_to?(:violation_flagged) ? owner.violation_flagged : false,
          violation_count: owner.respond_to?(:violation_count) ? owner.violation_count : 0,
          created_at: owner.created_at&.iso8601,
          photo_count: owner.photos.count,
          total_reports_against: Detail.count_reports_against(owner)
        }
      end

      # Admin who resolved the report
      attribute :resolved_by do |report|
        resolver = report.resolved_by
        next nil unless resolver

        {
          id: resolver.id,
          display_name: resolver.display_name
        }
      end

      # Timestamps
      attribute :created_at do |report|
        report.created_at&.iso8601
      end

      attribute :updated_at do |report|
        report.updated_at&.iso8601
      end

      # Related reports for the same content
      attribute :related_reports do |report|
        Report.where(
          reportable_type: report.reportable_type,
          reportable_id: report.reportable_id
        ).where.not(id: report.id).limit(5).map do |related|
          {
            id: related.id,
            status: related.status,
            reason: related.reason.truncate(100),
            created_at: related.created_at&.iso8601
          }
        end
      end

      # Count all reports against a user's content
      def self.count_reports_against(user)
        photo_reports = Report.where(reportable_type: "Photo")
          .joins("INNER JOIN photos ON photos.id = reports.reportable_id")
          .where(photos: { user_id: user.id })
          .count

        comment_reports = Report.where(reportable_type: "Comment")
          .joins("INNER JOIN comments ON comments.id = reports.reportable_id")
          .where(comments: { user_id: user.id })
          .count

        photo_reports + comment_reports
      rescue StandardError
        0
      end
    end
  end
end
