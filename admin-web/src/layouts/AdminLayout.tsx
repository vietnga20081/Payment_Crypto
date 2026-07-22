import { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Button, theme, Typography, Switch, Badge, Input, Space, Tooltip } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined, TeamOutlined, SwapOutlined, ArrowUpOutlined,
  WalletOutlined, BarChartOutlined, SettingOutlined, AuditOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, LogoutOutlined, UserOutlined,
  ThunderboltOutlined, FileSearchOutlined, TeamOutlined as AdminIcon, GiftOutlined,
  SearchOutlined, BellOutlined, MoonOutlined, SunOutlined, DownOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../stores/auth.store';
import { useThemeStore } from '../stores/theme.store';
import { useLogout } from '../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { withdrawalService } from '../services';

const { Sider, Header, Content } = Layout;

const baseMenuItems = [
  { key: '/admin/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/admin/merchants', icon: <TeamOutlined />, label: 'Đại lý' },
  { key: '/admin/transactions', icon: <SwapOutlined />, label: 'Giao dịch' },
  { key: '/admin/withdrawals', icon: <ArrowUpOutlined />, label: 'Rút tiền' },
  { key: '/admin/wallets', icon: <WalletOutlined />, label: 'Ví' },
  { key: '/admin/sweep', icon: <ThunderboltOutlined />, label: 'Sweep' },
  { key: '/admin/reconciliation', icon: <FileSearchOutlined />, label: 'Đối soát' },
  { key: '/admin/reports', icon: <BarChartOutlined />, label: 'Báo cáo' },
  { key: '/admin/referral', icon: <GiftOutlined />, label: 'Giới thiệu (Ref)' },
  { key: '/admin/settings', icon: <SettingOutlined />, label: 'Cài đặt' },
  { key: '/admin/audit-logs', icon: <AuditOutlined />, label: 'Audit Log' },
];

const SIDEBAR_BG = '#12111c';
const SIDEBAR_BORDER = 'rgba(255,255,255,0.06)';

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const logout = useLogout();
  const { token } = theme.useToken();
  const isDark = useThemeStore((s) => s.isDark);
  const toggleTheme = useThemeStore((s) => s.toggle);

  const { data: pendingWithdrawals } = useQuery({
    queryKey: ['header-pending-withdrawals'],
    queryFn: () => withdrawalService.list({ status: 'PENDING', limit: 1 }).then((r) => r.data.meta?.total || 0),
    refetchInterval: 30_000,
  });

  const menuItems = user?.role === 'SUPER_ADMIN'
    ? [...baseMenuItems, { key: '/admin/admins', icon: <AdminIcon />, label: 'Quản lý Admin' }]
    : baseMenuItems;

  const siderWidth = collapsed ? (window.innerWidth < 768 ? 0 : 80) : 220;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        width={220}
        collapsedWidth={window.innerWidth < 768 ? 0 : 80}
        style={{
          background: SIDEBAR_BG,
          position: 'fixed', height: '100vh', zIndex: 100, left: 0, top: 0,
          display: 'flex', flexDirection: 'column',
        }}
        trigger={null}
      >
        <div style={{
          height: 64, display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? 0 : '0 20px',
          borderBottom: `1px solid ${SIDEBAR_BORDER}`, flexShrink: 0,
        }}>
          <Typography.Text strong style={{ fontSize: 17, color: '#fff', whiteSpace: 'nowrap' }}>
            ⚡ {!collapsed && 'CryptoGW'}
          </Typography.Text>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ background: 'transparent', border: 'none' }}
            theme="dark"
            className="cryptogw-dark-menu"
          />
        </div>

        <div style={{ borderTop: `1px solid ${SIDEBAR_BORDER}`, padding: collapsed ? '12px 8px' : '14px 16px', flexShrink: 0 }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Space size={6}>
                {isDark ? <MoonOutlined style={{ color: 'rgba(255,255,255,0.65)' }} /> : <SunOutlined style={{ color: 'rgba(255,255,255,0.65)' }} />}
                <Typography.Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>Chế độ sáng</Typography.Text>
              </Space>
              <Switch size="small" checked={!isDark} onChange={() => toggleTheme()} />
            </div>
          )}
          {!collapsed && (
            <>
              <Typography.Text strong style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, display: 'block' }}>CryptoGW</Typography.Text>
              <Typography.Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, display: 'block' }}>v2.3.0</Typography.Text>
              <Typography.Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, display: 'block' }}>© 2026 All rights reserved.</Typography.Text>
            </>
          )}
        </div>
      </Sider>

      <Layout style={{ marginLeft: siderWidth, transition: 'margin 0.2s' }}>
        <Header style={{
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          padding: '0 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 99, height: 64,
        }}>
          <Space size={12}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
            />
            <Input
              placeholder="Tìm kiếm giao dịch, đại lý..."
              prefix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
              style={{ width: 260, display: window.innerWidth < 640 ? 'none' : 'inline-flex' }}
              onPressEnter={(e) => {
                const q = (e.target as HTMLInputElement).value.trim();
                if (q) navigate(`/admin/transactions?search=${encodeURIComponent(q)}`);
              }}
            />
          </Space>

          <Space size={16}>
            <Tooltip title={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}>
              <Button type="text" shape="circle" icon={isDark ? <SunOutlined /> : <MoonOutlined />} onClick={toggleTheme} />
            </Tooltip>

            <Tooltip title="Rút tiền chờ duyệt">
              <Badge count={pendingWithdrawals || 0} size="small">
                <Button type="text" shape="circle" icon={<BellOutlined />} onClick={() => navigate('/admin/withdrawals')} />
              </Badge>
            </Tooltip>

            <Dropdown menu={{
              items: [
                { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', onClick: logout },
              ],
            }}>
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar icon={<UserOutlined />} style={{ background: token.colorPrimary }} />
                <div style={{ lineHeight: 1.2, display: window.innerWidth < 480 ? 'none' : 'block' }}>
                  <Typography.Text style={{ fontSize: 13, display: 'block' }}>{user?.email}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    {user?.role === 'SUPER_ADMIN' ? 'Super Admin' : user?.role === 'ADMIN' ? 'Administrator' : 'Operator'}
                  </Typography.Text>
                </div>
                <DownOutlined style={{ fontSize: 10, color: token.colorTextQuaternary }} />
              </div>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ padding: '24px', overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
