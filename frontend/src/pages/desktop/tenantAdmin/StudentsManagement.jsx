import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    MagnifyingGlass,
    PhoneCall,
    Star,
    CaretDown,
    CaretLeft,
    CaretRight,
    Users,
    Bell,
    Plus,
    PencilSimple,
    Trash,
    SquaresFour,
    ListBullets,
    CheckCircle,
    XCircle,
    MapPin,
    Books,
    GraduationCap,
    ArrowsClockwise,
    X,
    Eye,
    WhatsappLogo,
    Heart,
    Wheelchair
} from '@phosphor-icons/react';
import {
    getStudents,
    createStudent,
    updateStudent,
    deleteStudent,
    getHalaqat,
    getProjects,
    getMosqueAdminDashboardData
} from '../../../services/api/tenantService';

const StudentsManagement = () => {
    const navigate = useNavigate();

    // Data States
    const [students, setStudents] = useState([]);
    const [halaqat, setHalaqat] = useState([]);
    const [centers, setCenters] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters and Search
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCenterId, setSelectedCenterId] = useState('all');
    const [selectedRingId, setSelectedRingId] = useState('all');
    const [selectedGender, setSelectedGender] = useState('all');
    const [selectedSocialStatus, setSelectedSocialStatus] = useState('all');
    const [sortBy, setSortBy] = useState('newest'); // 'newest', 'name', 'points', 'reached_page'
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'

    // Modals
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [wizardStep, setWizardStep] = useState(1);
    const [studentToEdit, setStudentToEdit] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [studentToDelete, setStudentToDelete] = useState(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedStudentDetails, setSelectedStudentDetails] = useState(null);

    // Submission & Feedback
    const [submitting, setSubmitting] = useState(false);
    const [modalError, setModalError] = useState('');
    const [toastMessage, setToastMessage] = useState('');

    // Wizard Form Data
    const initialFormData = {
        full_name: '',
        gender: 'M',
        birth_date: '',
        national_id: '',
        registration_number: '',
        current_residence: '',
        is_orphan: false,
        has_special_needs: false,
        special_needs_notes: '',
        parent_name: '',
        parent_phone: '',
        mother_name: '',
        mother_phone: '',
        income_level: '',
        general_notes: '',
        halaqa_id: '',
        reached_page: 1,
        points: 0
    };
    const [formData, setFormData] = useState(initialFormData);

    // Date String
    const currentUserName = localStorage.getItem('username') || 'محمد العمري';
    const today = new Date();
    const dateStr = today.toLocaleDateString('ar-SA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    useEffect(() => {
        loadInitialData();
    }, []);

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 4000);
    };

    const loadInitialData = async (isManual = false) => {
        try {
            if (isManual) setRefreshing(true);
            else setLoading(true);

            const [studentsRes, halaqatRes, centersRes, projectsRes] = await Promise.all([
                getStudents().catch(() => ({ data: [] })),
                getHalaqat().catch(() => ({ data: [] })),
                getMosqueAdminDashboardData('all').catch(() => ({ data: { centers: [] } })),
                getProjects().catch(() => ({ data: [] }))
            ]);

            if (studentsRes && studentsRes.data) {
                setStudents(studentsRes.data);
            }
            if (halaqatRes && halaqatRes.data) {
                setHalaqat(halaqatRes.data);
            }
            if (centersRes && centersRes.data && centersRes.data.centers) {
                setCenters(centersRes.data.centers);
            }
            if (projectsRes && projectsRes.data) {
                setProjects(projectsRes.data);
            }
        } catch (error) {
            console.error('Error fetching students data:', error);
            showToast('حدث خطأ أثناء تحميل بيانات الطلاب');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Format Date Helper
    const formatDate = (isoString) => {
        if (!isoString) return 'غير متوفر';
        const date = new Date(isoString);
        return `${date.getFullYear()} / ${date.getMonth() + 1} / ${date.getDate()}`;
    };

    // Helper: Student Initials
    const getInitials = (fullName) => {
        if (!fullName) return 'ط';
        const parts = fullName.trim().split(/\s+/);
        if (parts.length >= 2) {
            return `${parts[0].charAt(0)} ${parts[1].charAt(0)}`;
        }
        return fullName.slice(0, 2);
    };

    // Filtering & Sorting
    const filteredStudents = students
        .filter(st => {
            const nameMatch = !searchQuery || (
                (st.full_name && st.full_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (st.national_id && st.national_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (st.parent_name && st.parent_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (st.registration_number && st.registration_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (st.parent_phone && st.parent_phone.includes(searchQuery))
            );

            const centerMatch = selectedCenterId === 'all' || st.center_id === selectedCenterId;
            const ringMatch = selectedRingId === 'all' || st.halaqa_id === selectedRingId;
            const genderMatch = selectedGender === 'all' || st.gender === selectedGender;

            let socialMatch = true;
            if (selectedSocialStatus === 'orphan') socialMatch = st.is_orphan === true;
            else if (selectedSocialStatus === 'special_needs') socialMatch = st.has_special_needs === true;

            return nameMatch && centerMatch && ringMatch && genderMatch && socialMatch;
        })
        .sort((a, b) => {
            if (sortBy === 'newest') {
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            }
            if (sortBy === 'name') {
                return (a.full_name || '').localeCompare(b.full_name || '', 'ar');
            }
            if (sortBy === 'points') {
                return (b.points || 0) - (a.points || 0);
            }
            if (sortBy === 'reached_page') {
                return (b.reached_page || 0) - (a.reached_page || 0);
            }
            return 0;
        });

    // KPI Calculations
    const totalStudentsCount = students.length;
    const maleCount = students.filter(s => s.gender === 'M').length;
    const femaleCount = students.filter(s => s.gender === 'F').length;
    const assignedToRingCount = students.filter(s => !!s.halaqa_id).length;

    // Open Wizard for Add
    const handleOpenAddWizard = () => {
        setStudentToEdit(null);
        setFormData(initialFormData);
        setWizardStep(1);
        setModalError('');
        setIsWizardOpen(true);
    };

    // Open Wizard for Edit
    const handleOpenEditWizard = (student) => {
        setStudentToEdit(student);
        setFormData({
            full_name: student.full_name || '',
            gender: student.gender || 'M',
            birth_date: student.birth_date ? student.birth_date.split('T')[0] : '',
            national_id: student.national_id || '',
            registration_number: student.registration_number || '',
            current_residence: student.current_residence || '',
            is_orphan: !!student.is_orphan,
            has_special_needs: !!student.has_special_needs,
            special_needs_notes: student.special_needs_notes || '',
            parent_name: student.parent_name || '',
            parent_phone: student.parent_phone || '',
            mother_name: student.mother_name || '',
            mother_phone: student.mother_phone || '',
            income_level: student.income_level || '',
            general_notes: student.general_notes || '',
            halaqa_id: student.halaqa_id || '',
            reached_page: student.reached_page || 1,
            points: student.points || 0
        });
        setWizardStep(1);
        setModalError('');
        setIsWizardOpen(true);
    };

    // Open Delete Confirmation
    const handleOpenDeleteModal = (student) => {
        setStudentToDelete(student);
        setIsDeleteModalOpen(true);
    };

    // Confirm Delete
    const handleConfirmDelete = async () => {
        if (!studentToDelete) return;
        try {
            setSubmitting(true);
            await deleteStudent(studentToDelete.id);
            showToast(`تم حذف ملف الطالب "${studentToDelete.full_name}" بنجاح`);
            setIsDeleteModalOpen(false);
            setStudentToDelete(null);
            await loadInitialData(true);
        } catch (error) {
            console.error('Error deleting student:', error);
            showToast('حدث خطأ أثناء حذف ملف الطالب');
        } finally {
            setSubmitting(false);
        }
    };

    // Open Details Modal
    const handleOpenDetailsModal = (student) => {
        setSelectedStudentDetails(student);
        setIsDetailsModalOpen(true);
    };

    // Submit Wizard (Add / Edit)
    const handleWizardSubmit = async (e) => {
        e.preventDefault();
        setModalError('');

        if (!formData.full_name.trim()) {
            setModalError('الاسم الكامل للطالب مطلوب');
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                ...formData,
                full_name: formData.full_name.trim(),
                reached_page: parseInt(formData.reached_page) || 1,
                points: parseInt(formData.points) || 0
            };

            if (studentToEdit) {
                await updateStudent(studentToEdit.id, payload);
                showToast(`تم تحديث بيانات الطالب "${payload.full_name}" بنجاح`);
            } else {
                await createStudent(payload);
                showToast(`تمت إضافة الطالب "${payload.full_name}" بنجاح إلى قاعدة البيانات`);
            }

            setIsWizardOpen(false);
            await loadInitialData(true);
        } catch (error) {
            console.error('Error saving student:', error);
            const msg = error.response?.data?.message || 'حدث خطأ أثناء حفظ بيانات الطالب. يرجى التحقق من البيانات';
            setModalError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="dashboard-container" style={{
            padding: '1.5rem 2rem',
            maxWidth: '1240px',
            margin: '0 auto',
            direction: 'rtl',
            minHeight: '100vh',
            background: '#fcfcfc'
        }}>
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

            {/* Header matches TeacherStudents.jsx layout */}
            <div className="dashboard-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '2rem'
            }}>
                <div className="greeting" style={{ textAlign: 'right' }}>
                    <h1 style={{ fontSize: '1.8rem', color: '#133315', marginBottom: '0.5rem', fontWeight: 800 }}>
                        السلام عليكم، أ. {currentUserName}
                    </h1>
                    <p style={{ color: '#888', fontSize: '0.9rem', margin: 0 }}>
                        {dateStr}
                    </p>
                </div>

                <div className="header-actions" style={{ display: 'flex', gap: '0.85rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Refresh Button */}
                    <button
                        onClick={() => loadInitialData(true)}
                        disabled={refreshing}
                        title="تحديث البيانات"
                        style={{
                            width: '42px',
                            height: '42px',
                            background: '#ffffff',
                            border: '1px solid #eee',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: refreshing ? 'not-allowed' : 'pointer',
                            color: '#133315',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.02)'
                        }}
                    >
                        <ArrowsClockwise size={18} className={refreshing ? 'spin-animation' : ''} />
                    </button>

                    {/* Center Filter Dropdown */}
                    <div className="select-center" style={{ position: 'relative' }}>
                        <select
                            value={selectedCenterId}
                            onChange={(e) => setSelectedCenterId(e.target.value)}
                            style={{
                                appearance: 'none',
                                border: '1px solid #eee',
                                padding: '0.55rem 2.4rem 0.55rem 1rem',
                                borderRadius: '8px',
                                background: '#fff',
                                color: '#133315',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                outline: 'none',
                                fontFamily: 'inherit',
                                minWidth: '150px',
                                fontSize: '0.9rem',
                                direction: 'rtl'
                            }}
                        >
                            <option value="all">جميع المراكز</option>
                            {centers.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        <MapPin size={16} color="#888" style={{ position: 'absolute', top: '50%', right: '0.75rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                        <CaretDown size={14} color="#888" style={{ position: 'absolute', top: '50%', left: '0.75rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>

                    {/* Halaqa Filter Dropdown (matching TeacherStudents.jsx) */}
                    <div className="select-halaqa" style={{ position: 'relative' }}>
                        <select
                            value={selectedRingId}
                            onChange={(e) => setSelectedRingId(e.target.value)}
                            style={{
                                appearance: 'none',
                                border: '1px solid #eee',
                                padding: '0.55rem 2.4rem 0.55rem 1rem',
                                borderRadius: '8px',
                                background: '#fff',
                                color: '#133315',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                outline: 'none',
                                fontFamily: 'inherit',
                                minWidth: '150px',
                                fontSize: '0.9rem',
                                direction: 'rtl'
                            }}
                        >
                            <option value="all">كل الحلقات</option>
                            {halaqat.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                        <Users size={16} color="#888" style={{ position: 'absolute', top: '50%', right: '0.75rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                        <CaretDown size={14} color="#888" style={{ position: 'absolute', top: '50%', left: '0.75rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>

                    {/* Notification Bell */}
                    <div className="icon-btn" style={{
                        position: 'relative',
                        background: '#fff',
                        border: '1px solid #eee',
                        padding: '0.55rem',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Bell size={20} color="#133315" />
                        <span style={{ position: 'absolute', top: 3, right: 3, width: 8, height: 8, backgroundColor: '#f57c00', borderRadius: '50%' }}></span>
                    </div>
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '1.25rem',
                marginBottom: '2rem'
            }}>
                <div style={{
                    background: '#fff',
                    borderRadius: '16px',
                    border: '1px solid #edf2f7',
                    padding: '1.25rem 1.4rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                }}>
                    <div>
                        <p style={{ color: '#718096', fontSize: '0.88rem', fontWeight: 600, margin: '0 0 0.35rem 0' }}>إجمالي الطلاب</p>
                        <h2 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#133315', margin: 0 }}>{totalStudentsCount}</h2>
                    </div>
                    <div style={{ background: '#f0fdf4', color: '#558b2f', width: '46px', height: '46px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <GraduationCap size={24} weight="bold" />
                    </div>
                </div>

                <div style={{
                    background: '#fff',
                    borderRadius: '16px',
                    border: '1px solid #edf2f7',
                    padding: '1.25rem 1.4rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                }}>
                    <div>
                        <p style={{ color: '#718096', fontSize: '0.88rem', fontWeight: 600, margin: '0 0 0.35rem 0' }}>الطلاب البنين</p>
                        <h2 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#2563eb', margin: 0 }}>{maleCount}</h2>
                    </div>
                    <div style={{ background: '#eff6ff', color: '#2563eb', width: '46px', height: '46px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={24} weight="bold" />
                    </div>
                </div>

                <div style={{
                    background: '#fff',
                    borderRadius: '16px',
                    border: '1px solid #edf2f7',
                    padding: '1.25rem 1.4rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                }}>
                    <div>
                        <p style={{ color: '#718096', fontSize: '0.88rem', fontWeight: 600, margin: '0 0 0.35rem 0' }}>الطالبات البنات</p>
                        <h2 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#db2777', margin: 0 }}>{femaleCount}</h2>
                    </div>
                    <div style={{ background: '#fdf2f8', color: '#db2777', width: '46px', height: '46px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={24} weight="bold" />
                    </div>
                </div>

                <div style={{
                    background: '#fff',
                    borderRadius: '16px',
                    border: '1px solid #edf2f7',
                    padding: '1.25rem 1.4rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                }}>
                    <div>
                        <p style={{ color: '#718096', fontSize: '0.88rem', fontWeight: 600, margin: '0 0 0.35rem 0' }}>مسكنون بالحلقات</p>
                        <h2 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#f36c32', margin: 0 }}>{assignedToRingCount}</h2>
                    </div>
                    <div style={{ background: '#fff7ed', color: '#ea580c', width: '46px', height: '46px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Books size={24} weight="bold" />
                    </div>
                </div>
            </div>

            {/* Title & Controls Bar (Identical styling to TeacherStudents.jsx + Admin Extensions) */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1.5rem',
                marginBottom: '2.5rem'
            }}>
                {/* Title & Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h2 style={{ fontSize: '2.5rem', color: '#1a3b1c', fontWeight: 'bold', margin: 0 }}>الطلاب</h2>
                    <span style={{
                        background: '#f4a261',
                        color: '#fff',
                        padding: '0.3rem 1rem',
                        borderRadius: '20px',
                        fontWeight: 'bold',
                        fontSize: '0.9rem'
                    }}>
                        {filteredStudents.length} طالب
                    </span>
                </div>

                {/* Search, Filters, Switcher, and Add Button */}
                <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Search Input */}
                    <div style={{ position: 'relative', width: '250px' }}>
                        <input
                            type="text"
                            placeholder="ابحث عن طالب ..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                padding: '0.7rem 2.5rem 0.7rem 1rem',
                                border: '1px solid #e0e0e0',
                                borderRadius: '8px',
                                width: '100%',
                                outline: 'none',
                                fontFamily: 'inherit',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.02)',
                                direction: 'rtl',
                                boxSizing: 'border-box'
                            }}
                        />
                        <MagnifyingGlass size={18} color="#888" style={{ position: 'absolute', top: '50%', right: '0.8rem', transform: 'translateY(-50%)' }} />
                        {searchQuery && (
                            <X
                                size={14}
                                color="#a0aec0"
                                style={{ position: 'absolute', top: '50%', left: '0.8rem', transform: 'translateY(-50%)', cursor: 'pointer' }}
                                onClick={() => setSearchQuery('')}
                            />
                        )}
                    </div>

                    {/* Gender Filter */}
                    <div style={{ position: 'relative' }}>
                        <select
                            value={selectedGender}
                            onChange={(e) => setSelectedGender(e.target.value)}
                            style={{
                                appearance: 'none',
                                border: '1px solid #e0e0e0',
                                padding: '0.65rem 1.8rem 0.65rem 0.9rem',
                                borderRadius: '8px',
                                background: '#fff',
                                color: '#4a5568',
                                fontSize: '0.88rem',
                                fontWeight: 600,
                                outline: 'none',
                                cursor: 'pointer',
                                direction: 'rtl'
                            }}
                        >
                            <option value="all">جميع الفئات</option>
                            <option value="M">بنين فقط</option>
                            <option value="F">بنات فقط</option>
                        </select>
                        <CaretDown size={12} color="#718096" style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>

                    {/* Sort Dropdown */}
                    <div style={{ position: 'relative' }}>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            style={{
                                appearance: 'none',
                                border: '1px solid #e0e0e0',
                                padding: '0.65rem 1.8rem 0.65rem 0.9rem',
                                borderRadius: '8px',
                                background: '#fff',
                                color: '#4a5568',
                                fontSize: '0.88rem',
                                fontWeight: 600,
                                outline: 'none',
                                cursor: 'pointer',
                                direction: 'rtl'
                            }}
                        >
                            <option value="newest">الأحدث تسجيلاً</option>
                            <option value="name">أبجدياً (أ-ي)</option>
                            <option value="points">الأعلى نقاطاً</option>
                            <option value="reached_page">الأعلى صفحة وصول</option>
                        </select>
                        <CaretDown size={12} color="#718096" style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>

                    {/* View Switcher: Grid / Table */}
                    <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '3px' }}>
                        <button
                            onClick={() => setViewMode('grid')}
                            title="عرض كروت"
                            style={{
                                background: viewMode === 'grid' ? '#ffffff' : 'transparent',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '0.45rem 0.65rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: viewMode === 'grid' ? '#133315' : '#718096',
                                boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
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
                                borderRadius: '6px',
                                padding: '0.45rem 0.65rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: viewMode === 'table' ? '#133315' : '#718096',
                                boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                            }}
                        >
                            <ListBullets size={18} weight={viewMode === 'table' ? 'bold' : 'regular'} />
                        </button>
                    </div>

                    {/* Add Student Button (Admin Direct Creation) */}
                    <button
                        onClick={handleOpenAddWizard}
                        style={{
                            backgroundColor: '#558b2f',
                            color: '#fff',
                            border: 'none',
                            padding: '0.7rem 1.5rem',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontSize: '0.95rem'
                        }}
                    >
                        <Plus size={18} weight="bold" />
                        <span>إضافة طالب جديد</span>
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
                    padding: '5rem 2rem',
                    textAlign: 'center'
                }}>
                    <div className="spinner" style={{
                        border: '4px solid #f3f3f3',
                        borderTop: '4px solid #558b2f',
                        borderRadius: '50%',
                        width: '42px',
                        height: '42px',
                        animation: 'spin 1s linear infinite',
                        marginBottom: '1rem'
                    }}></div>
                    <p style={{ color: '#558b2f', fontWeight: 'bold', fontSize: '1.05rem', margin: 0 }}>
                        جاري تحميل بيانات الطلاب...
                    </p>
                </div>
            )}

            {/* Empty State */}
            {!loading && filteredStudents.length === 0 && (
                <div style={{
                    background: '#fff',
                    borderRadius: '16px',
                    border: '1px solid #f0f0f0',
                    padding: '4rem 2rem',
                    textAlign: 'center',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.02)'
                }}>
                    <div style={{
                        width: '70px',
                        height: '70px',
                        borderRadius: '50%',
                        background: '#f8fafc',
                        color: '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.25rem auto'
                    }}>
                        <GraduationCap size={36} />
                    </div>
                    <h3 style={{ fontSize: '1.3rem', color: '#133315', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                        لم يتم العثور على أي طالب
                    </h3>
                    <p style={{ color: '#718096', fontSize: '0.95rem', margin: '0 0 1.5rem 0' }}>
                        {searchQuery || selectedRingId !== 'all' || selectedCenterId !== 'all'
                            ? 'لا توجد نتائج تطابق معايير البحث والفلترة المحددة'
                            : 'لا يوجد طلاب مسجلون حالياً. يمكنك إضافة طالب جديد للبدء'}
                    </p>
                    <button
                        onClick={handleOpenAddWizard}
                        style={{
                            background: '#558b2f',
                            color: '#fff',
                            border: 'none',
                            padding: '0.65rem 1.5rem',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        إضافة طالب الآن
                    </button>
                </div>
            )}

            {/* Cards Grid View (Identical to TeacherStudents.jsx + Admin Controls) */}
            {!loading && filteredStudents.length > 0 && viewMode === 'grid' && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '2.5rem',
                    paddingTop: '2rem'
                }}>
                    {filteredStudents.map(student => (
                        <div key={student.id} style={{
                            background: '#fff',
                            borderRadius: '16px',
                            padding: '1.5rem',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                            border: '1px solid #f0f0f0',
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            {/* Top row: Gender badge and Points */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span style={{
                                        background: student.gender === 'F' ? '#fce7f3' : '#aed1f5',
                                        color: student.gender === 'F' ? '#9d174d' : '#1e3a8a',
                                        padding: '0.3rem 0.9rem',
                                        borderRadius: '12px',
                                        fontSize: '0.8rem',
                                        fontWeight: 'bold'
                                    }}>
                                        {student.gender === 'F' ? 'أنثى' : 'ذكر'}
                                    </span>
                                    {student.is_orphan && (
                                        <span title="يتيم" style={{ background: '#fef3c7', color: '#92400e', padding: '0.25rem 0.5rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                                            <Heart size={12} weight="fill" />
                                            <span>يتيم</span>
                                        </span>
                                    )}
                                    {student.has_special_needs && (
                                        <span title="ذوي احتياجات خاصة" style={{ background: '#ede9fe', color: '#5b21b6', padding: '0.25rem 0.5rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                                            <Wheelchair size={13} weight="bold" />
                                            <span>احتياجات خاصة</span>
                                        </span>
                                    )}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#666', fontSize: '0.85rem' }}>
                                    <span style={{ fontWeight: 600 }}>{student.points || 0} نقطة</span>
                                    <Star size={16} color="#f57c00" weight="fill" />
                                </div>
                            </div>

                            {/* Avatar (overlapping top border) */}
                            <div style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '50%',
                                border: '3px solid #eee',
                                background: student.gender === 'F' ? '#fff1f2' : '#fafafa',
                                margin: '-4.5rem auto 1rem auto',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                color: student.gender === 'F' ? '#e11d48' : '#558b2f',
                                fontWeight: 800,
                                fontSize: '1.25rem',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                            }}>
                                {getInitials(student.full_name)}
                            </div>

                            {/* Center info */}
                            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                                <div style={{
                                    background: '#dcedc8',
                                    color: '#33691e',
                                    padding: '0.2rem 0.6rem',
                                    borderRadius: '12px',
                                    fontSize: '0.8rem',
                                    fontWeight: 'bold',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.2rem',
                                    marginBottom: '0.5rem'
                                }}>
                                    {student.rating || '0.0'} / 5
                                </div>
                                <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.3rem', color: '#111', fontWeight: 700 }}>
                                    {student.full_name}
                                </h3>
                                <p style={{ color: '#e65100', margin: '0 0 0.35rem 0', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                    رقم صفحة الوصول : {student.reached_page || 1}
                                </p>
                                {student.halaqa_name && (
                                    <span style={{
                                        background: '#f1f5f9',
                                        color: '#334155',
                                        padding: '0.15rem 0.6rem',
                                        borderRadius: '8px',
                                        fontSize: '0.78rem',
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        <Books size={12} color="#558b2f" />
                                        {student.halaqa_name} {student.center_name ? `• ${student.center_name}` : ''}
                                    </span>
                                )}
                            </div>

                            {/* Details List (Exact parity with TeacherStudents.jsx) */}
                            <div style={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.6rem',
                                fontSize: '0.85rem',
                                color: '#444',
                                marginBottom: '1.5rem',
                                lineHeight: '1.4'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#718096' }}>اسم الأب :</span>
                                    <span style={{ fontWeight: 600 }}>{student.parent_name || 'غير متوفر'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#718096' }}>اسم الأم والكنية :</span>
                                    <span style={{ fontWeight: 600 }}>{student.mother_name || 'غير متوفر'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#718096' }}>تاريخ الميلاد :</span>
                                    <span>{formatDate(student.birth_date)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#718096' }}>رقم هاتف الأب :</span>
                                    <span style={{ direction: 'ltr' }}>{student.parent_phone || 'غير متوفر'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#718096' }}>رقم هاتف الأم :</span>
                                    <span style={{ direction: 'ltr' }}>{student.mother_phone || 'غير متوفر'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#718096' }}>رقم الوثيقة :</span>
                                    <span>{student.national_id || 'غير متوفر'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#718096' }}>رقم القيد :</span>
                                    <span>{student.registration_number || 'غير متوفر'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#718096' }}>السكن الحالي :</span>
                                    <span>{student.current_residence || 'غير متوفر'}</span>
                                </div>
                            </div>

                            {/* Actions Footer (With Admin Full Permissions) */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderTop: '1px solid #eee',
                                paddingTop: '1rem',
                                marginTop: 'auto'
                            }}>
                                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                    {student.parent_phone && (
                                        <a
                                            href={`tel:${student.parent_phone}`}
                                            title="اتصال بولي الأمر"
                                            style={{ color: '#81b255', display: 'flex', alignItems: 'center' }}
                                        >
                                            <PhoneCall size={22} weight="regular" />
                                        </a>
                                    )}
                                    {student.parent_phone && (
                                        <a
                                            href={`https://wa.me/${student.parent_phone.replace(/[^0-9]/g, '')}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            title="مراسلة واتساب"
                                            style={{ color: '#25d366', display: 'flex', alignItems: 'center' }}
                                        >
                                            <WhatsappLogo size={22} weight="fill" />
                                        </a>
                                    )}
                                </div>

                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                    <button
                                        onClick={() => handleOpenEditWizard(student)}
                                        style={{
                                            backgroundColor: '#558b2f',
                                            color: '#fff',
                                            border: 'none',
                                            padding: '0.4rem 0.9rem',
                                            borderRadius: '20px',
                                            fontSize: '0.82rem',
                                            fontWeight: 'bold',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        تعديل
                                    </button>
                                    <button
                                        onClick={() => handleOpenDeleteModal(student)}
                                        style={{
                                            backgroundColor: '#dc2626',
                                            color: '#fff',
                                            border: 'none',
                                            padding: '0.4rem 0.85rem',
                                            borderRadius: '20px',
                                            fontSize: '0.82rem',
                                            fontWeight: 'bold',
                                            cursor: 'pointer'
                                        }}
                                        title="حذف الطالب مباشرة"
                                    >
                                        حذف
                                    </button>
                                    <button
                                        onClick={() => handleOpenDetailsModal(student)}
                                        style={{
                                            backgroundColor: '#e65100',
                                            color: '#fff',
                                            border: 'none',
                                            padding: '0.4rem 0.9rem',
                                            borderRadius: '20px',
                                            fontSize: '0.82rem',
                                            fontWeight: 'bold',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        نشاط الطالب
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Table View Mode (Admin Grid Overview) */}
            {!loading && filteredStudents.length > 0 && viewMode === 'table' && (
                <div style={{
                    background: '#fff',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', color: '#4a5568', fontSize: '0.92rem', borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ padding: '1rem', width: '50px', textAlign: 'center' }}>م</th>
                                <th style={{ padding: '1rem' }}>اسم الطالب</th>
                                <th style={{ padding: '1rem' }}>الحلقة والمركز</th>
                                <th style={{ padding: '1rem' }}>ولي الأمر</th>
                                <th style={{ padding: '1rem', textAlign: 'center' }}>صفحة الوصول</th>
                                <th style={{ padding: '1rem', textAlign: 'center' }}>النقاط</th>
                                <th style={{ padding: '1rem', textAlign: 'center' }}>التقييم</th>
                                <th style={{ padding: '1rem', textAlign: 'center' }}>الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStudents.map((student, idx) => (
                                <tr key={student.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                                    <td style={{ padding: '1rem', textAlign: 'center', color: '#718096', fontWeight: 600 }}>
                                        {idx + 1}
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{
                                                width: '38px',
                                                height: '38px',
                                                borderRadius: '50%',
                                                background: student.gender === 'F' ? '#fce7f3' : '#e8f5e9',
                                                color: student.gender === 'F' ? '#9d174d' : '#2e7d32',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 700,
                                                fontSize: '0.9rem'
                                            }}>
                                                {getInitials(student.full_name)}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 700, color: '#133315', fontSize: '0.95rem' }}>
                                                    {student.full_name}
                                                </div>
                                                <div style={{ color: '#718096', fontSize: '0.8rem' }}>
                                                    {student.national_id ? `هوية: ${student.national_id}` : (student.gender === 'F' ? 'أنثى' : 'ذكر')}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#334155' }}>
                                        {student.halaqa_name || '—'}
                                        {student.center_name && (
                                            <div style={{ fontSize: '0.8rem', color: '#718096' }}>{student.center_name}</div>
                                        )}
                                    </td>
                                    <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#334155' }}>
                                        <div>{student.parent_name || 'غير متوفر'}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#718096', direction: 'ltr', textAlign: 'right' }}>
                                            {student.parent_phone || ''}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 700, color: '#e65100' }}>
                                        {student.reached_page || 1}
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 700, color: '#133315' }}>
                                        {student.points || 0}
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                        <span style={{
                                            background: '#dcedc8',
                                            color: '#33691e',
                                            padding: '0.2rem 0.6rem',
                                            borderRadius: '12px',
                                            fontSize: '0.8rem',
                                            fontWeight: 'bold'
                                        }}>
                                            {student.rating || '0.0'} / 5
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                                            <button
                                                onClick={() => handleOpenEditWizard(student)}
                                                style={{
                                                    background: '#f0fdf4',
                                                    border: '1px solid #bbf7d0',
                                                    borderRadius: '8px',
                                                    padding: '0.4rem 0.6rem',
                                                    cursor: 'pointer',
                                                    color: '#2e7d32'
                                                }}
                                                title="تعديل الطالب"
                                            >
                                                <PencilSimple size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleOpenDeleteModal(student)}
                                                style={{
                                                    background: '#fef2f2',
                                                    border: '1px solid #fecaca',
                                                    borderRadius: '8px',
                                                    padding: '0.4rem 0.6rem',
                                                    cursor: 'pointer',
                                                    color: '#dc2626'
                                                }}
                                                title="حذف الطالب"
                                            >
                                                <Trash size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleOpenDetailsModal(student)}
                                                style={{
                                                    background: '#fff7ed',
                                                    border: '1px solid #fed7aa',
                                                    borderRadius: '8px',
                                                    padding: '0.4rem 0.6rem',
                                                    cursor: 'pointer',
                                                    color: '#ea580c'
                                                }}
                                                title="تفاصيل ونشاط الطالب"
                                            >
                                                <Eye size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* =========================================================================
                ADD / EDIT STUDENT 3-STEP WIZARD MODAL
            ========================================================================== */}
            {isWizardOpen && (
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
                        maxWidth: '680px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        maxHeight: '90vh'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '1.25rem 1.75rem',
                            borderBottom: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: '#f8fafc'
                        }}>
                            <div>
                                <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', fontWeight: 800, color: '#133315' }}>
                                    {studentToEdit ? `تعديل بيانات الطالب: ${studentToEdit.full_name}` : 'إضافة طالب جديد'}
                                </h3>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#718096' }}>
                                    صلاحيات المدير الكاملة — حفظ مباشر في قاعدة البيانات
                                </p>
                            </div>
                            <button
                                onClick={() => setIsWizardOpen(false)}
                                style={{ background: 'transparent', border: 'none', color: '#718096', cursor: 'pointer', padding: '4px' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Step Navigation Progress */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-around',
                            padding: '1rem 1.75rem',
                            borderBottom: '1px solid #f1f5f9',
                            background: '#fff'
                        }}>
                            <div
                                onClick={() => setWizardStep(1)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    cursor: 'pointer',
                                    color: wizardStep === 1 ? '#558b2f' : '#94a3b8',
                                    fontWeight: wizardStep === 1 ? 700 : 500
                                }}
                            >
                                <span style={{
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '50%',
                                    background: wizardStep === 1 ? '#558b2f' : '#f1f5f9',
                                    color: wizardStep === 1 ? '#fff' : '#64748b',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.85rem'
                                }}>1</span>
                                <span>البيانات الشخصية</span>
                            </div>

                            <div
                                onClick={() => setWizardStep(2)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    cursor: 'pointer',
                                    color: wizardStep === 2 ? '#558b2f' : '#94a3b8',
                                    fontWeight: wizardStep === 2 ? 700 : 500
                                }}
                            >
                                <span style={{
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '50%',
                                    background: wizardStep === 2 ? '#558b2f' : '#f1f5f9',
                                    color: wizardStep === 2 ? '#fff' : '#64748b',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.85rem'
                                }}>2</span>
                                <span>بيانات الأسرة</span>
                            </div>

                            <div
                                onClick={() => setWizardStep(3)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    cursor: 'pointer',
                                    color: wizardStep === 3 ? '#558b2f' : '#94a3b8',
                                    fontWeight: wizardStep === 3 ? 700 : 500
                                }}
                            >
                                <span style={{
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '50%',
                                    background: wizardStep === 3 ? '#558b2f' : '#f1f5f9',
                                    color: wizardStep === 3 ? '#fff' : '#64748b',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.85rem'
                                }}>3</span>
                                <span>الحلقة والحفظ</span>
                            </div>
                        </div>

                        {/* Modal Body / Steps */}
                        <form onSubmit={handleWizardSubmit} style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 1.75rem' }}>
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

                            {/* STEP 1: Personal Details */}
                            {wizardStep === 1 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                                الاسم الكامل للطالب *
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="مثال: عمر أحمد الراشد"
                                                value={formData.full_name}
                                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                                style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box' }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                                الجنس *
                                            </label>
                                            <select
                                                value={formData.gender}
                                                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                                style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', background: '#fff', boxSizing: 'border-box' }}
                                            >
                                                <option value="M">ذكر (طالب)</option>
                                                <option value="F">أنثى (طالبة)</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                                تاريخ الميلاد
                                            </label>
                                            <input
                                                type="date"
                                                value={formData.birth_date}
                                                onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                                                style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box' }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                                رقم الوثيقة / الهوية الوطنية
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="رقم الوثيقة"
                                                value={formData.national_id}
                                                onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                                                style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box' }}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                                رقم القيد
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="مثال: باب السباع - 560"
                                                value={formData.registration_number}
                                                onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                                                style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box' }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                                السكن الحالي
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="مثال: حمص - الإنشاءات"
                                                value={formData.current_residence}
                                                onChange={(e) => setFormData({ ...formData, current_residence: e.target.value })}
                                                style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Social & Health Status Checkboxes */}
                                    <div style={{
                                        background: '#f8fafc',
                                        padding: '1rem',
                                        borderRadius: '12px',
                                        border: '1px solid #e2e8f0',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.75rem'
                                    }}>
                                        <div style={{ display: 'flex', gap: '2rem' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.is_orphan}
                                                    onChange={(e) => setFormData({ ...formData, is_orphan: e.target.checked })}
                                                    style={{ width: '18px', height: '18px', accentColor: '#558b2f' }}
                                                />
                                                <span>هل الطالب يتيم؟</span>
                                            </label>

                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.has_special_needs}
                                                    onChange={(e) => setFormData({ ...formData, has_special_needs: e.target.checked })}
                                                    style={{ width: '18px', height: '18px', accentColor: '#558b2f' }}
                                                />
                                                <span>هل يعاني من احتياجات خاصة؟</span>
                                            </label>
                                        </div>

                                        {formData.has_special_needs && (
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
                                                    ملاحظات الحالة الصحية والاحتياجات الخاصة:
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder="حدد نوع الاحتياج أو الإعاقة"
                                                    value={formData.special_needs_notes}
                                                    onChange={(e) => setFormData({ ...formData, special_needs_notes: e.target.value })}
                                                    style={{ width: '100%', padding: '0.5rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: Parent and Family Details */}
                            {wizardStep === 2 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                                اسم الأب / ولي الأمر
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="اسم الأب الكامل"
                                                value={formData.parent_name}
                                                onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                                                style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box' }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                                رقم هاتف الأب / ولي الأمر
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="0501234567"
                                                value={formData.parent_phone}
                                                onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                                                style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', direction: 'ltr', boxSizing: 'border-box' }}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                                اسم الأم والكنية
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="اسم الأم واللقب"
                                                value={formData.mother_name}
                                                onChange={(e) => setFormData({ ...formData, mother_name: e.target.value })}
                                                style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box' }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                                رقم هاتف الأم
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="0507654321"
                                                value={formData.mother_phone}
                                                onChange={(e) => setFormData({ ...formData, mother_phone: e.target.value })}
                                                style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', direction: 'ltr', boxSizing: 'border-box' }}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                            المستوى المادي للأسرة
                                        </label>
                                        <select
                                            value={formData.income_level}
                                            onChange={(e) => setFormData({ ...formData, income_level: e.target.value })}
                                            style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', background: '#fff' }}
                                        >
                                            <option value="">-- غير محدد --</option>
                                            <option value="محدود">محدود / بحاجة لدعم</option>
                                            <option value="متوسط">متوسط</option>
                                            <option value="جيد">جيد / ميسور</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                            ملاحظات عامة حول الطالب
                                        </label>
                                        <textarea
                                            rows="3"
                                            placeholder="أي ملاحظات تربوية أو أسرية تهم الإدارة"
                                            value={formData.general_notes}
                                            onChange={(e) => setFormData({ ...formData, general_notes: e.target.value })}
                                            style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box' }}
                                        ></textarea>
                                    </div>
                                </div>
                            )}

                            {/* STEP 3: Quranic Halaqa & Progress */}
                            {wizardStep === 3 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                            الحلقة القرآنية المسند إليها *
                                        </label>
                                        <select
                                            value={formData.halaqa_id}
                                            onChange={(e) => setFormData({ ...formData, halaqa_id: e.target.value })}
                                            style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', background: '#fff' }}
                                        >
                                            <option value="">-- بدون حلقة حالياً (تسجيل حر) --</option>
                                            {halaqat.map(r => (
                                                <option key={r.id} value={r.id}>
                                                    {r.name} {r.teacher_name ? `(معلم: ${r.teacher_name})` : ''} {r.center_name ? `• ${r.center_name}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                                رقم صفحة الوصول الحالية (1 - 604)
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="604"
                                                value={formData.reached_page}
                                                onChange={(e) => setFormData({ ...formData, reached_page: e.target.value })}
                                                style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box' }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                                رصيد النقاط الافتتاحي
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.points}
                                                onChange={(e) => setFormData({ ...formData, points: e.target.value })}
                                                style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box' }}
                                            />
                                        </div>
                                    </div>

                                    <div style={{
                                        background: '#f0fdf4',
                                        border: '1px solid #bbf7d0',
                                        borderRadius: '12px',
                                        padding: '1rem',
                                        color: '#166534',
                                        fontSize: '0.88rem',
                                        lineHeight: '1.5'
                                    }}>
                                        💡 <strong>تنبيه إداري:</strong> عند تعيين حلقة وموقع وصول، سيقوم النظام تلقائياً بتحديد المرحلة القرآنية والجزء المعتمد في المشروع وإضافته لملف الطالب وسجلات الإنجاز فوراً.
                                    </div>
                                </div>
                            )}

                            {/* Wizard Footer Controls */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderTop: '1px solid #e2e8f0',
                                paddingTop: '1.25rem',
                                marginTop: '1.5rem'
                            }}>
                                <div>
                                    {wizardStep > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => setWizardStep(wizardStep - 1)}
                                            style={{
                                                background: '#f1f5f9',
                                                border: 'none',
                                                borderRadius: '10px',
                                                padding: '0.65rem 1.25rem',
                                                color: '#475569',
                                                fontWeight: 700,
                                                fontSize: '0.9rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.4rem'
                                            }}
                                        >
                                            <CaretRight size={16} />
                                            <span>السابق</span>
                                        </button>
                                    )}
                                </div>

                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => setIsWizardOpen(false)}
                                        style={{
                                            background: 'transparent',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '10px',
                                            padding: '0.65rem 1.25rem',
                                            color: '#64748b',
                                            fontWeight: 600,
                                            fontSize: '0.9rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        إلغاء
                                    </button>

                                    {wizardStep < 3 ? (
                                        <button
                                            type="button"
                                            onClick={() => setWizardStep(wizardStep + 1)}
                                            style={{
                                                background: '#558b2f',
                                                border: 'none',
                                                borderRadius: '10px',
                                                padding: '0.65rem 1.5rem',
                                                color: '#fff',
                                                fontWeight: 700,
                                                fontSize: '0.9rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.4rem'
                                            }}
                                        >
                                            <span>التالي</span>
                                            <CaretLeft size={16} />
                                        </button>
                                    ) : (
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            style={{
                                                background: '#133315',
                                                border: 'none',
                                                borderRadius: '10px',
                                                padding: '0.65rem 1.75rem',
                                                color: '#fff',
                                                fontWeight: 700,
                                                fontSize: '0.92rem',
                                                cursor: submitting ? 'not-allowed' : 'pointer',
                                                boxShadow: '0 2px 6px rgba(19, 51, 21, 0.3)'
                                            }}
                                        >
                                            {submitting ? 'جاري الحفظ...' : (studentToEdit ? 'حفظ التعديلات' : 'إنشاء ملف الطالب')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* =========================================================================
                STUDENT DETAILS & ACTIVITY MODAL
            ========================================================================== */}
            {isDetailsModalOpen && selectedStudentDetails && (
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
                        maxWidth: '620px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                        overflow: 'hidden',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <div style={{
                            padding: '1.25rem 1.75rem',
                            borderBottom: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: '#f8fafc'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    width: '42px',
                                    height: '42px',
                                    borderRadius: '50%',
                                    background: '#e8f5e9',
                                    color: '#2e7d32',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: '1.1rem'
                                }}>
                                    {getInitials(selectedStudentDetails.full_name)}
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#133315' }}>
                                        الملف الشامل: {selectedStudentDetails.full_name}
                                    </h3>
                                    <span style={{ fontSize: '0.85rem', color: '#718096' }}>
                                        {selectedStudentDetails.halaqa_name || 'بدون حلقة'} • {selectedStudentDetails.center_name || 'بدون مركز'}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsDetailsModalOpen(false)}
                                style={{ background: 'transparent', border: 'none', color: '#718096', cursor: 'pointer', padding: '4px' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {/* Academic Highlights */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, 1fr)',
                                gap: '0.75rem',
                                background: '#f8fafc',
                                padding: '1rem',
                                borderRadius: '12px',
                                textAlign: 'center'
                            }}>
                                <div>
                                    <span style={{ color: '#718096', fontSize: '0.8rem', display: 'block' }}>صفحة الوصول</span>
                                    <strong style={{ fontSize: '1.2rem', color: '#e65100' }}>
                                        {selectedStudentDetails.reached_page || 1}
                                    </strong>
                                </div>
                                <div>
                                    <span style={{ color: '#718096', fontSize: '0.8rem', display: 'block' }}>رصيد النقاط</span>
                                    <strong style={{ fontSize: '1.2rem', color: '#558b2f' }}>
                                        {selectedStudentDetails.points || 0}
                                    </strong>
                                </div>
                                <div>
                                    <span style={{ color: '#718096', fontSize: '0.8rem', display: 'block' }}>التقييم العام</span>
                                    <strong style={{ fontSize: '1.2rem', color: '#f57c00' }}>
                                        {selectedStudentDetails.rating || '0.0'} / 5
                                    </strong>
                                </div>
                            </div>

                            {/* Enrollments & Stages */}
                            <div>
                                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#133315', fontWeight: 700 }}>
                                    التسكين والمراحل المسجلة
                                </h4>
                                {selectedStudentDetails.enrollments && selectedStudentDetails.enrollments.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {selectedStudentDetails.enrollments.map(en => (
                                            <div key={en.enrollment_id} style={{
                                                background: '#fff',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '10px',
                                                padding: '0.75rem 1rem',
                                                fontSize: '0.88rem'
                                            }}>
                                                <div style={{ fontWeight: 700, color: '#133315', marginBottom: '0.2rem' }}>
                                                    {en.halaqa_name || 'حلقة غير مسماة'}
                                                </div>
                                                <div style={{ color: '#64748b', fontSize: '0.82rem' }}>
                                                    {en.project_title ? `المشروع: ${en.project_title} • ` : ''}
                                                    {en.stage_title ? `المرحلة: ${en.stage_title} • ` : ''}
                                                    {en.part_title ? `الجزء: ${en.part_title}` : ''}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>لا توجد تفاصيل تسكين مسجلة</p>
                                )}
                            </div>

                            {/* Contact & Social Information */}
                            <div>
                                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#133315', fontWeight: 700 }}>
                                    البيانات العائلية والاجتماعية
                                </h4>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '0.75rem',
                                    background: '#f8fafc',
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    fontSize: '0.88rem'
                                }}>
                                    <div><span style={{ color: '#718096' }}>الأب:</span> <strong>{selectedStudentDetails.parent_name || '—'}</strong></div>
                                    <div><span style={{ color: '#718096' }}>هاتف الأب:</span> <span style={{ direction: 'ltr' }}>{selectedStudentDetails.parent_phone || '—'}</span></div>
                                    <div><span style={{ color: '#718096' }}>الأم:</span> <strong>{selectedStudentDetails.mother_name || '—'}</strong></div>
                                    <div><span style={{ color: '#718096' }}>هاتف الأم:</span> <span style={{ direction: 'ltr' }}>{selectedStudentDetails.mother_phone || '—'}</span></div>
                                    <div><span style={{ color: '#718096' }}>الحالة:</span> <strong>{selectedStudentDetails.is_orphan ? 'يتيم' : 'طبيعي'}</strong></div>
                                    <div><span style={{ color: '#718096' }}>الدخل:</span> <strong>{selectedStudentDetails.income_level || '—'}</strong></div>
                                </div>
                            </div>
                        </div>

                        <div style={{
                            padding: '1rem 1.75rem',
                            borderTop: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            background: '#f8fafc'
                        }}>
                            <button
                                onClick={() => setIsDetailsModalOpen(false)}
                                style={{
                                    background: '#558b2f',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '0.5rem 1.5rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                إغلاق
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================================================
                DELETE CONFIRMATION DIALOG
            ========================================================================== */}
            {isDeleteModalOpen && studentToDelete && (
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
                        maxWidth: '440px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                        padding: '1.75rem',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            background: '#fee2e2',
                            color: '#dc2626',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1.25rem auto'
                        }}>
                            <Trash size={28} weight="bold" />
                        </div>
                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: '#1e293b', fontWeight: 800 }}>
                            حذف ملف الطالب نهائياً؟
                        </h3>
                        <p style={{ color: '#64748b', fontSize: '0.92rem', margin: '0 0 1.5rem 0', lineHeight: '1.5' }}>
                            هل أنت متأكد من رغبتك في حذف ملف الطالب <strong>"{studentToDelete.full_name}"</strong>؟
                            سيؤدي ذلك لحذف سجلات الحفظ والتسجيل الخاصة به من قاعدة البيانات.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                style={{
                                    background: '#f1f5f9',
                                    border: 'none',
                                    borderRadius: '10px',
                                    padding: '0.65rem 1.4rem',
                                    color: '#475569',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                تراجع
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                disabled={submitting}
                                style={{
                                    background: '#dc2626',
                                    border: 'none',
                                    borderRadius: '10px',
                                    padding: '0.65rem 1.75rem',
                                    color: '#fff',
                                    fontWeight: 700,
                                    cursor: submitting ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {submitting ? 'جاري الحذف...' : 'نعم، احذف الطالب'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentsManagement;
