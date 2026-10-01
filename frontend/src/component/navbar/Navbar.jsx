import { useState } from 'react';
import { House, Books, Users, CalendarBlank, DotsThree, User, Bell, SignOut, X } from '@phosphor-icons/react';
import { NavLink, useNavigate } from 'react-router-dom';

import { useAuthContext } from '../../context/AuthContext';

export const MobileTopbar = () => {
    const { user, role, logout } = useAuthContext();
    const navigate = useNavigate();
    const [showMenu, setShowMenu] = useState(false);
    const displayName = user?.first_name || user?.username || localStorage.getItem('username') || 'المستخدم';

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <>
            <header id="mobile-topbar-container" className="mobile-topbar hide-on-desktop">
                <div className="mobile-topbar-left">
                    <div 
                        id="btn-mobile-user-profile"
                        className="icon-btn" 
                        onClick={() => setShowMenu(prev => !prev)}
                        style={{ cursor: 'pointer' }}
                        title="الملف الشخصي"
                    >
                        <User size={20} />
                    </div>
                    <div className="icon-btn">
                        <Bell size={20} />
                        <span className="badge"></span>
                    </div>
                </div>
                <div className="mobile-topbar-right" onClick={() => setShowMenu(prev => !prev)} style={{ cursor: 'pointer' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-green)' }}>مَنَارَة</h2>
                    <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=133315&color=fff&rounded=true`} alt="شعار منارة" width="30" height="30" />
                </div>
            </header>

            {/* Mobile User Dropdown Modal */}
            {showMenu && (
                <>
                    <div 
                        onClick={() => setShowMenu(false)} 
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 9998, backdropFilter: 'blur(2px)' }} 
                    />
                    <div style={{
                        position: 'fixed', top: '4rem', right: '1rem', left: '1rem',
                        background: '#fff', borderRadius: '16px', padding: '1.2rem',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.15)', zIndex: 9999,
                        direction: 'rtl', animation: 'fadeInDown 0.2s ease', border: '1px solid #eee'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #f0f0f0', paddingBottom: '0.8rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=133315&color=fff&rounded=true`} alt="User" width="40" height="40" style={{ borderRadius: '50%' }} />
                                <div>
                                    <div style={{ fontWeight: '700', fontSize: '1rem', color: '#133315' }}>{displayName}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#777' }}>
                                        {role === 'teacher' ? 'معلم / محفظ' : role === 'tenant_admin' ? 'مدير المنشأة' : role === 'parent' ? 'ولي أمر' : role || 'مستخدم'}
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setShowMenu(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <button
                            id="btn-mobile-logout"
                            onClick={handleLogout}
                            style={{
                                width: '100%', padding: '0.75rem', borderRadius: '10px',
                                border: '1.5px solid #c62828', background: '#ffebee', color: '#c62828',
                                fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                fontFamily: 'inherit'
                            }}
                        >
                            <SignOut size={20} weight="bold" />
                            تسجيل الخروج
                        </button>
                    </div>
                </>
            )}
        </>
    );
};

export const MobileNavbar = () => {
    const { role } = useAuthContext();
    const normalizedRole = role ? role.toLowerCase() : '';

    let items = [
        { to: '/dashboard', label: 'الرئيسية', icon: House },
        { to: '/rings', label: 'الحلقات', icon: Books },
        { to: '/students', label: 'الطلاب', icon: Users },
        { to: '/sessions', label: 'الجلسات', icon: CalendarBlank },
    ];

    if (normalizedRole === 'teacher') {
        items = [
            { to: '/teacher/dashboard', label: 'الرئيسية', icon: House },
            { to: '/teacher/rings', label: 'الحلقات', icon: Books },
            { to: '/teacher/students', label: 'الطلاب', icon: Users },
        ];
    } else if (normalizedRole === 'tenant_admin') {
        items = [
            { to: '/admin/dashboard', label: 'الرئيسية', icon: House },
            { to: '/admin/rings', label: 'الحلقات', icon: Books },
            { to: '/admin/students', label: 'الطلاب', icon: Users },
            { to: '/admin/users', label: 'المستخدمين', icon: CalendarBlank },
        ];
    } else if (normalizedRole === 'parent') {
        items = [
            { to: '/parent/dashboard', label: 'الرئيسية', icon: House },
            { to: '/parent/report', label: 'التقرير', icon: Books },
            { to: '/parent/plan', label: 'الخطة', icon: CalendarBlank },
            { to: '/parent/notifications', label: 'الإشعارات', icon: Bell },
        ];
    }

    return (
        <nav id="mobile-navbar-container" className="mobile-navbar hide-on-desktop">
            {items.map((item, idx) => {
                const IconComp = item.icon;
                return (
                    <NavLink key={idx} to={item.to} className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
                        <IconComp size={24} />
                        <span>{item.label}</span>
                    </NavLink>
                );
            })}
        </nav>
    );
};
