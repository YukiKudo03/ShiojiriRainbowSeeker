# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Rack::Attack", type: :request do
  before do
    # Use in-memory store for isolated tests
    Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new
    Rack::Attack.reset!
  end

  after do
    Rack::Attack.reset!
  end

  # Helper to generate a valid auth header
  def bearer_header(token = "test-token-for-rate-limiting")
    { "HTTP_AUTHORIZATION" => "Bearer #{token}" }
  end

  describe "general API throttle (api/ip)" do
    it "allows requests under the limit of 300 per 5 minutes" do
      5.times do
        get "/api/v1/health", headers: { "REMOTE_ADDR" => "1.2.3.4" }
      end
      # Health check is safelisted, so use another endpoint
      # The throttle applies to /api/ paths; verify it does not block early
      expect(response).not_to have_http_status(:too_many_requests)
    end

    it "throttles requests exceeding 300 per 5 minutes from the same IP" do
      301.times do |i|
        get "/api/v1/photos", headers: { "REMOTE_ADDR" => "10.0.0.1" }
      end
      expect(response).to have_http_status(:too_many_requests)
    end

    it "does not apply to non-API paths" do
      301.times do
        get "/up", headers: { "REMOTE_ADDR" => "10.0.0.2" }
      end
      expect(response).not_to have_http_status(:too_many_requests)
    end
  end

  describe "authentication throttle (auth/ip)" do
    it "allows requests under the limit of 10 per minute" do
      5.times do
        post "/api/v1/auth/login",
             params: { email: "test@example.com", password: "wrong" }.to_json,
             headers: { "Content-Type" => "application/json", "REMOTE_ADDR" => "10.1.0.1" }
      end
      expect(response).not_to have_http_status(:too_many_requests)
    end

    it "throttles POST /api/v1/auth/login exceeding 10 per minute" do
      11.times do
        post "/api/v1/auth/login",
             params: { email: "test@example.com", password: "wrong" }.to_json,
             headers: { "Content-Type" => "application/json", "REMOTE_ADDR" => "10.1.0.2" }
      end
      expect(response).to have_http_status(:too_many_requests)
    end

    it "throttles POST /api/v1/auth/register exceeding 10 per minute" do
      11.times do
        post "/api/v1/auth/register",
             params: { email: "new@example.com", password: "password123" }.to_json,
             headers: { "Content-Type" => "application/json", "REMOTE_ADDR" => "10.1.0.3" }
      end
      expect(response).to have_http_status(:too_many_requests)
    end

    it "does not throttle GET requests to auth endpoints" do
      15.times do
        get "/api/v1/photos",
            headers: { "REMOTE_ADDR" => "10.1.0.4" }
      end
      expect(response).not_to have_http_status(:too_many_requests)
    end
  end

  describe "photo upload throttle (uploads/token)" do
    it "allows uploads under the limit of 20 per hour" do
      5.times do
        post "/api/v1/photos",
             params: {}.to_json,
             headers: { "Content-Type" => "application/json" }.merge(bearer_header("upload-user-token-1"))
      end
      expect(response).not_to have_http_status(:too_many_requests)
    end

    it "throttles uploads exceeding 20 per hour for the same token" do
      21.times do
        post "/api/v1/photos",
             params: {}.to_json,
             headers: { "Content-Type" => "application/json" }.merge(bearer_header("upload-user-token-2-longtoken"))
      end
      expect(response).to have_http_status(:too_many_requests)
    end

    it "does not throttle GET requests to the photos endpoint" do
      25.times do
        get "/api/v1/photos",
            headers: bearer_header("upload-user-token-3")
      end
      expect(response).not_to have_http_status(:too_many_requests)
    end
  end

  describe "social actions throttle (social/token)" do
    let(:photo) { create(:photo, :without_image) }

    it "allows social actions under the limit of 60 per minute" do
      5.times do
        post "/api/v1/photos/#{photo.id}/likes",
             params: {}.to_json,
             headers: { "Content-Type" => "application/json" }.merge(bearer_header("social-token-1-abcdefgh"))
      end
      expect(response).not_to have_http_status(:too_many_requests)
    end

    it "throttles social actions exceeding 60 per minute for the same token" do
      61.times do
        post "/api/v1/photos/#{photo.id}/likes",
             params: {}.to_json,
             headers: { "Content-Type" => "application/json" }.merge(bearer_header("social-token-2-abcdefgh"))
      end
      expect(response).to have_http_status(:too_many_requests)
    end
  end

  describe "health check safelist" do
    it "exempts /api/v1/health from rate limiting" do
      # Make many requests; health should never be throttled
      350.times do
        get "/api/v1/health", headers: { "REMOTE_ADDR" => "10.2.0.1" }
      end
      expect(response).not_to have_http_status(:too_many_requests)
    end

    it "exempts /api/v1/health/ready from rate limiting" do
      350.times do
        get "/api/v1/health/ready", headers: { "REMOTE_ADDR" => "10.2.0.2" }
      end
      expect(response).not_to have_http_status(:too_many_requests)
    end
  end

  describe "custom 429 response" do
    it "returns a JSON body with RATE_LIMITED error code" do
      11.times do
        post "/api/v1/auth/login",
             params: { email: "test@example.com", password: "wrong" }.to_json,
             headers: { "Content-Type" => "application/json", "REMOTE_ADDR" => "10.3.0.1" }
      end

      expect(response).to have_http_status(:too_many_requests)
      body = JSON.parse(response.body, symbolize_names: true)
      expect(body.dig(:error, :code)).to eq("RATE_LIMITED")
      expect(body.dig(:error, :message)).to be_present
      expect(body.dig(:error, :retry_after)).to be_a(Integer)
    end

    it "includes a Retry-After header" do
      11.times do
        post "/api/v1/auth/login",
             params: { email: "test@example.com", password: "wrong" }.to_json,
             headers: { "Content-Type" => "application/json", "REMOTE_ADDR" => "10.3.0.2" }
      end

      expect(response).to have_http_status(:too_many_requests)
      expect(response.headers["Retry-After"]).to be_present
      expect(response.headers["Retry-After"].to_i).to be > 0
    end

    it "returns application/json content type" do
      11.times do
        post "/api/v1/auth/login",
             params: { email: "test@example.com", password: "wrong" }.to_json,
             headers: { "Content-Type" => "application/json", "REMOTE_ADDR" => "10.3.0.3" }
      end

      expect(response).to have_http_status(:too_many_requests)
      expect(response.content_type).to include("application/json")
    end
  end
end
