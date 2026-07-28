#!/usr/bin/env bash
# =============================================================
#  backup-db.sh — Backup MySQL tự động, có xoay vòng (rotation)
#
#  Cách dùng:
#    bash scripts/backup-db.sh              # backup ngay, dùng cấu hình mặc định
#
#  Chạy định kỳ bằng cron (khuyến khích 1 lần/ngày):
#    0 2 * * * cd /www/wwwroot/payment.v3vn.eu && bash scripts/backup-db.sh >> logs/backup.log 2>&1
#
#  Biến môi trường tùy chỉnh (đặt trong .env hoặc export trước khi chạy):
#    BACKUP_DIR             Thư mục lưu backup (mặc định: ./backups)
#    BACKUP_RETENTION_DAYS  Số ngày giữ lại backup cũ (mặc định: 14)
#    BACKUP_REMOTE          Đích đồng bộ ra ngoài server, dạng rsync
#                           (vd: user@backup-host:/path/) — để trống = chỉ lưu local
#
#  ⚠️ QUAN TRỌNG: Script này CHỈ backup database. KHÔNG backup:
#    - File .env (chứa DATABASE_URL, JWT secret, WALLET_ENCRYPTION_KEY...)
#    - WALLET_ENCRYPTION_KEY — nếu mất key này, backup DB vô dụng vì không
#      giải mã được private key ví nào cả.
#  Xem RUNBOOK.md để biết cách backup an toàn 2 thứ này (backup RIÊNG, KHÔNG
#  để chung 1 chỗ với backup DB — mất 1 chỗ vẫn còn chỗ kia).
# =============================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✔] $(date '+%Y-%m-%d %H:%M:%S') $1${NC}"; }
info() { echo -e "${BLUE}[→] $(date '+%Y-%m-%d %H:%M:%S') $1${NC}"; }
warn() { echo -e "${YELLOW}[!] $(date '+%Y-%m-%d %H:%M:%S') $1${NC}"; }
err()  { echo -e "${RED}[✘] $(date '+%Y-%m-%d %H:%M:%S') $1${NC}"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

# ── Nạp cấu hình từ .env của gateway-api (nơi DATABASE_URL thật nằm) ────────
ENV_FILE="gateway-api/.env"
[ -f "$ENV_FILE" ] || ENV_FILE=".env"
[ -f "$ENV_FILE" ] || err "Không tìm thấy .env (đã thử gateway-api/.env và .env)"
set -a; source "$ENV_FILE"; set +a

[ -n "${DATABASE_URL:-}" ] || err "DATABASE_URL chưa được cấu hình trong $ENV_FILE"

# Parse mysql://user:pass@host:port/dbname từ DATABASE_URL
if [[ "$DATABASE_URL" =~ ^mysql://([^:]+):(.+)@([^:/@]+):([0-9]+)/([^?]+) ]]; then
  DB_USER="${BASH_REMATCH[1]}"
  DB_PASS="${BASH_REMATCH[2]}"
  DB_HOST="${BASH_REMATCH[3]}"
  DB_PORT="${BASH_REMATCH[4]}"
  DB_NAME="${BASH_REMATCH[5]}"
else
  err "Không parse được DATABASE_URL — kiểm tra lại định dạng (mysql://user:pass@host:port/dbname)"
fi

BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
FILENAME="${DB_NAME}_${TIMESTAMP}.sql.gz"
FILEPATH="$BACKUP_DIR/$FILENAME"

info "Backup database '$DB_NAME' từ $DB_HOST:$DB_PORT..."

# --single-transaction: backup nhất quán cho InnoDB mà KHÔNG khóa bảng
# (quan trọng — hệ thống đang xử lý tiền real-time, không được phép khóa bảng
# giữa giờ hành chính). --routines --triggers: backup luôn stored procedure/trigger nếu có.
if MYSQL_PWD="$DB_PASS" mysqldump \
    -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" \
    --single-transaction --routines --triggers --set-gtid-purged=OFF \
    "$DB_NAME" | gzip > "$FILEPATH"; then
  SIZE=$(du -h "$FILEPATH" | cut -f1)
  log "Backup thành công: $FILENAME ($SIZE)"
else
  rm -f "$FILEPATH"
  err "Backup thất bại — kiểm tra kết nối DB / quyền user"
fi

# ── Đồng bộ ra ngoài server (khuyến khích mạnh — backup chỉ nằm trên cùng
#    VPS thì mất VPS là mất luôn cả backup) ─────────────────────────────────
if [ -n "${BACKUP_REMOTE:-}" ]; then
  info "Đồng bộ backup ra: $BACKUP_REMOTE"
  if rsync -az "$FILEPATH" "$BACKUP_REMOTE"; then
    log "Đã đồng bộ ra ngoài server"
  else
    warn "Đồng bộ ra ngoài server thất bại — backup vẫn còn ở local ($FILEPATH), kiểm tra lại kết nối/SSH key"
  fi
else
  warn "BACKUP_REMOTE chưa cấu hình — backup CHỈ nằm trên VPS này. Mất VPS = mất backup. Xem RUNBOOK.md mục 'Đồng bộ ra ngoài server'."
fi

# ── Xoay vòng: xóa backup cũ hơn RETENTION_DAYS ─────────────────────────────
DELETED=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime "+$RETENTION_DAYS" -print -delete | wc -l)
[ "$DELETED" -gt 0 ] && info "Đã xóa $DELETED backup cũ hơn $RETENTION_DAYS ngày"

TOTAL=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" | wc -l)
log "Hoàn tất — hiện có $TOTAL bản backup trong $BACKUP_DIR"
