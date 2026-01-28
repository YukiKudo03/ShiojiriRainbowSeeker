# frozen_string_literal: true

# Migration to create the photos table with PostGIS geography support.
# This is the core content table for rainbow photo submissions.
#
# Features:
# - UUID primary key
# - PostGIS geography point for precise geolocation (SRID 4326 / WGS84)
# - GiST spatial index for efficient geographic queries
# - Counter caches for likes and comments
# - Moderation status tracking
#
class CreatePhotos < ActiveRecord::Migration[8.0]
  def change
    create_table :photos, id: :uuid do |t|
      # Foreign key to users
      t.references :user, type: :uuid, foreign_key: true, null: false

      # Content fields
      t.string :title, limit: 100
      t.text :description

      # Geographic location using PostGIS geography type
      # SRID 4326 = WGS84 coordinate system (standard GPS coordinates)
      t.st_point :location, geographic: true, srid: 4326, null: false

      # Additional location metadata
      t.decimal :altitude
      t.decimal :accuracy
      t.string :location_name

      # Capture timestamp (when photo was taken, not uploaded)
      t.datetime :captured_at, null: false

      # Counter caches for performance
      t.integer :like_count, default: 0
      t.integer :comment_count, default: 0

      # Visibility and moderation
      t.boolean :is_visible, default: true
      t.integer :moderation_status, default: 1

      # Timestamps
      t.timestamps
    end

    # GiST index for efficient spatial queries (e.g., finding nearby photos)
    add_index :photos, :location, using: :gist

    # Index for time-based queries
    add_index :photos, :captured_at

    # Index for user's photos lookup - already created by t.references above
  end
end
