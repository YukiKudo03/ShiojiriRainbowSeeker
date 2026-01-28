# frozen_string_literal: true

# Migration to create the notifications table.
# Stores in-app notifications for users.
#
# Features:
# - UUID primary key
# - Notification type enum for categorization
# - JSONB data field for flexible notification payloads
# - Read status tracking
#
class CreateNotifications < ActiveRecord::Migration[8.0]
  def change
    create_table :notifications, id: :uuid do |t|
      # Foreign key to the recipient user
      t.references :user, type: :uuid, foreign_key: true, null: false

      # Notification categorization
      t.integer :notification_type, null: false

      # Notification content
      t.string :title
      t.text :body

      # Flexible payload for notification-specific data
      t.jsonb :data, default: {}

      # Read status
      t.boolean :is_read, default: false

      # Timestamps
      t.timestamps
    end
  end
end
