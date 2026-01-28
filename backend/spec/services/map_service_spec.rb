# frozen_string_literal: true

require "rails_helper"

RSpec.describe MapService do
  let(:service) { described_class.new }

  # Default bounds (Shiojiri area)
  let(:bounds) do
    {
      sw_lat: 36.0,
      sw_lng: 137.8,
      ne_lat: 36.2,
      ne_lng: 138.0
    }
  end

  describe "#markers" do
    context "with valid bounds" do
      let(:user) { create(:user) }
      let!(:photo1) do
        photo = build(:photo, :without_image, user: user, title: "Rainbow 1", captured_at: Time.utc(2024, 1, 21, 10, 0, 0))
        photo.set_location(36.115, 137.954)
        photo.save!
        photo
      end
      let!(:photo2) do
        photo = build(:photo, :without_image, user: user, title: "Rainbow 2", captured_at: Time.utc(2024, 1, 22, 14, 30, 0))
        photo.set_location(36.120, 137.960)
        photo.save!
        photo
      end

      it "returns success result" do
        result = service.markers(bounds: bounds)

        expect(result[:success]).to be true
      end

      it "returns markers array" do
        result = service.markers(bounds: bounds)

        expect(result[:data][:markers]).to be_an(Array)
        expect(result[:data][:markers].length).to eq(2)
      end

      it "includes marker data" do
        result = service.markers(bounds: bounds)
        marker = result[:data][:markers].find { |m| m[:id] == photo1.id }

        expect(marker[:id]).to eq(photo1.id)
        expect(marker[:latitude]).to be_within(0.001).of(36.115)
        expect(marker[:longitude]).to be_within(0.001).of(137.954)
        expect(marker[:title]).to eq("Rainbow 1")
        expect(marker[:capturedAt]).to be_present
      end

      it "includes total count" do
        result = service.markers(bounds: bounds)

        expect(result[:data][:totalCount]).to eq(2)
      end

      it "includes bounds in response" do
        result = service.markers(bounds: bounds)

        expect(result[:data][:bounds]).to eq(bounds)
      end
    end

    context "with limit parameter" do
      let(:user) { create(:user) }

      before do
        3.times do |i|
          photo = build(:photo, :without_image, user: user)
          photo.set_location(36.1 + i * 0.01, 137.9 + i * 0.01)
          photo.save!
        end
      end

      it "respects limit parameter" do
        result = service.markers(bounds: bounds, limit: 2)

        expect(result[:data][:markers].length).to eq(2)
      end
    end

    context "with filters" do
      let(:user) { create(:user) }

      before do
        photo1 = build(:photo, :without_image, user: user, captured_at: Date.new(2024, 1, 15).noon)
        photo1.set_location(36.115, 137.954)
        photo1.save!

        photo2 = build(:photo, :without_image, user: user, captured_at: Date.new(2024, 6, 15).noon)
        photo2.set_location(36.120, 137.960)
        photo2.save!
      end

      it "applies date filters" do
        result = service.markers(
          bounds: bounds,
          filters: { start_date: "2024-01-01", end_date: "2024-01-31" }
        )

        expect(result[:success]).to be true
        expect(result[:data][:markers].length).to eq(1)
      end
    end

    context "with caching" do
      let(:user) { create(:user) }

      before do
        photo = build(:photo, :without_image, user: user)
        photo.set_location(36.115, 137.954)
        photo.save!
      end

      it "caches successful results" do
        # Use memory store for this test
        original_cache = Rails.cache
        memory_cache = ActiveSupport::Cache::MemoryStore.new
        Rails.cache = memory_cache

        begin
          service.markers(bounds: bounds)

          # Second call should use cache
          allow(Photo).to receive(:visible).and_call_original
          service.markers(bounds: bounds)
        ensure
          Rails.cache = original_cache
        end
      end
    end
  end

  describe "#clusters" do
    context "with valid bounds" do
      let(:user) { create(:user) }

      before do
        # Create photos in two groups
        # Group 1: close together
        3.times do |i|
          photo = build(:photo, :without_image, user: user, captured_at: Time.utc(2024, 1, 20 + i, 10, 0, 0))
          photo.set_location(36.115 + i * 0.0001, 137.954)
          photo.save!
        end

        # Group 2: slightly apart
        2.times do |i|
          photo = build(:photo, :without_image, user: user, captured_at: Time.utc(2024, 1, 25 + i, 10, 0, 0))
          photo.set_location(36.180 + i * 0.0001, 137.980)
          photo.save!
        end
      end

      it "returns success result" do
        result = service.clusters(bounds: bounds)

        expect(result[:success]).to be true
      end

      it "returns clusters array" do
        result = service.clusters(bounds: bounds)

        expect(result[:data][:clusters]).to be_an(Array)
      end

      it "includes cluster metadata" do
        result = service.clusters(bounds: bounds)

        expect(result[:data][:totalPhotos]).to be_a(Integer)
        expect(result[:data][:totalClusters]).to be_a(Integer)
        expect(result[:data]).to have_key(:unclusteredCount)
      end
    end

    context "with custom clustering parameters" do
      let(:user) { create(:user) }

      before do
        photo = build(:photo, :without_image, user: user)
        photo.set_location(36.115, 137.954)
        photo.save!
      end

      it "accepts cluster_distance parameter" do
        result = service.clusters(bounds: bounds, cluster_distance: 1000)

        expect(result[:success]).to be true
      end

      it "accepts min_points parameter" do
        result = service.clusters(bounds: bounds, min_points: 3)

        expect(result[:success]).to be true
      end
    end
  end

  describe "#heatmap" do
    context "with valid bounds" do
      let(:user) { create(:user) }

      before do
        # Create photos at different densities
        5.times do
          photo = build(:photo, :without_image, user: user)
          photo.set_location(36.115, 137.954)
          photo.save!
        end

        2.times do
          photo = build(:photo, :without_image, user: user)
          photo.set_location(36.120, 137.960)
          photo.save!
        end
      end

      it "returns success result" do
        result = service.heatmap(bounds: bounds)

        expect(result[:success]).to be true
      end

      it "returns heatmapPoints array" do
        result = service.heatmap(bounds: bounds)

        expect(result[:data][:heatmapPoints]).to be_an(Array)
      end

      it "includes intensity values" do
        result = service.heatmap(bounds: bounds)
        points = result[:data][:heatmapPoints]

        expect(points).not_to be_empty
        points.each do |point|
          expect(point[:latitude]).to be_a(Numeric)
          expect(point[:longitude]).to be_a(Numeric)
          expect(point[:intensity]).to be_a(Numeric)
          expect(point[:count]).to be_a(Integer)
        end
      end

      it "includes metadata" do
        result = service.heatmap(bounds: bounds)

        expect(result[:data][:maxIntensity]).to eq(1.0)
        expect(result[:data][:maxCount]).to be_a(Integer)
        expect(result[:data][:totalPhotos]).to be_a(Integer)
      end
    end

    context "with custom grid size" do
      let(:user) { create(:user) }

      before do
        photo = build(:photo, :without_image, user: user)
        photo.set_location(36.115, 137.954)
        photo.save!
      end

      it "accepts grid_size parameter" do
        result = service.heatmap(bounds: bounds, grid_size: 200)

        expect(result[:success]).to be true
      end
    end

    context "with empty results" do
      # No photos created - empty bounds area
      let(:empty_bounds) do
        {
          sw_lat: 40.0,
          sw_lng: 140.0,
          ne_lat: 41.0,
          ne_lng: 141.0
        }
      end

      it "handles empty heatmap data" do
        result = service.heatmap(bounds: empty_bounds)

        expect(result[:success]).to be true
        expect(result[:data][:heatmapPoints]).to eq([])
        expect(result[:data][:totalPhotos]).to eq(0)
      end
    end
  end

  describe "error handling" do
    context "when database error occurs" do
      before do
        allow(Photo).to receive(:visible).and_raise(StandardError, "Database error")
      end

      it "returns failure result for markers" do
        result = service.markers(bounds: bounds)

        expect(result[:success]).to be false
        expect(result[:error][:code]).to eq(ErrorHandler::ErrorCodes::INTERNAL_ERROR)
      end
    end

    context "when cluster query fails" do
      before do
        allow(ActiveRecord::Base.connection).to receive(:execute).and_raise(StandardError, "SQL error")
      end

      it "returns failure result for clusters" do
        result = service.clusters(bounds: bounds)

        expect(result[:success]).to be false
        expect(result[:error][:message]).to include("clusters")
      end

      it "returns failure result for heatmap" do
        result = service.heatmap(bounds: bounds)

        expect(result[:success]).to be false
        expect(result[:error][:message]).to include("heatmap")
      end
    end
  end

  describe "limit sanitization" do
    let(:user) { create(:user) }

    before do
      5.times do |i|
        photo = build(:photo, :without_image, user: user)
        photo.set_location(36.1 + i * 0.01, 137.9 + i * 0.01)
        photo.save!
      end
    end

    it "uses default limit when not provided" do
      result = service.markers(bounds: bounds)

      expect(result[:success]).to be true
    end

    it "enforces maximum limit" do
      result = service.markers(bounds: bounds, limit: 5000)

      expect(result[:success]).to be true
      # MAX_MARKER_LIMIT is 2000, so it should be capped
    end

    it "uses default for invalid limit" do
      result = service.markers(bounds: bounds, limit: -10)

      expect(result[:success]).to be true
    end
  end
end
