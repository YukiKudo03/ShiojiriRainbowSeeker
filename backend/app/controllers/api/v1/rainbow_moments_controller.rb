# frozen_string_literal: true

module Api
  module V1
    # RainbowMomentsController provides endpoints for Rainbow Moment events.
    #
    # == Endpoints
    # - GET  /api/v1/rainbow_moments         - List past moments
    # - GET  /api/v1/rainbow_moments/active   - Get current active moment(s)
    # - GET  /api/v1/rainbow_moments/:id      - Show moment details
    # - POST /api/v1/demo/trigger_moment      - Demo: manually trigger a moment
    #
    class RainbowMomentsController < BaseController
      before_action :authenticate_user!
      before_action :set_moment, only: [:show]

      # GET /api/v1/rainbow_moments
      # List past moments with pagination.
      def index
        page = [params.fetch(:page, 1).to_i, 1].max
        per_page = [params.fetch(:per_page, 20).to_i, 100].min

        scope = RainbowMoment.recent
        scope = scope.for_location(params[:location_id]) if params[:location_id].present?

        total = scope.count
        moments = scope.offset((page - 1) * per_page).limit(per_page)

        render_success(
          data: { moments: moments.map { |m| serialize_moment(m) } },
          meta: {
            currentPage: page,
            perPage: per_page,
            totalPages: (total.to_f / per_page).ceil,
            totalCount: total
          }
        )
      end

      # GET /api/v1/rainbow_moments/active
      # Get currently active or closing moments.
      def active
        moments = RainbowMoment.where(status: %w[active closing]).recent
        render_success(data: { moments: moments.map { |m| serialize_moment(m) } })
      end

      # GET /api/v1/rainbow_moments/:id
      def show
        render_success(data: { moment: serialize_moment(@moment, detailed: true) })
      end

      # POST /api/v1/demo/trigger_moment
      # Demo endpoint: manually trigger a rainbow moment for a location.
      # Only available in development/staging.
      def trigger_demo
        unless Rails.env.development? || Rails.env.staging? || Rails.env.test?
          render_error(code: "FORBIDDEN", message: "Demo endpoint not available in production", status: :forbidden)
          return
        end

        location_id = params[:location_id] || "daimon"
        location = RainbowAlertJob::MONITORING_LOCATIONS.find { |l| l[:id] == location_id }

        unless location
          render_error(code: "NOT_FOUND", message: "Location not found", status: :not_found)
          return
        end

        moment = RainbowMoment.create_for_alert(
          location: location,
          weather_data: demo_weather_data
        )

        # Broadcast to all connected clients that a moment started
        ActionCable.server.broadcast("rainbow_moments:global", {
          type: "moment_started",
          moment: serialize_moment(moment)
        })

        render_success(data: { moment: serialize_moment(moment) }, status: :created)
      end

      private

      def set_moment
        @moment = RainbowMoment.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render_error(code: "NOT_FOUND", message: "Moment not found", status: :not_found)
      end

      def serialize_moment(moment, detailed: false)
        data = {
          id: moment.id,
          locationId: moment.location_id,
          locationName: moment.location_name,
          status: moment.status,
          startsAt: moment.starts_at.iso8601,
          endsAt: moment.ends_at.iso8601,
          participantsCount: moment.active_participants_count,
          photosCount: moment.photos.count,
          weatherSnapshot: moment.weather_snapshot
        }

        if detailed
          data[:participants] = moment.participations.active.includes(:user).limit(50).map do |p|
            { id: p.user.id, displayName: p.user.display_name, joinedAt: p.joined_at.iso8601 }
          end
        end

        data
      end

      def demo_weather_data
        {
          temperature: 18.5,
          humidity: 72,
          cloud_cover: 45,
          sun_altitude: 25.0,
          weather_code: "500",
          weather_description: "light rain",
          visibility: 8000,
          rain_1h: 1.2
        }
      end
    end
  end
end
