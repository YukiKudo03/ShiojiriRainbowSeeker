# frozen_string_literal: true

# Migration to create the comments table.
# Stores user comments on rainbow photos.
#
# Features:
# - UUID primary key
# - References to both user (commenter) and photo
# - Visibility flag for soft moderation
#
class CreateComments < ActiveRecord::Migration[8.0]
  def change
    create_table :comments, id: :uuid do |t|
      # Foreign key to the commenting user
      t.references :user, type: :uuid, foreign_key: true, null: false

      # Foreign key to the photo being commented on
      t.references :photo, type: :uuid, foreign_key: true, null: false

      # Comment content
      t.text :content, null: false

      # Visibility flag (for moderation)
      t.boolean :is_visible, default: true

      # Timestamps
      t.timestamps
    end
  end
end
