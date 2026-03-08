# =============================================================================
# Shiojiri Rainbow Seeker Mobile - Test Makefile
# =============================================================================
# Docker-based test operations for the mobile app
#
# Usage: make <target>
# =============================================================================

.DEFAULT_GOAL := help

COMPOSE := docker compose -f docker-compose.test.yml

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

.PHONY: build
build: ## Build test Docker image
	$(COMPOSE) build test

# ---------------------------------------------------------------------------
# Testing
# ---------------------------------------------------------------------------

.PHONY: test
test: ## Run all tests (unit + component)
	$(COMPOSE) run --rm test

.PHONY: test-unit
test-unit: ## Run unit tests only
	$(COMPOSE) run --rm test npm run test:unit

.PHONY: test-components
test-components: ## Run component tests only
	$(COMPOSE) run --rm test npm run test:components

.PHONY: test-coverage
test-coverage: ## Run all tests with coverage
	$(COMPOSE) run --rm test npm run test:coverage

# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

.PHONY: shell
shell: ## Open shell in test container
	$(COMPOSE) run --rm test bash

.PHONY: clean
clean: ## Remove images and containers
	$(COMPOSE) down --rmi all --remove-orphans

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'
