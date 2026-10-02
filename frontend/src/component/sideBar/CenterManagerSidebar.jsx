import { 
    House, Users, GraduationCap, ChalkboardTeacher, 
    Books, CalendarBlank, Medal, ChartBar, Gear, Sparkle, SignOut, User 
} from '@phosphor-icons/react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import UserProfileRoleSwitcher from '../common/UserProfileRoleSwitcher';

const CenterManagerSidebar = () => {
    const { logout } = useAuthContext();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    // مطابقة صريحة ونظيفة للمسارات لتفادي أي تداخل برمجي في الـ Active State
    const isRingsActive = location.pathname.startsWith('/center-manager/rings');
    const isSessionsActive = location.pathname.startsWith('/center-manager/sessions');

    return (
        <aside id="desktop-sidebar-container" className="sidebar-container hide-on-mobile">
            <div className="sidebar-logo">
                <img src="https://ui-avatars.com/api/?name=م&background=133315&color=fff&rounded=true" alt="شعار منارة" />
                <span>مَنَارَة</span>
            </div>
            
            <UserProfileRoleSwitcher />
            
            <nav className="nav-menu">
                <NavLink to="/center-manager/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <House size={20} />
                    <span>الرئيسية</span>
                </NavLink>
                <NavLink to="/center-manager/students" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <GraduationCap size={20} />
                    <span>الطلاب</span>
                </NavLink>
                <NavLink to="/center-manager/teachers" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <ChalkboardTeacher size={20} />
                    <span>المعلمون</span>
                </NavLink>
                <NavLink to="/center-manager/rings" className={`nav-item ${isRingsActive ? 'active' : ''}`}>
                    <Books size={20} />
                    <span>الحلقات</span>
                </NavLink>
                <NavLink to="/center-manager/sessions" className={`nav-item ${isSessionsActive ? 'active' : ''}`}>
                    <CalendarBlank size={20} />
                    <span>الجلسات</span>
                </NavLink>
                <NavLink to="/center-manager/rewards" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Medal size={20} />
                    <span>النقاط والمكافآت</span>
                </NavLink>
                <NavLink to="/center-manager/reports" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <ChartBar size={20} />
                    <span>التقارير</span>
                </NavLink>
                <NavLink to="/center-manager/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Gear size={20} />
                    <span>الإعدادات</span>
                </NavLink>
                <NavLink to="/center-manager/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <User size={20} />
                    <span>الملف الشخصي</span>
                </NavLink>
            </nav>
            
            <div className="sidebar-bottom">
                <button className="smart-assistant-btn">
                    <Sparkle size={20} weight="fill" />
                    <span>مساعد منارة الذكي</span>
                </button>
                
                <div className="bottom-nav" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.75rem' }}>
                    <NavLink to="/center-manager/settings" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.9rem' }}>
                        <Gear size={18} />
                        <span>الإعدادات</span>
                    </NavLink>
                    <button
                        onClick={handleLogout}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e57373', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem' }}
                    >
                        <span>الخروج</span>
                        <SignOut size={18} style={{ transform: 'scaleX(-1)' }} />
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default CenterManagerSidebar;
