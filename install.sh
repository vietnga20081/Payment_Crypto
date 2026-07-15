#!/usr/bin/env bash
# =============================================================
#  install.sh — Cài đặt Crypto Payment Gateway
#  Hỗ trợ: Ubuntu 20.04/22.04 (standalone hoặc aaPanel)
# =============================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✔] $1${NC}"; }
warn() { echo -e "${YELLOW}[!] $1${NC}"; }
err()  { echo -e "${RED}[✘] $1${NC}"; exit 1; }
info() { echo -e "${BLUE}[→] $1${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║   Crypto Payment Gateway — Setup          ║"
echo "╚═══════════════════════════════════════════╝"
echo ""

# ── 1. Kiểm tra .env ──────────────────────────────────────────
if [ ! -f ".env" ]; then
  cp .env.example .env
  warn ".env chưa có — đã copy từ .env.example"
  warn "Vui lòng sửa .env trước khi tiếp tục: nano .env"
  echo ""
  read -p "Nhấn Enter sau khi đã sửa .env để tiếp tục..." _
fi
source .env

# ── 2. Kiểm tra Node.js ───────────────────────────────────────
if ! command -v node &>/dev/null; then
  info "Cài đặt Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VER" -lt 18 ]; then
    err "Node.js >= 18 là bắt buộc. Hiện tại: $(node -v)"
  fi
  log "Node.js $(node -v) đã có sẵn"
fi

# ── 3. Kiểm tra PM2 ───────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
  info "Cài đặt PM2..."
  sudo npm install -g pm2
fi
log "PM2 $(pm2 -v) sẵn sàng"

# ── 3b. Kiểm tra pnpm ─────────────────────────────────────────
if ! command -v pnpm &>/dev/null; then
  info "Cài đặt pnpm..."
  corepack enable 2>/dev/null || sudo npm install -g corepack
  corepack prepare pnpm@9.15.0 --activate
fi
log "pnpm $(pnpm -v) sẵn sàng"

# ── 4. Kiểm tra Nginx ─────────────────────────────────────────
if command -v nginx &>/dev/null; then
  log "Nginx $(nginx -v 2>&1 | awk -F'/' '{print $2}') đã có sẵn"
else
  warn "Nginx chưa cài — bỏ qua (aaPanel đã quản lý Nginx)"
fi

# ── 5. Tạo thư mục logs ───────────────────────────────────────
mkdir -p logs
log "Thư mục logs/"

# ── 6. Build gateway-api ──────────────────────────────────────
info "Cài đặt dependencies — gateway-api..."
cd gateway-api
cp ../.env .env
pnpm install
pnpm exec prisma generate
pnpm run build
cd ..
log "gateway-api build xong"

# ── 7. Build tron-listener ────────────────────────────────────
info "Cài đặt dependencies — tron-listener..."
cd tron-listener
cp ../.env .env
pnpm install
pnpm exec prisma generate
pnpm run build
cd ..
log "tron-listener build xong"

# ── 7b. Build bsc-listener ────────────────────────────────────
info "Cài đặt dependencies — bsc-listener..."
cd bsc-listener
cp ../.env .env
pnpm install
pnpm exec prisma generate
pnpm run build
cd ..
log "bsc-listener build xong"

# ── 8. Build frontend ─────────────────────────────────────────
info "Build admin-web..."
cd admin-web
pnpm install
pnpm run build
cd ..
log "admin-web build xong"

# ── 9. Deploy frontend ────────────────────────────────────────
# Phát hiện webroot: aaPanel hoặc mặc định
detect_webroot() {
  # aaPanel thường dùng /www/wwwroot/<domain>
  # Tìm thư mục wwwroot gần nhất với script
  local script_dir="$SCRIPT_DIR"

  # Nếu script đang chạy trong /www/wwwroot/<domain>/...
  if echo "$script_dir" | grep -q "^/www/wwwroot/"; then
    # Dùng thư mục public của site aaPanel: /www/wwwroot/<domain>
    local domain_dir
    domain_dir=$(echo "$script_dir" | sed 's|^/www/wwwroot/||' | cut -d'/' -f1)
    echo "/www/wwwroot/${domain_dir}/public"
    return
  fi

  # Fallback: tạo /var/www/crypto-gateway
  echo "/var/www/crypto-gateway"
}

WEBROOT=$(detect_webroot)

info "Deploy frontend vào: $WEBROOT"
sudo mkdir -p "$WEBROOT"
sudo cp -r admin-web/dist/. "$WEBROOT/"
log "Frontend deploy vào $WEBROOT"

# ── 10. Cấu hình Nginx ────────────────────────────────────────
configure_nginx() {
  local conf_src="$SCRIPT_DIR/nginx/crypto-gateway.conf"

  # aaPanel: thêm config vào /www/server/panel/vhost/nginx/<domain>.conf
  # Hoặc user tự cấu hình qua UI aaPanel
  # Script này chỉ in hướng dẫn thay vì tự sửa để tránh xung đột với aaPanel

  if [ -d "/www/server/nginx" ] || [ -d "/www/server/panel" ]; then
    warn "Phát hiện aaPanel — KHÔNG tự động cấu hình Nginx."
    echo ""
    echo -e "${YELLOW}  ► Vui lòng cấu hình website trong aaPanel:${NC}"
    echo ""
    echo "  1. aaPanel → Website → Chọn site payment.v3vn.eu"
    echo "  2. Đặt Web Root thành: $WEBROOT"
    echo "  3. Vào tab 'Config' → thêm nội dung bên dưới vào trong block 'server {}'"
    echo ""
    echo "  ─── Nginx config cần thêm ───────────────────────────"
    cat << 'NGINX_SNIPPET'
    # Serve React SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API sang gateway-api
    location /api/ {
        proxy_pass http://127.0.0.1:3007;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
    }

    # WebSocket / Socket.IO
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3007;
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host       $host;
        proxy_read_timeout 86400s;
    }
NGINX_SNIPPET
    echo "  ──────────────────────────────────────────────────────"
    echo ""
    echo -e "${YELLOW}  ► Sau khi thêm config → bấm Save → Reload Nginx${NC}"
    echo ""
  else
    # Standalone Ubuntu — dùng sites-available
    if [ -d "/etc/nginx/sites-available" ]; then
      local nginx_conf="/etc/nginx/sites-available/crypto-gateway"
      sudo cp "$conf_src" "$nginx_conf"
      sudo ln -sf "$nginx_conf" /etc/nginx/sites-enabled/crypto-gateway
      sudo rm -f /etc/nginx/sites-enabled/default
      sudo nginx -t && sudo systemctl reload nginx
      log "Nginx đã cấu hình và reload"
    elif [ -d "/etc/nginx/conf.d" ]; then
      # RedHat-style
      sudo cp "$conf_src" /etc/nginx/conf.d/crypto-gateway.conf
      sudo nginx -t && sudo systemctl reload nginx
      log "Nginx đã cấu hình (conf.d) và reload"
    else
      warn "Không tìm thấy thư mục config Nginx — cấu hình thủ công"
    fi
  fi
}

configure_nginx

# ── 11. Migrate database ──────────────────────────────────────
info "Chạy database migrations..."
cd gateway-api
pnpm exec prisma migrate deploy
info "Chạy seed dữ liệu mặc định..."
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();
bcrypt.hash('Admin@123456', 10).then(h => p.user.upsert({
  where: { email: 'admin@gateway.com' },
  update: {},
  create: { email: 'admin@gateway.com', password: h, role: 'SUPER_ADMIN' }
})).then(() => p.feeConfig.upsert({
  where: { id: 'default-fee' },
  update: {},
  create: { id: 'default-fee', name: 'Default', rate: 0.01, minFee: 1, isDefault: true, isActive: true }
})).then(r => console.log('Seed OK:', r.name || r.email)).catch(console.error).finally(() => p.\$disconnect());
"
cd ..
log "Database migrations + seed xong"

# ── 12. Khởi động PM2 ─────────────────────────────────────────
info "Khởi động services với PM2..."
pm2 startOrRestart ecosystem.config.js --env production
pm2 save

# Auto-start khi reboot
if command -v systemctl &>/dev/null; then
  # Tạo systemd service cho PM2
  PM2_USER="${SUDO_USER:-$(whoami)}"
  PM2_HOME="${HOME}"
  sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd \
    -u "$PM2_USER" --hp "$PM2_HOME" 2>/dev/null || \
  pm2 startup 2>/dev/null || \
  warn "Không tự cấu hình được PM2 startup — chạy thủ công: pm2 startup"
fi

log "PM2 đã khởi động"

# ── Hoàn tất ──────────────────────────────────────────────────
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "your-server-ip")

echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║   🎉  Cài đặt hoàn tất!                           ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""
echo -e "  API (PM2)  :  ${GREEN}http://127.0.0.1:3007${NC}"
echo -e "  Frontend   :  ${GREEN}$WEBROOT${NC}"
echo -e "  Admin      :  admin@gateway.com / Admin@123456"
echo ""
echo -e "  ${YELLOW}⚠ Nhớ cấu hình Nginx trong aaPanel (xem hướng dẫn bên trên)${NC}"
echo ""
echo -e "  Lệnh hữu ích:"
echo -e "    pm2 status              — xem trạng thái"
echo -e "    pm2 logs                — xem logs realtime"
echo -e "    bash scripts/deploy.sh  — redeploy sau khi sửa code"
echo ""
