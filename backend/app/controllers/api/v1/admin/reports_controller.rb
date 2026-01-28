# frozen_string_literal: true

module Api
  module V1
    module Admin
      # ReportsController handles content moderation report management for admins.
      #
      # Provides endpoints for viewing and processing user reports:
      # - List all reports with filtering and pagination
      # - View report details
      # - Process reports (approve, hide, delete content)
      #
      # == API Endpoints
      #   GET    /api/v1/admin/reports           - List reports with filters
      #   GET    /api/v1/admin/reports/:id       - Show report details
      #   POST   /api/v1/admin/reports/:id/process - Process report (approve/hide/delete)
      #
      # == Requirements
      #   - FR-10: Content Moderation
      #   - AC-10.1: View report list
      #   - AC-10.2: Process reports (approve/hide/delete)
      #   - AC-10.3: Flag users with 3+ violations
      #   - AC-10.4: Notify content owner on hide/delete
      #
      class ReportsController < BaseController
        # Load report for member actions
        before_action :set_report, only: %i[show process_report]

        # Authorize report for member actions
        before_action :authorize_report, only: %i[show process_report]

        # Violation threshold for user flagging
        VIOLATION_THRESHOLD = 3

        # GET /api/v1/admin/reports
        #
        # List reports with pagination and filters.
        #
        # @param page [Integer] Page number (default: 1)
        # @param per_page [Integer] Items per page (default: 20, max: 100)
        # @param status [String] Filter by status (pending, resolved, dismissed)
        # @param reportable_type [String] Filter by content type (Photo, Comment)
        # @param sort_by [String] Sort field (created_at, updated_at)
        # @param sort_order [String] Sort order (asc, desc)
        #
        # @return [JSON] Paginated list of reports
        #
        # @example Success response (200 OK)
        #   {
        #     "data": {
        #       "reports": [...],
        #       "pagination": {
        #         "current_page": 1,
        #         "total_pages": 5,
        #         "total_count": 100,
        #         "per_page": 20
        #       },
        #       "stats": {
        #         "pending_count": 15,
        #         "resolved_count": 80,
        #         "dismissed_count": 5
        #       }
        #     }
        #   }
        def index
          authorize Report

          reports = filtered_reports
          paginated = paginate(reports)

          render_success(
            data: {
              reports: serialize_reports(paginated),
              pagination: pagination_meta(reports),
              stats: report_stats
            },
            status: :ok
          )
        end

        # GET /api/v1/admin/reports/:id
        #
        # Show report details with reported content and reporter info.
        #
        # @param id [String] Report UUID
        #
        # @return [JSON] Report details
        #
        # @example Success response (200 OK)
        #   {
        #     "data": {
        #       "report": {
        #         "id": "...",
        #         "reason": "Inappropriate content",
        #         "status": "pending",
        #         "reporter": { ... },
        #         "reportable": { ... },
        #         "created_at": "..."
        #       }
        #     }
        #   }
        def show
          render_success(
            data: {
              report: ::Admin::ReportSerializer::Detail.new(@report).to_h
            },
            status: :ok
          )
        end

        # POST /api/v1/admin/reports/:id/process
        #
        # Process a report with specified action.
        #
        # @param moderation_action [String] Action to take (approve, hide, delete)
        # @param admin_note [String] Optional admin note about the decision
        #
        # == Actions
        # - approve: Dismiss the report, content remains visible
        # - hide: Hide the reported content from public view
        # - delete: Soft delete the reported content
        #
        # @return [JSON] Processed report data
        #
        # @example Request body
        #   {
        #     "moderation_action": "hide",
        #     "admin_note": "Content violates community guidelines"
        #   }
        #
        # @example Success response (200 OK)
        #   {
        #     "data": {
        #       "report": { ... },
        #       "message": "Report processed successfully",
        #       "user_flagged": false
        #     }
        #   }
        def process_report
          action = process_params[:moderation_action]
          admin_note = process_params[:admin_note]

          unless %w[approve hide delete].include?(action)
            return render_error(
              code: ErrorHandler::ErrorCodes::VALIDATION_FAILED,
              message: I18n.t("admin.reports.errors.invalid_action"),
              details: { valid_actions: %w[approve hide delete] },
              status: :unprocessable_entity
            )
          end

          result = execute_report_action(action, admin_note)

          if result[:success]
            render_success(
              data: {
                report: ::Admin::ReportSerializer::Detail.new(@report.reload).to_h,
                message: I18n.t("admin.reports.#{action}_success"),
                user_flagged: result[:user_flagged] || false
              },
              status: :ok
            )
          else
            render_error(
              code: ErrorHandler::ErrorCodes::INTERNAL_ERROR,
              message: result[:error],
              status: :unprocessable_entity
            )
          end
        end

        private

        # Load report from params[:id]
        def set_report
          @report = Report.find(params[:id])
        end

        # Authorize the report using Pundit
        def authorize_report
          authorize @report
        end

        # Strong parameters for process action
        #
        # @return [ActionController::Parameters] permitted parameters
        def process_params
          params.permit(:moderation_action, :admin_note)
        end

        # Execute the specified action on the report
        #
        # @param action [String] The action to execute
        # @param admin_note [String, nil] Optional admin note
        # @return [Hash] Result with success status and optional user_flagged flag
        def execute_report_action(action, admin_note)
          ActiveRecord::Base.transaction do
            case action
            when "approve"
              @report.dismiss!(current_user, note: admin_note)
              { success: true }
            when "hide"
              hide_content(admin_note)
            when "delete"
              delete_content(admin_note)
            end
          end
        rescue StandardError => e
          Rails.logger.error("[Admin::ReportsController] process_report error: #{e.message}")
          { success: false, error: e.message }
        end

        # Hide the reported content
        #
        # @param admin_note [String, nil] Optional admin note
        # @return [Hash] Result with user_flagged flag
        def hide_content(admin_note)
          reportable = @report.reportable

          if reportable.respond_to?(:moderation_status)
            reportable.update!(moderation_status: :hidden, is_visible: false)
          elsif reportable.respond_to?(:is_visible)
            reportable.update!(is_visible: false)
          end

          @report.resolve!(current_user, note: admin_note)

          user_flagged = check_and_flag_user(reportable)
          notify_content_owner(reportable, :hidden)

          { success: true, user_flagged: user_flagged }
        end

        # Delete (soft delete) the reported content
        #
        # @param admin_note [String, nil] Optional admin note
        # @return [Hash] Result with user_flagged flag
        def delete_content(admin_note)
          reportable = @report.reportable

          if reportable.respond_to?(:moderation_status)
            reportable.update!(moderation_status: :deleted, is_visible: false)
          elsif reportable.respond_to?(:deleted_at)
            reportable.update!(deleted_at: Time.current)
          end

          @report.resolve!(current_user, note: admin_note)

          user_flagged = check_and_flag_user(reportable)
          notify_content_owner(reportable, :deleted)

          { success: true, user_flagged: user_flagged }
        end

        # Check if user has 3+ violations and flag them
        # AC-10.3: Flag users with 3+ violations
        #
        # @param reportable [Object] The reported content
        # @return [Boolean] true if user was flagged
        def check_and_flag_user(reportable)
          content_owner = get_content_owner(reportable)
          return false unless content_owner

          # Count resolved reports against this user's content
          violation_count = count_user_violations(content_owner)

          if violation_count >= VIOLATION_THRESHOLD && !content_owner.violation_flagged
            content_owner.update!(violation_flagged: true, violation_count: violation_count)
            Rails.logger.info("[Admin] User #{content_owner.id} flagged with #{violation_count} violations")
            true
          else
            content_owner.update!(violation_count: violation_count) if content_owner.respond_to?(:violation_count)
            false
          end
        end

        # Count the number of resolved reports (violations) for a user's content
        #
        # @param user [User] The content owner
        # @return [Integer] Number of violations
        def count_user_violations(user)
          # Count reports resolved against user's photos
          photo_violations = Report.resolved
            .where(reportable_type: "Photo")
            .joins("INNER JOIN photos ON photos.id = reports.reportable_id")
            .where(photos: { user_id: user.id })
            .count

          # Count reports resolved against user's comments
          comment_violations = Report.resolved
            .where(reportable_type: "Comment")
            .joins("INNER JOIN comments ON comments.id = reports.reportable_id")
            .where(comments: { user_id: user.id })
            .count

          photo_violations + comment_violations
        end

        # Get the owner of the reported content
        #
        # @param reportable [Object] The reported content
        # @return [User, nil] The content owner
        def get_content_owner(reportable)
          reportable.user if reportable.respond_to?(:user)
        end

        # Notify content owner when their content is hidden/deleted
        # AC-10.4: Notify content owner on hide/delete
        #
        # @param reportable [Object] The reported content
        # @param action [Symbol] The action taken (:hidden or :deleted)
        def notify_content_owner(reportable, action)
          owner = get_content_owner(reportable)
          return unless owner

          content_type = reportable.class.name.downcase
          notification_service.send_push_notification(
            user: owner,
            title: I18n.t("admin.notifications.content_#{action}.title"),
            body: I18n.t("admin.notifications.content_#{action}.body", content_type: content_type),
            data: {
              type: "moderation",
              action: action.to_s,
              content_type: content_type,
              content_id: reportable.id
            },
            notification_type: :system
          )
        rescue StandardError => e
          # Log but don't fail the main operation
          Rails.logger.warn("[Admin::ReportsController] Failed to send notification: #{e.message}")
        end

        # Get filtered reports based on query parameters
        #
        # @return [ActiveRecord::Relation] Filtered reports
        def filtered_reports
          scope = Report.includes(:reporter, :resolved_by, :reportable).recent

          scope = scope.where(status: params[:status]) if params[:status].present?
          scope = scope.where(reportable_type: params[:reportable_type]) if params[:reportable_type].present?

          apply_sorting(scope)
        end

        # Apply sorting to the reports scope
        #
        # @param scope [ActiveRecord::Relation] The base scope
        # @return [ActiveRecord::Relation] Sorted scope
        def apply_sorting(scope)
          sort_by = params[:sort_by] || "created_at"
          sort_order = params[:sort_order] == "asc" ? :asc : :desc

          allowed_sort_fields = %w[created_at updated_at status]
          sort_by = "created_at" unless allowed_sort_fields.include?(sort_by)

          scope.order(sort_by => sort_order)
        end

        # Paginate the reports
        #
        # @param scope [ActiveRecord::Relation] The reports scope
        # @return [ActiveRecord::Relation] Paginated reports
        def paginate(scope)
          page = [ params[:page].to_i, 1 ].max
          per_page = [ [ params[:per_page].to_i, 1 ].max, 100 ].min
          per_page = 20 if per_page <= 0

          scope.offset((page - 1) * per_page).limit(per_page)
        end

        # Generate pagination metadata
        #
        # @param scope [ActiveRecord::Relation] The full scope (before pagination)
        # @return [Hash] Pagination metadata
        def pagination_meta(scope)
          total_count = scope.count
          per_page = [ [ params[:per_page].to_i, 1 ].max, 100 ].min
          per_page = 20 if per_page <= 0

          {
            current_page: [ params[:page].to_i, 1 ].max,
            total_pages: (total_count.to_f / per_page).ceil,
            total_count: total_count,
            per_page: per_page
          }
        end

        # Generate report statistics
        #
        # @return [Hash] Report statistics
        def report_stats
          {
            pending_count: Report.pending.count,
            resolved_count: Report.resolved.count,
            dismissed_count: Report.dismissed.count
          }
        end

        # Serialize reports for API response
        #
        # @param reports [ActiveRecord::Relation] Reports to serialize
        # @return [Array<Hash>] Serialized reports
        def serialize_reports(reports)
          reports.map { |report| ::Admin::ReportSerializer.new(report).to_h }
        end

        # Get notification service instance
        #
        # @return [NotificationService] The notification service
        def notification_service
          @notification_service ||= NotificationService.new
        end
      end
    end
  end
end
