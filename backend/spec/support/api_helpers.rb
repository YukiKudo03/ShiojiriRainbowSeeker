# frozen_string_literal: true

# API test helpers for request specs
module ApiHelpers
  # API version prefix
  API_V1_PREFIX = "/api/v1"

  # Standard JSON headers for API requests
  def json_headers
    {
      "Content-Type" => "application/json",
      "Accept" => "application/json"
    }
  end

  # Headers with authentication token
  def auth_headers(user)
    token = generate_jwt_token(user)
    json_headers.merge("Authorization" => "Bearer #{token}")
  end

  # Generate JWT token for user
  def generate_jwt_token(user)
    Warden::JWTAuth::UserEncoder.new.call(user, :user, nil).first
  end

  # Parse JSON response
  def json_body
    JSON.parse(response.body, symbolize_names: true)
  end

  # Get data from response
  def response_data
    json_body[:data]
  end

  # Get error from response
  def response_error
    json_body[:error]
  end

  # Get meta from response
  def response_meta
    json_body[:meta]
  end

  # Build API path
  def api_v1_path(path)
    "#{API_V1_PREFIX}#{path}"
  end

  # Common request methods with JSON content type
  def get_api(path, params: {}, headers: {})
    get api_v1_path(path), params: params, headers: json_headers.merge(headers)
  end

  def post_api(path, params: {}, headers: {})
    post api_v1_path(path), params: params.to_json, headers: json_headers.merge(headers)
  end

  def put_api(path, params: {}, headers: {})
    put api_v1_path(path), params: params.to_json, headers: json_headers.merge(headers)
  end

  def patch_api(path, params: {}, headers: {})
    patch api_v1_path(path), params: params.to_json, headers: json_headers.merge(headers)
  end

  def delete_api(path, params: {}, headers: {})
    delete api_v1_path(path), params: params.to_json, headers: json_headers.merge(headers)
  end

  # Authenticated request methods
  def get_api_as(user, path, params: {}, headers: {})
    get api_v1_path(path), params: params, headers: auth_headers(user).merge(headers)
  end

  def post_api_as(user, path, params: {}, headers: {})
    post api_v1_path(path), params: params.to_json, headers: auth_headers(user).merge(headers)
  end

  def put_api_as(user, path, params: {}, headers: {})
    put api_v1_path(path), params: params.to_json, headers: auth_headers(user).merge(headers)
  end

  def patch_api_as(user, path, params: {}, headers: {})
    patch api_v1_path(path), params: params.to_json, headers: auth_headers(user).merge(headers)
  end

  def delete_api_as(user, path, params: {}, headers: {})
    delete api_v1_path(path), params: params.to_json, headers: auth_headers(user).merge(headers)
  end

  # Assert successful response
  def expect_success_response(status: :ok)
    expect(response).to have_http_status(status)
    expect(json_body).to have_key(:data)
  end

  # Assert error response
  def expect_error_response(status:, code: nil)
    expect(response).to have_http_status(status)
    expect(json_body).to have_key(:error)
    expect(json_body[:error][:code]).to eq(code) if code
  end

  # Assert paginated response
  def expect_paginated_response
    expect(json_body).to have_key(:data)
    expect(json_body).to have_key(:meta)
    expect(json_body[:meta]).to include(:current_page, :total_pages, :total_count)
  end

  # Assert unauthorized response
  def expect_unauthorized_response
    expect_error_response(status: :unauthorized, code: "UNAUTHORIZED")
  end

  # Assert forbidden response
  def expect_forbidden_response
    expect_error_response(status: :forbidden, code: "FORBIDDEN")
  end

  # Assert not found response
  def expect_not_found_response
    expect_error_response(status: :not_found, code: "NOT_FOUND")
  end

  # Assert validation error response
  def expect_validation_error_response
    expect_error_response(status: :unprocessable_entity, code: "VALIDATION_FAILED")
  end
end

# Factory helpers for common test data patterns
module FactoryHelpers
  # Create a user with a photo
  def create_user_with_photo(user_traits: [], photo_traits: [])
    user = create(:user, *user_traits)
    photo = create(:photo, *photo_traits, user: user)
    [ user, photo ]
  end

  # Create a user with multiple photos
  def create_user_with_photos(count: 3, user_traits: [], photo_traits: [])
    user = create(:user, *user_traits)
    photos = create_list(:photo, count, *photo_traits, user: user)
    [ user, photos ]
  end

  # Create a photo with comments and likes
  def create_photo_with_engagement(comment_count: 2, like_count: 3)
    photo = create(:photo)
    comments = create_list(:comment, comment_count, photo: photo)
    likes = create_list(:like, like_count, photo: photo)
    [ photo, comments, likes ]
  end

  # Create admin user
  def create_admin_user(traits: [])
    create(:user, :admin, *traits)
  end

  # Create reported content
  def create_reported_photo(report_count: 1)
    photo = create(:photo)
    reports = create_list(:report, report_count, reportable: photo)
    [ photo, reports ]
  end
end

RSpec.configure do |config|
  config.include ApiHelpers, type: :request
  config.include FactoryHelpers, type: :request
  config.include FactoryHelpers, type: :service
end
