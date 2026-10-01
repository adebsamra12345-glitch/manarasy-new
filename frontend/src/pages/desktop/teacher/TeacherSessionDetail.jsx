import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Bell, CaretDown, Users, MagnifyingGlass, UserCircle, DotsThreeVertical, Clock, Check, FilePdf, CalendarBlank } from '@phosphor-icons/react';
import { getHalaqat, getTeacherSessionDetail, startSession, updateSessionDetails } from '../../../services/api/tenantService';
import { useAuthContext } from '../../../context/AuthContext';
import RecitationModal from './RecitationModal';
import useDeviceType from '../../../hooks/useDeviceType';
import MobileAttendanceSession from '../../mobile/teacher/MobileAttendanceSession';
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

const TeacherSessionDetail = () => {
    const { isMobile } = useDeviceType();
    const { ringId, sessionId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuthContext();

    if (isMobile) {
        return <MobileAttendanceSession />;
    }
    
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
                console.error(err);
            }
        };
        fetchRings();
    }, []);

    useEffect(() => {
        const loadSessionData = async () => {
            if (!sessionId || sessionId === 'new') return;
            
            setLoading(true);
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
                console.error(err);
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
        const basePath = location.pathname.startsWith('/admin') ? '/admin' : '/teacher';
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
        const dateToSave = (typeof customDate === 'string' && customDate) ? customDate : sessionDate;

        // التحقق من منع التواريخ المستقبلية
        const todayISO = new Date().toISOString().slice(0, 10);
        if (dateToSave > todayISO) {
            alert('لا يمكن إنشاء جلسة بتاريخ مستقبلي. يرجى اختيار تاريخ اليوم أو أي تاريخ سابق.');
            setSaving(false);
            return;
        }

        try {
            const payload = {
                session_date: dateToSave,
                modified_by_id: user?.id,
                modified_by_name: localStorage.getItem('username') || user?.username,
                change_reason: 'تعديل تاريخ الجلسة من شاشة التقييمات',
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
                alert('تم حفظ تفاصيل الجلسة وتحديث التاريخ بنجاح!');
                const basePath = location.pathname.startsWith('/admin') ? '/admin' : '/teacher';
                navigate(`${basePath}/rings/${selectedRingId}/sessions/${sessionId}`);
            } else {
                alert(response.message || 'حدث خطأ أثناء الحفظ');
            }
        } catch (err) {
            console.error(err);
            if (err.response?.status === 409 || err.response?.data?.error_code === 'SESSION_DATE_CONFLICT') {
                const confDate = err.response?.data?.conflicting_date || dateToSave;
                setConflictDate(confDate);
                setShowDatePickerModal(true);
            } else {
                alert(err.response?.data?.message || 'حدث خطأ في الاتصال بالخادم');
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
                    // Replace the existing evaluation for this page
                    updatedEvals = updatedEvals.map(ev =>
                        ev.page_number === newEvaluation.page_number ? newEvaluation : ev
                    );
                } else {
                    // Append the new evaluation
                    updatedEvals = [...updatedEvals, newEvaluation];
                }
            }
            return { ...st, reached_page: newReachedPage, evaluations: updatedEvals };
        }));
    };

    const filteredStudents = students.filter(st => 
        st.student_name.toLowerCase().includes(searchQuery.toLowerCase())
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
        <div className="dashboard-container" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', direction: 'rtl' }}>
            {/* Header */}
            <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '2.2rem', color: '#1a3b1c', fontWeight: 'bold' }}>طلاب الحلقة {isEditMode ? '' : '(للقراءة فقط)'}</h2>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', width: '60%' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <input 
                            type="text" 
                            placeholder="ابحث عن طالب ..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ 
                                padding: '0.5rem 2.5rem 0.5rem 1rem', 
                                border: '1px solid #ddd', 
                                borderRadius: '8px',
                                width: '100%',
                                outline: 'none'
                            }} 
                        />
                        <MagnifyingGlass size={18} color="#888" style={{ position: 'absolute', top: '50%', right: '0.5rem', transform: 'translateY(-50%)' }} />
                    </div>
                    <button 
                        disabled={exporting}
                        onClick={handleExportPdfDetail}
                        style={{ 
                            backgroundColor: '#fff', 
                            color: '#c62828', 
                            border: '1px solid #c62828', 
                            padding: '0.6rem 1.2rem', 
                            borderRadius: '8px', 
                            fontWeight: 'bold',
                            cursor: exporting ? 'wait' : 'pointer',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                        }}
                    >
                        <FilePdf size={18} weight="fill" color="#c62828" />
                        {exporting ? 'جاري التصدير...' : 'تصدير تقرير الجلسة PDF'}
                    </button>
                    <button 
                        style={{ 
                            backgroundColor: '#558b2f', 
                            color: '#fff', 
                            border: 'none', 
                            padding: '0.6rem 1.5rem', 
                            borderRadius: '8px', 
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        طلب تسجيل طالب
                    </button>
                </div>
            </div>

            {/* Session Info & Date Management Bar */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '12px',
                padding: '0.85rem 1.25rem',
                marginBottom: '1.25rem',
                boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                    {/* Date Selector / Display */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            backgroundColor: '#f1f8e9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#558b2f'
                        }}>
                            <CalendarBlank size={18} weight="bold" />
                        </div>
                        <span style={{ fontWeight: 'bold', color: '#133315', fontSize: '0.95rem' }}>
                            تاريخ الجلسة:
                        </span>
                        {isEditMode ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                    type="date"
                                    value={sessionDate}
                                    onChange={(e) => setSessionDate(e.target.value)}
                                    style={{
                                        padding: '0.45rem 0.85rem',
                                        border: '1.5px solid #81b255',
                                        borderRadius: '8px',
                                        outline: 'none',
                                        color: '#133315',
                                        fontWeight: 'bold',
                                        fontSize: '0.95rem',
                                        backgroundColor: '#f9fbe7'
                                    }}
                                />
                                <span style={{ fontSize: '0.78rem', color: '#666' }}>
                                    (يمكنك تعديل التاريخ قبل الحفظ)
                                </span>
                            </div>
                        ) : (
                            <span style={{
                                padding: '0.4rem 0.9rem',
                                backgroundColor: '#f1f8e9',
                                color: '#2e7d32',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                fontSize: '0.95rem'
                            }}>
                                {sessionDate ? new Date(sessionDate).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'غير محدد'}
                            </span>
                        )}
                    </div>

                    {/* Change indicator badge */}
                    {isEditMode && sessionDate && originalSessionDate && sessionDate !== originalSessionDate && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            backgroundColor: '#fff3e0',
                            border: '1px solid #ffe082',
                            color: '#e65100',
                            padding: '0.3rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: '600'
                        }}>
                            <span>التاريخ الأصلي: {originalSessionDate} ← الجديد: {sessionDate}</span>
                        </div>
                    )}
                </div>

                {/* Quick Action Button in Toolbar */}
                {isEditMode ? (
                    <button
                        onClick={() => handleSaveSession()}
                        disabled={saving}
                        style={{
                            backgroundColor: '#558b2f',
                            color: '#fff',
                            border: 'none',
                            padding: '0.55rem 1.4rem',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            cursor: saving ? 'wait' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            boxShadow: '0 2px 6px rgba(85,139,47,0.3)',
                            fontSize: '0.9rem'
                        }}
                    >
                        <Check size={16} weight="bold" />
                        {saving ? 'جاري الحفظ...' : 'حفظ التقييمات والتاريخ'}
                    </button>
                ) : (
                    <button
                        onClick={() => navigate(`/teacher/rings/${selectedRingId}/sessions/${sessionId}?edit=true`)}
                        style={{
                            backgroundColor: '#f1f8e9',
                            color: '#33691e',
                            border: '1px solid #c5e1a5',
                            padding: '0.45rem 1.1rem',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            fontSize: '0.88rem'
                        }}
                    >
                        تعديل تاريخ الجلسة والتقييمات
                    </button>
                )}
            </div>
            
            {/* Table Header */}
            <div style={{ display: 'flex', backgroundColor: '#e0e0e0', padding: '1rem', borderTopLeftRadius: '8px', borderTopRightRadius: '8px', fontWeight: 'bold', color: '#333', textAlign: 'center' }}>
                <div style={{ flex: 1.8 }}>الطالب</div>
                <div style={{ flex: 2.2, borderRight: '1px solid #aaa' }}>الحضور والغياب</div>
                <div style={{ flex: 1.5, borderRight: '1px solid #aaa' }}>السلوك</div>
                <div style={{ flex: 1.5, borderRight: '1px solid #aaa' }}>التقييم</div>
                <div style={{ flex: 1.8, borderRight: '1px solid #aaa' }}>ملاحظات</div>
                <div style={{ width: '40px', borderRight: '1px solid #aaa' }}></div>
            </div>

            {/* Table Body */}
            {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#558b2f' }}>جاري تحميل تفاصيل الجلسة...</div>
            ) : error ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#c62828' }}>{error}</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
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
                                borderRadius: '8px', 
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

                                {/* Attendance Status Options (Present / Absent & Excused Checkbox) */}
                                <div style={{ flex: 2.2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
                                    {/* Present Button */}
                                    <button 
                                        type="button"
                                        disabled={!isEditMode}
                                        onClick={() => handleAttendanceChange(student.attendance_id, 'PRESENT')}
                                        style={{
                                            padding: '0.4rem 0.8rem',
                                            border: `1.5px solid ${isPresent ? '#2e7d32' : '#ccc'}`,
                                            borderRadius: '6px',
                                            background: isPresent ? '#e8f5e9' : '#fff',
                                            color: isPresent ? '#2e7d32' : '#666',
                                            fontWeight: isPresent ? 'bold' : 'normal',
                                            cursor: isEditMode ? 'pointer' : 'default',
                                            fontSize: '0.85rem',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        حاضر
                                    </button>

                                    {/* Absent Button */}
                                    <button 
                                        type="button"
                                        disabled={!isEditMode}
                                        onClick={() => handleAttendanceChange(student.attendance_id, isExcused ? 'EXCUSED' : 'ABSENT')}
                                        style={{
                                            padding: '0.4rem 0.8rem',
                                            border: `1.5px solid ${isAbsent ? '#d32f2f' : '#ccc'}`,
                                            borderRadius: '6px',
                                            background: isAbsent ? '#ffebee' : '#fff',
                                            color: isAbsent ? '#d32f2f' : '#666',
                                            fontWeight: isAbsent ? 'bold' : 'normal',
                                            cursor: isEditMode ? 'pointer' : 'default',
                                            fontSize: '0.85rem',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        غائب
                                    </button>

                                    {/* Excused Checkbox (Only visible when Absent is selected) */}
                                    {isAbsent && (
                                        <label style={{ 
                                            display: 'inline-flex', 
                                            alignItems: 'center', 
                                            gap: '0.3rem', 
                                            fontSize: '0.82rem', 
                                            color: '#e65100', 
                                            fontWeight: 'bold',
                                            cursor: isEditMode ? 'pointer' : 'default',
                                            background: '#fff3e0',
                                            padding: '0.3rem 0.5rem',
                                            borderRadius: '6px',
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

                                {/* Behavior Select */}
                                <div style={{ flex: 1.5, padding: '0 0.4rem' }}>
                                    <div style={{ position: 'relative' }}>
                                        <select
                                            disabled={!isEditMode}
                                            value={student.behavior_score !== undefined ? student.behavior_score : 10}
                                            onChange={(e) => handleBehaviorChange(student.attendance_id, e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '0.4rem 0.5rem',
                                                border: '1px solid #ccc',
                                                borderRadius: '6px',
                                                appearance: 'none',
                                                background: '#fff',
                                                textAlign: 'center',
                                                fontSize: '0.8rem',
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

                                {/* Evaluation */}
                                <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '0 0.4rem', gap: '0.5rem' }}>
                                    {isEditMode ? (
                                        // New Session Mode: paginated evaluations list + "Add Evaluation" button
                                        <>
                                            <PageEvaluationsList evaluations={student.evaluations} />
                                            {student.status === 'PRESENT' && (
                                                <button
                                                    type="button"
                                                    onClick={() => setEvaluatingStudent(student)}
                                                    style={{
                                                        background: '#e3f2fd',
                                                        color: '#1565c0',
                                                        border: '1px solid #90caf9',
                                                        padding: '0.3rem 0.6rem',
                                                        borderRadius: '4px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 'bold',
                                                        cursor: 'pointer',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    + إضافة تقييم
                                                </button>
                                            )}
                                        </>
                                    ) : (
                                        // Previous Session Review Mode: read-only full unordered list
                                        student.evaluations && student.evaluations.length > 0 ? (
                                            <ul style={{
                                                listStyle: 'disc',
                                                paddingRight: '1.2rem',
                                                margin: 0,
                                                width: '100%',
                                                fontSize: '0.8rem',
                                                color: '#333',
                                                lineHeight: '1.6'
                                            }}>
                                                {student.evaluations.map((ev, idx) => {
                                                    const gradeStr = String(ev.grade || '');
                                                    const formattedGrade = gradeStr.endsWith('%') || isNaN(gradeStr)
                                                        ? gradeStr
                                                        : `${gradeStr}%`;
                                                    return (
                                                        <li key={ev.id || idx} style={{ marginBottom: '0.15rem' }}>
                                                            صفحة {ev.page_number} — {formattedGrade}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        ) : (
                                            <span style={{ color: '#999', fontSize: '0.82rem', fontStyle: 'italic' }}>
                                                لا توجد تقييمات
                                            </span>
                                        )
                                    )}
                                </div>

                                {/* Notes */}
                                <div style={{ flex: 1.8 }}>
                                    <input 
                                        type="text" 
                                        placeholder="ملاحظات..."
                                        disabled={!isEditMode}
                                        value={student.notes || ''}
                                        onChange={(e) => handleNotesChange(student.attendance_id, e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '0.4rem',
                                            border: '1px solid #eee',
                                            borderRadius: '4px',
                                            outline: 'none',
                                            fontSize: '0.82rem',
                                            color: '#555',
                                            background: isEditMode ? '#f9f9f9' : '#fff'
                                        }}
                                    />
                                </div>

                                {/* Contextual 3-Dot Menu Button (Late Arrival Toggle) */}
                                <div style={{ width: '40px', position: 'relative', display: 'flex', justifyContent: 'center' }}>
                                    {isEditMode && (
                                        <button
                                            type="button"
                                            onClick={() => setActiveMenuId(activeMenuId === student.attendance_id ? null : student.attendance_id)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: '0.3rem',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: student.is_late ? '#e65100' : '#666'
                                            }}
                                            title="خيارات إضافية"
                                        >
                                            <DotsThreeVertical size={20} weight="bold" />
                                        </button>
                                    )}

                                    {/* Action Dropdown Menu */}
                                    {activeMenuId === student.attendance_id && (
                                        <div 
                                            ref={menuRef}
                                            style={{
                                                position: 'absolute',
                                                top: '100%',
                                                left: 0,
                                                zIndex: 100,
                                                background: '#fff',
                                                borderRadius: '8px',
                                                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                                                border: '1px solid #eee',
                                                minWidth: '150px',
                                                overflow: 'hidden',
                                                textAlign: 'right'
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
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
                    <button 
                        onClick={() => handleSaveSession()}
                        disabled={saving}
                        style={{
                            backgroundColor: '#f57c00',
                            color: '#fff',
                            border: 'none',
                            padding: '0.8rem 3rem',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            fontSize: '1.2rem',
                            cursor: saving ? 'not-allowed' : 'pointer',
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
                message="توجد جلسة مسجلة مسبقاً لهذه الحلقة في التاريخ المحدد."
            />
        </div>
    );
};

export default TeacherSessionDetail;

