# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Social", type: :request do
  let(:user) { create(:user) }
  let(:other_user) { create(:user) }
  let(:photo) { create(:photo, :without_image, user: other_user) }

  describe "POST /api/v1/photos/:id/likes" do
    context "when authenticated" do
      context "when photo exists and not yet liked" do
        it "creates a like and returns success" do
          expect {
            post "/api/v1/photos/#{photo.id}/likes", headers: auth_headers(user), as: :json
          }.to change(Like, :count).by(1)

          expect(response).to have_http_status(:created)
          expect(json_data[:liked]).to be true
        end
      end

      context "when photo is already liked" do
        before { create(:like, user: user, photo: photo) }

        it "returns success with existing like state" do
          expect {
            post "/api/v1/photos/#{photo.id}/likes", headers: auth_headers(user), as: :json
          }.not_to change(Like, :count)

          expect(response).to have_http_status(:ok)
          expect(json_data[:liked]).to be true
        end
      end

      context "when photo does not exist" do
        it "returns not found error" do
          post "/api/v1/photos/#{SecureRandom.uuid}/likes", headers: auth_headers(user), as: :json

          expect(response).to have_http_status(:not_found)
        end
      end
    end

    context "when not authenticated" do
      it "returns unauthorized error" do
        post "/api/v1/photos/#{photo.id}/likes", as: :json

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe "DELETE /api/v1/photos/:id/likes" do
    context "when authenticated" do
      context "when photo is liked by user" do
        before { create(:like, user: user, photo: photo) }

        it "removes the like and returns success" do
          expect {
            delete "/api/v1/photos/#{photo.id}/likes", headers: auth_headers(user), as: :json
          }.to change(Like, :count).by(-1)

          expect(response).to have_http_status(:ok)
          expect(json_data[:liked]).to be false
        end
      end

      context "when photo is not liked by user" do
        it "returns success (idempotent)" do
          delete "/api/v1/photos/#{photo.id}/likes", headers: auth_headers(user), as: :json

          expect(response).to have_http_status(:ok)
          expect(json_data[:liked]).to be false
        end
      end
    end
  end

  describe "GET /api/v1/photos/:id/comments" do
    context "when photo exists" do
      before do
        create_list(:comment, 3, photo: photo, user: other_user)
      end

      it "returns paginated comments" do
        get "/api/v1/photos/#{photo.id}/comments", headers: auth_headers(user), as: :json

        expect(response).to have_http_status(:ok)
        expect(json_data[:comments]).to be_an(Array)
        expect(json_data[:comments].length).to eq(3)
        expect(json_data[:pagination]).to be_present
      end
    end

    context "with pagination parameters" do
      before do
        create_list(:comment, 10, photo: photo, user: other_user)
      end

      it "respects pagination parameters" do
        get "/api/v1/photos/#{photo.id}/comments?page=1&per_page=5", headers: auth_headers(user), as: :json

        expect(response).to have_http_status(:ok)
        expect(json_data[:comments].length).to eq(5)
        expect(json_data[:pagination][:current_page]).to eq(1)
      end
    end
  end

  describe "POST /api/v1/photos/:photo_id/comments" do
    context "when authenticated" do
      context "with valid content" do
        it "creates a comment and returns success" do
          expect {
            post "/api/v1/photos/#{photo.id}/comments",
                 params: { content: "Beautiful rainbow!" },
                 headers: auth_headers(user),
                 as: :json
          }.to change(Comment, :count).by(1)

          expect(response).to have_http_status(:created)
          expect(json_data[:comment][:content]).to eq("Beautiful rainbow!")
        end
      end

      context "with empty content" do
        it "returns validation error" do
          post "/api/v1/photos/#{photo.id}/comments",
               params: { content: "" },
               headers: auth_headers(user),
               as: :json

          expect(response).to have_http_status(:unprocessable_content)
        end
      end

      context "with content exceeding 500 characters" do
        it "returns character limit error" do
          post "/api/v1/photos/#{photo.id}/comments",
               params: { content: "a" * 501 },
               headers: auth_headers(user),
               as: :json

          expect(response).to have_http_status(:unprocessable_content)
        end
      end
    end
  end

  describe "DELETE /api/v1/comments/:id" do
    context "when authenticated" do
      context "when deleting own comment" do
        let!(:comment) { create(:comment, user: user, photo: photo) }

        it "deletes the comment and returns success" do
          comment_id = comment.id

          delete "/api/v1/comments/#{comment_id}", headers: auth_headers(user), as: :json

          expect(response).to have_http_status(:ok)
          expect(Comment.find_by(id: comment_id)).to be_nil
        end
      end

      context "when deleting another user's comment" do
        let!(:other_comment) { create(:comment, user: other_user, photo: photo) }

        it "returns forbidden error" do
          delete "/api/v1/comments/#{other_comment.id}", headers: auth_headers(user), as: :json

          expect(response).to have_http_status(:forbidden)
        end
      end
    end
  end

  describe "POST /api/v1/reports" do
    context "when authenticated" do
      context "with valid report for photo" do
        it "creates a report and returns success" do
          expect {
            post "/api/v1/reports",
                 params: {
                   reportable_type: "Photo",
                   reportable_id: photo.id,
                   reason: "Inappropriate content"
                 },
                 headers: auth_headers(user),
                 as: :json
          }.to change(Report, :count).by(1)

          expect(response).to have_http_status(:created)
        end
      end

      context "with valid report for comment" do
        let(:comment) { create(:comment, user: other_user, photo: photo) }

        it "creates a report and returns success" do
          expect {
            post "/api/v1/reports",
                 params: {
                   reportable_type: "Comment",
                   reportable_id: comment.id,
                   reason: "Spam"
                 },
                 headers: auth_headers(user),
                 as: :json
          }.to change(Report, :count).by(1)

          expect(response).to have_http_status(:created)
        end
      end

      context "with missing reportable_type" do
        it "returns validation error" do
          post "/api/v1/reports",
               params: { reportable_id: photo.id, reason: "Some reason" },
               headers: auth_headers(user),
               as: :json

          expect(response).to have_http_status(:unprocessable_content)
        end
      end

      context "with missing reason" do
        it "returns validation error" do
          post "/api/v1/reports",
               params: { reportable_type: "Photo", reportable_id: photo.id },
               headers: auth_headers(user),
               as: :json

          expect(response).to have_http_status(:unprocessable_content)
        end
      end

      context "with invalid reportable_type" do
        it "returns validation error" do
          post "/api/v1/reports",
               params: { reportable_type: "User", reportable_id: user.id, reason: "Some reason" },
               headers: auth_headers(user),
               as: :json

          expect(response).to have_http_status(:unprocessable_content)
        end
      end

      context "when reportable not found" do
        it "returns not found error" do
          post "/api/v1/reports",
               params: { reportable_type: "Photo", reportable_id: SecureRandom.uuid, reason: "Some reason" },
               headers: auth_headers(user),
               as: :json

          expect(response).to have_http_status(:not_found)
        end
      end

      context "when reporting own content" do
        let(:own_photo) { create(:photo, :without_image, user: user) }

        it "returns validation error" do
          post "/api/v1/reports",
               params: { reportable_type: "Photo", reportable_id: own_photo.id, reason: "Some reason" },
               headers: auth_headers(user),
               as: :json

          expect(response).to have_http_status(:unprocessable_content)
        end
      end

      context "when already reported" do
        before do
          create(:report, reporter: user, reportable: photo, reason: "Previous report")
        end

        it "returns validation error" do
          post "/api/v1/reports",
               params: { reportable_type: "Photo", reportable_id: photo.id, reason: "Another report" },
               headers: auth_headers(user),
               as: :json

          expect(response).to have_http_status(:unprocessable_content)
        end
      end
    end
  end
end
