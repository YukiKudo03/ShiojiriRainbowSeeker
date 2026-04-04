# frozen_string_literal: true

require "rails_helper"

RSpec.describe RadarDatumSerializer, type: :serializer do
  let(:photo) { create(:photo, :without_image) }
  let(:radar_datum) do
    create(:radar_datum,
           photo: photo,
           timestamp: Time.zone.parse("2026-03-01 14:30:00"),
           precipitation_intensity: 3.5,
           precipitation_area: { "type" => "Polygon", "coordinates" => [ [ 0, 0 ], [ 1, 1 ] ] },
           movement_direction: 225)
  end

  describe "RadarDatumSerializer (default)" do
    subject(:serialized) { described_class.new(radar_datum).to_h }

    it "includes id" do
      expect(serialized[:id]).to eq(radar_datum.id)
    end

    it "includes recordedAt as ISO8601" do
      expect(serialized[:recordedAt]).to match(/\d{4}-\d{2}-\d{2}T/)
    end

    it "includes precipitationIntensity" do
      expect(serialized[:precipitationIntensity]).to eq(3.5)
    end

    it "returns nil for radarImageUrl when no image is attached" do
      expect(serialized[:radarImageUrl]).to be_nil
    end

    it "includes precipitationArea" do
      expect(serialized[:precipitationArea]).to be_present
    end

    it "includes movementDirection" do
      expect(serialized[:movementDirection]).to eq(225)
    end

    it "uses camelCase keys" do
      snake_case_keys = serialized.keys.select { |k| k.to_s.include?("_") }
      expect(snake_case_keys).to be_empty
    end
  end
end
