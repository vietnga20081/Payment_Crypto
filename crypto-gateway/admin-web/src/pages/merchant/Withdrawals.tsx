import { useState } from 'react';
import { Table, Tag, Button, Modal, Form, Input, InputNumber, Typography, Select, message, Space } from 'antd';
import type { ColumnType } from 'antd/es/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { withdrawalService } from '../../services';
import { formatDate, formatUSDT, wdStatusColor, wdStatusLabel, shortAddress } from '../../utils';
import type { WithdrawalStatus, Withdrawal } from '../../types';
import { PlusOutlined } from '@ant-design/icons';

export default function MerchantWithdrawalsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string | undefined>();
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['merchant-withdrawals', page, status],
    queryFn: () => withdrawalService.list({ page, limit: 20, status }).then((r) => r.data),
    refetchInterval: 15_000,
  });

  const createMutation = useMutation({
    mutationFn: (values: { toAddress: string; amount: number; note?: string }) => withdrawalService.create(values),
    onSuccess: () => {
      message.success('Đã gửi yêu cầu rút tiền');
      qc.invalidateQueries({ queryKey: ['merchant-withdrawals'] });
      qc.invalidateQueries({ queryKey: ['merchant-profile'] });
      setCreateOpen(false);
      form.resetFields();
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      message.error(e.response?.data?.message || 'Lỗi tạo yêu cầu'),
  });

  const columns: ColumnType<Withdrawal>[] = [
    { title: 'Địa chỉ nhận', dataIndex: 'toAddress', render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{shortAddress(v)}</span> },
    { title: 'Số tiền', dataIndex: 'amount', render: (v: string) => formatUSDT(v) },
    { title: 'Phí', dataIndex: 'fee', render: (v: string) => formatUSDT(v), responsive: ['lg'] as ('xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl')[] },
    { title: 'Thực nhận', dataIndex: 'netAmount', render: (v: string) => formatUSDT(v) },
    {
      title: 'Trạng thái', dataIndex: 'status',
      render: (s: WithdrawalStatus) => <Tag color={wdStatusColor[s]}>{wdStatusLabel[s]}</Tag>,
    },
    { title: 'Ghi chú', dataIndex: 'note', ellipsis: true, responsive: ['lg'] as ('xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl')[] },
    { title: 'Thời gian', dataIndex: 'createdAt', render: formatDate, responsive: ['md'] as ('xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl')[] },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Rút tiền</Typography.Title>
        <Space wrap>
          <Select placeholder="Trạng thái" allowClear style={{ width: 160 }} onChange={setStatus}
            options={Object.entries(wdStatusLabel).map(([v, l]) => ({ value: v, label: l }))} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>Tạo yêu cầu</Button>
        </Space>
      </div>

      <Table
        dataSource={data?.data || []}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 700 }}
        pagination={{ current: page, pageSize: 20, total: data?.meta?.total || 0, onChange: setPage, showTotal: (t) => `Tổng ${t}` }}
      />

      <Modal title="Yêu cầu rút tiền" open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields(); }}
        onOk={() => form.submit()} okText="Gửi yêu cầu" cancelText="Hủy"
        confirmLoading={createMutation.isPending}>
        <Form form={form} layout="vertical" onFinish={createMutation.mutate}>
          <Form.Item name="toAddress" label="Địa chỉ TRC20" rules={[{ required: true, message: 'Nhập địa chỉ' }]}>
            <Input placeholder="T..." />
          </Form.Item>
          <Form.Item name="amount" label="Số tiền (USDT)" rules={[{ required: true }]}>
            <InputNumber min={1} step={1} precision={2} style={{ width: '100%' }} addonAfter="USDT" />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={2} placeholder="Ghi chú (tuỳ chọn)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
