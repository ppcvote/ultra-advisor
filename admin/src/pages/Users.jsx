import React, { useState, useEffect } from 'react';
import {
  Table,
  Input,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  InputNumber,
  message,
  Popconfirm,
  Card,
  Row,
  Col,
  Statistic,
  Select,
  DatePicker,
  Divider,
  Tooltip,
  Typography,
} from 'antd';
import {
  SearchOutlined,
  UserOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  DownloadOutlined,
  ReloadOutlined,
  EditOutlined,
  CrownOutlined,
  PlusOutlined,
  MinusOutlined,
  SaveOutlined,
  LockOutlined,
  ClearOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import {
  collection,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, auth } from '../firebase';

// 初始化 Firebase Functions
const functions = getFunctions(undefined, 'us-central1');
import dayjs from 'dayjs';

const { Search } = Input;
const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

// 身分組設定（新增 referral_trial）
const MEMBERSHIP_TIERS = [
  { id: 'founder', name: '創始會員', color: 'gold', icon: '👑' },
  { id: 'paid', name: '付費會員', color: 'blue', icon: '💎' },
  { id: 'referral_trial', name: '轉介紹試用', color: 'purple', icon: '🎁' },
  { id: 'trial', name: '試用會員', color: 'green', icon: '🎁' },
  { id: 'grace', name: '寬限期', color: 'orange', icon: '⏳' },
  { id: 'expired', name: '已過期', color: 'default', icon: '❌' },
];

// 天數方案
const DAYS_OPTIONS = [
  { value: 365, label: '365 天（年訂閱）- $8,999', amount: 8999 },
  { value: 180, label: '180 天（半年）- $4,999', amount: 4999 },
  { value: 30, label: '30 天（月訂閱）- $999', amount: 999 },
  { value: 7, label: '7 天（週訂閱）- $299', amount: 299 },
];

const Users = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [extendModalVisible, setExtendModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [processPaymentForm] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [processPaymentModalVisible, setProcessPaymentModalVisible] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  // 🆕 重設密碼
  const [resetPasswordModalVisible, setResetPasswordModalVisible] = useState(false);
  const [resetPasswordForm] = Form.useForm();
  const [resettingPassword, setResettingPassword] = useState(false);
  // 🆕 孤立帳號清理
  const [orphanModalVisible, setOrphanModalVisible] = useState(false);
  const [orphanUsers, setOrphanUsers] = useState([]);
  const [loadingOrphans, setLoadingOrphans] = useState(false);
  const [selectedOrphanUids, setSelectedOrphanUids] = useState([]);
  const [deletingOrphans, setDeletingOrphans] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    trial: 0,
    paid: 0,
    expired: 0,
    founder: 0,
  });

  // 載入用戶資料
  useEffect(() => {
    fetchUsers();
  }, []);

  // 搜尋和篩選
  useEffect(() => {
    let filtered = users;

    // 搜尋
    if (searchText) {
      filtered = filtered.filter(
        (user) =>
          user.email?.toLowerCase().includes(searchText.toLowerCase()) ||
          user.id?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // 篩選狀態
    if (filterStatus !== 'all') {
      if (filterStatus === 'founder' || filterStatus === 'paid' || filterStatus === 'trial' || filterStatus === 'grace' || filterStatus === 'expired') {
        filtered = filtered.filter((user) => user.primaryTierId === filterStatus);
      } else {
        filtered = filtered.filter((user) => user.subscriptionStatus === filterStatus);
      }
    }

    setFilteredUsers(filtered);
  }, [users, searchText, filterStatus]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      console.log('=== Firebase 配置檢查 ===');
      console.log('Project ID:', db.app.options.projectId);
      console.log('當前登入用戶:', auth.currentUser?.email);

      const usersQuery = collection(db, 'users');
      const snapshot = await getDocs(usersQuery);

      console.log('查詢到的文檔數:', snapshot.size);

      // 🆕 載入每個用戶的 profile 子集合和每日金句分享記錄
      const usersList = await Promise.all(
        snapshot.docs.map(async (userDoc) => {
          const data = userDoc.data();

          // 嘗試載入 profile 子集合
          let profileData = {};
          try {
            const profileDoc = await getDoc(doc(db, 'users', userDoc.id, 'profile', 'data'));
            if (profileDoc.exists()) {
              profileData = profileDoc.data();
            }
          } catch (err) {
            // 忽略錯誤，可能沒有 profile
          }

          // 🆕 嘗試載入每日金句分享記錄
          let quoteShareData = {};
          try {
            const quoteShareDoc = await getDoc(doc(db, 'users', userDoc.id, 'dailyQuoteShares', 'data'));
            if (quoteShareDoc.exists()) {
              quoteShareData = quoteShareDoc.data();
            }
          } catch (err) {
            // 忽略錯誤，可能沒有分享記錄
          }

          return {
            key: userDoc.id,
            id: userDoc.id,
            ...data,
            // 🆕 合併 profile 資料（優先使用 profile 的值）
            displayName: profileData.displayName || data.displayName || '',
            photoURL: profileData.photoURL || data.photoURL || '',
            phone: profileData.phone || data.phone || '',
            lineId: profileData.lineId || data.lineId || '',
            // 🆕 每日金句分享資料
            lastQuoteShareDate: quoteShareData.lastShareDate || null,
            totalQuoteShareDays: quoteShareData.totalShareDays || 0,
          };
        })
      );

      setUsers(usersList);
      setFilteredUsers(usersList);

      // 計算統計
      const stats = {
        total: usersList.length,
        founder: usersList.filter((u) => u.primaryTierId === 'founder').length,
        paid: usersList.filter((u) => u.primaryTierId === 'paid').length,
        trial: usersList.filter((u) => u.primaryTierId === 'trial' || u.subscriptionStatus === 'trial').length,
        expired: usersList.filter((u) => u.primaryTierId === 'expired' || !u.isActive).length,
      };
      setStats(stats);

      message.success('用戶資料載入成功');
    } catch (error) {
      console.error('Error fetching users:', error);
      message.error('載入用戶資料失敗');
    } finally {
      setLoading(false);
    }
  };

  // 延長會員（快速按鈕）- 使用天數制
  const handleQuickExtend = async (userId, days) => {
    try {
      const userRef = doc(db, 'users', userId);
      const user = users.find(u => u.id === userId);

      // 🆕 天數制：直接增加 daysRemaining
      const currentDays = user?.daysRemaining || 0;
      const newDays = Math.max(0, currentDays) + days;

      await updateDoc(userRef, {
        daysRemaining: newDays,
        updatedAt: Timestamp.now(),
        updatedBy: auth.currentUser?.email || 'admin',
      });

      message.success(`已延長 ${days} 天（現有 ${newDays} 天）`);
      fetchUsers();
    } catch (error) {
      console.error('Error extending membership:', error);
      message.error('延長失敗');
    }
  };

  // 開啟編輯 Modal
  const openEditModal = (user) => {
    setSelectedUser(user);
    editForm.setFieldsValue({
      // 🆕 基本資料
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      // 身分組
      primaryTierId: user.primaryTierId || 'trial',
      // 🆕 天數制
      daysRemaining: user.daysRemaining ?? 0,
      // 舊版到期日（備用）
      membershipExpiresAt: user.membershipExpiresAt
        ? dayjs(user.membershipExpiresAt.toDate())
        : user.trialExpiresAt
          ? dayjs(user.trialExpiresAt.toDate())
          : null,
      pointsCurrent: user.points?.current || 0,
      adminNote: user.adminNote || '',
    });
    setEditModalVisible(true);
  };

  // 儲存編輯
  const handleSaveEdit = async (values) => {
    if (!selectedUser) return;
    setSaving(true);

    try {
      const userRef = doc(db, 'users', selectedUser.id);
      const updateData = {
        // 🆕 基本資料
        displayName: values.displayName || '',
        photoURL: values.photoURL || '',
        // 身分組
        primaryTierId: values.primaryTierId,
        // 🆕 天數制
        daysRemaining: values.daysRemaining ?? 0,
        // 備註
        adminNote: values.adminNote || '',
        updatedAt: Timestamp.now(),
        updatedBy: auth.currentUser?.email || 'admin',
      };

      // 更新到期日（舊版備用）
      if (values.membershipExpiresAt) {
        const expiryTimestamp = Timestamp.fromDate(values.membershipExpiresAt.toDate());
        updateData.membershipExpiresAt = expiryTimestamp;
        updateData.trialExpiresAt = expiryTimestamp; // 同步舊欄位
      }

      // 更新點數
      if (values.pointsCurrent !== undefined) {
        updateData['points.current'] = values.pointsCurrent;
      }

      // 根據身分組更新 subscriptionStatus（向後相容）
      if (values.primaryTierId === 'paid' || values.primaryTierId === 'founder') {
        updateData.subscriptionStatus = 'paid';
        updateData.isActive = true;
      } else if (values.primaryTierId === 'trial' || values.primaryTierId === 'referral_trial') {
        updateData.subscriptionStatus = 'trial';
        updateData.isActive = true;
      } else if (values.primaryTierId === 'grace') {
        updateData.subscriptionStatus = 'trial';
        updateData.isActive = true;
      } else {
        updateData.subscriptionStatus = 'expired';
        updateData.isActive = false;
      }

      // 🆕 將 displayName 和 photoURL 從 updateData 移除（因為要存到 profile 子集合）
      const { displayName, photoURL, ...rootUpdateData } = updateData;

      await updateDoc(userRef, rootUpdateData);

      // 🆕 更新 profile 子集合（與登入頁面資料結構一致）
      if (values.displayName !== undefined || values.photoURL !== undefined) {
        const profileRef = doc(db, 'users', selectedUser.id, 'profile', 'data');
        await setDoc(profileRef, {
          displayName: values.displayName || '',
          photoURL: values.photoURL || '',
          updatedAt: Timestamp.now(),
        }, { merge: true });
      }

      message.success('用戶資料已更新');
      setEditModalVisible(false);
      fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      message.error('儲存失敗：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // 調整點數
  const adjustPoints = (amount) => {
    const current = editForm.getFieldValue('pointsCurrent') || 0;
    editForm.setFieldValue('pointsCurrent', Math.max(0, current + amount));
  };

  // 🆕 調整天數
  const adjustDays = (amount) => {
    const current = editForm.getFieldValue('daysRemaining') || 0;
    editForm.setFieldValue('daysRemaining', Math.max(0, current + amount));
  };

  // 延長試用（舊功能保留）
  const handleExtendTrial = async (values) => {
    try {
      const userRef = doc(db, 'users', selectedUser.id);
      const currentExpiry = selectedUser.membershipExpiresAt || selectedUser.trialExpiresAt;
      const baseTime = currentExpiry?.toMillis() > Date.now() ? currentExpiry.toMillis() : Date.now();
      const newExpiry = Timestamp.fromMillis(baseTime + values.days * 24 * 60 * 60 * 1000);

      await updateDoc(userRef, {
        membershipExpiresAt: newExpiry,
        trialExpiresAt: newExpiry,
      });

      message.success(`已延長 ${values.days} 天`);
      setExtendModalVisible(false);
      fetchUsers();
    } catch (error) {
      console.error('Error extending trial:', error);
      message.error('延長試用期失敗');
    }
  };

  // 刪除用戶
  const handleDeleteUser = async (userId) => {
    try {
      await deleteDoc(doc(db, 'users', userId));
      message.success('用戶已刪除');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      message.error('刪除用戶失敗');
    }
  };

  // 🆕 查找孤立帳號（在 Auth 但不在 Firestore）
  const handleFindOrphanUsers = async () => {
    setLoadingOrphans(true);
    setOrphanModalVisible(true);
    try {
      const listOrphanAuthUsers = httpsCallable(functions, 'listOrphanAuthUsers');
      const result = await listOrphanAuthUsers();
      if (result.data.success) {
        setOrphanUsers(result.data.orphanUsers || []);
        message.success(`找到 ${result.data.orphanCount} 個孤立帳號`);
      }
    } catch (error) {
      console.error('Find orphan users error:', error);
      message.error(error.message || '查找孤立帳號失敗');
    } finally {
      setLoadingOrphans(false);
    }
  };

  // 🆕 刪除選中的孤立帳號
  const handleDeleteOrphanUsers = async () => {
    if (selectedOrphanUids.length === 0) {
      message.warning('請先選擇要刪除的帳號');
      return;
    }
    setDeletingOrphans(true);
    try {
      const deleteOrphanAuthUsers = httpsCallable(functions, 'deleteOrphanAuthUsers');
      const result = await deleteOrphanAuthUsers({ uids: selectedOrphanUids });
      if (result.data.success) {
        message.success(result.data.message);
        // 重新查詢
        setSelectedOrphanUids([]);
        handleFindOrphanUsers();
      }
    } catch (error) {
      console.error('Delete orphan users error:', error);
      message.error(error.message || '刪除孤立帳號失敗');
    } finally {
      setDeletingOrphans(false);
    }
  };

  // 🆕 處理付款訂單（呼叫 Cloud Function）
  const handleProcessPayment = async (values) => {
    setProcessingPayment(true);
    try {
      const processPayment = httpsCallable(functions, 'processPayment');
      const selectedOption = DAYS_OPTIONS.find(opt => opt.value === values.days);

      const result = await processPayment({
        userEmail: values.email,
        days: values.days,
        amount: selectedOption?.amount || 0,
        notes: values.notes || '',
      });

      if (result.data.success) {
        message.success(
          `處理成功！用戶現有 ${result.data.newDaysRemaining} 天` +
          (result.data.referralRewardGiven ? '（已發放推薦獎勵 +1000 UA）' : '')
        );
        setProcessPaymentModalVisible(false);
        processPaymentForm.resetFields();
        fetchUsers();
      }
    } catch (error) {
      console.error('Process payment error:', error);
      message.error(error.message || '處理失敗');
    } finally {
      setProcessingPayment(false);
    }
  };

  // 🆕 重設用戶密碼
  const handleResetPassword = async (values) => {
    setResettingPassword(true);
    try {
      const adminResetPassword = httpsCallable(functions, 'adminResetPassword');
      const result = await adminResetPassword({
        userEmail: selectedUser.email,
        newPassword: values.newPassword,
      });

      if (result.data.success) {
        message.success(result.data.message);
        setResetPasswordModalVisible(false);
        resetPasswordForm.resetFields();
      }
    } catch (error) {
      console.error('Reset password error:', error);
      message.error(error.message || '重設密碼失敗');
    } finally {
      setResettingPassword(false);
    }
  };

  // 開啟重設密碼 Modal
  const openResetPasswordModal = (user) => {
    setSelectedUser(user);
    resetPasswordForm.resetFields();
    setResetPasswordModalVisible(true);
  };

  // 導出用戶資料
  const handleExport = () => {
    try {
      const csvContent = [
        ['Email', 'UID', '身分組', '狀態', '點數', '註冊時間', '到期時間', 'LINE ID', '管理員備註'].join(','),
        ...filteredUsers.map((user) =>
          [
            user.email,
            user.id,
            user.primaryTierId || 'trial',
            user.subscriptionStatus,
            user.points?.current || 0,
            user.createdAt ? dayjs(user.createdAt.toDate()).format('YYYY-MM-DD HH:mm') : '',
            user.membershipExpiresAt
              ? dayjs(user.membershipExpiresAt.toDate()).format('YYYY-MM-DD HH:mm')
              : user.trialExpiresAt
                ? dayjs(user.trialExpiresAt.toDate()).format('YYYY-MM-DD HH:mm')
                : '',
            user.lineUserId || '',
            (user.adminNote || '').replace(/,/g, '，'),
          ].join(',')
        ),
      ].join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `users_${dayjs().format('YYYY-MM-DD')}.csv`;
      link.click();

      message.success('用戶資料已導出');
    } catch (error) {
      console.error('Error exporting users:', error);
      message.error('導出失敗');
    }
  };

  // 取得身分組顯示
  const getTierDisplay = (tierId) => {
    const tier = MEMBERSHIP_TIERS.find(t => t.id === tierId);
    return tier || { id: tierId, name: tierId, color: 'default', icon: '❓' };
  };

  // 表格欄位
  const columns = [
    {
      title: '用戶',
      key: 'user',
      width: 280,
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* 頭像 */}
          {record.photoURL ? (
            <img
              src={record.photoURL}
              alt=""
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                objectFit: 'cover',
                border: '1px solid #e5e7eb'
              }}
            />
          ) : (
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 'bold',
              fontSize: 14
            }}>
              {record.displayName?.charAt(0) || record.email?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            {record.displayName && (
              <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13, marginBottom: 2 }}>
                {record.displayName}
              </div>
            )}
            <div style={{
              color: record.displayName ? '#64748b' : '#1e293b',
              fontSize: record.displayName ? 12 : 13,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {record.email}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '身分組',
      dataIndex: 'primaryTierId',
      key: 'primaryTierId',
      width: 120,
      render: (tierId, record) => {
        const tier = getTierDisplay(tierId || (record.subscriptionStatus === 'paid' ? 'paid' : 'trial'));
        return (
          <Tag color={tier.color} icon={tier.id === 'founder' ? <CrownOutlined /> : null}>
            {tier.icon} {tier.name}
          </Tag>
        );
      },
    },
    {
      title: '剩餘天數',
      key: 'daysRemaining',
      width: 100,
      render: (_, record) => {
        // 優先顯示 daysRemaining（天數制）
        const days = record.daysRemaining;
        if (days !== undefined && days !== null) {
          const color = days <= 0 ? 'red' : days <= 3 ? 'orange' : days <= 7 ? '#faad14' : 'green';
          return (
            <Tooltip title={`剩餘 ${days} 天會員權限`}>
              <span style={{ color, fontWeight: 600 }}>
                {days > 0 ? `${days} 天` : `已過期`}
              </span>
            </Tooltip>
          );
        }
        // 舊版：用 timestamp 計算
        const timestamp = record.membershipExpiresAt || record.trialExpiresAt;
        if (!timestamp) return <span style={{ color: '#9ca3af' }}>-</span>;
        const daysLeft = Math.ceil((timestamp.toMillis() - Date.now()) / (1000 * 60 * 60 * 24));
        const color = daysLeft <= 0 ? 'red' : daysLeft <= 3 ? 'orange' : daysLeft <= 7 ? '#faad14' : 'green';
        return (
          <Tooltip title={dayjs(timestamp.toDate()).format('YYYY-MM-DD HH:mm')}>
            <span style={{ color }}>
              {daysLeft > 0 ? `${daysLeft} 天` : `已過期`}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: '點數',
      dataIndex: ['points', 'current'],
      key: 'points',
      width: 80,
      render: (points) => (
        <Text strong style={{ color: '#8b5cf6' }}>
          {points || 0} UA
        </Text>
      ),
    },
    {
      title: '推薦',
      key: 'referral',
      width: 140,
      render: (_, record) => {
        const referredByUser = record.referredBy
          ? users.find(u => u.id === record.referredBy)
          : null;
        return (
          <div style={{ fontSize: 12 }}>
            {referredByUser ? (
              <Tooltip title={`推薦人 UID: ${record.referredBy}`}>
                <div style={{ color: '#8b5cf6' }}>
                  ⬆️ {referredByUser.displayName || referredByUser.email?.split('@')[0] || '未知'}
                </div>
              </Tooltip>
            ) : record.referredBy ? (
              <div style={{ color: '#64748b' }}>⬆️ {record.referredBy.slice(0, 8)}...</div>
            ) : null}
            {record.referralCount > 0 && (
              <Tooltip title={`已推薦 ${record.referralCount} 位好友`}>
                <div style={{ color: '#10b981', fontWeight: 600 }}>
                  ⬇️ 推薦了 {record.referralCount} 人
                </div>
              </Tooltip>
            )}
            {!referredByUser && !record.referredBy && !record.referralCount && (
              <span style={{ color: '#9ca3af' }}>-</span>
            )}
          </div>
        );
      },
    },
    {
      title: '每日金句',
      key: 'quoteShare',
      width: 120,
      render: (_, record) => {
        if (!record.lastQuoteShareDate) {
          return <span style={{ color: '#9ca3af' }}>未使用</span>;
        }
        const lastDate = record.lastQuoteShareDate;
        const today = new Date().toISOString().split('T')[0];
        const isToday = lastDate === today;
        const daysAgo = Math.floor((new Date(today) - new Date(lastDate)) / (1000 * 60 * 60 * 24));

        return (
          <Tooltip title={`累積分享 ${record.totalQuoteShareDays} 天`}>
            <div style={{ fontSize: 12 }}>
              <div style={{
                color: isToday ? '#10b981' : daysAgo <= 7 ? '#3b82f6' : '#f59e0b',
                fontWeight: 600
              }}>
                {isToday ? '今天' : daysAgo === 1 ? '昨天' : `${daysAgo} 天前`}
              </div>
              <div style={{ color: '#8b5cf6', fontSize: 11 }}>
                共 {record.totalQuoteShareDays} 天
              </div>
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: '快速延長',
      key: 'quickExtend',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Button size="small" onClick={() => handleQuickExtend(record.id, 7)}>+7天</Button>
          <Button size="small" onClick={() => handleQuickExtend(record.id, 30)}>+30天</Button>
          <Button size="small" onClick={() => handleQuickExtend(record.id, 365)}>+1年</Button>
        </Space>
      ),
    },
    {
      title: '備註',
      dataIndex: 'adminNote',
      key: 'adminNote',
      width: 150,
      ellipsis: true,
      render: (note) => note ? (
        <Tooltip title={note}>
          <Text type="secondary" ellipsis style={{ maxWidth: 140 }}>{note}</Text>
        </Tooltip>
      ) : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small" wrap>
          <Tooltip title="編輯用戶">
            <Button
              type="primary"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
            >
              編輯
            </Button>
          </Tooltip>
          <Tooltip title="重設密碼">
            <Button
              size="small"
              icon={<LockOutlined />}
              onClick={() => openResetPasswordModal(record)}
            >
              改密碼
            </Button>
          </Tooltip>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedUser(record);
              setDetailModalVisible(true);
            }}
          >
            詳情
          </Button>
          <Popconfirm
            title="確定要刪除此用戶嗎？"
            description="此操作無法復原"
            onConfirm={() => handleDeleteUser(record.id)}
            okText="確定"
            cancelText="取消"
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
              刪除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">👥 用戶管理</h1>

      {/* 統計卡片 */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12} lg={4}>
          <Card size="small">
            <Statistic
              title="總用戶數"
              value={stats.total}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#3b82f6' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card size="small">
            <Statistic
              title="👑 創始會員"
              value={stats.founder}
              valueStyle={{ color: '#f59e0b' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card size="small">
            <Statistic
              title="💎 付費會員"
              value={stats.paid}
              valueStyle={{ color: '#8b5cf6' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card size="small">
            <Statistic
              title="🎁 試用中"
              value={stats.trial}
              valueStyle={{ color: '#10b981' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card size="small">
            <Statistic
              title="❌ 已過期"
              value={stats.expired}
              valueStyle={{ color: '#ef4444' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 搜尋和篩選 */}
      <Card className="mb-6">
        <Space className="w-full" direction="vertical" size="middle">
          <Row gutter={16}>
            <Col xs={24} md={10}>
              <Search
                placeholder="搜尋 Email 或 UID"
                allowClear
                enterButton={<SearchOutlined />}
                size="large"
                onSearch={setSearchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </Col>
            <Col xs={24} md={14}>
              <Space wrap>
                <Select
                  value={filterStatus}
                  onChange={setFilterStatus}
                  style={{ width: 150 }}
                  size="large"
                >
                  <Option value="all">全部狀態</Option>
                  <Option value="founder">👑 創始會員</Option>
                  <Option value="paid">💎 付費會員</Option>
                  <Option value="trial">🎁 試用中</Option>
                  <Option value="grace">⏳ 寬限期</Option>
                  <Option value="expired">❌ 已過期</Option>
                </Select>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={fetchUsers}
                  size="large"
                >
                  重新載入
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={handleExport}
                  size="large"
                >
                  導出 CSV
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setProcessPaymentModalVisible(true)}
                  size="large"
                  style={{ backgroundColor: '#722ed1' }}
                >
                  處理訂單
                </Button>
                <Button
                  icon={<ClearOutlined />}
                  onClick={handleFindOrphanUsers}
                  size="large"
                  danger
                >
                  清理孤立帳號
                </Button>
              </Space>
            </Col>
          </Row>
        </Space>
      </Card>

      {/* 用戶表格 */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredUsers}
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 個用戶`,
          }}
          size="middle"
        />
      </Card>

      {/* 🆕 編輯用戶 Modal */}
      <Modal
        title={
          <Space>
            <EditOutlined />
            編輯用戶：{selectedUser?.email}
          </Space>
        }
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleSaveEdit}
          className="mt-4"
        >
          {/* 🆕 基本資料區塊 */}
          <div style={{
            background: '#f8fafc',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            border: '1px solid #e2e8f0'
          }}>
            <Text strong style={{ display: 'block', marginBottom: 12, color: '#334155' }}>
              👤 基本資料
            </Text>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="displayName"
                  label="姓名 / 暱稱"
                >
                  <Input
                    placeholder="用於辨識會員"
                    size="large"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="photoURL"
                  label="頭像網址"
                >
                  <Input
                    placeholder="https://..."
                    size="large"
                  />
                </Form.Item>
              </Col>
            </Row>
          </div>

          {/* 身分組選擇 */}
          <Form.Item
            name="primaryTierId"
            label="身分組"
            rules={[{ required: true, message: '請選擇身分組' }]}
          >
            <Select size="large">
              {MEMBERSHIP_TIERS.map(tier => (
                <Option key={tier.id} value={tier.id}>
                  <Space>
                    <span>{tier.icon}</span>
                    <span>{tier.name}</span>
                    <Tag color={tier.color} style={{ marginLeft: 8 }}>{tier.id}</Tag>
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          {/* 🆕 天數制會員 */}
          <div style={{
            background: '#f0fdf4',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            border: '1px solid #bbf7d0'
          }}>
            <Text strong style={{ display: 'block', marginBottom: 12, color: '#166534' }}>
              ⏰ 會員天數（天數制）
            </Text>
            <Form.Item label="剩餘天數" style={{ marginBottom: 8 }}>
              <Space wrap>
                <Button
                  icon={<MinusOutlined />}
                  onClick={() => adjustDays(-7)}
                  danger
                  size="small"
                >
                  -7
                </Button>
                <Button
                  icon={<MinusOutlined />}
                  onClick={() => adjustDays(-1)}
                  size="small"
                >
                  -1
                </Button>
                <Form.Item name="daysRemaining" noStyle>
                  <InputNumber
                    min={0}
                    max={9999}
                    style={{ width: 100, textAlign: 'center' }}
                    size="large"
                    addonAfter="天"
                  />
                </Form.Item>
                <Button
                  icon={<PlusOutlined />}
                  onClick={() => adjustDays(1)}
                  size="small"
                >
                  +1
                </Button>
                <Button
                  icon={<PlusOutlined />}
                  onClick={() => adjustDays(7)}
                  type="primary"
                  size="small"
                >
                  +7
                </Button>
                <Button
                  icon={<PlusOutlined />}
                  onClick={() => adjustDays(30)}
                  type="primary"
                  size="small"
                >
                  +30
                </Button>
                <Button
                  icon={<PlusOutlined />}
                  onClick={() => adjustDays(365)}
                  type="primary"
                  size="small"
                >
                  +365
                </Button>
              </Space>
            </Form.Item>
          </div>

          {/* 舊版到期日期（折疊顯示） */}
          <details style={{ marginBottom: 16 }}>
            <summary style={{ cursor: 'pointer', color: '#64748b', fontSize: 13 }}>
              📅 舊版到期日（點擊展開）
            </summary>
            <div style={{ paddingTop: 12 }}>
              <Form.Item
                name="membershipExpiresAt"
                label="會員到期日（舊版）"
              >
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  style={{ width: '100%' }}
                  size="large"
                  placeholder="選擇到期日期"
                />
              </Form.Item>
            </div>
          </details>

          <Divider />

          {/* 點數調整 */}
          <Form.Item label="UA 點數">
            <Space>
              <Button
                icon={<MinusOutlined />}
                onClick={() => adjustPoints(-10)}
                danger
              >
                -10
              </Button>
              <Button
                icon={<MinusOutlined />}
                onClick={() => adjustPoints(-1)}
              >
                -1
              </Button>
              <Form.Item name="pointsCurrent" noStyle>
                <InputNumber
                  min={0}
                  max={99999}
                  style={{ width: 100, textAlign: 'center' }}
                  size="large"
                />
              </Form.Item>
              <Button
                icon={<PlusOutlined />}
                onClick={() => adjustPoints(1)}
              >
                +1
              </Button>
              <Button
                icon={<PlusOutlined />}
                onClick={() => adjustPoints(10)}
                type="primary"
              >
                +10
              </Button>
              <Button
                icon={<PlusOutlined />}
                onClick={() => adjustPoints(100)}
                type="primary"
              >
                +100
              </Button>
            </Space>
          </Form.Item>

          <Divider />

          {/* 管理員備註 */}
          <Form.Item
            name="adminNote"
            label="管理員備註"
          >
            <TextArea
              rows={3}
              placeholder="輸入備註（例如：VIP 客戶、特殊折扣、問題記錄等）"
              maxLength={500}
              showCount
            />
          </Form.Item>

          {/* 操作按鈕 */}
          <Form.Item className="mb-0 mt-6">
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setEditModalVisible(false)}>
                取消
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={saving}
                icon={<SaveOutlined />}
              >
                儲存變更
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 用戶詳情 Modal */}
      <Modal
        title="👤 用戶詳情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button
            key="edit"
            type="primary"
            icon={<EditOutlined />}
            onClick={() => {
              setDetailModalVisible(false);
              openEditModal(selectedUser);
            }}
          >
            編輯用戶
          </Button>,
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            關閉
          </Button>,
        ]}
        width={650}
      >
        {selectedUser && (
          <Space direction="vertical" size="middle" className="w-full">
            <Row gutter={16}>
              <Col span={12}>
                <div>
                  <Text type="secondary">📧 Email</Text>
                  <div><Text strong>{selectedUser.email}</Text></div>
                </div>
              </Col>
              <Col span={12}>
                <div>
                  <Text type="secondary">🆔 UID</Text>
                  <div><Text code copyable style={{ fontSize: 11 }}>{selectedUser.id}</Text></div>
                </div>
              </Col>
            </Row>

            <Divider style={{ margin: '12px 0' }} />

            <Row gutter={16}>
              <Col span={12}>
                <div>
                  <Text type="secondary">🏷️ 身分組</Text>
                  <div>
                    {(() => {
                      const tier = getTierDisplay(selectedUser.primaryTierId || 'trial');
                      return (
                        <Tag color={tier.color} style={{ marginTop: 4 }}>
                          {tier.icon} {tier.name}
                        </Tag>
                      );
                    })()}
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div>
                  <Text type="secondary">💰 UA 點數</Text>
                  <div>
                    <Text strong style={{ color: '#8b5cf6', fontSize: 18 }}>
                      {selectedUser.points?.current || 0} UA
                    </Text>
                  </div>
                </div>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <div>
                  <Text type="secondary">📅 註冊時間</Text>
                  <div>
                    <Text>
                      {selectedUser.createdAt
                        ? dayjs(selectedUser.createdAt.toDate()).format('YYYY-MM-DD HH:mm')
                        : '-'}
                    </Text>
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div>
                  <Text type="secondary">⏰ 會員到期</Text>
                  <div>
                    {(() => {
                      const timestamp = selectedUser.membershipExpiresAt || selectedUser.trialExpiresAt;
                      if (!timestamp) return <Text>-</Text>;
                      const daysLeft = Math.ceil((timestamp.toMillis() - Date.now()) / (1000 * 60 * 60 * 24));
                      return (
                        <Text style={{ color: daysLeft <= 0 ? 'red' : daysLeft <= 7 ? 'orange' : 'green' }}>
                          {dayjs(timestamp.toDate()).format('YYYY-MM-DD HH:mm')}
                          <br />
                          <small>({daysLeft > 0 ? `剩餘 ${daysLeft} 天` : `已過期 ${Math.abs(daysLeft)} 天`})</small>
                        </Text>
                      );
                    })()}
                  </div>
                </div>
              </Col>
            </Row>

            <Divider style={{ margin: '12px 0' }} />

            <Row gutter={16}>
              <Col span={12}>
                <div>
                  <Text type="secondary">📱 LINE User ID</Text>
                  <div><Text code style={{ fontSize: 11 }}>{selectedUser.lineUserId || '-'}</Text></div>
                </div>
              </Col>
              <Col span={12}>
                <div>
                  <Text type="secondary">🔥 連續登入</Text>
                  <div><Text>{selectedUser.loginStreak || 0} 天</Text></div>
                </div>
              </Col>
            </Row>

            {/* 🆕 每日金句分享 */}
            <Divider style={{ margin: '12px 0' }} />
            <Row gutter={16}>
              <Col span={12}>
                <div>
                  <Text type="secondary">💬 上次分享金句</Text>
                  <div>
                    {selectedUser.lastQuoteShareDate ? (
                      <Text>
                        {selectedUser.lastQuoteShareDate}
                        {(() => {
                          const today = new Date().toISOString().split('T')[0];
                          const daysAgo = Math.floor((new Date(today) - new Date(selectedUser.lastQuoteShareDate)) / (1000 * 60 * 60 * 24));
                          if (daysAgo === 0) return <Tag color="green" style={{ marginLeft: 8 }}>今天</Tag>;
                          if (daysAgo === 1) return <Tag color="blue" style={{ marginLeft: 8 }}>昨天</Tag>;
                          return <Tag color={daysAgo <= 7 ? 'blue' : 'orange'} style={{ marginLeft: 8 }}>{daysAgo} 天前</Tag>;
                        })()}
                      </Text>
                    ) : (
                      <Text type="secondary">-</Text>
                    )}
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div>
                  <Text type="secondary">📊 累積分享天數</Text>
                  <div>
                    <Text strong style={{ color: '#8b5cf6', fontSize: 18 }}>
                      {selectedUser.totalQuoteShareDays || 0} 天
                    </Text>
                  </div>
                </div>
              </Col>
            </Row>

            {/* 🆕 推薦資訊 */}
            <Divider style={{ margin: '12px 0' }} />
            <Row gutter={16}>
              <Col span={12}>
                <div>
                  <Text type="secondary">⬆️ 推薦人</Text>
                  <div>
                    {(() => {
                      if (!selectedUser.referredBy) return <Text>-</Text>;
                      const referrer = users.find(u => u.id === selectedUser.referredBy);
                      return (
                        <div>
                          <Text strong style={{ color: '#8b5cf6' }}>
                            {referrer?.displayName || referrer?.email?.split('@')[0] || '未知'}
                          </Text>
                          <br />
                          <Text code style={{ fontSize: 10 }}>{selectedUser.referredBy}</Text>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div>
                  <Text type="secondary">⬇️ 推薦人數</Text>
                  <div>
                    <Text strong style={{ color: '#10b981', fontSize: 18 }}>
                      {selectedUser.referralCount || 0} 人
                    </Text>
                  </div>
                </div>
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 8 }}>
              <Col span={12}>
                <div>
                  <Text type="secondary">🎟️ 推薦碼</Text>
                  <div><Text code copyable>{selectedUser.referralCode || '-'}</Text></div>
                </div>
              </Col>
              <Col span={12}>
                <div>
                  <Text type="secondary">🎁 付費獎勵</Text>
                  <div>
                    <Tag color={selectedUser.referralRewardClaimed ? 'green' : 'orange'}>
                      {selectedUser.referralRewardClaimed ? '已領取' : '未領取'}
                    </Tag>
                  </div>
                </div>
              </Col>
            </Row>

            {selectedUser.adminNote && (
              <>
                <Divider style={{ margin: '12px 0' }} />
                <div>
                  <Text type="secondary">📝 管理員備註</Text>
                  <div style={{
                    marginTop: 4,
                    padding: '8px 12px',
                    background: '#f5f5f5',
                    borderRadius: 6,
                    whiteSpace: 'pre-wrap'
                  }}>
                    <Text>{selectedUser.adminNote}</Text>
                  </div>
                </div>
              </>
            )}
          </Space>
        )}
      </Modal>

      {/* 延長試用 Modal（保留舊功能） */}
      <Modal
        title="⏱️ 延長會員期限"
        open={extendModalVisible}
        onCancel={() => setExtendModalVisible(false)}
        footer={null}
      >
        <Form onFinish={handleExtendTrial} layout="vertical">
          <Form.Item
            name="days"
            label="延長天數"
            rules={[{ required: true, message: '請輸入延長天數' }]}
            initialValue={7}
          >
            <InputNumber min={1} max={365} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                確定延長
              </Button>
              <Button onClick={() => setExtendModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 🆕 處理訂單 Modal */}
      <Modal
        title={
          <Space>
            <CrownOutlined style={{ color: '#722ed1' }} />
            <span>處理付款訂單</span>
          </Space>
        }
        open={processPaymentModalVisible}
        onCancel={() => {
          setProcessPaymentModalVisible(false);
          processPaymentForm.resetFields();
        }}
        footer={null}
        width={500}
        destroyOnClose
      >
        <Form
          form={processPaymentForm}
          layout="vertical"
          onFinish={handleProcessPayment}
          className="mt-4"
        >
          {/* 用戶 Email */}
          <Form.Item
            name="email"
            label="用戶 Email"
            rules={[
              { required: true, message: '請輸入用戶 Email' },
              { type: 'email', message: '請輸入有效的 Email' },
            ]}
          >
            <Input
              placeholder="輸入已付款用戶的 Email"
              size="large"
              prefix={<UserOutlined />}
            />
          </Form.Item>

          {/* 天數方案 */}
          <Form.Item
            name="days"
            label="購買方案"
            rules={[{ required: true, message: '請選擇方案' }]}
            initialValue={365}
          >
            <Select size="large" placeholder="選擇天數方案">
              {DAYS_OPTIONS.map(opt => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {/* 備註 */}
          <Form.Item
            name="notes"
            label="訂單備註（選填）"
          >
            <TextArea
              rows={2}
              placeholder="例如：LINE Pay 訂單編號、銀行轉帳後五碼等"
              maxLength={200}
            />
          </Form.Item>

          {/* 提示訊息 */}
          <div style={{
            background: '#f6ffed',
            border: '1px solid #b7eb8f',
            borderRadius: 6,
            padding: '12px 16px',
            marginBottom: 16,
          }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              💡 處理後系統將自動：
              <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
                <li>為用戶增加購買天數</li>
                <li>更新用戶身分為「付費會員」</li>
                <li>若有推薦人，自動發放 +1000 UA 獎勵（雙方各得）</li>
                <li>記錄付款歷史</li>
              </ul>
            </Text>
          </div>

          {/* 操作按鈕 */}
          <Form.Item className="mb-0">
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button
                onClick={() => {
                  setProcessPaymentModalVisible(false);
                  processPaymentForm.resetFields();
                }}
              >
                取消
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={processingPayment}
                icon={<SaveOutlined />}
                style={{ backgroundColor: '#722ed1' }}
              >
                確認處理
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 🆕 重設密碼 Modal */}
      <Modal
        title={
          <Space>
            <LockOutlined style={{ color: '#fa8c16' }} />
            <span>重設用戶密碼</span>
          </Space>
        }
        open={resetPasswordModalVisible}
        onCancel={() => {
          setResetPasswordModalVisible(false);
          resetPasswordForm.resetFields();
        }}
        footer={null}
        width={450}
        destroyOnClose
      >
        <Form
          form={resetPasswordForm}
          layout="vertical"
          onFinish={handleResetPassword}
          className="mt-4"
        >
          {/* 用戶資訊 */}
          <div style={{
            background: '#f0f5ff',
            border: '1px solid #adc6ff',
            borderRadius: 6,
            padding: '12px 16px',
            marginBottom: 16,
          }}>
            <Text type="secondary">目標用戶：</Text>
            <div style={{ marginTop: 4 }}>
              <Text strong style={{ fontSize: 15 }}>{selectedUser?.email}</Text>
              {selectedUser?.displayName && (
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  ({selectedUser.displayName})
                </Text>
              )}
            </div>
          </div>

          {/* 新密碼 */}
          <Form.Item
            name="newPassword"
            label="新密碼"
            rules={[
              { required: true, message: '請輸入新密碼' },
              { min: 6, message: '密碼至少需要 6 個字元' },
            ]}
          >
            <Input.Password
              placeholder="輸入新密碼（至少 6 個字元）"
              size="large"
              prefix={<LockOutlined />}
            />
          </Form.Item>

          {/* 確認密碼 */}
          <Form.Item
            name="confirmPassword"
            label="確認密碼"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '請再次輸入密碼' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('兩次輸入的密碼不一致'));
                },
              }),
            ]}
          >
            <Input.Password
              placeholder="再次輸入新密碼"
              size="large"
              prefix={<LockOutlined />}
            />
          </Form.Item>

          {/* 警告訊息 */}
          <div style={{
            background: '#fff7e6',
            border: '1px solid #ffd591',
            borderRadius: 6,
            padding: '12px 16px',
            marginBottom: 16,
          }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              ⚠️ 注意事項：
              <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
                <li>重設後用戶需使用新密碼登入</li>
                <li>此操作會記錄在審計日誌中</li>
                <li>建議通知用戶新密碼</li>
              </ul>
            </Text>
          </div>

          {/* 操作按鈕 */}
          <Form.Item className="mb-0">
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button
                onClick={() => {
                  setResetPasswordModalVisible(false);
                  resetPasswordForm.resetFields();
                }}
              >
                取消
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={resettingPassword}
                icon={<LockOutlined />}
                style={{ backgroundColor: '#fa8c16' }}
              >
                確認重設
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 🆕 孤立帳號清理 Modal */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            清理孤立帳號
          </Space>
        }
        open={orphanModalVisible}
        onCancel={() => {
          setOrphanModalVisible(false);
          setOrphanUsers([]);
          setSelectedOrphanUids([]);
        }}
        width={800}
        footer={
          <Space>
            <Button onClick={() => setOrphanModalVisible(false)}>關閉</Button>
            <Button onClick={handleFindOrphanUsers} loading={loadingOrphans}>
              重新掃描
            </Button>
            <Popconfirm
              title="確定要刪除選中的帳號嗎？"
              description="此操作無法復原，將從 Firebase Auth 中永久刪除這些帳號"
              onConfirm={handleDeleteOrphanUsers}
              okText="確定刪除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button
                type="primary"
                danger
                icon={<DeleteOutlined />}
                loading={deletingOrphans}
                disabled={selectedOrphanUids.length === 0}
              >
                刪除選中 ({selectedOrphanUids.length})
              </Button>
            </Popconfirm>
          </Space>
        }
      >
        <div className="mb-4">
          <Text type="secondary">
            以下帳號存在於 Firebase Authentication，但在 Firestore users 集合中找不到對應資料。
            這些可能是測試帳號或舊資料殘留。
          </Text>
        </div>

        {loadingOrphans ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <Text type="secondary">掃描中...</Text>
          </div>
        ) : orphanUsers.length === 0 ? (
          <div className="text-center py-8">
            <Text type="secondary">沒有找到孤立帳號，資料庫很乾淨！</Text>
          </div>
        ) : (
          <Table
            rowSelection={{
              type: 'checkbox',
              selectedRowKeys: selectedOrphanUids,
              onChange: (keys) => setSelectedOrphanUids(keys),
            }}
            columns={[
              {
                title: 'Email',
                dataIndex: 'email',
                key: 'email',
                render: (email) => <Text copyable>{email}</Text>,
              },
              {
                title: '顯示名稱',
                dataIndex: 'displayName',
                key: 'displayName',
                render: (name) => name || <Text type="secondary">-</Text>,
              },
              {
                title: '建立時間',
                dataIndex: 'createdAt',
                key: 'createdAt',
                render: (time) => time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '-',
              },
              {
                title: '最後登入',
                dataIndex: 'lastSignIn',
                key: 'lastSignIn',
                render: (time) => time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '-',
              },
              {
                title: 'UID',
                dataIndex: 'uid',
                key: 'uid',
                width: 120,
                render: (uid) => (
                  <Tooltip title={uid}>
                    <Text copyable={{ text: uid }} style={{ fontSize: 11 }}>
                      {uid.slice(0, 8)}...
                    </Text>
                  </Tooltip>
                ),
              },
            ]}
            dataSource={orphanUsers}
            rowKey="uid"
            size="small"
            pagination={{ pageSize: 10 }}
            scroll={{ y: 400 }}
          />
        )}
      </Modal>
    </div>
  );
};

export default Users;
