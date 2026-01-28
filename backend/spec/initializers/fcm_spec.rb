# frozen_string_literal: true

require "rails_helper"
require "active_support/all"
require "securerandom"
require "ostruct"

# Stub Rails before loading the initializer
module Rails
  class << self
    attr_accessor :logger, :cache

    def env
      @env ||= ActiveSupport::StringInquirer.new("test")
    end

    def application
      @application ||= ::OpenStruct.new(
        config: ::OpenStruct.new(
          after_initialize: proc { |&block| block&.call }
        )
      )
    end
  end
end unless defined?(Rails) && Rails.respond_to?(:logger=)

# Initialize Rails logger before loading initializer
Rails.logger = Logger.new("/dev/null")

# Stub FCM gem
class FCM
  attr_reader :project_id, :json_key_io, :server_key

  def initialize(project_id, json_key_io, server_key = nil)
    @project_id = project_id
    @json_key_io = json_key_io
    @server_key = server_key
  end

  def send_v1(message)
    { status_code: 200, body: { "name" => "projects/test/messages/mock123" } }
  end
end unless defined?(FCM)

# Now require the initializer
require_relative "../../config/initializers/fcm"

RSpec.describe FcmClient do
  before do
    # Reset any memoized state
    described_class.instance_variable_set(:@fcm_client, nil)
  end

  describe ".configured?" do
    context "when no environment variables are set" do
      before do
        allow(ENV).to receive(:fetch).with("FIREBASE_PROJECT_ID", nil).and_return(nil)
        allow(ENV).to receive(:fetch).with("FIREBASE_CREDENTIALS_JSON", nil).and_return(nil)
        allow(ENV).to receive(:fetch).with("FIREBASE_CREDENTIALS_PATH", nil).and_return(nil)
      end

      it "returns false" do
        expect(described_class.configured?).to be false
      end
    end

    context "when project_id and credentials_json are set" do
      before do
        allow(ENV).to receive(:fetch).with("FIREBASE_PROJECT_ID", nil).and_return("test-project")
        allow(ENV).to receive(:fetch).with("FIREBASE_CREDENTIALS_JSON", nil).and_return("base64_encoded_json")
        allow(ENV).to receive(:fetch).with("FIREBASE_CREDENTIALS_PATH", nil).and_return(nil)
      end

      it "returns true" do
        expect(described_class.configured?).to be true
      end
    end

    context "when project_id and credentials_path are set" do
      before do
        allow(ENV).to receive(:fetch).with("FIREBASE_PROJECT_ID", nil).and_return("test-project")
        allow(ENV).to receive(:fetch).with("FIREBASE_CREDENTIALS_JSON", nil).and_return(nil)
        allow(ENV).to receive(:fetch).with("FIREBASE_CREDENTIALS_PATH", nil).and_return("/path/to/credentials.json")
      end

      it "returns true" do
        expect(described_class.configured?).to be true
      end
    end
  end

  describe ".project_id" do
    it "returns FIREBASE_PROJECT_ID from environment" do
      allow(ENV).to receive(:fetch).with("FIREBASE_PROJECT_ID", nil).and_return("my-firebase-project")

      expect(described_class.project_id).to eq("my-firebase-project")
    end

    it "returns nil when not set" do
      allow(ENV).to receive(:fetch).with("FIREBASE_PROJECT_ID", nil).and_return(nil)

      expect(described_class.project_id).to be_nil
    end
  end

  describe ".send_notification" do
    let(:token) { "fcm_device_token_123" }
    let(:title) { "虹が見える可能性があります！" }
    let(:body) { "東の空をご覧ください" }
    let(:data) { { photo_id: "uuid-123" } }

    context "in test environment" do
      before do
        allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new("test"))
        allow(ENV).to receive(:fetch).with("FIREBASE_PROJECT_ID", nil).and_return("test-project")
        allow(ENV).to receive(:fetch).with("FIREBASE_CREDENTIALS_JSON", nil).and_return("credentials")
        allow(ENV).to receive(:fetch).with("FIREBASE_CREDENTIALS_PATH", nil).and_return(nil)
      end

      it "returns mock response" do
        result = described_class.send_notification(
          token: token,
          title: title,
          body: body,
          data: data
        )

        expect(result[:success]).to be true
        expect(result[:message_id]).to start_with("mock_")
      end
    end

    context "when not configured" do
      before do
        allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new("development"))
        allow(ENV).to receive(:fetch).with("FIREBASE_PROJECT_ID", nil).and_return(nil)
        allow(ENV).to receive(:fetch).with("FIREBASE_CREDENTIALS_JSON", nil).and_return(nil)
        allow(ENV).to receive(:fetch).with("FIREBASE_CREDENTIALS_PATH", nil).and_return(nil)
      end

      it "raises ConfigurationError" do
        expect {
          described_class.send_notification(
            token: token,
            title: title,
            body: body
          )
        }.to raise_error(FcmClient::ConfigurationError, /not configured/)
      end
    end
  end

  describe ".send_to_devices" do
    let(:tokens) { [ "token1", "token2", "token3" ] }
    let(:title) { "Test Title" }
    let(:body) { "Test Body" }

    before do
      allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new("test"))
      allow(ENV).to receive(:fetch).with("FIREBASE_PROJECT_ID", nil).and_return("test-project")
      allow(ENV).to receive(:fetch).with("FIREBASE_CREDENTIALS_JSON", nil).and_return("credentials")
      allow(ENV).to receive(:fetch).with("FIREBASE_CREDENTIALS_PATH", nil).and_return(nil)
    end

    it "sends to multiple devices" do
      results = described_class.send_to_devices(
        tokens: tokens,
        title: title,
        body: body
      )

      expect(results.length).to eq(3)
      expect(results.all? { |r| r[:success] }).to be true
    end
  end

  describe "error classes" do
    it "defines ConfigurationError" do
      expect(FcmClient::ConfigurationError).to be < StandardError
    end

    it "defines NotificationError" do
      expect(FcmClient::NotificationError).to be < StandardError
    end
  end

  describe "constants" do
    it "defines FCM_API_BASE" do
      expect(FcmClient::FCM_API_BASE).to eq("https://fcm.googleapis.com/v1/projects")
    end
  end
end
