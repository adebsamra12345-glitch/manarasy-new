import React, { useState, useEffect } from 'react';
import {
    MagnifyingGlass, Funnel, UserCircle, Plus, CaretDown, MapPin, Bell, Check,
    Eye, PencilSimple, Trash, Phone, Envelope, Clock, X, WarningCircle, ShieldCheck
} from '@phosphor-icons/react';
import { getUsers, deleteUser } from '../../../services/api/userService';
import { getTenantList, getMosqueAdminDashboardData } from '../../../services/api/tenantService';
import { useNavigate, useLocation } from 'react-router-dom';
import CreateUserModal from './CreateUserModal';
import './usersManagement.css';

const UsersManagement = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const basePath = location.pathname.startsWith('/center-manager') ? '/center-manager' : '/admin';
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRole, setSelectedRole] = useState('all');
    const [selectedCenter, setSelectedCenter] = useState('all');
    const [centers, setCenters] = useState([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [deleteModalState, setDeleteModalState] = useState({ open: false, user: null, loading: false });

    const currentUserName = localStorage.getItem('username');
    const todayDate = new Date();
    const hijriDate = new Intl.DateTimeFormat('ar-SA', {
        calendar: 'islamic', day: 'numeric', month: 'long', year: 'numeric'
    }).format(todayDate);
    const gregorianDate = new Intl.DateTimeFormat('ar-EG', {
        day: 'numeric', month: 'long', year: 'numeric'
    }).format(todayDate);
    const weekday = new Intl.DateTimeFormat('ar-EG', { weekday: 'long' }).format(todayDate);
    const defaultDateStr = `${weekday}، ${hijriDate} | ${gregorianDate} م`;

    useEffect(() => {
        fetchCenters();
        fetchUsers();
    }, []);

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

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const data = await getUsers();
            if (data && data.data) {
                setUsers(data.data);
            }
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        setSearchQuery(e.target.value);
    };

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 4000);
    };

    const handleUserCreated = (newUser) => {
        const name = newUser?.first_name ? `${newUser.first_name} ${newUser.last_name || ''}`.trim() : '';
        showToast(name ? `تم إنشاء حساب المستخدم (${name}) بنجاح` : 'تم إنشاء المستخدم بنجاح');
        fetchUsers();
    };

    const handleConfirmDelete = async () => {
        if (!deleteModalState.user) return;
        setDeleteModalState(prev => ({ ...prev, loading: true }));
        try {
            await deleteUser(deleteModalState.user.id);
            setUsers(prev => prev.filter(u => u.id !== deleteModalState.user.id));
            showToast(`تم حذف حساب المستخدم (${deleteModalState.user.first_name || deleteModalState.user.username}) بنجاح`);
            setDeleteModalState({ open: false, user: null, loading: false });
        } catch (err) {
            console.error("Error deleting user:", err);
            alert(err.response?.data?.message || err.message || 'فشل حذف المستخدم');
            setDeleteModalState(prev => ({ ...prev, loading: false }));
        }
    };

    const getRoleName = (role) => {
        switch (role) {
            case 'TENANT_ADMIN': return 'مدير النظام';
            case 'CENTER_MANAGER': return 'مدير مركز';
            case 'TEACHER': return 'معلم';
            case 'STUDENT': return 'طالب';
            default: return role;
        }
    };

    const getRoleBadgeStyle = (role) => {
        switch (role) {
            case 'TENANT_ADMIN':
                return { background: '#f3e8ff', color: '#6b21a8', border: '1px solid #e9d5ff' };
            case 'CENTER_MANAGER':
                return { background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' };
            case 'TEACHER':
                return { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' };
            case 'STUDENT':
                return { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' };
            default:
                return { background: '#edf2f7', color: '#4a5568', border: '1px solid #cbd5e0' };
        }
    };

    const getStatusBadge = (isActive) => {
        if (isActive) {
            return <span style={{ background: '#7cb342', color: '#fff', padding: '0.25rem 0.8rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700 }}>نشط</span>;
        }
        return <span style={{ background: '#e53935', color: '#fff', padding: '0.25rem 0.8rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700 }}>معطل</span>;
    };

    const filteredUsers = users.filter(user => {
        const matchesSearch = (user.first_name + ' ' + user.last_name).toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase()));
        const userRoles = Array.isArray(user.roles) ? user.roles : [user.role];
        const matchesRole = selectedRole === 'all' || userRoles.includes(selectedRole);
        const matchesCenter = selectedCenter === 'all' || user.center_id === selectedCenter;

        return matchesSearch && matchesRole && matchesCenter;
    });

    return (
        <div className="users-management-container">
            {/* Header matches Dashboard */}
            <div className="users-header-row">
                <div className="greeting">
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#133315', margin: 0, marginBottom: '0.4rem', letterSpacing: '-0.3px' }}>
                        السلام عليكم، أ. {currentUserName}
                    </h1>
                    <p style={{ color: '#718096', fontSize: '0.9rem', margin: 0, fontWeight: 500 }}>
                        {defaultDateStr}
                    </p>
                </div>

                <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    {/* Center Filter Dropdown */}
                    <div style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '0.55rem 2.5rem 0.55rem 1.15rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer'
                    }}>
                        <select
                            value={selectedCenter}
                            onChange={(e) => setSelectedCenter(e.target.value)}
                            style={{
                                appearance: 'none', border: 'none', background: 'transparent',
                                color: '#4a5568', fontSize: '0.92rem', fontWeight: 600,
                                outline: 'none', cursor: 'pointer', width: '100%', paddingRight: '0.5rem'
                            }}
                        >
                            <option value="all"> جميع المراكز</option>
                            {centers.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        <CaretDown size={14} color="#718096" style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }} />
                        <MapPin size={18} color="#718096" style={{ position: 'absolute', right: '12px', pointerEvents: 'none' }} />
                    </div>

                    {/* Notification Bell */}
                    <button style={{
                        position: 'relative', width: '42px', height: '42px', background: '#ffffff',
                        border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)', color: '#4a5568', padding: 0
                    }}>
                        <Bell size={20} />
                        <span style={{
                            position: 'absolute', top: '8px', right: '9px', width: '8px', height: '8px',
                            backgroundColor: '#ea580c', borderRadius: '50%', border: '1.5px solid #ffffff'
                        }}></span>
                    </button>
                </div>
            </div>

            {/* Toolbar: Search, Filter & Add Button */}
            <div className="users-toolbar">
                <div className="users-search-filter-group">
                    <h2 style={{ fontSize: '1.8rem', color: '#133315', margin: 0, fontWeight: 'bold' }}>المستخدمون ({filteredUsers.length})</h2>

                    <div className="users-search-input-wrap">
                        <MagnifyingGlass size={18} color="#a0aec0" style={{ position: 'absolute', left: '1rem' }} />
                        <input
                            type="text"
                            placeholder="ابحث عن مستخدم ..."
                            value={searchQuery}
                            onChange={handleSearch}
                            style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: '0.95rem' }}
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.4rem 0.8rem' }}>
                        <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                            style={{ border: 'none', background: 'transparent', outline: 'none', color: '#4a5568', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                            <option value="all">كافة الأدوار</option>
                            <option value="TENANT_ADMIN">مدير النظام</option>
                            <option value="CENTER_MANAGER">مدير مركز</option>
                            <option value="TEACHER">معلم</option>
                            <option value="STUDENT">طالب</option>
                        </select>
                    </div>
                </div>

                <button
                    className="users-btn-add"
                    onClick={() => setIsCreateModalOpen(true)}
                    style={{ background: '#558b2f', color: '#fff', border: 'none', padding: '0.65rem 1.4rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 6px rgba(85, 139, 47, 0.25)' }}
                >
                    <Plus size={18} weight="bold" />
                    إضافة مستخدم
                </button>
            </div>

            {/* Desktop Table View (visible on screen > 768px) */}
            <div className="users-desktop-table-card">
                <table className="users-desktop-table">
                    <thead>
                        <tr style={{ background: '#f8fafc', color: '#4a5568', fontSize: '0.9rem' }}>
                            <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', width: '50px' }}>م</th>
                            <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', textAlign: 'right' }}>اسم المستخدم</th>
                            <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>البريد الإلكتروني</th>
                            <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', width: '150px' }}>الأدوار</th>
                            <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', width: '90px' }}>الحالة</th>
                            <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', width: '130px' }}>رقم الهاتف</th>
                            <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', width: '150px' }}>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: '#718096' }}>جاري التحميل...</td>
                            </tr>
                        ) : filteredUsers.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: '#718096' }}>لا يوجد مستخدمين لعرضهم</td>
                            </tr>
                        ) : (
                            filteredUsers.map((user, index) => {
                                const formattedDate = new Date(user.created_at).toLocaleDateString('ar-SA');

                                return (
                                    <tr key={user.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '0.85rem', color: '#718096' }}>{index + 1}</td>
                                        <td style={{ padding: '0.85rem 1rem', borderRight: '1px solid #f1f5f9', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{ color: '#2b6cb0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => navigate(`${basePath}/users/${user.id}`)}>
                                                    <UserCircle size={32} />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: '700', color: '#2d3748', cursor: 'pointer' }} onClick={() => navigate(`${basePath}/users/${user.id}`)}>
                                                        {user.first_name} {user.last_name}
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: '#a0aec0' }}>@{user.username}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.85rem', borderRight: '1px solid #f1f5f9', color: '#718096', fontSize: '0.9rem' }}>{user.email || '—'}</td>
                                        <td style={{ padding: '0.85rem', borderRight: '1px solid #f1f5f9' }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center' }}>
                                                {Array.from(new Set(Array.isArray(user.roles) && user.roles.length > 0 ? user.roles : [user.role])).map((r) => {
                                                    const style = getRoleBadgeStyle(r);
                                                    return (
                                                        <span key={r} style={{ ...style, padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                                                            {getRoleName(r)}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.85rem', borderRight: '1px solid #f1f5f9' }}>
                                            {getStatusBadge(user.is_active)}
                                        </td>
                                        <td style={{ padding: '0.85rem', borderRight: '1px solid #f1f5f9', color: '#4a5568', fontSize: '0.85rem' }}>
                                            {user.phone || '—'}
                                        </td>
                                        <td style={{ padding: '0.85rem', borderRight: '1px solid #f1f5f9' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                                                <button
                                                    onClick={() => navigate(`${basePath}/users/${user.id}`)}
                                                    style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '0.35rem 0.6rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', fontWeight: 600 }}
                                                    title="عرض الملف"
                                                >
                                                    <Eye size={14} /> عرض
                                                </button>
                                                <button
                                                    onClick={() => navigate(`${basePath}/users/${user.id}?edit=true`)}
                                                    style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '0.35rem 0.6rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', fontWeight: 600 }}
                                                    title="تعديل"
                                                >
                                                    <PencilSimple size={14} /> تعديل
                                                </button>
                                                <button
                                                    onClick={() => setDeleteModalState({ open: true, user, loading: false })}
                                                    style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', padding: '0.35rem 0.6rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', fontWeight: 600 }}
                                                    title="حذف"
                                                >
                                                    <Trash size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile Cards View (visible on screen <= 768px, NO horizontal scroll) */}
            <div className="users-mobile-cards-wrap">
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#558b2f' }}>جاري التحميل...</div>
                ) : filteredUsers.length === 0 ? (
                    <div style={{ background: '#fff', padding: '2rem', textAlign: 'center', borderRadius: '12px', color: '#718096' }}>
                        لا يوجد مستخدمين لعرضهم
                    </div>
                ) : (
                    filteredUsers.map((user) => {
                        const initialLetter = user.first_name ? user.first_name.charAt(0) : (user.username ? user.username.charAt(0) : 'م');
                        const roles = Array.from(new Set(Array.isArray(user.roles) && user.roles.length > 0 ? user.roles : [user.role]));
                        const formattedDate = user.created_at ? new Date(user.created_at).toLocaleDateString('ar-SA') : '—';

                        return (
                            <div key={user.id} className="user-mobile-card">
                                <div className="user-card-top">
                                    <div className="user-card-identity">
                                        <div className="user-card-avatar" onClick={() => navigate(`${basePath}/users/${user.id}`)}>
                                            {initialLetter}
                                        </div>
                                        <div className="user-card-names">
                                            <h4 className="user-card-fullname" onClick={() => navigate(`${basePath}/users/${user.id}`)}>
                                                {user.first_name} {user.last_name || ''}
                                            </h4>
                                            <span className="user-card-username">@{user.username}</span>
                                        </div>
                                    </div>
                                    <div>
                                        {getStatusBadge(user.is_active)}
                                    </div>
                                </div>

                                <div className="user-card-roles">
                                    {roles.map((r) => {
                                        const style = getRoleBadgeStyle(r);
                                        return (
                                            <span key={r} style={{ ...style, padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                                                {getRoleName(r)}
                                            </span>
                                        );
                                    })}
                                </div>

                                <div className="user-card-meta-list">
                                    {user.email && (
                                        <div className="user-card-meta-item">
                                            <Envelope size={15} color="#558b2f" />
                                            <a href={`mailto:${user.email}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                                {user.email}
                                            </a>
                                        </div>
                                    )}
                                    {user.phone && (
                                        <div className="user-card-meta-item">
                                            <Phone size={15} color="#558b2f" />
                                            <a href={`tel:${user.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                                {user.phone}
                                            </a>
                                        </div>
                                    )}
                                    <div className="user-card-meta-item">
                                        <Clock size={15} color="#718096" />
                                        <span>تاريخ الانضمام: {formattedDate}</span>
                                    </div>
                                </div>

                                <div className="user-card-actions">
                                    <button
                                        className="user-card-btn user-card-btn-view"
                                        onClick={() => navigate(`${basePath}/users/${user.id}`)}
                                    >
                                        <Eye size={16} />
                                        عرض
                                    </button>
                                    <button
                                        className="user-card-btn user-card-btn-edit"
                                        onClick={() => navigate(`${basePath}/users/${user.id}?edit=true`)}
                                    >
                                        <PencilSimple size={16} />
                                        تعديل
                                    </button>
                                    <button
                                        className="user-card-btn user-card-btn-delete"
                                        onClick={() => setDeleteModalState({ open: true, user, loading: false })}
                                    >
                                        <Trash size={16} />
                                        حذف
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {deleteModalState.open && deleteModalState.user && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 10000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
                }}>
                    <div style={{
                        background: '#fff', borderRadius: '16px', maxWidth: '420px', width: '100%',
                        padding: '1.5rem', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                            <WarningCircle size={32} weight="bold" />
                        </div>
                        <h3 style={{ margin: '0 0 0.5rem 0', color: '#111827', fontSize: '1.25rem', fontWeight: 800 }}>
                            تأكيد حذف المستخدم
                        </h3>
                        <p style={{ color: '#4b5563', fontSize: '0.95rem', lineHeight: 1.5, margin: '0 0 1.5rem 0' }}>
                            هل أنت متأكد من رغبتك في حذف حساب المستخدم <strong>{deleteModalState.user.first_name} {deleteModalState.user.last_name || ''}</strong> (<code>@{deleteModalState.user.username}</code>)؟ لا يمكن التراجع عن هذا الإجراء.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                type="button"
                                disabled={deleteModalState.loading}
                                onClick={() => setDeleteModalState({ open: false, user: null, loading: false })}
                                style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                                إلغاء
                            </button>
                            <button
                                type="button"
                                disabled={deleteModalState.loading}
                                onClick={handleConfirmDelete}
                                style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, cursor: deleteModalState.loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                            >
                                {deleteModalState.loading ? 'جاري الحذف...' : 'تأكيد الحذف'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '0.95rem',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.18)'
                }}>
                    <Check size={20} color="#8fc97e" weight="bold" />
                    <span>{toastMessage}</span>
                </div>
            )}

            <CreateUserModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onUserCreated={handleUserCreated}
                centers={centers}
            />
        </div>
    );
};

export default UsersManagement;
