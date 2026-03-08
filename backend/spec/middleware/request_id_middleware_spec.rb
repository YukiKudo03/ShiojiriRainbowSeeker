# frozen_string_literal: true

require "rails_helper"

RSpec.describe RequestIdMiddleware do
  let(:app) { ->(env) { [200, {}, ["OK"]] } }
  let(:middleware) { described_class.new(app) }

  after do
    # Ensure Thread.current is clean after each test
    Thread.current[:request_id] = nil
  end

  describe "#call" do
    it "generates a UUID request ID" do
      _status, headers, _body = middleware.call(Rack::MockRequest.env_for("/"))
      expect(headers["X-Request-Id"]).to match(/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i)
    end

    it "uses X-Request-Id header when provided with a valid value" do
      env = Rack::MockRequest.env_for("/", "HTTP_X_REQUEST_ID" => "custom-request-id-123")
      _status, headers, _body = middleware.call(env)
      expect(headers["X-Request-Id"]).to eq("custom-request-id-123")
    end

    it "uses a valid UUID from X-Request-Id header" do
      uuid = "550e8400-e29b-41d4-a716-446655440000"
      env = Rack::MockRequest.env_for("/", "HTTP_X_REQUEST_ID" => uuid)
      _status, headers, _body = middleware.call(env)
      expect(headers["X-Request-Id"]).to eq(uuid)
    end

    it "rejects invalid request IDs containing special characters" do
      env = Rack::MockRequest.env_for("/", "HTTP_X_REQUEST_ID" => "invalid id with spaces!")
      _status, headers, _body = middleware.call(env)
      # Should generate a new UUID instead of using the invalid one
      expect(headers["X-Request-Id"]).not_to eq("invalid id with spaces!")
      expect(headers["X-Request-Id"]).to match(/\A[\w\-]+\z/)
    end

    it "stores request ID in Thread.current during request processing" do
      captured_request_id = nil
      capturing_app = lambda do |_env|
        captured_request_id = Thread.current[:request_id]
        [200, {}, ["OK"]]
      end

      capturing_middleware = described_class.new(capturing_app)
      _status, headers, _body = capturing_middleware.call(Rack::MockRequest.env_for("/"))

      expect(captured_request_id).to eq(headers["X-Request-Id"])
    end

    it "adds X-Request-Id to response headers" do
      _status, headers, _body = middleware.call(Rack::MockRequest.env_for("/"))
      expect(headers).to have_key("X-Request-Id")
    end

    it "cleans up Thread.current after the request completes" do
      middleware.call(Rack::MockRequest.env_for("/"))
      expect(Thread.current[:request_id]).to be_nil
    end

    it "cleans up Thread.current even when the app raises an error" do
      error_app = ->(_env) { raise StandardError, "Something went wrong" }
      error_middleware = described_class.new(error_app)

      expect {
        error_middleware.call(Rack::MockRequest.env_for("/"))
      }.to raise_error(StandardError, "Something went wrong")

      expect(Thread.current[:request_id]).to be_nil
    end

    it "sets action_dispatch.request_id in the Rack environment" do
      captured_env = nil
      env_app = lambda do |env|
        captured_env = env
        [200, {}, ["OK"]]
      end

      env_middleware = described_class.new(env_app)
      env_middleware.call(Rack::MockRequest.env_for("/"))

      expect(captured_env["action_dispatch.request_id"]).to be_present
    end
  end

  describe ".request_id" do
    it "returns the current request ID during a request" do
      captured_class_method_value = nil
      capturing_app = lambda do |_env|
        captured_class_method_value = described_class.request_id
        [200, {}, ["OK"]]
      end

      capturing_middleware = described_class.new(capturing_app)
      _status, headers, _body = capturing_middleware.call(Rack::MockRequest.env_for("/"))

      expect(captured_class_method_value).to eq(headers["X-Request-Id"])
    end

    it "returns nil outside of a request" do
      expect(described_class.request_id).to be_nil
    end
  end
end
