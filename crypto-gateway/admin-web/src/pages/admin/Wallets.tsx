import { useState } from 'react';
import { Table, Button, Tag, Space, Modal, Form, Input, Select, Typography, message, Switch, Card, Statistic, Row, Col, Alert, Popconfirm } from 'antd';
import type { ColumnType } from 'antd/es/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { walletService } from '../../services';
import { formatDate, formatUSDT, shortAddress } from '../../utils';
import type { Wallet } from '../../types';
import { PlusOutlined, CopyOutlined, SwapOutlined, KeyOutlined } from '@ant-design/icons';

export default function WalletsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [networkFilter, setNetworkFilter] = useState<string | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();
  const [showRotation, setShowRotation] = useState(false);

  // ── Export private key — 2 kênh OTP (Telegram + Email) ──────────────────
  const [exportWallet, setExportWallet] = useState<Wallet | null>(null);
  const [exportRequestId, setExportRequestId] = useState<string | null>(null);
  const [exportedKey, setExportedKey] = useState<{ address: string; network: string; privateKey: string } | null>(null);
  const [otpForm] = Form.useForm();

  const requestExportMutation = useMutation({
    mutationFn: (walletId: string) => walletService.requestExportKey(walletId),
    onSuccess: (res) => {
      setExportRequestId(res.data.data.requestId);
      message.success('Đã gửi OTP qua Telegram và Email — kiểm tra cả 2 kênh');
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      message.error(e.response?.data?.message || 'Lỗi gửi OTP'),
  });

  const verifyExportMutation = useMutation({
    mutationFn: ({ telegramCode, emailCode }: { telegramCode: string; emailCode: string }) =>
      walletService.verifyExportKey(exportWallet!.id, exportRequestId!, telegramCode, emailCode),
    onSuccess: (res) => {
      setExportedKey(res.data.data);
      otpForm.resetFields();
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      message.error(e.response?.data?.message || 'Mã xác thực không đúng'),
  });

  const closeExportModal = () => {
    setExportWallet(null);
    setExportRequestId(null);
    setExportedKey(null);
    otpForm.resetFields();
  };

  const { data, isLoading } = useQuery({
    queryKey: ['wallets', page, networkFilter],
    queryFn: () => walletService.list({ page, limit: 20, network: networkFilter as 'TRC20' | 'BEP20' | undefined }).then((r) => r.data),
  });

  const { data: rotationStats } = useQuery({
    queryKey: ['rotation-stats'],
    queryFn: () => walletService.getRotationStats().then((r) => r.data.data),
    enabled: showRotation,
  });

  const createMutation = useMutation({
    mutationFn: (values: { label?: string; type?: string; network?: string }) => walletService.create(values as { label?: string; type?: string; network?: 'TRC20' | 'BEP20' }),
    onSuccess: () => {
      message.success('Tạo ví thành công');
      qc.invalidateQueries({ queryKey: ['wallets'] });
      setCreateOpen(false);
      form.resetFields();
    },
  });

  const rotationMutation = useMutation({
    mutationFn: ({ id, inRotation }: { id: string; inRotation: boolean }) => walletService.setRotation(id, inRotation),
    onSuccess: () => {
      message.success('Đã cập nhật');
      qc.invalidateQueries({ queryKey: ['wallets'] });
      qc.invalidateQueries({ queryKey: ['rotation-stats'] });
    },
  });

  const typeColor: Record<string, string> = { HOT: 'red', COLD: 'blue', MERCHANT: 'green', SWEEP: 'purple' };
  const networkColor: Record<string, string> = { TRC20: 'volcano', BEP20: 'gold' };

  const columns: ColumnType<Wallet>[] = [
    {
      title: 'Địa chỉ', dataIndex: 'address',
      render: (v: string) => (
        <Space>
          <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{shortAddress(v)}</span>
          <Button size="small" icon={<CopyOutlined />} onClick={() => { navigator.clipboard.writeText(v); message.success('Đã sao chép'); }} />
        </Space>
      ),
    },
    { title: 'Mạng', dataIndex: 'network', render: (v: string) => <Tag color={networkColor[v] || 'default'}>{v || 'TRC20'}</Tag> },
    { title: 'Loại', dataIndex: 'type', render: (v: string) => <Tag color={typeColor[v]}>{v}</Tag> },
    { title: 'Số dư', dataIndex: 'balance', render: (v: string) => formatUSDT(v) },
    { title: 'Nhãn', dataIndex: 'label', render: (v?: string) => v || '-' },
    {
      title: 'Rotation', dataIndex: 'inRotation',
      render: (v: boolean, r: Wallet) => r.type === 'HOT' ? (
        <Switch checked={v} size="small" loading={rotationMutation.isPending}
          onChange={(checked) => rotationMutation.mutate({ id: r.id, inRotation: checked })} />
      ) : '-',
    },
    { title: 'Đã gán', dataIndex: 'assignedCount', responsive: ['lg'] as ('xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl')[], render: (v?: number) => v ?? '-' },
    { title: 'Trạng thái', dataIndex: 'isActive', render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'Hoạt động' : 'Tắt'}</Tag> },
    { title: 'Ngày tạo', dataIndex: 'createdAt', render: formatDate, responsive: ['md'] as ('xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl')[] },
    {
      title: 'Thao tác', key: 'actions',
      render: (_: unknown, r: Wallet) => (
        <Button size="small" danger icon={<KeyOutlined />} onClick={() => setExportWallet(r)}>
          Export Key
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Quản lý Ví</Typography.Title>
        <Space>
          <Select
            allowClear
            placeholder="Tất cả mạng"
            style={{ width: 140 }}
            value={networkFilter}
            onChange={(v) => { setNetworkFilter(v); setPage(1); }}
            options={[
              { value: 'TRC20', label: 'TRC20 (TRON)' },
              { value: 'BEP20', label: 'BEP20 (BSC)' },
            ]}
          />
          <Button icon={<SwapOutlined />} onClick={() => setShowRotation(!showRotation)}>
            {showRotation ? 'Ẩn' : 'Xem'} Rotation Stats
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>Tạo ví mới</Button>
        </Space>
      </div>

      {showRotation && rotationStats && (
        <Card title="Phân bổ Round-Robin" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            {rotationStats.map((w) => (
              <Col xs={24} sm={12} md={8} key={w.id}>
                <Card size="small">
                  <Statistic
                    title={<span style={{ fontFamily: 'monospace', fontSize: 11 }}>{shortAddress(w.address)}</span>}
                    value={w.assignedCount || 0}
                    suffix="lượt gán"
                    valueStyle={{ fontSize: 18 }}
                  />
                  <Tag color={w.inRotation ? 'green' : 'default'} style={{ marginTop: 8 }}>
                    {w.inRotation ? 'Trong rotation' : 'Ngoài rotation'}
                  </Tag>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      <Table
        dataSource={data?.data || []}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 800 }}
        pagination={{ current: page, pageSize: 20, total: data?.meta?.total || 0, onChange: setPage }}
      />

      <Modal title="Tạo ví mới" open={createOpen} onCancel={() => { setCreateOpen(false); form.resetFields(); }}
        onOk={() => form.submit()} confirmLoading={createMutation.isPending} okText="Tạo" cancelText="Hủy">
        <Form form={form} layout="vertical" onFinish={createMutation.mutate}>
          <Form.Item name="label" label="Nhãn ví">
            <Input placeholder="VD: Ví chính" />
          </Form.Item>
          <Form.Item name="network" label="Mạng" initialValue="TRC20">
            <Select options={[
              { value: 'TRC20', label: 'TRC20 — USDT trên TRON' },
              { value: 'BEP20', label: 'BEP20 — USDT trên BSC' },
            ]} />
          </Form.Item>
          <Form.Item name="type" label="Loại ví" initialValue="HOT">
            <Select options={[
              { value: 'HOT', label: 'Hot Wallet (nhận thanh toán)' },
              { value: 'COLD', label: 'Cold Wallet (lưu trữ — đích sweep)' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Export Private Key — 2 kênh OTP bắt buộc ────────────────────── */}
      <Modal
        title={<Space><KeyOutlined /> Export Private Key</Space>}
        open={!!exportWallet}
        onCancel={closeExportModal}
        footer={null}
        destroyOnClose
      >
        {exportWallet && (
          <>
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message={<span style={{ fontFamily: 'monospace' }}>{shortAddress(exportWallet.address)} ({exportWallet.network})</span>}
              description="Private key cho phép toàn quyền kiểm soát ví này. Mọi lượt export đều được ghi lại trong Audit Logs."
            />

            {!exportedKey && !exportRequestId && (
              <Popconfirm
                title="Gửi OTP xác thực?"
                description="Hệ thống sẽ gửi 2 mã riêng biệt qua Telegram và Email của bạn. Cần nhập đúng cả 2 mã mới xem được private key."
                onConfirm={() => requestExportMutation.mutate(exportWallet.id)}
                okText="Gửi OTP"
                cancelText="Hủy"
              >
                <Button type="primary" danger icon={<KeyOutlined />} loading={requestExportMutation.isPending} block>
                  Yêu cầu OTP để export
                </Button>
              </Popconfirm>
            )}

            {exportRequestId && !exportedKey && (
              <Form form={otpForm} layout="vertical" onFinish={(v) => verifyExportMutation.mutate(v)}>
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message="OTP đã gửi — có hiệu lực trong 5 phút"
                  description="Kiểm tra tin nhắn Telegram và email của bạn để lấy 2 mã."
                />
                <Form.Item name="telegramCode" label="Mã từ Telegram" rules={[{ required: true, len: 6, message: 'Nhập đủ 6 số' }]}>
                  <Input placeholder="6 số từ Telegram" maxLength={6} />
                </Form.Item>
                <Form.Item name="emailCode" label="Mã từ Email" rules={[{ required: true, len: 6, message: 'Nhập đủ 6 số' }]}>
                  <Input placeholder="6 số từ Email" maxLength={6} />
                </Form.Item>
                <Space style={{ width: '100%' }} direction="vertical">
                  <Button type="primary" danger htmlType="submit" loading={verifyExportMutation.isPending} block>
                    Xác thực & Xem Private Key
                  </Button>
                  <Button type="link" size="small" onClick={() => requestExportMutation.mutate(exportWallet.id)} loading={requestExportMutation.isPending}>
                    Không nhận được mã? Gửi lại OTP
                  </Button>
                </Space>
              </Form>
            )}

            {exportedKey && (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Alert
                  type="error"
                  showIcon
                  message="Private Key — chỉ hiển thị 1 lần này"
                  description="Sao chép và lưu trữ an toàn ngay. Đóng cửa sổ này sẽ không xem lại được nữa (phải yêu cầu export lại từ đầu)."
                />
                <Input.Password
                  value={exportedKey.privateKey}
                  readOnly
                  visibilityToggle
                  addonAfter={
                    <CopyOutlined
                      style={{ cursor: 'pointer' }}
                      onClick={() => { navigator.clipboard.writeText(exportedKey.privateKey); message.success('Đã sao chép'); }}
                    />
                  }
                />
                <Button block onClick={closeExportModal}>Đóng</Button>
              </Space>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
