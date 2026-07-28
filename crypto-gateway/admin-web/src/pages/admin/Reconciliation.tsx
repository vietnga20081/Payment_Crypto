import { useState } from 'react';
import { Table, Tag, Typography, Button, Modal, Form, Select, DatePicker, Space, message, Drawer, Descriptions, Statistic, Row, Col } from 'antd';
import type { ColumnType } from 'antd/es/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reconciliationService, merchantService } from '../../services';
import { formatDate, formatUSDT } from '../../utils';
import type { Reconciliation } from '../../types';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const statusColor: Record<string, string> = { PENDING: 'orange', COMPLETED: 'green', DISCREPANCY: 'red' };
const statusLabel: Record<string, string> = { PENDING: 'Đang chờ', COMPLETED: 'Khớp', DISCREPANCY: 'Lệch số liệu' };

export default function ReconciliationPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [detail, setDetail] = useState<Reconciliation | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['reconciliations', page],
    queryFn: () => reconciliationService.list({ page, limit: 20 }).then((r) => r.data),
  });

  const { data: merchants } = useQuery({
    queryKey: ['merchants-for-recon'],
    queryFn: () => merchantService.list({ limit: 100 }).then((r) => r.data.data),
  });

  const { data: detailData } = useQuery({
    queryKey: ['reconciliation-detail', detail?.id],
    queryFn: () => reconciliationService.getDetail(detail!.id).then((r) => r.data.data),
    enabled: !!detail,
  });

  const generateMutation = useMutation({
    mutationFn: (values: { merchantId: string; range: [dayjs.Dayjs, dayjs.Dayjs] }) =>
      reconciliationService.generate({
        merchantId: values.merchantId,
        periodStart: values.range[0].startOf('day').toISOString(),
        periodEnd: values.range[1].endOf('day').toISOString(),
      }),
    onSuccess: () => {
      message.success('Đối soát hoàn tất');
      qc.invalidateQueries({ queryKey: ['reconciliations'] });
      setGenerateOpen(false);
      form.resetFields();
    },
    onError: () => message.error('Lỗi tạo đối soát'),
  });

  const columns: ColumnType<Reconciliation>[] = [
    { title: 'Đại lý', dataIndex: ['merchant', 'name'] as string[] },
    { title: 'Từ ngày', dataIndex: 'periodStart', render: (v: string) => formatDate(v).split(' ')[0] },
    { title: 'Đến ngày', dataIndex: 'periodEnd', render: (v: string) => formatDate(v).split(' ')[0] },
    { title: 'Số GD khớp', dataIndex: 'matchedCount' },
    { title: 'Khối lượng', dataIndex: 'matchedVolume', render: (v: string) => formatUSDT(v) },
    { title: 'Số lệch', dataIndex: 'discrepancyCount', render: (v: number) => v > 0 ? <Tag color="red">{v}</Tag> : '0' },
    { title: 'Trạng thái', dataIndex: 'status', render: (s: string) => <Tag color={statusColor[s]}>{statusLabel[s] || s}</Tag> },
    { title: 'Tạo lúc', dataIndex: 'createdAt', render: formatDate, responsive: ['lg'] as ('xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl')[] },
    { title: '', render: (_: unknown, r: Reconciliation) => <Button size="small" onClick={() => setDetail(r)}>Chi tiết</Button> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Đối soát Giao dịch</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setGenerateOpen(true)}>Tạo đối soát mới</Button>
      </div>

      <Table
        dataSource={data?.data || []}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 800 }}
        pagination={{ current: page, pageSize: 20, total: data?.meta?.total || 0, onChange: setPage }}
      />

      <Modal title="Tạo đối soát mới" open={generateOpen} onCancel={() => setGenerateOpen(false)}
        onOk={() => form.submit()} confirmLoading={generateMutation.isPending} okText="Chạy đối soát" cancelText="Hủy">
        <Form form={form} layout="vertical" onFinish={generateMutation.mutate}>
          <Form.Item name="merchantId" label="Đại lý" rules={[{ required: true }]}>
            <Select
              showSearch optionFilterProp="label"
              options={merchants?.map((m) => ({ value: m.id, label: m.name }))}
            />
          </Form.Item>
          <Form.Item name="range" label="Khoảng thời gian" rules={[{ required: true }]}
            initialValue={[dayjs().subtract(1, 'day').startOf('day'), dayjs().subtract(1, 'day').endOf('day')]}>
            <RangePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer title="Chi tiết đối soát" open={!!detail} onClose={() => setDetail(null)} width={600}>
        {detailData && (
          <Space direction="vertical" style={{ width: '100%' }} size={20}>
            <Row gutter={16}>
              <Col span={12}><Statistic title="Số GD khớp" value={detailData.matchedCount} /></Col>
              <Col span={12}><Statistic title="Khối lượng" value={formatUSDT(detailData.matchedVolume)} /></Col>
              <Col span={12}><Statistic title="Số lệch" value={detailData.discrepancyCount} valueStyle={{ color: detailData.discrepancyCount > 0 ? '#cf1322' : undefined }} /></Col>
              <Col span={12}><Statistic title="Trạng thái" value={statusLabel[detailData.status] || detailData.status} /></Col>
            </Row>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Đại lý">{detailData.merchant?.name}</Descriptions.Item>
              <Descriptions.Item label="Từ">{formatDate(detailData.periodStart)}</Descriptions.Item>
              <Descriptions.Item label="Đến">{formatDate(detailData.periodEnd)}</Descriptions.Item>
            </Descriptions>
            <Typography.Text strong>Danh sách giao dịch ({detailData.transactions.length})</Typography.Text>
            <Table
              size="small"
              dataSource={detailData.transactions}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              columns={[
                { title: 'Order ID', dataIndex: 'orderId', ellipsis: true },
                { title: 'Số tiền', dataIndex: 'amount', render: (v: string) => formatUSDT(v) },
                { title: 'Xác nhận lúc', dataIndex: 'confirmedAt', render: (v: string) => v ? formatDate(v) : '-' },
              ]}
            />
          </Space>
        )}
      </Drawer>
    </div>
  );
}
