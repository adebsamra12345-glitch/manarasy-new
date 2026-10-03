import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, MagnifyingGlass, CaretDown, MapPin, Check, WarningCircle } from '@phosphor-icons/react';
import { getProjects, getCentersList, createProject, updateProject, deleteProject, getEvaluationTemplates, getTestRubrics } from '../../../services/api/tenantService';

const MobileCentersAndProjects = () => {
    const [projects, setProjects] = useState([]);
    const [centersList, setCentersList] = useState([{ id: 'all', name: 'المركز الرئيسي' }]);
    const [selectedCenterId, setSelectedCenterId] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    const [evaluationTemplates, setEvaluationTemplates] = useState([]);
    const [testRubrics, setTestRubrics] = useState([]);

    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [projectTitle, setProjectTitle] = useState('');
    const [projectDesc, setProjectDesc] = useState('');
    const [projectType, setProjectType] = useState('QURAN');
    const [isGlobal, setIsGlobal] = useState(true);
    const [requireExam, setRequireExam] = useState(false);
    const [selectedEvalId, setSelectedEvalId] = useState('');
    const [selectedRubricId, setSelectedRubricId] = useState('');
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const loadData = async () => {
        setLoading(true);
        try {
            const [projRes, centersRes, evalRes, rubricsRes] = await Promise.all([
                getProjects().catch(() => ({ data: [] })),
                getCentersList().catch(() => ({ data: [] })),
                getEvaluationTemplates().catch(() => ({ data: [] })),
                getTestRubrics().catch(() => ({ data: [] }))
            ]);
            if (projRes?.data) setProjects(projRes.data);
            if (centersRes?.data?.length > 0) {
                setCentersList([{ id: 'all', name: 'المركز الرئيسي' }, ...centersRes.data]);
            }
            if (evalRes?.data) setEvaluationTemplates(evalRes.data);
            if (rubricsRes?.data) setTestRubrics(rubricsRes.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleOpenNewProjectModal = () => {
        setEditingProject(null);
        setProjectTitle('');
        setProjectDesc('');
        setProjectType('QURAN');
        setIsGlobal(true);
        setRequireExam(false);
        if (evaluationTemplates.length > 0) setSelectedEvalId(evaluationTemplates[0].id);
        else setSelectedEvalId('');
        setSelectedRubricId('');
        setErrorMsg('');
        setIsProjectModalOpen(true);
    };

    const handleSaveProject = async () => {
        if (!projectTitle.trim()) {
            setErrorMsg('يرجى إدخال عنوان المشروع');
            return;
        }
        if (!selectedEvalId) {
            setErrorMsg('يرجى تحديد نموذج التقييم');
            return;
        }

        setSaving(true);
        setErrorMsg('');
        const payload = {
            title: projectTitle.trim(),
            description: projectDesc,
            project_type: projectType,
            is_global: isGlobal,
            require_exam_for_all_stages: requireExam,
            evaluation_template_id: selectedEvalId,
            test_rubric_id: selectedRubricId || null,
            center_ids: isGlobal ? [] : (selectedCenterId !== 'all' ? [selectedCenterId] : [])
        };

        try {
            let res;
            if (editingProject) {
                res = await updateProject(editingProject.id, payload);
            } else {
                res = await createProject(payload);
                if (res.status === 'warning_duplicate') {
                    if (window.confirm(`${res.message} هل تريد المتابعة؟`)) {
                        res = await createProject({ ...payload, confirm_duplicate: true });
                    } else {
                        setSaving(false);
                        return;
                    }
                }
            }
            if (res.status === 'success') {
                setIsProjectModalOpen(false);
                loadData();
            } else {
                setErrorMsg(res.message || 'فشل حفظ المشروع');
            }
        } catch (err) {
            setErrorMsg(err.response?.data?.message || 'حدث خطأ أثناء حفظ المشروع');
        } finally {
            setSaving(false);
        }
    };

    const handleOpenEditProjectModal = (proj) => {
        setEditingProject(proj);
        setProjectTitle(proj.title || '');
        setProjectDesc(proj.description || '');
        setProjectType(proj.project_type || 'QURAN');
        setIsGlobal(proj.is_global ?? true);
        setRequireExam(proj.require_exam_for_all_stages || false);
        setSelectedEvalId(proj.evaluation_template_id || proj.evaluation_template?.id || '');
        setSelectedRubricId(proj.test_rubric_id || proj.test_rubric?.id || '');
        setErrorMsg('');
        setIsProjectModalOpen(true);
    };

    const handleDeleteProject = async (proj) => {
        if (!window.confirm(`هل أنت متأكد من رغبتك في حذف المشروع (${proj.title})؟`)) return;
        try {
            const res = await deleteProject(proj.id);
            if (res.status === 'success') {
                loadData();
            } else {
                alert(res.message || 'فشل حذف المشروع');
            }
        } catch (err) {
            console.error(err);
            alert('حدث خطأ أثناء الحذف');
        }
    };

    const filteredProjects = projects.filter(p => {
        const query = searchQuery.trim().toLowerCase();
        const matchesQuery = query === '' || (p.title && p.title.toLowerCase().includes(query));
        const matchesCenter = selectedCenterId === 'all' || p.is_global || (p.centers && p.centers.some(c => String(c.id) === String(selectedCenterId)));
        return matchesQuery && matchesCenter;
    });

    return (
        <div style={{ padding: '1rem', paddingBottom: '5rem', direction: 'rtl', fontFamily: 'inherit', background: '#f8fafc', minHeight: '100vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.4rem', color: '#133315', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <BookOpen size={24} color="#558b2f" /> المشاريع
                </h2>
                <button onClick={handleOpenNewProjectModal} style={{ background: '#133315', color: '#fff', border: 'none', borderRadius: '10px', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
                    <Plus size={16} weight="bold" /><span>مشروع جديد</span>
                </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexDirection: 'column' }}>
                <select value={selectedCenterId} onChange={(e) => setSelectedCenterId(e.target.value)} style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '1px solid #eee', fontSize: '0.9rem', outline: 'none', background: '#fff' }}>
                    {centersList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div style={{ position: 'relative' }}>
                    <input type="text" placeholder="بحث عن مشروع..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '0.8rem 2.5rem 0.8rem 1rem', borderRadius: '12px', border: '1px solid #eee', fontSize: '0.9rem', outline: 'none' }} />
                    <MagnifyingGlass size={18} color="#888" style={{ position: 'absolute', top: '50%', right: '0.8rem', transform: 'translateY(-50%)' }} />
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#558b2f' }}>جاري التحميل...</div>
            ) : filteredProjects.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#888', background: '#fff', borderRadius: '16px', border: '1px dashed #ccc' }}>لا توجد مشاريع مضافة حالياً</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {filteredProjects.map(project => (
                        <div key={project.id} style={{ background: '#fff', borderRadius: '16px', padding: '1rem', border: '1px solid #eee', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '4px', background: '#558b2f' }}></div>
                            <div style={{ paddingRight: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', margin: 0, color: '#133315', fontWeight: 'bold' }}>{project.title}</h3>
                                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '8px', background: '#e8f5e9', color: '#2e7d32', fontWeight: 'bold' }}>
                                        {project.is_global ? 'عام' : 'مخصص'}
                                    </span>
                                </div>
                                <p style={{ fontSize: '0.85rem', color: '#666', margin: '0 0 0.8rem 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {project.description || 'لا يوجد وصف للمشروع'}
                                </p>
                                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#888' }}>
                                    <span>المراحل: {project.stages?.length || 0}</span>
                                    <span>نوع المشروع: {project.project_type === 'QURAN' ? 'قرآن كريم' : project.project_type}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                                    <button onClick={() => handleOpenEditProjectModal(project)} style={{ flex: 1, padding: '0.5rem', background: '#f1f8e9', border: '1px solid #a5d6a7', borderRadius: '8px', color: '#2e7d32', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>تعديل</button>
                                    <button onClick={() => handleDeleteProject(project)} style={{ flex: 1, padding: '0.5rem', background: '#ffebee', border: '1px solid #ffcdd2', borderRadius: '8px', color: '#c62828', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>حذف</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isProjectModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ background: '#fff', width: '100%', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '1.5rem', maxHeight: '85vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#133315' }}>{editingProject ? 'تعديل المشروع' : 'إضافة مشروع جديد'}</h3>
                            <button onClick={() => setIsProjectModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem' }}>&times;</button>
                        </div>
                        {errorMsg && <div style={{ background: '#ffebee', color: '#c62828', padding: '0.8rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>{errorMsg}</div>}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>عنوان المشروع</label>
                                <input type="text" value={projectTitle} onChange={e => setProjectTitle(e.target.value)} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #ddd' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>وصف المشروع</label>
                                <textarea value={projectDesc} onChange={e => setProjectDesc(e.target.value)} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #ddd', minHeight: '80px' }}></textarea>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>نوع المشروع</label>
                                <select value={projectType} onChange={e => setProjectType(e.target.value)} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #ddd', background: '#fff' }}>
                                    <option value="QURAN">قرآن كريم</option>
                                    <option value="TAJWEED">تجويد</option>
                                    <option value="ISLAMIC_STUDIES">دراسات إسلامية</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>نموذج التقييم</label>
                                <select value={selectedEvalId} onChange={e => setSelectedEvalId(e.target.value)} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #ddd', background: '#fff' }}>
                                    <option value="">-- اختر نموذج التقييم --</option>
                                    {evaluationTemplates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>نموذج الاختبار (اختياري)</label>
                                <select value={selectedRubricId} onChange={e => setSelectedRubricId(e.target.value)} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #ddd', background: '#fff' }}>
                                    <option value="">-- بدون نموذج اختبار --</option>
                                    {testRubrics.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input type="checkbox" checked={isGlobal} onChange={e => setIsGlobal(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#133315' }} />
                                <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>مشروع عام (لجميع المراكز)</label>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input type="checkbox" checked={requireExam} onChange={e => setRequireExam(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#133315' }} />
                                <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>يتطلب اختبار لانتقال الطالب</label>
                            </div>
                        </div>
                        <button onClick={handleSaveProject} disabled={saving} style={{ width: '100%', padding: '1rem', background: '#133315', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', marginTop: '1.5rem' }}>
                            {saving ? 'جاري الحفظ...' : 'حفظ'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MobileCentersAndProjects;
