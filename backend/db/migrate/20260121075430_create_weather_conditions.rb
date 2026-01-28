# frozen_string_literal: true

# Migration to create the weather_conditions table.
# Stores detailed weather information at the time and location of photo capture.
#
# Features:
# - UUID primary key
# - Required reference to photo
# - Optional reference to radar_data
# - Comprehensive weather metrics (temperature, humidity, wind, etc.)
# - Sun position data for rainbow prediction
#
class CreateWeatherConditions < ActiveRecord::Migration[8.0]
  def change
    create_table :weather_conditions, id: :uuid do |t|
      # Required reference to the associated photo
      t.references :photo, type: :uuid, foreign_key: true, null: false

      # Optional reference to radar data
      t.references :radar_datum, type: :uuid, foreign_key: true

      # Weather observation timestamp
      t.datetime :timestamp, null: false

      # Temperature and humidity
      t.decimal :temperature
      t.decimal :humidity

      # Atmospheric pressure
      t.decimal :pressure

      # Weather condition codes
      t.string :weather_code
      t.string :weather_description

      # Wind data
      t.decimal :wind_speed
      t.decimal :wind_direction
      t.decimal :wind_gust

      # Precipitation data
      t.decimal :precipitation
      t.string :precipitation_type

      # Visibility conditions
      t.decimal :cloud_cover
      t.decimal :visibility

      # Sun position (important for rainbow visibility)
      t.decimal :sun_azimuth
      t.decimal :sun_altitude

      # Timestamp (created_at only, weather data is immutable)
      t.datetime :created_at
    end
  end
end
