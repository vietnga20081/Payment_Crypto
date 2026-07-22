import { useEffect, useState } from 'react';
import { Card, Form, Input, InputNumber, Button, Typography, Row, Col, message, Spin, Space, Alert, Divider } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsService, authService } from '../../services';
import { useAuthStore } from '../../stores/auth.store';
import { SendOutlined } from '@ant-design/icons';
import ActiveSessionsCard from '../../components/common/ActiveSessionsCard';

interface Setting { id: string; key: string; value: string; type: string; group: string }

const groupLabel: Record<string, string> = {
  blockchain: 'Blockchain',
  payment: 'Thanh toán',
  fee: 'Phí',
  withdrawal: 'Rút tiền',
  wallet: 'Ví',
  integrations: 'Tích hợp (Telegram / Email SMTP)',
  general: 'Chung',
};

const keyLabel: Record<string, string> = {
  required_confirmations: 'Số xác nhận cần thiết',
  payment_expiry_minutes: 'Thời hạn thanh toán (phút)',
  withdrawal_fee_rate: 'Phí rút tiền (tỷ lệ)',
  default_merchant_fee_rate: 'Phí mặc định cho Đại lý tự đăng ký (tỷ lệ)',
  min_withdrawal_amount: 'Rút tối thiểu (USDT)',
  trc20_network_fee_note: 'Ghi chú phí mạng TRC20 (hiện cho khách trên trang thanh toán)',
  bep20_network_fee_note: 'Ghi chú phí mạng BEP20 (hiện cho khách trên trang thanh toán)',
  tron_node_url: 'Tron Node URL',
  usdt_contract_address: 'USDT Contract Address',
  telegram_bot_token: 'Telegram Bot Token (dùng chung cho cảnh báo + OTP export key)',
  smtp_host: 'SMTP Host',
  smtp_port: 'SMTP Port',
  smtp_secure: 'SMTP Secure (true/false — 465 dùng true, 587 dùng false)',
  smtp_user: 'SMTP User (email Gmail)',
  smtp_pass: 'SMTP Password (App Password của Gmail, không phải mật khẩu đăng nhập)',
  smtp_from: 'Gửi từ (From) — để trống sẽ dùng luôn SMTP User',
};

function TelegramChatIdCard() {
  const [form] = Form.useForm();
  const { data, isLoading } = useQuery({
    queryKey: ['my-telegram-chat-id'],
    queryFn: () => authService.getTelegramChatId().then((r) => r.data.data),
  });

  useEffect(() => {
    if (data) form.setFieldsValue({ telegramChatId: data.telegramChatId || '' });
  }, [data, form]);

  const mutation = useMutation({
    mutationFn: (telegramChatId: string) => authService.updateTelegramChatId(telegramChatId),
    onSuccess: () => message.success('Đã lưu Telegram Chat ID'),
    onError: () => message.error('Lỗi lưu Telegram Chat ID'),
  });

  return (
    <Card title="Telegram cá nhân của bạn" style={{ marginBottom: 16 }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Chat ID này dùng để nhận mã OTP riêng khi bạn export private key của ví. Mỗi admin cần Chat ID riêng của mình."
        description={
          <>
            Cách lấy Chat ID: (1) Mở Telegram, tìm bot đã cấu hình ở mục "Tích hợp" bên dưới, bấm <b>Start</b>.
            (2) Mở link <code>https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code> trên trình duyệt (thay TOKEN bằng bot token),
            tìm field <code>"chat":{'{'}"id": ...{'}'}</code> — số đó chính là Chat ID của bạn.
          </>
        }
      />
      {isLoading ? <Spin /> : (
        <Form form={form} layout="inline" onFinish={(v) => mutation.mutate(v.telegramChatId)}>
          <Form.Item name="telegramChatId" rules={[{ required: true, message: 'Nhập Chat ID' }]}>
            <Input placeholder="VD: 123456789" style={{ width: 240 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={mutation.isPending}>Lưu Chat ID</Button>
          </Form.Item>
        </Form>
      )}
    </Card>
  );
}

function IntegrationsTestPanel({ form }: { form: ReturnType<typeof Form.useForm>[0] }) {
  const currentUser = useAuthStore((s) => s.user);
  const [testEmailTo, setTestEmailTo] = useState('');
  const [testChatId, setTestChatId] = useState('');

  useEffect(() => {
    if (currentUser?.email) setTestEmailTo(currentUser.email);
  }, [currentUser]);

  const testSmtpMutation = useMutation({
    mutationFn: () => {
      const v = form.getFieldsValue() as Record<string, string | number | boolean>;
      return settingsService.testSmtp({
        host: v.smtp_host as string, port: Number(v.smtp_port), secure: v.smtp_secure === 'true' || v.smtp_secure === true,
        user: v.smtp_user as string, pass: v.smtp_pass as string, from: v.smtp_from as string, to: testEmailTo,
      });
    },
    onSuccess: (res) => message.success(res.data.message || 'Đã gửi email test'),
    onError: (e: { response?: { data?: { message?: string } } }) => message.error(e.response?.data?.message || 'Gửi test SMTP thất bại'),
  });

  const testTelegramMutation = useMutation({
    mutationFn: () => {
      const v = form.getFieldsValue() as Record<string, string | number | boolean>;
      return settingsService.testTelegram({ botToken: v.telegram_bot_token as string, chatId: testChatId });
    },
    onSuccess: (res) => message.success(res.data.message || 'Đã gửi tin nhắn test'),
    onError: (e: { response?: { data?: { message?: string } } }) => message.error(e.response?.data?.message || 'Gửi test Telegram thất bại'),
  });

  return (
    <>
      <Divider style={{ margin: '8px 0 16px' }} />
      <Typography.Text type="secondary">
        Test dùng luôn giá trị đang gõ ở trên — chưa cần bấm "Lưu cài đặt" cũng test được.
      </Typography.Text>
      <Row gutter={[16, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} md={12}>
          <Space.Compact style={{ width: '100%' }}>
            <Input placeholder="Email nhận thử" value={testEmailTo} onChange={(e) => setTestEmailTo(e.target.value)} />
            <Button icon={<SendOutlined />} loading={testSmtpMutation.isPending} onClick={() => testSmtpMutation.mutate()}>
              Test SMTP
            </Button>
          </Space.Compact>
        </Col>
        <Col xs={24} md={12}>
          <Space.Compact style={{ width: '100%' }}>
            <Input placeholder="Chat ID nhận thử" value={testChatId} onChange={(e) => setTestChatId(e.target.value)} />
            <Button icon={<SendOutlined />} loading={testTelegramMutation.isPending} onClick={() => testTelegramMutation.mutate()}>
              Test Telegram
            </Button>
          </Space.Compact>
        </Col>
      </Row>
    </>
  );
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsService.list().then((r) => r.data.data),
  });

  useEffect(() => {
    if (data) {
      const vals: Record<string, string | number> = {};
      data.forEach((s: Setting) => {
        vals[s.key] = s.type === 'number' ? Number(s.value) : s.value;
      });
      form.setFieldsValue(vals);
    }
  }, [data, form]);

  const updateMutation = useMutation({
    mutationFn: (settings: Array<{ key: string; value: string }>) => settingsService.update(settings),
    onSuccess: () => { message.success('Đã lưu cài đặt'); qc.invalidateQueries({ queryKey: ['settings'] }); },
    onError: () => message.error('Lỗi lưu cài đặt'),
  });

  const handleSubmit = (values: Record<string, string | number>) => {
    const settings = Object.entries(values).map(([key, value]) => ({ key, value: String(value) }));
    updateMutation.mutate(settings);
  };

  if (isLoading) return <Spin style={{ display: 'block', marginTop: 48 }} />;

  // referral_* đã có trang riêng (Admin → Giới thiệu), không hiện lại ở đây tránh trùng lặp
  const grouped = (data || []).filter((s: Setting) => s.group !== 'referral').reduce((acc: Record<string, Setting[]>, s: Setting) => {
    (acc[s.group] = acc[s.group] || []).push(s);
    return acc;
  }, {});

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 24 }}>Cài đặt hệ thống</Typography.Title>
      <TelegramChatIdCard />
      <div style={{ marginBottom: 16 }}>
        <ActiveSessionsCard />
      </div>
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        {Object.entries(grouped).map(([group, settings]) => (
          <Card key={group} title={groupLabel[group] || group} style={{ marginBottom: 16 }}>
            <Row gutter={[16, 0]}>
              {(settings as Setting[]).map((s) => (
                <Col xs={24} sm={12} key={s.key}>
                  <Form.Item name={s.key} label={keyLabel[s.key] || s.key}>
                    {s.type === 'number'
                      ? <InputNumber style={{ width: '100%' }} />
                      : s.type === 'password'
                      ? <Input.Password autoComplete="new-password" />
                      : <Input />
                    }
                  </Form.Item>
                </Col>
              ))}
            </Row>
            {group === 'integrations' && <IntegrationsTestPanel form={form} />}
          </Card>
        ))}
        <Button type="primary" htmlType="submit" size="large" loading={updateMutation.isPending}>
          Lưu cài đặt
        </Button>
      </Form>
    </div>
  );
}
