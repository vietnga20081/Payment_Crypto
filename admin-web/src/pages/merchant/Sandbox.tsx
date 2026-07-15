import { useState } from 'react';
import { Card, Typography, Table, Tag, Button, Alert, Space, Form, Input, InputNumber, Modal, message } from 'antd';
import type { ColumnType } from 'antd/es/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionService, merchantService } from '../../services';
import { formatDate, formatUSDT, txStatusColor, txStatusLabel } from '../../utils';
import type { Transaction } from '../../types';
import { ExperimentOutlined, PlayCircleOutlined } from '@ant-design/icons';

export default function SandboxPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();

  const { data: profile } = useQuery({
    queryKey: ['merchant-profile'],
    queryFn: () => merchantService.getProfile().then((r) => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['sandbox-transactions', page],
    queryFn: () => transactionService.list({ page, limit: 20 }).then((r) => ({
      ...r.data,
      data: r.data.data.filter((t) => t.environment === 'SANDBOX'),
    })),
    refetchInterval: 8000,
  });

  const { data: apiKeys } = useQuery({
    queryKey: ['my-api-keys-sandbox'],
    queryFn: () => merchantService.getMyApiKeys().then((r) => r.data.data.filter((k) => k.environment === 'SANDBOX')),
  });

  const simulateMutation = useMutation({
    mutationFn: (id: string) => transactionService.simulateSandboxComplete(id),
    onSuccess: () => {
      message.success('Đã giả lập hoàn thành giao dịch');
      qc.invalidateQueries({ queryKey: ['sandbox-transactions'] });
    },
  });

  const columns: ColumnType<Transaction>[] = [
    { title: 'Order ID', dataIndex: 'orderId', ellipsis: true },
    { title: 'Số tiền', dataIndex: 'amount', render: (v: string) => formatUSDT(v) },
    {
      title: 'Trạng thái', dataIndex: 'status',
      render: (s: Transaction['status']) => <Tag color={txStatusColor[s]}>{txStatusLabel[s]}</Tag>,
    },
    { title: 'Thời gian', dataIndex: 'createdAt', render: formatDate },
    {
      title: '', render: (_: unknown, r: Transaction) => r.status === 'PENDING' && (
        <Button size="small" type="primary" icon={<PlayCircleOutlined />}
          loading={simulateMutation.isPending}
          onClick={() => simulateMutation.mutate(r.id)}>
          Giả lập hoàn thành
        </Button>
      ),
    },
  ];

  const sandboxKey = apiKeys?.[0];

  const curlExample = sandboxKey
    ? `curl -X POST ${window.location.origin}/api/v1/transactions/pay \\
  -H "x-api-key: ${sandboxKey.key}" \\
  -H "x-api-secret: <your-secret-shown-when-created>" \\
  -H "Content-Type: application/json" \\
  -d '{"orderId":"TEST-001","amount":50}'`
    : '# Tạo API Key môi trường SANDBOX trước (trang API Keys)';

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        <Space><ExperimentOutlined />Sandbox / Test Mode</Space>
      </Typography.Title>

      <Alert
        type="info" showIcon style={{ marginBottom: 24 }}
        message={`Số dư Sandbox hiện tại: ${profile ? formatUSDT(profile.sandboxBalance) : '-'}`}
        description="Giao dịch Sandbox không chạm vào blockchain thật và không trừ phí thật. Dùng để test tích hợp webhook trước khi go-live."
      />

      <Card title="Cách dùng API Sandbox" style={{ marginBottom: 24 }}>
        <Typography.Paragraph>
          Dùng API Key có prefix <Typography.Text code>sk_test_</Typography.Text> để gọi tới cùng endpoint <Typography.Text code>/api/v1/transactions/pay</Typography.Text>.
          Giao dịch sẽ ở trạng thái <Tag color="orange">PENDING</Tag> — bấm "Giả lập hoàn thành" bên dưới để kích hoạt webhook callback giống như thật.
        </Typography.Paragraph>
        <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, fontSize: 12, overflow: 'auto' }}>
          {curlExample}
        </pre>
      </Card>

      <Card title="Giao dịch Sandbox gần đây">
        <Table
          dataSource={data?.data || []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 600 }}
          pagination={{ current: page, pageSize: 20, total: data?.meta?.total || 0, onChange: setPage }}
        />
      </Card>
    </div>
  );
}
