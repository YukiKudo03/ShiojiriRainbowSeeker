# frozen_string_literal: true

# Migration to create the radar_data table for weather radar information.
# Stores precipitation radar data associated with photo submissions.
#
# Features:
# - UUID primary key
# - PostGIS geography point for radar center location
# - JSONB storage for precipitation area polygons
# - Movement tracking for precipitation patterns
#
# Note: This table is created before weather_conditions because
# weather_conditions has an optional reference to radar_data.
#
class CreateRadarData < ActiveRecord::Migration[8.0]
  def change
    create_table :radar_data, id: :uuid do |t|
      # Foreign key to photos
      t.references :photo, type: :uuid, foreign_key: true, null: false

      # Radar observation timestamp
      t.datetime :timestamp, null: false

      # Center location of radar observation
      t.st_point :center_location, geographic: true, srid: 4326

      # Observation area radius (in meters or kilometers)
      t.decimal :radius

      # Precipitation data
      t.decimal :precipitation_intensity
      t.jsonb :precipitation_area

      # Movement vector for precipitation patterns
      t.decimal :movement_direction
      t.decimal :movement_speed

      # Timestamp (created_at only, no updated_at as radar data is immutable)
      t.datetime :created_at
    end
  end
end
