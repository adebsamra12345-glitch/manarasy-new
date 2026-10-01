import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Books, Users, CalendarCheck, Plus, CaretDown, PlayCircle, Star, ArrowLeft, CheckCircle, WarningCircle, X } from '@phosphor-icons/react';
import { getHalaqat, getAnalyticsSummary, startSession } from '../../../services/api/tenantService';
import { useAuthContext } from '../../../context/AuthContext';
import AlternativeDatePickerModal from '../../../components/AlternativeDatePickerModal';

/* ─── Toast component ───────────────────────────────────────────────────────── */
const Toast = ({ message, type, onClose }) => {
    useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
    const bg = type === 'success' ? '#2e7d32' : type === 'error' ? '#c62828' : '#e65100';
    const Icon = type === 'success' ? CheckCircle : WarningCircle;
    return (
        <div style={{
            position: 'fixed', bottom: '4.5rem', left: '50%', transform: 'translateX(-50%)',
            background: bg, color: '#fff', padding: '0.8rem 1.4rem', borderRadius: '12px',
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            boxShadow: '0 6px 20px rgba(0,0,0,0.25)', zIndex: 9999,
            animation: 'slideUp 0.3s ease', minWidth: '280px', maxWidth: '90%', direction: 'rtl'
        }}>
            <Icon size={20} weight="fill" />
            <span style={{ flex: 1, fontWeight: '500', fontSize: '0.85rem' }}>{message}</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}>
                <X size={16} />
            </button>
            <style>{`@keyframes slideUp{from{opacity:0;transform:translate(-50%,20px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
        </div>
    );
};

/**
 * MobileHalqaList — واجهة الحلقات والجلسات السريعة للمعلم على الموبايل
 * تعتمد بالكامل على نفس APIs تطبيق سطح المكتب
 */
const MobileHalqaList = ({ hideRings = false, hideStats = false }) => {
    const navigate = useNavigate();
    const { user } = useAuthContext();

    const today = new Date();
    const dateStr = today.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' });

    const [rings, setRings] = useState([]);
    const [selectedRingId, setSelectedRingId] = useState('all');
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [startingSessionId, setStartingSessionId] = useState(null);
    const [error, setError] = useState('');
    const [toast, setToast] = useState(null);

    const [showDatePickerModal, setShowDatePickerModal] = useState(false);
    const [conflictDate, setConflictDate] = useState('');
    const [conflictRingId, setConflictRingId] = useState(null);

    useEffect(() => {
        const fetchMobileData = async () => {
            setLoading(true);
            try {
                const ringsRes = await getHalaqat();
                if (ringsRes.status === 'success') {
                    setRings(ringsRes.data || []);
                } else {
                    setError('فشل في تحميل الحلقات');
                }

                const analyticsRes = await getAnalyticsSummary(selectedRingId === 'all' ? null : selectedRingId);
                if (analyticsRes.status === 'success') {
                    setAnalytics(analyticsRes.data);
                }
            } catch (err) {
                console.error(err);
                setError('خطأ في الاتصال بالشبكة');
            } finally {
                setLoading(false);
            }
        };

        fetchMobileData();
    }, [user, selectedRingId]);

    const executeStartSession = async (ringId, sessionDate = null) => {
        const todayISO = new Date().toISOString().slice(0, 10);
        if (sessionDate && sessionDate > todayISO) {
            setToast({ message: 'لا يمكن إنشاء جلسة بتاريخ مستقبلي.', type: 'error' });
            return;
        }

        setStartingSessionId(ringId);
        try {
            const payload = {
                halaqa_id: ringId,
                teacher_id: user.id
            };
            if (sessionDate) {
                payload.session_date = sessionDate;
            }
            const res = await startSession(payload);
            if (res.status === 'success' && res.data?.session_id) {
                setShowDatePickerModal(false);
                setConflictRingId(null);
                navigate(`/teacher/rings/${ringId}/sessions/${res.data.session_id}?edit=true`);
            } else {
                setToast({ message: 'فشل في إنشاء الجلسة الجديدة', type: 'error' });
            }
        } catch (err) {
            console.error(err);
            if (err.response?.status === 409 || err.response?.data?.error_code === 'SESSION_DATE_CONFLICT') {
                const confDate = err.response?.data?.conflicting_date || (sessionDate || todayISO);
                setConflictDate(confDate);
                setConflictRingId(ringId);
                setShowDatePickerModal(true);
            } else {
                setToast({ message: err.response?.data?.message || 'حدث خطأ في الاتصال بالخادم', type: 'error' });
            }
        } finally {
            setStartingSessionId(null);
        }
    };

    const handleStartNewSession = (ringId) => {
        executeStartSession(ringId, null);
    };

    const handleSelectAlternativeDate = (chosenDate) => {
        if (conflictRingId) {
            executeStartSession(conflictRingId, chosenDate);
        }
    };

    const filteredRings = selectedRingId === 'all' ? rings : rings.filter(r => r.id === selectedRingId);
    const totalStudents = filteredRings.reduce((acc, r) => acc + (r.students_count || 0), 0);

    return (
        <div style={{ padding: '1rem', paddingBottom: '5rem', direction: 'rtl', fontFamily: 'inherit' }}>
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
                            أ. {localStorage.getItem('username') || user?.username || 'المعلم'}
                        </h2>
                        <p style={{ fontSize: '0.8rem', color: '#a5d6a7', margin: 0 }}>{dateStr}</p>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.15)', padding: '0.5rem 0.8rem', borderRadius: '12px', fontSize: '0.8rem', color: '#fff', fontWeight: 'bold' }}>
                        {rings.length} حلقات
                    </div>
                </div>

                {/* Ring Filter */}
                <div style={{ position: 'relative', marginTop: '0.75rem' }}>
                    <select
                        value={selectedRingId}
                        onChange={(e) => setSelectedRingId(e.target.value)}
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
                        <option value="all">جميع الحلقات</option>
                        {rings.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
                    <CaretDown size={18} color="#133315" style={{ position: 'absolute', top: '50%', right: '0.75rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
            </div>

            {/* Quick Stats Grid */}
            {!hideStats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ background: '#fff', padding: '0.85rem 0.5rem', borderRadius: '12px', border: '1px solid #eee', textAlign: 'center' }}>
                    <Users size={22} color="#558b2f" style={{ marginBottom: '0.3rem' }} />
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#133315' }}>{totalStudents}</div>
                    <div style={{ fontSize: '0.72rem', color: '#777' }}>الطلاب</div>
                </div>
                <div style={{ background: '#fff', padding: '0.85rem 0.5rem', borderRadius: '12px', border: '1px solid #eee', textAlign: 'center' }}>
                    <Books size={22} color="#f57c00" style={{ marginBottom: '0.3rem' }} />
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#133315' }}>
                        {rings.length}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#777' }}>الحلقات</div>
                </div>
                <div style={{ background: '#fff', padding: '0.85rem 0.5rem', borderRadius: '12px', border: '1px solid #eee', textAlign: 'center' }}>
                    <Star size={22} color="#0288d1" style={{ marginBottom: '0.3rem' }} />
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#133315' }}>
                        {analytics ? analytics.absent_today : 0}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#777' }}>يحتاجون متابعة</div>
                </div>
            </div>
            )}

            {/* Section Header */}
            {!hideRings && (
            <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#133315', fontWeight: 'bold' }}>الحلقات القرآنية</h3>
                <span style={{ fontSize: '0.8rem', color: '#888' }}>{filteredRings.length} حلقة</span>
            </div>

            {/* Loading / Error State */}
            {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#558b2f', fontWeight: 'bold' }}>
                    جاري تحميل البيانات...
                </div>
            ) : error ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#d32f2f', background: '#ffebee', borderRadius: '12px' }}>
                    {error}
                </div>
            ) : filteredRings.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#888', background: '#fff', borderRadius: '12px', border: '1px dashed #ccc' }}>
                    لا توجد حلقات حالياً.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {filteredRings.map(ring => (
                        <div key={ring.id} style={{
                            background: '#fff',
                            borderRadius: '16px',
                            padding: '1.1rem',
                            border: '1px solid #e0e0e0',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            {/* Decorative bar */}
                            <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '5px', backgroundColor: '#558b2f' }}></div>

                            <div style={{ paddingRight: '0.5rem', marginBottom: '0.8rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <h4 style={{ margin: '0 0 0.3rem 0', fontSize: '1.15rem', color: '#133315', fontWeight: 'bold' }}>{ring.name}</h4>
                                    <span style={{
                                        fontSize: '0.72rem',
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: '12px',
                                        backgroundColor: ring.is_active ? '#e8f5e9' : '#f5f5f5',
                                        color: ring.is_active ? '#2e7d32' : '#757575',
                                        fontWeight: 'bold'
                                    }}>
                                        {ring.is_active ? 'نشطة' : 'غير نشطة'}
                                    </span>
                                </div>
                                <p style={{ margin: 0, fontSize: '0.82rem', color: '#666' }}>
                                    {ring.project_title || ring.center_name || 'بدون مشروع'} • {ring.students_count || 0} طالب
                                </p>
                            </div>

                            {/* Action Buttons */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                                <button
                                    onClick={() => navigate(`/teacher/rings/${ring.id}/sessions`)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.4rem',
                                        padding: '0.6rem',
                                        borderRadius: '10px',
                                        border: '1px solid #558b2f',
                                        background: '#f1f8e9',
                                        color: '#33691e',
                                        fontWeight: 'bold',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Books size={16} />
                                    عرض الجلسات
                                </button>
                                <button
                                    onClick={() => handleStartNewSession(ring.id)}
                                    disabled={startingSessionId === ring.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.4rem',
                                        padding: '0.6rem',
                                        borderRadius: '10px',
                                        border: 'none',
                                        background: '#f57c00',
                                        color: '#fff',
                                        fontWeight: 'bold',
                                        fontSize: '0.85rem',
                                        cursor: startingSessionId === ring.id ? 'wait' : 'pointer',
                                        opacity: startingSessionId === ring.id ? 0.7 : 1
                                    }}
                                >
                                    <PlayCircle size={18} />
                                    {startingSessionId === ring.id ? 'جاري البث...' : 'جلسة جديدة'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            </>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Modal Dialog for selecting an alternative date */}
            <AlternativeDatePickerModal
                isOpen={showDatePickerModal}
                onClose={() => {
                    setShowDatePickerModal(false);
                    setConflictRingId(null);
                }}
                onSelectDate={handleSelectAlternativeDate}
                halaqaId={conflictRingId}
                conflictingDate={conflictDate}
                title="تاريخ بديل للجلسة الجديدة"
                message="توجد جلسة مسجلة مسبقاً لهذه الحلقة في التاريخ المحدد."
            />
        </div>
    );
};

export default MobileHalqaList;
