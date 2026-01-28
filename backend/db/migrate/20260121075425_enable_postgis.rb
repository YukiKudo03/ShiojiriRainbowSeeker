# frozen_string_literal: true

# Migration to enable PostGIS and pgcrypto extensions for geospatial data support.
# PostGIS provides geographic object support for PostgreSQL.
# pgcrypto provides cryptographic functions including UUID generation.
#
# Requirements:
# - PostgreSQL 14 or higher
# - PostGIS 3.0 or higher (must be installed on the database server)
#
# To install PostGIS on macOS with Homebrew:
#   brew install postgis
#
# To install PostGIS on Ubuntu/Debian:
#   sudo apt-get install postgresql-14-postgis-3
#
class EnablePostgis < ActiveRecord::Migration[8.0]
  def change
    # Enable PostGIS extension for geospatial data types and functions
    # This provides: geometry, geography data types, spatial indexes, and GIS functions
    enable_extension "postgis"

    # Enable pgcrypto extension for cryptographic functions
    # This provides: gen_random_uuid(), crypt(), pgp_sym_encrypt(), etc.
    enable_extension "pgcrypto"
  end
end
