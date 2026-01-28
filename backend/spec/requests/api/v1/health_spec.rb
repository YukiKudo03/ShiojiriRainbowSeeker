# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Health", type: :request do
  let(:json_headers) { { "Accept" => "application/json" } }

  describe "GET /api/v1/health" do
    it "returns 200 status when healthy" do
      get "/api/v1/health", headers: json_headers
      expect(response).to have_http_status(:ok)
    end

    it "returns health status data" do
      get "/api/v1/health", headers: json_headers
      expect(json_response[:status]).to eq("healthy")
      expect(json_response[:timestamp]).to be_present
      expect(json_response[:environment]).to eq("test")
    end

    it "includes database check" do
      get "/api/v1/health", headers: json_headers
      expect(json_response[:checks][:database]).to be_present
      expect(json_response[:checks][:database][:status]).to eq("healthy")
    end

    it "includes cache check" do
      get "/api/v1/health", headers: json_headers
      expect(json_response[:checks][:cache]).to be_present
    end

    it "includes queue check" do
      get "/api/v1/health", headers: json_headers
      expect(json_response[:checks][:queue]).to be_present
    end

    it "includes system resources" do
      get "/api/v1/health", headers: json_headers
      expect(json_response[:checks][:system]).to be_present
      expect(json_response[:checks][:system][:ruby_version]).to eq(RUBY_VERSION)
      expect(json_response[:checks][:system][:rails_version]).to eq(Rails.version)
    end

    it "includes version information" do
      get "/api/v1/health", headers: json_headers
      expect(json_response[:version]).to be_present
    end

    it "includes uptime information" do
      get "/api/v1/health", headers: json_headers
      expect(json_response[:uptime]).to be_present
    end

    context "when database is unavailable" do
      before do
        allow(ActiveRecord::Base.connection).to receive(:execute).and_raise(ActiveRecord::ConnectionNotEstablished)
      end

      it "returns unhealthy status" do
        get "/api/v1/health", headers: json_headers
        # Note: The first database check in collect_health_data will fail
        # but the controller still handles the error
        expect(json_response[:checks][:database][:status]).to eq("unhealthy")
      end
    end
  end

  describe "GET /api/v1/health/ready" do
    context "when system is ready" do
      it "returns 200 status" do
        get "/api/v1/health/ready", headers: json_headers
        expect(response).to have_http_status(:ok)
      end

      it "returns ready status" do
        get "/api/v1/health/ready", headers: json_headers
        expect(json_response[:status]).to eq("ready")
        expect(json_response[:timestamp]).to be_present
      end
    end

    context "when database is unavailable" do
      before do
        allow(ActiveRecord::Base.connection).to receive(:execute).and_raise(ActiveRecord::ConnectionNotEstablished)
      end

      it "returns 503 status" do
        get "/api/v1/health/ready", headers: json_headers
        expect(response).to have_http_status(:service_unavailable)
      end

      it "returns not_ready status" do
        get "/api/v1/health/ready", headers: json_headers
        expect(json_response[:status]).to eq("not_ready")
      end
    end
  end

  describe "GET /api/v1/health/live" do
    it "returns 200 status" do
      get "/api/v1/health/live", headers: json_headers
      expect(response).to have_http_status(:ok)
    end

    it "returns alive status" do
      get "/api/v1/health/live", headers: json_headers
      expect(json_response[:status]).to eq("alive")
      expect(json_response[:timestamp]).to be_present
    end
  end

  describe "Authentication" do
    it "allows unauthenticated access to all health endpoints" do
      endpoints = [
        "/api/v1/health",
        "/api/v1/health/ready",
        "/api/v1/health/live"
      ]

      endpoints.each do |endpoint|
        get endpoint, headers: json_headers
        expect(response).not_to have_http_status(:unauthorized),
          "Expected #{endpoint} to allow unauthenticated access"
      end
    end
  end
end
