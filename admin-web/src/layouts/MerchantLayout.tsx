import { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Button, theme, Typography, Switch, Badge, Space, Tooltip, Tag } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined, SwapOutlined, ArrowUpOutlined,
  KeyOutlined, UserOutlined, MenuFoldOutlined, MenuUnfoldOutlined, LogoutOutlined,
  ExperimentOutlined, FileSearchOutlined, ApiOutlined, GiftOutlined, SendOutlined,
  BellOutlined, MoonOutlined, SunOutlined, DownOutlined, WalletOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../stores/auth.store';
import { useThemeStore } from '../stores/theme.store';
import { useLogout } from '../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { withdrawalService, merchantService } from '../services';
import { formatUSDT } from '../utils';

const { Sider, Header, Content } = Layout;

const menuItems = [
  { key: '/merchant/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/merchant/transactions', icon: <SwapOutlined />, label: 'Giao dịch' },
  { key: '/merchant/withdrawals', icon: <ArrowUpOutlined />, label: 'Rút tiền' },
  { key: '/merchant/sandbox', icon: <ExperimentOutlined />, label: 'Sandbox' },
  { key: '/merchant/reconciliation', icon: <FileSearchOutlined />, label: 'Đối soát' },
  { key: '/merchant/api-keys', icon: <KeyOutlined />, label: 'API Keys' },
  { key: '/merchant/api-docs', icon: <ApiOutlined />, label: 'API Docs' },
  { key: '/merchant/webhook-logs', icon: <SendOutlined />, label: 'Webhook Logs' },
  { key: '/merchant/referral', icon: <GiftOutlined />, label: 'Giới thiệu (Ref)' },
  { key: '/merchant/profile', icon: <UserOutlined />, label: 'Hồ sơ' },
];

const SIDEBAR_BG = '#12111c';
const SIDEBAR_BORDER = 'rgba(255,255,255,0.06)';

export default function MerchantLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const logout = useLogout();
  const { token } = theme.useToken();
  const isDark = useThemeStore((s) => s.isDark);
  const toggleTheme = useThemeStore((s) => s.toggle);

  const { data: profile } = useQuery({
    queryKey: ['merchant-profile'],
    queryFn: () => merchantService.getProfile().then((r) => r.data.data),
    refetchInterval: 30_000,
  });

  const { data: pendingWithdrawals } = useQuery({
    queryKey: ['header-my-pending-withdrawals'],
    queryFn: () => withdrawalService.list({ status: 'PENDING', limit: 1 }).then((r) => r.data.meta?.total || 0),
    refetchInterval: 30_000,
  });

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

        {!collapsed && (
          <div style={{ padding: '14px 16px 4px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              borderRadius: 12, padding: '12px 14px',
            }}>
              <Typography.Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, display: 'block' }}>
                Số dư khả dụng
              </Typography.Text>
              <Typography.Text strong style={{ color: '#fff', fontSize: 18 }}>
                {profile ? formatUSDT(profile.balance) : '—'} <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.85 }}>USDT</span>
              </Typography.Text>
            </div>
          </div>
        )}

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
              <Typography.Text strong style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, display: 'block' }}>CryptoGW Merchant</Typography.Text>
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
            {profile && (
              <Tag color="purple" style={{ borderRadius: 8, padding: '4px 10px', display: window.innerWidth < 480 ? 'none' : 'inline-block' }}>
                <WalletOutlined /> {profile.name}
              </Tag>
            )}
          </Space>

          <Space size={16}>
            <Tooltip title={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}>
              <Button type="text" shape="circle" icon={isDark ? <SunOutlined /> : <MoonOutlined />} onClick={toggleTheme} />
            </Tooltip>

            <Tooltip title="Yêu cầu rút tiền đang chờ duyệt">
              <Badge count={pendingWithdrawals || 0} size="small">
                <Button type="text" shape="circle" icon={<BellOutlined />} onClick={() => navigate('/merchant/withdrawals')} />
              </Badge>
            </Tooltip>

            <Dropdown menu={{
              items: [
                { key: 'profile', icon: <UserOutlined />, label: 'Hồ sơ', onClick: () => navigate('/merchant/profile') },
                { type: 'divider' as const },
                { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', onClick: logout },
              ],
            }}>
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar icon={<UserOutlined />} style={{ background: token.colorPrimary }} />
                <div style={{ lineHeight: 1.2, display: window.innerWidth < 480 ? 'none' : 'block' }}>
                  <Typography.Text style={{ fontSize: 13, display: 'block' }}>{user?.email}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>Merchant</Typography.Text>
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
