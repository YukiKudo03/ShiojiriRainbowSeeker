# frozen_string_literal: true

require "rails_helper"
require "webmock/rspec"

RSpec.describe LineClient do
  let(:test_token) { "test-line-channel-access-token" }

  before do
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with("LINE_CHANNEL_ACCESS_TOKEN").and_return(test_token)
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with("LINE_CHANNEL_ACCESS_TOKEN").and_return(test_token)
    # Reset the memoized connection between tests
    described_class.instance_variable_set(:@connection, nil)
  end

  describe ".configured?" do
    context "when LINE_CHANNEL_ACCESS_TOKEN is set" do
      it "returns true" do
        expect(described_class.configured?).to be true
      end
    end

    context "when LINE_CHANNEL_ACCESS_TOKEN is not set" do
      before do
        allow(ENV).to receive(:[]).with("LINE_CHANNEL_ACCESS_TOKEN").and_return(nil)
      end

      it "returns false" do
        expect(described_class.configured?).to be false
      end
    end

    context "when LINE_CHANNEL_ACCESS_TOKEN is empty string" do
      before do
        allow(ENV).to receive(:[]).with("LINE_CHANNEL_ACCESS_TOKEN").and_return("")
      end

      it "returns false" do
        expect(described_class.configured?).to be false
      end
    end
  end

  describe ".send_push_message" do
    let(:line_user_id) { "U1234567890abcdef" }
    let(:title) { "Rainbow Alert" }
    let(:body) { "Look east for a rainbow!" }
    let(:data) { { type: "rainbow_alert" } }

    context "when not configured" do
      before do
        allow(ENV).to receive(:[]).with("LINE_CHANNEL_ACCESS_TOKEN").and_return(nil)
      end

      it "raises ConfigurationError" do
        expect {
          described_class.send_push_message(
            line_user_id: line_user_id,
            title: title,
            body: body
          )
        }.to raise_error(LineClient::ConfigurationError, /not configured/)
      end
    end

    context "when configured" do
      it "sends POST to PUSH_URL with Bearer token" do
        stub = stub_request(:post, LineClient::PUSH_URL)
          .with(
            headers: {
              "Authorization" => "Bearer #{test_token}",
              "Content-Type" => "application/json"
            }
          )
          .to_return(status: 200, body: "{}")

        described_class.send_push_message(
          line_user_id: line_user_id,
          title: title,
          body: body,
          data: data
        )

        expect(stub).to have_been_requested
      end

      it "includes line_user_id in payload as 'to' field" do
        stub = stub_request(:post, LineClient::PUSH_URL)
          .with { |request|
            payload = JSON.parse(request.body)
            payload["to"] == line_user_id
          }
          .to_return(status: 200, body: "{}")

        described_class.send_push_message(
          line_user_id: line_user_id,
          title: title,
          body: body,
          data: data
        )

        expect(stub).to have_been_requested
      end

      context "when API returns 200" do
        before do
          stub_request(:post, LineClient::PUSH_URL)
            .to_return(status: 200, body: "{}")
        end

        it "returns success hash with line_user_id" do
          result = described_class.send_push_message(
            line_user_id: line_user_id,
            title: title,
            body: body,
            data: data
          )

          expect(result[:success]).to be true
          expect(result[:line_user_id]).to eq(line_user_id)
        end
      end

      context "when API returns 400" do
        before do
          stub_request(:post, LineClient::PUSH_URL)
            .to_return(status: 400, body: '{"message":"Invalid request"}')
        end

        it "returns error hash" do
          result = described_class.send_push_message(
            line_user_id: line_user_id,
            title: title,
            body: body
          )

          expect(result[:success]).to be false
          expect(result[:error]).to include("Invalid request")
        end
      end

      context "when API returns 401" do
        before do
          stub_request(:post, LineClient::PUSH_URL)
            .to_return(status: 401, body: '{"message":"Unauthorized"}')
        end

        it "returns error about invalid channel access token" do
          result = described_class.send_push_message(
            line_user_id: line_user_id,
            title: title,
            body: body
          )

          expect(result[:success]).to be false
          expect(result[:error]).to include("Invalid channel access token")
        end
      end

      context "when API returns 429" do
        before do
          stub_request(:post, LineClient::PUSH_URL)
            .to_return(status: 429, body: '{"message":"Rate limited"}')
        end

        it "returns rate limit error" do
          result = described_class.send_push_message(
            line_user_id: line_user_id,
            title: title,
            body: body
          )

          expect(result[:success]).to be false
          expect(result[:error]).to include("Rate limit exceeded")
        end
      end

      context "when Faraday::Error is raised" do
        before do
          stub_request(:post, LineClient::PUSH_URL)
            .to_raise(Faraday::ConnectionFailed.new("Connection refused"))
        end

        it "returns error hash with message" do
          result = described_class.send_push_message(
            line_user_id: line_user_id,
            title: title,
            body: body
          )

          expect(result[:success]).to be false
          expect(result[:error]).to include("Connection refused")
        end
      end
    end
  end

  describe ".send_multicast" do
    let(:line_user_ids) { [ "U001", "U002", "U003" ] }
    let(:title) { "Rainbow Alert" }
    let(:body) { "Check the sky!" }
    let(:data) { { type: "rainbow_alert" } }

    context "when not configured" do
      before do
        allow(ENV).to receive(:[]).with("LINE_CHANNEL_ACCESS_TOKEN").and_return(nil)
      end

      it "raises ConfigurationError" do
        expect {
          described_class.send_multicast(
            line_user_ids: line_user_ids,
            title: title,
            body: body
          )
        }.to raise_error(LineClient::ConfigurationError, /not configured/)
      end
    end

    context "when configured" do
      it "sends POST to MULTICAST_URL" do
        stub = stub_request(:post, LineClient::MULTICAST_URL)
          .with(
            headers: {
              "Authorization" => "Bearer #{test_token}",
              "Content-Type" => "application/json"
            }
          )
          .to_return(status: 200, body: "{}")

        described_class.send_multicast(
          line_user_ids: line_user_ids,
          title: title,
          body: body,
          data: data
        )

        expect(stub).to have_been_requested
      end

      context "when API returns 200" do
        before do
          stub_request(:post, LineClient::MULTICAST_URL)
            .to_return(status: 200, body: "{}")
        end

        it "returns array of results with success and batch_size" do
          results = described_class.send_multicast(
            line_user_ids: line_user_ids,
            title: title,
            body: body,
            data: data
          )

          expect(results).to be_an(Array)
          expect(results.length).to eq(1)
          expect(results.first[:success]).to be true
          expect(results.first[:batch_size]).to eq(3)
          expect(results.first[:status]).to eq(200)
        end
      end

      context "when user count exceeds MAX_MULTICAST_USERS" do
        let(:many_user_ids) { (1..750).map { |n| "U#{n.to_s.rjust(10, '0')}" } }

        before do
          stub_request(:post, LineClient::MULTICAST_URL)
            .to_return(status: 200, body: "{}")
        end

        it "batches in groups of MAX_MULTICAST_USERS (500)" do
          stub = stub_request(:post, LineClient::MULTICAST_URL)
            .to_return(status: 200, body: "{}")

          results = described_class.send_multicast(
            line_user_ids: many_user_ids,
            title: title,
            body: body,
            data: data
          )

          expect(stub).to have_been_requested.times(2)
          expect(results.length).to eq(2)
          expect(results[0][:batch_size]).to eq(500)
          expect(results[1][:batch_size]).to eq(250)
        end
      end

      context "when Faraday::Error is raised" do
        before do
          stub_request(:post, LineClient::MULTICAST_URL)
            .to_raise(Faraday::TimeoutError.new("Request timed out"))
        end

        it "returns error array" do
          results = described_class.send_multicast(
            line_user_ids: line_user_ids,
            title: title,
            body: body
          )

          expect(results).to be_an(Array)
          expect(results.first[:success]).to be false
          expect(results.first[:error]).to include("Request timed out")
        end
      end
    end
  end

  describe "constants" do
    it "defines PUSH_URL" do
      expect(LineClient::PUSH_URL).to eq("https://api.line.me/v2/bot/message/push")
    end

    it "defines MULTICAST_URL" do
      expect(LineClient::MULTICAST_URL).to eq("https://api.line.me/v2/bot/message/multicast")
    end

    it "defines MAX_MULTICAST_USERS as 500" do
      expect(LineClient::MAX_MULTICAST_USERS).to eq(500)
    end
  end
end
