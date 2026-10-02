import React, { useState, useEffect } from 'react';
import {
    Bell, CaretDown, MapPin, MagnifyingGlass,
    Pencil, Trash, Check, X, BookOpen, Exam, Plus
} from '@phosphor-icons/react';
import {
    getProjects,
    createProject,
    updateProject,
    deleteProject,
    getProjectStages,
    createProjectStage,
    updateProjectStage,
    deleteProjectStage,
    createStagePart,
    deleteStagePart,
    getEvaluationTemplates,
    getExamTemplates,
    getTestRubrics,
    getCentersList
} from '../../../services/api/tenantService';
import TestsModule from './tests/TestsModule';

const CentersAndProjects = () => {
    // Current User formatting matching reference: "السلام عليكم، أ. محمد العمري"
    const userStr = localStorage.getItem('user');
    let userObj = null;
    try { userObj = JSON.parse(userStr); } catch (e) { }
    const currentUserName = (userObj?.first_name || userObj?.last_name)
        ? `${userObj.first_name || ''} ${userObj.last_name || ''}`.trim()
        : (localStorage.getItem('username') === 'manager' || !localStorage.getItem('username') ? 'محمد العمري' : localStorage.getItem('username'));

    // Islamic and Gregorian Dates
    const todayDate = new Date();
    const hijriDate = new Intl.DateTimeFormat('ar-SA', {
        calendar: 'islamic', day: 'numeric', month: 'long', year: 'numeric'
    }).format(todayDate);
    const gregorianDate = new Intl.DateTimeFormat('ar-EG', {
        day: 'numeric', month: 'long', year: 'numeric'
    }).format(todayDate);
    const weekday = new Intl.DateTimeFormat('ar-EG', { weekday: 'long' }).format(todayDate);
    const defaultDateStr = `${weekday}، ${hijriDate} | ${gregorianDate} م`;

    // Core States
    const [activeTab, setActiveTab] = useState('projects'); // 'projects' | 'exams'
    const [projects, setProjects] = useState([]);
    const [examTemplates, setExamTemplates] = useState([]);
    const [evaluationTemplates, setEvaluationTemplates] = useState([]);
    const [testRubrics, setTestRubrics] = useState([]);
    const [centersList, setCentersList] = useState([{ id: 'all', name: 'المركز الرئيسي' }]);
    const [selectedCenterId, setSelectedCenterId] = useState('all');

    // UI States
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [toastMessage, setToastMessage] = useState('');

    // Modal States: Project Create / Edit
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState(null); // null for new, object for edit
    const [projectTitle, setProjectTitle] = useState('');
    const [projectDesc, setProjectDesc] = useState('');
    const [projectType, setProjectType] = useState('QURAN');
    const [isGlobal, setIsGlobal] = useState(true);
    const [requireExam, setRequireExam] = useState(false);
    const [selectedEvalId, setSelectedEvalId] = useState('');
    const [selectedRubricId, setSelectedRubricId] = useState('');
    const [selectedCenters, setSelectedCenters] = useState([]);
    const [saving, setSaving] = useState(false);
    const [deletingProjectId, setDeletingProjectId] = useState(null);

    // Modal States: Stages
    const [selectedProjectForStages, setSelectedProjectForStages] = useState(null);
    const [isStagesModalOpen, setIsStagesModalOpen] = useState(false);
    const [stagesList, setStagesList] = useState([]);
    const [loadingStages, setLoadingStages] = useState(false);
    const [newStageTitle, setNewStageTitle] = useState('');
    const [newStageHasExam, setNewStageHasExam] = useState(false);
    const [addingStage, setAddingStage] = useState(false);

    // Modal States: Parts
    const [selectedProjectForParts, setSelectedProjectForParts] = useState(null);
    const [isPartsModalOpen, setIsPartsModalOpen] = useState(false);
    const [newPartTitle, setNewPartTitle] = useState('الجزء 1');
    const [newPartJuz, setNewPartJuz] = useState(1);
    const [selectedStageForPart, setSelectedStageForPart] = useState('');
    const [addingPart, setAddingPart] = useState(false);

    // Fetch All Initial Data from Backend APIs
    const fetchInitialData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [projRes, evalRes, examRes, rubricsRes, centersRes] = await Promise.all([
                getProjects().catch(() => ({ status: 'error', data: [] })),
                getEvaluationTemplates().catch(() => ({ status: 'error', data: [] })),
                getExamTemplates().catch(() => ({ status: 'error', data: [] })),
                getTestRubrics().catch(() => ({ status: 'error', data: [] })),
                getCentersList().catch(() => ({ status: 'error', data: [] }))
            ]);

            if (projRes && projRes.data) {
                setProjects(projRes.data);
            }
            if (evalRes && evalRes.data) {
                setEvaluationTemplates(evalRes.data);
                if (evalRes.data.length > 0 && !selectedEvalId) {
                    setSelectedEvalId(evalRes.data[0].id);
                }
            }
            if (examRes && examRes.data) {
                setExamTemplates(examRes.data);
            }
            if (rubricsRes && rubricsRes.data) {
                setTestRubrics(rubricsRes.data);
            }
            if (centersRes && centersRes.data && centersRes.data.length > 0) {
                setCentersList([{ id: 'all', name: 'المركز الرئيسي' }, ...centersRes.data.filter(c => c.name !== 'المركز الرئيسي')]);
                setSelectedCenters(centersRes.data.map(c => c.id));
            }
        } catch (err) {
            console.error('Error fetching projects data:', err);
            setError('حدث خطأ أثناء تحميل بيانات المشاريع من الخادم');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, []);

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3500);
    };

    // Open Modal: New Project
    const handleOpenNewProjectModal = () => {
        setEditingProject(null);
        setProjectTitle('');
        setProjectDesc('');
        setProjectType('QURAN');
        setIsGlobal(true);
        setRequireExam(false);
        if (evaluationTemplates.length > 0) {
            setSelectedEvalId(evaluationTemplates[0].id);
        } else {
            setSelectedEvalId('');
        }
        setSelectedRubricId('');
        setIsProjectModalOpen(true);
    };

    // Open Modal: Edit Project
    const handleOpenEditProjectModal = (proj) => {
        setEditingProject(proj);
        setProjectTitle(proj.title || '');
        setProjectDesc(proj.description || '');
        setProjectType(proj.project_type || 'QURAN');
        setIsGlobal(proj.is_global ?? true);
        setRequireExam(proj.require_exam_for_all_stages || false);
        setSelectedEvalId(proj.evaluation_template_id || proj.evaluation_template?.id || '');
        setSelectedRubricId(proj.test_rubric_id || proj.test_rubric?.id || '');
        if (proj.centers && proj.centers.length > 0) {
            setSelectedCenters(proj.centers.map(c => c.id));
        }
        setIsProjectModalOpen(true);
    };

    // Save Project (Create / Update)
    const handleSaveProject = async (e) => {
        e.preventDefault();
        if (!projectTitle.trim()) {
            showToast('يرجى إدخال عنوان المشروع');
            return;
        }
        if (!selectedEvalId) {
            showToast('يرجى تحديد نموذج التقييم');
            return;
        }

        setSaving(true);
        const payload = {
            title: projectTitle.trim(),
            description: projectDesc,
            project_type: projectType,
            is_global: isGlobal,
            require_exam_for_all_stages: requireExam,
            evaluation_template_id: selectedEvalId,
            test_rubric_id: selectedRubricId || null,
            center_ids: isGlobal ? [] : selectedCenters
        };

        try {
            if (editingProject) {
                const res = await updateProject(editingProject.id, payload);
                if (res.status === 'success') {
                    showToast('تم تعديل بيانات المشروع بنجاح');
                    setIsProjectModalOpen(false);
                    fetchInitialData();
                } else {
                    showToast(res.message || 'فشل تعديل المشروع');
                }
            } else {
                const res = await createProject(payload);
                if (res.status === 'success') {
                    showToast('تم إنشاء المشروع بنجاح');
                    setIsProjectModalOpen(false);
                    fetchInitialData();
                } else if (res.status === 'warning_duplicate') {
                    if (window.confirm(`${res.message} هل تريد المتابعة؟`)) {
                        const dupRes = await createProject({ ...payload, confirm_duplicate: true });
                        if (dupRes.status === 'success') {
                            showToast('تم إنشاء المشروع بنجاح');
                            setIsProjectModalOpen(false);
                            fetchInitialData();
                        }
                    }
                } else {
                    showToast(res.message || 'فشل إنشاء المشروع');
                }
            }
        } catch (err) {
            console.error(err);
            showToast(err.response?.data?.message || 'حدث خطأ أثناء حفظ المشروع');
        } finally {
            setSaving(false);
        }
    };

    // Delete Project
    const handleDeleteProject = async (projectId, projTitle) => {
        if (!window.confirm(`هل أنت متأكد من رغبتك في حذف المشروع (${projTitle}) نهائياً؟`)) {
            return;
        }
        setDeletingProjectId(projectId);
        try {
            const res = await deleteProject(projectId);
            if (res.status === 'success') {
                showToast('تم حذف المشروع بنجاح');
                setIsProjectModalOpen(false);
                fetchInitialData();
            } else {
                showToast(res.message || 'فشل حذف المشروع');
            }
        } catch (err) {
            console.error(err);
            showToast('حدث خطأ أثناء حذف المشروع');
        } finally {
            setDeletingProjectId(null);
        }
    };

    // Open Modal: Stages
    const handleOpenStagesModal = async (project) => {
        setSelectedProjectForStages(project);
        setIsStagesModalOpen(true);
        setLoadingStages(true);
        try {
            const res = await getProjectStages(project.id);
            if (res && res.data) {
                setStagesList(res.data);
            } else {
                setStagesList(project.stages || []);
            }
        } catch (err) {
            console.error(err);
            setStagesList(project.stages || []);
        } finally {
            setLoadingStages(false);
        }
    };

    // Add Stage
    const handleAddStage = async () => {
        if (!newStageTitle.trim() || !selectedProjectForStages) return;
        setAddingStage(true);
        try {
            const payload = {
                title: newStageTitle.trim(),
                has_exam: newStageHasExam,
                order: stagesList.length + 1
            };
            const res = await createProjectStage(selectedProjectForStages.id, payload);
            if (res.status === 'success') {
                showToast('تمت إضافة المرحلة بنجاح');
                setNewStageTitle('');
                setNewStageHasExam(false);
                const updatedRes = await getProjectStages(selectedProjectForStages.id);
                if (updatedRes.data) setStagesList(updatedRes.data);
                fetchInitialData();
            }
        } catch (err) {
            console.error(err);
            showToast('فشلت إضافة المرحلة');
        } finally {
            setAddingStage(false);
        }
    };

    // Toggle Stage Has Exam
    const handleToggleStageExam = async (stage) => {
        try {
            const updatedHasExam = !stage.has_exam;
            const res = await updateProjectStage(stage.id, { has_exam: updatedHasExam });
            if (res.status === 'success') {
                showToast(`تم ${updatedHasExam ? 'تفعيل' : 'إلغاء'} خيار الامتحان لهذه المرحلة`);
                setStagesList(prev => prev.map(s => s.id === stage.id ? { ...s, has_exam: updatedHasExam } : s));
                fetchInitialData();
            }
        } catch (err) {
            console.error(err);
            showToast('فشل تعديل خيار الامتحان للمرحلة');
        }
    };

    // Delete Stage
    const handleDeleteStage = async (stageId) => {
        if (!window.confirm('هل تريد بالتأكيد حذف هذه المرحلة؟')) return;
        try {
            const res = await deleteProjectStage(stageId);
            if (res.status === 'success') {
                showToast('تم حذف المرحلة');
                setStagesList(prev => prev.filter(s => s.id !== stageId));
                fetchInitialData();
            }
        } catch (err) {
            console.error(err);
            showToast('فشل حذف المرحلة');
        }
    };

    // Open Modal: Parts
    const handleOpenPartsModal = (project) => {
        setSelectedProjectForParts(project);
        setIsPartsModalOpen(true);
        if (project.stages && project.stages.length > 0) {
            setSelectedStageForPart(project.stages[0].id);
        }
    };

    // Add Part
    const handleAddPart = async () => {
        if (!newPartTitle.trim() || !selectedStageForPart) {
            showToast('يرجى تحديد المرحلة وكتابة اسم الجزء');
            return;
        }
        setAddingPart(true);
        try {
            const payload = {
                title: newPartTitle.trim(),
                part_type: 'DEFAULT_QURAN',
                juz_number: newPartJuz,
                start_page: (newPartJuz - 1) * 20 + 1,
                end_page: newPartJuz * 20
            };
            const res = await createStagePart(selectedStageForPart, payload);
            if (res.status === 'success') {
                showToast('تمت إضافة الجزء بنجاح');
                setNewPartTitle(`الجزء ${newPartJuz + 1 <= 30 ? newPartJuz + 1 : 1}`);
                setNewPartJuz(prev => (prev < 30 ? prev + 1 : 1));
                fetchInitialData();
            }
        } catch (err) {
            console.error(err);
            showToast('فشلت إضافة الجزء');
        } finally {
            setAddingPart(false);
        }
    };

    // Delete Part
    const handleDeletePart = async (partId) => {
        if (!window.confirm('هل تريد حذف هذا الجزء؟')) return;
        try {
            const res = await deleteStagePart(partId);
            if (res.status === 'success') {
                showToast('تم حذف الجزء بنجاح');
                fetchInitialData();
            }
        } catch (err) {
            console.error(err);
            showToast('فشل حذف الجزء');
        }
    };

    // Filter projects based on search query and selected center
    const filteredProjects = projects.filter(p => {
        const query = searchQuery.trim().toLowerCase();
        const matchesQuery = query === '' ||
            (p.title && p.title.toLowerCase().includes(query)) ||
            (p.evaluation_template_title && p.evaluation_template_title.toLowerCase().includes(query)) ||
            (p.evaluation_template?.title && p.evaluation_template.title.toLowerCase().includes(query));

        const matchesCenter = selectedCenterId === 'all' ||
            p.is_global ||
            (p.centers && p.centers.some(c => String(c.id) === String(selectedCenterId)));

        return matchesQuery && matchesCenter;
    });

    // Filter exams based on search query
    const filteredExams = examTemplates.filter(tmpl => {
        const query = searchQuery.trim().toLowerCase();
        return query === '' ||
            (tmpl.title && tmpl.title.toLowerCase().includes(query)) ||
            (tmpl.description && tmpl.description.toLowerCase().includes(query));
    });

    return (
        <div style={{
            direction: 'rtl',
            fontFamily: "'Tajawal', sans-serif",
            color: '#1e293b',
            width: '100%',
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '1.25rem 1.5rem'
        }}>
            {/* Toast Notification */}
            {toastMessage && (
                <div style={{
                    position: 'fixed',
                    bottom: '24px',
                    left: '24px',
                    zIndex: 9999,
                    background: '#133315',
                    color: '#ffffff',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '10px',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.18)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '0.95rem',
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <Check size={18} color="#8fc97e" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Top Bar matching reference: Greeting + Center Dropdown + Bell */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1.25rem',
                marginBottom: '2rem'
            }}>
                {/* Greeting on Right (RTL first) */}
                <div>
                    <h1 style={{
                        fontSize: '1.9rem',
                        fontWeight: 800,
                        color: '#0f172a',
                        margin: '0 0 0.35rem 0',
                        letterSpacing: '-0.3px'
                    }}>
                        السلام عليكم، أ. {currentUserName}
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0, fontWeight: 500 }}>
                        {defaultDateStr}
                    </p>
                </div>

                {/* Left Actions: Center selector + Bell */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    {/* Center Filter Dropdown */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#ffffff',
                        border: '1px solid #d1d5db',
                        borderRadius: '10px',
                        padding: '0.45rem 0.9rem',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                        cursor: 'pointer'
                    }}>
                        <CaretDown size={14} color="#64748b" />
                        <select
                            value={selectedCenterId}
                            onChange={(e) => setSelectedCenterId(e.target.value)}
                            style={{
                                appearance: 'none',
                                border: 'none',
                                background: 'transparent',
                                color: '#334155',
                                fontSize: '0.92rem',
                                fontWeight: 600,
                                outline: 'none',
                                cursor: 'pointer',
                                padding: '0 4px',
                                fontFamily: 'inherit'
                            }}
                        >
                            {centersList.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        <MapPin size={17} color="#64748b" />
                    </div>

                    {/* Notification Bell with red dot */}
                    <button style={{
                        position: 'relative',
                        width: '40px',
                        height: '40px',
                        background: '#ffffff',
                        border: '1px solid #d1d5db',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                        color: '#475569',
                        padding: 0
                    }}>
                        <Bell size={20} />
                        <span style={{
                            position: 'absolute',
                            top: '8px',
                            right: '9px',
                            width: '7.5px',
                            height: '7.5px',
                            backgroundColor: '#ea580c',
                            borderRadius: '50%',
                            border: '1.5px solid #ffffff'
                        }}></span>
                    </button>
                </div>
            </div>

            {/* Navigation & Action Bar: Tabs (المشاريع / الاختبارات) on RIGHT | Search in CENTER | "مشروع جديد" on LEFT */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1.25rem',
                paddingBottom: '0.9rem',
                borderBottom: '1.5px solid #cbd5e1',
                marginBottom: '1.75rem'
            }}>
                {/* RIGHT: Tabs: المشاريع / الاختبارات */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '2.5rem' }}>
                    {/* المشاريع Tab */}
                    <div
                        onClick={() => setActiveTab('projects')}
                        style={{
                            cursor: 'pointer',
                            position: 'relative',
                            userSelect: 'none'
                        }}
                    >
                        <span style={{
                            fontFamily: activeTab === 'projects' ? "'Amiri', 'Tajawal', serif" : "'Tajawal', sans-serif",
                            fontSize: activeTab === 'projects' ? '2.1rem' : '1.7rem',
                            fontWeight: activeTab === 'projects' ? 800 : 700,
                            color: activeTab === 'projects' ? '#143818' : '#64748b',
                            letterSpacing: '-0.3px',
                            display: 'inline-block',
                            transition: 'color 0.2s ease'
                        }}>
                            المشاريع
                        </span>
                        {activeTab === 'projects' && (
                            <svg
                                width="44"
                                height="6"
                                viewBox="0 0 44 6"
                                fill="none"
                                style={{
                                    position: 'absolute',
                                    bottom: '-4px',
                                    right: '2px',
                                    pointerEvents: 'none'
                                }}
                            >
                                <path
                                    d="M2 3C12 5.5 28 5.5 42 2"
                                    stroke="#143818"
                                    strokeWidth="3.5"
                                    strokeLinecap="round"
                                />
                            </svg>
                        )}
                    </div>

                    {/* الاختبارات Tab */}
                    <div
                        onClick={() => setActiveTab('exams')}
                        style={{
                            cursor: 'pointer',
                            position: 'relative',
                            userSelect: 'none'
                        }}
                    >
                        <span style={{
                            fontFamily: activeTab === 'exams' ? "'Amiri', 'Tajawal', serif" : "'Tajawal', sans-serif",
                            fontSize: activeTab === 'exams' ? '2.1rem' : '1.7rem',
                            fontWeight: activeTab === 'exams' ? 800 : 700,
                            color: activeTab === 'exams' ? '#143818' : '#64748b',
                            letterSpacing: '-0.3px',
                            display: 'inline-block',
                            transition: 'color 0.2s ease'
                        }}>
                            الاختبارات
                        </span>
                        {activeTab === 'exams' && (
                            <svg
                                width="44"
                                height="6"
                                viewBox="0 0 44 6"
                                fill="none"
                                style={{
                                    position: 'absolute',
                                    bottom: '-4px',
                                    right: '2px',
                                    pointerEvents: 'none'
                                }}
                            >
                                <path
                                    d="M2 3C12 5.5 28 5.5 42 2"
                                    stroke="#143818"
                                    strokeWidth="3.5"
                                    strokeLinecap="round"
                                />
                            </svg>
                        )}
                    </div>
                </div>

                {/* CENTER: Search Bar */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    padding: '0.45rem 1rem',
                    width: '280px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                }}>
                    <input
                        type="text"
                        placeholder="ابحث عن مشروع ..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            fontSize: '0.92rem',
                            fontFamily: 'inherit',
                            color: '#1e293b',
                            width: '100%'
                        }}
                    />
                    <MagnifyingGlass size={18} color="#64748b" />
                </div>

                {/* LEFT: New Project / New Exam Button */}
                <div>
                    {activeTab === 'projects' && (
                        <button
                            onClick={handleOpenNewProjectModal}
                            style={{
                                background: '#4a6b18',
                                color: '#ffffff',
                                border: 'none',
                                padding: '0.55rem 1.6rem',
                                borderRadius: '9px',
                                fontSize: '0.98rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                boxShadow: '0 2px 5px rgba(74, 107, 24, 0.25)',
                                transition: 'background 0.2s ease',
                                fontFamily: 'inherit'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#3c5713'}
                            onMouseOut={(e) => e.currentTarget.style.background = '#4a6b18'}
                        >
                            مشروع جديد
                        </button>
                    )}
                </div>
            </div>

            {/* TAB CONTENT 1: PROJECTS */}
            {activeTab === 'projects' && (
                <div>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '4.5rem 0' }}>
                            <div style={{
                                border: '4px solid #f1f5f9',
                                borderTop: '4px solid #4a6b18',
                                borderRadius: '50%',
                                width: '40px',
                                height: '40px',
                                animation: 'spin 1s linear infinite',
                                margin: '0 auto 1.25rem'
                            }}></div>
                            <p style={{ color: '#64748b', fontWeight: 600, fontSize: '0.95rem' }}>جاري تحميل المشاريع من الخادم...</p>
                            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                        </div>
                    ) : error ? (
                        <div style={{
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: '14px',
                            padding: '1.75rem',
                            textAlign: 'center',
                            color: '#991b1b',
                            margin: '1rem 0'
                        }}>
                            <p style={{ margin: '0 0 1rem 0', fontWeight: 700, fontSize: '1.05rem' }}>{error}</p>
                            <button
                                onClick={fetchInitialData}
                                style={{
                                    background: '#dc2626',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '0.55rem 1.5rem',
                                    borderRadius: '8px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    fontFamily: 'inherit'
                                }}
                            >
                                إعادة المحاولة
                            </button>
                        </div>
                    ) : filteredProjects.length === 0 ? (
                        <div style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '16px',
                            padding: '4rem 2rem',
                            textAlign: 'center',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                        }}>
                            <BookOpen size={52} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
                            <h3 style={{ fontSize: '1.3rem', color: '#334155', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                                لا توجد مشاريع مضافة حالياً
                            </h3>
                            <p style={{ color: '#64748b', fontSize: '0.95rem', margin: '0 0 1.5rem 0' }}>
                                لم يتم العثور على أي مشاريع مطابقة لبحثك، أو لم يتم إضافة مشاريع بعد.
                            </p>
                            <button
                                onClick={handleOpenNewProjectModal}
                                style={{
                                    background: '#4a6b18',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '0.65rem 1.6rem',
                                    borderRadius: '9px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    fontFamily: 'inherit'
                                }}
                            >
                                إضافة مشروع جديد الآن
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                            {filteredProjects.map((project) => {
                                const stageCount = project.stages ? project.stages.length : 0;
                                const evalTitle = project.evaluation_template_title ||
                                    (project.evaluation_template ? project.evaluation_template.title : 'الضبط والاتقان');

                                return (
                                    <div
                                        key={project.id}
                                        style={{
                                            background: '#ffffff',
                                            border: '1px solid #334155',
                                            borderRadius: '16px',
                                            padding: '1.35rem 1.75rem',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            flexWrap: 'wrap',
                                            gap: '1.25rem',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                                            position: 'relative',
                                            transition: 'box-shadow 0.2s ease'
                                        }}
                                    >
                                        {/* Right Details: Vertical Orange Pill + Title + Metadata */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                            {/* Inside Vertical Orange Rounded Capsule Pill */}
                                            <div style={{
                                                width: '9.5px',
                                                height: '52px',
                                                backgroundColor: '#e25c1d',
                                                borderRadius: '999px',
                                                flexShrink: 0
                                            }}></div>

                                            <div>
                                                <h2 style={{
                                                    fontSize: '1.35rem',
                                                    fontWeight: 800,
                                                    color: '#0f172a',
                                                    margin: '0 0 0.5rem 0',
                                                    letterSpacing: '-0.2px'
                                                }}>
                                                    {project.title}
                                                </h2>

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                                    {/* Meta 1: Stages Count */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{
                                                            width: '12px',
                                                            height: '12px',
                                                            borderRadius: '50%',
                                                            backgroundColor: '#7cb342',
                                                            display: 'inline-block'
                                                        }}></span>
                                                        <span style={{ color: '#64748b', fontSize: '0.94rem', fontWeight: 600 }}>
                                                            {stageCount} مراحل
                                                        </span>
                                                    </div>

                                                    {/* Meta 2: Evaluation Template */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{
                                                            width: '12px',
                                                            height: '12px',
                                                            borderRadius: '50%',
                                                            backgroundColor: '#7cb342',
                                                            display: 'inline-block'
                                                        }}></span>
                                                        <span style={{ color: '#64748b', fontSize: '0.94rem', fontWeight: 600 }}>
                                                            نموذج التقييم : {evalTitle}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Left Actions: مراحل المشروع | أجزاء المشروع | تعديل */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                                            {/* Button 1: مراحل المشروع (Orange) */}
                                            <button
                                                onClick={() => handleOpenStagesModal(project)}
                                                style={{
                                                    background: '#e25c1d',
                                                    color: '#ffffff',
                                                    border: 'none',
                                                    padding: '0.55rem 1.4rem',
                                                    borderRadius: '9px',
                                                    fontSize: '0.95rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    boxShadow: '0 2px 4px rgba(226, 92, 29, 0.2)',
                                                    transition: 'background 0.2s ease',
                                                    fontFamily: 'inherit'
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.background = '#c94e16'}
                                                onMouseOut={(e) => e.currentTarget.style.background = '#e25c1d'}
                                            >
                                                مراحل المشروع
                                            </button>

                                            {/* Button 2: أجزاء المشروع (Orange) */}
                                            <button
                                                onClick={() => handleOpenPartsModal(project)}
                                                style={{
                                                    background: '#e25c1d',
                                                    color: '#ffffff',
                                                    border: 'none',
                                                    padding: '0.55rem 1.4rem',
                                                    borderRadius: '9px',
                                                    fontSize: '0.95rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    boxShadow: '0 2px 4px rgba(226, 92, 29, 0.2)',
                                                    transition: 'background 0.2s ease',
                                                    fontFamily: 'inherit'
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.background = '#c94e16'}
                                                onMouseOut={(e) => e.currentTarget.style.background = '#e25c1d'}
                                            >
                                                أجزاء المشروع
                                            </button>

                                            {/* Button 3: تعديل (Olive Green) */}
                                            <button
                                                onClick={() => handleOpenEditProjectModal(project)}
                                                style={{
                                                    background: '#4a6b18',
                                                    color: '#ffffff',
                                                    border: 'none',
                                                    padding: '0.55rem 2rem',
                                                    borderRadius: '9px',
                                                    fontSize: '0.95rem',
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
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB CONTENT 2: TESTS & EVALUATIONS MODULE */}
            {activeTab === 'exams' && (
                <TestsModule
                    searchQuery={searchQuery}
                    showToast={showToast}
                />
            )}

            {/* MODAL 1: Create / Edit Project Modal */}
            {isProjectModalOpen && (
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
                        borderRadius: '18px',
                        width: '100%',
                        maxWidth: '580px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        padding: '1.75rem',
                        boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
                        direction: 'rtl'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '1.25rem',
                            borderBottom: '1px solid #e2e8f0',
                            paddingBottom: '0.75rem'
                        }}>
                            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#143818', margin: 0 }}>
                                {editingProject ? 'تعديل بيانات المشروع' : 'إضافة مشروع جديد'}
                            </h3>
                            <button
                                onClick={() => setIsProjectModalOpen(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveProject}>
                            <div style={{ marginBottom: '1.15rem' }}>
                                <label style={{ display: 'block', fontSize: '0.92rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                    اسم / عنوان المشروع *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={projectTitle}
                                    onChange={(e) => setProjectTitle(e.target.value)}
                                    placeholder="مثال: مشروع الضبط والاتقان"
                                    style={{
                                        width: '100%',
                                        padding: '0.65rem 0.9rem',
                                        borderRadius: '8px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '0.95rem',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        fontFamily: 'inherit'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '1.15rem' }}>
                                <label style={{ display: 'block', fontSize: '0.92rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                    وصف المشروع
                                </label>
                                <textarea
                                    rows={3}
                                    value={projectDesc}
                                    onChange={(e) => setProjectDesc(e.target.value)}
                                    placeholder="اكتب وصفاً موجزاً للمشروع وأهدافه..."
                                    style={{
                                        width: '100%',
                                        padding: '0.65rem 0.9rem',
                                        borderRadius: '8px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '0.95rem',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        fontFamily: 'inherit'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '1.15rem' }}>
                                <label style={{ display: 'block', fontSize: '0.92rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                    نموذج التقييم *
                                </label>
                                <select
                                    required
                                    value={selectedEvalId}
                                    onChange={(e) => setSelectedEvalId(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '0.65rem 0.9rem',
                                        borderRadius: '8px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '0.95rem',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        background: '#fff',
                                        fontFamily: 'inherit'
                                    }}
                                >
                                    <option value="">-- اختر نموذج التقييم --</option>
                                    {evaluationTemplates.map((t) => (
                                        <option key={t.id} value={t.id}>{t.title}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ marginBottom: '1.15rem' }}>
                                <label style={{ display: 'block', fontSize: '0.92rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                    سلم الاختبار
                                </label>
                                <select
                                    value={selectedRubricId}
                                    onChange={(e) => setSelectedRubricId(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '0.65rem 0.9rem',
                                        borderRadius: '8px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '0.95rem',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        background: '#fff',
                                        fontFamily: 'inherit'
                                    }}
                                >
                                    <option value="">-- اختر سلم الاختبار (اختياري) --</option>
                                    {testRubrics.map((r) => (
                                        <option key={r.id} value={r.id}>{r.title}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ marginBottom: '1.15rem' }}>
                                <label style={{ display: 'block', fontSize: '0.92rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                    نوع المشروع
                                </label>
                                <select
                                    value={projectType}
                                    onChange={(e) => setProjectType(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '0.65rem 0.9rem',
                                        borderRadius: '8px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '0.95rem',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        background: '#fff',
                                        fontFamily: 'inherit'
                                    }}
                                >
                                    <option value="QURAN">مشروع قرآني (حفظ ومراجعة)</option>
                                    <option value="CUSTOM">مشروع منهجي مخصص</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.92rem', fontWeight: 600, color: '#334155' }}>
                                    <input
                                        type="checkbox"
                                        checked={isGlobal}
                                        onChange={(e) => setIsGlobal(e.target.checked)}
                                    />
                                    <span>مشروع عام (متاح لجميع المراكز)</span>
                                </label>

                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.92rem', fontWeight: 600, color: '#334155' }}>
                                    <input
                                        type="checkbox"
                                        checked={requireExam}
                                        onChange={(e) => setRequireExam(e.target.checked)}
                                    />
                                    <span>اشتراط اختبار لكل مرحلة</span>
                                </label>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '1rem' }}>
                                {/* Delete button if editing */}
                                <div>
                                    {editingProject && (
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteProject(editingProject.id, editingProject.title)}
                                            disabled={deletingProjectId === editingProject.id}
                                            style={{
                                                background: '#fee2e2',
                                                color: '#dc2626',
                                                border: 'none',
                                                padding: '0.55rem 1rem',
                                                borderRadius: '8px',
                                                fontWeight: 700,
                                                fontSize: '0.88rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                fontFamily: 'inherit'
                                            }}
                                        >
                                            <Trash size={16} />
                                            <span>{deletingProjectId === editingProject.id ? 'جاري الحذف...' : 'حذف المشروع'}</span>
                                        </button>
                                    )}
                                </div>

                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => setIsProjectModalOpen(false)}
                                        style={{
                                            background: '#f1f5f9',
                                            color: '#475569',
                                            border: 'none',
                                            padding: '0.6rem 1.4rem',
                                            borderRadius: '8px',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            fontFamily: 'inherit'
                                        }}
                                    >
                                        إلغاء
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        style={{
                                            background: '#4a6b18',
                                            color: '#ffffff',
                                            border: 'none',
                                            padding: '0.6rem 1.8rem',
                                            borderRadius: '8px',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            opacity: saving ? 0.7 : 1,
                                            fontFamily: 'inherit'
                                        }}
                                    >
                                        {saving ? 'جاري الحفظ...' : (editingProject ? 'تحديث البيانات' : 'حفظ المشروع')}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: Manage Stages Modal */}
            {isStagesModalOpen && selectedProjectForStages && (
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
                        borderRadius: '18px',
                        width: '100%',
                        maxWidth: '620px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        padding: '1.75rem',
                        boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
                        direction: 'rtl'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '1.25rem',
                            borderBottom: '1px solid #e2e8f0',
                            paddingBottom: '0.75rem'
                        }}>
                            <div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#143818', margin: 0 }}>
                                    مراحل المشروع: {selectedProjectForStages.title}
                                </h3>
                                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 0' }}>
                                    إضافة وتعديل ترتيب مراحل المشروع القرآنية
                                </p>
                            </div>
                            <button
                                onClick={() => setIsStagesModalOpen(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Add New Stage Box */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    placeholder="اسم المرحلة الجديد (مثال: المرحلة 6)"
                                    value={newStageTitle}
                                    onChange={(e) => setNewStageTitle(e.target.value)}
                                    style={{
                                        flex: 1,
                                        padding: '0.6rem 0.9rem',
                                        borderRadius: '8px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '0.92rem',
                                        outline: 'none',
                                        fontFamily: 'inherit'
                                    }}
                                />
                                <button
                                    onClick={handleAddStage}
                                    disabled={addingStage || !newStageTitle.trim()}
                                    style={{
                                        background: '#e25c1d',
                                        color: '#ffffff',
                                        border: 'none',
                                        padding: '0.6rem 1.4rem',
                                        borderRadius: '8px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        opacity: addingStage ? 0.7 : 1,
                                        fontFamily: 'inherit'
                                    }}
                                >
                                    {addingStage ? 'جاري الإضافة...' : 'إضافة مرحلة'}
                                </button>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', color: '#475569', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={newStageHasExam}
                                    onChange={(e) => setNewStageHasExam(e.target.checked)}
                                />
                                <span>إجراء امتحان بعد إنهاء هذه المرحلة</span>
                            </label>
                        </div>

                        {/* Stages List */}
                        {loadingStages ? (
                            <p style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem 0' }}>جاري تحميل المراحل...</p>
                        ) : stagesList.length === 0 ? (
                            <p style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem 0' }}>لا توجد مراحل مضافة لهذا المشروع بعد.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {stagesList.map((st, idx) => (
                                    <div
                                        key={st.id || idx}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '0.85rem 1.15rem',
                                            background: '#f8fafc',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '10px'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{
                                                background: '#4a6b18',
                                                color: '#fff',
                                                width: '26px',
                                                height: '26px',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '0.82rem',
                                                fontWeight: 700
                                            }}>
                                                {st.order || idx + 1}
                                            </span>
                                            <span style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
                                                {st.title}
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <button
                                                onClick={() => handleToggleStageExam(st)}
                                                style={{
                                                    background: st.has_exam ? '#dcfce7' : '#f1f5f9',
                                                    color: st.has_exam ? '#166534' : '#64748b',
                                                    border: `1px solid ${st.has_exam ? '#86efac' : '#cbd5e1'}`,
                                                    padding: '0.35rem 0.75rem',
                                                    borderRadius: '6px',
                                                    fontSize: '0.82rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                                title="تغيير خيار امتحان المرحلة"
                                            >
                                                <Exam size={14} />
                                                <span>امتحان: {st.has_exam ? 'نعم' : 'لا'}</span>
                                            </button>

                                            <button
                                                onClick={() => handleDeleteStage(st.id)}
                                                style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '4px' }}
                                                title="حذف المرحلة"
                                            >
                                                <Trash size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL 3: Manage Parts Modal */}
            {isPartsModalOpen && selectedProjectForParts && (
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
                        borderRadius: '18px',
                        width: '100%',
                        maxWidth: '640px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        padding: '1.75rem',
                        boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
                        direction: 'rtl'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '1.25rem',
                            borderBottom: '1px solid #e2e8f0',
                            paddingBottom: '0.75rem'
                        }}>
                            <div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#143818', margin: 0 }}>
                                    أجزاء المشروع: {selectedProjectForParts.title}
                                </h3>
                                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 0' }}>
                                    توزيع وربط الأجزاء القرآنية بمراحل المشروع
                                </p>
                            </div>
                            <button
                                onClick={() => setIsPartsModalOpen(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Add Part Form Box */}
                        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155', margin: '0 0 0.75rem 0' }}>إضافة جزء جديد للمرحلة</h4>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                                <select
                                    value={selectedStageForPart}
                                    onChange={(e) => setSelectedStageForPart(e.target.value)}
                                    style={{ padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', flex: 1, fontFamily: 'inherit' }}
                                >
                                    {selectedProjectForParts.stages && selectedProjectForParts.stages.map(s => (
                                        <option key={s.id} value={s.id}>{s.title}</option>
                                    ))}
                                </select>

                                <select
                                    value={newPartJuz}
                                    onChange={(e) => {
                                        const juz = Number(e.target.value);
                                        setNewPartJuz(juz);
                                        setNewPartTitle(`الجزء ${juz}`);
                                    }}
                                    style={{ padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', width: '130px', fontFamily: 'inherit' }}
                                >
                                    {Array.from({ length: 30 }, (_, i) => i + 1).map(j => (
                                        <option key={j} value={j}>الجزء {j}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    placeholder="عنوان الجزء (مثال: الجزء 1)"
                                    value={newPartTitle}
                                    onChange={(e) => setNewPartTitle(e.target.value)}
                                    style={{ flex: 1, padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontFamily: 'inherit' }}
                                />
                                <button
                                    onClick={handleAddPart}
                                    disabled={addingPart}
                                    style={{
                                        background: '#e25c1d',
                                        color: '#fff',
                                        border: 'none',
                                        padding: '0.55rem 1.4rem',
                                        borderRadius: '8px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        fontFamily: 'inherit'
                                    }}
                                >
                                    {addingPart ? 'جاري الإضافة...' : 'حفظ الجزء'}
                                </button>
                            </div>
                        </div>

                        {/* Existing Parts grouped by stage */}
                        {selectedProjectForParts.stages && selectedProjectForParts.stages.map(st => (
                            <div key={st.id} style={{ marginBottom: '1.25rem' }}>
                                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#143818', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '0.5rem' }}>
                                    {st.title} ({st.parts ? st.parts.length : 0} أجزاء)
                                </h4>
                                {st.parts && st.parts.length > 0 ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '8px' }}>
                                        {st.parts.map(pt => (
                                            <div key={pt.id} style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.5rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#334155' }}>{pt.title}</span>
                                                <button onClick={() => handleDeletePart(pt.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '2px' }}>
                                                    <Trash size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>لا توجد أجزاء لهذه المرحلة بعد.</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CentersAndProjects;
