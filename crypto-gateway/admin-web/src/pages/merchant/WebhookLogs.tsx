import { useState } from 'react';
import { Table, Tag, Typography, Space, Input, Button, message, Drawer, Descriptions, Popconfirm } from 'antd';
import type { ColumnType } from 'antd/es/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SendOutlined, SearchOutlined } from '@ant-design/icons';
import { merchantService } from '../../services';
import { formatDate } from '../../utils';

interface WebhookLog {
  id: string;
  transactionId: string;
  attempt: number;
  url: string;
  success: boolean;
  statusCode: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
  transaction: { orderId: string; status: string };
}

export default function WebhookLogsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [transactionIdFilter, setTransactionIdFilter] = useState('');
  const [detail, setDetail] = useState<WebhookLog | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['merchant-webhook-logs', page, transactionIdFilter],
    queryFn: () => merchantService.getWebhookLogs({ page, limit: 20, transactionId: transactionIdFilter || undefined }).then((r) => r.data),
  });

  const resendMutation = useMutation({
    mutationFn: (transactionId: string) => merchantService.resendWebhook(transactionId),
    onSuccess: () => {
      message.success('Đã đưa vào hàng đợi gửi lại — kiểm tra lại sau vài giây');
      qc.invalidateQueries({ queryKey: ['merchant-webhook-logs'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => message.error(e.response?.data?.message || 'Lỗi gửi lại webhook'),
  });

  const columns: ColumnType<WebhookLog>[] = [
    { title: 'Đơn hàng', dataIndex: ['transaction', 'orderId'] },
    { title: 'Lần thử', dataIndex: 'attempt', width: 80, align: 'center' },
    {
      title: 'Kết quả', dataIndex: 'success', width: 100,
      render: (v: boolean, r) => v
        ? <Tag color="green">Thành công {r.statusCode ? `(${r.statusCode})` : ''}</Tag>
        : <Tag color="red">Thất bại {r.statusCode ? `(${r.statusCode})` : ''}</Tag>,
    },
    { title: 'Thời gian phản hồi', dataIndex: 'durationMs', width: 130, render: (v: number | null) => v ? `${v}ms` : '-' },
    { title: 'Lúc gửi', dataIndex: 'createdAt', render: formatDate },
    {
      title: 'Thao tác',
      render: (_: unknown, r: WebhookLog) => (
        <Space>
          <Button size="small" onClick={() => setDetail(r)}>Chi tiết</Button>
          {!r.success && (
            <Popconfirm
              title="Gửi lại webhook cho giao dịch này?"
              onConfirm={() => resendMutation.mutate(r.transactionId)}
              okText="Gửi lại" cancelText="Hủy"
            >
              <Button size="small" icon={<SendOutlined />} loading={resendMutation.isPending}>Gửi lại</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 24 }}>Webhook Delivery Logs</Typography.Title>
      <Typography.Paragraph type="secondary">
        Lịch sử gửi webhook tới Callback URL của bạn — tự tra được webhook đã gửi bao nhiêu lần, lần nào fail, lỗi gì, không cần hỏi admin.
      </Typography.Paragraph>

      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="Lọc theo Transaction ID"
          prefix={<SearchOutlined />}
          value={transactionIdFilter}
          onChange={(e) => { setTransactionIdFilter(e.target.value); setPage(1); }}
          style={{ width: 280 }}
          allowClear
        />
      </Space>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data?.data || []}
        columns={columns}
        pagination={{
          current: page, pageSize: 20, total: data?.meta?.total || 0,
          onChange: setPage, showSizeChanger: false,
        }}
      />

      <Drawer title="Chi tiết webhook" open={!!detail} onClose={() => setDetail(null)} width={520}>
        {detail && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Đơn hàng">{detail.transaction.orderId}</Descriptions.Item>
            <Descriptions.Item label="Transaction ID"><code style={{ fontSize: 12 }}>{detail.transactionId}</code></Descriptions.Item>
            <Descriptions.Item label="Lần thử">{detail.attempt}</Descriptions.Item>
            <Descriptions.Item label="URL đích"><code style={{ fontSize: 12, wordBreak: 'break-all' }}>{detail.url}</code></Descriptions.Item>
            <Descriptions.Item label="Kết quả">
              {detail.success ? <Tag color="green">Thành công</Tag> : <Tag color="red">Thất bại</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="HTTP Status">{detail.statusCode ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Thời gian phản hồi">{detail.durationMs ? `${detail.durationMs}ms` : '-'}</Descriptions.Item>
            {detail.errorMessage && (
              <Descriptions.Item label="Lỗi">
                <Typography.Text type="danger" style={{ fontSize: 12 }}>{detail.errorMessage}</Typography.Text>
              </Descriptions.Item>
            )}
            {detail.responseBody && (
              <Descriptions.Item label="Response body">
                <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>{detail.responseBody}</pre>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Lúc gửi">{formatDate(detail.createdAt)}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
}
