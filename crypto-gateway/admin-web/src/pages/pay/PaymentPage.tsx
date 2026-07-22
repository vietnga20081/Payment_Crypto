import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Typography, Steps, Result, Spin, Alert, Tag, Button, Space } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, CopyOutlined, LoadingOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text, Paragraph } = Typography;

interface PaymentInfo {
  id: string;
  orderId: string;
  amount: string;
  fee: string;
  netAmount: string;
  toAddress: string | null;
  network: 'TRC20' | 'BEP20' | null;
  status: 'PENDING' | 'CONFIRMING' | 'COMPLETED' | 'EXPIRED' | 'FAILED';
  confirmations: number;
  requiredConfirmations: number;
  expiredAt: string;
  confirmedAt?: string;
  returnUrl?: string;
  networkFeeNotes?: { TRC20: string | null; BEP20: string | null };
}

const statusConfig = {
  PENDING:    { color: '#fa8c16', label: 'Chờ thanh toán',    icon: <ClockCircleOutlined /> },
  CONFIRMING: { color: '#1677ff', label: 'Đang xác nhận',     icon: <LoadingOutlined spin /> },
  COMPLETED:  { color: '#52c41a', label: 'Hoàn thành',        icon: <CheckCircleOutlined /> },
  EXPIRED:    { color: '#ff4d4f', label: 'Hết hạn',           icon: <CloseCircleOutlined /> },
  FAILED:     { color: '#ff4d4f', label: 'Thất bại',          icon: <CloseCircleOutlined /> },
};

function Countdown({ expiredAt }: { expiredAt: string }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(expiredAt).getTime() - Date.now()) / 1000));
      setRemaining(diff);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [expiredAt]);

  const m = Math.floor(remaining / 60).toString().padStart(2, '0');
  const s = (remaining % 60).toString().padStart(2, '0');
  const isLow = remaining < 120;

  return (
    <Text style={{ fontSize: 28, fontWeight: 700, color: isLow ? '#ff4d4f' : '#1677ff', fontFamily: 'monospace' }}>
      {m}:{s}
    </Text>
  );
}

function QRCodeDisplay({ address, amount, network }: { address: string; amount: string; network?: 'TRC20' | 'BEP20' }) {
  // TRON ví hỗ trợ URI scheme "tron:" kèm amount. Với BEP20 (EVM), ví thường chỉ
  // quét địa chỉ thô — mã hoá số tiền USDT-BEP20 cần EIP-681 + contract call data
  // phức tạp hơn nên tạm thời chỉ encode địa chỉ để đảm bảo tương thích rộng nhất.
  const qrData = network === 'BEP20' ? address : `tron:${address}?amount=${amount}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrData)}`;
  return (
    <img src={qrUrl} alt="QR Code" width={180} height={180}
      style={{ borderRadius: 8, border: '1px solid #f0f0f0' }} />
  );
}

export default function PaymentPage() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const [payment, setPayment] = useState<PaymentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<'address' | 'amount' | null>(null);
  const [selecting, setSelecting] = useState<'TRC20' | 'BEP20' | null>(null);
  const [selectError, setSelectError] = useState('');

  const selectNetwork = async (network: 'TRC20' | 'BEP20') => {
    setSelecting(network);
    setSelectError('');
    try {
      const res = await axios.post(`/api/v1/pay/${transactionId}/select-network`, { network });
      setPayment(res.data.data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setSelectError(err.response?.data?.message || 'Chọn mạng thất bại, thử lại');
    } finally {
      setSelecting(null);
    }
  };

  const fetchPayment = useCallback(async () => {
    try {
      const res = await axios.get(`/api/v1/pay/${transactionId}`);
      setPayment(res.data.data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message || 'Không tìm thấy giao dịch');
    } finally {
      setLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    fetchPayment();
    // Poll every 5s while pending/confirming
    const timer = setInterval(() => {
      if (payment?.status === 'COMPLETED' || payment?.status === 'EXPIRED' || payment?.status === 'FAILED') return;
      fetchPayment();
    }, 5000);
    return () => clearInterval(timer);
  }, [fetchPayment, payment?.status]);

  // Auto-redirect after completion
  useEffect(() => {
    if (payment?.status === 'COMPLETED' && payment.returnUrl) {
      const timer = setTimeout(() => {
        window.location.href = payment.returnUrl!;
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [payment?.status, payment?.returnUrl]);

  const copy = (text: string, type: 'address' | 'amount') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spin size="large" />
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Result status="error" title="Không tìm thấy giao dịch" subTitle={error} />
    </div>
  );

  if (!payment) return null;

  const cfg = statusConfig[payment.status];

  // ── COMPLETED ──────────────────────────────────────────────────────────────
  if (payment.status === 'COMPLETED') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: '#f6ffed' }}>
        <Card style={{ maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 16 }}>
          <Result
            status="success"
            icon={<CheckCircleOutlined style={{ color: '#52c41a', fontSize: 64 }} />}
            title="Thanh toán thành công!"
            subTitle={
              <Space direction="vertical">
                <Text>Số tiền: <Text strong>{Number(payment.amount).toFixed(2)} USDT</Text></Text>
                <Text type="secondary">Mã đơn: {payment.orderId}</Text>
                {payment.returnUrl && <Text type="secondary">Đang chuyển hướng về trang mua hàng...</Text>}
              </Space>
            }
          />
          {payment.returnUrl && (
            <Button type="primary" onClick={() => window.location.href = payment.returnUrl!}>
              Quay về trang mua hàng
            </Button>
          )}
        </Card>
      </div>
    );
  }

  // ── EXPIRED / FAILED ───────────────────────────────────────────────────────
  if (payment.status === 'EXPIRED' || payment.status === 'FAILED') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Card style={{ maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 16 }}>
          <Result
            status="error"
            title={payment.status === 'EXPIRED' ? 'Giao dịch đã hết hạn' : 'Giao dịch thất bại'}
            subTitle="Vui lòng quay lại trang mua hàng và tạo đơn hàng mới."
          />
          {payment.returnUrl && (
            <Button onClick={() => window.location.href = payment.returnUrl!}>
              Quay về trang mua hàng
            </Button>
          )}
        </Card>
      </div>
    );
  }

  // ── Chưa chọn mạng nhận tiền — hiện màn hình chọn TRC20/BEP20 ───────────────
  if (payment.status === 'PENDING' && !payment.network) {
    return (
      <div style={{
        minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c29, #302b63)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}>
        <Card style={{ maxWidth: 420, width: '100%', borderRadius: 16 }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <Title level={4} style={{ margin: 0 }}>Chọn mạng nhận tiền</Title>
            <Text type="secondary">Đơn hàng: {payment.orderId} — {Number(payment.amount).toFixed(2)} USDT</Text>
          </div>

          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Button
              block size="large" loading={selecting === 'TRC20'} disabled={!!selecting}
              onClick={() => selectNetwork('TRC20')}
              style={{ height: 72, textAlign: 'left', display: 'flex', alignItems: 'center' }}
            >
              <Space direction="vertical" size={0} style={{ textAlign: 'left' }}>
                <Text strong>USDT — TRC20 (TRON)</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>TronLink, Trust Wallet, Binance...</Text>
                {payment.networkFeeNotes?.TRC20 && (
                  <Text type="secondary" style={{ fontSize: 11 }}>Phí mạng: {payment.networkFeeNotes.TRC20}</Text>
                )}
              </Space>
            </Button>

            <Button
              block size="large" loading={selecting === 'BEP20'} disabled={!!selecting}
              onClick={() => selectNetwork('BEP20')}
              style={{ height: 72, textAlign: 'left', display: 'flex', alignItems: 'center' }}
            >
              <Space direction="vertical" size={0} style={{ textAlign: 'left' }}>
                <Text strong>USDT — BEP20 (BNB Smart Chain)</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>MetaMask, Trust Wallet, Binance...</Text>
                {payment.networkFeeNotes?.BEP20 && (
                  <Text type="secondary" style={{ fontSize: 11 }}>Phí mạng: {payment.networkFeeNotes.BEP20}</Text>
                )}
              </Space>
            </Button>
          </Space>

          {selectError && <Alert type="error" showIcon message={selectError} style={{ marginTop: 16 }} />}

          <div style={{ background: '#fafafa', borderRadius: 8, padding: 12, marginTop: 16 }}>
            <Text style={{ fontSize: 12 }}>
              Số tiền chuyển: <Text strong>{Number(payment.amount).toFixed(2)} USDT</Text>
              {Number(payment.fee) > 0 && (
                <> — sau phí dịch vụ, bạn sẽ được cộng <Text strong>{Number(payment.netAmount).toFixed(2)} USDT</Text></>
              )}
            </Text>
          </div>

          <Paragraph type="secondary" style={{ fontSize: 12, textAlign: 'center', marginTop: 12, marginBottom: 0 }}>
            Chọn đúng mạng bạn sẽ dùng để chuyển tiền. Phí mạng ở trên là phí blockchain bạn tự trả bằng TRX/BNB — không trừ vào số USDT chuyển.
          </Paragraph>
        </Card>
      </div>
    );
  }

  // ── PENDING / CONFIRMING ────────────────────────────────────────────────────
  const stepCurrent = payment.status === 'CONFIRMING' ? 1 : 0;

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c29, #302b63)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <Card style={{ maxWidth: 480, width: '100%', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0 }}>⚡ Thanh toán USDT {payment.network || 'TRC20'}</Title>
          <Text type="secondary">Mã đơn: <Text code>{payment.orderId}</Text></Text>
        </div>

        {/* Status */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <Tag color={cfg.color} icon={cfg.icon} style={{ fontSize: 14, padding: '4px 12px' }}>
            {cfg.label}
          </Tag>
        </div>

        {/* Steps */}
        <Steps
          current={stepCurrent}
          size="small"
          style={{ marginBottom: 24 }}
          items={[
            { title: 'Chuyển tiền' },
            { title: 'Xác nhận blockchain' },
            { title: 'Hoàn thành' },
          ]}
        />

        {/* Countdown (only while PENDING) */}
        {payment.status === 'PENDING' && (
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Thời gian còn lại</Text>
            <Countdown expiredAt={payment.expiredAt} />
          </div>
        )}

        {/* Confirming progress */}
        {payment.status === 'CONFIRMING' && (
          <Alert
            type="info" showIcon
            message={`Đang xác nhận: ${payment.confirmations}/${payment.requiredConfirmations} blocks`}
            description="Vui lòng chờ blockchain xác nhận giao dịch. Không cần làm gì thêm."
            style={{ marginBottom: 20 }}
          />
        )}

        {/* Amount */}
        <div style={{ background: '#f5f5f5', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Số tiền cần chuyển</Text>
              <Text style={{ fontSize: 28, fontWeight: 700, color: '#1677ff' }}>
                {Number(payment.amount).toFixed(6)}
              </Text>
              <Text style={{ fontSize: 18, color: '#666' }}> USDT</Text>
            </div>
            <Button
              icon={<CopyOutlined />}
              onClick={() => copy(payment.amount, 'amount')}
              type={copied === 'amount' ? 'primary' : 'default'}
            >
              {copied === 'amount' ? 'Đã sao chép!' : 'Sao chép'}
            </Button>
          </div>
          <Alert
            type="warning" showIcon style={{ marginTop: 8 }}
            message="Chuyển đúng số tiền trên. Sai số tiền sẽ không được xác nhận."
          />
        </div>

        {/* Fee breakdown */}
        {(Number(payment.fee) > 0 || payment.networkFeeNotes?.[payment.network!]) && (
          <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            {Number(payment.fee) > 0 && (
              <Text style={{ fontSize: 13, display: 'block' }}>
                Sau phí dịch vụ, bạn sẽ được cộng <Text strong>{Number(payment.netAmount).toFixed(2)} USDT</Text> vào tài khoản
                <Text type="secondary"> (phí dịch vụ: {Number(payment.fee).toFixed(2)} USDT)</Text>
              </Text>
            )}
            {payment.network && payment.networkFeeNotes?.[payment.network] && (
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: Number(payment.fee) > 0 ? 6 : 0 }}>
                Phí mạng ({payment.network}, bạn tự trả từ ví, không trừ vào USDT): {payment.networkFeeNotes[payment.network]}
              </Text>
            )}
          </div>
        )}

        {/* Address + QR */}
        <div style={{ background: '#f5f5f5', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            Địa chỉ ví {payment.network || 'TRC20'} (USDT)
          </Text>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <QRCodeDisplay address={payment.toAddress!} amount={payment.amount} network={payment.network!} />
            <div style={{ flex: 1 }}>
              <Paragraph
                code
                copyable={{ text: payment.toAddress!, tooltips: ['Sao chép địa chỉ', 'Đã sao chép!'] }}
                style={{ wordBreak: 'break-all', fontSize: 13, marginBottom: 8 }}
              >
                {payment.toAddress}
              </Paragraph>
              <Button
                type="primary" block icon={<CopyOutlined />}
                onClick={() => copy(payment.toAddress!, 'address')}
              >
                {copied === 'address' ? '✓ Đã sao chép!' : 'Sao chép địa chỉ'}
              </Button>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <Alert
          type="info" showIcon
          message="Hướng dẫn thanh toán"
          description={
            <ol style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
              <li>
                {payment.network === 'BEP20'
                  ? 'Mở ví hỗ trợ BSC của bạn (Trust Wallet, MetaMask, Binance...)'
                  : 'Mở ví TRC20 của bạn (TronLink, Trust Wallet...)'}
              </li>
              <li>Chọn token <strong>USDT {payment.network || 'TRC20'}</strong> {payment.network === 'BEP20' ? '(mạng BNB Smart Chain — BEP20)' : '(mạng TRON)'}</li>
              <li>Chuyển chính xác <strong>{Number(payment.amount).toFixed(6)} USDT</strong> đến địa chỉ trên</li>
              <li>Đợi xác nhận từ blockchain (~1-3 phút)</li>
            </ol>
          }
        />

        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 16, fontSize: 12 }}>
          Trang tự động cập nhật mỗi 5 giây
        </Text>
      </Card>
    </div>
  );
}
