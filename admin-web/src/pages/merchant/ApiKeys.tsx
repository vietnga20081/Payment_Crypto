import { useState } from 'react';
import { Table, Button, Tag, Space, Modal, Form, Input, Typography, Popconfirm, message, Alert, Select } from 'antd';
import type { ColumnType } from 'antd/es/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { merchantService } from '../../services';
import { formatDate } from '../../utils';
import type { ApiKey } from '../../types';
import { PlusOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons';

export default function ApiKeysPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newKey, setNewKey] = useState<{ key: string; secret: string; environment: string } | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['my-api-keys'],
    queryFn: () => merchantService.getMyApiKeys().then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: ({ name, environment }: { name: string; environment: 'LIVE' | 'SANDBOX' }) =>
      merchantService.createMyApiKey(name, environment),
    onSuccess: (res) => {
      setNewKey(res.data.data);
      qc.invalidateQueries({ queryKey: ['my-api-keys'] });
      setCreateOpen(false);
      form.resetFields();
    },
    onError: () => message.error('Lỗi tạo API key'),
  });

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => merchantService.revokeMyApiKey(keyId),
    onSuccess: () => { message.success('Đã thu hồi API key'); qc.invalidateQueries({ queryKey: ['my-api-keys'] }); },
  });

  const copy = (text: string) => { navigator.clipboard.writeText(text); message.success('Đã sao chép'); };

  const columns: ColumnType<ApiKey>[] = [
    { title: 'Tên', dataIndex: 'name' },
    {
      title: 'Môi trường', dataIndex: 'environment',
      render: (v: string) => <Tag color={v === 'LIVE' ? 'red' : 'blue'}>{v}</Tag>,
    },
    {
      title: 'API Key', dataIndex: 'key',
      render: (v: string) => (
        <Space>
          <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>
          <Button size="small" icon={<CopyOutlined />} onClick={() => copy(v)} />
        </Space>
      ),
    },
    { title: 'Trạng thái', dataIndex: 'isActive', render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'Hoạt động' : 'Vô hiệu'}</Tag> },
    { title: 'Dùng lần cuối', dataIndex: 'lastUsedAt', render: (v?: string) => v ? formatDate(v) : 'Chưa dùng' },
    { title: 'Tạo lúc', dataIndex: 'createdAt', render: formatDate, responsive: ['lg'] as ('xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl')[] },
    {
      title: 'Thao tác',
      render: (_: unknown, r: ApiKey) => r.isActive && (
        <Popconfirm title="Thu hồi API key này?" onConfirm={() => revokeMutation.mutate(r.id)}>
          <Button size="small" danger icon={<DeleteOutlined />}>Thu hồi</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>API Keys</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>Tạo API Key</Button>
      </div>

      <Table
        dataSource={data || []}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 700 }}
        pagination={false}
      />

      {/* Create modal */}
      <Modal title="Tạo API Key mới" open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields(); }}
        onOk={() => form.submit()} okText="Tạo" cancelText="Hủy"
        confirmLoading={createMutation.isPending}>
        <Form form={form} layout="vertical" onFinish={createMutation.mutate} initialValues={{ environment: 'LIVE' }}>
          <Form.Item name="name" label="Tên API Key" rules={[{ required: true }]}>
            <Input placeholder="VD: Production Key" />
          </Form.Item>
          <Form.Item name="environment" label="Môi trường" rules={[{ required: true }]}>
            <Select options={[
              { value: 'LIVE', label: 'LIVE — Giao dịch thật trên blockchain' },
              { value: 'SANDBOX', label: 'SANDBOX — Test, không chạm blockchain' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Show new key - only shown once */}
      <Modal
        title="⚠️ Lưu thông tin API Key"
        open={!!newKey}
        onOk={() => setNewKey(null)}
        cancelButtonProps={{ style: { display: 'none' } }}
        okText="Đã lưu"
        closable={false}
      >
        <Alert message="Secret chỉ hiển thị một lần. Hãy sao chép và lưu lại ngay!" type="warning" showIcon style={{ marginBottom: 16 }} />
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Typography.Text type="secondary">Môi trường</Typography.Text>
            <div><Tag color={newKey?.environment === 'LIVE' ? 'red' : 'blue'}>{newKey?.environment}</Tag></div>
          </div>
          <div>
            <Typography.Text type="secondary">API Key</Typography.Text>
            <Input value={newKey?.key} readOnly addonAfter={<CopyOutlined style={{ cursor: 'pointer' }} onClick={() => copy(newKey!.key)} />} />
          </div>
          <div>
            <Typography.Text type="secondary">API Secret</Typography.Text>
            <Input.Password value={newKey?.secret} readOnly visibilityToggle
              addonAfter={<CopyOutlined style={{ cursor: 'pointer' }} onClick={() => copy(newKey!.secret)} />} />
          </div>
        </Space>
      </Modal>
    </div>
  );
}
