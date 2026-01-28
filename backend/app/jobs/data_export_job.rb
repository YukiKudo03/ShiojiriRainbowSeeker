# frozen_string_literal: true

# DataExportJob handles GDPR-compliant data export for users.
#
# This job collects all user data (profile, photos, comments, likes),
# packages it into a ZIP archive, uploads to storage, and sends a
# download notification via email.
#
# == Queue
# Runs on the 'default' queue via Solid Queue (PostgreSQL-based).
#
# == Retry Policy
# - Retries 3 times on transient errors
# - Exponential backoff: 10s, 30s, 90s
# - Discards job if user is deleted
#
# == ZIP Archive Structure
# user_data_export_[user_id]_[timestamp]/
# +-- profile.json          # User profile data
# +-- photos/
# |   +-- photos.json       # Photo metadata
# |   +-- photo_[id].jpg    # Original photos
# +-- comments.json         # All comments made
# +-- likes.json            # All likes given
#
# == Requirements Reference
# - FR-12: Data export and deletion (GDPR compliance)
# - AC-12.1: Users can export their data as ZIP with 48-hour download link
#
# == Usage
#   DataExportJob.perform_later(user_id)
#
class DataExportJob < ApplicationJob
  queue_as :default

  # Retry on transient errors with exponential backoff
  retry_on StandardError, wait: :polynomially_longer, attempts: 3

  # Retry on Active Storage errors
  retry_on ActiveStorage::Error, wait: 10.seconds, attempts: 3

  # Discard if user no longer exists
  discard_on ActiveRecord::RecordNotFound

  # Download link validity period (48 hours)
  DOWNLOAD_LINK_VALIDITY = 48.hours

  # Main job execution
  #
  # @param user_id [String] UUID of the user requesting data export
  def perform(user_id)
    @user = User.find(user_id)

    Rails.logger.info("[DataExportJob] Starting data export for user #{user_id}")

    Dir.mktmpdir("data_export_#{user_id}") do |temp_dir|
      @export_dir = File.join(temp_dir, export_folder_name)
      FileUtils.mkdir_p(@export_dir)

      # Collect all user data
      export_profile
      export_photos
      export_comments
      export_likes

      # Create ZIP archive
      zip_path = create_zip_archive(temp_dir)

      # Upload to Active Storage and generate download URL
      download_url = upload_and_generate_url(zip_path)

      # Send notification email with download link
      send_notification_email(download_url)

      Rails.logger.info("[DataExportJob] Successfully completed data export for user #{user_id}")
    end
  rescue StandardError => e
    Rails.logger.error("[DataExportJob] Error exporting data for user #{user_id}: #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
    raise
  end

  private

  # Generate export folder name with user ID and timestamp
  #
  # @return [String] folder name in format user_data_export_[id]_[timestamp]
  def export_folder_name
    timestamp = Time.current.strftime("%Y%m%d_%H%M%S")
    "user_data_export_#{@user.id}_#{timestamp}"
  end

  # Export user profile data to JSON
  def export_profile
    Rails.logger.info("[DataExportJob] Exporting profile for user #{@user.id}")

    profile_data = {
      export_date: Time.current.iso8601,
      user: {
        id: @user.id,
        email: @user.email,
        display_name: @user.display_name,
        role: @user.role,
        locale: @user.locale,
        notification_settings: @user.notification_settings,
        created_at: @user.created_at&.iso8601,
        updated_at: @user.updated_at&.iso8601,
        confirmed_at: @user.confirmed_at&.iso8601
      }
    }

    write_json_file("profile.json", profile_data)
  end

  # Export all user photos with images and metadata
  def export_photos
    Rails.logger.info("[DataExportJob] Exporting photos for user #{@user.id}")

    photos_dir = File.join(@export_dir, "photos")
    FileUtils.mkdir_p(photos_dir)

    photos_metadata = []

    @user.photos.includes(:weather_conditions).find_each do |photo|
      # Export photo metadata
      photo_data = {
        id: photo.id,
        title: photo.title,
        description: photo.description,
        captured_at: photo.captured_at&.iso8601,
        location_name: photo.location_name,
        latitude: photo.latitude,
        longitude: photo.longitude,
        like_count: photo.like_count,
        comment_count: photo.comment_count,
        moderation_status: photo.moderation_status,
        created_at: photo.created_at&.iso8601,
        updated_at: photo.updated_at&.iso8601,
        weather_conditions: photo.weather_conditions.map do |wc|
          {
            timestamp: wc.timestamp&.iso8601,
            temperature: wc.temperature,
            humidity: wc.humidity,
            weather_description: wc.weather_description,
            precipitation: wc.precipitation
          }
        end
      }
      photos_metadata << photo_data

      # Export photo image if attached
      export_photo_image(photo, photos_dir)
    end

    write_json_file("photos/photos.json", {
      export_date: Time.current.iso8601,
      total_count: photos_metadata.count,
      photos: photos_metadata
    })
  end

  # Export a single photo image to the photos directory
  #
  # @param photo [Photo] the photo record
  # @param photos_dir [String] path to the photos export directory
  def export_photo_image(photo, photos_dir)
    return unless photo.image.attached?

    begin
      # Determine file extension from content type
      extension = case photo.image.content_type
      when "image/jpeg" then "jpg"
      when "image/png" then "png"
      when "image/gif" then "gif"
      when "image/webp" then "webp"
      when "image/heic", "image/heif" then "heic"
      else "jpg"
      end

      filename = "photo_#{photo.id}.#{extension}"
      file_path = File.join(photos_dir, filename)

      # Download and save the original image
      photo.image.blob.open do |tempfile|
        FileUtils.cp(tempfile.path, file_path)
      end

      Rails.logger.debug("[DataExportJob] Exported photo #{photo.id} to #{filename}")
    rescue StandardError => e
      Rails.logger.warn("[DataExportJob] Failed to export photo #{photo.id} image: #{e.message}")
      # Continue with other photos even if one fails
    end
  end

  # Export all user comments to JSON
  def export_comments
    Rails.logger.info("[DataExportJob] Exporting comments for user #{@user.id}")

    comments_data = @user.comments.includes(:photo).map do |comment|
      {
        id: comment.id,
        content: comment.content,
        photo_id: comment.photo_id,
        photo_title: comment.photo&.title,
        is_visible: comment.is_visible,
        created_at: comment.created_at&.iso8601,
        updated_at: comment.updated_at&.iso8601
      }
    end

    write_json_file("comments.json", {
      export_date: Time.current.iso8601,
      total_count: comments_data.count,
      comments: comments_data
    })
  end

  # Export all user likes to JSON
  def export_likes
    Rails.logger.info("[DataExportJob] Exporting likes for user #{@user.id}")

    likes_data = @user.likes.includes(:photo).map do |like|
      {
        id: like.id,
        photo_id: like.photo_id,
        photo_title: like.photo&.title,
        created_at: like.created_at&.iso8601
      }
    end

    write_json_file("likes.json", {
      export_date: Time.current.iso8601,
      total_count: likes_data.count,
      likes: likes_data
    })
  end

  # Write data to a JSON file in the export directory
  #
  # @param filename [String] relative path within export directory
  # @param data [Hash] data to serialize as JSON
  def write_json_file(filename, data)
    file_path = File.join(@export_dir, filename)
    File.write(file_path, JSON.pretty_generate(data))
  end

  # Create ZIP archive from the export directory
  #
  # @param temp_dir [String] temporary directory containing export folder
  # @return [String] path to the created ZIP file
  def create_zip_archive(temp_dir)
    Rails.logger.info("[DataExportJob] Creating ZIP archive for user #{@user.id}")

    zip_filename = "#{export_folder_name}.zip"
    zip_path = File.join(temp_dir, zip_filename)

    require "zip"

    Zip::File.open(zip_path, Zip::File::CREATE) do |zipfile|
      add_directory_to_zip(zipfile, @export_dir, export_folder_name)
    end

    Rails.logger.info("[DataExportJob] Created ZIP archive: #{zip_path}")
    zip_path
  end

  # Recursively add a directory to a ZIP file
  #
  # @param zipfile [Zip::File] the ZIP file being created
  # @param dir_path [String] path to the directory to add
  # @param base_name [String] base name for entries in the ZIP
  def add_directory_to_zip(zipfile, dir_path, base_name)
    Dir.glob("#{dir_path}/**/*").each do |file_path|
      # Calculate relative path within the export
      relative_path = file_path.sub("#{dir_path}/", "")
      entry_name = "#{base_name}/#{relative_path}"

      if File.directory?(file_path)
        zipfile.mkdir(entry_name)
      else
        zipfile.add(entry_name, file_path)
      end
    end
  end

  # Upload ZIP to Active Storage and generate a signed URL
  #
  # @param zip_path [String] path to the ZIP file
  # @return [String] signed URL valid for 48 hours
  def upload_and_generate_url(zip_path)
    Rails.logger.info("[DataExportJob] Uploading ZIP archive for user #{@user.id}")

    # Create an ActiveStorage blob for the export
    blob = ActiveStorage::Blob.create_and_upload!(
      io: File.open(zip_path),
      filename: File.basename(zip_path),
      content_type: "application/zip",
      metadata: {
        user_id: @user.id,
        export_type: "gdpr_data_export",
        created_at: Time.current.iso8601
      }
    )

    # Generate a signed URL valid for 48 hours
    url = blob.url(expires_in: DOWNLOAD_LINK_VALIDITY, disposition: :attachment)

    Rails.logger.info("[DataExportJob] Generated download URL for user #{@user.id} (valid for 48 hours)")

    url
  end

  # Send notification email with download link
  #
  # @param download_url [String] the signed download URL
  def send_notification_email(download_url)
    Rails.logger.info("[DataExportJob] Sending notification email for user #{@user.id}")

    DataExportMailer.export_ready(
      user: @user,
      download_url: download_url,
      expires_at: Time.current + DOWNLOAD_LINK_VALIDITY
    ).deliver_later

    Rails.logger.info("[DataExportJob] Queued notification email for user #{@user.id}")
  end
end
