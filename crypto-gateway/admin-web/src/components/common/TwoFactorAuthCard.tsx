import { useState } from 'react';
import { Card, Button, Modal, Input, Typography, Space, Image, Alert, message, Tag, List } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { twoFAService } from '../../services';
import { SafetyCertificateOutlined, CopyOutlined } from '@ant-design/icons';

export default function TwoFactorAuthCard() {
  const qc = useQueryClient();
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [qrData, setQrData] = useState<{ secret: string; qrCodeUrl: string } | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [otpToken, setOtpToken] = useState('');
  const [disablePassword, setDisablePassword] = useState('');

  const { data: status } = useQuery({
    queryKey: ['2fa-status'],
    queryFn: () => twoFAService.status().then((r) => r.data.data),
  });

  const setupMutation = useMutation({
    mutationFn: () => twoFAService.setup(),
    onSuccess: (res) => { setQrData(res.data.data); setSetupOpen(true); },
    onError: () => message.error('Lỗi khởi tạo 2FA'),
  });

  const enableMutation = useMutation({
    mutationFn: (token: string) => twoFAService.enable(token),
    onSuccess: (res) => {
      setBackupCodes(res.data.data.backupCodes);
      setSetupOpen(false);
      setOtpToken('');
      qc.invalidateQueries({ queryKey: ['2fa-status'] });
    },
    onError: () => message.error('Mã OTP không đúng'),
  });

  const disableMutation = useMutation({
    mutationFn: (password: string) => twoFAService.disable(password),
    onSuccess: () => {
      message.success('Đã tắt 2FA');
      setDisableOpen(false);
      setDisablePassword('');
      qc.invalidateQueries({ queryKey: ['2fa-status'] });
    },
    onError: () => message.error('Mật khẩu không đúng'),
  });

  const copy = (text: string) => { navigator.clipboard.writeText(text); message.success('Đã sao chép'); };

  return (
    <Card title={<Space><SafetyCertificateOutlined />Xác thực 2 lớp (2FA)</Space>}>
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Typography.Text>Trạng thái: </Typography.Text>
            <Tag color={status?.enabled ? 'green' : 'default'}>{status?.enabled ? 'Đã bật' : 'Chưa bật'}</Tag>
          </div>
          {status?.enabled ? (
            <Button danger onClick={() => setDisableOpen(true)}>Tắt 2FA</Button>
          ) : (
            <Button type="primary" loading={setupMutation.isPending} onClick={() => setupMutation.mutate()}>
              Bật 2FA
            </Button>
          )}
        </div>
        {!status?.enabled && (
          <Alert type="info" showIcon message="Khuyến nghị bật 2FA để bảo vệ tài khoản, đặc biệt khi duyệt rút tiền." />
        )}
      </Space>

      {/* Setup Modal */}
      <Modal title="Thiết lập 2FA" open={setupOpen} onCancel={() => { setSetupOpen(false); setOtpToken(''); }}
        footer={null}>
        {qrData && (
          <Space direction="vertical" align="center" style={{ width: '100%' }} size={16}>
            <Typography.Text>Quét mã QR bằng Google Authenticator / Authy:</Typography.Text>
            <Image src={qrData.qrCodeUrl} width={200} preview={false} />
            <Space>
              <Typography.Text type="secondary" code style={{ fontSize: 11 }}>{qrData.secret}</Typography.Text>
              <Button size="small" icon={<CopyOutlined />} onClick={() => copy(qrData.secret)} />
            </Space>
            <Input
              placeholder="Nhập mã 6 số" value={otpToken} maxLength={6}
              onChange={(e) => setOtpToken(e.target.value)} style={{ width: 200, textAlign: 'center' }}
            />
            <Button type="primary" block loading={enableMutation.isPending}
              disabled={otpToken.length !== 6}
              onClick={() => enableMutation.mutate(otpToken)}>
              Xác nhận & Kích hoạt
            </Button>
          </Space>
        )}
      </Modal>

      {/* Backup codes modal */}
      <Modal title="⚠️ Lưu Backup Codes" open={!!backupCodes}
        onOk={() => setBackupCodes(null)} okText="Đã lưu"
        cancelButtonProps={{ style: { display: 'none' } }} closable={false}>
        <Alert message="Mỗi mã chỉ dùng được 1 lần khi mất thiết bị xác thực. Lưu lại ngay!" type="warning" showIcon style={{ marginBottom: 16 }} />
        <List
          size="small" bordered dataSource={backupCodes || []}
          renderItem={(code) => (
            <List.Item>
              <Typography.Text code>{code}</Typography.Text>
            </List.Item>
          )}
        />
        <Button block style={{ marginTop: 12 }} icon={<CopyOutlined />}
          onClick={() => copy((backupCodes || []).join('\n'))}>
          Sao chép tất cả
        </Button>
      </Modal>

      {/* Disable modal */}
      <Modal title="Tắt 2FA" open={disableOpen} onCancel={() => setDisableOpen(false)}
        onOk={() => disableMutation.mutate(disablePassword)} okText="Xác nhận" okButtonProps={{ danger: true }}
        confirmLoading={disableMutation.isPending}>
        <Typography.Text>Nhập mật khẩu để xác nhận tắt 2FA:</Typography.Text>
        <Input.Password style={{ marginTop: 8 }} value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} />
      </Modal>
    </Card>
  );
}
