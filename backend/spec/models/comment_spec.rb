# frozen_string_literal: true

require "rails_helper"

RSpec.describe Comment, type: :model do
  subject(:comment) { build(:comment) }

  describe "associations" do
    it { is_expected.to belong_to(:user).optional }
    it { is_expected.to belong_to(:photo).counter_cache(:comment_count) }
    it { is_expected.to have_many(:reports).dependent(:destroy) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:content) }
    it { is_expected.to validate_length_of(:content).is_at_most(500) }
  end

  describe "scopes" do
    let(:user) { create(:user) }
    let(:photo) { create(:photo, :without_image) }

    describe ".visible" do
      let!(:visible_comment) { create(:comment, photo: photo, is_visible: true) }
      let!(:hidden_comment) { create(:comment, photo: photo, is_visible: false) }

      it "returns only visible comments" do
        expect(Comment.visible).to include(visible_comment)
        expect(Comment.visible).not_to include(hidden_comment)
      end
    end

    describe ".hidden" do
      let!(:visible_comment) { create(:comment, photo: photo, is_visible: true) }
      let!(:hidden_comment) { create(:comment, photo: photo, is_visible: false) }

      it "returns only hidden comments" do
        expect(Comment.hidden).to include(hidden_comment)
        expect(Comment.hidden).not_to include(visible_comment)
      end
    end

    describe ".recent" do
      let!(:older_comment) { create(:comment, photo: photo, created_at: 2.days.ago) }
      let!(:newer_comment) { create(:comment, photo: photo, created_at: 1.day.ago) }

      it "orders by created_at descending" do
        expect(Comment.recent.first).to eq(newer_comment)
        expect(Comment.recent.last).to eq(older_comment)
      end
    end

    describe ".oldest_first" do
      let!(:older_comment) { create(:comment, photo: photo, created_at: 2.days.ago) }
      let!(:newer_comment) { create(:comment, photo: photo, created_at: 1.day.ago) }

      it "orders by created_at ascending" do
        expect(Comment.oldest_first.first).to eq(older_comment)
        expect(Comment.oldest_first.last).to eq(newer_comment)
      end
    end

    describe ".by_user" do
      let!(:user_comment) { create(:comment, photo: photo, user: user) }
      let!(:other_comment) { create(:comment, photo: photo) }

      it "returns only comments by the specified user" do
        expect(Comment.by_user(user)).to include(user_comment)
        expect(Comment.by_user(user)).not_to include(other_comment)
      end
    end

    describe ".anonymized" do
      let!(:normal_comment) { create(:comment, photo: photo, user: user) }
      let!(:anonymized_comment) do
        create(:comment, photo: photo, user: nil, deleted_user_display_name: "deleted_user")
      end

      it "returns only anonymized comments" do
        expect(Comment.anonymized).to include(anonymized_comment)
        expect(Comment.anonymized).not_to include(normal_comment)
      end
    end

    describe ".with_user" do
      let!(:normal_comment) { create(:comment, photo: photo, user: user) }
      let!(:orphan_comment) do
        create(:comment, photo: photo, user: nil, deleted_user_display_name: "deleted_user")
      end

      it "returns only comments with users" do
        expect(Comment.with_user).to include(normal_comment)
        expect(Comment.with_user).not_to include(orphan_comment)
      end
    end
  end

  describe "#hide!" do
    let(:comment) { create(:comment, is_visible: true) }

    it "sets is_visible to false" do
      expect { comment.hide! }.to change { comment.is_visible }.from(true).to(false)
    end

    it "returns true on success" do
      expect(comment.hide!).to be true
    end
  end

  describe "#show!" do
    let(:comment) { create(:comment, is_visible: false) }

    it "sets is_visible to true" do
      expect { comment.show! }.to change { comment.is_visible }.from(false).to(true)
    end

    it "returns true on success" do
      expect(comment.show!).to be true
    end
  end

  describe "#owned_by?" do
    let(:user) { create(:user) }
    let(:other_user) { create(:user) }
    let(:comment) { create(:comment, user: user) }

    it "returns true for the owner" do
      expect(comment.owned_by?(user)).to be true
    end

    it "returns false for other users" do
      expect(comment.owned_by?(other_user)).to be false
    end

    it "returns false for nil user" do
      expect(comment.owned_by?(nil)).to be false
    end
  end

  describe "#anonymized?" do
    context "when comment has a user" do
      let(:comment) { create(:comment) }

      it "returns false" do
        expect(comment.anonymized?).to be false
      end
    end

    context "when comment has been anonymized" do
      let(:comment) { create(:comment, user: nil, deleted_user_display_name: "deleted_user") }

      it "returns true" do
        expect(comment.anonymized?).to be true
      end
    end

    context "when comment has no user but no deleted_user_display_name" do
      let(:photo) { create(:photo, :without_image) }
      let(:comment) { build(:comment, photo: photo, user: nil, deleted_user_display_name: nil) }

      it "returns false" do
        expect(comment.anonymized?).to be false
      end
    end
  end

  describe "#author_display_name" do
    let(:user) { create(:user, display_name: "Test User") }

    context "when comment has a user" do
      let(:comment) { create(:comment, user: user) }

      it "returns the user's display name" do
        expect(comment.author_display_name).to eq("Test User")
      end
    end

    context "when comment is anonymized" do
      let(:comment) { create(:comment, user: nil, deleted_user_display_name: "deleted_user") }

      it "returns the deleted user placeholder" do
        expect(comment.author_display_name).to be_present
      end
    end

    context "when comment has no user and no deleted_user_display_name" do
      let(:photo) { create(:photo, :without_image) }
      let(:comment) { build(:comment, photo: photo, user: nil, deleted_user_display_name: nil) }

      it "returns Unknown translation" do
        expected = I18n.t("account_deletion.unknown_user", default: "Unknown")
        expect(comment.author_display_name).to eq(expected)
      end
    end
  end

  describe "counter cache" do
    let(:photo) { create(:photo, :without_image) }

    it "increments photo comment_count when created" do
      expect { create(:comment, photo: photo) }
        .to change { photo.reload.comment_count }.by(1)
    end

    it "decrements photo comment_count when destroyed" do
      comment = create(:comment, photo: photo)
      expect { comment.destroy }
        .to change { photo.reload.comment_count }.by(-1)
    end
  end
end
