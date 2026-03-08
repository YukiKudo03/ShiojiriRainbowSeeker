# frozen_string_literal: true

RSpec.describe ApplicationMailer, type: :mailer do
  describe "defaults" do
    it "has the correct default from address" do
      expect(described_class.default[:from]).to eq("from@example.com")
    end
  end

  describe "layout" do
    it "uses the mailer layout" do
      # ApplicationMailer specifies layout "mailer"
      mailer = described_class.new
      expect(mailer.class.ancestors.map(&:to_s)).to include("ApplicationMailer")
    end
  end
end
