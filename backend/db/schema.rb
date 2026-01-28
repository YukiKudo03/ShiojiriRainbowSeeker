# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.0].define(version: 2026_01_25_124252) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"
  enable_extension "pgcrypto"
  enable_extension "postgis"

  create_table "active_storage_attachments", force: :cascade do |t|
    t.string "name", null: false
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.string "service_name", null: false
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "comments", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id"
    t.uuid "photo_id", null: false
    t.text "content", null: false
    t.boolean "is_visible", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "deleted_user_display_name"
    t.index ["deleted_user_display_name"], name: "index_comments_on_deleted_user_display_name", where: "(deleted_user_display_name IS NOT NULL)"
    t.index ["photo_id"], name: "index_comments_on_photo_id"
    t.index ["user_id"], name: "index_comments_on_user_id"
  end

  create_table "device_tokens", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.string "token", null: false
    t.string "platform", null: false
    t.boolean "is_active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["token"], name: "index_device_tokens_on_token", unique: true
    t.index ["user_id"], name: "index_device_tokens_on_user_id"
  end

  create_table "jwt_denylists", force: :cascade do |t|
    t.string "jti", null: false
    t.datetime "exp", null: false
    t.index ["jti"], name: "index_jwt_denylists_on_jti"
  end

  create_table "likes", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.uuid "photo_id", null: false
    t.datetime "created_at"
    t.index ["photo_id"], name: "index_likes_on_photo_id"
    t.index ["user_id", "photo_id"], name: "index_likes_on_user_id_and_photo_id", unique: true
    t.index ["user_id"], name: "index_likes_on_user_id"
  end

  create_table "notifications", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.integer "notification_type", null: false
    t.string "title"
    t.text "body"
    t.jsonb "data", default: {}
    t.boolean "is_read", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_notifications_on_user_id"
  end

  create_table "photos", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.string "title", limit: 100
    t.text "description"
    t.geography "location", limit: {:srid=>4326, :type=>"st_point", :geographic=>true}, null: false
    t.decimal "altitude"
    t.decimal "accuracy"
    t.string "location_name"
    t.datetime "captured_at", null: false
    t.integer "like_count", default: 0
    t.integer "comment_count", default: 0
    t.boolean "is_visible", default: true
    t.integer "moderation_status", default: 1
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.datetime "deleted_at"
    t.index ["captured_at"], name: "index_photos_on_captured_at"
    t.index ["location"], name: "index_photos_on_location", using: :gist
    t.index ["user_id"], name: "index_photos_on_user_id"
  end

  create_table "radar_data", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "photo_id", null: false
    t.datetime "timestamp", null: false
    t.geography "center_location", limit: {:srid=>4326, :type=>"st_point", :geographic=>true}
    t.decimal "radius"
    t.decimal "precipitation_intensity"
    t.jsonb "precipitation_area"
    t.decimal "movement_direction"
    t.decimal "movement_speed"
    t.datetime "created_at"
    t.index ["photo_id"], name: "index_radar_data_on_photo_id"
  end

  create_table "reports", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "reporter_id", null: false
    t.string "reportable_type", null: false
    t.uuid "reportable_id", null: false
    t.uuid "resolved_by_id"
    t.integer "status", default: 0
    t.text "reason"
    t.text "admin_note"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["reportable_type", "reportable_id"], name: "index_reports_on_reportable_type_and_reportable_id"
    t.index ["reporter_id"], name: "index_reports_on_reporter_id"
    t.index ["resolved_by_id"], name: "index_reports_on_resolved_by_id"
  end

  create_table "users", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "email", null: false
    t.string "encrypted_password", null: false
    t.string "display_name", limit: 30, null: false
    t.integer "role", default: 0
    t.jsonb "notification_settings", default: {}
    t.string "locale", limit: 5, default: "ja"
    t.string "reset_password_token"
    t.datetime "reset_password_sent_at"
    t.datetime "remember_created_at"
    t.string "confirmation_token"
    t.datetime "confirmed_at"
    t.datetime "confirmation_sent_at"
    t.string "unconfirmed_email"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.datetime "deleted_at"
    t.integer "failed_attempts", default: 0, null: false
    t.datetime "locked_at"
    t.boolean "violation_flagged", default: false, null: false
    t.integer "violation_count", default: 0, null: false
    t.datetime "deletion_requested_at"
    t.datetime "deletion_scheduled_at"
    t.string "deletion_job_id"
    t.index ["confirmation_token"], name: "index_users_on_confirmation_token", unique: true
    t.index ["deletion_scheduled_at"], name: "index_users_on_deletion_scheduled_at", where: "(deletion_scheduled_at IS NOT NULL)"
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
    t.index ["violation_flagged"], name: "index_users_on_violation_flagged", where: "(violation_flagged = true)"
  end

  create_table "weather_conditions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "photo_id", null: false
    t.uuid "radar_datum_id"
    t.datetime "timestamp", null: false
    t.decimal "temperature"
    t.decimal "humidity"
    t.decimal "pressure"
    t.string "weather_code"
    t.string "weather_description"
    t.decimal "wind_speed"
    t.decimal "wind_direction"
    t.decimal "wind_gust"
    t.decimal "precipitation"
    t.string "precipitation_type"
    t.decimal "cloud_cover"
    t.decimal "visibility"
    t.decimal "sun_azimuth"
    t.decimal "sun_altitude"
    t.datetime "created_at"
    t.index ["photo_id"], name: "index_weather_conditions_on_photo_id"
    t.index ["radar_datum_id"], name: "index_weather_conditions_on_radar_datum_id"
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "comments", "photos"
  add_foreign_key "comments", "users"
  add_foreign_key "device_tokens", "users"
  add_foreign_key "likes", "photos"
  add_foreign_key "likes", "users"
  add_foreign_key "notifications", "users"
  add_foreign_key "photos", "users"
  add_foreign_key "radar_data", "photos"
  add_foreign_key "reports", "users", column: "reporter_id"
  add_foreign_key "reports", "users", column: "resolved_by_id"
  add_foreign_key "weather_conditions", "photos"
  add_foreign_key "weather_conditions", "radar_data"
end
