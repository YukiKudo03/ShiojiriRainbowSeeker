# frozen_string_literal: true

# UserSerializer provides Alba serialization for User resources.
#
# Offers three serialization modes:
# - Summary: Minimal user info for embedding in other resources
# - Full (default): Public profile information for profile views
# - Private: Full profile with private fields (for current user only)
#
# == Security
# - Email address only exposed in Private serializer
# - Never exposes password-related fields
# - Never exposes admin status to non-admins
#
# == Usage
#   # Summary (for embedding in photos, comments, etc.)
#   UserSerializer::Summary.new(user).serialize
#
#   # Public profile (for viewing other users)
#   UserSerializer.new(user).serialize
#
#   # Private profile (for current user viewing own profile)
#   UserSerializer::Private.new(user).serialize
#
# == Requirements
#   - FR-9 (AC-9.1): Display user stats including photo count, likes received, comments count
#
class UserSerializer < ApplicationSerializer
  attributes :id, :display_name

  # Profile image URL
  attribute :profile_image_url do |user|
    UserSerializer.profile_image_url_for(user)
  end

  # User statistics (AC-9.1: アップロード写真数、受け取ったいいね数、総コメント数)
  attribute :stats do |user|
    UserSerializer.calculate_stats(user)
  end

  attribute :created_at do |user|
    user.created_at&.iso8601
  end

  class << self
    # Generate profile image URL
    #
    # @param user [User] the user
    # @return [String, nil] the profile image URL
    def profile_image_url_for(user)
      return nil unless user.profile_image.attached?

      if Rails.env.production? && ENV["AWS_CLOUDFRONT_HOST"].present?
        "https://#{ENV['AWS_CLOUDFRONT_HOST']}/#{user.profile_image.key}"
      else
        Rails.application.routes.url_helpers.rails_blob_url(
          user.profile_image,
          host: Rails.application.config.action_mailer.default_url_options[:host] || "localhost:3000"
        )
      end
    rescue StandardError
      nil
    end

    # Calculate user statistics
    #
    # Stats include:
    # - photo_count: Number of photos uploaded
    # - likes_received: Total likes received on all photos
    # - comments_count: Total comments made by user
    #
    # @param user [User] the user
    # @return [Hash] user statistics
    def calculate_stats(user)
      {
        photoCount: user.photos.where(deleted_at: nil).count,
        likesReceived: Like.joins(:photo).where(photos: { user_id: user.id, deleted_at: nil }).count,
        commentsCount: user.comments.count
      }
    end
  end

  # Summary serializer for embedding user info in other resources
  # Only includes minimal information
  class Summary < ApplicationSerializer
    attributes :id, :display_name

    # Profile image URL (for summary view)
    attribute :profile_image_url do |user|
      UserSerializer.profile_image_url_for(user)
    end
  end

  # Private serializer for current user viewing own profile
  # Includes sensitive/private fields
  class Private < ApplicationSerializer
    attributes :id, :display_name

    # Profile image URL
    attribute :profile_image_url do |user|
      UserSerializer.profile_image_url_for(user)
    end

    # User statistics (same as public)
    attribute :stats do |user|
      UserSerializer.calculate_stats(user)
    end

    # === Private fields (only visible to user themselves) ===

    attribute :email do |user|
      user.email
    end

    attribute :locale do |user|
      user.locale
    end

    attribute :notification_enabled do |user|
      user.notification_settings&.dig("enabled") || false
    end

    attribute :notification_radius do |user|
      user.notification_settings&.dig("radius") || 10000
    end

    attribute :quiet_hours_start do |user|
      user.notification_settings&.dig("quiet_hours_start")
    end

    attribute :quiet_hours_end do |user|
      user.notification_settings&.dig("quiet_hours_end")
    end

    attribute :created_at do |user|
      user.created_at&.iso8601
    end

    attribute :updated_at do |user|
      user.updated_at&.iso8601
    end
  end
end
