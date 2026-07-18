import { Card, Button, List, Tag, Typography, Space, Popconfirm, message } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authService } from '../../services';
import { formatDate } from '../../utils';
import { DesktopOutlined, DeleteOutlined, LogoutOutlined } from '@ant-design/icons';
import { useLogout } from '../../hooks/useAuth';

export default function ActiveSessionsCard() {
  const qc = useQueryClient();
  const doLogout = useLogout();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['active-sessions'],
    queryFn: () => authService.getSessions().then((r) => r.data.data),
  });

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => authService.revokeSession(sessionId),
    onSuccess: () => {
      message.success('Đã thu hồi phiên đăng nhập');
      qc.invalidateQueries({ queryKey: ['active-sessions'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => message.error(e.response?.data?.message || 'Lỗi thu hồi phiên'),
  });

  const revokeAllMutation = useMutation({
    mutationFn: () => authService.revokeAllSessions(),
    onSuccess: () => {
      message.success('Đã thu hồi toàn bộ phiên — bạn sẽ cần đăng nhập lại');
      setTimeout(() => doLogout(), 800);
    },
    onError: (e: { response?: { data?: { message?: string } } }) => message.error(e.response?.data?.message || 'Lỗi thu hồi phiên'),
  });

  return (
    <Card
      title={<Space><DesktopOutlined /> Phiên đăng nhập</Space>}
      extra={
        <Popconfirm
          title="Thu hồi toàn bộ phiên đăng nhập?"
          description="Bạn (và mọi thiết bị khác đang đăng nhập) sẽ phải đăng nhập lại ngay."
          onConfirm={() => revokeAllMutation.mutate()}
          okText="Thu hồi tất cả" okButtonProps={{ danger: true }} cancelText="Hủy"
        >
          <Button danger size="small" icon={<LogoutOutlined />} loading={revokeAllMutation.isPending}>
            Thu hồi tất cả
          </Button>
        </Popconfirm>
      }
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
        Danh sách thiết bị/trình duyệt đang đăng nhập vào tài khoản của bạn. Nếu thấy phiên lạ không phải bạn, thu hồi ngay và đổi mật khẩu.
      </Typography.Paragraph>
      <List
        loading={isLoading}
        dataSource={sessions || []}
        locale={{ emptyText: 'Không có phiên nào' }}
        renderItem={(s) => (
          <List.Item
            actions={[
              <Popconfirm
                key="revoke"
                title="Thu hồi phiên này?"
                onConfirm={() => revokeMutation.mutate(s.id)}
                okText="Thu hồi" cancelText="Hủy"
              >
                <Button size="small" danger icon={<DeleteOutlined />} loading={revokeMutation.isPending}>
                  Thu hồi
                </Button>
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              title={
                <Space>
                  {s.device}
                  {s.ipAddress && <Tag>{s.ipAddress}</Tag>}
                </Space>
              }
              description={`Hoạt động gần nhất: ${formatDate(s.lastUsedAt)} — Đăng nhập lúc: ${formatDate(s.createdAt)}`}
            />
          </List.Item>
        )}
      />
    </Card>
  );
}
