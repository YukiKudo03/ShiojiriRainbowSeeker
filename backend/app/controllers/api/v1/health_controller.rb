# frozen_string_literal: true

# =============================================================================
# Health Check Controller
# =============================================================================
# Provides detailed health check endpoints for monitoring and load balancers.
#
# Task 56: Monitoring & Logging Setup
# Requirements: NFR-8
#
# Endpoints:
#   GET /api/v1/health       - Detailed health status (authenticated)
#   GET /api/v1/health/ready - Readiness probe (Kubernetes/Kamal)
#   GET /api/v1/health/live  - Liveness probe (Kubernetes/Kamal)
# =============================================================================

module Api
  module V1
    class HealthController < ApplicationController
      # Health checks are public endpoints - no authentication required

      # Detailed health check (requires authentication for security)
      # Returns comprehensive system status
      def show
        health_data = collect_health_data

        status = health_data[:status] == "healthy" ? :ok : :service_unavailable

        render json: health_data, status: status
      end

      # Readiness probe - Is the app ready to serve traffic?
      # Use for Kubernetes readinessProbe or Kamal health checks
      def ready
        if ready_to_serve?
          render json: { status: "ready", timestamp: Time.current.iso8601 }, status: :ok
        else
          render json: { status: "not_ready", timestamp: Time.current.iso8601 }, status: :service_unavailable
        end
      end

      # Liveness probe - Is the app alive?
      # Use for Kubernetes livenessProbe
      def live
        render json: { status: "alive", timestamp: Time.current.iso8601 }, status: :ok
      end

      private

      def collect_health_data
        checks = {}
        overall_healthy = true

        # Database check
        checks[:database] = check_database
        overall_healthy = false unless checks[:database][:status] == "healthy"

        # Redis/Solid Cache check
        checks[:cache] = check_cache
        # Cache is optional, don't fail health check

        # Solid Queue check
        checks[:queue] = check_queue
        # Queue is optional, don't fail health check

        # External services (optional)
        checks[:external_services] = check_external_services

        # System resources
        checks[:system] = check_system_resources

        {
          status: overall_healthy ? "healthy" : "unhealthy",
          timestamp: Time.current.iso8601,
          version: app_version,
          environment: Rails.env,
          uptime: process_uptime,
          checks: checks
        }
      end

      def check_database
        start_time = Time.current
        ActiveRecord::Base.connection.execute("SELECT 1")
        response_time = ((Time.current - start_time) * 1000).round(2)

        # Check PostGIS extension
        postgis_version = ActiveRecord::Base.connection.execute("SELECT PostGIS_Version()").first["postgis_version"] rescue nil

        {
          status: "healthy",
          response_time_ms: response_time,
          adapter: ActiveRecord::Base.connection.adapter_name,
          database: ActiveRecord::Base.connection.current_database,
          postgis_version: postgis_version,
          pool_size: ActiveRecord::Base.connection_pool.size,
          connections_in_use: ActiveRecord::Base.connection_pool.connections.count(&:in_use?)
        }
      rescue StandardError => e
        {
          status: "unhealthy",
          error: e.message.truncate(100)
        }
      end

      def check_cache
        start_time = Time.current
        test_key = "health_check_#{SecureRandom.hex(8)}"

        Rails.cache.write(test_key, "ok", expires_in: 10.seconds)
        result = Rails.cache.read(test_key)
        Rails.cache.delete(test_key)

        response_time = ((Time.current - start_time) * 1000).round(2)

        if result == "ok"
          {
            status: "healthy",
            response_time_ms: response_time,
            store: Rails.cache.class.name
          }
        else
          {
            status: "degraded",
            message: "Cache read/write failed"
          }
        end
      rescue StandardError => e
        {
          status: "unhealthy",
          error: e.message.truncate(100)
        }
      end

      def check_queue
        if defined?(SolidQueue)
          # Check Solid Queue status
          pending_jobs = SolidQueue::Job.where(finished_at: nil).count rescue nil
          failed_jobs = SolidQueue::FailedExecution.count rescue nil

          {
            status: "healthy",
            queue_system: "SolidQueue",
            pending_jobs: pending_jobs,
            failed_jobs: failed_jobs
          }
        else
          {
            status: "unknown",
            message: "Queue system not configured"
          }
        end
      rescue StandardError => e
        {
          status: "unhealthy",
          error: e.message.truncate(100)
        }
      end

      def check_external_services
        services = {}

        # Check S3 connectivity (if configured)
        if ENV["AWS_ACCESS_KEY_ID"].present?
          services[:s3] = check_s3
        end

        # Check weather API (if configured)
        if ENV["OPENWEATHER_API_KEY"].present?
          services[:weather_api] = { status: "configured" }
        end

        # Check Sentry (if configured)
        if defined?(Sentry) && Sentry.initialized?
          services[:sentry] = { status: "configured" }
        end

        services.presence || { status: "none_configured" }
      end

      def check_s3
        # Simple S3 connectivity check
        s3_client = Aws::S3::Client.new
        s3_client.list_buckets(max_keys: 1)

        { status: "healthy" }
      rescue StandardError => e
        { status: "unhealthy", error: e.message.truncate(50) }
      end

      def check_system_resources
        memory_info = memory_usage
        disk_info = disk_usage

        {
          memory: memory_info,
          disk: disk_info,
          ruby_version: RUBY_VERSION,
          rails_version: Rails.version,
          puma_workers: ENV.fetch("WEB_CONCURRENCY", 1).to_i,
          puma_threads: ENV.fetch("RAILS_MAX_THREADS", 5).to_i
        }
      end

      def memory_usage
        # Get Ruby process memory usage
        if File.exist?("/proc/self/status")
          status = File.read("/proc/self/status")
          vm_rss = status.match(/VmRSS:\s+(\d+)\s+kB/)&.captures&.first&.to_i
          { rss_mb: (vm_rss / 1024.0).round(2) } if vm_rss
        else
          # macOS fallback
          pid = Process.pid
          rss = `ps -o rss= -p #{pid}`.strip.to_i rescue nil
          { rss_mb: (rss / 1024.0).round(2) } if rss
        end
      rescue StandardError
        { status: "unknown" }
      end

      def disk_usage
        # Get storage volume disk usage
        if File.exist?("/rails/storage")
          stat = `df -h /rails/storage 2>/dev/null | tail -1`.strip.split rescue nil
          if stat && stat.length >= 5
            { used: stat[2], available: stat[3], percent_used: stat[4] }
          end
        end
      rescue StandardError
        { status: "unknown" }
      end

      def ready_to_serve?
        # Check if database is accessible
        ActiveRecord::Base.connection.execute("SELECT 1")
        true
      rescue StandardError
        false
      end

      def app_version
        ENV.fetch("GIT_COMMIT_SHA") { `git rev-parse --short HEAD 2>/dev/null`.strip.presence || "unknown" }
      end

      def process_uptime
        # Calculate process uptime
        if defined?(@process_start_time)
          seconds = (Time.current - @process_start_time).to_i
        else
          @process_start_time ||= Time.current
          seconds = 0
        end

        format_duration(seconds)
      end

      def format_duration(seconds)
        days = seconds / 86400
        hours = (seconds % 86400) / 3600
        minutes = (seconds % 3600) / 60

        parts = []
        parts << "#{days}d" if days > 0
        parts << "#{hours}h" if hours > 0
        parts << "#{minutes}m" if minutes > 0
        parts << "#{seconds % 60}s"

        parts.join(" ")
      end
    end
  end
end
