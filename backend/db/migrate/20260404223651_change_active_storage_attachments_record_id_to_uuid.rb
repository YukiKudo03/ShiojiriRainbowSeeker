# frozen_string_literal: true

class ChangeActiveStorageAttachmentsRecordIdToUuid < ActiveRecord::Migration[8.0]
  def up
    remove_index :active_storage_attachments,
                 name: "index_active_storage_attachments_uniqueness"

    change_column :active_storage_attachments, :record_id, :uuid,
                  null: false, using: "gen_random_uuid()"

    add_index :active_storage_attachments,
              [:record_type, :record_id, :name, :blob_id],
              name: "index_active_storage_attachments_uniqueness",
              unique: true
  end

  def down
    remove_index :active_storage_attachments,
                 name: "index_active_storage_attachments_uniqueness"

    change_column :active_storage_attachments, :record_id, :bigint, null: false

    add_index :active_storage_attachments,
              [:record_type, :record_id, :name, :blob_id],
              name: "index_active_storage_attachments_uniqueness",
              unique: true
  end
end
