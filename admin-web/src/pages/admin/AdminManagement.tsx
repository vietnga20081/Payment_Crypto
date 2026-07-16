import { useState } from 'react';
import { Table, Tag, Button, Modal, Form, Input, Select, Typography, Space, Switch, message, Drawer, Popconfirm } from 'antd';
import type { ColumnType } from 'antd/es/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminManagementService } from '../../services';
import { formatDate } from '../../utils';
import type { AdminUser, AdminPermission } from '../../types';
import { PlusOutlined, SettingOutlined, EditOutlined, DeleteOutlined, KeyOutlined } from '@ant-design/icons';

const resourceLabel: Record<string, string> = {
  merchants: 'Đại lý',
  transactions: 'Giao dịch',
  withdrawals: 'Rút tiền',
  wallets: 'Ví',
  settings: 'Cài đặt',
  reports: 'Báo cáo',
  audit: 'Audit Log',
};

const roleColor: Record<string, string> = { SUPER_ADMIN: 'gold', ADMIN: 'blue', OPERATOR: 'green' };

export default function AdminManagementPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [resetPwTarget, setResetPwTarget] = useState<AdminUser | null>(null);
  const [permTarget, setPermTarget] = useState<AdminUser | null>(null);
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [resetPwForm] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-list'],
    queryFn: () => adminManagementService.list().then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (values: { email: string; password: string; role: 'ADMIN' | 'OPERATOR' }) =>
      adminManagementService.create(values),
    onSuccess: () => {
      message.success('Tạo admin thành công');
      qc.invalidateQueries({ queryKey: ['admin-list'] });
      setCreateOpen(false);
      form.resetFields();
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      message.error(e.response?.data?.message || 'Lỗi tạo admin'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => adminManagementService.setStatus(id, status),
    onSuccess: () => { message.success('Đã cập nhật'); qc.invalidateQueries({ queryKey: ['admin-list'] }); },
    onError: (e: { response?: { data?: { message?: string } } }) => message.error(e.response?.data?.message || 'Lỗi cập nhật'),
  });

  const updateMutation = useMutation({
    mutationFn: (values: { email?: string; role?: 'ADMIN' | 'OPERATOR' }) =>
      adminManagementService.update(editTarget!.id, values),
    onSuccess: () => {
      message.success('Đã cập nhật admin');
      qc.invalidateQueries({ queryKey: ['admin-list'] });
      setEditTarget(null);
      editForm.resetFields();
    },
    onError: (e: { response?: { data?: { message?: string } } }) => message.error(e.response?.data?.message || 'Lỗi cập nhật'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminManagementService.remove(id),
    onSuccess: () => { message.success('Đã xóa admin'); qc.invalidateQueries({ queryKey: ['admin-list'] }); },
    onError: (e: { response?: { data?: { message?: string } } }) => message.error(e.response?.data?.message || 'Lỗi xóa admin'),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (newPassword: string) => adminManagementService.resetPassword(resetPwTarget!.id, newPassword),
    onSuccess: () => {
      message.success('Đã đặt lại mật khẩu — admin đó sẽ phải đăng nhập lại');
      setResetPwTarget(null);
      resetPwForm.resetFields();
    },
    onError: (e: { response?: { data?: { message?: string } } }) => message.error(e.response?.data?.message || 'Lỗi đặt lại mật khẩu'),
  });

  const openPermissions = async (admin: AdminUser) => {
    setPermTarget(admin);
    const res = await adminManagementService.getPermissions(admin.id);
    setPermissions(res.data.data);
  };

  const savePermissionsMutation = useMutation({
    mutationFn: () => adminManagementService.setPermissions(permTarget!.id, permissions),
    onSuccess: () => {
      message.success('Đã lưu phân quyền');
      setPermTarget(null);
    },
  });

  const togglePerm = (resource: string, field: keyof AdminPermission, value: boolean) => {
    setPermissions((prev) => prev.map((p) => p.resource === resource ? { ...p, [field]: value } : p));
  };

  const columns: ColumnType<AdminUser>[] = [
    { title: 'Email', dataIndex: 'email' },
    { title: 'Vai trò', dataIndex: 'role', render: (v: string) => <Tag color={roleColor[v]}>{v}</Tag> },
    {
      title: 'Trạng thái', dataIndex: 'status',
      render: (v: string, r: AdminUser) => r.role === 'SUPER_ADMIN' ? <Tag color="green">ACTIVE</Tag> : (
        <Select size="small" value={v} style={{ width: 110 }}
          onChange={(val) => statusMutation.mutate({ id: r.id, status: val })}
          options={[
            { value: 'ACTIVE', label: 'Hoạt động' },
            { value: 'INACTIVE', label: 'Tạm dừng' },
            { value: 'SUSPENDED', label: 'Đình chỉ' },
          ]} />
      ),
    },
    { title: 'Đăng nhập cuối', dataIndex: 'lastLoginAt', render: (v?: string) => v ? formatDate(v) : 'Chưa đăng nhập' },
    { title: 'Tạo lúc', dataIndex: 'createdAt', render: formatDate, responsive: ['lg'] as ('xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl')[] },
    {
      title: 'Thao tác',
      render: (_: unknown, r: AdminUser) => r.role !== 'SUPER_ADMIN' && (
        <Space wrap>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditTarget(r); editForm.setFieldsValue({ email: r.email, role: r.role }); }}>
            Sửa
          </Button>
          <Button size="small" icon={<SettingOutlined />} onClick={() => openPermissions(r)}>Phân quyền</Button>
          <Button size="small" icon={<KeyOutlined />} onClick={() => setResetPwTarget(r)}>Đặt lại MK</Button>
          <Popconfirm
            title="Xóa admin này?"
            description="Tài khoản sẽ bị khóa và không thể đăng nhập nữa. Lịch sử thao tác vẫn được giữ lại."
            onConfirm={() => deleteMutation.mutate(r.id)}
            okText="Xóa" okButtonProps={{ danger: true }} cancelText="Hủy"
          >
            <Button size="small" danger icon={<DeleteOutlined />} loading={deleteMutation.isPending}>Xóa</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Quản lý Admin</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>Thêm admin</Button>
      </div>

      <Table dataSource={data || []} columns={columns} rowKey="id" loading={isLoading} scroll={{ x: 700 }} pagination={false} />

      <Modal title="Thêm Admin mới" open={createOpen} onCancel={() => { setCreateOpen(false); form.resetFields(); }}
        onOk={() => form.submit()} confirmLoading={createMutation.isPending} okText="Tạo" cancelText="Hủy">
        <Form form={form} layout="vertical" onFinish={createMutation.mutate}>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, min: 8 }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="role" label="Vai trò" rules={[{ required: true }]} initialValue="OPERATOR">
            <Select options={[
              { value: 'ADMIN', label: 'Admin — Quản lý đầy đủ (trừ quản lý admin khác)' },
              { value: 'OPERATOR', label: 'Operator — Quyền hạn chế, tùy chỉnh bên dưới' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer title={`Phân quyền — ${permTarget?.email}`} open={!!permTarget} onClose={() => setPermTarget(null)} width={520}
        extra={<Button type="primary" loading={savePermissionsMutation.isPending} onClick={() => savePermissionsMutation.mutate()}>Lưu</Button>}>
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          {permissions.map((p) => (
            <div key={p.resource} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
              <Typography.Text strong>{resourceLabel[p.resource] || p.resource}</Typography.Text>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                <Space size={4}><Switch size="small" checked={p.canView} onChange={(v) => togglePerm(p.resource, 'canView', v)} /><span>Xem</span></Space>
                <Space size={4}><Switch size="small" checked={p.canCreate} onChange={(v) => togglePerm(p.resource, 'canCreate', v)} /><span>Tạo</span></Space>
                <Space size={4}><Switch size="small" checked={p.canEdit} onChange={(v) => togglePerm(p.resource, 'canEdit', v)} /><span>Sửa</span></Space>
                <Space size={4}><Switch size="small" checked={p.canDelete} onChange={(v) => togglePerm(p.resource, 'canDelete', v)} /><span>Xóa</span></Space>
                <Space size={4}><Switch size="small" checked={p.canApprove} onChange={(v) => togglePerm(p.resource, 'canApprove', v)} /><span>Duyệt</span></Space>
              </div>
            </div>
          ))}
        </Space>
      </Drawer>

      <Modal title={`Sửa admin — ${editTarget?.email}`} open={!!editTarget}
        onCancel={() => { setEditTarget(null); editForm.resetFields(); }}
        onOk={() => editForm.submit()} confirmLoading={updateMutation.isPending} okText="Lưu" cancelText="Hủy">
        <Form form={editForm} layout="vertical" onFinish={updateMutation.mutate}>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="Vai trò" rules={[{ required: true }]}>
            <Select options={[
              { value: 'ADMIN', label: 'Admin — Quản lý đầy đủ (trừ quản lý admin khác)' },
              { value: 'OPERATOR', label: 'Operator — Quyền hạn chế, tùy chỉnh ở Phân quyền' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`Đặt lại mật khẩu — ${resetPwTarget?.email}`} open={!!resetPwTarget}
        onCancel={() => { setResetPwTarget(null); resetPwForm.resetFields(); }}
        onOk={() => resetPwForm.submit()} confirmLoading={resetPasswordMutation.isPending} okText="Đặt lại" cancelText="Hủy">
        <Typography.Paragraph type="secondary">
          Admin này sẽ bị đăng xuất khỏi mọi phiên hiện tại và phải đăng nhập lại bằng mật khẩu mới.
        </Typography.Paragraph>
        <Form form={resetPwForm} layout="vertical" onFinish={(v) => resetPasswordMutation.mutate(v.newPassword)}>
          <Form.Item name="newPassword" label="Mật khẩu mới" rules={[{ required: true, min: 8, message: 'Tối thiểu 8 ký tự' }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
