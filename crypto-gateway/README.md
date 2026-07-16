# Crypto Payment Gateway

Hệ thống Payment Gateway USDT (TRC20 + BEP20) — quản lý bằng **pnpm + PM2 + Nginx**.

> 📋 **Đã nâng cấp**: 2FA, IP Whitelist, Multi-wallet rotation, Auto-sweep, Duyệt rút 2 bước, Sandbox mode, Đối soát, Export Excel/PDF, Multi-admin phân quyền, **Đa chuỗi (USDT-BEP20 trên BSC)**, **Giám sát & cảnh báo Telegram**, **Unit test**.
> Xem chi tiết tại [`CHANGELOG.md`](./CHANGELOG.md).

## Cấu trúc

```
crypto-gateway/
├── gateway-api/          # Backend API (Express + TypeScript + Prisma)
├── tron-listener/        # Blockchain monitor — USDT-TRC20 trên TRON
├── bsc-listener/         # Blockchain monitor — USDT-BEP20 trên BSC
├── admin-web/            # Frontend (React + Vite + Ant Design)
├── nginx/
│   └── crypto-gateway.conf   # Nginx config
├── scripts/
│   ├── deploy.sh         # Rebuild + reload
│   ├── dev.sh            # Chạy development
│   ├── setup-db.sh       # Tạo MySQL DB + user
│   ├── logs.sh           # Xem logs
│   └── status.sh         # Kiểm tra hệ thống
├── ecosystem.config.js   # PM2 config
├── install.sh            # Cài đặt lần đầu (one-shot)
└── .env.example
```

---

## Yêu cầu

| Phần mềm | Phiên bản | Ghi chú |
|----------|-----------|---------|
| Node.js  | >= 20     | https://nodejs.org |
| pnpm     | >= 9      | `corepack enable && corepack prepare pnpm@9.15.0 --activate` (hoặc `npm i -g pnpm`) |
| PM2      | latest    | `npm i -g pm2` |
| MySQL    | 8.0       | |
| Redis    | 7+        | |
| Nginx    | 1.18+     | |

---

## 🚀 Cài đặt lần đầu (Production)

### Bước 1 — Clone + cấu hình

```bash
git clone <repo> crypto-gateway
cd crypto-gateway
cp .env.example .env
nano .env          # Điền đầy đủ thông tin
```

Các biến **bắt buộc** trong `.env`:

```env
DATABASE_URL="mysql://cgw_user:PASSWORD@127.0.0.1:3306/crypto_gateway"
REDIS_URL="redis://127.0.0.1:6379"
JWT_ACCESS_SECRET=<openssl rand -hex 64>
JWT_REFRESH_SECRET=<openssl rand -hex 64>
TRON_API_KEY=<lấy tại trongrid.io>
```

### Bước 2 — Tạo MySQL database

```bash
sudo bash scripts/setup-db.sh
```

> Script tự tạo database `crypto_gateway`, user `cgw_user` và in ra `DATABASE_URL` để copy vào `.env`.

### Bước 3 — Cài Redis (nếu chưa có)

```bash
sudo apt-get install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

### Bước 4 — Chạy install.sh

```bash
chmod +x install.sh scripts/*.sh
bash install.sh
```

Script tự động:
1. Kiểm tra & cài Node.js, pnpm, PM2, Nginx
2. `pnpm install` + build tất cả 3 services
3. Migrate database + seed dữ liệu mặc định
4. Deploy frontend vào `/var/www/crypto-gateway`
5. Cấu hình Nginx + reload
6. Start PM2 + đăng ký autostart khi reboot

**Sau khi xong:**
```
  Frontend  →  http://<server-ip>
  API       →  http://<server-ip>:3007
  Admin     →  admin@gateway.com / Admin@123456  (vai trò SUPER_ADMIN)
```

⚠️ **Đổi mật khẩu và bật 2FA ngay sau lần đăng nhập đầu tiên.**

---

## 💻 Development Local

### Cài đặt deps + prisma generate

```bash
# gateway-api
cd gateway-api && pnpm install && pnpm exec prisma generate && cd ..

# tron-listener
cd tron-listener && pnpm install && pnpm exec prisma generate && cd ..

# bsc-listener
cd bsc-listener && pnpm install && pnpm exec prisma generate && cd ..

# admin-web
cd admin-web && pnpm install && cd ..
```

### Migrate + seed DB (lần đầu)

```bash
cd gateway-api
pnpm exec prisma migrate dev --name init
pnpm exec ts-node prisma/seed.ts
cd ..
```

### Chạy development (tất cả services)

```bash
bash scripts/dev.sh
```

> Dùng tmux nếu có (3 windows riêng). Nếu không có tmux thì chạy background.

**Hoặc chạy riêng từng service:**

```bash
# Terminal 1
cd gateway-api && pnpm dev

# Terminal 2
cd tron-listener && pnpm dev

# Terminal 3
cd bsc-listener && pnpm dev

# Terminal 4
cd admin-web && pnpm dev    # http://localhost:5173
```

---

## ⚙️ Quản lý PM2

```bash
pm2 status                      # Trạng thái tất cả processes
pm2 logs                        # Logs realtime (Ctrl+C để thoát)
pm2 logs gateway-api            # Logs của 1 service
pm2 restart gateway-api         # Restart 1 service
pm2 restart all                 # Restart tất cả
pm2 stop tron-listener          # Dừng 1 service
pm2 reload ecosystem.config.js  # Zero-downtime reload
pm2 monit                       # Dashboard realtime (CPU/RAM)
```

---

## 🔄 Deploy lại sau khi sửa code

```bash
# Deploy tất cả
bash scripts/deploy.sh

# Deploy chỉ backend API
bash scripts/deploy.sh api

# Deploy chỉ blockchain listener
bash scripts/deploy.sh listener

# Deploy chỉ frontend
bash scripts/deploy.sh web
```

---

## 📋 Xem logs

```bash
bash scripts/logs.sh            # Tất cả services
bash scripts/logs.sh api        # Chỉ gateway-api
bash scripts/logs.sh listener   # Chỉ tron-listener
bash scripts/logs.sh bsc        # Chỉ bsc-listener

# Hoặc trực tiếp
pm2 logs --lines 200
tail -f logs/gateway-api-error.log
```

---

## 🩺 Kiểm tra hệ thống

```bash
bash scripts/status.sh
```

---

## 🔔 Giám sát & Cảnh báo

Hệ thống tự động theo dõi (`gateway-api`'s watchdog job):
- **Heartbeat của tron-listener / bsc-listener** — nếu 1 listener không phản hồi quá `HEARTBEAT_STALE_THRESHOLD_MS` (mặc định 5 phút), gửi cảnh báo Telegram mức 🔴 critical.
- **Hàng đợi webhook bị nghẽn** — nếu số job thất bại vượt `WEBHOOK_FAILED_ALERT_THRESHOLD` (mặc định 20), gửi cảnh báo ⚠️ warning.

**Cấu hình Telegram** (trong `.env`):
```bash
ALERT_TELEGRAM_BOT_TOKEN=xxx   # tạo qua @BotFather
ALERT_TELEGRAM_CHAT_ID=xxx     # nhắn bot rồi mở https://api.telegram.org/bot<TOKEN>/getUpdates
```
Nếu chưa cấu hình, hệ thống vẫn hoạt động bình thường — chỉ ghi log thay vì gửi Telegram.

**Dashboard hàng đợi webhook** (Bull Board — cần đăng nhập ADMIN/SUPER_ADMIN):
```
https://<domain>/api/v1/admin/queues
```

---

## 🧪 Test tự động

```bash
cd gateway-api
pnpm test          # chạy 1 lần
pnpm test:watch    # chạy theo dõi khi sửa code
```

Hiện có test cho: xác minh chữ ký webhook (HMAC), tính phí giao dịch (`calculateFee`), mã hoá private key (`crypto-vault`), và state machine chuyển trạng thái giao dịch. Nên bổ sung thêm test khi thêm tính năng mới, đặc biệt các logic liên quan tới tiền.

---

## 🔧 CI (GitHub Actions)

Có sẵn `.github/workflows/ci.yml` — tự động chạy `typecheck` + `test` + `build` cho cả 4 service mỗi khi push/tạo PR. Mục tiêu: bắt lỗi kiểu "thiếu field bắt buộc sau khi đổi schema Prisma" **trước khi** phải deploy thật lên server rồi mới phát hiện qua log (đã xảy ra vài lần trong quá trình phát triển — sandbox dev không tải được Prisma engine nên bỏ sót, còn CI chạy trên GitHub có mạng đầy đủ nên bắt được).

**Điều kiện để dùng được: dự án cần đang nằm trong 1 Git repo có push lên GitHub** — hiện dự án của bạn đang quản lý qua deploy thủ công (tải zip → giải nén trên VPS), chưa có git. Cần làm 1 lần:

```bash
cd /www/wwwroot/payment.v3vn.eu
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

Từ lần sau, mỗi khi sửa code xong chỉ cần:
```bash
bash scripts/sync.sh "mô tả thay đổi"
```
(gộp sẵn `git add` + `commit` + `push` — không cần nhớ 3 lệnh riêng lẻ)

Sau đó vào tab **Actions** trên GitHub để xem kết quả mỗi lần push. Không cần cấu hình gì thêm — workflow tự chạy.

**Không tự động deploy lên server** — CI này chỉ kiểm tra code, không SSH vào server để deploy thay bạn (tránh phải lưu SSH key/secret nhạy cảm lên GitHub cho 1 VPS đang chạy nhiều dự án khác). Bạn vẫn `git pull` + `bash scripts/deploy.sh` trên server như hiện tại — nếu muốn tự động luôn bước deploy, nói mình biết để thêm workflow riêng (cần bạn cung cấp SSH key deploy riêng, không dùng chung key VPS chính).



Config tại: `nginx/crypto-gateway.conf`

```bash
# Test config
sudo nginx -t

# Reload (không downtime)
sudo systemctl reload nginx

# Xem logs nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

**HTTPS với Let's Encrypt:**
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com -d www.example.com
# Certbot tự sửa nginx config và đặt auto-renew
```

---

## 📡 API Reference

### Auth
```
POST /api/v1/auth/login           { email, password }
POST /api/v1/auth/refresh         { refreshToken }
POST /api/v1/auth/logout          { refreshToken }
GET  /api/v1/auth/me
PUT  /api/v1/auth/change-password { currentPassword, newPassword }
```

### Tạo payment request (Merchant API Key)
```bash
curl -X POST http://localhost:3007/api/v1/transactions/pay \
  -H "x-api-key: mk_your_key" \
  -H "x-api-secret: your_secret" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"ORDER-001","amount":100,"network":"TRC20"}'
```

`network` (tùy chọn, mặc định `TRC20`): `TRC20` (USDT trên TRON) hoặc `BEP20` (USDT trên BSC).

**Chống tạo trùng giao dịch:** gửi kèm header `Idempotency-Key: <chuỗi tự sinh, khuyến khích UUID>` — gọi lại với cùng key + cùng nội dung request sẽ trả về đúng kết quả cũ thay vì tạo giao dịch mới (hữu ích khi merchant phải retry do timeout mạng). Không bắt buộc — bỏ qua vẫn hoạt động như trước. Cùng key nhưng khác nội dung → lỗi 409. Kết quả lưu lại 24h.

Response:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "toAddress": "T...",
    "amount": "100.000000",
    "network": "TRC20",
    "status": "PENDING",
    "expiredAt": "..."
  }
}
```

### WebSocket realtime
```javascript
const socket = io('http://server', { auth: { token: 'jwt_access_token' } });
socket.emit('subscribe:transaction', transactionId);
socket.on('transaction:updated', (data) => console.log(data));
```

### Webhook callback
```
Header: X-Webhook-Signature: <hmac-sha256>
Body:   { event, transactionId, orderId, amount, fee, netAmount, txHash, status }
```

---

## 🔐 Cài đặt hệ thống (Admin UI → Settings)

| Key | Default | Mô tả |
|-----|---------|-------|
| `required_confirmations` | 20 | Số block xác nhận |
| `payment_expiry_minutes` | 30 | Thời hạn GD (phút) |
| `withdrawal_fee_rate` | 0.005 | Phí rút (0.5%) |
| `min_withdrawal_amount` | 10 | Rút tối thiểu (USDT) |

---

---

## 🔒 Mã hoá ví & Tự động hoá Payout

### Mã hoá private key at-rest
Private key ví giờ được mã hoá AES-256-GCM trước khi lưu DB (thay vì plaintext như trước).

**Bắt buộc cấu hình khi lên production:**
```bash
# Trong .env
WALLET_ENCRYPTION_KEY=$(openssl rand -hex 32)
```
⚠️ Mất key này = mất khả năng giải mã toàn bộ private key đã mã hoá. Backup key này **tách riêng** khỏi backup database (không lưu chung 1 chỗ).

**Nếu đã có ví tạo từ trước** (đang lưu private key dạng plaintext), chạy 1 lần để mã hoá lại:
```bash
cd gateway-api
pnpm run encrypt-keys
```
An toàn chạy nhiều lần — key nào đã mã hoá sẽ tự bỏ qua, không mã hoá chồng.

### Tự động hoá payout khi duyệt rút tiền
Trước đây: duyệt xong → Admin phải tự tay gửi crypto rồi nhập `txHash` thủ công.
Giờ: duyệt xong (`PROCESSING`) → hệ thống **tự động ký + gửi USDT thật on-chain** (ưu tiên lấy từ ví COLD trước, không đủ mới lấy ví HOT) → tự đánh dấu `COMPLETED` kèm `txHash` thật.

- Payout tự động thất bại (vd: ví không đủ số dư, RPC lỗi tạm thời) → withdrawal **giữ nguyên ở PROCESSING** (tiền không mất, vẫn đang `frozenBalance`) → Admin bấm **"Thử lại tự động"** trên trang Rút tiền, hoặc dùng **"Đánh dấu xong (thủ công)"** nếu muốn tự gửi ngoài hệ thống như trước.
- Có cảnh báo Telegram tự động khi payout thất bại (dùng chung cấu hình `ALERT_TELEGRAM_BOT_TOKEN` ở mục Giám sát).

### Sweep tự động cho BEP20
Trước đây chỉ TRC20 tự sweep được, BEP20 phải làm thủ công. Giờ cả 2 mạng đều tự sweep HOT → COLD (đúng theo từng mạng — ví COLD đích phải cùng mạng với ví HOT nguồn).

### Khách hàng tự chọn mạng nhận tiền (TRC20/BEP20)
Nếu Đại lý gọi `POST /transactions/pay` **không truyền `network`**, giao dịch sẽ ở trạng thái "chờ chọn mạng" — trang thanh toán (`/pay/:id`) sẽ hiện 2 lựa chọn TRC20/BEP20 cho khách hàng tự chọn, ví chỉ được gán sau khi khách chọn. Nếu Đại lý vẫn truyền `network` như trước, hành vi giữ nguyên (gán ví ngay, không hỏi khách).

### Đại lý tự đăng ký (Register) + Hệ thống giới thiệu (Ref)
- Trang `/register` cho phép Đại lý tự tạo tài khoản — bắt buộc xác thực email trước khi đăng nhập lần đầu.
- Mỗi merchant có `referralCode` riêng, xem tại trang riêng **Merchant → Giới thiệu (Ref)** — kèm link `/register?ref=MÃ`, xem được danh sách đã giới thiệu + lịch sử hoa hồng.
- **Admin → Giới thiệu (Ref)**: trang riêng để bật/tắt chương trình, cấu hình tỉ lệ hoa hồng + thời hạn hưởng (0 = vĩnh viễn), xem bảng xếp hạng top người giới thiệu.
- Hoa hồng tự động: khi giao dịch của merchant được giới thiệu hoàn tất, `tron-listener`/`bsc-listener` tự tính `hoa hồng = phí dịch vụ × tỉ lệ` và cộng thẳng vào `balance` của người giới thiệu — mặc định **tắt** (`referral_enabled = false`), Admin cần bật thủ công ở trang Giới thiệu.
- **Chống lạm dụng**: tự động chặn gắn quan hệ giới thiệu nếu người đăng ký dùng cùng IP với người giới thiệu (tài khoản vẫn tạo được, chỉ không tính hoa hồng — không chặn nhầm người dùng chung mạng/văn phòng khi IP không trùng); giới hạn hoa hồng tối đa/ngày cho mỗi người giới thiệu (cấu hình ở Admin → Giới thiệu, 0 = không giới hạn); chỉ giao dịch **LIVE thật trên blockchain** mới tính hoa hồng — giao dịch Sandbox không bao giờ sinh hoa hồng. Admin xem được danh sách các lượt bị chặn (nghi tự giới thiệu) ngay trong trang Giới thiệu.
- **Số dư hoa hồng tách riêng**: hoa hồng cộng vào `referralBalance` — tách biệt hoàn toàn với `balance` (tiền từ giao dịch khách hàng). Merchant tự bấm "Chuyển vào số dư chính" ở trang Giới thiệu khi muốn rút (API rút tiền vẫn chỉ trừ từ `balance`). Admin xem được cả 2 số dư riêng biệt trong chi tiết Đại lý.
- Admin → Đại lý giờ hiện luôn "Mã giới thiệu" + "Được giới thiệu bởi" trong chi tiết từng merchant.
- Admin vẫn tạo merchant tay như cũ được (không cần xác thực email), có nút xác thực thủ công cho merchant gặp trục trặc.



### 2FA & Bảo mật
- Admin/Merchant bật 2FA tại trang **Hồ sơ** (Google Authenticator)
- Merchant cấu hình **IP Whitelist** cho API key LIVE tại trang Hồ sơ
- Rate-limit tự động 60 request/phút cho mỗi merchant

### Ví & Rút tiền
- Ví HOT tự xoay vòng (round-robin) khi nhận thanh toán — xem tại **Admin → Ví → Rotation Stats**
- Tạo ví loại **COLD** rồi vào **Admin → Sweep** để gom tiền tự động
- Rút tiền ≥ 1000 USDT bắt buộc 2 admin khác nhau duyệt (xem tại **Admin → Rút tiền**)

### Sandbox cho Merchant
- Tạo API Key môi trường **SANDBOX** tại trang API Keys (prefix `sk_test_`)
- Vào **Merchant → Sandbox** để xem hướng dẫn cURL + giả lập hoàn thành giao dịch test

### Đối soát
- Admin tạo batch đối soát tại **Admin → Đối soát**, chọn merchant + khoảng ngày
- Merchant tự xem tóm tắt giao dịch tại **Merchant → Đối soát**

### Export & Đa Admin
- Xuất Excel/PDF tại **Admin → Giao dịch → Xuất file**
- SUPER_ADMIN tạo thêm ADMIN/OPERATOR và phân quyền chi tiết tại **Admin → Quản lý Admin**

### Đa chuỗi (USDT-TRC20 + USDT-BEP20)
- `tron-listener` theo dõi USDT-TRC20 trên TRON, `bsc-listener` theo dõi USDT-BEP20 trên BSC — chạy song song, độc lập.
- Tạo ví cho từng mạng tại **Admin → Ví → Tạo ví mới**, chọn `network = TRC20` hoặc `BEP20`.
- Merchant truyền `"network": "BEP20"` khi gọi `POST /transactions/pay` để nhận thanh toán qua BSC (mặc định vẫn là `TRC20` nếu không truyền).
- ⚠️ **Sweep tự động cho BEP20 chưa được hỗ trợ** (cần chữ ký EVM riêng, trả phí gas bằng BNB) — ví BEP20 đủ ngưỡng sweep sẽ được cảnh báo qua Redis pub/sub (`sweep:eligible`) để admin gom tiền thủ công. Đây là hạng mục cần làm tiếp nếu dùng BEP20 ở quy mô lớn.

## 🛡️ Checklist Production

- [ ] Đổi `JWT_ACCESS_SECRET` và `JWT_REFRESH_SECRET` (64+ ký tự)
- [ ] Tạo `WALLET_ENCRYPTION_KEY` (`openssl rand -hex 32`) — backup tách riêng khỏi backup DB
- [ ] Chạy `pnpm run encrypt-keys` (gateway-api) nếu nâng cấp từ bản chưa mã hoá key
- [ ] Dùng HTTPS (certbot)
- [ ] MySQL chỉ bind `127.0.0.1` (không expose port 3306 ra ngoài)
- [ ] Redis bind `127.0.0.1`
- [ ] Tạo Hot Wallet mới trong Admin UI → Wallets (cho từng network cần dùng)
- [ ] Tạo Cold Wallet để dùng tính năng Sweep (TRC20)
- [ ] Bật 2FA cho tài khoản SUPER_ADMIN
- [ ] Đăng ký TronGrid API Key (free plan đủ để test)
- [ ] Nếu dùng BEP20: đổi `BSC_RPC_URL` sang RPC riêng (Ankr/QuickNode/NodeReal) thay vì RPC công khai
- [ ] Cấu hình `ALERT_TELEGRAM_BOT_TOKEN` + `ALERT_TELEGRAM_CHAT_ID` để nhận cảnh báo khi listener chết
- [ ] Chạy `pnpm exec prisma migrate dev --name add_bep20_network` (gateway-api) sau khi pull code có BEP20
- [ ] Setup log rotation: `pm2 install pm2-logrotate`
- [ ] Monitor: `pm2 install pm2-server-monit`
- [ ] Xem lại `dual_approval_threshold` trong Settings (mặc định 1000 USDT)
