# =============================================================================
# Shiojiri Rainbow Seeker Backend - Development Makefile
# =============================================================================
# Common development operations for Docker-based workflow
#
# Usage: make <target>
# =============================================================================

.DEFAULT_GOAL := help

# ---------------------------------------------------------------------------
# Setup & Lifecycle
# ---------------------------------------------------------------------------

.PHONY: setup
setup: ## Initial setup: build images + create/migrate DB + seed
	docker compose build api
	docker compose up -d db
	docker compose up -d api
	docker compose exec api bin/rails db:prepare
	docker compose exec api bin/rails db:seed

.PHONY: up
up: ## Start db + api (detached)
	docker compose up -d

.PHONY: down
down: ## Stop all services
	docker compose down

.PHONY: restart
restart: ## Restart API container
	docker compose restart api

.PHONY: clean
clean: ## Stop all services and remove volumes
	docker compose --profile monitoring --profile test down -v

# ---------------------------------------------------------------------------
# Logs & Status
# ---------------------------------------------------------------------------

.PHONY: logs
logs: ## Follow API logs
	docker compose logs -f api

.PHONY: status
status: ## Show service status
	docker compose ps -a

# ---------------------------------------------------------------------------
# Rails Commands
# ---------------------------------------------------------------------------

.PHONY: console
console: ## Open Rails console
	docker compose exec api bin/rails console

.PHONY: shell
shell: ## Open bash shell in API container
	docker compose exec api bash

.PHONY: db-setup
db-setup: ## Create + migrate + seed databases
	docker compose exec api bin/rails db:prepare
	docker compose exec api bin/rails db:seed

.PHONY: db-migrate
db-migrate: ## Run pending migrations
	docker compose exec api bin/rails db:migrate

.PHONY: db-reset
db-reset: ## Drop + recreate + migrate + seed databases
	docker compose exec api bin/rails db:reset

# ---------------------------------------------------------------------------
# Testing & Linting
# ---------------------------------------------------------------------------

.PHONY: test
test: ## Run RSpec tests via test profile
	docker compose run --rm test

.PHONY: lint
lint: ## Run RuboCop linter
	docker compose exec api bundle exec rubocop

# ---------------------------------------------------------------------------
# Monitoring (optional profile)
# ---------------------------------------------------------------------------

.PHONY: monitoring
monitoring: ## Start InfluxDB + Grafana
	docker compose --profile monitoring up -d

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'
