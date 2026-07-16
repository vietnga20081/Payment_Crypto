import { useState } from 'react';
import { Form, Input, Button, Card, Typography, Space, Alert, Result } from 'antd';
import { UserOutlined, LockOutlined, ShopOutlined, LinkOutlined, GiftOutlined } from '@ant-design/icons';
import { Link, useSearchParams, Navigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authService } from '../../services';
import { useAuthStore } from '../../stores/auth.store';

export default function RegisterPage() {
  const { isAuthenticated } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [done, setDone] = useState<{ email: string } | null>(null);

  const mutation = useMutation({
    mutationFn: (values: { email: string; password: string; merchantName: string; website?: string; referralCode?: string }) =>
      authService.register(values),
    onSuccess: (res) => setDone({ email: res.data.data.email }),
  });

  if (isAuthenticated()) return <Navigate to="/login" replace />;

  const errorMessage = (mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message;

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)', padding: 16,
    }}>
      <Card style={{ width: '100%', maxWidth: 440, borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        {done ? (
          <Result
            status="success"
            title="Đăng ký thành công!"
            subTitle={<>Kiểm tra hộp thư <b>{done.email}</b> và bấm vào link xác thực để bắt đầu sử dụng.</>}
            extra={<Link to="/login"><Button type="primary">Về trang đăng nhập</Button></Link>}
          />
        ) : (
          <Space direction="vertical" size={24} style={{ width: '100%' }}>
            <div style={{ textAlign: 'center' }}>
              <Typography.Title level={2} style={{ margin: 0 }}>⚡ CryptoGW</Typography.Title>
              <Typography.Text type="secondary">Đăng ký tài khoản Đại lý</Typography.Text>
            </div>

            {errorMessage && <Alert type="error" showIcon message={errorMessage} />}

            <Form
              layout="vertical" requiredMark={false}
              initialValues={{ referralCode: searchParams.get('ref') || '' }}
              onFinish={(v) => mutation.mutate(v)}
            >
              <Form.Item name="merchantName" rules={[{ required: true, message: 'Nhập tên Đại lý / cửa hàng' }]}>
                <Input prefix={<ShopOutlined />} placeholder="Tên Đại lý / cửa hàng" size="large" autoFocus />
              </Form.Item>
              <Form.Item name="email" rules={[{ required: true, type: 'email', message: 'Nhập email hợp lệ' }]}>
                <Input prefix={<UserOutlined />} placeholder="Email" size="large" />
              </Form.Item>
              <Form.Item name="password" rules={[{ required: true, min: 8, message: 'Mật khẩu tối thiểu 8 ký tự' }]}>
                <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu (tối thiểu 8 ký tự)" size="large" />
              </Form.Item>
              <Form.Item name="website">
                <Input prefix={<LinkOutlined />} placeholder="Website (không bắt buộc)" size="large" />
              </Form.Item>
              <Form.Item name="referralCode">
                <Input prefix={<GiftOutlined />} placeholder="Mã giới thiệu (không bắt buộc)" size="large" />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" size="large" block loading={mutation.isPending}>
                  Đăng ký
                </Button>
              </Form.Item>
            </Form>

            <Typography.Text type="secondary" style={{ textAlign: 'center', display: 'block' }}>
              Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
            </Typography.Text>
          </Space>
        )}
      </Card>
    </div>
  );
}
