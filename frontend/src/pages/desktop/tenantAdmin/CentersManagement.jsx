import React, { useState, useEffect } from 'react';
import {
    MapPin, MagnifyingGlass, Bell, CaretDown, Check, X, Pencil, Trash, Plus, ArrowsClockwise,
    Users, Books, User, Buildings, ChartBar, CheckCircle, WarningCircle, Eye, Clock, Phone,
    Envelope, ShieldCheck, UserCheck, Calendar, Info, Rows, Hash
} from '@phosphor-icons/react';
import {
    getCentersList,
    getCenterById,
    createCenter,
    updateCenter,
    deleteCenter
} from '../../../services/api/tenantService';

const CentersManagement = () => {
    // Current User formatting
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
    const [centers, setCenters] = useState([]);
    const [selectedHeaderCenter, setSelectedHeaderCenter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [toastMessage, setToastMessage] = useState('');

    // Modal States: Create / Edit Center
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCenter, setEditingCenter] = useState(null);
    const [centerName, setCenterName] = useState('');
    const [centerAddress, setCenterAddress] = useState('');
    const [centerCode, setCenterCode] = useState('');
    const [centerIsActive, setCenterIsActive] = useState(true);
    const [saving, setSaving] = useState(false);

    // Delete Confirmation Modal State
    const [deleteModalCenter, setDeleteModalCenter] = useState(null);
    const [deleting, setDeleting] = useState(false);

    // Center Details Drawer State
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [selectedCenterForDetails, setSelectedCenterForDetails] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [activeDetailTab, setActiveDetailTab] = useState('overview');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const centersRes = await getCentersList().catch(() => ({ status: 'error', data: [] }));
            if (centersRes && centersRes.data) {
                setCenters(centersRes.data);
            } else {
                setCenters([]);
            }
        } catch (err) {
            console.error('Error fetching centers data:', err);
            setError('حدث خطأ أثناء تحميل بيانات المراكز. يرجى المحاولة لاحقاً.');
        } finally {
            setLoading(false);
        }
    };

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3500);
    };

    const handleOpenAddModal = () => {
        setEditingCenter(null);
        setCenterName('');
        setCenterAddress('');
        setCenterCode('');
        setCenterIsActive(true);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (center) => {
        setEditingCenter(center);
        setCenterName(center.name || '');
        setCenterAddress(center.address || '');
        setCenterCode(center.code || '');
        setCenterIsActive(center.is_active !== undefined ? center.is_active : true);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        if (saving) return;
        setIsModalOpen(false);
        setEditingCenter(null);
        setCenterName('');
        setCenterAddress('');
        setCenterCode('');
        setCenterIsActive(true);
    };

    const handleSaveCenter = async (e) => {
        e.preventDefault();
        if (!centerName.trim()) {
            showToast('يرجى إدخال اسم المركز');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                name: centerName.trim(),
                address: centerAddress.trim(),
                is_active: centerIsActive
            };
            if (centerCode.trim()) {
                payload.code = centerCode.trim();
            }

            if (editingCenter) {
                const res = await updateCenter(editingCenter.id, payload);
                if (res && res.status === 'success') {
                    showToast('تم حفظ التعديلات بنجاح');
                    setIsModalOpen(false);
                    fetchData();
                } else {
                    showToast(res?.message || 'فشل تعديل بيانات المركز');
                }
            } else {
                const res = await createCenter(payload);
                if (res && (res.status === 'success' || res.data)) {
                    showToast('تم إضافة المركز بنجاح');
                    setIsModalOpen(false);
                    fetchData();
                } else {
                    showToast(res?.message || 'فشل إضافة المركز');
                }
            }
        } catch (err) {
            console.error('Error saving center:', err);
            showToast('حدث خطأ أثناء حفظ التعديلات');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteCenter = async () => {
        if (!deleteModalCenter) return;
        setDeleting(true);
        try {
            const res = await deleteCenter(deleteModalCenter.id);
            if (res && res.status === 'success') {
                showToast(`تم حذف مركز "${deleteModalCenter.name}" بنجاح`);
                setDeleteModalCenter(null);
                if (selectedCenterForDetails?.id === deleteModalCenter.id) {
                    setIsDetailsOpen(false);
                    setSelectedCenterForDetails(null);
                }
                fetchData();
            } else {
                showToast(res?.message || 'فشل حذف المركز');
            }
        } catch (err) {
            console.error('Error deleting center:', err);
            showToast('حدث خطأ أثناء حذف المركز');
        } finally {
            setDeleting(false);
        }
    };

    const handleOpenDetails = async (centerSummary) => {
        setSelectedCenterForDetails(centerSummary);
        setIsDetailsOpen(true);
        setActiveDetailTab('overview');
        setDetailsLoading(true);

        try {
            const res = await getCenterById(centerSummary.id);
            if (res && res.status === 'success' && res.data) {
                setSelectedCenterForDetails(res.data);
            }
        } catch (err) {
            console.error('Error fetching center full details:', err);
        } finally {
            setDetailsLoading(false);
        }
    };

    // Filter centers based on search & header dropdown & status filter
    const filteredCenters = centers.filter(center => {
        if (selectedHeaderCenter !== 'all' && center.id !== selectedHeaderCenter) {
            return false;
        }

        if (statusFilter === 'active' && !center.is_active) return false;
        if (statusFilter === 'inactive' && center.is_active) return false;

        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;

        return (
            (center.name && center.name.toLowerCase().includes(query)) ||
            (center.code && center.code.toLowerCase().includes(query)) ||
            (center.address && center.address.toLowerCase().includes(query)) ||
            (center.city && center.city.toLowerCase().includes(query)) ||
            (center.manager?.name && center.manager.name.toLowerCase().includes(query))
        );
    });

    // Overview Stats
    const totalCenters = centers.length;
    const totalStudents = centers.reduce((acc, c) => acc + (c.students_count || 0), 0);
    const totalTeachers = centers.reduce((acc, c) => acc + (c.teachers_count || 0), 0);
    const totalHalaqat = centers.reduce((acc, c) => acc + (c.halaqat_count || 0), 0);
    const avgAttendance = totalCenters > 0
        ? (centers.reduce((acc, c) => acc + (c.attendance_percentage || 0), 0) / totalCenters).toFixed(1)
        : 0;

    return (
        <div className="centers-container" style={{ direction: 'rtl', padding: '1.5rem 2rem', fontFamily: 'Cairo, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
            {/* Toast Notification */}
            {toastMessage && (
                <div style={{
                    position: 'fixed',
                    bottom: '24px',
                    left: '24px',
                    zIndex: 99999,
                    background: '#133315',
                    color: '#fff',
                    padding: '0.85rem 1.75rem',
                    borderRadius: '14px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '1rem',
                    fontWeight: 700,
                    animation: 'fadeIn 0.3s ease'
                }}>
                    <CheckCircle size={22} color="#8fc97e" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* ===== Top Header Bar ===== */}
            <div className="dashboard-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1.25rem',
                marginBottom: '1.75rem',
                background: '#ffffff',
                padding: '1.25rem 1.75rem',
                borderRadius: '20px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
                <div className="greeting">
                    <h1 style={{
                        fontSize: '1.75rem',
                        fontWeight: 800,
                        color: '#133315',
                        margin: 0,
                        marginBottom: '0.3rem',
                        letterSpacing: '-0.3px'
                    }}>
                        السلام عليكم، أ. {currentUserName}
                    </h1>
                    <p style={{ color: '#718096', fontSize: '0.95rem', margin: 0, fontWeight: 600 }}>
                        {defaultDateStr}
                    </p>
                </div>

                <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    {/* Center Selector Dropdown (No Project filter!) */}
                    <div style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        background: '#f8fafc',
                        border: '1px solid #cbd5e0',
                        borderRadius: '12px',
                        padding: '0.55rem 2.2rem 0.55rem 1rem',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer'
                    }}>
                        <MapPin size={18} color="#558b2f" style={{ position: 'absolute', right: '12px', pointerEvents: 'none' }} />
                        <select
                            value={selectedHeaderCenter}
                            onChange={(e) => setSelectedHeaderCenter(e.target.value)}
                            style={{
                                appearance: 'none',
                                border: 'none',
                                background: 'transparent',
                                fontSize: '0.9rem',
                                fontWeight: 700,
                                color: '#2d3748',
                                outline: 'none',
                                cursor: 'pointer',
                                paddingLeft: '1.2rem',
                                fontFamily: 'inherit'
                            }}
                        >
                            <option value="all">جميع المراكز المتاحة ({centers.length})</option>
                            {centers.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        <CaretDown size={14} color="#718096" style={{ position: 'absolute', left: '10px', pointerEvents: 'none' }} />
                    </div>

                    {/* Notification Bell */}
                    <button style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '12px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        position: 'relative',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                    }}>
                        <Bell size={20} color="#4a5568" />
                        <span style={{
                            position: 'absolute',
                            top: '10px',
                            right: '10px',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#f36c32'
                        }} />
                    </button>
                </div>
            </div>

            {/* ===== Summary Cards Metric Bar ===== */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.25rem',
                marginBottom: '2rem'
            }}>
                <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.25rem',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#eef6ec', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Buildings size={24} color="#558b2f" />
                    </div>
                    <div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#718096', display: 'block' }}>إجمالي المراكز</span>
                        <strong style={{ fontSize: '1.6rem', fontWeight: 800, color: '#133315' }}>{totalCenters}</strong>
                    </div>
                </div>

                <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.25rem',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#ebf8ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={24} color="#3182ce" />
                    </div>
                    <div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#718096', display: 'block' }}>إجمالي الطلاب</span>
                        <strong style={{ fontSize: '1.6rem', fontWeight: 800, color: '#2b6cb0' }}>{totalStudents}</strong>
                    </div>
                </div>

                <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.25rem',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#faf5ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <UserCheck size={24} color="#805ad5" />
                    </div>
                    <div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#718096', display: 'block' }}>إجمالي المعلمين</span>
                        <strong style={{ fontSize: '1.6rem', fontWeight: 800, color: '#6b46c1' }}>{totalTeachers}</strong>
                    </div>
                </div>

                <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.25rem',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#fffaf0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Books size={24} color="#dd6b20" />
                    </div>
                    <div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#718096', display: 'block' }}>إجمالي الحلقات</span>
                        <strong style={{ fontSize: '1.6rem', fontWeight: 800, color: '#c05621' }}>{totalHalaqat}</strong>
                    </div>
                </div>

                <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.25rem',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#f0fff4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ChartBar size={24} color="#38a169" />
                    </div>
                    <div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#718096', display: 'block' }}>متوسط نسبة الحضور</span>
                        <strong style={{ fontSize: '1.6rem', fontWeight: 800, color: '#276749' }}>%{avgAttendance}</strong>
                    </div>
                </div>
            </div>

            {/* ===== Main Section Header: Title, Search, Status Filter, Add Button ===== */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1.25rem',
                marginBottom: '1.5rem'
            }}>
                <div>
                    <h2 style={{
                        fontSize: '2.2rem',
                        fontWeight: 900,
                        color: '#133315',
                        margin: 0,
                        letterSpacing: '-0.5px'
                    }}>
                        المراكز والإدارات
                    </h2>
                    <p style={{ margin: '0.2rem 0 0', color: '#718096', fontSize: '0.95rem', fontWeight: 500 }}>
                        عرض وإدارة جميع المراكز ومتابعة المؤشرات الإحصائية ومديري المراكز
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    {/* Status Filter Selector */}
                    <div style={{ position: 'relative' }}>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{
                                background: '#ffffff',
                                border: '1px solid #cbd5e0',
                                borderRadius: '12px',
                                padding: '0.65rem 2.2rem 0.65rem 1rem',
                                fontSize: '0.9rem',
                                fontWeight: 700,
                                color: '#2d3748',
                                appearance: 'none',
                                outline: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="all">جميع الحالات</option>
                            <option value="active">المراكز النشطة فقط</option>
                            <option value="inactive">المراكز المتوقفة فقط</option>
                        </select>
                        <CaretDown size={14} color="#718096" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>

                    {/* Search Bar Input */}
                    <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
                        <input
                            type="text"
                            placeholder="ابحث باسم المركز، الكود، المدينة، المدير..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                background: '#ffffff',
                                border: '1px solid #cbd5e0',
                                borderRadius: '12px',
                                padding: '0.65rem 2.6rem 0.65rem 1rem',
                                fontSize: '0.92rem',
                                color: '#2d3748',
                                outline: 'none',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                            }}
                        />
                        <MagnifyingGlass
                            size={18}
                            color="#a0aec0"
                            style={{
                                position: 'absolute',
                                right: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                pointerEvents: 'none'
                            }}
                        />
                    </div>

                    {/* Add New Center Button */}
                    <button
                        onClick={handleOpenAddModal}
                        style={{
                            background: 'linear-gradient(135deg, #558b2f 0%, #388e3c 100%)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '12px',
                            padding: '0.7rem 1.75rem',
                            fontSize: '1rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 14px rgba(85, 139, 47, 0.3)',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <Plus size={18} weight="bold" />
                        <span>إضافة مركز جديد</span>
                    </button>
                </div>
            </div>

            {/* ===== Content Area ===== */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '5rem 0', background: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                    <div style={{
                        display: 'inline-block',
                        width: '44px',
                        height: '44px',
                        border: '4px solid #e2e8f0',
                        borderTopColor: '#558b2f',
                        borderRadius: '50%',
                        animation: 'spin 0.9s linear infinite'
                    }} />
                    <p style={{ marginTop: '1.25rem', color: '#718096', fontWeight: 700, fontSize: '1.05rem' }}>جاري تحميل بيانات المراكز والإحصائيات الشاملة...</p>
                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                </div>
            ) : error ? (
                <div style={{
                    background: '#fff5f5',
                    border: '1px solid #feb2b2',
                    borderRadius: '16px',
                    padding: '2.5rem',
                    textAlign: 'center',
                    color: '#c53030'
                }}>
                    <WarningCircle size={40} color="#e53e3e" style={{ marginBottom: '0.75rem' }} />
                    <p style={{ fontWeight: 700, fontSize: '1.1rem', margin: '0 0 1rem' }}>{error}</p>
                    <button
                        onClick={fetchData}
                        style={{
                            background: '#558b2f',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '10px',
                            padding: '0.6rem 1.75rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        إعادة المحاولة
                    </button>
                </div>
            ) : filteredCenters.length === 0 ? (
                <div style={{
                    background: '#ffffff',
                    border: '2px dashed #cbd5e0',
                    borderRadius: '24px',
                    padding: '4.5rem 2rem',
                    textAlign: 'center'
                }}>
                    <Buildings size={56} color="#a0aec0" style={{ marginBottom: '1rem' }} />
                    <h3 style={{ fontSize: '1.35rem', color: '#2d3748', fontWeight: 800, margin: '0 0 0.5rem' }}>
                        {searchQuery ? 'لا توجد مراكز تطابق نتائج البحث' : 'لا توجد مراكز مضافة حالياً'}
                    </h3>
                    <p style={{ color: '#718096', fontSize: '1rem', margin: '0 0 1.75rem' }}>
                        {searchQuery ? 'جرب البحث عن طريق كود المركز أو اسم مختلف' : 'يمكنك البدء بإضافة مركز جديد بالضغط على زر "إضافة مركز جديد"'}
                    </p>
                    {!searchQuery && (
                        <button
                            onClick={handleOpenAddModal}
                            style={{
                                background: '#558b2f',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '12px',
                                padding: '0.75rem 2rem',
                                fontWeight: 700,
                                fontSize: '1rem',
                                cursor: 'pointer'
                            }}
                        >
                            إضافة مركز الآن
                        </button>
                    )}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {filteredCenters.map((center) => (
                        <div
                            key={center.id}
                            style={{
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '20px',
                                padding: '1.5rem 2rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1.25rem',
                                position: 'relative',
                                overflow: 'hidden',
                                boxShadow: '0 3px 10px rgba(0,0,0,0.02)',
                                transition: 'all 0.25s ease'
                            }}
                        >
                            {/* Color Accent Stripe on Right */}
                            <div style={{
                                position: 'absolute',
                                right: 0,
                                top: 0,
                                bottom: 0,
                                width: '8px',
                                background: center.is_active ? '#558b2f' : '#f36c32',
                                borderRadius: '0 20px 20px 0'
                            }} />

                            {/* Top Row: Center Title, Code, Badges & Main Action Buttons */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                    <h3 style={{
                                        fontSize: '1.5rem',
                                        fontWeight: 900,
                                        color: '#133315',
                                        margin: 0
                                    }}>
                                        {center.name}
                                    </h3>

                                    <span style={{
                                        background: '#edf2f7',
                                        color: '#4a5568',
                                        fontSize: '0.8rem',
                                        fontWeight: 800,
                                        padding: '0.25rem 0.75rem',
                                        borderRadius: '8px',
                                        letterSpacing: '0.5px'
                                    }}>
                                        {center.code || 'CTR-000'}
                                    </span>

                                    <span style={{
                                        background: center.is_active ? '#edf7ed' : '#fff5f5',
                                        color: center.is_active ? '#2e7d32' : '#c53030',
                                        fontSize: '0.8rem',
                                        fontWeight: 800,
                                        padding: '0.25rem 0.75rem',
                                        borderRadius: '12px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: center.is_active ? '#388e3c' : '#e53e3e' }} />
                                        {center.is_active ? 'نشط' : 'متوقف مؤقتاً'}
                                    </span>

                                    <span style={{
                                        background: '#f7fafc',
                                        border: '1px solid #e2e8f0',
                                        color: '#718096',
                                        fontSize: '0.78rem',
                                        fontWeight: 600,
                                        padding: '0.2rem 0.65rem',
                                        borderRadius: '10px'
                                    }}>
                                        {center.city || 'المركز الرئيسي'}
                                    </span>
                                </div>

                                {/* Action Buttons */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <button
                                        onClick={() => handleOpenDetails(center)}
                                        style={{
                                            background: '#f0fdf4',
                                            color: '#15803d',
                                            border: '1px solid #bbf7d0',
                                            borderRadius: '10px',
                                            padding: '0.55rem 1.25rem',
                                            fontSize: '0.9rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <Eye size={17} />
                                        <span>التفاصيل الشاملة</span>
                                    </button>

                                    <button
                                        onClick={() => handleOpenEditModal(center)}
                                        style={{
                                            background: '#558b2f',
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: '10px',
                                            padding: '0.55rem 1.25rem',
                                            fontSize: '0.9rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        <Pencil size={16} />
                                        <span>تعديل</span>
                                    </button>

                                    <button
                                        onClick={() => setDeleteModalCenter(center)}
                                        title="حذف المركز"
                                        style={{
                                            background: '#fff5f5',
                                            color: '#e53e3e',
                                            border: '1px solid #fed7d7',
                                            borderRadius: '10px',
                                            padding: '0.55rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Trash size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Middle Row: Manager Information & Address Bar */}
                            <div style={{
                                background: '#f8fafc',
                                borderRadius: '12px',
                                padding: '0.85rem 1.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '1rem',
                                border: '1px solid #edf2f7'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4a5568', fontSize: '0.92rem', fontWeight: 600 }}>
                                    <MapPin size={18} color="#558b2f" />
                                    <span>{center.address || 'حمص ، المركز الرئيسي'}</span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: '#2d3748', fontWeight: 700 }}>
                                        <User size={16} color="#3182ce" />
                                        <span>مدير المركز:</span>
                                        <span style={{ color: center.manager ? '#1a202c' : '#a0aec0', fontWeight: 800 }}>
                                            {center.manager?.name || 'غير محدد'}
                                        </span>
                                    </div>

                                    {center.manager?.phone && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: '#718096' }}>
                                            <Phone size={14} color="#718096" />
                                            <span>{center.manager.phone}</span>
                                        </div>
                                    )}

                                    {center.manager?.email && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: '#718096' }}>
                                            <Envelope size={14} color="#718096" />
                                            <span>{center.manager.email}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Bottom Row: Comprehensive Statistical Grid Badges */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                                gap: '0.85rem'
                            }}>
                                <div style={{ background: '#f0fff4', border: '1px solid #c6f6d5', padding: '0.65rem 0.85rem', borderRadius: '12px', textAlign: 'center' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#2f855a', fontWeight: 700, display: 'block' }}>الطلاب</span>
                                    <strong style={{ fontSize: '1.2rem', color: '#22543d', fontWeight: 900 }}>{center.students_count || 0}</strong>
                                </div>

                                <div style={{ background: '#ebf8ff', border: '1px solid #bee3f8', padding: '0.65rem 0.85rem', borderRadius: '12px', textAlign: 'center' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#2b6cb0', fontWeight: 700, display: 'block' }}>المعلمون</span>
                                    <strong style={{ fontSize: '1.2rem', color: '#1a365d', fontWeight: 900 }}>{center.teachers_count || 0}</strong>
                                </div>

                                <div style={{ background: '#fffaf0', border: '1px solid #feebc8', padding: '0.65rem 0.85rem', borderRadius: '12px', textAlign: 'center' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#c05621', fontWeight: 700, display: 'block' }}>الحلقات</span>
                                    <strong style={{ fontSize: '1.2rem', color: '#7b341e', fontWeight: 900 }}>{center.halaqat_count || 0}</strong>
                                </div>

                                <div style={{ background: '#faf5ff', border: '1px solid #e9d8fd', padding: '0.65rem 0.85rem', borderRadius: '12px', textAlign: 'center' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#6b46c1', fontWeight: 700, display: 'block' }}>المساجد</span>
                                    <strong style={{ fontSize: '1.2rem', color: '#44337a', fontWeight: 900 }}>{center.mosques_count || 0}</strong>
                                </div>

                                <div style={{ background: '#f7fafc', border: '1px solid #e2e8f0', padding: '0.65rem 0.85rem', borderRadius: '12px', textAlign: 'center' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#4a5568', fontWeight: 700, display: 'block' }}>نسبة الحضور</span>
                                    <strong style={{ fontSize: '1.2rem', color: '#2d3748', fontWeight: 900 }}>%{center.attendance_percentage || 0}</strong>
                                </div>

                                <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', padding: '0.65rem 0.85rem', borderRadius: '12px', textAlign: 'center' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#c53030', fontWeight: 700, display: 'block' }}>طلبات معلقة</span>
                                    <strong style={{ fontSize: '1.2rem', color: '#9b2c2c', fontWeight: 900 }}>{center.open_requests_count || 0}</strong>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ===== Center Details Drawer / Dialog ===== */}
            {isDetailsOpen && selectedCenterForDetails && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 100000,
                    background: 'rgba(0, 0, 0, 0.5)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    animation: 'fadeIn 0.25s ease'
                }}>
                    <div style={{
                        background: '#ffffff',
                        width: '720px',
                        maxWidth: '100%',
                        height: '100vh',
                        display: 'flex',
                        flexDirection: 'column',
                        direction: 'rtl',
                        boxShadow: '-10px 0 30px rgba(0,0,0,0.2)'
                    }}>
                        {/* Drawer Header */}
                        <div style={{
                            padding: '1.5rem 2rem',
                            background: '#133315',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <h3 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0 }}>
                                        {selectedCenterForDetails.name}
                                    </h3>
                                    <span style={{ background: 'rgba(255,255,255,0.2)', padding: '0.2rem 0.6rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700 }}>
                                        {selectedCenterForDetails.code || 'CTR-000'}
                                    </span>
                                </div>
                                <p style={{ margin: '0.25rem 0 0', opacity: 0.8, fontSize: '0.9rem' }}>
                                    شاشة تفاصيل ومعلومات المركز الشاملة
                                </p>
                            </div>

                            <button
                                onClick={() => setIsDetailsOpen(false)}
                                style={{
                                    background: 'rgba(255,255,255,0.15)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '38px',
                                    height: '38px',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Navigation Tabs */}
                        <div style={{
                            display: 'flex',
                            borderBottom: '1px solid #e2e8f0',
                            background: '#f8fafc',
                            padding: '0 1.5rem'
                        }}>
                            {[
                                { id: 'overview', label: 'نظرة عامة', icon: Info },
                                { id: 'management', label: 'إدارة المركز', icon: UserCheck },
                                { id: 'stats', label: 'المؤشرات والأنشطة', icon: ChartBar },
                                { id: 'halaqat', label: `الحلقات (${selectedCenterForDetails.halaqat?.length || selectedCenterForDetails.halaqat_count || 0})`, icon: Books },
                                { id: 'requests', label: `الطلبات (${selectedCenterForDetails.recent_requests?.length || selectedCenterForDetails.open_requests_count || 0})`, icon: Rows },
                            ].map(tab => {
                                const IconComp = tab.icon;
                                const isActive = activeDetailTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveDetailTab(tab.id)}
                                        style={{
                                            padding: '1rem 1.25rem',
                                            background: 'transparent',
                                            border: 'none',
                                            borderBottom: isActive ? '3px solid #558b2f' : '3px solid transparent',
                                            color: isActive ? '#558b2f' : '#718096',
                                            fontWeight: isActive ? 800 : 600,
                                            fontSize: '0.92rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <IconComp size={16} />
                                        <span>{tab.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Drawer Body Content */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
                            {detailsLoading ? (
                                <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                                    <div style={{
                                        display: 'inline-block',
                                        width: '36px',
                                        height: '36px',
                                        border: '3px solid #e2e8f0',
                                        borderTopColor: '#558b2f',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite'
                                    }} />
                                    <p style={{ marginTop: '1rem', color: '#718096', fontWeight: 600 }}>جاري استخراج بيانات المركز التفصيلية...</p>
                                </div>
                            ) : (
                                <>
                                    {/* Tab 1: Overview */}
                                    {activeDetailTab === 'overview' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                            <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                                                <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#133315', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Info size={20} color="#558b2f" />
                                                    المعلومات الأساسية للمركز
                                                </h4>

                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', fontSize: '0.95rem' }}>
                                                    <div>
                                                        <span style={{ color: '#718096', display: 'block', fontSize: '0.85rem' }}>اسم المركز</span>
                                                        <strong style={{ color: '#2d3748', fontSize: '1.05rem' }}>{selectedCenterForDetails.name}</strong>
                                                    </div>

                                                    <div>
                                                        <span style={{ color: '#718096', display: 'block', fontSize: '0.85rem' }}>رمز المركز (Code)</span>
                                                        <strong style={{ color: '#2d3748', fontSize: '1.05rem' }}>{selectedCenterForDetails.code || 'غير محدد'}</strong>
                                                    </div>

                                                    <div>
                                                        <span style={{ color: '#718096', display: 'block', fontSize: '0.85rem' }}>الحالة التشغيلية</span>
                                                        <strong style={{ color: selectedCenterForDetails.is_active ? '#2e7d32' : '#c53030' }}>
                                                            {selectedCenterForDetails.operational_status || (selectedCenterForDetails.is_active ? 'يعمل بشكل طبيعي' : 'متوقف')}
                                                        </strong>
                                                    </div>

                                                    <div>
                                                        <span style={{ color: '#718096', display: 'block', fontSize: '0.85rem' }}>تاريخ الإنشاء</span>
                                                        <strong style={{ color: '#2d3748' }}>
                                                            {selectedCenterForDetails.created_at ? new Date(selectedCenterForDetails.created_at).toLocaleDateString('ar-EG') : 'غير متوفر'}
                                                        </strong>
                                                    </div>

                                                    <div>
                                                        <span style={{ color: '#718096', display: 'block', fontSize: '0.85rem' }}>المدينة / المحافظة</span>
                                                        <strong style={{ color: '#2d3748' }}>{selectedCenterForDetails.city || 'المركز الرئيسي'}</strong>
                                                    </div>

                                                    <div>
                                                        <span style={{ color: '#718096', display: 'block', fontSize: '0.85rem' }}>المنطقة / العنوان التفصيلي</span>
                                                        <strong style={{ color: '#2d3748' }}>{selectedCenterForDetails.address || 'غير محدد'}</strong>
                                                    </div>
                                                </div>
                                            </div>

                                            {(selectedCenterForDetails.latitude || selectedCenterForDetails.longitude) && (
                                                <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                                                    <h5 style={{ margin: '0 0 0.5rem', color: '#2d3748', fontWeight: 700 }}>الموقع الجغرافي</h5>
                                                    <p style={{ margin: 0, color: '#718096', fontSize: '0.9rem' }}>
                                                        خط العرض: {selectedCenterForDetails.latitude} | خط الطول: {selectedCenterForDetails.longitude}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Tab 2: Management Info */}
                                    {activeDetailTab === 'management' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                            <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                                                <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#133315', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <UserCheck size={20} color="#558b2f" />
                                                    بيانات مدير المركز
                                                </h4>

                                                {selectedCenterForDetails.manager ? (
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', fontSize: '0.95rem' }}>
                                                        <div>
                                                            <span style={{ color: '#718096', display: 'block', fontSize: '0.85rem' }}>اسم المدير</span>
                                                            <strong style={{ color: '#2d3748', fontSize: '1.05rem' }}>{selectedCenterForDetails.manager.name}</strong>
                                                        </div>

                                                        <div>
                                                            <span style={{ color: '#718096', display: 'block', fontSize: '0.85rem' }}>اسم المستخدم</span>
                                                            <strong style={{ color: '#2d3748' }}>{selectedCenterForDetails.manager.username}</strong>
                                                        </div>

                                                        <div>
                                                            <span style={{ color: '#718096', display: 'block', fontSize: '0.85rem' }}>البريد الإلكتروني</span>
                                                            <strong style={{ color: '#2d3748' }}>{selectedCenterForDetails.manager.email || 'غير متوفر'}</strong>
                                                        </div>

                                                        <div>
                                                            <span style={{ color: '#718096', display: 'block', fontSize: '0.85rem' }}>رقم الهاتف</span>
                                                            <strong style={{ color: '#2d3748' }}>{selectedCenterForDetails.manager.phone || 'غير متوفر'}</strong>
                                                        </div>

                                                        <div>
                                                            <span style={{ color: '#718096', display: 'block', fontSize: '0.85rem' }}>حالة حساب المدير</span>
                                                            <strong style={{ color: selectedCenterForDetails.manager.is_active ? '#2e7d32' : '#c53030' }}>
                                                                {selectedCenterForDetails.manager.is_active ? 'حساب نشط' : 'حساب معطل'}
                                                            </strong>
                                                        </div>

                                                        <div>
                                                            <span style={{ color: '#718096', display: 'block', fontSize: '0.85rem' }}>آخر تسجيل دخول</span>
                                                            <strong style={{ color: '#2d3748' }}>
                                                                {selectedCenterForDetails.manager.last_login ? new Date(selectedCenterForDetails.manager.last_login).toLocaleString('ar-EG') : 'لم يسجل الدخول بعد'}
                                                            </strong>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p style={{ color: '#a0aec0', fontWeight: 600, margin: 0 }}>لا يوجد مدير مخصص لهذا المركز حالياً.</p>
                                                )}
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                <div style={{ background: '#edf2f7', padding: '1.25rem', borderRadius: '14px', textAlign: 'center' }}>
                                                    <span style={{ fontSize: '0.85rem', color: '#4a5568', fontWeight: 700, display: 'block' }}>عدد المشرفين المساعدين</span>
                                                    <strong style={{ fontSize: '1.4rem', color: '#2d3748', fontWeight: 900 }}>{selectedCenterForDetails.supervisors_count || 0}</strong>
                                                </div>

                                                <div style={{ background: '#e6fffa', padding: '1.25rem', borderRadius: '14px', textAlign: 'center' }}>
                                                    <span style={{ fontSize: '0.85rem', color: '#234e52', fontWeight: 700, display: 'block' }}>إجمالي المستخدمين النشطين</span>
                                                    <strong style={{ fontSize: '1.4rem', color: '#1d4044', fontWeight: 900 }}>{selectedCenterForDetails.active_users_count || 0}</strong>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Tab 3: Stats & Activity Indicators */}
                                    {activeDetailTab === 'stats' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                            <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#133315', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <ChartBar size={20} color="#558b2f" />
                                                مؤشرات النشاط والأداء للفترة الحالية
                                            </h4>

                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                                                <div style={{ background: '#f0fff4', border: '1px solid #bbf7d0', padding: '1.25rem', borderRadius: '16px' }}>
                                                    <span style={{ fontSize: '0.85rem', color: '#166534', fontWeight: 700, display: 'block' }}>سجلات الحضور</span>
                                                    <strong style={{ fontSize: '1.75rem', color: '#14532d', fontWeight: 900 }}>{selectedCenterForDetails.attendance_count || 0}</strong>
                                                </div>

                                                <div style={{ background: '#fff5f5', border: '1px solid #fecdd3', padding: '1.25rem', borderRadius: '16px' }}>
                                                    <span style={{ fontSize: '0.85rem', color: '#9f1239', fontWeight: 700, display: 'block' }}>سجلات الغياب</span>
                                                    <strong style={{ fontSize: '1.75rem', color: '#881337', fontWeight: 900 }}>{selectedCenterForDetails.absence_count || 0}</strong>
                                                </div>

                                                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '1.25rem', borderRadius: '16px' }}>
                                                    <span style={{ fontSize: '0.85rem', color: '#1e40af', fontWeight: 700, display: 'block' }}>متوسط نسبة الحضور</span>
                                                    <strong style={{ fontSize: '1.75rem', color: '#1e3a8a', fontWeight: 900 }}>%{selectedCenterForDetails.attendance_percentage || 0}</strong>
                                                </div>

                                                <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', padding: '1.25rem', borderRadius: '16px' }}>
                                                    <span style={{ fontSize: '0.85rem', color: '#d48806', fontWeight: 700, display: 'block' }}>عدد التقييمات / التسميع</span>
                                                    <strong style={{ fontSize: '1.75rem', color: '#874d00', fontWeight: 900 }}>{selectedCenterForDetails.evaluations_count || 0}</strong>
                                                </div>

                                                <div style={{ background: '#faf5ff', border: '1px solid #e9d8fd', padding: '1.25rem', borderRadius: '16px' }}>
                                                    <span style={{ fontSize: '0.85rem', color: '#6b46c1', fontWeight: 700, display: 'block' }}>الطلبات المفتوحة</span>
                                                    <strong style={{ fontSize: '1.75rem', color: '#44337a', fontWeight: 900 }}>{selectedCenterForDetails.open_requests_count || 0}</strong>
                                                </div>

                                                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '1.25rem', borderRadius: '16px' }}>
                                                    <span style={{ fontSize: '0.85rem', color: '#15803d', fontWeight: 700, display: 'block' }}>الطلبات المكتملة</span>
                                                    <strong style={{ fontSize: '1.75rem', color: '#166534', fontWeight: 900 }}>{selectedCenterForDetails.completed_requests_count || 0}</strong>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Tab 4: Linked Halaqat */}
                                    {activeDetailTab === 'halaqat' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#133315', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Books size={20} color="#558b2f" />
                                                الحلقات التابعة للمركز
                                            </h4>

                                            {selectedCenterForDetails.halaqat && selectedCenterForDetails.halaqat.length > 0 ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                    {selectedCenterForDetails.halaqat.map(h => (
                                                        <div key={h.id} style={{
                                                            background: '#f8fafc',
                                                            border: '1px solid #e2e8f0',
                                                            borderRadius: '12px',
                                                            padding: '1rem 1.25rem',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between'
                                                        }}>
                                                            <div>
                                                                <h5 style={{ margin: '0 0 0.25rem', fontSize: '1.05rem', fontWeight: 800, color: '#2d3748' }}>{h.name}</h5>
                                                                <p style={{ margin: 0, color: '#718096', fontSize: '0.85rem' }}>المعلم المسؤول: {h.teacher_name}</p>
                                                            </div>

                                                            <div style={{ textAlign: 'left' }}>
                                                                <span style={{ background: '#e2e8f0', color: '#2d3748', fontSize: '0.8rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '8px' }}>
                                                                    السعة: {h.max_students} طالب
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p style={{ color: '#a0aec0', fontWeight: 600, textAlign: 'center', padding: '2rem 0' }}>لا توجد حلقات مسجلة في هذا المركز حتى الآن.</p>
                                            )}
                                        </div>
                                    )}

                                    {/* Tab 5: Requests */}
                                    {activeDetailTab === 'requests' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#133315', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Rows size={20} color="#558b2f" />
                                                طلبات الحسابات المرتبطة بالمركز
                                            </h4>

                                            {selectedCenterForDetails.recent_requests && selectedCenterForDetails.recent_requests.length > 0 ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                    {selectedCenterForDetails.recent_requests.map(req => (
                                                        <div key={req.id} style={{
                                                            background: '#f8fafc',
                                                            border: '1px solid #e2e8f0',
                                                            borderRadius: '12px',
                                                            padding: '1rem 1.25rem',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between'
                                                        }}>
                                                            <div>
                                                                <strong style={{ color: '#2d3748', display: 'block', fontSize: '0.95rem' }}>مقدم الطلب: {req.requested_by}</strong>
                                                                <span style={{ fontSize: '0.8rem', color: '#718096' }}>نوع الإجراء: {req.action_type}</span>
                                                            </div>

                                                            <div>
                                                                <span style={{
                                                                    background: req.status === 'PENDING' ? '#fffbe6' : req.status === 'APPROVED' ? '#f0fdf4' : '#fff5f5',
                                                                    color: req.status === 'PENDING' ? '#d48806' : req.status === 'APPROVED' ? '#15803d' : '#e53e3e',
                                                                    fontSize: '0.8rem',
                                                                    fontWeight: 800,
                                                                    padding: '0.25rem 0.75rem',
                                                                    borderRadius: '10px'
                                                                }}>
                                                                    {req.status === 'PENDING' ? 'قيد الانتظار' : req.status === 'APPROVED' ? 'مقبول' : 'مرفوض'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p style={{ color: '#a0aec0', fontWeight: 600, textAlign: 'center', padding: '2rem 0' }}>لا توجد طلبات حسابات مسجلة لهذا المركز.</p>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ===== Add / Edit Center Modal ===== */}
            {isModalOpen && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 10000,
                    background: 'rgba(0, 0, 0, 0.45)',
                    backdropFilter: 'blur(3px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem',
                    animation: 'fadeIn 0.2s ease'
                }}>
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '24px',
                        width: '540px',
                        maxWidth: '95%',
                        padding: '2.5rem',
                        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
                        direction: 'rtl',
                        position: 'relative'
                    }}>
                        <button
                            onClick={handleCloseModal}
                            disabled={saving}
                            style={{
                                position: 'absolute',
                                left: '20px',
                                top: '20px',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#a0aec0',
                                padding: '4px'
                            }}
                        >
                            <X size={20} />
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
                            <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#133315', margin: 0 }}>
                                {editingCenter ? `تعديل مركز: ${editingCenter.name}` : 'إضافة مركز جديد'}
                            </h2>
                        </div>

                        <form onSubmit={handleSaveCenter}>
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.95rem', color: '#2d3748', marginBottom: '0.5rem' }}>
                                    اسم المركز <span style={{ color: '#e53e3e' }}>*</span>
                                </label>
                                <input
                                    type="text"
                                    value={centerName}
                                    onChange={(e) => setCenterName(e.target.value)}
                                    placeholder="مثال: المركز الرئيسي - باب الدريب"
                                    required
                                    style={{
                                        width: '100%',
                                        background: '#ffffff',
                                        border: '1px solid #cbd5e0',
                                        borderRadius: '12px',
                                        padding: '0.75rem 1rem',
                                        fontSize: '1rem',
                                        color: '#1a202c',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.95rem', color: '#2d3748', marginBottom: '0.5rem' }}>
                                    رمز المركز (Code)
                                </label>
                                <input
                                    type="text"
                                    value={centerCode}
                                    onChange={(e) => setCenterCode(e.target.value)}
                                    placeholder="مثال: CTR-MAIN (يتم التوليد تلقائياً إذا تُرك فارغاً)"
                                    style={{
                                        width: '100%',
                                        background: '#ffffff',
                                        border: '1px solid #cbd5e0',
                                        borderRadius: '12px',
                                        padding: '0.75rem 1rem',
                                        fontSize: '1rem',
                                        color: '#1a202c',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.95rem', color: '#2d3748', marginBottom: '0.5rem' }}>
                                    العنوان والمدينة
                                </label>
                                <input
                                    type="text"
                                    value={centerAddress}
                                    onChange={(e) => setCenterAddress(e.target.value)}
                                    placeholder="مثال: حمص ، باب الدريب"
                                    style={{
                                        width: '100%',
                                        background: '#ffffff',
                                        border: '1px solid #cbd5e0',
                                        borderRadius: '12px',
                                        padding: '0.75rem 1rem',
                                        fontSize: '1rem',
                                        color: '#1a202c',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input
                                    type="checkbox"
                                    id="centerIsActive"
                                    checked={centerIsActive}
                                    onChange={(e) => setCenterIsActive(e.target.checked)}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                <label htmlFor="centerIsActive" style={{ fontSize: '0.95rem', fontWeight: 700, color: '#2d3748', cursor: 'pointer' }}>
                                    تفعيل المركز (حالة المركز نشطة)
                                </label>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.25rem' }}>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    style={{
                                        background: '#558b2f',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '12px',
                                        padding: '0.75rem 2.5rem',
                                        fontSize: '1rem',
                                        fontWeight: 700,
                                        cursor: saving ? 'not-allowed' : 'pointer',
                                        boxShadow: '0 4px 12px rgba(85, 139, 47, 0.25)'
                                    }}
                                >
                                    {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                                </button>

                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    disabled={saving}
                                    style={{
                                        background: '#f1f5f9',
                                        color: '#4a5568',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '12px',
                                        padding: '0.75rem 2.5rem',
                                        fontSize: '1rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    إلغاء
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ===== Delete Confirmation Modal ===== */}
            {deleteModalCenter && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 10001,
                    background: 'rgba(0, 0, 0, 0.45)',
                    backdropFilter: 'blur(3px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem'
                }}>
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '20px',
                        width: '420px',
                        maxWidth: '95%',
                        padding: '2rem',
                        textAlign: 'center',
                        direction: 'rtl'
                    }}>
                        <WarningCircle size={48} color="#e53e3e" style={{ marginBottom: '0.5rem' }} />
                        <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#133315', margin: '0 0 0.75rem' }}>
                            حذف المركز
                        </h3>
                        <p style={{ color: '#4a5568', fontSize: '1rem', margin: '0 0 1.5rem', lineHeight: '1.6' }}>
                            هل أنت تأكد من رغبتك في حذف مركز <strong>"{deleteModalCenter.name}"</strong>؟
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                            <button
                                onClick={handleDeleteCenter}
                                disabled={deleting}
                                style={{
                                    background: '#e53e3e',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '10px',
                                    padding: '0.65rem 1.75rem',
                                    fontWeight: 700,
                                    cursor: deleting ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {deleting ? 'جاري الحذف...' : 'تأكيد الحذف'}
                            </button>
                            <button
                                onClick={() => setDeleteModalCenter(null)}
                                disabled={deleting}
                                style={{
                                    background: '#edf2f7',
                                    color: '#4a5568',
                                    border: 'none',
                                    borderRadius: '10px',
                                    padding: '0.65rem 1.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CentersManagement;
