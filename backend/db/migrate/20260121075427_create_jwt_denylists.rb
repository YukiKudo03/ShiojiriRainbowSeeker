# frozen_string_literal: true

# Migration to create the jwt_denylists table for devise-jwt token revocation.
# This table stores revoked JWT tokens to prevent their reuse after logout.
#
# The jti (JWT ID) is a unique identifier for each token.
# The exp column stores the token expiration time for cleanup purposes.
#
# Note: This table uses integer ID (not UUID) as per devise-jwt requirements.
#
class CreateJwtDenylists < ActiveRecord::Migration[8.0]
  def change
    create_table :jwt_denylists do |t|
      # JWT unique identifier
      t.string :jti, null: false

      # Token expiration time (used for cleanup of expired entries)
      t.datetime :exp, null: false
    end

    # Index for fast lookups during token validation
    add_index :jwt_denylists, :jti
  end
end
