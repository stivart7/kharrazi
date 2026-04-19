#!/usr/bin/env bash
# ============================================
# Kharrazi — Local Setup Script
# Run: bash setup.sh
# ============================================
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[setup]${NC} $1"; }
ok()  { echo -e "${GREEN}[ok]${NC} $1"; }
warn(){ echo -e "${YELLOW}[warn]${NC} $1"; }

log "Starting Kharrazi setup..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Node.js 20+ is required"; exit 1; }
command -v yarn >/dev/null 2>&1 || { echo "Yarn 1.x is required (npm install -g yarn)"; exit 1; }

NODE_VERSION=$(node -v | cut -d'.' -f1 | tr -d 'v')
if [ "$NODE_VERSION" -lt 20 ]; then
  warn "Node.js 20+ recommended, found $(node -v)"
fi

ok "Prerequisites checked"

# Setup .env
if [ ! -f ".env" ]; then
  cp .env.example .env
  ok ".env created from .env.example"
  warn "Please edit .env and set your DATABASE_URL before continuing!"
  echo ""
  read -p "Press Enter after configuring .env..."
else
  ok ".env already exists"
fi

# Install dependencies
log "Installing dependencies..."
yarn install --frozen-lockfile
ok "Dependencies installed"

# Generate Prisma client
log "Generating Prisma client..."
yarn db:generate
ok "Prisma client generated"

# Run migrations
log "Running database migrations..."
yarn db:migrate
ok "Migrations applied"

# Seed demo data
log "Seeding demo data..."
yarn db:seed
ok "Demo data seeded"

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN} Kharrazi is ready!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "  Start dev servers: yarn dev"
echo "  API:               http://localhost:4000"
echo "  Web:               http://localhost:3000"
echo ""
echo "  Login:  admin@rental.ma"
echo "  Pass:   Password123!"
echo ""
