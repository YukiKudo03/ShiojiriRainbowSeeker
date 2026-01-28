# frozen_string_literal: true

require "rails_helper"

RSpec.describe AnalysisService do
  let(:service) { described_class.new }

  # Default period
  let(:period) do
    { start_date: "2024-01-01", end_date: "2024-12-31" }
  end

  describe "#region_stats" do
    context "with valid predefined region" do
      it "returns success result" do
        result = service.region_stats(region_id: "daimon", period: period)

        expect(result[:success]).to be true
      end

      it "includes region information" do
        result = service.region_stats(region_id: "daimon", period: period)

        expect(result[:data][:region][:id]).to eq("daimon")
        expect(result[:data][:region][:name]).to eq("大門地区")
        expect(result[:data][:region][:center]).to be_present
        expect(result[:data][:region][:radius]).to eq(3000)
      end

      it "includes period in response" do
        result = service.region_stats(region_id: "daimon", period: period)

        expect(result[:data][:period][:start_date]).to eq("2024-01-01")
        expect(result[:data][:period][:end_date]).to eq("2024-12-31")
      end

      it "includes empty statistics when no data" do
        result = service.region_stats(region_id: "daimon", period: period)

        expect(result[:data][:statistics][:total_sightings]).to eq(0)
        expect(result[:data][:statistics][:unique_users]).to eq(0)
      end
    end

    context "with photos in region" do
      let(:user) { create(:user) }
      let!(:photo_in_region) do
        photo = build(:photo, :without_image, user: user, captured_at: Date.new(2024, 6, 15).noon)
        # Set location to center of daimon region (36.115, 137.954)
        photo.set_location(36.115, 137.954)
        photo.save!
        photo
      end

      it "returns positive total sightings" do
        result = service.region_stats(region_id: "daimon", period: period)

        expect(result[:success]).to be true
        expect(result[:data][:statistics][:total_sightings]).to eq(1)
      end

      it "includes statistics hash" do
        result = service.region_stats(region_id: "daimon", period: period)

        expect(result[:success]).to be true
        expect(result[:data][:statistics]).to be_a(Hash)
      end

      it "counts unique users" do
        result = service.region_stats(region_id: "daimon", period: period)

        expect(result[:data][:statistics][:unique_users]).to eq(1)
      end
    end

    context "with custom region" do
      let(:custom_center) { { lat: 36.100, lng: 137.900 } }

      it "accepts custom region parameters" do
        result = service.region_stats(
          region_id: "custom",
          center: custom_center,
          radius: 5000,
          period: period
        )

        expect(result[:success]).to be true
        expect(result[:data][:region][:name]).to eq("カスタム領域")
      end

      it "returns error without required custom parameters" do
        result = service.region_stats(region_id: "custom", period: period)

        expect(result[:success]).to be false
        expect(result[:error][:message]).to include("center and radius")
      end
    end

    context "with invalid region" do
      it "returns error for unknown region" do
        result = service.region_stats(region_id: "unknown_region", period: period)

        expect(result[:success]).to be false
        expect(result[:error][:message]).to include("Unknown region")
      end
    end

    context "with caching" do
      it "caches successful results" do
        # Use memory store for this test
        original_cache = Rails.cache
        memory_cache = ActiveSupport::Cache::MemoryStore.new
        Rails.cache = memory_cache

        begin
          service.region_stats(region_id: "daimon", period: period)

          # Second call should use cache
          expect(memory_cache).not_to receive(:write)
          service.region_stats(region_id: "daimon", period: period)
        ensure
          Rails.cache = original_cache
        end
      end
    end
  end

  describe "#rainbow_trends" do
    context "with valid parameters" do
      let(:user) { create(:user) }

      before do
        # Create photos across different months
        create(:photo, :without_image, user: user, captured_at: Date.new(2024, 1, 15).noon)
        create(:photo, :without_image, user: user, captured_at: Date.new(2024, 2, 15).noon)
        create(:photo, :without_image, user: user, captured_at: Date.new(2024, 3, 15).noon)
      end

      it "returns success result" do
        result = service.rainbow_trends(period: period)

        expect(result[:success]).to be true
      end

      it "returns time series data" do
        result = service.rainbow_trends(period: period)

        expect(result[:data][:trends]).to be_an(Array)
      end

      it "includes summary statistics" do
        result = service.rainbow_trends(period: period)

        expect(result[:data][:summary]).to be_a(Hash)
        expect(result[:data][:summary]).to include(:total, :average, :max, :min, :trend_direction)
      end

      it "accepts group_by parameter" do
        result = service.rainbow_trends(period: period, group_by: "week")

        expect(result[:success]).to be true
        expect(result[:data][:group_by]).to eq("week")
      end

      it "accepts region_id filter" do
        result = service.rainbow_trends(period: period, region_id: "daimon")

        expect(result[:success]).to be true
        expect(result[:data][:region_id]).to eq("daimon")
      end
    end

    context "with empty results" do
      it "handles empty data gracefully" do
        result = service.rainbow_trends(period: period)

        expect(result[:success]).to be true
        expect(result[:data][:trends]).to eq([])
        expect(result[:data][:summary][:total]).to eq(0)
      end
    end
  end

  describe "#weather_correlations" do
    context "with valid parameters and weather data" do
      let(:user) { create(:user) }
      let(:photo) do
        p = build(:photo, :without_image, user: user, captured_at: Date.new(2024, 6, 15).noon)
        p.set_location(36.115, 137.954)
        p.save!
        p
      end

      before do
        create(:weather_condition,
          photo: photo,
          timestamp: photo.captured_at,
          temperature: 20.0,
          humidity: 65.0,
          sun_altitude: 30.0
        )
      end

      it "returns success result" do
        result = service.weather_correlations(period: period)

        expect(result[:success]).to be true
      end

      it "includes total samples count" do
        result = service.weather_correlations(period: period)

        expect(result[:data][:correlations][:total_samples]).to be >= 1
      end

      it "includes favorable sun position rate" do
        result = service.weather_correlations(period: period)

        expect(result[:data][:correlations][:favorable_sun_position_rate]).to be_a(Numeric)
      end

      it "includes temperature range" do
        result = service.weather_correlations(period: period)

        expect(result[:data][:correlations][:temperature_range]).to be_a(Hash)
      end
    end

    context "with no data" do
      it "handles empty data" do
        result = service.weather_correlations(period: period)

        expect(result[:success]).to be true
        expect(result[:data][:correlations]).to eq({})
      end
    end
  end

  describe "#export_dataset" do
    context "with small dataset" do
      let(:user) { create(:user) }

      before do
        # Create photos with specific locations
        photo1 = build(:photo, :without_image, user: user, captured_at: Date.new(2024, 1, 21).at_midday)
        photo1.set_location(36.115, 137.954)
        photo1.save!

        photo2 = build(:photo, :without_image, user: user, captured_at: Date.new(2024, 1, 22).at_midday)
        photo2.set_location(36.120, 137.960)
        photo2.save!
      end

      it "returns complete status for small datasets" do
        result = service.export_dataset(period: period)

        expect(result[:success]).to be true
        expect(result[:data][:status]).to eq("complete")
      end

      it "includes record count" do
        result = service.export_dataset(period: period)

        expect(result[:data][:record_count]).to eq(2)
      end

      it "includes data array for JSON format" do
        result = service.export_dataset(period: period, format: "json")

        expect(result[:data][:format]).to eq("json")
        expect(result[:data][:data]).to be_an(Array)
      end

      it "includes metadata" do
        result = service.export_dataset(period: period)

        expect(result[:data][:metadata]).to be_a(Hash)
        expect(result[:data][:metadata][:exported_at]).to be_present
      end
    end

    context "with large dataset simulation" do
      before do
        # Stub count to simulate large dataset
        allow_any_instance_of(ActiveRecord::Relation).to receive(:count).and_return(15_000)
      end

      it "returns queued status for large datasets" do
        result = service.export_dataset(period: period)

        expect(result[:success]).to be true
        expect(result[:data][:status]).to eq("queued")
      end

      it "includes job_id for background processing" do
        result = service.export_dataset(period: period)

        expect(result[:data][:job_id]).to be_present
      end

      it "includes estimated record count" do
        result = service.export_dataset(period: period)

        expect(result[:data][:estimated_records]).to eq(15_000)
      end
    end

    context "with CSV format" do
      let(:user) { create(:user) }

      before do
        photo1 = build(:photo, :without_image, user: user, captured_at: Date.new(2024, 1, 21).at_midday)
        photo1.set_location(36.115, 137.954)
        photo1.save!

        photo2 = build(:photo, :without_image, user: user, captured_at: Date.new(2024, 1, 22).at_midday)
        photo2.set_location(36.120, 137.960)
        photo2.save!
      end

      it "returns CSV formatted data" do
        result = service.export_dataset(period: period, format: "csv")

        expect(result[:data][:format]).to eq("csv")
        expect(result[:data][:data]).to be_a(String)
        expect(result[:data][:data]).to include("id")
      end
    end
  end

  describe "#compare_regions" do
    context "with valid regions" do
      it "returns success result" do
        result = service.compare_regions(
          region_ids: [ "daimon", "shiojiri_central" ],
          period: period
        )

        expect(result[:success]).to be true
      end

      it "includes comparisons array" do
        result = service.compare_regions(
          region_ids: [ "daimon", "shiojiri_central" ],
          period: period
        )

        expect(result[:data][:regions]).to be_an(Array)
      end

      it "includes rankings hash" do
        result = service.compare_regions(
          region_ids: [ "daimon", "shiojiri_central" ],
          period: period
        )

        expect(result[:data][:rankings]).to be_a(Hash)
      end
    end
  end

  describe "predefined regions" do
    it "includes daimon region" do
      expect(described_class::REGIONS).to have_key("daimon")
      expect(described_class::REGIONS["daimon"][:name]).to eq("大門地区")
    end

    it "includes shiojiri_central region" do
      expect(described_class::REGIONS).to have_key("shiojiri_central")
    end

    it "includes shiojiri_city region" do
      expect(described_class::REGIONS).to have_key("shiojiri_city")
    end

    it "all regions have required fields" do
      described_class::REGIONS.each do |id, region|
        expect(region).to have_key(:name), "Region #{id} missing name"
        expect(region).to have_key(:center), "Region #{id} missing center"
        expect(region).to have_key(:radius), "Region #{id} missing radius"
        expect(region[:center]).to have_key(:lat), "Region #{id} center missing lat"
        expect(region[:center]).to have_key(:lng), "Region #{id} center missing lng"
      end
    end
  end

  describe "error handling" do
    context "when database error occurs" do
      before do
        allow(Photo).to receive(:visible).and_raise(StandardError, "Database error")
      end

      it "returns failure result for region_stats" do
        result = service.region_stats(region_id: "daimon", period: period)

        expect(result[:success]).to be false
        expect(result[:error][:code]).to eq(ErrorHandler::ErrorCodes::INTERNAL_ERROR)
      end
    end
  end
end
