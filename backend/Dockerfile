# syntax=docker/dockerfile:1
# check=error=true

# =============================================================================
# Shiojiri Rainbow Seeker Backend - Production Dockerfile
# =============================================================================
# Multi-stage build optimized for Rails 8 API with PostGIS support
#
# Build:   docker build -t shiojiri-rainbow-backend .
# Run:     docker run -d -p 80:80 -e RAILS_MASTER_KEY=<value> shiojiri-rainbow-backend
#
# For development, use docker-compose.yml instead.
# =============================================================================

# Ruby version from .ruby-version
ARG RUBY_VERSION=3.2.2

# =============================================================================
# Stage 1: Base image with runtime dependencies
# =============================================================================
FROM docker.io/library/ruby:$RUBY_VERSION-slim AS base

# Rails app lives here
WORKDIR /rails

# Install base packages including PostGIS client libraries
# - curl: Health checks and debugging
# - libjemalloc2: Memory allocator for reduced memory usage
# - libvips: Image processing for Active Storage
# - libgeos-c1v5: GEOS library for geometric operations (RGeo)
# - libproj25: PROJ library for coordinate transformations
# - postgresql-client: Database CLI tools
# - postgis: PostGIS client utilities
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
      curl \
      libjemalloc2 \
      libvips \
      libgeos-c1v5 \
      libproj25 \
      postgresql-client \
      postgis && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Set production environment
ENV RAILS_ENV="production" \
    BUNDLE_DEPLOYMENT="1" \
    BUNDLE_PATH="/usr/local/bundle" \
    BUNDLE_WITHOUT="development:test" \
    RAILS_LOG_TO_STDOUT="true" \
    RAILS_SERVE_STATIC_FILES="false" \
    MALLOC_ARENA_MAX="2"

# =============================================================================
# Stage 2: Build stage for gem installation
# =============================================================================
FROM base AS build

# Install packages needed to build gems
# - build-essential: C compiler for native extensions
# - git: Required for some gem sources
# - libpq-dev: PostgreSQL development headers
# - libyaml-dev: YAML parsing library
# - libgeos-dev: GEOS development headers for RGeo
# - libproj-dev: PROJ development headers
# - pkg-config: Build tool for finding libraries
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
      build-essential \
      git \
      libpq-dev \
      libyaml-dev \
      libgeos-dev \
      libproj-dev \
      pkg-config && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Install application gems
COPY Gemfile Gemfile.lock ./

# Bundle install with optimizations:
# - Install gems without cache to reduce layer size
# - Remove gem caches and git directories
# - Precompile bootsnap for faster boot times
RUN bundle install --jobs 4 --retry 3 && \
    rm -rf ~/.bundle/ "${BUNDLE_PATH}"/ruby/*/cache "${BUNDLE_PATH}"/ruby/*/bundler/gems/*/.git && \
    bundle exec bootsnap precompile --gemfile

# Copy application code
COPY . .

# Precompile bootsnap code for faster boot times
RUN bundle exec bootsnap precompile app/ lib/

# Remove unnecessary files from the build
RUN rm -rf spec test tmp/cache tmp/pids tmp/sockets log/*.log

# =============================================================================
# Stage 3: Production image
# =============================================================================
FROM base AS production

# Labels for container metadata
LABEL org.opencontainers.image.title="Shiojiri Rainbow Seeker Backend" \
      org.opencontainers.image.description="Rails 8 API for rainbow sighting management" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.vendor="Shiojiri Rainbow Seeker"

# Copy built artifacts: gems, application
COPY --from=build "${BUNDLE_PATH}" "${BUNDLE_PATH}"
COPY --from=build /rails /rails

# Create directories that may not exist
RUN mkdir -p db log storage tmp/pids tmp/cache tmp/sockets

# Run and own only the runtime files as a non-root user for security
RUN groupadd --system --gid 1000 rails && \
    useradd rails --uid 1000 --gid 1000 --create-home --shell /bin/bash && \
    chown -R rails:rails db log storage tmp

# Switch to non-root user
USER 1000:1000

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/up || exit 1

# Entrypoint prepares the database
ENTRYPOINT ["/rails/bin/docker-entrypoint"]

# Start server via Thruster (HTTP/2, compression, caching proxy)
# Thruster listens on port 80 and proxies to Puma on port 3000
EXPOSE 80
CMD ["./bin/thrust", "./bin/rails", "server"]

# =============================================================================
# Alternative: Direct Puma (without Thruster)
# =============================================================================
# If you want to run Puma directly without Thruster:
# EXPOSE 3000
# CMD ["./bin/rails", "server", "-b", "0.0.0.0"]
