# frozen_string_literal: true

require "rails_helper"

RSpec.describe ApplicationJob, type: :job do
  describe "retry configuration" do
    it "retries on ActiveRecord::Deadlocked" do
      retry_handlers = described_class.rescue_handlers
      deadlock_handler = retry_handlers.find { |h| h.first == "ActiveRecord::Deadlocked" }

      expect(deadlock_handler).to be_present
    end
  end

  describe "discard configuration" do
    it "discards on ActiveJob::DeserializationError" do
      discard_handlers = described_class.rescue_handlers
      deserialization_handler = discard_handlers.find { |h| h.first == "ActiveJob::DeserializationError" }

      expect(deserialization_handler).to be_present
    end
  end

  describe "around_perform logging" do
    # Create a concrete test job class that inherits from ApplicationJob
    let(:test_job_class) do
      Class.new(ApplicationJob) do
        self.queue_adapter = :test

        def perform
          # no-op
        end
      end
    end

    it "logs start and completion messages" do
      allow(Rails.logger).to receive(:info).and_call_original
      expect(Rails.logger).to receive(:info).with(/Starting job/).at_least(:once)
      expect(Rails.logger).to receive(:info).with(/Completed job.*in.*s/).at_least(:once)

      test_job_class.perform_now
    end
  end

  describe "base class" do
    it "inherits from ActiveJob::Base" do
      expect(described_class.superclass).to eq(ActiveJob::Base)
    end
  end
end
