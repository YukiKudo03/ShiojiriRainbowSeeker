# frozen_string_literal: true

module ExternalApis
  # RadarApi - RainViewer API連携モジュール
  #
  # 雨雲レーダーデータの取得を担当するクラス。
  # RainViewerは無料のレーダーデータAPIで、APIキー不要。
  #
  # 使用例:
  #   api = ExternalApis::RadarApi.new
  #   data = api.get_radar_data(lat: 36.115, lng: 137.954)
  #   historical = api.get_radar_data(lat: 36.115, lng: 137.954, timestamp: 1.hour.ago)
  #
  # RainViewer API Documentation: https://www.rainviewer.com/api.html
  #
  class RadarApi
    class ApiError < StandardError; end
    class InvalidResponseError < ApiError; end

    # RainViewer API base URL
    BASE_URL = "https://api.rainviewer.com"
    MAPS_ENDPOINT = "/public/weather-maps.json"

    # Tile URL patterns
    RADAR_TILE_URL = "https://tilecache.rainviewer.com/v2/radar/%{timestamp}/%{size}/%{z}/%{x}/%{y}/%{color}/%{options}.png"
    SATELLITE_TILE_URL = "https://tilecache.rainviewer.com/v2/satellite/%{timestamp}/%{size}/%{z}/%{x}/%{y}/%{color}/%{options}.png"

    # Default settings
    DEFAULT_TIMEOUT = 10 # seconds
    DEFAULT_TILE_SIZE = 256 # pixels
    DEFAULT_COLOR_SCHEME = 1 # 1-8 color schemes
    DEFAULT_SMOOTH = 1 # 0 = no smooth, 1 = smooth
    DEFAULT_SNOW = 1 # 0 = no snow, 1 = show snow

    # Precipitation intensity levels (dBZ to mm/h approximation)
    # Based on Z-R relationship: Z = 200 * R^1.6
    INTENSITY_LEVELS = {
      0..15 => { level: :none, mm_h: 0.0, description: "No precipitation" },
      16..25 => { level: :light, mm_h: 0.5, description: "Light precipitation" },
      26..35 => { level: :moderate, mm_h: 2.5, description: "Moderate precipitation" },
      36..45 => { level: :heavy, mm_h: 10.0, description: "Heavy precipitation" },
      46..55 => { level: :very_heavy, mm_h: 50.0, description: "Very heavy precipitation" },
      56..Float::INFINITY => { level: :extreme, mm_h: 100.0, description: "Extreme precipitation" }
    }.freeze

    def initialize(timeout: DEFAULT_TIMEOUT)
      @timeout = timeout
    end

    # 利用可能なレーダータイムスタンプを取得
    #
    # @return [Hash] 利用可能なタイムスタンプ情報
    # @raise [ApiError] API呼び出しに失敗した場合
    def available_timestamps
      response = connection.get(MAPS_ENDPOINT)

      handle_response(response) do |data|
        parse_available_timestamps(data)
      end
    end

    # 指定位置の雨雲レーダーデータを取得
    #
    # @param lat [Float] 緯度
    # @param lng [Float] 経度
    # @param timestamp [Time, Integer, nil] 取得したい時刻（nilの場合は最新）
    # @param zoom [Integer] ズームレベル（1-20、デフォルト10）
    # @return [Hash] レーダーデータ
    # @raise [ApiError] API呼び出しに失敗した場合
    def get_radar_data(lat:, lng:, timestamp: nil, zoom: 10)
      timestamps_data = available_timestamps

      # タイムスタンプを決定
      radar_timestamp = if timestamp.nil?
                          timestamps_data[:radar][:past].last
      else
                          find_closest_timestamp(timestamps_data[:radar][:past], timestamp)
      end

      return nil unless radar_timestamp

      # タイル座標を計算
      tile_coords = lat_lng_to_tile(lat, lng, zoom)

      # レーダータイル画像URLを生成
      tile_url = generate_tile_url(radar_timestamp, tile_coords, zoom)

      {
        timestamp: Time.at(radar_timestamp).utc,
        location: { lat: lat, lng: lng },
        zoom: zoom,
        tile_url: tile_url,
        tile_coords: tile_coords,
        coverage: timestamps_data[:radar][:coverage],
        # 予測データがあれば追加
        nowcast_available: timestamps_data[:radar][:nowcast].any?,
        nowcast_timestamps: timestamps_data[:radar][:nowcast].map { |ts| Time.at(ts).utc }
      }
    end

    # 指定位置の降水強度を取得（複数タイムスタンプ）
    #
    # @param lat [Float] 緯度
    # @param lng [Float] 経度
    # @param count [Integer] 取得するタイムスタンプ数（デフォルト7 = 過去1時間）
    # @return [Array<Hash>] 時系列降水データ
    def get_precipitation_timeline(lat:, lng:, count: 7)
      timestamps_data = available_timestamps
      past_timestamps = timestamps_data[:radar][:past].last(count)

      past_timestamps.map do |ts|
        tile_coords = lat_lng_to_tile(lat, lng, 10)
        {
          timestamp: Time.at(ts).utc,
          tile_url: generate_tile_url(ts, tile_coords, 10),
          tile_coords: tile_coords
        }
      end
    end

    # 予測データ（Nowcast）を取得
    #
    # @param lat [Float] 緯度
    # @param lng [Float] 経度
    # @return [Array<Hash>] 予測タイムラインデータ
    def get_nowcast(lat:, lng:)
      timestamps_data = available_timestamps
      nowcast_timestamps = timestamps_data[:radar][:nowcast]

      return [] if nowcast_timestamps.empty?

      nowcast_timestamps.map do |ts|
        tile_coords = lat_lng_to_tile(lat, lng, 10)
        {
          timestamp: Time.at(ts).utc,
          is_forecast: true,
          tile_url: generate_tile_url(ts, tile_coords, 10),
          tile_coords: tile_coords
        }
      end
    end

    # 雨雲の移動方向と速度を推定（簡易版）
    # 複数タイムスタンプのデータから推定
    #
    # @param lat [Float] 緯度
    # @param lng [Float] 経度
    # @return [Hash, nil] 移動方向と速度の推定値
    def estimate_movement(lat:, lng:)
      # この実装は簡易版です
      # 実際の雨雲追跡には画像解析が必要
      {
        direction: nil,
        speed: nil,
        estimated: false,
        note: "Movement estimation requires image analysis - not implemented in basic version"
      }
    end

    # 降水強度レベルを判定
    #
    # @param dbz [Integer] レーダー反射強度（dBZ）
    # @return [Hash] 強度レベル情報
    def self.classify_intensity(dbz)
      INTENSITY_LEVELS.each do |range, info|
        return info if range.include?(dbz)
      end
      INTENSITY_LEVELS.values.first # fallback to none
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
      when 400..499
        raise ApiError, "Client error: #{response.status} - #{response.body}"
      when 500..599
        raise ApiError, "Server error: #{response.status}"
      else
        raise InvalidResponseError, "Unexpected response: #{response.status}"
      end
    end

    def parse_available_timestamps(data)
      {
        generated: Time.at(data["generated"]).utc,
        host: data["host"],
        radar: {
          past: (data["radar"]&.dig("past") || []).map { |frame| frame["time"] },
          nowcast: (data["radar"]&.dig("nowcast") || []).map { |frame| frame["time"] },
          coverage: data["radar"]&.dig("past", 0, "path")&.include?("radar") ? :global : :unknown
        },
        satellite: {
          infrared: (data["satellite"]&.dig("infrared") || []).map { |frame| frame["time"] }
        }
      }
    end

    def find_closest_timestamp(timestamps, target_time)
      return nil if timestamps.empty?

      target_unix = target_time.is_a?(Time) ? target_time.to_i : target_time

      timestamps.min_by { |ts| (ts - target_unix).abs }
    end

    # 緯度経度からタイル座標を計算（Web Mercator / Slippy map tilenames）
    def lat_lng_to_tile(lat, lng, zoom)
      n = 2**zoom
      x = ((lng + 180.0) / 360.0 * n).floor
      lat_rad = lat * Math::PI / 180.0
      y = ((1.0 - Math.log(Math.tan(lat_rad) + 1.0 / Math.cos(lat_rad)) / Math::PI) / 2.0 * n).floor

      { x: x, y: y, z: zoom }
    end

    # タイルURLを生成
    def generate_tile_url(timestamp, tile_coords, zoom, options: {})
      tile_size = options[:tile_size] || DEFAULT_TILE_SIZE
      color_scheme = options[:color_scheme] || DEFAULT_COLOR_SCHEME
      smooth = options[:smooth] || DEFAULT_SMOOTH
      snow = options[:snow] || DEFAULT_SNOW

      options_str = "#{smooth}_#{snow}"

      format(RADAR_TILE_URL, {
        timestamp: timestamp,
        size: tile_size,
        z: zoom,
        x: tile_coords[:x],
        y: tile_coords[:y],
        color: color_scheme,
        options: options_str
      })
    end
  end
end
