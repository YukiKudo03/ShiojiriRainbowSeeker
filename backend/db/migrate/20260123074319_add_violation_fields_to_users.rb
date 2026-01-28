# frozen_string_literal: true

# Migration to add violation tracking fields to users table.
#
# These fields support content moderation features:
# - violation_flagged: Boolean flag set when user has 3+ violations
# - violation_count: Running count of resolved reports against user's content
#
# Requirements:
# - FR-10: Content Moderation (AC-10.3: Flag users with 3+ violations)
#
class AddViolationFieldsToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :violation_flagged, :boolean, default: false, null: false
    add_column :users, :violation_count, :integer, default: 0, null: false

    add_index :users, :violation_flagged, where: "violation_flagged = true"
  end
end
