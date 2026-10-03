import { House, BookOpen, Bell, SignOut, Trophy } from '@phosphor-icons/react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import UserProfileRoleSwitcher from '../common/UserProfileRoleSwitcher';
import BrandLogo from '../common/BrandLogo';

const StudentSidebar = () => {
    const { logout } = useAuthContext();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    return (
        <aside id="student-sidebar" className="sidebar-container hide-on-mobile">
            <div className="sidebar-logo">
                <BrandLogo size={36} />
                <span>مَنَارَة</span>
            </div>

            <UserProfileRoleSwitcher />

            <nav className="nav-menu">
                <NavLink to="/student/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <House size={20} />
                    الرئيسية
                </NavLink>
                <NavLink to="/student/report" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <BookOpen size={20} />
                    كشف المتابعة والدرجات
                </NavLink>
                <NavLink to="/student/competitions" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Trophy size={20} />
                    المسابقات القرآنية
                </NavLink>
                <NavLink to="/student/notifications" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
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

export default StudentSidebar;
