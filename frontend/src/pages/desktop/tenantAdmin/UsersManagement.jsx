import React, { useState, useEffect } from 'react';
import { MagnifyingGlass, Funnel, UserCircle, Plus, CaretDown, MapPin, Bell, Check } from '@phosphor-icons/react';
import { getUsers } from '../../../services/api/userService';
import { getTenantList } from '../../../services/api/tenantService';
import { useNavigate, useLocation } from 'react-router-dom';
import { getMosqueAdminDashboardData } from '../../../services/api/tenantService';
import CreateUserModal from './CreateUserModal';

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

    const handleRoleFilter = (e) => {
        setSelectedRole(e.target.value);
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
            return <span style={{ background: '#7cb342', color: '#fff', padding: '0.3rem 1.2rem', borderRadius: '4px', fontSize: '0.85rem' }}>نشط</span>;
        }
        return <span style={{ background: '#e53935', color: '#fff', padding: '0.3rem 1.2rem', borderRadius: '4px', fontSize: '0.85rem' }}>معطل</span>;
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
        <div className="dashboard-container" style={{ direction: 'rtl' }}>
            {/* Header matches Dashboard */}
            <div className="dashboard-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1.25rem',
                marginBottom: '2rem'
            }}>
                <div className="greeting">
                    <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#133315', margin: 0, marginBottom: '0.4rem', letterSpacing: '-0.3px' }}>
                        السلام عليكم، أ. {currentUserName}
                    </h1>
                    <p style={{ color: '#718096', fontSize: '0.95rem', margin: 0, fontWeight: 500 }}>
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

            {/* Title & Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h2 style={{ fontSize: '2.2rem', color: '#133315', margin: 0, fontWeight: 'bold' }}>المستخدمون</h2>

                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '24px', padding: '0.5rem 1rem', width: '300px', marginRight: '2rem' }}>
                        <MagnifyingGlass size={18} color="#a0aec0" style={{ position: 'absolute', left: '1rem' }} />
                        <input
                            type="text"
                            placeholder="ابحث عن مستخدم ..."
                            value={searchQuery}
                            onChange={handleSearch}
                            style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: '0.95rem' }}
                        />
                    </div>

                    <button style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem 0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#718096' }}>
                        <Funnel size={20} />
                    </button>
                </div>

                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    style={{ background: '#558b2f', color: '#fff', border: 'none', padding: '0.6rem 1.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}
                >
                    <Plus size={16} />
                    إضافة مستخدم
                </button>
            </div>

            {/* Users Table */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                    <thead>
                        <tr style={{ background: '#e2e8f0', color: '#4a5568', fontSize: '0.95rem' }}>
                            <th style={{ padding: '1rem', borderBottom: '1px solid #cbd5e0', width: '60px' }}>م</th>
                            <th style={{ padding: '1rem', borderBottom: '1px solid #cbd5e0', borderRight: '1px solid #cbd5e0' }}>اسم المستخدم</th>
                            <th style={{ padding: '1rem', borderBottom: '1px solid #cbd5e0', borderRight: '1px solid #cbd5e0' }}>البريد الإلكتروني</th>
                            <th style={{ padding: '1rem', borderBottom: '1px solid #cbd5e0', borderRight: '1px solid #cbd5e0', width: '150px' }}>الأدوار</th>
                            <th style={{ padding: '1rem', borderBottom: '1px solid #cbd5e0', borderRight: '1px solid #cbd5e0', width: '100px' }}>الحالة</th>
                            <th style={{ padding: '1rem', borderBottom: '1px solid #cbd5e0', borderRight: '1px solid #cbd5e0', width: '150px' }}>رقم الهاتف</th>
                            <th style={{ padding: '1rem', borderBottom: '1px solid #cbd5e0', borderRight: '1px solid #cbd5e0', width: '180px' }}>أخر تسجيل دخول</th>
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
                                const formattedDate = new Date(user.created_at).toLocaleString('ar-EG', {
                                    year: 'numeric', month: 'numeric', day: 'numeric',
                                    hour: 'numeric', minute: 'numeric', hour12: true
                                });

                                return (
                                    <tr key={user.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '1rem', color: '#718096' }}>{index + 1}</td>
                                        <td style={{ padding: '1rem 1.5rem 1rem 1rem', borderRight: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.8rem', justifyContent: 'flex-start' }}>
                                            <div style={{ color: '#2b6cb0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => navigate(`${basePath}/users/${user.id}`)}>
                                                <UserCircle size={28} />
                                            </div>
                                            <span style={{ fontWeight: '600', color: '#2d3748', cursor: 'pointer' }} onClick={() => navigate(`${basePath}/users/${user.id}`)}>
                                                {user.first_name} {user.last_name}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem', borderRight: '1px solid #e2e8f0', color: '#718096' }}>{user.email || '—'}</td>
                                        <td style={{ padding: '1rem', borderRight: '1px solid #e2e8f0' }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                                                {Array.from(new Set(Array.isArray(user.roles) && user.roles.length > 0 ? user.roles : [user.role])).map((r) => {
                                                    const style = getRoleBadgeStyle(r);
                                                    return (
                                                        <span
                                                            key={r}
                                                            style={{
                                                                ...style,
                                                                padding: '0.25rem 0.65rem',
                                                                borderRadius: '12px',
                                                                fontSize: '0.8rem',
                                                                fontWeight: '600',
                                                                whiteSpace: 'nowrap',
                                                                display: 'inline-block'
                                                            }}
                                                        >
                                                            {getRoleName(r)}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem', borderRight: '1px solid #e2e8f0' }}>
                                            {getStatusBadge(user.is_active)}
                                        </td>
                                        <td style={{ padding: '1rem', borderRight: '1px solid #e2e8f0', color: '#a0aec0', fontSize: '0.9rem' }}>
                                            {user.phone || '—'}
                                        </td>
                                        <td style={{ padding: '1rem', borderRight: '1px solid #e2e8f0', color: '#a0aec0', fontSize: '0.85rem' }}>
                                            {formattedDate}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
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
