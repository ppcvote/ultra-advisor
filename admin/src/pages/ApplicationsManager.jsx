import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Descriptions,
  Select,
  message,
  Tabs,
  Badge,
  Empty,
  Spin,
  Tooltip,
  Typography,
} from 'antd';
import {
  CalendarOutlined,
  ShopOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

// 狀態標籤配置
const STATUS_CONFIG = {
  pending: { color: 'orange', text: '待處理', icon: <ClockCircleOutlined /> },
  contacted: { color: 'blue', text: '已聯繫', icon: <UserOutlined /> },
  reviewing: { color: 'blue', text: '審核中', icon: <ClockCircleOutlined /> },
  completed: { color: 'green', text: '已完成', icon: <CheckCircleOutlined /> },
  approved: { color: 'green', text: '已通過', icon: <CheckCircleOutlined /> },
  cancelled: { color: 'default', text: '已取消', icon: <CloseCircleOutlined /> },
  rejected: { color: 'red', text: '已拒絕', icon: <CloseCircleOutlined /> },
};

// 需求分類
const NEED_CATEGORIES = {
  mortgage: '房貸規劃',
  retirement: '退休規劃',
  insurance: '保險檢視',
  tax: '稅務傳承',
  investment: '投資理財',
  other: '其他諮詢',
};

// 店家類型
const STORE_TYPES = {
  cafe: '咖啡廳',
  restaurant: '餐廳',
  'business-center': '商務中心',
  gym: '健身房',
  beauty: '美容美髮',
  other: '其他',
};

// 合作項目
const COOPERATION_OPTIONS = {
  'short-video': '短影音拍攝',
  '3d-render': '3D 渲染影片',
  'member-discount': '會員專屬優惠',
  'tier-system': '會員分級系統',
};

// 家庭成員角色
const ROLE_LABELS = {
  self: '本人',
  spouse: '配偶',
  father: '父親',
  mother: '母親',
  father_in_law: '公公/岳父',
  mother_in_law: '婆婆/岳母',
  child: '子女',
};

const ApplicationsManager = () => {
  const [activeTab, setActiveTab] = useState('booking');
  const [bookingRequests, setBookingRequests] = useState([]);
  const [partnerApplications, setPartnerApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailModal, setDetailModal] = useState({ visible: false, type: null, data: null });
  const [statusLoading, setStatusLoading] = useState(false);

  // 監聽預約諮詢
  useEffect(() => {
    const q = query(collection(db, 'bookingRequests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
      }));
      setBookingRequests(data);
      setLoading(false);
    }, (error) => {
      console.error('讀取預約失敗:', error);
      message.error('讀取預約資料失敗');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 監聽合作申請
  useEffect(() => {
    const q = query(collection(db, 'partnerApplications'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
      }));
      setPartnerApplications(data);
    }, (error) => {
      console.error('讀取合作申請失敗:', error);
    });
    return () => unsubscribe();
  }, []);

  // 更新狀態
  const handleStatusChange = async (type, id, newStatus) => {
    setStatusLoading(true);
    try {
      const collectionName = type === 'booking' ? 'bookingRequests' : 'partnerApplications';
      await updateDoc(doc(db, collectionName, id), {
        status: newStatus,
        updatedAt: Timestamp.now(),
      });
      message.success('狀態更新成功');
      setDetailModal({ visible: false, type: null, data: null });
    } catch (error) {
      console.error('更新失敗:', error);
      message.error('更新失敗');
    } finally {
      setStatusLoading(false);
    }
  };

  // 預約諮詢表格欄位
  const bookingColumns = [
    {
      title: '申請人',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.phone}</Text>
        </div>
      ),
    },
    {
      title: '需求類型',
      dataIndex: 'needCategory',
      key: 'needCategory',
      render: (cat) => (
        <Tag color="purple">{NEED_CATEGORIES[cat] || cat}</Tag>
      ),
    },
    {
      title: '家庭成員',
      dataIndex: 'familyMemberCount',
      key: 'familyMemberCount',
      render: (count) => <Badge count={count} style={{ backgroundColor: '#52c41a' }} />,
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
        return <Tag color={config.color} icon={config.icon}>{config.text}</Tag>;
      },
    },
    {
      title: '申請時間',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => date?.toLocaleDateString?.('zh-TW') || '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Tooltip title="查看詳情">
            <Button
              icon={<EyeOutlined />}
              onClick={() => setDetailModal({ visible: true, type: 'booking', data: record })}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 合作申請表格欄位
  const partnerColumns = [
    {
      title: '店家名稱',
      dataIndex: 'storeName',
      key: 'storeName',
      render: (name, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {STORE_TYPES[record.storeType] || record.storeType}
          </Text>
        </div>
      ),
    },
    {
      title: '地區',
      dataIndex: 'district',
      key: 'district',
    },
    {
      title: '聯絡人',
      dataIndex: 'contactName',
      key: 'contactName',
      render: (name, record) => (
        <div>
          <div>{name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.contactPhone}</Text>
        </div>
      ),
    },
    {
      title: '合作項目',
      dataIndex: 'cooperationInterests',
      key: 'cooperationInterests',
      render: (items) => (
        <Space wrap>
          {items?.map(item => (
            <Tag key={item} color="blue">{COOPERATION_OPTIONS[item] || item}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
        return <Tag color={config.color} icon={config.icon}>{config.text}</Tag>;
      },
    },
    {
      title: '申請時間',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => date?.toLocaleDateString?.('zh-TW') || '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Tooltip title="查看詳情">
            <Button
              icon={<EyeOutlined />}
              onClick={() => setDetailModal({ visible: true, type: 'partner', data: record })}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 預約詳情 Modal
  const renderBookingDetail = () => {
    const data = detailModal.data;
    if (!data) return null;

    return (
      <Descriptions column={1} bordered size="small">
        <Descriptions.Item label="姓名">{data.name}</Descriptions.Item>
        <Descriptions.Item label="電話">{data.phone}</Descriptions.Item>
        <Descriptions.Item label="Email">{data.email || '-'}</Descriptions.Item>
        <Descriptions.Item label="職業">{data.occupation || '-'}</Descriptions.Item>
        <Descriptions.Item label="出生年">{data.birthYear || '-'}</Descriptions.Item>
        <Descriptions.Item label="需求類型">
          <Tag color="purple">{NEED_CATEGORIES[data.needCategory] || data.needCategory}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="具體需求">{data.specificNeeds || '-'}</Descriptions.Item>
        <Descriptions.Item label="方便聯繫時間">{data.preferredTime || '-'}</Descriptions.Item>
        <Descriptions.Item label="來源">{data.referralSource || '-'}</Descriptions.Item>
        <Descriptions.Item label="家庭成員">
          <Space wrap>
            {data.familyMembers?.map((m, idx) => (
              <Tag key={idx}>
                {ROLE_LABELS[m.role] || m.role}
                {m.age && ` (${m.age}歲)`}
              </Tag>
            ))}
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label="申請時間">
          {data.createdAt?.toLocaleString?.('zh-TW') || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="狀態">
          <Select
            value={data.status}
            style={{ width: 120 }}
            loading={statusLoading}
            onChange={(value) => handleStatusChange('booking', data.id, value)}
          >
            <Select.Option value="pending">待處理</Select.Option>
            <Select.Option value="contacted">已聯繫</Select.Option>
            <Select.Option value="completed">已完成</Select.Option>
            <Select.Option value="cancelled">已取消</Select.Option>
          </Select>
        </Descriptions.Item>
      </Descriptions>
    );
  };

  // 合作申請詳情 Modal
  const renderPartnerDetail = () => {
    const data = detailModal.data;
    if (!data) return null;

    return (
      <Descriptions column={1} bordered size="small">
        <Descriptions.Item label="店家名稱">{data.storeName}</Descriptions.Item>
        <Descriptions.Item label="店家類型">
          {STORE_TYPES[data.storeType] || data.storeType}
          {data.otherStoreType && ` (${data.otherStoreType})`}
        </Descriptions.Item>
        <Descriptions.Item label="地區">{data.district}</Descriptions.Item>
        <Descriptions.Item label="地址">{data.address}</Descriptions.Item>
        <Descriptions.Item label="聯絡人">{data.contactName}</Descriptions.Item>
        <Descriptions.Item label="職稱">{data.contactRole || '-'}</Descriptions.Item>
        <Descriptions.Item label="電話">{data.contactPhone}</Descriptions.Item>
        <Descriptions.Item label="Email">{data.contactEmail}</Descriptions.Item>
        <Descriptions.Item label="合作項目">
          <Space wrap>
            {data.cooperationInterests?.map(item => (
              <Tag key={item} color="blue">{COOPERATION_OPTIONS[item] || item}</Tag>
            ))}
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label="提供優惠">{data.discountOffer || '-'}</Descriptions.Item>
        <Descriptions.Item label="補充說明">{data.additionalInfo || '-'}</Descriptions.Item>
        <Descriptions.Item label="申請時間">
          {data.createdAt?.toLocaleString?.('zh-TW') || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="狀態">
          <Select
            value={data.status}
            style={{ width: 120 }}
            loading={statusLoading}
            onChange={(value) => handleStatusChange('partner', data.id, value)}
          >
            <Select.Option value="pending">待處理</Select.Option>
            <Select.Option value="reviewing">審核中</Select.Option>
            <Select.Option value="approved">已通過</Select.Option>
            <Select.Option value="rejected">已拒絕</Select.Option>
          </Select>
        </Descriptions.Item>
      </Descriptions>
    );
  };

  // 計算待處理數量
  const pendingBookings = bookingRequests.filter(r => r.status === 'pending').length;
  const pendingPartners = partnerApplications.filter(r => r.status === 'pending').length;

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        <CalendarOutlined /> 申請管理
      </Title>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane
          tab={
            <span>
              <CalendarOutlined />
              預約諮詢
              {pendingBookings > 0 && (
                <Badge count={pendingBookings} style={{ marginLeft: 8 }} />
              )}
            </span>
          }
          key="booking"
        >
          <Card>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin size="large" />
              </div>
            ) : bookingRequests.length === 0 ? (
              <Empty description="尚無預約諮詢" />
            ) : (
              <Table
                columns={bookingColumns}
                dataSource={bookingRequests}
                rowKey="id"
                pagination={{ pageSize: 10 }}
              />
            )}
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <ShopOutlined />
              合作申請
              {pendingPartners > 0 && (
                <Badge count={pendingPartners} style={{ marginLeft: 8 }} />
              )}
            </span>
          }
          key="partner"
        >
          <Card>
            {partnerApplications.length === 0 ? (
              <Empty description="尚無合作申請" />
            ) : (
              <Table
                columns={partnerColumns}
                dataSource={partnerApplications}
                rowKey="id"
                pagination={{ pageSize: 10 }}
              />
            )}
          </Card>
        </TabPane>
      </Tabs>

      {/* 詳情 Modal */}
      <Modal
        title={detailModal.type === 'booking' ? '預約諮詢詳情' : '合作申請詳情'}
        open={detailModal.visible}
        onCancel={() => setDetailModal({ visible: false, type: null, data: null })}
        footer={[
          <Button key="close" onClick={() => setDetailModal({ visible: false, type: null, data: null })}>
            關閉
          </Button>,
        ]}
        width={600}
      >
        {detailModal.type === 'booking' ? renderBookingDetail() : renderPartnerDetail()}
      </Modal>
    </div>
  );
};

export default ApplicationsManager;
