import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Users, Books, Clock, User, CheckCircle, WarningCircle, CaretDown, MapPin
} from '@phosphor-icons/react';
import { getMosqueAdminDashboardData } from '../../../services/api/tenantService';

const MobileTenantDashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const basePath = location.pathname.startsWith('/center-manager') ? '/center-manager' : '/admin';
    const currentUserName = localStorage.getItem('username') || 'مدير النظام';

    const todayDate = new Date();
    const hijriDate = new Intl.DateTimeFormat('ar-SA', {
        calendar: 'islamic', day: 'numeric', month: 'long', year: 'numeric'
    }).format(todayDate);
    const dateStr = `${hijriDate}`;

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedCenterId, setSelectedCenterId] = useState('all');
    const [centersList, setCentersList] = useState([{ id: 'all', name: 'جميع المراكز' }]);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await getMosqueAdminDashboardData(selectedCenterId);
                if (res && res.data) {
                    setData(res.data);
                    if (res.data.centers && res.data.centers.length > 0) {
                        setCentersList([{ id: 'all', name: 'جميع المراكز' }, ...res.data.centers]);
                    }
                }
            } catch (err) {
                console.error(err);
                setError('حدث خطأ في الاتصال بالخادم');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedCenterId]);

    const totalActiveStudents = data?.total_active_students || 0;
    const totalTeachers = data?.total_teachers || 0;
    const totalRings = data?.total_rings || 0;
    const currentMonthSessions = data?.current_month_sessions || 0;

    return (
        <div style={{ padding: '1rem', paddingBottom: '5.5rem', direction: 'rtl', fontFamily: 'inherit' }}>
            {/* Header Greeting */}
            <div style={{
                background: 'linear-gradient(135deg, #133315 0%, #1e4d20 100%)',
                color: '#fff',
                borderRadius: '16px',
                padding: '1.25rem',
                marginBottom: '1.25rem',
                boxShadow: '0 4px 12px rgba(19, 51, 21, 0.15)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                        <span style={{ fontSize: '0.8rem', color: '#c8e6c9', fontWeight: 500 }}>أهلاً وسهلاً</span>
                        <h2 style={{ fontSize: '1.3rem', margin: '0.2rem 0', fontWeight: 'bold' }}>
                            أ. {currentUserName}
                        </h2>
                        <p style={{ fontSize: '0.8rem', color: '#a5d6a7', margin: 0 }}>{dateStr}</p>
                    </div>
                </div>

                {/* Center Filter */}
                <div style={{ position: 'relative', marginTop: '0.75rem' }}>
                    <select
                        value={selectedCenterId}
                        onChange={(e) => setSelectedCenterId(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.6rem 2.2rem 0.6rem 1rem',
                            borderRadius: '10px',
                            border: 'none',
                            background: 'rgba(255,255,255,0.95)',
                            color: '#133315',
                            fontWeight: 'bold',
                            fontSize: '0.9rem',
                            outline: 'none',
                            appearance: 'none'
                        }}
                    >
                        {centersList.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    <CaretDown size={18} color="#133315" style={{ position: 'absolute', top: '50%', right: '0.75rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div 
                    onClick={() => navigate(`${basePath}/students`)}
                    style={{ background: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid #eee', textAlign: 'center', cursor: 'pointer' }}
                >
                    <Users size={24} color="#558b2f" style={{ marginBottom: '0.5rem' }} />
                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#133315' }}>{totalActiveStudents}</div>
                    <div style={{ fontSize: '0.8rem', color: '#777' }}>الطلاب</div>
                </div>
                <div 
                    onClick={() => navigate(`${basePath}/rings`)}
                    style={{ background: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid #eee', textAlign: 'center', cursor: 'pointer' }}
                >
                    <Books size={24} color="#f57c00" style={{ marginBottom: '0.5rem' }} />
                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#133315' }}>{totalRings}</div>
                    <div style={{ fontSize: '0.8rem', color: '#777' }}>الحلقات</div>
                </div>
                <div 
                    onClick={() => navigate(`${basePath}/teachers`)}
                    style={{ background: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid #eee', textAlign: 'center', cursor: 'pointer' }}
                >
                    <User size={24} color="#0288d1" style={{ marginBottom: '0.5rem' }} />
                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#133315' }}>{totalTeachers}</div>
                    <div style={{ fontSize: '0.8rem', color: '#777' }}>المعلمون</div>
                </div>
                <div 
                    onClick={() => navigate(`${basePath}/sessions`)}
                    style={{ background: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid #eee', textAlign: 'center', cursor: 'pointer' }}
                >
                    <Clock size={24} color="#9c27b0" style={{ marginBottom: '0.5rem' }} />
                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#133315' }}>{currentMonthSessions}</div>
                    <div style={{ fontSize: '0.8rem', color: '#777' }}>جلسات الشهر</div>
                </div>
            </div>

            {/* Recent Activity or Placeholder */}
            <div style={{ background: '#fff', borderRadius: '16px', padding: '1.25rem', border: '1px solid #eee' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#133315', fontWeight: 'bold', margin: '0 0 1rem 0' }}>نظرة عامة</h3>
                {loading ? (
                    <div style={{ textAlign: 'center', color: '#888', padding: '1rem' }}>جاري التحميل...</div>
                ) : error ? (
                    <div style={{ textAlign: 'center', color: '#c62828', padding: '1rem' }}>{error}</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f5f5f5', paddingBottom: '0.5rem' }}>
                            <span style={{ color: '#555', fontSize: '0.9rem' }}>نسبة الذكور</span>
                            <span style={{ fontWeight: 'bold', color: '#133315' }}>{data?.gender_distribution?.male_percentage || 0}%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f5f5f5', paddingBottom: '0.5rem' }}>
                            <span style={{ color: '#555', fontSize: '0.9rem' }}>نسبة الإناث</span>
                            <span style={{ fontWeight: 'bold', color: '#133315' }}>{data?.gender_distribution?.female_percentage || 0}%</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MobileTenantDashboard;
