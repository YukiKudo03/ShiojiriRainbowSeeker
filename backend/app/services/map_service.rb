# frozen_string_literal: true

# MapService provides map-related business logic for the Shiojiri Rainbow Seeker API.
#
# This service object handles:
# - Map marker retrieval within bounding boxes
# - Photo clustering using PostGIS ST_ClusterDBSCAN
# - Heatmap data generation for density visualization
#
# == PostGIS Functions Used
# - ST_Within: Bounds filtering
# - ST_MakeEnvelope: Bounding box creation
# - ST_ClusterDBSCAN: Density-based clustering
# - ST_Centroid: Cluster center calculation
# - ST_SnapToGrid: Heatmap grid snapping
#
# == Usage
#   service = MapService.new
#   result = service.markers(
#     bounds: { sw_lat: 36.0, sw_lng: 137.8, ne_lat: 36.2, ne_lng: 138.0 },
#     filters: { start_date: '2024-01-01' },
#     limit: 100
#   )
#
class MapService
  # Default maximum markers to return
  DEFAULT_MARKER_LIMIT = 500

  # Maximum markers allowed
  MAX_MARKER_LIMIT = 2000

  # Default clustering distance in meters
  DEFAULT_CLUSTER_DISTANCE = 500

  # Default minimum points to form a cluster
  DEFAULT_MIN_POINTS = 2

  # Default grid size for heatmap in meters
  DEFAULT_GRID_SIZE = 100

  # Cache TTL for map data
  CACHE_TTL = 5.minutes

  # Get photo markers within bounding box
  #
  # @param bounds [Hash] bounding box coordinates
  # @param filters [Hash] optional filters (start_date, end_date, user_id)
  # @param limit [Integer] maximum markers to return
  # @return [Hash] result with markers data
  def markers(bounds:, filters: {}, limit: nil)
    limit = sanitize_limit(limit)

    cache_key = build_cache_key("markers", bounds, filters, limit)
    cached_result = fetch_from_cache(cache_key)
    return cached_result if cached_result

    photos = build_base_query(bounds, filters)
                .includes(:user, image_attachment: :blob)
                .limit(limit)
                .select(:id, :location, :captured_at, :title, :user_id)

    total_count = count_photos_in_bounds(bounds, filters)

    result = success_result(
      markers: photos.map { |photo| marker_data(photo) },
      totalCount: total_count,
      bounds: bounds
    )

    store_in_cache(cache_key, result)
    result
  rescue StandardError => e
    log_error("Failed to fetch markers: #{e.message}")
    failure_result(
      code: ErrorHandler::ErrorCodes::INTERNAL_ERROR,
      message: "Failed to fetch map markers"
    )
  end

  # Get clustered markers within bounding box using PostGIS ST_ClusterDBSCAN
  #
  # @param bounds [Hash] bounding box coordinates
  # @param filters [Hash] optional filters
  # @param cluster_distance [Float] clustering distance in meters (default: 500)
  # @param min_points [Integer] minimum points to form cluster (default: 2)
  # @return [Hash] result with clusters data
  def clusters(bounds:, filters: {}, cluster_distance: nil, min_points: nil)
    cluster_distance = (cluster_distance || DEFAULT_CLUSTER_DISTANCE).to_f
    min_points = (min_points || DEFAULT_MIN_POINTS).to_i

    cache_key = build_cache_key("clusters", bounds, filters, cluster_distance, min_points)
    cached_result = fetch_from_cache(cache_key)
    return cached_result if cached_result

    # Build the clustering query using ST_ClusterDBSCAN
    cluster_data = execute_clustering_query(bounds, filters, cluster_distance, min_points)

    total_photos = cluster_data.sum { |c| c[:count] }
    total_clusters = cluster_data.count { |c| c[:cluster_id] >= 0 }
    unclustered_count = cluster_data.select { |c| c[:cluster_id] < 0 }.sum { |c| c[:count] }

    result = success_result(
      clusters: cluster_data.map { |c| format_cluster(c) },
      totalPhotos: total_photos,
      totalClusters: total_clusters,
      unclusteredCount: unclustered_count,
      bounds: bounds
    )

    store_in_cache(cache_key, result)
    result
  rescue StandardError => e
    log_error("Failed to fetch clusters: #{e.message}")
    failure_result(
      code: ErrorHandler::ErrorCodes::INTERNAL_ERROR,
      message: "Failed to fetch map clusters"
    )
  end

  # Get heatmap data within bounding box
  #
  # @param bounds [Hash] bounding box coordinates
  # @param filters [Hash] optional filters
  # @param grid_size [Float] grid cell size in meters (default: 100)
  # @return [Hash] result with heatmap data
  def heatmap(bounds:, filters: {}, grid_size: nil)
    grid_size = (grid_size || DEFAULT_GRID_SIZE).to_f

    cache_key = build_cache_key("heatmap", bounds, filters, grid_size)
    cached_result = fetch_from_cache(cache_key)
    return cached_result if cached_result

    # Build heatmap query using ST_SnapToGrid for aggregation
    heatmap_data = execute_heatmap_query(bounds, filters, grid_size)

    max_count = heatmap_data.map { |p| p[:count] }.max || 1
    total_photos = heatmap_data.sum { |p| p[:count] }

    # Calculate intensity (0.0 - 1.0) based on count
    heatmap_points = heatmap_data.map do |point|
      {
        latitude: point[:latitude],
        longitude: point[:longitude],
        intensity: (point[:count].to_f / max_count).round(3),
        count: point[:count]
      }
    end

    result = success_result(
      heatmapPoints: heatmap_points,
      maxIntensity: 1.0,
      maxCount: max_count,
      totalPhotos: total_photos,
      bounds: bounds
    )

    store_in_cache(cache_key, result)
    result
  rescue StandardError => e
    log_error("Failed to fetch heatmap: #{e.message}")
    failure_result(
      code: ErrorHandler::ErrorCodes::INTERNAL_ERROR,
      message: "Failed to fetch heatmap data"
    )
  end

  private

  # Build base query with bounds and filters
  def build_base_query(bounds, filters)
    query = Photo.visible.within_bounds(
      bounds[:sw_lat],
      bounds[:sw_lng],
      bounds[:ne_lat],
      bounds[:ne_lng]
    )

    query = apply_filters(query, filters)
    query
  end

  # Apply filters to query
  def apply_filters(query, filters)
    if filters[:start_date].present?
      query = query.where("captured_at >= ?", Date.parse(filters[:start_date].to_s))
    end

    if filters[:end_date].present?
      query = query.where("captured_at <= ?", Date.parse(filters[:end_date].to_s).end_of_day)
    end

    if filters[:user_id].present?
      query = query.where(user_id: filters[:user_id])
    end

    query
  end

  # Count photos in bounds with filters
  def count_photos_in_bounds(bounds, filters)
    build_base_query(bounds, filters).count
  end

  # Execute PostGIS clustering query
  def execute_clustering_query(bounds, filters, cluster_distance, min_points)
    # Convert meters to degrees (approximate for this latitude)
    # At ~36°N latitude, 1 degree ≈ 90km for longitude, 111km for latitude
    eps_degrees = cluster_distance / 111_000.0

    # Build WHERE clause for bounds and filters
    where_conditions = build_where_conditions(bounds, filters)

    # PostGIS ST_ClusterDBSCAN query
    # Note: ST_ClusterDBSCAN uses degrees for the eps parameter when working with geography
    sql = <<~SQL
      WITH filtered_photos AS (
        SELECT id, location, captured_at, title
        FROM photos
        WHERE is_visible = true
          AND moderation_status = 1
          AND #{where_conditions}
      ),
      clustered AS (
        SELECT
          id,
          ST_Y(location::geometry) as latitude,
          ST_X(location::geometry) as longitude,
          captured_at,
          title,
          ST_ClusterDBSCAN(location::geometry, #{eps_degrees}, #{min_points}) OVER () as cluster_id
        FROM filtered_photos
      )
      SELECT
        cluster_id,
        COUNT(*) as count,
        AVG(latitude) as center_lat,
        AVG(longitude) as center_lng,
        ARRAY_AGG(id) as photo_ids,
        MIN(captured_at) as earliest_capture,
        MAX(captured_at) as latest_capture
      FROM clustered
      GROUP BY cluster_id
      ORDER BY count DESC
    SQL

    result = ActiveRecord::Base.connection.execute(sql)
    result.map do |row|
      {
        cluster_id: row["cluster_id"] || -1,
        count: row["count"].to_i,
        latitude: row["center_lat"].to_f,
        longitude: row["center_lng"].to_f,
        photo_ids: parse_pg_array(row["photo_ids"]),
        earliest_capture: row["earliest_capture"],
        latest_capture: row["latest_capture"]
      }
    end
  end

  # Execute heatmap query using ST_SnapToGrid
  def execute_heatmap_query(bounds, filters, grid_size)
    # Convert meters to degrees (approximate)
    grid_degrees = grid_size / 111_000.0

    where_conditions = build_where_conditions(bounds, filters)

    sql = <<~SQL
      SELECT
        ST_Y(ST_SnapToGrid(location::geometry, #{grid_degrees})) as latitude,
        ST_X(ST_SnapToGrid(location::geometry, #{grid_degrees})) as longitude,
        COUNT(*) as count
      FROM photos
      WHERE is_visible = true
        AND moderation_status = 1
        AND #{where_conditions}
      GROUP BY ST_SnapToGrid(location::geometry, #{grid_degrees})
      ORDER BY count DESC
    SQL

    result = ActiveRecord::Base.connection.execute(sql)
    result.map do |row|
      {
        latitude: row["latitude"].to_f,
        longitude: row["longitude"].to_f,
        count: row["count"].to_i
      }
    end
  end

  # Build WHERE conditions for bounds and filters
  def build_where_conditions(bounds, filters)
    conn = ActiveRecord::Base.connection
    conditions = []

    # Bounding box condition
    conditions << "ST_Within(location::geometry, ST_MakeEnvelope(#{conn.quote(bounds[:sw_lng])}, #{conn.quote(bounds[:sw_lat])}, #{conn.quote(bounds[:ne_lng])}, #{conn.quote(bounds[:ne_lat])}, 4326))"

    # Date filters
    if filters[:start_date].present?
      date = Date.parse(filters[:start_date].to_s)
      conditions << "captured_at >= #{conn.quote(date)}"
    end

    if filters[:end_date].present?
      date = Date.parse(filters[:end_date].to_s).end_of_day
      conditions << "captured_at <= #{conn.quote(date)}"
    end

    if filters[:user_id].present?
      conditions << "user_id = #{conn.quote(filters[:user_id])}"
    end

    conditions.join(" AND ")
  end

  # Parse PostgreSQL array string to Ruby array
  def parse_pg_array(pg_array_string)
    return [] if pg_array_string.blank?

    # Handle both string format "{uuid1,uuid2}" and already-parsed array
    if pg_array_string.is_a?(Array)
      pg_array_string
    else
      pg_array_string.gsub(/[{}]/, "").split(",")
    end
  end

  # Format cluster data for response
  def format_cluster(cluster)
    if cluster[:cluster_id] < 0
      # Unclustered points - return as individual markers
      {
        id: "unclustered_#{cluster[:photo_ids].first}",
        latitude: cluster[:latitude],
        longitude: cluster[:longitude],
        count: cluster[:count],
        photoIds: cluster[:photo_ids],
        isCluster: false
      }
    else
      {
        id: "cluster_#{cluster[:cluster_id]}",
        latitude: cluster[:latitude],
        longitude: cluster[:longitude],
        count: cluster[:count],
        photoIds: cluster[:photo_ids],
        isCluster: cluster[:count] > 1
      }
    end
  end

  # Format single marker data
  def marker_data(photo)
    {
      id: photo.id,
      latitude: photo.latitude,
      longitude: photo.longitude,
      title: photo.title,
      thumbnailUrl: photo.thumbnail_url,
      capturedAt: photo.captured_at&.iso8601
    }
  end

  # Sanitize limit parameter
  def sanitize_limit(limit)
    limit = limit.to_i
    limit = DEFAULT_MARKER_LIMIT if limit <= 0
    [ limit, MAX_MARKER_LIMIT ].min
  end

  # Build cache key for map data
  def build_cache_key(type, bounds, filters, *extra)
    parts = [
      "map_service/v1",
      type,
      bounds.values.map { |v| v.round(4) }.join(","),
      Digest::MD5.hexdigest(filters.to_json),
      extra.map(&:to_s).join("_")
    ]
    parts.join("/")
  end

  # Fetch from cache if available
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

  # Store in cache
  def store_in_cache(key, value)
    return unless cache_available?

    Rails.cache.write(key, value, expires_in: CACHE_TTL)
    log_debug("Cached #{key} for #{CACHE_TTL}")
  end

  # Check if cache is available
  def cache_available?
    defined?(Rails) && Rails.respond_to?(:cache) && Rails.cache
  end

  # Success result helper
  def success_result(data)
    { success: true, data: data }
  end

  # Failure result helper
  def failure_result(code:, message:, details: nil)
    result = {
      success: false,
      error: {
        code: code,
        message: message
      }
    }
    result[:error][:details] = details if details.present?
    result
  end

  # Log error
  def log_error(message)
    if defined?(Rails) && Rails.respond_to?(:logger) && Rails.logger
      Rails.logger.error("[MapService] #{message}")
    end
  end

  # Log debug
  def log_debug(message)
    if defined?(Rails) && Rails.respond_to?(:logger) && Rails.logger
      Rails.logger.debug("[MapService] #{message}")
    end
  end
end
