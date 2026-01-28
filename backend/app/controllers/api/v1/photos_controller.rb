# frozen_string_literal: true

module Api
  module V1
    # PhotosController handles all photo-related API endpoints.
    #
    # Provides CRUD operations for rainbow photos with:
    # - Pagination and filtering support
    # - Geographic queries (radius, bounding box)
    # - JWT authentication for protected actions
    # - Pundit authorization for ownership checks
    #
    # == API Endpoints
    #   GET    /api/v1/photos           - List photos with filters
    #   GET    /api/v1/photos/:id       - Show photo details
    #   POST   /api/v1/photos           - Create new photo
    #   PATCH  /api/v1/photos/:id       - Update photo metadata
    #   DELETE /api/v1/photos/:id       - Delete photo
    #   GET    /api/v1/photos/:id/weather - Get weather data for photo
    #
    # == Requirements
    #   - FR-2: Photo upload and management
    #   - FR-3: Photo metadata management
    #   - FR-4: Photo feed and browsing
    #
    class PhotosController < BaseController
      include Pundit::Authorization

      # Authentication required for create, update, destroy
      before_action :authenticate_user!, except: %i[index show weather]

      # Optional authentication for index and show (for personalization)
      before_action :authenticate_user_optional, only: %i[index show weather]

      # Load photo for member actions
      before_action :set_photo, only: %i[show update destroy weather]

      # Authorize photo for member actions
      before_action :authorize_photo, only: %i[show update destroy weather]

      # GET /api/v1/photos
      #
      # List photos with pagination and filters.
      #
      # @param page [Integer] Page number (default: 1)
      # @param per_page [Integer] Items per page (default: 20, max: 100)
      # @param user_id [String] Filter by user ID
      # @param latitude [Float] Center latitude for radius search
      # @param longitude [Float] Center longitude for radius search
      # @param radius_meters [Float] Search radius in meters (default: 10000)
      # @param sw_lat [Float] Southwest latitude for bounding box
      # @param sw_lng [Float] Southwest longitude for bounding box
      # @param ne_lat [Float] Northeast latitude for bounding box
      # @param ne_lng [Float] Northeast longitude for bounding box
      # @param start_date [Date] Filter by captured_at >= date
      # @param end_date [Date] Filter by captured_at <= date
      # @param keyword [String] Search in title/description
      # @param sort_by [String] Sort field (captured_at, created_at, like_count)
      # @param sort_order [String] Sort order (asc, desc)
      #
      # @return [JSON] Paginated list of photos
      #
      # @example Success response (200 OK)
      #   {
      #     "data": {
      #       "photos": [...],
      #       "pagination": {
      #         "current_page": 1,
      #         "total_pages": 5,
      #         "total_count": 100,
      #         "per_page": 20
      #       }
      #     }
      #   }
      def index
        result = photo_service.list(
          filters: filter_params,
          page: params[:page],
          per_page: params[:per_page],
          current_user: current_user
        )

        if result[:success]
          render_success(data: result[:data], status: :ok)
        else
          render_service_error(result: result, status: http_status_for_error(result[:error][:code]))
        end
      end

      # GET /api/v1/photos/:id
      #
      # Show photo details with associated data.
      #
      # @param id [String] Photo UUID
      #
      # @return [JSON] Photo details with weather, comments, likes
      #
      # @example Success response (200 OK)
      #   {
      #     "data": {
      #       "photo": {
      #         "id": "...",
      #         "title": "Beautiful Rainbow",
      #         "image_urls": { "thumbnail": "...", "medium": "...", "large": "...", "original": "..." },
      #         "weather_summary": { "temperature": 22.5, "humidity": 65 },
      #         "comments": [...],
      #         "liked_by_current_user": false,
      #         "is_owner": true
      #       }
      #     }
      #   }
      def show
        result = photo_service.find_with_details(
          photo_id: @photo.id,
          current_user: current_user
        )

        if result[:success]
          render_success(data: result[:data], status: :ok)
        else
          render_service_error(result: result, status: http_status_for_error(result[:error][:code]))
        end
      end

      # POST /api/v1/photos
      #
      # Create a new photo with image upload.
      # Requires authentication.
      #
      # @param image [File] The uploaded image file (required)
      # @param title [String] Photo title (max 100 chars)
      # @param description [String] Photo description (max 500 chars)
      # @param latitude [Float] GPS latitude
      # @param longitude [Float] GPS longitude
      # @param location_name [String] Location name
      # @param captured_at [DateTime] When the photo was taken (required)
      #
      # @return [JSON] Created photo data
      #
      # @example Request (multipart/form-data)
      #   {
      #     "photo": {
      #       "image": <file>,
      #       "title": "Beautiful Rainbow",
      #       "captured_at": "2024-01-15T14:30:00Z",
      #       "latitude": 36.115,
      #       "longitude": 137.954
      #     }
      #   }
      #
      # @example Success response (201 Created)
      #   {
      #     "data": {
      #       "photo": { ... },
      #       "message": "Photo created successfully"
      #     }
      #   }
      def create
        authorize Photo

        result = photo_service.create(
          user: current_user,
          image: photo_params[:image],
          metadata: photo_metadata_params
        )

        if result[:success]
          render_success(data: result[:data], status: :created)
        else
          render_service_error(result: result, status: http_status_for_error(result[:error][:code]))
        end
      end

      # PATCH/PUT /api/v1/photos/:id
      #
      # Update photo metadata.
      # Only the photo owner (or admin) can update.
      # Requires authentication.
      #
      # @param title [String] New title (max 100 chars)
      # @param description [String] New description (max 500 chars)
      # @param latitude [Float] New latitude
      # @param longitude [Float] New longitude
      # @param location_name [String] New location name
      #
      # @return [JSON] Updated photo data
      #
      # @example Request body
      #   {
      #     "photo": {
      #       "title": "Updated Title",
      #       "description": "Updated description"
      #     }
      #   }
      #
      # @example Success response (200 OK)
      #   {
      #     "data": {
      #       "photo": { ... },
      #       "message": "Photo updated successfully"
      #     }
      #   }
      def update
        result = photo_service.update(
          photo: @photo,
          params: update_params,
          current_user: current_user
        )

        if result[:success]
          render_success(data: result[:data], status: :ok)
        else
          render_service_error(result: result, status: http_status_for_error(result[:error][:code]))
        end
      end

      # DELETE /api/v1/photos/:id
      #
      # Delete (soft delete) a photo.
      # Only the photo owner (or admin) can delete.
      # Requires authentication.
      #
      # @return [JSON] Success message
      #
      # @example Success response (200 OK)
      #   {
      #     "data": {
      #       "message": "Photo deleted successfully"
      #     }
      #   }
      def destroy
        result = photo_service.destroy(
          photo: @photo,
          current_user: current_user
        )

        if result[:success]
          render_success(data: result[:data], status: :ok)
        else
          render_service_error(result: result, status: http_status_for_error(result[:error][:code]))
        end
      end

      # GET /api/v1/photos/:id/weather
      #
      # Get weather data for a photo.
      # Returns weather conditions and radar data at capture time.
      #
      # @return [JSON] Weather conditions and radar data
      #
      # @example Success response (200 OK)
      #   {
      #     "data": {
      #       "weather_conditions": [
      #         { "recorded_at": "...", "temperature": 22.5, "humidity": 65, ... }
      #       ],
      #       "radar_data": [
      #         { "recorded_at": "...", "precipitation_intensity": 5.2, ... }
      #       ]
      #     }
      #   }
      def weather
        result = photo_service.weather_data(photo_id: @photo.id)

        if result[:success]
          render_success(data: result[:data], status: :ok)
        else
          render_service_error(result: result, status: http_status_for_error(result[:error][:code]))
        end
      end

      private

      # Load photo from params[:id]
      def set_photo
        @photo = Photo.find(params[:id])
      end

      # Authorize the photo using Pundit
      def authorize_photo
        authorize @photo
      end

      # Strong Parameters for photo creation
      #
      # @return [ActionController::Parameters] permitted parameters
      def photo_params
        params.require(:photo).permit(
          :image,
          :title,
          :description,
          :latitude,
          :longitude,
          :location_name,
          :captured_at
        )
      rescue ActionController::ParameterMissing
        # Allow parameters at root level for flexibility
        params.permit(
          :image,
          :title,
          :description,
          :latitude,
          :longitude,
          :location_name,
          :captured_at
        )
      end

      # Extract photo metadata from params
      #
      # @return [Hash] metadata hash
      def photo_metadata_params
        {
          title: photo_params[:title],
          description: photo_params[:description],
          latitude: photo_params[:latitude],
          longitude: photo_params[:longitude],
          location_name: photo_params[:location_name],
          captured_at: photo_params[:captured_at]
        }
      end

      # Strong Parameters for photo update
      #
      # @return [Hash] permitted update parameters
      def update_params
        params.require(:photo).permit(
          :title,
          :description,
          :latitude,
          :longitude,
          :location_name
        ).to_h.symbolize_keys
      rescue ActionController::ParameterMissing
        params.permit(
          :title,
          :description,
          :latitude,
          :longitude,
          :location_name
        ).to_h.symbolize_keys
      end

      # Extract filter parameters from request
      #
      # @return [Hash] filter parameters
      def filter_params
        {
          user_id: params[:user_id],
          latitude: params[:latitude],
          longitude: params[:longitude],
          radius_meters: params[:radius_meters],
          sw_lat: params[:sw_lat],
          sw_lng: params[:sw_lng],
          ne_lat: params[:ne_lat],
          ne_lng: params[:ne_lng],
          start_date: params[:start_date],
          end_date: params[:end_date],
          keyword: params[:keyword],
          sort_by: params[:sort_by],
          sort_order: params[:sort_order],
          include_own: params[:include_own]
        }.compact
      end

      # Initialize PhotoService instance
      #
      # @return [PhotoService] the photo service
      def photo_service
        @photo_service ||= PhotoService.new
      end
    end
  end
end
