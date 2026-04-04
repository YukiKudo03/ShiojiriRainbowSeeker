# frozen_string_literal: true

class AddUniqueIndexToActiveRainbowMoments < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    # Partial unique index: only one active moment per location
    add_index :rainbow_moments, :location_id, algorithm: :concurrently,
              unique: true,
              where: "status = 'active'",
              name: "index_rainbow_moments_unique_active_per_location"
  end
end
