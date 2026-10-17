import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ClipboardText, Mosque, SignOut } from '@phosphor-icons/react';
import { usePlatformAuth } from '../../../context/PlatformAuthContext';
import './mobilePlatform.css';

const MobilePlatformLayout = () => {
    const { admin, logout } = usePlatformAuth();
    const navigate = useNavigate();

    const doLogout = async () => {
        await logout();
        navigate('/platform/login', { replace: true });
    };

    return (
        <div className="pl-m-shell">
            {/* الشريط العلوي */}
            <header className="pl-m-header">
                <div className="pl-m-brand">
                    <span className="pl-m-logo-star">✦</span>
                    <span className="pl-m-title">مَنَارَة</span>
                    <span className="pl-m-badge">المنصة</span>
                </div>
                <div className="pl-m-user-meta">
                    <span className="pl-m-user-email" title={admin?.email}>
                        {admin?.full_name || admin?.email?.split('@')[0]}
                    </span>
                    <button type="button" className="pl-m-btn-logout" onClick={doLogout} aria-label="خروج">
                        <SignOut size={18} weight="bold" />
                    </button>
                </div>
            </header>

            {/* محتوى الشاشة */}
            <main className="pl-m-main">
                <Outlet />
            </main>

            {/* شريط التنقل السفلي المريح للإبهام */}
            <nav className="pl-m-bottom-nav">
                <NavLink
                    to="/platform/requests"
                    className={({ isActive }) => `pl-m-nav-item ${isActive ? 'active' : ''}`}
                >
                    <ClipboardText size={22} weight="duotone" />
                    <span>طلبات التسجيل</span>
                </NavLink>
                <NavLink
                    to="/platform/mosques"
                    className={({ isActive }) => `pl-m-nav-item ${isActive ? 'active' : ''}`}
                >
                    <Mosque size={22} weight="duotone" />
                    <span>المساجد</span>
                </NavLink>
            </nav>
        </div>
    );
};

export default MobilePlatformLayout;
