import React, { useState, useEffect } from 'react';
import { Bell } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { getHalaqat } from '../../../services/api/tenantService';
import { useAuthContext } from '../../../context/AuthContext';

const TeacherRings = () => {
    const navigate = useNavigate();
    const today = new Date();
    const dateStr = today.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const { user } = useAuthContext();
    const [rings, setRings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchRings = async () => {
            try {
                const response = await getHalaqat();
                if (response.status === 'success') {
                    const fetchedRings = response.data || [];
                    const ringsWithStudents = fetchedRings.map(r => ({
                        ...r,
                        studentsCount: r.students_count || 0
                    }));
                    setRings(ringsWithStudents);
                } else {
                    setError('فشل في جلب الحلقات');
                }
            } catch (err) {
                console.error(err);
                setError('حدث خطأ في الاتصال بالخادم');
            } finally {
                setLoading(false);
            }
        };
        fetchRings();
    }, [user]);

    return (
        <div className="dashboard-container" style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto', direction: 'rtl' }}>
            {/* Header */}
            <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                <div className="greeting" style={{ textAlign: 'right' }}>
                    <h1 style={{ fontSize: '1.8rem', color: '#133315', marginBottom: '0.5rem' }}>السلام عليكم، أ. {localStorage.getItem('username') || user?.username}</h1>
                    <p style={{ color: '#888', fontSize: '0.9rem' }}>{dateStr}</p>
                </div>
                <div className="header-actions">
                    <div className="icon-btn" style={{ position: 'relative', background: '#fff', border: '1px solid #eee', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer' }}>
                        <Bell size={20} color="#133315" />
                        <span style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, backgroundColor: '#f57c00', borderRadius: '50%' }}></span>
                    </div>
                </div>
            </div>

            {/* Page Title */}
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                <h2 style={{ fontSize: '2.5rem', color: '#1a3b1c', fontWeight: 'bold' }}>الحلقات القرآنية</h2>
            </div>
            
            {/* Horizontal Divider */}
            <div style={{ height: '1px', backgroundColor: '#888', opacity: 0.3, marginBottom: '2rem' }}></div>

            {/* Rings List */}
            {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#558b2f' }}>جاري تحميل الحلقات...</div>
            ) : error ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#c62828' }}>{error}</div>
            ) : rings.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>لا توجد حلقات حالياً.</div>
            ) : (
                <div className="rings-list" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {rings.map(ring => (
                        <div 
                            key={ring.id} 
                            onClick={() => navigate(`/teacher/rings/${ring.id}/sessions`)}
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between', 
                                padding: '1.5rem 2rem', 
                                border: '1px solid #ddd', 
                                borderRadius: '16px', 
                                background: '#fff',
                                position: 'relative',
                                boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.05)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.02)';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            {/* Orange side bar accent */}
                            <div style={{
                                position: 'absolute',
                                right: '12px',
                                top: '15%',
                                bottom: '15%',
                                width: '6px',
                                borderRadius: '10px',
                                backgroundColor: '#f57c00'
                            }}></div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', paddingRight: '20px' }}>
                                <div style={{ textAlign: 'right' }}>
                                    <h3 style={{ fontSize: '1.8rem', color: '#133315', marginBottom: '0.2rem', fontWeight: 'bold' }}>{ring.name}</h3>
                                    <p style={{ color: '#888', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                                        {ring.project_title || ring.center_name || 'بدون مشروع'}
                                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: ring.is_active ? '#81b255' : '#ccc', display: 'inline-block' }}></span>
                                    </p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ fontSize: '1.1rem', color: '#333' }}>{ring.studentsCount} طالب</span>
                            </div>

                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TeacherRings;
