import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, Clock, User, Check, X, DotsThreeVertical, WarningCircle, UserCircle, Star, PencilSimple } from '@phosphor-icons/react';
import { getTeacherSessionDetail, updateSessionDetails } from '../../../services/api/tenantService';
import { useAuthContext } from '../../../context/AuthContext';
import { BEHAVIOR_OPTIONS } from '../../desktop/tenantAdmin/AdminSessionDetail';

const MobileAdminSessionDetail = () => {
    const { ringId, sessionId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuthContext();
    const basePath = location.pathname.startsWith('/center-manager') ? '/center-manager' : '/admin';

    const isEditMode = location.search.includes('edit=true');

    const [students, setStudents] = useState([]);
    const [sessionDate, setSessionDate] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeMenuId, setActiveMenuId] = useState(null);

    useEffect(() => {
        const loadSessionData = async () => {
            if (!sessionId || sessionId === 'new') return;
            setLoading(true);
            try {
                const response = await getTeacherSessionDetail(sessionId);
                if (response.status === 'success') {
                    setStudents(response.attendance || []);
                    if (response.session_date) {
                        setSessionDate(response.session_date.slice(0, 10));
                    }
                }
            } catch (err) {} finally {
                setLoading(false);
            }
        };
        loadSessionData();
    }, [sessionId]);

    const handleAttendanceChange = (attendanceId, newStatus) => {
        if (!isEditMode) return;
        setStudents(prev => prev.map(st => st.attendance_id === attendanceId ? { ...st, status: newStatus } : st));
    };

    const handleBehaviorChange = (attendanceId, value) => {
        if (!isEditMode) return;
        const scoreVal = parseInt(value, 10);
        const matchedOpt = BEHAVIOR_OPTIONS.find(b => b.value === scoreVal);
        setStudents(prev => prev.map(st => st.attendance_id === attendanceId ? {
            ...st, behavior_score: scoreVal, behavior: matchedOpt ? matchedOpt.code : 'EXCELLENT'
        } : st));
    };

    const handleSaveSession = async () => {
        if (!isEditMode) return;
        setSaving(true);
        try {
            const payload = {
                session_date: sessionDate,
                modified_by_id: user?.id,
                students: students.map(st => ({
                    attendance_id: st.attendance_id,
                    status: st.status || 'PRESENT',
                    is_late: !!st.is_late,
                    behavior_score: st.behavior_score !== undefined ? st.behavior_score : 10,
                    behavior: st.behavior || 'EXCELLENT',
                    notes: st.notes || ''
                }))
            };
            const response = await updateSessionDetails(sessionId, payload);
            if (response.status === 'success') {
                alert('تم حفظ التفاصيل بنجاح');
                navigate(`${basePath}/rings/${ringId}/sessions/${sessionId}`);
            }
        } catch (err) {
            alert('حدث خطأ');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ padding: '1rem', paddingBottom: '6rem', direction: 'rtl', fontFamily: 'inherit', background: '#f8fafc', minHeight: '100vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#666', fontWeight: 'bold' }}>
                    <ArrowRight size={20} /> عودة
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Clock size={20} color="#558b2f" />
                    <span style={{ fontWeight: 'bold', color: '#133315' }}>{sessionDate || 'تاريخ الجلسة'}</span>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, color: '#133315', fontWeight: 'bold' }}>سجل الحضور ({students.length})</h3>
                {!isEditMode && (
                    <button onClick={() => navigate(`${location.pathname}?edit=true`)} style={{ background: '#e8f5e9', color: '#2e7d32', border: 'none', borderRadius: '8px', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold' }}>
                        <PencilSimple size={16} /> تعديل
                    </button>
                )}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#558b2f' }}>جاري التحميل...</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    {students.map(student => (
                        <div key={student.attendance_id} style={{ background: '#fff', padding: '1rem', borderRadius: '16px', border: '1px solid #eee', position: 'relative' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem' }}>
                                <UserCircle size={36} color="#888" />
                                <div>
                                    <h4 style={{ margin: '0 0 0.2rem 0', color: '#133315', fontSize: '1rem' }}>{student.student_name}</h4>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                <button onClick={() => handleAttendanceChange(student.attendance_id, 'PRESENT')} disabled={!isEditMode} style={{ flex: 1, padding: '0.6rem', borderRadius: '10px', border: student.status === 'PRESENT' ? '2px solid #558b2f' : '1px solid #ddd', background: student.status === 'PRESENT' ? '#f0fdf4' : '#fff', color: student.status === 'PRESENT' ? '#2e7d32' : '#666', fontWeight: 'bold' }}>
                                    حاضر
                                </button>
                                <button onClick={() => handleAttendanceChange(student.attendance_id, 'ABSENT')} disabled={!isEditMode} style={{ flex: 1, padding: '0.6rem', borderRadius: '10px', border: student.status === 'ABSENT' ? '2px solid #d32f2f' : '1px solid #ddd', background: student.status === 'ABSENT' ? '#ffebee' : '#fff', color: student.status === 'ABSENT' ? '#c62828' : '#666', fontWeight: 'bold' }}>
                                    غائب
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.85rem', color: '#666' }}>السلوك:</label>
                                <select value={student.behavior_score ?? 10} onChange={e => handleBehaviorChange(student.attendance_id, e.target.value)} disabled={!isEditMode} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #ddd', outline: 'none', background: isEditMode ? '#fff' : '#f5f5f5' }}>
                                    {BEHAVIOR_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isEditMode && (
                <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '1rem', background: '#fff', borderTop: '1px solid #eee', zIndex: 10 }}>
                    <button onClick={handleSaveSession} disabled={saving} style={{ width: '100%', padding: '1rem', borderRadius: '12px', background: '#558b2f', color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                        {saving ? 'جاري الحفظ...' : <><Check size={20} weight="bold" /> حفظ التعديلات</>}
                    </button>
                </div>
            )}
        </div>
    );
};

export default MobileAdminSessionDetail;
