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

# ── PostgreSQL ──────────────────────────────────────────────────────────────
if ! docker ps --format '{{.Names}}' | grep -q fillaiq-postgres; then
  info "Starting PostgreSQL..."
  docker run -d \
    --name fillaiq-postgres \
    -e POSTGRES_USER=fillaiq \
    -e POSTGRES_PASSWORD=fillaiq \
    -e POSTGRES_DB=fillaiq \
    -p 5432:5432 \
    -v fillaiq-pgdata:/var/lib/postgresql/data \
    postgres:17 \
    >/dev/null

  # Wait for postgres to be ready
  for i in {1..30}; do
    if docker exec fillaiq-postgres pg_isready -U fillaiq >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  info "PostgreSQL ready"
else
  info "PostgreSQL already running"
fi

# Update DATABASE_URL in .env to match the container
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' 's|^DATABASE_URL=.*|DATABASE_URL=postgresql://fillaiq:fillaiq@localhost:5432/fillaiq?sslmode=disable|' "$WEB/.env"
else
  sed -i 's|^DATABASE_URL=.*|DATABASE_URL=postgresql://fillaiq:fillaiq@localhost:5432/fillaiq?sslmode=disable|' "$WEB/.env"
fi

# ── Dependencies ────────────────────────────────────────────────────────────
info "Installing dependencies..."
cd "$WEB"
yarn install --silent 2>/dev/null || yarn install

# ── Database migrations ─────────────────────────────────────────────────────
info "Running database migrations..."
yarn db:migrate

# ── Start dev server ────────────────────────────────────────────────────────
info "Starting Next.js dev server on http://localhost:3000"
exec yarn dev
