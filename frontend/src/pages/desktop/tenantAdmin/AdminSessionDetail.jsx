import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
    Bell, CaretDown, Users, MagnifyingGlass, UserCircle, 
    Clock, FilePdf, ArrowRight, Check, CheckCircle, WarningCircle, 
    DotsThreeVertical, PencilSimple 
} from '@phosphor-icons/react';
import { getHalaqat, getTeacherSessionDetail, updateSessionDetails } from '../../../services/api/tenantService';
import { useAuthContext } from '../../../context/AuthContext';
import RecitationModal from '../teacher/RecitationModal';
import PageEvaluationsList from '../../../components/PageEvaluationsList';
import { exportSessionPdf } from '../../../utils/sessionPdfExporter';
import AlternativeDatePickerModal from '../../../components/AlternativeDatePickerModal';

export const BEHAVIOR_OPTIONS = [
    { label: 'ممتاز (10)', value: 10, code: 'EXCELLENT' },
    { label: 'جيد جداً (8)', value: 8, code: 'VERY_GOOD' },
    { label: 'جيد (6)', value: 6, code: 'GOOD' },
    { label: 'مقبول (4)', value: 4, code: 'ACCEPTABLE' },
    { label: 'ضعيف (2)', value: 2, code: 'WEAK' },
    { label: 'مغادرة الحلقة دون عذر', value: 0, code: 'LEFT_WITHOUT_EXCUSE' },
];

const AdminSessionDetail = () => {
    const { ringId, sessionId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const basePath = location.pathname.startsWith('/center-manager') ? '/center-manager' : '/admin';
    const { user } = useAuthContext();

    const isEditMode = location.search.includes('edit=true');

    const today = new Date();
    const dateStr = today.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const [rings, setRings] = useState([]);
    const [selectedRingId, setSelectedRingId] = useState(ringId || '');
    const [students, setStudents] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [evaluationTemplate, setEvaluationTemplate] = useState(null);
    const [evaluatingStudent, setEvaluatingStudent] = useState(null);
    const [activeMenuId, setActiveMenuId] = useState(null);

    // Session Date management states
    const [sessionDate, setSessionDate] = useState('');
    const [originalSessionDate, setOriginalSessionDate] = useState('');
    const [showDatePickerModal, setShowDatePickerModal] = useState(false);
    const [conflictDate, setConflictDate] = useState('');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [saving, setSaving] = useState(false);

    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setActiveMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchRings = async () => {
            try {
                const response = await getHalaqat();
                if (response.status === 'success') {
                    setRings(response.data || []);
                }
            } catch (err) {
                console.error('Error fetching rings:', err);
            }
        };
        fetchRings();
    }, []);

    useEffect(() => {
        const loadSessionData = async () => {
            if (!sessionId || sessionId === 'new') return;

            setLoading(true);
            setError('');
            try {
                const response = await getTeacherSessionDetail(sessionId);
                if (response.status === 'success') {
                    setStudents(response.attendance || []);
                    setEvaluationTemplate(response.evaluation_template || null);
                    if (response.session_date) {
                        const dStr = response.session_date.slice(0, 10);
                        setSessionDate(dStr);
                        setOriginalSessionDate(dStr);
                    }
                } else {
                    setError('فشل في جلب تفاصيل الجلسة');
                }
            } catch (err) {
                console.error('Error loading session:', err);
                setError('حدث خطأ في الاتصال بالخادم');
            } finally {
                setLoading(false);
            }
        };

        loadSessionData();
    }, [sessionId]);

    const handleRingChange = (e) => {
        const newRingId = e.target.value;
        setSelectedRingId(newRingId);
        navigate(`${basePath}/rings/${newRingId}/sessions`);
    };

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
        if (!isEditMode) return;
        setSaving(true);
        setError('');
        setSuccessMsg('');
        const dateToSave = (typeof customDate === 'string' && customDate) ? customDate : sessionDate;

        // التحقق من منع التواريخ المستقبلية
        const todayISO = new Date().toISOString().slice(0, 10);
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
                change_reason: 'تعديل تاريخ وتفاصيل الجلسة من لوحة إدارة الحلقات',
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
                setSuccessMsg('تم حفظ تفاصيل الجلسة وتحديث التاريخ بنجاح!');
                setTimeout(() => {
                    navigate(`${basePath}/rings/${selectedRingId}/sessions/${sessionId}`);
                }, 1200);
            } else {
                setError(response.message || 'حدث خطأ أثناء الحفظ');
            }
        } catch (err) {
            console.error('Error saving session:', err);
            if (err.response?.status === 409 || err.response?.data?.error_code === 'SESSION_DATE_CONFLICT') {
                const confDate = err.response?.data?.conflicting_date || dateToSave;
                setConflictDate(confDate);
                setShowDatePickerModal(true);
            } else {
                setError(err.response?.data?.message || 'حدث خطأ في الاتصال بالخادم');
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

    const handleEvaluationSuccess = (attendanceId, newReachedPage, newEvaluation, isUpdate = false) => {
        setStudents(prev => prev.map(st => {
            if (st.attendance_id !== attendanceId) return st;
            let updatedEvals = st.evaluations || [];
            if (newEvaluation) {
                if (isUpdate) {
                    updatedEvals = updatedEvals.map(ev =>
                        ev.page_number === newEvaluation.page_number ? newEvaluation : ev
                    );
                } else {
                    updatedEvals = [...updatedEvals, newEvaluation];
                }
            }
            return { ...st, reached_page: newReachedPage, evaluations: updatedEvals };
        }));
    };

    const filteredStudents = students.filter(st =>
        (st.student_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const [exporting, setExporting] = useState(false);

    const handleExportPdfDetail = async () => {
        if (exporting || !sessionId) return;
        setExporting(true);
        try {
            const selectedRing = rings.find(r => String(r.id) === String(selectedRingId));
            await exportSessionPdf(sessionId, {
                halaqa_name: selectedRing?.name,
                teacher_name: selectedRing?.teacher_name
            });
        } catch (err) {
            console.error(err);
            alert('حدث خطأ أثناء تصدير تقرير الجلسة PDF');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="dashboard-container" style={{ padding: '2rem', maxWidth: '1050px', margin: '0 auto', direction: 'rtl', fontFamily: 'inherit' }}>
            {/* Header */}
            <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div className="greeting" style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                        <button
                            onClick={() => navigate(`${basePath}/rings/${selectedRingId}/sessions`)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                background: '#f1f8e9',
                                color: '#2e7d32',
                                border: '1px solid #c8e6c9',
                                padding: '0.35rem 0.8rem',
                                borderRadius: '8px',
                                fontSize: '0.85rem',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            title="العودة لجلسات الحلقة"
                        >
                            <ArrowRight size={16} />
                            <span>العودة لجلسات الحلقة</span>
                        </button>
                        {isEditMode && (
                            <span style={{
                                backgroundColor: '#fff3e0',
                                color: '#e65100',
                                border: '1px solid #ffe0b2',
                                padding: '0.2rem 0.6rem',
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                fontWeight: 'bold'
                            }}>
                                وضع التعديل والتقييم
                            </span>
                        )}
                    </div>
                    <h1 style={{ fontSize: '1.8rem', color: '#133315', marginBottom: '0.3rem', fontWeight: 'bold' }}>
                        السلام عليكم، أ. {localStorage.getItem('username') || user?.username || 'مدير النظام'}
                    </h1>
                    <p style={{ color: '#888', fontSize: '0.9rem', margin: 0 }}>{dateStr}</p>
                </div>
                <div className="header-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div className="select-halaqa" style={{ position: 'relative' }}>
                        <select
                            value={selectedRingId}
                            onChange={handleRingChange}
                            style={{
                                appearance: 'none',
                                border: '1.5px solid #558b2f',
                                padding: '0.55rem 2.4rem 0.55rem 1.2rem',
                                borderRadius: '10px',
                                background: '#f1f8e9',
                                color: '#133315',
                                fontWeight: 'bold',
                                fontSize: '0.95rem',
                                cursor: 'pointer',
                                outline: 'none',
                                fontFamily: 'inherit',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                            }}
                        >
                            {rings.map(r => (
                                <option key={r.id} value={r.id}>{r.name} {r.project_title ? `(${r.project_title})` : ''}</option>
                            ))}
                        </select>
                        <CaretDown size={16} color="#133315" style={{ position: 'absolute', top: '50%', right: '0.7rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                        <Users size={16} color="#558b2f" style={{ position: 'absolute', top: '50%', left: '0.7rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>
                    <div className="icon-btn" style={{ position: 'relative', background: '#fff', border: '1px solid #eee', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer' }}>
                        <Bell size={20} color="#133315" />
                        <span style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, backgroundColor: '#f57c00', borderRadius: '50%' }}></span>
                    </div>
                </div>
            </div>

            {/* Alerts */}
            {successMsg && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '0.8rem 1.2rem', borderRadius: '10px', marginBottom: '1.5rem', border: '1px solid #a5d6a7' }}>
                    <CheckCircle size={22} weight="fill" />
                    <span style={{ fontWeight: 'bold' }}>{successMsg}</span>
                </div>
            )}

            {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', backgroundColor: '#ffebee', color: '#c62828', padding: '0.8rem 1.2rem', borderRadius: '10px', marginBottom: '1.5rem', border: '1px solid #ef9a9a' }}>
                    <WarningCircle size={22} weight="fill" />
                    <span style={{ fontWeight: 'bold' }}>{error}</span>
                    <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: 'auto', color: '#c62828' }}>✕</button>
                </div>
            )}

            {/* Page Title & Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h2 style={{ fontSize: '2.2rem', color: '#1a3b1c', fontWeight: 'bold', margin: 0 }}>تفاصيل الجلسة والتقييمات</h2>
                    {!isEditMode && (
                        <button
                            onClick={() => navigate(`${basePath}/rings/${selectedRingId}/sessions/${sessionId}?edit=true`)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                backgroundColor: '#558b2f',
                                color: '#fff',
                                border: 'none',
                                padding: '0.45rem 1rem',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                fontSize: '0.88rem',
                                cursor: 'pointer'
                            }}
                        >
                            <PencilSimple size={16} weight="bold" />
                            <span>تعديل الجلسة</span>
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', width: '220px' }}>
                        <input
                            type="text"
                            placeholder="ابحث عن طالب ..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                padding: '0.55rem 2.2rem 0.55rem 1rem',
                                border: '1px solid #ddd',
                                borderRadius: '8px',
                                width: '100%',
                                outline: 'none',
                                textAlign: 'right',
                                fontSize: '0.9rem'
                            }}
                        />
                        <MagnifyingGlass size={18} color="#888" style={{ position: 'absolute', top: '50%', right: '0.7rem', transform: 'translateY(-50%)' }} />
                    </div>
                    <button
                        disabled={exporting}
                        onClick={handleExportPdfDetail}
                        style={{
                            backgroundColor: '#fff',
                            color: '#c62828',
                            border: '1.5px solid #c62828',
                            padding: '0.55rem 1.2rem',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            cursor: exporting ? 'wait' : 'pointer',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontSize: '0.9rem'
                        }}
                    >
                        <FilePdf size={18} weight="fill" color="#c62828" />
                        {exporting ? 'جاري التصدير...' : 'تصدير تقرير الجلسة PDF'}
                    </button>
                </div>
            </div>

            {/* Table Header */}
            <div style={{ display: 'flex', backgroundColor: '#e0e0e0', padding: '1rem', borderTopLeftRadius: '12px', borderTopRightRadius: '12px', fontWeight: 'bold', color: '#333', textAlign: 'center' }}>
                <div style={{ flex: 1.8 }}>الطالب</div>
                <div style={{ flex: 2.2, borderRight: '1px solid #aaa' }}>الحضور والغياب</div>
                <div style={{ flex: 1.5, borderRight: '1px solid #aaa' }}>السلوك</div>
                <div style={{ flex: 1.5, borderRight: '1px solid #aaa' }}>التقييم</div>
                <div style={{ flex: 2, borderRight: '1px solid #aaa' }}>ملاحظات</div>
            </div>

            {/* Table Body */}
            {loading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#558b2f', fontWeight: 'bold' }}>جاري تحميل تفاصيل الجلسة...</div>
            ) : filteredStudents.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#777', backgroundColor: '#fff', border: '1px solid #eee' }}>لا يوجد طلاب مسجلين في هذه الجلسة.</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
                    {filteredStudents.map(student => {
                        const isPresent = student.status === 'PRESENT';
                        const isAbsent = student.status === 'ABSENT' || student.status === 'EXCUSED';
                        const isExcused = student.status === 'EXCUSED';

                        return (
                            <div key={student.attendance_id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '0.85rem 1rem',
                                border: '1px solid #eee',
                                borderRadius: '10px',
                                background: '#fff',
                                textAlign: 'center',
                                position: 'relative'
                            }}>
                                {/* Student Name & Late Indicator */}
                                <div style={{ flex: 1.8, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold', color: '#133315' }}>
                                        <UserCircle size={24} color="#64b5f6" weight="fill" />
                                        <span>{student.student_name}</span>
                                    </div>
                                    {student.is_late && (
                                        <span style={{
                                            marginTop: '0.25rem',
                                            marginRight: '1.8rem',
                                            background: '#fff3e0',
                                            color: '#e65100',
                                            fontSize: '0.72rem',
                                            fontWeight: 'bold',
                                            padding: '0.15rem 0.5rem',
                                            borderRadius: '12px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.25rem',
                                            border: '1px solid #ffe0b2'
                                        }}>
                                            <Clock size={12} weight="bold" /> متأخر
                                        </span>
                                    )}
                                </div>

                                {/* Attendance Status Options */}
                                <div style={{ flex: 2.2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
                                    <button
                                        disabled={!isEditMode}
                                        onClick={() => handleAttendanceChange(student.attendance_id, 'PRESENT')}
                                        style={{
                                            padding: '0.4rem 0.8rem',
                                            border: `1.5px solid ${isPresent ? '#2e7d32' : '#ccc'}`,
                                            borderRadius: '6px',
                                            background: isPresent ? '#e8f5e9' : '#fff',
                                            color: isPresent ? '#2e7d32' : '#888',
                                            fontWeight: isPresent ? 'bold' : 'normal',
                                            fontSize: '0.85rem',
                                            cursor: isEditMode ? 'pointer' : 'default'
                                        }}
                                    >
                                        حاضر
                                    </button>
                                    <button
                                        disabled={!isEditMode}
                                        onClick={() => handleAttendanceChange(student.attendance_id, 'ABSENT')}
                                        style={{
                                            padding: '0.4rem 0.8rem',
                                            border: `1.5px solid ${isAbsent ? '#d32f2f' : '#ccc'}`,
                                            borderRadius: '6px',
                                            background: isAbsent ? '#ffebee' : '#fff',
                                            color: isAbsent ? '#d32f2f' : '#888',
                                            fontWeight: isAbsent ? 'bold' : 'normal',
                                            fontSize: '0.85rem',
                                            cursor: isEditMode ? 'pointer' : 'default'
                                        }}
                                    >
                                        غائب
                                    </button>
                                    {isAbsent && (
                                        isEditMode ? (
                                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleExcusedToggle(student.attendance_id, true)}
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        padding: '0.25rem 0.45rem',
                                                        borderRadius: '4px',
                                                        border: isExcused ? '1.5px solid #2e7d32' : '1px solid #ccc',
                                                        background: isExcused ? '#e8f5e9' : '#fff',
                                                        color: isExcused ? '#2e7d32' : '#666',
                                                        fontWeight: isExcused ? 'bold' : 'normal',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    بعذر
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleExcusedToggle(student.attendance_id, false)}
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        padding: '0.25rem 0.45rem',
                                                        borderRadius: '4px',
                                                        border: !isExcused ? '1.5px solid #d32f2f' : '1px solid #ccc',
                                                        background: !isExcused ? '#ffebee' : '#fff',
                                                        color: !isExcused ? '#d32f2f' : '#666',
                                                        fontWeight: !isExcused ? 'bold' : 'normal',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    بدون عذر
                                                </button>
                                            </div>
                                        ) : (
                                            <span style={{
                                                fontSize: '0.82rem',
                                                color: '#e65100',
                                                fontWeight: 'bold',
                                                background: '#fff3e0',
                                                padding: '0.3rem 0.5rem',
                                                borderRadius: '6px',
                                                border: '1px solid #ffe0b2'
                                            }}>
                                                {isExcused ? 'بعذر' : 'بدون عذر'}
                                            </span>
                                        )
                                    )}
                                </div>

                                {/* Behavior Select */}
                                <div style={{ flex: 1.5, padding: '0 0.4rem' }}>
                                    <div style={{ position: 'relative' }}>
                                        <select
                                            disabled={!isEditMode}
                                            value={student.behavior_score !== undefined ? student.behavior_score : 10}
                                            onChange={(e) => handleBehaviorChange(student.attendance_id, e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '0.45rem 0.5rem',
                                                border: '1px solid #ccc',
                                                borderRadius: '6px',
                                                appearance: 'none',
                                                background: isEditMode ? '#fff' : '#f9f9f9',
                                                textAlign: 'center',
                                                fontSize: '0.82rem',
                                                fontWeight: student.behavior_score === 0 ? 'bold' : 'normal',
                                                color: student.behavior_score === 0 ? '#c62828' : '#333',
                                                cursor: isEditMode ? 'pointer' : 'default'
                                            }}
                                        >
                                            {BEHAVIOR_OPTIONS.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                        <CaretDown size={12} color="#888" style={{ position: 'absolute', top: '50%', left: '0.4rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                    </div>
                                </div>

                                {/* Evaluation Badge */}
                                <div style={{ flex: 1.5, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0 0.4rem' }}>
                                    <PageEvaluationsList 
                                        evaluations={student.evaluations} 
                                        onEvaluateClick={() => setEvaluatingStudent(student)}
                                    />
                                </div>

                                {/* Notes & Actions */}
                                <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: '0.4rem', position: 'relative' }}>
                                    <input
                                        type="text"
                                        disabled={!isEditMode}
                                        value={student.notes || ''}
                                        onChange={(e) => handleNotesChange(student.attendance_id, e.target.value)}
                                        placeholder={isEditMode ? 'أدخل ملاحظة...' : ''}
                                        style={{
                                            flex: 1,
                                            padding: '0.45rem',
                                            border: '1px solid #eee',
                                            borderRadius: '6px',
                                            outline: 'none',
                                            color: '#333',
                                            background: isEditMode ? '#fff' : '#f9f9f9',
                                            textAlign: 'right',
                                            fontSize: '0.82rem'
                                        }}
                                    />
                                    {isEditMode && (
                                        <button
                                            type="button"
                                            onClick={() => setActiveMenuId(activeMenuId === student.attendance_id ? null : student.attendance_id)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: '0.3rem',
                                                color: '#888'
                                            }}
                                        >
                                            <DotsThreeVertical size={18} weight="bold" />
                                        </button>
                                    )}

                                    {/* Menu for Late toggle */}
                                    {isEditMode && activeMenuId === student.attendance_id && (
                                        <div
                                            ref={menuRef}
                                            style={{
                                                position: 'absolute',
                                                left: 0,
                                                top: '100%',
                                                zIndex: 50,
                                                background: '#fff',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                                borderRadius: '8px',
                                                border: '1px solid #eee',
                                                width: '130px',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => toggleLateStatus(student.attendance_id)}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.6rem 0.8rem',
                                                    background: student.is_late ? '#fff3e0' : 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    fontSize: '0.85rem',
                                                    color: student.is_late ? '#e65100' : '#333',
                                                    fontWeight: student.is_late ? 'bold' : 'normal'
                                                }}
                                            >
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    <Clock size={16} color="#e65100" />
                                                    متأخر
                                                </span>
                                                {student.is_late && <Check size={16} color="#e65100" weight="bold" />}
                                            </button>
                                        </div>
                                    )}
                                </div>

                            </div>
                        );
                    })}
                </div>
            )}

            {/* Save Button */}
            {isEditMode && !loading && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2.5rem' }}>
                    <button 
                        onClick={() => handleSaveSession()}
                        disabled={saving}
                        style={{
                            backgroundColor: '#f57c00',
                            color: '#fff',
                            border: 'none',
                            padding: '0.85rem 3.5rem',
                            borderRadius: '10px',
                            fontWeight: 'bold',
                            fontSize: '1.2rem',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            boxShadow: '0 4px 12px rgba(245,124,0,0.3)',
                            transition: 'all 0.2s',
                            opacity: saving ? 0.7 : 1
                        }}
                    >
                        {saving ? 'جاري الحفظ...' : 'حفظ الجلسة'}
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
                readOnly={!isEditMode}
                canEdit={isEditMode}
            />

            {/* Alternative Date Picker Modal for Conflict Resolution */}
            <AlternativeDatePickerModal
                isOpen={showDatePickerModal}
                onClose={() => setShowDatePickerModal(false)}
                onSelectDate={handleSelectAlternativeDate}
                halaqaId={selectedRingId}
                conflictingDate={conflictDate}
                excludeSessionId={sessionId}
                title="تعارض في تاريخ الجلسة"
                message={`توجد جلسة مسجلة مسبقاً لهذه الحلقة في التاريخ المحدد.`}
            />
        </div>
    );
};

export default AdminSessionDetail;
