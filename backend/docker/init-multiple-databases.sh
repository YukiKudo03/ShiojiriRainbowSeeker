#!/bin/bash

# =============================================================================
# Initialize Multiple PostgreSQL Databases
# =============================================================================
# This script creates additional databases for Solid Cache, Queue, and Cable
# It runs during PostgreSQL container initialization
# =============================================================================

set -e
set -u

# Function to create database if it doesn't exist
create_database() {
    local database=$1
    echo "  Creating database: $database"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
        SELECT 'CREATE DATABASE "$database"'
        WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$database')\gexec
        GRANT ALL PRIVILEGES ON DATABASE "$database" TO "$POSTGRES_USER";
EOSQL

    # Enable PostGIS extension on the new database
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$database" <<-EOSQL
        CREATE EXTENSION IF NOT EXISTS postgis;
EOSQL
}

# Main execution
main() {
    # Enable PostGIS on the primary database
    echo "Enabling PostGIS extension on primary database: $POSTGRES_DB"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
        CREATE EXTENSION IF NOT EXISTS postgis;
EOSQL

    # Check if POSTGRES_MULTIPLE_DATABASES is set
    if [ -n "${POSTGRES_MULTIPLE_DATABASES:-}" ]; then
        echo "Creating additional databases..."

        # Parse comma-separated database names
        # Remove spaces and split by comma
        IFS=',' read -ra DATABASES <<< "$(echo "$POSTGRES_MULTIPLE_DATABASES" | tr -d ' ')"

        for db in "${DATABASES[@]}"; do
            # Skip empty strings
            if [ -n "$db" ]; then
                create_database "$db"
            fi
        done

        echo "Additional databases created successfully!"
    fi
}

main
