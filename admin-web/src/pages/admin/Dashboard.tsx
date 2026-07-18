import { useState, useEffect } from 'react';
import { Row, Col, Card, Typography, Table, Tag, Space, Badge, Progress, Segmented } from 'antd';
import type { ColumnType } from 'antd/es/table';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { reportService, transactionService } from '../../services';
import StatCard from '../../components/common/StatCard';
import { formatUSDT, formatDate, txStatusColor, txStatusLabel } from '../../utils';
import {
  DollarOutlined, SwapOutlined, TeamOutlined, ClockCircleOutlined,
  RiseOutlined, FallOutlined, CheckCircleOutlined, SyncOutlined,
} from '@ant-design/icons';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
  Legend, LineChart, Line,
} from 'recharts';
import type { Transaction, TopMerchant } from '../../types';
import { useSocket } from '../../hooks/useSocket';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// ── Trend indicator ─────────────────────────────────────────────────────────
function Trend({ value }: { value: number }) {
  if (value === 0) return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>;
  const up = value > 0;
  return (
    <Space size={2}>
      {up ? <RiseOutlined style={{ color: '#52c41a', fontSize: 11 }} /> : <FallOutlined style={{ color: '#ff4d4f', fontSize: 11 }} />}
      <Text style={{ fontSize: 12, color: up ? '#52c41a' : '#ff4d4f' }}>
        {Math.abs(value).toFixed(1)}%
      </Text>
    </Space>
  );
}

// ── Sparkline mini ───────────────────────────────────────────────────────────
function Sparkline({ data, color = '#1677ff' }: { data: number[]; color?: string }) {
  const pts = data.map((v, i) => ({ v, i }));
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={pts} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
        <defs>
          <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
          fill={`url(#spark-${color.replace('#', '')})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Rich Stat Card with sparkline ───────────────────────────────────────────
function RichStatCard({
  title, value, sub, trend, color, icon, spark, loading,
}: {
  title: string; value: string | number; sub?: string;
  trend?: number; color?: string; icon: React.ReactNode;
  spark?: number[]; loading?: boolean;
}) {
  return (
    <Card style={{ height: '100%', borderRadius: 12 }} loading={loading}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>{title}</Text>
          <div style={{ fontSize: 24, fontWeight: 700, color: color || '#000', lineHeight: 1.3, marginTop: 4 }}>
            {value}
          </div>
          {sub && <Text type="secondary" style={{ fontSize: 12 }}>{sub}</Text>}
          {trend !== undefined && <div style={{ marginTop: 4 }}><Trend value={trend} /></div>}
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: (color || '#1677ff') + '18',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, color: color || '#1677ff',
        }}>
          {icon}
        </div>
      </div>
      {spark && spark.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <Sparkline data={spark} color={color || '#1677ff'} />
        </div>
      )}
    </Card>
  );
}

// ── Status Pie colors ────────────────────────────────────────────────────────
const PIE_COLORS: Record<string, string> = {
  COMPLETED: '#52c41a', CONFIRMING: '#1677ff',
  PENDING: '#fa8c16', EXPIRED: '#ff4d4f', FAILED: '#d9d9d9',
};
const PIE_LABELS: Record<string, string> = {
  COMPLETED: 'Hoàn thành', CONFIRMING: 'Đang xác nhận',
  PENDING: 'Chờ TT', EXPIRED: 'Hết hạn', FAILED: 'Thất bại',
};

// ── Custom Tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: {active?: boolean; payload?: Array<{name: string; value: number; color: string}>; label?: string}) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: '8px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{label}</Text>
      {payload.map((p) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 12 }}>
          <Text style={{ color: p.color }}>{p.name}</Text>
          <Text strong>{typeof p.value === 'number' && p.name.includes('USDT') ? formatUSDT(p.value) : p.value}</Text>
        </div>
      ))}
    </div>
  );
};

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const qc = useQueryClient();
  const socket = useSocket();
  const [trendDays, setTrendDays] = useState(30);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => reportService.getDashboard().then((r) => r.data.data),
    refetchInterval: 30_000,
  });

  const { data: trend } = useQuery({
    queryKey: ['dashboard-trend', trendDays],
    queryFn: () => reportService.getTrend(trendDays).then((r) => r.data.data),
    refetchInterval: 60_000,
  });

  const { data: recentTx } = useQuery({
    queryKey: ['recent-transactions'],
    queryFn: () => transactionService.list({ limit: 8 }).then((r) => r.data.data),
    refetchInterval: 10_000,
  });

  // Realtime via socket
  useEffect(() => {
    if (!socket) return;
    socket.on('transaction:updated', () => {
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      qc.invalidateQueries({ queryKey: ['recent-transactions'] });
    });
    return () => { socket.off('transaction:updated'); };
  }, [socket, qc]);

  const txColumns: ColumnType<Transaction>[] = [
    { title: 'Order ID', dataIndex: 'orderId', ellipsis: true, render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text> },
    { title: 'Đại lý', dataIndex: ['merchant', 'name'] as string[], ellipsis: true, responsive: ['md'] as ('xs'|'sm'|'md'|'lg'|'xl'|'xxl')[] },
    { title: 'Số tiền', dataIndex: 'amount', render: (v: string) => <Text strong>{formatUSDT(v)}</Text> },
    {
      title: 'Trạng thái', dataIndex: 'status',
      render: (s: Transaction['status']) => <Tag color={txStatusColor[s]}>{txStatusLabel[s]}</Tag>,
    },
    { title: 'Thời gian', dataIndex: 'createdAt', render: formatDate, responsive: ['lg'] as ('xs'|'sm'|'md'|'lg'|'xl'|'xxl')[] },
  ];

  const topMerchantCols: ColumnType<TopMerchant>[] = [
    { title: '#', render: (_: unknown, __: TopMerchant, i: number) => <Text type="secondary">{i + 1}</Text>, width: 32 },
    { title: 'Đại lý', dataIndex: 'name', ellipsis: true },
    { title: 'Khối lượng', dataIndex: 'volume', render: (v: number) => formatUSDT(v) },
    { title: 'GD', dataIndex: 'count' },
  ];

  // Sparkline data from trend
  const sparkVolume = (trend || []).slice(-14).map((d) => d.volume);
  const sparkCount = (trend || []).slice(-14).map((d) => d.count);

  // Hourly chart — show last 12h
  const now = new Date().getHours();
  const hourlyData = (stats?.hourlyChart || []).map((h) => ({
    ...h,
    label: `${String(h.hour).padStart(2, '0')}:00`,
  }));

  const pendingTotal = (stats?.withdrawals.pending || 0) + (stats?.withdrawals.processing || 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Dashboard</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Cập nhật lúc {dayjs().format('HH:mm:ss DD/MM/YYYY')}
            {stats?.transactions.confirming ? (
              <Badge count={stats.transactions.confirming} style={{ marginLeft: 8, background: '#1677ff' }}>
                <Tag color="blue" style={{ marginLeft: 8 }}>
                  <SyncOutlined spin /> {stats.transactions.confirming} đang xác nhận
                </Tag>
              </Badge>
            ) : null}
          </Text>
        </div>
      </div>

      {/* KPI Cards Row 1 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <RichStatCard
            title="Doanh thu tháng này"
            value={stats ? formatUSDT(stats.revenue.monthVolume) : '—'}
            sub={`Phí: ${stats ? formatUSDT(stats.revenue.monthFee) : '—'}`}
            trend={stats?.revenue.monthChange}
            color="#1677ff" icon={<DollarOutlined />}
            spark={sparkVolume} loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <RichStatCard
            title="Doanh thu hôm nay"
            value={stats ? formatUSDT(stats.revenue.todayVolume) : '—'}
            sub={`Hôm qua: ${stats ? formatUSDT(stats.revenue.yesterdayVolume) : '—'}`}
            trend={stats?.revenue.todayVolumeChange}
            color="#52c41a" icon={<RiseOutlined />}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <RichStatCard
            title="Giao dịch hôm nay"
            value={stats?.transactions.today ?? '—'}
            sub={`Hôm qua: ${stats?.transactions.yesterday ?? '—'}`}
            trend={stats?.transactions.todayChange}
            color="#722ed1" icon={<SwapOutlined />}
            spark={sparkCount} loading={isLoading}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <RichStatCard
            title="Rút tiền chờ duyệt"
            value={stats?.withdrawals.pending ?? '—'}
            sub={`Đang xử lý: ${stats?.withdrawals.processing ?? 0}`}
            color={pendingTotal > 0 ? '#fa8c16' : '#8c8c8c'}
            icon={<ClockCircleOutlined />} loading={isLoading}
          />
        </Col>
      </Row>

      {/* KPI Cards Row 2 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }} loading={isLoading}>
            <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{stats?.transactions.completed ?? '—'}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>Hoàn thành</Text>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }} loading={isLoading}>
            <SyncOutlined style={{ fontSize: 24, color: '#1677ff' }} spin={!!stats?.transactions.confirming} />
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{stats?.transactions.confirming ?? '—'}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>Xác nhận</Text>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }} loading={isLoading}>
            <ClockCircleOutlined style={{ fontSize: 24, color: '#fa8c16' }} />
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{stats?.transactions.pending ?? '—'}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>Đang chờ</Text>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }} loading={isLoading}>
            <TeamOutlined style={{ fontSize: 24, color: '#722ed1' }} />
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{stats?.merchants.active ?? '—'}<Text type="secondary" style={{ fontSize: 14 }}>/{stats?.merchants.total ?? '—'}</Text></div>
            <Text type="secondary" style={{ fontSize: 11 }}>Đại lý hoạt động</Text>
          </Card>
        </Col>
      </Row>

      {/* Charts Row 1 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* Hourly Activity */}
        <Col xs={24} xl={14}>
          <Card
            title="Hoạt động 24 giờ qua"
            style={{ borderRadius: 12 }}
            extra={<Badge status="processing" text="Realtime" />}
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourlyData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={2} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="count" name="Tổng GD" fill="#e6f4ff" stroke="#1677ff" radius={[3, 3, 0, 0]} />
                <Bar dataKey="completed" name="Hoàn thành" fill="#52c41a" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Status Pie */}
        <Col xs={24} xl={10}>
          <Card title="Phân bổ trạng thái hôm nay" style={{ borderRadius: 12 }}>
            {stats?.statusBreakdown.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={stats.statusBreakdown}
                    dataKey="count"
                    nameKey="status"
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={85}
                    paddingAngle={3}
                    label={({ status, percent }) =>
                      `${PIE_LABELS[status] || status} ${((percent || 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {stats.statusBreakdown.map((entry) => (
                      <Cell key={entry.status} fill={PIE_COLORS[entry.status] || '#d9d9d9'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, name: string) => [v, PIE_LABELS[name] || name]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Text type="secondary">Chưa có giao dịch hôm nay</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Charts Row 2 — Trend */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card
            title="Xu hướng doanh thu"
            style={{ borderRadius: 12 }}
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
                  <linearGradient id="gradVol" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1677ff" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#1677ff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradFee" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#52c41a" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#52c41a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }}
                  tickFormatter={(v) => dayjs(v).format(trendDays <= 7 ? 'DD/MM' : 'DD/MM')}
                  interval={trendDays <= 7 ? 0 : Math.floor(trendDays / 8)}
                />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v} USDT`} width={80} />
                <Tooltip content={<CustomTooltip />}
                  labelFormatter={(v) => dayjs(v as string).format('DD/MM/YYYY')}
                />
                <Legend />
                <Area type="monotone" dataKey="volume" name="Khối lượng (USDT)"
                  stroke="#1677ff" fill="url(#gradVol)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="fee" name="Phí (USDT)"
                  stroke="#52c41a" fill="url(#gradFee)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Bottom Row */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* Recent Transactions */}
        <Col xs={24} xl={14}>
          <Card title="Giao dịch gần đây" style={{ borderRadius: 12 }}
            extra={<Badge status="processing" text="Live" />}>
            <Table
              dataSource={recentTx || []}
              columns={txColumns}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 500 }}
            />
          </Card>
        </Col>

        {/* Top Merchants */}
        <Col xs={24} xl={10}>
          <Card title="Top đại lý tháng này" style={{ borderRadius: 12 }}>
            {stats?.topMerchants.length ? (
              <>
                <Table
                  dataSource={stats.topMerchants}
                  columns={topMerchantCols}
                  rowKey="merchantId"
                  size="small"
                  pagination={false}
                  style={{ marginBottom: 16 }}
                />
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart
                    data={stats.topMerchants}
                    layout="vertical"
                    margin={{ left: 0, right: 0 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip formatter={(v: number) => formatUSDT(v)} />
                    <Bar dataKey="volume" fill="#1677ff" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Text type="secondary">Chưa có dữ liệu tháng này</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
