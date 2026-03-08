# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Account Deletion Workflow", type: :request do
  include ActiveJob::TestHelper

  let(:user) { create(:user) }

  describe "request deletion -> grace period -> cancel" do
    it "requests account deletion and sets a 14-day grace period" do
      post api_v1_path("/users/me/delete"),
           headers: auth_headers(user)

      expect(response).to have_http_status(:ok)
      body = json_body
      expect(body[:data][:deletion_scheduled_at]).to be_present
      expect(body[:data][:grace_period_days]).to eq(14)

      user.reload
      expect(user.deletion_requested_at).to be_present
      expect(user.deletion_scheduled_at).to be_present
      expect(user.deletion_job_id).to be_present
    end

    it "returns deletion status during the grace period" do
      post api_v1_path("/users/me/delete"),
           headers: auth_headers(user)

      get api_v1_path("/users/me/deletion_status"),
          headers: auth_headers(user)

      expect(response).to have_http_status(:ok)
      body = json_body
      expect(body[:data][:deletion_pending]).to be true
      expect(body[:data][:can_cancel]).to be true
      expect(body[:data][:days_remaining]).to be > 0
    end

    it "cancels the deletion request within the grace period" do
      post api_v1_path("/users/me/delete"),
           headers: auth_headers(user)

      delete api_v1_path("/users/me/delete"),
             headers: auth_headers(user)

      expect(response).to have_http_status(:ok)

      user.reload
      expect(user.deletion_requested_at).to be_nil
      expect(user.deletion_scheduled_at).to be_nil
      expect(user.deletion_job_id).to be_nil
    end

    it "shows no pending deletion after cancellation" do
      post api_v1_path("/users/me/delete"),
           headers: auth_headers(user)

      delete api_v1_path("/users/me/delete"),
             headers: auth_headers(user)

      get api_v1_path("/users/me/deletion_status"),
          headers: auth_headers(user)

      expect(response).to have_http_status(:ok)
      body = json_body
      expect(body[:data][:deletion_pending]).to be false
    end
  end

  describe "request deletion -> execute after grace period" do
    it "executes account deletion when the AccountDeletionJob runs" do
      # Create some associated data for the user
      photo = create(:photo, :without_image, user: user)
      create(:comment, user: user, photo: photo)
      create(:like, user: user, photo: photo)
      create(:notification, user: user)

      # Request deletion
      post api_v1_path("/users/me/delete"),
           headers: auth_headers(user)

      user.reload
      expect(user.deletion_requested_at).to be_present

      # Simulate grace period expiry by updating the scheduled time
      user.update_columns(
        deletion_scheduled_at: 1.day.ago,
        deletion_requested_at: 15.days.ago
      )

      # Execute the deletion job
      perform_enqueued_jobs(only: AccountDeletionJob)

      # Verify user is deleted
      expect(User.find_by(id: user.id)).to be_nil
    end

    it "anonymizes comments when the account is deleted" do
      other_photo = create(:photo, :without_image)
      comment = create(:comment, user: user, photo: other_photo, content: "Great rainbow!")

      # Request deletion
      service = AccountDeletionService.new
      service.request_deletion(user)

      user.reload
      user.update_columns(
        deletion_scheduled_at: 1.day.ago,
        deletion_requested_at: 15.days.ago
      )

      # Execute deletion
      service.execute_deletion(user)

      # Verify comment is anonymized
      comment.reload
      expect(comment.user_id).to be_nil
      expect(comment.deleted_user_display_name).to eq("deleted_user")
      expect(comment.content).to eq("Great rainbow!")  # Content preserved
    end

    it "does not execute deletion if request was canceled (safety check)" do
      post api_v1_path("/users/me/delete"),
           headers: auth_headers(user)

      # Cancel the deletion
      delete api_v1_path("/users/me/delete"),
             headers: auth_headers(user)

      user.reload
      expect(user.deletion_requested_at).to be_nil

      # Even if the job runs, it should not delete the user
      # because deletion_requested_at is nil
      AccountDeletionJob.perform_now(user.id)

      expect(User.find_by(id: user.id)).to be_present
    end

    it "prevents duplicate deletion requests" do
      post api_v1_path("/users/me/delete"),
           headers: auth_headers(user)
      expect(response).to have_http_status(:ok)

      # Second request should fail
      post api_v1_path("/users/me/delete"),
           headers: auth_headers(user)
      expect(response).to have_http_status(:unprocessable_entity)

      body = json_body
      expect(body[:error][:message]).to match(/already requested/i)
    end
  end
end
