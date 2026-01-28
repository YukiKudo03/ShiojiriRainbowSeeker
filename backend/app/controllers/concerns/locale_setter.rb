# frozen_string_literal: true

# LocaleSetter concern handles internationalization for API controllers.
#
# This concern implements locale detection based on:
# 1. Authenticated user's stored locale preference (highest priority)
# 2. Accept-Language HTTP header
# 3. Default locale (Japanese) as fallback
#
# == Requirements Reference
# - NFR-5: Internationalization support for Japanese and English
#
# == Usage
#   class ApplicationController < ActionController::API
#     include LocaleSetter
#   end
#
# == Accept-Language Header Parsing
# Supports standard Accept-Language header format:
# - Simple: "ja", "en"
# - With quality values: "ja,en;q=0.9"
# - Complex: "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7"
#
module LocaleSetter
  extend ActiveSupport::Concern

  included do
    before_action :set_locale
  end

  private

  # Set the I18n locale based on user preference or Accept-Language header
  #
  # Priority:
  # 1. Authenticated user's stored locale preference
  # 2. Accept-Language header
  # 3. Default locale (ja)
  def set_locale
    locale = extract_locale
    I18n.locale = locale if I18n.available_locales.include?(locale)
  end

  # Extract locale from available sources
  #
  # @return [Symbol] the determined locale
  def extract_locale
    user_locale || header_locale || I18n.default_locale
  end

  # Get locale from authenticated user's preference
  #
  # @return [Symbol, nil] user's locale or nil if not authenticated
  def user_locale
    return nil unless respond_to?(:current_user) && current_user.present?
    return nil if current_user.locale.blank?

    current_user.locale.to_sym
  end

  # Parse Accept-Language header to determine preferred locale
  #
  # Supports formats like:
  # - "ja"
  # - "en-US"
  # - "ja,en;q=0.9"
  # - "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7"
  #
  # @return [Symbol, nil] the preferred available locale or nil
  def header_locale
    accept_language = request.headers["Accept-Language"]
    return nil if accept_language.blank?

    parse_accept_language(accept_language)
  end

  # Parse Accept-Language header and return the best matching locale
  #
  # @param header [String] the Accept-Language header value
  # @return [Symbol, nil] the best matching locale or nil
  def parse_accept_language(header)
    # Parse languages with quality values
    # Format: "lang;q=value" or just "lang"
    languages = header.split(",").map do |lang|
      parts = lang.strip.split(";")
      code = parts[0].strip

      # Extract quality value (default 1.0)
      quality = if parts[1] && parts[1].include?("q=")
        parts[1].match(/q=([0-9.]+)/)&.[](1).to_f
      else
        1.0
      end

      [ code, quality ]
    end

    # Sort by quality (highest first) and find first available locale
    languages.sort_by { |_, q| -q }.each do |code, _|
      locale = normalize_language_code(code)
      return locale if locale && I18n.available_locales.include?(locale)
    end

    nil
  end

  # Normalize language code to match available locales
  #
  # Converts codes like "ja-JP" to "ja", "en-US" to "en"
  #
  # @param code [String] the language code from Accept-Language header
  # @return [Symbol, nil] normalized locale symbol or nil if not supported
  def normalize_language_code(code)
    # Extract primary language subtag (e.g., "ja" from "ja-JP")
    primary = code.split("-").first&.downcase
    return nil if primary.blank?

    locale = primary.to_sym
    I18n.available_locales.include?(locale) ? locale : nil
  end
end
