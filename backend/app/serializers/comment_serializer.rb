# frozen_string_literal: true

# CommentSerializer provides Alba serialization for Comment resources.
#
# Serializes comment data with user information for API responses.
#
# == Security
# - Only includes visible comments by default
# - Includes ownership flag for UI controls
#
# == Usage
#   CommentSerializer.new(comment).serialize
#   CommentSerializer.new(comments).serialize
#
class CommentSerializer < ApplicationSerializer
  attributes :id, :content

  # User who wrote the comment
  one :user, serializer: UserSerializer::Summary

  # Whether current user owns this comment
  attribute :is_owner do |comment, params|
    current_user = params[:current_user]
    next false unless current_user

    comment.user_id == current_user.id
  end

  # Creation timestamp
  attribute :created_at do |comment|
    comment.created_at&.iso8601
  end

  # Update timestamp (for edited indicator)
  attribute :updated_at do |comment|
    comment.updated_at&.iso8601
  end
end
