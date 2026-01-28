# frozen_string_literal: true

# ApplicationPolicy is the base class for all Pundit authorization policies.
#
# Provides default deny-all behavior and common helper methods.
# All resource-specific policies inherit from this class.
#
# == Usage
#   class PhotoPolicy < ApplicationPolicy
#     def show?
#       true  # Allow everyone to view
#     end
#   end
#
class ApplicationPolicy
  attr_reader :user, :record

  # Initialize the policy with user and record
  #
  # @param user [User, nil] the current user (may be nil for guests)
  # @param record [Object] the record being authorized
  def initialize(user, record)
    @user = user
    @record = record
  end

  # Default: deny index access
  def index?
    false
  end

  # Default: deny show access
  def show?
    false
  end

  # Default: deny create access
  def create?
    false
  end

  # Default: deny new access (alias for create)
  def new?
    create?
  end

  # Default: deny update access
  def update?
    false
  end

  # Default: deny edit access (alias for update)
  def edit?
    update?
  end

  # Default: deny destroy access
  def destroy?
    false
  end

  # Check if user is an admin
  #
  # @return [Boolean] true if user is admin, false otherwise (including nil user)
  def admin?
    user&.admin? == true
  end

  # Check if user owns the record
  #
  # @return [Boolean] true if user owns the record
  def owner?
    return false unless user && record.respond_to?(:user_id)

    record.user_id == user.id
  end

  # Check if user is owner or admin
  #
  # @return [Boolean] true if user is owner or admin
  def owner_or_admin?
    owner? || admin?
  end

  # Scope class for filtering collections
  class Scope
    attr_reader :user, :scope

    # Initialize the scope with user and scope
    #
    # @param user [User, nil] the current user
    # @param scope [ActiveRecord::Relation] the base scope
    def initialize(user, scope)
      @user = user
      @scope = scope
    end

    # Default: return empty scope
    def resolve
      scope.none
    end
  end
end
