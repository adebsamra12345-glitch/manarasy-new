import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Books, MagnifyingGlass, Plus, X, PencilSimple, Trash, WarningCircle
} from '@phosphor-icons/react';
import {
    getHalaqat, createHalaqa, updateHalaqa, deleteHalaqa,
    getProjects, getCentersList, getMosqueAdminDashboardData
} from '../../../services/api/tenantService';
import { getTeachers } from '../../../services/api/userService';

const MobileHalqaManagement = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const basePath = location.pathname.startsWith('/center-manager') ? '/center-manager' : '/admin';

    const [rings, setRings] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [centers, setCenters] = useState([]);
    const [projects, setProjects] = useState([]);
    const [teachers, setTeachers] = useState([]);

    const [modalMode, setModalMode] = useState('add');
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [editingRing, setEditingRing] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [modalError, setModalError] = useState('');

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deletingRing, setDeletingRing] = useState(null);

    const initialFormState = { name: '', center_id: '', project_id: '', teacher_id: '' };
    const [formData, setFormData] = useState(initialFormState);

    useEffect(() => {
        fetchRings();
        loadDropdownData();
    }, []);

    const fetchRings = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await getHalaqat();
            if (data.status === 'success') {
                const fetchedRings = (data.data || []).map(r => ({
                    ...r,
                    studentsCount: r.students_count || r.current_students_count || 0
                }));
                setRings(fetchedRings);
            } else {
                setError('فشل في جلب قائمة الحلقات');
            }
        } catch (err) {
            setError('حدث خطأ أثناء تحميل الحلقات');
        } finally {
            setLoading(false);
        }
    };

    const loadDropdownData = async () => {
        try {
            const [centersRes, projectsRes, teachersRes] = await Promise.all([
                getCentersList().catch(async () => {
                    const dash = await getMosqueAdminDashboardData('all').catch(() => null);
                    return { data: dash?.data?.centers || [] };
                }),
                getProjects().catch(() => ({ data: [] })),
                getTeachers().catch(() => ({ data: [] }))
            ]);
            setCenters(Array.isArray(centersRes?.data) ? centersRes.data : []);
            setProjects(Array.isArray(projectsRes?.data) ? projectsRes.data : []);
            setTeachers(Array.isArray(teachersRes?.data) ? teachersRes.data : []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleOpenAddModal = () => {
        setModalMode('add');
        setEditingRing(null);
        setFormData({ ...initialFormState, center_id: centers.length === 1 ? centers[0].id : '' });
        setModalError('');
        setIsAddEditModalOpen(true);
    };

    const handleOpenEditModal = (ring) => {
        setModalMode('edit');
        setEditingRing(ring);
        setModalError('');

        const ringCenterId = ring.center_id || '';
        let matchedTeacherId = ring.teacher_id || '';

        if (!matchedTeacherId && ring.teacher_name && teachers.length > 0) {
            const cleanRingTeacher = ring.teacher_name.trim().toLowerCase();
            const foundTeacher = teachers.find(t => {
                const fullName = (t.full_name || `${t.first_name || ''} ${t.last_name || ''}`).trim().toLowerCase();
                const username = (t.username || '').toLowerCase();
                return fullName === cleanRingTeacher || username === cleanRingTeacher || fullName.includes(cleanRingTeacher);
            });
            if (foundTeacher) {
                matchedTeacherId = foundTeacher.id || foundTeacher.user_id;
            }
        }

        setFormData({
            name: ring.name || '',
            center_id: ringCenterId,
            project_id: ring.project_id || '',
            teacher_id: matchedTeacherId
        });
        setIsAddEditModalOpen(true);
    };

    const handleOpenDeleteModal = (ring) => {
        setDeletingRing(ring);
        setIsDeleteModalOpen(true);
    };

    const handleSaveHalaqa = async (confirmDuplicate = false) => {
        setModalError('');
        setSubmitting(true);

        if (!formData.name.trim()) {
            setModalError('اسم الحلقة مطلوب');
            setSubmitting(false);
            return;
        }

        try {
            const payload = {
                name: formData.name.trim(),
                center_id: formData.center_id,
                project_id: formData.project_id,
                teacher_id: formData.teacher_id,
                confirm_duplicate: confirmDuplicate
            };

            let res;
            if (modalMode === 'add') {
                res = await createHalaqa(payload);
            } else {
                res = await updateHalaqa(editingRing.id, payload);
            }

            if (res.status === 'success') {
                setIsAddEditModalOpen(false);
                setEditingRing(null);
                setFormData(initialFormState);
                fetchRings();
            } else {
                setModalError(res.message || 'فشل حفظ بيانات الحلقة القرآنية');
            }
        } catch (err) {
            setModalError(err.response?.data?.message || err.message || 'حدث خطأ أثناء حفظ بيانات الحلقة');
        } finally {
            setSubmitting(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!deletingRing) return;
        setSubmitting(true);
        try {
            const res = await deleteHalaqa(deletingRing.id);
            if (res.status === 'success') {
                setIsDeleteModalOpen(false);
                setDeletingRing(null);
                fetchRings();
            }
        } catch (err) {
            console.error('Error deleting halaqa:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const filteredTeachers = teachers.filter(t => {
        if (!formData.center_id) return true;
        const teacherCenterId = t.center?.id || t.center_id || t.center;
        return !teacherCenterId || String(teacherCenterId) === String(formData.center_id);
    });

    const filteredRings = rings.filter(r => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        return (r.name?.toLowerCase().includes(query) || r.teacher_name?.toLowerCase().includes(query) || (r.project_title || '').toLowerCase().includes(query));
    });

    return (
        <div style={{ padding: '1rem', paddingBottom: '5rem', direction: 'rtl', fontFamily: 'inherit' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.4rem', color: '#133315', fontWeight: 'bold', margin: 0 }}>الحلقات القرآنية</h2>
                <button
                    onClick={handleOpenAddModal}
                    style={{
                        background: '#133315', color: '#fff', border: 'none', borderRadius: '10px',
                        padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem',
                        fontWeight: 'bold', fontSize: '0.9rem'
                    }}
                >
                    <Plus size={16} weight="bold" />
                    <span>إضافة</span>
                </button>
            </div>

            <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                <input
                    type="text"
                    placeholder="ابحث باسم الحلقة أو المعلم..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                        width: '100%', padding: '0.8rem 2.5rem 0.8rem 1rem', borderRadius: '12px',
                        border: '1px solid #eee', fontSize: '0.9rem', outline: 'none'
                    }}
                />
                <MagnifyingGlass size={18} color="#888" style={{ position: 'absolute', top: '50%', right: '0.8rem', transform: 'translateY(-50%)' }} />
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#558b2f' }}>جاري التحميل...</div>
            ) : error ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#c62828' }}>{error}</div>
            ) : filteredRings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#888', background: '#fff', borderRadius: '16px', border: '1px dashed #ccc' }}>
                    لا توجد حلقات تطابق بحثك
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {filteredRings.map(ring => (
                        <div key={ring.id} style={{
                            background: '#fff', borderRadius: '16px', padding: '1rem',
                            border: '1px solid #eee', boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                            position: 'relative', overflow: 'hidden'
                        }}>
                            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '4px', background: '#558b2f' }}></div>
                            <div style={{ paddingRight: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', margin: 0, color: '#133315', fontWeight: 'bold' }} onClick={() => navigate(`${basePath}/rings/${ring.id}/sessions`)}>{ring.name}</h3>
                                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '8px', background: ring.is_active ? '#e8f5e9' : '#f5f5f5', color: ring.is_active ? '#2e7d32' : '#757575', fontWeight: 'bold' }}>
                                        {ring.is_active ? 'نشطة' : 'متوقفة'}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.8rem' }} onClick={() => navigate(`${basePath}/rings/${ring.id}/sessions`)}>
                                    <div style={{ marginBottom: '0.2rem' }}>المعلم: <strong style={{ color: '#333' }}>{ring.teacher_name || 'غير محدد'}</strong></div>
                                    <div>الطلاب: <strong style={{ color: '#333' }}>{ring.studentsCount}</strong></div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleOpenEditModal(ring); }}
                                        style={{ flex: 1, padding: '0.5rem', background: '#f1f8e9', border: '1px solid #a5d6a7', borderRadius: '8px', color: '#2e7d32', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontWeight: 'bold' }}
                                    >
                                        <PencilSimple size={16} /> تعديل
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleOpenDeleteModal(ring); }}
                                        style={{ flex: 1, padding: '0.5rem', background: '#ffebee', border: '1px solid #ffcdd2', borderRadius: '8px', color: '#c62828', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontWeight: 'bold' }}
                                    >
                                        <Trash size={16} /> حذف
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isAddEditModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ background: '#fff', width: '100%', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '1.5rem', maxHeight: '85vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#133315' }}>{modalMode === 'add' ? 'إضافة حلقة' : 'تعديل حلقة'}</h3>
                            <button onClick={() => setIsAddEditModalOpen(false)} style={{ background: 'none', border: 'none' }}><X size={20} /></button>
                        </div>
                        {modalError && <div style={{ background: '#ffebee', color: '#c62828', padding: '0.8rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>{modalError}</div>}
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>اسم الحلقة</label>
                                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #ddd' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>المركز</label>
                                <select value={formData.center_id} onChange={(e) => setFormData({ ...formData, center_id: e.target.value, project_id: '', teacher_id: '' })} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #ddd', background: '#fff' }}>
                                    <option value="">-- اختر --</option>
                                    {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>المشروع</label>
                                <select disabled={!formData.center_id} value={formData.project_id} onChange={(e) => setFormData({ ...formData, project_id: e.target.value })} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #ddd', background: '#fff' }}>
                                    <option value="">-- اختر --</option>
                                    {projects.filter(p => formData.center_id && (p.is_global || (p.centers && p.centers.some(c => String(c.id) === String(formData.center_id))))).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>المعلم</label>
                                <select value={formData.teacher_id} onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #ddd', background: '#fff' }}>
                                    <option value="">-- اختر --</option>
                                    {filteredTeachers.map(t => <option key={t.id} value={t.id}>{t.full_name || t.username}</option>)}
                                </select>
                            </div>
                        </div>

                        <button onClick={() => handleSaveHalaqa(false)} disabled={submitting} style={{ width: '100%', padding: '1rem', background: '#133315', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', marginTop: '1.5rem' }}>
                            {submitting ? 'جاري الحفظ...' : 'حفظ'}
                        </button>
                    </div>
                </div>
            )}

            {isDeleteModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ background: '#fff', width: '100%', borderRadius: '20px', padding: '1.5rem', textAlign: 'center' }}>
                        <WarningCircle size={48} color="#c62828" weight="fill" style={{ marginBottom: '1rem' }} />
                        <h3 style={{ fontSize: '1.2rem', color: '#133315', margin: '0 0 0.5rem 0' }}>هل أنت متأكد من الحذف؟</h3>
                        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem' }}>سيتم حذف حلقة "{deletingRing?.name}" نهائياً.</p>
                        <div style={{ display: 'flex', gap: '0.8rem' }}>
                            <button onClick={() => setIsDeleteModalOpen(false)} style={{ flex: 1, padding: '0.8rem', background: '#f5f5f5', color: '#333', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>إلغاء</button>
                            <button onClick={handleConfirmDelete} disabled={submitting} style={{ flex: 1, padding: '0.8rem', background: '#c62828', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>{submitting ? 'جاري الحذف...' : 'تأكيد الحذف'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MobileHalqaManagement;
