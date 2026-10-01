import { House, Books, Users, CalendarBlank, DotsThree, User, Bell } from '@phosphor-icons/react';
import { NavLink } from 'react-router-dom';

import { useAuthContext } from '../context/AuthContext';

export const MobileTopbar = () => {
    const { user } = useAuthContext();
    const displayName = user?.first_name || user?.username || localStorage.getItem('username') || 'المستخدم';

    return (
        <header id="mobile-topbar-container" className="mobile-topbar hide-on-desktop">
            <div className="mobile-topbar-left">
                <div className="icon-btn">
                    <User size={20} />
                </div>
                <div className="icon-btn">
                    <Bell size={20} />
                    <span className="badge"></span>
                </div>
            </div>
            <div className="mobile-topbar-right">
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-green)' }}>مَنَارَة</h2>
                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=133315&color=fff&rounded=true`} alt="شعار منارة" width="30" height="30" />
            </div>
        </header>
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
