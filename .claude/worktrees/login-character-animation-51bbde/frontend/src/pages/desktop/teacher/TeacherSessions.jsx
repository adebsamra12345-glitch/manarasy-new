import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bell, CaretDown, Users, CalendarBlank } from '@phosphor-icons/react';
import { getHalaqat, getSessions, startSession } from '../../../services/api/tenantService';
import { useAuthContext } from '../../../context/AuthContext';

const TeacherSessions = () => {
    const { ringId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuthContext();
    
    const today = new Date();
    const dateStr = today.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const [rings, setRings] = useState([]);
    const [selectedRingId, setSelectedRingId] = useState(ringId || '');
    const [sessions, setSessions] = useState([]);
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Fetch rings
    useEffect(() => {
        const fetchRings = async () => {
            try {
                const response = await getHalaqat();
                if (response.status === 'success') {
                    setRings(response.data || []);
                    if (!selectedRingId && response.data.length > 0) {
                        setSelectedRingId(response.data[0].id);
                        navigate(`/teacher/rings/${response.data[0].id}/sessions`, { replace: true });
                    }
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchRings();
    }, [user, navigate, selectedRingId]);

    // Fetch sessions when ring changes
    useEffect(() => {
        if (!selectedRingId) return;
        
        const fetchSessionsData = async () => {
            setLoading(true);
            try {
                const response = await getSessions(selectedRingId);
                if (response.status === 'success') {
                    setSessions(response.data || []);
                } else {
                    setError('فشل في جلب الجلسات');
                }
            } catch (err) {
                console.error(err);
                setError('حدث خطأ في الاتصال بالخادم');
            } finally {
                setLoading(false);
            }
        };
        
        fetchSessionsData();
    }, [selectedRingId]);

    const handleRingChange = (e) => {
        const newRingId = e.target.value;
        setSelectedRingId(newRingId);
        navigate(`/teacher/rings/${newRingId}/sessions`);
    };

    const handleNewSession = async () => {
        if (!selectedRingId) return;
        try {
            const response = await startSession({
                halaqa_id: selectedRingId,
                teacher_id: user.id
            });
            if (response.status === 'success') {
                const newSessionId = response.data.session_id;
                navigate(`/teacher/rings/${selectedRingId}/sessions/${newSessionId}?edit=true`);
            } else {
                alert('حدث خطأ أثناء بدء الجلسة');
            }
        } catch (err) {
            console.error(err);
            alert('حدث خطأ في الاتصال بالخادم');
        }
    };

    // Helper to format session date
    const formatSessionDate = (isoDate) => {
        const d = new Date(isoDate);
        return d.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    };

    return (
        <div className="dashboard-container" style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto', direction: 'rtl' }}>
            {/* Header */}
            <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                <div className="greeting" style={{ textAlign: 'right' }}>
                    <h1 style={{ fontSize: '1.8rem', color: '#133315', marginBottom: '0.5rem' }}>السلام عليكم، أ. {localStorage.getItem('username') || user?.username}</h1>
                    <p style={{ color: '#888', fontSize: '0.9rem' }}>{dateStr}</p>
                </div>
                <div className="header-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div className="select-halaqa" style={{ position: 'relative' }}>
                        <select 
                            value={selectedRingId} 
                            onChange={handleRingChange}
                            style={{
                                appearance: 'none',
                                border: '1px solid #eee',
                                padding: '0.5rem 2.5rem 0.5rem 1rem',
                                borderRadius: '8px',
                                background: '#fff',
                                color: '#133315',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                outline: 'none',
                                fontFamily: 'inherit'
                            }}
                        >
                            {rings.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                        <CaretDown size={16} color="#888" style={{ position: 'absolute', top: '50%', right: '0.5rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                        <Users size={16} color="#888" style={{ position: 'absolute', top: '50%', left: '0.5rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>
                    <div className="icon-btn" style={{ position: 'relative', background: '#fff', border: '1px solid #eee', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer' }}>
                        <Bell size={20} color="#133315" />
                        <span style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, backgroundColor: '#f57c00', borderRadius: '50%' }}></span>
                    </div>
                </div>
            </div>

            {/* Page Title & Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '2.5rem', color: '#1a3b1c', fontWeight: 'bold' }}>الجلسات</h2>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                        <input 
                            type="text" 
                            placeholder="اختر جلسة / تاريخ" 
                            style={{ 
                                padding: '0.5rem 1rem 0.5rem 2.5rem', 
                                border: '1px solid #ddd', 
                                borderRadius: '8px',
                                textAlign: 'right',
                                outline: 'none'
                            }} 
                        />
                        <CalendarBlank size={18} color="#81b255" style={{ position: 'absolute', top: '50%', left: '0.5rem', transform: 'translateY(-50%)' }} />
                    </div>
                    <button 
                        onClick={handleNewSession}
                        style={{ 
                            backgroundColor: '#558b2f', 
                            color: '#fff', 
                            border: 'none', 
                            padding: '0.6rem 1.5rem', 
                            borderRadius: '8px', 
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        جلسة جديدة
                    </button>
                </div>
            </div>
            
            {/* Horizontal Divider */}
            <div style={{ height: '1px', backgroundColor: '#888', opacity: 0.3, marginBottom: '2rem' }}></div>

            {/* Sessions List */}
            {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#558b2f' }}>جاري تحميل الجلسات...</div>
            ) : error ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#c62828' }}>{error}</div>
            ) : sessions.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>لا توجد جلسات لهذه الحلقة حالياً.</div>
            ) : (
                <div className="sessions-list" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {sessions.map(session => {
                        const attendancePercentage = session.total_count > 0 
                            ? Math.round((session.present_count / session.total_count) * 100) 
                            : 0;

                        return (
                            <div 
                                key={session.id} 
                                onClick={() => navigate(`/teacher/rings/${selectedRingId}/sessions/${session.id}`)}
                                style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between', 
                                    padding: '1.5rem 2rem', 
                                    border: '1px solid #558b2f', 
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

                                <div style={{ textAlign: 'right', paddingRight: '20px' }}>
                                    <h3 style={{ fontSize: '1.4rem', color: '#133315', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                                        {formatSessionDate(session.session_date)}
                                    </h3>
                                    <p style={{ color: '#888', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                                        الحضور : {session.present_count} / {session.total_count}
                                        <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#81b255', display: 'inline-block' }}></span>
                                    </p>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <div style={{
                                        width: '60px',
                                        height: '60px',
                                        borderRadius: '50%',
                                        border: '3px solid #81b255',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: '#f1f8e9',
                                        color: '#133315',
                                        fontWeight: 'bold',
                                        fontSize: '1.1rem'
                                    }}>
                                        {attendancePercentage}%
                                    </div>
                                </div>

                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default TeacherSessions;
