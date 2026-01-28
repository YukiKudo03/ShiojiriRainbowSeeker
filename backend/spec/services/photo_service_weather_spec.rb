# frozen_string_literal: true

require "rails_helper"

RSpec.describe PhotoService, "weather data functionality" do
  let(:service) { described_class.new }
  let(:user) { create(:user) }
  let(:captured_at) { Time.utc(2024, 1, 21, 10, 0, 0) }

  describe "#weather_data" do
    context "with valid photo and weather data" do
      let(:photo) do
        p = build(:photo, :without_image, user: user, captured_at: captured_at)
        p.set_location(36.115, 137.954)
        p.save!
        p
      end

      let!(:weather_condition) do
        create(:weather_condition,
          photo: photo,
          timestamp: captured_at,
          temperature: 18.5,
          humidity: 70,
          pressure: 1013,
          wind_speed: 3.5,
          wind_direction: 180,
          wind_gust: 5.0,
          weather_code: "500",
          weather_description: "light rain",
          precipitation: 1.5,
          precipitation_type: "rain",
          cloud_cover: 40,
          visibility: 10000,
          sun_azimuth: 150.0,
          sun_altitude: 25.0
        )
      end

      let!(:radar_datum) do
        rd = build(:radar_datum,
          photo: photo,
          timestamp: captured_at,
          precipitation_intensity: 2.5,
          precipitation_area: 1000,
          radius: 50000
        )
        rd.set_center_location(36.115, 137.954)
        rd.save!
        rd
      end

      it "returns success result" do
        result = service.weather_data(photo_id: photo.id)

        expect(result[:success]).to be true
      end

      it "returns weather conditions with camelCase keys" do
        result = service.weather_data(photo_id: photo.id)

        expect(result[:data][:weatherConditions]).to be_present
        expect(result[:data][:weatherConditions].length).to eq(1)
      end

      it "includes correct weather condition fields with camelCase keys" do
        result = service.weather_data(photo_id: photo.id)
        wc = result[:data][:weatherConditions].first

        expect(wc[:id]).to eq(weather_condition.id)
        expect(wc[:timestamp]).to be_present
        expect(wc[:temperature]).to eq(18.5)
        expect(wc[:humidity]).to eq(70)
        expect(wc[:sunAltitude]).to eq(25.0)
      end

      it "returns radar data with camelCase keys" do
        result = service.weather_data(photo_id: photo.id)

        expect(result[:data][:radarData]).to be_present
        expect(result[:data][:radarData].length).to eq(1)
      end

      it "includes correct radar data fields with camelCase keys" do
        result = service.weather_data(photo_id: photo.id)
        rd = result[:data][:radarData].first

        expect(rd[:id]).to eq(radar_datum.id)
        expect(rd[:timestamp]).to be_present
        expect(rd[:precipitationIntensity]).to eq(2.5)
        expect(rd[:centerLatitude]).to eq(36.115)
      end

      it "returns rainbow conditions summary with camelCase keys" do
        result = service.weather_data(photo_id: photo.id)

        expect(result[:data][:rainbowConditions]).to be_present
        expect(result[:data][:rainbowConditions][:available]).to be true
      end

      it "includes rainbow conditions details with camelCase keys" do
        result = service.weather_data(photo_id: photo.id)
        rc = result[:data][:rainbowConditions]

        expect(rc[:sunAltitude]).to eq(25.0)
        expect(rc[:recommendations]).to be_an(Array)
      end
    end

    context "with photo not found" do
      it "returns failure result" do
        result = service.weather_data(photo_id: "non-existent-uuid")

        expect(result[:success]).to be false
        expect(result[:error][:code]).to eq(ErrorHandler::ErrorCodes::PHOTO_NOT_FOUND)
      end
    end

    context "with photo without weather data" do
      let(:photo_no_weather) do
        p = build(:photo, :without_image, user: user, captured_at: captured_at)
        p.set_location(36.115, 137.954)
        p.save!
        p
      end

      it "returns empty weather conditions" do
        result = service.weather_data(photo_id: photo_no_weather.id)

        expect(result[:success]).to be true
        expect(result[:data][:weatherConditions]).to eq([])
      end

      it "returns empty radar data" do
        result = service.weather_data(photo_id: photo_no_weather.id)

        expect(result[:data][:radarData]).to eq([])
      end

      it "indicates rainbow conditions unavailable" do
        result = service.weather_data(photo_id: photo_no_weather.id)

        expect(result[:data][:rainbowConditions][:available]).to be false
        expect(result[:data][:rainbowConditions][:message]).to include("No weather data")
      end
    end

    context "with unfavorable conditions" do
      let(:photo) do
        p = build(:photo, :without_image, user: user, captured_at: captured_at)
        p.set_location(36.115, 137.954)
        p.save!
        p
      end

      let!(:unfavorable_weather) do
        create(:weather_condition,
          photo: photo,
          timestamp: captured_at,
          temperature: 15.0,
          humidity: 30,
          pressure: 1010,
          sun_altitude: 50.0,  # Too high
          precipitation: 0,     # No precipitation
          cloud_cover: 10
        )
      end

      it "returns unfavorable rainbow conditions with camelCase keys" do
        result = service.weather_data(photo_id: photo.id)
        rc = result[:data][:rainbowConditions]

        expect(rc[:available]).to be true
        # High sun altitude makes it unfavorable
        expect(rc[:isFavorable]).to be false
      end

      it "includes recommendations for unfavorable conditions" do
        result = service.weather_data(photo_id: photo.id)
        recommendations = result[:data][:rainbowConditions][:recommendations]

        expect(recommendations).to be_an(Array)
        expect(recommendations.length).to be > 0
      end
    end
  end

  describe "#generate_recommendations" do
    let(:photo) do
      p = build(:photo, :without_image, user: user, captured_at: captured_at)
      p.set_location(36.115, 137.954)
      p.save!
      p
    end

    context "with favorable conditions" do
      let!(:favorable_weather) do
        create(:weather_condition,
          photo: photo,
          timestamp: captured_at,
          sun_altitude: 25.0,
          precipitation: 1.5,
          humidity: 70,
          cloud_cover: 40
        )
      end

      it "returns positive recommendation for favorable sun angle" do
        recommendations = service.send(:generate_recommendations, favorable_weather)

        expect(recommendations).to include("Sun angle is favorable for rainbow visibility")
      end

      it "returns positive recommendation for precipitation" do
        recommendations = service.send(:generate_recommendations, favorable_weather)

        expect(recommendations).to include("Precipitation present - good for rainbow formation")
      end

      it "returns positive recommendation for high humidity" do
        recommendations = service.send(:generate_recommendations, favorable_weather)

        expect(recommendations).to include("High humidity supports rainbow formation")
      end

      it "returns positive recommendation for partial cloud cover" do
        recommendations = service.send(:generate_recommendations, favorable_weather)

        expect(recommendations).to include("Partial cloud cover allows sunlight through")
      end
    end

    context "with unfavorable conditions" do
      let!(:unfavorable_weather) do
        create(:weather_condition,
          photo: photo,
          timestamp: captured_at,
          sun_altitude: 50.0,
          precipitation: 0,
          humidity: 30,
          cloud_cover: 90
        )
      end

      it "returns warning for high sun angle" do
        recommendations = service.send(:generate_recommendations, unfavorable_weather)

        expect(recommendations).to include("Sun is too high for optimal rainbow viewing")
      end

      it "returns warning for no precipitation" do
        recommendations = service.send(:generate_recommendations, unfavorable_weather)

        expect(recommendations).to include("No precipitation detected - rainbows unlikely")
      end

      it "returns warning for low humidity" do
        recommendations = service.send(:generate_recommendations, unfavorable_weather)

        expect(recommendations).to include("Low humidity may reduce rainbow intensity")
      end

      it "returns warning for heavy cloud cover" do
        recommendations = service.send(:generate_recommendations, unfavorable_weather)

        expect(recommendations).to include("Heavy cloud cover may block sunlight needed for rainbows")
      end
    end

    context "with nighttime conditions" do
      let!(:nighttime_weather) do
        create(:weather_condition,
          photo: photo,
          timestamp: captured_at,
          sun_altitude: -5.0,
          precipitation: 1.0,
          humidity: 80,
          cloud_cover: 30
        )
      end

      it "returns warning for sun below horizon" do
        recommendations = service.send(:generate_recommendations, nighttime_weather)

        expect(recommendations).to include("Sun is below horizon - rainbows not visible")
      end
    end
  end

  describe "#weather_condition_data" do
    let(:photo) do
      p = build(:photo, :without_image, user: user, captured_at: captured_at)
      p.set_location(36.115, 137.954)
      p.save!
      p
    end

    let!(:weather_condition) do
      create(:weather_condition,
        photo: photo,
        timestamp: captured_at,
        temperature: 18.5,
        humidity: 70,
        pressure: 1013,
        wind_speed: 3.5,
        wind_direction: 180,
        wind_gust: 5.0,
        weather_code: "500",
        weather_description: "light rain",
        precipitation: 1.5,
        precipitation_type: "rain",
        cloud_cover: 40,
        visibility: 10000,
        sun_azimuth: 150.0,
        sun_altitude: 25.0
      )
    end

    it "formats weather condition correctly with camelCase keys" do
      data = service.send(:weather_condition_data, weather_condition)

      expect(data[:id]).to eq(weather_condition.id)
      expect(data[:temperature]).to eq(18.5)
      expect(data[:humidity]).to eq(70)
      expect(data[:pressure]).to eq(1013)
      expect(data[:windSpeed]).to eq(3.5)
      expect(data[:windDirection]).to eq(180)
      expect(data[:weatherCode]).to eq("500")
      expect(data[:weatherDescription]).to eq("light rain")
      expect(data[:precipitation]).to eq(1.5)
      expect(data[:precipitationType]).to eq("rain")
      expect(data[:cloudCover]).to eq(40)
      expect(data[:visibility]).to eq(10000)
      expect(data[:sunAzimuth]).to eq(150.0)
      expect(data[:sunAltitude]).to eq(25.0)
    end
  end

  describe "#radar_datum_data" do
    let(:photo) do
      p = build(:photo, :without_image, user: user, captured_at: captured_at)
      p.set_location(36.115, 137.954)
      p.save!
      p
    end

    let!(:radar_datum) do
      rd = build(:radar_datum,
        photo: photo,
        timestamp: captured_at,
        precipitation_intensity: 2.5,
        precipitation_area: 1000,
        radius: 50000
      )
      rd.set_center_location(36.115, 137.954)
      rd.save!
      rd
    end

    it "formats radar datum correctly with camelCase keys" do
      data = service.send(:radar_datum_data, radar_datum)

      expect(data[:id]).to eq(radar_datum.id)
      expect(data[:precipitationIntensity]).to eq(2.5)
      expect(data[:precipitationArea]).to eq(1000)
      expect(data[:radius]).to eq(50000)
      expect(data[:centerLatitude]).to eq(36.115)
      expect(data[:centerLongitude]).to eq(137.954)
    end
  end
end
