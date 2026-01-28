# frozen_string_literal: true

# =============================================================================
# Monitoring Rake Tasks
# =============================================================================
# Provides command-line utilities for checking system health and metrics.
#
# Task 56: Monitoring & Logging Setup
# Requirements: NFR-8
#
# Usage:
#   rails monitoring:status           - Show overall system status
#   rails monitoring:database         - Check database health
#   rails monitoring:queue            - Check queue status
#   rails monitoring:cache            - Check cache status
#   rails monitoring:metrics          - Show application metrics
#   rails monitoring:sentry_test      - Test Sentry error reporting
# =============================================================================

namespace :monitoring do
  desc "Show overall system status"
  task status: :environment do
    puts "\n" + "=" * 60
    puts "Shiojiri Rainbow Seeker - System Status"
    puts "=" * 60
    puts "Timestamp: #{Time.current.iso8601}"
    puts "Environment: #{Rails.env}"
    puts "Ruby: #{RUBY_VERSION}"
    puts "Rails: #{Rails.version}"
    puts

    # Check all systems
    Rake::Task["monitoring:database"].invoke
    puts
    Rake::Task["monitoring:queue"].invoke
    puts
    Rake::Task["monitoring:cache"].invoke
    puts
    Rake::Task["monitoring:metrics"].invoke

    puts "\n" + "=" * 60
  end

  desc "Check database health"
  task database: :environment do
    puts "Database Status"
    puts "-" * 40

    begin
      start_time = Time.current
      ActiveRecord::Base.connection.execute("SELECT 1")
      response_time = ((Time.current - start_time) * 1000).round(2)

      puts "  Status: ✓ Healthy"
      puts "  Response Time: #{response_time}ms"
      puts "  Adapter: #{ActiveRecord::Base.connection.adapter_name}"
      puts "  Database: #{ActiveRecord::Base.connection.current_database}"

      # Check PostGIS
      begin
        postgis = ActiveRecord::Base.connection.execute("SELECT PostGIS_Version()").first["postgis_version"]
        puts "  PostGIS: #{postgis}"
      rescue StandardError
        puts "  PostGIS: Not available"
      end

      # Connection pool info
      pool = ActiveRecord::Base.connection_pool
      puts "  Pool Size: #{pool.size}"
      puts "  Connections In Use: #{pool.connections.count(&:in_use?)}"
      puts "  Connections Available: #{pool.size - pool.connections.count(&:in_use?)}"

      # Migration status
      if ActiveRecord::Base.connection.table_exists?("schema_migrations")
        migration_count = ActiveRecord::SchemaMigration.count
        pending = ActiveRecord::Base.connection.migration_context.migrations.count - migration_count
        puts "  Migrations Applied: #{migration_count}"
        puts "  Pending Migrations: #{pending}" if pending > 0
      end
    rescue StandardError => e
      puts "  Status: ✗ Unhealthy"
      puts "  Error: #{e.message}"
    end
  end

  desc "Check queue status"
  task queue: :environment do
    puts "Queue Status (Solid Queue)"
    puts "-" * 40

    if defined?(SolidQueue)
      begin
        pending = SolidQueue::Job.where(finished_at: nil).count
        failed = SolidQueue::FailedExecution.count
        scheduled = SolidQueue::ScheduledExecution.count

        puts "  Status: ✓ Active"
        puts "  Pending Jobs: #{pending}"
        puts "  Failed Jobs: #{failed}"
        puts "  Scheduled Jobs: #{scheduled}"

        # Show failed job details
        if failed > 0
          puts "\n  Recent Failed Jobs:"
          SolidQueue::FailedExecution.order(created_at: :desc).limit(5).each do |failure|
            puts "    - #{failure.job.class_name}: #{failure.error&.truncate(50)}"
          end
        end
      rescue StandardError => e
        puts "  Status: ✗ Error"
        puts "  Error: #{e.message}"
      end
    else
      puts "  Status: Not configured"
    end
  end

  desc "Check cache status"
  task cache: :environment do
    puts "Cache Status"
    puts "-" * 40

    begin
      test_key = "monitoring_test_#{SecureRandom.hex(4)}"
      start_time = Time.current

      Rails.cache.write(test_key, "ok", expires_in: 10.seconds)
      result = Rails.cache.read(test_key)
      Rails.cache.delete(test_key)

      response_time = ((Time.current - start_time) * 1000).round(2)

      if result == "ok"
        puts "  Status: ✓ Healthy"
        puts "  Response Time: #{response_time}ms"
        puts "  Store: #{Rails.cache.class.name}"
      else
        puts "  Status: ✗ Read/Write Failed"
      end
    rescue StandardError => e
      puts "  Status: ✗ Unhealthy"
      puts "  Error: #{e.message}"
    end
  end

  desc "Show application metrics"
  task metrics: :environment do
    puts "Application Metrics"
    puts "-" * 40

    # User metrics
    if defined?(User) && User.table_exists?
      total_users = User.count rescue 0
      active_users = User.where("last_sign_in_at > ?", 7.days.ago).count rescue 0
      puts "  Total Users: #{total_users}"
      puts "  Active Users (7d): #{active_users}"
    end

    # Photo metrics
    if defined?(Photo) && Photo.table_exists?
      total_photos = Photo.count rescue 0
      photos_today = Photo.where("created_at > ?", 24.hours.ago).count rescue 0
      puts "  Total Photos: #{total_photos}"
      puts "  Photos (24h): #{photos_today}"
    end

    # Notification metrics
    if defined?(Notification) && Notification.table_exists?
      unread_notifications = Notification.where(read_at: nil).count rescue 0
      puts "  Unread Notifications: #{unread_notifications}"
    end

    # Report metrics
    if defined?(Report) && Report.table_exists?
      pending_reports = Report.where(status: "pending").count rescue 0
      puts "  Pending Reports: #{pending_reports}"
    end
  end

  desc "Test Sentry error reporting"
  task sentry_test: :environment do
    puts "Testing Sentry Integration"
    puts "-" * 40

    if defined?(Sentry) && Sentry.initialized?
      puts "  Sentry DSN: Configured"
      puts "  Environment: #{Sentry.configuration.environment}"
      puts "  Release: #{Sentry.configuration.release || 'Not set'}"

      # Send a test event
      begin
        Sentry.capture_message("Monitoring test from rake task", level: :info)
        puts "  Test Event: ✓ Sent successfully"
        puts "\n  Check your Sentry dashboard for the test event."
      rescue StandardError => e
        puts "  Test Event: ✗ Failed"
        puts "  Error: #{e.message}"
      end
    else
      puts "  Status: Sentry not initialized"
      puts "  Hint: Set SENTRY_DSN environment variable"
    end
  end

  desc "Generate health report JSON"
  task report: :environment do
    report = {
      timestamp: Time.current.iso8601,
      environment: Rails.env,
      version: ENV.fetch("GIT_COMMIT_SHA") { `git rev-parse --short HEAD 2>/dev/null`.strip.presence || "unknown" },
      checks: {}
    }

    # Database check
    begin
      ActiveRecord::Base.connection.execute("SELECT 1")
      report[:checks][:database] = { status: "healthy" }
    rescue StandardError => e
      report[:checks][:database] = { status: "unhealthy", error: e.message }
    end

    # Queue check
    if defined?(SolidQueue)
      begin
        pending = SolidQueue::Job.where(finished_at: nil).count
        failed = SolidQueue::FailedExecution.count
        report[:checks][:queue] = { status: "healthy", pending_jobs: pending, failed_jobs: failed }
      rescue StandardError => e
        report[:checks][:queue] = { status: "unhealthy", error: e.message }
      end
    end

    # Cache check
    begin
      test_key = "health_#{SecureRandom.hex(4)}"
      Rails.cache.write(test_key, "ok", expires_in: 5.seconds)
      result = Rails.cache.read(test_key)
      Rails.cache.delete(test_key)
      report[:checks][:cache] = { status: result == "ok" ? "healthy" : "degraded" }
    rescue StandardError => e
      report[:checks][:cache] = { status: "unhealthy", error: e.message }
    end

    # Overall status
    report[:status] = report[:checks].values.all? { |c| c[:status] == "healthy" } ? "healthy" : "degraded"

    puts JSON.pretty_generate(report)
  end

  desc "Show slow queries (from logs)"
  task slow_queries: :environment do
    puts "Slow Query Analysis"
    puts "-" * 40
    puts "Note: Enable SLOW_QUERY_THRESHOLD in instrumentation.rb"
    puts "Current threshold: #{ApplicationInstrumentation::DatabaseQuerySubscriber::SLOW_QUERY_THRESHOLD rescue 500}ms"
    puts "\nCheck application logs for 'slow_query' events."
  end
end
