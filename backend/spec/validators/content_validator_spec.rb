# frozen_string_literal: true

require "rails_helper"
require "active_support/all"
require "active_model"
require "ostruct"
require "yaml"
require "tempfile"
require "fileutils"

# Stub Rails
module Rails
  class << self
    attr_accessor :logger, :root_path

    def root
      @root_path || Pathname.new(Dir.pwd)
    end

    def root=(path)
      @root_path = Pathname.new(path)
    end
  end
end unless defined?(Rails) && Rails.respond_to?(:root=)

# Now require the validator
require_relative "../../app/validators/content_validator"

RSpec.describe ContentValidator do
  let(:validator) { described_class.new(attributes: [ :content ]) }
  let(:mock_errors) { ActiveModel::Errors.new(self) }
  let(:mock_record) do
    record = OpenStruct.new(errors: mock_errors)
    def record.class
      OpenStruct.new(name: "TestRecord")
    end
    record
  end

  before do
    Rails.logger = Logger.new("/dev/null")
    described_class.reset_cache!
  end

  describe "class methods" do
    describe ".configuration" do
      context "when config file does not exist" do
        let(:original_root) { Rails.root }

        before do
          Rails.root = "/nonexistent/path"
        end

        after do
          Rails.root = original_root.to_s
        end

        it "returns default config" do
          config = described_class.configuration

          expect(config["settings"]["enabled"]).to be false
          expect(config["exact"]).to eq([])
          expect(config["partial"]).to eq([])
        end
      end

      context "when config file exists" do
        let(:temp_dir) { Dir.mktmpdir }
        let(:original_root) { Rails.root }
        let(:config_content) do
          {
            "settings" => { "enabled" => true },
            "exact" => [ "badword" ],
            "partial" => [ "spam" ],
            "regex" => [],
            "categories" => {}
          }.to_yaml
        end

        before do
          FileUtils.mkdir_p(File.join(temp_dir, "config"))
          File.write(File.join(temp_dir, "config", "banned_words.yml"), config_content)
          Rails.root = temp_dir
        end

        after do
          Rails.root = original_root.to_s
          FileUtils.rm_rf(temp_dir)
        end

        it "loads config from file" do
          config = described_class.configuration

          expect(config["settings"]["enabled"]).to be true
          expect(config["exact"]).to include("badword")
        end

        it "caches the configuration" do
          # First load
          described_class.configuration

          # Modify file but don't change mtime
          expect(File).not_to receive(:read)

          # Second load should use cache
          described_class.configuration
        end
      end
    end

    describe ".enabled?" do
      context "when filtering is enabled in config" do
        before do
          allow(described_class).to receive(:configuration).and_return({
            "settings" => { "enabled" => true }
          })
        end

        it "returns true" do
          expect(described_class.enabled?).to be true
        end
      end

      context "when filtering is disabled in config" do
        before do
          allow(described_class).to receive(:configuration).and_return({
            "settings" => { "enabled" => false }
          })
        end

        it "returns false" do
          expect(described_class.enabled?).to be false
        end
      end
    end

    describe ".rejection_message" do
      context "when custom message is configured" do
        before do
          allow(described_class).to receive(:configuration).and_return({
            "settings" => { "rejection_message" => "カスタムエラー" }
          })
        end

        it "returns custom message" do
          expect(described_class.rejection_message).to eq("カスタムエラー")
        end
      end

      context "when no custom message" do
        before do
          allow(described_class).to receive(:configuration).and_return({
            "settings" => {}
          })
        end

        it "returns default message" do
          expect(described_class.rejection_message).to eq("Content contains prohibited words.")
        end
      end
    end

    describe ".reset_cache!" do
      it "clears the configuration cache" do
        described_class.instance_variable_set(:@config_cache, { "test" => true })
        described_class.instance_variable_set(:@config_mtime, Time.now)

        described_class.reset_cache!

        expect(described_class.instance_variable_get(:@config_cache)).to be_nil
        expect(described_class.instance_variable_get(:@config_mtime)).to be_nil
      end
    end
  end

  describe "#validate_each" do
    context "when filtering is disabled" do
      before do
        allow(described_class).to receive(:enabled?).and_return(false)
      end

      it "does not add errors" do
        validator.validate_each(mock_record, :content, "any content")

        expect(mock_record.errors).to be_empty
      end
    end

    context "when content is blank" do
      before do
        allow(described_class).to receive(:enabled?).and_return(true)
      end

      it "does not add errors for nil" do
        validator.validate_each(mock_record, :content, nil)

        expect(mock_record.errors).to be_empty
      end

      it "does not add errors for empty string" do
        validator.validate_each(mock_record, :content, "")

        expect(mock_record.errors).to be_empty
      end
    end

    context "when filtering is enabled" do
      before do
        allow(described_class).to receive(:enabled?).and_return(true)
        allow(described_class).to receive(:configuration).and_return({
          "settings" => {
            "enabled" => true,
            "rejection_message" => "禁止ワードが含まれています"
          },
          "exact" => [ "spam", "広告" ],
          "partial" => [ "http://", "badword" ],
          "regex" => [ '[!?]{4,}' ],
          "categories" => {
            "test_category" => {
              "enabled" => true,
              "words" => [ "宣伝" ],
              "patterns" => [ 'test@example' ]
            }
          }
        })
      end

      describe "exact matching" do
        it "rejects content with exact banned word" do
          validator.validate_each(mock_record, :content, "This is spam content")

          expect(mock_record.errors[:content]).not_to be_empty
        end

        it "rejects Japanese exact word" do
          validator.validate_each(mock_record, :content, "これは広告です")

          expect(mock_record.errors[:content]).not_to be_empty
        end

        it "allows content without banned words" do
          validator.validate_each(mock_record, :content, "Nice rainbow photo!")

          expect(mock_record.errors).to be_empty
        end

        it "is case-insensitive" do
          validator.validate_each(mock_record, :content, "This is SPAM content")

          expect(mock_record.errors[:content]).not_to be_empty
        end
      end

      describe "partial matching" do
        it "rejects content with partial match" do
          validator.validate_each(mock_record, :content, "Check this badword here")

          expect(mock_record.errors[:content]).not_to be_empty
        end

        it "rejects URLs" do
          validator.validate_each(mock_record, :content, "Visit http://example.com")

          expect(mock_record.errors[:content]).not_to be_empty
        end

        it "is case-insensitive for partial matches" do
          validator.validate_each(mock_record, :content, "Contains BADWORD inside")

          expect(mock_record.errors[:content]).not_to be_empty
        end
      end

      describe "regex matching" do
        it "rejects content matching regex pattern" do
          validator.validate_each(mock_record, :content, "Wow!!!!!")

          expect(mock_record.errors[:content]).not_to be_empty
        end

        it "allows content not matching regex" do
          validator.validate_each(mock_record, :content, "Wow!")

          expect(mock_record.errors).to be_empty
        end
      end

      describe "category matching" do
        it "rejects content with category word" do
          validator.validate_each(mock_record, :content, "これは宣伝です")

          expect(mock_record.errors[:content]).not_to be_empty
        end

        it "rejects content matching category pattern" do
          validator.validate_each(mock_record, :content, "Contact: test@example.com")

          expect(mock_record.errors[:content]).not_to be_empty
        end
      end

      describe "error message" do
        it "uses configured rejection message" do
          validator.validate_each(mock_record, :content, "spam")

          expect(mock_record.errors[:content].first).to eq("禁止ワードが含まれています")
        end

        it "uses custom message from options" do
          custom_validator = described_class.new(
            attributes: [ :content ],
            message: "Custom error message"
          )

          custom_validator.validate_each(mock_record, :content, "spam")

          expect(mock_record.errors[:content].first).to eq("Custom error message")
        end
      end
    end

    context "with invalid regex pattern" do
      before do
        allow(described_class).to receive(:enabled?).and_return(true)
        allow(described_class).to receive(:configuration).and_return({
          "settings" => { "enabled" => true },
          "exact" => [],
          "partial" => [],
          "regex" => [ "[invalid(regex" ],
          "categories" => {}
        })
      end

      it "handles invalid regex gracefully" do
        expect {
          validator.validate_each(mock_record, :content, "test content")
        }.not_to raise_error
      end
    end
  end
end

RSpec.describe ContentFilter do
  before do
    Rails.logger = Logger.new("/dev/null")
    ContentValidator.reset_cache!
  end

  describe ".clean?" do
    context "when filtering is disabled" do
      before do
        allow(ContentValidator).to receive(:enabled?).and_return(false)
      end

      it "returns true for any content" do
        expect(described_class.clean?("spam spam spam")).to be true
      end
    end

    context "when content is blank" do
      before do
        allow(ContentValidator).to receive(:enabled?).and_return(true)
      end

      it "returns true for nil" do
        expect(described_class.clean?(nil)).to be true
      end

      it "returns true for empty string" do
        expect(described_class.clean?("")).to be true
      end
    end

    context "when filtering is enabled" do
      before do
        allow(ContentValidator).to receive(:enabled?).and_return(true)
        allow(ContentValidator).to receive(:configuration).and_return({
          "settings" => { "enabled" => true },
          "exact" => [],
          "partial" => [ "spam" ],
          "regex" => [],
          "categories" => {}
        })
      end

      it "returns false for content with banned words" do
        expect(described_class.clean?("this is spam")).to be false
      end

      it "returns true for clean content" do
        expect(described_class.clean?("Nice photo!")).to be true
      end
    end
  end

  describe ".check" do
    before do
      allow(ContentValidator).to receive(:enabled?).and_return(true)
      allow(ContentValidator).to receive(:configuration).and_return({
        "settings" => {
          "enabled" => true,
          "rejection_message" => "禁止ワードが含まれています"
        },
        "exact" => [],
        "partial" => [ "spam" ],
        "regex" => [],
        "categories" => {}
      })
    end

    it "returns clean: true for clean content" do
      result = described_class.check("Nice rainbow!")

      expect(result[:clean]).to be true
      expect(result[:message]).to be_nil
    end

    it "returns clean: false with message for banned content" do
      result = described_class.check("this is spam")

      expect(result[:clean]).to be false
      expect(result[:message]).to eq("禁止ワードが含まれています")
    end
  end
end
