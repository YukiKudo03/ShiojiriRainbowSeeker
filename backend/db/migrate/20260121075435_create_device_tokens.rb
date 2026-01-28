# frozen_string_literal: true

# Migration to create the device_tokens table for push notifications.
# Stores FCM/APNs device tokens for sending push notifications.
#
# Features:
# - UUID primary key
# - Unique constraint on token to prevent duplicates
# - Platform field to distinguish iOS and Android devices
# - Active status flag to manage token lifecycle
#
class CreateDeviceTokens < ActiveRecord::Migration[8.0]
  def change
    create_table :device_tokens, id: :uuid do |t|
      # Foreign key to the user who owns this device
      t.references :user, type: :uuid, foreign_key: true, null: false

      # Push notification token (FCM or APNs)
      t.string :token, null: false

      # Platform identifier ('ios' or 'android')
      t.string :platform, null: false

      # Active status (set to false when token becomes invalid)
      t.boolean :is_active, default: true

      # Timestamps
      t.timestamps
    end

    # Unique constraint on token to prevent duplicate registrations
    add_index :device_tokens, :token, unique: true
  end
end
