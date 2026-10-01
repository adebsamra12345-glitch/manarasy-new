import { House, Books, Users, CalendarBlank, DotsThree, User, Bell } from '@phosphor-icons/react';
import { NavLink } from 'react-router-dom';

export const MobileTopbar = () => {
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
                <img src="https://ui-avatars.com/api/?name=م&background=133315&color=fff&rounded=true" alt="شعار منارة" width="30" height="30" />
            </div>
        </header>
    );
};

export const MobileNavbar = () => {
    return (
        <nav id="mobile-navbar-container" className="mobile-navbar hide-on-desktop">
            <NavLink to="/dashboard" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
                <House size={24} weight="fill" />
                <span>الرئيسية</span>
            </NavLink>
            <NavLink to="/rings" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
                <Books size={24} />
                <span>الحلقات</span>
            </NavLink>
            <NavLink to="/students" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
                <Users size={24} />
                <span>الطلاب</span>
            </NavLink>
            <NavLink to="/sessions" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
                <CalendarBlank size={24} />
                <span>الجلسات</span>
            </NavLink>
            <button className="mobile-nav-item" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                <DotsThree size={24} />
                <span>المزيد</span>
            </button>
        </nav>
    );
};
