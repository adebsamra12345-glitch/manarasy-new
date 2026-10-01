import React, { useState, useEffect } from 'react';
import {
    CaretDown, Pencil, Trash, Plus, Check, X,
    ArrowRight, BookOpen, Exam, WarningCircle
} from '@phosphor-icons/react';
import {
    getEvaluationTemplates,
    createEvaluationTemplate,
    updateEvaluationTemplate,
    deleteEvaluationTemplate,
    createEvaluationGrade,
    updateEvaluationGrade,
    deleteEvaluationGrade,
    getTestRubrics,
    createTestRubric,
    updateTestRubric,
    deleteTestRubric,
    createRubricErrorType,
    updateRubricErrorType,
    deleteRubricErrorType
} from '../../../../services/api/tenantService';

const COLOR_OPTIONS = [
    { label: 'أزرق', value: 'أزرق', hex: '#2563eb' },
    { label: 'أخضر', value: 'أخضر', hex: '#16a34a' },
    { label: 'أحمر', value: 'أحمر', hex: '#dc2626' },
    { label: 'أصفر', value: 'أصفر', hex: '#ca8a04' },
    { label: 'برتقالي', value: 'برتقالي', hex: '#ea580c' },
    { label: 'رمادي', value: 'رمادي', hex: '#475569' }
];

const STOP_ACTION_OPTIONS = ['لا', 'نعم', 'معلم'];

const TestsModule = ({ searchQuery = '', showToast }) => {
    // Sub-view: 'landing' (Image 1) | 'rubrics' (Image 2) | 'evaluations' (Image 3)
    const [subView, setSubView] = useState('landing');

    // Data States
    const [rubrics, setRubrics] = useState([]);
    const [evaluationTemplates, setEvaluationTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Modal: Rubric Create / Edit
    const [isRubricModalOpen, setIsRubricModalOpen] = useState(false);
    const [editingRubric, setEditingRubric] = useState(null);
    const [rubricTitle, setRubricTitle] = useState('');
    const [rubricDesc, setRubricDesc] = useState('');
    const [savingRubric, setSavingRubric] = useState(false);

    // Modal: Error Type Create / Edit
    const [isErrorTypeModalOpen, setIsErrorTypeModalOpen] = useState(false);
    const [activeRubricForError, setActiveRubricForError] = useState(null);
    const [editingErrorType, setEditingErrorType] = useState(null);
    const [errorName, setErrorName] = useState('');
    const [errorValue, setErrorValue] = useState(1);
    const [errorMaxCount, setErrorMaxCount] = useState(3);
    const [errorNotes, setErrorNotes] = useState('');
    const [savingErrorType, setSavingErrorType] = useState(false);

    // Modal: Evaluation Template Create / Edit
    const [isEvalModalOpen, setIsEvalModalOpen] = useState(false);
    const [editingEval, setEditingEval] = useState(null);
    const [evalTitle, setEvalTitle] = useState('');
    const [evalDesc, setEvalDesc] = useState('');
    const [savingEval, setSavingEval] = useState(false);

    // Modal: Evaluation Grade Create / Edit
    const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
    const [activeEvalForGrade, setActiveEvalForGrade] = useState(null);
    const [editingGrade, setEditingGrade] = useState(null);
    const [gradeName, setGradeName] = useState('');
    const [gradeColor, setGradeColor] = useState('أزرق');
    const [gradeStopAction, setGradeStopAction] = useState('لا');
    const [gradeOrder, setGradeOrder] = useState(1);
    const [savingGrade, setSavingGrade] = useState(false);

    // Fetch live data from backend
    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [rubricsRes, evalRes] = await Promise.all([
                getTestRubrics().catch(() => ({ status: 'error', data: [] })),
                getEvaluationTemplates().catch(() => ({ status: 'error', data: [] }))
            ]);

            if (rubricsRes && rubricsRes.data) {
                setRubrics(rubricsRes.data);
            }
            if (evalRes && evalRes.data) {
                setEvaluationTemplates(evalRes.data);
            }
        } catch (err) {
            console.error('Error loading tests data:', err);
            setError('حدث خطأ أثناء تحميل بيانات الاختبارات والتقييمات من الخادم');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Filtered lists based on search
    const filteredRubrics = rubrics.filter(r => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        const matchesTitle = r.title && r.title.toLowerCase().includes(q);
        const matchesDesc = r.description && r.description.toLowerCase().includes(q);
        const matchesError = r.error_types && r.error_types.some(e => e.name && e.name.toLowerCase().includes(q));
        return matchesTitle || matchesDesc || matchesError;
    });

    const filteredEvaluations = evaluationTemplates.filter(t => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        const matchesTitle = t.title && t.title.toLowerCase().includes(q);
        const matchesDesc = t.description && t.description.toLowerCase().includes(q);
        const matchesGrade = t.grades && t.grades.some(g => g.name && g.name.toLowerCase().includes(q));
        return matchesTitle || matchesDesc || matchesGrade;
    });

    // ==========================================
    // Rubric Handlers
    // ==========================================
    const handleOpenNewRubricModal = () => {
        setEditingRubric(null);
        setRubricTitle('');
        setRubricDesc('');
        setIsRubricModalOpen(true);
    };

    const handleOpenEditRubricModal = (rubric) => {
        setEditingRubric(rubric);
        setRubricTitle(rubric.title || '');
        setRubricDesc(rubric.description || '');
        setIsRubricModalOpen(true);
    };

    const handleSaveRubric = async (e) => {
        e.preventDefault();
        if (!rubricTitle.trim()) {
            showToast('يرجى كتابة عنوان سلم الاختبار');
            return;
        }

        setSavingRubric(true);
        try {
            if (editingRubric) {
                const res = await updateTestRubric(editingRubric.id, {
                    title: rubricTitle.trim(),
                    description: rubricDesc.trim()
                });
                if (res.status === 'success') {
                    showToast('تم تعديل سلم الاختبار بنجاح');
                    setIsRubricModalOpen(false);
                    loadData();
                } else {
                    showToast(res.message || 'فشل تعديل سلم الاختبار');
                }
            } else {
                const res = await createTestRubric({
                    title: rubricTitle.trim(),
                    description: rubricDesc.trim()
                });
                if (res.status === 'success') {
                    showToast('تم إنشاء سلم الاختبار بنجاح');
                    setIsRubricModalOpen(false);
                    loadData();
                } else {
                    showToast(res.message || 'فشل إنشاء سلم الاختبار');
                }
            }
        } catch (err) {
            console.error(err);
            showToast('حدث خطأ أثناء حفظ سلم الاختبار');
        } finally {
            setSavingRubric(false);
        }
    };

    const handleDeleteRubric = async (rubricId, title) => {
        if (!window.confirm(`هل أنت متأكد من حذف سلم الاختبار "${title}" نهائياً؟`)) return;
        
        // Optimistic UI update
        const prevRubrics = [...rubrics];
        setRubrics(prev => prev.filter(r => r.id !== rubricId));

        try {
            const res = await deleteTestRubric(rubricId);
            if (res.status === 'success') {
                showToast('تم حذف سلم الاختبار بنجاح');
                setIsRubricModalOpen(false);
            } else {
                setRubrics(prevRubrics);
                showToast(res.message || 'فشل حذف سلم الاختبار');
            }
        } catch (err) {
            console.error(err);
            setRubrics(prevRubrics);
            showToast('حدث خطأ أثناء الحذف');
        }
    };

    // ==========================================
    // Error Type Handlers
    // ==========================================
    const handleOpenAddErrorTypeModal = (rubric) => {
        setActiveRubricForError(rubric);
        setEditingErrorType(null);
        setErrorName('');
        setErrorValue(3);
        setErrorMaxCount(3);
        setErrorNotes('');
        setIsErrorTypeModalOpen(true);
    };

    const handleOpenEditErrorTypeModal = (rubric, errObj) => {
        setActiveRubricForError(rubric);
        setEditingErrorType(errObj);
        setErrorName(errObj.name || '');
        setErrorValue(errObj.value || 1);
        setErrorMaxCount(errObj.max_count || 3);
        setErrorNotes(errObj.notes || '');
        setIsErrorTypeModalOpen(true);
    };

    const handleSaveErrorType = async (e) => {
        e.preventDefault();
        if (!errorName.trim()) {
            showToast('يرجى إدخال اسم نوع الخطأ');
            return;
        }

        setSavingErrorType(true);
        try {
            if (editingErrorType) {
                const res = await updateRubricErrorType(editingErrorType.id, {
                    name: errorName.trim(),
                    value: Number(errorValue),
                    max_count: Number(errorMaxCount),
                    notes: errorNotes.trim()
                });
                if (res.status === 'success') {
                    showToast('تم تعديل نوع الخطأ بنجاح');
                    setIsErrorTypeModalOpen(false);
                    loadData();
                } else {
                    showToast(res.message || 'فشل تعديل نوع الخطأ');
                }
            } else {
                const res = await createRubricErrorType(activeRubricForError.id, {
                    name: errorName.trim(),
                    value: Number(errorValue),
                    max_count: Number(errorMaxCount),
                    notes: errorNotes.trim()
                });
                if (res.status === 'success') {
                    showToast('تمت إضافة نوع الخطأ بنجاح');
                    setIsErrorTypeModalOpen(false);
                    loadData();
                } else {
                    showToast(res.message || 'فشل إضافة نوع الخطأ');
                }
            }
        } catch (err) {
            console.error(err);
            showToast('حدث خطأ أثناء حفظ نوع الخطأ');
        } finally {
            setSavingErrorType(false);
        }
    };

    const handleQuickChangeErrorMaxCount = async (errObj, newMaxCount) => {
        try {
            setRubrics(prev => prev.map(r => ({
                ...r,
                error_types: r.error_types.map(e => e.id === errObj.id ? { ...e, max_count: Number(newMaxCount) } : e)
            })));

            const res = await updateRubricErrorType(errObj.id, { max_count: Number(newMaxCount) });
            if (res.status === 'success') {
                showToast(`تم تحديث عدد المرات إلى ${newMaxCount}`);
            } else {
                showToast('فشل تحديث عدد المرات');
                loadData();
            }
        } catch (err) {
            console.error(err);
            showToast('فشل تحديث عدد المرات');
            loadData();
        }
    };

    const handleDeleteErrorType = async (rubricId, errorTypeId) => {
        if (!window.confirm('هل تريد حذف نوع الخطأ هذا؟')) return;
        
        // Optimistic UI update
        const prevRubrics = [...rubrics];
        setRubrics(prev => prev.map(r => {
            if (r.id === rubricId) {
                return { ...r, error_types: r.error_types.filter(e => e.id !== errorTypeId) };
            }
            return r;
        }));

        try {
            const res = await deleteRubricErrorType(errorTypeId);
            if (res.status === 'success') {
                showToast('تم حذف نوع الخطأ بنجاح');
                setIsErrorTypeModalOpen(false);
            } else {
                setRubrics(prevRubrics);
                showToast(res.message || 'فشل حذف نوع الخطأ');
            }
        } catch (err) {
            console.error(err);
            setRubrics(prevRubrics);
            showToast('حدث خطأ أثناء حذف نوع الخطأ');
        }
    };

    // ==========================================
    // Evaluation Template Handlers
    // ==========================================
    const handleOpenNewEvalModal = () => {
        setEditingEval(null);
        setEvalTitle('');
        setEvalDesc('');
        setIsEvalModalOpen(true);
    };

    const handleOpenEditEvalModal = (tmpl) => {
        setEditingEval(tmpl);
        setEvalTitle(tmpl.title || '');
        setEvalDesc(tmpl.description || '');
        setIsEvalModalOpen(true);
    };

    const handleSaveEvalTemplate = async (e) => {
        e.preventDefault();
        if (!evalTitle.trim()) {
            showToast('يرجى إدخال عنوان نموذج التقييم');
            return;
        }

        setSavingEval(true);
        try {
            if (editingEval) {
                const res = await updateEvaluationTemplate(editingEval.id, {
                    title: evalTitle.trim(),
                    description: evalDesc.trim()
                });
                if (res.status === 'success') {
                    showToast('تم تعديل نموذج التقييم بنجاح');
                    setIsEvalModalOpen(false);
                    loadData();
                } else {
                    showToast(res.message || 'فشل تعديل نموذج التقييم');
                }
            } else {
                const res = await createEvaluationTemplate({
                    title: evalTitle.trim(),
                    description: evalDesc.trim()
                });
                if (res.status === 'success') {
                    showToast('تم إنشاء نموذج التقييم بنجاح');
                    setIsEvalModalOpen(false);
                    loadData();
                } else {
                    showToast(res.message || 'فشل إنشاء نموذج التقييم');
                }
            }
        } catch (err) {
            console.error(err);
            showToast('حدث خطأ أثناء حفظ نموذج التقييم');
        } finally {
            setSavingEval(false);
        }
    };

    const handleDeleteEvalTemplate = async (templateId, title) => {
        if (!window.confirm(`هل أنت متأكد من حذف نموذج التقييم "${title}" نهائياً؟`)) return;

        // Optimistic UI update
        const prevTemplates = [...evaluationTemplates];
        setEvaluationTemplates(prev => prev.filter(t => t.id !== templateId));

        try {
            const res = await deleteEvaluationTemplate(templateId);
            if (res.status === 'success') {
                showToast('تم حذف نموذج التقييم بنجاح');
                setIsEvalModalOpen(false);
            } else {
                setEvaluationTemplates(prevTemplates);
                showToast(res.message || 'فشل حذف نموذج التقييم');
            }
        } catch (err) {
            console.error(err);
            setEvaluationTemplates(prevTemplates);
            showToast('حدث خطأ أثناء الحذف');
        }
    };

    // ==========================================
    // Evaluation Grade Handlers
    // ==========================================
    const handleOpenAddGradeModal = (tmpl) => {
        setActiveEvalForGrade(tmpl);
        setEditingGrade(null);
        setGradeName('');
        setGradeColor('أزرق');
        setGradeStopAction('لا');
        setGradeOrder((tmpl.grades ? tmpl.grades.length : 0) + 1);
        setIsGradeModalOpen(true);
    };

    const handleOpenEditGradeModal = (tmpl, gradeObj) => {
        setActiveEvalForGrade(tmpl);
        setEditingGrade(gradeObj);
        setGradeName(gradeObj.name || '');
        setGradeColor(gradeObj.color_code || 'أزرق');
        setGradeStopAction(gradeObj.stop_test_action || (gradeObj.requires_repeat ? 'نعم' : 'لا'));
        setGradeOrder(gradeObj.order || 1);
        setIsGradeModalOpen(true);
    };

    const handleSaveGrade = async (e) => {
        e.preventDefault();
        if (!gradeName.trim()) {
            showToast('يرجى إدخال اسم التقييم');
            return;
        }

        setSavingGrade(true);
        try {
            if (editingGrade) {
                const res = await updateEvaluationGrade(editingGrade.id, {
                    name: gradeName.trim(),
                    color_code: gradeColor,
                    stop_test_action: gradeStopAction,
                    order: Number(gradeOrder)
                });
                if (res.status === 'success') {
                    showToast('تم تعديل التقييم بنجاح');
                    setIsGradeModalOpen(false);
                    loadData();
                } else {
                    showToast(res.message || 'فشل تعديل التقييم');
                }
            } else {
                const res = await createEvaluationGrade(activeEvalForGrade.id, {
                    name: gradeName.trim(),
                    color_code: gradeColor,
                    stop_test_action: gradeStopAction,
                    order: Number(gradeOrder)
                });
                if (res.status === 'success') {
                    showToast('تمت إضافة التقييم بنجاح');
                    setIsGradeModalOpen(false);
                    loadData();
                } else {
                    showToast(res.message || 'فشل إضافة التقييم');
                }
            }
        } catch (err) {
            console.error(err);
            showToast('حدث خطأ أثناء حفظ التقييم');
        } finally {
            setSavingGrade(false);
        }
    };

    const handleQuickChangeGradeColor = async (gradeObj, newColor) => {
        try {
            setEvaluationTemplates(prev => prev.map(tmpl => ({
                ...tmpl,
                grades: tmpl.grades.map(g => g.id === gradeObj.id ? { ...g, color_code: newColor } : g)
            })));

            const res = await updateEvaluationGrade(gradeObj.id, { color_code: newColor });
            if (res.status === 'success') {
                showToast(`تم تغيير اللون إلى "${newColor}"`);
            } else {
                showToast('فشل تغيير اللون');
                loadData();
            }
        } catch (err) {
            console.error(err);
            showToast('فشل تغيير اللون');
            loadData();
        }
    };

    const handleQuickChangeGradeStopAction = async (gradeObj, newAction) => {
        try {
            setEvaluationTemplates(prev => prev.map(tmpl => ({
                ...tmpl,
                grades: tmpl.grades.map(g => g.id === gradeObj.id ? { ...g, stop_test_action: newAction } : g)
            })));

            const res = await updateEvaluationGrade(gradeObj.id, { stop_test_action: newAction });
            if (res.status === 'success') {
                showToast(`تم تحديث خيار إيقاف الاختبار إلى "${newAction}"`);
            } else {
                showToast('فشل تحديث الخيار');
                loadData();
            }
        } catch (err) {
            console.error(err);
            showToast('فشل تحديث الخيار');
            loadData();
        }
    };

    const handleDeleteGrade = async (templateId, gradeId) => {
        if (!window.confirm('هل تريد حذف هذا التقييم؟')) return;

        // Optimistic UI update
        const prevTemplates = [...evaluationTemplates];
        setEvaluationTemplates(prev => prev.map(tmpl => {
            if (tmpl.id === templateId) {
                return { ...tmpl, grades: tmpl.grades.filter(g => g.id !== gradeId) };
            }
            return tmpl;
        }));

        try {
            const res = await deleteEvaluationGrade(gradeId);
            if (res.status === 'success') {
                showToast('تم حذف التقييم بنجاح');
                setIsGradeModalOpen(false);
            } else {
                setEvaluationTemplates(prevTemplates);
                showToast(res.message || 'فشل حذف التقييم');
            }
        } catch (err) {
            console.error(err);
            setEvaluationTemplates(prevTemplates);
            showToast('حدث خطأ أثناء حذف التقييم');
        }
    };

    // ==========================================
    // Loading State
    // ==========================================
    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '5rem 0' }}>
                <div style={{
                    border: '4px solid #f1f5f9',
                    borderTop: '4px solid #4a6b18',
                    borderRadius: '50%',
                    width: '42px',
                    height: '42px',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 1.25rem'
                }}></div>
                <p style={{ color: '#64748b', fontWeight: 600, fontSize: '0.98rem' }}>
                    جاري تحميل بيانات الاختبارات والتقييمات...
                </p>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '14px',
                padding: '1.75rem',
                textAlign: 'center',
                color: '#991b1b',
                margin: '1rem 0'
            }}>
                <WarningCircle size={38} color="#dc2626" style={{ margin: '0 auto 0.5rem' }} />
                <p style={{ margin: '0 0 1rem 0', fontWeight: 700, fontSize: '1.05rem' }}>{error}</p>
                <button
                    onClick={loadData}
                    style={{
                        background: '#dc2626',
                        color: '#fff',
                        border: 'none',
                        padding: '0.55rem 1.6rem',
                        borderRadius: '8px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'inherit'
                    }}
                >
                    إعادة المحاولة
                </button>
            </div>
        );
    }

    // =========================================================================
    // VIEW 1: LANDING VIEW (Image 1: Two Large Cards)
    // =========================================================================
    if (subView === 'landing') {
        return (
            <div style={{ marginTop: '1rem' }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                    gap: '2.5rem',
                    alignItems: 'stretch'
                }}>
                    {/* Card 1 (Right in RTL): نماذج التقييم */}
                    <div
                        onClick={() => setSubView('evaluations')}
                        style={{
                            background: '#ffffff',
                            border: '1px solid #1e293b',
                            borderRadius: '20px',
                            minHeight: '380px',
                            padding: '3rem 2.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                            transition: 'all 0.25s ease',
                            userSelect: 'none'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.08)';
                            e.currentTarget.style.borderColor = '#4a6b18';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.02)';
                            e.currentTarget.style.borderColor = '#1e293b';
                        }}
                    >
                        <h2 style={{
                            fontFamily: "'Amiri', 'Tajawal', serif",
                            fontSize: '2.5rem',
                            fontWeight: 800,
                            color: '#0f172a',
                            margin: '0 0 1.75rem 0',
                            letterSpacing: '-0.4px'
                        }}>
                            نماذج التقييم
                        </h2>
                        <p style={{
                            fontSize: '1.05rem',
                            lineHeight: 1.8,
                            color: '#64748b',
                            fontWeight: 600,
                            margin: 0,
                            maxWidth: '380px'
                        }}>
                            نماذج التقييم هي النماذج (القوالب) التي تستخدم لتقييم الطالب ضمن الجلسة (أي في الدوام العادي)
                        </p>
                    </div>

                    {/* Card 2 (Left in RTL): سلالم الاختبارات */}
                    <div
                        onClick={() => setSubView('rubrics')}
                        style={{
                            background: '#ffffff',
                            border: '1px solid #1e293b',
                            borderRadius: '20px',
                            minHeight: '380px',
                            padding: '3rem 2.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                            transition: 'all 0.25s ease',
                            userSelect: 'none'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.08)';
                            e.currentTarget.style.borderColor = '#4a6b18';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.02)';
                            e.currentTarget.style.borderColor = '#1e293b';
                        }}
                    >
                        <h2 style={{
                            fontFamily: "'Amiri', 'Tajawal', serif",
                            fontSize: '2.5rem',
                            fontWeight: 800,
                            color: '#0f172a',
                            margin: '0 0 1.75rem 0',
                            letterSpacing: '-0.4px'
                        }}>
                            سلالم الاختبارات
                        </h2>
                        <p style={{
                            fontSize: '1.05rem',
                            lineHeight: 1.8,
                            color: '#64748b',
                            fontWeight: 600,
                            margin: 0,
                            maxWidth: '380px'
                        }}>
                            سلالم الاختبارات هي القوالب او النماذج التي يتم من خلالها تقييم الطالب في نهاية كل جزء من أجزاء المشروع في حال كان الجزء يحتوي على تقييم في نهايته
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // =========================================================================
    // VIEW 2: TEST RUBRICS (Image 2: سلالم الاختبارات)
    // =========================================================================
    if (subView === 'rubrics') {
        return (
            <div>
                {/* Header row: Title + Actions */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    marginBottom: '1.5rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button
                            onClick={() => setSubView('landing')}
                            style={{
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                borderRadius: '8px',
                                padding: '0.45rem 0.9rem',
                                color: '#475569',
                                fontSize: '0.9rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontFamily: 'inherit'
                            }}
                        >
                            <ArrowRight size={16} />
                            <span>الرجوع</span>
                        </button>
                        <h2 style={{
                            fontSize: '1.75rem',
                            fontWeight: 800,
                            color: '#0f172a',
                            margin: 0,
                            letterSpacing: '-0.3px'
                        }}>
                            سلالم الاختبارات
                        </h2>
                    </div>

                    <button
                        onClick={handleOpenNewRubricModal}
                        style={{
                            background: '#4a6b18',
                            color: '#ffffff',
                            border: 'none',
                            padding: '0.55rem 1.6rem',
                            borderRadius: '9px',
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 2px 4px rgba(74, 107, 24, 0.2)',
                            fontFamily: 'inherit'
                        }}
                    >
                        <Plus size={18} weight="bold" />
                        <span>إضافة سلم اختبار جديد</span>
                    </button>
                </div>

                {filteredRubrics.length === 0 ? (
                    <div style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '16px',
                        padding: '4rem 2rem',
                        textAlign: 'center',
                        color: '#64748b'
                    }}>
                        <Exam size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
                        <h3 style={{ fontSize: '1.25rem', color: '#1e293b', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
                            لا توجد سلالم اختبارات مضافة حالياً
                        </h3>
                        <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.95rem' }}>
                            يمكنك إنشاء سلم اختبار جديد لتحديد أنواع الأخطاء ونقاط الخصم لكل خطأ.
                        </p>
                        <button
                            onClick={handleOpenNewRubricModal}
                            style={{
                                background: '#4a6b18',
                                color: '#ffffff',
                                border: 'none',
                                padding: '0.6rem 1.8rem',
                                borderRadius: '9px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                fontFamily: 'inherit'
                            }}
                        >
                            إضافة سلم اختبار الآن
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                        {filteredRubrics.map((rubric) => {
                            const errCount = rubric.error_types ? rubric.error_types.length : 0;

                            return (
                                <div key={rubric.id}>
                                    {/* Card Header Box matching Image 2 */}
                                    <div style={{
                                        background: '#ffffff',
                                        border: '1px solid #1e293b',
                                        borderRadius: '16px',
                                        padding: '1.25rem 1.75rem',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        flexWrap: 'wrap',
                                        gap: '1.25rem',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                                    }}>
                                        {/* Right: Orange Capsule + Title + Error count */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                            <div style={{
                                                width: '9.5px',
                                                height: '52px',
                                                backgroundColor: '#e25c1d',
                                                borderRadius: '999px',
                                                flexShrink: 0
                                            }}></div>

                                            <div>
                                                <h3 style={{
                                                    fontSize: '1.35rem',
                                                    fontWeight: 800,
                                                    color: '#0f172a',
                                                    margin: '0 0 0.4rem 0',
                                                    letterSpacing: '-0.2px'
                                                }}>
                                                    {rubric.title}
                                                </h3>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{
                                                        width: '11px',
                                                        height: '11px',
                                                        borderRadius: '50%',
                                                        backgroundColor: '#7cb342',
                                                        display: 'inline-block'
                                                    }}></span>
                                                    <span style={{ color: '#64748b', fontSize: '0.94rem', fontWeight: 600 }}>
                                                        {errCount} أنواع من الاخطاء
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Left: Buttons تعديل and حذف */}
                                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                                            <button
                                                onClick={() => handleOpenEditRubricModal(rubric)}
                                                style={{
                                                    background: '#4a6b18',
                                                    color: '#ffffff',
                                                    border: 'none',
                                                    padding: '0.55rem 2.2rem',
                                                    borderRadius: '9px',
                                                    fontSize: '0.98rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    boxShadow: '0 2px 4px rgba(74, 107, 24, 0.2)',
                                                    transition: 'background 0.2s ease',
                                                    fontFamily: 'inherit'
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.background = '#3c5713'}
                                                onMouseOut={(e) => e.currentTarget.style.background = '#4a6b18'}
                                            >
                                                تعديل
                                            </button>
                                            <button
                                                onClick={() => handleDeleteRubric(rubric.id, rubric.title)}
                                                style={{
                                                    background: '#fef2f2',
                                                    color: '#dc2626',
                                                    border: '1px solid #fecaca',
                                                    padding: '0.55rem 1.25rem',
                                                    borderRadius: '9px',
                                                    fontSize: '0.98rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    fontFamily: 'inherit',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem'
                                                }}
                                                onMouseOver={(e) => {
                                                    e.currentTarget.style.background = '#fee2e2';
                                                }}
                                                onMouseOut={(e) => {
                                                    e.currentTarget.style.background = '#fef2f2';
                                                }}
                                            >
                                                <Trash size={18} />
                                                حذف
                                            </button>
                                        </div>
                                    </div>

                                    {/* Sub-heading: أنواع الأخطاء */}
                                    <div style={{ margin: '1.25rem 0.25rem 0.75rem' }}>
                                        <h4 style={{
                                            fontSize: '1.15rem',
                                            fontWeight: 800,
                                            color: '#0f172a',
                                            margin: 0
                                        }}>
                                            أنواع الأخطاء
                                        </h4>
                                    </div>

                                    {/* Error Types Table Container matching Image 2 */}
                                    <div style={{
                                        background: '#ffffff',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '14px',
                                        overflow: 'hidden',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                                    }}>
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{
                                                width: '100%',
                                                borderCollapse: 'collapse',
                                                textAlign: 'right',
                                                direction: 'rtl'
                                            }}>
                                                <thead>
                                                    <tr style={{ background: '#cbd5e1', color: '#334155' }}>
                                                        <th style={{ width: '65px', padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 800, fontSize: '0.95rem', borderLeft: '1px solid #94a3b8' }}>
                                                            م
                                                        </th>
                                                        <th style={{ padding: '0.85rem 1.25rem', fontWeight: 800, fontSize: '0.95rem', borderLeft: '1px solid #94a3b8' }}>
                                                            الاسم
                                                        </th>
                                                        <th style={{ width: '130px', padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 800, fontSize: '0.95rem', borderLeft: '1px solid #94a3b8' }}>
                                                            القيمة
                                                        </th>
                                                        <th style={{ width: '180px', padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 800, fontSize: '0.95rem', borderLeft: '1px solid #94a3b8' }}>
                                                            عدد مرات الخطأ
                                                        </th>
                                                        <th style={{ width: '120px', padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 800, fontSize: '0.95rem' }}>
                                                            ملاحظات
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {rubric.error_types && rubric.error_types.length > 0 ? (
                                                        rubric.error_types.map((errObj, idx) => (
                                                            <tr
                                                                key={errObj.id}
                                                                style={{
                                                                    borderBottom: '1px solid #e2e8f0',
                                                                    transition: 'background 0.15s ease'
                                                                }}
                                                                onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                                                                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                                            >
                                                                <td style={{ textAlign: 'center', padding: '0.9rem', color: '#475569', fontWeight: 600, fontSize: '0.95rem' }}>
                                                                    {idx + 1}
                                                                </td>
                                                                <td style={{ padding: '0.9rem 1.25rem', color: '#1e293b', fontWeight: 700, fontSize: '0.96rem' }}>
                                                                    {errObj.name}
                                                                </td>
                                                                <td style={{ textAlign: 'center', padding: '0.9rem', color: '#1e293b', fontWeight: 700, fontSize: '0.96rem' }}>
                                                                    {errObj.value}
                                                                </td>
                                                                <td style={{ textAlign: 'center', padding: '0.75rem 1rem' }}>
                                                                    {/* Dropdown with subtle rounded box & caret down */}
                                                                    <div style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '8px',
                                                                        background: '#ffffff',
                                                                        border: '1px solid #94a3b8',
                                                                        borderRadius: '8px',
                                                                        padding: '0.35rem 0.8rem',
                                                                        minWidth: '85px',
                                                                        justifyContent: 'space-between'
                                                                    }}>
                                                                        <CaretDown size={14} color="#64748b" />
                                                                        <select
                                                                            value={errObj.max_count}
                                                                            onChange={(e) => handleQuickChangeErrorMaxCount(errObj, e.target.value)}
                                                                            style={{
                                                                                appearance: 'none',
                                                                                border: 'none',
                                                                                outline: 'none',
                                                                                background: 'transparent',
                                                                                fontSize: '0.95rem',
                                                                                fontWeight: 700,
                                                                                color: '#1e293b',
                                                                                cursor: 'pointer',
                                                                                fontFamily: 'inherit',
                                                                                width: '100%',
                                                                                textAlign: 'center'
                                                                            }}
                                                                        >
                                                                            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                                                                                <option key={n} value={n}>{n}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                </td>
                                                                <td style={{ textAlign: 'center', padding: '0.75rem 1rem' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                                                        <button
                                                                            onClick={() => handleOpenEditErrorTypeModal(rubric, errObj)}
                                                                            title="تعديل نوع الخطأ"
                                                                            style={{
                                                                                background: 'none',
                                                                                border: 'none',
                                                                                cursor: 'pointer',
                                                                                color: '#94a3b8',
                                                                                padding: '4px',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                transition: 'color 0.2s'
                                                                            }}
                                                                            onMouseOver={(e) => e.currentTarget.style.color = '#4a6b18'}
                                                                            onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
                                                                        >
                                                                            <Pencil size={18} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteErrorType(rubric.id, errObj.id)}
                                                                            title="حذف نوع الخطأ"
                                                                            style={{
                                                                                background: 'none',
                                                                                border: 'none',
                                                                                cursor: 'pointer',
                                                                                color: '#cbd5e1',
                                                                                padding: '4px',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                transition: 'color 0.2s'
                                                                            }}
                                                                            onMouseOver={(e) => e.currentTarget.style.color = '#dc2626'}
                                                                            onMouseOut={(e) => e.currentTarget.style.color = '#cbd5e1'}
                                                                        >
                                                                            <Trash size={16} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <tr>
                                                            <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                                                لا توجد أنواع أخطاء مضافة في هذا السلم بعد. اضغط على زر "إضافة" أدناه.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Button إضافة matching Image 2 */}
                                        <div style={{ textAlign: 'center', padding: '1.25rem 0' }}>
                                            <button
                                                onClick={() => handleOpenAddErrorTypeModal(rubric)}
                                                style={{
                                                    background: '#ffffff',
                                                    border: '1.5px solid #4a6b18',
                                                    color: '#4a6b18',
                                                    borderRadius: '8px',
                                                    padding: '0.45rem 2.6rem',
                                                    fontSize: '0.95rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    fontFamily: 'inherit'
                                                }}
                                                onMouseOver={(e) => {
                                                    e.currentTarget.style.background = '#4a6b18';
                                                    e.currentTarget.style.color = '#ffffff';
                                                }}
                                                onMouseOut={(e) => {
                                                    e.currentTarget.style.background = '#ffffff';
                                                    e.currentTarget.style.color = '#4a6b18';
                                                }}
                                            >
                                                إضافة
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* MODAL 1: Create / Edit Rubric */}
                {isRubricModalOpen && (
                    <div style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.45)',
                        backdropFilter: 'blur(3px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999,
                        padding: '1rem'
                    }}>
                        <div style={{
                            background: '#ffffff',
                            borderRadius: '16px',
                            width: '100%',
                            maxWidth: '520px',
                            padding: '1.75rem',
                            direction: 'rtl',
                            boxShadow: '0 15px 35px rgba(0,0,0,0.2)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#143818', margin: 0 }}>
                                    {editingRubric ? 'تعديل سلم الاختبار' : 'إضافة سلم اختبار جديد'}
                                </h3>
                                <button onClick={() => setIsRubricModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSaveRubric}>
                                <div style={{ marginBottom: '1.25rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.92rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                        اسم سلم الاختبار *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={rubricTitle}
                                        onChange={(e) => setRubricTitle(e.target.value)}
                                        placeholder="مثال: الضبط والاتقان أو الإجازة"
                                        style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
                                    />
                                </div>

                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.92rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                        الوصف
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={rubricDesc}
                                        onChange={(e) => setRubricDesc(e.target.value)}
                                        placeholder="وصف سلم الاختبار وتفاصيل تطبيقه..."
                                        style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
                                    />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    {editingRubric ? (
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteRubric(editingRubric.id, editingRubric.title)}
                                            style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                                        >
                                            حذف السلم
                                        </button>
                                    ) : <div></div>}

                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button
                                            type="button"
                                            onClick={() => setIsRubricModalOpen(false)}
                                            style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '0.6rem 1.4rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                                        >
                                            إلغاء
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={savingRubric}
                                            style={{ background: '#4a6b18', color: '#ffffff', border: 'none', padding: '0.6rem 1.8rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                                        >
                                            {savingRubric ? 'جاري الحفظ...' : 'حفظ السلم'}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* MODAL 2: Create / Edit Error Type */}
                {isErrorTypeModalOpen && (
                    <div style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.45)',
                        backdropFilter: 'blur(3px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999,
                        padding: '1rem'
                    }}>
                        <div style={{
                            background: '#ffffff',
                            borderRadius: '16px',
                            width: '100%',
                            maxWidth: '500px',
                            padding: '1.75rem',
                            direction: 'rtl',
                            boxShadow: '0 15px 35px rgba(0,0,0,0.2)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#143818', margin: 0 }}>
                                    {editingErrorType ? 'تعديل نوع الخطأ' : 'إضافة نوع خطأ جديد'}
                                </h3>
                                <button onClick={() => setIsErrorTypeModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSaveErrorType}>
                                <div style={{ marginBottom: '1.15rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.92rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                        اسم نوع الخطأ *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={errorName}
                                        onChange={(e) => setErrorName(e.target.value)}
                                        placeholder="مثال: خطأ تشكيل (نبه وصحح لنفسه)"
                                        style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.15rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.92rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                            القيمة (الخصم) *
                                        </label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            min="0"
                                            required
                                            value={errorValue}
                                            onChange={(e) => setErrorValue(e.target.value)}
                                            style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.92rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                            عدد مرات الخطأ المسموحة *
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="20"
                                            required
                                            value={errorMaxCount}
                                            onChange={(e) => setErrorMaxCount(e.target.value)}
                                            style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.92rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                        ملاحظات إضافية
                                    </label>
                                    <input
                                        type="text"
                                        value={errorNotes}
                                        onChange={(e) => setErrorNotes(e.target.value)}
                                        placeholder="توضيح أو تعليمات للممتحن..."
                                        style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
                                    />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setIsErrorTypeModalOpen(false)}
                                        style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '0.6rem 1.4rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                                    >
                                        إلغاء
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={savingErrorType}
                                        style={{ background: '#4a6b18', color: '#ffffff', border: 'none', padding: '0.6rem 1.8rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                                    >
                                        {savingErrorType ? 'جاري الحفظ...' : 'حفظ'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // =========================================================================
    // VIEW 3: EVALUATION TEMPLATES (Image 3: نماذج التقييم)
    // =========================================================================
    return (
        <div>
            {/* Header row: Title + Actions */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.5rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button
                        onClick={() => setSubView('landing')}
                        style={{
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            padding: '0.45rem 0.9rem',
                            color: '#475569',
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontFamily: 'inherit'
                        }}
                    >
                        <ArrowRight size={16} />
                        <span>الرجوع</span>
                    </button>
                    <h2 style={{
                        fontSize: '1.75rem',
                        fontWeight: 800,
                        color: '#0f172a',
                        margin: 0,
                        letterSpacing: '-0.3px'
                    }}>
                        نماذج التقييم
                    </h2>
                </div>

                <button
                    onClick={handleOpenNewEvalModal}
                    style={{
                        background: '#4a6b18',
                        color: '#ffffff',
                        border: 'none',
                        padding: '0.55rem 1.6rem',
                        borderRadius: '9px',
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 2px 4px rgba(74, 107, 24, 0.2)',
                        fontFamily: 'inherit'
                    }}
                >
                    <Plus size={18} weight="bold" />
                    <span>إضافة نموذج تقييم جديد</span>
                </button>
            </div>

            {filteredEvaluations.length === 0 ? (
                <div style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '16px',
                    padding: '4rem 2rem',
                    textAlign: 'center',
                    color: '#64748b'
                }}>
                    <BookOpen size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
                    <h3 style={{ fontSize: '1.25rem', color: '#1e293b', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
                        لا توجد نماذج تقييم مضافة حالياً
                    </h3>
                    <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.95rem' }}>
                        نماذج التقييم تستخدم لتقييم أداء الطالب في الجلسات اليومية وتحديد فئات الإتقان.
                    </p>
                    <button
                        onClick={handleOpenNewEvalModal}
                        style={{
                            background: '#4a6b18',
                            color: '#ffffff',
                            border: 'none',
                            padding: '0.6rem 1.8rem',
                            borderRadius: '9px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontFamily: 'inherit'
                        }}
                    >
                        إضافة نموذج تقييم الآن
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                    {filteredEvaluations.map((tmpl) => (
                        <div key={tmpl.id}>
                            {/* Card Header Box matching Image 3 */}
                            <div style={{
                                background: '#ffffff',
                                border: '1px solid #1e293b',
                                borderRadius: '16px',
                                padding: '1.25rem 1.75rem',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '1.25rem',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                            }}>
                                {/* Right: Orange Capsule + Title */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                    <div style={{
                                        width: '9.5px',
                                        height: '52px',
                                        backgroundColor: '#e25c1d',
                                        borderRadius: '999px',
                                        flexShrink: 0
                                    }}></div>

                                    <div>
                                        <h3 style={{
                                            fontSize: '1.35rem',
                                            fontWeight: 800,
                                            color: '#0f172a',
                                            margin: 0,
                                            letterSpacing: '-0.2px'
                                        }}>
                                            {tmpl.title}
                                        </h3>
                                    </div>
                                </div>

                                {/* Left: Buttons تعديل and حذف */}
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button
                                        onClick={() => handleOpenEditEvalModal(tmpl)}
                                        style={{
                                            background: '#4a6b18',
                                            color: '#ffffff',
                                            border: 'none',
                                            padding: '0.55rem 2.2rem',
                                            borderRadius: '9px',
                                            fontSize: '0.98rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            boxShadow: '0 2px 4px rgba(74, 107, 24, 0.2)',
                                            transition: 'background 0.2s ease',
                                            fontFamily: 'inherit'
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.background = '#3c5713'}
                                        onMouseOut={(e) => e.currentTarget.style.background = '#4a6b18'}
                                    >
                                        تعديل
                                    </button>
                                    <button
                                        onClick={() => handleDeleteEvalTemplate(tmpl.id, tmpl.title)}
                                        style={{
                                            background: '#fef2f2',
                                            color: '#dc2626',
                                            border: '1px solid #fecaca',
                                            padding: '0.55rem 1.25rem',
                                            borderRadius: '9px',
                                            fontSize: '0.98rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            fontFamily: 'inherit',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem'
                                        }}
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.background = '#fee2e2';
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.background = '#fef2f2';
                                        }}
                                    >
                                        <Trash size={18} />
                                        حذف
                                    </button>
                                </div>
                            </div>

                            {/* Sub-heading: التقييمات */}
                            <div style={{ margin: '1.25rem 0.25rem 0.75rem' }}>
                                <h4 style={{
                                    fontSize: '1.15rem',
                                    fontWeight: 800,
                                    color: '#0f172a',
                                    margin: 0
                                }}>
                                    التقييمات
                                </h4>
                            </div>

                            {/* Evaluations Table Container matching Image 3 */}
                            <div style={{
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '14px',
                                overflow: 'hidden',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                            }}>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{
                                        width: '100%',
                                        borderCollapse: 'collapse',
                                        textAlign: 'right',
                                        direction: 'rtl'
                                    }}>
                                        <thead>
                                            <tr style={{ background: '#cbd5e1', color: '#334155' }}>
                                                <th style={{ width: '80px', padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 800, fontSize: '0.95rem', borderLeft: '1px solid #94a3b8' }}>
                                                    الترتيب
                                                </th>
                                                <th style={{ padding: '0.85rem 1.25rem', fontWeight: 800, fontSize: '0.95rem', borderLeft: '1px solid #94a3b8' }}>
                                                    الاسم
                                                </th>
                                                <th style={{ width: '180px', padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 800, fontSize: '0.95rem', borderLeft: '1px solid #94a3b8' }}>
                                                    لون الزر
                                                </th>
                                                <th style={{ width: '180px', padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 800, fontSize: '0.95rem', borderLeft: '1px solid #94a3b8' }}>
                                                    هل يوقف الاختبار؟
                                                </th>
                                                <th style={{ width: '110px', padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 800, fontSize: '0.95rem' }}>
                                                    الإجراءات
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tmpl.grades && tmpl.grades.length > 0 ? (
                                                tmpl.grades.map((gradeObj, idx) => (
                                                    <tr
                                                        key={gradeObj.id}
                                                        style={{
                                                            borderBottom: '1px solid #e2e8f0',
                                                            transition: 'background 0.15s ease'
                                                        }}
                                                        onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                                                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                                    >
                                                        <td style={{ textAlign: 'center', padding: '0.9rem', color: '#475569', fontWeight: 600, fontSize: '0.95rem' }}>
                                                            {gradeObj.order || idx + 1}
                                                        </td>
                                                        <td style={{ padding: '0.9rem 1.25rem', color: '#1e293b', fontWeight: 700, fontSize: '0.96rem' }}>
                                                            {gradeObj.name}
                                                        </td>
                                                        <td style={{ textAlign: 'center', padding: '0.75rem 1rem' }}>
                                                            {/* Dropdown: Button Color */}
                                                            <div style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '8px',
                                                                background: '#ffffff',
                                                                border: '1px solid #94a3b8',
                                                                borderRadius: '8px',
                                                                padding: '0.35rem 0.8rem',
                                                                minWidth: '100px',
                                                                justifyContent: 'space-between'
                                                            }}>
                                                                <CaretDown size={14} color="#64748b" />
                                                                <select
                                                                    value={gradeObj.color_code || 'أزرق'}
                                                                    onChange={(e) => handleQuickChangeGradeColor(gradeObj, e.target.value)}
                                                                    style={{
                                                                        appearance: 'none',
                                                                        border: 'none',
                                                                        outline: 'none',
                                                                        background: 'transparent',
                                                                        fontSize: '0.95rem',
                                                                        fontWeight: 700,
                                                                        color: '#1e293b',
                                                                        cursor: 'pointer',
                                                                        fontFamily: 'inherit',
                                                                        width: '100%',
                                                                        textAlign: 'center'
                                                                    }}
                                                                >
                                                                    {COLOR_OPTIONS.map(c => (
                                                                        <option key={c.value} value={c.value}>{c.label}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </td>
                                                        <td style={{ textAlign: 'center', padding: '0.75rem 1rem' }}>
                                                            {/* Dropdown: Does it stop exam? */}
                                                            <div style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '8px',
                                                                background: '#ffffff',
                                                                border: '1px solid #94a3b8',
                                                                borderRadius: '8px',
                                                                padding: '0.35rem 0.8rem',
                                                                minWidth: '100px',
                                                                justifyContent: 'space-between'
                                                            }}>
                                                                <CaretDown size={14} color="#64748b" />
                                                                <select
                                                                    value={gradeObj.stop_test_action || 'لا'}
                                                                    onChange={(e) => handleQuickChangeGradeStopAction(gradeObj, e.target.value)}
                                                                    style={{
                                                                        appearance: 'none',
                                                                        border: 'none',
                                                                        outline: 'none',
                                                                        background: 'transparent',
                                                                        fontSize: '0.95rem',
                                                                        fontWeight: 700,
                                                                        color: '#1e293b',
                                                                        cursor: 'pointer',
                                                                        fontFamily: 'inherit',
                                                                        width: '100%',
                                                                        textAlign: 'center'
                                                                    }}
                                                                >
                                                                    {STOP_ACTION_OPTIONS.map(opt => (
                                                                        <option key={opt} value={opt}>{opt}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </td>
                                                        <td style={{ textAlign: 'center', padding: '0.75rem 1rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                                                <button
                                                                    onClick={() => handleOpenEditGradeModal(tmpl, gradeObj)}
                                                                    title="تعديل التقييم"
                                                                    style={{
                                                                        background: 'none',
                                                                        border: 'none',
                                                                        cursor: 'pointer',
                                                                        color: '#94a3b8',
                                                                        padding: '4px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        transition: 'color 0.2s'
                                                                    }}
                                                                    onMouseOver={(e) => e.currentTarget.style.color = '#4a6b18'}
                                                                    onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
                                                                >
                                                                    <Pencil size={18} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteGrade(tmpl.id, gradeObj.id)}
                                                                    title="حذف التقييم"
                                                                    style={{
                                                                        background: 'none',
                                                                        border: 'none',
                                                                        cursor: 'pointer',
                                                                        color: '#cbd5e1',
                                                                        padding: '4px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        transition: 'color 0.2s'
                                                                    }}
                                                                    onMouseOver={(e) => e.currentTarget.style.color = '#dc2626'}
                                                                    onMouseOut={(e) => e.currentTarget.style.color = '#cbd5e1'}
                                                                >
                                                                    <Trash size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                                        لا توجد فئات تقييم مضافة لهذا النموذج بعد. اضغط على زر "إضافة" أدناه.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Button إضافة matching Image 3 */}
                                <div style={{ textAlign: 'center', padding: '1.25rem 0' }}>
                                    <button
                                        onClick={() => handleOpenAddGradeModal(tmpl)}
                                        style={{
                                            background: '#ffffff',
                                            border: '1.5px solid #4a6b18',
                                            color: '#4a6b18',
                                            borderRadius: '8px',
                                            padding: '0.45rem 2.6rem',
                                            fontSize: '0.95rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            fontFamily: 'inherit'
                                        }}
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.background = '#4a6b18';
                                            e.currentTarget.style.color = '#ffffff';
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.background = '#ffffff';
                                            e.currentTarget.style.color = '#4a6b18';
                                        }}
                                    >
                                        إضافة
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* MODAL 3: Create / Edit Evaluation Template */}
            {isEvalModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.45)',
                    backdropFilter: 'blur(3px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '1rem'
                }}>
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '520px',
                        padding: '1.75rem',
                        direction: 'rtl',
                        boxShadow: '0 15px 35px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#143818', margin: 0 }}>
                                {editingEval ? 'تعديل نموذج التقييم' : 'إضافة نموذج تقييم جديد'}
                            </h3>
                            <button onClick={() => setIsEvalModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveEvalTemplate}>
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', fontSize: '0.92rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                    اسم نموذج التقييم *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={evalTitle}
                                    onChange={(e) => setEvalTitle(e.target.value)}
                                    placeholder="مثال: الضبط والاتقان أو الإجازة"
                                    style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
                                />
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.92rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                    الوصف
                                </label>
                                <textarea
                                    rows={3}
                                    value={evalDesc}
                                    onChange={(e) => setEvalDesc(e.target.value)}
                                    placeholder="وصف نموذج التقييم واستخداماته..."
                                    style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                {editingEval ? (
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteEvalTemplate(editingEval.id, editingEval.title)}
                                        style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                                    >
                                        حذف النموذج
                                    </button>
                                ) : <div></div>}

                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setIsEvalModalOpen(false)}
                                        style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '0.6rem 1.4rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                                    >
                                        إلغاء
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={savingEval}
                                        style={{ background: '#4a6b18', color: '#ffffff', border: 'none', padding: '0.6rem 1.8rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                                    >
                                        {savingEval ? 'جاري الحفظ...' : 'حفظ'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 4: Create / Edit Evaluation Grade */}
            {isGradeModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.45)',
                    backdropFilter: 'blur(3px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '1rem'
                }}>
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '500px',
                        padding: '1.75rem',
                        direction: 'rtl',
                        boxShadow: '0 15px 35px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#143818', margin: 0 }}>
                                {editingGrade ? 'تعديل التقييم' : 'إضافة تقييم جديد'}
                            </h3>
                            <button onClick={() => setIsGradeModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveGrade}>
                            <div style={{ marginBottom: '1.15rem' }}>
                                <label style={{ display: 'block', fontSize: '0.92rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                    اسم التقييم *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={gradeName}
                                    onChange={(e) => setGradeName(e.target.value)}
                                    placeholder="مثال: ممتاز، جيد جداً، يحتاج إعادة"
                                    style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.15rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.92rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                        لون الزر *
                                    </label>
                                    <select
                                        value={gradeColor}
                                        onChange={(e) => setGradeColor(e.target.value)}
                                        style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' }}
                                    >
                                        {COLOR_OPTIONS.map(c => (
                                            <option key={c.value} value={c.value}>{c.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.92rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                        هل يوقف الاختبار؟ *
                                    </label>
                                    <select
                                        value={gradeStopAction}
                                        onChange={(e) => setGradeStopAction(e.target.value)}
                                        style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' }}
                                    >
                                        {STOP_ACTION_OPTIONS.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.92rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                    الترتيب
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={gradeOrder}
                                    onChange={(e) => setGradeOrder(e.target.value)}
                                    style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsGradeModalOpen(false)}
                                    style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '0.6rem 1.4rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                                >
                                    إلغاء
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingGrade}
                                    style={{ background: '#4a6b18', color: '#ffffff', border: 'none', padding: '0.6rem 1.8rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                                >
                                    {savingGrade ? 'جاري الحفظ...' : 'حفظ'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TestsModule;
