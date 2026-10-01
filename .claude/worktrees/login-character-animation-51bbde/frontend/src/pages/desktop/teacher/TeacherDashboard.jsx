import React, { useState, useEffect } from 'react';
import { Bell, CaretDown, Users, CalendarCheck, Star, Medal } from '@phosphor-icons/react';
import { getHalaqat, getAnalyticsSummary } from '../../../services/api/tenantService';
import { useAuthContext } from '../../../context/AuthContext';

const TeacherDashboard = () => {
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

    // حساب عدد الطلاب (إذا كان الفلتر 'all' نجمع كل الطلاب، وإلا نأخذ طلاب الحلقة المحددة)
    const filteredRings = selectedRingId === 'all' ? rings : rings.filter(r => r.id === selectedRingId);
    const totalStudents = filteredRings.reduce((acc, ring) => acc + ring.studentsCount, 0);

    // استخدام البيانات الحقيقية من الـ API للإحصائيات
    const attendanceToday = analytics ? analytics.total_attendance_records : 0;
    const attendancePercentageText = analytics ? analytics.attendance_rate : "0%";
    const totalRecitations = analytics ? analytics.total_recitation_sessions : 0;
    const awardedPoints = totalRecitations * 5; // حساب تقريبي لحين توفر حقل النقاط في الخادم



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
                    <p style={{ color: '#81b255', fontSize: '0.8rem' }}>2 طلاب حضر هذا الأسبوع</p>
                </div>

                {/* Stat 2: Today's Attendance */}
                <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1rem' }}>
                        <div style={{ background: '#f1f8e9', padding: '0.5rem', borderRadius: '8px' }}>
                            <CalendarCheck size={24} color="#558b2f" />
                        </div>
                    </div>
                    <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '0.5rem' }}>حضور اليوم</p>
                    <h2 style={{ fontSize: '2rem', color: '#133315', marginBottom: '1rem' }}>{attendanceToday} / {totalStudents}</h2>
                    <p style={{ color: '#81b255', fontSize: '0.8rem' }}>نسبة الحضور {attendancePercentageText}</p>
                </div>

                {/* Stat 3: Daily Evaluation Average (Mapped to Recitation Sessions for now) */}
                <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1rem' }}>
                        <div style={{ background: '#f1f8e9', padding: '0.5rem', borderRadius: '8px' }}>
                            <Star size={24} color="#558b2f" />
                        </div>
                    </div>
                    <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '0.5rem' }}>جلسات التسميع والتقييم</p>
                    <h2 style={{ fontSize: '2rem', color: '#133315', marginBottom: '1rem' }}>{totalRecitations} جلسة</h2>
                    <p style={{ color: '#81b255', fontSize: '0.8rem' }}>ممتاز جداً</p>
                </div>

                {/* Stat 4: Awarded Points */}
                <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1rem' }}>
                        <div style={{ background: '#fff3e0', padding: '0.5rem', borderRadius: '8px' }}>
                            <Medal size={24} color="#f57c00" />
                        </div>
                    </div>
                    <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '0.5rem' }}>النقاط الممنوحة هذا الشهر</p>
                    <h2 style={{ fontSize: '2rem', color: '#133315', marginBottom: '1rem' }}>{awardedPoints} نقطة</h2>
                    <p style={{ color: '#f57c00', fontSize: '0.8rem' }}>تحفيز مستمر</p>
                </div>
            </div>

            {/* Hidden Students Section */}
            {/* 
            <div className="page-header-flex" style={{ marginTop: '2rem', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
                <h2 className="students-page-title" style={{ fontSize: '1.8rem', color: '#133315' }}>الطلاب المتميزون (المتصدرون)</h2>
            </div>
            ... List goes here ...
            */}

            {/* Title & Search */}
            {/* 
            <div className="page-header-flex" style={{ marginTop: '2rem', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
                <h2 className="students-page-title" style={{ fontSize: '1.8rem', color: '#133315' }}>الحلقات القرآنية</h2>
                <div className="search-bar" style={{ width: '300px' }}>
                    <MagnifyingGlass size={18} className="search-icon" />
                    <input type="text" placeholder="ابحث عن حلقة ..." className="search-input" />
                </div>
            </div>

            // Rings List
            {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#558b2f' }}>جاري تحميل الحلقات...</div>
            ) : error ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#c62828' }}>{error}</div>
            ) : rings.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>لا توجد حلقات حالياً.</div>
            ) : (
                <div className="rings-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {rings.map(ring => (
                        <div key={ring.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem', border: '1px solid #eee', borderRadius: '12px', background: '#fff' }}>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                                <div style={{ textAlign: 'right' }}>
                                    <h3 style={{ fontSize: '1.5rem', color: '#133315', marginBottom: '0.5rem' }}>{ring.name}</h3>
                                    <p style={{ color: '#888', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {ring.project_title || ring.center_name || 'بدون مشروع'}
                                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: ring.is_active ? '#81b255' : '#ccc', display: 'inline-block' }}></span>
                                    </p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                                <span style={{ fontSize: '1.2rem', color: '#133315' }}>{ring.studentsCount} طالب كحد أقصى</span>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <button className="btn-primary" style={{ backgroundColor: '#558b2f' }}>تعديل</button>
                                    <button className="btn-primary" style={{ backgroundColor: '#f57c00' }}>طلاب الحلقة</button>
                                </div>
                            </div>

                        </div>
                    ))}
                </div>
            )}
            */}


        </div>
    );
};

export default TeacherDashboard;

