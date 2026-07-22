import { useState } from 'react';
import { Table, Tag, Typography, Button, Card, Statistic, Row, Col, message, InputNumber, Space, Popconfirm } from 'antd';
import type { ColumnType } from 'antd/es/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sweepService, walletService } from '../../services';
import type { SweepLog, Wallet } from '../../types';
import { formatDate, formatUSDT, shortAddress } from '../../utils';
import { ThunderboltOutlined, SyncOutlined } from '@ant-design/icons';

const statusColor: Record<string, string> = { PENDING: 'orange', PROCESSING: 'blue', COMPLETED: 'green', FAILED: 'red' };

export default function SweepPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [threshold, setThreshold] = useState(500);

  const { data, isLoading } = useQuery({
    queryKey: ['sweep-history', page],
    queryFn: () => sweepService.history({ page, limit: 20 }).then((r) => r.data),
    refetchInterval: 15000,
  });

  const { data: wallets } = useQuery({
    queryKey: ['wallets-for-sweep'],
    queryFn: () => walletService.list({ limit: 100 }).then((r) => r.data.data.filter((w) => w.type === 'HOT')),
  });

  const runAllMutation = useMutation({
    mutationFn: () => sweepService.runAll(threshold),
    onSuccess: (res) => {
      const results = res.data.data as Array<{ swept: boolean }>;
      const swept = results.filter((r) => r.swept).length;
      message.success(`Đã sweep ${swept}/${results.length} ví`);
      qc.invalidateQueries({ queryKey: ['sweep-history'] });
      qc.invalidateQueries({ queryKey: ['wallets-for-sweep'] });
    },
    onError: () => message.error('Lỗi chạy sweep — kiểm tra đã có ví COLD chưa'),
  });

  const sweepOneMutation = useMutation({
    mutationFn: (walletId: string) => sweepService.sweepWallet(walletId, threshold),
    onSuccess: (res) => {
      message.success(res.data.data.swept ? `Sweep thành công ${formatUSDT(res.data.data.amount || 0)}` : 'Số dư chưa đủ ngưỡng');
      qc.invalidateQueries({ queryKey: ['sweep-history'] });
      qc.invalidateQueries({ queryKey: ['wallets-for-sweep'] });
    },
    onError: () => message.error('Sweep thất bại'),
  });

  const eligibleWallets = wallets?.filter((w) => Number(w.balance) >= threshold) || [];
  const totalEligible = eligibleWallets.reduce((s, w) => s + Number(w.balance), 0);

  const columns: ColumnType<SweepLog>[] = [
    { title: 'Ví nguồn', dataIndex: ['wallet', 'address'] as string[], render: (v: string) => shortAddress(v) },
    { title: 'Đến ví', dataIndex: 'toAddress', render: shortAddress },
    { title: 'Số tiền', dataIndex: 'amount', render: (v: string) => formatUSDT(v) },
    { title: 'Trạng thái', dataIndex: 'status', render: (s: string) => <Tag color={statusColor[s]}>{s}</Tag> },
    { title: 'TxHash', dataIndex: 'txHash', render: (v?: string) => v ? shortAddress(v) : '-' },
    { title: 'Lỗi', dataIndex: 'errorMessage', ellipsis: true, render: (v?: string) => v || '-' },
    { title: 'Thời gian', dataIndex: 'createdAt', render: formatDate },
  ];

  const walletColumns: ColumnType<Wallet>[] = [
    { title: 'Địa chỉ', dataIndex: 'address', render: shortAddress },
    { title: 'Nhãn', dataIndex: 'label', render: (v?: string) => v || '-' },
    { title: 'Số dư', dataIndex: 'balance', render: (v: string) => formatUSDT(v) },
    {
      title: '', render: (_: unknown, r: Wallet) => (
        <Popconfirm title={`Sweep ${formatUSDT(r.balance)} về ví COLD?`} onConfirm={() => sweepOneMutation.mutate(r.id)}>
          <Button size="small" type="primary" icon={<ThunderboltOutlined />} loading={sweepOneMutation.isPending}>
            Sweep ngay
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>Auto-Sweep Ví</Typography.Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card><Statistic title="Ví đủ ngưỡng sweep" value={eligibleWallets.length} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card><Statistic title="Tổng có thể sweep" value={formatUSDT(totalEligible)} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Typography.Text type="secondary">Ngưỡng sweep (USDT)</Typography.Text>
              <InputNumber min={1} value={threshold} onChange={(v) => setThreshold(v || 500)} style={{ width: '100%' }} />
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title="Ví HOT đủ điều kiện sweep" style={{ marginBottom: 24 }}
        extra={
          <Popconfirm title={`Sweep toàn bộ ${eligibleWallets.length} ví đủ ngưỡng?`} onConfirm={() => runAllMutation.mutate()}>
            <Button type="primary" icon={<SyncOutlined />} loading={runAllMutation.isPending} disabled={eligibleWallets.length === 0}>
              Sweep tất cả
            </Button>
          </Popconfirm>
        }>
        <Table dataSource={eligibleWallets} columns={walletColumns} rowKey="id" pagination={false} size="small" scroll={{ x: 500 }} />
      </Card>

      <Card title="Lịch sử Sweep">
        <Table
          dataSource={data?.data || []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 800 }}
          pagination={{ current: page, pageSize: 20, total: data?.meta?.total || 0, onChange: setPage }}
        />
      </Card>
    </div>
  );
}
