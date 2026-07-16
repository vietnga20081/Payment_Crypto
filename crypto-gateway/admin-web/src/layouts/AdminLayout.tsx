import { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Button, theme, Typography } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined, TeamOutlined, SwapOutlined, ArrowUpOutlined,
  WalletOutlined, BarChartOutlined, SettingOutlined, AuditOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, LogoutOutlined, UserOutlined,
  ThunderboltOutlined, FileSearchOutlined, TeamOutlined as AdminIcon, GiftOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../stores/auth.store';
import { useLogout } from '../hooks/useAuth';

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

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const logout = useLogout();
  const { token } = theme.useToken();

  const menuItems = user?.role === 'SUPER_ADMIN'
    ? [...baseMenuItems, { key: '/admin/admins', icon: <AdminIcon />, label: 'Quản lý Admin' }]
    : baseMenuItems;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        collapsedWidth={window.innerWidth < 768 ? 0 : 80}
        style={{ background: token.colorBgContainer, borderRight: `1px solid ${token.colorBorderSecondary}`, position: 'fixed', height: '100vh', zIndex: 100, left: 0, top: 0 }}
        trigger={null}
      >
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
          {!collapsed && <Typography.Text strong style={{ fontSize: 16, color: token.colorPrimary }}>⚡ CryptoGW</Typography.Text>}
          {collapsed && <Typography.Text strong style={{ color: token.colorPrimary }}>⚡</Typography.Text>}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{ border: 'none', marginTop: 8 }}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? (window.innerWidth < 768 ? 0 : 80) : 200, transition: 'margin 0.2s' }}>
        <Header style={{
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          padding: '0 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 99,
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Dropdown menu={{
            items: [
              { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', onClick: logout },
            ],
          }}>
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar icon={<UserOutlined />} style={{ background: token.colorPrimary }} />
              <Typography.Text>{user?.email}</Typography.Text>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ padding: '24px', overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
