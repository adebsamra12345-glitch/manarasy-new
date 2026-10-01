import { 
    House, Users, FolderStar, GraduationCap, ChalkboardTeacher, 
    Books, MapPin, CalendarBlank, Medal, ChartBar, Gear, Sparkle, SignOut 
} from '@phosphor-icons/react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';

const TenantAdminSidebar = () => {
    const { user, logout } = useAuthContext();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    const displayName = user?.username || localStorage.getItem('username') || 'مدير النظام';

    return (
        <aside id="desktop-sidebar-container" className="sidebar-container hide-on-mobile">
            <div className="sidebar-logo">
                <img src="https://ui-avatars.com/api/?name=م&background=133315&color=fff&rounded=true" alt="شعار منارة" />
                <span>مَنَارَة</span>
            </div>
            
            <div className="user-profile">
                <img src={`https://ui-avatars.com/api/?name=${displayName}&background=1a5c1e&color=fff&rounded=true`} alt={displayName} />
                <div className="user-info">
                    <h3>{displayName}</h3>
                    <p>مدير الحلقة</p>
                </div>
            </div>
            
            <nav className="nav-menu">
                <NavLink to="/admin/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <House size={20} />
                    الرئيسية
                </NavLink>
                <NavLink to="/admin/teachers" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <ChalkboardTeacher size={20} />
                    المعلمون
                </NavLink>
                <NavLink to="/admin/rings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Books size={20} />
                    الحلقات
                </NavLink>
                <NavLink to="/admin/students" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <GraduationCap size={20} />
                    الطلاب
                </NavLink>
                <NavLink to="/admin/centers" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <MapPin size={20} />
                    المراكز
                </NavLink>
                <NavLink to="/admin/projects" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <FolderStar size={20} />
                    المشاريع
                </NavLink>
                <NavLink to="/admin/rewards" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Medal size={20} />
                    النقاط والمكافآت
                </NavLink>
                <NavLink to="/admin/reports" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <ChartBar size={20} />
                    التقارير
                </NavLink>
                <NavLink to="/admin/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Gear size={20} />
                    الإعدادات
                </NavLink>
            </nav>
            
            <div className="sidebar-bottom">
                <button className="smart-assistant-btn">
                    <Sparkle size={20} weight="fill" />
                    مساعد منارة الذكي
                </button>
                
                <div className="bottom-nav">
                    <button
                        className="nav-item"
                        onClick={handleLogout}
                        style={{ padding: '12px 0', color: '#e57373', background: 'none', border: 'none', width: '100%', textAlign: 'right', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem' }}
                    >
                        الخروج
                        <SignOut size={20} style={{ transform: 'scaleX(-1)' }} />
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default TenantAdminSidebar;
