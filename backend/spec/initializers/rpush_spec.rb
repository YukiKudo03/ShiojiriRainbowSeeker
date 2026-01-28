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

# Stub Rpush gem
module Rpush
  module Apns2
    class App
      attr_accessor :name, :certificate, :password, :environment, :bundle_id, :connections

      def self.find_by(attrs)
        nil
      end

      def save!
        true
      end
    end

    class Notification
      attr_accessor :app, :device_token, :alert, :data, :sound, :badge,
                    :content_available, :mutable_content, :category, :thread_id

      def save!
        @id = SecureRandom.uuid
        true
      end

      def id
        @id ||= SecureRandom.uuid
      end
    end
  end
end unless defined?(Rpush)

# Now require the initializer
require_relative "../../config/initializers/rpush"

RSpec.describe ApnsClient do
  before do
    Rails.logger = Logger.new("/dev/null")
    # Reset memoized instance variables
    described_class.instance_variable_set(:@rpush_app, nil)
  end

  describe ".configured?" do
    context "when no environment variables are set" do
      before do
        allow(ENV).to receive(:fetch).with("APNS_BUNDLE_ID", nil).and_return(nil)
        allow(ENV).to receive(:fetch).with("APNS_CERTIFICATE_PATH", nil).and_return(nil)
        allow(ENV).to receive(:fetch).with("APNS_CERTIFICATE_BASE64", nil).and_return(nil)
      end

      it "returns false" do
        expect(described_class.configured?).to be false
      end
    end

    context "when bundle_id and certificate_path are set" do
      before do
        allow(ENV).to receive(:fetch).with("APNS_BUNDLE_ID", nil).and_return("com.example.app")
        allow(ENV).to receive(:fetch).with("APNS_CERTIFICATE_PATH", nil).and_return("/path/to/cert.pem")
        allow(ENV).to receive(:fetch).with("APNS_CERTIFICATE_BASE64", nil).and_return(nil)
      end

      it "returns true" do
        expect(described_class.configured?).to be true
      end
    end

    context "when bundle_id and certificate_base64 are set" do
      before do
        allow(ENV).to receive(:fetch).with("APNS_BUNDLE_ID", nil).and_return("com.example.app")
        allow(ENV).to receive(:fetch).with("APNS_CERTIFICATE_PATH", nil).and_return(nil)
        allow(ENV).to receive(:fetch).with("APNS_CERTIFICATE_BASE64", nil).and_return("base64_cert_data")
      end

      it "returns true" do
        expect(described_class.configured?).to be true
      end
    end
  end

  describe ".environment" do
    context "when APNS_ENVIRONMENT is set" do
      before do
        allow(ENV).to receive(:fetch).with("APNS_ENVIRONMENT", nil).and_return("production")
      end

      it "returns the environment variable value" do
        expect(described_class.environment).to eq("production")
      end
    end

    context "when APNS_ENVIRONMENT is not set" do
      before do
        allow(ENV).to receive(:fetch).with("APNS_ENVIRONMENT", nil).and_return(nil)
      end

      context "in production Rails environment" do
        before do
          allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new("production"))
        end

        it "returns production" do
          expect(described_class.environment).to eq("production")
        end
      end

      context "in development Rails environment" do
        before do
          allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new("development"))
        end

        it "returns sandbox" do
          expect(described_class.environment).to eq("sandbox")
        end
      end
    end
  end

  describe ".bundle_id" do
    it "returns APNS_BUNDLE_ID from environment" do
      allow(ENV).to receive(:fetch).with("APNS_BUNDLE_ID", nil).and_return("jp.shiojiri.rainbow")

      expect(described_class.bundle_id).to eq("jp.shiojiri.rainbow")
    end

    it "returns nil when not set" do
      allow(ENV).to receive(:fetch).with("APNS_BUNDLE_ID", nil).and_return(nil)

      expect(described_class.bundle_id).to be_nil
    end
  end

  describe ".send_notification" do
    let(:token) { "apns_device_token_abc123" }
    let(:title) { "虹が見える可能性があります！" }
    let(:body) { "東の空をご覧ください" }
    let(:data) { { photo_id: "uuid-123" } }

    context "in test environment" do
      before do
        allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new("test"))
        allow(ENV).to receive(:fetch).with("APNS_BUNDLE_ID", nil).and_return("com.example.app")
        allow(ENV).to receive(:fetch).with("APNS_CERTIFICATE_PATH", nil).and_return("/path/to/cert.pem")
        allow(ENV).to receive(:fetch).with("APNS_CERTIFICATE_BASE64", nil).and_return(nil)
      end

      it "returns mock response" do
        result = described_class.send_notification(
          token: token,
          title: title,
          body: body,
          data: data
        )

        expect(result[:success]).to be true
        expect(result[:notification_id]).to start_with("mock_")
      end
    end

    context "when not configured" do
      before do
        allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new("development"))
        allow(ENV).to receive(:fetch).with("APNS_BUNDLE_ID", nil).and_return(nil)
        allow(ENV).to receive(:fetch).with("APNS_CERTIFICATE_PATH", nil).and_return(nil)
        allow(ENV).to receive(:fetch).with("APNS_CERTIFICATE_BASE64", nil).and_return(nil)
      end

      it "raises ConfigurationError" do
        expect {
          described_class.send_notification(
            token: token,
            title: title,
            body: body
          )
        }.to raise_error(ApnsClient::ConfigurationError, /not configured/)
      end
    end
  end

  describe ".send_to_devices" do
    let(:tokens) { [ "token1", "token2", "token3" ] }
    let(:title) { "Test Title" }
    let(:body) { "Test Body" }

    before do
      allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new("test"))
      allow(ENV).to receive(:fetch).with("APNS_BUNDLE_ID", nil).and_return("com.example.app")
      allow(ENV).to receive(:fetch).with("APNS_CERTIFICATE_PATH", nil).and_return("/path/to/cert.pem")
      allow(ENV).to receive(:fetch).with("APNS_CERTIFICATE_BASE64", nil).and_return(nil)
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
      expect(ApnsClient::ConfigurationError).to be < StandardError
    end

    it "defines NotificationError" do
      expect(ApnsClient::NotificationError).to be < StandardError
    end
  end
end
