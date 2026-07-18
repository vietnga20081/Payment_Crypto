import { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Button, theme, Typography } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined, SwapOutlined, ArrowUpOutlined,
  KeyOutlined, UserOutlined, MenuFoldOutlined, MenuUnfoldOutlined, LogoutOutlined,
  ExperimentOutlined, FileSearchOutlined, ApiOutlined, GiftOutlined, SendOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../stores/auth.store';
import { useLogout } from '../hooks/useAuth';

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

export default function MerchantLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const logout = useLogout();
  const { token } = theme.useToken();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible collapsed={collapsed} onCollapse={setCollapsed}
        breakpoint="lg"
        collapsedWidth={window.innerWidth < 768 ? 0 : 80}
        style={{ background: token.colorBgContainer, borderRight: `1px solid ${token.colorBorderSecondary}`, position: 'fixed', height: '100vh', zIndex: 100, left: 0, top: 0 }}
        trigger={null}
      >
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
          {!collapsed && <Typography.Text strong style={{ fontSize: 16, color: token.colorPrimary }}>⚡ Merchant</Typography.Text>}
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
          <Button type="text" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed(!collapsed)} />
          <Dropdown menu={{ items: [{ key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', onClick: logout }] }}>
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
