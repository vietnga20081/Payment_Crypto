import { Form, Input, Button, Card, Typography, Space } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { useLogin } from '../../hooks/useAuth';
import { Navigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';

export default function LoginPage() {
  const { isAuthenticated, user } = useAuthStore();
  const login = useLogin();

  if (isAuthenticated()) {
    const isAdmin = user && ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(user.role);
    return <Navigate to={isAdmin ? '/admin/dashboard' : '/merchant/dashboard'} replace />;
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
    }}>
      <Card style={{ width: '100%', maxWidth: 400, margin: '0 16px', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <Space direction="vertical" size={24} style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <Typography.Title level={2} style={{ margin: 0 }}>⚡ CryptoGW</Typography.Title>
            <Typography.Text type="secondary">Crypto Payment Gateway</Typography.Text>
          </div>

          {!login.requires2FA ? (
            <Form layout="vertical" onFinish={(v) => login.mutate(v)} requiredMark={false}>
              <Form.Item name="email" rules={[{ required: true, type: 'email', message: 'Nhập email hợp lệ' }]}>
                <Input prefix={<UserOutlined />} placeholder="Email" size="large" autoFocus />
              </Form.Item>
              <Form.Item name="password" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
                <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu" size="large" />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" size="large" block loading={login.isPending}>
                  Đăng nhập
                </Button>
              </Form.Item>
            </Form>
          ) : (
            <Form layout="vertical" onFinish={(v) => login.submitWithOtp(v.token)} requiredMark={false}>
              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                Nhập mã 6 số từ ứng dụng xác thực hoặc backup code
              </Typography.Text>
              <Form.Item name="token" rules={[{ required: true, message: 'Nhập mã xác thực' }]}>
                <Input prefix={<SafetyOutlined />} placeholder="123456" size="large" maxLength={10} autoFocus />
              </Form.Item>
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <Button type="primary" htmlType="submit" size="large" block loading={login.isPending}>
                  Xác nhận
                </Button>
                <Button type="link" block onClick={login.resetTwoFactor}>Quay lại</Button>
              </Space>
            </Form>
          )}

          {!login.requires2FA && (
            <Typography.Text type="secondary" style={{ textAlign: 'center', display: 'block' }}>
              Chưa có tài khoản? <Link to="/register">Đăng ký Đại lý</Link>
            </Typography.Text>
          )}
        </Space>
      </Card>
    </div>
  );
}
