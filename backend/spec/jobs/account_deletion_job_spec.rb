# frozen_string_literal: true

require "rails_helper"

RSpec.describe AccountDeletionJob, type: :job do
  include ActiveJob::TestHelper

  describe "#perform" do
    context "with a valid deletion request" do
      let(:user) { create(:user, :deletion_due) }

      it "executes deletion through AccountDeletionService" do
        service_double = instance_double(AccountDeletionService)
        allow(AccountDeletionService).to receive(:new).and_return(service_double)
        allow(service_double).to receive(:execute_deletion).and_return({ success: true, summary: {} })

        perform_enqueued_jobs do
          AccountDeletionJob.perform_later(user.id)
        end

        expect(service_double).to have_received(:execute_deletion).with(user)
      end
    end

    context "when deletion was canceled" do
      let(:user) { create(:user) }  # No deletion_requested_at

      it "does not execute deletion" do
        service_double = instance_double(AccountDeletionService)
        allow(AccountDeletionService).to receive(:new).and_return(service_double)
        allow(service_double).to receive(:execute_deletion)  # Stub it even though we don't expect it

        perform_enqueued_jobs do
          AccountDeletionJob.perform_later(user.id)
        end

        expect(service_double).not_to have_received(:execute_deletion)
      end
    end

    context "when user is already soft deleted" do
      let(:user) { create(:user, :deleted, :pending_deletion) }

      it "does not execute deletion" do
        service_double = instance_double(AccountDeletionService)
        allow(AccountDeletionService).to receive(:new).and_return(service_double)
        allow(service_double).to receive(:execute_deletion)  # Stub it even though we don't expect it

        perform_enqueued_jobs do
          AccountDeletionJob.perform_later(user.id)
        end

        expect(service_double).not_to have_received(:execute_deletion)
      end
    end

    context "when user does not exist" do
      let(:non_existent_id) { SecureRandom.uuid }

      it "is discarded and does not raise" do
        expect {
          perform_enqueued_jobs do
            AccountDeletionJob.perform_later(non_existent_id)
          end
        }.not_to raise_error
      end
    end

    context "when scheduled time has not yet passed" do
      let(:user) { create(:user, :pending_deletion) }

      it "reschedules the job" do
        expect {
          AccountDeletionJob.perform_now(user.id)
        }.to have_enqueued_job(AccountDeletionJob).with(user.id)
      end
    end

    context "when deletion service fails" do
      let(:user) { create(:user, :deletion_due) }

      it "raises an error for retry" do
        service_double = instance_double(AccountDeletionService)
        allow(AccountDeletionService).to receive(:new).and_return(service_double)
        allow(service_double).to receive(:execute_deletion).and_return({
          success: false,
          error: { message: "Database error" }
        })

        expect {
          AccountDeletionJob.perform_now(user.id)
        }.to raise_error(StandardError, /Deletion failed/)
      end
    end
  end

  describe "queue configuration" do
    it "is enqueued to the default queue" do
      expect(AccountDeletionJob.new.queue_name).to eq("default")
    end
  end

  describe "retry behavior" do
    it "inherits from ApplicationJob" do
      expect(AccountDeletionJob.superclass).to eq(ApplicationJob)
    end
  end
end
