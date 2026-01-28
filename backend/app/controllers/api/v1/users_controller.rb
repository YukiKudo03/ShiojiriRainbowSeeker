# frozen_string_literal: true

module Api
  module V1
    # UsersController handles user profile API endpoints.
    #
    # Provides profile viewing and editing, user photos listing,
    # user statistics, and data management (export/deletion) using
    # Alba serializers for consistent responses.
    #
    # == API Endpoints
    #   GET    /api/v1/users/me                 - Get current user profile (private)
    #   PATCH  /api/v1/users/me                 - Update current user profile
    #   GET    /api/v1/users/me/photos          - Get current user's photos
    #   POST   /api/v1/users/me/export          - Request data export
    #   POST   /api/v1/users/me/delete          - Request account deletion
    #   DELETE /api/v1/users/me/delete          - Cancel deletion request
    #   GET    /api/v1/users/me/deletion_status - Get deletion status
    #   GET    /api/v1/users/:id                - Get public user profile
    #   GET    /api/v1/users/:id/photos         - Get user's public photos
    #
    # == Requirements
    #   - FR-9: User Profile (AC-9.1〜AC-9.5)
    #   - FR-12: Data Export and Deletion (AC-12.1〜AC-12.4)
    #
    class UsersController < BaseController
      include Pundit::Authorization

      # Authentication required for all actions
      before_action :authenticate_user!

      # Load user for member actions
      before_action :set_user, only: %i[show user_photos]

      # GET /api/v1/users/me
      #
      # Get the current authenticated user's profile with statistics.
      # Uses UserSerializer::Private to include private fields.
      #
      # @return [JSON] User profile with stats (including private fields)
      #
      # @example Success response (200 OK)
      #   {
      #     "data": {
      #       "user": {
      #         "id": "uuid",
      #         "display_name": "Username",
      #         "profile_image_url": "https://...",
      #         "email": "user@example.com",
      #         "locale": "ja",
      #         "notification_enabled": true,
      #         "stats": {
      #           "photo_count": 10,
      #           "likes_received": 50,
      #           "comments_count": 25
      #         }
      #       }
      #     }
      #   }
      def me
        serialized = UserSerializer::Private.new(current_user).to_h
        render_success(data: { user: serialized })
      end

      # PATCH/PUT /api/v1/users/me
      #
      # Update the current user's profile.
      #
      # @param display_name [String] Display name (3-30 chars)
      # @param profile_image [File] Profile image file
      #
      # @return [JSON] Updated user profile
      #
      # @example Request body (multipart/form-data)
      #   {
      #     "user": {
      #       "display_name": "New Name",
      #       "profile_image": <file>
      #     }
      #   }
      #
      # @example Success response (200 OK)
      #   {
      #     "data": {
      #       "user": { ... },
      #       "message": "Profile updated successfully"
      #     }
      #   }
      def update_me
        authorize current_user, :update?

        if current_user.update(user_update_params)
          serialized = UserSerializer::Private.new(current_user).to_h
          render_success(
            data: {
              user: serialized,
              message: I18n.t("users.profile_updated")
            }
          )
        else
          render_error(
            code: ErrorHandler::ErrorCodes::VALIDATION_FAILED,
            message: I18n.t("errors.validation_failed"),
            details: current_user.errors.full_messages,
            status: :unprocessable_entity
          )
        end
      end

      # GET /api/v1/users/me/photos
      #
      # Get the current user's photos with pagination.
      #
      # @param page [Integer] Page number (default: 1)
      # @param per_page [Integer] Items per page (default: 20, max: 100)
      #
      # @return [JSON] Paginated list of user's photos
      def my_photos
        photos = current_user.photos
                            .where(deleted_at: nil)
                            .includes(:user, image_attachment: :blob)
                            .order(created_at: :desc)
                            .page(params[:page] || 1)
                            .per([ params[:per_page]&.to_i || 20, 100 ].min)

        render_success(
          data: {
            photos: photos.map { |photo| serialize_photo(photo, current_user) },
            pagination: pagination_data(photos)
          }
        )
      end

      # POST /api/v1/users/me/export
      #
      # Request a data export for the current user.
      # Triggers a background job to collect and package user data.
      # User will receive an email with download link when ready.
      #
      # @return [JSON] Success message with export information
      #
      # @example Success response (202 Accepted)
      #   {
      #     "data": {
      #       "message": "Data export has been requested...",
      #       "estimated_time": "within 24 hours"
      #     }
      #   }
      def request_export
        # Enqueue data export job
        DataExportJob.perform_later(current_user.id)

        Rails.logger.info("[UsersController] Data export requested for user #{current_user.id}")

        render_success(
          data: {
            message: I18n.t("data_export.request_success"),
            estimated_time: I18n.t("data_export.estimated_time")
          },
          status: :accepted
        )
      end

      # POST /api/v1/users/me/delete
      #
      # Request account deletion for the current user.
      # Initiates a 14-day grace period during which the user
      # can cancel the deletion request.
      #
      # @return [JSON] Success message with deletion schedule
      #
      # @example Success response (200 OK)
      #   {
      #     "data": {
      #       "message": "Account deletion scheduled...",
      #       "deletion_scheduled_at": "2024-02-15T00:00:00Z",
      #       "grace_period_days": 14
      #     }
      #   }
      def request_deletion
        result = account_deletion_service.request_deletion(current_user)

        if result[:success]
          render_success(
            data: {
              message: result[:message],
              deletion_scheduled_at: result[:deletion_scheduled_at],
              grace_period_days: result[:grace_period_days]
            }
          )
        else
          error_message = result[:error][:message]
          error_code = determine_deletion_error_code(error_message)
          render_error(
            code: error_code,
            message: error_message,
            status: :unprocessable_entity
          )
        end
      end

      # DELETE /api/v1/users/me/delete
      #
      # Cancel a pending account deletion request.
      # Only possible during the 14-day grace period.
      #
      # @return [JSON] Success message confirming cancellation
      #
      # @example Success response (200 OK)
      #   {
      #     "data": {
      #       "message": "Account deletion canceled..."
      #     }
      #   }
      def cancel_deletion
        result = account_deletion_service.cancel_deletion(current_user)

        if result[:success]
          render_success(data: { message: result[:message] })
        else
          error_message = result[:error][:message]
          error_code = determine_deletion_error_code(error_message)
          render_error(
            code: error_code,
            message: error_message,
            status: :unprocessable_entity
          )
        end
      end

      # GET /api/v1/users/me/deletion_status
      #
      # Get the current deletion status for the authenticated user.
      # Returns whether a deletion is pending and when it's scheduled.
      #
      # @return [JSON] Deletion status information
      #
      # @example Response with pending deletion (200 OK)
      #   {
      #     "data": {
      #       "deletion_pending": true,
      #       "deletion_requested_at": "2024-02-01T00:00:00Z",
      #       "deletion_scheduled_at": "2024-02-15T00:00:00Z",
      #       "days_remaining": 10,
      #       "can_cancel": true
      #     }
      #   }
      #
      # @example Response with no pending deletion (200 OK)
      #   {
      #     "data": {
      #       "deletion_pending": false,
      #       "message": "No deletion request is pending."
      #     }
      #   }
      def deletion_status
        result = account_deletion_service.deletion_status(current_user)

        if result[:success]
          render_success(data: result.except(:success))
        else
          render_error(
            code: ErrorHandler::ErrorCodes::USER_NOT_FOUND,
            message: result[:error][:message],
            status: :not_found
          )
        end
      end

      # GET /api/v1/users/:id
      #
      # Get a user's public profile.
      # Uses UserSerializer (public) which excludes email and other private fields.
      #
      # @param id [String] User UUID
      #
      # @return [JSON] Public user profile
      def show
        authorize @user

        serialized = UserSerializer.new(@user).to_h
        render_success(data: { user: serialized })
      end

      # GET /api/v1/users/:id/photos
      #
      # Get a user's public photos with pagination.
      #
      # @param id [String] User UUID
      # @param page [Integer] Page number (default: 1)
      # @param per_page [Integer] Items per page (default: 20, max: 100)
      #
      # @return [JSON] Paginated list of user's public photos
      def user_photos
        authorize @user, :show?

        photos = @user.photos
                     .where(deleted_at: nil)
                     .includes(:user, image_attachment: :blob)
                     .order(created_at: :desc)
                     .page(params[:page] || 1)
                     .per([ params[:per_page]&.to_i || 20, 100 ].min)

        render_success(
          data: {
            photos: photos.map { |photo| serialize_photo(photo, current_user) },
            pagination: pagination_data(photos)
          }
        )
      end

      private

      # Load user from params[:id]
      def set_user
        @user = User.active.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render_error(
          code: ErrorHandler::ErrorCodes::USER_NOT_FOUND,
          message: I18n.t("errors.user_not_found"),
          status: :not_found
        )
      end

      # Strong Parameters for user update
      #
      # @return [ActionController::Parameters] permitted parameters
      def user_update_params
        params.require(:user).permit(:display_name, :profile_image)
      rescue ActionController::ParameterMissing
        params.permit(:display_name, :profile_image)
      end

      # Build pagination data hash
      #
      # @param collection [Kaminari::Collection] paginated collection
      # @return [Hash] pagination metadata
      def pagination_data(collection)
        {
          currentPage: collection.current_page,
          totalPages: collection.total_pages,
          totalCount: collection.total_count,
          perPage: collection.limit_value
        }
      end

      # Serialize photo for API response
      #
      # @param photo [Photo] the photo to serialize
      # @param viewer [User, nil] the current user for ownership check
      # @return [Hash] serialized photo data
      def serialize_photo(photo, viewer)
        {
          id: photo.id,
          title: photo.title,
          description: photo.description,
          thumbnail_url: photo_thumbnail_url(photo),
          image_url: photo_image_url(photo),
          latitude: photo.location&.y,
          longitude: photo.location&.x,
          location_name: photo.location_name,
          captured_at: photo.captured_at&.iso8601,
          created_at: photo.created_at.iso8601,
          like_count: photo.like_count,
          comment_count: photo.comment_count,
          is_own: viewer&.id == photo.user_id,
          user: UserSerializer::Summary.new(photo.user).to_h
        }
      end

      # Get photo thumbnail URL
      #
      # @param photo [Photo] the photo
      # @return [String, nil] the thumbnail URL
      def photo_thumbnail_url(photo)
        return nil unless photo.image.attached?

        if Rails.application.config.active_storage.service == :local
          Rails.application.routes.url_helpers.rails_representation_url(
            photo.image.variant(resize_to_fill: [ 400, 400 ]),
            host: Rails.application.config.action_mailer.default_url_options[:host] || "localhost:3000"
          )
        else
          photo.image.variant(resize_to_fill: [ 400, 400 ]).url
        end
      rescue StandardError
        nil
      end

      # Get photo image URL
      #
      # @param photo [Photo] the photo
      # @return [String, nil] the image URL
      def photo_image_url(photo)
        return nil unless photo.image.attached?

        if Rails.application.config.active_storage.service == :local
          Rails.application.routes.url_helpers.rails_blob_url(
            photo.image,
            host: Rails.application.config.action_mailer.default_url_options[:host] || "localhost:3000"
          )
        else
          photo.image.url
        end
      rescue StandardError
        nil
      end

      # Initialize AccountDeletionService instance
      #
      # @return [AccountDeletionService] the account deletion service
      def account_deletion_service
        @account_deletion_service ||= AccountDeletionService.new
      end

      # Determine appropriate error code for deletion-related errors
      #
      # @param message [String] the error message
      # @return [Integer] appropriate error code
      def determine_deletion_error_code(message)
        case message
        when /already deleted/i
          ErrorHandler::ErrorCodes::VALIDATION_FAILED
        when /already requested/i
          ErrorHandler::ErrorCodes::VALIDATION_FAILED
        when /no deletion request/i
          ErrorHandler::ErrorCodes::VALIDATION_FAILED
        when /grace period.*expired/i
          ErrorHandler::ErrorCodes::VALIDATION_FAILED
        else
          ErrorHandler::ErrorCodes::INTERNAL_ERROR
        end
      end
    end
  end
end
