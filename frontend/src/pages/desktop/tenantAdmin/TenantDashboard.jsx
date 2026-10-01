import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Bell, Users, User, CaretDown, Medal, BookOpen, Clock,
    Warning, MagnifyingGlass, MapPin, Check, X
} from '@phosphor-icons/react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
    PieChart, Pie, Cell, LabelList
} from 'recharts';
import {
    getMosqueAdminDashboardData,
    approveRegistrationRequest,
    rejectRegistrationRequest
} from '../../../services/api/tenantService';

const TenantDashboard = () => {
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
    const [pendingRequests, setPendingRequests] = useState([]);
    const [toastMessage, setToastMessage] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            if (data) {
                setIsRefreshing(true);
            }
            try {
                const res = await getMosqueAdminDashboardData(selectedCenterId);
                if (res && res.data) {
                    setData(res.data);

                    // Update centers list only if we haven't loaded it properly yet, or to keep it fresh
                    if (res.data.centers && res.data.centers.length > 0) {
                        setCentersList([{ id: 'all', name: 'جميع المراكز' }, ...res.data.centers]);
                    }

                    if (res.data.pending_requests !== undefined) {
                        setPendingRequests(res.data.pending_requests);
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
        fetchData();
    }, [selectedCenterId]);

    const handleAcceptRequest = async (id, name) => {
        try {
            await approveRegistrationRequest(id);
            setPendingRequests(prev => prev.filter(r => r.id !== id));
            showToast(`تمت الموافقة على طلب تسجيل ${name}`);
        } catch (error) {
            showToast(`حدث خطأ أثناء الموافقة على طلب ${name}`);
            console.error(error);
        }
    };

    const handleRejectRequest = async (id, name) => {
        try {
            await rejectRegistrationRequest(id);
            setPendingRequests(prev => prev.filter(r => r.id !== id));
            showToast(`تم رفض طلب تسجيل ${name}`);
        } catch (error) {
            showToast(`حدث خطأ أثناء رفض طلب ${name}`);
            console.error(error);
        }
    };

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3500);
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
                <div style={{
                    background: '#ffffff',
                    border: '1px solid #edf2f7',
                    borderRadius: '16px',
                    padding: '1.25rem 1.4rem',
                    textAlign: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}>
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
                <div style={{
                    background: '#ffffff',
                    border: '1px solid #edf2f7',
                    borderRadius: '16px',
                    padding: '1.25rem 1.4rem',
                    textAlign: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}>
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

            {/* Bottom Section: Urgent Notifications & Actions */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr',
                gap: '1.5rem',
                alignItems: 'start',
                paddingBottom: '2.5rem'
            }}>
                {/* Right Column: Pending Registrations */}
                <div>
                    <h3 style={{
                        fontSize: '1.15rem',
                        fontWeight: 800,
                        color: '#133315',
                        margin: '0 0 1rem 0'
                    }}>
                        الإشعارات والإجراءات العاجلة
                    </h3>

                    <div style={{
                        background: '#ffffff',
                        border: '1px solid #edf2f7',
                        borderRadius: '16px',
                        padding: '1.5rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                    }}>
                        <h4 style={{
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            color: '#2d3748',
                            margin: '0 0 1.25rem 0'
                        }}>
                            طلبات تسجيل معلقة ({pendingRequests.length})
                        </h4>

                        {pendingRequests.length === 0 ? (
                            <p style={{ color: '#a0aec0', fontSize: '0.9rem', textAlign: 'center', padding: '1rem 0' }}>
                                لا توجد طلبات معلقة حالياً
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {pendingRequests.map((req, idx) => (
                                    <div
                                        key={req.id || idx}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            paddingBottom: idx !== pendingRequests.length - 1 ? '1rem' : '0',
                                            borderBottom: idx !== pendingRequests.length - 1 ? '1px solid #f1f5f9' : 'none'
                                        }}
                                    >
                                        <div>
                                            <h5 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#133315', margin: '0 0 0.25rem 0' }}>
                                                {req.name}
                                            </h5>
                                            <p style={{ fontSize: '0.82rem', color: '#718096', margin: 0 }}>
                                                {req.level || 'مستوى الحفظ'}
                                            </p>
                                        </div>

                                        <div style={{ display: 'flex', gap: '0.65rem' }}>
                                            <button
                                                onClick={() => handleRejectRequest(req.id, req.name)}
                                                style={{
                                                    background: '#fee2e2',
                                                    color: '#dc2626',
                                                    border: 'none',
                                                    padding: '0.45rem 1.4rem',
                                                    borderRadius: '8px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    fontFamily: 'inherit',
                                                    transition: 'opacity 0.2s'
                                                }}
                                            >
                                                رفض
                                            </button>
                                            <button
                                                onClick={() => handleAcceptRequest(req.id, req.name)}
                                                style={{
                                                    background: '#558b2f',
                                                    color: '#ffffff',
                                                    border: 'none',
                                                    padding: '0.45rem 1.4rem',
                                                    borderRadius: '8px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    fontFamily: 'inherit',
                                                    transition: 'opacity 0.2s'
                                                }}
                                            >
                                                موافقة
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Left Column: Teacher Attendance Alert Card */}
                <div style={{ paddingTop: '2.15rem' }}>
                    <div style={{
                        background: '#fffbf5',
                        border: '1.5px solid #fed7aa',
                        borderRadius: '16px',
                        padding: '1.5rem',
                        display: 'flex',
                        gap: '1.1rem',
                        alignItems: 'flex-start',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                    }}>
                        <div style={{
                            background: '#ffedd5',
                            color: '#ea580c',
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            <Warning size={26} weight="fill" />
                        </div>
                        <div>
                            <h5 style={{
                                fontSize: '1.02rem',
                                fontWeight: 800,
                                color: '#ea580c',
                                margin: '0 0 0.5rem 0'
                            }}>
                                تنبيه متابعة حضور المعلمين
                            </h5>
                            <p style={{
                                color: '#4a5568',
                                fontSize: '0.92rem',
                                lineHeight: 1.6,
                                margin: 0,
                                fontWeight: 500
                            }}>
                                {data?.teacher_attendance_alert?.message || "المعلم أحمد الراشد لم يسجل حضوراً منذ 5 أيام لمجموعته (حلقة عاصم بن أبي النجود)."}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TenantDashboard;
