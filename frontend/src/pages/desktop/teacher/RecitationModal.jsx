import React, { useState, useEffect, useRef } from 'react';
import { 
    X, BookOpen, User, CheckCircle, WarningCircle, LockSimple, 
    PencilSimple, Plus, Minus, ArrowsClockwise, Check
} from '@phosphor-icons/react';
import { evaluateRecitation, updateRecitationEvaluation } from '../../../services/api/tenantService';
import { JUZ_AMMA_SURAHS, getSurahName } from '../../../utils/quranData';

/**
 * RecitationModal
 *
 * Props:
 *  - isOpen              : boolean
 *  - onClose             : () => void  — no data side-effects
 *  - student             : object      — includes student.evaluations[], student.project
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
    const project = student?.project || student?.halaqa?.project || {};
    const isReverse = project?.recitation_direction === 'REVERSE';
    const isCustom = project?.project_type === 'CUSTOM';
    const isCustomUnit = isCustom && (project?.evaluation_unit === 'LESSONS' || project?.evaluation_unit === 'TOPICS');
    const unitLabel = project?.evaluation_unit === 'LESSONS' ? 'الدرس' : (project?.evaluation_unit === 'TOPICS' ? 'المحور' : 'الصفحة');
    const unitPlural = project?.evaluation_unit === 'LESSONS' ? 'الدروس' : (project?.evaluation_unit === 'TOPICS' ? 'المحاور' : 'الصفحات');

    // Flatten all parts across all stages in the project
    const allProjectParts = [];
    (project?.stages || []).forEach(stage => {
        (stage.parts || []).forEach(pt => {
            allProjectParts.push({
                ...pt,
                stage_id: stage.id,
                stage_title: stage.title,
                stage_order: stage.order
            });
        });
    });

    const [evalMode, setEvalMode] = useState('PAGE'); // 'PAGE' or 'SURAH'
    const [selectedSurahs, setSelectedSurahs] = useState([]); // array of surah numbers
    const [surahFilter, setSurahFilter] = useState('');
    const [lessonTitle, setLessonTitle] = useState('');
    const [selectedPartId, setSelectedPartId] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // Set of page numbers already evaluated (prevents duplicates)
    const [evaluatedPages, setEvaluatedPages] = useState(new Set());
    const [evaluatedSurahs, setEvaluatedSurahs] = useState(new Set());
    const [evaluatedLessonTitles, setEvaluatedLessonTitles] = useState(new Set());

    // The saved evaluation object for the currently displayed page / lesson
    const [currentPageResult, setCurrentPageResult] = useState(null);

    // Whether the teacher is actively editing an already-evaluated page
    const [isEditingPage, setIsEditingPage] = useState(false);

    // Guard against rapid double-clicks
    const submittingRef = useRef(false);

    // ── Initialise state whenever modal opens ────────────────────────────────
    useEffect(() => {
        if (isOpen && student) {
            const alreadyEvalPages = new Set();
            const alreadyEvalSurahs = new Set();
            const alreadyEvalLessons = new Set();
            (student.evaluations || []).forEach(ev => {
                if (ev.page_number) alreadyEvalPages.add(ev.page_number);
                if (ev.surah_number) alreadyEvalSurahs.add(ev.surah_number);
                if (ev.lesson_title) alreadyEvalLessons.add(ev.lesson_title);
            });
            setEvaluatedPages(alreadyEvalPages);
            setEvaluatedSurahs(alreadyEvalSurahs);
            setEvaluatedLessonTitles(alreadyEvalLessons);

            // Compute default page based on project direction
            let defaultPage = 1;
            if (isReverse) {
                defaultPage = (student.reached_page && student.reached_page > 1) 
                    ? student.reached_page - 1 
                    : 604;
            } else {
                defaultPage = (student.reached_page || 0) + 1;
            }
            setCurrentPage(defaultPage);

            // Set initial selected part if project uses lessons or topics
            if (isCustomUnit) {
                const currentEnrolledPartId = student.enrollment?.part_id;
                const currentEnrolledPartTitle = student.enrollment?.part_title;
                const matchedById = allProjectParts.find(p => String(p.id) === String(currentEnrolledPartId));
                const matchedByTitle = allProjectParts.find(p => p.title === currentEnrolledPartTitle);

                if (matchedById) {
                    setSelectedPartId(matchedById.id);
                } else if (matchedByTitle) {
                    setSelectedPartId(matchedByTitle.id);
                } else if (allProjectParts.length > 0) {
                    setSelectedPartId(allProjectParts[0].id);
                } else {
                    setSelectedPartId('');
                }
            }

            setEvalMode('PAGE');
            setSelectedSurahs([]);
            setSurahFilter('');
            setLessonTitle('');
            setNotes('');
            setError(null);
            setSuccessMessage(null);
            setCurrentPageResult(null);
            setIsEditingPage(false);
            submittingRef.current = false;
        }
    }, [isOpen, student, isReverse, isCustomUnit]);

    // Sync currentPageResult whenever currentPage, selectedPartId, student, or evalMode changes
    useEffect(() => {
        if (!student) return;
        if (isCustomUnit) {
            const currentPart = allProjectParts.find(p => String(p.id) === String(selectedPartId));
            const targetTitle = currentPart ? currentPart.title : lessonTitle.trim();
            const existing = (student.evaluations || []).find(
                ev => ev.lesson_title && targetTitle && ev.lesson_title === targetTitle
            );
            setCurrentPageResult(existing || null);
        } else if (evalMode === 'PAGE') {
            const existing = (student.evaluations || []).find(
                ev => !ev.is_surah_evaluation && ev.page_number === currentPage
            );
            setCurrentPageResult(existing || null);
        } else if (evalMode === 'SURAH' && selectedSurahs.length === 1) {
            const existing = (student.evaluations || []).find(
                ev => ev.is_surah_evaluation && ev.surah_number === selectedSurahs[0]
            );
            setCurrentPageResult(existing || null);
        } else {
            setCurrentPageResult(null);
        }
        setIsEditingPage(false);
        setError(null);
        setSuccessMessage(null);
    }, [currentPage, student, evalMode, selectedSurahs, selectedPartId, isCustomUnit, lessonTitle]);

    if (!isOpen || !student) return null;

    const grades = evaluationTemplate?.grades || [];
    const currentPartObj = allProjectParts.find(p => String(p.id) === String(selectedPartId));

    // Check if current target is evaluated
    const isTargetEvaluated = isCustomUnit
        ? (currentPageResult !== null || (currentPartObj && evaluatedLessonTitles.has(currentPartObj.title)))
        : evalMode === 'PAGE' 
        ? (evaluatedPages.has(currentPage) || currentPageResult !== null)
        : (selectedSurahs.length === 1 && evaluatedSurahs.has(selectedSurahs[0]));

    // Toggle surah selection
    const handleToggleSurah = (surah) => {
        setSelectedSurahs(prev => {
            const exists = prev.includes(surah.number);
            let updated;
            if (exists) {
                updated = prev.filter(num => num !== surah.number);
            } else {
                updated = [...prev, surah.number];
            }
            // Auto update page to primary selected surah's page
            if (updated.length > 0) {
                const primary = JUZ_AMMA_SURAHS.find(s => s.number === updated[0]);
                if (primary) setCurrentPage(primary.page);
            }
            return updated;
        });
    };

    // Filtered Juz Amma surahs
    const filteredSurahs = JUZ_AMMA_SURAHS.filter(s => 
        s.name.includes(surahFilter.trim()) || 
        String(s.number).includes(surahFilter.trim())
    );

    // ── Submit evaluation ────────────────────────────────────────────────────
    const handleGradeSelect = async (grade) => {
        if (submittingRef.current || submitting) return;
        if (readOnly) return;
        if (isTargetEvaluated && !isEditingPage) return;

        if (isCustomUnit && allProjectParts.length > 0 && !selectedPartId) {
            setError(`الرجاء اختيار ${unitLabel} من القائمة المنسدلة`);
            return;
        }

        if (!isCustomUnit && evalMode === 'SURAH' && selectedSurahs.length === 0) {
            setError('الرجاء اختيار سورة واحدة على الأقل لتقييمها');
            return;
        }

        submittingRef.current = true;
        setSubmitting(true);
        setError(null);
        setSuccessMessage(null);

        const currentPart = allProjectParts.find(p => String(p.id) === String(selectedPartId));
        const finalLessonTitle = isCustomUnit 
            ? (currentPart ? currentPart.title : lessonTitle.trim())
            : (isCustom ? lessonTitle.trim() : undefined);

        try {
            let response;

            if (isEditingPage && currentPageResult?.id) {
                // ── UPDATE existing evaluation ──
                const payload = {
                    evaluation_grade_id: grade.id,
                    grade: grade.name,
                    notes: notes
                };
                if (finalLessonTitle) {
                    payload.lesson_title = finalLessonTitle;
                }
                if (currentPart) {
                    payload.part_id = currentPart.id;
                }
                response = await updateRecitationEvaluation(currentPageResult.id, payload);
            } else {
                // ── CREATE new evaluation ──
                const payload = {
                    attendance_id: student.attendance_id,
                    student_id: student.student_id,
                    page_number: isCustomUnit ? (currentPart?.order || 1) : currentPage,
                    evaluation_grade_id: grade.id,
                    grade: grade.name,
                    notes: notes,
                    recitation_type: 'NEW_MEMORIZATION'
                };

                if (finalLessonTitle) {
                    payload.lesson_title = finalLessonTitle;
                }
                if (currentPart) {
                    payload.part_id = currentPart.id;
                }

                if (!isCustom && evalMode === 'SURAH' && selectedSurahs.length > 0) {
                    payload.is_surah_evaluation = true;
                    if (selectedSurahs.length === 1) {
                        payload.surah_number = selectedSurahs[0];
                    } else {
                        payload.surahs_list = selectedSurahs;
                    }
                }

                response = await evaluateRecitation(payload);
            }

            if (response.status === 'success') {
                const data = response.data;
                const savedEval = {
                    id: data.recitation_id,
                    page_number: isCustomUnit ? (currentPart?.order || 1) : currentPage,
                    grade: grade.name,
                    color_code: grade.color_code,
                    requires_repeat: data.requires_repeat ?? false,
                    notes: notes,
                    lesson_title: finalLessonTitle,
                    part_id: currentPart ? currentPart.id : undefined,
                    part_title: currentPart ? currentPart.title : finalLessonTitle,
                    stage_title: currentPart ? currentPart.stage_title : undefined,
                    is_surah_evaluation: evalMode === 'SURAH',
                    surah_number: selectedSurahs.length === 1 ? selectedSurahs[0] : undefined
                };

                // Lock locally
                if (isCustomUnit && finalLessonTitle) {
                    setEvaluatedLessonTitles(prev => new Set([...prev, finalLessonTitle]));
                } else if (evalMode === 'PAGE') {
                    setEvaluatedPages(prev => new Set([...prev, currentPage]));
                } else if (selectedSurahs.length > 0) {
                    setEvaluatedSurahs(prev => new Set([...prev, ...selectedSurahs]));
                }
                
                setCurrentPageResult(savedEval);
                setIsEditingPage(false);

                const successText = isEditingPage
                    ? `تم تعديل التقييم بنجاح`
                    : (response.message || `تم تسجيل التقييم بنجاح`);
                setSuccessMessage(successText);
                setNotes('');

                if (onEvaluationSuccess) {
                    onEvaluationSuccess(
                        student.attendance_id,
                        data.reached_page ?? student.reached_page,
                        savedEval,
                        isEditingPage
                    );
                }

                // Advance to next part or page if allowed
                if (!isEditingPage && data.can_recite_next && !data.requires_repeat) {
                    setTimeout(() => {
                        if (isCustomUnit && allProjectParts.length > 0) {
                            const curIdx = allProjectParts.findIndex(p => String(p.id) === String(selectedPartId));
                            if (curIdx !== -1 && curIdx < allProjectParts.length - 1) {
                                setSelectedPartId(allProjectParts[curIdx + 1].id);
                            }
                        } else if (data.next_page) {
                            setCurrentPage(data.next_page);
                        }
                        setSelectedSurahs([]);
                        setCurrentPageResult(null);
                        setSuccessMessage(null);
                    }, 1600);
                }
            } else {
                setError(response.message || 'حدث خطأ أثناء التقييم');
                if (response.code === 'ALREADY_EVALUATED') {
                    if (isCustomUnit && finalLessonTitle) {
                        setEvaluatedLessonTitles(prev => new Set([...prev, finalLessonTitle]));
                    } else {
                        setEvaluatedPages(prev => new Set([...prev, currentPage]));
                    }
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
                setError(serverMsg || `تم تقييم هذا ${unitLabel} مسبقاً في هذه الجلسة`);
                if (isCustomUnit && finalLessonTitle) {
                    setEvaluatedLessonTitles(prev => new Set([...prev, finalLessonTitle]));
                } else {
                    setEvaluatedPages(prev => new Set([...prev, currentPage]));
                }
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

    const headerBg = readOnly ? '#fafafa' : '#f1f8e9';

    return (
        <div
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1000, direction: 'rtl', padding: '1rem'
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: '#fff', width: '100%', maxWidth: '540px',
                    borderRadius: '16px', boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
                    position: 'relative', overflow: 'hidden', maxHeight: '90vh',
                    display: 'flex', flexDirection: 'column'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '1.2rem 1.5rem 1rem',
                    borderBottom: '1px solid #eee',
                    background: headerBg,
                    flexShrink: 0
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{
                            background: readOnly ? '#e8eaf6' : '#c8e6c9',
                            padding: '0.5rem', borderRadius: '50%', display: 'flex'
                        }}>
                            <BookOpen size={22} color={readOnly ? '#3949ab' : '#2e7d32'} />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <h2 style={{ margin: 0, color: '#133315', fontSize: '1.15rem', fontWeight: 'bold' }}>
                                    {readOnly
                                        ? 'عرض تقييم تسميع'
                                        : isEditingPage
                                            ? 'تعديل تقييم تسميع'
                                            : 'إضافة تقييم تسميع'}
                                </h2>
                                {isReverse && (
                                    <span style={{
                                        background: '#fff3e0', color: '#e65100',
                                        fontSize: '0.72rem', fontWeight: 'bold',
                                        padding: '0.2rem 0.5rem', borderRadius: '12px',
                                        display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                                        border: '1px solid #ffe0b2'
                                    }}>
                                        <ArrowsClockwise size={12} weight="bold" /> عكسي
                                    </span>
                                )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#555', fontSize: '0.88rem', marginTop: '0.2rem' }}>
                                <User size={14} />
                                <span style={{ fontWeight: '600' }}>{student.student_name}</span>
                                {isCustomUnit ? (
                                    <span style={{ color: '#2e7d32', fontSize: '0.8rem', fontWeight: 600 }}>
                                        (وصل إلى: {student.enrollment?.part_title || student.enrollment?.stage_title || 'البداية'})
                                    </span>
                                ) : student.reached_page ? (
                                    <span style={{ color: '#888', fontSize: '0.8rem' }}>
                                        (وصل لصفحة: {student.reached_page})
                                    </span>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <button
                        id="recitation-modal-close-btn"
                        onClick={onClose}
                        title="إغلاق"
                        aria-label="إغلاق نافذة التقييم"
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: '#fff', border: '1.5px solid #ccc', borderRadius: '50%',
                            width: '36px', height: '36px', cursor: 'pointer', flexShrink: 0
                        }}
                    >
                        <X size={18} color="#555" />
                    </button>
                </div>

                {/* ── Scrollable Body ── */}
                <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto' }}>

                    {/* Mode Toggle (for Quranic Projects: Pages vs Juz Amma Short Surahs) */}
                    {!isCustom && (
                        <div style={{
                            display: 'flex', background: '#f5f5f5', borderRadius: '10px',
                            padding: '3px', marginBottom: '1.2rem'
                        }}>
                            <button
                                type="button"
                                onClick={() => setEvalMode('PAGE')}
                                style={{
                                    flex: 1, padding: '0.5rem', border: 'none', borderRadius: '8px',
                                    fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer',
                                    background: evalMode === 'PAGE' ? '#fff' : 'transparent',
                                    color: evalMode === 'PAGE' ? '#2e7d32' : '#666',
                                    boxShadow: evalMode === 'PAGE' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                                    transition: 'all 0.2s'
                                }}
                            >
                                التسميع بالصفحات
                            </button>
                            <button
                                type="button"
                                onClick={() => setEvalMode('SURAH')}
                                style={{
                                    flex: 1, padding: '0.5rem', border: 'none', borderRadius: '8px',
                                    fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer',
                                    background: evalMode === 'SURAH' ? '#fff' : 'transparent',
                                    color: evalMode === 'SURAH' ? '#2e7d32' : '#666',
                                    boxShadow: evalMode === 'SURAH' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                                    transition: 'all 0.2s'
                                }}
                            >
                                قصار السور (جزء عم)
                            </button>
                        </div>
                    )}

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

                    {/* Custom Project Lessons / Topics Dropdown Selector */}
                    {isCustomUnit && (
                        <div style={{
                            background: '#f8fafc',
                            border: '1.5px solid #cbd5e1',
                            borderRadius: '12px',
                            padding: '1.1rem',
                            marginBottom: '1.25rem'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <label style={{
                                    fontSize: '0.92rem',
                                    fontWeight: 800,
                                    color: '#1e293b'
                                }}>
                                    تحديد {unitLabel} المراد تقييمه للطالب:
                                </label>
                                {allProjectParts.length > 0 && (
                                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                        إجمالي {unitPlural}: {allProjectParts.length}
                                    </span>
                                )}
                            </div>

                            {student.enrollment?.part_title && (
                                <div style={{
                                    background: '#ecfccb',
                                    color: '#365314',
                                    padding: '0.35rem 0.75rem',
                                    borderRadius: '8px',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    marginBottom: '0.75rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    border: '1px solid #d9f99d'
                                }}>
                                    <span>📍 وصل الطالب حالياً إلى:</span>
                                    <span>{student.enrollment.stage_title ? `${student.enrollment.stage_title} ❯ ` : ''}{student.enrollment.part_title}</span>
                                </div>
                            )}

                            {allProjectParts.length > 0 ? (
                                <div>
                                    <select
                                        id="custom-lesson-part-select"
                                        value={selectedPartId}
                                        onChange={(e) => setSelectedPartId(e.target.value)}
                                        disabled={submitting || readOnly || (isTargetEvaluated && !isEditingPage)}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem 1rem',
                                            borderRadius: '10px',
                                            border: '2px solid #84cc16',
                                            fontSize: '0.95rem',
                                            fontWeight: 700,
                                            color: '#1e293b',
                                            background: '#ffffff',
                                            outline: 'none',
                                            fontFamily: 'inherit',
                                            boxSizing: 'border-box',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {project.stages && project.stages.map(stage => (
                                            <optgroup key={stage.id} label={`مرحلة: ${stage.title}`}>
                                                {(stage.parts || []).map(part => {
                                                    const isPartEvaluated = evaluatedLessonTitles.has(part.title);
                                                    return (
                                                        <option key={part.id} value={part.id}>
                                                            {stage.title} ❯ {part.title} {isPartEvaluated ? '✓ (تم تقييمه في هذه الجلسة)' : ''}
                                                        </option>
                                                    );
                                                })}
                                            </optgroup>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div>
                                    <p style={{ color: '#b45309', background: '#fef3c7', padding: '0.6rem 0.8rem', borderRadius: '8px', fontSize: '0.85rem', margin: '0 0 0.6rem 0' }}>
                                        لم يتم إضافة {unitPlural} بمراحل هذا المشروع بعد في إعدادات المراحل. يمكنك كتابة اسم {unitLabel} هنا مباشرة:
                                    </p>
                                    <input
                                        type="text"
                                        placeholder={`مثال: ${unitLabel} 1...`}
                                        value={lessonTitle}
                                        onChange={(e) => setLessonTitle(e.target.value)}
                                        disabled={submitting || readOnly || (isTargetEvaluated && !isEditingPage)}
                                        style={{
                                            width: '100%',
                                            padding: '0.65rem 0.9rem',
                                            borderRadius: '8px',
                                            border: '1.5px solid #cbd5e1',
                                            fontSize: '0.92rem',
                                            boxSizing: 'border-box',
                                            fontFamily: 'inherit'
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Custom Project Lesson Title Input (for pages-based custom projects) */}
                    {isCustom && !isCustomUnit && (
                        <div style={{ marginBottom: '1.2rem' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#333', marginBottom: '0.4rem' }}>
                                عنوان الدرس / المحتوى:
                            </label>
                            <input
                                type="text"
                                placeholder="مثال: أحكام النون الساكنة - الإدغام، أو الحديث الأول..."
                                value={lessonTitle}
                                onChange={e => setLessonTitle(e.target.value)}
                                disabled={submitting || readOnly}
                                style={{
                                    width: '100%', padding: '0.7rem',
                                    borderRadius: '8px', border: '1.5px solid #81b255',
                                    outline: 'none', fontSize: '0.9rem', fontFamily: 'inherit',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                    )}

                    {/* Juz Amma Short Surahs Selector */}
                    {!isCustom && evalMode === 'SURAH' && (
                        <div style={{
                            background: '#f9fbf9', border: '1px solid #e0e0e0',
                            borderRadius: '12px', padding: '1rem', marginBottom: '1.2rem'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#133315' }}>
                                    اختر السورة (أو عدة سور من جزء عم):
                                </span>
                                {selectedSurahs.length > 0 && (
                                    <span style={{ fontSize: '0.78rem', background: '#e8f5e9', color: '#2e7d32', padding: '0.2rem 0.5rem', borderRadius: '10px', fontWeight: 'bold' }}>
                                        تم اختيار: {selectedSurahs.length} سورة
                                    </span>
                                )}
                            </div>

                            <input
                                type="text"
                                placeholder="بحث عن سورة في جزء عم..."
                                value={surahFilter}
                                onChange={e => setSurahFilter(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.45rem 0.75rem',
                                    borderRadius: '8px', border: '1px solid #ddd',
                                    fontSize: '0.82rem', marginBottom: '0.8rem',
                                    boxSizing: 'border-box', outline: 'none'
                                }}
                            />

                            <div style={{
                                display: 'flex', flexWrap: 'wrap', gap: '0.4rem',
                                maxHeight: '150px', overflowY: 'auto', padding: '2px'
                            }}>
                                {filteredSurahs.map(surah => {
                                    const isSelected = selectedSurahs.includes(surah.number);
                                    const isAlreadyEval = evaluatedSurahs.has(surah.number);
                                    return (
                                        <button
                                            key={surah.number}
                                            type="button"
                                            onClick={() => handleToggleSurah(surah)}
                                            style={{
                                                padding: '0.35rem 0.65rem',
                                                borderRadius: '8px',
                                                fontSize: '0.8rem',
                                                fontWeight: isSelected ? 'bold' : 'normal',
                                                border: `1px solid ${isSelected ? '#2e7d32' : isAlreadyEval ? '#e0e0e0' : '#cfd8dc'}`,
                                                background: isSelected ? '#2e7d32' : isAlreadyEval ? '#f5f5f5' : '#fff',
                                                color: isSelected ? '#fff' : isAlreadyEval ? '#9e9e9e' : '#333',
                                                cursor: 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.3rem',
                                                transition: 'all 0.15s'
                                            }}
                                        >
                                            {isSelected && <Check size={12} weight="bold" />}
                                            {surah.name} ({surah.number})
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Page / Progression Counter (Only for Quran / Pages-based projects) */}
                    {!isCustomUnit && (
                        <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
                            <p style={{ color: '#888', marginBottom: '0.4rem', fontSize: '0.88rem' }}>
                                {isCustom ? 'رقم الدرس أو الصفحة المراد تقييمها' : 'رقم الصفحة في المصحف الشريف'}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.2rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={submitting || readOnly || (isTargetEvaluated && !isEditingPage)}
                                    style={{
                                        width: 36, height: 36, borderRadius: '50%',
                                        border: '1.5px solid #ddd', background: '#f5f5f5',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', opacity: (isTargetEvaluated && !isEditingPage) ? 0.4 : 1
                                    }}
                                >
                                    <Minus size={18} color="#133315" />
                                </button>
                                <span style={{
                                    fontSize: '2.8rem', fontWeight: 'bold', lineHeight: 1,
                                    color: (isTargetEvaluated && !isEditingPage) ? '#9e9e9e' : '#f57c00'
                                }}>
                                    {currentPage}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(prev => Math.min(604, prev + 1))}
                                    disabled={submitting || readOnly || (isTargetEvaluated && !isEditingPage)}
                                    style={{
                                        width: 36, height: 36, borderRadius: '50%',
                                        border: '1.5px solid #ddd', background: '#f5f5f5',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', opacity: (isTargetEvaluated && !isEditingPage) ? 0.4 : 1
                                    }}
                                >
                                    <Plus size={18} color="#133315" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── LOCKED STATE: target already evaluated ── */}
                    {isTargetEvaluated && !isEditingPage ? (
                        <div style={{
                            background: '#f5f5f5', border: '1.5px solid #e0e0e0',
                            borderRadius: '10px', padding: '1.2rem', textAlign: 'center'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.6rem' }}>
                                <LockSimple size={30} color="#9e9e9e" weight="fill" />
                            </div>
                            <p style={{ color: '#666', fontWeight: 'bold', marginBottom: '0.6rem', fontSize: '0.95rem' }}>
                                {isCustomUnit 
                                    ? `تم تقييم ${unitLabel} (${currentPartObj?.title || currentPageResult?.lesson_title || ''}) مسبقاً في هذه الجلسة`
                                    : 'تم رصد التقييم مسبقاً'}
                            </p>
                            {currentPageResult && (
                                <div style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                    background: currentPageResult.color_code || '#558b2f',
                                    color: '#fff', padding: '0.45rem 1.2rem',
                                    borderRadius: '20px', fontWeight: 'bold', fontSize: '0.92rem',
                                    marginBottom: '0.8rem'
                                }}>
                                    <CheckCircle size={16} weight="fill" />
                                    {currentPageResult.grade}
                                    {currentPageResult.requires_repeat && (
                                        <span style={{ fontSize: '0.8rem', opacity: 0.9 }}> (إعادة)</span>
                                    )}
                                </div>
                            )}

                            {canEdit && !readOnly && (
                                <div style={{ marginTop: '0.5rem' }}>
                                    <button
                                        id="edit-evaluation-btn"
                                        type="button"
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
                                            fontSize: '0.88rem', cursor: 'pointer'
                                        }}
                                    >
                                        <PencilSimple size={16} />
                                        تعديل التقييم
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* ── ACTIVE STATE: new evaluation or editing existing ── */
                        <>
                            {isEditingPage && (
                                <div style={{
                                    background: '#fff8e1', border: '1px solid #ffe082',
                                    borderRadius: '8px', padding: '0.7rem 1rem',
                                    marginBottom: '1rem', fontSize: '0.85rem', color: '#e65100',
                                    display: 'flex', alignItems: 'center', gap: '0.5rem'
                                }}>
                                    <PencilSimple size={16} />
                                    <span>أنت تعدّل التقييم الحالي. اختر الدرجة أدناه.</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsEditingPage(false);
                                            setError(null);
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
                                    placeholder="ملاحظات حول التسميع والأداء (اختياري)..."
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    disabled={submitting || readOnly}
                                    style={{
                                        width: '100%', padding: '0.75rem',
                                        border: '1px solid #ddd', borderRadius: '8px',
                                        outline: 'none', fontFamily: 'inherit', fontSize: '0.9rem',
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
                                                    type="button"
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
                                                        padding: '0.85rem',
                                                        borderRadius: '8px', fontWeight: 'bold',
                                                        fontSize: '0.92rem',
                                                        cursor: submitting ? 'not-allowed' : 'pointer',
                                                        opacity: submitting ? 0.6 : 1,
                                                        transition: 'transform 0.1s, opacity 0.2s',
                                                        fontFamily: 'inherit', position: 'relative'
                                                    }}
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
