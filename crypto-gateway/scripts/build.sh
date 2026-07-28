#!/usr/bin/env bash
# =============================================================
#  build.sh — Cài đặt lại & build nhanh sau khi sửa code
#  Dùng cho máy dev (KHÔNG đụng tới PM2/Nginx/production).
#  Muốn deploy lên server thật, dùng scripts/deploy.sh
#
#  Package manager: pnpm (yêu cầu cài sẵn: npm i -g pnpm)
#
#  Mặc định: LUÔN xoá node_modules + dist cũ trước khi build lại
#            (pnpm dùng global store nên cài lại vẫn nhanh, không tải lại từ mạng).
#  Cần build nhanh mà không xoá node_modules? Bật "chế độ nhanh" trong menu,
#  hoặc dùng flag --keep-modules.
#
#  Cách dùng:
#    bash scripts/build.sh                    # mở menu chọn
#    bash scripts/build.sh api                # chỉ build gateway-api
#    bash scripts/build.sh listener           # chỉ build tron-listener (TRON/TRC20)
#    bash scripts/build.sh bsc                # chỉ build bsc-listener (BSC/BEP20)
#    bash scripts/build.sh web                # chỉ build admin-web
#    bash scripts/build.sh all                # build tất cả
#    bash scripts/build.sh all --keep-modules # build nhanh, giữ nguyên node_modules
# =============================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✔] $1${NC}"; }
info() { echo -e "${BLUE}[→] $1${NC}"; }
warn() { echo -e "${YELLOW}[!] $1${NC}"; }
err()  { echo -e "${RED}[✘] $1${NC}"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

# ── Kiểm tra pnpm ────────────────────────────────────────────
if ! command -v pnpm &>/dev/null; then
  warn "pnpm chưa được cài đặt."
  if command -v corepack &>/dev/null; then
    info "Kích hoạt pnpm qua corepack..."
    corepack enable
    corepack prepare pnpm@9.15.0 --activate
  else
    info "Cài pnpm qua npm..."
    npm install -g pnpm
  fi
fi
log "pnpm $(pnpm -v) sẵn sàng"

KEEP_MODULES=false

# Luôn dọn dist/ (rẻ, tránh rác build cũ còn sót lại)
clean_dist() {
  local dir="$1"
  if [ -d "$dir/dist" ]; then
    info "Xoá $dir/dist cũ..."
    rm -rf "$dir/dist"
  fi
}

# Mặc định LUÔN xoá node_modules (pnpm dùng global store nên cài lại vẫn nhanh).
# Bật KEEP_MODULES = true để bỏ qua bước này khi cần build gấp.
clean_node_modules() {
  local dir="$1"
  if [ "$KEEP_MODULES" = false ] && [ -d "$dir/node_modules" ]; then
    info "Xoá $dir/node_modules..."
    rm -rf "$dir/node_modules"
  fi
}

build_api() {
  echo ""
  echo "── gateway-api ───────────────────────────"
  clean_node_modules gateway-api
  clean_dist gateway-api
  cd gateway-api

  info "Cài dependencies (pnpm install)..."
  pnpm install

  info "Sinh Prisma Client..."
  pnpm exec prisma generate

  info "Build TypeScript..."
  pnpm run build

  cd "$SCRIPT_DIR"
  log "gateway-api build xong"
}

build_listener() {
  echo ""
  echo "── tron-listener ─────────────────────────"
  clean_node_modules tron-listener
  clean_dist tron-listener
  cd tron-listener

  info "Cài dependencies (pnpm install)..."
  pnpm install

  info "Sinh Prisma Client..."
  pnpm exec prisma generate

  info "Build TypeScript..."
  pnpm run build

  cd "$SCRIPT_DIR"
  log "tron-listener build xong"
}

build_bsc() {
  echo ""
  echo "── bsc-listener ──────────────────────────"
  clean_node_modules bsc-listener
  clean_dist bsc-listener
  cd bsc-listener

  info "Cài dependencies (pnpm install)..."
  pnpm install

  info "Sinh Prisma Client..."
  pnpm exec prisma generate

  info "Build TypeScript..."
  pnpm run build

  cd "$SCRIPT_DIR"
  log "bsc-listener build xong"
}

build_web() {
  echo ""
  echo "── admin-web ─────────────────────────────"
  clean_node_modules admin-web
  clean_dist admin-web
  cd admin-web

  info "Cài dependencies (pnpm install)..."
  pnpm install

  info "Build (tsc + vite build)..."
  pnpm run build

  cd "$SCRIPT_DIR"
  log "admin-web build xong (output: admin-web/dist)"
}

# Chạy 1 target (api|listener|web|all) và in tổng kết thời gian
run_target() {
  local target="$1"
  local start
  start=$(date +%s)

  echo ""
  echo "╔═══════════════════════════════════════════╗"
  echo "║   Build lại dự án — Crypto Payment Gateway ║"
  echo "╚═══════════════════════════════════════════╝"
  if [ "$KEEP_MODULES" = true ]; then
    warn "Chế độ nhanh: giữ nguyên node_modules (dist vẫn được xoá mặc định)"
  else
    info "Sẽ xoá node_modules + dist trước khi cài lại (mặc định)"
  fi

  case "$target" in
    api)      build_api ;;
    listener) build_listener ;;
    bsc)      build_bsc ;;
    web)      build_web ;;
    all)
      build_api
      build_listener
      build_bsc
      build_web
      ;;
    *)
      err "Target không hợp lệ: '$target'. Dùng: api | listener | bsc | web | all"
      ;;
  esac

  local elapsed=$(( $(date +%s) - start ))
  echo ""
  log "Hoàn tất trong ${elapsed}s"
  echo ""
  info "Service đang chạy bằng PM2? Nhớ restart:  pm2 restart all --update-env"
  info "Chạy dev thường ngày, dùng thay:          bash scripts/dev.sh"
}

show_menu() {
  while true; do
    echo ""
    echo "╔═══════════════════════════════════════════╗"
    echo "║   Build lại dự án — Crypto Payment Gateway ║"
    echo "╚═══════════════════════════════════════════╝"
    echo -e "  ${CYAN}1)${NC} Build tất cả (api + listener + bsc + web)"
    echo -e "  ${CYAN}2)${NC} Build gateway-api"
    echo -e "  ${CYAN}3)${NC} Build tron-listener (TRON/TRC20)"
    echo -e "  ${CYAN}4)${NC} Build bsc-listener (BSC/BEP20)"
    echo -e "  ${CYAN}5)${NC} Build admin-web"
    echo -e "  ${CYAN}6)${NC} Bật/tắt chế độ nhanh (giữ node_modules, không xoá trước khi build)"
    echo -e "     Chế độ nhanh hiện tại: $([ "$KEEP_MODULES" = true ] && echo -e "${GREEN}BẬT${NC}" || echo -e "${YELLOW}TẮT (mặc định: luôn xoá node_modules)${NC}")"
    echo -e "  ${CYAN}0)${NC} Thoát"
    echo ""
    read -rp "Chọn một mục [0-6]: " choice

    case "$choice" in
      1) run_target all; break ;;
      2) run_target api; break ;;
      3) run_target listener; break ;;
      4) run_target bsc; break ;;
      5) run_target web; break ;;
      6)
        if [ "$KEEP_MODULES" = true ]; then KEEP_MODULES=false; warn "Đã tắt chế độ nhanh — sẽ xoá node_modules khi build"; else KEEP_MODULES=true; warn "Đã bật chế độ nhanh — giữ nguyên node_modules"; fi
        ;;
      0) echo "Thoát."; exit 0 ;;
      *) warn "Lựa chọn không hợp lệ, thử lại." ;;
    esac
  done
}

# ── Entry point ────────────────────────────────────────────────
TARGET="${1:-}"
[ "${2:-}" = "--keep-modules" ] && KEEP_MODULES=true
[ "${1:-}" = "--keep-modules" ] && { TARGET="all"; KEEP_MODULES=true; }

if [ -z "$TARGET" ]; then
  show_menu
else
  run_target "$TARGET"
fi
