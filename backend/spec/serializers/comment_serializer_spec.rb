# frozen_string_literal: true

require "rails_helper"

RSpec.describe CommentSerializer, type: :serializer do
  let(:user) { create(:user, display_name: "Commenter") }
  let(:photo) { create(:photo, :without_image) }
  let(:comment) { create(:comment, user: user, photo: photo, content: "Amazing rainbow!") }

  describe "CommentSerializer (default)" do
    subject(:serialized) { described_class.new(comment, params: { current_user: current_user }).to_h }

    let(:current_user) { nil }

    it "includes id" do
      expect(serialized[:id]).to eq(comment.id)
    end

    it "includes content" do
      expect(serialized[:content]).to eq("Amazing rainbow!")
    end

    it "includes user as a Summary serialization" do
      expect(serialized[:user]).to include(
        id: user.id,
        displayName: "Commenter"
      )
    end

    it "includes createdAt as ISO8601" do
      expect(serialized[:createdAt]).to match(/\d{4}-\d{2}-\d{2}T/)
    end

    it "includes updatedAt as ISO8601" do
      expect(serialized[:updatedAt]).to match(/\d{4}-\d{2}-\d{2}T/)
    end

    it "uses camelCase keys" do
      snake_case_keys = serialized.keys.select { |k| k.to_s.include?("_") }
      expect(snake_case_keys).to be_empty
    end

    context "when current_user is the comment owner" do
      let(:current_user) { user }

      it "returns true for isOwner" do
        expect(serialized[:isOwner]).to be true
      end
    end

    context "when current_user is a different user" do
      let(:current_user) { create(:user) }

      it "returns false for isOwner" do
        expect(serialized[:isOwner]).to be false
      end
    end

    context "when current_user is nil" do
      let(:current_user) { nil }

      it "returns false for isOwner" do
        expect(serialized[:isOwner]).to be false
      end
    end
  end
end
