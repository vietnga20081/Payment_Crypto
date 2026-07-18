import { useState } from 'react';
import { Card, Typography, DatePicker, Button, Table, Statistic, Row, Col, Space } from 'antd';
import type { ColumnType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import { reconciliationService } from '../../services';
import { formatDate, formatUSDT } from '../../utils';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

interface SummaryTx {
  orderId: string;
  amount: string;
  fee: string;
  netAmount: string;
  txHash?: string;
  confirmedAt: string;
}

export default function MerchantReconciliationPage() {
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().subtract(7, 'day'), dayjs()]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['my-reconciliation', range[0].format('YYYY-MM-DD'), range[1].format('YYYY-MM-DD')],
    queryFn: () => reconciliationService.myMummary(range[0].startOf('day').toISOString(), range[1].endOf('day').toISOString()).then((r) => r.data.data),
  });

  const columns: ColumnType<SummaryTx>[] = [
    { title: 'Order ID', dataIndex: 'orderId', ellipsis: true },
    { title: 'Số tiền', dataIndex: 'amount', render: (v: string) => formatUSDT(v) },
    { title: 'Phí', dataIndex: 'fee', render: (v: string) => formatUSDT(v) },
    { title: 'Thực nhận', dataIndex: 'netAmount', render: (v: string) => formatUSDT(v) },
    { title: 'TxHash', dataIndex: 'txHash', ellipsis: true, render: (v?: string) => v || '-' },
    { title: 'Xác nhận lúc', dataIndex: 'confirmedAt', render: formatDate },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Đối soát của tôi</Typography.Title>
        <Space>
          <RangePicker value={range} onChange={(v) => v && setRange(v as [dayjs.Dayjs, dayjs.Dayjs])} format="DD/MM/YYYY" />
          <Button type="primary" onClick={() => refetch()} loading={isLoading}>Xem</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}><Card><Statistic title="Tổng giao dịch" value={data?.count || 0} /></Card></Col>
        <Col xs={24} sm={8}><Card><Statistic title="Tổng khối lượng" value={data ? formatUSDT(data.totalVolume) : '-'} /></Card></Col>
        <Col xs={24} sm={8}><Card><Statistic title="Tổng phí" value={data ? formatUSDT(data.totalFee) : '-'} /></Card></Col>
      </Row>

      <Card title="Chi tiết giao dịch đã hoàn thành">
        <Table
          dataSource={(data?.transactions as SummaryTx[]) || []}
          columns={columns}
          rowKey="orderId"
          loading={isLoading}
          scroll={{ x: 700 }}
          pagination={{ pageSize: 20 }}
          size="small"
        />
      </Card>
    </div>
  );
}
