# frozen_string_literal: true

# RainbowMoment represents a shared rainbow viewing event.
#
# When RainbowAlertJob detects favorable conditions, a RainbowMoment is created.
# Users who open the app during the active window are counted as participants.
# Photos taken during the moment are associated for community sharing and
# scientific data collection.
#
# == Lifecycle
# - active:   Created on alert. Participation and photo upload allowed.
# - closing:  ends_at reached. No new participants. Viewing allowed (5 min grace).
# - archived: Final state. Read-only. Data preserved for analysis.
#
# == Associations
# - has_many :participations (RainbowMomentParticipation)
# - has_many :participants, through: :participations (User)
# - has_many :photos (via location + time window query)
#
class RainbowMoment < ApplicationRecord
  # =============================================================================
  # Constants
  # =============================================================================

  STATUSES = %w[active closing archived].freeze
  DEFAULT_DURATION = 15.minutes
  CLOSING_GRACE_PERIOD = 5.minutes

  # =============================================================================
  # Associations
  # =============================================================================

  has_many :participations, class_name: "RainbowMomentParticipation", dependent: :destroy
  has_many :participants, through: :participations, source: :user

  # =============================================================================
  # Validations
  # =============================================================================

  validates :starts_at, presence: true
  validates :ends_at, presence: true
  validates :location_id, presence: true
  validates :status, presence: true, inclusion: { in: STATUSES }

  # =============================================================================
  # Scopes
  # =============================================================================

  scope :active, -> { where(status: "active") }
  scope :recent, -> { order(starts_at: :desc) }
  scope :for_location, ->(location_id) { where(location_id: location_id) }
  scope :by_month, ->(year, month) {
    start_date = Date.new(year, month, 1)
    end_date = start_date.end_of_month
    where(starts_at: start_date.beginning_of_day..end_date.end_of_day)
  }

  # =============================================================================
  # Class Methods
  # =============================================================================

  # Find or create an active moment for the given location.
  # Prevents duplicate moments for the same location.
  #
  # @param location [Hash] { id:, name:, lat:, lng: }
  # @param weather_data [Hash] Weather snapshot data
  # @return [RainbowMoment]
  def self.create_for_alert(location:, weather_data: {})
    now = Time.current
    # Use find_or_create_by with partial unique index to prevent race conditions
    active.find_or_create_by!(location_id: location[:id]) do |moment|
      moment.starts_at = now
      moment.ends_at = now + DEFAULT_DURATION
      moment.status = "active"
      moment.weather_snapshot = {
        temperature: weather_data[:temperature],
        humidity: weather_data[:humidity],
        cloud_cover: weather_data[:cloud_cover],
        sun_altitude: weather_data[:sun_altitude],
        weather_code: weather_data[:weather_code],
        weather_description: weather_data[:weather_description],
        visibility: weather_data[:visibility],
        precipitation_mm: weather_data[:rain_1h] || weather_data[:precipitation] || 0
      }
    end
  rescue ActiveRecord::RecordNotUnique
    # Another process created it first, return the existing one
    active.for_location(location[:id]).first!
  end

  # =============================================================================
  # Instance Methods
  # =============================================================================

  def active?
    status == "active"
  end

  def closing?
    status == "closing"
  end

  def archived?
    status == "archived"
  end

  # Transition to closing state.
  # Called when ends_at is reached.
  def close!
    return unless active?

    update!(status: "closing")
    broadcast_status_change("closing")
  end

  # Transition to archived state.
  # Called after closing grace period.
  def archive!
    return unless closing?

    update!(status: "archived")
    broadcast_status_change("archived")
  end

  # Check if the moment should transition states based on current time.
  def check_lifecycle!
    now = Time.current

    if active? && now >= ends_at
      close!
    elsif closing? && now >= ends_at + CLOSING_GRACE_PERIOD
      archive!
    end
  end

  # Add a participant to this moment.
  #
  # @param user [User]
  # @return [RainbowMomentParticipation, nil]
  def join(user)
    return nil unless active?

    participation = participations.find_or_initialize_by(user: user)
    if participation.new_record?
      participation.joined_at = Time.current
      participation.save!
      broadcast_participant_count
    elsif participation.left_at.present?
      # Rejoin
      participation.update!(left_at: nil)
      broadcast_participant_count
    end
    participation
  end

  # Remove a participant from this moment.
  #
  # @param user [User]
  def leave(user)
    participation = participations.find_by(user: user)
    return unless participation && participation.left_at.nil?

    participation.update!(left_at: Time.current)
    broadcast_participant_count
  end

  # Current active participant count (joined but not left).
  #
  # @return [Integer]
  def active_participants_count
    participations.where(left_at: nil).count
  end

  # Photos taken during this moment's window at this location.
  # Uses a time + location proximity query.
  #
  # @return [ActiveRecord::Relation]
  def photos
    Photo.where(captured_at: starts_at..ends_at)
         .where("ST_DWithin(location, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, ?)",
                location_lng, location_lat, 10_000) # 10km radius
  end

  # Get location details from MONITORING_LOCATIONS.
  #
  # @return [Hash, nil]
  def location_details
    RainbowAlertJob::MONITORING_LOCATIONS.find { |loc| loc[:id] == location_id }
  end

  def location_name
    location_details&.dig(:name) || location_id
  end

  def location_lat
    location_details&.dig(:lat)
  end

  def location_lng
    location_details&.dig(:lng)
  end

  private

  def broadcast_participant_count
    ActionCable.server.broadcast(
      "rainbow_moment:#{id}",
      {
        type: "participant_count",
        count: active_participants_count,
        total: participations.count
      }
    )
  end

  def broadcast_status_change(new_status)
    ActionCable.server.broadcast(
      "rainbow_moment:#{id}",
      {
        type: "status_change",
        status: new_status,
        moment_id: id
      }
    )
  end
end
