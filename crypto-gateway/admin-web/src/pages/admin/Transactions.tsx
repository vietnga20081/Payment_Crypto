import { useState } from 'react';
import { Table, Tag, Space, Input, Select, Button, Typography, Drawer, Descriptions, Progress, Dropdown } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { transactionService, exportService } from '../../services';
import { formatDate, formatUSDT, txStatusColor, txStatusLabel, shortAddress } from '../../utils';
import type { Transaction, TransactionStatus } from '../../types';
import { CopyOutlined, DownloadOutlined, FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons';
import { message } from 'antd';
import type { ColumnType } from 'antd/es/table';

export default function AdminTransactionsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<Transaction | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-transactions', page, status, search],
    queryFn: () => transactionService.list({ page, limit: 20, status, search }).then((r) => r.data),
    refetchInterval: 10_000,
  });

  const copy = (text: string) => { navigator.clipboard.writeText(text); message.success('Đã sao chép'); };

  const handleExport = async (format: 'excel' | 'pdf') => {
    setExporting(true);
    try {
      const params = { status, startDate: undefined, endDate: undefined };
      if (format === 'excel') await exportService.transactionsExcel(params);
      else await exportService.transactionsPdf(params);
      message.success('Đã tải file');
    } catch {
      message.error('Lỗi xuất file');
    } finally {
      setExporting(false);
    }
  };

  const columns: ColumnType<Transaction>[] = [
    { title: 'Order ID', dataIndex: 'orderId', ellipsis: true, render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
    { title: 'Đại lý', dataIndex: ['merchant', 'name'] as string[], ellipsis: true },
    { title: 'Số tiền', dataIndex: 'amount', render: (v: string) => formatUSDT(v) },
    { title: 'Phí', dataIndex: 'fee', render: (v: string) => formatUSDT(v), responsive: ['xl'] as ('xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl')[] },
    { title: 'Địa chỉ nhận', dataIndex: 'toAddress', render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{shortAddress(v)}</span> },
    {
      title: 'Trạng thái', dataIndex: 'status',
      render: (s: TransactionStatus) => <Tag color={txStatusColor[s]}>{txStatusLabel[s]}</Tag>,
    },
    { title: 'Xác nhận', dataIndex: 'confirmations', responsive: ['lg'] as ('xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl')[],
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
        <Typography.Title level={4} style={{ margin: 0 }}>Giao dịch</Typography.Title>
        <Space wrap>
          <Select placeholder="Trạng thái" allowClear style={{ width: 160 }} onChange={setStatus}
            options={Object.entries(txStatusLabel).map(([v, l]) => ({ value: v, label: l }))} />
          <Input.Search placeholder="Order ID / TxHash / Địa chỉ" onSearch={setSearch} allowClear style={{ width: 260 }} />
          <Dropdown menu={{
            items: [
              { key: 'excel', icon: <FileExcelOutlined />, label: 'Xuất Excel', onClick: () => handleExport('excel') },
              { key: 'pdf', icon: <FilePdfOutlined />, label: 'Xuất PDF', onClick: () => handleExport('pdf') },
            ],
          }}>
            <Button icon={<DownloadOutlined />} loading={exporting}>Xuất file</Button>
          </Dropdown>
        </Space>
      </div>

      <Table
        dataSource={data?.data || []}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 800 }}
        pagination={{
          current: page, pageSize: 20,
          total: data?.meta?.total || 0,
          onChange: setPage,
          showTotal: (t) => `Tổng ${t}`,
        }}
      />

      <Drawer title="Chi tiết giao dịch" open={!!detail} onClose={() => setDetail(null)} width={520}>
        {detail && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="ID">{detail.id}</Descriptions.Item>
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
            <Descriptions.Item label="Từ địa chỉ">{detail.fromAddress || '-'}</Descriptions.Item>
            <Descriptions.Item label="Đến địa chỉ">
              <Space><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{detail.toAddress || 'Chưa chọn mạng'}</span>{detail.toAddress && <Button size="small" icon={<CopyOutlined />} onClick={() => copy(detail.toAddress!)} />}</Space>
            </Descriptions.Item>
            <Descriptions.Item label="Xác nhận">{detail.confirmations} / {detail.requiredConfirmations}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái"><Tag color={txStatusColor[detail.status]}>{txStatusLabel[detail.status]}</Tag></Descriptions.Item>
            <Descriptions.Item label="Hết hạn">{formatDate(detail.expiredAt)}</Descriptions.Item>
            <Descriptions.Item label="Xác nhận lúc">{detail.confirmedAt ? formatDate(detail.confirmedAt) : '-'}</Descriptions.Item>
            <Descriptions.Item label="Tạo lúc">{formatDate(detail.createdAt)}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
}
