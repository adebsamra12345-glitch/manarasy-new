import React, { useState, useEffect } from 'react';
import {
    Plus, PencilSimple, Trash, CaretLeft, Check, X,
    Exam, BookOpen, MagnifyingGlass, WarningCircle, DotsThreeVertical
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

const STOP_ACTION_OPTIONS = [
    { label: 'لا يوقف', value: 'لا' },
    { label: 'يوقف الاختبار', value: 'نعم' },
    { label: 'بأمر المعلم', value: 'معلم' }
];

const MobileTestsModule = ({ searchQuery = '', showToast = (msg) => alert(msg) }) => {
    // التبويب النشط الداخلي: 'rubrics' (سلالم الاختبارات) أو 'evaluations' (نماذج التقييم)
    const [activeSection, setActiveSection] = useState('rubrics');

    // البيانات
    const [rubrics, setRubrics] = useState([]);
    const [evaluations, setEvaluations] = useState([]);
    const [loading, setLoading] = useState(true);

    // حالة Bottom Sheet لسلم الاختبار (إضافة / تعديل)
    const [isRubricSheetOpen, setIsRubricSheetOpen] = useState(false);
    const [editingRubric, setEditingRubric] = useState(null);
    const [rubricTitle, setRubricTitle] = useState('');
    const [rubricDesc, setRubricDesc] = useState('');
    const [savingRubric, setSavingRubric] = useState(false);

    // حالة Bottom Sheet لنوع الخطأ (إضافة / تعديل)
    const [isErrorSheetOpen, setIsErrorSheetOpen] = useState(false);
    const [targetRubricForError, setTargetRubricForError] = useState(null);
    const [editingError, setEditingError] = useState(null);
    const [errorName, setErrorName] = useState('');
    const [errorValue, setErrorValue] = useState(1);
    const [errorMaxCount, setErrorMaxCount] = useState(3);
    const [errorNotes, setErrorNotes] = useState('');
    const [savingError, setSavingError] = useState(false);

    // حالة Bottom Sheet لنموذج التقييم (إضافة / تعديل)
    const [isEvalSheetOpen, setIsEvalSheetOpen] = useState(false);
    const [editingEval, setEditingEval] = useState(null);
    const [evalTitle, setEvalTitle] = useState('');
    const [evalDesc, setEvalDesc] = useState('');
    const [savingEval, setSavingEval] = useState(false);

    // حالة Bottom Sheet لفئة التقدير (إضافة / تعديل)
    const [isGradeSheetOpen, setIsGradeSheetOpen] = useState(false);
    const [targetEvalForGrade, setTargetEvalForGrade] = useState(null);
    const [editingGrade, setEditingGrade] = useState(null);
    const [gradeName, setGradeName] = useState('');
    const [gradeColor, setGradeColor] = useState('أزرق');
    const [gradeStopAction, setGradeStopAction] = useState('لا');
    const [gradeOrder, setGradeOrder] = useState(1);
    const [savingGrade, setSavingGrade] = useState(false);

    // جلب البيانات
    const loadAllData = async () => {
        setLoading(true);
        try {
            const [rubricsRes, evalRes] = await Promise.all([
                getTestRubrics().catch(() => ({ data: [] })),
                getEvaluationTemplates().catch(() => ({ data: [] }))
            ]);
            if (rubricsRes?.data) setRubrics(rubricsRes.data);
            if (evalRes?.data) setEvaluations(evalRes.data);
        } catch (err) {
            console.error('Error fetching tests data:', err);
            showToast('حدث خطأ أثناء تحميل بيانات الاختبارات');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAllData();
    }, []);

    // تصفية البيانات حسب شريط البحث
    const q = searchQuery.trim().toLowerCase();
    const filteredRubrics = rubrics.filter(r =>
        !q || (r.title && r.title.toLowerCase().includes(q)) ||
        (r.error_types && r.error_types.some(e => e.name && e.name.toLowerCase().includes(q)))
    );

    const filteredEvaluations = evaluations.filter(t =>
        !q || (t.title && t.title.toLowerCase().includes(q)) ||
        (t.grades && t.grades.some(g => g.name && g.name.toLowerCase().includes(q)))
    );

    // ==========================================
    // معالجات سلالم الاختبارات (Rubrics)
    // ==========================================
    const openNewRubric = () => {
        setEditingRubric(null);
        setRubricTitle('');
        setRubricDesc('');
        setIsRubricSheetOpen(true);
    };

    const openEditRubric = (r) => {
        setEditingRubric(r);
        setRubricTitle(r.title || '');
        setRubricDesc(r.description || '');
        setIsRubricSheetOpen(true);
    };

    const handleSaveRubric = async (e) => {
        e.preventDefault();
        if (!rubricTitle.trim()) {
            showToast('يرجى كتابة عنوان سلم الاختبار');
            return;
        }
        setSavingRubric(true);
        try {
            const payload = { title: rubricTitle.trim(), description: rubricDesc.trim() };
            const res = editingRubric
                ? await updateTestRubric(editingRubric.id, payload)
                : await createTestRubric(payload);

            if (res.status === 'success') {
                showToast(editingRubric ? 'تم تعديل السلم بنجاح' : 'تم إضافة السلم بنجاح');
                setIsRubricSheetOpen(false);
                loadAllData();
            } else {
                showToast(res.message || 'فشلت العملية');
            }
        } catch (err) {
            showToast('حدث خطأ أثناء الحفظ');
        } finally {
            setSavingRubric(false);
        }
    };

    const handleDeleteRubric = async (r) => {
        if (!window.confirm(`هل أنت متأكد من حذف سلم الاختبار "${r.title}"؟`)) return;
        try {
            const res = await deleteTestRubric(r.id);
            if (res.status === 'success') {
                showToast('تم الحذف بنجاح');
                loadAllData();
            } else {
                showToast(res.message || 'فشل الحذف');
            }
        } catch (err) {
            showToast('حدث خطأ أثناء الحذف');
        }
    };

    // معالجات أنواع الأخطاء (Error Types)
    const openAddError = (rubric) => {
        setTargetRubricForError(rubric);
        setEditingError(null);
        setErrorName('');
        setErrorValue(1);
        setErrorMaxCount(3);
        setErrorNotes('');
        setIsErrorSheetOpen(true);
    };

    const openEditError = (rubric, errObj) => {
        setTargetRubricForError(rubric);
        setEditingError(errObj);
        setErrorName(errObj.name || '');
        setErrorValue(errObj.value ?? 1);
        setErrorMaxCount(errObj.max_count ?? 3);
        setErrorNotes(errObj.notes || '');
        setIsErrorSheetOpen(true);
    };

    const handleSaveErrorType = async (e) => {
        e.preventDefault();
        if (!errorName.trim()) {
            showToast('يرجى إدخال اسم نوع الخطأ');
            return;
        }
        setSavingError(true);
        try {
            const payload = {
                name: errorName.trim(),
                value: Number(errorValue),
                max_count: Number(errorMaxCount),
                notes: errorNotes.trim()
            };
            const res = editingError
                ? await updateRubricErrorType(editingError.id, payload)
                : await createRubricErrorType(targetRubricForError.id, payload);

            if (res.status === 'success') {
                showToast(editingError ? 'تم تعديل نوع الخطأ' : 'تمت إضافة نوع الخطأ');
                setIsErrorSheetOpen(false);
                loadAllData();
            } else {
                showToast(res.message || 'فشلت العملية');
            }
        } catch (err) {
            showToast('حدث خطأ أثناء حفظ نوع الخطأ');
        } finally {
            setSavingError(false);
        }
    };

    const handleDeleteErrorType = async (errObj) => {
        if (!window.confirm(`هل تريد حذف نوع الخطأ "${errObj.name}"؟`)) return;
        try {
            const res = await deleteRubricErrorType(errObj.id);
            if (res.status === 'success') {
                showToast('تم حذف نوع الخطأ');
                loadAllData();
            } else {
                showToast(res.message || 'فشل الحذف');
            }
        } catch (err) {
            showToast('حدث خطأ أثناء الحذف');
        }
    };

    // ==========================================
    // معالجات نماذج التقييم (Evaluations)
    // ==========================================
    const openNewEval = () => {
        setEditingEval(null);
        setEvalTitle('');
        setEvalDesc('');
        setIsEvalSheetOpen(true);
    };

    const openEditEval = (t) => {
        setEditingEval(t);
        setEvalTitle(t.title || '');
        setEvalDesc(t.description || '');
        setIsEvalSheetOpen(true);
    };

    const handleSaveEval = async (e) => {
        e.preventDefault();
        if (!evalTitle.trim()) {
            showToast('يرجى إدخال عنوان نموذج التقييم');
            return;
        }
        setSavingEval(true);
        try {
            const payload = { title: evalTitle.trim(), description: evalDesc.trim() };
            const res = editingEval
                ? await updateEvaluationTemplate(editingEval.id, payload)
                : await createEvaluationTemplate(payload);

            if (res.status === 'success') {
                showToast(editingEval ? 'تم تعديل نموذج التقييم' : 'تمت إضافة نموذج التقييم');
                setIsEvalSheetOpen(false);
                loadAllData();
            } else {
                showToast(res.message || 'فشلت العملية');
            }
        } catch (err) {
            showToast('حدث خطأ أثناء حفظ النموذج');
        } finally {
            setSavingEval(false);
        }
    };

    const handleDeleteEval = async (t) => {
        if (!window.confirm(`هل أنت متأكد من حذف نموذج التقييم "${t.title}"؟`)) return;
        try {
            const res = await deleteEvaluationTemplate(t.id);
            if (res.status === 'success') {
                showToast('تم حذف نموذج التقييم بنجاح');
                loadAllData();
            } else {
                showToast(res.message || 'فشل الحذف');
            }
        } catch (err) {
            showToast('حدث خطأ أثناء الحذف');
        }
    };

    // معالجات فئات التقدير (Grades)
    const openAddGrade = (tmpl) => {
        setTargetEvalForGrade(tmpl);
        setEditingGrade(null);
        setGradeName('');
        setGradeColor('أزرق');
        setGradeStopAction('لا');
        setGradeOrder((tmpl.grades?.length || 0) + 1);
        setIsGradeSheetOpen(true);
    };

    const openEditGrade = (tmpl, g) => {
        setTargetEvalForGrade(tmpl);
        setEditingGrade(g);
        setGradeName(g.name || '');
        setGradeColor(g.color_code || 'أزرق');
        setGradeStopAction(g.stop_test_action || 'لا');
        setGradeOrder(g.order || 1);
        setIsGradeSheetOpen(true);
    };

    const handleSaveGrade = async (e) => {
        e.preventDefault();
        if (!gradeName.trim()) {
            showToast('يرجى إدخال اسم التقدير');
            return;
        }
        setSavingGrade(true);
        try {
            const payload = {
                name: gradeName.trim(),
                color_code: gradeColor,
                stop_test_action: gradeStopAction,
                order: Number(gradeOrder)
            };
            const res = editingGrade
                ? await updateEvaluationGrade(editingGrade.id, payload)
                : await createEvaluationGrade(targetEvalForGrade.id, payload);

            if (res.status === 'success') {
                showToast(editingGrade ? 'تم تعديل التقدير بنجاح' : 'تمت إضافة التقدير بنجاح');
                setIsGradeSheetOpen(false);
                loadAllData();
            } else {
                showToast(res.message || 'فشلت العملية');
            }
        } catch (err) {
            showToast('حدث خطأ أثناء حفظ التقدير');
        } finally {
            setSavingGrade(false);
        }
    };

    const handleDeleteGrade = async (g) => {
        if (!window.confirm(`هل تريد حذف فئة التقدير "${g.name}"؟`)) return;
        try {
            const res = await deleteEvaluationGrade(g.id);
            if (res.status === 'success') {
                showToast('تم الحذف بنجاح');
                loadAllData();
            } else {
                showToast(res.message || 'فشل الحذف');
            }
        } catch (err) {
            showToast('حدث خطأ أثناء الحذف');
        }
    };

    // دالة مساعدة للحصول على لون الكبسولة
    const getColorHex = (name) => {
        const found = COLOR_OPTIONS.find(c => c.value === name);
        return found ? found.hex : '#2563eb';
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* أزرار التبديل الثانوية (Segmented Control) */}
            <div style={{
                display: 'flex',
                background: '#e2e8f0',
                padding: '4px',
                borderRadius: '12px',
                gap: '4px'
            }}>
                <button
                    onClick={() => setActiveSection('rubrics')}
                    style={{
                        flex: 1,
                        padding: '0.65rem',
                        border: 'none',
                        borderRadius: '9px',
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        background: activeSection === 'rubrics' ? '#ffffff' : 'transparent',
                        color: activeSection === 'rubrics' ? '#133315' : '#64748b',
                        boxShadow: activeSection === 'rubrics' ? '0 2px 5px rgba(0,0,0,0.06)' : 'none',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                    }}
                >
                    <Exam size={18} />
                    <span>سلالم الاختبارات</span>
                </button>

                <button
                    onClick={() => setActiveSection('evaluations')}
                    style={{
                        flex: 1,
                        padding: '0.65rem',
                        border: 'none',
                        borderRadius: '9px',
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        background: activeSection === 'evaluations' ? '#ffffff' : 'transparent',
                        color: activeSection === 'evaluations' ? '#133315' : '#64748b',
                        boxShadow: activeSection === 'evaluations' ? '0 2px 5px rgba(0,0,0,0.06)' : 'none',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                    }}
                >
                    <BookOpen size={18} />
                    <span>نماذج التقييم</span>
                </button>
            </div>

            {/* زر الإضافة العائم/العلوي بحسب القسم النشط */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
                    {activeSection === 'rubrics'
                        ? `${filteredRubrics.length} سلم اختبار متوفر`
                        : `${filteredEvaluations.length} نموذج تقييم متوفر`}
                </span>
                <button
                    onClick={activeSection === 'rubrics' ? openNewRubric : openNewEval}
                    style={{
                        background: '#133315',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '0.5rem 0.9rem',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(19, 51, 21, 0.2)'
                    }}
                >
                    <Plus size={16} weight="bold" />
                    <span>{activeSection === 'rubrics' ? 'سلم جديد' : 'نموذج جديد'}</span>
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#558b2f', fontWeight: 'bold' }}>
                    جاري تحميل بيانات الاختبارات...
                </div>
            ) : activeSection === 'rubrics' ? (
                /* ========================================================
                   عرض سلالم الاختبارات (RUBRICS) على الموبايل
                   ======================================================== */
                filteredRubrics.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#fff', borderRadius: '16px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                        <Exam size={40} color="#94a3b8" style={{ marginBottom: '0.5rem' }} />
                        <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#1e293b' }}>لا توجد سلالم اختبارات</div>
                        <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>اضغط على "سلم جديد" لإنشاء سلم تقييم أخطاء للأجزاء</div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {filteredRubrics.map(rubric => {
                            const errCount = rubric.error_types?.length || 0;
                            return (
                                <div
                                    key={rubric.id}
                                    style={{
                                        background: '#ffffff',
                                        borderRadius: '16px',
                                        border: '1px solid #e2e8f0',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                                        overflow: 'hidden'
                                    }}
                                >
                                    {/* ترويسة بطاقة السلم */}
                                    <div style={{
                                        padding: '1rem',
                                        borderBottom: '1px solid #f1f5f9',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        background: '#fafbfc'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ width: '5px', height: '36px', background: '#e25c1d', borderRadius: '4px' }} />
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                                                    {rubric.title}
                                                </h4>
                                                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                                                    {errCount} أنواع من الأخطاء
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button
                                                onClick={() => openEditRubric(rubric)}
                                                style={{
                                                    background: '#f1f8e9',
                                                    border: '1px solid #c5e1a5',
                                                    color: '#33691e',
                                                    borderRadius: '8px',
                                                    padding: '0.4rem 0.75rem',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 'bold',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                تعديل
                                            </button>
                                            <button
                                                onClick={() => handleDeleteRubric(rubric)}
                                                style={{
                                                    background: '#fef2f2',
                                                    border: '1px solid #fecaca',
                                                    color: '#dc2626',
                                                    borderRadius: '8px',
                                                    padding: '0.4rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <Trash size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* قائمة أنواع الأخطاء (بطاقات عمودية خفيفة بدلاً من جدول) */}
                                    <div style={{ padding: '0.75rem 1rem' }}>
                                        {errCount === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                                                لا توجد أخطاء مضافة في هذا السلم بعد
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                {rubric.error_types.map((errObj, idx) => (
                                                    <div
                                                        key={errObj.id}
                                                        style={{
                                                            background: '#f8fafc',
                                                            borderRadius: '10px',
                                                            padding: '0.65rem 0.85rem',
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            border: '1px solid #edf2f7'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#94a3b8', width: '18px' }}>
                                                                {idx + 1}
                                                            </span>
                                                            <div>
                                                                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>
                                                                    {errObj.name}
                                                                </div>
                                                                <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: '8px', marginTop: '2px' }}>
                                                                    <span>الحسم: <b>{errObj.value}</b> درجات</span>
                                                                    <span>•</span>
                                                                    <span>الحد الأقصى: <b>{errObj.max_count}</b> مرات</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div style={{ display: 'flex', gap: '4px' }}>
                                                            <button
                                                                onClick={() => openEditError(rubric, errObj)}
                                                                style={{ background: 'none', border: 'none', color: '#64748b', padding: '4px', cursor: 'pointer' }}
                                                            >
                                                                <PencilSimple size={17} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteErrorType(errObj)}
                                                                style={{ background: 'none', border: 'none', color: '#ef4444', padding: '4px', cursor: 'pointer' }}
                                                            >
                                                                <Trash size={17} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* زر إضافة نوع خطأ للسلم */}
                                        <button
                                            onClick={() => openAddError(rubric)}
                                            style={{
                                                width: '100%',
                                                marginTop: '0.75rem',
                                                padding: '0.6rem',
                                                borderRadius: '10px',
                                                border: '1.5px dashed #4a6b18',
                                                background: '#fcfdfa',
                                                color: '#4a6b18',
                                                fontWeight: 700,
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            <Plus size={16} weight="bold" />
                                            <span>إضافة نوع خطأ جديد</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            ) : (
                /* ========================================================
                   عرض نماذج التقييم (EVALUATIONS) على الموبايل
                   ======================================================== */
                filteredEvaluations.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#fff', borderRadius: '16px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                        <BookOpen size={40} color="#94a3b8" style={{ marginBottom: '0.5rem' }} />
                        <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#1e293b' }}>لا توجد نماذج تقييم</div>
                        <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>اضغط على "نموذج جديد" لإنشاء قالب تقييم للجلسات</div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {filteredEvaluations.map(tmpl => {
                            const gradeCount = tmpl.grades?.length || 0;
                            return (
                                <div
                                    key={tmpl.id}
                                    style={{
                                        background: '#ffffff',
                                        borderRadius: '16px',
                                        border: '1px solid #e2e8f0',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                                        overflow: 'hidden'
                                    }}
                                >
                                    {/* ترويسة نموذج التقييم */}
                                    <div style={{
                                        padding: '1rem',
                                        borderBottom: '1px solid #f1f5f9',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        background: '#fafbfc'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ width: '5px', height: '36px', background: '#16a34a', borderRadius: '4px' }} />
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                                                    {tmpl.title}
                                                </h4>
                                                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                                                    {gradeCount} فئات تقدير
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button
                                                onClick={() => openEditEval(tmpl)}
                                                style={{
                                                    background: '#f1f8e9',
                                                    border: '1px solid #c5e1a5',
                                                    color: '#33691e',
                                                    borderRadius: '8px',
                                                    padding: '0.4rem 0.75rem',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 'bold',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                تعديل
                                            </button>
                                            <button
                                                onClick={() => handleDeleteEval(tmpl)}
                                                style={{
                                                    background: '#fef2f2',
                                                    border: '1px solid #fecaca',
                                                    color: '#dc2626',
                                                    borderRadius: '8px',
                                                    padding: '0.4rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <Trash size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* قائمة فئات التقدير (Cards) */}
                                    <div style={{ padding: '0.75rem 1rem' }}>
                                        {gradeCount === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                                                لا توجد فئات تقدير مضافة في هذا النموذج
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                {tmpl.grades.map((gradeObj) => (
                                                    <div
                                                        key={gradeObj.id}
                                                        style={{
                                                            background: '#f8fafc',
                                                            borderRadius: '10px',
                                                            padding: '0.65rem 0.85rem',
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            border: '1px solid #edf2f7'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                            {/* كبسولة اللون */}
                                                            <div
                                                                style={{
                                                                    width: '12px',
                                                                    height: '12px',
                                                                    borderRadius: '50%',
                                                                    background: getColorHex(gradeObj.color_code),
                                                                    boxShadow: `0 0 6px ${getColorHex(gradeObj.color_code)}66`
                                                                }}
                                                            />
                                                            <div>
                                                                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>
                                                                    {gradeObj.name}
                                                                </div>
                                                                <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: '8px', marginTop: '2px' }}>
                                                                    <span>الترتيب: {gradeObj.order}</span>
                                                                    <span>•</span>
                                                                    <span style={{ color: gradeObj.stop_test_action === 'نعم' ? '#dc2626' : '#64748b' }}>
                                                                        {gradeObj.stop_test_action === 'نعم' ? 'يوقف الاختبار' : gradeObj.stop_test_action === 'معلم' ? 'حسب المعلم' : 'لا يوقف'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div style={{ display: 'flex', gap: '4px' }}>
                                                            <button
                                                                onClick={() => openEditGrade(tmpl, gradeObj)}
                                                                style={{ background: 'none', border: 'none', color: '#64748b', padding: '4px', cursor: 'pointer' }}
                                                            >
                                                                <PencilSimple size={17} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteGrade(gradeObj)}
                                                                style={{ background: 'none', border: 'none', color: '#ef4444', padding: '4px', cursor: 'pointer' }}
                                                            >
                                                                <Trash size={17} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* زر إضافة تقدير للنموذج */}
                                        <button
                                            onClick={() => openAddGrade(tmpl)}
                                            style={{
                                                width: '100%',
                                                marginTop: '0.75rem',
                                                padding: '0.6rem',
                                                borderRadius: '10px',
                                                border: '1.5px dashed #4a6b18',
                                                background: '#fcfdfa',
                                                color: '#4a6b18',
                                                fontWeight: 700,
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            <Plus size={16} weight="bold" />
                                            <span>إضافة فئة تقدير جديدة</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            )}

            {/* ========================================================
               BOTTOM SHEET 1: إضافة / تعديل سلم اختبار
               ======================================================== */}
            {isRubricSheetOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ background: '#fff', width: '100%', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '1.5rem', maxHeight: '85vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#133315', fontWeight: 800 }}>
                                {editingRubric ? 'تعديل سلم الاختبار' : 'إضافة سلم اختبار جديد'}
                            </h3>
                            <button onClick={() => setIsRubricSheetOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#64748b' }}>&times;</button>
                        </div>
                        <form onSubmit={handleSaveRubric} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>عنوان السلم *</label>
                                <input
                                    type="text"
                                    required
                                    value={rubricTitle}
                                    onChange={e => setRubricTitle(e.target.value)}
                                    placeholder="مثال: سلم اختبار الجزء الثلاثين"
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>وصف السلم (اختياري)</label>
                                <textarea
                                    value={rubricDesc}
                                    onChange={e => setRubricDesc(e.target.value)}
                                    placeholder="وصف معايير حسم الدرجات..."
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', minHeight: '80px', fontSize: '0.9rem' }}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={savingRubric}
                                style={{ width: '100%', padding: '0.9rem', background: '#133315', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.95rem', marginTop: '0.5rem' }}
                            >
                                {savingRubric ? 'جاري الحفظ...' : 'حفظ السلم'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================
               BOTTOM SHEET 2: إضافة / تعديل نوع خطأ
               ======================================================== */}
            {isErrorSheetOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ background: '#fff', width: '100%', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '1.5rem', maxHeight: '85vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#133315', fontWeight: 800 }}>
                                {editingError ? 'تعديل نوع الخطأ' : 'إضافة نوع خطأ جديد'}
                            </h3>
                            <button onClick={() => setIsErrorSheetOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#64748b' }}>&times;</button>
                        </div>
                        <form onSubmit={handleSaveErrorType} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>اسم الخطأ *</label>
                                <input
                                    type="text"
                                    required
                                    value={errorName}
                                    onChange={e => setErrorName(e.target.value)}
                                    placeholder="مثال: لحن جلي، نسيان، تنبيه..."
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>درجة الخصم</label>
                                    <input
                                        type="number"
                                        step="0.25"
                                        min="0"
                                        required
                                        value={errorValue}
                                        onChange={e => setErrorValue(e.target.value)}
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>أقصى تكرار للخصم</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        required
                                        value={errorMaxCount}
                                        onChange={e => setErrorMaxCount(e.target.value)}
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                                    />
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>ملاحظات (اختياري)</label>
                                <input
                                    type="text"
                                    value={errorNotes}
                                    onChange={e => setErrorNotes(e.target.value)}
                                    placeholder="أي تنبيهات للمعلم الفاحص"
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={savingError}
                                style={{ width: '100%', padding: '0.9rem', background: '#133315', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.95rem', marginTop: '0.5rem' }}
                            >
                                {savingError ? 'جاري الحفظ...' : 'حفظ نوع الخطأ'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================
               BOTTOM SHEET 3: إضافة / تعديل نموذج تقييم
               ======================================================== */}
            {isEvalSheetOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ background: '#fff', width: '100%', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '1.5rem', maxHeight: '85vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#133315', fontWeight: 800 }}>
                                {editingEval ? 'تعديل نموذج التقييم' : 'إضافة نموذج تقييم جديد'}
                            </h3>
                            <button onClick={() => setIsEvalSheetOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#64748b' }}>&times;</button>
                        </div>
                        <form onSubmit={handleSaveEval} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>عنوان النموذج *</label>
                                <input
                                    type="text"
                                    required
                                    value={evalTitle}
                                    onChange={e => setEvalTitle(e.target.value)}
                                    placeholder="مثال: التقييم اليومي المعتمد"
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>الوصف (اختياري)</label>
                                <textarea
                                    value={evalDesc}
                                    onChange={e => setEvalDesc(e.target.value)}
                                    placeholder="شرح إضافي للنموذج..."
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', minHeight: '80px', fontSize: '0.9rem' }}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={savingEval}
                                style={{ width: '100%', padding: '0.9rem', background: '#133315', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.95rem', marginTop: '0.5rem' }}
                            >
                                {savingEval ? 'جاري الحفظ...' : 'حفظ نموذج التقييم'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================
               BOTTOM SHEET 4: إضافة / تعديل فئة تقدير
               ======================================================== */}
            {isGradeSheetOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ background: '#fff', width: '100%', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '1.5rem', maxHeight: '85vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#133315', fontWeight: 800 }}>
                                {editingGrade ? 'تعديل التقدير' : 'إضافة تقدير جديد'}
                            </h3>
                            <button onClick={() => setIsGradeSheetOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#64748b' }}>&times;</button>
                        </div>
                        <form onSubmit={handleSaveGrade} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>اسم التقدير *</label>
                                <input
                                    type="text"
                                    required
                                    value={gradeName}
                                    onChange={e => setGradeName(e.target.value)}
                                    placeholder="مثال: ممتاز، جيد جداً، بحاجة لإعادة..."
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                                />
                            </div>

                            {/* محدد اللون التفاعلي السلس للموبايل */}
                            <div>
                                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>لون زر التقدير</label>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {COLOR_OPTIONS.map(c => {
                                        const isSelected = gradeColor === c.value;
                                        return (
                                            <button
                                                key={c.value}
                                                type="button"
                                                onClick={() => setGradeColor(c.value)}
                                                style={{
                                                    padding: '0.45rem 0.85rem',
                                                    borderRadius: '8px',
                                                    border: isSelected ? `2px solid ${c.hex}` : '1px solid #cbd5e1',
                                                    background: isSelected ? `${c.hex}15` : '#fff',
                                                    color: isSelected ? c.hex : '#64748b',
                                                    fontWeight: 'bold',
                                                    fontSize: '0.8rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: c.hex }} />
                                                <span>{c.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>إجراء إيقاف الاختبار</label>
                                    <select
                                        value={gradeStopAction}
                                        onChange={e => setGradeStopAction(e.target.value)}
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.85rem' }}
                                    >
                                        {STOP_ACTION_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>الترتيب</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={gradeOrder}
                                        onChange={e => setGradeOrder(e.target.value)}
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={savingGrade}
                                style={{ width: '100%', padding: '0.9rem', background: '#133315', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.95rem', marginTop: '0.5rem' }}
                            >
                                {savingGrade ? 'جاري الحفظ...' : 'حفظ فئة التقدير'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MobileTestsModule;
