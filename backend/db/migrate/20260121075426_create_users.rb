# frozen_string_literal: true

# Migration to create the users table with UUID primary key and Devise support.
# This is the core authentication table for the Shiojiri Rainbow Seeker application.
#
# Features:
# - UUID primary key (using pgcrypto extension)
# - Devise authentication columns (confirmable, recoverable)
# - Soft delete support via deleted_at
# - Notification settings stored as JSONB
# - Role-based access control via integer enum
#
class CreateUsers < ActiveRecord::Migration[8.0]
  def change
    create_table :users, id: :uuid do |t|
      # Core authentication fields
      t.string :email, null: false
      t.string :encrypted_password, null: false

      # Profile fields
      t.string :display_name, null: false, limit: 30
      t.integer :role, default: 0
      t.jsonb :notification_settings, default: {}
      t.string :locale, default: "ja", limit: 5

      # Devise recoverable
      t.string :reset_password_token
      t.datetime :reset_password_sent_at

      # Devise rememberable
      t.datetime :remember_created_at

      # Devise confirmable
      t.string :confirmation_token
      t.datetime :confirmed_at
      t.datetime :confirmation_sent_at
      t.string :unconfirmed_email

      # Timestamps
      t.timestamps

      # Soft delete
      t.datetime :deleted_at
    end

    # Indexes for unique constraints and performance
    add_index :users, :email, unique: true
    add_index :users, :reset_password_token, unique: true
    add_index :users, :confirmation_token, unique: true
  end
end
