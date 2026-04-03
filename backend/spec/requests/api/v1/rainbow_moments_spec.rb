# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::RainbowMoments", type: :request do
  let(:user) { create(:user) }

  let!(:active_moment) do
    RainbowMoment.create!(
      starts_at: Time.current,
      ends_at: 15.minutes.from_now,
      location_id: "daimon",
      status: "active",
      weather_snapshot: { temperature: 18.5, humidity: 72 }
    )
  end

  let!(:archived_moment) do
    RainbowMoment.create!(
      starts_at: 2.hours.ago,
      ends_at: 1.hour.ago,
      location_id: "hirooka",
      status: "archived",
      weather_snapshot: { temperature: 20.0, humidity: 65 }
    )
  end

  describe "GET /api/v1/rainbow_moments" do
    it "returns a paginated list of moments" do
      get_api_as user, "/rainbow_moments"

      expect(response).to have_http_status(:ok)
      moments = json_body[:data][:moments]
      expect(moments).to be_an(Array)
      expect(moments.length).to be >= 1
    end

    it "returns moments ordered by starts_at descending" do
      get_api_as user, "/rainbow_moments"

      moments = json_body[:data][:moments]
      expect(moments.first[:locationId]).to eq("daimon") # more recent
    end

    it "includes pagination metadata" do
      get_api_as user, "/rainbow_moments"

      meta = json_body[:meta]
      expect(meta).to include(:currentPage, :perPage, :totalPages, :totalCount)
    end

    it "filters by location_id" do
      get_api_as user, "/rainbow_moments", params: { location_id: "hirooka" }

      moments = json_body[:data][:moments]
      expect(moments.all? { |m| m[:locationId] == "hirooka" }).to be true
    end

    it "requires authentication" do
      get "/api/v1/rainbow_moments", headers: json_headers
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET /api/v1/rainbow_moments/active" do
    it "returns active and closing moments" do
      get_api_as user, "/rainbow_moments/active"

      expect(response).to have_http_status(:ok)
      moments = json_body[:data][:moments]
      statuses = moments.map { |m| m[:status] }
      expect(statuses).to all(be_in(%w[active closing]))
    end

    it "does not include archived moments" do
      get_api_as user, "/rainbow_moments/active"

      moments = json_body[:data][:moments]
      expect(moments.none? { |m| m[:status] == "archived" }).to be true
    end
  end

  describe "GET /api/v1/rainbow_moments/:id" do
    it "returns moment details" do
      get_api_as user, "/rainbow_moments/#{active_moment.id}"

      expect(response).to have_http_status(:ok)
      moment = json_body[:data][:moment]
      expect(moment[:id]).to eq(active_moment.id)
      expect(moment[:locationId]).to eq("daimon")
      expect(moment[:status]).to eq("active")
    end

    it "returns 404 for non-existent moment" do
      get_api_as user, "/rainbow_moments/non-existent-id"
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/demo/trigger_moment" do
    it "creates a new rainbow moment" do
      post_api_as user, "/demo/trigger_moment"

      expect(response).to have_http_status(:created)
      moment = json_body[:data][:moment]
      expect(moment[:status]).to eq("active")
      expect(moment[:locationId]).to eq("daimon")
    end

    it "accepts a location_id parameter" do
      post_api_as user, "/demo/trigger_moment", params: { location_id: "narai" }

      expect(response).to have_http_status(:created)
      moment = json_body[:data][:moment]
      expect(moment[:locationId]).to eq("narai")
    end

    it "returns 404 for unknown location" do
      post_api_as user, "/demo/trigger_moment", params: { location_id: "nonexistent" }
      expect(response).to have_http_status(:not_found)
    end
  end
end
