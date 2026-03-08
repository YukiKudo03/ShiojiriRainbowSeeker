# frozen_string_literal: true

require "rails_helper"

RSpec.describe Like, type: :model do
  subject(:like) { build(:like) }

  describe "associations" do
    it { is_expected.to belong_to(:user) }
    it { is_expected.to belong_to(:photo).counter_cache(:like_count) }
  end

  describe "validations" do
    subject { create(:like) }

    it { is_expected.to validate_uniqueness_of(:user_id).scoped_to(:photo_id).with_message("has already liked this photo") }
  end

  describe "uniqueness enforcement" do
    let(:user) { create(:user) }
    let(:photo) { create(:photo, :without_image) }

    it "allows a user to like different photos" do
      create(:like, user: user, photo: photo)
      other_photo = create(:photo, :without_image)
      new_like = build(:like, user: user, photo: other_photo)
      expect(new_like).to be_valid
    end

    it "allows different users to like the same photo" do
      create(:like, user: user, photo: photo)
      other_user = create(:user)
      new_like = build(:like, user: other_user, photo: photo)
      expect(new_like).to be_valid
    end

    it "prevents a user from liking the same photo twice" do
      create(:like, user: user, photo: photo)
      duplicate_like = build(:like, user: user, photo: photo)
      expect(duplicate_like).not_to be_valid
    end
  end

  describe "scopes" do
    describe ".recent" do
      let!(:older_like) { create(:like, created_at: 2.days.ago) }
      let!(:newer_like) { create(:like, created_at: 1.day.ago) }

      it "orders by created_at descending" do
        expect(Like.recent.first).to eq(newer_like)
        expect(Like.recent.last).to eq(older_like)
      end
    end

    describe ".by_user" do
      let(:user) { create(:user) }
      let!(:user_like) { create(:like, user: user) }
      let!(:other_like) { create(:like) }

      it "returns only likes by the specified user" do
        expect(Like.by_user(user)).to include(user_like)
        expect(Like.by_user(user)).not_to include(other_like)
      end
    end

    describe ".for_photo" do
      let(:photo) { create(:photo, :without_image) }
      let!(:photo_like) { create(:like, photo: photo) }
      let!(:other_like) { create(:like) }

      it "returns only likes for the specified photo" do
        expect(Like.for_photo(photo)).to include(photo_like)
        expect(Like.for_photo(photo)).not_to include(other_like)
      end
    end
  end

  describe "callbacks" do
    describe "after_create_commit :broadcast_like" do
      let(:photo_owner) { create(:user) }
      let(:photo) { create(:photo, :without_image, user: photo_owner) }
      let(:liker) { create(:user) }

      it "broadcasts to the photo owner when a different user likes" do
        expect(NotificationsChannel).to receive(:broadcast_to).with(
          photo_owner,
          hash_including(type: "new_like", photo_id: photo.id)
        )

        create(:like, user: liker, photo: photo)
      end

      it "includes the liker's display name in the broadcast" do
        expect(NotificationsChannel).to receive(:broadcast_to).with(
          photo_owner,
          hash_including(user: hash_including(id: liker.id, display_name: liker.display_name))
        )

        create(:like, user: liker, photo: photo)
      end

      it "includes the updated like_count in the broadcast" do
        expect(NotificationsChannel).to receive(:broadcast_to).with(
          photo_owner,
          hash_including(like_count: 1)
        )

        create(:like, user: liker, photo: photo)
      end

      it "does not broadcast when user likes their own photo" do
        expect(NotificationsChannel).not_to receive(:broadcast_to)

        create(:like, user: photo_owner, photo: photo)
      end
    end
  end

  describe "#owned_by?" do
    let(:user) { create(:user) }
    let(:other_user) { create(:user) }
    let(:like) { create(:like, user: user) }

    it "returns true for the owner" do
      expect(like.owned_by?(user)).to be true
    end

    it "returns false for other users" do
      expect(like.owned_by?(other_user)).to be false
    end

    it "returns false for nil user" do
      expect(like.owned_by?(nil)).to be false
    end
  end

  describe "counter cache" do
    let(:photo) { create(:photo, :without_image) }

    it "increments photo like_count when created" do
      expect { create(:like, photo: photo) }
        .to change { photo.reload.like_count }.by(1)
    end

    it "decrements photo like_count when destroyed" do
      like = create(:like, photo: photo)
      expect { like.destroy }
        .to change { photo.reload.like_count }.by(-1)
    end
  end
end
