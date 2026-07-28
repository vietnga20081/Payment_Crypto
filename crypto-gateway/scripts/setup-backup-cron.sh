#!/usr/bin/env bash
# =============================================================
#  setup-backup-cron.sh — Cài cron job backup DB tự động hàng ngày
#
#  Cách dùng:
#    bash scripts/setup-backup-cron.sh          # backup lúc 2h sáng mỗi ngày (mặc định)
#    bash scripts/setup-backup-cron.sh "0 */6 * * *"   # tùy chỉnh lịch (mỗi 6 tiếng)
#
#  An toàn chạy nhiều lần — tự kiểm tra đã có cron entry chưa, không thêm trùng.
# =============================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✔] $1${NC}"; }
warn() { echo -e "${YELLOW}[!] $1${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEDULE="${1:-0 2 * * *}"
CRON_CMD="cd $SCRIPT_DIR && bash scripts/backup-db.sh >> logs/backup.log 2>&1"
CRON_LINE="$SCHEDULE $CRON_CMD"

mkdir -p "$SCRIPT_DIR/logs"

if crontab -l 2>/dev/null | grep -qF "backup-db.sh"; then
  warn "Đã có cron job backup-db.sh trong crontab — bỏ qua (xóa dòng cũ trong 'crontab -e' nếu muốn đổi lịch)."
  echo ""
  echo "Cron hiện tại liên quan tới backup:"
  crontab -l 2>/dev/null | grep "backup-db.sh"
  exit 0
fi

(crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -

log "Đã cài cron job: chạy '$SCHEDULE' (giờ server)"
echo "  $CRON_LINE"
echo ""
echo "Xem log backup: tail -f $SCRIPT_DIR/logs/backup.log"
echo "Xem/sửa cron:   crontab -e"
