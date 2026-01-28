# frozen_string_literal: true

# ReportPolicy provides authorization rules for Report resources.
#
# Implements Pundit authorization for content moderation reports.
# All report management actions are restricted to admin users only.
#
# == Requirements
# - FR-10: Content Moderation (AC-10.1~AC-10.4)
#
# == Rules
# - Only admins can view the report list (index)
# - Only admins can view report details (show)
# - Only admins can process reports (process_report)
#
# == Usage
#   authorize @report                 # Uses the default action (e.g., show?)
#   authorize @report, :process_report?
#   authorize Report                  # For index action
#   policy_scope(Report)              # Returns scoped collection
#
class ReportPolicy < ApplicationPolicy
  # Only admins can view the report list
  #
  # @return [Boolean] true if user is admin
  def index?
    admin?
  end

  # Only admins can view report details
  #
  # @return [Boolean] true if user is admin
  def show?
    admin?
  end

  # Only admins can process reports
  #
  # @return [Boolean] true if user is admin
  def process_report?
    admin?
  end

  # Only admins can create reports through admin interface
  # (regular users create reports via SocialController)
  #
  # @return [Boolean] true if user is admin
  def create?
    admin?
  end

  # Only admins can update reports
  #
  # @return [Boolean] true if user is admin
  def update?
    admin?
  end

  # Only admins can destroy reports
  #
  # @return [Boolean] true if user is admin
  def destroy?
    admin?
  end

  # Scope class for filtering report collections
  class Scope < Scope
    # Resolve the scope based on user permissions
    #
    # For admins: all reports
    # For non-admins: no reports (empty scope)
    #
    # @return [ActiveRecord::Relation] filtered reports
    def resolve
      if user&.admin?
        scope.all
      else
        scope.none
      end
    end
  end
end
