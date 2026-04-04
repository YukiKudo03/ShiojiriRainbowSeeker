# frozen_string_literal: true

require "rails_helper"

RSpec.describe RainbowMomentLeaveJob, type: :job do
  let(:user) { create(:user) }
  let(:moment) { create(:rainbow_moment) }

  before do
    moment.join(user)
  end

  describe "#perform" do
    context "when user has no active subscription" do
      before do
        # Stub ActionCable.server.connections to return empty array
        allow(ActionCable.server).to receive(:connections).and_return([])
      end

      it "marks the user as having left the moment" do
        described_class.perform_now(moment_id: moment.id, user_id: user.id)

        participation = moment.participations.find_by(user: user)
        expect(participation.left_at).to be_present
      end
    end

    context "when user has an active subscription (reconnected)" do
      before do
        connection = double("connection")
        allow(connection).to receive(:current_user).and_return(user)
        subscription_id = { channel: "RainbowMomentChannel" }.to_json
        identifiers = double("identifiers")
        allow(identifiers).to receive(:any?).and_return(true)
        subscriptions = double("subscriptions", identifiers: [subscription_id])
        allow(connection).to receive(:subscriptions).and_return(subscriptions)
        allow(ActionCable.server).to receive(:connections).and_return([connection])
      end

      it "does not mark the user as having left" do
        described_class.perform_now(moment_id: moment.id, user_id: user.id)

        participation = moment.participations.find_by(user: user)
        expect(participation.left_at).to be_nil
      end
    end

    context "when moment does not exist" do
      it "returns without error" do
        expect {
          described_class.perform_now(moment_id: SecureRandom.uuid, user_id: user.id)
        }.not_to raise_error
      end
    end

    context "when user does not exist" do
      it "returns without error" do
        expect {
          described_class.perform_now(moment_id: moment.id, user_id: SecureRandom.uuid)
        }.not_to raise_error
      end
    end
  end
end
