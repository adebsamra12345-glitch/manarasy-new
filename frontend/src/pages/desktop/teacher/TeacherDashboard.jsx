import React, { useState, useEffect } from 'react';
import { Bell, CaretDown, Users, Books, WarningCircle } from '@phosphor-icons/react';
import { getHalaqat, getAnalyticsSummary } from '../../../services/api/tenantService';
import { useAuthContext } from '../../../context/AuthContext';
import useDeviceType from '../../../hooks/useDeviceType';
import MobileHalqaList from '../../mobile/teacher/MobileHalqaList';

const DesktopTeacherDashboard = () => {
    const today = new Date();
    const dateStr = today.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const { user } = useAuthContext();
    const [rings, setRings] = useState([]);
    const [selectedRingId, setSelectedRingId] = useState('all');
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                // جلب الحلقات
                const ringsResponse = await getHalaqat();
                if (ringsResponse.status === 'success') {
                    const fetchedRings = ringsResponse.data || [];
                    const ringsWithStudents = fetchedRings.map(r => ({
                        ...r,
                        studentsCount: r.students_count || 0
                    }));
                    setRings(ringsWithStudents);
                } else {
                    setError('فشل في جلب الحلقات');
                }

                // جلب الإحصائيات
                const analyticsResponse = await getAnalyticsSummary(selectedRingId);
                if (analyticsResponse.status === 'success') {
                    setAnalytics(analyticsResponse.data);
                }

            } catch (err) {
                console.error(err);
                setError('حدث خطأ في الاتصال بالخادم');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user, selectedRingId]);

    // حساب عدد الطلاب الفعليين المسجلين
    const filteredRings = selectedRingId === 'all' ? rings : rings.filter(r => r.id === selectedRingId);
    const totalStudents = filteredRings.reduce((acc, ring) => acc + ring.studentsCount, 0);

    // ---- بيانات حقيقية من الـ API ----
    // present_today: عدد الحاضرين اليوم فعلاً (مفلتر حسب session_date=today)
    const presentToday           = analytics ? analytics.present_today        : 0;
    // absent_today: عدد الغائبين اليوم
    const absentToday            = analytics ? analytics.absent_today         : 0;
    // total_today: إجمالي الطلاب المسجلين فعلياً (تجاهل السعة القصوى تماماً)
    const totalToday             = (analytics && typeof analytics.total_today === 'number') ? analytics.total_today : totalStudents;
    // نسبة الحضور الفعلية: عدد الحاضرين / إجمالي الطلاب المسجلين فعلياً
    const attendancePercentageText = analytics?.attendance_rate
        ? analytics.attendance_rate
        : (totalToday > 0 ? `${((presentToday / totalToday) * 100).toFixed(2).replace(/\.00$/, '')}%` : '0%');

    return (
        <div className="dashboard-container">
            {/* Header */}
            <div className="dashboard-header">
                <div className="greeting">
                    <h1>السلام عليكم، أ. {localStorage.getItem('username')}</h1>
                    <p>{dateStr}</p>
                </div>
                <div className="header-actions">
                    <div className="select-halaqa" style={{ position: 'relative' }}>
                        <select
                            value={selectedRingId}
                            onChange={(e) => setSelectedRingId(e.target.value)}
                            style={{
                                appearance: 'none',
                                border: '1px solid #eee',
                                padding: '0.5rem 2rem 0.5rem 1rem',
                                borderRadius: '8px',
                                background: '#fff',
                                color: '#133315',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                outline: 'none',
                                fontFamily: 'inherit'
                            }}
                        >
                            <option value="all">الكل (جميع الحلقات)</option>
                            {rings.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                        <CaretDown size={16} color="#888" style={{ position: 'absolute', top: '50%', right: '0.5rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                        <Users size={16} color="#888" style={{ position: 'absolute', top: '50%', left: '0.5rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>
                    <div className="icon-btn" style={{ position: 'relative' }}>
                        <Bell size={20} />
                        <span style={{ position: 'absolute', top: 5, right: 5, width: 8, height: 8, backgroundColor: '#f57c00', borderRadius: '50%' }}></span>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>

                {/* Stat 1: Total Students */}
                <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1rem' }}>
                        <div style={{ background: '#f1f8e9', padding: '0.5rem', borderRadius: '8px' }}>
                            <Users size={24} color="#558b2f" />
                        </div>
                    </div>
                    <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '0.5rem' }}>إجمالي الطلاب</p>
                    <h2 style={{ fontSize: '2rem', color: '#133315', marginBottom: '1rem' }}>{totalStudents} طالباً</h2>
                    <p style={{ color: '#81b255', fontSize: '0.8rem' }}>موزعون على {filteredRings.length} حلقة</p>
                </div>

                {/* Stat 2: Number of Halaqat taught by the teacher */}
                <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1rem' }}>
                        <div style={{ background: '#f1f8e9', padding: '0.5rem', borderRadius: '8px' }}>
                            <Books size={24} color="#558b2f" />
                        </div>
                    </div>
                    <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '0.5rem' }}>عدد الحلقات</p>
                    <h2 style={{ fontSize: '2rem', color: '#133315', marginBottom: '1rem' }}>
                        {rings.length} {rings.length === 1 ? 'حلقة' : rings.length === 2 ? 'حلقتان' : rings.length >= 3 && rings.length <= 10 ? 'حلقات' : 'حلقة'}
                    </h2>
                    <p style={{ color: '#81b255', fontSize: '0.8rem' }}>
                        {selectedRingId === 'all' ? 'حلقات قرآنية نشطة مسندة' : `الحلقة المحددة: ${filteredRings[0]?.name || ''}`}
                    </p>
                </div>

                {/* Stat 3: Absent Students Today — KPI جديد بدلاً من جلسات التسميع */}
                <div style={{ background: '#fff', border: absentToday > 0 ? '1px solid #fff3e0' : '1px solid #eee', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1rem' }}>
                        <div style={{ background: absentToday > 0 ? '#fff3e0' : '#f1f8e9', padding: '0.5rem', borderRadius: '8px' }}>
                            <WarningCircle size={24} color={absentToday > 0 ? '#f57c00' : '#558b2f'} />
                        </div>
                    </div>
                    <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '0.5rem' }}>طلاب يحتاجون متابعة</p>
                    <h2 style={{ fontSize: '2rem', color: absentToday > 0 ? '#f57c00' : '#133315', marginBottom: '1rem' }}>
                        {absentToday} طالب
                    </h2>
                    <p style={{ color: absentToday > 0 ? '#e65100' : '#81b255', fontSize: '0.8rem' }}>
                        {absentToday === 0 ? 'لا غيابات اليوم 🎉' : 'يحتاجون متابعة'}
                    </p>
                </div>

            </div>
        </div>
    );
};

const TeacherDashboard = () => {
    const { isMobile } = useDeviceType();

    if (isMobile) {
        return <MobileHalqaList hideRings={true} />;
    }

    return <DesktopTeacherDashboard />;
};

export default TeacherDashboard;
