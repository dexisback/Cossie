# Cossie — Makefile
# Thin wrapper around existing pnpm scripts. Run `make help` for the full list.

# ---------- Configuration ----------
SHELL := /bin/bash
.DEFAULT_GOAL := help
.PHONY: help

# ANSI colors for the help banner
GREEN  := \033[0;32m
CYAN   := \033[0;36m
YELLOW := \033[0;33m
RESET  := \033[0m

# ---------- Help ----------
help: ## Show this help message
	@printf "$(CYAN)Cossie$(RESET) — available targets\n\n"
	@printf "$(YELLOW)Development$(RESET)\n"
	@grep -E '^(install|dev|backend|frontend):.*?##' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-12s$(RESET) %s\n", $$1, $$2}'
	@printf "\n$(YELLOW)Build$(RESET)\n"
	@grep -E '^(build|clean):.*?##' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-12s$(RESET) %s\n", $$1, $$2}'
	@printf "\n$(YELLOW)Database$(RESET)\n"
	@grep -E '^(prisma|migrate|seed):.*?##' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-12s$(RESET) %s\n", $$1, $$2}'
	@printf "\n$(YELLOW)Testing$(RESET)\n"
	@grep -E '^test:.*?##' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-12s$(RESET) %s\n", $$1, $$2}'
	@printf "\n$(YELLOW)Docker$(RESET)\n"
	@grep -E '^docker.*:.*?##' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-12s$(RESET) %s\n", $$1, $$2}'
	@printf "\n$(YELLOW)Quality$(RESET)\n"
	@grep -E '^lint:.*?##' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-12s$(RESET) %s\n", $$1, $$2}'
	@printf "\n"

# ---------- Development ----------
install: ## Install all workspace dependencies
	pnpm install --frozen-lockfile

dev: ## Start backend + dashboard in parallel
	pnpm dev

backend: ## Start only the agent backend
	pnpm dev:agent

frontend: ## Start only the dashboard
	pnpm dev:dashboard

# ---------- Build ----------
build: ## Build the entire monorepo
	pnpm build

clean: ## Remove generated build artifacts
	rm -rf apps/*/dist apps/*/.next packages/*/dist generated
	find . -type d -name coverage -not -path '*/node_modules/*' -prune -exec rm -rf {} +

# ---------- Database ----------
prisma: ## Generate the Prisma client
	pnpm prisma:generate

migrate: ## Run Prisma migrations
	pnpm prisma:migrate

seed: ## Seed the database
	pnpm seed

# ---------- Testing ----------
test: ## Run the full test suite
	pnpm test

# ---------- Docker ----------
docker: ## Build and start the Docker Compose stack
	docker compose up --build

docker-build: ## Build Docker images only
	docker compose build

docker-down: ## Stop all Docker containers
	docker compose down

docker-logs: ## Follow Docker logs
	docker compose logs -f

# ---------- Quality ----------
lint: ## Run linting across the workspace
	pnpm lint
