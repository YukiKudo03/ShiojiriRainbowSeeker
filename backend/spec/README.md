# Backend Test Suite

This document describes the test structure, coverage tools, and how to run tests for the Shiojiri Rainbow Seeker backend.

## Test Structure

```
spec/
├── controllers/          # Controller concern specs
│   └── concerns/
├── factories/            # FactoryBot factory definitions
├── fixtures/             # Test fixtures
│   └── files/           # Test image files
├── initializers/         # Initializer specs
├── jobs/                 # Background job specs
├── lib/                  # Library specs
│   └── external_apis/   # External API client specs
├── mailers/              # Mailer specs
├── models/               # Model specs
├── policies/             # Pundit policy specs
├── requests/             # Request/integration specs
│   └── api/v1/          # API endpoint specs
│       └── admin/       # Admin API endpoint specs
├── serializers/          # Alba serializer specs
├── services/             # Service object specs
├── support/              # Test helpers and configuration
│   ├── api_helpers.rb   # API testing helpers
│   ├── devise.rb        # Devise test configuration
│   ├── factory_bot.rb   # FactoryBot configuration
│   ├── json_helpers.rb  # JSON response helpers
│   └── shoulda_matchers.rb # Shoulda-Matchers config
├── validators/           # Custom validator specs
├── rails_helper.rb       # Rails test configuration
└── spec_helper.rb        # RSpec configuration (with SimpleCov)
```

## Running Tests

### Basic Test Commands

```bash
# Run all tests
bundle exec rspec

# Run specific spec file
bundle exec rspec spec/models/user_spec.rb

# Run specific example
bundle exec rspec spec/models/user_spec.rb:10

# Run with documentation format
bundle exec rspec --format documentation

# Run failing tests first
bundle exec rspec --order defined
```

### Coverage Analysis

```bash
# Run tests with code coverage
COVERAGE=true bundle exec rspec

# Or use the rake task
bundle exec rake test:coverage

# View coverage report
open coverage/index.html
```

### Security Scanning

```bash
# Run Brakeman security scan
bundle exec brakeman

# Or use the rake task
bundle exec rake test:security

# View security report
open tmp/brakeman_report.html
```

### Full Test Suite

```bash
# Run full test suite with coverage and security
bundle exec rake test:full
```

### Component-Specific Tests

```bash
# Run model specs
bundle exec rake test:component[models]

# Run request/controller specs
bundle exec rake test:component[controllers]

# Run service specs
bundle exec rake test:component[services]

# Run job specs
bundle exec rake test:component[jobs]

# Run policy specs
bundle exec rake test:component[policies]

# Run all components
bundle exec rake test:component[all]
```

## Test Coverage

### Configuration

SimpleCov is configured in `spec/spec_helper.rb` with:
- Minimum overall coverage: 80%
- Minimum per-file coverage: 50%
- Branch coverage enabled
- Coverage grouped by component type

### Viewing Coverage

After running tests with coverage enabled, open `coverage/index.html` in a browser to view:
- Overall coverage percentage
- Coverage by component group
- Per-file coverage details
- Uncovered lines highlighted

### Coverage Summary

```bash
# Show coverage summary
bundle exec rake test:summary

# Generate coverage badge URL
bundle exec rake test:badge
```

## Security Scanning

### Brakeman Configuration

Brakeman is configured via `.brakeman.yml` with:
- Minimum confidence level: Medium (1)
- Exit on warnings enabled
- HTML and JSON reports generated

### Handling False Positives

If Brakeman reports false positives, add them to `.brakeman.ignore`:

```bash
# Generate ignore file interactively
bundle exec brakeman -I
```

## Test Helpers

### API Helpers

The `spec/support/api_helpers.rb` module provides:

```ruby
# JSON headers
json_headers

# Auth headers with JWT token
auth_headers(user)

# API path builder
api_v1_path("/photos") # => "/api/v1/photos"

# Request helpers
get_api("/photos", params: { page: 1 })
post_api("/photos", params: { title: "Rainbow" })
get_api_as(user, "/photos")  # Authenticated request
post_api_as(user, "/photos", params: data)

# Response helpers
json_body         # Parsed JSON response
response_data     # response[:data]
response_error    # response[:error]
response_meta     # response[:meta]

# Assertion helpers
expect_success_response(status: :ok)
expect_error_response(status: :not_found, code: "NOT_FOUND")
expect_paginated_response
expect_unauthorized_response
expect_forbidden_response
```

### Factory Helpers

```ruby
# Create user with photo
user, photo = create_user_with_photo

# Create user with multiple photos
user, photos = create_user_with_photos(count: 5)

# Create photo with engagement
photo, comments, likes = create_photo_with_engagement(comment_count: 3, like_count: 5)

# Create admin user
admin = create_admin_user

# Create reported content
photo, reports = create_reported_photo(report_count: 2)
```

## Writing Tests

### Model Specs

```ruby
RSpec.describe Photo, type: :model do
  describe "associations" do
    it { is_expected.to belong_to(:user) }
    it { is_expected.to have_many(:comments) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:captured_at) }
    it { is_expected.to validate_length_of(:title).is_at_most(100) }
  end

  describe "scopes" do
    describe ".visible" do
      it "returns only visible photos" do
        # ...
      end
    end
  end
end
```

### Request Specs

```ruby
RSpec.describe "Api::V1::Photos", type: :request do
  describe "GET /api/v1/photos" do
    context "when authenticated" do
      let(:user) { create(:user) }

      it "returns photos" do
        get_api_as(user, "/photos")
        expect_success_response
        expect(response_data[:photos]).to be_an(Array)
      end
    end

    context "when unauthenticated" do
      it "returns unauthorized" do
        get_api("/photos")
        expect_unauthorized_response
      end
    end
  end
end
```

### Service Specs

```ruby
RSpec.describe PhotoService do
  let(:service) { described_class.new }

  describe "#create" do
    context "with valid params" do
      it "creates a photo" do
        result = service.create(valid_params)
        expect(result[:success]).to be true
      end
    end
  end
end
```

## CI/CD Integration

For GitHub Actions or other CI systems:

```yaml
- name: Run tests with coverage
  env:
    COVERAGE: true
    RAILS_ENV: test
  run: bundle exec rspec

- name: Run security scan
  run: bundle exec brakeman -o tmp/brakeman_report.json --no-pager --exit-on-warn
```

## Troubleshooting

### Database Issues

```bash
# Create test database
RAILS_ENV=test bin/rails db:create

# Run migrations
RAILS_ENV=test bin/rails db:migrate

# Reset test database
RAILS_ENV=test bin/rails db:reset
```

### Slow Tests

```bash
# Profile slow tests
bundle exec rspec --profile 10

# Run tests in parallel (requires parallel_tests gem)
bundle exec parallel_rspec spec/
```

### Debugging

```ruby
# Add to spec for debugging
require 'debug'
debugger

# Or use pry
require 'pry'
binding.pry
```
