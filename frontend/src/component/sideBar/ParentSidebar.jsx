import { House, BookOpen, Bell, Star, SignOut, User, Gift, Trophy } from '@phosphor-icons/react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import UserProfileRoleSwitcher from '../common/UserProfileRoleSwitcher';

const ParentSidebar = () => {
    const { logout } = useAuthContext();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    return (
        <aside id="parent-sidebar" className="sidebar-container hide-on-mobile">
            <div className="sidebar-logo">
                <img src="https://ui-avatars.com/api/?name=م&background=133315&color=fff&rounded=true" alt="شعار منارة" />
                <span>مَنَارَة</span>
            </div>

            <UserProfileRoleSwitcher />

            <nav className="nav-menu">
                <NavLink to="/parent/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <House size={20} />
                    الرئيسية
                </NavLink>
                <NavLink to="/parent/report" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <BookOpen size={20} />
                    كشف المتابعة والدرجات
                </NavLink>
                <NavLink to="/parent/competitions" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Trophy size={20} />
                    المسابقات القرآنية
                </NavLink>
                <NavLink to="/parent/plan" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Star size={20} />
                    خطة الحفظ
                </NavLink>
                <NavLink to="/parent/notifications" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Bell size={20} />
                    الإشعارات
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

export default ParentSidebar;
