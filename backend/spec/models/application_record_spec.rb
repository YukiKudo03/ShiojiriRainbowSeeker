# frozen_string_literal: true

require "rails_helper"

RSpec.describe ApplicationRecord, type: :model do
  describe "configuration" do
    it "is an abstract class" do
      expect(ApplicationRecord).to be_abstract_class
    end

    it "inherits from ActiveRecord::Base" do
      expect(ApplicationRecord.superclass).to eq(ActiveRecord::Base)
    end
  end
end
