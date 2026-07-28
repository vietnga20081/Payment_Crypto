#!/usr/bin/env bash
# deploy.sh — Rebuild & reload sau khi sửa code
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✔] $1${NC}"; }
info() { echo -e "${BLUE}[→] $1${NC}"; }
warn() { echo -e "${YELLOW}[!] $1${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

if ! command -v pnpm &>/dev/null; then
  warn "pnpm chưa cài — cài qua corepack..."
  corepack enable && corepack prepare pnpm@9.15.0 --activate
fi

TARGET="${1:-all}"

# pm2 restart chỉ hoạt động nếu process đã từng được `pm2 start` ít nhất 1 lần.
# Service mới (như bsc-listener) chưa có trong danh sách PM2 sẽ báo lỗi và
# (do set -e) làm cả script dừng giữa chừng — bỏ qua luôn các bước sau (vd: build web).
# Hàm này tự phát hiện và start lần đầu qua ecosystem.config.js nếu cần.
pm2_restart_or_start() {
  local name="$1"
  if pm2 describe "$name" &>/dev/null; then
    pm2 restart "$name" --update-env
  else
    warn "'$name' chưa có trong PM2 — start lần đầu qua ecosystem.config.js..."
    pm2 start ecosystem.config.js --only "$name"
  fi
}

# Đảm bảo mỗi service backend có file .env riêng (copy từ .env gốc nếu thiếu).
# Cần thiết cho service mới thêm sau này (như bsc-listener) chưa từng qua install.sh.
ensure_env() {
  local dir="$1"
  if [ ! -f "$dir/.env" ]; then
    warn "$dir/.env chưa có — copy từ .env gốc..."
    cp .env "$dir/.env"
  fi
}

rebuild_api() {
  info "Build gateway-api..."
  ensure_env gateway-api
  cd gateway-api
  rm -rf node_modules dist
  pnpm install
  pnpm exec prisma generate
  pnpm run build
  cd ..
  pm2_restart_or_start gateway-api
  log "gateway-api restarted"
}

rebuild_listener() {
  info "Build tron-listener..."
  ensure_env tron-listener
  cd tron-listener
  rm -rf node_modules dist
  pnpm install
  pnpm exec prisma generate
  pnpm run build
  cd ..
  pm2_restart_or_start tron-listener
  log "tron-listener restarted"
}

rebuild_bsc() {
  info "Build bsc-listener..."
  ensure_env bsc-listener
  cd bsc-listener
  rm -rf node_modules dist
  pnpm install
  pnpm exec prisma generate
  pnpm run build
  cd ..
  pm2_restart_or_start bsc-listener
  log "bsc-listener restarted"
}

rebuild_web() {
  info "Build admin-web..."
  cd admin-web
  rm -rf node_modules dist
  pnpm install
  pnpm run build
  cd ..

  # Detect webroot (aaPanel hoặc standard)
  if echo "$SCRIPT_DIR" | grep -q "^/www/wwwroot/"; then
    DOMAIN=$(echo "$SCRIPT_DIR" | sed 's|^/www/wwwroot/||' | cut -d'/' -f1)
    WEBROOT="/www/wwwroot/${DOMAIN}/public"
  else
    WEBROOT="/var/www/crypto-gateway"
  fi

  sudo mkdir -p "$WEBROOT"
  sudo cp -r admin-web/dist/. "$WEBROOT/"
  log "Frontend deployed to $WEBROOT"

  # Reload nginx nếu có quyền và không phải aaPanel quản lý
  if command -v nginx &>/dev/null && [ ! -d "/www/server/panel" ]; then
    sudo nginx -t && sudo systemctl reload nginx && log "Nginx reloaded"
  else
    warn "Nginx do aaPanel quản lý — vào aaPanel reload nếu cần"
  fi
}

case "$TARGET" in
  api)      rebuild_api ;;
  listener) rebuild_listener ;;
  bsc)      rebuild_bsc ;;
  web)      rebuild_web ;;
  all)
    rebuild_api
    rebuild_listener
    rebuild_bsc
    rebuild_web
    ;;
  *)
    echo "Usage: $0 [api|listener|bsc|web|all]"
    exit 1
    ;;
esac

echo ""
pm2 status
echo ""
log "Deploy xong — $(date '+%Y-%m-%d %H:%M:%S')"
