#!/usr/bin/env bash
# =============================================================
#  restore-db.sh — Khôi phục database từ 1 file backup
#
#  Cách dùng:
#    bash scripts/restore-db.sh                       # liệt kê các bản backup có sẵn
#    bash scripts/restore-db.sh backups/xxx.sql.gz     # khôi phục từ file cụ thể
#
#  ⚠️ THAO TÁC NÀY GHI ĐÈ TOÀN BỘ DATABASE HIỆN TẠI — không thể hoàn tác.
#  Luôn được hỏi xác nhận trước khi thực thi (trừ khi truyền --force).
# =============================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✔] $1${NC}"; }
info() { echo -e "${BLUE}[→] $1${NC}"; }
warn() { echo -e "${YELLOW}[!] $1${NC}"; }
err()  { echo -e "${RED}[✘] $1${NC}"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/backups}"
FORCE=false
FILE=""

for arg in "$@"; do
  if [ "$arg" = "--force" ]; then FORCE=true; else FILE="$arg"; fi
done

if [ -z "$FILE" ]; then
  echo ""
  echo "Các bản backup có sẵn trong $BACKUP_DIR:"
  echo ""
  ls -lht "$BACKUP_DIR"/*.sql.gz 2>/dev/null | awk '{print "  " $NF, "(" $5 ", " $6, $7, $8 ")"}' || echo "  (không có bản backup nào)"
  echo ""
  echo "Dùng: bash scripts/restore-db.sh <đường-dẫn-file-backup>"
  exit 0
fi

[ -f "$FILE" ] || err "Không tìm thấy file: $FILE"

ENV_FILE="gateway-api/.env"
[ -f "$ENV_FILE" ] || ENV_FILE=".env"
[ -f "$ENV_FILE" ] || err "Không tìm thấy .env (đã thử gateway-api/.env và .env)"
set -a; source "$ENV_FILE"; set +a

[ -n "${DATABASE_URL:-}" ] || err "DATABASE_URL chưa được cấu hình trong $ENV_FILE"

if [[ "$DATABASE_URL" =~ ^mysql://([^:]+):(.+)@([^:/@]+):([0-9]+)/([^?]+) ]]; then
  DB_USER="${BASH_REMATCH[1]}"
  DB_PASS="${BASH_REMATCH[2]}"
  DB_HOST="${BASH_REMATCH[3]}"
  DB_PORT="${BASH_REMATCH[4]}"
  DB_NAME="${BASH_REMATCH[5]}"
else
  err "Không parse được DATABASE_URL"
fi

echo ""
warn "SẮP GHI ĐÈ toàn bộ database '$DB_NAME' tại $DB_HOST:$DB_PORT"
warn "Nguồn khôi phục: $FILE"
warn "Toàn bộ dữ liệu hiện tại trong DB sẽ MẤT VĨNH VIỄN, thay bằng dữ liệu trong file backup này."
echo ""

if [ "$FORCE" = false ]; then
  read -rp "Gõ chính xác tên database '$DB_NAME' để xác nhận: " CONFIRM
  [ "$CONFIRM" = "$DB_NAME" ] || err "Xác nhận không khớp — đã hủy, không có gì bị thay đổi."
fi

info "Đang khôi phục... (có thể mất vài phút tùy dung lượng)"
if gunzip -c "$FILE" | MYSQL_PWD="$DB_PASS" mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$DB_NAME"; then
  log "Khôi phục thành công từ $FILE"
  warn "Nhớ: restart lại các service để chúng kết nối lại đúng trạng thái mới:"
  echo "  pm2 restart gateway-api tron-listener bsc-listener --update-env"
else
  err "Khôi phục thất bại — kiểm tra lại file backup có bị hỏng không, hoặc quyền user DB"
fi
