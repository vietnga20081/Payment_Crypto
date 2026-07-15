import { useEffect, useState } from 'react';
import { Row, Col, Card, Typography, Table, Tag, Space, Badge, Segmented, Progress } from 'antd';
import type { ColumnType } from 'antd/es/table';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { transactionService, reportService, merchantService } from '../../services';
import StatCard from '../../components/common/StatCard';
import { formatUSDT, formatDate, txStatusColor, txStatusLabel } from '../../utils';
import {
  DollarOutlined, SwapOutlined, CheckCircleOutlined,
  ClockCircleOutlined, RiseOutlined, WalletOutlined,
} from '@ant-design/icons';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import type { Transaction } from '../../types';
import { useSocket } from '../../hooks/useSocket';
import { useAuthStore } from '../../stores/auth.store';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

function Trend({ value }: { value: number }) {
  if (!value) return null;
  const up = value >= 0;
  return (
    <Text style={{ fontSize: 12, color: up ? '#52c41a' : '#ff4d4f' }}>
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(1)}% so hôm qua
    </Text>
  );
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: '8px 12px' }}>
      <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{label}</Text>
      {payload.map((p) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 12 }}>
          <Text style={{ color: p.color }}>{p.name}</Text>
          <Text strong>{formatUSDT(p.value)}</Text>
        </div>
      ))}
    </div>
  );
};

export default function MerchantDashboard() {
  const qc = useQueryClient();
  const socket = useSocket();
  const { user } = useAuthStore();
  const merchantId = user?.merchantId;
  const [trendDays, setTrendDays] = useState(30);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['merchant-profile'],
    queryFn: () => merchantService.getProfile().then((r) => r.data.data),
    refetchInterval: 30_000,
  });

  const { data: mStats, isLoading: statsLoading } = useQuery({
    queryKey: ['merchant-dashboard', merchantId],
    queryFn: () => reportService.getMerchantDashboard().then((r) => r.data.data),
    refetchInterval: 30_000,
    enabled: !!merchantId,
  });

  const { data: trend } = useQuery({
    queryKey: ['merchant-trend', trendDays, merchantId],
    queryFn: () => reportService.getTrend(trendDays, merchantId).then((r) => r.data.data),
    refetchInterval: 60_000,
    enabled: !!merchantId,
  });

  const { data: recentTx } = useQuery({
    queryKey: ['merchant-recent-tx'],
    queryFn: () => transactionService.list({ limit: 8 }).then((r) => r.data.data),
    refetchInterval: 8_000,
  });

  useEffect(() => {
    if (!socket) return;
    socket.on('transaction:updated', () => {
      qc.invalidateQueries({ queryKey: ['merchant-dashboard'] });
      qc.invalidateQueries({ queryKey: ['merchant-recent-tx'] });
      qc.invalidateQueries({ queryKey: ['merchant-profile'] });
    });
    return () => { socket.off('transaction:updated'); };
  }, [socket, qc]);

  const isLoading = profileLoading || statsLoading;

  // Balance utilisation (frozen / total)
  const totalBalance = (Number(profile?.balance || 0)) + (Number(profile?.frozenBalance || 0));
  const frozenPct = totalBalance > 0 ? (Number(profile?.frozenBalance || 0) / totalBalance) * 100 : 0;

  const txColumns: ColumnType<Transaction>[] = [
    {
      title: 'Order ID', dataIndex: 'orderId', ellipsis: true,
      render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text>,
    },
    { title: 'Số tiền', dataIndex: 'amount', render: (v: string) => <Text strong>{formatUSDT(v)}</Text> },
    { title: 'Thực nhận', dataIndex: 'netAmount', render: (v: string) => formatUSDT(v), responsive: ['lg'] as ('xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl')[] },
    {
      title: 'Trạng thái', dataIndex: 'status',
      render: (s: Transaction['status']) => <Tag color={txStatusColor[s]}>{txStatusLabel[s]}</Tag>,
    },
    {
      title: 'Xác nhận', dataIndex: 'confirmations',
      responsive: ['xl'] as ('xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl')[],
      render: (v: number, r: Transaction) =>
        r.status === 'CONFIRMING'
          ? <Progress percent={Math.min(100, Math.round(v / r.requiredConfirmations * 100))} size="small" format={() => `${v}/${r.requiredConfirmations}`} />
          : null,
    },
    { title: 'Thời gian', dataIndex: 'createdAt', render: formatDate, responsive: ['md'] as ('xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl')[] },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Dashboard</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs().format('HH:mm:ss DD/MM/YYYY')}
          </Text>
        </div>
        <Badge status="processing" text="Realtime" />
      </div>

      {/* Balance Card — full width highlight */}
      <Card
        style={{ marginBottom: 16, borderRadius: 12, background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)', border: 'none' }}
        loading={isLoading}
      >
        <Row gutter={[24, 16]} align="middle">
          <Col xs={24} sm={8}>
            <Space direction="vertical" size={2}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Số dư khả dụng</Text>
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: 700 }}>
                {formatUSDT(profile?.balance || 0)}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>
                Đóng băng: {formatUSDT(profile?.frozenBalance || 0)}
              </Text>
            </Space>
          </Col>
          <Col xs={24} sm={8}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Phân bổ số dư</Text>
              <Progress
                percent={100 - frozenPct}
                success={{ percent: 100 - frozenPct }}
                trailColor="rgba(255,255,255,0.3)"
                strokeColor="#fff"
                showInfo={false}
                size="small"
              />
              <Space>
                <Text style={{ color: '#fff', fontSize: 11 }}>✓ Khả dụng {(100 - frozenPct).toFixed(0)}%</Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>⟳ Đóng băng {frozenPct.toFixed(0)}%</Text>
              </Space>
            </Space>
          </Col>
          <Col xs={24} sm={8}>
            <Space direction="vertical" size={2}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Phí giao dịch</Text>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>
                {((Number(profile?.feeRate || 0)) * 100).toFixed(2)}%
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>
                Doanh thu tháng: {formatUSDT(mStats?.revenue.monthNetAmount || 0)}
              </Text>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* KPI Row */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }} loading={isLoading}>
            <SwapOutlined style={{ fontSize: 22, color: '#1677ff' }} />
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{mStats?.transactions.total ?? '—'}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>Tổng giao dịch</Text>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }} loading={isLoading}>
            <ClockCircleOutlined style={{ fontSize: 22, color: '#fa8c16' }} />
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{mStats?.transactions.today ?? '—'}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>Hôm nay</Text>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }} loading={isLoading}>
            <CheckCircleOutlined style={{ fontSize: 22, color: '#52c41a' }} />
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{mStats?.transactions.completed ?? '—'}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>Hoàn thành</Text>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }} loading={isLoading}>
            <DollarOutlined style={{ fontSize: 22, color: '#722ed1' }} />
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
              {mStats ? formatUSDT(mStats.revenue.monthVolume) : '—'}
            </div>
            <Text type="secondary" style={{ fontSize: 11 }}>Tháng này</Text>
          </Card>
        </Col>
      </Row>

      {/* Trend Chart */}
      <Card
        title="Xu hướng doanh thu"
        style={{ marginTop: 16, borderRadius: 12 }}
        extra={
          <Segmented
            value={trendDays}
            onChange={(v) => setTrendDays(Number(v))}
            options={[
              { label: '7 ngày', value: 7 },
              { label: '30 ngày', value: 30 },
              { label: '90 ngày', value: 90 },
            ]}
            size="small"
          />
        }
      >
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={trend || []} margin={{ left: 0, right: 0 }}>
            <defs>
              <linearGradient id="mGradVol" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1677ff" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#1677ff" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="mGradFee" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#52c41a" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#52c41a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date" tick={{ fontSize: 11 }}
              tickFormatter={(v) => dayjs(v).format('DD/MM')}
              interval={trendDays <= 7 ? 0 : Math.floor(trendDays / 8)}
            />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}`} width={60} />
            <Tooltip content={<CustomTooltip />} labelFormatter={(v) => dayjs(v as string).format('DD/MM/YYYY')} />
            <Legend />
            <Area type="monotone" dataKey="volume" name="Khối lượng (USDT)"
              stroke="#1677ff" fill="url(#mGradVol)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="fee" name="Phí (USDT)"
              stroke="#52c41a" fill="url(#mGradFee)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Transactions Table */}
      <Card
        title="Giao dịch gần đây"
        style={{ marginTop: 16, borderRadius: 12 }}
        extra={<Badge status="processing" text="Live" />}
      >
        <Table
          dataSource={recentTx || []}
          columns={txColumns}
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ x: 500 }}
        />
      </Card>
    </div>
  );
}
