import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
    Bell, Books, MagnifyingGlass, CalendarBlank, Users, 
    ChalkboardTeacher, ArrowLeft, Plus, X, WarningCircle, CheckCircle,
    PencilSimple, Trash
} from '@phosphor-icons/react';
import { 
    getHalaqat, 
    createHalaqa, 
    updateHalaqa,
    deleteHalaqa,
    getProjects, 
    getCentersList,
    getMosqueAdminDashboardData 
} from '../../../services/api/tenantService';
import { getTeachers } from '../../../services/api/userService';
import { useAuthContext } from '../../../context/AuthContext';
import useDeviceType from '../../../hooks/useDeviceType';
import MobileHalqaManagement from '../../mobile/tenantAdmin/MobileHalqaManagement';

/**
 * HalqaManagement (إدارة الحلقات القرآنية - الأدمن ومدير المركز)
 */
const HalqaManagement = () => {
    const { isMobile } = useDeviceType();
    const navigate = useNavigate();
    const location = useLocation();
    const basePath = location.pathname.startsWith('/center-manager') ? '/center-manager' : '/admin';
    const { user, role } = useAuthContext();
    
    const [rings, setRings] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Dropdowns data
    const [centers, setCenters] = useState([]);
    const [projects, setProjects] = useState([]);
    const [teachers, setTeachers] = useState([]);

    // Add / Edit Modal State
    const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [editingRing, setEditingRing] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [modalError, setModalError] = useState('');
    const [duplicateWarning, setDuplicateWarning] = useState(null);

    // Delete Confirmation Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deletingRing, setDeletingRing] = useState(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    const initialFormState = {
        name: '',
        center_id: '',
        project_id: '',
        teacher_id: '',
    };
    const [formData, setFormData] = useState(initialFormState);
    const [toastMessage, setToastMessage] = useState('');

    const today = new Date();
    const dateStr = today.toLocaleDateString('ar-SA', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    if (isMobile) {
        return <MobileHalqaManagement />;
    }

    useEffect(() => {
        fetchRings();
        loadDropdownData();
    }, []);

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 4000);
    };

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
                setError('فشل في جلب قائمة الحلقات من الخادم');
            }
        } catch (err) {
            setError('حدث خطأ أثناء تحميل الحلقات القرآنية');
            console.error('Error fetching halaqat:', err);
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

            const loadedCenters = centersRes?.data || centersRes || [];
            const loadedProjects = projectsRes?.data || projectsRes || [];
            const loadedTeachers = teachersRes?.data || teachersRes || [];

            setCenters(Array.isArray(loadedCenters) ? loadedCenters : []);
            setProjects(Array.isArray(loadedProjects) ? loadedProjects : []);
            setTeachers(Array.isArray(loadedTeachers) ? loadedTeachers : []);
        } catch (err) {
            console.error('Error loading dropdowns for Halaqa modal:', err);
        }
    };

    const handleOpenAddModal = () => {
        setModalMode('add');
        setEditingRing(null);
        setFormData({
            ...initialFormState,
            center_id: centers.length === 1 ? centers[0].id : ''
        });
        setModalError('');
        setDuplicateWarning(null);
        setIsAddEditModalOpen(true);
    };

    const handleOpenEditModal = (ring) => {
        setModalMode('edit');
        setEditingRing(ring);
        setModalError('');
        setDuplicateWarning(null);

        // المطابقة لاختيار المعلم الحالي للحلقة
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
        setDeleteError('');
        setIsDeleteModalOpen(true);
    };

    const handleSaveHalaqa = async (confirmDuplicate = false) => {
        setModalError('');
        setSubmitting(true);

        // Validation
        if (!formData.name.trim()) {
            setModalError('اسم الحلقة مطلوب');
            setSubmitting(false);
            return;
        }
        if (!formData.center_id) {
            setModalError('يرجى اختيار المركز لتحديد المسجد أو المركز التابع له الحلقة');
            setSubmitting(false);
            return;
        }
        if (!formData.project_id) {
            setModalError('المشروع حقل إلزامي. لا يمكن إنشاء أو تعديل أي حلقة دون اختيار مشروع.');
            setSubmitting(false);
            return;
        }
        if (!formData.teacher_id) {
            setModalError('يرجى اختيار المعلم المسند إليه الحلقة');
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
                showToast(res.message || (modalMode === 'add' ? 'تم إضافة الحلقة القرآنية بنجاح' : 'تم تعديل بيانات الحلقة القرآنية بنجاح'));
                setIsAddEditModalOpen(false);
                setEditingRing(null);
                setFormData(initialFormState);
                fetchRings();
            } else if (res.requires_confirmation || res.status?.startsWith('warning')) {
                setDuplicateWarning({
                    message: res.message || 'توجد حلقة بنفس الاسم، هل ترغب بالاستمرار؟',
                });
            } else {
                setModalError(res.message || 'فشل حفظ بيانات الحلقة القرآنية');
            }
        } catch (err) {
            console.error('Error saving halaqa:', err);
            const errData = err.response?.data;
            if (errData?.requires_confirmation || errData?.status?.startsWith('warning')) {
                setDuplicateWarning({
                    message: errData.message || 'توجد حلقة بنفس الاسم، هل ترغب بالاستمرار؟',
                });
            } else {
                setModalError(errData?.message || err.message || 'حدث خطأ أثناء حفظ بيانات الحلقة');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!deletingRing) return;
        setDeleteSubmitting(true);
        setDeleteError('');

        try {
            const res = await deleteHalaqa(deletingRing.id);
            if (res.status === 'success') {
                showToast(res.message || `تم حذف حلقة (${deletingRing.name}) بنجاح`);
                setIsDeleteModalOpen(false);
                setDeletingRing(null);
                fetchRings();
            } else {
                setDeleteError(res.message || 'فشل حذف الحلقة القرآنية');
            }
        } catch (err) {
            console.error('Error deleting halaqa:', err);
            const errData = err.response?.data;
            setDeleteError(errData?.message || err.message || 'حدث خطأ أثناء تنفيذ عملية الحذف');
        } finally {
            setDeleteSubmitting(false);
        }
    };

    // Filter teachers based on selected center_id
    const filteredTeachers = teachers.filter(t => {
        if (!formData.center_id) return true;
        const teacherCenterId = t.center?.id || t.center_id || t.center;
        return !teacherCenterId || String(teacherCenterId) === String(formData.center_id);
    });

    // Filter halaqat search
    const filteredRings = rings.filter(r => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        const nameMatch = r.name?.toLowerCase().includes(query);
        const teacherMatch = r.teacher_name?.toLowerCase().includes(query);
        const projectMatch = (r.project_title || r.center_name || '').toLowerCase().includes(query);
        return nameMatch || teacherMatch || projectMatch;
    });

    const totalStudents = rings.reduce((acc, r) => acc + (r.studentsCount || 0), 0);

    return (
        <div className="dashboard-container" style={{ padding: '2rem', maxWidth: '1050px', margin: '0 auto', direction: 'rtl', fontFamily: 'inherit' }}>
            
            {/* Header */}
            <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <div className="greeting" style={{ textAlign: 'right' }}>
                    <h1 style={{ fontSize: '1.8rem', color: '#133315', marginBottom: '0.4rem', fontWeight: 'bold' }}>
                        السلام عليكم، أ. {user?.username || localStorage.getItem('username') || 'مدير النظام'}
                    </h1>
                    <p style={{ color: '#777', fontSize: '0.9rem', margin: 0 }}>{dateStr}</p>
                </div>

                <div className="header-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {/* زر إضافة حلقة جديدة */}
                    <button
                        onClick={handleOpenAddModal}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            backgroundColor: '#133315',
                            color: '#fff',
                            border: 'none',
                            padding: '0.6rem 1.3rem',
                            borderRadius: '10px',
                            fontWeight: 'bold',
                            fontSize: '0.92rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 3px 10px rgba(19, 51, 21, 0.25)'
                        }}
                    >
                        <Plus size={18} weight="bold" />
                        <span>إضافة حلقة جديدة</span>
                    </button>

                    {/* زر سريع لجدول الجلسات */}
                    <button
                        onClick={() => navigate(`${basePath}/sessions`)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            backgroundColor: '#fff',
                            color: '#133315',
                            border: '1.5px solid #133315',
                            padding: '0.55rem 1.2rem',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        title="الانتقال إلى جدول الجلسات التقويمي"
                    >
                        <CalendarBlank size={18} />
                        <span>جدول الجلسات</span>
                    </button>

                    <div className="icon-btn" style={{ position: 'relative', background: '#fff', border: '1px solid #ddd', padding: '0.55rem', borderRadius: '50%', cursor: 'pointer' }}>
                        <Bell size={20} color="#133315" />
                        <span style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, backgroundColor: '#f57c00', borderRadius: '50%' }}></span>
                    </div>
                </div>
            </div>

            {/* عنوان الصفحة وشريط البحث */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '2.4rem', color: '#1a3b1c', fontWeight: 'bold', margin: '0 0 0.3rem 0' }}>
                        الحلقات القرآنية
                    </h2>
                    <div style={{ display: 'flex', gap: '1rem', color: '#666', fontSize: '0.9rem' }}>
                        <span>إجمالي الحلقات: <strong style={{ color: '#133315' }}>{rings.length}</strong></span>
                        <span>•</span>
                        <span>إجمالي الطلاب: <strong style={{ color: '#558b2f' }}>{totalStudents}</strong></span>
                    </div>
                </div>

                {/* شريط البحث */}
                <div style={{ position: 'relative', width: '280px' }}>
                    <input
                        type="text"
                        placeholder="ابحث باسم الحلقة أو المعلم..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            padding: '0.6rem 2.4rem 0.6rem 1rem',
                            border: '1px solid #ccc',
                            borderRadius: '10px',
                            width: '100%',
                            textAlign: 'right',
                            outline: 'none',
                            fontFamily: 'inherit',
                            fontSize: '0.9rem'
                        }}
                    />
                    <MagnifyingGlass size={18} color="#888" style={{ position: 'absolute', top: '50%', right: '0.75rem', transform: 'translateY(-50%)' }} />
                </div>
            </div>

            {/* فاصل أفقي */}
            <div style={{ height: '1px', backgroundColor: '#e0e0e0', marginBottom: '2rem' }}></div>

            {/* رسائل الأخطاء العامة */}
            {error && (
                <div style={{ padding: '1rem', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #ef9a9a' }}>
                    {error}
                </div>
            )}

            {/* قائمة الحلقات */}
            {loading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#558b2f', fontSize: '1.2rem', fontWeight: 'bold' }}>
                    جاري تحميل الحلقات...
                </div>
            ) : filteredRings.length === 0 ? (
                <div style={{
                    padding: '4rem 2rem',
                    textAlign: 'center',
                    backgroundColor: '#fff',
                    borderRadius: '16px',
                    border: '1px dashed #ccc'
                }}>
                    <Books size={54} color="#9e9e9e" style={{ marginBottom: '1rem' }} />
                    <h3 style={{ fontSize: '1.3rem', color: '#333', marginBottom: '0.5rem' }}>
                        {searchQuery ? 'لم يتم العثور على حلقات تطابق بحثك' : 'لا توجد حلقات قرآنية مسجلة حالياً'}
                    </h3>
                    <p style={{ color: '#777', fontSize: '0.95rem' }}>
                        {searchQuery ? 'جرب البحث بكلمات أخرى' : 'يمكنك إضافة حلقة جديدة وإسناد مشروع ومعلم لها من الزر أعلاه'}
                    </p>
                </div>
            ) : (
                <div className="rings-list" style={{ display: 'flex', flexDirection: 'column', gap: '1.3rem' }}>
                    {filteredRings.map(ring => (
                        <div
                            key={ring.id}
                            onClick={() => navigate(`${basePath}/rings/${ring.id}/sessions`)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '1.5rem 2rem',
                                border: '1px solid #ddd',
                                borderRadius: '16px',
                                background: '#fff',
                                position: 'relative',
                                boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                overflow: 'hidden'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.06)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.borderColor = '#81c784';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.02)';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = '#ddd';
                            }}
                        >
                            {/* الشريط البرتقالي التمييزي */}
                            <div style={{
                                position: 'absolute',
                                right: '12px',
                                top: '15%',
                                bottom: '15%',
                                width: '6px',
                                borderRadius: '10px',
                                backgroundColor: '#f57c00'
                            }}></div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', paddingRight: '20px' }}>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.3rem' }}>
                                        <h3 style={{ fontSize: '1.6rem', color: '#133315', margin: 0, fontWeight: 'bold' }}>
                                            {ring.name}
                                        </h3>
                                        <span style={{
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: '50%',
                                            backgroundColor: ring.is_active !== false ? '#81b255' : '#ccc',
                                            display: 'inline-block'
                                        }} title={ring.is_active !== false ? 'حلقة نشطة' : 'حلقة متوقفة'}></span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', color: '#777', fontSize: '0.9rem', flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: '600', color: ring.project_title ? '#2e7d32' : '#c62828' }}>
                                            المشروع: {ring.project_title || 'بدون مشروع'}
                                        </span>
                                        {ring.center_name && <span>• المركز: {ring.center_name}</span>}
                                        {ring.teacher_name && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#555' }}>
                                                <ChalkboardTeacher size={16} />
                                                <span>المعلم: {ring.teacher_name}</span>
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', flexWrap: 'wrap' }}>
                                <div style={{ textAlign: 'center', paddingLeft: '0.5rem' }}>
                                    <span style={{ fontSize: '1.15rem', color: '#133315', fontWeight: 'bold' }}>
                                        {ring.studentsCount} طالب
                                    </span>
                                </div>

                                {/* أزرار الإجراءات: تعديل / حذف / عرض الجلسات */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {/* زر التعديل */}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenEditModal(ring);
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.35rem',
                                            padding: '0.5rem 0.9rem',
                                            borderRadius: '9px',
                                            border: '1px solid #a5d6a7',
                                            backgroundColor: '#f1f8e9',
                                            color: '#2e7d32',
                                            fontSize: '0.85rem',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = '#2e7d32';
                                            e.currentTarget.style.color = '#fff';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = '#f1f8e9';
                                            e.currentTarget.style.color = '#2e7d32';
                                        }}
                                        title="تعديل بيانات الحلقة"
                                    >
                                        <PencilSimple size={16} weight="bold" />
                                        <span>تعديل</span>
                                    </button>

                                    {/* زر الحذف */}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenDeleteModal(ring);
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.35rem',
                                            padding: '0.5rem 0.9rem',
                                            borderRadius: '9px',
                                            border: '1px solid #ffcdd2',
                                            backgroundColor: '#ffebee',
                                            color: '#c62828',
                                            fontSize: '0.85rem',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = '#c62828';
                                            e.currentTarget.style.color = '#fff';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = '#ffebee';
                                            e.currentTarget.style.color = '#c62828';
                                        }}
                                        title="حذف الحلقة"
                                    >
                                        <Trash size={16} weight="bold" />
                                        <span>حذف</span>
                                    </button>

                                    {/* زر الانتقال إلى الجلسات */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                        color: '#558b2f',
                                        fontWeight: 'bold',
                                        fontSize: '0.9rem',
                                        marginRight: '0.3rem'
                                    }}>
                                        <span>عرض الجلسات</span>
                                        <ArrowLeft size={18} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* =========================================================================
                ADD / EDIT HALAQA MODAL (نموذج إضافة/تعديل حلقة قرآنية)
            ========================================================================== */}
            {isAddEditModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0, 0, 0, 0.55)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 10000, direction: 'rtl', padding: '1rem'
                }}>
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '20px',
                        width: '100%',
                        maxWidth: '520px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
                        overflow: 'hidden',
                        display: 'flex', flexDirection: 'column'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '1.25rem 1.75rem',
                            borderBottom: '1px solid #e2e8f0',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: '#f8fafc'
                        }}>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#133315' }}>
                                {modalMode === 'add' ? 'إضافة حلقة قرآنية جديدة' : 'تعديل بيانات الحلقة القرآنية'}
                            </h3>
                            <button
                                onClick={() => setIsAddEditModalOpen(false)}
                                style={{ background: 'transparent', border: 'none', color: '#718096', cursor: 'pointer' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div style={{ padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                            {modalError && (
                                <div style={{ padding: '0.8rem 1rem', background: '#ffebee', color: '#c62828', borderRadius: '10px', fontSize: '0.88rem', border: '1px solid #ef9a9a' }}>
                                    {modalError}
                                </div>
                            )}

                            {duplicateWarning && (
                                <div style={{ padding: '1rem', background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f57f17', fontWeight: 700, marginBottom: '0.5rem' }}>
                                        <WarningCircle size={20} weight="fill" />
                                        <span>تنبيه وجود تكرار</span>
                                    </div>
                                    <p style={{ margin: '0 0 1rem 0', color: '#424242', fontSize: '0.88rem', lineHeight: 1.5 }}>
                                        {duplicateWarning.message}
                                    </p>
                                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                        <button
                                            type="button"
                                            onClick={() => setDuplicateWarning(null)}
                                            style={{ padding: '0.45rem 1rem', borderRadius: '8px', border: '1px solid #ccc', background: '#fff', fontSize: '0.85rem', cursor: 'pointer' }}
                                        >
                                            إلغاء
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleSaveHalaqa(true)}
                                            style={{ padding: '0.45rem 1.2rem', borderRadius: '8px', border: 'none', background: '#f57c00', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                                        >
                                            متابعة الحفظ على أي حال
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Field 1: Halaqa Name */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                    اسم الحلقة القرآنية *
                                </label>
                                <input
                                    type="text"
                                    placeholder="مثال: حلقة الإمام عاصم"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>

                            {/* Field 2: Center */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                    المركز / المسجد التابع له *
                                </label>
                                <select
                                    value={formData.center_id}
                                    onChange={(e) => {
                                        const newCenterId = e.target.value;
                                        let updatedProjectId = formData.project_id;
                                        if (updatedProjectId) {
                                            const currentProj = projects.find(p => String(p.id) === String(updatedProjectId));
                                            if (currentProj && !currentProj.is_global) {
                                                const belongsToNewCenter = currentProj.centers && currentProj.centers.some(c => String(c.id) === String(newCenterId));
                                                if (!belongsToNewCenter) updatedProjectId = '';
                                            }
                                        }
                                        setFormData({ ...formData, center_id: newCenterId, project_id: updatedProjectId, teacher_id: '' });
                                    }}
                                    style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', background: '#fff' }}
                                >
                                    <option value="">-- اختر المركز --</option>
                                    {centers.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Field 3: Project (Obligatory & Center-Linked) */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                    المشروع المعتمد للحلقة * <span style={{ color: '#c62828', fontSize: '0.8rem' }}>(إلزامي)</span>
                                </label>
                                <select
                                    disabled={!formData.center_id}
                                    value={formData.project_id}
                                    onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '0.65rem 0.9rem',
                                        borderRadius: '10px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '0.92rem',
                                        outline: 'none',
                                        background: !formData.center_id ? '#f1f5f9' : '#fff',
                                        cursor: !formData.center_id ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    <option value="">
                                        {!formData.center_id ? '-- يرجى اختيار المركز أولاً --' : '-- اختر المشروع المعتمد --'}
                                    </option>
                                    {projects
                                        .filter(p => formData.center_id && (p.is_global || (p.centers && p.centers.some(c => String(c.id) === String(formData.center_id)))))
                                        .map(p => (
                                            <option key={p.id} value={p.id}>{p.title} {p.project_type === 'QURAN' ? '(قرآني)' : '(منهجي)'}</option>
                                        ))
                                    }
                                </select>
                            </div>

                            {/* Field 4: Teacher */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                    المعلم المسند إليه *
                                </label>
                                <select
                                    value={formData.teacher_id}
                                    onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })}
                                    style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', background: '#fff' }}
                                >
                                    <option value="">-- اختر المعلم --</option>
                                    {filteredTeachers.map(t => {
                                        const teacherId = t.id || t.user_id;
                                        const teacherName = t.full_name || `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.username;
                                        return (
                                            <option key={teacherId} value={teacherId}>
                                                {teacherName}
                                            </option>
                                        );
                                    })}
                                </select>
                                {formData.center_id && filteredTeachers.length === 0 && (
                                    <span style={{ fontSize: '0.8rem', color: '#c62828', display: 'block', marginTop: '0.3rem' }}>
                                        تنبيه: لا يوجد معلمون نشطون في هذا المركز حالياً.
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div style={{
                            padding: '1rem 1.75rem',
                            borderTop: '1px solid #e2e8f0',
                            display: 'flex', justifyContent: 'flex-end', gap: '0.75rem',
                            background: '#f8fafc'
                        }}>
                            <button
                                type="button"
                                onClick={() => setIsAddEditModalOpen(false)}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '10px',
                                    padding: '0.6rem 1.25rem',
                                    color: '#64748b',
                                    fontWeight: 600,
                                    fontSize: '0.9rem',
                                    cursor: 'pointer'
                                }}
                            >
                                إلغاء
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSaveHalaqa(false)}
                                disabled={submitting}
                                style={{
                                    background: '#133315',
                                    border: 'none',
                                    borderRadius: '10px',
                                    padding: '0.6rem 1.75rem',
                                    color: '#fff',
                                    fontWeight: 700,
                                    fontSize: '0.92rem',
                                    cursor: submitting ? 'not-allowed' : 'pointer',
                                    boxShadow: '0 2px 6px rgba(19, 51, 21, 0.3)'
                                }}
                            >
                                {submitting ? 'جاري الحفظ...' : (modalMode === 'add' ? 'إنشاء الحلقة' : 'حفظ التعديلات')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================================================
                DELETE CONFIRMATION MODAL (نافذة تأكيد حذف الحلقة)
            ========================================================================== */}
            {isDeleteModalOpen && deletingRing && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0, 0, 0, 0.55)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 10000, direction: 'rtl', padding: '1rem'
                }}>
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '20px',
                        width: '100%',
                        maxWidth: '470px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
                        overflow: 'hidden',
                        display: 'flex', flexDirection: 'column'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '1.25rem 1.75rem',
                            borderBottom: '1px solid #fee2e2',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: '#fef2f2'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#991b1b' }}>
                                <WarningCircle size={24} weight="fill" color="#dc2626" />
                                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                                    تأكيد حذف الحلقة
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                disabled={deleteSubmitting}
                                style={{ background: 'transparent', border: 'none', color: '#718096', cursor: 'pointer' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div style={{ padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {deleteError && (
                                <div style={{ padding: '0.8rem 1rem', background: '#ffebee', color: '#c62828', borderRadius: '10px', fontSize: '0.88rem', border: '1px solid #ef9a9a' }}>
                                    {deleteError}
                                </div>
                            )}

                            <p style={{ margin: 0, color: '#334155', fontSize: '1rem', lineHeight: 1.6 }}>
                                هل أنت أكر من رغبتك في حذف حلقة <strong style={{ color: '#133315', fontSize: '1.05rem' }}>"{deletingRing.name}"</strong>؟
                            </p>

                            {deletingRing.studentsCount > 0 ? (
                                <div style={{
                                    padding: '0.85rem 1rem',
                                    backgroundColor: '#fff8e1',
                                    border: '1px solid #ffe082',
                                    borderRadius: '10px',
                                    color: '#b78103',
                                    fontSize: '0.88rem',
                                    lineHeight: 1.5
                                }}>
                                    تنبيه: تحتوي هذه الحلقة حالياً على <strong>{deletingRing.studentsCount} طالب</strong>. عند الحذف سيتم أرشفة الحلقة (إلغاء تنشيطها ناعماً) للحفاظ على سجلات الطلاب والأداء والجلسات التاريخية دون فقدانها.
                                </div>
                            ) : (
                                <p style={{ margin: 0, color: '#64748b', fontSize: '0.88rem' }}>
                                    لن تظهر هذه الحلقة في القوائم الافتراضية بعد الحذف.
                                </p>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div style={{
                            padding: '1rem 1.75rem',
                            borderTop: '1px solid #e2e8f0',
                            display: 'flex', justifyContent: 'flex-end', gap: '0.75rem',
                            background: '#f8fafc'
                        }}>
                            <button
                                type="button"
                                onClick={() => setIsDeleteModalOpen(false)}
                                disabled={deleteSubmitting}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '10px',
                                    padding: '0.6rem 1.25rem',
                                    color: '#64748b',
                                    fontWeight: 600,
                                    fontSize: '0.9rem',
                                    cursor: 'pointer'
                                }}
                            >
                                إلغاء
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                disabled={deleteSubmitting}
                                style={{
                                    background: '#dc2626',
                                    border: 'none',
                                    borderRadius: '10px',
                                    padding: '0.6rem 1.75rem',
                                    color: '#fff',
                                    fontWeight: 700,
                                    fontSize: '0.92rem',
                                    cursor: deleteSubmitting ? 'not-allowed' : 'pointer',
                                    boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)'
                                }}
                            >
                                {deleteSubmitting ? 'جاري الحذف...' : 'نعم، تأكيد الحذف'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notifications */}
            {toastMessage && (
                <div style={{
                    position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
                    background: '#133315', color: '#fff',
                    padding: '0.75rem 1.5rem', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                    zIndex: 10000, display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem',
                    fontWeight: '600'
                }}>
                    <CheckCircle size={20} color="#81b255" weight="fill" />
                    <span>{toastMessage}</span>
                </div>
            )}
        </div>
    );
};

export default HalqaManagement;
