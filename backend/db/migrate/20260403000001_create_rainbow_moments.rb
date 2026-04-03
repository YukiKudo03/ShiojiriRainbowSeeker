# frozen_string_literal: true

class CreateRainbowMoments < ActiveRecord::Migration[8.0]
  def change
    create_table :rainbow_moments, id: :uuid do |t|
      t.datetime :starts_at, null: false
      t.datetime :ends_at, null: false
      t.string :location_id, null: false
      t.string :status, null: false, default: "active"
      t.jsonb :weather_snapshot, default: {}
      t.integer :participants_count, default: 0, null: false
      t.integer :photos_count, default: 0, null: false

      t.timestamps
    end

    add_index :rainbow_moments, :location_id
    add_index :rainbow_moments, :status
    add_index :rainbow_moments, :starts_at

    create_table :rainbow_moment_participations, id: :uuid do |t|
      t.references :rainbow_moment, type: :uuid, null: false, foreign_key: true
      t.references :user, type: :uuid, null: false, foreign_key: true
      t.datetime :joined_at, null: false
      t.datetime :left_at

      t.timestamps
    end

    add_index :rainbow_moment_participations,
              %i[rainbow_moment_id user_id],
              unique: true,
              name: "idx_moment_participations_unique"
  end
end
