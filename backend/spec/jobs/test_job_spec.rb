# frozen_string_literal: true

require "rails_helper"

RSpec.describe TestJob, type: :job do
  describe "#perform_later" do
    it "enqueues the job" do
      expect {
        described_class.perform_later("Test message")
      }.to have_enqueued_job(described_class)
        .with("Test message")
        .on_queue("default")
    end
  end

  describe "#perform" do
    it "logs the message successfully" do
      expect(Rails.logger).to receive(:info).with("[TestJob] Starting execution...")
      expect(Rails.logger).to receive(:info).with("[TestJob] Message: Hello World")
      expect(Rails.logger).to receive(:info).with(/\[TestJob\] Queue:/)
      expect(Rails.logger).to receive(:info).with(/\[TestJob\] Job ID:/)
      expect(Rails.logger).to receive(:info).with(/\[TestJob\] Executed at:/)
      expect(Rails.logger).to receive(:info).with("[TestJob] TestJob executed successfully: Hello World")

      result = described_class.new.perform("Hello World")
      expect(result).to be true
    end

    it "uses default message when none provided" do
      expect(Rails.logger).to receive(:info).exactly(6).times

      result = described_class.new.perform
      expect(result).to be true
    end
  end

  describe "queue configuration" do
    it "uses the default queue" do
      expect(described_class.new.queue_name).to eq("default")
    end
  end

  describe "retry configuration" do
    it "retries on StandardError" do
      expect(described_class.rescue_handlers).to include(
        have_attributes(
          first: "StandardError"
        )
      )
    end
  end
end
