# frozen_string_literal: true

module Api
  module V1
    # StatisticsController provides analytics endpoints for rainbow sighting data.
    #
    # All endpoints are publicly accessible (no authentication required) to allow
    # researchers and visitors to access statistical data.
    #
    # == Requirements
    # - FR-6: Statistics Dashboard
    # - AC-6.1: Regional statistics display
    # - AC-6.2: Time-based trend analysis
    # - AC-6.3: Weather correlation analysis
    # - AC-6.4: Regional comparison
    # - AC-6.5: Data export for research
    #
    # == Endpoints
    # GET /api/v1/statistics/regions              - Available regions
    # GET /api/v1/statistics/region/:region_id    - Region statistics
    # GET /api/v1/statistics/trends               - Rainbow occurrence trends
    # GET /api/v1/statistics/weather              - Weather correlations
    # GET /api/v1/statistics/compare              - Compare regions
    # GET /api/v1/statistics/export               - Export dataset
    #
    class StatisticsController < BaseController
      # All statistics endpoints are public (no authentication required)
      # This allows researchers and visitors to access statistical data

      # GET /api/v1/statistics/regions
      #
      # List available predefined regions for analysis.
      #
      # @return [JSON] List of available regions with metadata
      #
      # @example Response
      #   {
      #     "data": {
      #       "regions": [
      #         {
      #           "id": "daimon",
      #           "name": "大門地区",
      #           "center": { "lat": 36.115, "lng": 137.954 },
      #           "radius": 3000
      #         }
      #       ]
      #     }
      #   }
      def regions
        regions_data = AnalysisService::REGIONS.map do |id, region|
          {
            id: id,
            name: region[:name],
            center: region[:center],
            radius: region[:radius]
          }
        end

        render_success(data: { regions: regions_data })
      end

      # GET /api/v1/statistics/region/:region_id
      #
      # Get detailed statistics for a specific region.
      #
      # @param region_id [String] Region identifier (daimon, shiojiri_central, shiojiri_city, or custom)
      # @param start_date [String] Optional start date (ISO8601)
      # @param end_date [String] Optional end date (ISO8601)
      # @param lat [Float] Required if region_id is "custom"
      # @param lng [Float] Required if region_id is "custom"
      # @param radius [Float] Required if region_id is "custom" (meters)
      #
      # @return [JSON] Regional statistics
      #
      def region_stats
        result = analysis_service.region_stats(
          region_id: params[:region_id],
          period: period_params,
          center: custom_center_params,
          radius: params[:radius]&.to_f
        )

        if result[:success]
          render_success(data: result[:data])
        else
          render_service_error(result: result, status: :unprocessable_entity)
        end
      end

      # GET /api/v1/statistics/trends
      #
      # Get rainbow occurrence trends over time.
      #
      # @param group_by [String] Grouping period: day, week, month (default), year
      # @param region_id [String] Optional region filter
      # @param start_date [String] Optional start date (ISO8601)
      # @param end_date [String] Optional end date (ISO8601)
      #
      # @return [JSON] Trend data with time series and summary
      #
      def trends
        result = analysis_service.rainbow_trends(
          period: period_params,
          group_by: params[:group_by] || "month",
          region_id: params[:region_id]
        )

        if result[:success]
          render_success(data: result[:data])
        else
          render_service_error(result: result, status: :unprocessable_entity)
        end
      end

      # GET /api/v1/statistics/weather
      #
      # Get weather condition correlations with rainbow sightings.
      #
      # @param region_id [String] Optional region filter
      # @param start_date [String] Optional start date (ISO8601)
      # @param end_date [String] Optional end date (ISO8601)
      #
      # @return [JSON] Weather correlation data
      #
      def weather_correlations
        result = analysis_service.weather_correlations(
          period: period_params,
          region_id: params[:region_id]
        )

        if result[:success]
          render_success(data: result[:data])
        else
          render_service_error(result: result, status: :unprocessable_entity)
        end
      end

      # GET /api/v1/statistics/compare
      #
      # Compare statistics between multiple regions.
      #
      # @param region_ids [Array<String>] Regions to compare (comma-separated or array)
      # @param start_date [String] Optional start date (ISO8601)
      # @param end_date [String] Optional end date (ISO8601)
      #
      # @return [JSON] Comparison data with rankings
      #
      def compare
        region_ids = parse_region_ids(params[:region_ids])

        if region_ids.empty?
          return render_error(
            code: ErrorHandler::ErrorCodes::VALIDATION_FAILED,
            message: "At least one region_id is required",
            status: :unprocessable_entity
          )
        end

        result = analysis_service.compare_regions(
          region_ids: region_ids,
          period: period_params
        )

        if result[:success]
          render_success(data: result[:data])
        else
          render_service_error(result: result, status: :unprocessable_entity)
        end
      end

      # GET /api/v1/statistics/export
      #
      # Export rainbow sighting dataset for research.
      #
      # @param export_format [String] Export format: json (default), csv
      # @param region_id [String] Optional region filter
      # @param start_date [String] Optional start date (ISO8601)
      # @param end_date [String] Optional end date (ISO8601)
      # @param include_weather [Boolean] Include weather data (default: true)
      #
      # @return [JSON] Export data or job ID for large exports
      #
      def export
        result = analysis_service.export_dataset(
          period: period_params,
          region_id: params[:region_id],
          format: params[:export_format] || "json",
          include_weather: params[:include_weather] != "false"
        )

        if result[:success]
          render_success(data: result[:data])
        else
          render_service_error(result: result, status: :unprocessable_entity)
        end
      end

      private

      # Initialize AnalysisService
      #
      # @return [AnalysisService]
      def analysis_service
        @analysis_service ||= AnalysisService.new
      end

      # Extract period parameters
      #
      # @return [Hash] Period with start_date and end_date
      def period_params
        {
          start_date: params[:start_date],
          end_date: params[:end_date]
        }.compact
      end

      # Extract custom center parameters
      #
      # @return [Hash, nil] Center point with lat/lng or nil
      def custom_center_params
        return nil unless params[:lat].present? && params[:lng].present?

        {
          lat: params[:lat].to_f,
          lng: params[:lng].to_f
        }
      end

      # Parse region_ids from various input formats
      #
      # @param input [String, Array] Region IDs
      # @return [Array<String>] Parsed region IDs
      def parse_region_ids(input)
        return [] if input.blank?

        if input.is_a?(Array)
          input.map(&:to_s)
        else
          input.to_s.split(",").map(&:strip)
        end
      end
    end
  end
end
