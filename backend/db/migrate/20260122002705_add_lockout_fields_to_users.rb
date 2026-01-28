# frozen_string_literal: true

# Migration to add lockout fields to users table for account security.
#
# These fields support the custom lockout logic in AuthService:
# - failed_attempts: Tracks consecutive failed login attempts
# - locked_at: Records when the account was locked (30 min lockout after 5 failures)
#
class AddLockoutFieldsToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :failed_attempts, :integer, default: 0, null: false
    add_column :users, :locked_at, :datetime
  end
end
