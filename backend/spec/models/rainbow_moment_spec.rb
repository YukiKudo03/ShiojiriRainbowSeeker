# frozen_string_literal: true

require "rails_helper"

RSpec.describe RainbowMoment, type: :model do
  describe "validations" do
    it "requires starts_at" do
      moment = described_class.new(ends_at: 15.minutes.from_now, location_id: "daimon", status: "active")
      expect(moment).not_to be_valid
      expect(moment.errors[:starts_at]).to be_present
    end

    it "requires ends_at" do
      moment = described_class.new(starts_at: Time.current, location_id: "daimon", status: "active")
      expect(moment).not_to be_valid
      expect(moment.errors[:ends_at]).to be_present
    end

    it "requires location_id" do
      moment = described_class.new(starts_at: Time.current, ends_at: 15.minutes.from_now, status: "active")
      expect(moment).not_to be_valid
      expect(moment.errors[:location_id]).to be_present
    end

    it "requires a valid status" do
      moment = described_class.new(
        starts_at: Time.current, ends_at: 15.minutes.from_now,
        location_id: "daimon", status: "invalid"
      )
      expect(moment).not_to be_valid
      expect(moment.errors[:status]).to be_present
    end

    it "is valid with all required attributes" do
      moment = described_class.new(
        starts_at: Time.current, ends_at: 15.minutes.from_now,
        location_id: "daimon", status: "active"
      )
      expect(moment).to be_valid
    end
  end

  describe "scopes" do
    it ".active returns only active moments" do
      active = described_class.create!(starts_at: Time.current, ends_at: 15.minutes.from_now, location_id: "daimon", status: "active")
      described_class.create!(starts_at: 1.hour.ago, ends_at: 45.minutes.ago, location_id: "hirooka", status: "archived")

      expect(described_class.active).to contain_exactly(active)
    end

    it ".for_location filters by location_id" do
      daimon = described_class.create!(starts_at: Time.current, ends_at: 15.minutes.from_now, location_id: "daimon", status: "active")
      described_class.create!(starts_at: Time.current, ends_at: 15.minutes.from_now, location_id: "hirooka", status: "active")

      expect(described_class.for_location("daimon")).to contain_exactly(daimon)
    end

    it ".recent orders by starts_at descending" do
      old = described_class.create!(starts_at: 2.hours.ago, ends_at: 1.hour.ago, location_id: "daimon", status: "archived")
      recent = described_class.create!(starts_at: 1.hour.ago, ends_at: 30.minutes.ago, location_id: "hirooka", status: "archived")

      expect(described_class.recent.first).to eq(recent)
    end
  end

  describe ".create_for_alert" do
    let(:location) { { id: "daimon", name: "大門地区", lat: 36.115, lng: 137.954 } }

    it "creates an active moment" do
      moment = described_class.create_for_alert(location: location)
      expect(moment).to be_persisted
      expect(moment.status).to eq("active")
      expect(moment.location_id).to eq("daimon")
    end

    it "returns existing active moment for same location" do
      first = described_class.create_for_alert(location: location)
      second = described_class.create_for_alert(location: location)
      expect(second.id).to eq(first.id)
    end

    it "stores weather data in weather_snapshot" do
      moment = described_class.create_for_alert(
        location: location,
        weather_data: { temperature: 18.5, humidity: 72, rain_1h: 1.2 }
      )
      expect(moment.weather_snapshot["temperature"]).to eq(18.5)
      expect(moment.weather_snapshot["humidity"]).to eq(72)
      expect(moment.weather_snapshot["precipitation_mm"]).to eq(1.2)
    end
  end

  describe "lifecycle transitions" do
    let(:moment) do
      described_class.create!(
        starts_at: Time.current, ends_at: 15.minutes.from_now,
        location_id: "daimon", status: "active"
      )
    end

    describe "#close!" do
      it "transitions from active to closing" do
        moment.close!
        expect(moment.reload.status).to eq("closing")
      end

      it "does nothing if not active" do
        moment.update!(status: "archived")
        moment.close!
        expect(moment.reload.status).to eq("archived")
      end
    end

    describe "#archive!" do
      it "transitions from closing to archived" do
        moment.update!(status: "closing")
        moment.archive!
        expect(moment.reload.status).to eq("archived")
      end

      it "does nothing if not closing" do
        moment.archive!
        expect(moment.reload.status).to eq("active")
      end
    end

    describe "#check_lifecycle!" do
      it "closes active moment when past ends_at" do
        moment.update!(ends_at: 1.minute.ago)
        moment.check_lifecycle!
        expect(moment.reload.status).to eq("closing")
      end

      it "archives closing moment after grace period" do
        moment.update!(status: "closing", ends_at: 10.minutes.ago)
        moment.check_lifecycle!
        expect(moment.reload.status).to eq("archived")
      end
    end
  end

  describe "#location_name" do
    it "returns the Japanese name from MONITORING_LOCATIONS" do
      moment = described_class.new(location_id: "daimon")
      expect(moment.location_name).to eq("大門地区")
    end

    it "falls back to location_id for unknown locations" do
      moment = described_class.new(location_id: "unknown")
      expect(moment.location_name).to eq("unknown")
    end
  end

  describe "participation" do
    let(:moment) do
      described_class.create!(
        starts_at: Time.current, ends_at: 15.minutes.from_now,
        location_id: "daimon", status: "active"
      )
    end
    let(:user) { User.create!(email: "test@example.com", password: "password123", display_name: "テスト", confirmed_at: Time.current) }

    describe "#join" do
      it "creates a participation record" do
        participation = moment.join(user)
        expect(participation).to be_persisted
        expect(participation.user).to eq(user)
      end

      it "does not duplicate participation" do
        moment.join(user)
        moment.join(user)
        expect(moment.participations.count).to eq(1)
      end

      it "reactivates a left participant" do
        participation = moment.join(user)
        participation.update!(left_at: Time.current)
        moment.join(user)
        expect(participation.reload.left_at).to be_nil
      end

      it "returns nil if moment is not active" do
        moment.update!(status: "archived")
        expect(moment.join(user)).to be_nil
      end
    end

    describe "#leave" do
      it "sets left_at on the participation" do
        moment.join(user)
        moment.leave(user)
        expect(moment.participations.first.left_at).to be_present
      end
    end

    describe "#active_participants_count" do
      it "counts only users who have not left" do
        user2 = User.create!(email: "test2@example.com", password: "password123", display_name: "テスト2", confirmed_at: Time.current)
        moment.join(user)
        moment.join(user2)
        moment.leave(user)
        expect(moment.active_participants_count).to eq(1)
      end
    end
  end
end
