# frozen_string_literal: true

# DeviceToken model for push notification registration.
#
# Stores FCM (Android) and APNs (iOS) device tokens for sending
# push notifications to users' mobile devices.
#
# == Associations
# - belongs_to :user - The user who owns this device
#
# == Validations
# - token: Required and must be unique (prevent duplicates)
# - platform: Required, must be 'ios' or 'android'
#
# == Platforms
# - ios: Apple Push Notification service (APNs)
# - android: Firebase Cloud Messaging (FCM)
#
# == Token Lifecycle
# - is_active tracks whether the token is still valid
# - Tokens should be marked inactive when push notifications fail
# - Old inactive tokens can be periodically cleaned up
#
class DeviceToken < ApplicationRecord
  # Associations
  belongs_to :user

  # Validations
  validates :token, presence: true, uniqueness: true
  validates :platform, presence: true, inclusion: { in: %w[ios android] }

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :inactive, -> { where(is_active: false) }
  scope :ios_devices, -> { where(platform: "ios") }
  scope :android_devices, -> { where(platform: "android") }
  scope :recent, -> { order(updated_at: :desc) }

  # Mark device token as active
  #
  # @return [Boolean] true if update was successful
  def activate!
    update(is_active: true)
  end

  # Mark device token as inactive (invalid)
  #
  # @return [Boolean] true if update was successful
  def deactivate!
    update(is_active: false)
  end

  # Check if this is an iOS device
  #
  # @return [Boolean] true if platform is iOS
  def ios?
    platform == "ios"
  end

  # Check if this is an Android device
  #
  # @return [Boolean] true if platform is Android
  def android?
    platform == "android"
  end

  # Update token and mark as active
  # Used when a device registers with a new token
  #
  # @param new_token [String] The new device token
  # @return [Boolean] true if update was successful
  def refresh_token!(new_token)
    update(token: new_token, is_active: true)
  end

  # Class method to find or create a device token for a user
  #
  # @param user [User] The user to register
  # @param token [String] The device token
  # @param platform [String] The platform ('ios' or 'android')
  # @return [DeviceToken] The created or updated device token
  def self.register(user:, token:, platform:)
    device = find_by(token: token)

    if device
      # Token exists - update user association and ensure active
      device.update(user: user, is_active: true)
      device
    else
      # New token - create new record
      create(user: user, token: token, platform: platform, is_active: true)
    end
  end

  # Class method to deactivate all tokens for a user
  # Used when user logs out of all devices
  #
  # @param user [User] The user whose tokens to deactivate
  # @return [Integer] Number of updated records
  def self.deactivate_all_for_user(user)
    where(user: user).update_all(is_active: false)
  end

  # Class method to clean up old inactive tokens
  #
  # @param days_old [Integer] Delete tokens inactive for this many days
  # @return [Integer] Number of deleted records
  def self.cleanup_inactive(days_old: 30)
    inactive.where("updated_at < ?", days_old.days.ago).delete_all
  end
end
