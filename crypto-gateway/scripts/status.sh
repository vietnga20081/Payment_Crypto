#!/usr/bin/env bash
# =============================================================
#  status.sh — Kiểm tra trạng thái toàn bộ hệ thống
# =============================================================

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}[✔] $1${NC}"; }
fail() { echo -e "  ${RED}[✘] $1${NC}"; }
warn() { echo -e "  ${YELLOW}[!] $1${NC}"; }

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   System Status                      ║"
echo "╚══════════════════════════════════════╝"
echo ""

# PM2 processes
echo "── PM2 Services ─────────────────────────"
pm2 status
echo ""

# MySQL
echo "── MySQL ─────────────────────────────────"
if systemctl is-active --quiet mysql 2>/dev/null || systemctl is-active --quiet mysqld 2>/dev/null; then
  ok "MySQL running"
else
  fail "MySQL not running"
fi

# Redis
echo "── Redis ─────────────────────────────────"
if command -v redis-cli &>/dev/null && redis-cli ping 2>/dev/null | grep -q "PONG"; then
  ok "Redis running"
else
  fail "Redis not running or not installed"
fi

# Nginx
echo "── Nginx ─────────────────────────────────"
if systemctl is-active --quiet nginx; then
  ok "Nginx running"
else
  fail "Nginx not running"
fi

# API health check
echo "── API Health ────────────────────────────"
if curl -sf http://127.0.0.1:3007/health >/dev/null 2>&1; then
  RESP=$(curl -s http://127.0.0.1:3007/health)
  ok "API responding: $RESP"
else
  fail "API not responding at :3007"
fi

# Disk & Memory
echo ""
echo "── Resources ─────────────────────────────"
echo "  Memory: $(free -h | awk '/^Mem:/ {print $3 " used / " $2 " total"}')"
echo "  Disk:   $(df -h / | awk 'NR==2 {print $3 " used / " $2 " total (" $5 ")"}')"
echo ""
