# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Admin::Reports", type: :request do
  let(:user) { create(:user) }
  let(:admin) { create(:user, :admin) }
  let(:json_headers) { { "Accept" => "application/json" } }

  def auth_headers_for(user)
    token = Warden::JWTAuth::UserEncoder.new.call(user, :user, nil).first
    json_headers.merge("Authorization" => "Bearer #{token}")
  end

  # Helper to create photo without image
  def create_photo(photo_user)
    photo = Photo.new(
      user: photo_user,
      title: "Test Rainbow",
      captured_at: Time.current,
      moderation_status: :approved,
      is_visible: true
    )
    photo.set_location(36.115, 137.954)
    photo.save!
    photo
  end

  # Helper to create report
  def create_report(reporter:, reportable:, status: :pending)
    Report.create!(
      reporter: reporter,
      reportable: reportable,
      reason: "inappropriate",
      status: status
    )
  end

  describe "GET /api/v1/admin/reports" do
    let!(:photo) { create_photo(user) }
    let!(:reports) do
      3.times.map { create_report(reporter: create(:user), reportable: photo) }
    end

    context "without authentication" do
      it "returns 401" do
        get "/api/v1/admin/reports", headers: json_headers
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "as regular user" do
      it "returns 403" do
        get "/api/v1/admin/reports", headers: auth_headers_for(user)
        expect(response).to have_http_status(:forbidden)
      end
    end

    context "as admin" do
      it "returns 200 status" do
        get "/api/v1/admin/reports", headers: auth_headers_for(admin)
        expect(response).to have_http_status(:ok)
      end

      it "returns list of reports" do
        get "/api/v1/admin/reports", headers: auth_headers_for(admin)
        expect(json_data[:reports]).to be_an(Array)
        expect(json_data[:reports].length).to be >= 1
      end

      it "returns pagination info" do
        get "/api/v1/admin/reports", headers: auth_headers_for(admin)
        expect(json_data[:pagination]).to be_present
        expect(json_data[:pagination][:total_count]).to be >= 1
      end

      it "returns stats" do
        get "/api/v1/admin/reports", headers: auth_headers_for(admin)
        expect(json_data[:stats]).to be_present
        expect(json_data[:stats][:pending_count]).to be >= 1
      end
    end

    context "with filters" do
      let!(:resolved_report) do
        create_report(reporter: create(:user), reportable: photo, status: :resolved)
      end

      it "filters by status" do
        get "/api/v1/admin/reports",
            params: { status: "pending" },
            headers: auth_headers_for(admin)
        expect(response).to have_http_status(:ok)
        # Ensure only pending reports are returned
        expect(json_data[:reports]).to be_an(Array)
        expect(json_data[:reports]).to all(satisfy { |r| r[:status] == "pending" })
      end

      it "filters by reportable_type" do
        get "/api/v1/admin/reports",
            params: { reportable_type: "Photo" },
            headers: auth_headers_for(admin)
        expect(response).to have_http_status(:ok)
      end
    end
  end

  describe "GET /api/v1/admin/reports/:id" do
    let!(:photo) { create_photo(user) }
    let!(:report) { create_report(reporter: create(:user), reportable: photo) }

    context "without authentication" do
      it "returns 401" do
        get "/api/v1/admin/reports/#{report.id}", headers: json_headers
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "as regular user" do
      it "returns 403" do
        get "/api/v1/admin/reports/#{report.id}", headers: auth_headers_for(user)
        expect(response).to have_http_status(:forbidden)
      end
    end

    context "as admin" do
      it "returns 200 status" do
        get "/api/v1/admin/reports/#{report.id}", headers: auth_headers_for(admin)
        expect(response).to have_http_status(:ok)
      end

      it "returns report details" do
        get "/api/v1/admin/reports/#{report.id}", headers: auth_headers_for(admin)
        expect(json_data[:report][:id]).to eq(report.id)
        expect(json_data[:report][:reason]).to eq("inappropriate")
      end
    end

    context "with non-existent report" do
      it "returns 404" do
        get "/api/v1/admin/reports/00000000-0000-0000-0000-000000000000",
            headers: auth_headers_for(admin)
        expect(response).to have_http_status(:not_found)
      end
    end
  end

  describe "POST /api/v1/admin/reports/:id/process" do
    let!(:photo) { create_photo(user) }
    let!(:report) { create_report(reporter: create(:user), reportable: photo) }

    context "without authentication" do
      it "returns 401" do
        post "/api/v1/admin/reports/#{report.id}/process",
             params: { moderation_action: "approve" },
             headers: json_headers
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "as regular user" do
      it "returns 403" do
        post "/api/v1/admin/reports/#{report.id}/process",
             params: { moderation_action: "approve" },
             headers: auth_headers_for(user)
        expect(response).to have_http_status(:forbidden)
      end
    end

    context "as admin" do
      describe "approve action" do
        it "returns 200 status" do
          post "/api/v1/admin/reports/#{report.id}/process",
               params: { moderation_action: "approve" },
               headers: auth_headers_for(admin)
          expect(response).to have_http_status(:ok)
        end

        it "dismisses the report" do
          post "/api/v1/admin/reports/#{report.id}/process",
               params: { moderation_action: "approve" },
               headers: auth_headers_for(admin)
          report.reload
          expect(report.status).to eq("dismissed")
        end
      end

      describe "hide action" do
        it "returns 200 status" do
          post "/api/v1/admin/reports/#{report.id}/process",
               params: { moderation_action: "hide" },
               headers: auth_headers_for(admin)
          expect(response).to have_http_status(:ok)
        end

        it "hides the content" do
          post "/api/v1/admin/reports/#{report.id}/process",
               params: { moderation_action: "hide" },
               headers: auth_headers_for(admin)
          photo.reload
          expect(photo.moderation_status).to eq("hidden")
          expect(photo.is_visible).to be false
        end

        it "resolves the report" do
          post "/api/v1/admin/reports/#{report.id}/process",
               params: { moderation_action: "hide" },
               headers: auth_headers_for(admin)
          report.reload
          expect(report.status).to eq("resolved")
        end
      end

      describe "delete action" do
        it "returns 200 status" do
          post "/api/v1/admin/reports/#{report.id}/process",
               params: { moderation_action: "delete" },
               headers: auth_headers_for(admin)
          expect(response).to have_http_status(:ok)
        end

        it "deletes the content" do
          post "/api/v1/admin/reports/#{report.id}/process",
               params: { moderation_action: "delete" },
               headers: auth_headers_for(admin)
          photo.reload
          expect(photo.moderation_status).to eq("deleted")
          expect(photo.is_visible).to be false
        end
      end

      describe "invalid action" do
        it "returns 422" do
          post "/api/v1/admin/reports/#{report.id}/process",
               params: { moderation_action: "invalid" },
               headers: auth_headers_for(admin)
          expect(response).to have_http_status(:unprocessable_entity)
        end
      end

      describe "with admin note" do
        it "accepts admin_note parameter" do
          post "/api/v1/admin/reports/#{report.id}/process",
               params: { moderation_action: "approve", admin_note: "This content is fine" },
               headers: auth_headers_for(admin)
          expect(response).to have_http_status(:ok)
        end
      end
    end
  end
end
