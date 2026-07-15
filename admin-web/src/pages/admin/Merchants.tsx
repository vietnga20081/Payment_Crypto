import { useState } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Input, InputNumber,
  Typography, Popconfirm, message, Drawer, Descriptions, Select, Row, Col,
} from 'antd';
import type { ColumnType } from 'antd/es/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { merchantService } from '../../services';
import { formatDate, formatUSDT } from '../../utils';
import type { Merchant, UserStatus } from '../../types';
import { PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined, ReloadOutlined } from '@ant-design/icons';

const statusColor: Record<UserStatus, string> = { ACTIVE: 'green', INACTIVE: 'orange', SUSPENDED: 'red' };
const statusLabel: Record<UserStatus, string> = { ACTIVE: 'Hoạt động', INACTIVE: 'Tạm dừng', SUSPENDED: 'Đình chỉ' };

export default function MerchantsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editMerchant, setEditMerchant] = useState<Merchant | null>(null);
  const [detailMerchant, setDetailMerchant] = useState<Merchant | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['merchants', page, search],
    queryFn: () => merchantService.list({ page, limit: 20, search }).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (values: Parameters<typeof merchantService.create>[0]) => merchantService.create(values),
    onSuccess: () => {
      message.success('Tạo đại lý thành công');
      qc.invalidateQueries({ queryKey: ['merchants'] });
      setCreateOpen(false);
      form.resetFields();
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      message.error(e.response?.data?.message || 'Lỗi tạo đại lý'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Merchant> }) => merchantService.update(id, data),
    onSuccess: () => {
      message.success('Cập nhật thành công');
      qc.invalidateQueries({ queryKey: ['merchants'] });
      setEditMerchant(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => merchantService.delete(id),
    onSuccess: () => { message.success('Đã xóa'); qc.invalidateQueries({ queryKey: ['merchants'] }); },
  });

  const resetSecretMutation = useMutation({
    mutationFn: (id: string) => merchantService.resetWebhookSecret(id),
    onSuccess: (res) => {
      Modal.info({ title: 'Webhook Secret mới', content: <Input.Password value={res.data.data.webhookSecret} readOnly /> });
    },
  });

  const columns: ColumnType<Merchant>[] = [
    { title: 'Tên', dataIndex: 'name', ellipsis: true },
    { title: 'Email', dataIndex: ['user', 'email'] as string[], ellipsis: true },
    { title: 'Số dư', dataIndex: 'balance', render: (v: string) => formatUSDT(v) },
    { title: 'Phí (%)', dataIndex: 'feeRate', render: (v: string) => `${(Number(v) * 100).toFixed(2)}%` },
    {
      title: 'Trạng thái', dataIndex: 'status',
      render: (s: UserStatus) => <Tag color={statusColor[s]}>{statusLabel[s]}</Tag>,
    },
    { title: 'Ngày tạo', dataIndex: 'createdAt', render: formatDate, responsive: ['lg'] as ('xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl')[] },
    {
      title: 'Thao tác',
      render: (_: unknown, record: Merchant) => (
        <Space size="small" wrap>
          <Button size="small" onClick={() => setDetailMerchant(record)}>Chi tiết</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditMerchant(record); editForm.setFieldsValue({ ...record, feeRate: Number(record.feeRate) * 100 }); }} />
          <Button size="small" icon={<KeyOutlined />} onClick={() => resetSecretMutation.mutate(record.id)} title="Reset Webhook Secret" />
          <Popconfirm title="Xóa đại lý này?" onConfirm={() => deleteMutation.mutate(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Quản lý Đại lý</Typography.Title>
        <Space wrap>
          <Input.Search placeholder="Tìm kiếm..." onSearch={setSearch} allowClear style={{ width: 220 }} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>Thêm đại lý</Button>
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
          showSizeChanger: false,
          showTotal: (t) => `Tổng ${t}`,
        }}
      />

      {/* Create Modal */}
      <Modal title="Thêm đại lý mới" open={createOpen} onCancel={() => { setCreateOpen(false); form.resetFields(); }}
        onOk={() => form.submit()} confirmLoading={createMutation.isPending} okText="Tạo" cancelText="Hủy">
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate({ ...v, feeRate: v.feeRate / 100 })}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, min: 8 }]}>
                <Input.Password />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="name" label="Tên đại lý" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="website" label="Website">
                <Input placeholder="https://example.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="feeRate" label="Phí (%)" initialValue={1} rules={[{ required: true }]}>
                <InputNumber min={0} max={100} step={0.1} precision={2} style={{ width: '100%' }} addonAfter="%" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="callbackUrl" label="Callback URL">
            <Input placeholder="https://example.com/webhook" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal title="Sửa đại lý" open={!!editMerchant} onCancel={() => setEditMerchant(null)}
        onOk={() => editForm.submit()} confirmLoading={updateMutation.isPending} okText="Lưu" cancelText="Hủy">
        <Form form={editForm} layout="vertical"
          onFinish={(v) => updateMutation.mutate({ id: editMerchant!.id, data: { ...v, feeRate: v.feeRate / 100 } })}>
          <Form.Item name="name" label="Tên đại lý" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="website" label="Website"><Input /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="feeRate" label="Phí (%)">
                <InputNumber min={0} max={100} step={0.1} precision={2} style={{ width: '100%' }} addonAfter="%" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="callbackUrl" label="Callback URL"><Input /></Form.Item>
          <Form.Item name="status" label="Trạng thái">
            <Select options={[
              { value: 'ACTIVE', label: 'Hoạt động' },
              { value: 'INACTIVE', label: 'Tạm dừng' },
              { value: 'SUSPENDED', label: 'Đình chỉ' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer title="Chi tiết đại lý" open={!!detailMerchant} onClose={() => setDetailMerchant(null)} width={480}>
        {detailMerchant && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="ID">{detailMerchant.id}</Descriptions.Item>
            <Descriptions.Item label="Tên">{detailMerchant.name}</Descriptions.Item>
            <Descriptions.Item label="Email">{detailMerchant.user?.email}</Descriptions.Item>
            <Descriptions.Item label="Website">{detailMerchant.website || '-'}</Descriptions.Item>
            <Descriptions.Item label="Callback URL">{detailMerchant.callbackUrl || '-'}</Descriptions.Item>
            <Descriptions.Item label="Số dư">{formatUSDT(detailMerchant.balance)}</Descriptions.Item>
            <Descriptions.Item label="Số dư đóng băng">{formatUSDT(detailMerchant.frozenBalance)}</Descriptions.Item>
            <Descriptions.Item label="Phí">{(Number(detailMerchant.feeRate) * 100).toFixed(2)}%</Descriptions.Item>
            <Descriptions.Item label="Trạng thái"><Tag color={statusColor[detailMerchant.status]}>{statusLabel[detailMerchant.status]}</Tag></Descriptions.Item>
            <Descriptions.Item label="Ngày tạo">{formatDate(detailMerchant.createdAt)}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
}
