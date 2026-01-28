# frozen_string_literal: true

module ExternalApis
  # WeatherApi - OpenWeatherMap API連携モジュール
  #
  # 気象データの取得を担当するクラス。現在の気象条件および過去の気象データを取得する。
  #
  # 使用例:
  #   api = ExternalApis::WeatherApi.new
  #   current = api.current_weather(lat: 36.115, lng: 137.954)
  #   historical = api.historical_weather(lat: 36.115, lng: 137.954, timestamp: 1.hour.ago)
  #
  class WeatherApi
    class ApiError < StandardError; end
    class ConfigurationError < StandardError; end
    class RateLimitError < ApiError; end
    class InvalidResponseError < ApiError; end

    BASE_URL = "https://api.openweathermap.org/data/3.0"
    ONECALL_ENDPOINT = "/onecall"
    TIMEMACHINE_ENDPOINT = "/onecall/timemachine"

    # OpenWeatherMap Weather Codes
    # https://openweathermap.org/weather-conditions
    WEATHER_CODES = {
      # Thunderstorm
      200..232 => "thunderstorm",
      # Drizzle
      300..321 => "drizzle",
      # Rain
      500..531 => "rain",
      # Snow
      600..622 => "snow",
      # Atmosphere (mist, fog, etc.)
      701..781 => "atmosphere",
      # Clear
      800 => "clear",
      # Clouds
      801..804 => "clouds"
    }.freeze

    DEFAULT_TIMEOUT = 10 # seconds
    DEFAULT_UNITS = "metric" # Celsius, m/s

    def initialize(api_key: nil, timeout: DEFAULT_TIMEOUT)
      @api_key = api_key || ENV.fetch("OPENWEATHERMAP_API_KEY", nil)
      @timeout = timeout

      raise ConfigurationError, "OpenWeatherMap API key is required" if @api_key.blank?
    end

    # 現在の気象条件を取得
    #
    # @param lat [Float] 緯度
    # @param lng [Float] 経度
    # @return [Hash] 気象データ
    # @raise [ApiError] API呼び出しに失敗した場合
    def current_weather(lat:, lng:)
      response = connection.get(ONECALL_ENDPOINT) do |req|
        req.params["lat"] = lat
        req.params["lon"] = lng
        req.params["appid"] = @api_key
        req.params["units"] = DEFAULT_UNITS
        req.params["exclude"] = "minutely,hourly,daily,alerts"
      end

      handle_response(response) do |data|
        parse_current_weather(data)
      end
    end

    # 過去の気象データを取得（OpenWeatherMap One Call API 3.0 Timemachine）
    #
    # @param lat [Float] 緯度
    # @param lng [Float] 経度
    # @param timestamp [Time, Integer] 取得したい時刻（Unix timestamp or Time object）
    # @return [Hash] 気象データ
    # @raise [ApiError] API呼び出しに失敗した場合
    def historical_weather(lat:, lng:, timestamp:)
      unix_timestamp = timestamp.is_a?(Time) ? timestamp.to_i : timestamp

      response = connection.get(TIMEMACHINE_ENDPOINT) do |req|
        req.params["lat"] = lat
        req.params["lon"] = lng
        req.params["dt"] = unix_timestamp
        req.params["appid"] = @api_key
        req.params["units"] = DEFAULT_UNITS
      end

      handle_response(response) do |data|
        parse_historical_weather(data, unix_timestamp)
      end
    end

    # 指定期間の気象データを取得（複数タイムスタンプ）
    #
    # @param lat [Float] 緯度
    # @param lng [Float] 経度
    # @param timestamps [Array<Time>] 取得したい時刻の配列
    # @return [Array<Hash>] 気象データの配列
    def historical_weather_bulk(lat:, lng:, timestamps:)
      timestamps.map do |timestamp|
        begin
          historical_weather(lat: lat, lng: lng, timestamp: timestamp)
        rescue ApiError => e
          if defined?(Rails) && Rails.logger
            Rails.logger.warn("Failed to fetch historical weather for #{timestamp}: #{e.message}")
          end
          nil
        end
      end.compact
    end

    private

    def connection
      @connection ||= Faraday.new(url: BASE_URL) do |conn|
        conn.options.timeout = @timeout
        conn.options.open_timeout = @timeout
        conn.request :json
        conn.response :json, content_type: /\bjson$/
        conn.adapter Faraday.default_adapter
      end
    end

    def handle_response(response)
      case response.status
      when 200
        yield(response.body)
      when 401
        raise ApiError, "Invalid API key"
      when 429
        raise RateLimitError, "API rate limit exceeded"
      when 400..499
        raise ApiError, "Client error: #{response.status} - #{response.body}"
      when 500..599
        raise ApiError, "Server error: #{response.status}"
      else
        raise InvalidResponseError, "Unexpected response: #{response.status}"
      end
    end

    def parse_current_weather(data)
      current = data["current"]
      return nil unless current

      {
        timestamp: Time.at(current["dt"]).utc,
        temperature: current["temp"],
        feels_like: current["feels_like"],
        humidity: current["humidity"],
        pressure: current["pressure"],
        dew_point: current["dew_point"],
        uvi: current["uvi"],
        cloud_cover: current["clouds"],
        visibility: current["visibility"],
        wind_speed: current["wind_speed"],
        wind_direction: current["wind_deg"],
        wind_gust: current["wind_gust"],
        weather_code: extract_weather_code(current["weather"]),
        weather_description: extract_weather_description(current["weather"]),
        weather_main: extract_weather_main(current["weather"]),
        weather_icon: extract_weather_icon(current["weather"]),
        rain_1h: current.dig("rain", "1h"),
        snow_1h: current.dig("snow", "1h"),
        sunrise: data["current"]["sunrise"] ? Time.at(data["current"]["sunrise"]).utc : nil,
        sunset: data["current"]["sunset"] ? Time.at(data["current"]["sunset"]).utc : nil,
        location: {
          lat: data["lat"],
          lon: data["lon"],
          timezone: data["timezone"],
          timezone_offset: data["timezone_offset"]
        }
      }
    end

    def parse_historical_weather(data, requested_timestamp)
      # Timemachine returns data in "data" array
      weather_data = data["data"]&.first
      return nil unless weather_data

      {
        timestamp: Time.at(weather_data["dt"]).utc,
        requested_timestamp: Time.at(requested_timestamp).utc,
        temperature: weather_data["temp"],
        feels_like: weather_data["feels_like"],
        humidity: weather_data["humidity"],
        pressure: weather_data["pressure"],
        dew_point: weather_data["dew_point"],
        uvi: weather_data["uvi"],
        cloud_cover: weather_data["clouds"],
        visibility: weather_data["visibility"],
        wind_speed: weather_data["wind_speed"],
        wind_direction: weather_data["wind_deg"],
        wind_gust: weather_data["wind_gust"],
        weather_code: extract_weather_code(weather_data["weather"]),
        weather_description: extract_weather_description(weather_data["weather"]),
        weather_main: extract_weather_main(weather_data["weather"]),
        weather_icon: extract_weather_icon(weather_data["weather"]),
        rain_1h: weather_data.dig("rain", "1h"),
        snow_1h: weather_data.dig("snow", "1h"),
        sunrise: weather_data["sunrise"] ? Time.at(weather_data["sunrise"]).utc : nil,
        sunset: weather_data["sunset"] ? Time.at(weather_data["sunset"]).utc : nil,
        location: {
          lat: data["lat"],
          lon: data["lon"],
          timezone: data["timezone"],
          timezone_offset: data["timezone_offset"]
        }
      }
    end

    def extract_weather_code(weather_array)
      weather_array&.first&.dig("id")
    end

    def extract_weather_description(weather_array)
      weather_array&.first&.dig("description")
    end

    def extract_weather_main(weather_array)
      weather_array&.first&.dig("main")
    end

    def extract_weather_icon(weather_array)
      weather_array&.first&.dig("icon")
    end

    # Weather code を虹条件判定用のカテゴリに変換
    def categorize_weather_code(code)
      return nil unless code

      WEATHER_CODES.each do |range_or_code, category|
        if range_or_code.is_a?(Range)
          return category if range_or_code.include?(code)
        elsif range_or_code == code
          return category
        end
      end

      "unknown"
    end
  end
end
