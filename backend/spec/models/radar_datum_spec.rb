# frozen_string_literal: true

require "rails_helper"

RSpec.describe RadarDatum, type: :model do
  subject(:radar_datum) { build(:radar_datum) }

  describe "associations" do
    it { is_expected.to belong_to(:photo) }
    it { is_expected.to have_many(:weather_conditions).dependent(:nullify) }
    it { is_expected.to have_one_attached(:radar_image) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:timestamp) }
    it { is_expected.to validate_numericality_of(:precipitation_intensity).is_greater_than_or_equal_to(0).allow_nil }
    it { is_expected.to validate_numericality_of(:movement_direction).is_greater_than_or_equal_to(0).is_less_than(360).allow_nil }
    it { is_expected.to validate_numericality_of(:movement_speed).is_greater_than_or_equal_to(0).allow_nil }
  end

  describe "scopes" do
    describe ".recent" do
      let!(:older_datum) { create(:radar_datum, timestamp: 2.days.ago) }
      let!(:newer_datum) { create(:radar_datum, timestamp: 1.day.ago) }

      it "orders by timestamp descending" do
        expect(RadarDatum.recent.first).to eq(newer_datum)
        expect(RadarDatum.recent.last).to eq(older_datum)
      end
    end

    describe ".with_precipitation" do
      let!(:with_precip) { create(:radar_datum, :with_active_precipitation) }
      let!(:without_precip) { create(:radar_datum, :no_precipitation) }

      it "returns only radar data with precipitation" do
        expect(RadarDatum.with_precipitation).to include(with_precip)
        expect(RadarDatum.with_precipitation).not_to include(without_precip)
      end
    end
  end

  describe "location methods" do
    let(:lat) { 36.115 }
    let(:lng) { 137.954 }

    describe "#set_center_location" do
      it "sets the center location from lat/lng coordinates" do
        radar_datum.set_center_location(lat, lng)
        expect(radar_datum.center_location).to be_present
      end
    end

    describe "#center_latitude" do
      it "returns the latitude from the center location" do
        radar_datum.set_center_location(lat, lng)
        expect(radar_datum.center_latitude).to be_within(0.001).of(lat)
      end

      it "returns nil when center location is not set" do
        radar_datum.center_location = nil
        expect(radar_datum.center_latitude).to be_nil
      end
    end

    describe "#center_longitude" do
      it "returns the longitude from the center location" do
        radar_datum.set_center_location(lat, lng)
        expect(radar_datum.center_longitude).to be_within(0.001).of(lng)
      end

      it "returns nil when center location is not set" do
        radar_datum.center_location = nil
        expect(radar_datum.center_longitude).to be_nil
      end
    end
  end

  describe "#active_precipitation?" do
    it "returns true when precipitation_intensity is greater than 0" do
      radar_datum = build(:radar_datum, :with_active_precipitation)
      expect(radar_datum.active_precipitation?).to be true
    end

    it "returns false when precipitation_intensity is 0" do
      radar_datum = build(:radar_datum, :no_precipitation)
      expect(radar_datum.active_precipitation?).to be false
    end

    it "returns false when precipitation_intensity is nil" do
      radar_datum = build(:radar_datum, precipitation_intensity: nil)
      expect(radar_datum.active_precipitation?).to be false
    end
  end

  describe "#precipitation_moving_away?" do
    it "returns true when movement direction is within 45 degrees of observer direction" do
      radar_datum = build(:radar_datum, movement_direction: 90)
      expect(radar_datum.precipitation_moving_away?(100)).to be true
    end

    it "returns true when directions are exactly aligned" do
      radar_datum = build(:radar_datum, movement_direction: 180)
      expect(radar_datum.precipitation_moving_away?(180)).to be true
    end

    it "returns false when movement direction differs by more than 45 degrees" do
      radar_datum = build(:radar_datum, movement_direction: 90)
      expect(radar_datum.precipitation_moving_away?(200)).to be false
    end

    it "handles wrap-around at 360 degrees" do
      radar_datum = build(:radar_datum, movement_direction: 350)
      expect(radar_datum.precipitation_moving_away?(10)).to be true
    end

    it "returns false when movement_direction is nil" do
      radar_datum = build(:radar_datum, movement_direction: nil)
      expect(radar_datum.precipitation_moving_away?(90)).to be false
    end
  end
end
