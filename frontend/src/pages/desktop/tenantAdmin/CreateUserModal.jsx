import React, { useState } from 'react';
import { 
    X, User, Phone, UsersThree, BookOpen, 
    ShieldCheck, Check, WarningCircle, Plus, Info
} from '@phosphor-icons/react';
import { createUser } from '../../../services/api/userService';

const ALL_ROLES = [
    { value: 'STUDENT', label: 'طالب', color: '#2b6cb0', bg: '#ebf8ff' },
    { value: 'TEACHER', label: 'معلم', color: '#c05621', bg: '#fffaf0' },
    { value: 'CENTER_MANAGER', label: 'مدير مركز', color: '#276749', bg: '#f0fff4' },
    { value: 'TENANT_ADMIN', label: 'مدير نظام', color: '#6b46c1', bg: '#faf5ff' },
    { value: 'PARENT', label: 'ولي أمر', color: '#9b2c2c', bg: '#fff5f5' },
];

const ORPHAN_CHOICES = [
    { value: '', label: 'سليم الأبوين (غير يتيم)' },
    { value: 'f', label: 'يتيم الأب' },
    { value: 'm', label: 'يتيم الأم' },
    { value: 't', label: 'يتيم الأبوين (الاثنين)' },
];

const CreateUserModal = ({ isOpen, onClose, onUserCreated, centers = [] }) => {
    const initialFormState = {
        first_name: '',
        last_name: '',
        username: '',
        email: '',
        password: '',
        is_active: true,
        roles: ['STUDENT'],
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
    };

    const [formData, setFormData] = useState(initialFormState);
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [parentWarning, setParentWarning] = useState(null);

    if (!isOpen) return null;

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        if (errorMessage) setErrorMessage('');
    };

    const handleAddRole = (roleVal) => {
        if (!formData.roles.includes(roleVal)) {
            setFormData(prev => ({
                ...prev,
                roles: [...prev.roles, roleVal]
            }));
        }
    };

    const handleRemoveRole = (roleVal) => {
        if (formData.roles.length <= 1) {
            setErrorMessage('يجب اختيار دور واحد على الأقل للمستخدم');
            return;
        }
        setFormData(prev => ({
            ...prev,
            roles: prev.roles.filter(r => r !== roleVal)
        }));
        setErrorMessage('');
    };

    const validateForm = () => {
        if (!formData.first_name.trim()) {
            return 'الاسم الأول مطلوب';
        }
        if (!formData.last_name.trim()) {
            return 'اسم العائلة (الكنية) مطلوب';
        }
        if (!formData.password) {
            return 'كلمة المرور مطلوبة';
        }
        if (formData.password.length < 6) {
            return 'يجب أن لا تقل كلمة المرور عن 6 أحرف';
        }
        if (!formData.roles || formData.roles.length === 0) {
            return 'يجب اختيار دور واحد على الأقل للمستخدم';
        }
        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            return 'صيغة البريد الإلكتروني غير صحيحة';
        }
        if (formData.roles.includes('STUDENT') && formData.guardian_type === 'MOTHER') {
            if (!formData.mother_name.trim() || !formData.mother_last_name.trim()) {
                return 'عذراً، لا يمكن اختيار الأم كولي أمر إلا في حال إدخال اسم الأم وكنيتها';
            }
        }
        if (formData.reached_page) {
            const pageNum = parseInt(formData.reached_page, 10);
            if (isNaN(pageNum) || pageNum < 1 || pageNum > 604) {
                return 'صفحة الوصول يجب أن تكون رقماً بين 1 و 604';
            }
        }
        return null;
    };

    const handleSubmit = async (e, parentDecision = null) => {
        if (e && e.preventDefault) e.preventDefault();
        setErrorMessage('');

        const validationErr = validateForm();
        if (validationErr) {
            setErrorMessage(validationErr);
            return;
        }

        try {
            setSubmitting(true);

            const payload = {
                first_name: formData.first_name.trim(),
                last_name: formData.last_name.trim(),
                username: formData.username.trim() || undefined,
                password: formData.password,
                email: formData.email.trim() || undefined,
                is_active: formData.is_active,
                roles: formData.roles,
                role: formData.roles[0],
                center_id: formData.center_id || undefined,
                phone: formData.phone.trim() || undefined,
                latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
                longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
                guardian_type: formData.guardian_type,
                father_name: formData.father_name.trim() || undefined,
                father_phone: formData.father_phone.trim() || undefined,
                mother_name: formData.mother_name.trim() || undefined,
                mother_last_name: formData.mother_last_name.trim() || undefined,
                mother_phone: formData.mother_phone.trim() || undefined,
                orphan_status: formData.orphan_status || undefined,
                monthly_income: formData.monthly_income ? parseFloat(formData.monthly_income) : undefined,
                health_status: formData.health_status.trim() || undefined,
                reached_page: formData.reached_page ? parseInt(formData.reached_page, 10) : 1,
            };

            if (parentDecision?.existing_parent_id) {
                payload.existing_parent_id = parentDecision.existing_parent_id;
            } else if (parentDecision?.create_new_parent) {
                payload.create_new_parent = true;
            }

            const response = await createUser(payload);

            if (response.status === 'warning_parent_exists') {
                setParentWarning(response);
                setSubmitting(false);
                return;
            }

            setFormData(initialFormState);
            setParentWarning(null);
            if (onUserCreated) onUserCreated(response.data || response);
            onClose();
        } catch (error) {
            console.error('Error creating user:', error);
            const resData = error.response?.data;
            if (resData?.status === 'warning_parent_exists') {
                setParentWarning(resData);
            } else {
                setErrorMessage(resData?.message || resData?.details || 'حدث خطأ أثناء إنشاء المستخدم. يرجى مراجعة البيانات.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleResolveParentConfirmation = (decision) => {
        if (decision === 'link') {
            handleSubmit(null, { existing_parent_id: parentWarning.existing_parent.id });
        } else if (decision === 'new') {
            handleSubmit(null, { create_new_parent: true });
        }
    };

    const availableRolesToAdd = ALL_ROLES.filter(r => !formData.roles.includes(r.value));

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1.5rem',
            direction: 'rtl'
        }}>
            <div style={{
                background: '#ffffff',
                borderRadius: '20px',
                width: '100%',
                maxWidth: '920px',
                maxHeight: '92vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                border: '1px solid #e2e8f0',
                overflow: 'hidden'
            }}>
                {/* Modal Header */}
                <div style={{
                    padding: '1.25rem 2rem',
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
                            borderRadius: '12px',
                            background: '#e8f5e9',
                            color: '#2e7d32',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Plus size={22} weight="bold" />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#133315' }}>
                                إضافة مستخدم جديد
                            </h2>
                            <p style={{ margin: 0, fontSize: '0.88rem', color: '#718096' }}>
                                إدخال كافة خصائص وبيانات حساب المستخدم في النظام
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: '#edf2f7',
                            border: 'none',
                            borderRadius: '50%',
                            width: '36px',
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#4a5568',
                            transition: 'all 0.2s'
                        }}
                    >
                        <X size={18} weight="bold" />
                    </button>
                </div>

                {/* Modal Body */}
                <div style={{ padding: '1.75rem 2rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                    
                    {/* Error Banner */}
                    {errorMessage && (
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
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {/* Parent Exists Confirmation Dialog */}
                    {parentWarning && (
                        <div style={{
                            background: '#fffaf0',
                            border: '1.5px solid #dd6b20',
                            borderRadius: '12px',
                            padding: '1.25rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.9rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', color: '#c05621' }}>
                                <Info size={24} weight="fill" style={{ flexShrink: 0, marginTop: '2px' }} />
                                <div>
                                    <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '1rem', fontWeight: 800 }}>تنبيه بخصوص ولي الأمر</h4>
                                    <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.5, color: '#744210' }}>
                                        {parentWarning.message}
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    onClick={() => handleResolveParentConfirmation('link')}
                                    disabled={submitting}
                                    style={{
                                        background: '#2b6cb0',
                                        color: '#ffffff',
                                        border: 'none',
                                        padding: '0.55rem 1.25rem',
                                        borderRadius: '8px',
                                        fontWeight: 600,
                                        fontSize: '0.9rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    ربط الطالب بحساب ({parentWarning.existing_parent?.full_name || 'ولي الأمر الحالي'})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleResolveParentConfirmation('new')}
                                    disabled={submitting}
                                    style={{
                                        background: '#fff',
                                        color: '#c05621',
                                        border: '1px solid #c05621',
                                        padding: '0.55rem 1.25rem',
                                        borderRadius: '8px',
                                        fontWeight: 600,
                                        fontSize: '0.9rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    إنشاء حساب ولي أمر جديد
                                </button>
                            </div>
                        </div>
                    )}

                    <form id="create-user-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                        
                        {/* Section 1: Account Information */}
                        <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: '#133315', fontWeight: 700, fontSize: '1.05rem' }}>
                                <User size={20} color="#558b2f" weight="bold" />
                                <span>بيانات الحساب الأساسية</span>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.4rem' }}>
                                        الاسم الأول <span style={{ color: '#e53e3e' }}>*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="first_name"
                                        placeholder="مثال: أحمد"
                                        value={formData.first_name}
                                        onChange={handleInputChange}
                                        required
                                        style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.92rem', outline: 'none' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.4rem' }}>
                                        اسم العائلة (الكنية) <span style={{ color: '#e53e3e' }}>*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="last_name"
                                        placeholder="مثال: القحطاني"
                                        value={formData.last_name}
                                        onChange={handleInputChange}
                                        required
                                        style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.92rem', outline: 'none' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.4rem' }}>
                                        اسم المستخدم <span style={{ fontSize: '0.78rem', color: '#a0aec0' }}>(اختياري، يولد تلقائياً)</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="username"
                                        placeholder="مثال: ahmed_q"
                                        value={formData.username}
                                        onChange={handleInputChange}
                                        style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.92rem', outline: 'none' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.4rem' }}>
                                        كلمة المرور <span style={{ color: '#e53e3e' }}>*</span>
                                    </label>
                                    <input
                                        type="password"
                                        name="password"
                                        placeholder="******"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                        required
                                        style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.92rem', outline: 'none' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.4rem' }}>
                                        البريد الإلكتروني
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        placeholder="user@example.com"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.92rem', outline: 'none' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.4rem' }}>
                                        حالة الحساب
                                    </label>
                                    <select
                                        name="is_active"
                                        value={formData.is_active ? 'true' : 'false'}
                                        onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.value === 'true' }))}
                                        style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.92rem', outline: 'none', background: '#fff' }}
                                    >
                                        <option value="true">نشط</option>
                                        <option value="false">معطل</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Roles & Center */}
                        <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: '#133315', fontWeight: 700, fontSize: '1.05rem' }}>
                                <ShieldCheck size={20} color="#558b2f" weight="bold" />
                                <span>الأدوار والمركز التابع له</span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.5rem' }}>
                                        الأدوار المسندة للمستخدم <span style={{ color: '#e53e3e' }}>*</span>
                                    </label>
                                    
                                    {/* Selected Roles Chips */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', minHeight: '40px', padding: '0.5rem', background: '#fff', border: '1px solid #cbd5e0', borderRadius: '8px' }}>
                                        {formData.roles.map(rVal => {
                                            const rObj = ALL_ROLES.find(r => r.value === rVal) || { label: rVal, color: '#4a5568', bg: '#edf2f7' };
                                            return (
                                                <div key={rVal} style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.4rem',
                                                    background: rObj.bg,
                                                    color: rObj.color,
                                                    border: `1px solid ${rObj.color}40`,
                                                    padding: '0.3rem 0.75rem',
                                                    borderRadius: '16px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 600
                                                }}>
                                                    <span>{rObj.label}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveRole(rVal)}
                                                        style={{ background: 'transparent', border: 'none', color: rObj.color, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                                                    >
                                                        <X size={12} weight="bold" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Add Role Pills */}
                                    {availableRolesToAdd.length > 0 && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
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
                                                        padding: '0.25rem 0.65rem',
                                                        borderRadius: '12px',
                                                        fontSize: '0.8rem',
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.25rem'
                                                    }}
                                                >
                                                    <Plus size={10} weight="bold" />
                                                    {rObj.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.4rem' }}>
                                        المركز القرآني
                                    </label>
                                    <select
                                        name="center_id"
                                        value={formData.center_id}
                                        onChange={handleInputChange}
                                        style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.92rem', outline: 'none', background: '#fff' }}
                                    >
                                        <option value="">-- بدون مركز محدد --</option>
                                        {centers.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Contact & Location */}
                        <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: '#133315', fontWeight: 700, fontSize: '1.05rem' }}>
                                <Phone size={20} color="#558b2f" weight="bold" />
                                <span>الاتصال والموقع الجغرافي</span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.4rem' }}>
                                        رقم الهاتف الأساسي
                                    </label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        placeholder="05XXXXXXXX"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.92rem', outline: 'none' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.4rem' }}>
                                        خط العرض (Latitude)
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        name="latitude"
                                        placeholder="مثال: 24.7136"
                                        value={formData.latitude}
                                        onChange={handleInputChange}
                                        style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.92rem', outline: 'none' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.4rem' }}>
                                        خط الطول (Longitude)
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        name="longitude"
                                        placeholder="مثال: 46.6753"
                                        value={formData.longitude}
                                        onChange={handleInputChange}
                                        style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.92rem', outline: 'none' }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 4: Family & Guardian Information - Shown ONLY for Student Role */}
                        {formData.roles?.includes('STUDENT') && (
                            <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: '#133315', fontWeight: 700, fontSize: '1.05rem' }}>
                                    <UsersThree size={20} color="#558b2f" weight="bold" />
                                    <span>بيانات الأسرة وولي الأمر</span>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.4rem' }}>
                                            نوع ولي الأمر المعتمد
                                        </label>
                                        <select
                                            name="guardian_type"
                                            value={formData.guardian_type}
                                            onChange={handleInputChange}
                                            style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.92rem', outline: 'none', background: '#fff' }}
                                        >
                                            <option value="FATHER">الأب</option>
                                            <option value="MOTHER">الأم</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.4rem' }}>
                                            حالة اليتم
                                        </label>
                                        <select
                                            name="orphan_status"
                                            value={formData.orphan_status}
                                            onChange={handleInputChange}
                                            style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.92rem', outline: 'none', background: '#fff' }}
                                        >
                                            {ORPHAN_CHOICES.map(c => (
                                                <option key={c.value} value={c.value}>{c.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.4rem' }}>
                                            اسم الأب
                                        </label>
                                        <input
                                            type="text"
                                            name="father_name"
                                            placeholder="اسم الأب الكامل"
                                            value={formData.father_name}
                                            onChange={handleInputChange}
                                            style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.92rem', outline: 'none' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.4rem' }}>
                                            هاتف الأب
                                        </label>
                                        <input
                                            type="tel"
                                            name="father_phone"
                                            placeholder="05XXXXXXXX"
                                            value={formData.father_phone}
                                            onChange={handleInputChange}
                                            style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.92rem', outline: 'none' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.4rem' }}>
                                            اسم الأم {formData.guardian_type === 'MOTHER' && <span style={{ color: '#e53e3e' }}>*</span>}
                                        </label>
                                        <input
                                            type="text"
                                            name="mother_name"
                                            placeholder="اسم الأم"
                                            value={formData.mother_name}
                                            onChange={handleInputChange}
                                            style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.92rem', outline: 'none' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.4rem' }}>
                                            كنية الأم {formData.guardian_type === 'MOTHER' && <span style={{ color: '#e53e3e' }}>*</span>}
                                        </label>
                                        <input
                                            type="text"
                                            name="mother_last_name"
                                            placeholder="كنية عائلة الأم"
                                            value={formData.mother_last_name}
                                            onChange={handleInputChange}
                                            style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.92rem', outline: 'none' }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.4rem' }}>
                                            هاتف الأم
                                        </label>
                                        <input
                                            type="tel"
                                            name="mother_phone"
                                            placeholder="05XXXXXXXX"
                                            value={formData.mother_phone}
                                            onChange={handleInputChange}
                                            style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.92rem', outline: 'none' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Section 5: Socio-economic, Health & Academic */}
                        <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: '#133315', fontWeight: 700, fontSize: '1.05rem' }}>
                                <BookOpen size={20} color="#558b2f" weight="bold" />
                                <span>البيانات الاجتماعية والصحية والتعليمية</span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.4rem' }}>
                                        الدخل الشهري (ريال)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        name="monthly_income"
                                        placeholder="مثال: 5000"
                                        value={formData.monthly_income}
                                        onChange={handleInputChange}
                                        style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.92rem', outline: 'none' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.4rem' }}>
                                        رقم صفحة المصحف الحالية (الإنجاز)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="604"
                                        name="reached_page"
                                        placeholder="1"
                                        value={formData.reached_page}
                                        onChange={handleInputChange}
                                        style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.92rem', outline: 'none' }}
                                    />
                                </div>

                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#4a5568', marginBottom: '0.4rem' }}>
                                        الحالة الصحية أو ملاحظات مرضية
                                    </label>
                                    <textarea
                                        name="health_status"
                                        rows="2"
                                        placeholder="أي حالات خاصة أو ملاحظات صحية هامة..."
                                        value={formData.health_status}
                                        onChange={handleInputChange}
                                        style={{ width: '100%', padding: '0.65rem 0.9rem', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.92rem', outline: 'none', resize: 'vertical' }}
                                    ></textarea>
                                </div>
                            </div>
                        </div>

                    </form>
                </div>

                {/* Modal Footer */}
                <div style={{
                    padding: '1.25rem 2rem',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '1rem',
                    background: '#f8fafc'
                }}>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        style={{
                            background: '#fff',
                            color: '#718096',
                            border: '1px solid #cbd5e0',
                            padding: '0.65rem 1.8rem',
                            borderRadius: '8px',
                            fontWeight: 600,
                            fontSize: '0.95rem',
                            cursor: 'pointer'
                        }}
                    >
                        إلغاء
                    </button>
                    <button
                        type="submit"
                        form="create-user-form"
                        disabled={submitting}
                        style={{
                            background: '#558b2f',
                            color: '#ffffff',
                            border: 'none',
                            padding: '0.65rem 2rem',
                            borderRadius: '8px',
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            cursor: submitting ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 2px 4px rgba(85, 139, 47, 0.25)'
                        }}
                    >
                        {submitting ? 'جاري الحفظ...' : (
                            <>
                                <Check size={18} weight="bold" />
                                <span>حفظ وإنشاء المستخدم</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateUserModal;
