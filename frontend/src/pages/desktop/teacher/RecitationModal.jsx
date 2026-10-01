import React, { useState, useEffect, useRef } from 'react';
import { X, BookOpen, User, CheckCircle, WarningCircle, LockSimple, PencilSimple } from '@phosphor-icons/react';
import { evaluateRecitation, updateRecitationEvaluation } from '../../../services/api/tenantService';

/**
 * RecitationModal
 *
 * Props:
 *  - isOpen              : boolean
 *  - onClose             : () => void  — no data side-effects
 *  - student             : object      — includes student.evaluations[]
 *  - evaluationTemplate  : { grades: [{ id, name, color_code, requires_repeat }] }
 *  - onEvaluationSuccess : (attendanceId, reachedPage, evaluation, isUpdate) => void
 *  - readOnly            : boolean     — true = previous session (full read-only, no edit)
 *  - canEdit             : boolean     — true = active session before save (allow editing existing evals)
 */
const RecitationModal = ({
    isOpen,
    onClose,
    student,
    evaluationTemplate,
    onEvaluationSuccess,
    readOnly = false,
    canEdit = false
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // Set of page numbers already evaluated (prevents duplicates)
    const [evaluatedPages, setEvaluatedPages] = useState(new Set());

    // The saved evaluation object for the currently displayed page
    const [currentPageResult, setCurrentPageResult] = useState(null);

    // Whether the teacher is actively editing an already-evaluated page
    const [isEditingPage, setIsEditingPage] = useState(false);

    // Guard against rapid double-clicks
    const submittingRef = useRef(false);

    // ── Initialise state whenever modal opens ────────────────────────────────
    useEffect(() => {
        if (isOpen && student) {
            const alreadyEval = new Set(
                (student.evaluations || []).map(ev => ev.page_number)
            );
            setEvaluatedPages(alreadyEval);

            const nextPage = (student.reached_page || 0) + 1;
            setCurrentPage(nextPage);
            setNotes('');
            setError(null);
            setSuccessMessage(null);
            setCurrentPageResult(null);
            setIsEditingPage(false);
            submittingRef.current = false;
        }
    }, [isOpen, student]);

    // Sync currentPageResult whenever currentPage or evaluations change
    useEffect(() => {
        if (!student) return;
        const existing = (student.evaluations || []).find(
            ev => ev.page_number === currentPage
        );
        setCurrentPageResult(existing || null);
        setIsEditingPage(false);
        setError(null);
        setSuccessMessage(null);
    }, [currentPage, student]);

    if (!isOpen || !student) return null;

    const grades = evaluationTemplate?.grades || [];
    const isCurrentPageEvaluated = evaluatedPages.has(currentPage) || currentPageResult !== null;

    // ── Submit new evaluation ────────────────────────────────────────────────
    const handleGradeSelect = async (grade) => {
        if (submittingRef.current || submitting) return;
        if (readOnly) return;
        // In edit mode, only allow if explicitly editing or page not yet evaluated
        if (isCurrentPageEvaluated && !isEditingPage) return;

        submittingRef.current = true;
        setSubmitting(true);
        setError(null);
        setSuccessMessage(null);

        try {
            let response;

            if (isEditingPage && currentPageResult?.id) {
                // ── UPDATE existing evaluation ──
                const payload = {
                    evaluation_grade_id: grade.id,
                    grade: grade.name,
                    notes: notes
                };
                response = await updateRecitationEvaluation(currentPageResult.id, payload);
            } else {
                // ── CREATE new evaluation ──
                const payload = {
                    attendance_id: student.attendance_id,
                    student_id: student.student_id,
                    page_number: currentPage,
                    evaluation_grade_id: grade.id,
                    grade: grade.name,
                    notes: notes,
                    recitation_type: 'NEW_MEMORIZATION'
                };
                response = await evaluateRecitation(payload);
            }

            if (response.status === 'success') {
                const data = response.data;
                const savedEval = {
                    id: data.recitation_id,
                    page_number: currentPage,
                    grade: grade.name,
                    color_code: grade.color_code,
                    requires_repeat: data.requires_repeat ?? false,
                    notes: notes
                };

                // Lock this page locally
                setEvaluatedPages(prev => new Set([...prev, currentPage]));
                setCurrentPageResult(savedEval);
                setIsEditingPage(false);
                setSuccessMessage(
                    isEditingPage
                        ? `تم تعديل تقييم الصفحة (${currentPage}) بنجاح`
                        : response.message || `تم تسجيل تقييم الصفحة (${currentPage}) بنجاح`
                );
                setNotes('');

                if (onEvaluationSuccess) {
                    onEvaluationSuccess(
                        student.attendance_id,
                        data.reached_page ?? student.reached_page,
                        savedEval,
                        isEditingPage  // isUpdate flag
                    );
                }

                // Auto-advance only on new evaluation + can recite next
                if (!isEditingPage && data.can_recite_next && !data.requires_repeat) {
                    setTimeout(() => {
                        setCurrentPage(data.next_page);
                        setCurrentPageResult(null);
                        setSuccessMessage(null);
                    }, 1800);
                }
            } else {
                setError(response.message || 'حدث خطأ أثناء التقييم');
                if (response.code === 'ALREADY_EVALUATED') {
                    setEvaluatedPages(prev => new Set([...prev, currentPage]));
                }
                if (response.code === 'SESSION_LOCKED') {
                    setIsEditingPage(false);
                }
            }
        } catch (err) {
            console.error(err);
            const status = err?.response?.status;
            const serverMsg = err?.response?.data?.message;
            const serverCode = err?.response?.data?.code;

            if (status === 409) {
                setError(serverMsg || `تم تقييم الصفحة (${currentPage}) مسبقاً في هذه الجلسة`);
                setEvaluatedPages(prev => new Set([...prev, currentPage]));
            } else if (status === 403 && serverCode === 'SESSION_LOCKED') {
                setError(serverMsg || 'الجلسة محفوظة ومقفلة — لا يمكن التعديل');
                setIsEditingPage(false);
            } else {
                setError('حدث خطأ في الاتصال بالخادم');
            }
        } finally {
            setSubmitting(false);
            submittingRef.current = false;
        }
    };

    // ── Styles ────────────────────────────────────────────────────────────────
    const headerBg = readOnly ? '#fafafa' : canEdit ? '#f1f8e9' : '#f1f8e9';

    return (
        <div
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1000, direction: 'rtl'
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: '#fff', width: '100%', maxWidth: '520px',
                    borderRadius: '16px', boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
                    position: 'relative', overflow: 'hidden'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '1.2rem 1.5rem 1rem',
                    borderBottom: '1px solid #eee',
                    background: headerBg
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{
                            background: readOnly ? '#e8eaf6' : '#c8e6c9',
                            padding: '0.5rem', borderRadius: '50%', display: 'flex'
                        }}>
                            <BookOpen size={22} color={readOnly ? '#3949ab' : '#2e7d32'} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, color: '#133315', fontSize: '1.15rem', fontWeight: 'bold' }}>
                                {readOnly
                                    ? 'عرض تقييم تسميع'
                                    : isEditingPage
                                        ? 'تعديل تقييم تسميع'
                                        : 'إضافة تقييم تسميع'}
                            </h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#555', fontSize: '0.88rem', marginTop: '0.15rem' }}>
                                <User size={14} />
                                <span style={{ fontWeight: '600' }}>{student.student_name}</span>
                            </div>
                        </div>
                    </div>

                    {/* ── Close Button — always visible ── */}
                    <button
                        id="recitation-modal-close-btn"
                        onClick={onClose}
                        title="إغلاق"
                        aria-label="إغلاق نافذة التقييم"
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: '#fff', border: '1.5px solid #ccc', borderRadius: '50%',
                            width: '36px', height: '36px', cursor: 'pointer', flexShrink: 0,
                            transition: 'border-color 0.2s, background 0.2s'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.borderColor = '#c62828';
                            e.currentTarget.style.background = '#ffebee';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.borderColor = '#ccc';
                            e.currentTarget.style.background = '#fff';
                        }}
                    >
                        <X size={18} color="#555" />
                    </button>
                </div>

                {/* ── Body ── */}
                <div style={{ padding: '1.5rem' }}>

                    {/* Error Banner */}
                    {error && (
                        <div style={{
                            background: '#ffebee', color: '#c62828',
                            padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem',
                            display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                            fontSize: '0.88rem', border: '1px solid #ffcdd2'
                        }}>
                            <WarningCircle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Success Banner */}
                    {successMessage && (
                        <div style={{
                            background: '#e8f5e9', color: '#2e7d32',
                            padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem',
                            display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                            fontSize: '0.88rem', border: '1px solid #c8e6c9'
                        }}>
                            <CheckCircle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
                            <span>{successMessage}</span>
                        </div>
                    )}

                    {/* Current Page */}
                    <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                        <p style={{ color: '#888', marginBottom: '0.4rem', fontSize: '0.9rem' }}>
                            رقم الصفحة الحالية
                        </p>
                        <div style={{
                            fontSize: '3rem', fontWeight: 'bold', lineHeight: 1,
                            color: isCurrentPageEvaluated && !isEditingPage ? '#9e9e9e' : '#f57c00'
                        }}>
                            {currentPage}
                        </div>
                    </div>

                    {/* ── LOCKED STATE: page already evaluated ── */}
                    {isCurrentPageEvaluated && !isEditingPage ? (
                        <div style={{
                            background: '#f5f5f5', border: '1.5px solid #e0e0e0',
                            borderRadius: '10px', padding: '1.2rem', textAlign: 'center'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.6rem' }}>
                                <LockSimple size={32} color="#9e9e9e" weight="fill" />
                            </div>
                            <p style={{ color: '#666', fontWeight: 'bold', marginBottom: '0.6rem', fontSize: '0.95rem' }}>
                                تم تقييم هذه الصفحة مسبقاً
                            </p>
                            {currentPageResult && (
                                <div style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                    background: currentPageResult.color_code || '#558b2f',
                                    color: '#fff', padding: '0.5rem 1.2rem',
                                    borderRadius: '20px', fontWeight: 'bold', fontSize: '0.95rem',
                                    marginBottom: '0.8rem'
                                }}>
                                    <CheckCircle size={16} weight="fill" />
                                    {currentPageResult.grade}
                                    {currentPageResult.requires_repeat && (
                                        <span style={{ fontSize: '0.8rem', opacity: 0.9 }}> (إعادة)</span>
                                    )}
                                </div>
                            )}

                            {/* Edit button: only shown in active (unsaved) session */}
                            {canEdit && !readOnly && (
                                <div style={{ marginTop: '0.5rem' }}>
                                    <button
                                        id="edit-evaluation-btn"
                                        onClick={() => {
                                            setIsEditingPage(true);
                                            setError(null);
                                            setSuccessMessage(null);
                                            setNotes(currentPageResult?.notes || '');
                                        }}
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                                            background: '#fff3e0', color: '#e65100',
                                            border: '1.5px solid #ffcc80', borderRadius: '8px',
                                            padding: '0.5rem 1.2rem', fontWeight: 'bold',
                                            fontSize: '0.88rem', cursor: 'pointer',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#ffe0b2'}
                                        onMouseLeave={e => e.currentTarget.style.background = '#fff3e0'}
                                    >
                                        <PencilSimple size={16} />
                                        تعديل التقييم
                                    </button>
                                    <p style={{ color: '#aaa', fontSize: '0.78rem', marginTop: '0.6rem' }}>
                                        يمكنك تعديل التقييم قبل حفظ الجلسة فقط
                                    </p>
                                </div>
                            )}

                            {/* If fully read-only (saved session), show lock message */}
                            {(readOnly || !canEdit) && (
                                <p style={{ color: '#aaa', fontSize: '0.8rem', marginTop: '0.4rem' }}>
                                    {readOnly
                                        ? 'الجلسة محفوظة — لا يمكن التعديل'
                                        : 'لا يمكن تعديل التقييم في هذا الوضع'}
                                </p>
                            )}
                        </div>
                    ) : (
                        /* ── ACTIVE STATE: new evaluation or editing existing ── */
                        <>
                            {/* Editing banner */}
                            {isEditingPage && (
                                <div style={{
                                    background: '#fff8e1', border: '1px solid #ffe082',
                                    borderRadius: '8px', padding: '0.7rem 1rem',
                                    marginBottom: '1rem', fontSize: '0.85rem', color: '#e65100',
                                    display: 'flex', alignItems: 'center', gap: '0.5rem'
                                }}>
                                    <PencilSimple size={16} />
                                    <span>
                                        أنت تعدّل التقييم الحالي للصفحة ({currentPage}).
                                        اختر التقييم الصحيح أدناه.
                                    </span>
                                    <button
                                        onClick={() => {
                                            setIsEditingPage(false);
                                            setError(null);
                                            setSuccessMessage(null);
                                        }}
                                        style={{
                                            marginRight: 'auto', background: 'none', border: 'none',
                                            cursor: 'pointer', color: '#e65100', fontWeight: 'bold',
                                            fontSize: '0.82rem', textDecoration: 'underline'
                                        }}
                                    >
                                        إلغاء التعديل
                                    </button>
                                </div>
                            )}

                            {/* Notes input */}
                            <div style={{ marginBottom: '1.2rem' }}>
                                <input
                                    type="text"
                                    placeholder="ملاحظات حول التسميع (اختياري)..."
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    disabled={submitting || readOnly}
                                    style={{
                                        width: '100%', padding: '0.75rem',
                                        border: '1px solid #ddd', borderRadius: '8px',
                                        outline: 'none', fontFamily: 'inherit', fontSize: '0.9rem',
                                        background: (submitting || readOnly) ? '#f9f9f9' : '#fff',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            {/* Grade buttons */}
                            <div>
                                <p style={{ color: '#555', marginBottom: '0.8rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                    {isEditingPage ? 'اختر التقييم الجديد:' : 'تقييم الأداء:'}
                                </p>
                                {grades.length > 0 ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                        {grades.map(grade => {
                                            const isCurrentGrade = isEditingPage &&
                                                currentPageResult?.grade === grade.name;
                                            return (
                                                <button
                                                    key={grade.id}
                                                    id={`grade-btn-${grade.id}`}
                                                    onClick={() => handleGradeSelect(grade)}
                                                    disabled={submitting || readOnly}
                                                    style={{
                                                        backgroundColor: grade.color_code || '#558b2f',
                                                        color: '#fff',
                                                        border: isCurrentGrade
                                                            ? '3px solid #fff'
                                                            : '3px solid transparent',
                                                        outline: isCurrentGrade
                                                            ? `2px solid ${grade.color_code || '#558b2f'}`
                                                            : 'none',
                                                        outlineOffset: '1px',
                                                        padding: '0.9rem',
                                                        borderRadius: '8px', fontWeight: 'bold',
                                                        fontSize: '0.95rem',
                                                        cursor: submitting ? 'not-allowed' : 'pointer',
                                                        opacity: submitting ? 0.6 : 1,
                                                        transition: 'transform 0.1s, opacity 0.2s',
                                                        fontFamily: 'inherit', position: 'relative'
                                                    }}
                                                    onMouseDown={e => { if (!submitting) e.currentTarget.style.transform = 'scale(0.97)'; }}
                                                    onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                                                >
                                                    {submitting ? 'جاري الحفظ...' : grade.name}
                                                    {isCurrentGrade && (
                                                        <span style={{
                                                            position: 'absolute', top: '-8px', left: '-8px',
                                                            background: '#fff', borderRadius: '50%',
                                                            padding: '1px', display: 'flex'
                                                        }}>
                                                            <CheckCircle size={16}
                                                                color={grade.color_code || '#558b2f'}
                                                                weight="fill" />
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p style={{ color: '#c62828', textAlign: 'center', fontSize: '0.9rem' }}>
                                        نموذج التقييم غير متوفر لهذه الحلقة.
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RecitationModal;
