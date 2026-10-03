import React, { useState, useEffect } from 'react';
import {
    Bell, Check, CheckCircle, Clock, Gift, Trophy,
    WarningCircle, BookOpen, Coins, CalendarBlank, ArrowsClockwise
} from '@phosphor-icons/react';
import {
    getStudentNotifications,
    markAllStudentNotificationsRead,
    markStudentNotificationRead
} from '../../../services/pointsAndRewardsApi';
import './studentParentPortal.css';

const StudentNotifications = () => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL'); // 'ALL' | 'UNREAD'

    useEffect(() => {
        loadNotifications();
    }, []);

    const loadNotifications = async () => {
        setLoading(true);
        try {
            const res = await getStudentNotifications();
            if (res.status === 'success' && res.data) {
                setNotifications(res.data.notifications || []);
                setUnreadCount(res.data.unread_count || 0);
            }
        } catch (err) {
            console.error('Failed to load student notifications:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await markAllStudentNotificationsRead();
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error(err);
        }
    };

    const handleMarkSingleRead = async (id, currentRead) => {
        if (currentRead) return;
        try {
            await markStudentNotificationRead(id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error(err);
        }
    };

    const getNotificationIcon = (title = '', msg = '') => {
        const text = `${title} ${msg}`;
        if (text.includes('غياب') || text.includes('جلسة')) {
            return <div className="sn-icon-box sn-icon-red"><WarningCircle size={22} weight="bold" /></div>;
        }
        if (text.includes('نقاط') || text.includes('مكافأة') || text.includes('رصيد')) {
            return <div className="sn-icon-box sn-icon-green"><Coins size={22} weight="fill" /></div>;
        }
        if (text.includes('مسابقة') || text.includes('نتيجة') || text.includes('الفوز')) {
            return <div className="sn-icon-box sn-icon-gold"><Trophy size={22} weight="fill" /></div>;
        }
        if (text.includes('تقييم') || text.includes('تسميع') || text.includes('حفظ')) {
            return <div className="sn-icon-box sn-icon-blue"><BookOpen size={22} weight="bold" /></div>;
        }
        if (text.includes('استبدال') || text.includes('هدية')) {
            return <div className="sn-icon-box sn-icon-purple"><Gift size={22} weight="fill" /></div>;
        }
        return <div className="sn-icon-box sn-icon-default"><Bell size={22} weight="bold" /></div>;
    };

    const displayedNotifications = notifications.filter(n => {
        if (filter === 'UNREAD') return !n.is_read;
        return true;
    });

    return (
        <div className="portal-container" style={{ paddingTop: 20 }}>
            <div className="portal-section-card" style={{ maxWidth: 880, margin: '0 auto' }}>
                {/* Header */}
                <div className="portal-section-header" style={{ paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ background: '#dcfce7', color: '#133315', padding: 8, borderRadius: 10 }}>
                            <Bell size={24} weight="fill" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 18, color: '#133315', display: 'flex', alignItems: 'center', gap: 8 }}>
                                مركز الإشعارات والتنبيهات
                                {unreadCount > 0 && (
                                    <span style={{
                                        background: '#ef4444', color: '#ffffff', fontSize: 12,
                                        padding: '2px 8px', borderRadius: 12, fontWeight: 700
                                    }}>
                                        {unreadCount} جديد
                                    </span>
                                )}
                            </h3>
                            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
                                تنبيهات فورية عن الغياب، التقييمات اليومية، مكافآت النقاط، والمسابقات
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {unreadCount > 0 && (
                            <button
                                className="sn-action-btn"
                                onClick={handleMarkAllRead}
                                title="تحديد جميع الإشعارات كمقروءة"
                            >
                                <CheckCircle size={16} />
                                تحديد الكل كمقروء
                            </button>
                        )}
                        <button
                            className="portal-refresh-btn"
                            onClick={loadNotifications}
                            title="تحديث"
                        >
                            <ArrowsClockwise size={16} />
                        </button>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
                    <button
                        className={`fu-pill-btn ${filter === 'ALL' ? 'active' : ''}`}
                        onClick={() => setFilter('ALL')}
                    >
                        جميع الإشعارات ({notifications.length})
                    </button>
                    <button
                        className={`fu-pill-btn ${filter === 'UNREAD' ? 'active' : ''}`}
                        onClick={() => setFilter('UNREAD')}
                    >
                        غير المقروءة ({unreadCount})
                    </button>
                </div>

                {/* Notifications List */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                        جاري تحميل الإشعارات...
                    </div>
                ) : displayedNotifications.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                        <Bell size={48} color="#cbd5e1" />
                        <h4 style={{ margin: '12px 0 6px 0', fontSize: 16, color: '#1e293b' }}>
                            {filter === 'UNREAD' ? 'لا توجد إشعارات غير مقروءة' : 'لا توجد إشعارات مسجلة'}
                        </h4>
                        <p style={{ margin: 0, fontSize: 13 }}>
                            ستظهر هنا تنبيهات الغياب والتقييمات اليومية والمكافآت فور صدورها.
                        </p>
                    </div>
                ) : (
                    <div className="sn-list">
                        {displayedNotifications.map((notif) => (
                            <div
                                key={notif.id}
                                className={`sn-item ${notif.is_read ? 'sn-item-read' : 'sn-item-unread'}`}
                                onClick={() => handleMarkSingleRead(notif.id, notif.is_read)}
                            >
                                {getNotificationIcon(notif.title, notif.message)}
                                <div className="sn-content">
                                    <div className="sn-title-row">
                                        <h4>{notif.title}</h4>
                                        <span className="sn-time">
                                            <Clock size={12} />
                                            {notif.created_at || notif.date}
                                        </span>
                                    </div>
                                    <p className="sn-message">{notif.message}</p>
                                </div>
                                {!notif.is_read && (
                                    <span className="sn-unread-dot" title="غير مقروء" />
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentNotifications;
