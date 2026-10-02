import React, { useState, useEffect } from 'react';
import { getCurrentUser } from '../../services/api/userService';
import { 
    User, Phone, Envelope, MapPin, 
    BookOpen, IdentificationCard, Heartbeat,
    CurrencyDollar, MapTrifold, Books, 
    UsersThree, Bank, LockKey
} from '@phosphor-icons/react';
import ChangePasswordModal from '../../component/common/ChangePasswordModal';
import './ProfilePage.css';

const ROLE_LABELS = {
    STUDENT: 'طالب',
    TEACHER: 'معلم',
    CENTER_MANAGER: 'مدير مركز',
    TENANT_ADMIN: 'مدير نظام',
    PARENT: 'ولي أمر',
    SUPER_ADMIN: 'مدير خارق'
};

const ProfilePage = () => {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            setLoading(true);
            const res = await getCurrentUser();
            if (res && res.data) {
                setProfile(res.data);
            } else {
                setError('لم يتم العثور على بيانات الملف الشخصي.');
            }
        } catch (err) {
            console.error('Error fetching profile', err);
            setError('حدث خطأ أثناء جلب بيانات الملف الشخصي.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="profile-loading-container">
                <div className="profile-spinner"></div>
                <p>جاري تحميل البيانات...</p>
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="profile-error-container">
                <p className="profile-error-text">{error || 'حدث خطأ غير متوقع.'}</p>
                <button onClick={fetchProfile} className="btn-retry">إعادة المحاولة</button>
            </div>
        );
    }

    const {
        first_name, last_name, username, roles, role,
        center_name, enrollments, ...otherData
    } = profile;

    const primaryRole = role || (roles && roles[0]) || 'STUDENT';
    const activeRoleLabel = ROLE_LABELS[primaryRole] || primaryRole;

    // قاموس لترجمة الحقول المتوقعة والجديدة
    const fieldTranslations = {
        email: 'البريد الإلكتروني',
        phone: 'رقم الهاتف',
        health_status: 'الحالة الصحية',
        monthly_income: 'الدخل الشهري',
        father_name: 'اسم الأب',
        father_phone: 'هاتف الأب',
        mother_name: 'اسم الأم',
        mother_phone: 'هاتف الأم',
        mother_last_name: 'كنية الأم',
        guardian_type: 'نوع ولي الأمر',
        orphan_status: 'حالة اليتيم',
        national_id: 'رقم الهوية',
        birth_date: 'تاريخ الميلاد',
        gender: 'الجنس',
        registration_number: 'رقم التسجيل',
        current_residence: 'مكان الإقامة الحالي',
        points: 'النقاط',
        rating: 'التقييم',
        is_orphan: 'يتيم',
        has_special_needs: 'ذوي احتياجات خاصة',
        special_needs_notes: 'ملاحظات الاحتياجات الخاصة',
        income_level: 'مستوى الدخل',
        general_notes: 'ملاحظات عامة',
        parent_email: 'البريد الإلكتروني لولي الأمر',
        parent_user_name: 'اسم حساب ولي الأمر'
    };

    const formatKey = (key) => {
        if (fieldTranslations[key]) return fieldTranslations[key];
        // تحويل الحقول غير المعروفة إلى شكل مقروء (مثال: birth_date -> Birth Date)
        return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    const formatValue = (val) => {
        if (val === null || val === undefined || val === '') return <span className="text-muted">غير متوفر</span>;
        if (typeof val === 'boolean') return val ? 'نعم' : 'لا';
        return val;
    };

    // استثناء الحقول التقنية والداخلية
    const excludeKeys = ['latitude', 'longitude', 'reached_page', 'parent_user_id'];
    const displayFields = Object.entries(otherData).filter(([key, val]) => !excludeKeys.includes(key) && val !== null && val !== undefined && val !== '');

    return (
        <div className="profile-page-wrapper">
            {/* Header Banner */}
            <div className="profile-header-banner">
                <div className="profile-header-content">
                    <div className="profile-avatar">
                        <User size={64} color="#ffffff" weight="fill" />
                    </div>
                    <div className="profile-titles">
                        <h1 className="profile-name">{first_name || ''} {last_name || ''}</h1>
                        <p className="profile-username">@{username}</p>
                        <div className="profile-badges">
                            {roles && roles.map(r => (
                                <span key={r} className={`profile-badge badge-${r.toLowerCase()}`}>
                                    {ROLE_LABELS[r] || r}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="profile-actions" style={{ marginTop: '1rem' }}>
                        <button className="btn-secondary" onClick={() => setIsPasswordModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>
                            <LockKey size={20} />
                            تغيير كلمة المرور
                        </button>
                    </div>
                </div>
            </div>

            <div className="profile-body-grid">
                {/* Dynamic Personal Information */}
                <div className="profile-card personal-info-card" style={{ gridColumn: '1 / -1' }}>
                    <h2 className="profile-card-title">
                        <IdentificationCard size={24} />
                        بيانات الملف الشخصي
                    </h2>

                    <div className="profile-info-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                        <div className="profile-info-item">
                            <span className="info-label">الاسم الكامل</span>
                            <span className="info-value">{(first_name || '') + ' ' + (last_name || '')}</span>
                        </div>
                        <div className="profile-info-item">
                            <span className="info-label">اسم المستخدم</span>
                            <span className="info-value">@{username}</span>
                        </div>
                        <div className="profile-info-item">
                            <span className="info-label">البريد الإلكتروني</span>
                            <span className="info-value">{formatValue(otherData.email)}</span>
                        </div>
                        <div className="profile-info-item">
                            <span className="info-label">رقم الهاتف</span>
                            <span className="info-value">{formatValue(otherData.phone)}</span>
                        </div>
                        {center_name && (
                            <div className="profile-info-item">
                                <span className="info-label"><Bank size={18}/> المركز</span>
                                <span className="info-value">{center_name}</span>
                            </div>
                        )}
                        {displayFields.length > 0 && displayFields.filter(([k]) => k !== 'email' && k !== 'phone').map(([key, val]) => (
                            <div className="profile-info-item" key={key}>
                                <span className="info-label">{formatKey(key)}</span>
                                <span className="info-value">{formatValue(val)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Academic/Service Information */}
                {primaryRole === 'STUDENT' && enrollments && enrollments.length > 0 && (
                    <div className="profile-card enrollments-card" style={{ gridColumn: '1 / -1' }}>
                        <h2 className="profile-card-title">
                            <Books size={24} />
                            الحلقات والمشاريع
                        </h2>
                        <div className="enrollments-list">
                            {enrollments.map(en => (
                                <div key={en.enrollment_id} className="enrollment-item">
                                    <div className="en-header">
                                        <BookOpen size={20} className="en-icon" />
                                        <span className="en-project">{en.project_title || 'مشروع غير محدد'}</span>
                                    </div>
                                    <div className="en-details">
                                        <div className="en-detail">
                                            <span className="en-lbl">الحلقة:</span>
                                            <span className="en-val">{en.halaqa_name || 'غير متوفر'}</span>
                                        </div>
                                        <div className="en-detail">
                                            <span className="en-lbl">المرحلة:</span>
                                            <span className="en-val">{en.stage_title || 'غير متوفر'}</span>
                                        </div>
                                        <div className="en-detail">
                                            <span className="en-lbl">صفحة الوصول:</span>
                                            <span className="en-val">{en.reached_page || 1}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <ChangePasswordModal 
                isOpen={isPasswordModalOpen} 
                onClose={() => setIsPasswordModalOpen(false)} 
            />
        </div>
    );
};

export default ProfilePage;
