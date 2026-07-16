import { useEffect, useState } from 'react';
import { Card, Form, Input, Button, Typography, Row, Col, Descriptions, Tag, message, Space, Popconfirm, Alert } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CopyOutlined, ReloadOutlined } from '@ant-design/icons';
import { merchantService, authService } from '../../services';
import { formatDate, formatUSDT } from '../../utils';
import TwoFactorAuthCard from '../../components/common/TwoFactorAuthCard';
import IpWhitelistCard from '../../components/common/IpWhitelistCard';

export default function MerchantProfilePage() {
  const qc = useQueryClient();
  const [profileForm] = Form.useForm();
  const [pwForm] = Form.useForm();
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  const copy = (text: string) => { navigator.clipboard.writeText(text); message.success('Đã sao chép'); };

  const { data: profile, isLoading } = useQuery({
    queryKey: ['merchant-profile'],
    queryFn: () => merchantService.getProfile().then((r) => r.data.data),
  });

  useEffect(() => {
    if (profile) profileForm.setFieldsValue({ name: profile.name, website: profile.website, callbackUrl: profile.callbackUrl });
  }, [profile, profileForm]);

  const updateMutation = useMutation({
    mutationFn: (values: { name?: string; website?: string; callbackUrl?: string }) => merchantService.updateProfile(values),
    onSuccess: () => { message.success('Cập nhật thành công'); qc.invalidateQueries({ queryKey: ['merchant-profile'] }); },
    onError: () => message.error('Lỗi cập nhật'),
  });

  const pwMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      authService.changePassword(currentPassword, newPassword),
    onSuccess: () => { message.success('Đổi mật khẩu thành công'); pwForm.resetFields(); },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      message.error(e.response?.data?.message || 'Lỗi đổi mật khẩu'),
  });

  const resetSecretMutation = useMutation({
    mutationFn: () => merchantService.resetMyWebhookSecret(),
    onSuccess: (res) => {
      setRevealedSecret(res.data.data.webhookSecret);
      message.success('Đã tạo Webhook Secret mới');
      qc.invalidateQueries({ queryKey: ['merchant-profile'] });
    },
    onError: () => message.error('Lỗi làm mới Webhook Secret'),
  });

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 24 }}>Hồ sơ đại lý</Typography.Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Thông tin tài khoản" loading={isLoading}>
            {profile && (
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Số dư">{formatUSDT(profile.balance)}</Descriptions.Item>
                <Descriptions.Item label="Đóng băng">{formatUSDT(profile.frozenBalance)}</Descriptions.Item>
                <Descriptions.Item label="Số dư Sandbox">{formatUSDT(profile.sandboxBalance)}</Descriptions.Item>
                <Descriptions.Item label="Hạn mức rút/ngày">{formatUSDT(profile.dailyWithdrawalLimit)}</Descriptions.Item>
                <Descriptions.Item label="Phí GD">{(Number(profile.feeRate) * 100).toFixed(2)}%</Descriptions.Item>
                <Descriptions.Item label="Trạng thái"><Tag color="green">{profile.status}</Tag></Descriptions.Item>
                <Descriptions.Item label="Ngày tham gia">{formatDate(profile.createdAt)}</Descriptions.Item>
              </Descriptions>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Chỉnh sửa thông tin">
            <Form form={profileForm} layout="vertical" onFinish={updateMutation.mutate}>
              <Form.Item name="name" label="Tên đại lý" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="website" label="Website">
                <Input placeholder="https://example.com" />
              </Form.Item>
              <Form.Item name="callbackUrl" label="Callback URL">
                <Input placeholder="https://example.com/webhook" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>Lưu thay đổi</Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Đổi mật khẩu">
            <Form form={pwForm} layout="vertical" onFinish={pwMutation.mutate}>
              <Form.Item name="currentPassword" label="Mật khẩu hiện tại" rules={[{ required: true }]}>
                <Input.Password />
              </Form.Item>
              <Form.Item name="newPassword" label="Mật khẩu mới"
                rules={[{ required: true, min: 8, message: 'Tối thiểu 8 ký tự' }]}>
                <Input.Password />
              </Form.Item>
              <Form.Item name="confirmPassword" label="Xác nhận mật khẩu"
                dependencies={['newPassword']}
                rules={[
                  { required: true },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                      return Promise.reject('Mật khẩu không khớp');
                    },
                  }),
                ]}>
                <Input.Password />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={pwMutation.isPending}>Đổi mật khẩu</Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Webhook Secret">
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="Dùng khóa này để xác minh chữ ký (HMAC) của webhook gửi tới callback URL của bạn. Xem mục 🔐 Xác minh chữ ký trong API Docs."
            />
            {profile?.webhookSecret && !revealedSecret && (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Typography.Text type="secondary">Webhook Secret hiện tại</Typography.Text>
                <Input.Password
                  value={profile.webhookSecret}
                  readOnly
                  visibilityToggle
                  addonAfter={<CopyOutlined style={{ cursor: 'pointer' }} onClick={() => copy(profile.webhookSecret!)} />}
                />
              </Space>
            )}
            {revealedSecret && (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Alert type="warning" showIcon message="Secret mới chỉ hiển thị một lần. Hãy sao chép và lưu lại ngay!" />
                <Input.Password
                  value={revealedSecret}
                  readOnly
                  visibilityToggle
                  addonAfter={<CopyOutlined style={{ cursor: 'pointer' }} onClick={() => copy(revealedSecret)} />}
                />
              </Space>
            )}
            <Popconfirm
              title="Tạo Webhook Secret mới?"
              description="Secret cũ sẽ ngừng hoạt động ngay lập tức. Bạn cần cập nhật lại nơi xác minh chữ ký webhook."
              onConfirm={() => resetSecretMutation.mutate()}
              okText="Tạo mới"
              cancelText="Hủy"
            >
              <Button
                style={{ marginTop: 16 }}
                icon={<ReloadOutlined />}
                loading={resetSecretMutation.isPending}
              >
                {profile?.webhookSecret ? 'Làm mới Webhook Secret' : 'Tạo Webhook Secret'}
              </Button>
            </Popconfirm>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <TwoFactorAuthCard />
        </Col>

        <Col xs={24}>
          <IpWhitelistCard />
        </Col>
      </Row>
    </div>
  );
}
