#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/web"

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}▸${NC} $1"; }
warn()  { echo -e "${YELLOW}▸${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

# ── Prerequisites ───────────────────────────────────────────────────────────
command -v node >/dev/null   || error "node is not installed"
command -v yarn >/dev/null   || error "yarn is not installed"
command -v docker >/dev/null || error "docker is not installed"

# ── .env setup ──────────────────────────────────────────────────────────────
if [ ! -f "$WEB/.env" ]; then
  warn ".env not found — creating from .env.example"
  cp "$WEB/.env.example" "$WEB/.env"

  # Generate a random BETTER_AUTH_SECRET
  SECRET=$(openssl rand -base64 32)
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|BETTER_AUTH_SECRET=generate-a-random-secret-here|BETTER_AUTH_SECRET=$SECRET|" "$WEB/.env"
  else
    sed -i "s|BETTER_AUTH_SECRET=generate-a-random-secret-here|BETTER_AUTH_SECRET=$SECRET|" "$WEB/.env"
  fi

  info "Generated BETTER_AUTH_SECRET"
  warn "Edit $WEB/.env to add OAuth credentials if needed"
fi

# ── Docker services (PostgreSQL + Mosquitto) ────────────────────────────────
info "Starting Docker services..."
docker compose -f "$ROOT/docker-compose.dev.yml" up -d

# Wait for postgres to be ready
info "Waiting for PostgreSQL..."
for i in {1..30}; do
  if docker exec fillaiq-postgres pg_isready -U fillaiq >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
info "PostgreSQL ready"
info "Mosquitto ready on mqtt://localhost:1883"

# ── Dependencies ────────────────────────────────────────────────────────────
info "Installing dependencies..."
cd "$WEB"
yarn install --silent 2>/dev/null || yarn install

# ── Database migrations ─────────────────────────────────────────────────────
info "Running database migrations..."
yarn db:migrate

# ── Seed database ──────────────────────────────────────────────────────────
info "Seeding database..."
yarn db:seed

# ── Start dev server ────────────────────────────────────────────────────────
info "Starting Next.js dev server on http://localhost:3000"
exec yarn dev
