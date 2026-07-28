import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services';
import { useAuthStore } from '../stores/auth.store';

export const useLogin = () => {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const [requires2FA, setRequires2FA] = useState(false);
  const [pendingCreds, setPendingCreds] = useState<{ email: string; password: string } | null>(null);

  const mutation = useMutation({
    mutationFn: ({ email, password, twoFactorToken }: { email: string; password: string; twoFactorToken?: string }) =>
      authService.login(email, password, twoFactorToken),
    onSuccess: (res, variables) => {
      const data = res.data.data;
      if (data.requiresTwoFactor) {
        setRequires2FA(true);
        setPendingCreds({ email: variables.email, password: variables.password });
        return;
      }
      const { user, accessToken, refreshToken } = data as { user: { id: string; email: string; role: string }; accessToken: string; refreshToken: string };
      setAuth({ id: user.id, email: user.email, role: user.role as 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR' | 'MERCHANT' }, accessToken, refreshToken);
      message.success('Đăng nhập thành công');
      navigate(['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(user.role) ? '/admin/dashboard' : '/merchant/dashboard');
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      message.error(e.response?.data?.message || 'Email hoặc mật khẩu không đúng'),
  });

  const submitWithOtp = (token: string) => {
    if (!pendingCreds) return;
    mutation.mutate({ ...pendingCreds, twoFactorToken: token });
  };

  const reset = () => { setRequires2FA(false); setPendingCreds(null); };

  return { ...mutation, requires2FA, submitWithOtp, resetTwoFactor: reset };
};

export const useLogout = () => {
  const { refreshToken, logout } = useAuthStore();
  const navigate = useNavigate();

  return () => {
    if (refreshToken) authService.logout(refreshToken).catch(() => {});
    logout();
    navigate('/login');
  };
};
