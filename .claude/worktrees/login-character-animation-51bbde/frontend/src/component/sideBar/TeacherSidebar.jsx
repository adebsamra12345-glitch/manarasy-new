import { House, CalendarBlank, Books, Users, SignOut } from '@phosphor-icons/react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';

const TeacherSidebar = () => {
    const { user, logout } = useAuthContext();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    const displayName = user?.username || localStorage.getItem('username') || 'معلم';

    return (
        <aside id="teacher-sidebar" className="sidebar-container hide-on-mobile">
            <div className="sidebar-logo">
                <img src="https://ui-avatars.com/api/?name=م&background=133315&color=fff&rounded=true" alt="شعار منارة" />
                <span>مَنَارَة</span>
            </div>

            <div className="user-profile">
                <img src={`https://ui-avatars.com/api/?name=${displayName}&background=2d6a4f&color=fff&rounded=true`} alt={displayName} />
                <div className="user-info">
                    <h3>{displayName}</h3>
                    <p>معلم حلقة</p>
                </div>
            </div>

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
