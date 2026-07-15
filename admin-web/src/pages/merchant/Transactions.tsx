import { useState } from 'react';
import { Table, Tag, Select, Typography, Drawer, Descriptions, Progress, Space, Button } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { transactionService } from '../../services';
import { formatDate, formatUSDT, txStatusColor, txStatusLabel, shortAddress } from '../../utils';
import type { Transaction, TransactionStatus } from '../../types';
import { CopyOutlined } from '@ant-design/icons';
import { message } from 'antd';
import type { ColumnType } from 'antd/es/table';

export default function MerchantTransactionsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string | undefined>();
  const [detail, setDetail] = useState<Transaction | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['merchant-transactions', page, status],
    queryFn: () => transactionService.list({ page, limit: 20, status }).then((r) => r.data),
    refetchInterval: 8_000,
  });

  const copy = (text: string) => { navigator.clipboard.writeText(text); message.success('Đã sao chép'); };

  const columns: ColumnType<Transaction>[] = [
    { title: 'Order ID', dataIndex: 'orderId', ellipsis: true },
    { title: 'Số tiền', dataIndex: 'amount', render: (v: string) => formatUSDT(v) },
    { title: 'Thực nhận', dataIndex: 'netAmount', render: (v: string) => formatUSDT(v) },
    { title: 'Địa chỉ nhận', dataIndex: 'toAddress', render: (v: string) => shortAddress(v) },
    {
      title: 'Trạng thái', dataIndex: 'status',
      render: (s: TransactionStatus) => <Tag color={txStatusColor[s]}>{txStatusLabel[s]}</Tag>,
    },
    {
      title: 'Xác nhận', dataIndex: 'confirmations', responsive: ['lg'] as ('xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl')[],
      render: (v: number, r: Transaction) => r.status === 'CONFIRMING'
        ? <Progress percent={Math.min(100, Math.round(v / r.requiredConfirmations * 100))} size="small" format={() => `${v}/${r.requiredConfirmations}`} />
        : <span>{v}</span>,
    },
    { title: 'Thời gian', dataIndex: 'createdAt', render: formatDate, responsive: ['md'] as ('xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl')[] },
    { title: '', render: (_: unknown, r: Transaction) => <Button size="small" onClick={() => setDetail(r)}>Chi tiết</Button> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Lịch sử giao dịch</Typography.Title>
        <Select placeholder="Trạng thái" allowClear style={{ width: 160 }} onChange={setStatus}
          options={Object.entries(txStatusLabel).map(([v, l]) => ({ value: v, label: l }))} />
      </div>

      <Table
        dataSource={data?.data || []}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 700 }}
        pagination={{ current: page, pageSize: 20, total: data?.meta?.total || 0, onChange: setPage, showTotal: (t) => `Tổng ${t}` }}
      />

      <Drawer title="Chi tiết giao dịch" open={!!detail} onClose={() => setDetail(null)} width={480}>
        {detail && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Order ID">
              <Space>{detail.orderId}<Button size="small" icon={<CopyOutlined />} onClick={() => copy(detail.orderId)} /></Space>
            </Descriptions.Item>
            <Descriptions.Item label="TxHash">
              {detail.txHash
                ? <Space><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{detail.txHash}</span><Button size="small" icon={<CopyOutlined />} onClick={() => copy(detail.txHash!)} /></Space>
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Số tiền">{formatUSDT(detail.amount)}</Descriptions.Item>
            <Descriptions.Item label="Phí">{formatUSDT(detail.fee)}</Descriptions.Item>
            <Descriptions.Item label="Thực nhận">{formatUSDT(detail.netAmount)}</Descriptions.Item>
            <Descriptions.Item label="Đến địa chỉ">
              <span style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>{detail.toAddress}</span>
            </Descriptions.Item>
            <Descriptions.Item label="Xác nhận">{detail.confirmations} / {detail.requiredConfirmations}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái"><Tag color={txStatusColor[detail.status]}>{txStatusLabel[detail.status]}</Tag></Descriptions.Item>
            <Descriptions.Item label="Hết hạn">{formatDate(detail.expiredAt)}</Descriptions.Item>
            {detail.confirmedAt && <Descriptions.Item label="Xác nhận lúc">{formatDate(detail.confirmedAt)}</Descriptions.Item>}
            <Descriptions.Item label="Tạo lúc">{formatDate(detail.createdAt)}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
}
