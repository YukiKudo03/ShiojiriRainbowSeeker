# frozen_string_literal: true

require "rails_helper"

RSpec.describe DataExportMailer, type: :mailer do
  let(:user) { create(:user, display_name: "Test User", email: "test@example.com", locale: "ja") }
  let(:download_url) { "https://example.com/exports/download?token=abc123" }
  let(:expires_at) { Time.current + 48.hours }

  describe "#export_ready" do
    let(:mail) { described_class.export_ready(user: user, download_url: download_url, expires_at: expires_at) }

    context "with Japanese locale" do
      before { user.update(locale: "ja") }

      # Helper to get decoded HTML body
      def html_body
        html_part = mail.parts.find { |p| p.content_type.include?("text/html") }
        html_part.body.decoded
      end

      it "renders the headers" do
        expect(mail.subject).to include("データエクスポート")
        expect(mail.to).to eq([ user.email ])
      end

      it "renders the body with download link" do
        expect(html_body).to include(download_url)
      end

      it "includes user name in greeting" do
        expect(html_body).to include(user.display_name)
      end

      it "includes contents description" do
        expect(html_body).to include("プロフィール情報")
        expect(html_body).to include("写真")
        expect(html_body).to include("コメント")
        expect(html_body).to include("いいね")
      end
    end

    context "with English locale" do
      before { user.update(locale: "en") }

      it "renders the headers in English" do
        expect(mail.subject).to include("data export")
        expect(mail.to).to eq([ user.email ])
      end

      it "renders the body in English" do
        expect(mail.body.encoded).to include("Download Your Data")
      end

      it "includes English content descriptions" do
        expect(mail.body.encoded).to include("profile information")
        expect(mail.body.encoded).to include("photos")
        expect(mail.body.encoded).to include("comments")
        expect(mail.body.encoded).to include("likes")
      end
    end

    it "includes both HTML and text parts" do
      expect(mail.parts.count).to eq(2)
      expect(mail.parts.map(&:content_type)).to include("text/html; charset=UTF-8", "text/plain; charset=UTF-8")
    end

    it "includes expiry warning" do
      # Check both HTML and plain text parts for expiry information
      html_part = mail.parts.find { |p| p.content_type.include?("text/html") }
      text_part = mail.parts.find { |p| p.content_type.include?("text/plain") }

      expect(html_part.body.encoded).to include(I18n.l(expires_at, format: :long))
      expect(text_part.body.encoded).to include(I18n.l(expires_at, format: :long))
    end
  end
end
