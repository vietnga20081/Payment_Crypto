import { useEffect, useState } from 'react';
import { Card, Result, Button, Spin, Input, Space, message } from 'antd';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authService } from '../../services';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [resendEmail, setResendEmail] = useState('');

  const verifyMutation = useMutation({
    mutationFn: (t: string) => authService.verifyEmail(t),
    onSuccess: () => setStatus('success'),
    onError: () => setStatus('error'),
  });

  const resendMutation = useMutation({
    mutationFn: (email: string) => authService.resendVerification(email),
    onSuccess: () => message.success('Nếu email tồn tại và chưa xác thực, chúng tôi đã gửi lại link mới'),
  });

  useEffect(() => {
    if (token) verifyMutation.mutate(token);
    else setStatus('error');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)', padding: 16,
    }}>
      <Card style={{ width: '100%', maxWidth: 440, borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        {status === 'verifying' && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin size="large" />
            <p style={{ marginTop: 16 }}>Đang xác thực...</p>
          </div>
        )}

        {status === 'success' && (
          <Result
            status="success"
            title="Xác thực email thành công!"
            subTitle="Bạn có thể đăng nhập ngay bây giờ."
            extra={<Link to="/login"><Button type="primary">Đăng nhập</Button></Link>}
          />
        )}

        {status === 'error' && (
          <Result
            status="error"
            title="Link xác thực không hợp lệ hoặc đã hết hạn"
            subTitle="Nhập lại email để nhận link xác thực mới."
            extra={
              <Space direction="vertical" style={{ width: '100%' }}>
                <Input placeholder="Email của bạn" value={resendEmail} onChange={(e) => setResendEmail(e.target.value)} />
                <Button type="primary" block loading={resendMutation.isPending} onClick={() => resendMutation.mutate(resendEmail)}>
                  Gửi lại link xác thực
                </Button>
                <Link to="/login">Về trang đăng nhập</Link>
              </Space>
            }
          />
        )}
      </Card>
    </div>
  );
}
