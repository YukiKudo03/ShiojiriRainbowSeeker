# frozen_string_literal: true

require "rails_helper"

RSpec.describe AccountDeletionService, type: :service do
  subject(:service) { described_class.new }

  describe "#request_deletion" do
    context "with a valid user" do
      let(:user) { create(:user) }

      it "schedules deletion for 14 days later" do
        freeze_time do
          result = service.request_deletion(user)

          expect(result[:success]).to be true
          expect(user.reload.deletion_requested_at).to be_within(1.second).of(Time.current)
          expect(user.deletion_scheduled_at).to be_within(1.second).of(14.days.from_now)
        end
      end

      it "returns the scheduled deletion date" do
        result = service.request_deletion(user)

        expect(result[:deletion_scheduled_at]).to be_present
        expect(result[:grace_period_days]).to eq(14)
      end

      it "enqueues an AccountDeletionJob" do
        expect {
          service.request_deletion(user)
        }.to have_enqueued_job(AccountDeletionJob)
          .with(user.id)
          .at(a_value_within(1.second).of(14.days.from_now))
      end

      it "stores the job ID on the user" do
        service.request_deletion(user)

        expect(user.reload.deletion_job_id).to be_present
      end

      it "returns success message" do
        result = service.request_deletion(user)

        expect(result[:success]).to be true
        expect(result[:message]).to be_present
      end
    end

    context "with an already deleted user" do
      let(:user) { create(:user, :deleted) }

      it "returns an error" do
        result = service.request_deletion(user)

        expect(result[:success]).to be false
        expect(result[:error][:message]).to include("already deleted")
      end

      it "does not schedule a job" do
        expect {
          service.request_deletion(user)
        }.not_to have_enqueued_job(AccountDeletionJob)
      end
    end

    context "with an already pending deletion" do
      let(:user) { create(:user, :pending_deletion) }

      it "returns an error" do
        result = service.request_deletion(user)

        expect(result[:success]).to be false
        expect(result[:error][:message]).to include("already requested")
      end
    end

    context "with nil user" do
      it "returns an error" do
        result = service.request_deletion(nil)

        expect(result[:success]).to be false
        expect(result[:error][:message]).to include("not found")
      end
    end
  end

  describe "#cancel_deletion" do
    context "with a pending deletion" do
      let(:user) { create(:user, :pending_deletion) }

      it "clears the deletion fields" do
        result = service.cancel_deletion(user)

        expect(result[:success]).to be true
        expect(user.reload.deletion_requested_at).to be_nil
        expect(user.deletion_scheduled_at).to be_nil
        expect(user.deletion_job_id).to be_nil
      end

      it "returns success message" do
        result = service.cancel_deletion(user)

        expect(result[:message]).to be_present
      end
    end

    context "with no pending deletion" do
      let(:user) { create(:user) }

      it "returns an error" do
        result = service.cancel_deletion(user)

        expect(result[:success]).to be false
        expect(result[:error][:message]).to include("No deletion request")
      end
    end

    context "with an already deleted user" do
      let(:user) { create(:user, :deleted) }

      it "returns an error" do
        result = service.cancel_deletion(user)

        expect(result[:success]).to be false
        expect(result[:error][:message]).to include("already deleted")
      end
    end

    context "when grace period has expired" do
      let(:user) { create(:user, :deletion_due) }

      it "returns an error" do
        result = service.cancel_deletion(user)

        expect(result[:success]).to be false
        expect(result[:error][:message]).to include("expired")
      end
    end

    context "with nil user" do
      it "returns an error" do
        result = service.cancel_deletion(nil)

        expect(result[:success]).to be false
        expect(result[:error][:message]).to include("not found")
      end
    end
  end

  describe "#execute_deletion" do
    context "with a valid deletion request" do
      let(:user) { create(:user, :pending_deletion) }

      it "deletes the user" do
        user_id = user.id
        result = service.execute_deletion(user)

        expect(result[:success]).to be true
        expect(User.find_by(id: user_id)).to be_nil
      end

      it "returns deletion summary" do
        result = service.execute_deletion(user)

        expect(result[:summary]).to include(
          :comments_anonymized,
          :photos_deleted,
          :likes_deleted,
          :notifications_deleted,
          :device_tokens_deleted
        )
      end
    end

    context "with user having photos" do
      let(:user) { create(:user, :pending_deletion) }
      let!(:photos) { create_list(:photo, 2, user: user) }

      it "deletes all photos" do
        photo_ids = photos.map(&:id)
        result = service.execute_deletion(user)

        expect(result[:success]).to be true
        expect(result[:summary][:photos_deleted]).to eq(2)
        expect(Photo.where(id: photo_ids)).to be_empty
      end

      it "purges associated images" do
        # Count how many photos actually have images attached (reload from DB to get fresh state)
        expected_image_count = user.photos.reload.count { |p| p.image.attached? }
        result = service.execute_deletion(user)

        expect(result[:summary][:images_purged]).to eq(expected_image_count)
      end
    end

    context "with user having comments" do
      let(:user) { create(:user, :pending_deletion) }
      let(:other_user) { create(:user) }
      let(:photo) { create(:photo, user: other_user) }
      let!(:comments) { create_list(:comment, 3, user: user, photo: photo) }

      it "anonymizes all comments" do
        comment_ids = comments.map(&:id)
        result = service.execute_deletion(user)

        expect(result[:success]).to be true
        expect(result[:summary][:comments_anonymized]).to eq(3)

        # Verify comments are anonymized, not deleted
        anonymized_comments = Comment.where(id: comment_ids)
        expect(anonymized_comments.count).to eq(3)
        expect(anonymized_comments.all? { |c| c.user_id.nil? }).to be true
        expect(anonymized_comments.all? { |c| c.deleted_user_display_name.present? }).to be true
      end
    end

    context "with user having likes" do
      let(:user) { create(:user, :pending_deletion) }
      let(:other_user) { create(:user) }
      let!(:likes) do
        # Create likes for different photos (uniqueness constraint: one like per user per photo)
        photos = create_list(:photo, 2, :without_image, user: other_user)
        photos.map { |photo| create(:like, user: user, photo: photo) }
      end

      it "deletes all likes" do
        like_ids = likes.map(&:id)
        result = service.execute_deletion(user)

        expect(result[:success]).to be true
        expect(result[:summary][:likes_deleted]).to eq(2)
        expect(Like.where(id: like_ids)).to be_empty
      end
    end

    context "with no deletion request" do
      let(:user) { create(:user) }

      it "returns an error" do
        result = service.execute_deletion(user)

        expect(result[:success]).to be false
        expect(result[:error][:message]).to include("No deletion request")
      end
    end

    context "with an already deleted user" do
      let(:user) { create(:user, :deleted, :pending_deletion) }

      it "returns an error" do
        result = service.execute_deletion(user)

        expect(result[:success]).to be false
        expect(result[:error][:message]).to include("already deleted")
      end
    end

    context "with nil user" do
      it "returns an error" do
        result = service.execute_deletion(nil)

        expect(result[:success]).to be false
        expect(result[:error][:message]).to include("not found")
      end
    end
  end

  describe "#anonymize_user_content" do
    context "with user having comments" do
      let(:user) { create(:user) }
      let(:other_user) { create(:user) }
      let(:photo) { create(:photo, user: other_user) }
      let!(:comments) { create_list(:comment, 3, user: user, photo: photo) }

      it "sets user_id to nil on all comments" do
        result = service.anonymize_user_content(user)

        expect(result[:success]).to be true
        comments.each do |comment|
          comment.reload
          expect(comment.user_id).to be_nil
        end
      end

      it "sets deleted_user_display_name on all comments" do
        result = service.anonymize_user_content(user)

        comments.each do |comment|
          comment.reload
          expect(comment.deleted_user_display_name).to eq("deleted_user")
        end
      end

      it "returns the count of anonymized comments" do
        result = service.anonymize_user_content(user)

        expect(result[:comments_anonymized]).to eq(3)
      end

      it "preserves comment content" do
        original_contents = comments.map(&:content)
        service.anonymize_user_content(user)

        comments.each_with_index do |comment, index|
          comment.reload
          expect(comment.content).to eq(original_contents[index])
        end
      end
    end

    context "with user having no comments" do
      let(:user) { create(:user) }

      it "returns zero anonymized count" do
        result = service.anonymize_user_content(user)

        expect(result[:success]).to be true
        expect(result[:comments_anonymized]).to eq(0)
      end
    end

    context "with nil user" do
      it "returns an error" do
        result = service.anonymize_user_content(nil)

        expect(result[:success]).to be false
        expect(result[:error][:message]).to include("not found")
      end
    end
  end

  describe "#deletion_status" do
    context "with no pending deletion" do
      let(:user) { create(:user) }

      it "returns deletion_pending as false" do
        result = service.deletion_status(user)

        expect(result[:success]).to be true
        expect(result[:deletion_pending]).to be false
      end
    end

    context "with pending deletion" do
      let(:user) { create(:user, :pending_deletion) }

      it "returns deletion details" do
        result = service.deletion_status(user)

        expect(result[:success]).to be true
        expect(result[:deletion_pending]).to be true
        expect(result[:deletion_requested_at]).to be_present
        expect(result[:deletion_scheduled_at]).to be_present
        expect(result[:days_remaining]).to be_a(Integer)
        expect(result[:can_cancel]).to be true
      end
    end

    context "when deletion is due" do
      let(:user) { create(:user, :deletion_due) }

      it "returns can_cancel as false" do
        result = service.deletion_status(user)

        expect(result[:can_cancel]).to be false
        expect(result[:days_remaining]).to eq(0)
      end
    end

    context "with nil user" do
      it "returns an error" do
        result = service.deletion_status(nil)

        expect(result[:success]).to be false
        expect(result[:error][:message]).to include("not found")
      end
    end
  end

  describe "complete deletion workflow" do
    let(:user) { create(:user) }
    let(:other_user) { create(:user) }
    let(:photos_to_like) { create_list(:photo, 2, :without_image, user: other_user) }

    before do
      # Create user content
      create_list(:photo, 2, :without_image, user: user)
      create_list(:comment, 3, user: user, photo: photos_to_like.first)
      # Create likes for different photos (uniqueness constraint)
      photos_to_like.each { |photo| create(:like, user: user, photo: photo) }
    end

    it "completes the full deletion workflow" do
      user_id = user.id

      # Step 1: Request deletion
      request_result = service.request_deletion(user)
      expect(request_result[:success]).to be true
      expect(user.reload.deletion_pending?).to be true

      # Step 2: User could cancel here (we'll skip for full workflow test)

      # Step 3: Execute deletion (simulating job execution)
      execute_result = service.execute_deletion(user)
      expect(execute_result[:success]).to be true

      # Verify complete deletion
      expect(User.find_by(id: user_id)).to be_nil
      expect(Photo.where(user_id: user_id)).to be_empty
      expect(Like.where(user_id: user_id)).to be_empty

      # Verify comments are anonymized, not deleted
      expect(Comment.where(deleted_user_display_name: "deleted_user").count).to eq(3)
    end

    it "allows cancellation during grace period" do
      # Step 1: Request deletion
      service.request_deletion(user)
      expect(user.reload.deletion_pending?).to be true

      # Step 2: Cancel deletion
      cancel_result = service.cancel_deletion(user)
      expect(cancel_result[:success]).to be true

      # Verify user is still active
      expect(user.reload.deletion_pending?).to be false
      expect(user.deletion_requested_at).to be_nil
    end
  end
end
