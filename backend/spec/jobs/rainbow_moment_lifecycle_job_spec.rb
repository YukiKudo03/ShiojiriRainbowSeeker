# frozen_string_literal: true

require "rails_helper"

RSpec.describe RainbowMomentLifecycleJob, type: :job do
  include ActiveJob::TestHelper

  describe "#perform" do
    it "transitions expired active moments to closing" do
      moment = create(:rainbow_moment, :expired)

      described_class.perform_now

      expect(moment.reload.status).to eq("closing")
    end

    it "does not transition active moments that haven't expired" do
      moment = create(:rainbow_moment, ends_at: 10.minutes.from_now)

      described_class.perform_now

      expect(moment.reload.status).to eq("active")
    end

    it "transitions closing moments past grace period to archived" do
      moment = create(:rainbow_moment, :closing,
                      ends_at: (RainbowMoment::CLOSING_GRACE_PERIOD + 1.minute).ago)

      described_class.perform_now

      expect(moment.reload.status).to eq("archived")
    end

    it "does not transition closing moments still within grace period" do
      moment = create(:rainbow_moment, :closing, ends_at: 1.minute.ago)

      described_class.perform_now

      expect(moment.reload.status).to eq("closing")
    end

    it "does not schedule next run in test environment" do
      described_class.perform_now

      expect(RainbowMomentLifecycleJob).not_to have_been_enqueued
    end
  end
end
