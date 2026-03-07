# frozen_string_literal: true

# Add LINE user ID to users for LINE Messaging API integration.
# This enables sending rainbow alerts and social notifications via LINE.
class AddLineUserIdToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :line_user_id, :string
    add_index :users, :line_user_id, unique: true, where: "line_user_id IS NOT NULL"
  end
end
