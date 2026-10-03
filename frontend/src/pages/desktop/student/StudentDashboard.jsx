import React, { useState, useEffect } from 'react';
import {
    House, Gift, Trophy, Star, BookOpen, Clock,
    CheckCircle, Coins, TrendUp, TrendDown, User,
    ArrowRight, X, Info, WarningCircle, Check, Prohibit,
    Truck, Sparkle, CalendarBlank, ChartBar
} from '@phosphor-icons/react';
import {
    getStudentPortalDashboard,
    getStudentPortalPointsStore,
    claimStudentReward,
    getStudentCompetitions,
    startStudentCompetition,
    submitStudentCompetition
} from '../../../services/pointsAndRewardsApi';
import StudentCompetitionQuiz from '../../mobile/student/StudentCompetitionQuiz';
import StudentFollowUpSection from './StudentFollowUpSection';
import './studentParentPortal.css';

const StudentDashboard = () => {
    // Current Active Tab: 'dashboard' | 'rewards' | 'competitions' | 'report'
    const [activeTab, setActiveTab] = useState('dashboard');

    // Selected Child ID (for parents with multiple children)
    const [selectedStudentId, setSelectedStudentId] = useState(null);

    // Data States
    const [dashboardData, setDashboardData] = useState(null);
    const [storeData, setStoreData] = useState(null);
    const [competitions, setCompetitions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState('success');

    // Claim Modal
    const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
    const [selectedReward, setSelectedReward] = useState(null);
    const [claimNotes, setClaimNotes] = useState('');
    const [isClaimSubmitting, setIsClaimSubmitting] = useState(false);

    // Active Quiz Modal
    const [activeQuizData, setActiveQuizData] = useState(null);

    const showToast = (msg, type = 'success') => {
        setToastMessage(msg);
        setToastType(type);
        setTimeout(() => setToastMessage(''), 4000);
    };

    // Load Dashboard Data
    useEffect(() => {
        loadPortalData();
    }, [selectedStudentId, activeTab]);

    const loadPortalData = async () => {
        setLoading(true);
        try {
            const params = selectedStudentId ? { student_id: selectedStudentId } : {};
            
            // 1. Dashboard data
            const dashRes = await getStudentPortalDashboard(params);
            if (dashRes.status === 'success') {
                setDashboardData(dashRes.data);
                if (!selectedStudentId && dashRes.data.student_info?.id) {
                    setSelectedStudentId(dashRes.data.student_info.id);
                }
            }

            // 2. Points & Store data if on rewards tab
            if (activeTab === 'rewards') {
                const storeRes = await getStudentPortalPointsStore(params);
                if (storeRes.status === 'success') {
                    setStoreData(storeRes.data);
                }
            }

            // 3. Competitions if on competitions tab
            if (activeTab === 'competitions') {
                const compRes = await getStudentCompetitions(params);
                if (compRes.status === 'success') {
                    setCompetitions(compRes.data);
                }
            }
        } catch (err) {
            console.error("Portal loading error:", err);
        } finally {
            setLoading(false);
        }
    };

    // Handle Claim Modal Open
    const handleOpenClaimModal = (reward) => {
        setSelectedReward(reward);
        setClaimNotes('');
        setIsClaimModalOpen(true);
    };

    // Submit Reward Claim Request
    const handleConfirmClaim = async (e) => {
        e.preventDefault();
        if (!selectedReward || !selectedStudentId) return;

        setIsClaimSubmitting(true);
        try {
            const res = await claimStudentReward({
                reward_id: selectedReward.id,
                student_id: selectedStudentId,
                notes: claimNotes
            });

            if (res.status === 'success') {
                showToast(res.message || 'تم تقديم طلب المكافأة بنجاح وهو بانتظار اعتماد الإدارة');
                setIsClaimModalOpen(false);
                // Reload store and claims history
                const storeRes = await getStudentPortalPointsStore({ student_id: selectedStudentId });
                if (storeRes.status === 'success') setStoreData(storeRes.data);
            } else {
                showToast(res.message || 'فشل إرسال الطلب', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast(err.response?.data?.message || 'حدث خطأ أثناء إرسال طلب المكافأة', 'error');
        } finally {
            setIsClaimSubmitting(false);
        }
    };

    // Handle Start Competition Quiz
    const handleStartCompetition = async (compId) => {
        try {
            const res = await startStudentCompetition(compId);
            if (res.status === 'success') {
                setActiveQuizData(res.data);
            } else {
                showToast(res.message || 'فشل بدء المسابقة', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast(err.response?.data?.message || 'المسابقة غير متاحة حالياً', 'error');
        }
    };

    const handleQuizSubmitted = () => {
        setActiveQuizData(null);
        showToast('تم تسليم المسابقة واحتساب درجاتك بنجاح 🎉');
        loadPortalData();
    };

    const renderClaimStatusBadge = (status) => {
        switch (status) {
            case 'PENDING':
                return <span className="pr-status-badge pr-status-pending"><Clock size={14} /> قيد الانتظار</span>;
            case 'APPROVED':
                return <span className="pr-status-badge pr-status-approved"><CheckCircle size={14} /> تمت الموافقة</span>;
            case 'DELIVERED':
                return <span className="pr-status-badge pr-status-delivered"><Truck size={14} /> تم التسليم</span>;
            case 'REJECTED':
                return <span className="pr-status-badge pr-status-rejected"><Prohibit size={14} /> مرفوض</span>;
            default:
                return <span className="pr-status-badge">{status}</span>;
        }
    };

    if (loading && !dashboardData) {
        return (
            <div className="portal-container" style={{ textAlign: 'center', padding: '60px' }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#133315' }}>جاري تحميل بوابة الطالب وولي الأمر...</div>
            </div>
        );
    }

    const student = dashboardData?.student_info;
    const kpis = dashboardData?.kpi_metrics || {};
    const followUps = dashboardData?.follow_up_records || [];
    const analytics = dashboardData?.performance_analytics || {};
    const childrenList = dashboardData?.children_list || [];
    const isParentView = dashboardData?.is_parent_view;
    const isStoreOpen = dashboardData?.store_status?.is_open;

    return (
        <div className="portal-container">
            {/* Toast Notification */}
            {toastMessage && (
                <div className={`pr-toast pr-toast-${toastType}`}>
                    {toastMessage}
                </div>
            )}

            {/* Child Switcher for Parents */}
            {isParentView && childrenList.length > 1 && (
                <div className="portal-child-switcher">
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#133315' }}>اختر الطالب:</span>
                    {childrenList.map((child) => (
                        <button
                            key={child.id}
                            className={`portal-child-btn ${selectedStudentId === child.id ? 'active' : ''}`}
                            onClick={() => setSelectedStudentId(child.id)}
                        >
                            {child.full_name} ({child.halaqa_name})
                        </button>
                    ))}
                </div>
            )}

            {/* Hero Student Profile Header */}
            {student && (
                <div className="portal-hero-card">
                    <div className="portal-hero-profile">
                        <div className="portal-hero-avatar">
                            {student.full_name?.charAt(0) || 'ط'}
                        </div>
                        <div className="portal-hero-details">
                            <h2>{student.full_name}</h2>
                            <div className="portal-hero-tags">
                                <span className="portal-hero-tag">
                                    <BookOpen size={14} />
                                    {student.halaqa_name}
                                </span>
                                <span className="portal-hero-tag">
                                    <User size={14} />
                                    المعلم: {student.teacher_name}
                                </span>
                                <span className="portal-hero-tag">
                                    <Star size={14} />
                                    الصفحة الحالية: ص {student.reached_page}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="portal-hero-points">
                        <div className="portal-hero-points-val">
                            <Coins size={28} weight="fill" />
                            {kpis.total_points || 0}
                        </div>
                        <div className="portal-hero-points-lbl">رصيد النقاط المتاح</div>
                    </div>
                </div>
            )}

            {/* Tabs Navigation */}
            <div className="portal-tabs">
                <button
                    className={`portal-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
                    onClick={() => setActiveTab('dashboard')}
                >
                    <House size={18} />
                    الرئيسية
                </button>
                {isStoreOpen && (
                    <button
                        className={`portal-tab-btn ${activeTab === 'rewards' ? 'active' : ''}`}
                        onClick={() => setActiveTab('rewards')}
                    >
                        <Gift size={18} />
                        النقاط والمكافآت
                    </button>
                )}
                <button
                    className={`portal-tab-btn ${activeTab === 'competitions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('competitions')}
                >
                    <Trophy size={18} />
                    المسابقات القرآنية
                </button>
                <button
                    className={`portal-tab-btn ${activeTab === 'report' ? 'active' : ''}`}
                    onClick={() => setActiveTab('report')}
                >
                    <ChartBar size={18} />
                    كشف المتابعة والدرجات
                </button>
            </div>

            {/* =========================================================
                TAB 1: DASHBOARD (الرئيسية)
            ========================================================= */}
            {activeTab === 'dashboard' && (
                <>
                    {/* 5 KPIs Row */}
                    <div className="portal-kpi-grid">
                        <div className="portal-kpi-card">
                            <div className="portal-kpi-icon kpi-icon-gold">
                                <Sparkle size={26} weight="fill" />
                            </div>
                            <div className="portal-kpi-info">
                                <h4>التقييم العام</h4>
                                <div className="kpi-val" style={{ color: '#b45309' }}>
                                    {kpis.overall_rating || 'ممتاز'}
                                </div>
                            </div>
                        </div>

                        <div className="portal-kpi-card">
                            <div className="portal-kpi-icon kpi-icon-green">
                                <Coins size={26} weight="fill" />
                            </div>
                            <div className="portal-kpi-info">
                                <h4>إجمالي النقاط</h4>
                                <div className="kpi-val" style={{ color: '#15803d' }}>
                                    {kpis.total_points || 0} نقطة
                                </div>
                            </div>
                        </div>

                        <div className="portal-kpi-card">
                            <div className="portal-kpi-icon kpi-icon-blue">
                                <CalendarBlank size={26} weight="bold" />
                            </div>
                            <div className="portal-kpi-info">
                                <h4>الجلسات المنجزة</h4>
                                <div className="kpi-val" style={{ color: '#1d4ed8' }}>
                                    {kpis.completed_sessions || 0} جلسة
                                </div>
                            </div>
                        </div>

                        <div className="portal-kpi-card">
                            <div className="portal-kpi-icon kpi-icon-purple">
                                <CheckCircle size={26} weight="bold" />
                            </div>
                            <div className="portal-kpi-info">
                                <h4>معدل الحضور</h4>
                                <div className="kpi-val" style={{ color: '#7e22ce' }}>
                                    {kpis.attendance_rate || '100%'}
                                </div>
                            </div>
                        </div>

                        <div className="portal-kpi-card">
                            <div className="portal-kpi-icon kpi-icon-teal">
                                <Star size={26} weight="fill" />
                            </div>
                            <div className="portal-kpi-info">
                                <h4>مستوى السلوك</h4>
                                <div className="kpi-val" style={{ color: '#0f766e' }}>
                                    {kpis.behavior_level || 'ممتاز'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Follow-up Table & Performance Analytics Grid */}
                    <div className="portal-main-grid">
                        {/* 1. جدول المتابعة الفعلي */}
                        <div className="portal-section-card">
                            <div className="portal-section-header">
                                <h3>
                                    <BookOpen size={20} color="#133315" />
                                    جدول المتابعة الفعلي وسجل الجلسات
                                </h3>
                                <span style={{ fontSize: 13, color: '#64748b' }}>
                                    آخر {followUps.length} جلسات مسجلة
                                </span>
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                                <table className="portal-table portal-desktop-table">
                                    <thead>
                                        <tr>
                                            <th>التاريخ</th>
                                            <th>الجلسة</th>
                                            <th>السلوك</th>
                                            <th>الحضور</th>
                                            <th>التقييم والتسميع</th>
                                            <th>ملاحظات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {followUps.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#888' }}>
                                                    لا توجد سجلات متابعة مسجلة حتى الآن
                                                </td>
                                            </tr>
                                        ) : (
                                            followUps.map((row) => (
                                                <tr key={row.id}>
                                                    <td style={{ fontWeight: 600 }}>{row.date}</td>
                                                    <td>{row.session}</td>
                                                    <td>
                                                        <span style={{
                                                            background: row.behavior_score >= 8 ? '#dcfce7' : '#fef3c7',
                                                            color: row.behavior_score >= 8 ? '#15803d' : '#b45309',
                                                            padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700
                                                        }}>
                                                            {row.behavior} ({row.behavior_score}/10)
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span style={{
                                                            color: row.attendance_status === 'PRESENT' ? '#15803d' : (row.attendance_status === 'LATE' ? '#d97706' : '#dc2626'),
                                                            fontWeight: 600
                                                        }}>
                                                            {row.attendance}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontWeight: 500 }}>{row.evaluation}</td>
                                                    <td style={{ fontSize: 12, color: '#64748b' }}>{row.notes || '-'}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>

                                {/* Mobile cards layout */}
                                <div className="portal-mobile-cards-list">
                                    {followUps.length === 0 ? (
                                        <p style={{ textAlign: 'center', color: '#888', padding: '20px' }}>لا توجد سجلات متابعة</p>
                                    ) : (
                                        followUps.map((row) => (
                                            <div key={row.id} className="portal-session-mobile-card">
                                                <div className="portal-session-mobile-header">
                                                    <strong>{row.date}</strong>
                                                    <span style={{
                                                        color: row.attendance_status === 'PRESENT' ? '#15803d' : (row.attendance_status === 'LATE' ? '#d97706' : '#dc2626'),
                                                        fontWeight: 700, fontSize: 13
                                                    }}>
                                                        {row.attendance}
                                                    </span>
                                                </div>
                                                <div className="portal-session-mobile-row">
                                                    <span>الجلسة:</span>
                                                    <strong>{row.session}</strong>
                                                </div>
                                                <div className="portal-session-mobile-row">
                                                    <span>التقييم:</span>
                                                    <strong>{row.evaluation}</strong>
                                                </div>
                                                <div className="portal-session-mobile-row">
                                                    <span>السلوك:</span>
                                                    <span style={{
                                                        background: row.behavior_score >= 8 ? '#dcfce7' : '#fef3c7',
                                                        color: row.behavior_score >= 8 ? '#15803d' : '#b45309',
                                                        padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700
                                                    }}>
                                                        {row.behavior} ({row.behavior_score}/10)
                                                    </span>
                                                </div>
                                                {row.notes && (
                                                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 6, paddingTop: 6, borderTop: '1px solid #f8fafc' }}>
                                                        {row.notes}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 2. تحليل الأداء والمخطط التفاعلي */}
                        <div className="portal-chart-card">
                            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>
                                تحليل الأداء الشهري
                            </h3>

                            {/* اتجاه التحسن */}
                            <div className={`portal-trend-badge ${
                                analytics.trend_direction === 'improving' ? 'portal-trend-improving' :
                                (analytics.trend_direction === 'declining' ? 'portal-trend-declining' : 'portal-trend-stable')
                            }`}>
                                {analytics.trend_direction === 'improving' && <TrendUp size={18} weight="bold" />}
                                {analytics.trend_direction === 'declining' && <TrendDown size={18} weight="bold" />}
                                {analytics.trend_direction === 'stable' && <ChartBar size={18} />}
                                <span>{analytics.trend_label || 'أداء ممتاز ومستقر'}</span>
                            </div>

                            {/* متوسطات الأسابيع */}
                            <div className="portal-weekly-bars">
                                {analytics.weekly_data?.map((w, idx) => (
                                    <div key={idx} className="portal-bar-item">
                                        <div className="portal-bar-label">
                                            <span>{w.week}</span>
                                            <strong>{w.score}%</strong>
                                        </div>
                                        <div className="portal-bar-track">
                                            <div
                                                className="portal-bar-fill"
                                                style={{ width: `${Math.min(100, Math.max(10, w.score))}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, background: '#f8fafc', padding: 12, borderRadius: 10, margin: 0 }}>
                                {analytics.comparison_summary}
                            </p>
                        </div>
                    </div>
                </>
            )}

            {/* =========================================================
                TAB 2: POINTS & REWARDS (النقاط والمكافآت)
            ========================================================= */}
            {activeTab === 'rewards' && (
                <div className="portal-view-section">
                    {/* Points Summary Banner */}
                    <div className="portal-points-banner">
                        <div className="portal-points-stat-card">
                            <h4>الرصيد المتاح حالياً</h4>
                            <div className="val" style={{ color: '#15803d' }}>
                                <Coins size={22} weight="fill" style={{ verticalAlign: 'middle', marginLeft: 6 }} />
                                {storeData?.points_summary?.current_balance ?? kpis.total_points ?? 0} نقطة
                            </div>
                        </div>
                        <div className="portal-points-stat-card">
                            <h4>إجمالي النقاط المكتسبة</h4>
                            <div className="val" style={{ color: '#2563eb' }}>
                                +{storeData?.points_summary?.total_earned ?? 0}
                            </div>
                        </div>
                        <div className="portal-points-stat-card">
                            <h4>إجمالي النقاط المستخدمة</h4>
                            <div className="val" style={{ color: '#d97706' }}>
                                {storeData?.points_summary?.total_spent ?? 0}
                            </div>
                        </div>
                    </div>

                    {/* Store Closed Banner Notice if applicable */}
                    {storeData?.store_status && !storeData.store_status.is_open && (
                        <div className="portal-store-notice">
                            <WarningCircle size={24} />
                            <div>
                                <strong>متجر المكافآت مغلق حالياً</strong>
                                <p style={{ margin: '4px 0 0 0', fontSize: 13 }}>{storeData.store_status.message}</p>
                            </div>
                        </div>
                    )}

                    {/* Store Catalog */}
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>
                        متجر الجوائز والمكافآت المتاحة
                    </h3>

                    <div className="portal-store-grid">
                        {storeData?.rewards_catalog?.map((reward) => (
                            <div key={reward.id} className="portal-reward-card">
                                <div className="portal-reward-img">
                                    {reward.image ? (
                                        <img src={reward.image} alt={reward.name} />
                                    ) : (
                                        <Gift size={48} color="#133315" />
                                    )}
                                    <span className="portal-reward-tag">
                                        <Coins size={14} weight="fill" />
                                        {reward.points_cost} نقطة
                                    </span>
                                </div>
                                <div className="portal-reward-body">
                                    <h4>{reward.name}</h4>
                                    <p>{reward.description || 'مكافأة تشجيعية مميزة لطلاب الحلقات القرآنية'}</p>
                                    
                                    <button
                                        className={`portal-claim-btn ${reward.is_available && reward.can_afford ? 'btn-active' : 'btn-disabled'}`}
                                        disabled={!reward.is_available || !reward.can_afford}
                                        onClick={() => handleOpenClaimModal(reward)}
                                    >
                                        {!reward.is_available ? 'غير متاح حالياً' :
                                         (!reward.can_afford ? 'رصيدك غير كافٍ' : 'طلب المكافأة')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* My Claims History */}
                    <div className="portal-section-card">
                        <div className="portal-section-header">
                            <h3>
                                <Clock size={20} color="#133315" />
                                سجل طلبات المكافآت السابقة
                            </h3>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table className="portal-table">
                                <thead>
                                    <tr>
                                        <th>المكافأة</th>
                                        <th>النقاط المطلوبة</th>
                                        <th>تاريخ الطلب</th>
                                        <th>حالة الطلب</th>
                                        <th>ملاحظات الطالب</th>
                                        <th>ملاحظات الإدارة</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {storeData?.claims_history?.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: '#888' }}>
                                                لم تقم بتقديم أي طلبات مكافآت بعد
                                            </td>
                                        </tr>
                                    ) : (
                                        storeData?.claims_history?.map((claim) => (
                                            <tr key={claim.id}>
                                                <td style={{ fontWeight: 600 }}>{claim.reward_name}</td>
                                                <td>
                                                    <span className="pr-points-badge">{claim.points_spent} نقطة</span>
                                                </td>
                                                <td>{claim.claimed_at}</td>
                                                <td>{renderClaimStatusBadge(claim.status)}</td>
                                                <td>{claim.notes || '-'}</td>
                                                <td style={{ color: claim.status === 'REJECTED' ? '#dc2626' : '#059669', fontWeight: 500 }}>
                                                    {claim.rejection_reason || claim.admin_notes || '-'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================================
                TAB 3: COMPETITIONS (المسابقات)
            ========================================================= */}
            {activeTab === 'competitions' && (
                <div className="portal-view-section">
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>
                        المسابقات القرآنية المتاحة للطالب
                    </h3>

                    <div className="portal-store-grid">
                        {competitions.length === 0 ? (
                            <p style={{ gridColumn: '1/-1', textAlign: 'center', padding: '30px', color: '#888' }}>
                                لا توجد مسابقات منشورة حالياً لحلقتك
                            </p>
                        ) : (
                            competitions.map((comp) => (
                                <div key={comp.id} className="portal-reward-card">
                                    <div className="portal-reward-img" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' }}>
                                        <Trophy size={48} color="#15803d" />
                                        <span className="portal-reward-tag" style={{ background: '#15803d', color: '#ffffff' }}>
                                            +{comp.points_reward} نقطة
                                        </span>
                                    </div>
                                    <div className="portal-reward-body">
                                        <h4>{comp.title}</h4>
                                        <p>{comp.description || 'اختبر معلوماتك واربح نقاطاً إضافية في رصيدك'}</p>
                                        
                                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
                                            ⏱️ المدة: {comp.duration_minutes} دقيقة | ❓ {comp.questions_count} سؤال
                                        </div>

                                        {comp.has_attempted ? (
                                            <div style={{ textAlign: 'center', padding: '8px', background: '#f8fafc', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#059669' }}>
                                                ✅ تم التسليم (الدرجة: {comp.score}/{comp.total_possible_score})
                                            </div>
                                        ) : (
                                            <button
                                                className="portal-claim-btn btn-active"
                                                onClick={() => handleStartCompetition(comp.id)}
                                            >
                                                بدء المسابقة الآن
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* =========================================================
                TAB 4: REPORT & RECITATIONS (سجل المتابعة والتقييمات المتكامل)
            ========================================================= */}
            {activeTab === 'report' && (
                <StudentFollowUpSection studentId={selectedStudentId} />
            )}

            {/* =========================================================
                CLAIM REWARD MODAL (طلب شراء مكافأة)
            ========================================================= */}
            {isClaimModalOpen && selectedReward && (
                <div className="portal-modal-overlay">
                    <div className="portal-modal-box">
                        <div className="portal-modal-header">
                            <h3>تأكيد طلب المكافأة</h3>
                            <button className="portal-modal-close" onClick={() => setIsClaimModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleConfirmClaim}>
                            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 18, fontSize: 14, lineHeight: 1.6 }}>
                                <div><strong>المكافأة:</strong> {selectedReward.name}</div>
                                <div><strong>النقاط المطلوبة:</strong> {selectedReward.points_cost} نقطة</div>
                                <div><strong>رصيدك الحالي:</strong> {kpis.total_points || 0} نقطة</div>
                                <div style={{ fontSize: 12, color: '#047857', marginTop: 6, fontWeight: 600 }}>
                                    ℹ️ ملاحظة: لن يتم خصم النقاط من رصيدك حتى تتم الموافقة النهائية من الإدارة.
                                </div>
                            </div>

                            <div className="pr-form-group">
                                <label className="pr-form-label">ملاحظات إضافية للمشرف (اختياري):</label>
                                <textarea
                                    className="pr-form-textarea"
                                    rows="3"
                                    placeholder="مثال: يفضل اللون الأزرق إن وجد..."
                                    value={claimNotes}
                                    onChange={(e) => setClaimNotes(e.target.value)}
                                />
                            </div>

                            <div className="portal-modal-footer">
                                <button type="button" className="pr-btn-secondary" onClick={() => setIsClaimModalOpen(false)}>
                                    إلغاء
                                </button>
                                <button type="submit" className="pr-action-btn-green" disabled={isClaimSubmitting}>
                                    {isClaimSubmitting ? 'جاري الإرسال...' : 'تأكيد إرسال الطلب'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* =========================================================
                ACTIVE QUIZ MODAL
            ========================================================= */}
            {activeQuizData && (
                <div className="portal-modal-overlay" style={{ zIndex: 10000 }}>
                    <div className="portal-modal-box" style={{ maxWidth: 700, maxHeight: '90vh', overflowY: 'auto' }}>
                        <StudentCompetitionQuiz
                            competitionData={activeQuizData}
                            onClose={() => setActiveQuizData(null)}
                            onSubmitted={handleQuizSubmitted}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentDashboard;
