.PHONY: help env up down logs ps smoke check test-integration

help: ## List targets
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-18s %s\n", $$1, $$2}'

env: ## Create .env from .env.example if missing
	@test -f .env || cp .env.example .env

up: env ## Build and start the stack, waiting for every healthcheck (120 s limit)
	docker compose up --build --detach --wait --wait-timeout 120

down: ## Stop the stack (keeps the database volume)
	docker compose down

logs: ## Follow logs from every service
	docker compose logs --follow --tail 100

ps: ## Show service status and health
	docker compose ps

smoke: ## Run the smoke test against the running stack
	node ci/smoke.ts

check: ## Static checks and unit tests (no database needed)
	pnpm format && pnpm lint && pnpm typecheck && pnpm knip && pnpm fr-trace && pnpm test

TEST_DB_IMAGE := postgres:19-alpine@sha256:8b0ff4cdf221f0c53d7fcda681d3b461be725c492cd881c5ec9c0ad25023f188
TEST_DB_URL := postgres://postgres:test@127.0.0.1:55432/riviera_test

test-integration: ## All tests with coverage against a throwaway Postgres on 127.0.0.1:55432
	docker rm -f riviera-testdb >/dev/null 2>&1 || true
	docker run --rm -d --name riviera-testdb -e POSTGRES_PASSWORD=test -e POSTGRES_DB=riviera_test \
		-p 127.0.0.1:55432:5432 $(TEST_DB_IMAGE) >/dev/null
	until docker exec riviera-testdb pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
	DATABASE_URL=$(TEST_DB_URL) pnpm test:coverage; status=$$?; docker rm -f riviera-testdb >/dev/null; exit $$status
