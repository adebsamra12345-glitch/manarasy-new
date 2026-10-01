import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { CalendarCheck, CalendarBlank, UserCircle, CheckCircle, MagnifyingGlass, BookOpen, CaretDown, FloppyDisk, ArrowRight, DotsThreeVertical, Clock, Check } from '@phosphor-icons/react';
import { getHalaqat, getTeacherSessionDetail, updateSessionDetails } from '../../../services/api/tenantService';
import { useAuthContext } from '../../../context/AuthContext';
import RecitationModal from '../../desktop/teacher/RecitationModal';
import PageEvaluationsList from '../../../components/PageEvaluationsList';
import AlternativeDatePickerModal from '../../../components/AlternativeDatePickerModal';

const BEHAVIOR_OPTIONS = [
    { label: 'ممتاز (10)', value: 10, code: 'EXCELLENT' },
    { label: 'جيد جداً (8)', value: 8, code: 'VERY_GOOD' },
    { label: 'جيد (6)', value: 6, code: 'GOOD' },
    { label: 'مقبول (4)', value: 4, code: 'ACCEPTABLE' },
    { label: 'ضعيف (2)', value: 2, code: 'WEAK' },
    { label: 'مغادرة الحلقة دون عذر', value: 0, code: 'LEFT_WITHOUT_EXCUSE' },
];

/**
 * MobileAttendanceSession — تسجيل الحضور والغياب والسلوك من الموبايل
 */
const MobileAttendanceSession = () => {
    const { ringId, sessionId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuthContext();

    const isEditMode = location.search.includes('edit=true') || !sessionId;

    const [rings, setRings] = useState([]);
    const [selectedRingId, setSelectedRingId] = useState(ringId || '');
    const [students, setStudents] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [evaluationTemplate, setEvaluationTemplate] = useState(null);
    const [evaluatingStudent, setEvaluatingStudent] = useState(null);
    const [activeMenuId, setActiveMenuId] = useState(null);

    // Date management states
    const [sessionDate, setSessionDate] = useState('');
    const [originalSessionDate, setOriginalSessionDate] = useState('');
    const [showDatePickerModal, setShowDatePickerModal] = useState(false);
    const [conflictDate, setConflictDate] = useState('');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successAlert, setSuccessAlert] = useState('');

    useEffect(() => {
        const fetchRingsData = async () => {
            try {
                const res = await getHalaqat();
                if (res.status === 'success') {
                    setRings(res.data || []);
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchRingsData();
    }, []);

    useEffect(() => {
        const loadSession = async () => {
            if (!sessionId) {
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const res = await getTeacherSessionDetail(sessionId);
                if (res.status === 'success') {
                    setStudents(res.attendance || []);
                    setEvaluationTemplate(res.evaluation_template || null);
                    if (res.session_date) {
                        const dStr = res.session_date.slice(0, 10);
                        setSessionDate(dStr);
                        setOriginalSessionDate(dStr);
                    }
                } else {
                    setError('فشل في جلب الجلسة');
                }
            } catch (err) {
                console.error(err);
                setError('حدث خطأ في الاتصال بالخادم');
            } finally {
                setLoading(false);
            }
        };

        loadSession();
    }, [sessionId]);

    const handleAttendanceChange = (attendanceId, newStatus) => {
        if (!isEditMode) return;
        setStudents(prev => prev.map(st => {
            if (st.attendance_id !== attendanceId) return st;
            return { ...st, status: newStatus };
        }));
    };

    const handleExcusedToggle = (attendanceId, isExcused) => {
        if (!isEditMode) return;
        setStudents(prev => prev.map(st => {
            if (st.attendance_id !== attendanceId) return st;
            return { ...st, status: isExcused ? 'EXCUSED' : 'ABSENT' };
        }));
    };

    const toggleLateStatus = (attendanceId) => {
        if (!isEditMode) return;
        setStudents(prev => prev.map(st => {
            if (st.attendance_id !== attendanceId) return st;
            return { ...st, is_late: !st.is_late };
        }));
        setActiveMenuId(null);
    };

    const handleBehaviorChange = (attendanceId, value) => {
        if (!isEditMode) return;
        const scoreVal = parseInt(value, 10);
        const matchedOpt = BEHAVIOR_OPTIONS.find(b => b.value === scoreVal);
        setStudents(prev => prev.map(st => {
            if (st.attendance_id !== attendanceId) return st;
            return {
                ...st,
                behavior_score: scoreVal,
                behavior: matchedOpt ? matchedOpt.code : (scoreVal === 0 ? 'LEFT_WITHOUT_EXCUSE' : 'EXCELLENT')
            };
        }));
    };

    const handleNotesChange = (attendanceId, notesValue) => {
        if (!isEditMode) return;
        setStudents(prev => prev.map(st => 
            st.attendance_id === attendanceId ? { ...st, notes: notesValue } : st
        ));
    };

    const handleSaveSession = async (customDate = null) => {
        setSaving(true);
        setError('');
        setSuccessAlert('');
        const dateToSave = (typeof customDate === 'string' && customDate) ? customDate : sessionDate;
        const todayISO = new Date().toISOString().split('T')[0];
        if (dateToSave > todayISO) {
            setError('لا يمكن إنشاء جلسة بتاريخ مستقبلي. يرجى اختيار تاريخ اليوم أو أي تاريخ سابق.');
            setSaving(false);
            return;
        }
        try {
            const payload = {
                session_date: dateToSave,
                modified_by_id: user?.id,
                modified_by_name: localStorage.getItem('username') || user?.username,
                change_reason: 'تعديل تاريخ الجلسة من تطبيق المعلم (جوال)',
                students: students.map(st => ({
                    attendance_id: st.attendance_id,
                    status: st.status || 'PRESENT',
                    is_late: !!st.is_late,
                    behavior_score: st.behavior_score !== undefined ? st.behavior_score : 10,
                    behavior: st.behavior || (st.behavior_score === 0 ? 'LEFT_WITHOUT_EXCUSE' : 'EXCELLENT'),
                    notes: st.notes || ''
                }))
            };
            const response = await updateSessionDetails(sessionId, payload);
            if (response.status === 'success') {
                setOriginalSessionDate(dateToSave);
                setSuccessAlert('تم حفظ تفاصيل الجلسة وتحديث التاريخ بنجاح!');
                setTimeout(() => setSuccessAlert(''), 3000);
            } else {
                setError(response.message || 'حدث خطأ أثناء الحفظ');
            }
        } catch (err) {
            console.error(err);
            if (err.response?.status === 409 || err.response?.data?.error_code === 'SESSION_DATE_CONFLICT') {
                const confDate = err.response?.data?.conflicting_date || dateToSave;
                setConflictDate(confDate);
                setShowDatePickerModal(true);
            } else {
                setError(err.response?.data?.message || 'خطأ في الاتصال بالخادم');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleSelectAlternativeDate = (chosenDate) => {
        setSessionDate(chosenDate);
        setShowDatePickerModal(false);
        handleSaveSession(chosenDate);
    };

    const handleEvaluationSuccess = (attendanceId, newReachedPage) => {
        setStudents(prev => prev.map(st =>
            st.attendance_id === attendanceId ? { ...st, reached_page: newReachedPage } : st
        ));
    };

    const filteredStudents = students.filter(st =>
        st.student_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const presentCount = students.filter(st => st.status === 'PRESENT').length;

    return (
        <div style={{ padding: '1rem', paddingBottom: '6rem', direction: 'rtl', fontFamily: 'inherit' }}>
            {/* Top Bar Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{ background: '#f5f5f5', border: 'none', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer', display: 'flex' }}
                >
                    <ArrowRight size={20} color="#133315" />
                </button>
                <h2 style={{ fontSize: '1.2rem', color: '#133315', margin: 0, fontWeight: 'bold' }}>جلسة الحضور والتقييم</h2>
                <div style={{ width: 32 }}></div>
            </div>

            {/* Mobile Session Date Bar */}
            <div style={{
                background: '#fff',
                borderRadius: '12px',
                padding: '0.75rem 1rem',
                border: '1px solid #e0e0e0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.85rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CalendarBlank size={18} color="#558b2f" weight="bold" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#133315' }}>
                        تاريخ الجلسة:
                    </span>
                </div>
                {isEditMode ? (
                    <input
                        type="date"
                        max={new Date().toISOString().split('T')[0]}
                        value={sessionDate}
                        onChange={(e) => setSessionDate(e.target.value)}
                        style={{
                            padding: '0.35rem 0.6rem',
                            borderRadius: '8px',
                            border: '1.5px solid #81b255',
                            outline: 'none',
                            fontSize: '0.85rem',
                            fontWeight: 'bold',
                            color: '#133315',
                            backgroundColor: '#f9fbe7'
                        }}
                    />
                ) : (
                    <span style={{
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        color: '#2e7d32',
                        backgroundColor: '#f1f8e9',
                        padding: '0.25rem 0.6rem',
                        borderRadius: '6px'
                    }}>
                        {sessionDate || 'غير محدد'}
                    </span>
                )}
            </div>

            {/* Quick Summary Pill */}
            <div style={{
                background: '#fff',
                borderRadius: '12px',
                padding: '0.85rem 1rem',
                border: '1px solid #e0e0e0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem'
            }}>
                <div>
                    <span style={{ fontSize: '0.8rem', color: '#777', display: 'block' }}>إجمالي الحضور</span>
                    <strong style={{ fontSize: '1.1rem', color: '#133315' }}>{presentCount} / {students.length} طالب</strong>
                </div>
                <span style={{
                    background: '#e8f5e9',
                    color: '#2e7d32',
                    padding: '0.3rem 0.7rem',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: 'bold'
                }}>
                    {students.length > 0 ? Math.round((presentCount / students.length) * 100) : 0}% حضور
                </span>
            </div>

            {/* Alerts */}
            {successAlert && (
                <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '0.75rem', borderRadius: '10px', marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    {successAlert}
                </div>
            )}
            {error && (
                <div style={{ background: '#ffebee', color: '#c62828', padding: '0.75rem', borderRadius: '10px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                    {error}
                </div>
            )}

            {/* Search Input */}
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
                <input
                    type="text"
                    placeholder="ابحث عن طالب..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '0.65rem 2.2rem 0.65rem 1rem',
                        borderRadius: '10px',
                        border: '1px solid #ddd',
                        outline: 'none',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box'
                    }}
                />
                <MagnifyingGlass size={18} color="#888" style={{ position: 'absolute', top: '50%', right: '0.75rem', transform: 'translateY(-50%)' }} />
            </div>

            {/* Student Cards List */}
            {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#558b2f', fontWeight: 'bold' }}>جاري تحميل الطلاب...</div>
            ) : filteredStudents.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#888', background: '#fff', borderRadius: '12px' }}>
                    لا يوجد طلاب لهذه الجلسة.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {filteredStudents.map(student => {
                        const isPresent = student.status === 'PRESENT';
                        const isAbsent = student.status === 'ABSENT' || student.status === 'EXCUSED';
                        const isExcused = student.status === 'EXCUSED';

                        return (
                            <div key={student.attendance_id} style={{
                                background: '#fff',
                                borderRadius: '14px',
                                padding: '1rem',
                                border: '1px solid #eee',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                                position: 'relative'
                            }}>
                                {/* Card Top: Name & Recitation / 3-dot Menu */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <UserCircle size={28} color="#558b2f" weight="fill" />
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#133315', fontWeight: 'bold' }}>{student.student_name}</h4>
                                                {student.is_late && (
                                                    <span style={{ 
                                                        background: '#fff3e0', 
                                                        color: '#e65100', 
                                                        fontSize: '0.7rem', 
                                                        fontWeight: 'bold', 
                                                        padding: '0.1rem 0.4rem', 
                                                        borderRadius: '10px', 
                                                        display: 'inline-flex', 
                                                        alignItems: 'center', 
                                                        gap: '0.2rem', 
                                                        border: '1px solid #ffe0b2' 
                                                    }}>
                                                        <Clock size={10} weight="bold" /> متأخر
                                                    </span>
                                                )}
                                            </div>
                                            <span style={{ fontSize: '0.75rem', color: '#e65100', fontWeight: 500 }}>صفحة الوصول: {student.reached_page || 1}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-end' }}>
                                            <div style={{ padding: '0.2rem 0' }}>
                                                <PageEvaluationsList evaluations={student.evaluations} />
                                            </div>
                                            {student.status === 'PRESENT' && (
                                                <button
                                                    onClick={() => setEvaluatingStudent(student)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.3rem',
                                                        background: '#81b255',
                                                        color: '#fff',
                                                        border: 'none',
                                                        padding: '0.4rem 0.8rem',
                                                        borderRadius: '8px',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 'bold',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <BookOpen size={14} />
                                                    تسميع
                                                </button>
                                            )}
                                        </div>
                                        {isEditMode && (
                                            <button
                                                type="button"
                                                onClick={() => setActiveMenuId(activeMenuId === student.attendance_id ? null : student.attendance_id)}
                                                style={{
                                                    background: '#f5f5f5',
                                                    border: 'none',
                                                    padding: '0.35rem',
                                                    borderRadius: '50%',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: student.is_late ? '#e65100' : '#666'
                                                }}
                                            >
                                                <DotsThreeVertical size={18} weight="bold" />
                                            </button>
                                        )}

                                        {/* Dropdown Menu for Late Arrival */}
                                        {activeMenuId === student.attendance_id && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '2.5rem',
                                                left: '0.5rem',
                                                zIndex: 100,
                                                background: '#fff',
                                                borderRadius: '8px',
                                                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                                                border: '1px solid #eee',
                                                minWidth: '140px',
                                                overflow: 'hidden',
                                                textAlign: 'right'
                                            }}>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleLateStatus(student.attendance_id)}
                                                    style={{
                                                        width: '100%',
                                                        padding: '0.5rem 0.75rem',
                                                        background: student.is_late ? '#fff3e0' : 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        fontSize: '0.8rem',
                                                        color: student.is_late ? '#e65100' : '#333',
                                                        fontWeight: student.is_late ? 'bold' : 'normal'
                                                    }}
                                                >
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                        <Clock size={14} color="#e65100" />
                                                        متأخر
                                                    </span>
                                                    {student.is_late && <Check size={14} color="#e65100" weight="bold" />}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Attendance Option Buttons & Excused Checkbox */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                    <button
                                        type="button"
                                        disabled={!isEditMode}
                                        onClick={() => handleAttendanceChange(student.attendance_id, 'PRESENT')}
                                        style={{
                                            flex: 1,
                                            padding: '0.45rem',
                                            borderRadius: '8px',
                                            border: `1.5px solid ${isPresent ? '#2e7d32' : '#e0e0e0'}`,
                                            background: isPresent ? '#e8f5e9' : '#fff',
                                            color: isPresent ? '#2e7d32' : '#666',
                                            fontWeight: isPresent ? 'bold' : 'normal',
                                            fontSize: '0.82rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        حاضر
                                    </button>

                                    <button
                                        type="button"
                                        disabled={!isEditMode}
                                        onClick={() => handleAttendanceChange(student.attendance_id, 'ABSENT')}
                                        style={{
                                            flex: 1,
                                            padding: '0.45rem',
                                            borderRadius: '8px',
                                            border: `1.5px solid ${isAbsent ? '#d32f2f' : '#e0e0e0'}`,
                                            background: isAbsent ? '#ffebee' : '#fff',
                                            color: isAbsent ? '#d32f2f' : '#666',
                                            fontWeight: isAbsent ? 'bold' : 'normal',
                                            fontSize: '0.82rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        غائب
                                    </button>

                                    {isAbsent && (
                                        <label style={{ 
                                            display: 'inline-flex', 
                                            alignItems: 'center', 
                                            gap: '0.3rem', 
                                            fontSize: '0.78rem', 
                                            color: '#e65100', 
                                            fontWeight: 'bold',
                                            cursor: isEditMode ? 'pointer' : 'default',
                                            background: '#fff3e0',
                                            padding: '0.35rem 0.5rem',
                                            borderRadius: '8px',
                                            border: '1px solid #ffe0b2'
                                        }}>
                                            <input 
                                                type="checkbox"
                                                disabled={!isEditMode}
                                                checked={isExcused}
                                                onChange={(e) => handleExcusedToggle(student.attendance_id, e.target.checked)}
                                                style={{ cursor: isEditMode ? 'pointer' : 'default', accentColor: '#ed6c02' }}
                                            />
                                            بعذر
                                        </label>
                                    )}
                                </div>

                                {/* Behavior & Notes */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem' }}>
                                    <div style={{ position: 'relative' }}>
                                        <select
                                            disabled={!isEditMode}
                                            value={student.behavior_score !== undefined ? student.behavior_score : 10}
                                            onChange={(e) => handleBehaviorChange(student.attendance_id, e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '0.4rem 1.4rem 0.4rem 0.4rem',
                                                borderRadius: '6px',
                                                border: '1px solid #ddd',
                                                fontSize: '0.78rem',
                                                fontWeight: student.behavior_score === 0 ? 'bold' : 'normal',
                                                color: student.behavior_score === 0 ? '#c62828' : '#333',
                                                background: '#fff',
                                                outline: 'none',
                                                appearance: 'none'
                                            }}
                                        >
                                            {BEHAVIOR_OPTIONS.map(b => (
                                                <option key={b.value} value={b.value}>{b.label}</option>
                                            ))}
                                        </select>
                                        <CaretDown size={12} color="#888" style={{ position: 'absolute', top: '50%', right: '0.3rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="ملاحظات..."
                                        disabled={!isEditMode}
                                        value={student.notes || ''}
                                        onChange={(e) => handleNotesChange(student.attendance_id, e.target.value)}
                                        style={{
                                            padding: '0.4rem 0.6rem',
                                            borderRadius: '6px',
                                            border: '1px solid #ddd',
                                            fontSize: '0.78rem',
                                            outline: 'none',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Bottom Save Bar */}
            {!loading && students.length > 0 && isEditMode && (
                <div style={{
                    position: 'fixed',
                    bottom: '3.8rem',
                    left: 0,
                    right: 0,
                    background: '#fff',
                    padding: '0.75rem 1rem',
                    boxShadow: '0 -2px 10px rgba(0,0,0,0.08)',
                    display: 'flex',
                    justifyContent: 'center',
                    zIndex: 90
                }}>
                    <button
                        onClick={() => handleSaveSession()}
                        disabled={saving}
                        style={{
                            width: '100%',
                            maxWidth: '400px',
                            backgroundColor: '#f57c00',
                            color: '#fff',
                            border: 'none',
                            padding: '0.75rem',
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            fontSize: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            cursor: saving ? 'wait' : 'pointer',
                            opacity: saving ? 0.7 : 1
                        }}
                    >
                        <FloppyDisk size={20} />
                        {saving ? 'جاري التحديث...' : 'حفظ الجلسة بالكامل'}
                    </button>
                </div>
            )}

            {/* Recitation Modal */}
            <RecitationModal
                isOpen={!!evaluatingStudent}
                onClose={() => setEvaluatingStudent(null)}
                student={evaluatingStudent}
                evaluationTemplate={evaluationTemplate}
                onEvaluationSuccess={handleEvaluationSuccess}
            />

            {/* Alternative Date Picker Modal */}
            <AlternativeDatePickerModal
                isOpen={showDatePickerModal}
                onClose={() => setShowDatePickerModal(false)}
                onSelectDate={handleSelectAlternativeDate}
                halaqaId={selectedRingId}
                conflictingDate={conflictDate}
                excludeSessionId={sessionId}
                title="تعارض في تاريخ الجلسة"
                message={`يوجد بالفعل جلسة مسجلة لهذه الحلقة بتاريخ (${conflictDate}). يرجى اختيار تاريخ شاغر:`}
            />
        </div>
    );
};

export default MobileAttendanceSession;
