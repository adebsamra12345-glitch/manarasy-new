import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ChalkboardTeacher, MagnifyingGlass, Plus, X, PencilSimple, Trash, WarningCircle
} from '@phosphor-icons/react';
import { getTeachers, createUser, updateUser, deleteUser } from '../../../services/api/userService';
import { getHalaqat, getMosqueAdminDashboardData } from '../../../services/api/tenantService';

const MobileTeacherAssignment = () => {
    const navigate = useNavigate();

    const [teachers, setTeachers] = useState([]);
    const [halaqat, setHalaqat] = useState([]);
    const [centers, setCenters] = useState([]);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCenter, setSelectedCenter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [selectedTeacher, setSelectedTeacher] = useState(null);
    const [formData, setFormData] = useState({
        first_name: '', last_name: '', username: '', password: '', phone: '', center_id: '', is_active: true
    });

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [teacherToDelete, setTeacherToDelete] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [teachersRes, halaqatRes, centersRes] = await Promise.all([
                getTeachers({ status: 'all' }),
                getHalaqat().catch(() => ({ data: [] })),
                getMosqueAdminDashboardData('all').catch(() => ({ data: { centers: [] } }))
            ]);
            setTeachers(teachersRes?.data || []);
            setHalaqat(halaqatRes?.data || []);
            setCenters(centersRes?.data?.centers || []);
        } catch (err) {
            setError('حدث خطأ في تحميل البيانات');
        } finally {
            setLoading(false);
        }
    };

    const getTeacherHalaqatCount = (teacher) => {
        if (!teacher) return 0;
        const tFullName = `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim().toLowerCase();
        const tUsername = (teacher.username || '').trim().toLowerCase();
        return halaqat.filter(h => {
            if (!h.teacher_name) return false;
            const hTeacher = h.teacher_name.trim().toLowerCase();
            return (hTeacher === tFullName || hTeacher === tUsername || hTeacher.includes(tFullName));
        }).length;
    };

    const handleOpenAddModal = () => {
        setModalMode('add');
        setSelectedTeacher(null);
        setFormData({ first_name: '', last_name: '', username: '', password: '', phone: '', center_id: centers.length > 0 ? centers[0].id : '', is_active: true });
        setIsAddEditModalOpen(true);
    };

    const handleOpenEditModal = (teacher) => {
        setModalMode('edit');
        setSelectedTeacher(teacher);
        setFormData({
            first_name: teacher.first_name || '', last_name: teacher.last_name || '', username: teacher.username || '',
            password: '', phone: teacher.phone || '', center_id: teacher.center_id || '', is_active: teacher.is_active !== false
        });
        setIsAddEditModalOpen(true);
    };

    const handleSaveTeacher = async () => {
        try {
            if (modalMode === 'add') {
                const payload = {
                    first_name: formData.first_name, last_name: formData.last_name, username: formData.username,
                    password: formData.password, role: 'TEACHER', phone: formData.phone, center_id: formData.center_id, is_active: formData.is_active
                };
                await createUser(payload);
            } else {
                const payload = {
                    first_name: formData.first_name, last_name: formData.last_name,
                    phone: formData.phone, center_id: formData.center_id, is_active: formData.is_active
                };
                if (formData.password) payload.password = formData.password;
                await updateUser(selectedTeacher.id, payload);
            }
            setIsAddEditModalOpen(false);
            loadData();
        } catch (err) {
            console.error(err);
        }
    };

    const handleConfirmDelete = async () => {
        if (!teacherToDelete) return;
        try {
            await deleteUser(teacherToDelete.id);
            setIsDeleteModalOpen(false);
            loadData();
        } catch (err) {
            console.error(err);
        }
    };

    const filteredTeachers = teachers.filter(t => {
        const q = searchQuery.trim().toLowerCase();
        const matchesQuery = !q || (`${t.first_name || ''} ${t.last_name || ''}`.toLowerCase().includes(q) || (t.username || '').toLowerCase().includes(q));
        const matchesCenter = selectedCenter === 'all' || t.center_id === selectedCenter;
        return matchesQuery && matchesCenter;
    });

    return (
        <div style={{ padding: '1rem', paddingBottom: '5rem', direction: 'rtl', fontFamily: 'inherit' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.4rem', color: '#133315', fontWeight: 'bold', margin: 0 }}>المعلمون</h2>
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
                        type="text" placeholder="بحث عن معلم..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ width: '100%', padding: '0.8rem 2.5rem 0.8rem 1rem', borderRadius: '12px', border: '1px solid #eee', fontSize: '0.9rem', outline: 'none' }}
                    />
                    <MagnifyingGlass size={18} color="#888" style={{ position: 'absolute', top: '50%', right: '0.8rem', transform: 'translateY(-50%)' }} />
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#558b2f' }}>جاري التحميل...</div>
            ) : error ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#c62828' }}>{error}</div>
            ) : filteredTeachers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#888', background: '#fff', borderRadius: '16px', border: '1px dashed #ccc' }}>لا يوجد معلمين</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {filteredTeachers.map(teacher => (
                        <div key={teacher.id} style={{ background: '#fff', borderRadius: '16px', padding: '1rem', border: '1px solid #eee', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '4px', background: teacher.is_active ? '#2e7d32' : '#c62828' }}></div>
                            <div style={{ paddingRight: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', margin: 0, color: '#133315', fontWeight: 'bold' }}>{teacher.first_name} {teacher.last_name}</h3>
                                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '8px', background: teacher.is_active ? '#e8f5e9' : '#ffebee', color: teacher.is_active ? '#2e7d32' : '#c62828', fontWeight: 'bold' }}>
                                        {teacher.is_active ? 'نشط' : 'معطل'}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.8rem' }}>
                                    <div>اسم المستخدم: <strong>{teacher.username}</strong></div>
                                    <div>الحلقات المسندة: <strong style={{ color: '#f57c00' }}>{getTeacherHalaqatCount(teacher)}</strong></div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => handleOpenEditModal(teacher)} style={{ flex: 1, padding: '0.5rem', background: '#f1f8e9', border: '1px solid #a5d6a7', borderRadius: '8px', color: '#2e7d32', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontWeight: 'bold' }}><PencilSimple size={16} /> تعديل</button>
                                    <button onClick={() => { setTeacherToDelete(teacher); setIsDeleteModalOpen(true); }} style={{ flex: 1, padding: '0.5rem', background: '#ffebee', border: '1px solid #ffcdd2', borderRadius: '8px', color: '#c62828', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontWeight: 'bold' }}><Trash size={16} /> حذف</button>
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
                            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#133315' }}>{modalMode === 'add' ? 'إضافة معلم' : 'تعديل بيانات المعلم'}</h3>
                            <button onClick={() => setIsAddEditModalOpen(false)} style={{ background: 'none', border: 'none' }}><X size={20} /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>الاسم الأول</label>
                                    <input type="text" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #ddd' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>اسم العائلة</label>
                                    <input type="text" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #ddd' }} />
                                </div>
                            </div>
                            {modalMode === 'add' && (
                                <div>
                                    <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>اسم المستخدم</label>
                                    <input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #ddd' }} />
                                </div>
                            )}
                            <div>
                                <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>كلمة المرور {modalMode === 'edit' && '(اتركه فارغاً لعدم التغيير)'}</label>
                                <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #ddd' }} />
                            </div>
                        </div>
                        <button onClick={handleSaveTeacher} style={{ width: '100%', padding: '1rem', background: '#133315', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', marginTop: '1.5rem' }}>حفظ</button>
                    </div>
                </div>
            )}

            {isDeleteModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ background: '#fff', width: '100%', borderRadius: '20px', padding: '1.5rem', textAlign: 'center' }}>
                        <WarningCircle size={48} color="#c62828" weight="fill" style={{ marginBottom: '1rem' }} />
                        <h3 style={{ fontSize: '1.2rem', color: '#133315', margin: '0 0 0.5rem 0' }}>تأكيد الحذف</h3>
                        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem' }}>سيتم حذف حساب المعلم نهائياً.</p>
                        <div style={{ display: 'flex', gap: '0.8rem' }}>
                            <button onClick={() => setIsDeleteModalOpen(false)} style={{ flex: 1, padding: '0.8rem', background: '#f5f5f5', color: '#333', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>إلغاء</button>
                            <button onClick={handleConfirmDelete} style={{ flex: 1, padding: '0.8rem', background: '#c62828', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>حذف</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MobileTeacherAssignment;
