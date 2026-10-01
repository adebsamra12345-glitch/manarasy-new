import { House, Buildings, CreditCard, Heartbeat, SignOut } from '@phosphor-icons/react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';

const SuperAdminSidebar = () => {
    const { user, logout } = useAuthContext();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    const displayName = user?.username || localStorage.getItem('username') || 'Super Admin';

    return (
        <aside id="super-admin-sidebar" className="sidebar-container hide-on-mobile">
            <div className="sidebar-logo">
                <img src="https://ui-avatars.com/api/?name=م&background=133315&color=fff&rounded=true" alt="شعار منارة" />
                <span>مَنَارَة</span>
            </div>

            <div className="user-profile">
                <img src={`https://ui-avatars.com/api/?name=${displayName}&background=1a3a5c&color=fff&rounded=true`} alt={displayName} />
                <div className="user-info">
                    <h3>{displayName}</h3>
                    <p>مدير النظام الرئيسي</p>
                </div>
            </div>

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
