import React, { useState, useEffect } from 'react';
import { Bell, Users, Books, WarningCircle, CaretDown } from '@phosphor-icons/react';
import { getHalaqat, getAnalyticsSummary } from '../services/api/tenantService';
import { useAuthContext } from '../context/AuthContext';

const TeacherDashboard = () => {
    const today = new Date();
    const dateStr = today.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const { user } = useAuthContext();
    const [rings, setRings] = useState([]);
    const [selectedRingId, setSelectedRingId] = useState('all');
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const ringsResponse = await getHalaqat();
                if (ringsResponse.status === 'success') {
                    setRings((ringsResponse.data || []).map(r => ({
                        ...r,
                        studentsCount: r.students_count || 0
                    })));
                }

                const analyticsResponse = await getAnalyticsSummary(selectedRingId);
                if (analyticsResponse.status === 'success') {
                    setAnalytics(analyticsResponse.data);
                }
            } catch (err) {
                console.error('[TeacherDashboard Mobile]', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user, selectedRingId]);

    const filteredRings = selectedRingId === 'all' ? rings : rings.filter(r => r.id === selectedRingId);
    const totalStudents = filteredRings.reduce((acc, r) => acc + r.studentsCount, 0);

    const presentToday           = analytics ? analytics.present_today    : 0;
    const absentToday            = analytics ? analytics.absent_today     : 0;
    const totalToday             = (analytics && typeof analytics.total_today === 'number') ? analytics.total_today : totalStudents;
    const attendancePercentageText = analytics?.attendance_rate
        ? analytics.attendance_rate
        : (totalToday > 0 ? `${((presentToday / totalToday) * 100).toFixed(2).replace(/\.00$/, '')}%` : '0%');

    return (
        <div className="dashboard-container">
            {/* Header */}
            <div className="dashboard-header">
                <div className="greeting">
                    <h1>السلام عليكم، أ. {localStorage.getItem('username') || 'المعلم'}</h1>
                    <p>{dateStr}</p>
                </div>
                <div className="header-actions">
                    <div style={{ position: 'relative' }}>
                        <select
                            value={selectedRingId}
                            onChange={(e) => setSelectedRingId(e.target.value)}
                            style={{
                                appearance: 'none',
                                border: '1px solid #eee',
                                padding: '0.45rem 1.8rem 0.45rem 0.8rem',
                                borderRadius: '8px',
                                background: '#fff',
                                color: '#133315',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                outline: 'none',
                                fontFamily: 'inherit',
                                fontSize: '0.85rem'
                            }}
                        >
                            <option value="all">جميع الحلقات</option>
                            {rings.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                        <CaretDown size={14} color="#888" style={{ position: 'absolute', top: '50%', right: '0.4rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>
                    <div className="icon-btn" style={{ position: 'relative' }}>
                        <Bell size={20} />
                        <span style={{ position: 'absolute', top: 3, right: 3, width: 7, height: 7, backgroundColor: '#f57c00', borderRadius: '50%' }}></span>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>

                {/* Stat 1: Total Students */}
                <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '1.2rem' }}>
                    <div style={{ background: '#f1f8e9', padding: '0.45rem', borderRadius: '8px', display: 'inline-flex', marginBottom: '0.75rem' }}>
                        <Users size={20} color="#558b2f" />
                    </div>
                    <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '0.3rem' }}>إجمالي الطلاب</p>
                    <h2 style={{ fontSize: '1.6rem', color: '#133315', marginBottom: '0.4rem' }}>{totalStudents}</h2>
                    <p style={{ color: '#81b255', fontSize: '0.75rem' }}>{filteredRings.length} حلقة</p>
                </div>

                {/* Stat 2: Number of Rings */}
                <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '1.2rem' }}>
                    <div style={{ background: '#f1f8e9', padding: '0.45rem', borderRadius: '8px', display: 'inline-flex', marginBottom: '0.75rem' }}>
                        <Books size={20} color="#558b2f" />
                    </div>
                    <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '0.3rem' }}>عدد الحلقات</p>
                    <h2 style={{ fontSize: '1.6rem', color: '#133315', marginBottom: '0.4rem' }}>
                        {rings.length} {rings.length === 1 ? 'حلقة' : rings.length === 2 ? 'حلقتان' : rings.length >= 3 && rings.length <= 10 ? 'حلقات' : 'حلقة'}
                    </h2>
                    <p style={{ color: '#81b255', fontSize: '0.75rem' }}>
                        {selectedRingId === 'all' ? 'حلقات قرآنية مسندة' : `الحلقة: ${filteredRings[0]?.name || ''}`}
                    </p>
                </div>

                {/* Stat 3: Absent Today (new KPI) */}
                <div style={{ background: '#fff', border: absentToday > 0 ? '1px solid #fff3e0' : '1px solid #eee', borderRadius: '12px', padding: '1.2rem' }}>
                    <div style={{ background: absentToday > 0 ? '#fff3e0' : '#f1f8e9', padding: '0.45rem', borderRadius: '8px', display: 'inline-flex', marginBottom: '0.75rem' }}>
                        <WarningCircle size={20} color={absentToday > 0 ? '#f57c00' : '#558b2f'} />
                    </div>
                    <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '0.3rem' }}>غائبو اليوم</p>
                    <h2 style={{ fontSize: '1.6rem', color: absentToday > 0 ? '#f57c00' : '#133315', marginBottom: '0.4rem' }}>
                        {absentToday}
                    </h2>
                    <p style={{ color: absentToday > 0 ? '#e65100' : '#81b255', fontSize: '0.75rem' }}>
                        {absentToday === 0 ? 'لا غيابات 🎉' : 'يحتاجون متابعة'}
                    </p>
                </div>

            </div>

            {/* Rings List */}
            <div style={{ marginTop: '2rem' }}>
                <h2 style={{ fontSize: '1.4rem', color: '#133315', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.75rem' }}>
                    الحلقات القرآنية
                </h2>
                {loading ? (
                    <div style={{ textAlign: 'center', color: '#558b2f', padding: '2rem' }}>جاري التحميل...</div>
                ) : rings.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>لا توجد حلقات حالياً.</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {filteredRings.map(ring => (
                            <div key={ring.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.2rem', border: '1px solid #eee', borderRadius: '12px', background: '#fff' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', color: '#133315', marginBottom: '0.25rem' }}>{ring.name}</h3>
                                    <p style={{ color: '#888', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        {ring.project_title || ring.center_name || 'بدون مشروع'}
                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: ring.is_active ? '#81b255' : '#ccc', display: 'inline-block' }}></span>
                                    </p>
                                </div>
                                <span style={{ fontSize: '1rem', color: '#558b2f', fontWeight: 'bold' }}>{ring.studentsCount} طالب</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
};

export default TeacherDashboard;
