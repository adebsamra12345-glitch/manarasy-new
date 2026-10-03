import { House, Buildings, CreditCard, Heartbeat, SignOut, User } from '@phosphor-icons/react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import UserProfileRoleSwitcher from '../common/UserProfileRoleSwitcher';
import BrandLogo from '../common/BrandLogo';

const SuperAdminSidebar = () => {
    const { logout } = useAuthContext();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    return (
        <aside id="super-admin-sidebar" className="sidebar-container hide-on-mobile">
            <div className="sidebar-logo">
                <BrandLogo size={36} />
                <span>مَنَارَة</span>
            </div>

            <UserProfileRoleSwitcher />

            <nav className="nav-menu">
                <NavLink to="/super/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <House size={20} />
                    الرئيسية
                </NavLink>
                <NavLink to="/super/tenants" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Buildings size={20} />
                    إدارة المساجد
                </NavLink>
                <NavLink to="/super/invoices" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <CreditCard size={20} />
                    الاشتراكات والفواتير
                </NavLink>
                <NavLink to="/super/health" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Heartbeat size={20} />
                    صحة النظام
                </NavLink>
                <NavLink to="/super/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <User size={20} />
                    الملف الشخصي
                </NavLink>
            </nav>

            <div className="sidebar-bottom">
                <button
                    className="nav-item"
                    onClick={handleLogout}
                    style={{ background: 'none', border: 'none', width: '100%', textAlign: 'right', cursor: 'pointer', color: '#e57373', fontFamily: 'inherit', fontSize: '1rem' }}
                >
                    <SignOut size={20} />
                    تسجيل الخروج
                </button>
            </div>
        </aside>
    );
};

export default SuperAdminSidebar;
