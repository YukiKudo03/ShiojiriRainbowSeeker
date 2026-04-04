# frozen_string_literal: true

require "rails_helper"

RSpec.describe RainbowMomentChannel, type: :channel do
  let(:user) { create(:user) }
  let(:moment) { create(:rainbow_moment) }

  before do
    stub_connection current_user: user
  end

  describe "#subscribed" do
    context "when moment is active" do
      it "subscribes to the moment stream" do
        subscribe(moment_id: moment.id)

        expect(subscription).to be_confirmed
        expect(subscription).to have_stream_from("rainbow_moment:#{moment.id}")
      end

      it "joins the moment as a participant" do
        expect {
          subscribe(moment_id: moment.id)
        }.to change { moment.participations.count }.by(1)
      end

      it "transmits initial state" do
        subscribe(moment_id: moment.id)

        expect(transmissions.last).to include(
          "type" => "initial_state"
        )
      end
    end

    context "when moment is archived" do
      let(:moment) { create(:rainbow_moment, :archived) }

      it "rejects the subscription" do
        subscribe(moment_id: moment.id)

        expect(subscription).to be_rejected
      end
    end

    context "when moment does not exist" do
      it "rejects the subscription" do
        subscribe(moment_id: SecureRandom.uuid)

        expect(subscription).to be_rejected
      end
    end

    context "when moment is closing" do
      let(:moment) { create(:rainbow_moment, :closing) }

      it "subscribes but does not join" do
        expect {
          subscribe(moment_id: moment.id)
        }.not_to change { moment.participations.count }

        expect(subscription).to be_confirmed
      end
    end
  end

  describe "#unsubscribed" do
    it "enqueues a leave job with grace period" do
      subscribe(moment_id: moment.id)

      expect {
        subscription.unsubscribe_from_channel
      }.to have_enqueued_job(RainbowMomentLeaveJob)
    end
  end

  describe "#new_photo" do
    it "broadcasts photo data to the moment stream" do
      subscribe(moment_id: moment.id)

      expect {
        perform :new_photo, photo_id: "test-id", thumbnail_url: "http://example.com/thumb.jpg",
                            latitude: 36.1, longitude: 137.9, captured_at: Time.current.iso8601
      }.to have_broadcasted_to("rainbow_moment:#{moment.id}")
        .with(hash_including(type: "new_photo"))
    end

    context "when moment is not active" do
      let(:moment) { create(:rainbow_moment, :closing) }

      it "does not broadcast" do
        subscribe(moment_id: moment.id)

        expect {
          perform :new_photo, photo_id: "test-id"
        }.not_to have_broadcasted_to("rainbow_moment:#{moment.id}")
      end
    end
  end
end
