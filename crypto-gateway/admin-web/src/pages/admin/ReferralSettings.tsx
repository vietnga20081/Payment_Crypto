import { useEffect } from 'react';
import { Card, Form, Switch, InputNumber, Button, Typography, Row, Col, Statistic, Table, message, Space, Alert } from 'antd';
import { GiftOutlined, DollarOutlined, TeamOutlined, NumberOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { referralAdminService } from '../../services';
import { formatUSDT } from '../../utils';
import { useAuthStore } from '../../stores/auth.store';

export default function ReferralSettingsPage() {
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const isSuperAdmin = useAuthStore((s) => s.user?.role === 'SUPER_ADMIN');

  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ['referral-settings'],
    queryFn: () => referralAdminService.getSettings().then((r) => r.data.data),
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['referral-stats'],
    queryFn: () => referralAdminService.getStats().then((r) => r.data.data),
  });

  useEffect(() => {
    if (settings) form.setFieldsValue(settings);
  }, [settings, form]);

  const updateMutation = useMutation({
    mutationFn: (values: { enabled: boolean; commissionRate: number; durationDays: number; dailyCap: number }) =>
      referralAdminService.updateSettings(values),
    onSuccess: () => {
      message.success('Đã lưu cấu hình giới thiệu');
      qc.invalidateQueries({ queryKey: ['referral-settings'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => message.error(e.response?.data?.message || 'Lỗi lưu cấu hình'),
  });

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 24 }}>
        <Space><GiftOutlined /> Chương trình Giới thiệu (Ref)</Space>
      </Typography.Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              loading={loadingStats}
              title="Tổng hoa hồng đã trả"
              value={formatUSDT(stats?.totalCommissionPaid || 0)}
              prefix={<DollarOutlined />}
              suffix="USDT"
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              loading={loadingStats}
              title="Số cặp quan hệ giới thiệu"
              value={stats?.totalReferralRelations || 0}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              loading={loadingStats}
              title="Số lượt hoa hồng đã ghi nhận"
              value={stats?.totalCommissionRows || 0}
              prefix={<NumberOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Cấu hình" style={{ marginBottom: 24 }}>
        {!isSuperAdmin && (
          <Alert type="warning" showIcon style={{ marginBottom: 16 }} message="Chỉ SUPER_ADMIN được sửa cấu hình này." />
        )}
        <Form
          form={form}
          layout="vertical"
          disabled={loadingSettings || !isSuperAdmin}
          onFinish={(v) => updateMutation.mutate(v)}
        >
          <Form.Item name="enabled" label="Bật chương trình giới thiệu" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="commissionRate" label="Tỉ lệ hoa hồng"
                tooltip="Tính trên PHÍ DỊCH VỤ của giao dịch (không phải trên tổng tiền giao dịch). VD: 0.1 = 10% của phí dịch vụ."
                rules={[{ required: true }]}
              >
                <InputNumber style={{ width: '100%' }} min={0} max={1} step={0.01} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="durationDays" label="Thời hạn hưởng hoa hồng (ngày)"
                tooltip="Số ngày kể từ lúc merchant được giới thiệu đăng ký. Để 0 = không giới hạn (hưởng vĩnh viễn)."
                rules={[{ required: true }]}
              >
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="dailyCap" label="Giới hạn hoa hồng/ngày (USDT)"
                tooltip="Trần tổng hoa hồng 1 người giới thiệu có thể nhận trong 1 ngày — chống lạm dụng (tạo tài khoản ảo tự giới thiệu nhau). Để 0 = không giới hạn."
                rules={[{ required: true }]}
              >
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          {isSuperAdmin && (
            <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>
              Lưu cấu hình
            </Button>
          )}
        </Form>
      </Card>

      <Card title="Top người giới thiệu (theo tổng hoa hồng)" style={{ marginBottom: 24 }}>
        <Table
          size="small"
          rowKey="merchantId"
          loading={loadingStats}
          dataSource={stats?.leaderboard || []}
          pagination={false}
          locale={{ emptyText: 'Chưa có hoa hồng nào được ghi nhận' }}
          columns={[
            { title: '#', render: (_: unknown, __: unknown, i: number) => i + 1, width: 50 },
            { title: 'Tên Đại lý', dataIndex: 'merchantName' },
            { title: 'Email', dataIndex: 'merchantEmail' },
            { title: 'Mã Ref', dataIndex: 'referralCode' },
            { title: 'Số lượt', dataIndex: 'commissionCount' },
            { title: 'Tổng hoa hồng', dataIndex: 'totalCommission', render: (v: string) => `${formatUSDT(v)} USDT` },
          ]}
        />
      </Card>

      <Card title="⚠️ Cảnh báo bảo mật — Lượt tự giới thiệu bị chặn">
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Hệ thống tự động chặn gắn quan hệ giới thiệu nếu người đăng ký dùng cùng địa chỉ IP với người giới thiệu (nghi ngờ tự tạo tài khoản ảo). Tài khoản vẫn được tạo bình thường, chỉ không tính hoa hồng."
        />
        <Table
          size="small"
          rowKey="id"
          loading={loadingStats}
          dataSource={stats?.suspiciousAttempts || []}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: 'Chưa phát hiện lượt nào' }}
          columns={[
            { title: 'Thời gian', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleString('vi-VN') },
            { title: 'IP', dataIndex: 'ipAddress' },
            { title: 'Email đăng ký', render: (_: unknown, r) => r.detail?.email || '—' },
            { title: 'Mã Ref đã dùng', render: (_: unknown, r) => r.detail?.referralCode || '—' },
          ]}
        />
      </Card>
    </div>
  );
}
