# frozen_string_literal: true

module ExternalApis
  # GeocodingApi - 逆ジオコーディングAPI連携モジュール
  #
  # GPS座標から住所（地名）を取得するクラス。
  # Mapbox Geocoding APIを使用し、結果を24時間キャッシュする。
  #
  # 使用例:
  #   api = ExternalApis::GeocodingApi.new
  #   result = api.reverse_geocode(lat: 36.115, lng: 137.954)
  #   # => { place_name: "大門, 塩尻市, 長野県", ... }
  #
  class GeocodingApi
    class ApiError < StandardError; end
    class ConfigurationError < StandardError; end
    class RateLimitError < ApiError; end
    class InvalidResponseError < ApiError; end

    # Mapbox Geocoding API
    BASE_URL = "https://api.mapbox.com"
    GEOCODING_PATH = "/geocoding/v5/mapbox.places"

    DEFAULT_TIMEOUT = 10 # seconds
    CACHE_TTL = 24.hours
    CACHE_KEY_PREFIX = "geocoding/v1"

    # 日本語での地名取得を優先
    DEFAULT_LANGUAGE = "ja"
    DEFAULT_COUNTRY = "JP"

    def initialize(api_key: nil, timeout: DEFAULT_TIMEOUT)
      @api_key = api_key || ENV.fetch("MAPBOX_ACCESS_TOKEN", nil)
      @timeout = timeout

      raise ConfigurationError, "Mapbox access token is required" if @api_key.blank?
    end

    # 逆ジオコーディング（GPS座標から住所を取得）
    #
    # @param lat [Float] 緯度
    # @param lng [Float] 経度
    # @param types [Array<String>] 取得する地名タイプ（place, locality, neighborhood, address等）
    # @return [Hash] 地名データ
    # @raise [ApiError] API呼び出しに失敗した場合
    def reverse_geocode(lat:, lng:, types: nil)
      cache_key = build_cache_key(lat, lng, types)

      # キャッシュから取得を試みる
      cached_result = fetch_from_cache(cache_key)
      return cached_result if cached_result

      # APIから取得
      result = fetch_from_api(lat: lat, lng: lng, types: types)

      # キャッシュに保存
      store_in_cache(cache_key, result)

      result
    end

    # 順ジオコーディング（住所から座標を取得）- 将来の拡張用
    #
    # @param query [String] 検索クエリ（住所や地名）
    # @param proximity [Hash] 優先的に検索する中心座標 { lat:, lng: }
    # @return [Hash] 座標データ
    def forward_geocode(query:, proximity: nil)
      cache_key = "#{CACHE_KEY_PREFIX}/forward/#{Digest::MD5.hexdigest(query)}"

      cached_result = fetch_from_cache(cache_key)
      return cached_result if cached_result

      encoded_query = URI.encode_www_form_component(query)
      endpoint = "#{GEOCODING_PATH}/#{encoded_query}.json"

      response = connection.get(endpoint) do |req|
        req.params["access_token"] = @api_key
        req.params["language"] = DEFAULT_LANGUAGE
        req.params["country"] = DEFAULT_COUNTRY
        req.params["limit"] = 1

        if proximity
          req.params["proximity"] = "#{proximity[:lng]},#{proximity[:lat]}"
        end
      end

      result = handle_response(response) do |data|
        parse_forward_geocode(data)
      end

      store_in_cache(cache_key, result)
      result
    end

    private

    def fetch_from_api(lat:, lng:, types:)
      # Mapbox expects longitude,latitude order
      coordinates = "#{lng},#{lat}"
      endpoint = "#{GEOCODING_PATH}/#{coordinates}.json"

      response = connection.get(endpoint) do |req|
        req.params["access_token"] = @api_key
        req.params["language"] = DEFAULT_LANGUAGE
        req.params["country"] = DEFAULT_COUNTRY
        req.params["limit"] = 1

        if types.present?
          req.params["types"] = Array(types).join(",")
        end
      end

      handle_response(response) do |data|
        parse_reverse_geocode(data, lat, lng)
      end
    end

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

    def parse_reverse_geocode(data, lat, lng)
      features = data["features"]

      if features.blank?
        return {
          success: false,
          place_name: nil,
          formatted_address: nil,
          components: {},
          coordinates: { lat: lat, lng: lng },
          error: "No results found"
        }
      end

      feature = features.first
      context = feature["context"] || []

      # コンテキストから住所コンポーネントを抽出
      components = extract_address_components(feature, context)

      {
        success: true,
        place_name: feature["place_name"],
        formatted_address: build_formatted_address(components),
        short_address: build_short_address(components),
        components: components,
        coordinates: {
          lat: lat,
          lng: lng,
          mapbox_center: feature["center"]
        },
        feature_type: feature["place_type"]&.first,
        relevance: feature["relevance"]
      }
    end

    def parse_forward_geocode(data)
      features = data["features"]

      if features.blank?
        return {
          success: false,
          coordinates: nil,
          place_name: nil,
          error: "No results found"
        }
      end

      feature = features.first
      center = feature["center"]

      {
        success: true,
        coordinates: {
          lng: center[0],
          lat: center[1]
        },
        place_name: feature["place_name"],
        feature_type: feature["place_type"]&.first,
        relevance: feature["relevance"]
      }
    end

    def extract_address_components(feature, context)
      components = {}

      # メインのフィーチャーの情報
      feature_type = feature["place_type"]&.first
      components[feature_type.to_sym] = feature["text"] if feature_type

      # コンテキストから各レベルの地名を抽出
      context.each do |ctx|
        id = ctx["id"]
        next unless id

        # Mapbox context IDs: place.xxx, region.xxx, country.xxx, etc.
        type = id.split(".").first
        components[type.to_sym] = ctx["text"]

        # 日本語の短縮名があれば使用
        if ctx["short_code"]
          components["#{type}_code".to_sym] = ctx["short_code"]
        end
      end

      # 郵便番号
      if feature["properties"] && feature["properties"]["postcode"]
        components[:postcode] = feature["properties"]["postcode"]
      end

      components
    end

    def build_formatted_address(components)
      # 日本の住所形式: 県 → 市 → 地区
      parts = []
      parts << components[:country] if components[:country]
      parts << components[:region] if components[:region]
      parts << components[:place] if components[:place]
      parts << components[:locality] if components[:locality]
      parts << components[:neighborhood] if components[:neighborhood]
      parts << components[:address] if components[:address]

      parts.compact.join(", ")
    end

    def build_short_address(components)
      # 短縮住所: 市 + 地区のみ
      parts = []
      parts << components[:place] if components[:place]
      parts << components[:locality] if components[:locality]
      parts << components[:neighborhood] if components[:neighborhood]

      return components[:region] if parts.empty? && components[:region]

      parts.compact.join(", ")
    end

    def build_cache_key(lat, lng, types)
      # 座標を小数点4桁で丸めてキャッシュキーを生成（約11mの精度）
      rounded_lat = lat.round(4)
      rounded_lng = lng.round(4)
      types_key = types.present? ? Digest::MD5.hexdigest(Array(types).sort.join(",")) : "default"

      "#{CACHE_KEY_PREFIX}/reverse/#{rounded_lat}/#{rounded_lng}/#{types_key}"
    end

    def fetch_from_cache(key)
      return nil unless cache_available?

      cached = Rails.cache.read(key)
      if cached
        log_debug("Cache hit for #{key}")
        cached
      else
        log_debug("Cache miss for #{key}")
        nil
      end
    end

    def store_in_cache(key, value)
      return unless cache_available?

      Rails.cache.write(key, value, expires_in: CACHE_TTL)
      log_debug("Cached #{key} for #{CACHE_TTL}")
    end

    def cache_available?
      defined?(Rails) && Rails.respond_to?(:cache) && Rails.cache
    end

    def log_debug(message)
      if defined?(Rails) && Rails.respond_to?(:logger) && Rails.logger
        Rails.logger.debug("[GeocodingApi] #{message}")
      end
    end
  end
end
