# frozen_string_literal: true

# Migration to create the likes table.
# Tracks which users have liked which photos.
#
# Features:
# - UUID primary key
# - Unique constraint on user_id + photo_id to prevent duplicate likes
# - Only created_at timestamp (likes are not edited)
#
class CreateLikes < ActiveRecord::Migration[8.0]
  def change
    create_table :likes, id: :uuid do |t|
      # Foreign key to the liking user
      t.references :user, type: :uuid, foreign_key: true, null: false

      # Foreign key to the liked photo
      t.references :photo, type: :uuid, foreign_key: true, null: false

      # Timestamp (created_at only, likes are not updated)
      t.datetime :created_at
    end

    # Unique constraint to prevent duplicate likes
    add_index :likes, [ :user_id, :photo_id ], unique: true
  end
end
