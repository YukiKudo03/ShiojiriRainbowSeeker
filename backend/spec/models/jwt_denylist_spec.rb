# frozen_string_literal: true

require "rails_helper"

RSpec.describe JwtDenylist, type: :model do
  describe "configuration" do
    it "includes Devise::JWT::RevocationStrategies::Denylist" do
      expect(JwtDenylist.ancestors).to include(Devise::JWT::RevocationStrategies::Denylist)
    end

    it "uses jwt_denylists as the table name" do
      expect(JwtDenylist.table_name).to eq("jwt_denylists")
    end
  end

  describe "scopes" do
    describe ".expired" do
      let!(:expired_token) { create(:jwt_denylist, exp: 1.hour.ago) }
      let!(:valid_token) { create(:jwt_denylist, exp: 1.hour.from_now) }

      it "returns only tokens with expired exp" do
        expect(JwtDenylist.expired).to include(expired_token)
        expect(JwtDenylist.expired).not_to include(valid_token)
      end
    end
  end

  describe ".cleanup_expired" do
    let!(:expired_token_1) { create(:jwt_denylist, exp: 2.hours.ago) }
    let!(:expired_token_2) { create(:jwt_denylist, exp: 1.hour.ago) }
    let!(:valid_token) { create(:jwt_denylist, exp: 1.hour.from_now) }

    it "deletes all expired tokens" do
      expect { JwtDenylist.cleanup_expired }.to change { JwtDenylist.count }.by(-2)
    end

    it "does not delete valid tokens" do
      JwtDenylist.cleanup_expired
      expect(JwtDenylist.all).to include(valid_token)
    end

    it "returns the number of deleted records" do
      expect(JwtDenylist.cleanup_expired).to eq(2)
    end
  end
end
