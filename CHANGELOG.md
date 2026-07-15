# Changelog — Nâng cấp tính năng

## 🔐 Bảo mật & Xác thực

- **2FA (TOTP)** — Google Authenticator/Authy, backup codes, bắt buộc khi đăng nhập nếu đã bật
- **IP Whitelist** — merchant tự quản lý danh sách IP được phép gọi API LIVE key
- **Rate-limit theo merchant** — sliding window 60 req/60s qua Redis, độc lập theo từng merchant
- **Brute-force protection** — khóa đăng nhập 15 phút sau 10 lần sai liên tiếp
- **Login history** — lưu IP, user-agent, lý do thất bại cho mỗi lần đăng nhập
- **Trust proxy** — đọc đúng IP thật qua Nginx `X-Forwarded-For`

### API mới
```
POST /api/v1/2fa/setup              — Tạo QR code
POST /api/v1/2fa/enable             — Xác nhận OTP, nhận backup codes
POST /api/v1/2fa/disable            — Tắt 2FA (cần mật khẩu)
GET  /api/v1/2fa/status

GET  /api/v1/ip-whitelist/my        — Merchant xem IP của mình
POST /api/v1/ip-whitelist/my        — Thêm IP
PUT  /api/v1/ip-whitelist/my/toggle-restriction
```

---

## 💰 Vận hành ví & Rút tiền

- **Multi-wallet rotation** — round-robin theo `lastAssignedAt`, tự động chọn ví HOT ít dùng nhất
- **Pinned wallet** — gán ví cố định cho merchant volume cao (`MerchantWallet`)
- **Auto-sweep** — gom USDT từ ví HOT về ví COLD khi vượt ngưỡng, ghi log đầy đủ (`SweepLog`)
- **Duyệt rút 2 bước (dual control)** — giao dịch ≥ 1000 USDT bắt buộc 2 admin khác nhau duyệt
- **Hạn mức rút/ngày** — `dailyWithdrawalLimit` theo từng merchant

### API mới
```
GET  /api/v1/wallets/rotation/stats
PUT  /api/v1/wallets/:id/rotation
POST /api/v1/wallets/:walletId/pin/:merchantId

POST /api/v1/sweep/wallet/:walletId
POST /api/v1/sweep/run-all
GET  /api/v1/sweep/history

POST /api/v1/withdrawals/:id/approve   — bước 1 hoặc bước 2 tùy trạng thái
POST /api/v1/withdrawals/:id/complete  — đánh dấu đã chuyển tiền on-chain
```

---

## 🧪 Merchant Tools

- **Sandbox/Test mode** — API key `sk_test_...` riêng biệt, giao dịch không chạm blockchain thật
- **Giả lập hoàn thành** — merchant tự bấm nút để test webhook callback trong sandbox
- **Đối soát (Reconciliation)** — admin tạo batch đối soát theo merchant + khoảng ngày; merchant tự xem tóm tắt giao dịch đã khớp

### API mới
```
POST /api/v1/transactions/sandbox/:id/simulate-complete
POST /api/v1/reconciliation/generate
GET  /api/v1/reconciliation/my/summary
```

---

## 📊 Admin & Báo cáo

- **Export Excel/PDF** — danh sách giao dịch, có tổng hợp số liệu
- **Multi-admin phân quyền** — `SUPER_ADMIN` tạo `ADMIN`/`OPERATOR`, gán quyền view/create/edit/delete/approve theo từng resource
- **Role mới**: `SUPER_ADMIN` (toàn quyền), `ADMIN`, `OPERATOR` (quyền tùy chỉnh)

### API mới
```
GET /api/v1/export/transactions/excel
GET /api/v1/export/transactions/pdf
GET /api/v1/export/my-transactions/excel   (merchant)

GET  /api/v1/admin/admins
POST /api/v1/admin/admins
PUT  /api/v1/admin/admins/:id/permissions
```

---

## Database — Bảng mới

| Bảng | Mục đích |
|------|----------|
| `admin_permissions` | Phân quyền chi tiết theo resource |
| `login_attempts` | Lịch sử đăng nhập (brute-force tracking) |
| `ip_whitelist` | Danh sách IP cho phép |
| `merchant_wallets` | Ví cố định gán cho merchant |
| `sweep_logs` | Lịch sử sweep ví |
| `withdrawal_approvals` | Lịch sử duyệt rút tiền (audit trail) |
| `reconciliations` | Batch đối soát |

## Database — Trường mới quan trọng

- `users.twoFactorSecret`, `twoFactorEnabled`, `backupCodes`, `lastLoginIp`
- `merchants.sandboxBalance`, `ipRestrictionEnabled`, `dailyWithdrawalLimit`
- `wallets.inRotation`, `lastAssignedAt`, `assignedCount`, `trxBalance`
- `transactions.environment` (LIVE/SANDBOX), `returnUrl`, `reconciliationId`
- `withdrawals.requiresDualApproval`, status thêm `APPROVED_L1`

⚠️ **Đây là thay đổi schema lớn — chạy migration trên DB mới hoặc backup trước khi migrate DB cũ.**

---

## Cần làm sau khi deploy

1. Chạy `npx prisma migrate deploy` (hoặc `migrate dev` nếu local)
2. Tạo ví loại **COLD** trong Admin → Wallets trước khi dùng tính năng Sweep
3. Bật 2FA cho tài khoản SUPER_ADMIN ngay sau khi cài đặt
4. Cấu hình `dual_approval_threshold` trong Settings nếu muốn đổi ngưỡng 1000 USDT mặc định
5. `npm install` lại cả 2 service backend (đã thêm `speakeasy`, `qrcode`, `exceljs`, `pdfkit`)
