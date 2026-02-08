import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Button, theme } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  GlobalOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  CrownOutlined,
  GiftOutlined,
  HistoryOutlined,
  FileTextOutlined,
  StarOutlined,
  DollarOutlined,
  MessageOutlined,
  BellOutlined,
  TrophyOutlined,
  UsergroupAddOutlined,
  ShoppingOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

const { Header, Sider, Content } = Layout;

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/secret-admin-ultra-2026');
    } catch (error) {
      console.error('登出失敗:', error);
    }
  };

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '登出',
      onClick: handleLogout,
    },
  ];

  // 選單項目
  const menuItems = [
    {
      key: '/admin/dashboard',
      icon: <DashboardOutlined />,
      label: '總覽',
    },
    {
      key: '/admin/users',
      icon: <UserOutlined />,
      label: '用戶管理',
    },
    {
      key: '/admin/applications',
      icon: <CalendarOutlined />,
      label: '申請管理',
    },
    {
      type: 'divider',
    },
    {
      key: 'membership',
      icon: <CrownOutlined />,
      label: '會員系統',
      children: [
        {
          key: '/admin/membership/tiers',
          icon: <StarOutlined />,
          label: '身分組管理',
        },
        {
          key: '/admin/membership/points-rules',
          icon: <GiftOutlined />,
          label: '點數規則',
        },
        {
          key: '/admin/membership/redeemable-items',
          icon: <GiftOutlined />,
          label: '兌換商品',
        },
        {
          key: '/admin/membership/points-ledger',
          icon: <HistoryOutlined />,
          label: '點數紀錄',
        },
        {
          key: '/admin/membership/audit-logs',
          icon: <FileTextOutlined />,
          label: '操作日誌',
        },
        {
          key: '/admin/membership/payment-history',
          icon: <DollarOutlined />,
          label: '付款歷史',
        },
        {
          key: '/admin/membership/missions',
          icon: <TrophyOutlined />,
          label: '任務管理',
        },
        {
          key: '/admin/membership/referrals',
          icon: <UsergroupAddOutlined />,
          label: '推薦紀錄',
        },
        {
          key: '/admin/membership/store-orders',
          icon: <ShoppingOutlined />,
          label: '兌換訂單',
        },
      ],
    },
    {
      type: 'divider',
    },
    {
      key: '/admin/site-editor',
      icon: <GlobalOutlined />,
      label: '官網內容',
    },
    {
      key: '/admin/line-bot',
      icon: <MessageOutlined />,
      label: 'LINE Bot',
    },
    {
      key: '/admin/notifications',
      icon: <BellOutlined />,
      label: '通知管理',
    },
    {
      key: '/admin/feedbacks',
      icon: <StarOutlined />,
      label: '建議管理',
    },
  ];

  // 計算選中的選單項
  const getSelectedKeys = () => {
    const path = location.pathname;
    return [path];
  };

  // 計算展開的子選單
  const getOpenKeys = () => {
    const path = location.pathname;
    if (path.includes('/membership/')) {
      return ['membership'];
    }
    return [];
  };

  const handleMenuClick = ({ key }) => {
    if (key && key.startsWith('/')) {
      navigate(key);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 側邊欄 */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="dark"
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
        }}
      >
        {/* Logo */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>⚡</span>
            </div>
            {!collapsed && (
              <div>
                <div style={{ color: '#fff', fontWeight: 'bold', fontSize: 14, lineHeight: 1.2 }}>
                  Ultra Admin
                </div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>
                  管理後台
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 選單 */}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={getSelectedKeys()}
          defaultOpenKeys={getOpenKeys()}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0, marginTop: 8 }}
        />

        {/* 底部管理員資訊 */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: collapsed ? '12px 8px' : '12px 16px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(0,0,0,0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar size={collapsed ? 24 : 32} icon={<UserOutlined />} style={{ backgroundColor: '#3b82f6' }} />
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#fff', fontSize: 12, fontWeight: 500 }}>Admin</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>○ 管理員</div>
              </div>
            )}
          </div>
          {!collapsed && (
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              style={{
                width: '100%',
                marginTop: 8,
                color: 'rgba(255,255,255,0.65)',
                textAlign: 'left',
                padding: '4px 8px',
              }}
            >
              登出
            </Button>
          )}
        </div>
      </Sider>

      {/* 主內容區 */}
      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'margin-left 0.2s' }}>
        {/* 頂部欄 */}
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            position: 'sticky',
            top: 0,
            zIndex: 99,
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 16, width: 48, height: 48 }}
          />

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 8,
              }}
            >
              <span style={{ color: token.colorTextSecondary }}>
                {auth.currentUser?.email || 'admin@ultraadvisor.com'}
              </span>
              <Avatar size={32} icon={<UserOutlined />} />
            </div>
          </Dropdown>
        </Header>

        {/* 內容區 */}
        <Content
          style={{
            margin: 24,
            minHeight: 'calc(100vh - 64px - 48px)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
