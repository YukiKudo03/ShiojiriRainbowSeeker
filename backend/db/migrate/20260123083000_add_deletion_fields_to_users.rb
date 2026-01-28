# frozen_string_literal: true

# Migration to add account deletion fields to users table.
#
# These fields support the GDPR-compliant account deletion workflow:
# - deletion_requested_at: When the user requested deletion
# - deletion_scheduled_at: When the deletion will be executed (14 days after request)
# - deletion_job_id: The Solid Queue job ID for cancellation purposes
#
# == Requirements Reference
# - FR-12: Data export and deletion (GDPR compliance)
# - AC-12.2: 14-day grace period for account deletion
#
class AddDeletionFieldsToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :deletion_requested_at, :datetime
    add_column :users, :deletion_scheduled_at, :datetime
    add_column :users, :deletion_job_id, :string

    # Index for finding users with pending deletions
    add_index :users, :deletion_scheduled_at, where: "deletion_scheduled_at IS NOT NULL"
  end
end
