# frozen_string_literal: true

# Migration to add deleted_user_display_name field to comments table.
#
# When a user is deleted, their comments are anonymized by setting user_id to null
# and storing the placeholder name in this field. This allows the application
# to display "deleted user" for anonymized comments.
#
# == Requirements Reference
# - FR-12: Data export and deletion (GDPR compliance)
# - AC-12.3: Comments anonymized as "deleted user" upon account deletion
#
class AddDeletedUserDisplayNameToComments < ActiveRecord::Migration[8.0]
  def change
    add_column :comments, :deleted_user_display_name, :string

    # Index for finding anonymized comments
    add_index :comments, :deleted_user_display_name, where: "deleted_user_display_name IS NOT NULL"
  end
end
