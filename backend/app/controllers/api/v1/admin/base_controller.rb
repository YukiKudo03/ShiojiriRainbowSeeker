# frozen_string_literal: true

module Api
  module V1
    module Admin
      # BaseController serves as the parent controller for all Admin API endpoints.
      #
      # Provides common functionality for admin-only APIs:
      # - JWT authentication requirement
      # - Admin role verification
      # - Pundit authorization
      #
      # All Admin API controllers should inherit from this class.
      #
      # == Requirements
      # - FR-10: Content Moderation (AC-10.1~AC-10.4)
      #
      class BaseController < Api::V1::BaseController
        include Pundit::Authorization

        # Require authentication for all admin actions
        before_action :authenticate_user!

        # Verify admin role for all actions
        before_action :verify_admin!

        private

        # Verify that the current user has admin privileges
        #
        # @raise [Pundit::NotAuthorizedError] if user is not an admin
        def verify_admin!
          unless current_user&.admin?
            raise Pundit::NotAuthorizedError.new(
              query: :admin?,
              record: nil,
              policy: self.class
            )
          end
        end
      end
    end
  end
end
