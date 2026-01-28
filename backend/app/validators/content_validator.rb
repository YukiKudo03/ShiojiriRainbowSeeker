# frozen_string_literal: true

# ContentValidator validates text content against banned words and patterns.
#
# This validator provides moderation capabilities for user-generated content
# such as comments. It supports multiple matching strategies:
# - Exact word matching (case-insensitive)
# - Partial/substring matching (case-insensitive)
# - Regular expression pattern matching
# - Categorized word lists
#
# == Configuration
# The banned words list is loaded from config/banned_words.yml
# Administrators can edit this file to update moderation rules.
#
# == Usage
#   class Comment < ApplicationRecord
#     validates :content, content: true
#   end
#
#   # Or with custom options
#   validates :content, content: { attribute_name: :body }
#
# == Requirements
# - FR-8 (AC-8.6): Content moderation for comments
#
class ContentValidator < ActiveModel::EachValidator
  # Cache for banned words configuration
  # Reloads when file modification time changes
  @config_cache = nil
  @config_mtime = nil

  class << self
    attr_accessor :config_cache, :config_mtime

    # Get the banned words configuration, with caching
    #
    # @return [Hash] The configuration hash
    def configuration
      config_path = Rails.root.join("config", "banned_words.yml")

      # Check if config file exists
      unless File.exist?(config_path)
        Rails.logger.warn("[ContentValidator] banned_words.yml not found, using empty config")
        return default_config
      end

      # Reload if file has been modified
      current_mtime = File.mtime(config_path)
      if @config_cache.nil? || @config_mtime != current_mtime
        @config_cache = YAML.load_file(config_path, permitted_classes: [ Symbol, Regexp ]) || default_config
        @config_mtime = current_mtime
        Rails.logger.info("[ContentValidator] Loaded banned words configuration")
      end

      @config_cache
    rescue StandardError => e
      Rails.logger.error("[ContentValidator] Failed to load config: #{e.message}")
      default_config
    end

    # Reset the configuration cache (for testing)
    def reset_cache!
      @config_cache = nil
      @config_mtime = nil
    end

    # Check if content filtering is enabled
    #
    # @return [Boolean]
    def enabled?
      configuration.dig("settings", "enabled") != false
    end

    # Get the rejection message
    #
    # @return [String]
    def rejection_message
      configuration.dig("settings", "rejection_message") ||
        "Content contains prohibited words."
    end

    private

    def default_config
      {
        "settings" => { "enabled" => false },
        "exact" => [],
        "partial" => [],
        "regex" => [],
        "categories" => {}
      }
    end
  end

  # Validate the content attribute
  #
  # @param record [ActiveRecord::Base] The record being validated
  # @param attribute [Symbol] The attribute name
  # @param value [String] The content value
  def validate_each(record, attribute, value)
    return if value.blank?
    return unless self.class.enabled?

    violations = find_violations(value)

    if violations.any?
      error_message = options[:message] || self.class.rejection_message
      record.errors.add(attribute, error_message)

      # Log the violation for moderation purposes
      Rails.logger.info(
        "[ContentValidator] Content rejected for #{record.class.name}##{attribute}: " \
        "violations=#{violations.join(', ')}"
      )
    end
  end

  private

  # Find all violations in the content
  #
  # @param content [String] The content to check
  # @return [Array<String>] List of violation descriptions
  def find_violations(content)
    violations = []
    config = self.class.configuration
    normalized_content = content.downcase

    # Check exact matches
    exact_words = config["exact"] || []
    exact_words.each do |word|
      if word_boundary_match?(normalized_content, word.downcase)
        violations << "exact:#{word}"
      end
    end

    # Check partial matches
    partial_words = config["partial"] || []
    partial_words.each do |word|
      if normalized_content.include?(word.downcase)
        violations << "partial:#{word}"
      end
    end

    # Check regex patterns
    regex_patterns = config["regex"] || []
    regex_patterns.each do |pattern|
      begin
        regex = Regexp.new(pattern, Regexp::IGNORECASE)
        if regex.match?(content)
          violations << "regex:#{pattern}"
        end
      rescue RegexpError => e
        Rails.logger.warn("[ContentValidator] Invalid regex pattern '#{pattern}': #{e.message}")
      end
    end

    # Check categorized words
    categories = config["categories"] || {}
    categories.each do |category_name, category_config|
      next unless category_config["enabled"]

      # Check category words
      category_words = category_config["words"] || []
      category_words.each do |word|
        if normalized_content.include?(word.to_s.downcase)
          violations << "category:#{category_name}:#{word}"
        end
      end

      # Check category patterns
      category_patterns = category_config["patterns"] || []
      category_patterns.each do |pattern|
        begin
          regex = Regexp.new(pattern, Regexp::IGNORECASE)
          if regex.match?(content)
            violations << "category:#{category_name}:pattern"
          end
        rescue RegexpError => e
          Rails.logger.warn("[ContentValidator] Invalid category regex '#{pattern}': #{e.message}")
        end
      end
    end

    violations
  end

  # Check if a word matches with word boundaries
  #
  # For ASCII words, uses word boundary detection.
  # For non-ASCII (Japanese, etc.), uses substring matching
  # since word boundaries don't apply the same way.
  #
  # @param content [String] The normalized content
  # @param word [String] The word to match
  # @return [Boolean]
  def word_boundary_match?(content, word)
    # For non-ASCII characters (Japanese, etc.), use simple include
    # since word boundaries don't work the same way
    if word.match?(/[^\x00-\x7F]/)
      return content.include?(word)
    end

    # For ASCII words, use word boundary regex
    escaped_word = Regexp.escape(word)
    pattern = /\b#{escaped_word}\b/i
    pattern.match?(content)
  rescue RegexpError
    # Fallback to simple include check if regex fails
    content.include?(word)
  end
end

# Convenience module for manual content checking
module ContentFilter
  class << self
    # Check if content contains banned words
    #
    # @param content [String] The content to check
    # @return [Boolean] true if content is clean, false if it contains banned words
    def clean?(content)
      return true if content.blank?
      return true unless ContentValidator.enabled?

      validator = ContentValidator.new(attributes: [ :content ])
      mock_record = OpenStruct.new(errors: ActiveModel::Errors.new(self))
      validator.validate_each(mock_record, :content, content)
      mock_record.errors.empty?
    end

    # Check if content contains banned words and return details
    #
    # @param content [String] The content to check
    # @return [Hash] Result with :clean and :message keys
    def check(content)
      if clean?(content)
        { clean: true, message: nil }
      else
        { clean: false, message: ContentValidator.rejection_message }
      end
    end
  end
end
