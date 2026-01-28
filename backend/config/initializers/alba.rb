# frozen_string_literal: true

# Configure Alba serialization gem
Alba.backend = :active_support
Alba.inflector = :active_support

# Use symbol keys for hash output
Alba.symbolize_keys!
