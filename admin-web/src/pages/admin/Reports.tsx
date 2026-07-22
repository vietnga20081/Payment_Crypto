import { useState } from 'react';
import { Card, Row, Col, Typography, DatePicker, Button, Space, Statistic, Table } from 'antd';
import type { ColumnType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import { reportService } from '../../services';
import { formatUSDT } from '../../utils';
import dayjs from 'dayjs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

const { RangePicker } = DatePicker;

export default function ReportsPage() {
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().subtract(30, 'day'), dayjs()]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['revenue-report', range[0].format('YYYY-MM-DD'), range[1].format('YYYY-MM-DD')],
    queryFn: () => reportService.getRevenue(range[0].format('YYYY-MM-DD'), range[1].endOf('day').toISOString()).then((r) => r.data.data),
  });

  interface DailyRow { date: string; count: number; volume: number; fee: number }
  const tableColumns: ColumnType<DailyRow>[] = [
    { title: 'Ngày', dataIndex: 'date' },
    { title: 'Số GD', dataIndex: 'count' },
    { title: 'Khối lượng', dataIndex: 'volume', render: (v: number) => formatUSDT(v) },
    { title: 'Phí thu', dataIndex: 'fee', render: (v: number) => formatUSDT(v) },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Báo cáo Doanh thu</Typography.Title>
        <Space wrap>
          <RangePicker
            value={range}
            onChange={(v) => v && setRange(v as [dayjs.Dayjs, dayjs.Dayjs])}
            format="DD/MM/YYYY"
          />
          <Button type="primary" onClick={() => refetch()} loading={isLoading}>Lọc</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card><Statistic title="Tổng giao dịch" value={data?.totalTransactions || 0} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card><Statistic title="Tổng khối lượng" value={data ? formatUSDT(data.totalVolume) : '-'} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card><Statistic title="Tổng phí thu" value={data ? formatUSDT(data.totalFee) : '-'} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
      </Row>

      <Card title="Biểu đồ doanh thu theo ngày" style={{ marginBottom: 24 }}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data?.daily || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => formatUSDT(v)} />
            <Legend />
            <Bar dataKey="volume" name="Khối lượng" fill="#1677ff" />
            <Bar dataKey="fee" name="Phí" fill="#52c41a" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Số giao dịch theo ngày" style={{ marginBottom: 24 }}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data?.daily || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey="count" name="Số GD" stroke="#722ed1" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Chi tiết theo ngày">
        <Table
          dataSource={data?.daily || []}
          columns={tableColumns}
          rowKey="date"
          loading={isLoading}
          pagination={{ pageSize: 31, showSizeChanger: false }}
          scroll={{ x: 500 }}
          size="small"
        />
      </Card>
    </div>
  );
}
