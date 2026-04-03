# frozen_string_literal: true

require "rails_helper"

RSpec.describe RainbowMomentParticipation, type: :model do
  describe "associations" do
    it { is_expected.to belong_to(:rainbow_moment) }
    it { is_expected.to belong_to(:user) }
  end

  describe "validations" do
    it "requires joined_at" do
      participation = described_class.new
      participation.valid?
      expect(participation.errors[:joined_at]).to be_present
    end

    it "enforces unique user per moment" do
      user = User.create!(email: "dup@example.com", password: "password123", display_name: "Dup", confirmed_at: Time.current)
      moment = RainbowMoment.create!(starts_at: Time.current, ends_at: 15.minutes.from_now, location_id: "daimon", status: "active")

      described_class.create!(rainbow_moment: moment, user: user, joined_at: Time.current)

      duplicate = described_class.new(rainbow_moment: moment, user: user, joined_at: Time.current)
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:user_id]).to be_present
    end
  end

  describe "scopes" do
    it ".active returns participations without left_at" do
      user = User.create!(email: "scope@example.com", password: "password123", display_name: "Scope", confirmed_at: Time.current)
      moment = RainbowMoment.create!(starts_at: Time.current, ends_at: 15.minutes.from_now, location_id: "daimon", status: "active")

      active = described_class.create!(rainbow_moment: moment, user: user, joined_at: Time.current)

      user2 = User.create!(email: "scope2@example.com", password: "password123", display_name: "Scope2", confirmed_at: Time.current)
      described_class.create!(rainbow_moment: moment, user: user2, joined_at: 5.minutes.ago, left_at: Time.current)

      expect(described_class.active).to contain_exactly(active)
    end
  end
end
