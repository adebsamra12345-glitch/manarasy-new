import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Users, MagnifyingGlass, Plus, X, PencilSimple, Trash, WarningCircle, CheckCircle, Funnel
} from '@phosphor-icons/react';
import {
    getStudents, createStudent, updateStudent, deleteStudent,
    getHalaqat, getMosqueAdminDashboardData, getProjects
} from '../../../services/api/tenantService';

const MobileStudentsManagement = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const basePath = location.pathname.startsWith('/center-manager') ? '/center-manager' : '/admin';

    const [students, setStudents] = useState([]);
    const [halaqat, setHalaqat] = useState([]);
    const [centers, setCenters] = useState([]);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRing, setSelectedRing] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [editingStudent, setEditingStudent] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [modalError, setModalError] = useState('');

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [studentToDelete, setStudentToDelete] = useState(null);

    const initialFormData = {
        full_name: '', gender: 'M', national_id: '',
        parent_phone: '', halaqa_id: ''
    };
    const [formData, setFormData] = useState(initialFormData);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            const [studentsRes, halaqatRes, centersRes] = await Promise.all([
                getStudents().catch(() => ({ data: [] })),
                getHalaqat().catch(() => ({ data: [] })),
                getMosqueAdminDashboardData('all').catch(() => ({ data: { centers: [] } }))
            ]);
            setStudents(studentsRes?.data || []);
            setHalaqat(halaqatRes?.data || []);
            setCenters(centersRes?.data?.centers || []);
        } catch (err) {
            setError('حدث خطأ أثناء جلب البيانات');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAddModal = () => {
        setModalMode('add');
        setEditingStudent(null);
        setFormData(initialFormData);
        setModalError('');
        setIsAddEditModalOpen(true);
    };

    const handleOpenEditModal = (student) => {
        setModalMode('edit');
        setEditingStudent(student);
        setFormData({
            full_name: student.full_name || '',
            gender: student.gender || 'M',
            national_id: student.national_id || '',
            parent_phone: student.parent_phone || '',
            halaqa_id: student.halaqa_id || ''
        });
        setModalError('');
        setIsAddEditModalOpen(true);
    };

    const handleOpenDeleteModal = (student) => {
        setStudentToDelete(student);
        setIsDeleteModalOpen(true);
    };

    const handleSaveStudent = async () => {
        setModalError('');
        setSubmitting(true);

        if (!formData.full_name.trim()) {
            setModalError('الاسم الكامل مطلوب');
            setSubmitting(false);
            return;
        }

        try {
            const payload = { ...formData, reached_page: 1, points: 0 };
            if (modalMode === 'add') {
                await createStudent(payload);
            } else {
                await updateStudent(editingStudent.id, payload);
            }
            setIsAddEditModalOpen(false);
            fetchData();
        } catch (err) {
            setModalError(err.response?.data?.message || 'فشل حفظ بيانات الطالب');
        } finally {
            setSubmitting(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!studentToDelete) return;
        setSubmitting(true);
        try {
            await deleteStudent(studentToDelete.id);
            setIsDeleteModalOpen(false);
            fetchData();
        } catch (err) {
            console.error('Error deleting student', err);
        } finally {
            setSubmitting(false);
        }
    };

    const filteredStudents = students.filter(s => {
        const q = searchQuery.trim().toLowerCase();
        const matchSearch = !q || (s.full_name || '').toLowerCase().includes(q) || (s.national_id || '').includes(q);
        const matchRing = selectedRing === 'all' || String(s.halaqa_id) === String(selectedRing);
        return matchSearch && matchRing;
    });

    return (
        <div style={{ padding: '1rem', paddingBottom: '5rem', direction: 'rtl', fontFamily: 'inherit' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.4rem', color: '#133315', fontWeight: 'bold', margin: 0 }}>الطلاب</h2>
                <button
                    onClick={handleOpenAddModal}
                    style={{ background: '#133315', color: '#fff', border: 'none', borderRadius: '10px', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold', fontSize: '0.9rem' }}
                >
                    <Plus size={16} weight="bold" /><span>إضافة</span>
                </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <input
                        type="text" placeholder="بحث باسم الطالب..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ width: '100%', padding: '0.8rem 2.5rem 0.8rem 1rem', borderRadius: '12px', border: '1px solid #eee', fontSize: '0.9rem', outline: 'none' }}
                    />
                    <MagnifyingGlass size={18} color="#888" style={{ position: 'absolute', top: '50%', right: '0.8rem', transform: 'translateY(-50%)' }} />
                </div>
                <div style={{ position: 'relative', width: '120px' }}>
                    <select value={selectedRing} onChange={(e) => setSelectedRing(e.target.value)} style={{ width: '100%', padding: '0.8rem 2.5rem 0.8rem 1rem', borderRadius: '12px', border: '1px solid #eee', fontSize: '0.9rem', outline: 'none', appearance: 'none', background: '#fff' }}>
                        <option value="all">كل الحلقات</option>
                        {halaqat.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                    <Funnel size={18} color="#888" style={{ position: 'absolute', top: '50%', right: '0.8rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#558b2f' }}>جاري التحميل...</div>
            ) : error ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#c62828' }}>{error}</div>
            ) : filteredStudents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#888', background: '#fff', borderRadius: '16px', border: '1px dashed #ccc' }}>لا يوجد طلاب يطابقون بحثك</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {filteredStudents.map(student => (
                        <div key={student.id} style={{ background: '#fff', borderRadius: '16px', padding: '1rem', border: '1px solid #eee', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '4px', background: student.gender === 'M' ? '#0288d1' : '#c2185b' }}></div>
                            <div style={{ paddingRight: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', margin: 0, color: '#133315', fontWeight: 'bold' }}>{student.full_name}</h3>
                                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '8px', background: '#e8f5e9', color: '#2e7d32', fontWeight: 'bold' }}>{student.halaqa_name || 'بدون حلقة'}</span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.8rem' }}>
                                    <div style={{ marginBottom: '0.2rem' }}>النقاط: <strong style={{ color: '#f57c00' }}>{student.points || 0}</strong></div>
                                    <div>الجوال: <span dir="ltr">{student.parent_phone || 'لا يوجد'}</span></div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => handleOpenEditModal(student)} style={{ flex: 1, padding: '0.5rem', background: '#f1f8e9', border: '1px solid #a5d6a7', borderRadius: '8px', color: '#2e7d32', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontWeight: 'bold' }}><PencilSimple size={16} /> تعديل</button>
                                    <button onClick={() => handleOpenDeleteModal(student)} style={{ flex: 1, padding: '0.5rem', background: '#ffebee', border: '1px solid #ffcdd2', borderRadius: '8px', color: '#c62828', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontWeight: 'bold' }}><Trash size={16} /> حذف</button>
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
                            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#133315' }}>{modalMode === 'add' ? 'إضافة طالب' : 'تعديل طالب'}</h3>
                            <button onClick={() => setIsAddEditModalOpen(false)} style={{ background: 'none', border: 'none' }}><X size={20} /></button>
                        </div>
                        {modalError && <div style={{ background: '#ffebee', color: '#c62828', padding: '0.8rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>{modalError}</div>}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>الاسم الكامل</label>
                                <input type="text" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #ddd' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>رقم الهوية</label>
                                <input type="text" value={formData.national_id} onChange={(e) => setFormData({ ...formData, national_id: e.target.value })} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #ddd' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>الحلقة</label>
                                <select value={formData.halaqa_id} onChange={(e) => setFormData({ ...formData, halaqa_id: e.target.value })} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #ddd', background: '#fff' }}>
                                    <option value="">-- اختر الحلقة --</option>
                                    {halaqat.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <button onClick={handleSaveStudent} disabled={submitting} style={{ width: '100%', padding: '1rem', background: '#133315', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', marginTop: '1.5rem' }}>
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
                        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem' }}>سيتم حذف الطالب "{studentToDelete?.full_name}" نهائياً.</p>
                        <div style={{ display: 'flex', gap: '0.8rem' }}>
                            <button onClick={() => setIsDeleteModalOpen(false)} style={{ flex: 1, padding: '0.8rem', background: '#f5f5f5', color: '#333', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>إلغاء</button>
                            <button onClick={handleConfirmDelete} disabled={submitting} style={{ flex: 1, padding: '0.8rem', background: '#c62828', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>تأكيد الحذف</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MobileStudentsManagement;
