import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    MagnifyingGlass,
    Phone,
    MapPin,
    Bell,
    CaretDown,
    Plus,
    PencilSimple,
    Books,
    User,
    UserCircle,
    Users,
    CheckCircle,
    XCircle,
    SquaresFour,
    ListBullets,
    ChalkboardTeacher,
    WhatsappLogo,
    EnvelopeSimple,
    CalendarBlank,
    X,
    ArrowsClockwise,
    ArrowSquareOut,
    Trash,
    WarningCircle
} from '@phosphor-icons/react';
import { getTeachers, createUser, updateUser, deleteUser } from '../../../services/api/userService';
import { getHalaqat, getMosqueAdminDashboardData } from '../../../services/api/tenantService';
import useDeviceType from '../../../hooks/useDeviceType';
import MobileTeacherAssignment from '../../mobile/tenantAdmin/MobileTeacherAssignment';

const DesktopTeacherAssignment = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const basePath = location.pathname.startsWith('/center-manager') ? '/center-manager' : '/admin';

    // Data States
    const [teachers, setTeachers] = useState([]);
    const [halaqat, setHalaqat] = useState([]);
    const [centers, setCenters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters and Search
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCenter, setSelectedCenter] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'

    // Modals
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isHalaqatModalOpen, setIsHalaqatModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedTeacher, setSelectedTeacher] = useState(null);
    const [teacherToDelete, setTeacherToDelete] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [toastMessage, setToastMessage] = useState('');
    const [modalError, setModalError] = useState('');

    // Form States
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        username: '',
        password: '',
        phone: '',
        email: '',
        center_id: '',
        is_active: true
    });

    // Arabic Header Dates
    const currentUserName = localStorage.getItem('username') || 'محمد العمري';
    const todayDate = new Date();
    const hijriDate = new Intl.DateTimeFormat('ar-SA', {
        calendar: 'islamic', day: 'numeric', month: 'long', year: 'numeric'
    }).format(todayDate);
    const gregorianDate = new Intl.DateTimeFormat('ar-EG', {
        day: 'numeric', month: 'long', year: 'numeric'
    }).format(todayDate);
    const weekday = new Intl.DateTimeFormat('ar-EG', { weekday: 'long' }).format(todayDate);
    const dateStr = `${weekday}، ${hijriDate} | ${gregorianDate} م`;

    useEffect(() => {
        loadAllData();
    }, []);

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 4000);
    };

    const loadAllData = async (isManualRefresh = false) => {
        try {
            if (isManualRefresh) setRefreshing(true);
            else setLoading(true);

            const [teachersRes, halaqatRes, centersRes] = await Promise.all([
                getTeachers({ status: 'all' }),
                getHalaqat().catch(() => ({ data: [] })),
                getMosqueAdminDashboardData('all').catch(() => ({ data: { centers: [] } }))
            ]);

            if (teachersRes && teachersRes.data) {
                setTeachers(teachersRes.data);
            }
            if (halaqatRes && halaqatRes.data) {
                setHalaqat(halaqatRes.data);
            }
            if (centersRes && centersRes.data && centersRes.data.centers) {
                setCenters(centersRes.data.centers);
            }
        } catch (error) {
            console.error('Error fetching teachers data:', error);
            showToast('حدث خطأ أثناء تحميل بيانات المعلمين من قاعدة البيانات');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Helper: Map halaqat to a specific teacher
    const getTeacherHalaqat = (teacher) => {
        if (!teacher || !Array.isArray(halaqat)) return [];
        const tFullName = `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim().toLowerCase();
        const tUsername = (teacher.username || '').trim().toLowerCase();

        return halaqat.filter(h => {
            if (!h.teacher_name) return false;
            const hTeacher = h.teacher_name.trim().toLowerCase();
            return (
                hTeacher === tFullName ||
                hTeacher === tUsername ||
                (tFullName && hTeacher.includes(tFullName)) ||
                (tUsername && hTeacher.includes(tUsername))
            );
        });
    };

    // Helper: Get student count for teacher
    const getTeacherStudentsCount = (teacher) => {
        const rings = getTeacherHalaqat(teacher);
        return rings.reduce((acc, r) => acc + (r.students_count || 0), 0);
    };

    // Helper: Teacher full name
    const getTeacherDisplayName = (teacher) => {
        const full = `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim();
        return full || teacher.username || 'معلم غير مسمى';
    };

    // Helper: Initials for avatar
    const getInitials = (teacher) => {
        const first = teacher.first_name ? teacher.first_name.trim().charAt(0) : '';
        const last = teacher.last_name ? teacher.last_name.trim().charAt(0) : '';
        return (first + (last ? ' ' + last : '')) || (teacher.username ? teacher.username.slice(0, 2).toUpperCase() : 'م');
    };

    // Filtering
    const filteredTeachers = teachers.filter(teacher => {
        const fullName = `${teacher.first_name || ''} ${teacher.last_name || ''}`.toLowerCase();
        const username = (teacher.username || '').toLowerCase();
        const phone = (teacher.phone || '').toLowerCase();
        const email = (teacher.email || '').toLowerCase();
        const centerName = (teacher.center_name || '').toLowerCase();
        const q = searchQuery.toLowerCase().trim();

        const matchesQuery = !q || (
            fullName.includes(q) ||
            username.includes(q) ||
            phone.includes(q) ||
            email.includes(q) ||
            centerName.includes(q)
        );

        const matchesCenter = selectedCenter === 'all' || teacher.center_id === selectedCenter;
        
        let matchesStatus = true;
        if (selectedStatus === 'active') matchesStatus = teacher.is_active === true;
        else if (selectedStatus === 'inactive') matchesStatus = teacher.is_active === false;

        return matchesQuery && matchesCenter && matchesStatus;
    });

    // Stats calculations
    const totalTeachersCount = teachers.length;
    const activeTeachersCount = teachers.filter(t => t.is_active).length;
    const totalAssignedRings = halaqat.filter(h => h.teacher_name).length;
    const totalStudentsInRings = halaqat.reduce((sum, h) => sum + (h.students_count || 0), 0);

    // Modal Handlers
    const handleOpenAddModal = () => {
        setFormData({
            first_name: '',
            last_name: '',
            username: '',
            password: '',
            phone: '',
            email: '',
            center_id: centers.length > 0 ? centers[0].id : '',
            is_active: true
        });
        setModalError('');
        setIsAddModalOpen(true);
    };

    const handleOpenEditModal = (teacher) => {
        setSelectedTeacher(teacher);
        setFormData({
            first_name: teacher.first_name || '',
            last_name: teacher.last_name || '',
            username: teacher.username || '',
            password: '', // blank if unchanged
            phone: teacher.phone || '',
            email: teacher.email || '',
            center_id: teacher.center_id || '',
            is_active: teacher.is_active !== false
        });
        setModalError('');
        setIsEditModalOpen(true);
    };

    const handleOpenHalaqatModal = (teacher) => {
        setSelectedTeacher(teacher);
        setIsHalaqatModalOpen(true);
    };

    const handleOpenDeleteModal = (teacher) => {
        setTeacherToDelete(teacher);
        setDeleteError('');
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!teacherToDelete) return;
        try {
            setDeleting(true);
            setDeleteError('');
            const res = await deleteUser(teacherToDelete.id);
            const displayName = getTeacherDisplayName(teacherToDelete);
            showToast(res?.message || `تم حذف حساب المعلم (${displayName}) بنجاح`);
            setIsDeleteModalOpen(false);
            setTeacherToDelete(null);
            await loadAllData(true);
        } catch (error) {
            console.error('Error deleting teacher:', error);
            const msg = error.response?.data?.message || 'حدث خطأ أثناء حذف حساب المعلم. تأكد من الصلاحيات والاتصال بالشبكة.';
            setDeleteError(msg);
        } finally {
            setDeleting(false);
        }
    };

    const handleCreateTeacher = async (e) => {
        e.preventDefault();
        setModalError('');

        if (!formData.first_name.trim() || !formData.last_name.trim()) {
            setModalError('الرجاء إدخال الاسم الأول واسم العائلة');
            return;
        }
        if (!formData.password.trim()) {
            setModalError('الرجاء إدخال كلمة المرور للمعلم');
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                first_name: formData.first_name.trim(),
                last_name: formData.last_name.trim(),
                username: formData.username.trim() || undefined,
                password: formData.password.trim(),
                role: 'TEACHER',
                phone: formData.phone.trim() || undefined,
                email: formData.email.trim() || undefined,
                center_id: formData.center_id || undefined,
                is_active: formData.is_active
            };

            await createUser(payload);
            showToast('تمت إضافة المعلم بنجاح إلى قاعدة البيانات');
            setIsAddModalOpen(false);
            await loadAllData(true);
        } catch (error) {
            console.error('Error creating teacher:', error);
            const msg = error.response?.data?.message || 'حدث خطأ أثناء إضافة المعلم. تأكد من صحة البيانات';
            setModalError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateTeacher = async (e) => {
        e.preventDefault();
        setModalError('');

        if (!formData.first_name.trim() || !formData.last_name.trim()) {
            setModalError('الرجاء إدخال الاسم الأول واسم العائلة');
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                first_name: formData.first_name.trim(),
                last_name: formData.last_name.trim(),
                phone: formData.phone.trim(),
                email: formData.email.trim(),
                center_id: formData.center_id || null,
                is_active: formData.is_active
            };
            if (formData.password.trim()) {
                payload.password = formData.password.trim();
            }

            await updateUser(selectedTeacher.id, payload);
            showToast('تم تعديل بيانات المعلم بنجاح');
            setIsEditModalOpen(false);
            await loadAllData(true);
        } catch (error) {
            console.error('Error updating teacher:', error);
            const msg = error.response?.data?.message || 'حدث خطأ أثناء تعديل بيانات المعلم';
            setModalError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="dashboard-container" style={{ direction: 'rtl', padding: '1.5rem', minHeight: '100vh', background: '#f8fafc' }}>
            {/* Toast Notification */}
            {toastMessage && (
                <div style={{
                    position: 'fixed',
                    bottom: '24px',
                    left: '24px',
                    zIndex: 9999,
                    background: '#133315',
                    color: '#fff',
                    padding: '0.85rem 1.75rem',
                    borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    direction: 'rtl'
                }}>
                    <CheckCircle size={22} color="#7cb342" weight="fill" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Header Greeting & Controls */}
            <div className="dashboard-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1.25rem',
                marginBottom: '2rem'
            }}>
                <div className="greeting" style={{ textAlign: 'right' }}>
                    <h1 style={{
                        fontSize: '1.85rem',
                        fontWeight: 800,
                        color: '#133315',
                        margin: 0,
                        marginBottom: '0.4rem',
                        letterSpacing: '-0.3px',
                        textAlign: 'right'
                    }}>
                        السلام عليكم، أ. {currentUserName}
                    </h1>
                    <p style={{ color: '#718096', fontSize: '0.95rem', margin: 0, fontWeight: 500, textAlign: 'right' }}>
                        {dateStr}
                    </p>
                </div>

                <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    {/* Refresh Button */}
                    <button
                        onClick={() => loadAllData(true)}
                        disabled={refreshing}
                        title="تحديث البيانات"
                        style={{
                            width: '42px',
                            height: '42px',
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: refreshing ? 'not-allowed' : 'pointer',
                            color: '#4a5568',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <ArrowsClockwise size={20} className={refreshing ? 'spin-animation' : ''} />
                    </button>

                    {/* Center Filter Dropdown in Header */}
                    <div style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '0.55rem 2.5rem 0.55rem 1.15rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        cursor: 'pointer'
                    }}>
                        <select
                            value={selectedCenter}
                            onChange={(e) => setSelectedCenter(e.target.value)}
                            style={{
                                appearance: 'none',
                                border: 'none',
                                background: 'transparent',
                                color: '#4a5568',
                                fontSize: '0.92rem',
                                fontWeight: 600,
                                outline: 'none',
                                cursor: 'pointer',
                                width: '100%',
                                paddingRight: '0.5rem',
                                direction: 'rtl',
                                textAlign: 'right'
                            }}
                        >
                            <option value="all">جميع المراكز القرآنية</option>
                            {centers.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        <CaretDown size={14} color="#718096" style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }} />
                        <MapPin size={18} color="#718096" style={{ position: 'absolute', right: '12px', pointerEvents: 'none' }} />
                    </div>

                    {/* Notification Bell */}
                    <button style={{
                        position: 'relative',
                        width: '42px',
                        height: '42px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        color: '#4a5568',
                        padding: 0
                    }}>
                        <Bell size={20} />
                        <span style={{
                            position: 'absolute',
                            top: '8px',
                            right: '9px',
                            width: '8px',
                            height: '8px',
                            backgroundColor: '#ea580c',
                            borderRadius: '50%',
                            border: '1.5px solid #ffffff'
                        }}></span>
                    </button>
                </div>
            </div>

            {/* KPI Statistics Overview Cards (RTL Layout) */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1.25rem',
                marginBottom: '2rem'
            }}>
                {/* Total Teachers */}
                <div style={{
                    background: '#ffffff',
                    border: '1px solid #edf2f7',
                    borderRadius: '16px',
                    padding: '1.25rem 1.4rem',
                    textAlign: 'right',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div>
                        <p style={{ color: '#718096', fontSize: '0.88rem', fontWeight: 600, margin: '0 0 0.35rem 0' }}>
                            إجمالي المعلمين
                        </p>
                        <h2 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#133315', margin: 0 }}>
                            {totalTeachersCount}
                        </h2>
                    </div>
                    <div style={{
                        background: '#f0fdf4',
                        color: '#558b2f',
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <ChalkboardTeacher size={24} weight="bold" />
                    </div>
                </div>

                {/* Active Teachers */}
                <div style={{
                    background: '#ffffff',
                    border: '1px solid #edf2f7',
                    borderRadius: '16px',
                    padding: '1.25rem 1.4rem',
                    textAlign: 'right',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div>
                        <p style={{ color: '#718096', fontSize: '0.88rem', fontWeight: 600, margin: '0 0 0.35rem 0' }}>
                            المعلمون النشطون
                        </p>
                        <h2 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#2e7d32', margin: 0 }}>
                            {activeTeachersCount}
                        </h2>
                    </div>
                    <div style={{
                        background: '#e8f5e9',
                        color: '#2e7d32',
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <CheckCircle size={24} weight="bold" />
                    </div>
                </div>

                {/* Assigned Rings */}
                <div style={{
                    background: '#ffffff',
                    border: '1px solid #edf2f7',
                    borderRadius: '16px',
                    padding: '1.25rem 1.4rem',
                    textAlign: 'right',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div>
                        <p style={{ color: '#718096', fontSize: '0.88rem', fontWeight: 600, margin: '0 0 0.35rem 0' }}>
                            الحلقات القرآنية المسندة
                        </p>
                        <h2 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#f36c32', margin: 0 }}>
                            {totalAssignedRings}
                        </h2>
                    </div>
                    <div style={{
                        background: '#fff7ed',
                        color: '#ea580c',
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Books size={24} weight="bold" />
                    </div>
                </div>

                {/* Total Students */}
                <div style={{
                    background: '#ffffff',
                    border: '1px solid #edf2f7',
                    borderRadius: '16px',
                    padding: '1.25rem 1.4rem',
                    textAlign: 'right',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div>
                        <p style={{ color: '#718096', fontSize: '0.88rem', fontWeight: 600, margin: '0 0 0.35rem 0' }}>
                            إجمالي الطلاب بالحلقات
                        </p>
                        <h2 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#1565c0', margin: 0 }}>
                            {totalStudentsInRings}
                        </h2>
                    </div>
                    <div style={{
                        background: '#eff6ff',
                        color: '#2563eb',
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Users size={24} weight="bold" />
                    </div>
                </div>
            </div>

            {/* Page Header, Search & Action Bar */}
            <div style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '1.25rem 1.5rem',
                marginBottom: '2rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1.25rem'
            }}>
                {/* Title & Count Badge (Right side in RTL) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '12px',
                        background: '#e8f5e9',
                        color: '#2e7d32',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <ChalkboardTeacher size={24} weight="bold" />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#133315', margin: 0 }}>
                                المعلمون
                            </h2>
                            <span style={{
                                background: '#f57c00',
                                color: '#fff',
                                padding: '0.2rem 0.75rem',
                                borderRadius: '16px',
                                fontSize: '0.85rem',
                                fontWeight: 700
                            }}>
                                {filteredTeachers.length} معلم
                            </span>
                        </div>
                        <p style={{ color: '#718096', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>
                            إدارة الكادر التعليمي، مراجعة الحلقات وتعيين الصلاحيات
                        </p>
                    </div>
                </div>

                {/* Filters, View Switcher & Action Button (Left side in RTL) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                    {/* Search Input */}
                    <div style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '0.55rem 2.4rem 0.55rem 1rem',
                        width: '240px'
                    }}>
                        <MagnifyingGlass size={18} color="#718096" style={{ position: 'absolute', right: '12px', pointerEvents: 'none' }} />
                        <input
                            type="text"
                            placeholder="ابحث عن معلم..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                border: 'none',
                                outline: 'none',
                                background: 'transparent',
                                width: '100%',
                                fontSize: '0.92rem',
                                color: '#1a202c',
                                direction: 'rtl',
                                textAlign: 'right'
                            }}
                        />
                        {searchQuery && (
                            <X
                                size={14}
                                color="#a0aec0"
                                style={{ cursor: 'pointer', marginLeft: '4px' }}
                                onClick={() => setSearchQuery('')}
                            />
                        )}
                    </div>

                    {/* Status Filter */}
                    <div style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '0.55rem 1.8rem 0.55rem 0.9rem'
                    }}>
                        <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            style={{
                                appearance: 'none',
                                border: 'none',
                                background: 'transparent',
                                color: '#4a5568',
                                fontSize: '0.88rem',
                                fontWeight: 600,
                                outline: 'none',
                                cursor: 'pointer',
                                direction: 'rtl',
                                textAlign: 'right'
                            }}
                        >
                            <option value="all">جميع الحالات</option>
                            <option value="active">نشط فقط</option>
                            <option value="inactive">معطل فقط</option>
                        </select>
                        <CaretDown size={12} color="#718096" style={{ position: 'absolute', left: '8px', pointerEvents: 'none' }} />
                    </div>

                    {/* View Switcher: Grid / Table */}
                    <div style={{
                        display: 'flex',
                        background: '#f1f5f9',
                        borderRadius: '10px',
                        padding: '3px'
                    }}>
                        <button
                            onClick={() => setViewMode('grid')}
                            title="عرض كروت"
                            style={{
                                background: viewMode === 'grid' ? '#ffffff' : 'transparent',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '0.45rem 0.65rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: viewMode === 'grid' ? '#133315' : '#718096',
                                boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                                transition: 'all 0.2s'
                            }}
                        >
                            <SquaresFour size={18} weight={viewMode === 'grid' ? 'bold' : 'regular'} />
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            title="عرض جدول"
                            style={{
                                background: viewMode === 'table' ? '#ffffff' : 'transparent',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '0.45rem 0.65rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: viewMode === 'table' ? '#133315' : '#718096',
                                boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                                transition: 'all 0.2s'
                            }}
                        >
                            <ListBullets size={18} weight={viewMode === 'table' ? 'bold' : 'regular'} />
                        </button>
                    </div>

                    {/* Add Teacher Button */}
                    <button
                        onClick={handleOpenAddModal}
                        style={{
                            background: '#558b2f',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '12px',
                            padding: '0.65rem 1.4rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 2px 6px rgba(85, 139, 47, 0.25)',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#426e24'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#558b2f'}
                    >
                        <Plus size={18} weight="bold" />
                        <span>إضافة معلم</span>
                    </button>
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '6rem 2rem',
                    background: '#ffffff',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    textAlign: 'center'
                }}>
                    <div className="spinner" style={{
                        border: '4px solid #f3f3f3',
                        borderTop: '4px solid #558b2f',
                        borderRadius: '50%',
                        width: '45px',
                        height: '45px',
                        animation: 'spin 1s linear infinite',
                        marginBottom: '1.25rem'
                    }}></div>
                    <h3 style={{ color: '#133315', fontSize: '1.2rem', margin: '0 0 0.5rem 0', fontWeight: 700 }}>
                        جاري تحميل بيانات المعلمين من قاعدة البيانات...
                    </h3>
                    <p style={{ color: '#718096', fontSize: '0.9rem', margin: 0 }}>
                        يتم جلب الحسابات والحلقات المسندة حالياً
                    </p>
                </div>
            )}

            {/* Empty State */}
            {!loading && filteredTeachers.length === 0 && (
                <div style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    padding: '4.5rem 2rem',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <div style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '50%',
                        background: '#f1f5f9',
                        color: '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '1.25rem'
                    }}>
                        <ChalkboardTeacher size={36} />
                    </div>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1e293b', margin: '0 0 0.5rem 0' }}>
                        لم يتم العثور على معلمين
                    </h3>
                    <p style={{ color: '#64748b', fontSize: '0.95rem', maxWidth: '420px', margin: '0 0 1.5rem 0' }}>
                        {searchQuery || selectedCenter !== 'all' || selectedStatus !== 'all'
                            ? 'لا توجد نتائج تطابق معايير البحث والفلترة المحددة. جرب تغيير كلمات البحث أو إعادة ضبط الفلاتر.'
                            : 'لا يوجد معلمون مسجلون في النظام حتى الآن. يمكنك إضافة معلم جديد بالضغط على الزر أدناه.'}
                    </p>
                    <button
                        onClick={handleOpenAddModal}
                        style={{
                            background: '#558b2f',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '10px',
                            padding: '0.65rem 1.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        <Plus size={18} weight="bold" />
                        <span>إضافة معلم جديد</span>
                    </button>
                </div>
            )}

            {/* Grid View Mode */}
            {!loading && filteredTeachers.length > 0 && viewMode === 'grid' && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                    gap: '1.5rem'
                }}>
                    {filteredTeachers.map(teacher => {
                        const teacherRings = getTeacherHalaqat(teacher);
                        const studentsCount = getTeacherStudentsCount(teacher);
                        const displayName = getTeacherDisplayName(teacher);

                        return (
                            <div
                                key={teacher.id}
                                style={{
                                    border: '1px solid #edf2f7',
                                    borderRadius: '16px',
                                    background: '#ffffff',
                                    padding: '1.5rem',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    position: 'relative',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-3px)';
                                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.06)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
                                }}
                            >
                                {/* Top Badges (RTL Layout: Role & Status on Right, Center on Left) */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '1.25rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{
                                            background: '#e8f5e9',
                                            color: '#2e7d32',
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '20px',
                                            fontSize: '0.8rem',
                                            fontWeight: 700
                                        }}>
                                            معلم
                                        </span>
                                        {teacher.is_active ? (
                                            <span style={{
                                                background: '#f0fdf4',
                                                color: '#16a34a',
                                                border: '1px solid #bbf7d0',
                                                padding: '0.2rem 0.6rem',
                                                borderRadius: '20px',
                                                fontSize: '0.75rem',
                                                fontWeight: 600
                                            }}>
                                                نشط
                                            </span>
                                        ) : (
                                            <span style={{
                                                background: '#fef2f2',
                                                color: '#dc2626',
                                                border: '1px solid #fecaca',
                                                padding: '0.2rem 0.6rem',
                                                borderRadius: '20px',
                                                fontSize: '0.75rem',
                                                fontWeight: 600
                                            }}>
                                                معطل
                                            </span>
                                        )}
                                    </div>

                                    {teacher.center_name && (
                                        <span style={{
                                            background: '#f8fafc',
                                            color: '#475569',
                                            border: '1px solid #e2e8f0',
                                            padding: '0.25rem 0.7rem',
                                            borderRadius: '16px',
                                            fontSize: '0.78rem',
                                            fontWeight: 500,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.35rem'
                                        }}>
                                            <MapPin size={13} color="#64748b" />
                                            {teacher.center_name}
                                        </span>
                                    )}
                                </div>

                                {/* Teacher Identity (Name and details aligned to the RIGHT) */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    marginBottom: '1.25rem',
                                    borderBottom: '1px solid #f1f5f9',
                                    paddingBottom: '1.25rem'
                                }}>
                                    <div style={{
                                        width: '54px',
                                        height: '54px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #133315 0%, #33691e 100%)',
                                        color: '#ffffff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.2rem',
                                        fontWeight: 700,
                                        flexShrink: 0,
                                        boxShadow: '0 4px 10px rgba(19, 51, 21, 0.15)'
                                    }}>
                                        {getInitials(teacher)}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                                        <h3 style={{
                                            fontSize: '1.25rem',
                                            fontWeight: 800,
                                            color: '#133315',
                                            margin: '0 0 0.25rem 0',
                                            textAlign: 'right',
                                            letterSpacing: '-0.2px',
                                            lineHeight: 1.3
                                        }}>
                                            {displayName}
                                        </h3>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            color: '#718096',
                                            fontSize: '0.85rem'
                                        }}>
                                            <span style={{ direction: 'ltr' }}>@{teacher.username}</span>
                                            {teacher.email && (
                                                <>
                                                    <span>•</span>
                                                    <span style={{ direction: 'ltr', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                                                        {teacher.email}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Information List (RTL Native Key-Value) */}
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.75rem',
                                    textAlign: 'right',
                                    marginBottom: '1.25rem',
                                    fontSize: '0.9rem'
                                }}>
                                    {/* Phone Number */}
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        background: '#f8fafc',
                                        padding: '0.5rem 0.75rem',
                                        borderRadius: '8px'
                                    }}>
                                        <span style={{ color: '#64748b', fontSize: '0.85rem' }}>رقم الهاتف:</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontWeight: 600, color: '#1e293b', direction: 'ltr' }}>
                                                {teacher.phone || 'غير مسجل'}
                                            </span>
                                            {teacher.phone && (
                                                <a
                                                    href={`tel:${teacher.phone}`}
                                                    title="اتصال مباشر"
                                                    style={{ color: '#558b2f', display: 'flex', alignItems: 'center' }}
                                                >
                                                    <Phone size={16} />
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    {/* Assigned Halaqat */}
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.35rem',
                                        background: '#f8fafc',
                                        padding: '0.65rem 0.75rem',
                                        borderRadius: '8px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>الحلقات المسندة:</span>
                                            <span style={{
                                                background: teacherRings.length > 0 ? '#e0f2fe' : '#f1f5f9',
                                                color: teacherRings.length > 0 ? '#0284c7' : '#94a3b8',
                                                padding: '0.15rem 0.5rem',
                                                borderRadius: '12px',
                                                fontSize: '0.78rem',
                                                fontWeight: 700
                                            }}>
                                                {teacherRings.length} {teacherRings.length === 1 ? 'حلقة' : 'حلقات'}
                                            </span>
                                        </div>

                                        {teacherRings.length > 0 ? (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.3rem' }}>
                                                {teacherRings.slice(0, 2).map(r => (
                                                    <span
                                                        key={r.id}
                                                        onClick={() => handleOpenHalaqatModal(teacher)}
                                                        style={{
                                                            background: '#ffffff',
                                                            border: '1px solid #cbd5e1',
                                                            color: '#334155',
                                                            padding: '0.2rem 0.6rem',
                                                            borderRadius: '6px',
                                                            fontSize: '0.8rem',
                                                            fontWeight: 600,
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.3rem'
                                                        }}
                                                    >
                                                        <Books size={13} color="#558b2f" />
                                                        {r.name}
                                                    </span>
                                                ))}
                                                {teacherRings.length > 2 && (
                                                    <span
                                                        onClick={() => handleOpenHalaqatModal(teacher)}
                                                        style={{
                                                            color: '#2563eb',
                                                            fontSize: '0.78rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            alignSelf: 'center'
                                                        }}
                                                    >
                                                        +{teacherRings.length - 2} المزيد
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '0.2rem' }}>
                                                لا توجد حلقات قرآنية مسندة لهذا المعلم
                                            </span>
                                        )}
                                    </div>

                                    {/* Student Count & Date Joined */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.25rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b', fontSize: '0.83rem' }}>
                                            <Users size={15} color="#558b2f" />
                                            <span>الطلاب المشرف عليهم:</span>
                                            <strong style={{ color: '#133315' }}>{studentsCount}</strong>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                                            <CalendarBlank size={14} />
                                            <span>
                                                {new Date(teacher.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric' })}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Card Action Buttons */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    borderTop: '1px solid #f1f5f9',
                                    paddingTop: '1rem',
                                    marginTop: 'auto'
                                }}>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            onClick={() => handleOpenEditModal(teacher)}
                                            style={{
                                                background: '#f8fafc',
                                                color: '#133315',
                                                border: '1px solid #cbd5e1',
                                                padding: '0.45rem 1rem',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                fontWeight: 700,
                                                fontSize: '0.88rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.4rem',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#edf2f7'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                        >
                                            <PencilSimple size={15} />
                                            <span>تعديل</span>
                                        </button>

                                        <button
                                            onClick={() => handleOpenHalaqatModal(teacher)}
                                            style={{
                                                background: '#f0fdf4',
                                                color: '#2e7d32',
                                                border: '1px solid #bbf7d0',
                                                padding: '0.45rem 0.85rem',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                fontWeight: 700,
                                                fontSize: '0.85rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.35rem'
                                            }}
                                            title="عرض تفاصيل الحلقات"
                                        >
                                            <Books size={15} />
                                            <span>الحلقات</span>
                                        </button>

                                        <button
                                            onClick={() => handleOpenDeleteModal(teacher)}
                                            style={{
                                                background: '#fef2f2',
                                                color: '#dc2626',
                                                border: '1px solid #fecaca',
                                                padding: '0.45rem 0.85rem',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                fontWeight: 700,
                                                fontSize: '0.85rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.35rem',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
                                            title="حذف حساب المعلم"
                                        >
                                            <Trash size={15} />
                                            <span>حذف</span>
                                        </button>
                                    </div>

                                    {/* Direct Phone / Contact Action */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        {teacher.phone && (
                                            <a
                                                href={`https://wa.me/${teacher.phone.replace(/[^0-9]/g, '')}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                title="مراسلة عبر واتساب"
                                                style={{
                                                    width: '36px',
                                                    height: '36px',
                                                    borderRadius: '8px',
                                                    background: '#e8f5e9',
                                                    color: '#2e7d32',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    textDecoration: 'none',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <WhatsappLogo size={20} weight="fill" />
                                            </a>
                                        )}
                                        {teacher.phone && (
                                            <a
                                                href={`tel:${teacher.phone}`}
                                                title="اتصال هاتفي"
                                                style={{
                                                    width: '36px',
                                                    height: '36px',
                                                    borderRadius: '8px',
                                                    background: '#f1f5f9',
                                                    color: '#475569',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    textDecoration: 'none'
                                                }}
                                            >
                                                <Phone size={18} />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Table View Mode */}
            {!loading && filteredTeachers.length > 0 && viewMode === 'table' && (
                <div style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', color: '#4a5568', fontSize: '0.92rem', borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ padding: '1rem', width: '50px', textAlign: 'center' }}>م</th>
                                <th style={{ padding: '1rem' }}>المعلم</th>
                                <th style={{ padding: '1rem' }}>المركز القرآني</th>
                                <th style={{ padding: '1rem' }}>الحلقات المسندة</th>
                                <th style={{ padding: '1rem', textAlign: 'center' }}>الطلاب</th>
                                <th style={{ padding: '1rem' }}>رقم الهاتف</th>
                                <th style={{ padding: '1rem', textAlign: 'center' }}>الحالة</th>
                                <th style={{ padding: '1rem', textAlign: 'center' }}>الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTeachers.map((teacher, index) => {
                                const teacherRings = getTeacherHalaqat(teacher);
                                const studentsCount = getTeacherStudentsCount(teacher);
                                const displayName = getTeacherDisplayName(teacher);

                                return (
                                    <tr key={teacher.id} style={{ borderBottom: '1px solid #edf2f7', transition: 'background 0.15s' }}>
                                        <td style={{ padding: '1rem', textAlign: 'center', color: '#718096', fontWeight: 600 }}>
                                            {index + 1}
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '50%',
                                                    background: '#e8f5e9',
                                                    color: '#2e7d32',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontWeight: 700,
                                                    fontSize: '0.95rem'
                                                }}>
                                                    {getInitials(teacher)}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700, color: '#133315', fontSize: '0.98rem' }}>
                                                        {displayName}
                                                    </div>
                                                    <div style={{ color: '#718096', fontSize: '0.82rem', direction: 'ltr', textAlign: 'right' }}>
                                                        @{teacher.username}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem', color: '#475569', fontSize: '0.92rem' }}>
                                            {teacher.center_name ? (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                    <MapPin size={15} color="#558b2f" />
                                                    {teacher.center_name}
                                                </span>
                                            ) : (
                                                <span style={{ color: '#94a3b8' }}>غير محدد</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            {teacherRings.length > 0 ? (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                                    {teacherRings.slice(0, 2).map(r => (
                                                        <span
                                                            key={r.id}
                                                            onClick={() => handleOpenHalaqatModal(teacher)}
                                                            style={{
                                                                background: '#f0fdf4',
                                                                color: '#2e7d32',
                                                                border: '1px solid #bbf7d0',
                                                                padding: '0.2rem 0.5rem',
                                                                borderRadius: '6px',
                                                                fontSize: '0.78rem',
                                                                fontWeight: 600,
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            {r.name}
                                                        </span>
                                                    ))}
                                                    {teacherRings.length > 2 && (
                                                        <span
                                                            onClick={() => handleOpenHalaqatModal(teacher)}
                                                            style={{ color: '#2563eb', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', alignSelf: 'center' }}
                                                        >
                                                            +{teacherRings.length - 2}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>لا توجد حلقات</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 700, color: '#1e293b' }}>
                                            {studentsCount}
                                        </td>
                                        <td style={{ padding: '1rem', color: '#475569', direction: 'ltr', textAlign: 'right', fontSize: '0.9rem' }}>
                                            {teacher.phone || '—'}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            {teacher.is_active ? (
                                                <span style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '0.2rem 0.7rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>
                                                    نشط
                                                </span>
                                            ) : (
                                                <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '0.2rem 0.7rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>
                                                    معطل
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                                <button
                                                    onClick={() => handleOpenEditModal(teacher)}
                                                    title="تعديل البيانات"
                                                    style={{
                                                        background: '#ffffff',
                                                        border: '1px solid #cbd5e1',
                                                        borderRadius: '8px',
                                                        padding: '0.4rem 0.6rem',
                                                        cursor: 'pointer',
                                                        color: '#1e293b',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                >
                                                    <PencilSimple size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleOpenHalaqatModal(teacher)}
                                                    title="تفاصيل الحلقات"
                                                    style={{
                                                        background: '#f0fdf4',
                                                        border: '1px solid #bbf7d0',
                                                        borderRadius: '8px',
                                                        padding: '0.4rem 0.6rem',
                                                        cursor: 'pointer',
                                                        color: '#2e7d32',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                >
                                                    <Books size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleOpenDeleteModal(teacher)}
                                                    title="حذف حساب المعلم"
                                                    style={{
                                                        background: '#fef2f2',
                                                        border: '1px solid #fecaca',
                                                        borderRadius: '8px',
                                                        padding: '0.4rem 0.6rem',
                                                        cursor: 'pointer',
                                                        color: '#dc2626',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
                                                >
                                                    <Trash size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* =========================================================================
                ADD TEACHER MODAL
            ========================================================================== */}
            {isAddModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.55)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000,
                    direction: 'rtl',
                    padding: '1rem'
                }}>
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '20px',
                        width: '100%',
                        maxWidth: '540px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                        overflow: 'hidden'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '1.25rem 1.75rem',
                            borderBottom: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '10px',
                                    background: '#e8f5e9',
                                    color: '#2e7d32',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <ChalkboardTeacher size={22} weight="bold" />
                                </div>
                                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#133315' }}>
                                    إضافة معلم جديد
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#718096',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleCreateTeacher} style={{ padding: '1.5rem 1.75rem' }}>
                            {modalError && (
                                <div style={{
                                    background: '#fef2f2',
                                    color: '#dc2626',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '10px',
                                    marginBottom: '1.25rem',
                                    fontSize: '0.9rem',
                                    border: '1px solid #fecaca'
                                }}>
                                    {modalError}
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                        الاسم الأول *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="مثال: أحمد"
                                        value={formData.first_name}
                                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '0.65rem 0.9rem',
                                            borderRadius: '10px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '0.92rem',
                                            outline: 'none',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                        اسم العائلة / الكنية *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="مثال: الراشد"
                                        value={formData.last_name}
                                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '0.65rem 0.9rem',
                                            borderRadius: '10px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '0.92rem',
                                            outline: 'none',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                        اسم المستخدم (اختياري)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="يُنشأ تلقائياً إذا تُرك فارغاً"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '0.65rem 0.9rem',
                                            borderRadius: '10px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '0.92rem',
                                            outline: 'none',
                                            boxSizing: 'border-box',
                                            direction: 'ltr'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                        كلمة المرور *
                                    </label>
                                    <input
                                        type="password"
                                        required
                                        placeholder="••••••••"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '0.65rem 0.9rem',
                                            borderRadius: '10px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '0.92rem',
                                            outline: 'none',
                                            boxSizing: 'border-box',
                                            direction: 'ltr'
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                        رقم الهاتف
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="مثال: 0501234567"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '0.65rem 0.9rem',
                                            borderRadius: '10px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '0.92rem',
                                            outline: 'none',
                                            boxSizing: 'border-box',
                                            direction: 'ltr'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                        المركز القرآني
                                    </label>
                                    <select
                                        value={formData.center_id}
                                        onChange={(e) => setFormData({ ...formData, center_id: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '0.65rem 0.9rem',
                                            borderRadius: '10px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '0.92rem',
                                            outline: 'none',
                                            boxSizing: 'border-box',
                                            background: '#ffffff',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value="">-- بدون مركز حالياً --</option>
                                        {centers.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                    البريد الإلكتروني (اختياري)
                                </label>
                                <input
                                    type="email"
                                    placeholder="teacher@example.com"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '0.65rem 0.9rem',
                                        borderRadius: '10px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '0.92rem',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        direction: 'ltr'
                                    }}
                                />
                            </div>

                            <div style={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: '0.75rem',
                                borderTop: '1px solid #e2e8f0',
                                paddingTop: '1.25rem'
                            }}>
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    style={{
                                        background: '#f1f5f9',
                                        border: 'none',
                                        borderRadius: '10px',
                                        padding: '0.65rem 1.4rem',
                                        color: '#475569',
                                        fontWeight: 700,
                                        fontSize: '0.92rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    إلغاء
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{
                                        background: '#558b2f',
                                        border: 'none',
                                        borderRadius: '10px',
                                        padding: '0.65rem 1.75rem',
                                        color: '#ffffff',
                                        fontWeight: 700,
                                        fontSize: '0.92rem',
                                        cursor: submitting ? 'not-allowed' : 'pointer',
                                        boxShadow: '0 2px 6px rgba(85, 139, 47, 0.3)'
                                    }}
                                >
                                    {submitting ? 'جاري الحفظ...' : 'حفظ المعلم'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* =========================================================================
                EDIT TEACHER MODAL
            ========================================================================== */}
            {isEditModalOpen && selectedTeacher && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.55)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000,
                    direction: 'rtl',
                    padding: '1rem'
                }}>
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '20px',
                        width: '100%',
                        maxWidth: '540px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                        overflow: 'hidden'
                    }}>
                        {/* Header */}
                        <div style={{
                            padding: '1.25rem 1.75rem',
                            borderBottom: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '10px',
                                    background: '#e8f5e9',
                                    color: '#2e7d32',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <PencilSimple size={22} weight="bold" />
                                </div>
                                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#133315' }}>
                                    تعديل بيانات المعلم: {getTeacherDisplayName(selectedTeacher)}
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#718096',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleUpdateTeacher} style={{ padding: '1.5rem 1.75rem' }}>
                            {modalError && (
                                <div style={{
                                    background: '#fef2f2',
                                    color: '#dc2626',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '10px',
                                    marginBottom: '1.25rem',
                                    fontSize: '0.9rem',
                                    border: '1px solid #fecaca'
                                }}>
                                    {modalError}
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                        الاسم الأول *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.first_name}
                                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '0.65rem 0.9rem',
                                            borderRadius: '10px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '0.92rem',
                                            outline: 'none',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                        اسم العائلة / الكنية *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.last_name}
                                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '0.65rem 0.9rem',
                                            borderRadius: '10px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '0.92rem',
                                            outline: 'none',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                        رقم الهاتف
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '0.65rem 0.9rem',
                                            borderRadius: '10px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '0.92rem',
                                            outline: 'none',
                                            boxSizing: 'border-box',
                                            direction: 'ltr'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                        المركز القرآني
                                    </label>
                                    <select
                                        value={formData.center_id}
                                        onChange={(e) => setFormData({ ...formData, center_id: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '0.65rem 0.9rem',
                                            borderRadius: '10px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '0.92rem',
                                            outline: 'none',
                                            boxSizing: 'border-box',
                                            background: '#ffffff',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value="">-- بدون مركز حالياً --</option>
                                        {centers.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                        البريد الإلكتروني
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '0.65rem 0.9rem',
                                            borderRadius: '10px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '0.92rem',
                                            outline: 'none',
                                            boxSizing: 'border-box',
                                            direction: 'ltr'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                        تغيير كلمة المرور (اختياري)
                                    </label>
                                    <input
                                        type="password"
                                        placeholder="اتركه فارغاً للإبقاء على الحالية"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '0.65rem 0.9rem',
                                            borderRadius: '10px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '0.92rem',
                                            outline: 'none',
                                            boxSizing: 'border-box',
                                            direction: 'ltr'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Active Status Toggle */}
                            <div style={{
                                background: '#f8fafc',
                                padding: '0.75rem 1rem',
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '1.5rem',
                                border: '1px solid #e2e8f0'
                            }}>
                                <div>
                                    <strong style={{ display: 'block', fontSize: '0.9rem', color: '#1e293b' }}>
                                        حالة الحساب
                                    </strong>
                                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                        تمكين أو تعطيل دخول المعلم إلى لوحة تحكم المعلم
                                    </span>
                                </div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                        style={{ width: '18px', height: '18px', accentColor: '#558b2f', cursor: 'pointer' }}
                                    />
                                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: formData.is_active ? '#2e7d32' : '#dc2626' }}>
                                        {formData.is_active ? 'حساب نشط' : 'حساب معطل'}
                                    </span>
                                </label>
                            </div>

                            <div style={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: '0.75rem',
                                borderTop: '1px solid #e2e8f0',
                                paddingTop: '1.25rem'
                            }}>
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    style={{
                                        background: '#f1f5f9',
                                        border: 'none',
                                        borderRadius: '10px',
                                        padding: '0.65rem 1.4rem',
                                        color: '#475569',
                                        fontWeight: 700,
                                        fontSize: '0.92rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    إلغاء
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{
                                        background: '#558b2f',
                                        border: 'none',
                                        borderRadius: '10px',
                                        padding: '0.65rem 1.75rem',
                                        color: '#ffffff',
                                        fontWeight: 700,
                                        fontSize: '0.92rem',
                                        cursor: submitting ? 'not-allowed' : 'pointer',
                                        boxShadow: '0 2px 6px rgba(85, 139, 47, 0.3)'
                                    }}
                                >
                                    {submitting ? 'جاري التعديل...' : 'تحديث البيانات'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* =========================================================================
                TEACHER HALAQAT DETAILS MODAL
            ========================================================================== */}
            {isHalaqatModalOpen && selectedTeacher && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.55)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000,
                    direction: 'rtl',
                    padding: '1rem'
                }}>
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '20px',
                        width: '100%',
                        maxWidth: '560px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            padding: '1.25rem 1.75rem',
                            borderBottom: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '10px',
                                    background: '#e0f2fe',
                                    color: '#0284c7',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Books size={22} weight="bold" />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#133315' }}>
                                        حلقات المعلم: {getTeacherDisplayName(selectedTeacher)}
                                    </h3>
                                    <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                                        المركز: {selectedTeacher.center_name || 'غير محدد'}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsHalaqatModalOpen(false)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#718096',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ padding: '1.5rem 1.75rem', maxHeight: '420px', overflowY: 'auto' }}>
                            {getTeacherHalaqat(selectedTeacher).length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
                                    <Books size={40} color="#cbd5e1" style={{ marginBottom: '0.75rem' }} />
                                    <p style={{ margin: '0 0 1rem 0', fontWeight: 600 }}>
                                        لا توجد حلقات قرآنية مسندة لهذا المعلم حالياً
                                    </p>
                                    <button
                                        onClick={() => {
                                            setIsHalaqatModalOpen(false);
                                            navigate(`${basePath}/rings`);
                                        }}
                                        style={{
                                            background: '#558b2f',
                                            color: '#fff',
                                            border: 'none',
                                            padding: '0.5rem 1.25rem',
                                            borderRadius: '8px',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            fontSize: '0.88rem'
                                        }}
                                    >
                                        إسناد حلقة من إدارة الحلقات
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                    {getTeacherHalaqat(selectedTeacher).map(ring => (
                                        <div
                                            key={ring.id}
                                            style={{
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '12px',
                                                padding: '1rem',
                                                background: '#f8fafc',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <div>
                                                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.05rem', color: '#133315', fontWeight: 700 }}>
                                                    {ring.name}
                                                </h4>
                                                <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.82rem', color: '#64748b' }}>
                                                    <span>المركز: {ring.center_name || '—'}</span>
                                                    {ring.project_title && (
                                                        <>
                                                            <span>•</span>
                                                            <span>المشروع: {ring.project_title}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <div style={{ textAlign: 'left' }}>
                                                <span style={{
                                                    background: '#e8f5e9',
                                                    color: '#2e7d32',
                                                    padding: '0.3rem 0.8rem',
                                                    borderRadius: '20px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 700,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.3rem'
                                                }}>
                                                    <Users size={14} />
                                                    {ring.students_count || 0} طالب
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{
                            padding: '1rem 1.75rem',
                            borderTop: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: '#f8fafc'
                        }}>
                            <button
                                onClick={() => {
                                    setIsHalaqatModalOpen(false);
                                    navigate(`${basePath}/rings`);
                                }}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#558b2f',
                                    fontWeight: 700,
                                    fontSize: '0.9rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    cursor: 'pointer'
                                }}
                            >
                                <span>إدارة جميع الحلقات</span>
                                <ArrowSquareOut size={16} />
                            </button>

                            <button
                                onClick={() => setIsHalaqatModalOpen(false)}
                                style={{
                                    background: '#cbd5e1',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '0.5rem 1.25rem',
                                    color: '#334155',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    fontSize: '0.9rem'
                                }}
                            >
                                إغلاق
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Delete Confirmation Modal Dialog */}
            {isDeleteModalOpen && teacherToDelete && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.65)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000,
                    padding: '1rem',
                    direction: 'rtl'
                }}>
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '20px',
                        width: '100%',
                        maxWidth: '480px',
                        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
                        overflow: 'hidden'
                    }}>
                        {/* Header */}
                        <div style={{
                            padding: '1.25rem 1.75rem',
                            borderBottom: '1px solid #f1f5f9',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: '#fef2f2'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '10px',
                                    background: '#fee2e2',
                                    color: '#dc2626',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Trash size={22} weight="bold" />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#991b1b' }}>
                                        تأكيد حذف حساب المعلم
                                    </h3>
                                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.82rem', color: '#b91c1c' }}>
                                        إجراء يتطلب التأكيد
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    if (!deleting) {
                                        setIsDeleteModalOpen(false);
                                        setTeacherToDelete(null);
                                    }
                                }}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#991b1b',
                                    cursor: 'pointer',
                                    padding: '0.25rem',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: '1.75rem' }}>
                            {deleteError && (
                                <div style={{
                                    background: '#fef2f2',
                                    border: '1px solid #fecaca',
                                    color: '#991b1b',
                                    padding: '0.85rem 1rem',
                                    borderRadius: '10px',
                                    fontSize: '0.9rem',
                                    marginBottom: '1.25rem',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    <WarningCircle size={20} color="#dc2626" />
                                    <span>{deleteError}</span>
                                </div>
                            )}

                            <div style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '12px',
                                padding: '1rem 1.25rem',
                                marginBottom: '1.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem'
                            }}>
                                <div style={{
                                    width: '46px',
                                    height: '46px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #133315 0%, #33691e 100%)',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: '1.1rem',
                                    flexShrink: 0
                                }}>
                                    {getInitials(teacherToDelete)}
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>
                                        {getTeacherDisplayName(teacherToDelete)}
                                    </h4>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                                        اسم المستخدم: <span style={{ direction: 'ltr', display: 'inline-block' }}>@{teacherToDelete.username}</span>
                                        {teacherToDelete.center_name ? ` • ${teacherToDelete.center_name}` : ''}
                                    </p>
                                </div>
                            </div>

                            {getTeacherHalaqat(teacherToDelete).length > 0 && (
                                <div style={{
                                    background: '#fff7ed',
                                    border: '1px solid #ffedd5',
                                    borderRadius: '10px',
                                    padding: '0.85rem 1rem',
                                    marginBottom: '1.25rem',
                                    fontSize: '0.88rem',
                                    color: '#9a3412',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '0.6rem'
                                }}>
                                    <WarningCircle size={20} color="#ea580c" style={{ flexShrink: 0, marginTop: '2px' }} />
                                    <div>
                                        <strong>تنبيه هام:</strong> المعلم مرتبط بـ ({getTeacherHalaqat(teacherToDelete).length}) حلقة قرآنية. عند حذف الحساب، سيتم إلغاء إسناد المعلم من هذه الحلقات لتصبح غير مسندة للمعلم.
                                    </div>
                                </div>
                            )}

                            <p style={{
                                color: '#475569',
                                fontSize: '0.95rem',
                                lineHeight: 1.6,
                                margin: 0,
                                textAlign: 'right'
                            }}>
                                هل أنت أصلًا متأكد من رغبتك في حذف حساب هذا المعلم؟ سيتم إلغاء تنشيط الحساب ومنعه من تسجيل الدخول إلى المنصة.
                            </p>
                        </div>

                        {/* Footer Buttons */}
                        <div style={{
                            padding: '1.25rem 1.75rem',
                            background: '#f8fafc',
                            borderTop: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '0.85rem'
                        }}>
                            <button
                                type="button"
                                disabled={deleting}
                                onClick={() => {
                                    setIsDeleteModalOpen(false);
                                    setTeacherToDelete(null);
                                }}
                                style={{
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    color: '#475569',
                                    padding: '0.65rem 1.4rem',
                                    borderRadius: '10px',
                                    fontSize: '0.92rem',
                                    fontWeight: 700,
                                    cursor: deleting ? 'not-allowed' : 'pointer'
                                }}
                            >
                                إلغاء
                            </button>

                            <button
                                type="button"
                                disabled={deleting}
                                onClick={handleConfirmDelete}
                                style={{
                                    background: '#dc2626',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '0.65rem 1.6rem',
                                    borderRadius: '10px',
                                    fontSize: '0.92rem',
                                    fontWeight: 700,
                                    cursor: deleting ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)'
                                }}
                            >
                                {deleting ? (
                                    <>
                                        <div style={{
                                            width: '16px',
                                            height: '16px',
                                            border: '2px solid rgba(255,255,255,0.4)',
                                            borderTopColor: '#ffffff',
                                            borderRadius: '50%',
                                            animation: 'spin 0.8s linear infinite'
                                        }}></div>
                                        <span>جاري الحذف...</span>
                                    </>
                                ) : (
                                    <>
                                        <Trash size={18} weight="bold" />
                                        <span>تأكيد الحذف</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const TeacherAssignment = () => {
    const { isMobile } = useDeviceType();

    if (isMobile) {
        return <MobileTeacherAssignment />;
    }

    return <DesktopTeacherAssignment />;
};

export default TeacherAssignment;
