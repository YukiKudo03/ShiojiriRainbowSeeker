# frozen_string_literal: true

# JwtDenylist model for devise-jwt token revocation.
#
# This model implements the Denylist strategy for JWT token revocation.
# When a user logs out, their JWT token's unique identifier (jti) is
# stored in this table to prevent the token from being used again.
#
# The exp column stores the token's expiration time, which can be used
# to periodically clean up expired entries from the table.
#
# == Schema
# - jti: JWT unique identifier (required)
# - exp: Token expiration datetime (required)
#
# Note: This table uses integer primary key (not UUID) as per devise-jwt requirements.
#
class JwtDenylist < ApplicationRecord
  include Devise::JWT::RevocationStrategies::Denylist

  self.table_name = "jwt_denylists"

  # Scope to find expired entries for cleanup
  scope :expired, -> { where("exp < ?", Time.current) }

  # Class method to clean up expired tokens
  #
  # @return [Integer] number of deleted records
  def self.cleanup_expired
    expired.delete_all
  end
end
