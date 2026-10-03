import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getUserById, updateUser } from '../../../services/api/userService';
import { 
    Bell, MapPin, CaretDown, Check, X, Plus, 
    User, Phone, ShieldCheck, 
    UsersThree, BookOpen, WarningCircle, CalendarBlank, Clock, IdentificationCard
} from '@phosphor-icons/react';
import { getMosqueAdminDashboardData } from '../../../services/api/tenantService';

const ALL_ROLES = [
    { value: 'STUDENT', label: 'طالب', color: '#2b6cb0', bg: '#ebf8ff' },
    { value: 'TEACHER', label: 'معلم', color: '#c05621', bg: '#fffaf0' },
    { value: 'CENTER_MANAGER', label: 'مدير مركز', color: '#276749', bg: '#f0fff4' },
    { value: 'TENANT_ADMIN', label: 'مدير نظام', color: '#6b46c1', bg: '#faf5ff' },
];

const ORPHAN_CHOICES = [
    { value: '', label: 'سليم الأبوين (غير يتيم)' },
    { value: 'f', label: 'يتيم الأب' },
    { value: 'm', label: 'يتيم الأم' },
    { value: 't', label: 'يتيم الأبوين (الاثنين)' },
];

const UserDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const basePath = location.pathname.startsWith('/center-manager') ? '/center-manager' : '/admin';
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState('success');
    const [formError, setFormError] = useState('');
    const [selectedCenter, setSelectedCenter] = useState('all');
    const [centers, setCenters] = useState([]);
    
    // User Form State matching all model properties
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        username: '',
        email: '',
        password: '',
        is_active: true,
        roles: ['STUDENT'],
        role: 'STUDENT',
        center_id: '',
        phone: '',
        latitude: '',
        longitude: '',
        guardian_type: 'FATHER',
        father_name: '',
        father_phone: '',
        mother_name: '',
        mother_last_name: '',
        mother_phone: '',
        orphan_status: '',
        monthly_income: '',
        health_status: '',
        reached_page: 1,
    });

    const currentUserName = localStorage.getItem('username') || 'محمد العمري';
    const todayDate = new Date();
    const hijriDate = new Intl.DateTimeFormat('ar-SA', { calendar: 'islamic', day: 'numeric', month: 'long', year: 'numeric' }).format(todayDate);
    const gregorianDate = new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }).format(todayDate);
    const weekday = new Intl.DateTimeFormat('ar-EG', { weekday: 'long' }).format(todayDate);
    const defaultDateStr = `${weekday}، ${hijriDate} | ${gregorianDate} م`;

    useEffect(() => {
        fetchCenters();
        fetchUserDetail();
    }, [id]);

    const fetchCenters = async () => {
        try {
            const res = await getMosqueAdminDashboardData('all');
            if (res && res.data && res.data.centers) {
                setCenters(res.data.centers);
            }
        } catch (error) {
            console.error("Error fetching centers", error);
        }
    };

    const fetchUserDetail = async () => {
        try {
            setLoading(true);
            const data = await getUserById(id);
            if (data && data.data) {
                const u = data.data;
                setUser(u);

                const userRoles = Array.isArray(u.roles) && u.roles.length > 0
                    ? u.roles
                    : (u.role ? [u.role] : ['STUDENT']);

                setFormData({
                    first_name: u.first_name || '',
                    last_name: u.last_name || '',
                    username: u.username || '',
                    email: u.email || '',
                    password: '', // leave empty unless updating
                    is_active: u.is_active ?? true,
                    roles: userRoles,
                    role: userRoles[0] || 'STUDENT',
                    center_id: u.center_id || '',
                    phone: u.phone || '',
                    latitude: u.latitude !== null && u.latitude !== undefined ? u.latitude : '',
                    longitude: u.longitude !== null && u.longitude !== undefined ? u.longitude : '',
                    guardian_type: u.guardian_type || 'FATHER',
                    father_name: u.father_name || '',
                    father_phone: u.father_phone || '',
                    mother_name: u.mother_name || '',
                    mother_last_name: u.mother_last_name || '',
                    mother_phone: u.mother_phone || '',
                    orphan_status: u.orphan_status || '',
                    monthly_income: u.monthly_income !== null && u.monthly_income !== undefined ? u.monthly_income : '',
                    health_status: u.health_status || '',
                    reached_page: u.reached_page !== null && u.reached_page !== undefined ? u.reached_page : 1,
                });
                setFormError('');
            }
        } catch (error) {
            console.error("Error fetching user detail:", error);
            showToast('تعذر جلب بيانات المستخدم', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        if (formError) setFormError('');
    };

    const handleAddRole = (roleValue) => {
        if (!formData.roles.includes(roleValue)) {
            const updatedRoles = [...formData.roles, roleValue];
            setFormData(prev => ({
                ...prev,
                roles: updatedRoles,
                role: updatedRoles[0]
            }));
            setFormError('');
        }
    };

    const handleRemoveRole = (roleValue) => {
        const updatedRoles = formData.roles.filter(r => r !== roleValue);
        if (updatedRoles.length === 0) {
            setFormError('يجب اختيار دور واحد على الأقل للمستخدم');
            return;
        }
        setFormData(prev => ({
            ...prev,
            roles: updatedRoles,
            role: updatedRoles[0]
        }));
        setFormError('');
    };

    const validateForm = () => {
        if (!formData.first_name.trim()) return 'الاسم الأول مطلوب';
        if (!formData.last_name.trim()) return 'اسم العائلة (الكنية) مطلوب';
        if (!formData.roles || formData.roles.length === 0) return 'يجب اختيار دور واحد على الأقل للمستخدم';
        if (formData.roles.includes('CENTER_MANAGER') && !formData.center_id) {
            return 'عذراً، يجب تحديد المركز القرآني التابع له المستخدم عند إسناد دور (مدير مركز)';
        }
        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            return 'صيغة البريد الإلكتروني غير صالحة';
        }
        if (formData.roles.includes('STUDENT') && formData.guardian_type === 'MOTHER') {
            if (!formData.mother_name.trim() || !formData.mother_last_name.trim()) {
                return 'عذراً، لا يمكن اختيار الأم كولي أمر إلا في حال إدخال اسم الأم وكنيتها';
            }
        }
        if (formData.password && formData.password.length < 6) {
            return 'كلمة المرور الجديدة يجب أن لا تقل عن 6 أحرف';
        }
        if (formData.reached_page) {
            const pageNum = parseInt(formData.reached_page, 10);
            if (isNaN(pageNum) || pageNum < 1 || pageNum > 604) {
                return 'صفحة الوصول يجب أن تكون رقماً بين 1 و 604';
            }
        }
        return null;
    };

    const handleSave = async () => {
        const error = validateForm();
        if (error) {
            setFormError(error);
            showToast(error, 'error');
            return;
        }

        try {
            setSaving(true);
            setFormError('');

            const payload = {
                first_name: formData.first_name.trim(),
                last_name: formData.last_name.trim(),
                username: formData.username.trim(),
                email: formData.email.trim(),
                is_active: formData.is_active,
                roles: formData.roles,
                role: formData.roles[0],
                center_id: formData.center_id || null,
                phone: formData.phone.trim(),
                latitude: formData.latitude !== '' ? parseFloat(formData.latitude) : null,
                longitude: formData.longitude !== '' ? parseFloat(formData.longitude) : null,
                guardian_type: formData.guardian_type,
                father_name: formData.father_name.trim(),
                father_phone: formData.father_phone.trim(),
                mother_name: formData.mother_name.trim(),
                mother_last_name: formData.mother_last_name.trim(),
                mother_phone: formData.mother_phone.trim(),
                orphan_status: formData.orphan_status || null,
                monthly_income: formData.monthly_income !== '' ? parseFloat(formData.monthly_income) : null,
                health_status: formData.health_status.trim(),
                reached_page: formData.reached_page ? parseInt(formData.reached_page, 10) : 1,
            };

            if (formData.password.trim()) {
                payload.password = formData.password.trim();
            }

            await updateUser(id, payload);
            showToast('تم حفظ التعديلات بنجاح', 'success');
            fetchUserDetail();
        } catch (error) {
            console.error("Error updating user:", error);
            const msg = error.response?.data?.message || error.response?.data?.details || 'حدث خطأ أثناء حفظ التعديلات';
            setFormError(msg);
            showToast(msg, 'error');
        } finally {
            setSaving(false);
        }
    };

    const showToast = (msg, type = 'success') => {
        setToastMessage(msg);
        setToastType(type);
        setTimeout(() => setToastMessage(''), 4000);
    };

    if (loading) {
        return (
            <div style={{ padding: '5rem', textAlign: 'center', color: '#718096', fontSize: '1.1rem', direction: 'rtl' }}>
                جاري تحميل تفاصيل المستخدم...
            </div>
        );
    }

    if (!user) {
        return (
            <div style={{ padding: '5rem', textAlign: 'center', color: '#e53e3e', fontSize: '1.1rem', direction: 'rtl' }}>
                المستخدم المطلوب غير موجود
            </div>
        );
    }

    const availableRolesToAdd = ALL_ROLES.filter(r => !formData.roles?.includes(r.value));

    const formattedCreatedAt = user.created_at ? new Date(user.created_at).toLocaleString('ar-SA', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : '—';

    const formattedLastLogin = user.last_login ? new Date(user.last_login).toLocaleString('ar-SA', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : 'لم يسجل دخول بعد';

    return (
        <div className="dashboard-container" style={{ direction: 'rtl' }}>
            {/* Toast Notification */}
            {toastMessage && (
                <div style={{ 
                    position: 'fixed', 
                    bottom: '24px', 
                    left: '24px', 
                    zIndex: 9999, 
                    background: toastType === 'error' ? '#9b2c2c' : '#133315', 
                    color: '#fff', 
                    padding: '0.85rem 1.75rem', 
                    borderRadius: '12px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px', 
                    fontSize: '0.95rem',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.18)'
                }}>
                    {toastType === 'error' ? <WarningCircle size={20} color="#feb2b2" weight="fill" /> : <Check size={20} color="#8fc97e" weight="bold" />}
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Header */}
            <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem', marginBottom: '2rem' }}>
                <div className="greeting">
                    <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#133315', margin: 0, marginBottom: '0.4rem', letterSpacing: '-0.3px' }}>
                        السلام عليكم، أ. {currentUserName}
                    </h1>
                    <p style={{ color: '#718096', fontSize: '0.95rem', margin: 0, fontWeight: 500 }}>
                        {defaultDateStr}
                    </p>
                </div>

                <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.55rem 2.5rem 0.55rem 1.15rem' }}>
                        <select
                            value={selectedCenter}
                            onChange={(e) => setSelectedCenter(e.target.value)}
                            style={{ appearance: 'none', border: 'none', background: 'transparent', color: '#4a5568', fontSize: '0.92rem', fontWeight: 600, outline: 'none', cursor: 'pointer', width: '100%', paddingRight: '0.5rem' }}
                        >
                            <option value="all">المركز الرئيسي</option>
                            {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <CaretDown size={14} color="#718096" style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }} />
                        <MapPin size={18} color="#718096" style={{ position: 'absolute', right: '12px', pointerEvents: 'none' }} />
                    </div>

                    <button style={{ position: 'relative', width: '42px', height: '42px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#4a5568' }}>
                        <Bell size={20} />
                        <span style={{ position: 'absolute', top: '8px', right: '9px', width: '8px', height: '8px', backgroundColor: '#ea580c', borderRadius: '50%', border: '1.5px solid #ffffff' }}></span>
                    </button>
                </div>
            </div>

            {/* Main User Card */}
            <div style={{ background: '#fff', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                
                {/* Top Profile Summary Bar - User & Avatar on the Right, Actions on the Left */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', borderBottom: '1px solid #edf2f7', paddingBottom: '1.5rem' }}>
                    {/* Right Side: Avatar and User Identity */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        <div style={{ 
                            width: '85px', 
                            height: '85px', 
                            borderRadius: '50%', 
                            background: '#e3f2fd', 
                            color: '#1565c0',
                            overflow: 'hidden', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            fontSize: '2rem',
                            fontWeight: 'bold',
                            border: '3px solid #bbdefb',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.06)',
                            flexShrink: 0
                        }}>
                            {(formData.first_name || user.first_name || 'U').charAt(0)}
                        </div>

                        <div style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                                <h2 style={{ margin: 0, fontSize: '1.6rem', color: '#133315', fontWeight: 800 }}>
                                    {formData.first_name} {formData.last_name}
                                </h2>
                                
                                <span style={{
                                    background: formData.is_active ? '#e8f5e9' : '#ffebee',
                                    color: formData.is_active ? '#2e7d32' : '#c62828',
                                    padding: '0.2rem 0.8rem',
                                    borderRadius: '16px',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    border: `1px solid ${formData.is_active ? '#a5d6a7' : '#ef9a9a'}`
                                }}>
                                    {formData.is_active ? 'حساب نشط' : 'حساب معطل'}
                                </span>
                            </div>

                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                                {formData.roles.map((rVal) => {
                                    const roleObj = ALL_ROLES.find(r => r.value === rVal) || { label: rVal, bg: '#e2e8f0', color: '#4a5568' };
                                    return (
                                        <span 
                                            key={rVal} 
                                            style={{ 
                                                background: roleObj.bg, 
                                                color: roleObj.color, 
                                                border: `1px solid ${roleObj.color}35`, 
                                                padding: '0.2rem 0.8rem', 
                                                borderRadius: '16px', 
                                                fontSize: '0.82rem',
                                                fontWeight: '700'
                                            }}
                                        >
                                            {roleObj.label}
                                        </span>
                                    );
                                })}
                            </div>

                            <div style={{ display: 'flex', gap: '1.25rem', color: '#718096', fontSize: '0.88rem' }}>
                                <span>اسم المستخدم: <strong style={{ color: '#2b6cb0' }}>@{formData.username || user.username}</strong></span>
                            </div>
                        </div>
                    </div>

                    {/* Left Side: Actions */}
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <button 
                            onClick={handleSave} 
                            disabled={saving}
                            style={{ 
                                background: '#558b2f', 
                                color: '#fff', 
                                border: 'none', 
                                padding: '0.7rem 2.2rem', 
                                borderRadius: '10px', 
                                fontSize: '1rem', 
                                fontWeight: 'bold', 
                                cursor: saving ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                boxShadow: '0 2px 6px rgba(85, 139, 47, 0.3)'
                            }}
                        >
                            <Check size={18} weight="bold" />
                            <span>{saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
                        </button>
                        <button 
                            onClick={() => navigate(`${basePath}/users`)}
                            style={{ background: '#fff', color: '#718096', border: '1px solid #cbd5e0', padding: '0.7rem 1.8rem', borderRadius: '10px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                            رجوع للقائمة
                        </button>
                    </div>
                </div>

                {/* Form Error Message */}
                {formError && (
                    <div style={{
                        background: '#fff5f5',
                        border: '1px solid #feb2b2',
                        borderRadius: '10px',
                        padding: '0.9rem 1.2rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        color: '#c53030',
                        fontSize: '0.92rem'
                    }}>
                        <WarningCircle size={20} weight="fill" />
                        <span>{formError}</span>
                    </div>
                )}

                {/* Structured Form Sections */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    
                    {/* SECTION 1: Identity & Account */}
                    <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem', color: '#133315', fontWeight: 800, fontSize: '1.1rem' }}>
                            <User size={22} color="#558b2f" weight="bold" />
                            <span>1. بيانات الحساب الأساسية والهوية</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#4a5568', marginBottom: '0.4rem' }}>
                                    الاسم الأول <span style={{ color: '#e53e3e' }}>*</span>
                                </label>
                                <input 
                                    type="text" 
                                    name="first_name"
                                    value={formData.first_name} 
                                    onChange={handleInputChange}
                                    style={{ width: '100%', padding: '0.7rem 1rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none' }} 
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#4a5568', marginBottom: '0.4rem' }}>
                                    اسم العائلة (الكنية) <span style={{ color: '#e53e3e' }}>*</span>
                                </label>
                                <input 
                                    type="text" 
                                    name="last_name"
                                    value={formData.last_name} 
                                    onChange={handleInputChange}
                                    style={{ width: '100%', padding: '0.7rem 1rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none' }} 
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#4a5568', marginBottom: '0.4rem' }}>
                                    اسم المستخدم
                                </label>
                                <input 
                                    type="text" 
                                    name="username"
                                    value={formData.username} 
                                    onChange={handleInputChange}
                                    disabled={user.username === 'manager'}
                                    style={{ width: '100%', padding: '0.7rem 1rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', background: user.username === 'manager' ? '#edf2f7' : '#fff' }} 
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#4a5568', marginBottom: '0.4rem' }}>
                                    البريد الإلكتروني
                                </label>
                                <input 
                                    type="email" 
                                    name="email"
                                    value={formData.email} 
                                    onChange={handleInputChange}
                                    placeholder="user@example.com"
                                    style={{ width: '100%', padding: '0.7rem 1rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none' }} 
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#4a5568', marginBottom: '0.4rem' }}>
                                    كلمة مرور جديدة <span style={{ fontSize: '0.8rem', color: '#a0aec0' }}>(اتركها فارغة إذا لم ترغب في التغيير)</span>
                                </label>
                                <input 
                                    type="password" 
                                    name="password"
                                    value={formData.password} 
                                    onChange={handleInputChange}
                                    placeholder="••••••••"
                                    style={{ width: '100%', padding: '0.7rem 1rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none' }} 
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#4a5568', marginBottom: '0.4rem' }}>
                                    حالة الحساب
                                </label>
                                <select 
                                    name="is_active"
                                    value={formData.is_active ? 'true' : 'false'}
                                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.value === 'true' }))}
                                    disabled={user.username === 'manager'}
                                    style={{ width: '100%', padding: '0.7rem 1rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', background: '#fff' }}
                                >
                                    <option value="true">نشط</option>
                                    <option value="false">معطل</option>
                                </select>
                            </div>
                        </div>

                        {/* Readonly Account Meta */}
                        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '2rem', flexWrap: 'wrap', color: '#718096', fontSize: '0.85rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <CalendarBlank size={16} />
                                <span>تاريخ التسجيل: <strong>{formattedCreatedAt}</strong></span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Clock size={16} />
                                <span>آخر تسجيل دخول: <strong>{formattedLastLogin}</strong></span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <IdentificationCard size={16} />
                                <span>المعرّف الفريد: <code style={{ fontSize: '0.8rem' }}>{user.id}</code></span>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: Roles & Center Assignment */}
                    <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem', color: '#133315', fontWeight: 800, fontSize: '1.1rem' }}>
                            <ShieldCheck size={22} color="#558b2f" weight="bold" />
                            <span>2. الصلاحيات وإسناد المركز</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#4a5568', marginBottom: '0.4rem' }}>
                                    المركز التابع له
                                </label>
                                <select 
                                    name="center_id"
                                    value={formData.center_id}
                                    onChange={handleInputChange}
                                    style={{ width: '100%', padding: '0.7rem 1rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', background: '#fff' }}
                                >
                                    <option value="">-- بدون مركز محدد --</option>
                                    {centers.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#4a5568', marginBottom: '0.4rem' }}>
                                    الأدوار (إسناد متعدد) <span style={{ color: '#e53e3e' }}>*</span>
                                </label>

                                {/* Selected Roles Container */}
                                <div style={{ 
                                    display: 'flex', 
                                    flexWrap: 'wrap', 
                                    gap: '0.5rem', 
                                    padding: '0.6rem', 
                                    border: '1px solid #cbd5e0', 
                                    borderRadius: '8px', 
                                    minHeight: '48px', 
                                    alignItems: 'center',
                                    background: '#fff'
                                }}>
                                    {formData.roles.map((rVal) => {
                                        const roleObj = ALL_ROLES.find(r => r.value === rVal) || { label: rVal, bg: '#edf2f7', color: '#2d3748' };
                                        return (
                                            <div 
                                                key={rVal}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.4rem',
                                                    background: roleObj.bg,
                                                    color: roleObj.color,
                                                    border: `1px solid ${roleObj.color}40`,
                                                    padding: '0.35rem 0.8rem',
                                                    borderRadius: '16px',
                                                    fontSize: '0.88rem',
                                                    fontWeight: '700'
                                                }}
                                            >
                                                <span>{roleObj.label}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveRole(rVal)}
                                                    title="إزالة الدور"
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: roleObj.color,
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        padding: 0
                                                    }}
                                                >
                                                    <X size={13} weight="bold" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Add Additional Role */}
                                {availableRolesToAdd.length > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.82rem', color: '#718096' }}>إضافة دور:</span>
                                        {availableRolesToAdd.map(rObj => (
                                            <button
                                                key={rObj.value}
                                                type="button"
                                                onClick={() => handleAddRole(rObj.value)}
                                                style={{
                                                    background: '#fff',
                                                    border: '1px dashed #cbd5e0',
                                                    color: '#4a5568',
                                                    padding: '0.25rem 0.7rem',
                                                    borderRadius: '12px',
                                                    fontSize: '0.82rem',
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.3rem'
                                                }}
                                            >
                                                <Plus size={11} weight="bold" />
                                                <span>{rObj.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* SECTION 3: Contact & Geographic Location */}
                    <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem', color: '#133315', fontWeight: 800, fontSize: '1.1rem' }}>
                            <Phone size={22} color="#558b2f" weight="bold" />
                            <span>3. بيانات الاتصال والموقع الجغرافي</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#4a5568', marginBottom: '0.4rem' }}>
                                    رقم الهاتف الشخصي
                                </label>
                                <input 
                                    type="tel" 
                                    name="phone"
                                    value={formData.phone} 
                                    onChange={handleInputChange}
                                    placeholder="05XXXXXXXX"
                                    style={{ width: '100%', padding: '0.7rem 1rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none' }} 
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#4a5568', marginBottom: '0.4rem' }}>
                                    خط العرض الجغرافي (Latitude)
                                </label>
                                <input 
                                    type="number" 
                                    step="any"
                                    name="latitude"
                                    value={formData.latitude} 
                                    onChange={handleInputChange}
                                    placeholder="مثال: 24.7136"
                                    style={{ width: '100%', padding: '0.7rem 1rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none' }} 
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#4a5568', marginBottom: '0.4rem' }}>
                                    خط الطول الجغرافي (Longitude)
                                </label>
                                <input 
                                    type="number" 
                                    step="any"
                                    name="longitude"
                                    value={formData.longitude} 
                                    onChange={handleInputChange}
                                    placeholder="مثال: 46.6753"
                                    style={{ width: '100%', padding: '0.7rem 1rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none' }} 
                                />
                            </div>
                        </div>
                    </div>

                    {/* SECTION 4: Family & Guardian - Shown ONLY for Student Role */}
                    {formData.roles?.includes('STUDENT') && (
                        <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem', color: '#133315', fontWeight: 800, fontSize: '1.1rem' }}>
                                <UsersThree size={22} color="#558b2f" weight="bold" />
                                <span>4. بيانات الأسرة والوصاية</span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#4a5568', marginBottom: '0.4rem' }}>
                                        نوع ولي الأمر المعتمد
                                    </label>
                                    <select 
                                        name="guardian_type"
                                        value={formData.guardian_type} 
                                        onChange={handleInputChange}
                                        style={{ width: '100%', padding: '0.7rem 1rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', background: '#fff' }}
                                    >
                                        <option value="FATHER">الأب</option>
                                        <option value="MOTHER">الأم</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#4a5568', marginBottom: '0.4rem' }}>
                                        حالة اليتم
                                    </label>
                                    <select 
                                        name="orphan_status"
                                        value={formData.orphan_status} 
                                        onChange={handleInputChange}
                                        style={{ width: '100%', padding: '0.7rem 1rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', background: '#fff' }}
                                    >
                                        {ORPHAN_CHOICES.map(c => (
                                            <option key={c.value} value={c.value}>{c.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#4a5568', marginBottom: '0.4rem' }}>
                                        اسم الأب
                                    </label>
                                    <input 
                                        type="text" 
                                        name="father_name"
                                        value={formData.father_name} 
                                        onChange={handleInputChange}
                                        placeholder="اسم الأب"
                                        style={{ width: '100%', padding: '0.7rem 1rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none' }} 
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#4a5568', marginBottom: '0.4rem' }}>
                                        هاتف الأب
                                    </label>
                                    <input 
                                        type="tel" 
                                        name="father_phone"
                                        value={formData.father_phone} 
                                        onChange={handleInputChange}
                                        placeholder="05XXXXXXXX"
                                        style={{ width: '100%', padding: '0.7rem 1rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none' }} 
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#4a5568', marginBottom: '0.4rem' }}>
                                        اسم الأم {formData.guardian_type === 'MOTHER' && <span style={{ color: '#e53e3e' }}>*</span>}
                                    </label>
                                    <input 
                                        type="text" 
                                        name="mother_name"
                                        value={formData.mother_name} 
                                        onChange={handleInputChange}
                                        placeholder="اسم الأم"
                                        style={{ width: '100%', padding: '0.7rem 1rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none' }} 
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#4a5568', marginBottom: '0.4rem' }}>
                                        كنية الأم {formData.guardian_type === 'MOTHER' && <span style={{ color: '#e53e3e' }}>*</span>}
                                    </label>
                                    <input 
                                        type="text" 
                                        name="mother_last_name"
                                        value={formData.mother_last_name} 
                                        onChange={handleInputChange}
                                        placeholder="كنية الأم"
                                        style={{ width: '100%', padding: '0.7rem 1rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none' }} 
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#4a5568', marginBottom: '0.4rem' }}>
                                        هاتف الأم
                                    </label>
                                    <input 
                                        type="tel" 
                                        name="mother_phone"
                                        value={formData.mother_phone} 
                                        onChange={handleInputChange}
                                        placeholder="05XXXXXXXX"
                                        style={{ width: '100%', padding: '0.7rem 1rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none' }} 
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#4a5568', marginBottom: '0.4rem' }}>
                                        حساب ولي الأمر المرتبط
                                    </label>
                                    <div style={{ 
                                        padding: '0.7rem 1rem', 
                                        background: '#edf2f7', 
                                        borderRadius: '8px', 
                                        border: '1px solid #cbd5e0', 
                                        color: '#4a5568', 
                                        fontSize: '0.95rem' 
                                    }}>
                                        {user.parent_user_name ? (
                                            <span style={{ fontWeight: 600, color: '#2b6cb0' }}>{user.parent_user_name}</span>
                                        ) : (
                                            <span style={{ color: '#a0aec0' }}>لا يوجد حساب مرتبط</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SECTION 5: Socio-economic, Health & Academic */}
                    <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem', color: '#133315', fontWeight: 800, fontSize: '1.1rem' }}>
                            <BookOpen size={22} color="#558b2f" weight="bold" />
                            <span>5. البيانات الاجتماعية والصحية والتعليمية</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#4a5568', marginBottom: '0.4rem' }}>
                                    الدخل الشهري للأسرة (ريال)
                                </label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    name="monthly_income"
                                    value={formData.monthly_income} 
                                    onChange={handleInputChange}
                                    placeholder="مثال: 5000"
                                    style={{ width: '100%', padding: '0.7rem 1rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none' }} 
                                />
                            </div>



                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#4a5568', marginBottom: '0.4rem' }}>
                                    الحالة الصحية والملاحظات المرضية
                                </label>
                                <textarea 
                                    name="health_status"
                                    rows="2"
                                    value={formData.health_status} 
                                    onChange={handleInputChange}
                                    placeholder="أي حالات خاصة أو ملاحظات صحية..."
                                    style={{ width: '100%', padding: '0.7rem 1rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', resize: 'vertical' }} 
                                ></textarea>
                            </div>
                        </div>

                        {/* Enrollments if any */}
                        {user.enrollments && user.enrollments.length > 0 && (
                            <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
                                <h4 style={{ margin: '0 0 0.8rem 0', fontSize: '0.95rem', color: '#2d3748', fontWeight: 700 }}>
                                    الحلقات والمشاريع المسجل بها الطالب ({user.enrollments.length}):
                                </h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                                    {user.enrollments.map(en => (
                                        <div key={en.enrollment_id} style={{
                                            background: '#fff',
                                            border: '1px solid #cbd5e0',
                                            borderRadius: '10px',
                                            padding: '0.6rem 1rem',
                                            fontSize: '0.88rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem'
                                        }}>
                                            <span style={{ fontWeight: 700, color: '#2b6cb0' }}>{en.halaqa_name || 'حلقة'}</span>
                                            <span style={{ color: '#a0aec0' }}>|</span>
                                            <span style={{ color: '#4a5568' }}>{en.project_title || 'مشروع'}</span>
                                            <span style={{ color: '#a0aec0' }}>|</span>
                                            <span style={{ color: '#718096' }}>صفحة: {en.reached_page}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                </div>

                {/* Bottom Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid #edf2f7', paddingTop: '1.5rem' }}>
                    <button 
                        onClick={() => navigate(`${basePath}/users`)}
                        style={{ background: '#fff', color: '#718096', border: '1px solid #cbd5e0', padding: '0.7rem 2rem', borderRadius: '10px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                        إلغاء والعودة
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={saving}
                        style={{ 
                            background: '#558b2f', 
                            color: '#fff', 
                            border: 'none', 
                            padding: '0.7rem 2.5rem', 
                            borderRadius: '10px', 
                            fontSize: '1rem', 
                            fontWeight: 'bold', 
                            cursor: saving ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 2px 6px rgba(85, 139, 47, 0.3)'
                        }}
                    >
                        <Check size={18} weight="bold" />
                        <span>{saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
                    </button>
                </div>

            </div>

        </div>
    );
};

export default UserDetail;
