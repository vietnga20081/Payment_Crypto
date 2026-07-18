#!/usr/bin/env bash
# =============================================================
#  logs.sh — Xem logs của services
#  Usage: ./scripts/logs.sh [api|listener|bsc|all]
# =============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-all}"

case "$TARGET" in
  api)      pm2 logs gateway-api --lines 100 ;;
  listener) pm2 logs tron-listener --lines 100 ;;
  bsc)      pm2 logs bsc-listener --lines 100 ;;
  all)      pm2 logs --lines 50 ;;
  *)
    echo "Usage: $0 [api|listener|bsc|all]"
    exit 1
    ;;
esac
