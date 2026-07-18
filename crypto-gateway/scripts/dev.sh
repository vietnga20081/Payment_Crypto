#!/usr/bin/env bash
# =============================================================
#  dev.sh — Chạy tất cả services ở chế độ development
#  Mỗi service chạy trong tab tmux hoặc background
# =============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

# Copy root .env vào từng service nếu chưa có
for svc in gateway-api tron-listener bsc-listener; do
  if [ ! -f "$svc/.env" ] && [ -f ".env" ]; then
    cp .env "$svc/.env"
    echo -e "${YELLOW}[!] Đã copy .env → $svc/.env${NC}"
  fi
done

# Dùng tmux nếu có, nếu không thì chạy background
if command -v tmux &>/dev/null; then
  SESSION="cgw-dev"
  tmux kill-session -t "$SESSION" 2>/dev/null || true
  tmux new-session -d -s "$SESSION" -x 220 -y 50

  tmux rename-window -t "$SESSION:0" "gateway-api"
  tmux send-keys -t "$SESSION:0" "cd gateway-api && pnpm dev" Enter

  tmux new-window -t "$SESSION" -n "tron-listener"
  tmux send-keys -t "$SESSION:1" "cd tron-listener && pnpm dev" Enter

  tmux new-window -t "$SESSION" -n "bsc-listener"
  tmux send-keys -t "$SESSION:2" "cd bsc-listener && pnpm dev" Enter

  tmux new-window -t "$SESSION" -n "admin-web"
  tmux send-keys -t "$SESSION:3" "cd admin-web && pnpm dev" Enter

  echo -e "${GREEN}[✔] Tất cả services đang chạy trong tmux session '$SESSION'${NC}"
  echo ""
  echo "  Attach:   tmux attach -t $SESSION"
  echo "  Cửa sổ:   Ctrl+B, 0/1/2/3 để chuyển service"
  echo "  Thoát:    Ctrl+B, D  (services vẫn chạy)"
  echo ""
  tmux attach -t "$SESSION"
else
  echo -e "${YELLOW}[!] tmux không có sẵn — chạy background${NC}"
  echo ""

  cd gateway-api && pnpm dev &
  API_PID=$!
  cd "$SCRIPT_DIR"

  cd tron-listener && pnpm dev &
  LISTENER_PID=$!
  cd "$SCRIPT_DIR"

  cd bsc-listener && pnpm dev &
  BSC_PID=$!
  cd "$SCRIPT_DIR"

  cd admin-web && pnpm dev &
  WEB_PID=$!
  cd "$SCRIPT_DIR"

  echo -e "${GREEN}[✔] Services đang chạy:${NC}"
  echo "  gateway-api   PID: $API_PID       → http://localhost:3007"
  echo "  tron-listener PID: $LISTENER_PID"
  echo "  bsc-listener  PID: $BSC_PID"
  echo "  admin-web     PID: $WEB_PID       → http://localhost:5173"
  echo ""
  echo "Nhấn Ctrl+C để dừng tất cả..."

  trap "kill $API_PID $LISTENER_PID $BSC_PID $WEB_PID 2>/dev/null; echo 'Đã dừng.'" INT TERM
  wait
fi
