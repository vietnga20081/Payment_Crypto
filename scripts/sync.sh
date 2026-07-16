#!/usr/bin/env bash
# =============================================================
#  sync.sh — Gộp git add + commit + push thành 1 lệnh
#
#  Cách dùng:
#    bash scripts/sync.sh                    # dùng message tự động (kèm ngày giờ)
#    bash scripts/sync.sh "sửa lỗi export key"   # tự đặt message
# =============================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✔] $1${NC}"; }
info() { echo -e "${BLUE}[→] $1${NC}"; }
warn() { echo -e "${YELLOW}[!] $1${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

MSG="${1:-Update $(date '+%Y-%m-%d %H:%M')}"

if [ -z "$(git status --porcelain)" ]; then
  warn "Không có gì thay đổi để đồng bộ."
  exit 0
fi

info "Các file thay đổi:"
git status --short

info "Đang commit + push..."
git add .
git commit -m "$MSG"
git push

log "Đã đồng bộ lên GitHub — commit: \"$MSG\""
