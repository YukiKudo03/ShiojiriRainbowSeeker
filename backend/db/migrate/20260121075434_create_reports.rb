# frozen_string_literal: true

# Migration to create the reports table for content moderation.
# Supports polymorphic associations to report different content types.
#
# Features:
# - UUID primary key
# - Polymorphic reportable association (can report photos, comments, etc.)
# - Reporter and resolver references to users table
# - Status tracking for report workflow
#
class CreateReports < ActiveRecord::Migration[8.0]
  def change
    create_table :reports, id: :uuid do |t|
      # Foreign key to the reporting user
      t.references :reporter, type: :uuid, foreign_key: { to_table: :users }, null: false

      # Polymorphic association to the reported content
      t.string :reportable_type, null: false
      t.uuid :reportable_id, null: false

      # Foreign key to the admin who resolved the report (optional)
      t.references :resolved_by, type: :uuid, foreign_key: { to_table: :users }

      # Report workflow status
      t.integer :status, default: 0

      # Report details
      t.text :reason
      t.text :admin_note

      # Timestamps
      t.timestamps
    end

    # Index for polymorphic association lookups
    add_index :reports, [ :reportable_type, :reportable_id ]
  end
end
