# frozen_string_literal: true

require "rails_helper"

RSpec.describe DailyCleanupJob, type: :job do
  include ActiveJob::TestHelper

  describe "#perform" do
    it "cleans up expired JWT denylist entries" do
      # Create expired and valid entries
      JwtDenylist.create!(jti: "expired-token", exp: 1.day.ago)
      JwtDenylist.create!(jti: "valid-token", exp: 1.day.from_now)

      described_class.perform_now

      expect(JwtDenylist.count).to eq(1)
      expect(JwtDenylist.first.jti).to eq("valid-token")
    end

    it "cleans up inactive device tokens" do
      user = create(:user)
      # Active token
      DeviceToken.create!(user: user, token: "active-token", platform: "ios", is_active: true)
      # Old inactive token
      old_token = DeviceToken.create!(user: user, token: "old-token", platform: "android", is_active: false)
      old_token.update_column(:updated_at, 31.days.ago)

      described_class.perform_now

      expect(DeviceToken.count).to eq(1)
      expect(DeviceToken.first.token).to eq("active-token")
    end
  end
end
