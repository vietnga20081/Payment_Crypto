import { useState } from 'react';
import {
  Typography, Card, Tabs, Tag, Space, Button, Select, Divider,
  Table, Alert, message, Row, Col, Badge,
} from 'antd';
import type { ColumnType } from 'antd/es/table';
import {
  CopyOutlined, CheckOutlined, CodeOutlined,
  ApiOutlined, BookOutlined, SafetyOutlined, ExperimentOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { merchantService } from '../../services';

const { Title, Text, Paragraph } = Typography;

const BASE_URL = window.location.origin;

// ── Helpers ──────────────────────────────────────────────────────────────────
function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code.trim());
    setCopied(true);
    message.success('Đã sao chép');
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ position: 'relative', marginBottom: 16 }}>
      <div style={{
        background: '#1e1e2e', borderRadius: 10, padding: '16px 20px',
        fontFamily: '"Fira Code", monospace', fontSize: 13, lineHeight: 1.7,
        color: '#cdd6f4', overflowX: 'auto', whiteSpace: 'pre',
      }}>
        {code.trim()}
      </div>
      <Button
        size="small"
        icon={copied ? <CheckOutlined /> : <CopyOutlined />}
        onClick={copy}
        type={copied ? 'primary' : 'default'}
        style={{ position: 'absolute', top: 10, right: 10, borderRadius: 6 }}
      >
        {copied ? 'Đã copy' : 'Copy'}
      </Button>
    </div>
  );
}

function MethodTag({ method }: { method: string }) {
  const colors: Record<string, string> = { GET: 'green', POST: 'blue', PUT: 'orange', DELETE: 'red' };
  return (
    <Tag color={colors[method] || 'default'} style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12 }}>
      {method}
    </Tag>
  );
}

function EndpointCard({
  method, path, title, description, params, body, response, notes,
}: {
  method: string; path: string; title: string; description?: string;
  params?: Array<{ name: string; type: string; required: boolean; desc: string }>;
  body?: Array<{ name: string; type: string; required: boolean; desc: string }>;
  response: string; notes?: string;
}) {
  const [open, setOpen] = useState(false);
  const paramCols: ColumnType<{ name: string; type: string; required: boolean; desc: string }>[] = [
    { title: 'Tham số', dataIndex: 'name', render: (v) => <Text code>{v}</Text> },
    { title: 'Kiểu', dataIndex: 'type', render: (v) => <Tag>{v}</Tag> },
    { title: 'Bắt buộc', dataIndex: 'required', render: (v) => v ? <Tag color="red">Có</Tag> : <Tag>Không</Tag> },
    { title: 'Mô tả', dataIndex: 'desc' },
  ];
  return (
    <Card
      style={{ marginBottom: 16, borderRadius: 12 }}
      styles={{ body: { padding: 0 } }}
    >
      <div
        style={{ padding: '14px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
        onClick={() => setOpen(!open)}
      >
        <MethodTag method={method} />
        <Text code style={{ fontSize: 13, flex: 1 }}>{path}</Text>
        <Text strong>{title}</Text>
        <Text style={{ color: '#1677ff', fontSize: 12 }}>{open ? '▲ Thu gọn' : '▼ Mở rộng'}</Text>
      </div>
      {open && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid #f0f0f0' }}>
          {description && <Paragraph type="secondary" style={{ marginTop: 12 }}>{description}</Paragraph>}
          {params && params.length > 0 && (
            <>
              <Title level={5} style={{ margin: '16px 0 8px' }}>Query Parameters</Title>
              <Table dataSource={params} columns={paramCols} rowKey="name" size="small" pagination={false} />
            </>
          )}
          {body && body.length > 0 && (
            <>
              <Title level={5} style={{ margin: '16px 0 8px' }}>Request Body</Title>
              <Table dataSource={body} columns={paramCols} rowKey="name" size="small" pagination={false} />
            </>
          )}
          <Title level={5} style={{ margin: '16px 0 8px' }}>Response mẫu</Title>
          <CodeBlock code={response} lang="json" />
          {notes && <Alert type="info" showIcon message={notes} />}
        </div>
      )}
    </Card>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ApiDocsPage() {
  const [lang, setLang] = useState<'curl' | 'php' | 'nodejs' | 'python'>('curl');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const { data: apiKeys } = useQuery({
    queryKey: ['my-api-keys-docs'],
    queryFn: () => merchantService.getMyApiKeys().then((r) => r.data.data),
  });

  const liveKey = apiKeys?.find((k) => k.environment === 'LIVE' && k.isActive);
  const testKey = apiKeys?.find((k) => k.environment === 'SANDBOX' && k.isActive);
  const displayKey = selectedKey || liveKey?.key || 'mk_live_YOUR_API_KEY';
  const displaySecret = 'YOUR_API_SECRET';

  // Code samples per language
  const samples: Record<string, Record<string, string>> = {
    curl: {
      create: `curl -X POST ${BASE_URL}/api/v1/transactions/pay \\
  -H "x-api-key: ${displayKey}" \\
  -H "x-api-secret: ${displaySecret}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "orderId": "ORDER-2024-001",
    "amount": 100,
    "returnUrl": "https://yoursite.com/payment/result",
    "metadata": { "userId": "user_123" }
  }'`,
      status: `curl ${BASE_URL}/api/v1/pay/{transactionId}`,
      webhook: `# Kiểm tra signature
SIGNATURE=$(echo -n '{"event":"payment.completed",...}' | \\
  openssl dgst -sha256 -hmac "YOUR_WEBHOOK_SECRET" | \\
  awk '{print $2}')
echo $SIGNATURE`,
    },
    php: {
      create: `<?php
$apiKey    = '${displayKey}';
$apiSecret = '${displaySecret}';

$ch = curl_init('${BASE_URL}/api/v1/transactions/pay');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode([
        'orderId'   => 'ORDER-2024-001',
        'amount'    => 100,
        'returnUrl' => 'https://yoursite.com/payment/result',
    ]),
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'x-api-key: '    . $apiKey,
        'x-api-secret: ' . $apiSecret,
    ],
]);

$response = json_decode(curl_exec($ch), true);
curl_close($ch);

if ($response['success']) {
    $transactionId = $response['data']['id'];
    $payAddress    = $response['data']['toAddress'];
    $amount        = $response['data']['amount'];
    // Redirect khách đến trang thanh toán
    header('Location: ${BASE_URL}/pay/' . $transactionId);
    exit;
}`,
      status: `<?php
function getTransaction(string $transactionId): array {
    $ch = curl_init('${BASE_URL}/api/v1/pay/' . $transactionId);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
    ]);
    $result = json_decode(curl_exec($ch), true);
    curl_close($ch);
    return $result['data'];
}

$tx = getTransaction('txn_uuid_here');
echo $tx['status']; // PENDING | CONFIRMING | COMPLETED | EXPIRED`,
      webhook: `<?php
// routes/webhook.php
$body      = file_get_contents('php://input');
$secret    = getenv('WEBHOOK_SECRET'); // lấy từ trang Hồ sơ
$signature = $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'] ?? '';

// Xác minh chữ ký
$expected = hash_hmac('sha256', $body, $secret);
if (!hash_equals($expected, $signature)) {
    http_response_code(401);
    exit('Invalid signature');
}

$data = json_decode($body, true);

if ($data['event'] === 'payment.completed') {
    $orderId   = $data['orderId'];     // Mã đơn hàng của bạn
    $netAmount = $data['netAmount'];   // Số tiền thực nhận
    $txHash    = $data['txHash'];      // Hash blockchain

    // Cập nhật đơn hàng
    DB::table('orders')
      ->where('order_id', $orderId)
      ->update(['status' => 'paid', 'paid_at' => now()]);

    // Ghi log (tuỳ chọn)
    Log::info("Payment completed: $orderId - $netAmount USDT");
}

http_response_code(200);
echo 'OK';`,
    },
    nodejs: {
      create: `const axios = require('axios');

const gateway = axios.create({
  baseURL: '${BASE_URL}/api/v1',
  headers: {
    'x-api-key':    process.env.GW_API_KEY,    // ${displayKey}
    'x-api-secret': process.env.GW_API_SECRET,
  },
});

// Tạo thanh toán
async function createPayment(orderId, amount, returnUrl) {
  const { data } = await gateway.post('/transactions/pay', {
    orderId,
    amount,
    returnUrl,
    metadata: { source: 'website' },
  });
  return data.data;
}

// Sử dụng trong Express route
app.post('/checkout', async (req, res) => {
  try {
    const payment = await createPayment(
      \`ORDER-\${Date.now()}\`,
      req.body.amount,
      \`\${process.env.APP_URL}/payment/result\`
    );
    
    // Lưu transactionId vào DB
    await Order.update(
      { transactionId: payment.id },
      { where: { id: req.body.orderId } }
    );

    res.json({
      paymentUrl: \`${BASE_URL}/pay/\${payment.id}\`,
      address:    payment.toAddress,
      amount:     payment.amount,
      expiredAt:  payment.expiredAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});`,
      status: `const axios = require('axios');

async function checkPayment(transactionId) {
  const { data } = await axios.get(
    \`${BASE_URL}/api/v1/pay/\${transactionId}\`
  );
  return data.data;
  // { status: 'COMPLETED', confirmations: 20, ... }
}`,
      webhook: `const express = require('express');
const crypto  = require('crypto');

// QUAN TRỌNG: dùng express.raw() để lấy body gốc để verify signature
app.post('/webhook/payment',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['x-webhook-signature'] || '';
    const secret    = process.env.WEBHOOK_SECRET;

    // Xác minh chữ ký
    const expected = crypto
      .createHmac('sha256', secret)
      .update(req.body)
      .digest('hex');

    if (!crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature)
    )) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const data = JSON.parse(req.body);

    if (data.event === 'payment.completed') {
      const { orderId, netAmount, txHash } = data;

      // Kiểm tra xem đã xử lý chưa (idempotent)
      const order = await Order.findOne({ where: { orderId } });
      if (order && order.status !== 'paid') {
        await order.update({ status: 'paid', paidAmount: netAmount });
        console.log(\`✅ Paid: \${orderId} - \${netAmount} USDT [\${txHash}]\`);
      }
    }

    res.status(200).send('OK');
  }
);`,
    },
    python: {
      create: `import requests
import os

class CryptoGateway:
    BASE_URL = '${BASE_URL}/api/v1'
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'x-api-key':    os.getenv('GW_API_KEY'),    # ${displayKey}
            'x-api-secret': os.getenv('GW_API_SECRET'),
            'Content-Type': 'application/json',
        })
    
    def create_payment(self, order_id: str, amount: float, 
                       return_url: str = '') -> dict:
        r = self.session.post(f'{self.BASE_URL}/transactions/pay', json={
            'orderId':   order_id,
            'amount':    amount,
            'returnUrl': return_url,
        })
        r.raise_for_status()
        return r.json()['data']

# Django view
from django.shortcuts import redirect

gw = CryptoGateway()

def checkout(request):
    payment = gw.create_payment(
        order_id   = f'ORDER-{order.id}',
        amount     = float(order.total),
        return_url = request.build_absolute_uri('/payment/result/'),
    )
    # Lưu transaction_id
    order.transaction_id = payment['id']
    order.save()
    
    # Redirect đến trang thanh toán
    return redirect(f'${BASE_URL}/pay/{payment["id"]}')`,
      status: `import requests

def check_payment(transaction_id: str) -> dict:
    r = requests.get(
        f'${BASE_URL}/api/v1/pay/{transaction_id}'
    )
    r.raise_for_status()
    return r.json()['data']

tx = check_payment('txn_uuid_here')
print(tx['status'])  # PENDING | CONFIRMING | COMPLETED | EXPIRED`,
      webhook: `import hmac
import hashlib
import json
from django.http import HttpResponse, HttpResponseForbidden
from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
def webhook_payment(request):
    if request.method != 'POST':
        return HttpResponseForbidden()
    
    body      = request.body
    secret    = os.getenv('WEBHOOK_SECRET').encode()
    signature = request.headers.get('X-Webhook-Signature', '')
    
    # Xác minh chữ ký
    expected = hmac.new(secret, body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        return HttpResponseForbidden('Invalid signature')
    
    data = json.loads(body)
    
    if data['event'] == 'payment.completed':
        order_id   = data['orderId']
        net_amount = data['netAmount']
        tx_hash    = data['txHash']
        
        # Cập nhật đơn hàng (idempotent)
        Order.objects.filter(
            order_id=order_id,
            status__ne='paid'
        ).update(status='paid', paid_amount=net_amount)
        
        print(f'✅ Paid: {order_id} - {net_amount} USDT')
    
    return HttpResponse('OK', status=200)`,
    },
  };

  const langOptions = [
    { value: 'curl', label: '🔧 cURL' },
    { value: 'php', label: '🐘 PHP' },
    { value: 'nodejs', label: '⬢ Node.js' },
    { value: 'python', label: '🐍 Python' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <Space><ApiOutlined />Tài liệu API</Space>
          </Title>
          <Text type="secondary">Tích hợp cổng thanh toán USDT TRC20 vào website của bạn</Text>
        </div>
        <Space wrap>
          <Text type="secondary">Ngôn ngữ:</Text>
          <Select
            value={lang}
            onChange={setLang}
            options={langOptions}
            style={{ width: 140 }}
          />
        </Space>
      </div>

      <Tabs
        defaultActiveKey="quickstart"
        size="large"
        items={[
          // ── Tab 1: Quick Start ──────────────────────────────────────────
          {
            key: 'quickstart',
            label: <Space><BookOutlined />Bắt đầu nhanh</Space>,
            children: (
              <div>
                {/* Base URL */}
                <Card style={{ marginBottom: 16, background: '#f6f8fa', borderRadius: 12 }}>
                  <Text strong>Base URL</Text>
                  <CodeBlock code={`${BASE_URL}/api/v1`} />
                  <Text strong>Authentication Headers</Text>
                  <CodeBlock code={`x-api-key:    mk_live_xxxxxxxxxxxxxxxxxxxxxxxx
x-api-secret: yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy`} />
                </Card>

                <Card style={{ marginBottom: 20, borderRadius: 12 }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text strong>📄 OpenAPI / Swagger</Text>
                    <Text type="secondary" style={{ display: 'block' }}>
                      Tài liệu API đầy đủ dạng chuẩn OpenAPI 3.0 — có thể import vào Postman/Insomnia,
                      hoặc dùng để tự sinh SDK client cho ngôn ngữ bạn cần.
                    </Text>
                    <Space>
                      <a href={`${BASE_URL}/api/v1/docs`} target="_blank" rel="noreferrer">
                        <Button type="primary">Mở Swagger UI</Button>
                      </a>
                      <a href={`${BASE_URL}/api/v1/docs/openapi.json`} target="_blank" rel="noreferrer">
                        <Button>Tải openapi.json</Button>
                      </a>
                    </Space>
                  </Space>
                </Card>

                {/* Quick key selector */}
                {apiKeys && apiKeys.length > 0 && (
                  <Card style={{ marginBottom: 20, borderRadius: 12 }} title="🔑 API Key của bạn">
                    <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                      Chọn key để điền tự động vào code mẫu:
                    </Text>
                    <Space wrap>
                      {apiKeys.filter((k) => k.isActive).map((k) => (
                        <Button
                          key={k.id}
                          type={selectedKey === k.key ? 'primary' : 'default'}
                          onClick={() => setSelectedKey(k.key)}
                          style={{ fontFamily: 'monospace', fontSize: 12 }}
                        >
                          <Tag color={k.environment === 'LIVE' ? 'red' : 'blue'} style={{ margin: 0 }}>
                            {k.environment}
                          </Tag>
                          {'  '}{k.key.slice(0, 20)}...
                        </Button>
                      ))}
                    </Space>
                  </Card>
                )}

                {/* Luồng tích hợp */}
                <Card title="📋 Luồng tích hợp" style={{ marginBottom: 20, borderRadius: 12 }}>
                  <Row gutter={[16, 16]}>
                    {[
                      { step: 1, title: 'Tạo thanh toán', desc: 'Backend gọi API tạo giao dịch, nhận transactionId' },
                      { step: 2, title: 'Redirect khách', desc: `Gửi khách đến ${BASE_URL}/pay/{transactionId}` },
                      { step: 3, title: 'Khách chuyển USDT', desc: 'Khách dùng ví TRC20 quét QR và chuyển tiền' },
                      { step: 4, title: 'Nhận Webhook', desc: 'Server nhận callback, cập nhật đơn hàng' },
                    ].map((item) => (
                      <Col xs={24} sm={12} key={item.step}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%', background: '#1677ff',
                            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, flexShrink: 0,
                          }}>
                            {item.step}
                          </div>
                          <div>
                            <Text strong style={{ display: 'block' }}>{item.title}</Text>
                            <Text type="secondary" style={{ fontSize: 13 }}>{item.desc}</Text>
                          </div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                </Card>

                {/* Code tạo thanh toán */}
                <Card title={<Space><CodeOutlined />Bước 1 — Tạo yêu cầu thanh toán</Space>} style={{ marginBottom: 16, borderRadius: 12 }}>
                  <CodeBlock code={samples[lang].create} lang={lang} />
                  <Alert
                    type="success" showIcon
                    message="Response trả về"
                    description={
                      <CodeBlock code={`{
  "success": true,
  "data": {
    "id":          "txn_abc123",
    "orderId":     "ORDER-2024-001",
    "amount":      "100.000000",
    "fee":         "1.000000",
    "netAmount":   "99.000000",
    "toAddress":   "TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "status":      "PENDING",
    "expiredAt":   "2024-01-01T00:30:00.000Z",
    "environment": "LIVE"
  }
}`} lang="json" />
                    }
                  />
                </Card>

                {/* Redirect */}
                <Card title="Bước 2 — Hiển thị trang thanh toán" style={{ marginBottom: 16, borderRadius: 12 }}>
                  <Tabs defaultActiveKey="redirect" size="small" items={[
                    {
                      key: 'redirect', label: 'Redirect',
                      children: <CodeBlock code={`// Option A: Redirect toàn trang
window.location.href = '${BASE_URL}/pay/{transactionId}';

// Option B: Mở popup
window.open(
  '${BASE_URL}/pay/{transactionId}',
  'payment',
  'width=520,height=640,scrollbars=no'
);`} />,
                    },
                    {
                      key: 'iframe', label: 'Nhúng iFrame',
                      children: <CodeBlock lang="html" code={`<iframe
  src="${BASE_URL}/pay/{transactionId}"
  width="100%"
  height="620"
  frameborder="0"
  allow="clipboard-write"
  style="border-radius: 16px; max-width: 480px; display: block; margin: 0 auto;"
></iframe>`} />,
                    },
                  ]} />
                </Card>
              </div>
            ),
          },

          // ── Tab 2: Webhook ──────────────────────────────────────────────
          {
            key: 'webhook',
            label: <Space><SafetyOutlined />Webhook</Space>,
            children: (
              <div>
                <Alert
                  type="info" showIcon style={{ marginBottom: 20 }}
                  message="Webhook là cách chính thức để nhận kết quả thanh toán"
                  description="Hệ thống sẽ gọi callback URL bạn đã đặt trong Hồ sơ khi giao dịch hoàn thành. Webhook được retry 3 lần nếu server không trả 200 OK."
                />

                <Card title="📨 Payload mẫu" style={{ marginBottom: 16, borderRadius: 12 }}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                    POST request gửi đến Callback URL của bạn:
                  </Text>
                  <CodeBlock code={`// Headers
POST https://yoursite.com/webhook/payment
Content-Type: application/json
X-Webhook-Signature: a1b2c3d4e5f6...  ← HMAC-SHA256

// Body
{
  "event":         "payment.completed",
  "transactionId": "txn_abc123",
  "orderId":       "ORDER-2024-001",
  "amount":        "100.000000",
  "fee":           "1.000000",
  "netAmount":     "99.000000",
  "txHash":        "abc123blockchain...",
  "status":        "COMPLETED",
  "confirmedAt":   "2024-01-01T00:10:00.000Z"
}`} />
                </Card>

                <Card title="🔐 Xác minh chữ ký (bắt buộc)" style={{ marginBottom: 16, borderRadius: 12 }}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                    Webhook Secret lấy tại: <Text code>Hồ sơ → Webhook Secret</Text>
                  </Text>
                  <CodeBlock code={samples[lang].webhook} lang={lang} />
                  <Alert
                    type="warning" showIcon style={{ marginTop: 12 }}
                    message="Luôn xác minh signature trước khi xử lý webhook để tránh giả mạo"
                  />
                </Card>

                <Card title="🔁 Chống tạo trùng giao dịch (Idempotency-Key)" style={{ marginBottom: 16, borderRadius: 12 }}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                    Khi gọi <Text code>POST /transactions/pay</Text>, có thể gửi kèm header <Text code>Idempotency-Key</Text> (tự sinh, khuyến khích UUID) để chống tạo trùng giao dịch nếu phải gọi lại do timeout mạng/mất kết nối.
                  </Text>
                  <CodeBlock code={`curl -X POST ${BASE_URL}/api/v1/transactions/pay \\
  -H "x-api-key: ${displayKey}" \\
  -H "x-api-secret: ${displaySecret}" \\
  -H "Idempotency-Key: 3f29a1c4-8b2e-4e11-9d0a-6c7f1e2b9a01" \\
  -H "Content-Type: application/json" \\
  -d '{"orderId":"ORDER-2024-001","amount":100}'`} lang="curl" />
                  <Alert
                    type="info" showIcon style={{ marginTop: 12 }}
                    message="Gọi lại với cùng Idempotency-Key + cùng nội dung request → trả lại đúng kết quả cũ (không tạo giao dịch mới)."
                    description={
                      <>
                        Không bắt buộc — không gửi header này vẫn hoạt động bình thường như trước.
                        Nếu gửi cùng key nhưng nội dung request khác (vd: đổi amount) → API trả lỗi 409, hãy dùng key mới cho mỗi giao dịch khác nhau.
                        Kết quả được lưu lại 24 giờ.
                      </>
                    }
                  />
                </Card>

                <Card title="✅ Best practices" style={{ borderRadius: 12 }}>
                  {[
                    ['Idempotent', 'Kiểm tra transactionId đã xử lý chưa trước khi update DB'],
                    ['Return 200 nhanh', 'Trả về 200 OK ngay, xử lý logic ở background nếu cần'],
                    ['Lưu payload', 'Ghi log toàn bộ webhook payload để debug sau'],
                    ['Không tin amount', 'Luôn kiểm tra amount từ DB của bạn, không dùng giá trị từ webhook để tính toán'],
                    ['Retry handling', 'Webhook được gửi lại 3 lần — đảm bảo handler chạy đúng khi gọi nhiều lần'],
                  ].map(([title, desc]) => (
                    <div key={title} style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start' }}>
                      <CheckOutlined style={{ color: '#52c41a', marginTop: 2 }} />
                      <div>
                        <Text strong>{title}: </Text>
                        <Text type="secondary">{desc}</Text>
                      </div>
                    </div>
                  ))}
                </Card>
              </div>
            ),
          },

          // ── Tab 3: API Reference ────────────────────────────────────────
          {
            key: 'reference',
            label: <Space><CodeOutlined />API Reference</Space>,
            children: (
              <div>
                <Alert
                  type="info" showIcon style={{ marginBottom: 16 }}
                  message={<>Base URL: <Text code>{BASE_URL}/api/v1</Text> — Bấm vào từng endpoint để xem chi tiết</>}
                />

                <Title level={5} style={{ color: '#666', marginBottom: 8 }}>THANH TOÁN</Title>

                <EndpointCard
                  method="POST" path="/transactions/pay" title="Tạo yêu cầu thanh toán"
                  description="Tạo một giao dịch mới. Merchant backend gọi endpoint này khi khách chọn thanh toán bằng USDT."
                  body={[
                    { name: 'orderId', type: 'string', required: true, desc: 'Mã đơn hàng duy nhất của bạn (max 100 ký tự)' },
                    { name: 'amount', type: 'number', required: true, desc: 'Số tiền USDT (tối thiểu 1.0)' },
                    { name: 'returnUrl', type: 'string', required: false, desc: 'URL redirect sau khi thanh toán xong' },
                    { name: 'metadata', type: 'object', required: false, desc: 'Dữ liệu tùy ý (userId, productId...)' },
                  ]}
                  response={`{
  "success": true,
  "data": {
    "id":          "txn_abc123",
    "orderId":     "ORDER-001",
    "amount":      "100.000000",
    "fee":         "1.000000",
    "netAmount":   "99.000000",
    "toAddress":   "TRxxxx...",
    "status":      "PENDING",
    "expiredAt":   "2024-01-01T00:30:00Z",
    "environment": "LIVE"
  }
}`}
                  notes="orderId phải unique. Nếu đã tồn tại giao dịch PENDING với orderId này, API trả 409."
                />

                <EndpointCard
                  method="GET" path="/pay/:transactionId" title="Kiểm tra trạng thái (Public)"
                  description="Endpoint public — không cần auth. Dùng để khách hàng hoặc frontend của bạn kiểm tra trạng thái."
                  params={[
                    { name: 'transactionId', type: 'string', required: true, desc: 'ID giao dịch từ bước tạo thanh toán' },
                  ]}
                  response={`{
  "success": true,
  "data": {
    "id":                    "txn_abc123",
    "orderId":               "ORDER-001",
    "amount":                "100.000000",
    "toAddress":             "TRxxxx...",
    "status":                "CONFIRMING",
    "confirmations":         15,
    "requiredConfirmations": 20,
    "expiredAt":             "2024-01-01T00:30:00Z",
    "confirmedAt":           null
  }
}`}
                />

                <EndpointCard
                  method="GET" path="/transactions" title="Lịch sử giao dịch"
                  description="Lấy danh sách giao dịch của merchant. Yêu cầu JWT Bearer token."
                  params={[
                    { name: 'page', type: 'number', required: false, desc: 'Trang hiện tại (mặc định 1)' },
                    { name: 'limit', type: 'number', required: false, desc: 'Số bản ghi mỗi trang (mặc định 20)' },
                    { name: 'status', type: 'string', required: false, desc: 'Lọc theo trạng thái: PENDING | CONFIRMING | COMPLETED | EXPIRED | FAILED' },
                    { name: 'startDate', type: 'string', required: false, desc: 'Từ ngày (ISO 8601)' },
                    { name: 'endDate', type: 'string', required: false, desc: 'Đến ngày (ISO 8601)' },
                  ]}
                  response={`{
  "success": true,
  "data": [...],
  "meta": {
    "page": 1, "limit": 20,
    "total": 150, "totalPages": 8
  }
}`}
                />

                <Title level={5} style={{ color: '#666', margin: '20px 0 8px' }}>XÁC THỰC</Title>

                <EndpointCard
                  method="POST" path="/auth/login" title="Đăng nhập lấy JWT Token"
                  description="Lấy access token để gọi các API yêu cầu xác thực (xem lịch sử, rút tiền...)"
                  body={[
                    { name: 'email', type: 'string', required: true, desc: 'Email tài khoản merchant' },
                    { name: 'password', type: 'string', required: true, desc: 'Mật khẩu' },
                    { name: 'twoFactorToken', type: 'string', required: false, desc: 'Mã OTP nếu đã bật 2FA' },
                  ]}
                  response={`{
  "success": true,
  "data": {
    "accessToken":  "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "user": { "id": "...", "email": "...", "role": "MERCHANT" }
  }
}`}
                  notes="accessToken hết hạn sau 15 phút. Dùng /auth/refresh để gia hạn bằng refreshToken."
                />

                <Title level={5} style={{ color: '#666', margin: '20px 0 8px' }}>RÚT TIỀN</Title>

                <EndpointCard
                  method="POST" path="/withdrawals" title="Tạo yêu cầu rút tiền"
                  description="Yêu cầu rút số dư USDT về ví TRC20 của bạn. Cần JWT Bearer token."
                  body={[
                    { name: 'toAddress', type: 'string', required: true, desc: 'Địa chỉ ví TRC20 nhận tiền' },
                    { name: 'amount', type: 'number', required: true, desc: 'Số tiền USDT muốn rút' },
                    { name: 'note', type: 'string', required: false, desc: 'Ghi chú (tuỳ chọn)' },
                  ]}
                  response={`{
  "success": true,
  "data": {
    "id":        "wd_xxx",
    "amount":    "500.000000",
    "fee":       "2.500000",
    "netAmount": "497.500000",
    "status":    "PENDING",
    "requiresDualApproval": true
  }
}`}
                  notes="Yêu cầu ≥ 1000 USDT cần 2 admin duyệt (dual approval). Hạn mức mặc định: 10,000 USDT/ngày."
                />

                <Divider />

                <Title level={5} style={{ color: '#666', marginBottom: 12 }}>Trạng thái giao dịch</Title>
                <Table
                  dataSource={[
                    { status: 'PENDING', color: 'orange', desc: 'Đang chờ khách chuyển tiền', action: 'Khách chuyển USDT đến địa chỉ' },
                    { status: 'CONFIRMING', color: 'blue', desc: 'Đã nhận tiền, đang xác nhận blockchain', action: 'Đợi đủ số block xác nhận' },
                    { status: 'COMPLETED', color: 'green', desc: 'Hoàn thành, tiền vào tài khoản', action: 'Cập nhật đơn hàng thành công' },
                    { status: 'EXPIRED', color: 'red', desc: 'Hết hạn 30 phút không nhận được tiền', action: 'Tạo giao dịch mới nếu cần' },
                    { status: 'FAILED', color: 'red', desc: 'Giao dịch thất bại', action: 'Liên hệ admin' },
                  ]}
                  columns={[
                    { title: 'Status', dataIndex: 'status', render: (v, r: {color: string}) => <Tag color={r.color}>{v}</Tag> },
                    { title: 'Ý nghĩa', dataIndex: 'desc' },
                    { title: 'Hành động', dataIndex: 'action' },
                  ] as ColumnType<{status: string; color: string; desc: string; action: string}>[]}
                  rowKey="status"
                  size="small"
                  pagination={false}
                />

                <Divider />

                <Title level={5} style={{ color: '#666', marginBottom: 12 }}>Mã lỗi</Title>
                <Table
                  dataSource={[
                    { code: '400', error: 'Validation Error', cause: 'Thiếu trường bắt buộc hoặc giá trị không hợp lệ', fix: 'Kiểm tra lại body request' },
                    { code: '401', error: 'Unauthorized', cause: 'API key/secret sai hoặc thiếu', fix: 'Kiểm tra x-api-key và x-api-secret' },
                    { code: '403', error: 'IP Forbidden', cause: 'IP không trong whitelist', fix: 'Thêm IP vào whitelist trong Hồ sơ' },
                    { code: '409', error: 'Conflict', cause: 'orderId đã tồn tại trong giao dịch đang chờ', fix: 'Dùng orderId khác hoặc kiểm tra giao dịch cũ' },
                    { code: '429', error: 'Rate Limited', cause: 'Vượt 60 request/phút', fix: 'Giảm tần suất gọi API hoặc dùng queue' },
                    { code: '503', error: 'No Wallet', cause: 'Không có ví HOT khả dụng', fix: 'Liên hệ admin để thêm ví' },
                  ]}
                  columns={[
                    { title: 'HTTP', dataIndex: 'code', render: (v) => <Badge status={v.startsWith('4') ? 'error' : 'warning'} text={v} /> },
                    { title: 'Lỗi', dataIndex: 'error', render: (v) => <Tag color="red">{v}</Tag> },
                    { title: 'Nguyên nhân', dataIndex: 'cause' },
                    { title: 'Xử lý', dataIndex: 'fix' },
                  ] as ColumnType<{code: string; error: string; cause: string; fix: string}>[]}
                  rowKey="code"
                  size="small"
                  pagination={false}
                />
              </div>
            ),
          },

          // ── Tab 4: Sandbox ──────────────────────────────────────────────
          {
            key: 'sandbox',
            label: <Space><ExperimentOutlined />Sandbox</Space>,
            children: (
              <div>
                <Alert
                  type="info" showIcon style={{ marginBottom: 20 }}
                  message="Môi trường Sandbox — test hoàn toàn miễn phí, không cần USDT thật"
                />

                <Card title="Tạo API Key Sandbox" style={{ marginBottom: 16, borderRadius: 12 }}>
                  <ol style={{ paddingLeft: 20 }}>
                    <li>Vào <Text strong>API Keys</Text> → <Text strong>Tạo API Key</Text></li>
                    <li>Chọn môi trường <Tag color="blue">SANDBOX</Tag></li>
                    <li>Lưu lại API Key (bắt đầu bằng <Text code>sk_test_</Text>) và Secret</li>
                  </ol>
                </Card>

                <Card title="Test tạo thanh toán" style={{ marginBottom: 16, borderRadius: 12 }}>
                  <CodeBlock code={`# Dùng sk_test_ key để tạo giao dịch test
curl -X POST ${BASE_URL}/api/v1/transactions/pay \\
  -H "x-api-key: sk_test_xxxxxxxx" \\
  -H "x-api-secret: YOUR_SANDBOX_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{
    "orderId": "TEST-${Date.now()}",
    "amount": 50,
    "returnUrl": "https://yoursite.com/result"
  }'`} />
                </Card>

                <Card title="Giả lập hoàn thành → Test Webhook" style={{ borderRadius: 12 }}>
                  <Paragraph type="secondary">
                    Sau khi tạo giao dịch sandbox, vào <Text strong>Dashboard → Sandbox</Text> → bấm
                    <Tag color="blue" style={{ margin: '0 4px' }}>Giả lập hoàn thành</Tag>
                    để hệ thống gọi webhook callback về server của bạn — giống hệt giao dịch thật.
                  </Paragraph>
                  <Alert
                    type="success" showIcon
                    message="Điểm khác biệt Sandbox vs LIVE"
                    description={
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        <li>API Key prefix: <Text code>sk_test_</Text> (sandbox) vs <Text code>mk_live_</Text> (live)</li>
                        <li>Không chạm blockchain thật — không cần USDT</li>
                        <li>Số dư sandbox riêng biệt, không liên quan số dư thật</li>
                        <li>Cùng format response và webhook — test 1:1 với production</li>
                      </ul>
                    }
                  />
                </Card>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
