# frozen_string_literal: true

module Api
  module V1
    # MapsController handles map-related API endpoints.
    #
    # Provides endpoints for:
    # - Map markers (photo locations)
    # - Clustering for dense areas
    # - Heatmap data for visualization
    #
    # == API Endpoints
    #   GET /api/v1/maps/markers   - Get photo markers within bounds
    #   GET /api/v1/maps/clusters  - Get clustered markers within bounds
    #   GET /api/v1/maps/heatmap   - Get heatmap data within bounds
    #
    # == Requirements
    #   - FR-5: Map view functionality
    #   - FR-13: Rainbow condition analysis (AC-13.5)
    #
    class MapsController < BaseController
      # Optional authentication for personalization
      before_action :authenticate_user_optional

      # GET /api/v1/maps/markers
      #
      # Get photo markers within a bounding box.
      #
      # @param sw_lat [Float] Southwest corner latitude (required)
      # @param sw_lng [Float] Southwest corner longitude (required)
      # @param ne_lat [Float] Northeast corner latitude (required)
      # @param ne_lng [Float] Northeast corner longitude (required)
      # @param limit [Integer] Maximum number of markers (default: 500)
      # @param start_date [Date] Filter by captured_at >= date
      # @param end_date [Date] Filter by captured_at <= date
      #
      # @return [JSON] Array of photo markers with basic info
      #
      # @example Success response (200 OK)
      #   {
      #     "data": {
      #       "markers": [
      #         {
      #           "id": "uuid",
      #           "latitude": 36.115,
      #           "longitude": 137.954,
      #           "thumbnail_url": "...",
      #           "captured_at": "2024-01-21T10:00:00Z"
      #         }
      #       ],
      #       "total_count": 50,
      #       "bounds": {
      #         "sw_lat": 36.0,
      #         "sw_lng": 137.8,
      #         "ne_lat": 36.2,
      #         "ne_lng": 138.0
      #       }
      #     }
      #   }
      def markers
        unless valid_bounds?
          return render_error(
            code: ErrorHandler::ErrorCodes::VALIDATION_FAILED,
            message: "Bounding box parameters are required (sw_lat, sw_lng, ne_lat, ne_lng)",
            status: :bad_request
          )
        end

        result = map_service.markers(
          bounds: bounds_params,
          filters: filter_params,
          limit: params[:limit]
        )

        if result[:success]
          render_success(data: result[:data])
        else
          render_service_error(result: result, status: http_status_for_error(result[:error][:code]))
        end
      end

      # GET /api/v1/maps/clusters
      #
      # Get clustered photo markers within a bounding box.
      # Uses ST_ClusterDBSCAN with 500m clustering distance.
      #
      # @param sw_lat [Float] Southwest corner latitude (required)
      # @param sw_lng [Float] Southwest corner longitude (required)
      # @param ne_lat [Float] Northeast corner latitude (required)
      # @param ne_lng [Float] Northeast corner longitude (required)
      # @param cluster_distance [Float] Clustering distance in meters (default: 500)
      # @param min_points [Integer] Minimum points to form a cluster (default: 2)
      # @param start_date [Date] Filter by captured_at >= date
      # @param end_date [Date] Filter by captured_at <= date
      #
      # @return [JSON] Array of clusters with center point and count
      #
      # @example Success response (200 OK)
      #   {
      #     "data": {
      #       "clusters": [
      #         {
      #           "id": "cluster_1",
      #           "latitude": 36.115,
      #           "longitude": 137.954,
      #           "count": 15,
      #           "photo_ids": ["uuid1", "uuid2", ...]
      #         }
      #       ],
      #       "total_photos": 150,
      #       "total_clusters": 10,
      #       "unclustered_count": 5,
      #       "bounds": {...}
      #     }
      #   }
      def clusters
        unless valid_bounds?
          return render_error(
            code: ErrorHandler::ErrorCodes::VALIDATION_FAILED,
            message: "Bounding box parameters are required (sw_lat, sw_lng, ne_lat, ne_lng)",
            status: :bad_request
          )
        end

        result = map_service.clusters(
          bounds: bounds_params,
          filters: filter_params,
          cluster_distance: params[:cluster_distance],
          min_points: params[:min_points]
        )

        if result[:success]
          render_success(data: result[:data])
        else
          render_service_error(result: result, status: http_status_for_error(result[:error][:code]))
        end
      end

      # GET /api/v1/maps/heatmap
      #
      # Get heatmap data within a bounding box.
      # Returns density data for visualization.
      #
      # @param sw_lat [Float] Southwest corner latitude (required)
      # @param sw_lng [Float] Southwest corner longitude (required)
      # @param ne_lat [Float] Northeast corner latitude (required)
      # @param ne_lng [Float] Northeast corner longitude (required)
      # @param grid_size [Float] Grid cell size in meters (default: 100)
      # @param start_date [Date] Filter by captured_at >= date
      # @param end_date [Date] Filter by captured_at <= date
      #
      # @return [JSON] Heatmap data with intensity values
      #
      # @example Success response (200 OK)
      #   {
      #     "data": {
      #       "heatmap_points": [
      #         {
      #           "latitude": 36.115,
      #           "longitude": 137.954,
      #           "intensity": 0.85,
      #           "count": 25
      #         }
      #       ],
      #       "max_intensity": 1.0,
      #       "total_photos": 500,
      #       "bounds": {...}
      #     }
      #   }
      def heatmap
        unless valid_bounds?
          return render_error(
            code: ErrorHandler::ErrorCodes::VALIDATION_FAILED,
            message: "Bounding box parameters are required (sw_lat, sw_lng, ne_lat, ne_lng)",
            status: :bad_request
          )
        end

        result = map_service.heatmap(
          bounds: bounds_params,
          filters: filter_params,
          grid_size: params[:grid_size]
        )

        if result[:success]
          render_success(data: result[:data])
        else
          render_service_error(result: result, status: http_status_for_error(result[:error][:code]))
        end
      end

      private

      def map_service
        @map_service ||= MapService.new
      end

      def valid_bounds?
        %i[sw_lat sw_lng ne_lat ne_lng].all? { |key| params[key].present? }
      end

      def bounds_params
        {
          sw_lat: params[:sw_lat].to_f,
          sw_lng: params[:sw_lng].to_f,
          ne_lat: params[:ne_lat].to_f,
          ne_lng: params[:ne_lng].to_f
        }
      end

      def filter_params
        params.permit(:start_date, :end_date, :user_id).to_h.symbolize_keys
      end
    end
  end
end
