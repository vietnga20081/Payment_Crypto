#!/usr/bin/env bash
# =============================================================
#  setup-db.sh — Tạo MySQL database + user
#  Chạy: sudo bash scripts/setup-db.sh
# =============================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✔] $1${NC}"; }
info() { echo -e "${BLUE}[i] $1${NC}"; }
warn() { echo -e "${YELLOW}[!] $1${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

# Load .env nếu có
if [ -f ".env" ]; then source .env; fi

DB_NAME="${DB_NAME:-crypto_gateway}"
DB_USER="${DB_USER:-cgw_user}"
DB_PASS="${DB_PASS:-cgwpassword}"
MYSQL_ROOT_PASS="${MYSQL_ROOT_PASS:-}"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   MySQL Database Setup               ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Cài MySQL nếu chưa có
if ! command -v mysql &>/dev/null; then
  info "Cài MySQL Server..."
  sudo apt-get update -qq
  sudo apt-get install -y mysql-server
  sudo systemctl enable mysql
  sudo systemctl start mysql
fi
log "MySQL đang chạy"

# Tạo DB + User
info "Tạo database và user..."

if [ -z "$MYSQL_ROOT_PASS" ]; then
  warn "Nhập MySQL root password (để trống nếu chưa đặt):"
  read -s MYSQL_ROOT_PASS
fi

MYSQL_CMD="mysql -u root"
[ -n "$MYSQL_ROOT_PASS" ] && MYSQL_CMD="mysql -u root -p${MYSQL_ROOT_PASS}"

$MYSQL_CMD <<EOF
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
EOF

log "Database '${DB_NAME}' và user '${DB_USER}' đã tạo"

echo ""
echo "  DATABASE_URL đề xuất:"
echo ""
echo "  DATABASE_URL=\"mysql://${DB_USER}:${DB_PASS}@127.0.0.1:3306/${DB_NAME}\""
echo ""
warn "Cập nhật DATABASE_URL trong file .env!"
