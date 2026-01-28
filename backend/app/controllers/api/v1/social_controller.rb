# frozen_string_literal: true

module Api
  module V1
    # SocialController handles social interaction API endpoints.
    #
    # Provides operations for:
    # - Adding/removing likes on photos
    # - Listing and posting comments
    # - Reporting inappropriate content
    #
    # == API Endpoints
    #   POST   /api/v1/photos/:photo_id/likes       - Add like to photo
    #   DELETE /api/v1/photos/:photo_id/likes       - Remove like from photo
    #   GET    /api/v1/photos/:photo_id/comments    - List comments for photo
    #   POST   /api/v1/photos/:photo_id/comments    - Add comment to photo
    #   DELETE /api/v1/comments/:id                 - Delete own comment
    #   POST   /api/v1/reports                      - Report content
    #
    # == Requirements
    #   - FR-8: Social Features (AC-8.1〜AC-8.7)
    #
    class SocialController < BaseController
      # Authentication required for all actions
      before_action :authenticate_user!
      before_action :set_photo, only: %i[like unlike comments create_comment]
      before_action :set_comment, only: %i[destroy_comment]

      # POST /api/v1/photos/:photo_id/likes
      #
      # Add a like to a photo. If already liked, returns success with existing like.
      #
      # @return [JSON] Like confirmation
      #
      # @example Success response (201 Created)
      #   {
      #     "data": {
      #       "liked": true,
      #       "like_count": 10
      #     }
      #   }
      def like
        # Check if already liked
        existing_like = @photo.likes.find_by(user: current_user)

        if existing_like
          render_success(
            data: {
              liked: true,
              like_count: @photo.like_count
            }
          )
          return
        end

        # Create new like
        like = @photo.likes.build(user: current_user)

        if like.save
          # Send notification to photo owner (async to not block response)
          send_like_notification_async(@photo)

          render_success(
            data: {
              liked: true,
              like_count: @photo.reload.like_count
            },
            status: :created
          )
        else
          render_error(
            code: ErrorHandler::ErrorCodes::VALIDATION_FAILED,
            message: like.errors.full_messages.join(", "),
            status: :unprocessable_entity
          )
        end
      end

      # DELETE /api/v1/photos/:photo_id/likes
      #
      # Remove a like from a photo.
      #
      # @return [JSON] Unlike confirmation
      #
      # @example Success response (200 OK)
      #   {
      #     "data": {
      #       "liked": false,
      #       "like_count": 9
      #     }
      #   }
      def unlike
        like = @photo.likes.find_by(user: current_user)

        if like
          like.destroy
          render_success(
            data: {
              liked: false,
              like_count: @photo.reload.like_count
            }
          )
        else
          # Already not liked - return success
          render_success(
            data: {
              liked: false,
              like_count: @photo.like_count
            }
          )
        end
      end

      # GET /api/v1/photos/:photo_id/comments
      #
      # List comments for a photo with pagination.
      #
      # @param page [Integer] Page number (default: 1)
      # @param per_page [Integer] Items per page (default: 20, max: 100)
      #
      # @return [JSON] Paginated list of comments
      #
      # @example Success response (200 OK)
      #   {
      #     "data": {
      #       "comments": [
      #         {
      #           "id": "uuid",
      #           "content": "Beautiful rainbow!",
      #           "user": {
      #             "id": "uuid",
      #             "display_name": "User Name"
      #           },
      #           "created_at": "2024-01-21T10:00:00Z",
      #           "is_own": true
      #         }
      #       ],
      #       "pagination": {
      #         "current_page": 1,
      #         "total_pages": 5,
      #         "total_count": 100,
      #         "per_page": 20
      #       }
      #     }
      #   }
      def comments
        page = params[:page]&.to_i || 1
        per_page = [ params[:per_page]&.to_i || 20, 100 ].min

        comments = @photo.comments
                         .visible
                         .includes(:user)
                         .oldest_first
                         .page(page)
                         .per(per_page)

        render_success(data: {
          comments: comments.map { |comment| serialize_comment(comment) },
          pagination: {
            current_page: comments.current_page,
            total_pages: comments.total_pages,
            total_count: comments.total_count,
            per_page: per_page
          }
        })
      end

      # POST /api/v1/photos/:photo_id/comments
      #
      # Add a comment to a photo.
      #
      # @param content [String] Comment text (max 500 characters)
      #
      # @return [JSON] Created comment
      #
      # @example Request body
      #   { "content": "What a beautiful rainbow!" }
      #
      # @example Success response (201 Created)
      #   {
      #     "data": {
      #       "comment": {
      #         "id": "uuid",
      #         "content": "What a beautiful rainbow!",
      #         "user": {...},
      #         "created_at": "2024-01-21T10:00:00Z",
      #         "is_own": true
      #       },
      #       "comment_count": 11
      #     }
      #   }
      def create_comment
        content = params[:content]

        if content.blank?
          return render_error(
            code: ErrorHandler::ErrorCodes::REQUIRED_FIELD_MISSING,
            message: "Content is required",
            status: :unprocessable_entity
          )
        end

        if content.length > 500
          return render_error(
            code: ErrorHandler::ErrorCodes::CHARACTER_LIMIT_EXCEEDED,
            message: "Content must be 500 characters or less",
            status: :unprocessable_entity
          )
        end

        comment = @photo.comments.build(
          user: current_user,
          content: content
        )

        if comment.save
          # Send notification to photo owner (async to not block response)
          send_comment_notification_async(@photo, comment)

          render_success(
            data: {
              comment: serialize_comment(comment),
              comment_count: @photo.reload.comment_count
            },
            status: :created
          )
        else
          render_error(
            code: ErrorHandler::ErrorCodes::VALIDATION_FAILED,
            message: comment.errors.full_messages.join(", "),
            status: :unprocessable_entity
          )
        end
      end

      # DELETE /api/v1/comments/:id
      #
      # Delete own comment.
      #
      # @return [JSON] Deletion confirmation
      #
      # @example Success response (200 OK)
      #   { "data": { "message": "Comment deleted" } }
      def destroy_comment
        unless @comment.owned_by?(current_user)
          return render_error(
            code: ErrorHandler::ErrorCodes::NOT_AUTHORIZED,
            message: "You can only delete your own comments",
            status: :forbidden
          )
        end

        photo = @comment.photo
        @comment.destroy

        render_success(
          data: {
            message: "Comment deleted",
            comment_count: photo.reload.comment_count
          }
        )
      end

      # POST /api/v1/reports
      #
      # Report inappropriate content.
      #
      # @param reportable_type [String] Type of content ("Photo" or "Comment")
      # @param reportable_id [String] ID of the content
      # @param reason [String] Reason for reporting (max 1000 characters)
      #
      # @return [JSON] Report confirmation
      #
      # @example Request body
      #   {
      #     "reportable_type": "Photo",
      #     "reportable_id": "uuid",
      #     "reason": "Inappropriate content"
      #   }
      #
      # @example Success response (201 Created)
      #   { "data": { "report_id": "uuid", "message": "Report submitted" } }
      def create_report
        reportable_type = params[:reportable_type]
        reportable_id = params[:reportable_id]
        reason = params[:reason]

        # Validate required fields
        if reportable_type.blank? || reportable_id.blank?
          return render_error(
            code: ErrorHandler::ErrorCodes::REQUIRED_FIELD_MISSING,
            message: "Reportable type and ID are required",
            status: :unprocessable_entity
          )
        end

        if reason.blank?
          return render_error(
            code: ErrorHandler::ErrorCodes::REQUIRED_FIELD_MISSING,
            message: "Reason is required",
            status: :unprocessable_entity
          )
        end

        # Validate reportable type
        unless %w[Photo Comment].include?(reportable_type)
          return render_error(
            code: ErrorHandler::ErrorCodes::VALIDATION_FAILED,
            message: "Invalid reportable type. Must be 'Photo' or 'Comment'",
            status: :unprocessable_entity
          )
        end

        # Find the reportable content
        reportable = reportable_type.constantize.find_by(id: reportable_id)

        unless reportable
          return render_error(
            code: ErrorHandler::ErrorCodes::RESOURCE_NOT_FOUND,
            message: "#{reportable_type} not found",
            status: :not_found
          )
        end

        # Check if user is reporting their own content
        is_own_content = (reportable.respond_to?(:owned_by?) && reportable.owned_by?(current_user)) ||
                         (reportable.respond_to?(:user_id) && reportable.user_id == current_user.id)
        if is_own_content
          return render_error(
            code: ErrorHandler::ErrorCodes::VALIDATION_FAILED,
            message: "You cannot report your own content",
            status: :unprocessable_entity
          )
        end

        # Check if user has already reported this content
        existing_report = Report.find_by(
          reporter: current_user,
          reportable: reportable,
          status: :pending
        )

        if existing_report
          return render_error(
            code: ErrorHandler::ErrorCodes::VALIDATION_FAILED,
            message: "You have already reported this content",
            status: :unprocessable_entity
          )
        end

        # Create the report
        report = Report.new(
          reporter: current_user,
          reportable: reportable,
          reason: reason
        )

        if report.save
          render_success(
            data: {
              report_id: report.id,
              message: "Report submitted. Thank you for helping keep the community safe."
            },
            status: :created
          )
        else
          render_error(
            code: ErrorHandler::ErrorCodes::VALIDATION_FAILED,
            message: report.errors.full_messages.join(", "),
            status: :unprocessable_entity
          )
        end
      end

      private

      def set_photo
        @photo = Photo.find_by(id: params[:id])

        unless @photo
          render_error(
            code: ErrorHandler::ErrorCodes::RESOURCE_NOT_FOUND,
            message: "Photo not found",
            status: :not_found
          )
        end
      end

      def set_comment
        @comment = Comment.find_by(id: params[:id])

        unless @comment
          render_error(
            code: ErrorHandler::ErrorCodes::RESOURCE_NOT_FOUND,
            message: "Comment not found",
            status: :not_found
          )
        end
      end

      def serialize_comment(comment)
        {
          id: comment.id,
          content: comment.content,
          user: {
            id: comment.user.id,
            display_name: comment.user.display_name
          },
          created_at: comment.created_at.iso8601,
          is_own: comment.owned_by?(current_user)
        }
      end

      # Send like notification asynchronously to avoid blocking the response
      # Uses Solid Queue to process in background
      def send_like_notification_async(photo)
        SocialNotificationJob.perform_later(
          notification_type: "like",
          liker_id: current_user.id,
          photo_id: photo.id
        )
      rescue StandardError => e
        # Log but don't fail the main action if notification fails
        Rails.logger.error("[SocialController] Failed to queue like notification: #{e.message}")
      end

      # Send comment notification asynchronously to avoid blocking the response
      # Uses Solid Queue to process in background
      def send_comment_notification_async(photo, comment)
        SocialNotificationJob.perform_later(
          notification_type: "comment",
          commenter_id: current_user.id,
          photo_id: photo.id,
          comment_id: comment.id
        )
      rescue StandardError => e
        # Log but don't fail the main action if notification fails
        Rails.logger.error("[SocialController] Failed to queue comment notification: #{e.message}")
      end
    end
  end
end
