# RUNBOOK — Backup & Khôi phục thảm họa

Tài liệu này dành cho tình huống khẩn cấp: VPS chết, ổ đĩa hỏng, bị hack, hoặc cần dựng lại hệ thống trên server mới. Đọc kỹ **trước khi** cần dùng đến — đừng để lúc sự cố mới đọc lần đầu.

---

## 1. Backup gồm những gì, nằm ở đâu

| Thành phần | Có backup tự động? | Nằm ở đâu |
|---|---|---|
| Database MySQL (giao dịch, merchant, ví, số dư...) | ✅ Có (`scripts/backup-db.sh`, chạy cron hàng ngày) | `scripts/backups/*.sql.gz` + nơi đồng bộ ngoài (nếu đã cấu hình `BACKUP_REMOTE`) |
| File `.env` (chứa `DATABASE_URL`, `JWT_*_SECRET`, `WALLET_ENCRYPTION_KEY`, SMTP/Telegram token...) | ❌ **KHÔNG tự động** | Bạn phải tự backup thủ công, **lưu riêng biệt**, không chung chỗ với backup DB |
| `WALLET_ENCRYPTION_KEY` (dùng giải mã private key ví) | ❌ **KHÔNG tự động** | Đã nằm trong `.env` — nhưng nên backup **thêm 1 bản riêng, tách biệt hoàn toàn** khỏi cả `.env` lẫn DB backup (xem mục 3) |
| Code | ✅ Có, qua Git/GitHub (nếu đã làm theo hướng dẫn CI/CD) | GitHub repo |

**Vì sao tách `WALLET_ENCRYPTION_KEY` ra riêng?** Nếu 1 kẻ tấn công lấy được **cả DB backup lẫn `.env`** cùng lúc (ví dụ: cùng nằm trong 1 bản backup VPS tổng), chúng có toàn bộ private key ví đã mã hoá VÀ chìa khoá giải mã — coi như mất trắng. Tách riêng ra nghĩa là mất 1 chỗ vẫn chưa đủ để giải mã được gì.

---

## 2. Backup database tự động

### Cài đặt lần đầu

```bash
cd /www/wwwroot/payment.v3vn.eu
bash scripts/setup-backup-cron.sh          # mặc định: 2h sáng mỗi ngày
```

Muốn đổi lịch (vd: mỗi 6 tiếng):
```bash
bash scripts/setup-backup-cron.sh "0 */6 * * *"
```

### Đồng bộ backup ra ngoài VPS (rất khuyến khích)

Backup nằm cùng ổ đĩa với server đang chạy = mất VPS thì mất luôn backup. Nên đồng bộ ra 1 nơi khác, ví dụ 1 VPS phụ, NAS, hoặc dịch vụ lưu trữ hỗ trợ rsync/SSH.

Thêm vào `gateway-api/.env` (hoặc `.env` gốc):
```bash
BACKUP_REMOTE=user@backup-server:/path/to/backups/
```

Yêu cầu: đã cấu hình SSH key cho phép `rsync` không cần nhập mật khẩu tới server đích (`ssh-copy-id user@backup-server`).

Không có server phụ? Tối thiểu hãy tự tay tải file backup mới nhất về máy cá nhân định kỳ (vd: hàng tuần) qua SFTP/`scp`.

### Backup thủ công (không cần chờ cron)

```bash
bash scripts/backup-db.sh
```

### Kiểm tra backup có chạy đúng không

```bash
tail -30 logs/backup.log
ls -lht scripts/backups/
```

---

## 3. Backup `.env` + `WALLET_ENCRYPTION_KEY` (thủ công, làm ngay bây giờ)

```bash
# 1. Backup .env của từng service (chứa hầu hết secret)
tar -czf env-backup-$(date +%Y%m%d).tar.gz \
  .env gateway-api/.env tron-listener/.env bsc-listener/.env

# 2. Mã hoá file này bằng 1 mật khẩu RIÊNG trước khi lưu đi đâu đó
#    (openssl có sẵn trên hầu hết Linux)
openssl enc -aes-256-cbc -pbkdf2 -salt \
  -in env-backup-$(date +%Y%m%d).tar.gz \
  -out env-backup-$(date +%Y%m%d).tar.gz.enc
rm env-backup-$(date +%Y%m%d).tar.gz   # xoá bản chưa mã hoá

# 3. Tải file .enc này về máy cá nhân (KHÔNG để lại trên VPS), lưu ở nơi an toàn
#    (password manager, USB mã hoá, hoặc dịch vụ lưu trữ có 2FA riêng)
```

⚠️ Mật khẩu dùng để mã hoá ở bước 2 — **nhớ nó, viết ra giấy cất tủ, hoặc lưu trong password manager**. Mất mật khẩu này = không mở lại được file, coi như mất luôn `WALLET_ENCRYPTION_KEY`.

**Làm lại việc này mỗi khi bạn đổi bất kỳ secret nào trong `.env`** (đổi `WALLET_ENCRYPTION_KEY`, JWT secret, SMTP password...).

---

## 4. Test khôi phục (làm định kỳ, đừng đợi sự cố thật mới thử lần đầu)

Khuyến khích thử trên 1 database TEST riêng (không phải production), ví dụ mỗi quý 1 lần:

```bash
# Xem danh sách backup có sẵn
bash scripts/restore-db.sh

# Khôi phục thử (script sẽ hỏi xác nhận gõ đúng tên database trước khi ghi đè)
bash scripts/restore-db.sh scripts/backups/crypto_gateway_20260101_020000.sql.gz
```

Nếu restore thử thành công và dữ liệu đọc được bình thường qua Admin UI → coi như backup pipeline đang hoạt động đúng.

---

## 5. Khôi phục thảm họa — dựng lại toàn bộ trên server mới

Tình huống: VPS cũ chết hẳn, cần dựng lại từ đầu trên 1 VPS mới.

### Bước 1 — Chuẩn bị server mới
```bash
# Trên server mới, clone code từ GitHub (nếu đã setup CI/CD ở phần trước)
git clone https://github.com/<username>/<repo>.git
cd <repo>
bash install.sh   # cài Node, pnpm, PM2, Nginx, MySQL, Redis
```

### Bước 2 — Khôi phục secret
```bash
# Giải mã file env-backup đã lưu ở bước 3 (mục 3 ở trên)
openssl enc -aes-256-cbc -pbkdf2 -d \
  -in env-backup-YYYYMMDD.tar.gz.enc \
  -out env-backup-YYYYMMDD.tar.gz
tar -xzf env-backup-YYYYMMDD.tar.gz
# Copy .env vào đúng vị trí từng service (gateway-api/.env, tron-listener/.env, bsc-listener/.env)
```

### Bước 3 — Khôi phục database
```bash
# Tạo DB rỗng trước (install.sh thường đã làm bước này, nhưng kiểm tra lại)
bash scripts/setup-db.sh

# Copy file backup mới nhất lên server mới, rồi restore
bash scripts/restore-db.sh /path/to/crypto_gateway_YYYYMMDD_HHMMSS.sql.gz
```

### Bước 4 — Build & khởi động
```bash
bash scripts/build.sh all
pm2 start ecosystem.config.js
pm2 save
```

### Bước 5 — Kiểm tra
- [ ] Đăng nhập Admin UI được
- [ ] Xem được danh sách merchant/giao dịch cũ (xác nhận DB restore đúng)
- [ ] `pm2 logs tron-listener bsc-listener` — không có lỗi kết nối blockchain
- [ ] Tạo 1 giao dịch test (Sandbox mode) để xác nhận toàn bộ pipeline hoạt động
- [ ] Kiểm tra `Admin → Cài đặt → Tích hợp` — Telegram bot/SMTP vẫn hoạt động (test lại bằng nút Test SMTP/Test Telegram)
- [ ] Trỏ DNS domain sang IP server mới, cấp lại SSL (`certbot`)

### Bước 6 — Sau khi ổn định
```bash
bash scripts/setup-backup-cron.sh   # đừng quên cài lại cron backup trên server MỚI
```

---

## 6. Câu hỏi thường gặp

**Q: Backup có chứa private key ví không?**
A: Có — private key nằm trong bảng `wallets` của DB, nhưng đã được **mã hoá AES-256-GCM**. Backup DB một mình không đủ để giải mã — cần thêm `WALLET_ENCRYPTION_KEY` (nằm trong `.env`, backup riêng theo mục 3).

**Q: Bao lâu backup 1 lần là đủ?**
A: Mặc định cron chạy 1 lần/ngày (2h sáng). Nếu giao dịch nhiều/24-7, cân nhắc tăng tần suất (`setup-backup-cron.sh "0 */6 * * *"` = mỗi 6 tiếng) để giảm lượng dữ liệu có thể mất giữa 2 lần backup.

**Q: Giữ backup bao lâu?**
A: Mặc định 14 ngày (`BACKUP_RETENTION_DAYS`). Với backup đồng bộ ra ngoài (`BACKUP_REMOTE`), cân nhắc giữ lâu hơn ở phía đó (vd: 90 ngày) vì dung lượng rẻ hơn nhiều so với rủi ro cần khôi phục dữ liệu cũ.

**Q: Restore nhầm database production thì sao?**
A: `restore-db.sh` bắt gõ đúng tên database để xác nhận trước khi ghi đè — không có `--force` thì không thể bấm nhầm Enter là mất dữ liệu.
