# frozen_string_literal: true

# SimpleCov must be started before any application code is loaded
if ENV["COVERAGE"] || ENV["CI"]
  require "simplecov"

  SimpleCov.start "rails" do
    # Track coverage for app directory
    add_filter "/spec/"
    add_filter "/config/"
    add_filter "/db/"
    add_filter "/vendor/"

    # Group coverage by component type
    add_group "Controllers", "app/controllers"
    add_group "Models", "app/models"
    add_group "Services", "app/services"
    add_group "Jobs", "app/jobs"
    add_group "Mailers", "app/mailers"
    add_group "Policies", "app/policies"
    add_group "Serializers", "app/serializers"
    add_group "Validators", "app/validators"
    add_group "Lib", "lib"

    # Set minimum coverage threshold (80%)
    minimum_coverage 80
    minimum_coverage_by_file 50

    # Enable branch coverage
    enable_coverage :branch

    # Merge results when running tests in parallel
    use_merging true

    # Format output
    formatter SimpleCov::Formatter::HTMLFormatter
  end

  puts "SimpleCov started with minimum coverage: 80%"
end

# See https://rubydoc.info/gems/rspec-core/RSpec/Core/Configuration

RSpec.configure do |config|
  # rspec-expectations config
  config.expect_with :rspec do |expectations|
    expectations.include_chain_clauses_in_custom_matcher_descriptions = true
  end

  # rspec-mocks config
  config.mock_with :rspec do |mocks|
    mocks.verify_partial_doubles = true
  end

  # This option will default to `:apply_to_host_groups` in RSpec 4
  config.shared_context_metadata_behavior = :apply_to_host_groups

  # Allow filtering runs with `:focus`
  config.filter_run_when_matching :focus

  # Allow skipping examples with `:skip`
  config.run_all_when_everything_filtered = true

  # Limits the available syntax to the non-monkey patched syntax
  config.disable_monkey_patching!

  # Print full backtraces for failures
  config.full_backtrace = false

  # Use the documentation formatter for verbose output
  config.default_formatter = "doc" if config.files_to_run.one?

  # Run specs in random order
  config.order = :random

  # Seed global randomization
  Kernel.srand config.seed
end
