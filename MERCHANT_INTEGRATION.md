# Hướng dẫn Tích hợp Thanh toán USDT (TRC20 / BEP20)

Tài liệu này dành cho **Đại lý (Merchant)** muốn tích hợp cổng thanh toán vào website của mình.

> 📄 **Tài liệu API đầy đủ, luôn cập nhật**: xem [OpenAPI/Swagger](../gateway-api/openapi.yaml) tại `https://<domain>/api/v1/docs`. Tài liệu bên dưới mang tính hướng dẫn tổng quan — nếu có chênh lệch, OpenAPI spec là nguồn chính xác nhất vì tự sinh sát với code.

---

## Mục lục

1. [Lấy API Key](#1-lấy-api-key)
2. [Tạo yêu cầu thanh toán](#2-tạo-yêu-cầu-thanh-toán)
3. [Hiển thị trang thanh toán cho khách](#3-hiển-thị-trang-thanh-toán-cho-khách)
4. [Nhận kết quả qua Webhook](#4-nhận-kết-quả-qua-webhook)
5. [Kiểm tra trạng thái giao dịch](#5-kiểm-tra-trạng-thái-giao-dịch)
6. [Code mẫu](#6-code-mẫu)
7. [Sandbox / Test](#7-sandbox--test)
8. [Bảng trạng thái & lỗi](#8-bảng-trạng-thái--lỗi)

---

## 1. Lấy API Key

1. Đăng nhập vào **https://payment.v3vn.eu**
2. Vào **API Keys → Tạo API Key**
3. Chọn môi trường:
   - **LIVE** — giao dịch thật trên blockchain
   - **SANDBOX** — test, không dùng tiền thật
4. Lưu lại `API Key` và `API Secret` (secret chỉ hiện **1 lần**)

```
API Key:    mk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
API Secret: yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
```

---

## 2. Tạo yêu cầu thanh toán

**Endpoint:**
```
POST https://payment.v3vn.eu/api/v1/transactions/pay
```

**Headers:**
```
x-api-key:    mk_live_xxxxxxxx...
x-api-secret: yyyyyyyy...
Content-Type: application/json
```

**Body:**
```json
{
  "orderId": "ORDER-2024-001",
  "amount": 100,
  "returnUrl": "https://yoursite.com/payment/result"
}
```

| Trường | Bắt buộc | Mô tả |
|--------|----------|-------|
| `orderId` | ✅ | Mã đơn hàng duy nhất bên bạn (string, max 100 ký tự) |
| `amount` | ✅ | Số tiền USDT (số thực, tối thiểu 1) |
| `returnUrl` | ❌ | URL redirect sau khi khách thanh toán xong |
| `metadata` | ❌ | Object JSON tùy ý để lưu thêm thông tin |

**Response thành công (201):**
```json
{
  "success": true,
  "data": {
    "id": "txn_uuid_here",
    "orderId": "ORDER-2024-001",
    "amount": "100.000000",
    "fee": "1.000000",
    "netAmount": "99.000000",
    "toAddress": "TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "status": "PENDING",
    "expiredAt": "2024-01-01T00:30:00.000Z",
    "environment": "LIVE"
  }
}
```

> **Quan trọng:** `toAddress` là địa chỉ TRC20 khách cần chuyển USDT đến. `expiredAt` là thời điểm hết hạn (mặc định 30 phút).

---

## 3. Hiển thị trang thanh toán cho khách

Sau khi tạo giao dịch, bạn cần hiển thị cho khách:

- **Địa chỉ ví** (`toAddress`) để chuyển USDT
- **Số tiền chính xác** (`amount`)
- **Đồng hồ đếm ngược** đến `expiredAt`
- **Trạng thái** cập nhật realtime

### Option A — Dùng Widget nhúng có sẵn (khuyến nghị)

Nhúng iframe thanh toán vào trang của bạn:

```html
<iframe
  src="https://payment.v3vn.eu/pay/{transactionId}"
  width="100%"
  height="520"
  frameborder="0"
  style="border-radius: 12px; max-width: 480px;"
></iframe>
```

Hoặc mở popup:

```javascript
function openPayment(transactionId) {
  window.open(
    `https://payment.v3vn.eu/pay/${transactionId}`,
    'payment',
    'width=500,height=600,scrollbars=no'
  );
}
```

### Option B — Tự xây dựng UI

Hiển thị thông tin từ API response và theo dõi trạng thái qua Webhook hoặc polling.

---

## 4. Nhận kết quả qua Webhook

Khi giao dịch hoàn thành, hệ thống sẽ gọi `callbackUrl` bạn đã đăng ký trong phần **Hồ sơ**.

**Hệ thống sẽ gửi POST request:**
```
POST https://yoursite.com/webhook/payment
Content-Type: application/json
X-Webhook-Signature: abc123...
```

**Body:**
```json
{
  "event": "payment.completed",
  "transactionId": "txn_uuid_here",
  "orderId": "ORDER-2024-001",
  "amount": "100.000000",
  "fee": "1.000000",
  "netAmount": "99.000000",
  "txHash": "blockchain_tx_hash",
  "status": "COMPLETED",
  "confirmedAt": "2024-01-01T00:10:00.000Z"
}
```

### Xác minh chữ ký Webhook

**Bắt buộc** phải xác minh `X-Webhook-Signature` để tránh giả mạo:

**PHP:**
```php
<?php
function verifyWebhook(string $body, string $secret, string $signature): bool {
    $expected = hash_hmac('sha256', $body, $secret);
    return hash_equals($expected, $signature);
}

// Trong controller
$body      = file_get_contents('php://input');
$secret    = 'your_webhook_secret'; // lấy từ trang Hồ sơ
$signature = $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'] ?? '';

if (!verifyWebhook($body, $secret, $signature)) {
    http_response_code(401);
    exit('Invalid signature');
}

$data = json_decode($body, true);

if ($data['event'] === 'payment.completed') {
    $orderId   = $data['orderId'];
    $netAmount = $data['netAmount'];
    // Cập nhật đơn hàng của bạn tại đây
    updateOrderStatus($orderId, 'paid');
}

http_response_code(200);
echo 'OK';
```

**Node.js / Express:**
```javascript
const crypto = require('crypto');

function verifyWebhook(body, secret, signature) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );
}

app.post('/webhook/payment', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const secret    = process.env.WEBHOOK_SECRET;

  if (!verifyWebhook(req.body, secret, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const data = JSON.parse(req.body);

  if (data.event === 'payment.completed') {
    console.log('Payment completed:', data.orderId, data.netAmount);
    // Cập nhật đơn hàng
    await Order.update({ status: 'paid' }, { where: { id: data.orderId } });
  }

  res.status(200).send('OK');
});
```

**Python / Django:**
```python
import hmac, hashlib, json
from django.http import HttpResponse, HttpResponseForbidden

def webhook_payment(request):
    body      = request.body
    secret    = b'your_webhook_secret'
    signature = request.headers.get('X-Webhook-Signature', '')

    expected = hmac.new(secret, body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        return HttpResponseForbidden('Invalid signature')

    data = json.loads(body)
    if data['event'] == 'payment.completed':
        order_id   = data['orderId']
        net_amount = data['netAmount']
        Order.objects.filter(id=order_id).update(status='paid')

    return HttpResponse('OK')
```

> **Lưu ý:** Webhook được retry tối đa **3 lần** nếu server trả về status != 200. Hãy đảm bảo endpoint trả `200 OK` ngay cả khi đã xử lý rồi (idempotent).

---

## 5. Kiểm tra trạng thái giao dịch

Ngoài Webhook, bạn có thể polling để kiểm tra:

```
GET https://payment.v3vn.eu/api/v1/transactions/{transactionId}
Authorization: Bearer {jwt_access_token}
```

Hoặc dùng **WebSocket** để nhận realtime (xem phần dưới).

### WebSocket Realtime

```javascript
import { io } from 'socket.io-client';

const socket = io('https://payment.v3vn.eu', {
  auth: { token: 'your_jwt_access_token' }
});

// Theo dõi giao dịch cụ thể
socket.emit('subscribe:transaction', transactionId);

// Nhận cập nhật
socket.on('transaction:updated', (data) => {
  console.log('Status:', data.status);
  console.log('Confirmations:', data.confirmations, '/', data.required);

  if (data.status === 'COMPLETED') {
    // Thanh toán thành công!
    showSuccessMessage();
  }
  if (data.status === 'EXPIRED') {
    showExpiredMessage();
  }
});
```

> **Lưu ý:** JWT access token lấy bằng cách đăng nhập qua API `/api/v1/auth/login` bằng tài khoản merchant.

---

## 6. Code mẫu

### PHP — Luồng thanh toán hoàn chỉnh

```php
<?php
class CryptoGateway {
    private string $apiKey;
    private string $apiSecret;
    private string $baseUrl = 'https://payment.v3vn.eu/api/v1';

    public function __construct(string $apiKey, string $apiSecret) {
        $this->apiKey    = $apiKey;
        $this->apiSecret = $apiSecret;
    }

    public function createPayment(string $orderId, float $amount, string $returnUrl = ''): array {
        $response = $this->request('POST', '/transactions/pay', [
            'orderId'   => $orderId,
            'amount'    => $amount,
            'returnUrl' => $returnUrl,
        ]);
        return $response['data'];
    }

    private function request(string $method, string $path, array $body = []): array {
        $ch = curl_init($this->baseUrl . $path);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_POSTFIELDS     => json_encode($body),
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'x-api-key: ' . $this->apiKey,
                'x-api-secret: ' . $this->apiSecret,
            ],
        ]);
        $result = curl_exec($ch);
        curl_close($ch);
        return json_decode($result, true);
    }
}

// Sử dụng
$gateway = new CryptoGateway('mk_live_xxx', 'yyy');
$payment = $gateway->createPayment('ORDER-001', 100.0, 'https://yoursite.com/result');

// Redirect khách đến trang thanh toán
header('Location: https://payment.v3vn.eu/pay/' . $payment['id']);
```

### Node.js / Express

```javascript
const axios = require('axios');

const gateway = axios.create({
  baseURL: 'https://payment.v3vn.eu/api/v1',
  headers: {
    'x-api-key':    process.env.GATEWAY_API_KEY,
    'x-api-secret': process.env.GATEWAY_API_SECRET,
  },
});

// Tạo thanh toán
app.post('/checkout', async (req, res) => {
  try {
    const { orderId, amount } = req.body;

    const { data } = await gateway.post('/transactions/pay', {
      orderId,
      amount,
      returnUrl: `${process.env.APP_URL}/payment/result`,
      metadata: { userId: req.user.id },
    });

    // Lưu transactionId vào đơn hàng
    await Order.update({ transactionId: data.data.id }, { where: { id: orderId } });

    // Trả về thông tin thanh toán
    res.json({
      paymentUrl: `https://payment.v3vn.eu/pay/${data.data.id}`,
      address:    data.data.toAddress,
      amount:     data.data.amount,
      expiredAt:  data.data.expiredAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### Python

```python
import requests
import hmac, hashlib

class CryptoGateway:
    BASE_URL = 'https://payment.v3vn.eu/api/v1'

    def __init__(self, api_key: str, api_secret: str):
        self.session = requests.Session()
        self.session.headers.update({
            'x-api-key':    api_key,
            'x-api-secret': api_secret,
            'Content-Type': 'application/json',
        })

    def create_payment(self, order_id: str, amount: float, return_url: str = '') -> dict:
        r = self.session.post(f'{self.BASE_URL}/transactions/pay', json={
            'orderId':   order_id,
            'amount':    amount,
            'returnUrl': return_url,
        })
        r.raise_for_status()
        return r.json()['data']

# Django view
def checkout(request):
    gw      = CryptoGateway(settings.GW_API_KEY, settings.GW_API_SECRET)
    payment = gw.create_payment(
        order_id   = f'ORDER-{order.id}',
        amount     = float(order.total),
        return_url = request.build_absolute_uri('/payment/result/'),
    )
    return redirect(f"https://payment.v3vn.eu/pay/{payment['id']}")
```

---

## 7. Sandbox / Test

Dùng API Key môi trường **SANDBOX** (`sk_test_...`) để test mà không cần chuyển tiền thật.

```bash
# Tạo giao dịch test
curl -X POST https://payment.v3vn.eu/api/v1/transactions/pay \
  -H "x-api-key: sk_test_xxxxxxxx" \
  -H "x-api-secret: your_secret" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"TEST-001","amount":50}'
```

Sau khi tạo, vào **Dashboard → Sandbox** → bấm **"Giả lập hoàn thành"** để kích hoạt webhook callback giống như giao dịch thật.

---

## 8. Bảng trạng thái & lỗi

### Trạng thái giao dịch

| Status | Mô tả |
|--------|-------|
| `PENDING` | Đang chờ khách chuyển tiền |
| `CONFIRMING` | Đã nhận được tiền, đang chờ xác nhận blockchain |
| `COMPLETED` | Hoàn thành, tiền đã vào tài khoản |
| `EXPIRED` | Hết hạn (khách không chuyển trong 30 phút) |
| `FAILED` | Thất bại |

### Lỗi API thường gặp

| HTTP | Code | Nguyên nhân | Xử lý |
|------|------|-------------|-------|
| 401 | - | API key/secret sai | Kiểm tra lại key |
| 403 | - | IP không trong whitelist | Thêm IP vào whitelist hoặc tắt tính năng này |
| 409 | - | `orderId` đã tồn tại | Dùng orderId khác hoặc kiểm tra giao dịch cũ |
| 429 | - | Quá giới hạn request (60 req/phút) | Giảm tần suất gọi API |
| 400 | - | Số tiền < 1 USDT | Tăng amount |
| 503 | - | Không có ví khả dụng | Liên hệ admin |

### Tips quan trọng

- **Luôn lưu `transactionId`** vào database của bạn ngay sau khi tạo
- **Không dùng `orderId` trùng** cho hai giao dịch khác nhau
- **Xác minh chữ ký webhook** trước khi cập nhật đơn hàng
- **Idempotent webhook handler** — kiểm tra `transactionId` đã xử lý chưa trước khi update
- **Số tiền USDT phải khớp chính xác** — khách chuyển sai số sẽ không được xác nhận
- **Thử nghiệm trong Sandbox** trước khi chuyển sang LIVE

---

## Hỗ trợ

Liên hệ admin qua trang quản trị hoặc tạo ticket nếu gặp vấn đề.
