class AddDeletedAtToPhotos < ActiveRecord::Migration[8.0]
  def change
    add_column :photos, :deleted_at, :datetime
  end
end
