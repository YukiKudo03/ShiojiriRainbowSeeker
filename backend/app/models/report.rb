# frozen_string_literal: true

# Report model for content moderation.
#
# Allows users to report inappropriate content for admin review.
# Supports polymorphic associations to report different content types
# (photos, comments, etc.).
#
# == Associations
# - belongs_to :reporter - The user who submitted the report
# - belongs_to :reportable - The content being reported (polymorphic)
# - belongs_to :resolved_by - Admin who handled the report (optional)
#
# == Report Status
# - pending (0): Awaiting admin review
# - resolved (1): Report has been handled and action taken
# - dismissed (2): Report was reviewed but no action needed
#
# == Polymorphic Association
# The reportable association can reference:
# - Photo - Reported rainbow photos
# - Comment - Reported user comments
#
class Report < ApplicationRecord
  # Associations
  belongs_to :reporter, class_name: "User"
  belongs_to :reportable, polymorphic: true
  belongs_to :resolved_by, class_name: "User", optional: true

  # Report status enumeration
  enum :status, { pending: 0, resolved: 1, dismissed: 2 }

  # Validations
  validates :reason, presence: true, length: { maximum: 1000 }
  validates :admin_note, length: { maximum: 2000 }, allow_nil: true

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :unresolved, -> { where(status: :pending) }
  scope :photo_reports, -> { where(reportable_type: "Photo") }
  scope :comment_reports, -> { where(reportable_type: "Comment") }

  # Resolve the report
  #
  # @param admin [User] The admin resolving the report
  # @param note [String] Optional admin note about resolution
  # @return [Boolean] true if update was successful
  def resolve!(admin, note: nil)
    update(
      status: :resolved,
      resolved_by: admin,
      admin_note: note
    )
  end

  # Dismiss the report
  #
  # @param admin [User] The admin dismissing the report
  # @param note [String] Optional admin note about dismissal
  # @return [Boolean] true if update was successful
  def dismiss!(admin, note: nil)
    update(
      status: :dismissed,
      resolved_by: admin,
      admin_note: note
    )
  end

  # Check if the report has been reviewed
  #
  # @return [Boolean] true if report has been resolved or dismissed
  def reviewed?
    resolved? || dismissed?
  end

  # Get the display name of the reporter
  #
  # @return [String] Reporter's display name
  def reporter_name
    reporter&.display_name
  end

  # Get the display name of the admin who resolved the report
  #
  # @return [String, nil] Admin's display name if resolved
  def resolver_name
    resolved_by&.display_name
  end

  # Check if report was filed by a given user
  #
  # @param user [User] The user to check
  # @return [Boolean] true if the user filed this report
  def filed_by?(user)
    reporter_id == user&.id
  end
end
