# frozen_string_literal: true

# PhotoPolicy provides authorization rules for Photo resources.
#
# Implements Pundit authorization for photo CRUD operations.
# Rules:
# - Anyone can view the photo list (index)
# - Anyone can view approved/visible photos (show)
# - Authenticated users can create photos
# - Only owner (or admin) can update their photos
# - Only owner (or admin) can delete their photos
#
# == Usage
#   authorize @photo   # Uses the default action (e.g., show?)
#   authorize @photo, :update?
#   policy_scope(Photo)  # Returns scoped collection
#
class PhotoPolicy < ApplicationPolicy
  # Anyone can view the photo list
  #
  # @return [Boolean] true
  def index?
    true
  end

  # Anyone can view approved photos, owner can view their own
  #
  # @return [Boolean] true if photo is visible or user is owner/admin
  def show?
    return true if record.approved? && record.is_visible

    owner_or_admin?
  end

  # Authenticated users can create photos
  #
  # @return [Boolean] true if user is authenticated
  def create?
    user.present?
  end

  # Only owner (or admin) can update photos
  #
  # @return [Boolean] true if user is owner or admin
  def update?
    owner_or_admin?
  end

  # Only owner (or admin) can delete photos
  #
  # @return [Boolean] true if user is owner or admin
  def destroy?
    owner_or_admin?
  end

  # Anyone can view weather data for visible photos
  #
  # @return [Boolean] true if photo is visible or user is owner/admin
  def weather?
    show?
  end

  # Scope class for filtering photo collections
  class Scope < Scope
    # Resolve the scope based on user permissions
    #
    # For guests: only visible, approved photos
    # For regular users: visible approved photos + own photos
    # For admins: all photos
    #
    # @return [ActiveRecord::Relation] filtered photos
    def resolve
      if user&.admin?
        # Admins see all photos
        scope.all
      elsif user
        # Authenticated users see visible photos + their own
        scope.where(is_visible: true, moderation_status: :approved)
             .or(scope.where(user_id: user.id))
      else
        # Guests see only visible, approved photos
        scope.visible
      end
    end
  end
end
