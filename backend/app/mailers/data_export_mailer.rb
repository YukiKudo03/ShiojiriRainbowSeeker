# frozen_string_literal: true

# DataExportMailer handles email notifications for GDPR data exports.
#
# Sends notification emails when a user's data export is ready for download,
# including the download link and expiration time.
#
# == Requirements Reference
# - FR-12: Data export and deletion (GDPR compliance)
# - AC-12.1: Users can export their data with 48-hour download link
#
class DataExportMailer < ApplicationMailer
  # Send notification when data export is ready for download
  #
  # @param user [User] the user who requested the export
  # @param download_url [String] signed URL for downloading the ZIP file
  # @param expires_at [Time] when the download link expires
  # @return [Mail::Message] the email to be sent
  def export_ready(user:, download_url:, expires_at:)
    @user = user
    @download_url = download_url
    @expires_at = expires_at
    @app_name = I18n.t("app_name", default: "Shiojiri Rainbow Seeker")

    I18n.with_locale(@user.locale) do
      mail(
        to: @user.email,
        subject: I18n.t("data_export_mailer.export_ready.subject", app_name: @app_name)
      )
    end
  end
end
