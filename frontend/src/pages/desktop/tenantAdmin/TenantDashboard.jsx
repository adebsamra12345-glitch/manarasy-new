import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Bell, Users, User, CaretDown, Medal, BookOpen, Clock,
    Warning, MagnifyingGlass, MapPin, Check, X,
    Eye, ArrowSquareOut, Checks, UserPlus, UserSwitch, Trash,
    Funnel, Calendar, ArrowsClockwise, Info, FileText, CheckCircle, XCircle
} from '@phosphor-icons/react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
    PieChart, Pie, Cell, LabelList
} from 'recharts';
import {
    getMosqueAdminDashboardData,
    approveStudentRegistrationRequest,
    rejectStudentRegistrationRequest,
    approveStudentDeletionRequest,
    rejectStudentDeletionRequest
} from '../../../services/api/tenantService';
import useDeviceType from '../../../hooks/useDeviceType';
import MobileTenantDashboard from '../../mobile/tenantAdmin/MobileTenantDashboard';

const TenantDashboard = () => {
    const { isMobile } = useDeviceType();
    const navigate = useNavigate();
    const location = useLocation();
    const basePath = location.pathname.startsWith('/center-manager') ? '/center-manager' : '/admin';
    const today = new Date();
    const todayDate = new Date();
    const hijriDate = new Intl.DateTimeFormat('ar-SA', {
        calendar: 'islamic', day: 'numeric', month: 'long', year: 'numeric'
    }).format(todayDate);
    const gregorianDate = new Intl.DateTimeFormat('ar-EG', {
        day: 'numeric', month: 'long', year: 'numeric'
    }).format(todayDate);
    const weekday = new Intl.DateTimeFormat('ar-EG', { weekday: 'long' }).format(todayDate);
    const defaultDateStr = `${weekday}، ${hijriDate} | ${gregorianDate} م`;

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedCenterId, setSelectedCenterId] = useState('all');
    const [centersList, setCentersList] = useState([{ id: 'all', name: 'جميع المراكز' }]);
    const [searchQuery, setSearchQuery] = useState('');
    const [toastMessage, setToastMessage] = useState('');

    // Requests Management State (Phases 3, 4, 5, 6)
    const [requests, setRequests] = useState([]);
    const [selectedTypeFilter, setSelectedTypeFilter] = useState('ALL'); // 'ALL' | 'CREATE' | 'UPDATE' | 'DELETE'
    const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'
    const [tableSearch, setTableSearch] = useState('');
    const [selectedRequestForDetails, setSelectedRequestForDetails] = useState(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [requestToReject, setRequestToReject] = useState(null);
    const [rejectionReasonInput, setRejectionReasonInput] = useState('');
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    if (isMobile) {
        return <MobileTenantDashboard />;
    }

    const fetchData = async (showRefresh = false) => {
        if (showRefresh) {
            setIsRefreshing(true);
        }
        try {
            const res = await getMosqueAdminDashboardData(selectedCenterId);
            if (res && res.data) {
                setData(res.data);

                if (res.data.centers && res.data.centers.length > 0) {
                    setCentersList([{ id: 'all', name: 'جميع المراكز' }, ...res.data.centers]);
                }

                if (res.data.requests) {
                    setRequests(res.data.requests);
                } else if (res.data.pending_requests) {
                    // Fallback formatting
                    setRequests(res.data.pending_requests.map(r => ({
                        id: r.id,
                        category: 'REGISTRATION',
                        request_type: 'CREATE',
                        request_type_label: 'إنشاء طالب',
                        student_id: null,
                        student_name: r.name,
                        halaqa: r.halaqa || '',
                        created_at: r.created_at || '',
                        created_date: r.created_at || '',
                        submitting_teacher: 'معلم الحلقة',
                        status: 'PENDING',
                        status_label: 'قيد الانتظار',
                        rejection_reason: '',
                        reviewed_by_name: '',
                        notes: '',
                        details: { full_name: r.name, reached_page: 1 }
                    })));
                }
            }
        } catch (err) {
            console.warn('Error fetching dashboard data:', err);
            showToast('حدث خطأ أثناء تحميل البيانات');
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData(Boolean(data));
    }, [selectedCenterId]);

    const handleApproveRequest = async (req) => {
        try {
            setActionLoading(true);
            let res;
            if (req.category === 'DELETION' || req.request_type === 'DELETE') {
                res = await approveStudentDeletionRequest(req.id);
            } else {
                res = await approveStudentRegistrationRequest(req.id);
            }

            // Immediately update the status in local state
            setRequests(prev => prev.map(r => r.id === req.id ? {
                ...r,
                status: 'APPROVED',
                status_label: 'مقبول',
                student_id: res?.data?.student_id || r.student_id
            } : r));
            showToast(res?.message || `تمت الموافقة بنجاح على طلب ${req.student_name}`);

            // Refresh dashboard data in background
            fetchData(false);
        } catch (error) {
            console.error('Error approving request:', error);
            showToast(error.response?.data?.message || 'حدث خطأ أثناء الموافقة على الطلب');
        } finally {
            setActionLoading(false);
        }
    };

    const handleOpenRejectModal = (req) => {
        setRequestToReject(req);
        setRejectionReasonInput('');
        setIsRejectModalOpen(true);
    };

    const handleConfirmRejectRequest = async () => {
        if (!requestToReject) return;
        try {
            setActionLoading(true);
            let res;
            const payload = { rejection_reason: rejectionReasonInput.trim() };
            if (requestToReject.category === 'DELETION' || requestToReject.request_type === 'DELETE') {
                res = await rejectStudentDeletionRequest(requestToReject.id, payload);
            } else {
                res = await rejectStudentRegistrationRequest(requestToReject.id, payload);
            }

            // Immediately update the status in local state
            setRequests(prev => prev.map(r => r.id === requestToReject.id ? {
                ...r,
                status: 'REJECTED',
                status_label: 'مرفوض',
                rejection_reason: rejectionReasonInput.trim()
            } : r));
            showToast(res?.message || `تم رفض طلب ${requestToReject.student_name}`);
            setIsRejectModalOpen(false);
            setRequestToReject(null);
            setRejectionReasonInput('');

            // Refresh dashboard data in background
            fetchData(false);
        } catch (error) {
            console.error('Error rejecting request:', error);
            showToast(error.response?.data?.message || 'حدث خطأ أثناء رفض الطلب');
        } finally {
            setActionLoading(false);
        }
    };

    const handleNavigateToStudent = (req) => {
        const studentId = req.student_id;
        if (!studentId) {
            showToast('طلب تسجيل جديد: لم يتم إنشاء ملف الطالب بعد');
            return;
        }
        navigate(`${basePath}/students`, { state: { targetStudentId: studentId } });
    };

    const handleViewDetails = (req) => {
        setSelectedRequestForDetails(req);
        setIsDetailsModalOpen(true);
    };

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 4000);
    };

    const filteredRequests = useMemo(() => {
        return requests.filter(req => {
            if (selectedTypeFilter !== 'ALL' && req.request_type !== selectedTypeFilter) {
                return false;
            }
            if (selectedStatusFilter !== 'ALL' && req.status !== selectedStatusFilter) {
                return false;
            }
            if (tableSearch.trim()) {
                const q = tableSearch.toLowerCase().trim();
                const sName = (req.student_name || '').toLowerCase();
                const tName = (req.submitting_teacher || '').toLowerCase();
                const rId = String(req.id || '');
                if (!sName.includes(q) && !tName.includes(q) && !rId.includes(q)) {
                    return false;
                }
            }
            return true;
        });
    }, [requests, selectedTypeFilter, selectedStatusFilter, tableSearch]);

    const getRequestTypeBadge = (type) => {
        switch (type) {
            case 'CREATE':
                return {
                    label: 'إنشاء طالب',
                    bg: '#ecfdf5',
                    color: '#065f46',
                    border: '#a7f3d0',
                    icon: <UserPlus size={14} weight="bold" />
                };
            case 'UPDATE':
                return {
                    label: 'تعديل طالب',
                    bg: '#eff6ff',
                    color: '#1e40af',
                    border: '#bfdbfe',
                    icon: <UserSwitch size={14} weight="bold" />
                };
            case 'DELETE':
                return {
                    label: 'حذف طالب',
                    bg: '#fef2f2',
                    color: '#991b1b',
                    border: '#fecaca',
                    icon: <Trash size={14} weight="bold" />
                };
            default:
                return {
                    label: type || 'طلب',
                    bg: '#f8fafc',
                    color: '#475569',
                    border: '#e2e8f0',
                    icon: <FileText size={14} weight="bold" />
                };
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'PENDING':
                return {
                    label: 'قيد الانتظار',
                    bg: '#fffbeb',
                    color: '#b45309',
                    border: '#fde68a',
                    icon: <Clock size={13} weight="bold" />
                };
            case 'APPROVED':
                return {
                    label: 'مقبول',
                    bg: '#f0fdf4',
                    color: '#15803d',
                    border: '#bbf7d0',
                    icon: <CheckCircle size={13} weight="fill" />
                };
            case 'REJECTED':
                return {
                    label: 'مرفوض',
                    bg: '#fef2f2',
                    color: '#b91c1c',
                    border: '#fecaca',
                    icon: <XCircle size={13} weight="fill" />
                };
            default:
                return {
                    label: status || 'معلق',
                    bg: '#f1f5f9',
                    color: '#475569',
                    border: '#cbd5e1',
                    icon: <Clock size={13} />
                };
        }
    };

    // Default numbers matching design
    const totalActiveStudents = data?.total_active_students || 0;
    const totalTeachers = data?.total_teachers || 0;
    const totalRings = data?.total_rings || 0;
    const currentMonthSessions = data?.current_month_sessions || 0;
    const awardedPoints = data?.awarded_points || 0;

    const maleCount = data?.gender_distribution?.male_count || 0;
    const malePercent = data?.gender_distribution?.male_percentage || 0;
    const femaleCount = data?.gender_distribution?.female_count || 0;
    const femalePercent = data?.gender_distribution?.female_percentage || 0;

    const pieData = [
        { name: 'الذكور', value: maleCount, color: '#f36c32' },
        { name: 'الإناث', value: femaleCount, color: '#558b2f' },
    ];

    const performanceData = (data?.performance_chart && data.performance_chart.length > 0)
        ? data.performance_chart
        : [];

    const currentUserName = localStorage.getItem('username') || 'محمد العمري';

    if (loading && !data) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', direction: 'rtl' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{
                        border: '4px solid #f3f3f3', borderTop: '4px solid #558b2f',
                        borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '0 auto 1rem'
                    }}></div>
                    <p style={{ color: '#4a5568', fontWeight: 600 }}>جاري تحميل البيانات...</p>
                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-container" style={{ direction: 'rtl', opacity: isRefreshing ? 0.6 : 1, transition: 'opacity 0.3s ease' }}>
            {/* Toast notification */}
            {toastMessage && (
                <div style={{
                    position: 'fixed',
                    bottom: '24px',
                    left: '24px',
                    zIndex: 9999,
                    background: '#133315',
                    color: '#fff',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '10px',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '0.95rem'
                }}>
                    <Check size={18} color="#8fc97e" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Top Header */}
            <div className="dashboard-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1.25rem',
                marginBottom: '2rem'
            }}>
                <div className="greeting">
                    <h1 style={{
                        fontSize: '1.85rem',
                        fontWeight: 800,
                        color: '#133315',
                        margin: 0,
                        marginBottom: '0.4rem',
                        letterSpacing: '-0.3px'
                    }}>
                        السلام عليكم، أ. {currentUserName}
                    </h1>
                    <p style={{ color: '#718096', fontSize: '0.95rem', margin: 0, fontWeight: 500 }}>
                        {defaultDateStr}
                    </p>
                </div>

                <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    {/* Center Filter Dropdown */}
                    <div style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '0.55rem 2.5rem 0.55rem 1.15rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer'
                    }}>
                        <select
                            value={selectedCenterId}
                            onChange={(e) => setSelectedCenterId(e.target.value)}
                            style={{
                                appearance: 'none',
                                border: 'none',
                                background: 'transparent',
                                color: '#4a5568',
                                fontSize: '0.92rem',
                                fontWeight: 600,
                                outline: 'none',
                                cursor: 'pointer',
                                width: '100%',
                                paddingRight: '0.5rem'
                            }}
                        >
                            {centersList.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        <CaretDown size={14} color="#718096" style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }} />
                        <MapPin size={18} color="#718096" style={{ position: 'absolute', right: '12px', pointerEvents: 'none' }} />
                    </div>

                    {/* Notification Bell */}
                    <button style={{
                        position: 'relative',
                        width: '42px',
                        height: '42px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        color: '#4a5568',
                        padding: 0
                    }}>
                        <Bell size={20} />
                        <span style={{
                            position: 'absolute',
                            top: '8px',
                            right: '9px',
                            width: '8px',
                            height: '8px',
                            backgroundColor: '#ea580c',
                            borderRadius: '50%',
                            border: '1.5px solid #ffffff'
                        }}></span>
                    </button>

                    {/* Search Input Box */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '0.55rem 1rem',
                        width: '230px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                    }}>
                        <MagnifyingGlass size={18} color="#a0aec0" />
                        <input
                            type="text"
                            placeholder="ابحث هنا..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                border: 'none',
                                outline: 'none',
                                background: 'transparent',
                                fontSize: '0.9rem',
                                fontFamily: 'inherit',
                                color: '#2d3748',
                                width: '100%'
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* 5 Stats Cards Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.25rem',
                marginBottom: '2rem'
            }}>


                {/* Card 2: جلسات الشهر الحالي */}
                <div 
                    onClick={() => navigate(`${basePath}/sessions`)}
                    style={{
                        background: '#ffffff',
                        border: '1px solid #edf2f7',
                        borderRadius: '16px',
                        padding: '1.25rem 1.4rem',
                        textAlign: 'center',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        cursor: 'pointer',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-3px)';
                        e.currentTarget.style.boxShadow = '0 6px 15px rgba(0,0,0,0.06)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '36px', marginBottom: '0.5rem' }}>
                        <div style={{
                            background: '#fff7ed',
                            color: '#ea580c',
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Clock size={22} weight="bold" />
                        </div>
                        <span style={{ color: '#2e7d32', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                            +8% &uarr;
                        </span>
                    </div>
                    <h2 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#133315', margin: '0 0 0.35rem 0' }}>
                        {currentMonthSessions}
                    </h2>
                    <p style={{ color: '#718096', fontSize: '0.88rem', fontWeight: 500, margin: 0 }}>
                        جلسات الشهر الحالي
                    </p>
                </div>

                {/* Card 3: الحلقات */}
                <div 
                    onClick={() => navigate(`${basePath}/rings`)}
                    style={{
                        background: '#ffffff',
                        border: '1px solid #edf2f7',
                        borderRadius: '16px',
                        padding: '1.25rem 1.4rem',
                        textAlign: 'center',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        cursor: 'pointer',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-3px)';
                        e.currentTarget.style.boxShadow = '0 6px 15px rgba(0,0,0,0.06)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'flex-start', minHeight: '36px', marginBottom: '0.5rem' }}>
                        <div style={{
                            background: '#f0fdf4',
                            color: '#558b2f',
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <BookOpen size={22} weight="bold" />
                        </div>
                    </div>
                    <h2 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#133315', margin: '0 0 0.35rem 0' }}>
                        {totalRings}
                    </h2>
                    <p style={{ color: '#718096', fontSize: '0.88rem', fontWeight: 500, margin: 0 }}>
                        الحلقات
                    </p>
                </div>

                {/* Card 4: إجمالي المعلمين */}
                <div 
                    onClick={() => navigate(`${basePath}/teachers`)}
                    style={{
                        background: '#ffffff',
                        border: '1px solid #edf2f7',
                        borderRadius: '16px',
                        padding: '1.25rem 1.4rem',
                        textAlign: 'center',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        cursor: 'pointer',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-3px)';
                        e.currentTarget.style.boxShadow = '0 6px 15px rgba(0,0,0,0.06)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'flex-start', minHeight: '36px', marginBottom: '0.5rem' }}>
                        <div style={{
                            background: '#f0fdf4',
                            color: '#558b2f',
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <User size={22} weight="bold" />
                        </div>
                    </div>
                    <h2 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#133315', margin: '0 0 0.35rem 0' }}>
                        {totalTeachers}
                    </h2>
                    <p style={{ color: '#718096', fontSize: '0.88rem', fontWeight: 500, margin: 0 }}>
                        إجمالي المعلمين
                    </p>
                </div>

                {/* Card 5 (Leftmost in visual layout): إجمالي الطلاب النشطين */}
                <div 
                    onClick={() => navigate(`${basePath}/students`)}
                    style={{
                        background: '#ffffff',
                        border: '1px solid #edf2f7',
                        borderRadius: '16px',
                        padding: '1.25rem 1.4rem',
                        textAlign: 'center',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        cursor: 'pointer',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-3px)';
                        e.currentTarget.style.boxShadow = '0 6px 15px rgba(0,0,0,0.06)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '36px', marginBottom: '0.5rem' }}>
                        <div style={{
                            background: '#f0fdf4',
                            color: '#558b2f',
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Users size={22} weight="bold" />
                        </div>
                        <span style={{ color: '#2e7d32', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                            +12% &uarr;
                        </span>
                    </div>
                    <h2 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#133315', margin: '0 0 0.35rem 0' }}>
                        {totalActiveStudents}
                    </h2>
                    <p style={{ color: '#718096', fontSize: '0.88rem', fontWeight: 500, margin: 0 }}>
                        إجمالي الطلاب النشطين
                    </p>
                </div>
            </div>

            {/* Middle Section: Charts Grid (Right: Donut, Left: Line Chart) */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1.1fr 1.6fr',
                gap: '1.5rem',
                marginBottom: '2rem'
            }}>
                {/* Right Card: Donut Chart — توزيع الطلاب */}
                <div style={{
                    background: '#ffffff',
                    border: '1px solid #edf2f7',
                    borderRadius: '16px',
                    padding: '1.5rem 1.75rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    position: 'relative'
                }}>
                    <h3 style={{
                        fontSize: '1.35rem',
                        fontWeight: 800,
                        color: '#133315',
                        margin: '0 0 1rem 0',
                        textAlign: 'center'
                    }}>
                        توزيع الطلاب
                    </h3>

                    {/* Donut Container */}
                    <div style={{ width: '100%', height: '260px', position: 'relative' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    innerRadius={70}
                                    outerRadius={100}
                                    startAngle={90}
                                    endAngle={-270}
                                    paddingAngle={0}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>

                        {/* Center text inside donut */}
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            textAlign: 'center',
                            pointerEvents: 'none'
                        }}>
                            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#133315', lineHeight: 1.1 }}>
                                {totalActiveStudents}
                            </div>
                            <div style={{ fontSize: '0.92rem', color: '#718096', fontWeight: 600, marginTop: '2px' }}>
                                الطلاب
                            </div>
                        </div>

                        {/* Labels positioned cleanly on each side matching design */}
                        <div style={{
                            position: 'absolute',
                            top: '20%',
                            right: '6%',
                            textAlign: 'right'
                        }}>
                            <div style={{ color: '#4a5568', fontSize: '0.88rem', fontWeight: 700 }}>الذكور</div>
                            <div style={{ color: '#718096', fontSize: '0.82rem', fontWeight: 600 }}>
                                {maleCount} ({malePercent}%)
                            </div>
                        </div>

                        <div style={{
                            position: 'absolute',
                            bottom: '22%',
                            left: '6%',
                            textAlign: 'left'
                        }}>
                            <div style={{ color: '#4a5568', fontSize: '0.88rem', fontWeight: 700 }}>الإناث</div>
                            <div style={{ color: '#718096', fontSize: '0.82rem', fontWeight: 600 }}>
                                {femaleCount} ({femalePercent}%)
                            </div>
                        </div>
                    </div>
                </div>

                {/* Left Card: Line Chart — Student Performance */}
                <div style={{
                    background: '#ffffff',
                    border: '1px solid #edf2f7',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    {/* Line Chart Header */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '1.25rem'
                    }}>
                        {/* Users icon on top right */}
                        <div style={{
                            background: '#f0fdf4',
                            color: '#558b2f',
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Users size={20} weight="bold" />
                        </div>

                        {/* Center filter dropdown on top left */}
                        <div style={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '10px',
                            padding: '0.45rem 2.2rem 0.45rem 0.95rem',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                        }}>
                            <select
                                value={selectedCenterId}
                                onChange={(e) => setSelectedCenterId(e.target.value)}
                                style={{
                                    appearance: 'none',
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#4a5568',
                                    fontSize: '0.88rem',
                                    fontWeight: 600,
                                    outline: 'none',
                                    cursor: 'pointer',
                                    width: '100%',
                                    paddingRight: '0.2rem'
                                }}
                            >
                                {centersList.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            <CaretDown size={14} color="#718096" style={{ position: 'absolute', left: '10px', pointerEvents: 'none' }} />
                            <MapPin size={16} color="#718096" style={{ position: 'absolute', right: '10px', pointerEvents: 'none' }} />
                        </div>
                    </div>

                    {/* Chart Container with Y-Axis label */}
                    <div style={{ display: 'flex', alignItems: 'center', height: '240px', width: '100%' }}>
                        <div style={{ flex: 1, height: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={performanceData} margin={{ top: 15, right: 10, left: 10, bottom: 5 }}>
                                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="0" vertical={true} horizontal={true} />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={{ stroke: '#cbd5e1' }}
                                        tickLine={false}
                                        tick={{ fill: '#475569', fontSize: 12, fontWeight: 500 }}
                                    />
                                    <YAxis hide domain={['auto', 'auto']} />
                                    <Line
                                        type="monotone"
                                        dataKey="value"
                                        stroke="#558b2f"
                                        strokeWidth={2.5}
                                        dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#558b2f' }}
                                        activeDot={{ r: 6 }}
                                    >
                                        <LabelList dataKey="value" position="top" fill="#133315" fontSize={13} fontWeight={700} offset={10} />
                                    </Line>
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Rotated Y-Axis Label matching design */}
                        <div style={{
                            writingMode: 'vertical-rl',
                            transform: 'rotate(180deg)',
                            color: '#475569',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            paddingLeft: '6px',
                            letterSpacing: '0.5px'
                        }}>
                            أداء الطلاب
                        </div>
                    </div>
                </div>
            </div>

            {/* Teacher Attendance Alert Banner */}
            <div style={{ marginBottom: '2rem' }}>
                <div style={{
                    background: '#fffbf5',
                    border: '1.5px solid #fed7aa',
                    borderRadius: '16px',
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    gap: '1.25rem',
                    alignItems: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}>
                    <div style={{
                        background: '#ffedd5',
                        color: '#ea580c',
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <Warning size={28} weight="fill" />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                            <h5 style={{
                                fontSize: '1.05rem',
                                fontWeight: 800,
                                color: '#c2410c',
                                margin: 0
                            }}>
                                تنبيه متابعة حضور المعلمين
                            </h5>
                            <span style={{
                                background: '#fed7aa',
                                color: '#9a3412',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.6rem',
                                borderRadius: '999px'
                            }}>
                                إشعار عاجل
                            </span>
                        </div>
                        <p style={{
                            color: '#4a5568',
                            fontSize: '0.92rem',
                            lineHeight: 1.5,
                            margin: 0,
                            fontWeight: 500
                        }}>
                            {data?.teacher_attendance_alert?.message || "المعلم أحمد الراشد لم يسجل حضوراً منذ 5 أيام لمجموعته (حلقة عاصم بن أبي النجود)."}
                        </p>
                    </div>
                    <button
                        onClick={() => navigate(`${basePath}/teachers`)}
                        style={{
                            background: '#ea580c',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '10px',
                            padding: '0.55rem 1.25rem',
                            fontSize: '0.88rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            flexShrink: 0,
                            transition: 'background 0.2s ease'
                        }}
                    >
                        <span>متابعة المعلمين</span>
                        <ArrowSquareOut size={16} weight="bold" />
                    </button>
                </div>
            </div>

            {/* Phase 3: Requests Management Professional Section */}
            <div style={{
                background: '#ffffff',
                border: '1px solid #edf2f7',
                borderRadius: '18px',
                padding: '1.75rem',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                marginBottom: '2.5rem'
            }}>
                {/* Section Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    marginBottom: '1.5rem',
                    paddingBottom: '1.25rem',
                    borderBottom: '1px solid #f1f5f9'
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <h3 style={{
                                fontSize: '1.3rem',
                                fontWeight: 800,
                                color: '#133315',
                                margin: 0
                            }}>
                                إدارة طلبات الطلاب والعمليات
                            </h3>
                            <span style={{
                                background: '#f0fdf4',
                                color: '#15803d',
                                border: '1px solid #bbf7d0',
                                fontSize: '0.85rem',
                                fontWeight: 800,
                                padding: '0.2rem 0.75rem',
                                borderRadius: '999px'
                            }}>
                                {filteredRequests.length} طلب
                            </span>
                        </div>
                        <p style={{ color: '#718096', fontSize: '0.88rem', margin: '0.35rem 0 0 0' }}>
                            مراجعة واعتماد طلبات التسجيل، تعديل البيانات، والحذف المقدمة من المعلمين
                        </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button
                            onClick={() => fetchData(true)}
                            title="تحديث الطلبات"
                            style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '10px',
                                padding: '0.55rem 0.85rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                cursor: 'pointer',
                                color: '#475569',
                                fontSize: '0.85rem',
                                fontWeight: 600
                            }}
                        >
                            <ArrowsClockwise size={16} weight="bold" />
                            <span>تحديث</span>
                        </button>
                        <button
                            onClick={() => navigate(`${basePath}/students`)}
                            style={{
                                background: '#133315',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '10px',
                                padding: '0.55rem 1.25rem',
                                fontSize: '0.88rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <span>سجل الطلاب والطلبات</span>
                            <ArrowSquareOut size={16} weight="bold" />
                        </button>
                    </div>
                </div>

                {/* Filters and Search Bar */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    marginBottom: '1.5rem',
                    background: '#f8fafc',
                    padding: '0.85rem 1.15rem',
                    borderRadius: '14px',
                    border: '1px solid #e2e8f0'
                }}>
                    {/* Request Type Pills */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', marginLeft: '0.35rem' }}>
                            نوع الطلب:
                        </span>
                        {[
                            { key: 'ALL', label: 'الكل' },
                            { key: 'CREATE', label: 'إنشاء طالب', icon: <UserPlus size={14} /> },
                            { key: 'UPDATE', label: 'تعديل طالب', icon: <UserSwitch size={14} /> },
                            { key: 'DELETE', label: 'حذف طالب', icon: <Trash size={14} /> },
                        ].map(tab => {
                            const isActive = selectedTypeFilter === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setSelectedTypeFilter(tab.key)}
                                    style={{
                                        border: isActive ? '1px solid #133315' : '1px solid #e2e8f0',
                                        background: isActive ? '#133315' : '#ffffff',
                                        color: isActive ? '#ffffff' : '#475569',
                                        padding: '0.4rem 0.85rem',
                                        borderRadius: '8px',
                                        fontSize: '0.82rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    {tab.icon}
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Status Dropdown and Search Input */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                        {/* Status Filter */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>
                                الحالة:
                            </span>
                            <select
                                value={selectedStatusFilter}
                                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                                style={{
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '8px',
                                    padding: '0.42rem 0.85rem',
                                    background: '#ffffff',
                                    color: '#334155',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="ALL">جميع الحالات</option>
                                <option value="PENDING">معلق (قيد الانتظار)</option>
                                <option value="APPROVED">مقبول</option>
                                <option value="REJECTED">مرفوض</option>
                            </select>
                        </div>

                        {/* Search Input */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            padding: '0.42rem 0.85rem',
                            minWidth: '220px'
                        }}>
                            <MagnifyingGlass size={16} color="#94a3b8" />
                            <input
                                type="text"
                                placeholder="ابحث بالاسم أو المعلم..."
                                value={tableSearch}
                                onChange={(e) => setTableSearch(e.target.value)}
                                style={{
                                    border: 'none',
                                    outline: 'none',
                                    background: 'transparent',
                                    fontSize: '0.85rem',
                                    width: '100%',
                                    color: '#1e293b'
                                }}
                            />
                            {tableSearch && (
                                <button
                                    onClick={() => setTableSearch('')}
                                    style={{
                                        border: 'none',
                                        background: 'none',
                                        cursor: 'pointer',
                                        padding: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        color: '#94a3b8'
                                    }}
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* 7 Columns Professional Table */}
                <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.88rem' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                                <th style={{ padding: '0.9rem 1rem', color: '#475569', fontWeight: 800 }}>رقم الطلب</th>
                                <th style={{ padding: '0.9rem 1rem', color: '#475569', fontWeight: 800 }}>اسم الطالب</th>
                                <th style={{ padding: '0.9rem 1rem', color: '#475569', fontWeight: 800 }}>نوع الطلب</th>
                                <th style={{ padding: '0.9rem 1rem', color: '#475569', fontWeight: 800 }}>تاريخ الإنشاء</th>
                                <th style={{ padding: '0.9rem 1rem', color: '#475569', fontWeight: 800 }}>المعلم المرسل</th>
                                <th style={{ padding: '0.9rem 1rem', color: '#475569', fontWeight: 800 }}>الحالة</th>
                                <th style={{ padding: '0.9rem 1rem', color: '#475569', fontWeight: 800, textAlign: 'center' }}>الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ padding: '3.5rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                                            <FileText size={42} weight="light" color="#cbd5e1" />
                                            <span style={{ fontSize: '1rem', fontWeight: 600, color: '#64748b' }}>
                                                لا توجد طلبات تطابق الفلتر المحدد
                                            </span>
                                            <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                                                يمكنك تغيير خيارات الفلترة أو إعادة ضبط البحث
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredRequests.map((req, idx) => {
                                    const typeBadge = getRequestTypeBadge(req.request_type);
                                    const statusBadge = getStatusBadge(req.status);
                                    const isPending = req.status === 'PENDING';

                                    return (
                                        <tr
                                            key={`${req.category || 'REQ'}-${req.id || idx}`}
                                            style={{
                                                borderBottom: idx !== filteredRequests.length - 1 ? '1px solid #f1f5f9' : 'none',
                                                background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                                                transition: 'background 0.15s ease'
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#fafafa'; }}
                                        >
                                            {/* 1. Request ID */}
                                            <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                                                <span style={{
                                                    fontFamily: 'monospace',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 700,
                                                    color: '#334155',
                                                    background: '#e2e8f0',
                                                    padding: '0.2rem 0.55rem',
                                                    borderRadius: '6px'
                                                }}>
                                                    #REQ-{req.id}
                                                </span>
                                            </td>

                                            {/* 2. Student Name */}
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ fontWeight: 800, color: '#133315', fontSize: '0.92rem' }}>
                                                    {req.student_name}
                                                </div>
                                                {req.halaqa && (
                                                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>
                                                        {req.halaqa}
                                                    </div>
                                                )}
                                            </td>

                                            {/* 3. Request Type */}
                                            <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.35rem',
                                                    background: typeBadge.bg,
                                                    color: typeBadge.color,
                                                    border: `1px solid ${typeBadge.border}`,
                                                    padding: '0.25rem 0.65rem',
                                                    borderRadius: '8px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 700
                                                }}>
                                                    {typeBadge.icon}
                                                    <span>{typeBadge.label}</span>
                                                </span>
                                            </td>

                                            {/* 4. Created Date */}
                                            <td style={{ padding: '1rem', whiteSpace: 'nowrap', color: '#64748b', fontSize: '0.82rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                    <Clock size={14} color="#94a3b8" />
                                                    <span>{req.created_date || req.created_at || '—'}</span>
                                                </div>
                                            </td>

                                            {/* 5. Submitting Teacher */}
                                            <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#334155', fontWeight: 600 }}>
                                                    <User size={15} color="#64748b" />
                                                    <span>{req.submitting_teacher || 'معلم الحلقة'}</span>
                                                </div>
                                            </td>

                                            {/* 6. Status */}
                                            <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.35rem',
                                                    background: statusBadge.bg,
                                                    color: statusBadge.color,
                                                    border: `1px solid ${statusBadge.border}`,
                                                    padding: '0.25rem 0.65rem',
                                                    borderRadius: '8px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 700
                                                }}>
                                                    {statusBadge.icon}
                                                    <span>{statusBadge.label}</span>
                                                </span>
                                            </td>

                                            {/* 7. Actions */}
                                            <td style={{ padding: '1rem', whiteSpace: 'nowrap', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem' }}>
                                                    {/* View Details Button */}
                                                    <button
                                                        onClick={() => handleViewDetails(req)}
                                                        title="عرض التفاصيل"
                                                        style={{
                                                            background: '#eff6ff',
                                                            color: '#1d4ed8',
                                                            border: '1px solid #bfdbfe',
                                                            borderRadius: '8px',
                                                            padding: '0.4rem 0.65rem',
                                                            fontSize: '0.8rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.3rem',
                                                            transition: 'background 0.15s ease'
                                                        }}
                                                    >
                                                        <Eye size={15} weight="bold" />
                                                        <span>التفاصيل</span>
                                                    </button>

                                                    {/* Go To Student Button */}
                                                    <button
                                                        onClick={() => handleNavigateToStudent(req)}
                                                        title={req.student_id ? 'الانتقال لملف الطالب' : 'طلب إنشاء طالب جديد'}
                                                        style={{
                                                            background: req.student_id ? '#f0fdf4' : '#f8fafc',
                                                            color: req.student_id ? '#15803d' : '#94a3b8',
                                                            border: `1px solid ${req.student_id ? '#bbf7d0' : '#e2e8f0'}`,
                                                            borderRadius: '8px',
                                                            padding: '0.4rem 0.65rem',
                                                            fontSize: '0.8rem',
                                                            fontWeight: 700,
                                                            cursor: req.student_id ? 'pointer' : 'not-allowed',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.3rem'
                                                        }}
                                                    >
                                                        <ArrowSquareOut size={15} weight="bold" />
                                                        <span>الطالب</span>
                                                    </button>

                                                    {/* Pending Workflow: Approve & Reject */}
                                                    {isPending && (
                                                        <>
                                                            <button
                                                                onClick={() => handleApproveRequest(req)}
                                                                disabled={actionLoading}
                                                                title="الموافقة على الطلب"
                                                                style={{
                                                                    background: '#558b2f',
                                                                    color: '#ffffff',
                                                                    border: 'none',
                                                                    borderRadius: '8px',
                                                                    padding: '0.4rem 0.8rem',
                                                                    fontSize: '0.8rem',
                                                                    fontWeight: 700,
                                                                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.3rem',
                                                                    opacity: actionLoading ? 0.7 : 1
                                                                }}
                                                            >
                                                                <Check size={14} weight="bold" />
                                                                <span>موافقة</span>
                                                            </button>

                                                            <button
                                                                onClick={() => handleOpenRejectModal(req)}
                                                                disabled={actionLoading}
                                                                title="رفض الطلب"
                                                                style={{
                                                                    background: '#fee2e2',
                                                                    color: '#b91c1c',
                                                                    border: '1px solid #fecaca',
                                                                    borderRadius: '8px',
                                                                    padding: '0.4rem 0.8rem',
                                                                    fontSize: '0.8rem',
                                                                    fontWeight: 700,
                                                                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.3rem',
                                                                    opacity: actionLoading ? 0.7 : 1
                                                                }}
                                                            >
                                                                <X size={14} weight="bold" />
                                                                <span>رفض</span>
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Phase 4: Request Details Modal */}
            {isDetailsModalOpen && selectedRequestForDetails && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.65)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 10000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1.5rem',
                    direction: 'rtl'
                }}>
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '20px',
                        width: '100%',
                        maxWidth: '750px',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '1.25rem 1.75rem',
                            borderBottom: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: '#f8fafc'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    background: '#133315',
                                    color: '#ffffff',
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <FileText size={20} weight="bold" />
                                </div>
                                <div>
                                    <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#133315' }}>
                                        تفاصيل الطلب #{selectedRequestForDetails.id}
                                    </h4>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                            النوع: {getRequestTypeBadge(selectedRequestForDetails.request_type).label}
                                        </span>
                                        <span style={{ color: '#cbd5e1' }}>•</span>
                                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                            التاريخ: {selectedRequestForDetails.created_date || selectedRequestForDetails.created_at || '—'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => { setIsDetailsModalOpen(false); setSelectedRequestForDetails(null); }}
                                style={{
                                    border: 'none',
                                    background: '#f1f5f9',
                                    borderRadius: '8px',
                                    width: '32px',
                                    height: '32px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: '#64748b'
                                }}
                            >
                                <X size={18} weight="bold" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', flex: 1 }}>
                            {/* Summary Banner */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                                gap: '1rem',
                                background: '#f8fafc',
                                padding: '1rem',
                                borderRadius: '12px',
                                border: '1px solid #e2e8f0',
                                marginBottom: '1.5rem'
                            }}>
                                <div>
                                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>اسم الطالب:</span>
                                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#133315', marginTop: '0.15rem' }}>
                                        {selectedRequestForDetails.student_name}
                                    </div>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>المعلم المرسل:</span>
                                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155', marginTop: '0.15rem' }}>
                                        {selectedRequestForDetails.submitting_teacher || 'معلم الحلقة'}
                                    </div>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>الحلقة:</span>
                                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155', marginTop: '0.15rem' }}>
                                        {selectedRequestForDetails.halaqa || 'غير محددة'}
                                    </div>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>حالة الطلب:</span>
                                    <div style={{ marginTop: '0.2rem' }}>
                                        {(() => {
                                            const badge = getStatusBadge(selectedRequestForDetails.status);
                                            return (
                                                <span style={{
                                                    background: badge.bg,
                                                    color: badge.color,
                                                    border: `1px solid ${badge.border}`,
                                                    padding: '0.15rem 0.55rem',
                                                    borderRadius: '6px',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 700,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.3rem'
                                                }}>
                                                    {badge.icon}
                                                    <span>{badge.label}</span>
                                                </span>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* Section: Details Content based on Request Type */}
                            {selectedRequestForDetails.request_type === 'UPDATE' && selectedRequestForDetails.old_data && selectedRequestForDetails.new_data ? (
                                <div>
                                    <h5 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.85rem' }}>
                                        مقارنة البيانات (القديمة مقابل الجديدة المطلوبة):
                                    </h5>
                                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.85rem' }}>
                                            <thead>
                                                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                                                    <th style={{ padding: '0.65rem 0.85rem', color: '#475569', fontWeight: 700 }}>الحقل</th>
                                                    <th style={{ padding: '0.65rem 0.85rem', color: '#475569', fontWeight: 700 }}>القيمة السابقة (الحالية)</th>
                                                    <th style={{ padding: '0.65rem 0.85rem', color: '#047857', fontWeight: 700 }}>القيمة الجديدة المطلوبة</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(() => {
                                                    const oldD = selectedRequestForDetails.old_data || {};
                                                    const newD = selectedRequestForDetails.new_data || {};
                                                    const fieldLabels = {
                                                        full_name: 'اسم الطالب',
                                                        phone_number: 'رقم هاتف الطالب',
                                                        national_id: 'رقم الهوية / الإقامة',
                                                        parent_name: 'اسم ولي الأمر',
                                                        parent_phone: 'هاتف ولي الأمر',
                                                        birth_date: 'تاريخ الميلاد',
                                                        reached_page: 'الصفحة الحالية',
                                                        current_juz: 'الجزء الحالي',
                                                        status: 'حالة القيد',
                                                        halaqa_name: 'اسم الحلقة'
                                                    };
                                                    const allKeys = Array.from(new Set([...Object.keys(oldD), ...Object.keys(newD)]));

                                                    return allKeys.map(k => {
                                                        const oVal = oldD[k] !== undefined && oldD[k] !== null && oldD[k] !== '' ? String(oldD[k]) : '—';
                                                        const nVal = newD[k] !== undefined && newD[k] !== null && newD[k] !== '' ? String(newD[k]) : '—';
                                                        const isChanged = oVal !== nVal;

                                                        return (
                                                            <tr key={k} style={{
                                                                borderBottom: '1px solid #f1f5f9',
                                                                background: isChanged ? '#fefce8' : '#ffffff'
                                                            }}>
                                                                <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#334155' }}>
                                                                    {fieldLabels[k] || k}
                                                                </td>
                                                                <td style={{ padding: '0.65rem 0.85rem', color: '#64748b' }}>
                                                                    {oVal}
                                                                </td>
                                                                <td style={{ padding: '0.65rem 0.85rem', fontWeight: isChanged ? 800 : 500, color: isChanged ? '#047857' : '#334155' }}>
                                                                    {nVal}
                                                                    {isChanged && (
                                                                        <span style={{ marginRight: '0.5rem', background: '#dcfce7', color: '#15803d', fontSize: '0.72rem', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                                                                            معدل
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    });
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : selectedRequestForDetails.request_type === 'DELETE' ? (
                                <div>
                                    <div style={{
                                        background: '#fef2f2',
                                        border: '1.5px solid #fecaca',
                                        borderRadius: '12px',
                                        padding: '1.25rem',
                                        marginBottom: '1rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#991b1b', fontWeight: 800, marginBottom: '0.5rem' }}>
                                            <Trash size={18} weight="bold" />
                                            <span>طلب حذف الطالب من الحلقة والمنظومة</span>
                                        </div>
                                        <p style={{ color: '#7f1d1d', fontSize: '0.88rem', margin: '0 0 0.5rem 0', lineHeight: 1.5 }}>
                                            سبب الحذف المقدم من المعلم:
                                        </p>
                                        <div style={{ background: '#ffffff', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.75rem', color: '#334155', fontWeight: 600 }}>
                                            {selectedRequestForDetails.notes || selectedRequestForDetails.rejection_reason || 'لم يتم إرفاق سبب تفصيلي للحذف.'}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* CREATE Request: Full Student Details */
                                <div>
                                    <h5 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.85rem' }}>
                                        بيانات الطالب المقدمة للتسجيل:
                                    </h5>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                        gap: '0.85rem',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '12px',
                                        padding: '1.25rem',
                                        background: '#ffffff'
                                    }}>
                                        {(() => {
                                            const d = selectedRequestForDetails.details || {};
                                            const items = [
                                                { label: 'الاسم الرباعي', value: d.full_name || selectedRequestForDetails.student_name },
                                                { label: 'رقم الهوية / الإقامة', value: d.national_id || '—' },
                                                { label: 'رقم هاتف الطالب', value: d.phone_number || '—' },
                                                { label: 'اسم ولي الأمر', value: d.parent_name || '—' },
                                                { label: 'هاتف ولي الأمر', value: d.parent_phone || '—' },
                                                { label: 'تاريخ الميلاد', value: d.birth_date || '—' },
                                                { label: 'الجنس', value: d.gender === 'FEMALE' ? 'أنثى' : 'ذكر' },
                                                { label: 'الصفحة الحالية', value: d.reached_page ? `صفحة ${d.reached_page}` : 'صفحة 1' }
                                            ];

                                            return items.map((it, idx) => (
                                                <div key={idx} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                                                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>{it.label}:</span>
                                                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginTop: '0.15rem' }}>
                                                        {it.value}
                                                    </div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </div>
                            )}

                            {/* Additional Notes if any */}
                            {selectedRequestForDetails.notes && selectedRequestForDetails.request_type !== 'DELETE' && (
                                <div style={{ marginTop: '1.25rem' }}>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                                        ملاحظات المعلم المرسل:
                                    </span>
                                    <div style={{
                                        background: '#f8fafc',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '8px',
                                        padding: '0.75rem',
                                        marginTop: '0.35rem',
                                        fontSize: '0.88rem',
                                        color: '#334155'
                                    }}>
                                        {selectedRequestForDetails.notes}
                                    </div>
                                </div>
                            )}

                            {/* Rejection reason if already rejected */}
                            {selectedRequestForDetails.status === 'REJECTED' && selectedRequestForDetails.rejection_reason && (
                                <div style={{ marginTop: '1.25rem' }}>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#b91c1c' }}>
                                        سبب الرفض المسجل:
                                    </span>
                                    <div style={{
                                        background: '#fef2f2',
                                        border: '1px solid #fecaca',
                                        borderRadius: '8px',
                                        padding: '0.75rem',
                                        marginTop: '0.35rem',
                                        fontSize: '0.88rem',
                                        color: '#991b1b',
                                        fontWeight: 600
                                    }}>
                                        {selectedRequestForDetails.rejection_reason}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer Actions */}
                        <div style={{
                            padding: '1.25rem 1.75rem',
                            borderTop: '1px solid #e2e8f0',
                            background: '#f8fafc',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '0.75rem'
                        }}>
                            <div>
                                {selectedRequestForDetails.student_id ? (
                                    <button
                                        onClick={() => {
                                            setIsDetailsModalOpen(false);
                                            handleNavigateToStudent(selectedRequestForDetails);
                                        }}
                                        style={{
                                            background: '#ffffff',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '10px',
                                            padding: '0.55rem 1rem',
                                            fontSize: '0.85rem',
                                            fontWeight: 700,
                                            color: '#1e293b',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.4rem'
                                        }}
                                    >
                                        <ArrowSquareOut size={16} weight="bold" />
                                        <span>الانتقال لملف الطالب بالكامل</span>
                                    </button>
                                ) : (
                                    <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                                        طالب جديد لم يتم إنشاء ملفه بعد
                                    </span>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '0.65rem' }}>
                                {selectedRequestForDetails.status === 'PENDING' && (
                                    <>
                                        <button
                                            onClick={() => {
                                                const req = selectedRequestForDetails;
                                                setIsDetailsModalOpen(false);
                                                handleOpenRejectModal(req);
                                            }}
                                            disabled={actionLoading}
                                            style={{
                                                background: '#fee2e2',
                                                color: '#b91c1c',
                                                border: '1px solid #fecaca',
                                                borderRadius: '10px',
                                                padding: '0.55rem 1.25rem',
                                                fontSize: '0.88rem',
                                                fontWeight: 700,
                                                cursor: actionLoading ? 'not-allowed' : 'pointer'
                                            }}
                                        >
                                            رفض الطلب
                                        </button>
                                        <button
                                            onClick={() => {
                                                const req = selectedRequestForDetails;
                                                setIsDetailsModalOpen(false);
                                                handleApproveRequest(req);
                                            }}
                                            disabled={actionLoading}
                                            style={{
                                                background: '#558b2f',
                                                color: '#ffffff',
                                                border: 'none',
                                                borderRadius: '10px',
                                                padding: '0.55rem 1.4rem',
                                                fontSize: '0.88rem',
                                                fontWeight: 700,
                                                cursor: actionLoading ? 'not-allowed' : 'pointer'
                                            }}
                                        >
                                            الموافقة على الطلب
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={() => { setIsDetailsModalOpen(false); setSelectedRequestForDetails(null); }}
                                    style={{
                                        background: '#f1f5f9',
                                        color: '#475569',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '10px',
                                        padding: '0.55rem 1.25rem',
                                        fontSize: '0.88rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    إغلاق
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Rejection Reason Modal */}
            {isRejectModalOpen && requestToReject && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.65)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 10001,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1.5rem',
                    direction: 'rtl'
                }}>
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '18px',
                        width: '100%',
                        maxWidth: '520px',
                        overflow: 'hidden',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                    }}>
                        <div style={{
                            padding: '1.25rem 1.5rem',
                            borderBottom: '1px solid #fecaca',
                            background: '#fef2f2',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem'
                        }}>
                            <div style={{
                                background: '#fee2e2',
                                color: '#b91c1c',
                                width: '38px',
                                height: '38px',
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <XCircle size={22} weight="fill" />
                            </div>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#991b1b' }}>
                                    تأكيد رفض الطلب #{requestToReject.id}
                                </h4>
                                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.82rem', color: '#b91c1c' }}>
                                    الطالب: {requestToReject.student_name}
                                </p>
                            </div>
                        </div>

                        <div style={{ padding: '1.5rem' }}>
                            <p style={{ color: '#475569', fontSize: '0.88rem', margin: '0 0 1rem 0' }}>
                                يرجى توضيح سبب رفض هذا الطلب لمشاركته مع المعلم المرسل:
                            </p>
                            <textarea
                                value={rejectionReasonInput}
                                onChange={(e) => setRejectionReasonInput(e.target.value)}
                                placeholder="اكتب سبب الرفض هنا (مثال: البيانات غير مكتملة، عدم مطابقة الشروط)..."
                                rows={4}
                                style={{
                                    width: '100%',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '10px',
                                    padding: '0.75rem',
                                    fontSize: '0.88rem',
                                    color: '#1e293b',
                                    outline: 'none',
                                    resize: 'vertical',
                                    fontFamily: 'inherit'
                                }}
                            />
                        </div>

                        <div style={{
                            padding: '1rem 1.5rem',
                            background: '#f8fafc',
                            borderTop: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '0.75rem'
                        }}>
                            <button
                                onClick={() => {
                                    setIsRejectModalOpen(false);
                                    setRequestToReject(null);
                                    setRejectionReasonInput('');
                                }}
                                style={{
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '8px',
                                    padding: '0.55rem 1.25rem',
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    color: '#475569',
                                    cursor: 'pointer'
                                }}
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={handleConfirmRejectRequest}
                                disabled={actionLoading}
                                style={{
                                    background: '#dc2626',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '0.55rem 1.4rem',
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    color: '#ffffff',
                                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                                    opacity: actionLoading ? 0.7 : 1
                                }}
                            >
                                {actionLoading ? 'جاري الرفض...' : 'تأكيد الرفض'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TenantDashboard;
