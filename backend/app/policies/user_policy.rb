# frozen_string_literal: true

# UserPolicy defines authorization rules for User resources.
#
# Rules:
# - show?: Any authenticated user can view public profiles
# - update?: Only the user themselves can update their profile (or admin)
#
# @see https://github.com/varvet/pundit
#
class UserPolicy < ApplicationPolicy
  # Check if the user can view another user's profile
  #
  # @return [Boolean] true if authorized
  def show?
    # Any authenticated user can view public profiles
    user.present?
  end

  # Check if the user can update the profile
  #
  # @return [Boolean] true if authorized
  def update?
    # Only the owner or admin can update
    return false unless user.present?
    return true if user.admin?

    user.id == record.id
  end

  # Scope for listing users (if needed in future)
  class Scope < ApplicationPolicy::Scope
    def resolve
      # Only show active users
      scope.active
    end
  end
end
