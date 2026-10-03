import { House, CalendarBlank, Books, Users, SignOut, User } from '@phosphor-icons/react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import UserProfileRoleSwitcher from '../common/UserProfileRoleSwitcher';
import BrandLogo from '../common/BrandLogo';

const TeacherSidebar = () => {
    const { logout } = useAuthContext();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    return (
        <aside id="teacher-sidebar" className="sidebar-container hide-on-mobile">
            <div className="sidebar-logo">
                <BrandLogo size={36} />
                <span>مَنَارَة</span>
            </div>

            <UserProfileRoleSwitcher />

            <nav className="nav-menu">
                <NavLink to="/teacher/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <House size={20} />
                    الرئيسية
                </NavLink>
                <NavLink to="/teacher/rings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Books size={20} />
                    الحلقات
                </NavLink>
                <NavLink to="/teacher/students" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Users size={20} />
                    الطلاب
                </NavLink>
                <NavLink to="/teacher/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <User size={20} />
                    الملف الشخصي
                </NavLink>
                {/* 
                <NavLink to="/teacher/sessions" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <CalendarBlank size={20} />
                    الجلسات
                </NavLink> 
                */}
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

export default TeacherSidebar;
