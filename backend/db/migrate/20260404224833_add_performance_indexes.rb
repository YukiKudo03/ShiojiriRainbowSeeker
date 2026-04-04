# frozen_string_literal: true

class AddPerformanceIndexes < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    # Photos: moderation_status used in .visible scope and admin queries
    add_index :photos, :moderation_status, algorithm: :concurrently,
              if_not_exists: true

    # Photos: soft delete queries
    add_index :photos, :deleted_at, algorithm: :concurrently,
              if_not_exists: true,
              where: "deleted_at IS NOT NULL",
              name: "index_photos_on_deleted_at_not_null"

    # Comments: pagination by photo ordered by created_at
    add_index :comments, [:photo_id, :created_at], algorithm: :concurrently,
              if_not_exists: true,
              order: { created_at: :desc },
              name: "index_comments_on_photo_id_and_created_at_desc"

    # Weather conditions: time-series queries per photo
    add_index :weather_conditions, [:photo_id, :timestamp], algorithm: :concurrently,
              if_not_exists: true,
              order: { timestamp: :desc },
              name: "index_weather_conditions_on_photo_timestamp"

    # Radar data: time-series queries per photo
    add_index :radar_data, [:photo_id, :timestamp], algorithm: :concurrently,
              if_not_exists: true,
              order: { timestamp: :desc },
              name: "index_radar_data_on_photo_timestamp"

    # Notifications: unread notification queries per user
    add_index :notifications, [:user_id, :is_read, :created_at], algorithm: :concurrently,
              if_not_exists: true,
              order: { created_at: :desc },
              name: "index_notifications_on_user_read_created"

    # Reports: filtering by status
    add_index :reports, [:status, :created_at], algorithm: :concurrently,
              if_not_exists: true,
              order: { created_at: :desc },
              name: "index_reports_on_status_created"
  end
end
