# frozen_string_literal: true

namespace :test do
  desc "Run all tests with code coverage analysis"
  task :coverage do
    puts "\n=========================================="
    puts "Running RSpec with Coverage Analysis"
    puts "==========================================\n"

    ENV["COVERAGE"] = "true"

    success = system("bundle exec rspec")

    if success
      puts "\n=========================================="
      puts "Coverage report generated: coverage/index.html"
      puts "==========================================\n"
    else
      puts "\n=========================================="
      puts "Tests failed. Check output above."
      puts "==========================================\n"
      exit(1)
    end
  end

  desc "Run security scan with Brakeman"
  task :security do
    puts "\n=========================================="
    puts "Running Brakeman Security Scan"
    puts "==========================================\n"

    # Ensure tmp directory exists
    FileUtils.mkdir_p("tmp")

    success = system("bundle exec brakeman -o tmp/brakeman_report.html -o tmp/brakeman_report.json --no-pager")

    if success
      puts "\n=========================================="
      puts "Security scan completed successfully"
      puts "HTML Report: tmp/brakeman_report.html"
      puts "JSON Report: tmp/brakeman_report.json"
      puts "==========================================\n"
    else
      puts "\n=========================================="
      puts "Security vulnerabilities detected!"
      puts "Check tmp/brakeman_report.html for details"
      puts "==========================================\n"
      exit(1)
    end
  end

  desc "Run full test suite with coverage and security scan"
  task :full do
    puts "\n=========================================="
    puts "Running Full Test Suite"
    puts "==========================================\n"

    Rake::Task["test:coverage"].invoke
    Rake::Task["test:security"].invoke

    puts "\n=========================================="
    puts "Full Test Suite Complete"
    puts "=========================================="
    puts "- Coverage Report: coverage/index.html"
    puts "- Security Report: tmp/brakeman_report.html"
    puts "==========================================\n"
  end

  desc "Run tests for a specific component (models, controllers, services, jobs)"
  task :component, [ :component ] do |_t, args|
    component = args[:component] || "all"

    puts "\n=========================================="
    puts "Running Tests for: #{component}"
    puts "==========================================\n"

    case component.downcase
    when "models"
      system("bundle exec rspec spec/models")
    when "controllers", "requests"
      system("bundle exec rspec spec/requests")
    when "services"
      system("bundle exec rspec spec/services")
    when "jobs"
      system("bundle exec rspec spec/jobs")
    when "policies"
      system("bundle exec rspec spec/policies")
    when "serializers"
      system("bundle exec rspec spec/serializers")
    when "validators"
      system("bundle exec rspec spec/validators")
    when "mailers"
      system("bundle exec rspec spec/mailers")
    when "lib"
      system("bundle exec rspec spec/lib")
    when "all"
      system("bundle exec rspec")
    else
      puts "Unknown component: #{component}"
      puts "Available: models, controllers, services, jobs, policies, serializers, validators, mailers, lib, all"
      exit(1)
    end
  end

  desc "Show test coverage summary"
  task :summary do
    coverage_file = "coverage/.last_run.json"

    unless File.exist?(coverage_file)
      puts "No coverage data found. Run 'rake test:coverage' first."
      exit(1)
    end

    require "json"
    data = JSON.parse(File.read(coverage_file))

    puts "\n=========================================="
    puts "Test Coverage Summary"
    puts "=========================================="
    puts "Line Coverage: #{data['result']['line'].to_f.round(2)}%"
    puts "Branch Coverage: #{data['result']['branch'].to_f.round(2)}%" if data["result"]["branch"]
    puts "==========================================\n"

    if data["result"]["line"].to_f < 80
      puts "WARNING: Coverage is below 80% threshold!"
    else
      puts "Coverage meets minimum threshold (80%)"
    end
  end

  desc "Generate test coverage badge"
  task :badge do
    coverage_file = "coverage/.last_run.json"

    unless File.exist?(coverage_file)
      puts "No coverage data found. Run 'rake test:coverage' first."
      exit(1)
    end

    require "json"
    data = JSON.parse(File.read(coverage_file))
    coverage = data["result"]["line"].to_f.round(0)

    color = case coverage
    when 90..100 then "brightgreen"
    when 80..89 then "green"
    when 70..79 then "yellow"
    when 50..69 then "orange"
    else "red"
    end

    badge_url = "https://img.shields.io/badge/coverage-#{coverage}%25-#{color}"
    puts "Coverage Badge URL: #{badge_url}"
    puts "Markdown: ![Coverage](#{badge_url})"
  end
end

# Add alias tasks
desc "Run tests with coverage (alias for test:coverage)"
task coverage: "test:coverage"

desc "Run security scan (alias for test:security)"
task security: "test:security"
