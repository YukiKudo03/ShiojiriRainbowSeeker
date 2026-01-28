# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Notifications", type: :request do
  let(:user) { create(:user) }

  describe "GET /api/v1/notifications" do
    context "when authenticated" do
      before do
        create_list(:notification, 5, user: user)
        create_list(:notification, 3, user: user, is_read: true)
      end

      it "returns paginated notifications" do
        get "/api/v1/notifications", headers: auth_headers(user), as: :json

        expect(response).to have_http_status(:ok)
        expect(json_data[:notifications]).to be_an(Array)
        expect(json_data[:notifications].length).to eq(8)
        expect(json_data[:pagination]).to be_present
      end

      it "includes unread count" do
        get "/api/v1/notifications", headers: auth_headers(user), as: :json

        expect(response).to have_http_status(:ok)
        expect(json_data[:unreadCount]).to eq(5)
      end

      it "orders by created_at desc" do
        get "/api/v1/notifications", headers: auth_headers(user), as: :json

        expect(response).to have_http_status(:ok)
        timestamps = json_data[:notifications].map { |n| n[:createdAt] }
        expect(timestamps).to eq(timestamps.sort.reverse)
      end
    end

    context "when not authenticated" do
      it "returns unauthorized error" do
        get "/api/v1/notifications", as: :json

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe "POST /api/v1/notifications/mark_read" do
    context "when authenticated" do
      let!(:notifications) { create_list(:notification, 3, user: user, is_read: false) }

      context "with specific notification IDs" do
        it "marks specified notifications as read" do
          notification_ids = notifications.first(2).map(&:id)

          post "/api/v1/notifications/mark_read",
               params: { notification_ids: notification_ids },
               headers: auth_headers(user),
               as: :json

          expect(response).to have_http_status(:ok)
          expect(json_data[:markedCount]).to eq(2)

          notifications.first(2).each do |n|
            expect(n.reload.is_read).to be true
          end
          expect(notifications.last.reload.is_read).to be false
        end
      end

      context "without notification_ids (marks all)" do
        it "marks all notifications as read" do
          post "/api/v1/notifications/mark_read",
               headers: auth_headers(user),
               as: :json

          expect(response).to have_http_status(:ok)
          expect(json_data[:markedCount]).to eq(3)

          notifications.each do |n|
            expect(n.reload.is_read).to be true
          end
        end
      end
    end
  end

  describe "GET /api/v1/notifications/settings" do
    context "when authenticated" do
      before do
        user.update(notification_settings: {
          "enabled" => true,
          "radius" => 5000,
          "quiet_hours_start" => "22:00",
          "quiet_hours_end" => "07:00"
        })
      end

      it "returns notification settings" do
        get "/api/v1/notifications/settings", headers: auth_headers(user), as: :json

        expect(response).to have_http_status(:ok)
        expect(json_data[:settings][:enabled]).to be true
        expect(json_data[:settings][:radius]).to eq(5000)
        expect(json_data[:settings][:quietHoursStart]).to eq("22:00")
        expect(json_data[:settings][:quietHoursEnd]).to eq("07:00")
      end
    end

    context "when user has no settings" do
      it "returns default settings" do
        get "/api/v1/notifications/settings", headers: auth_headers(user), as: :json

        expect(response).to have_http_status(:ok)
        expect(json_data[:settings]).to be_present
      end
    end
  end

  describe "PUT /api/v1/notifications/settings" do
    context "when authenticated" do
      let(:new_settings) do
        {
          rainbow_alerts: true,
          likes: true,
          comments: true,
          system: true,
          alert_radius_km: 10,
          quiet_hours_start: "23:00",
          quiet_hours_end: "06:00"
        }
      end

      it "updates notification settings" do
        put "/api/v1/notifications/settings",
            params: new_settings,
            headers: auth_headers(user),
            as: :json

        expect(response).to have_http_status(:ok)
        expect(json_data[:settings]).to be_present
      end

      it "persists the settings" do
        put "/api/v1/notifications/settings",
            params: new_settings,
            headers: auth_headers(user),
            as: :json

        user.reload
        expect(user.notification_settings).to be_present
      end
    end

    context "with toggle settings" do
      it "disables rainbow alerts" do
        put "/api/v1/notifications/settings",
            params: { rainbow_alerts: false },
            headers: auth_headers(user),
            as: :json

        expect(response).to have_http_status(:ok)
      end
    end
  end

  describe "POST /api/v1/notifications/devices" do
    context "when authenticated" do
      let(:device_params) do
        {
          token: "test_device_token_#{SecureRandom.hex(16)}",
          platform: "ios"
        }
      end

      it "registers a new device token" do
        expect {
          post "/api/v1/notifications/devices",
               params: device_params,
               headers: auth_headers(user),
               as: :json
        }.to change(DeviceToken, :count).by(1)

        expect(response).to have_http_status(:created)
        expect(json_data[:device_token_id]).to be_present
        expect(json_data[:platform]).to eq("ios")
      end

      it "reactivates existing device token" do
        existing_token = create(:device_token, user: user, token: device_params[:token], platform: "ios", is_active: false)

        expect {
          post "/api/v1/notifications/devices",
               params: device_params,
               headers: auth_headers(user),
               as: :json
        }.not_to change(DeviceToken, :count)

        # Controller returns 201 for successful registration (upsert behavior)
        expect(response).to have_http_status(:created)
        expect(existing_token.reload.is_active).to be true
      end

      context "with missing token" do
        it "returns bad request error" do
          post "/api/v1/notifications/devices",
               params: { platform: "ios" },
               headers: auth_headers(user),
               as: :json

          expect(response).to have_http_status(:bad_request)
        end
      end

      context "with invalid platform" do
        it "returns validation error" do
          post "/api/v1/notifications/devices",
               params: { token: "test_token", platform: "windows" },
               headers: auth_headers(user),
               as: :json

          expect(response).to have_http_status(:unprocessable_content)
        end
      end
    end
  end

  describe "DELETE /api/v1/notifications/devices" do
    context "when authenticated" do
      let!(:device_token) { create(:device_token, user: user, token: "token_to_delete") }

      it "deactivates the device token" do
        delete "/api/v1/notifications/devices",
               params: { token: "token_to_delete" },
               headers: auth_headers(user),
               as: :json

        expect(response).to have_http_status(:ok)
        expect(device_token.reload.is_active).to be false
      end

      context "with non-existent token" do
        it "returns not found error" do
          delete "/api/v1/notifications/devices",
                 params: { token: "nonexistent_token" },
                 headers: auth_headers(user),
                 as: :json

          expect(response).to have_http_status(:not_found)
        end
      end
    end
  end
end
